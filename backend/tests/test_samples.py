"""Pruebas de los datasets de muestra descargables."""

from __future__ import annotations

import io

import pandas as pd

from app.models.schemas import TipoVariable
from app.services import samples
from app.services.classification import clasificar_dataframe


def test_hay_exactamente_cinco_muestras():
    assert len(samples.MUESTRAS) == 5


def test_catalogo_ofrece_cinco_excel_y_cinco_csv():
    catalogo = samples.construir_catalogo()
    assert len(catalogo.excel) == 5
    assert len(catalogo.csv) == 5
    assert all(a.formato == "xlsx" for a in catalogo.excel)
    assert all(a.formato == "csv" for a in catalogo.csv)
    assert len({a.id for a in catalogo.excel}) == 5


def test_las_urls_del_catalogo_son_descargables():
    catalogo = samples.construir_catalogo()
    for archivo in catalogo.excel + catalogo.csv:
        assert archivo.url == f"/api/muestras/{archivo.id}/{archivo.formato}"
        assert samples.generar_archivo(archivo.id, archivo.formato) is not None


def test_excel_generado_es_legible_por_pandas():
    for definicion in samples.MUESTRAS:
        contenido, nombre = samples.generar_archivo(definicion.id, "xlsx")
        assert nombre.endswith(".xlsx")
        df = pd.read_excel(io.BytesIO(contenido))
        assert not df.empty and df.shape[1] >= 8


def test_csv_generado_es_legible_por_pandas():
    for definicion in samples.MUESTRAS:
        contenido, nombre = samples.generar_archivo(definicion.id, "csv")
        assert nombre.endswith(".csv")
        df = pd.read_csv(io.BytesIO(contenido))
        assert not df.empty


def test_generacion_determinista():
    primero, _ = samples.generar_archivo("ventas-retail", "csv")
    samples._CACHE.clear()
    segundo, _ = samples.generar_archivo("ventas-retail", "csv")
    assert primero == segundo


def test_muestra_inexistente_devuelve_none():
    assert samples.generar_archivo("no-existe", "csv") is None
    assert samples.generar_archivo("ventas-retail", "pdf") is None


def test_cada_muestra_contiene_los_cuatro_tipos_de_variable():
    """El clasificador debe encontrar los 4 tipos en cada dataset de muestra."""
    for definicion in samples.MUESTRAS:
        df = definicion.generador()
        tipos = {c.tipo for c in clasificar_dataframe(df).values()}
        faltantes = set(TipoVariable) - tipos
        assert not faltantes, f"{definicion.id} no cubre: {[t.value for t in faltantes]}"
