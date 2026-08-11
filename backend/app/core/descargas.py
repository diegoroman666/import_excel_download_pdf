"""Cabeceras de descarga.

El nombre de un archivo exportado se deriva del que subió el usuario, así que
es entrada no confiable y no puede insertarse tal cual en una cabecera HTTP.
"""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import quote

#: Todo lo que no sea esto se sustituye por `_` en la versión ASCII.
_NO_SEGUROS = re.compile(r"[^A-Za-z0-9._-]+")

#: Los nombres largos no aportan nada y complican a algunos clientes.
MAX_LONGITUD = 120


def cabecera_descarga(nombre: str) -> dict[str, str]:
    """`Content-Disposition` válido sea cual sea el nombre del archivo.

    Dos problemas que resuelve:

    - Unas comillas o un salto de línea en el nombre romperían el valor de la
      cabecera.
    - Las cabeceras HTTP se codifican en latin-1, no en UTF-8: un nombre con un
      símbolo de euro o con ideogramas haría fallar la respuesta entera con un
      error 500, aunque la exportación en sí fuese correcta.

    Se emiten los dos parámetros del RFC 6266: `filename`, reducido a ASCII
    para clientes antiguos, y `filename*`, con el nombre real codificado, que es
    el que usan los navegadores actuales.
    """
    limpio = (nombre or "").strip()[:MAX_LONGITUD] or "datos"

    simple = unicodedata.normalize("NFKD", limpio).encode("ascii", "ignore").decode()
    simple = _NO_SEGUROS.sub("_", simple).strip("._") or "datos"

    return {
        "Content-Disposition": (
            f'attachment; filename="{simple}"; filename*=UTF-8\'\'{quote(limpio, safe="")}'
        )
    }
