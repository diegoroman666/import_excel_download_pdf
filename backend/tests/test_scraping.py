"""Pruebas de la validación de consistencia por scraping simulado."""

from __future__ import annotations

import pandas as pd

from app.models.schemas import SeveridadHallazgo
from app.services.scraping import validar_consistencia


def codigos(informe) -> set[str]:
    return {h.codigo for h in informe.hallazgos}


def test_dataset_limpio_obtiene_puntuacion_alta():
    df = pd.DataFrame(
        {
            "Región": ["Norte", "Sur", "Centro"] * 5,
            "Monto Total": [100.0, 220.5, 310.0] * 5,
        }
    )
    informe = validar_consistencia(df, "abc")
    assert informe.simulado is True
    assert informe.puntuacion_consistencia >= 95
    assert informe.filas_analizadas == 15
    assert informe.fuentes, "debe reportar las fuentes consultadas"


def test_detecta_valores_fuera_del_catalogo_y_sugiere_correccion():
    df = pd.DataFrame({"Región": ["Norte", "Sur", "Nrte", "Atlántida"]})
    informe = validar_consistencia(df, "abc")

    assert "valor_fuera_de_catalogo" in codigos(informe)
    hallazgo = next(h for h in informe.hallazgos if h.codigo == "valor_fuera_de_catalogo")
    # "Nrte" está a una edición de "norte": debe proponerse la corrección.
    assert any("norte" in ejemplo for ejemplo in hallazgo.ejemplos)


def test_detecta_valores_fuera_de_rango_fisico():
    df = pd.DataFrame({"Temperatura Media": [20.0, 22.5, 950.0, -300.0]})
    informe = validar_consistencia(df, "abc")

    hallazgo = next(h for h in informe.hallazgos if h.codigo == "valor_fuera_de_rango")
    assert hallazgo.severidad == SeveridadHallazgo.CRITICO
    assert hallazgo.filas_afectadas == 2


def test_detecta_identificadores_duplicados():
    df = pd.DataFrame({"ID Pedido": ["A-1", "A-2", "A-1", "A-3"]})
    informe = validar_consistencia(df, "abc")

    hallazgo = next(h for h in informe.hallazgos if h.codigo == "identificador_duplicado")
    assert hallazgo.filas_afectadas == 1
    assert hallazgo.severidad == SeveridadHallazgo.CRITICO


def test_detecta_inconsistencias_de_formato():
    df = pd.DataFrame({"Ciudad": ["Lima", "lima", " LIMA ", "Cusco"]})
    informe = validar_consistencia(df, "abc")
    assert "inconsistencia_de_formato" in codigos(informe)


def test_detecta_exceso_de_nulos():
    df = pd.DataFrame({"Observación": [None] * 8 + ["dato", "otro"]})
    informe = validar_consistencia(df, "abc")

    hallazgo = next(h for h in informe.hallazgos if h.codigo == "exceso_de_nulos")
    assert hallazgo.filas_afectadas == 8


def test_detecta_filas_duplicadas():
    df = pd.DataFrame({"a": [1, 1, 2], "b": ["x", "x", "y"]})
    informe = validar_consistencia(df, "abc")
    assert "filas_duplicadas" in codigos(informe)


def test_los_hallazgos_se_ordenan_por_severidad():
    df = pd.DataFrame(
        {
            "ID Pedido": ["A-1", "A-1", "A-2", "A-3"],
            "Ciudad": ["Lima", "lima", "Cusco", "Cusco"],
        }
    )
    informe = validar_consistencia(df, "abc")
    severidades = [h.severidad for h in informe.hallazgos]
    assert severidades[0] == SeveridadHallazgo.CRITICO


def test_la_puntuacion_baja_con_problemas_graves():
    limpio = validar_consistencia(pd.DataFrame({"Región": ["Norte"] * 10}), "a")
    sucio = validar_consistencia(
        pd.DataFrame({"Región": ["Marte"] * 10, "Temperatura": [999.0] * 10}), "b"
    )
    assert sucio.puntuacion_consistencia < limpio.puntuacion_consistencia


def test_es_reproducible():
    df = pd.DataFrame({"Región": ["Norte", "Marte"]})
    primero = validar_consistencia(df, "abc")
    segundo = validar_consistencia(df, "abc")
    assert [h.codigo for h in primero.hallazgos] == [h.codigo for h in segundo.hallazgos]
    assert primero.puntuacion_consistencia == segundo.puntuacion_consistencia
    assert [f.latencia_ms for f in primero.fuentes] == [f.latencia_ms for f in segundo.fuentes]


def test_dataframe_vacio_no_rompe():
    informe = validar_consistencia(pd.DataFrame({"a": []}), "abc")
    assert informe.filas_analizadas == 0
