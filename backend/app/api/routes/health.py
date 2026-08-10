"""Diagnóstico del servicio."""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from app.core.config import settings
from app.services.store import almacen

router = APIRouter(tags=["sistema"])


@router.get("/salud", summary="Estado del motor de datos")
def salud() -> dict[str, object]:
    return {
        "estado": "ok",
        "servicio": settings.app_name,
        "version": settings.version,
        "pandas": pd.__version__,
        "datasets_en_memoria": len(almacen),
        "limites": {
            "max_filas": settings.max_rows,
            "max_columnas": settings.max_columns,
            "max_bytes": settings.max_upload_bytes,
            "filas_preview": settings.preview_rows,
        },
    }
