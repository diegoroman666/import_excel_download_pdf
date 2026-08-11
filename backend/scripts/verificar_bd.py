#!/usr/bin/env python3
"""Comprueba que la cadena de `DATABASE_URL` sirve para el historial.

Evita el ciclo lento de «desplegar y mirar los registros»: hace en local lo
mismo que el motor al arrancar —conectar, crear las tablas y escribir— y dice
en castellano qué falla si algo falla.

    cd backend
    DATABASE_URL='postgresql://postgres.abc:clave@aws-0-us-west-1.pooler.supabase.com:5432/postgres' \
        python scripts/verificar_bd.py

No deja rastro: la fila de prueba se borra al terminar.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

# Permite ejecutarlo con `python scripts/verificar_bd.py` desde `backend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from app.db import base as db  # noqa: E402
from app.services import history  # noqa: E402

CLIENTE_PRUEBA = "verificacion-local"


def _fallo(mensaje: str) -> int:
    print(f"\n  ✗ {mensaje}")
    return 1


def main() -> int:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return _fallo(
            "No hay DATABASE_URL en el entorno.\n"
            "    Defínala antes de ejecutar este script (véase docs/supabase.md)."
        )

    cadena = db._sanear_parametros(db._normalizar_url(url))
    es_postgres = cadena.startswith("postgresql")

    try:
        partes = urlsplit(cadena)
        if not es_postgres:
            destino = partes.path
        elif partes.hostname:
            destino = f"{partes.hostname}:{partes.port or 5432}"
        else:  # conexión por socket local: el anfitrión viaja como parámetro
            destino = dict(parse_qsl(partes.query)).get("host", "socket local")
    except ValueError:
        return _fallo(
            "La cadena no se pudo interpretar. Si la contraseña lleva "
            "caracteres\n    especiales (@ : / # ? & %), hay que codificarla en "
            "la URL."
        )

    print(f"  Destino ......... {destino}")
    if es_postgres:
        modo = "transacción (sin preparadas)" if db._usa_pool_de_transaccion(cadena) else "sesión o directa"
        print(f"  Modo de pool .... {modo}")

    print("\n  Conectando y creando las tablas si faltan…")
    if not db.inicializar(url):
        return _fallo(
            "No se pudo conectar. El motivo concreto aparece arriba, en el "
            "registro.\n    Causas frecuentes: contraseña sin codificar en la "
            "URL, o la\n    conexión directa (db.<ref>.supabase.co), que sólo "
            "resuelve por IPv6."
        )
    print("  ✓ Conexión establecida y tabla `analisis_guardado` disponible.")

    if es_postgres:
        sesion = db.obtener_sesion()
        if sesion is None:
            return _fallo("La sesión no se pudo abrir después de conectar.")
        with sesion:
            version = sesion.scalar(text("select version()")) or ""
        print(f"  ✓ Servidor: {version.split(',')[0]}")

    print("\n  Escribiendo y leyendo una entrada de prueba…")
    identificador = history.guardar(
        cliente=CLIENTE_PRUEBA,
        nombre_archivo="verificacion.csv",
        hoja=None,
        contenido=b"columna\n1\n",
        filas=1,
        columnas=1,
        resumen_tipos={"Cuantitativo Discreto": 1},
    )
    if identificador is None:
        return _fallo("La escritura falló. Revise los permisos del rol de la cadena.")

    recuperado = history.recuperar(CLIENTE_PRUEBA, identificador)
    if recuperado is None or recuperado.contenido != b"columna\n1\n":
        history.vaciar(CLIENTE_PRUEBA)
        return _fallo("Lo escrito no se pudo leer de vuelta íntegro.")
    print("  ✓ Escritura, lectura y descompresión correctas.")

    borradas = history.vaciar(CLIENTE_PRUEBA)
    print(f"  ✓ Limpieza: {borradas} entrada(s) de prueba eliminada(s).")

    db.cerrar()
    print("\n  Todo correcto. Esta cadena vale para DATABASE_URL en el motor.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
