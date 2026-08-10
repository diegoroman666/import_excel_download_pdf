"""Historial de análisis guardados en base de datos.

Se conserva el **archivo original comprimido**, no el análisis ya calculado.
Al reabrir una entrada se vuelve a procesar con el código vigente, de modo que
un archivo guardado hace meses nunca queda descrito por una versión antigua del
motor ni obliga a migrar esquemas cuando cambian los cálculos.

Todas las funciones son tolerantes a que no haya base de datos: en ese caso
devuelven un resultado vacío en lugar de fallar.
"""

from __future__ import annotations

import gzip
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.db.base import AnalisisGuardado, esta_activa, obtener_sesion
from app.models.schemas import EntradaHistorial

logger = logging.getLogger("motor-datos.historial")

#: Nivel de compresión: 6 es el equilibrio habitual entre tamaño y tiempo.
NIVEL_GZIP = 6


@dataclass
class ArchivoRecuperado:
    id: str
    nombre_archivo: str
    hoja: str | None
    contenido: bytes


def _a_entrada(fila: AnalisisGuardado) -> EntradaHistorial:
    return EntradaHistorial(
        id=fila.id,
        nombre_archivo=fila.nombre_archivo,
        hoja=fila.hoja,
        filas=fila.filas,
        columnas=fila.columnas,
        tamano_bytes=fila.tamano_bytes,
        creado_en=fila.creado_en.isoformat(),
        resumen_tipos=fila.resumen_tipos or {},
    )


def disponible() -> bool:
    """`True` si el historial puede usarse en esta instalación."""
    return esta_activa()


def guardar(
    *,
    cliente: str,
    nombre_archivo: str,
    hoja: str | None,
    contenido: bytes,
    filas: int,
    columnas: int,
    resumen_tipos: dict[str, int],
) -> str | None:
    """Persiste un archivo analizado. Devuelve su id, o ``None`` si no se guardó.

    No guardar nunca es un error para el usuario: el análisis en curso funciona
    igual. Por eso los fallos se registran pero no se propagan.
    """
    if not esta_activa():
        return None
    if len(contenido) > settings.max_bytes_historial:
        logger.info(
            "Archivo de %d bytes no guardado: supera el límite del historial.", len(contenido)
        )
        return None

    sesion = obtener_sesion()
    if sesion is None:
        return None

    identificador = uuid.uuid4().hex[:16]
    try:
        with sesion:
            sesion.add(
                AnalisisGuardado(
                    id=identificador,
                    cliente=cliente,
                    nombre_archivo=nombre_archivo,
                    hoja=hoja,
                    filas=filas,
                    columnas=columnas,
                    tamano_bytes=len(contenido),
                    resumen_tipos=resumen_tipos,
                    contenido=gzip.compress(contenido, NIVEL_GZIP),
                )
            )
            sesion.commit()
            _podar(sesion, cliente)
        return identificador
    except Exception as error:  # noqa: BLE001 - el historial nunca rompe la carga
        logger.warning("No se pudo guardar en el historial: %s", error)
        return None


def _podar(sesion, cliente: str) -> None:
    """Conserva sólo las entradas más recientes de cada cliente."""
    limite = settings.max_historial_por_cliente
    total = sesion.scalar(
        select(func.count()).select_from(AnalisisGuardado).where(AnalisisGuardado.cliente == cliente)
    )
    if not total or total <= limite:
        return

    sobrantes = sesion.scalars(
        select(AnalisisGuardado.id)
        .where(AnalisisGuardado.cliente == cliente)
        .order_by(AnalisisGuardado.creado_en.desc())
        .offset(limite)
    ).all()
    if sobrantes:
        sesion.execute(delete(AnalisisGuardado).where(AnalisisGuardado.id.in_(sobrantes)))
        sesion.commit()


def listar(cliente: str) -> list[EntradaHistorial]:
    """Entradas del cliente, de la más reciente a la más antigua."""
    if not esta_activa():
        return []

    sesion = obtener_sesion()
    if sesion is None:
        return []

    try:
        with sesion:
            filas = sesion.scalars(
                select(AnalisisGuardado)
                .where(AnalisisGuardado.cliente == cliente)
                .order_by(AnalisisGuardado.creado_en.desc())
                .limit(settings.max_historial_por_cliente)
            ).all()
            return [_a_entrada(fila) for fila in filas]
    except Exception as error:  # noqa: BLE001
        logger.warning("No se pudo leer el historial: %s", error)
        return []


def recuperar(cliente: str, identificador: str) -> ArchivoRecuperado | None:
    """Devuelve el archivo original de una entrada, o ``None`` si no existe.

    Se exige que la entrada pertenezca al cliente: así el identificador de otra
    persona no sirve para leer su archivo.
    """
    if not esta_activa():
        return None

    sesion = obtener_sesion()
    if sesion is None:
        return None

    try:
        with sesion:
            fila = sesion.scalar(
                select(AnalisisGuardado).where(
                    AnalisisGuardado.id == identificador,
                    AnalisisGuardado.cliente == cliente,
                )
            )
            if fila is None:
                return None
            return ArchivoRecuperado(
                id=fila.id,
                nombre_archivo=fila.nombre_archivo,
                hoja=fila.hoja,
                contenido=gzip.decompress(fila.contenido),
            )
    except Exception as error:  # noqa: BLE001
        logger.warning("No se pudo recuperar la entrada %s: %s", identificador, error)
        return None


def eliminar(cliente: str, identificador: str) -> bool:
    """Borra una entrada del historial del cliente."""
    if not esta_activa():
        return False

    sesion = obtener_sesion()
    if sesion is None:
        return False

    try:
        with sesion:
            resultado = sesion.execute(
                delete(AnalisisGuardado).where(
                    AnalisisGuardado.id == identificador,
                    AnalisisGuardado.cliente == cliente,
                )
            )
            sesion.commit()
            return resultado.rowcount > 0
    except Exception as error:  # noqa: BLE001
        logger.warning("No se pudo eliminar la entrada %s: %s", identificador, error)
        return False


def vaciar(cliente: str) -> int:
    """Borra todo el historial del cliente y devuelve cuántas entradas quitó."""
    if not esta_activa():
        return 0

    sesion = obtener_sesion()
    if sesion is None:
        return 0

    try:
        with sesion:
            resultado = sesion.execute(
                delete(AnalisisGuardado).where(AnalisisGuardado.cliente == cliente)
            )
            sesion.commit()
            return int(resultado.rowcount or 0)
    except Exception as error:  # noqa: BLE001
        logger.warning("No se pudo vaciar el historial: %s", error)
        return 0
