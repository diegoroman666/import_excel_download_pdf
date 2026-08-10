"""Pruebas del motor de filtros estilo Power BI."""

from __future__ import annotations

import pandas as pd
import pytest

from app.core.errors import InvalidFilterError
from app.models.schemas import Filtro, TipoFiltro
from app.services.filtering import aplicar_filtros, filtro_es_activo


@pytest.fixture
def df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Ciudad": ["Lima", "Cusco", "Lima", None, "Piura"],
            "Ventas": [100.0, 250.0, 80.0, 500.0, None],
            "Fecha": pd.to_datetime(
                ["2024-01-01", "2024-02-15", "2024-03-20", "2024-04-05", "2024-05-30"]
            ),
            "Comentario": ["muy bueno", "Regular", "excelente", "malo", "bueno"],
        }
    )


def test_sin_filtros_devuelve_todo(df):
    resultado, activos = aplicar_filtros(df, [])
    assert len(resultado) == 5 and activos == 0


def test_filtro_categorico_incluye(df):
    filtro = Filtro(columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=["Lima"])
    resultado, activos = aplicar_filtros(df, [filtro])
    assert list(resultado["Ciudad"]) == ["Lima", "Lima"] and activos == 1


def test_filtro_categorico_excluye(df):
    filtro = Filtro(
        columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=["Lima"], excluir=True,
        incluir_nulos=False,
    )
    resultado, _ = aplicar_filtros(df, [filtro])
    assert set(resultado["Ciudad"]) == {"Cusco", "Piura"}


def test_filtro_categorico_puede_incluir_nulos(df):
    filtro = Filtro(
        columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=["Lima"], incluir_nulos=True
    )
    resultado, _ = aplicar_filtros(df, [filtro])
    # El nulo se conserva porque incluir_nulos=True.
    assert len(resultado) == 3


def test_filtro_de_rango(df):
    filtro = Filtro(columna="Ventas", tipo=TipoFiltro.RANGO, minimo=90, maximo=300,
                    incluir_nulos=False)
    resultado, _ = aplicar_filtros(df, [filtro])
    assert sorted(resultado["Ventas"]) == [100.0, 250.0]


def test_filtro_de_rango_conserva_nulos_si_se_pide(df):
    filtro = Filtro(columna="Ventas", tipo=TipoFiltro.RANGO, minimo=90, incluir_nulos=True)
    resultado, _ = aplicar_filtros(df, [filtro])
    assert len(resultado) == 4  # 100, 250, 500 y el nulo


def test_filtro_de_fecha(df):
    filtro = Filtro(columna="Fecha", tipo=TipoFiltro.FECHA, desde="2024-02-01", hasta="2024-04-30")
    resultado, _ = aplicar_filtros(df, [filtro])
    assert len(resultado) == 3


def test_filtro_de_texto_es_insensible_a_mayusculas_por_defecto(df):
    filtro = Filtro(columna="Comentario", tipo=TipoFiltro.TEXTO, contiene="BUENO")
    resultado, _ = aplicar_filtros(df, [filtro])
    assert len(resultado) == 2


def test_filtro_de_texto_sensible(df):
    filtro = Filtro(
        columna="Comentario", tipo=TipoFiltro.TEXTO, contiene="BUENO", sensible_mayusculas=True
    )
    resultado, _ = aplicar_filtros(df, [filtro])
    assert len(resultado) == 0


def test_filtro_de_texto_trata_el_patron_como_literal(df):
    filtro = Filtro(columna="Comentario", tipo=TipoFiltro.TEXTO, contiene="(")
    resultado, _ = aplicar_filtros(df, [filtro])
    assert len(resultado) == 0  # no debe interpretarse como regex inválida


def test_filtro_de_nulos(df):
    filtro = Filtro(columna="Ventas", tipo=TipoFiltro.NULOS, incluir_nulos=False)
    resultado, activos = aplicar_filtros(df, [filtro])
    assert len(resultado) == 4 and activos == 1


def test_filtros_se_combinan_con_and(df):
    filtros = [
        Filtro(columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=["Lima"], incluir_nulos=False),
        Filtro(columna="Ventas", tipo=TipoFiltro.RANGO, minimo=90, incluir_nulos=False),
    ]
    resultado, activos = aplicar_filtros(df, filtros)
    assert len(resultado) == 1 and activos == 2
    assert resultado.iloc[0]["Ventas"] == 100.0


def test_filtro_vacio_no_cuenta_como_activo(df):
    filtros = [Filtro(columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=[])]
    resultado, activos = aplicar_filtros(df, filtros)
    assert len(resultado) == 5 and activos == 0
    assert not filtro_es_activo(filtros[0])


def test_columna_inexistente_lanza_error(df):
    filtro = Filtro(columna="No existe", tipo=TipoFiltro.CATEGORICO, valores=["x"])
    with pytest.raises(InvalidFilterError):
        aplicar_filtros(df, [filtro])


def test_el_indice_se_reinicia_tras_filtrar(df):
    filtro = Filtro(columna="Ciudad", tipo=TipoFiltro.CATEGORICO, valores=["Piura"],
                    incluir_nulos=False)
    resultado, _ = aplicar_filtros(df, [filtro])
    assert list(resultado.index) == [0]
