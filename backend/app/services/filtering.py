"""Motor de filtrado estilo Power BI.

Los filtros se combinan con AND. Cada filtro produce una máscara booleana
sobre el ``DataFrame`` original; el resultado alimenta tanto las métricas como
los gráficos, de modo que todo el dashboard reacciona a la vez.

La misma semántica está implementada en el cliente (``frontend/lib/filters.js``)
para que la respuesta sea inmediata mientras el backend recalcula el informe.
"""

from __future__ import annotations

import pandas as pd

from app.core.errors import InvalidFilterError
from app.models.schemas import Filtro, TipoFiltro


def _serie_texto(serie: pd.Series) -> pd.Series:
    return serie.astype(str)


def _mascara_categorico(serie: pd.Series, filtro: Filtro) -> pd.Series:
    valores = filtro.valores or []
    if not valores:
        # Sin valores seleccionados no se filtra nada (equivale a "todos").
        return pd.Series(True, index=serie.index)

    seleccionados = set(valores)
    pertenece = _serie_texto(serie).isin(seleccionados) & serie.notna()
    mascara = ~pertenece if filtro.excluir else pertenece

    if serie.isna().any():
        # Los nulos se controlan aparte: nunca "pertenecen" a una categoría.
        mascara = mascara.where(serie.notna(), filtro.incluir_nulos)
    return mascara


def _mascara_rango(serie: pd.Series, filtro: Filtro) -> pd.Series:
    numerica = pd.to_numeric(serie, errors="coerce")
    mascara = pd.Series(True, index=serie.index)
    if filtro.minimo is not None:
        mascara &= numerica >= filtro.minimo
    if filtro.maximo is not None:
        mascara &= numerica <= filtro.maximo
    return mascara.where(numerica.notna(), filtro.incluir_nulos)


def _mascara_fecha(serie: pd.Series, filtro: Filtro) -> pd.Series:
    fechas = pd.to_datetime(serie, errors="coerce")
    mascara = pd.Series(True, index=serie.index)
    if filtro.desde:
        mascara &= fechas >= pd.to_datetime(filtro.desde, errors="coerce")
    if filtro.hasta:
        mascara &= fechas <= pd.to_datetime(filtro.hasta, errors="coerce")
    return mascara.where(fechas.notna(), filtro.incluir_nulos)


def _mascara_texto(serie: pd.Series, filtro: Filtro) -> pd.Series:
    patron = (filtro.contiene or "").strip()
    if not patron:
        return pd.Series(True, index=serie.index)

    texto = _serie_texto(serie)
    coincide = texto.str.contains(patron, case=filtro.sensible_mayusculas, regex=False, na=False)
    return coincide.where(serie.notna(), filtro.incluir_nulos)


def _mascara_nulos(serie: pd.Series, filtro: Filtro) -> pd.Series:
    return serie.notna() if not filtro.incluir_nulos else pd.Series(True, index=serie.index)


_ESTRATEGIAS = {
    TipoFiltro.CATEGORICO: _mascara_categorico,
    TipoFiltro.RANGO: _mascara_rango,
    TipoFiltro.FECHA: _mascara_fecha,
    TipoFiltro.TEXTO: _mascara_texto,
    TipoFiltro.NULOS: _mascara_nulos,
}


def filtro_es_activo(filtro: Filtro) -> bool:
    """Un filtro sin criterio no debe contarse como aplicado."""
    if filtro.tipo == TipoFiltro.CATEGORICO:
        return bool(filtro.valores)
    if filtro.tipo == TipoFiltro.RANGO:
        return filtro.minimo is not None or filtro.maximo is not None
    if filtro.tipo == TipoFiltro.FECHA:
        return bool(filtro.desde or filtro.hasta)
    if filtro.tipo == TipoFiltro.TEXTO:
        return bool((filtro.contiene or "").strip())
    if filtro.tipo == TipoFiltro.NULOS:
        return not filtro.incluir_nulos
    return False


def aplicar_filtros(df: pd.DataFrame, filtros: list[Filtro]) -> tuple[pd.DataFrame, int]:
    """Devuelve el ``DataFrame`` filtrado y el número de filtros realmente activos."""
    activos = [f for f in filtros if filtro_es_activo(f)]
    if not activos:
        return df, 0

    mascara = pd.Series(True, index=df.index)
    for filtro in activos:
        if filtro.columna not in df.columns:
            raise InvalidFilterError(
                f"La columna '{filtro.columna}' no existe en el dataset.",
                detail="Vuelva a cargar el archivo o actualice los filtros.",
            )
        estrategia = _ESTRATEGIAS.get(filtro.tipo)
        if estrategia is None:  # pragma: no cover - el enum cubre todos los casos
            raise InvalidFilterError(f"Tipo de filtro no soportado: {filtro.tipo}.")
        mascara &= estrategia(df[filtro.columna], filtro).fillna(False).astype(bool)

    return df[mascara].reset_index(drop=True), len(activos)
