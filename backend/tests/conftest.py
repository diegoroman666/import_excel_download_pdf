from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd
import pytest

# Permite ejecutar `pytest` desde la carpeta backend/ sin instalar el paquete.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.store import almacen  # noqa: E402


@pytest.fixture(autouse=True)
def _limpiar_almacen():
    almacen.limpiar()
    yield
    almacen.limpiar()


@pytest.fixture
def df_mixto() -> pd.DataFrame:
    """Dataset pequeño con los cuatro tipos de variable."""
    return pd.DataFrame(
        {
            "ID Cliente": [f"C-{i:03d}" for i in range(1, 13)],
            "Ciudad": [
                "Lima", "Cusco", "Lima", "Piura", "Cusco", "Lima",
                "Piura", "Lima", "Cusco", "Piura", "Lima", "Cusco",
            ],
            "Nivel de Satisfacción": [
                "Alto", "Medio", "Bajo", "Alto", "Medio", "Alto",
                "Bajo", "Medio", "Alto", "Alto", "Medio", "Bajo",
            ],
            "Número de Compras": [3, 1, 5, 2, 4, 3, 1, 2, 6, 3, 2, 4],
            "Monto Total": [
                120.5, 45.0, 310.75, 88.2, 199.99, 150.3,
                42.1, 76.4, 420.0, 133.33, 91.7, 210.25,
            ],
        }
    )


@pytest.fixture
def csv_bytes(df_mixto: pd.DataFrame) -> bytes:
    return df_mixto.to_csv(index=False).encode("utf-8")


@pytest.fixture
def xlsx_bytes(df_mixto: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as escritor:
        df_mixto.to_excel(escritor, index=False, sheet_name="Datos")
    return buffer.getvalue()
