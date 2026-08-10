"""Conexión a la base de datos y definición de tablas.

La persistencia es **opcional**: si no hay `DATABASE_URL`, la aplicación
funciona igual que antes (análisis en memoria) y los endpoints de historial
responden que la función no está disponible. Así el despliegue no depende de
tener una base de datos y el desarrollo local no la necesita.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

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


def _normalizar_url(url: str) -> str:
    """Adapta la URL al driver instalado.

    Muchos proveedores (Render entre ellos) entregan la cadena con el esquema
    `postgres://`, que SQLAlchemy 2 no reconoce, y con `postgresql://`, que
    apunta al driver psycopg2. Aquí se fuerza psycopg 3.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def hay_base_de_datos() -> bool:
    return bool(settings.database_url)


def inicializar(url: str | None = None) -> bool:
    """Crea el motor y las tablas. Devuelve ``True`` si la BD quedó lista.

    Un fallo de conexión no debe tumbar el servicio: se registra y la
    aplicación sigue funcionando sin historial.
    """
    global _motor, _Sesion

    destino = url or settings.database_url
    if not destino:
        logger.info("Sin DATABASE_URL: el historial queda desactivado.")
        return False

    try:
        _motor = create_engine(
            _normalizar_url(destino),
            pool_pre_ping=True,  # reconecta si el proveedor cerró la conexión
            pool_size=5,
            max_overflow=5,
            future=True,
        )
        Base.metadata.create_all(_motor)
        _Sesion = sessionmaker(bind=_motor, expire_on_commit=False, future=True)
        logger.info("Historial activo: base de datos conectada.")
        return True
    except Exception as error:  # noqa: BLE001 - cualquier fallo desactiva el historial
        logger.warning("No se pudo conectar con la base de datos: %s", error)
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
