"""Descarga de los datasets de muestra (5 Excel + 5 CSV)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, status
from fastapi.responses import Response

from app.core.descargas import cabecera_descarga
from app.models.schemas import CatalogoMuestras
from app.services import samples

router = APIRouter(prefix="/muestras", tags=["muestras"])

_MEDIOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
}


@router.get("", response_model=CatalogoMuestras, summary="Catálogo de archivos de muestra")
def catalogo() -> CatalogoMuestras:
    return samples.construir_catalogo()


@router.get("/{muestra_id}/{formato}", summary="Descargar un archivo de muestra")
def descargar(
    muestra_id: Annotated[str, Path(description="Identificador de la muestra")],
    formato: Literal["xlsx", "csv"],
) -> Response:
    resultado = samples.generar_archivo(muestra_id, formato)
    if resultado is None:
        disponibles = ", ".join(m.id for m in samples.MUESTRAS)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": f"No existe la muestra '{muestra_id}'.",
                "detalle": f"Muestras disponibles: {disponibles}.",
            },
        )

    contenido, nombre = resultado
    return Response(
        content=contenido,
        media_type=_MEDIOS[formato],
        headers=cabecera_descarga(nombre),
    )
