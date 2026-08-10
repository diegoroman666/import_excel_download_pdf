"""Pruebas del historial persistido.

Se usa SQLite sobre un archivo temporal: el código no depende de nada exclusivo
de PostgreSQL, así que la misma lógica queda cubierta sin levantar un servidor.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.db import base as db
from app.main import app
from app.services import history

CLIENTE = "cliente-de-prueba"
OTRO_CLIENTE = "otro-cliente"


@pytest.fixture
def bd(tmp_path):
    """Activa la persistencia sobre una base de datos SQLite desechable."""
    db.cerrar()
    assert db.inicializar(f"sqlite:///{tmp_path / 'historial.db'}")
    yield
    db.cerrar()


@pytest.fixture
def cliente() -> TestClient:
    return TestClient(app)


def _subir(cliente: TestClient, csv_bytes: bytes, *, quien: str | None = CLIENTE):
    cabeceras = {"X-Cliente": quien} if quien else {}
    return cliente.post(
        "/api/datasets",
        files={"archivo": ("ventas.csv", csv_bytes, "text/csv")},
        headers=cabeceras,
    )


# ---------------------------------------------------------------------------
# Sin base de datos
# ---------------------------------------------------------------------------
def test_sin_base_de_datos_el_historial_se_anuncia_como_no_disponible(cliente):
    db.cerrar()
    cuerpo = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()
    assert cuerpo["disponible"] is False
    assert cuerpo["entradas"] == []
    assert "DATABASE_URL" in cuerpo["motivo"]


def test_sin_base_de_datos_la_subida_funciona_igual(cliente, csv_bytes):
    db.cerrar()
    respuesta = _subir(cliente, csv_bytes)
    assert respuesta.status_code == 200
    assert respuesta.json()["metadatos"]["filas"] == 12


def test_sin_base_de_datos_abrir_devuelve_503(cliente):
    db.cerrar()
    respuesta = cliente.post("/api/historial/loquesea/abrir", headers={"X-Cliente": CLIENTE})
    assert respuesta.status_code == 503


# ---------------------------------------------------------------------------
# Con base de datos
# ---------------------------------------------------------------------------
def test_la_subida_queda_registrada_en_el_historial(bd, cliente, csv_bytes):
    assert _subir(cliente, csv_bytes).status_code == 200

    cuerpo = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()
    assert cuerpo["disponible"] is True
    assert len(cuerpo["entradas"]) == 1

    entrada = cuerpo["entradas"][0]
    assert entrada["nombre_archivo"] == "ventas.csv"
    assert entrada["filas"] == 12
    assert entrada["columnas"] == 5
    # El resumen permite pintar la lista sin volver a procesar el archivo.
    assert sum(entrada["resumen_tipos"].values()) == 5


def test_sin_cabecera_de_cliente_no_se_guarda_nada(bd, cliente, csv_bytes):
    assert _subir(cliente, csv_bytes, quien=None).status_code == 200
    cuerpo = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()
    assert cuerpo["entradas"] == []


def test_el_historial_de_un_cliente_no_es_visible_para_otro(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)

    ajeno = cliente.get("/api/historial", headers={"X-Cliente": OTRO_CLIENTE}).json()
    assert ajeno["entradas"] == []


def test_reabrir_devuelve_el_mismo_analisis(bd, cliente, csv_bytes):
    original = _subir(cliente, csv_bytes).json()
    entrada_id = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"][0]["id"]

    reabierto = cliente.post(
        f"/api/historial/{entrada_id}/abrir", headers={"X-Cliente": CLIENTE}
    )
    assert reabierto.status_code == 200
    cuerpo = reabierto.json()

    assert cuerpo["metadatos"]["filas"] == original["metadatos"]["filas"]
    assert cuerpo["columnas_orden"] == original["columnas_orden"]

    tipos_original = {c["nombre"]: c["tipo"] for c in original["informe"]["columnas"]}
    tipos_reabierto = {c["nombre"]: c["tipo"] for c in cuerpo["informe"]["columnas"]}
    assert tipos_reabierto == tipos_original


def test_reabrir_no_duplica_la_entrada(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)
    entrada_id = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"][0]["id"]

    cliente.post(f"/api/historial/{entrada_id}/abrir", headers={"X-Cliente": CLIENTE})

    assert len(cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"]) == 1


def test_no_se_puede_reabrir_la_entrada_de_otro_cliente(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)
    entrada_id = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"][0]["id"]

    respuesta = cliente.post(
        f"/api/historial/{entrada_id}/abrir", headers={"X-Cliente": OTRO_CLIENTE}
    )
    assert respuesta.status_code == 404


def test_eliminar_una_entrada(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)
    entrada_id = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"][0]["id"]

    borrado = cliente.delete(f"/api/historial/{entrada_id}", headers={"X-Cliente": CLIENTE})
    assert borrado.json() == {"eliminado": True}
    assert cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"] == []


def test_no_se_puede_eliminar_la_entrada_de_otro_cliente(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)
    entrada_id = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"][0]["id"]

    ajeno = cliente.delete(f"/api/historial/{entrada_id}", headers={"X-Cliente": OTRO_CLIENTE})
    assert ajeno.json() == {"eliminado": False}
    # La entrada sigue estando para su dueño.
    assert len(cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"]) == 1


def test_vaciar_el_historial(bd, cliente, csv_bytes):
    _subir(cliente, csv_bytes)
    _subir(cliente, csv_bytes)

    vaciado = cliente.delete("/api/historial", headers={"X-Cliente": CLIENTE})
    assert vaciado.json() == {"eliminadas": 2}
    assert cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"] == []


def test_las_entradas_se_listan_de_la_mas_reciente_a_la_mas_antigua(bd, cliente, csv_bytes):
    for _ in range(3):
        _subir(cliente, csv_bytes)

    entradas = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"]
    fechas = [e["creado_en"] for e in entradas]
    assert fechas == sorted(fechas, reverse=True)


def test_se_descartan_las_entradas_mas_antiguas_al_superar_el_limite(bd, cliente, csv_bytes, monkeypatch):
    # `Settings` es un dataclass congelado: se sustituye el objeto completo que
    # ve el módulo, en lugar de intentar mutar un campo.
    monkeypatch.setattr(
        history, "settings", replace(history.settings, max_historial_por_cliente=3)
    )
    for _ in range(5):
        _subir(cliente, csv_bytes)

    entradas = cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"]
    assert len(entradas) == 3


def test_un_archivo_demasiado_grande_no_se_guarda_pero_se_analiza(bd, cliente, csv_bytes, monkeypatch):
    monkeypatch.setattr(history, "settings", replace(history.settings, max_bytes_historial=10))
    assert _subir(cliente, csv_bytes).status_code == 200
    assert cliente.get("/api/historial", headers={"X-Cliente": CLIENTE}).json()["entradas"] == []


def test_el_contenido_se_guarda_comprimido(bd, csv_bytes):
    identificador = history.guardar(
        cliente=CLIENTE,
        nombre_archivo="ventas.csv",
        hoja=None,
        contenido=csv_bytes,
        filas=12,
        columnas=5,
        resumen_tipos={},
    )
    assert identificador is not None

    recuperado = history.recuperar(CLIENTE, identificador)
    assert recuperado is not None
    # Al recuperarlo se descomprime y coincide byte a byte con el original.
    assert recuperado.contenido == csv_bytes


def test_la_url_de_render_con_esquema_postgres_se_normaliza():
    assert db._normalizar_url("postgres://u:p@h/d") == "postgresql+psycopg://u:p@h/d"
    assert db._normalizar_url("postgresql://u:p@h/d") == "postgresql+psycopg://u:p@h/d"
    # Una URL ya normalizada no se toca.
    assert db._normalizar_url("postgresql+psycopg://u:p@h/d") == "postgresql+psycopg://u:p@h/d"


def test_una_url_invalida_no_tumba_el_servicio():
    db.cerrar()
    assert db.inicializar("postgresql+psycopg://nadie@127.0.0.1:1/inexistente") is False
    assert history.disponible() is False
    assert history.listar(CLIENTE) == []
