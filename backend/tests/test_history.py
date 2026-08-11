"""Pruebas del historial persistido.

Se usa SQLite sobre un archivo temporal: el código no depende de nada exclusivo
de PostgreSQL, así que la misma lógica queda cubierta sin levantar un servidor.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import NullPool

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


# ---------------------------------------------------------------------------
# Cadena de conexión de Supabase
# ---------------------------------------------------------------------------
POOL_SESION = "postgresql+psycopg://postgres.ref:c@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
POOL_TRANSACCION = POOL_SESION.replace(":5432/", ":6543/")


def test_se_exige_tls_en_postgres_y_no_se_toca_sqlite():
    assert "sslmode=require" in db._sanear_parametros(POOL_SESION)
    # Una preferencia explícita del usuario se respeta.
    assert db._sanear_parametros(POOL_SESION + "?sslmode=verify-full").endswith("sslmode=verify-full")
    # SQLite no entiende de TLS.
    assert db._sanear_parametros("sqlite:///historial.db") == "sqlite:///historial.db"


def test_se_descartan_los_parametros_que_libpq_no_conoce():
    # Algunos paneles añaden `pgbouncer=true`, que psycopg rechazaría.
    saneada = db._sanear_parametros(POOL_TRANSACCION + "?pgbouncer=true&connection_limit=1")
    assert "pgbouncer" not in saneada
    assert "connection_limit" not in saneada
    assert "sslmode=require" in saneada


def test_el_pool_de_transaccion_se_detecta_por_puerto_o_parametro():
    assert db._usa_pool_de_transaccion(POOL_TRANSACCION) is True
    assert db._usa_pool_de_transaccion(POOL_SESION + "?pgbouncer=true") is True
    assert db._usa_pool_de_transaccion(POOL_SESION) is False


def test_el_pool_de_transaccion_desactiva_pool_propio_y_sentencias_preparadas():
    # En modo transacción cada transacción puede caer en otra conexión: ni el
    # pool ni las sentencias preparadas sobreviven al cambio.
    opciones = db._opciones_de_motor(POOL_TRANSACCION)
    assert opciones["poolclass"] is NullPool
    assert opciones["connect_args"] == {"prepare_threshold": None}

    # En modo sesión (o conexión directa) sí interesa mantener el pool.
    assert db._opciones_de_motor(POOL_SESION) == {"pool_size": 5, "max_overflow": 5}
    # SQLite no admite esos parámetros.
    assert db._opciones_de_motor("sqlite:///historial.db") == {}


def test_la_conexion_directa_de_supabase_avisa_de_que_solo_tiene_ipv6():
    directa = "postgresql+psycopg://postgres:c@db.abcdef.supabase.co:5432/postgres"
    pista = db._pista_de_conexion(directa)
    assert pista is not None and "IPv6" in pista
    # Con el pooler no hay nada que avisar.
    assert db._pista_de_conexion(POOL_SESION) is None


#: Cadena tal como la copia quien no sustituye el marcador de Supabase. Los
#: corchetes hacen que `urlsplit` intente leer el anfitrión como una dirección
#: IPv6 y lance ValueError, así que sirve de caso límite para todo el análisis.
CON_MARCADOR = "postgresql+psycopg://postgres.ref:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"


def test_una_cadena_con_corchetes_no_tumba_el_servicio():
    # Un error de configuración desactiva el historial; no impide arrancar.
    db.cerrar()
    assert db.inicializar(CON_MARCADOR) is False
    assert history.disponible() is False


def test_ninguna_funcion_de_analisis_revienta_con_una_cadena_ilegible():
    assert db._partes(CON_MARCADOR) is None
    # Cada una devuelve algo utilizable en lugar de propagar la excepción.
    assert db._sanear_parametros(CON_MARCADOR) == CON_MARCADOR
    assert db._puerto(CON_MARCADOR) is None
    assert db._usa_pool_de_transaccion(CON_MARCADOR) is False
    assert db._opciones_de_motor(CON_MARCADOR) == {"pool_size": 5, "max_overflow": 5}


def test_los_corchetes_se_explican_en_el_registro():
    pista = db._pista_de_conexion(CON_MARCADOR)
    assert pista is not None and "YOUR-PASSWORD" in pista


def test_una_cadena_del_pooler_arranca_el_motor_sin_conectar_de_verdad():
    # Comprueba que las opciones elegidas son válidas para `create_engine`:
    # un host inexistente falla al conectar, no al construir el motor.
    db.cerrar()
    assert db.inicializar(POOL_TRANSACCION.replace("aws-0-us-west-1.pooler.supabase.com", "127.0.0.1")) is False


def test_una_url_invalida_no_tumba_el_servicio():
    db.cerrar()
    assert db.inicializar("postgresql+psycopg://nadie@127.0.0.1:1/inexistente") is False
    assert history.disponible() is False
    assert history.listar(CLIENTE) == []
