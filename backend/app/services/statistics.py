"""Análisis estadístico automático de un ``DataFrame``.

Reproduce (y amplía) los cálculos que la aplicación original hacía en el
navegador: tendencia central, posición, dispersión y tablas de frecuencia.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    CategoriaFrecuencia,
    ColumnaAnalizada,
    IntervaloFrecuencia,
    MatrizCorrelacion,
    OpcionesFiltroColumna,
    ResumenGlobal,
    ResumenNumerico,
    TablasFrecuencia,
    TipoFiltro,
    TipoVariable,
)
from app.services.classification import Clasificacion, clasificar_dataframe, normalizar

#: Máximo de categorías distintas que se envían a la UI por columna.
MAX_CATEGORIAS_UI = 200
#: Máximo de categorías en el resumen "top" de cada columna.
TOP_CATEGORIAS = 12


# ---------------------------------------------------------------------------
# Utilidades numéricas seguras para JSON
# ---------------------------------------------------------------------------
def limpiar_numero(valor: Any) -> float | None:
    """Convierte a ``float`` serializable; ``NaN``/``inf`` pasan a ``None``."""
    if valor is None:
        return None
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    if math.isnan(numero) or math.isinf(numero):
        return None
    return round(numero, 6)


def valor_serializable(valor: Any) -> Any:
    """Normaliza un valor de celda a algo que ``json`` acepte."""
    if valor is None or (isinstance(valor, float) and (math.isnan(valor) or math.isinf(valor))):
        return None
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating,)):
        return limpiar_numero(valor)
    if isinstance(valor, (np.bool_, bool)):
        return bool(valor)
    if isinstance(valor, (pd.Timestamp,)):
        return valor.isoformat()
    if valor is pd.NaT:
        return None
    if isinstance(valor, (str, int, float)):
        return valor
    return str(valor)


def _serie_numerica(serie: pd.Series) -> np.ndarray:
    valores = pd.to_numeric(serie, errors="coerce").dropna().to_numpy(dtype="float64")
    return valores[np.isfinite(valores)]


# ---------------------------------------------------------------------------
# Medidas descriptivas
# ---------------------------------------------------------------------------
def calcular_moda(valores: np.ndarray) -> list[float]:
    """Moda(s) de una muestra. Si todos los valores son únicos, no hay moda."""
    if valores.size == 0:
        return []
    unicos, conteos = np.unique(valores, return_counts=True)
    maximo = int(conteos.max())
    if maximo <= 1:
        return []
    modas = unicos[conteos == maximo]
    return [limpiar_numero(m) for m in modas[:10] if limpiar_numero(m) is not None]


def resumen_numerico(serie: pd.Series) -> ResumenNumerico | None:
    """Estadística descriptiva completa de una columna numérica."""
    valores = _serie_numerica(serie)
    if valores.size == 0:
        return None

    media = float(np.mean(valores))
    desviacion = float(np.std(valores, ddof=1)) if valores.size > 1 else 0.0
    q1, q2, q3 = (float(np.percentile(valores, p)) for p in (25, 50, 75))
    iqr = q3 - q1
    atipicos = int(np.sum((valores < q1 - 1.5 * iqr) | (valores > q3 + 1.5 * iqr))) if iqr > 0 else 0
    serie_pd = pd.Series(valores)

    return ResumenNumerico(
        conteo=int(valores.size),
        media=limpiar_numero(media),
        mediana=limpiar_numero(q2),
        moda=calcular_moda(valores),
        desviacion_estandar=limpiar_numero(desviacion),
        varianza=limpiar_numero(desviacion**2),
        minimo=limpiar_numero(np.min(valores)),
        maximo=limpiar_numero(np.max(valores)),
        rango=limpiar_numero(np.max(valores) - np.min(valores)),
        q1=limpiar_numero(q1),
        q2=limpiar_numero(q2),
        q3=limpiar_numero(q3),
        iqr=limpiar_numero(iqr),
        coeficiente_variacion=limpiar_numero(desviacion / abs(media)) if media != 0 else None,
        asimetria=limpiar_numero(serie_pd.skew()) if valores.size > 2 else None,
        curtosis=limpiar_numero(serie_pd.kurtosis()) if valores.size > 3 else None,
        percentiles={
            f"p{p}": limpiar_numero(np.percentile(valores, p))
            for p in (1, 5, 10, 25, 50, 75, 90, 95, 99)
        },
        deciles={
            f"d{i}": limpiar_numero(np.percentile(valores, i * 10)) for i in range(1, 11)
        },
        atipicos=atipicos,
        suma=limpiar_numero(np.sum(valores)),
    )


def tabla_frecuencia_no_agrupada(
    serie: pd.Series,
    limite: int | None = None,
    orden_categorias: list[str] | None = None,
) -> list[CategoriaFrecuencia]:
    """Frecuencias absolutas, relativas y acumuladas por valor."""
    valores = serie.dropna()
    total = len(valores)
    if total == 0:
        return []

    conteos = valores.astype(str).value_counts()

    if orden_categorias:
        conteos = conteos.reindex(ordenar_por_escala(list(conteos.index), orden_categorias))
    elif pd.api.types.is_numeric_dtype(valores):
        conteos = conteos.reindex(
            sorted(conteos.index, key=lambda v: (float(v) if _es_float(v) else math.inf, str(v)))
        )
    else:
        conteos = conteos.sort_index()

    if limite is not None and len(conteos) > limite:
        conteos = conteos.head(limite)

    filas: list[CategoriaFrecuencia] = []
    acumulada = 0
    for valor, frecuencia in conteos.items():
        frecuencia = int(frecuencia)
        acumulada += frecuencia
        filas.append(
            CategoriaFrecuencia(
                valor=str(valor),
                frecuencia_absoluta=frecuencia,
                frecuencia_relativa=round(frecuencia / total, 6),
                frecuencia_acumulada=acumulada,
                frecuencia_relativa_acumulada=round(acumulada / total, 6),
            )
        )
    return filas


def _es_float(valor: Any) -> bool:
    try:
        float(valor)
        return True
    except (TypeError, ValueError):
        return False


def ordenar_por_escala(valores: list[Any], escala: list[str]) -> list[Any]:
    """Ordena etiquetas reales según una escala ordinal.

    La escala está normalizada (``"bajo"``) mientras que los datos conservan su
    grafía original (``"Bajo"``), por eso la comparación se hace normalizando.
    Los valores ajenos a la escala se colocan al final, en orden alfabético.
    """
    posicion = {normalizar(nivel): indice for indice, nivel in enumerate(escala)}
    fuera = len(posicion)
    return sorted(valores, key=lambda v: (posicion.get(normalizar(v), fuera), str(v)))


def tabla_frecuencia_agrupada(
    serie: pd.Series,
) -> tuple[list[IntervaloFrecuencia], int, float] | None:
    """Tabla agrupada por intervalos usando la regla de Sturges.

    Los intervalos son semiabiertos ``[a, b)`` salvo el último, que incluye el
    máximo — así ningún valor se cuenta dos veces.
    """
    valores = _serie_numerica(serie)
    if valores.size < 2:
        return None

    minimo, maximo = float(np.min(valores)), float(np.max(valores))
    if math.isclose(minimo, maximo):
        return None

    n = int(valores.size)
    clases = max(2, int(math.ceil(1 + 3.322 * math.log10(n))))
    amplitud = (maximo - minimo) / clases

    filas: list[IntervaloFrecuencia] = []
    acumulada = 0
    for indice in range(clases):
        inferior = minimo + indice * amplitud
        superior = maximo if indice == clases - 1 else minimo + (indice + 1) * amplitud
        if indice == clases - 1:
            mascara = (valores >= inferior) & (valores <= superior)
        else:
            mascara = (valores >= inferior) & (valores < superior)

        frecuencia = int(np.sum(mascara))
        acumulada += frecuencia
        cierre = "]" if indice == clases - 1 else ")"
        filas.append(
            IntervaloFrecuencia(
                intervalo=f"[{inferior:.2f} - {superior:.2f}{cierre}",
                limite_inferior=round(inferior, 6),
                limite_superior=round(superior, 6),
                marca_clase=round((inferior + superior) / 2, 6),
                frecuencia_absoluta=frecuencia,
                frecuencia_relativa=round(frecuencia / n, 6),
                frecuencia_acumulada=acumulada,
                frecuencia_relativa_acumulada=round(acumulada / n, 6),
            )
        )
    return filas, clases, round(amplitud, 6)


def construir_tablas_frecuencia(
    serie: pd.Series,
    tipo: TipoVariable,
    nombre: str,
    orden_categorias: list[str] | None = None,
) -> TablasFrecuencia:
    agrupada = None
    clases = None
    amplitud = None
    if tipo in (TipoVariable.CONTINUA, TipoVariable.DISCRETA):
        resultado = tabla_frecuencia_agrupada(serie)
        if resultado is not None:
            agrupada, clases, amplitud = resultado

    return TablasFrecuencia(
        columna=nombre,
        tipo=tipo,
        no_agrupada=tabla_frecuencia_no_agrupada(serie, limite=500, orden_categorias=orden_categorias),
        agrupada=agrupada,
        clases_sturges=clases,
        amplitud_clase=amplitud,
    )


# ---------------------------------------------------------------------------
# Informe por columna
# ---------------------------------------------------------------------------
def analizar_columna(
    serie: pd.Series,
    nombre: str,
    clave: str,
    clasificacion: Clasificacion,
) -> ColumnaAnalizada:
    total = int(len(serie))
    nulos = int(serie.isna().sum())
    no_nulos = serie.dropna()
    es_numerica = bool(pd.api.types.is_numeric_dtype(serie)) and not pd.api.types.is_bool_dtype(serie)

    return ColumnaAnalizada(
        nombre=nombre,
        clave=clave,
        tipo=clasificacion.tipo,
        rol=clasificacion.rol,
        dtype_pandas=str(serie.dtype),
        confianza=round(clasificacion.confianza, 3),
        justificacion=clasificacion.justificacion,
        escala_orden=clasificacion.escala_orden,
        total=total,
        nulos=nulos,
        porcentaje_nulos=round(nulos / total * 100, 2) if total else 0.0,
        unicos=int(no_nulos.nunique()),
        muestra=[valor_serializable(v) for v in no_nulos.head(5).tolist()],
        resumen_numerico=resumen_numerico(serie) if es_numerica else None,
        top_categorias=tabla_frecuencia_no_agrupada(
            serie, limite=TOP_CATEGORIAS, orden_categorias=clasificacion.escala_orden
        )
        if not es_numerica or clasificacion.tipo == TipoVariable.DISCRETA
        else [],
        es_numerica=es_numerica,
        es_graficable_x=True,
        es_graficable_y=es_numerica,
    )


def matriz_correlacion(df: pd.DataFrame, columnas_numericas: list[str]) -> MatrizCorrelacion:
    """Correlación de Pearson entre columnas numéricas."""
    if len(columnas_numericas) < 2:
        return MatrizCorrelacion(columnas=columnas_numericas, valores=[])

    matriz = df[columnas_numericas].apply(pd.to_numeric, errors="coerce").corr(numeric_only=True)
    return MatrizCorrelacion(
        columnas=[str(c) for c in matriz.columns],
        valores=[[limpiar_numero(v) for v in fila] for fila in matriz.to_numpy()],
    )


def opciones_filtro(
    serie: pd.Series,
    nombre: str,
    clasificacion: Clasificacion,
) -> OpcionesFiltroColumna:
    """Metadatos para pintar el control de filtro adecuado en la UI."""
    tiene_nulos = bool(serie.isna().any())
    no_nulos = serie.dropna()

    if pd.api.types.is_datetime64_any_dtype(serie):
        return OpcionesFiltroColumna(
            columna=nombre,
            tipo_control=TipoFiltro.FECHA,
            valores=[],
            minimo=None,
            maximo=None,
            tiene_nulos=tiene_nulos,
        )

    cuantitativa = clasificacion.tipo in (TipoVariable.DISCRETA, TipoVariable.CONTINUA)
    if cuantitativa and pd.api.types.is_numeric_dtype(serie):
        valores = _serie_numerica(serie)
        if valores.size:
            minimo, maximo = float(np.min(valores)), float(np.max(valores))
            rango = maximo - minimo
            paso = 1.0 if clasificacion.tipo == TipoVariable.DISCRETA else max(rango / 100, 1e-6)
            return OpcionesFiltroColumna(
                columna=nombre,
                tipo_control=TipoFiltro.RANGO,
                minimo=limpiar_numero(minimo),
                maximo=limpiar_numero(maximo),
                paso=limpiar_numero(paso),
                tiene_nulos=tiene_nulos,
            )

    unicos = no_nulos.astype(str).value_counts()
    if len(unicos) > MAX_CATEGORIAS_UI:
        return OpcionesFiltroColumna(
            columna=nombre,
            tipo_control=TipoFiltro.TEXTO,
            valores=[str(v) for v in unicos.head(MAX_CATEGORIAS_UI).index],
            valores_truncados=True,
            tiene_nulos=tiene_nulos,
        )

    if clasificacion.escala_orden:
        listado = ordenar_por_escala(list(unicos.index), clasificacion.escala_orden)
    else:
        listado = sorted(unicos.index, key=lambda v: (float(v) if _es_float(v) else math.inf, str(v)))

    return OpcionesFiltroColumna(
        columna=nombre,
        tipo_control=TipoFiltro.CATEGORICO,
        valores=[str(v) for v in listado],
        tiene_nulos=tiene_nulos,
    )


def resumen_global(df: pd.DataFrame, columnas: list[ColumnaAnalizada]) -> ResumenGlobal:
    celdas = int(df.shape[0] * df.shape[1])
    nulas = int(df.isna().sum().sum())
    conteo = {tipo: 0 for tipo in TipoVariable}
    for columna in columnas:
        conteo[columna.tipo] += 1

    numericas = sum(1 for c in columnas if c.es_numerica)
    return ResumenGlobal(
        filas=int(df.shape[0]),
        columnas=int(df.shape[1]),
        numericas=numericas,
        categoricas=len(columnas) - numericas,
        nominales=conteo[TipoVariable.NOMINAL],
        ordinales=conteo[TipoVariable.ORDINAL],
        discretas=conteo[TipoVariable.DISCRETA],
        continuas=conteo[TipoVariable.CONTINUA],
        celdas_totales=celdas,
        celdas_nulas=nulas,
        completitud=round((1 - nulas / celdas) * 100, 2) if celdas else 100.0,
        filas_duplicadas=int(df.duplicated().sum()),
        memoria_kb=round(df.memory_usage(deep=True).sum() / 1024, 2),
    )


def analizar_dataframe(
    df: pd.DataFrame,
    clasificaciones: dict[str, Clasificacion] | None = None,
) -> tuple[list[ColumnaAnalizada], MatrizCorrelacion, list[OpcionesFiltroColumna], ResumenGlobal]:
    """Ejecuta el análisis completo sobre un ``DataFrame`` (ya filtrado o no)."""
    clasificaciones = clasificaciones or clasificar_dataframe(df)

    columnas: list[ColumnaAnalizada] = []
    filtros: list[OpcionesFiltroColumna] = []
    for indice, nombre in enumerate(df.columns):
        nombre = str(nombre)
        clasificacion = clasificaciones.get(nombre)
        if clasificacion is None:  # pragma: no cover - defensivo
            from app.services.classification import clasificar_columna

            clasificacion = clasificar_columna(df[nombre], nombre)
        columnas.append(analizar_columna(df[nombre], nombre, f"col{indice}", clasificacion))
        filtros.append(opciones_filtro(df[nombre], nombre, clasificacion))

    numericas = [c.nombre for c in columnas if c.es_numerica]
    return columnas, matriz_correlacion(df, numericas), filtros, resumen_global(df, columnas)


def filas_serializables(df: pd.DataFrame, limite: int | None = None) -> list[dict[str, Any]]:
    """Convierte el ``DataFrame`` a una lista de diccionarios apta para JSON."""
    recorte = df if limite is None else df.head(limite)
    registros = recorte.to_dict(orient="records")
    return [{str(k): valor_serializable(v) for k, v in fila.items()} for fila in registros]
