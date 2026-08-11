"""Pruebas de extremo a extremo de la API HTTP."""

from __future__ import annotations

import io
import re

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.descargas import cabecera_descarga
from app.main import app


@pytest.fixture
def cliente() -> TestClient:
    return TestClient(app)


@pytest.fixture
def dataset_id(cliente: TestClient, csv_bytes: bytes) -> str:
    respuesta = cliente.post(
        "/api/datasets", files={"archivo": ("datos.csv", csv_bytes, "text/csv")}
    )
    assert respuesta.status_code == 200
    return respuesta.json()["metadatos"]["dataset_id"]


def test_salud(cliente):
    cuerpo = cliente.get("/api/salud").json()
    assert cuerpo["estado"] == "ok"
    assert "pandas" in cuerpo


def test_subida_devuelve_informe_completo(cliente, xlsx_bytes):
    respuesta = cliente.post(
        "/api/datasets",
        files={
            "archivo": (
                "datos.xlsx",
                xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()

    assert cuerpo["metadatos"]["filas"] == 12
    assert cuerpo["metadatos"]["columnas"] == 5
    assert cuerpo["metadatos"]["hoja"] == "Datos"
    assert len(cuerpo["filas"]) == 12
    assert cuerpo["columnas_orden"][0] == "ID Cliente"

    tipos = {c["nombre"]: c["tipo"] for c in cuerpo["informe"]["columnas"]}
    assert tipos["Nivel de Satisfacción"] == "Cualitativo Ordinal"
    assert tipos["Número de Compras"] == "Cuantitativo Discreto"
    assert tipos["Monto Total"] == "Cuantitativo Continuo"

    # Cada columna trae su control de filtro listo para la UI.
    assert len(cuerpo["informe"]["filtros_disponibles"]) == 5
    assert cuerpo["informe"]["filas_filtradas"] == 12


def test_subida_de_formato_no_soportado(cliente):
    respuesta = cliente.post(
        "/api/datasets", files={"archivo": ("doc.pdf", b"%PDF-1.4", "application/pdf")}
    )
    assert respuesta.status_code == 415
    assert "error" in respuesta.json()["detail"]


def test_subida_de_archivo_vacio(cliente):
    respuesta = cliente.post("/api/datasets", files={"archivo": ("v.csv", b"", "text/csv")})
    assert respuesta.status_code == 400


def test_analisis_con_filtros_recalcula_metricas(cliente, dataset_id):
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/analisis",
        json={
            "filtros": [
                {"columna": "Ciudad", "tipo": "categorico", "valores": ["Lima"]}
            ],
            "incluir_filas": True,
        },
    )
    assert respuesta.status_code == 200
    informe = respuesta.json()["informe"]

    assert informe["filas_filtradas"] == 5
    assert informe["filas_totales"] == 12
    assert informe["filtros_aplicados"] == 1
    assert len(respuesta.json()["filas"]) == 5

    # Las métricas corresponden al subconjunto filtrado.
    compras = next(c for c in informe["columnas"] if c["nombre"] == "Número de Compras")
    assert compras["resumen_numerico"]["conteo"] == 5


def test_el_tipo_de_variable_no_cambia_al_filtrar(cliente, dataset_id):
    """La clasificación se fija en la carga: filtrar no debe reinterpretarla."""
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/analisis",
        json={
            "filtros": [
                {"columna": "Nivel de Satisfacción", "tipo": "categorico", "valores": ["Alto"]}
            ]
        },
    )
    tipos = {c["nombre"]: c["tipo"] for c in respuesta.json()["informe"]["columnas"]}
    assert tipos["Nivel de Satisfacción"] == "Cualitativo Ordinal"
    assert tipos["Monto Total"] == "Cuantitativo Continuo"


def test_filtro_sobre_columna_inexistente(cliente, dataset_id):
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/analisis",
        json={"filtros": [{"columna": "Fantasma", "tipo": "categorico", "valores": ["x"]}]},
    )
    assert respuesta.status_code == 422


def test_dataset_inexistente(cliente):
    respuesta = cliente.post("/api/datasets/noexiste/analisis", json={"filtros": []})
    assert respuesta.status_code == 404


def test_tablas_de_frecuencia(cliente, dataset_id):
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/frecuencias?columna=Nivel de Satisfacción", json={}
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "Cualitativo Ordinal"
    # Respeta el orden de la escala, no el alfabético.
    assert [f["valor"] for f in cuerpo["no_agrupada"]] == ["Bajo", "Medio", "Alto"]
    assert cuerpo["agrupada"] is None


def test_tablas_de_frecuencia_agrupada_para_continua(cliente, dataset_id):
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/frecuencias?columna=Monto Total", json={}
    )
    cuerpo = respuesta.json()
    assert cuerpo["agrupada"] is not None
    assert cuerpo["clases_sturges"] == len(cuerpo["agrupada"])
    assert sum(f["frecuencia_absoluta"] for f in cuerpo["agrupada"]) == 12


def test_validacion_por_scraping_simulado(cliente, dataset_id):
    respuesta = cliente.post(f"/api/datasets/{dataset_id}/validacion", json={})
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["simulado"] is True
    assert cuerpo["filas_analizadas"] == 12
    assert isinstance(cuerpo["fuentes"], list) and cuerpo["fuentes"]


def test_exportar_excel_y_csv(cliente, dataset_id):
    excel = cliente.post(f"/api/datasets/{dataset_id}/exportar?formato=xlsx", json={})
    assert excel.status_code == 200
    assert "attachment" in excel.headers["content-disposition"]
    assert pd.read_excel(io.BytesIO(excel.content)).shape == (12, 5)

    csv = cliente.post(f"/api/datasets/{dataset_id}/exportar?formato=csv", json={})
    assert csv.status_code == 200
    assert pd.read_csv(io.BytesIO(csv.content)).shape == (12, 5)


def test_exportar_respeta_los_filtros(cliente, dataset_id):
    respuesta = cliente.post(
        f"/api/datasets/{dataset_id}/exportar?formato=csv",
        json={"filtros": [{"columna": "Ciudad", "tipo": "categorico", "valores": ["Cusco"]}]},
    )
    assert pd.read_csv(io.BytesIO(respuesta.content)).shape[0] == 4


def test_un_nombre_de_archivo_exotico_no_rompe_la_descarga(cliente, csv_bytes):
    """El nombre lo elige quien sube el archivo, y acaba en una cabecera HTTP.

    Las cabeceras se codifican en latin-1: sin tratar el nombre, un símbolo
    fuera de ese juego tumbaba la exportación con un error 500. Las comillas,
    además, permitirían romper el valor de la cabecera.
    """
    nombre = 'ventas€ 数据 "raras".csv'
    subida = cliente.post(
        "/api/datasets", files={"archivo": (nombre, csv_bytes, "text/csv")}
    )
    assert subida.status_code == 200

    respuesta = cliente.post(
        f"/api/datasets/{subida.json()['metadatos']['dataset_id']}/exportar?formato=csv",
        json={},
    )
    assert respuesta.status_code == 200

    cabecera = respuesta.headers["content-disposition"]
    # La cabecera entera debe poder codificarse como exige HTTP.
    cabecera.encode("latin-1")

    # El nombre simple queda en ASCII y sin comillas que rompan el valor…
    simple = re.search(r'filename="([^"]*)"', cabecera).group(1)
    assert simple.isascii() and simple.endswith(".csv")
    # …y el original viaja codificado, para los navegadores que lo entienden.
    assert "filename*=UTF-8''" in cabecera
    assert "%E2%82%AC" in cabecera  # el euro, percent-encoded


def test_la_cabecera_de_descarga_neutraliza_comillas_y_saltos_de_linea():
    """Comprobación directa: por HTTP el cliente ya escapa parte de esto."""
    valor = cabecera_descarga('a"; x="b\r\nc.csv')["Content-Disposition"]
    # Sólo las dos comillas que delimitan el nombre simple.
    assert valor.count('"') == 2
    assert "\r" not in valor and "\n" not in valor
    valor.encode("latin-1")


def test_exportar_informe_incluye_hojas_de_analisis(cliente, dataset_id):
    respuesta = cliente.post(f"/api/datasets/{dataset_id}/exportar?formato=informe", json={})
    hojas = pd.ExcelFile(io.BytesIO(respuesta.content)).sheet_names
    assert "Datos" in hojas
    assert "Clasificación" in hojas
    assert "Estadística" in hojas


def test_eliminar_dataset(cliente, dataset_id):
    assert cliente.delete(f"/api/datasets/{dataset_id}").json() == {"eliminado": True}
    assert cliente.post(f"/api/datasets/{dataset_id}/analisis", json={}).status_code == 404


def test_catalogo_de_muestras(cliente):
    cuerpo = cliente.get("/api/muestras").json()
    assert len(cuerpo["excel"]) == 5
    assert len(cuerpo["csv"]) == 5


def test_descarga_de_cada_muestra(cliente):
    catalogo = cliente.get("/api/muestras").json()
    for archivo in catalogo["excel"] + catalogo["csv"]:
        respuesta = cliente.get(archivo["url"])
        assert respuesta.status_code == 200, archivo["url"]
        assert len(respuesta.content) > 0
        assert archivo["id"] in respuesta.headers["content-disposition"]


def test_muestra_inexistente(cliente):
    assert cliente.get("/api/muestras/fantasma/csv").status_code == 404


def test_las_muestras_se_pueden_reingerir(cliente):
    """Cada archivo de muestra debe poder subirse y analizarse sin errores."""
    catalogo = cliente.get("/api/muestras").json()
    for archivo in catalogo["excel"] + catalogo["csv"]:
        contenido = cliente.get(archivo["url"]).content
        nombre = f"{archivo['id']}.{archivo['formato']}"
        respuesta = cliente.post(
            "/api/datasets", files={"archivo": (nombre, contenido, "application/octet-stream")}
        )
        assert respuesta.status_code == 200, nombre
        informe = respuesta.json()["informe"]
        tipos = {c["tipo"] for c in informe["columnas"]}
        assert len(tipos) >= 3, f"{nombre} debería cubrir varios tipos de variable"
