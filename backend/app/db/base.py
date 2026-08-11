"""Conexión a la base de datos y definición de tablas.

La persistencia es **opcional**: si no hay `DATABASE_URL`, la aplicación
funciona igual que antes (análisis en memoria) y los endpoints de historial
responden que la función no está disponible. Así el despliegue no depende de
tener una base de datos y el desarrollo local no la necesita.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import (
    JSON,
    DateTime,
    Index,
    Integer,
    LargeBinary,
    String,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger("motor-datos.db")


class Base(DeclarativeBase):
    pass


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class AnalisisGuardado(Base):
    """Un archivo analizado que el usuario decidió conservar.

    Se guarda el **archivo original** en lugar del análisis ya calculado: al
    reabrirlo se vuelve a procesar con el código vigente, de modo que una
    entrada antigua nunca queda descrita por una versión anterior del motor.
    """

    __tablename__ = "analisis_guardado"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    # Identificador anónimo del navegador: evita que el historial de una
    # persona sea visible para el resto. No hay cuentas ni datos personales.
    cliente: Mapped[str] = mapped_column(String(64), nullable=False)

    nombre_archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    hoja: Mapped[str | None] = mapped_column(String(120), nullable=True)
    filas: Mapped[int] = mapped_column(Integer, nullable=False)
    columnas: Mapped[int] = mapped_column(Integer, nullable=False)
    tamano_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Recuento por tipo de variable, para pintar la lista sin reprocesar nada.
    resumen_tipos: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    contenido: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    __table_args__ = (Index("ix_analisis_cliente_fecha", "cliente", "creado_en"),)


_motor = None
_Sesion: sessionmaker | None = None


#: Puerto del *pooler* de Supabase en modo transacción (Supavisor). El modo
#: sesión usa el 5432, igual que una conexión directa.
PUERTO_POOL_TRANSACCION = 6543

#: Parámetros que algunos paneles añaden a la cadena pero que libpq no conoce:
#: si llegan a psycopg, la conexión falla con «invalid connection option».
PARAMETROS_AJENOS = ("pgbouncer", "schema", "connection_limit", "pool_timeout")


def _normalizar_url(url: str) -> str:
    """Adapta la URL al driver instalado.

    Muchos proveedores (Render y Supabase entre ellos) entregan la cadena con
    el esquema `postgres://`, que SQLAlchemy 2 no reconoce, y con
    `postgresql://`, que apunta al driver psycopg2. Aquí se fuerza psycopg 3.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _es_postgres(url: str) -> bool:
    return url.startswith("postgresql")


def _partes(url: str):
    """`urlsplit` tolerante: devuelve ``None`` si la cadena no es interpretable.

    Una `DATABASE_URL` mal escrita es un error de configuración, no un motivo
    para tumbar el servicio. Como `urlsplit` lanza `ValueError` ante ciertas
    cadenas —por ejemplo si quedaron los corchetes del marcador
    `[YOUR-PASSWORD]`, que hacen que Python intente leer el anfitrión como una
    dirección IPv6—, todo el análisis de la URL pasa por aquí.
    """
    try:
        return urlsplit(url)
    except ValueError:
        return None


def _puerto(url: str) -> int | None:
    """Puerto de la URL, o ``None`` si no lo lleva o no es interpretable."""
    partes = _partes(url)
    if partes is None:
        return None
    try:
        return partes.port
    except ValueError:  # puerto no numérico: lo dirá el driver al conectar
        return None


def _usa_pool_de_transaccion(url: str) -> bool:
    """`True` si la cadena apunta a un pooler en modo transacción."""
    if _puerto(url) == PUERTO_POOL_TRANSACCION:
        return True
    partes = _partes(url)
    if partes is None:
        return False
    parametros = dict(parse_qsl(partes.query))
    return parametros.get("pgbouncer", "").lower() == "true"


def _sanear_parametros(url: str) -> str:
    """Quita parámetros que libpq rechaza y exige TLS si no se dijo otra cosa.

    Supabase sirve siempre por TLS, pero el valor por omisión de libpq
    (`prefer`) acepta degradar a texto plano. Fijar `require` evita que un
    fallo de negociación pase inadvertido.

    Si la cadena no es interpretable se devuelve tal cual: que el fallo lo
    reporte el driver al conectar, con el historial desactivado y el resto del
    servicio en pie.
    """
    if not _es_postgres(url):
        return url

    partes = _partes(url)
    if partes is None:
        return url

    parametros = [(clave, valor) for clave, valor in parse_qsl(partes.query) if clave not in PARAMETROS_AJENOS]
    if not any(clave == "sslmode" for clave, _ in parametros):
        parametros.append(("sslmode", "require"))
    return urlunsplit(partes._replace(query=urlencode(parametros)))


def _opciones_de_motor(url: str) -> dict:
    """Ajustes de `create_engine` apropiados para el destino."""
    if not _es_postgres(url):
        # SQLite (pruebas y uso local): sin parámetros de pool.
        return {}

    if _usa_pool_de_transaccion(url):
        # En modo transacción cada transacción puede caer en una conexión
        # distinta del servidor, así que ni el pool propio ni las sentencias
        # preparadas de psycopg sobreviven: sin `NullPool` y sin preparadas,
        # aparecen errores de «prepared statement ya existe».
        return {"poolclass": NullPool, "connect_args": {"prepare_threshold": None}}

    return {"pool_size": 5, "max_overflow": 5}


def _pista_de_conexion(url: str) -> str | None:
    """Explicación del fallo más habitual al conectar con Supabase."""
    if "[" in url or "]" in url:
        # Se comprueba antes de analizar la URL: los corchetes son justo lo que
        # impide analizarla.
        return (
            "La cadena lleva corchetes. Si copió la plantilla de Supabase, "
            "sustituya [YOUR-PASSWORD] —corchetes incluidos— por la contraseña. "
            "Si la contraseña los contiene de verdad, codifíquelos: [ es %5B y ] es %5D."
        )

    partes = _partes(url)
    if partes is None:
        return (
            "La cadena no se pudo interpretar: si la contraseña lleva caracteres "
            "especiales (@ : / # ?), hay que escribirla codificada en la URL."
        )

    anfitrion = partes.hostname or ""
    if anfitrion.startswith("db.") and anfitrion.endswith(".supabase.co"):
        return (
            "Esa es la conexión directa de Supabase, que sólo resuelve por IPv6. "
            "Si el proveedor del motor no tiene IPv6 (Render, entre otros), use la "
            "cadena del pooler: <region>.pooler.supabase.com. Véase docs/supabase.md."
        )
    return None


def hay_base_de_datos() -> bool:
    return bool(settings.database_url)


def inicializar(url: str | None = None) -> bool:
    """Crea el motor y las tablas. Devuelve ``True`` si la BD quedó lista.

    Ningún problema con la base de datos —ni de conexión, ni de credenciales,
    ni una `DATABASE_URL` mal escrita— debe tumbar el servicio: se registra y
    la aplicación sigue funcionando sin historial. Por eso *todo* el trabajo,
    incluido interpretar la cadena, ocurre dentro del `try`.
    """
    global _motor, _Sesion

    destino = url or settings.database_url
    if not destino:
        logger.info("Sin DATABASE_URL: el historial queda desactivado.")
        return False

    try:
        cadena = _sanear_parametros(_normalizar_url(destino))
        _motor = create_engine(
            cadena,
            pool_pre_ping=True,  # reconecta si el proveedor cerró la conexión
            future=True,
            **_opciones_de_motor(cadena),
        )
        Base.metadata.create_all(_motor)
        _Sesion = sessionmaker(bind=_motor, expire_on_commit=False, future=True)
        logger.info("Historial activo: base de datos conectada.")
        return True
    except Exception as error:  # noqa: BLE001 - cualquier fallo desactiva el historial
        logger.warning("Historial desactivado, la base de datos no respondió: %s", error)
        # La pista se calcula sobre la cadena original: si el fallo ocurrió al
        # interpretarla, la versión saneada no llegó a existir.
        pista = _pista_de_conexion(destino)
        if pista:
            logger.warning("%s", pista)
        _motor, _Sesion = None, None
        return False


def obtener_sesion():
    """Sesión de base de datos, o ``None`` si la persistencia está apagada."""
    if _Sesion is None:
        return None
    return _Sesion()


def esta_activa() -> bool:
    return _Sesion is not None


def cerrar() -> None:
    """Libera el pool de conexiones (usado en pruebas y al apagar el servicio)."""
    global _motor, _Sesion
    if _motor is not None:
        _motor.dispose()
    _motor, _Sesion = None, None
