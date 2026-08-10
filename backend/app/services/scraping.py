"""Validación de consistencia mediante *web scraping simulado*.

El proceso imita la consulta a catálogos de referencia públicos (regiones,
categorías, rangos físicos admisibles) y contrasta el dataset del usuario
contra ellos. **No se realiza ninguna petición de red**: los catálogos están
embebidos y la latencia se simula de forma determinista, lo que hace la
validación reproducible y apta para entornos sin salida a internet.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.core.dtypes import es_texto
from app.models.schemas import (
    FuenteConsultada,
    HallazgoValidacion,
    InformeValidacion,
    SeveridadHallazgo,
)
from app.services.classification import normalizar

#: Umbral de nulos por columna a partir del cual se advierte.
UMBRAL_NULOS = 0.15
#: Umbral de valores atípicos extremos (|z| > 4) para advertir.
UMBRAL_ATIPICOS = 0.02


@dataclass(frozen=True)
class CatalogoReferencia:
    """Catálogo 'descargado' de una fuente pública simulada."""

    nombre: str
    url: str
    pistas_columna: tuple[str, ...]
    valores: tuple[str, ...]


@dataclass(frozen=True)
class RangoReferencia:
    """Rango físico/lógico admisible para una magnitud conocida."""

    nombre: str
    url: str
    pistas_columna: tuple[str, ...]
    minimo: float
    maximo: float
    unidad: str


CATALOGOS: tuple[CatalogoReferencia, ...] = (
    CatalogoReferencia(
        nombre="Catálogo de regiones y departamentos",
        url="https://referencia.datos.gob/regiones",
        pistas_columna=("region", "departamento", "provincia", "estado", "zona geografica"),
        valores=(
            "norte", "sur", "centro", "oriente", "occidente", "lima", "arequipa",
            "cusco", "piura", "la libertad", "junin", "ica", "loreto", "puno",
            "cajamarca", "ancash", "lambayeque", "tacna", "urbano", "rural",
        ),
    ),
    CatalogoReferencia(
        nombre="Taxonomía de categorías de producto",
        url="https://referencia.datos.gob/taxonomia-productos",
        pistas_columna=("categoria producto", "categoria", "rubro", "linea producto", "familia"),
        valores=(
            "electronica", "hogar", "ropa", "alimentos", "deportes", "juguetes",
            "belleza", "libros", "muebles", "tecnologia", "salud", "mascotas",
        ),
    ),
    CatalogoReferencia(
        nombre="Canales de venta homologados",
        url="https://referencia.datos.gob/canales",
        pistas_columna=("canal", "medio de venta", "punto de venta"),
        valores=("tienda fisica", "online", "distribuidor", "mayorista", "telefonico", "marketplace"),
    ),
    CatalogoReferencia(
        nombre="Niveles educativos oficiales",
        url="https://referencia.datos.gob/niveles-educativos",
        pistas_columna=("nivel educativo", "educacion", "grado academico", "instruccion"),
        valores=(
            "inicial", "primaria", "secundaria", "tecnico", "universitario",
            "postgrado", "maestria", "doctorado", "sin instruccion",
        ),
    ),
)

RANGOS: tuple[RangoReferencia, ...] = (
    RangoReferencia(
        nombre="Rangos climatológicos históricos",
        url="https://referencia.clima.org/rangos",
        pistas_columna=("temperatura",),
        minimo=-90.0,
        maximo=60.0,
        unidad="°C",
    ),
    RangoReferencia(
        nombre="Rangos climatológicos históricos",
        url="https://referencia.clima.org/rangos",
        pistas_columna=("humedad", "humedad relativa"),
        minimo=0.0,
        maximo=100.0,
        unidad="%",
    ),
    RangoReferencia(
        nombre="Rangos climatológicos históricos",
        url="https://referencia.clima.org/rangos",
        pistas_columna=("presion", "presion atmosferica"),
        minimo=850.0,
        maximo=1100.0,
        unidad="hPa",
    ),
    RangoReferencia(
        nombre="Convenciones demográficas",
        url="https://referencia.datos.gob/demografia",
        pistas_columna=("edad",),
        minimo=0.0,
        maximo=125.0,
        unidad="años",
    ),
    RangoReferencia(
        nombre="Convenciones comerciales",
        url="https://referencia.datos.gob/comercio",
        pistas_columna=("porcentaje", "descuento", "tasa", "participacion"),
        minimo=0.0,
        maximo=100.0,
        unidad="%",
    ),
    RangoReferencia(
        nombre="Convenciones comerciales",
        url="https://referencia.datos.gob/comercio",
        pistas_columna=("precio", "monto", "importe", "costo", "ingreso", "gasto", "salario"),
        minimo=0.0,
        maximo=float("inf"),
        unidad="moneda",
    ),
)


def _distancia_edicion(a: str, b: str) -> int:
    """Levenshtein iterativo (suficiente para etiquetas cortas)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    previa = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        actual = [i]
        for j, cb in enumerate(b, start=1):
            actual.append(min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (ca != cb)))
        previa = actual
    return previa[-1]


def _sugerir(valor: str, catalogo: tuple[str, ...]) -> str | None:
    """Valor del catálogo más parecido, si la diferencia es pequeña."""
    normalizado = normalizar(valor)
    if not normalizado:
        return None
    mejor, distancia_min = None, 99
    for referencia in catalogo:
        distancia = _distancia_edicion(normalizado, referencia)
        if distancia < distancia_min:
            mejor, distancia_min = referencia, distancia
    umbral = max(1, len(normalizado) // 3)
    return mejor if mejor is not None and distancia_min <= umbral else None


def _coincide_columna(nombre: str, pistas: tuple[str, ...]) -> bool:
    normalizado = normalizar(nombre)
    return any(pista in normalizado for pista in pistas)


def _latencia_simulada(url: str) -> int:
    """Latencia determinista y estable entre 40 y 180 ms."""
    return 40 + (sum(ord(c) for c in url) % 141)


# ---------------------------------------------------------------------------
# Reglas de validación
# ---------------------------------------------------------------------------
def _validar_catalogos(df: pd.DataFrame) -> tuple[list[HallazgoValidacion], list[FuenteConsultada]]:
    hallazgos: list[HallazgoValidacion] = []
    fuentes: list[FuenteConsultada] = []

    for catalogo in CATALOGOS:
        columnas = [c for c in df.columns if _coincide_columna(str(c), catalogo.pistas_columna)]
        fuentes.append(
            FuenteConsultada(
                nombre=catalogo.nombre,
                url=catalogo.url,
                registros=len(catalogo.valores),
                latencia_ms=_latencia_simulada(catalogo.url),
                estado="consultada" if columnas else "sin coincidencias",
            )
        )

        for columna in columnas:
            serie = df[columna].dropna().astype(str)
            if serie.empty:
                continue
            desconocidos: dict[str, int] = {}
            for valor, frecuencia in serie.value_counts().items():
                if normalizar(valor) not in catalogo.valores:
                    desconocidos[str(valor)] = int(frecuencia)

            if desconocidos:
                ejemplos = []
                for valor in list(desconocidos)[:5]:
                    sugerido = _sugerir(valor, catalogo.valores)
                    ejemplos.append(f"{valor} → {sugerido}" if sugerido else valor)
                hallazgos.append(
                    HallazgoValidacion(
                        codigo="valor_fuera_de_catalogo",
                        severidad=SeveridadHallazgo.ADVERTENCIA,
                        columna=str(columna),
                        mensaje=(
                            f"{len(desconocidos)} valor(es) de '{columna}' no figuran en "
                            f"«{catalogo.nombre}»."
                        ),
                        filas_afectadas=sum(desconocidos.values()),
                        ejemplos=ejemplos,
                        sugerencia=(
                            "Homologue los valores con el catálogo de referencia o confirme "
                            "que son categorías nuevas válidas."
                        ),
                    )
                )

    return hallazgos, fuentes


def _validar_rangos(df: pd.DataFrame) -> tuple[list[HallazgoValidacion], list[FuenteConsultada]]:
    hallazgos: list[HallazgoValidacion] = []
    vistas: dict[str, FuenteConsultada] = {}

    for rango in RANGOS:
        columnas = [
            c
            for c in df.columns
            if _coincide_columna(str(c), rango.pistas_columna)
            and pd.api.types.is_numeric_dtype(df[c])
        ]
        if rango.url not in vistas:
            vistas[rango.url] = FuenteConsultada(
                nombre=rango.nombre,
                url=rango.url,
                registros=len(RANGOS),
                latencia_ms=_latencia_simulada(rango.url),
                estado="sin coincidencias",
            )
        if columnas:
            vistas[rango.url].estado = "consultada"

        for columna in columnas:
            valores = pd.to_numeric(df[columna], errors="coerce").dropna()
            fuera = valores[(valores < rango.minimo) | (valores > rango.maximo)]
            if not fuera.empty:
                hallazgos.append(
                    HallazgoValidacion(
                        codigo="valor_fuera_de_rango",
                        severidad=SeveridadHallazgo.CRITICO,
                        columna=str(columna),
                        mensaje=(
                            f"'{columna}' tiene {len(fuera)} valor(es) fuera del rango admisible "
                            f"[{rango.minimo:g}, {rango.maximo:g}] {rango.unidad}."
                        ),
                        filas_afectadas=int(len(fuera)),
                        ejemplos=[f"{v:g}" for v in fuera.head(5)],
                        sugerencia="Revise la unidad de medida o corrija los valores atípicos.",
                    )
                )

    return hallazgos, list(vistas.values())


def _validar_estructura(df: pd.DataFrame) -> list[HallazgoValidacion]:
    hallazgos: list[HallazgoValidacion] = []
    total = len(df)
    if total == 0:
        return hallazgos

    duplicadas = int(df.duplicated().sum())
    if duplicadas:
        hallazgos.append(
            HallazgoValidacion(
                codigo="filas_duplicadas",
                severidad=SeveridadHallazgo.ADVERTENCIA,
                mensaje=f"Hay {duplicadas} fila(s) completamente duplicadas.",
                filas_afectadas=duplicadas,
                sugerencia="Elimine los registros repetidos antes de calcular métricas.",
            )
        )

    for columna in df.columns:
        serie = df[columna]
        nombre = str(columna)
        nulos = int(serie.isna().sum())

        if nulos and nulos / total > UMBRAL_NULOS:
            hallazgos.append(
                HallazgoValidacion(
                    codigo="exceso_de_nulos",
                    severidad=SeveridadHallazgo.ADVERTENCIA,
                    columna=nombre,
                    mensaje=f"'{nombre}' tiene {nulos / total:.1%} de valores vacíos.",
                    filas_afectadas=nulos,
                    sugerencia="Impute o descarte la columna antes de usarla en los gráficos.",
                )
            )

        if es_texto(serie):
            no_nulos = serie.dropna().astype(str)
            if no_nulos.empty:
                continue

            # Variantes que sólo difieren en mayúsculas, tildes o espacios.
            agrupado: dict[str, set[str]] = {}
            for valor in no_nulos.unique():
                agrupado.setdefault(normalizar(valor), set()).add(valor)
            colisiones = {k: v for k, v in agrupado.items() if len(v) > 1}
            if colisiones:
                ejemplos = [" / ".join(sorted(v)) for v in list(colisiones.values())[:3]]
                afectadas = int(
                    no_nulos[no_nulos.map(lambda v: normalizar(v) in colisiones)].shape[0]
                )
                hallazgos.append(
                    HallazgoValidacion(
                        codigo="inconsistencia_de_formato",
                        severidad=SeveridadHallazgo.ADVERTENCIA,
                        columna=nombre,
                        mensaje=(
                            f"'{nombre}' contiene {len(colisiones)} categoría(s) escritas de "
                            "varias formas (mayúsculas, tildes o espacios)."
                        ),
                        filas_afectadas=afectadas,
                        ejemplos=ejemplos,
                        sugerencia="Normalice el texto para no dividir la misma categoría.",
                    )
                )

            if normalizar(nombre).startswith(("id", "codigo", "clave")):
                repetidos = int(no_nulos.duplicated().sum())
                if repetidos:
                    hallazgos.append(
                        HallazgoValidacion(
                            codigo="identificador_duplicado",
                            severidad=SeveridadHallazgo.CRITICO,
                            columna=nombre,
                            mensaje=f"'{nombre}' parece un identificador y repite {repetidos} valor(es).",
                            filas_afectadas=repetidos,
                            ejemplos=[str(v) for v in no_nulos[no_nulos.duplicated()].head(5)],
                            sugerencia="Verifique el origen: puede haber registros duplicados.",
                        )
                    )

        elif pd.api.types.is_numeric_dtype(serie):
            valores = pd.to_numeric(serie, errors="coerce").dropna()
            if len(valores) > 10:
                desviacion = float(valores.std(ddof=1))
                if desviacion > 0:
                    z = np.abs((valores - valores.mean()) / desviacion)
                    extremos = int((z > 4).sum())
                    if extremos and extremos / len(valores) < UMBRAL_ATIPICOS:
                        hallazgos.append(
                            HallazgoValidacion(
                                codigo="atipicos_extremos",
                                severidad=SeveridadHallazgo.INFO,
                                columna=nombre,
                                mensaje=(
                                    f"'{nombre}' tiene {extremos} valor(es) a más de 4 desviaciones "
                                    "estándar de la media."
                                ),
                                filas_afectadas=extremos,
                                ejemplos=[f"{v:g}" for v in valores[z > 4].head(5)],
                                sugerencia="Confirme si son errores de captura o casos legítimos.",
                            )
                        )

    return hallazgos


_PESOS = {
    SeveridadHallazgo.CRITICO: 12.0,
    SeveridadHallazgo.ADVERTENCIA: 5.0,
    SeveridadHallazgo.INFO: 1.0,
}


def _puntuacion(hallazgos: list[HallazgoValidacion], filas: int) -> float:
    """100 = sin incidencias. Cada hallazgo descuenta según severidad y alcance."""
    if filas == 0:
        return 0.0
    penalizacion = 0.0
    for hallazgo in hallazgos:
        alcance = min(hallazgo.filas_afectadas / filas, 1.0) if filas else 1.0
        penalizacion += _PESOS[hallazgo.severidad] * (0.4 + 0.6 * alcance)
    return round(max(0.0, 100.0 - penalizacion), 2)


def validar_consistencia(df: pd.DataFrame, dataset_id: str) -> InformeValidacion:
    """Ejecuta el proceso completo de validación simulada."""
    inicio = time.perf_counter()

    hallazgos_catalogo, fuentes_catalogo = _validar_catalogos(df)
    hallazgos_rango, fuentes_rango = _validar_rangos(df)
    hallazgos = hallazgos_catalogo + hallazgos_rango + _validar_estructura(df)

    orden = {
        SeveridadHallazgo.CRITICO: 0,
        SeveridadHallazgo.ADVERTENCIA: 1,
        SeveridadHallazgo.INFO: 2,
    }
    hallazgos.sort(key=lambda h: (orden[h.severidad], -h.filas_afectadas))

    fuentes = fuentes_catalogo + fuentes_rango
    latencia_simulada = sum(f.latencia_ms for f in fuentes)
    duracion_real = int((time.perf_counter() - inicio) * 1000)

    return InformeValidacion(
        dataset_id=dataset_id,
        ejecutado_en=datetime.now(timezone.utc).isoformat(),
        duracion_ms=duracion_real + latencia_simulada,
        fuentes=fuentes,
        hallazgos=hallazgos,
        puntuacion_consistencia=_puntuacion(hallazgos, len(df)),
        filas_analizadas=int(len(df)),
        simulado=True,
    )
