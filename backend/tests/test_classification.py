"""Pruebas del clasificador de variables."""

from __future__ import annotations

import pandas as pd
import pytest

from app.models.schemas import RolVariable, TipoVariable
from app.services.classification import (
    clasificar_columna,
    clasificar_dataframe,
    detectar_escala_ordinal,
    normalizar,
)


def tipo(valores, nombre) -> TipoVariable:
    return clasificar_columna(pd.Series(valores), nombre).tipo


def test_nominal_texto_sin_orden():
    assert tipo(["Rojo", "Verde", "Azul", "Rojo", "Verde"], "Color") == TipoVariable.NOMINAL


def test_ordinal_escala_conocida():
    resultado = clasificar_columna(
        pd.Series(["Bajo", "Alto", "Medio", "Alto", "Bajo", "Medio"]), "Nivel de Riesgo"
    )
    assert resultado.tipo == TipoVariable.ORDINAL
    assert resultado.escala_orden == ["bajo", "medio", "alto"]


def test_ordinal_likert_con_tildes_y_mayusculas():
    valores = ["MUY SATISFECHO", "insatisfecho", "Neutral", "Satisfecho", "Muy insatisfecho"]
    assert tipo(valores, "Respuesta") == TipoVariable.ORDINAL


def test_ordinal_numerico_por_encabezado():
    resultado = clasificar_columna(pd.Series([1, 3, 2, 5, 4, 3, 2] * 3), "Estrato Socioeconómico")
    assert resultado.tipo == TipoVariable.ORDINAL
    assert resultado.escala_orden == ["1", "2", "3", "4", "5"]


def test_discreta_por_encabezado_de_conteo():
    resultado = clasificar_columna(pd.Series([1, 2, 3, 2, 4, 5, 1]), "Número de Hijos")
    assert resultado.tipo == TipoVariable.DISCRETA
    assert resultado.rol == RolVariable.CONTEO


def test_discreta_por_valores_enteros_con_pocos_unicos():
    assert tipo([2, 3, 4, 3, 2, 5, 4, 3], "Habitaciones") == TipoVariable.DISCRETA


def test_continua_por_decimales():
    assert tipo([1.5, 2.25, 3.75, 4.0, 5.125], "Peso") == TipoVariable.CONTINUA


def test_continua_aunque_los_valores_esten_redondeados():
    # El encabezado describe una magnitud medible: sigue siendo continua.
    assert tipo([100, 200, 350, 420, 175], "Precio Unitario") == TipoVariable.CONTINUA


def test_identificador_numerico_es_nominal():
    resultado = clasificar_columna(pd.Series(range(1000, 1050)), "ID Pedido")
    assert resultado.tipo == TipoVariable.NOMINAL
    assert resultado.rol == RolVariable.IDENTIFICADOR


def test_identificador_texto_por_unicidad():
    valores = [f"REG-{i}" for i in range(40)]
    resultado = clasificar_columna(pd.Series(valores), "Referencia")
    assert resultado.rol == RolVariable.IDENTIFICADOR


def test_fecha_es_ordinal_temporal():
    serie = pd.Series(pd.date_range("2024-01-01", periods=10, freq="D"))
    resultado = clasificar_columna(serie, "Fecha Venta")
    assert resultado.tipo == TipoVariable.ORDINAL
    assert resultado.rol == RolVariable.TEMPORAL


def test_booleano_texto_es_nominal():
    resultado = clasificar_columna(pd.Series(["Sí", "No", "Sí", "No", "Sí"]), "Tiene Internet")
    assert resultado.tipo == TipoVariable.NOMINAL
    assert resultado.rol == RolVariable.BOOLEANO


def test_booleano_numerico_cero_uno():
    resultado = clasificar_columna(pd.Series([0, 1, 1, 0, 1, 0]), "Activo")
    assert resultado.rol == RolVariable.BOOLEANO
    assert resultado.tipo == TipoVariable.NOMINAL


def test_columna_vacia_no_rompe():
    resultado = clasificar_columna(pd.Series([None, None, None], dtype=object), "Vacía")
    assert resultado.tipo == TipoVariable.NOMINAL
    assert resultado.confianza < 0.5


def test_texto_libre_es_nominal():
    comentarios = [f"El servicio fue {'muy ' * 3}bueno en la sucursal número {i}" for i in range(30)]
    resultado = clasificar_columna(pd.Series(comentarios), "Comentario")
    assert resultado.tipo == TipoVariable.NOMINAL


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [("Á Ñ", "a n"), ("Nivel_de-Riesgo", "nivel de riesgo"), (None, "")],
)
def test_normalizar(entrada, esperado):
    assert normalizar(entrada) == esperado


def test_detectar_escala_ordinal_requiere_pertenencia_total():
    assert detectar_escala_ordinal(["Bajo", "Medio", "Alto"]) == ["bajo", "medio", "alto"]
    # "Extremo" no pertenece a la escala: no es ordinal reconocida.
    assert detectar_escala_ordinal(["Bajo", "Medio", "Extremo"]) is None


def test_clasificar_dataframe_cubre_los_cuatro_tipos(df_mixto):
    tipos = {nombre: c.tipo for nombre, c in clasificar_dataframe(df_mixto).items()}
    assert tipos["ID Cliente"] == TipoVariable.NOMINAL
    assert tipos["Ciudad"] == TipoVariable.NOMINAL
    assert tipos["Nivel de Satisfacción"] == TipoVariable.ORDINAL
    assert tipos["Número de Compras"] == TipoVariable.DISCRETA
    assert tipos["Monto Total"] == TipoVariable.CONTINUA
