"""Endpoints del historial de análisis guardados."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.core.errors import DataEngineError
from app.models.schemas import ListaHistorial, RespuestaCarga
from app.services import history

router = APIRouter(prefix="/historial", tags=["historial"])

#: Motivo que se muestra en la UI cuando no hay base de datos configurada.
SIN_BASE_DE_DATOS = (
    "El historial necesita una base de datos. Defina DATABASE_URL en el servicio "
    "para activarlo; el análisis funciona igual sin ella."
)


def _cliente(valor: str | None) -> str:
    """Identificador anónimo del navegador que envía la petición.

    No es autenticación —cualquiera puede fabricarse uno—, pero impide que el
    historial de una persona aparezca en el navegador de otra, que es el riesgo
    real en una aplicación sin cuentas.
    """
    identificador = (valor or "").strip()
    if not identificador or len(identificador) > 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Falta el identificador de cliente.",
                "detalle": "La interfaz debe enviar la cabecera X-Cliente.",
            },
        )
    return identificador


@router.get("", response_model=ListaHistorial, summary="Análisis guardados")
def listar(x_cliente: Annotated[str | None, Header()] = None) -> ListaHistorial:
    if not history.disponible():
        return ListaHistorial(disponible=False, motivo=SIN_BASE_DE_DATOS)

    return ListaHistorial(disponible=True, entradas=history.listar(_cliente(x_cliente)))


@router.post(
    "/{entrada_id}/abrir",
    response_model=RespuestaCarga,
    summary="Reabrir un análisis guardado",
)
def abrir(
    entrada_id: str,
    x_cliente: Annotated[str | None, Header()] = None,
) -> RespuestaCarga:
    # La importación es local para evitar un ciclo entre los dos routers.
    from app.api.routes.datasets import procesar_contenido

    if not history.disponible():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "El historial no está disponible.", "detalle": SIN_BASE_DE_DATOS},
        )

    archivo = history.recuperar(_cliente(x_cliente), entrada_id)
    if archivo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "El análisis guardado ya no existe.",
                "detalle": "Puede haberse borrado desde otro dispositivo.",
            },
        )

    try:
        # Se reprocesa con el motor actual; no se vuelve a guardar para no
        # duplicar la entrada que ya existe.
        return procesar_contenido(
            contenido=archivo.contenido,
            nombre_archivo=archivo.nombre_archivo,
            hoja=archivo.hoja,
            cliente=None,
        )
    except DataEngineError as error:
        raise error.as_http() from error


@router.delete("/{entrada_id}", summary="Borrar un análisis guardado")
def eliminar(
    entrada_id: str,
    x_cliente: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    return {"eliminado": history.eliminar(_cliente(x_cliente), entrada_id)}


@router.delete("", summary="Vaciar el historial")
def vaciar(x_cliente: Annotated[str | None, Header()] = None) -> dict[str, int]:
    return {"eliminadas": history.vaciar(_cliente(x_cliente))}
