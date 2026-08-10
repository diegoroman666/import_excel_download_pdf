"""Punto de entrada de la API del motor de datos.

Arranque en desarrollo:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import datasets, health, history, samples
from app.core.config import settings
from app.core.errors import DataEngineError
from app.db import base as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("motor-datos")


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    """Prepara la base de datos al arrancar y libera el pool al apagar.

    El historial es opcional: si no hay DATABASE_URL o la conexión falla, el
    servicio arranca igual y sólo se desactiva esa función.
    """
    db.inicializar()
    yield
    db.cerrar()


def crear_app() -> FastAPI:
    app = FastAPI(
        lifespan=ciclo_de_vida,
        title=settings.app_name,
        version=settings.version,
        description=(
            "Motor de análisis estadístico automático sobre Pandas: clasifica variables "
            "(nominal, ordinal, discreta, continua), calcula estadística descriptiva, "
            "aplica filtros reactivos y genera archivos de muestra."
        ),
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(DataEngineError)
    async def _manejar_error_dominio(_: Request, error: DataEngineError) -> JSONResponse:
        logger.warning("Error de dominio: %s", error.message)
        return JSONResponse(
            status_code=error.status_code,
            content={"error": error.message, "detalle": error.detail},
        )

    @app.exception_handler(Exception)
    async def _manejar_error_inesperado(_: Request, error: Exception) -> JSONResponse:
        logger.exception("Error no controlado", exc_info=error)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Ocurrió un error inesperado al procesar la solicitud.",
                "detalle": type(error).__name__,
            },
        )

    api_prefix = "/api"
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(datasets.router, prefix=api_prefix)
    app.include_router(history.router, prefix=api_prefix)
    app.include_router(samples.router, prefix=api_prefix)

    @app.get("/", include_in_schema=False)
    def raiz() -> dict[str, str]:
        return {"servicio": settings.app_name, "documentacion": "/docs", "salud": "/api/salud"}

    return app


app = crear_app()
