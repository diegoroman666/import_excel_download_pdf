"""Ayudas de dtypes compatibles con Pandas 2.x y 3.x.

En Pandas 3 las columnas de texto dejan de ser ``object`` y pasan a tener un
dtype ``str`` dedicado, por lo que comprobar ``serie.dtype == object`` deja de
detectarlas. Estas funciones encapsulan esa diferencia.
"""

from __future__ import annotations

import pandas as pd


def es_texto(serie: pd.Series) -> bool:
    """``True`` si la columna contiene texto (dtype ``object`` o ``str``)."""
    if pd.api.types.is_numeric_dtype(serie) or pd.api.types.is_bool_dtype(serie):
        return False
    if pd.api.types.is_datetime64_any_dtype(serie):
        return False
    return serie.dtype == object or pd.api.types.is_string_dtype(serie)
