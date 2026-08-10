"""Pruebas de la estadística descriptiva y las tablas de frecuencia."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.models.schemas import TipoVariable
from app.services.statistics import (
    analizar_dataframe,
    calcular_moda,
    construir_tablas_frecuencia,
    filas_serializables,
    resumen_numerico,
    tabla_frecuencia_agrupada,
    tabla_frecuencia_no_agrupada,
)


def test_moda_multiple():
    assert calcular_moda(np.array([1.0, 1.0, 2.0, 2.0, 3.0])) == [1.0, 2.0]


def test_sin_moda_cuando_todos_los_valores_son_unicos():
    # La app original devolvía el primer valor como "moda"; aquí no hay moda.
    assert calcular_moda(np.array([1.0, 2.0, 3.0, 4.0])) == []


def test_resumen_numerico_valores_conocidos():
    resumen = resumen_numerico(pd.Series([2, 4, 4, 4, 5, 5, 7, 9]))
    assert resumen is not None
    assert resumen.conteo == 8
    assert resumen.media == 5.0
    assert resumen.mediana == 4.5
    assert resumen.moda == [4.0]
    assert resumen.minimo == 2.0
    assert resumen.maximo == 9.0
    assert resumen.rango == 7.0
    # Desviación estándar muestral (ddof=1) de la serie.
    assert round(resumen.desviacion_estandar, 4) == 2.1381
    assert resumen.q1 == 4.0 and resumen.q2 == 4.5 and resumen.q3 == 5.5
    assert resumen.deciles["d5"] == 4.5


def test_resumen_numerico_ignora_no_numericos_y_nulos():
    resumen = resumen_numerico(pd.Series([1.0, None, 3.0, float("nan")]))
    assert resumen is not None and resumen.conteo == 2 and resumen.media == 2.0


def test_resumen_numerico_serie_vacia():
    assert resumen_numerico(pd.Series([None, None], dtype="float64")) is None


def test_coeficiente_variacion_none_si_media_cero():
    resumen = resumen_numerico(pd.Series([-2.0, 2.0]))
    assert resumen is not None and resumen.coeficiente_variacion is None


def test_frecuencia_no_agrupada_acumulados():
    tabla = tabla_frecuencia_no_agrupada(pd.Series(["a", "b", "a", "c", "a"]))
    assert [f.valor for f in tabla] == ["a", "b", "c"]
    assert [f.frecuencia_absoluta for f in tabla] == [3, 1, 1]
    assert tabla[-1].frecuencia_acumulada == 5
    assert tabla[-1].frecuencia_relativa_acumulada == 1.0


def test_frecuencia_no_agrupada_respeta_escala_ordinal():
    serie = pd.Series(["Alto", "Bajo", "Medio", "Alto"])
    tabla = tabla_frecuencia_no_agrupada(serie, orden_categorias=["Bajo", "Medio", "Alto"])
    assert [f.valor for f in tabla] == ["Bajo", "Medio", "Alto"]


def test_frecuencia_ordena_por_escala_aunque_cambie_la_grafia():
    # La escala se guarda normalizada; los datos conservan tildes y mayúsculas.
    serie = pd.Series(["MUY ALTO", "bajo", "Medio", "Alto", "Muy bajo"])
    tabla = tabla_frecuencia_no_agrupada(
        serie, orden_categorias=["muy bajo", "bajo", "medio", "alto", "muy alto"]
    )
    assert [f.valor for f in tabla] == ["Muy bajo", "bajo", "Medio", "Alto", "MUY ALTO"]


def test_frecuencia_agrupada_no_duplica_valores_en_los_limites():
    valores = pd.Series(np.arange(0, 100, dtype=float))
    resultado = tabla_frecuencia_agrupada(valores)
    assert resultado is not None
    tabla, clases, amplitud = resultado
    # Cada observación cae en exactamente un intervalo.
    assert sum(f.frecuencia_absoluta for f in tabla) == 100
    assert tabla[-1].frecuencia_acumulada == 100
    assert clases == len(tabla)
    assert amplitud > 0


def test_frecuencia_agrupada_none_si_todos_los_valores_son_iguales():
    assert tabla_frecuencia_agrupada(pd.Series([5.0, 5.0, 5.0])) is None


def test_construir_tablas_frecuencia_categorica_no_agrupa():
    tablas = construir_tablas_frecuencia(
        pd.Series(["x", "y", "x"]), TipoVariable.NOMINAL, "Letra"
    )
    assert tablas.agrupada is None
    assert len(tablas.no_agrupada) == 2


def test_analizar_dataframe_completo(df_mixto):
    columnas, correlacion, filtros, resumen = analizar_dataframe(df_mixto)

    assert len(columnas) == 5
    assert resumen.filas == 12 and resumen.columnas == 5
    assert resumen.completitud == 100.0
    assert resumen.nominales + resumen.ordinales + resumen.discretas + resumen.continuas == 5

    monto = next(c for c in columnas if c.nombre == "Monto Total")
    assert monto.es_numerica and monto.resumen_numerico is not None
    assert monto.es_graficable_y

    ciudad = next(c for c in columnas if c.nombre == "Ciudad")
    assert not ciudad.es_graficable_y
    assert ciudad.top_categorias[0].frecuencia_absoluta > 0

    assert "Monto Total" in correlacion.columnas
    assert len(correlacion.valores) == len(correlacion.columnas)
    assert {f.columna for f in filtros} == set(df_mixto.columns)


def test_valores_no_finitos_se_serializan_como_null():
    df = pd.DataFrame({"x": [1.0, float("nan"), float("inf")]})
    filas = filas_serializables(df)
    assert filas[1]["x"] is None and filas[2]["x"] is None


def test_filas_serializables_convierte_fechas():
    df = pd.DataFrame({"f": pd.to_datetime(["2024-05-01"])})
    assert filas_serializables(df)[0]["f"].startswith("2024-05-01")
