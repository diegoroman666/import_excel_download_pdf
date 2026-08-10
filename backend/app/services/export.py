"""Exportación de datos y de informes a Excel / CSV."""

from __future__ import annotations

import io

import pandas as pd

from app.models.schemas import ColumnaAnalizada
from app.services.statistics import construir_tablas_frecuencia

_ENCABEZADO = {
    "bold": True,
    "font_color": "#FFFFFF",
    "bg_color": "#0F766E",
    "border": 1,
    "align": "center",
    "valign": "vcenter",
    "text_wrap": True,
}


def _escribir_hoja(escritor: pd.ExcelWriter, df: pd.DataFrame, nombre: str) -> None:
    hoja_nombre = nombre[:31]
    df.to_excel(escritor, sheet_name=hoja_nombre, index=False)
    libro, hoja = escritor.book, escritor.sheets[hoja_nombre]
    formato = libro.add_format(_ENCABEZADO)
    for indice, columna in enumerate(df.columns):
        hoja.write(0, indice, str(columna), formato)
        try:
            ancho_datos = int(df[columna].astype(str).str.len().max() or 10)
        except (TypeError, ValueError):  # pragma: no cover - columnas exóticas
            ancho_datos = 12
        hoja.set_column(indice, indice, min(max(len(str(columna)), ancho_datos) + 2, 42))
    if len(df):
        hoja.autofilter(0, 0, len(df), max(len(df.columns) - 1, 0))
    hoja.freeze_panes(1, 0)


def datos_a_excel(df: pd.DataFrame, nombre_hoja: str = "Datos") -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as escritor:
        _escribir_hoja(escritor, df, nombre_hoja)
    return buffer.getvalue()


def datos_a_csv(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8-sig")


def informe_a_excel(df: pd.DataFrame, columnas: list[ColumnaAnalizada]) -> bytes:
    """Libro con datos, clasificación, estadística descriptiva y frecuencias."""
    clasificacion = pd.DataFrame(
        [
            {
                "Columna": c.nombre,
                "Tipo de variable": c.tipo.value,
                "Rol": c.rol.value,
                "Confianza": c.confianza,
                "Justificación": c.justificacion,
                "Tipo Pandas": c.dtype_pandas,
                "Valores únicos": c.unicos,
                "Nulos": c.nulos,
                "% Nulos": c.porcentaje_nulos,
            }
            for c in columnas
        ]
    )

    filas_estadistica = []
    for columna in columnas:
        resumen = columna.resumen_numerico
        if resumen is None:
            continue
        filas_estadistica.append(
            {
                "Columna": columna.nombre,
                "N": resumen.conteo,
                "Media": resumen.media,
                "Mediana": resumen.mediana,
                "Moda": ", ".join(str(m) for m in resumen.moda) or "Sin moda",
                "Desv. estándar": resumen.desviacion_estandar,
                "Varianza": resumen.varianza,
                "Mínimo": resumen.minimo,
                "Máximo": resumen.maximo,
                "Rango": resumen.rango,
                "Q1": resumen.q1,
                "Q2": resumen.q2,
                "Q3": resumen.q3,
                "IQR": resumen.iqr,
                "Coef. variación": resumen.coeficiente_variacion,
                "Asimetría": resumen.asimetria,
                "Curtosis": resumen.curtosis,
                "Atípicos": resumen.atipicos,
            }
        )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as escritor:
        _escribir_hoja(escritor, df, "Datos")
        _escribir_hoja(escritor, clasificacion, "Clasificación")
        if filas_estadistica:
            _escribir_hoja(escritor, pd.DataFrame(filas_estadistica), "Estadística")

        # Una hoja de frecuencias con las primeras columnas para no inflar el libro.
        bloques: list[pd.DataFrame] = []
        for columna in columnas[:10]:
            tablas = construir_tablas_frecuencia(
                df[columna.nombre], columna.tipo, columna.nombre, columna.escala_orden
            )
            if not tablas.no_agrupada:
                continue
            bloque = pd.DataFrame(
                [
                    {
                        "Columna": columna.nombre,
                        "Valor": fila.valor,
                        "Frec. absoluta": fila.frecuencia_absoluta,
                        "Frec. relativa": fila.frecuencia_relativa,
                        "Frec. acumulada": fila.frecuencia_acumulada,
                        "Frec. rel. acumulada": fila.frecuencia_relativa_acumulada,
                    }
                    for fila in tablas.no_agrupada[:100]
                ]
            )
            bloques.append(bloque)
        if bloques:
            _escribir_hoja(escritor, pd.concat(bloques, ignore_index=True), "Frecuencias")

    return buffer.getvalue()
