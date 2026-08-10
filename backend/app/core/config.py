"""Configuración central del motor de datos.

Todos los valores se pueden sobreescribir por variables de entorno, lo que
permite ajustar límites sin tocar el código (p. ej. en despliegue).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Parámetros de ejecución del backend."""

    app_name: str = "Motor de Datos Inteligente"
    version: str = "1.0.0"

    # Límites de ingesta
    max_upload_bytes: int = _env_int("MAX_UPLOAD_BYTES", 25 * 1024 * 1024)  # 25 MB
    max_rows: int = _env_int("MAX_ROWS", 200_000)
    max_columns: int = _env_int("MAX_COLUMNS", 200)
    # Filas que se envían al navegador para el modo reactivo en cliente.
    preview_rows: int = _env_int("PREVIEW_ROWS", 5_000)

    # Persistencia del historial. Si `database_url` está vacío, la aplicación
    # funciona con normalidad pero sin guardar nada.
    database_url: str = os.getenv("DATABASE_URL", "")
    # Tamaño máximo de un archivo que se guarda en el historial.
    max_bytes_historial: int = _env_int("MAX_BYTES_HISTORIAL", 8 * 1024 * 1024)
    # Entradas conservadas por cliente; al superarlas se descartan las antiguas.
    max_historial_por_cliente: int = _env_int("MAX_HISTORIAL", 25)

    # Ciclo de vida de los datasets en memoria
    dataset_ttl_seconds: int = _env_int("DATASET_TTL_SECONDS", 60 * 60)  # 1 h
    max_datasets: int = _env_int("MAX_DATASETS", 24)

    # Heurísticas de clasificación de variables
    # Un numérico con <= N valores únicos y sin decimales se considera discreto.
    discrete_max_unique: int = _env_int("DISCRETE_MAX_UNIQUE", 30)
    # Proporción de valores únicos a partir de la cual una columna se considera identificador.
    identifier_unique_ratio: float = 0.95

    cors_origins: list[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
            ],
        )
    )

    allowed_extensions: tuple[str, ...] = (".xlsx", ".xls", ".xlsm", ".csv", ".tsv", ".txt")


settings = Settings()
