"""Generación de los 5 datasets de muestra (Excel y CSV).

Cada dataset está diseñado para contener los cuatro tipos de variable, de modo
que sirven como banco de pruebas del clasificador y del dashboard.
Los datos son sintéticos y deterministas (semilla fija): la misma descarga
produce siempre el mismo archivo.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from app.models.schemas import ArchivoMuestra, CatalogoMuestras, TipoVariable

TODOS_LOS_TIPOS = [
    TipoVariable.NOMINAL,
    TipoVariable.ORDINAL,
    TipoVariable.DISCRETA,
    TipoVariable.CONTINUA,
]


@dataclass(frozen=True)
class DefinicionMuestra:
    id: str
    nombre: str
    descripcion: str
    generador: Callable[[], pd.DataFrame]


def _rng(semilla: int) -> np.random.Generator:
    return np.random.default_rng(semilla)


# ---------------------------------------------------------------------------
# Generadores
# ---------------------------------------------------------------------------
def _ventas_retail() -> pd.DataFrame:
    rng = _rng(101)
    n = 240
    regiones = ["Norte", "Sur", "Centro", "Oriente", "Occidente"]
    categorias = ["Electrónica", "Hogar", "Ropa", "Alimentos", "Deportes"]
    satisfaccion = ["Malo", "Regular", "Bueno", "Excelente"]

    cantidad = rng.integers(1, 25, n)
    precio = np.round(rng.gamma(shape=4.0, scale=28.0, size=n) + 5, 2)
    descuento = np.round(rng.choice([0, 5, 10, 15, 20], n, p=[0.4, 0.25, 0.2, 0.1, 0.05]), 2)
    monto = np.round(cantidad * precio * (1 - descuento / 100), 2)

    return pd.DataFrame(
        {
            "ID Pedido": [f"PED-{2024000 + i}" for i in range(n)],
            "Fecha Venta": pd.date_range("2024-01-02", periods=n, freq="D").strftime("%Y-%m-%d"),
            "Región": rng.choice(regiones, n),
            "Categoría Producto": rng.choice(categorias, n),
            "Canal": rng.choice(["Tienda física", "Online", "Distribuidor"], n, p=[0.45, 0.4, 0.15]),
            "Satisfacción Cliente": rng.choice(satisfaccion, n, p=[0.08, 0.22, 0.45, 0.25]),
            "Cantidad Vendida": cantidad,
            "Precio Unitario": precio,
            "Descuento Aplicado": descuento,
            "Monto Total": monto,
        }
    )


def _encuesta_satisfaccion() -> pd.DataFrame:
    rng = _rng(202)
    n = 200
    likert = [
        "Muy insatisfecho",
        "Insatisfecho",
        "Neutral",
        "Satisfecho",
        "Muy satisfecho",
    ]
    nps = rng.integers(0, 11, n)

    return pd.DataFrame(
        {
            "ID Encuesta": [f"ENC-{i:04d}" for i in range(1, n + 1)],
            "Género": rng.choice(["Masculino", "Femenino"], n),
            "Grupo Edad": rng.choice(["18-25", "26-35", "36-50", "51-65", "66+"], n),
            "Nivel Educativo": rng.choice(
                ["Primaria", "Secundaria", "Técnico", "Universitario", "Postgrado"],
                n,
                p=[0.05, 0.25, 0.25, 0.35, 0.10],
            ),
            "Satisfacción General": rng.choice(likert, n, p=[0.05, 0.12, 0.23, 0.4, 0.2]),
            "Frecuencia de Uso": rng.choice(
                ["Nunca", "Casi nunca", "A veces", "Casi siempre", "Siempre"], n
            ),
            "Puntuación NPS": nps,
            "Número de Compras": rng.poisson(4, n),
            "Gasto Mensual": np.round(rng.lognormal(4.2, 0.6, n), 2),
            "Recomendaría": np.where(nps >= 7, "Sí", "No"),
        }
    )


def _mediciones_climaticas() -> pd.DataFrame:
    rng = _rng(303)
    n = 365
    dia = np.arange(n)
    estacional = 12 * np.sin(2 * np.pi * dia / 365)

    return pd.DataFrame(
        {
            "Estación Meteorológica": rng.choice(
                ["Andes-01", "Costa-02", "Selva-03", "Valle-04"], n
            ),
            "Fecha Medición": pd.date_range("2024-01-01", periods=n, freq="D").strftime("%d/%m/%Y"),
            "Temperatura Media": np.round(18 + estacional + rng.normal(0, 2.2, n), 1),
            "Humedad Relativa": np.round(np.clip(rng.normal(68, 12, n), 15, 100), 1),
            "Presión Atmosférica": np.round(rng.normal(1013, 6, n), 2),
            "Velocidad del Viento": np.round(np.abs(rng.gamma(2.0, 3.0, n)), 2),
            "Precipitación": np.round(np.abs(rng.exponential(4.5, n)) * (rng.random(n) > 0.55), 2),
            "Días de Lluvia Acumulados": np.cumsum(rng.random(n) > 0.62),
            "Calidad del Aire": rng.choice(
                ["Baja", "Media", "Alta"], n, p=[0.2, 0.55, 0.25]
            ),
        }
    )


def _censo_hogares() -> pd.DataFrame:
    rng = _rng(404)
    n = 300
    habitantes = rng.integers(1, 9, n)
    estrato = rng.integers(1, 6, n)
    ingreso = np.round(np.exp(6.4 + 0.35 * estrato + rng.normal(0, 0.35, n)), 2)

    return pd.DataFrame(
        {
            "ID Hogar": [f"HOG{i:05d}" for i in range(1, n + 1)],
            "Departamento": rng.choice(
                ["Lima", "Arequipa", "Cusco", "Piura", "La Libertad", "Junín"], n
            ),
            "Zona": rng.choice(["Urbano", "Rural"], n, p=[0.72, 0.28]),
            "Estrato Socioeconómico": estrato,
            "Número de Habitantes": habitantes,
            "Número de Habitaciones": np.clip(habitantes - rng.integers(0, 3, n), 1, None),
            "Ingreso Mensual del Hogar": ingreso,
            "Gasto en Alimentos": np.round(ingreso * rng.uniform(0.18, 0.42, n), 2),
            "Nivel Educativo Jefe": rng.choice(
                ["Primaria", "Secundaria", "Técnico", "Universitario"], n, p=[0.18, 0.4, 0.24, 0.18]
            ),
            "Tiene Internet": rng.choice(["Sí", "No"], n, p=[0.66, 0.34]),
        }
    )


def _rendimiento_academico() -> pd.DataFrame:
    rng = _rng(505)
    n = 220
    horas = np.round(np.clip(rng.normal(9.5, 3.4, n), 0.5, 24), 1)
    faltas = rng.poisson(3, n)
    nota = np.round(np.clip(6.5 + 0.55 * horas - 0.35 * faltas + rng.normal(0, 1.6, n), 0, 20), 1)

    def letra(valor: float) -> str:
        if valor >= 18:
            return "A"
        if valor >= 15:
            return "B"
        if valor >= 12:
            return "C"
        if valor >= 10:
            return "D"
        return "F"

    def desempeno(valor: float) -> str:
        if valor >= 15:
            return "Destacado"
        if valor >= 11:
            return "Aprobado"
        return "Desaprobado"

    return pd.DataFrame(
        {
            "Código Estudiante": [f"EST-{i:04d}" for i in range(1, n + 1)],
            "Sección": rng.choice(["A", "B", "C", "D"], n),
            "Turno": rng.choice(["Mañana", "Tarde", "Noche"], n),
            "Género": rng.choice(["Masculino", "Femenino"], n),
            "Horas de Estudio Semanal": horas,
            "Número de Faltas": faltas,
            "Nota Final": nota,
            "Calificación Letra": [letra(v) for v in nota],
            "Nivel de Desempeño": [desempeno(v) for v in nota],
            "Beca": rng.choice(["Sí", "No"], n, p=[0.28, 0.72]),
        }
    )


MUESTRAS: tuple[DefinicionMuestra, ...] = (
    DefinicionMuestra(
        id="ventas-retail",
        nombre="Ventas Retail 2024",
        descripcion="Pedidos por región, canal y categoría, con montos y descuentos.",
        generador=_ventas_retail,
    ),
    DefinicionMuestra(
        id="encuesta-satisfaccion",
        nombre="Encuesta de Satisfacción",
        descripcion="Escalas Likert, NPS y gasto mensual por perfil demográfico.",
        generador=_encuesta_satisfaccion,
    ),
    DefinicionMuestra(
        id="mediciones-climaticas",
        nombre="Mediciones Climáticas",
        descripcion="Serie diaria de un año con temperatura, humedad y precipitación.",
        generador=_mediciones_climaticas,
    ),
    DefinicionMuestra(
        id="censo-hogares",
        nombre="Censo de Hogares",
        descripcion="Estratos, integrantes e ingresos por departamento y zona.",
        generador=_censo_hogares,
    ),
    DefinicionMuestra(
        id="rendimiento-academico",
        nombre="Rendimiento Académico",
        descripcion="Notas, horas de estudio y niveles de desempeño por sección.",
        generador=_rendimiento_academico,
    ),
)

_POR_ID = {m.id: m for m in MUESTRAS}
_CACHE: dict[tuple[str, str], bytes] = {}


def obtener_definicion(muestra_id: str) -> DefinicionMuestra | None:
    return _POR_ID.get(muestra_id)


def generar_dataframe(muestra_id: str) -> pd.DataFrame | None:
    definicion = _POR_ID.get(muestra_id)
    return definicion.generador() if definicion else None


def _a_excel(df: pd.DataFrame, nombre_hoja: str) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as escritor:
        df.to_excel(escritor, sheet_name=nombre_hoja[:31], index=False)
        libro, hoja = escritor.book, escritor.sheets[nombre_hoja[:31]]
        formato_encabezado = libro.add_format(
            {
                "bold": True,
                "font_color": "#FFFFFF",
                "bg_color": "#0F766E",
                "border": 1,
                "align": "center",
                "valign": "vcenter",
                "text_wrap": True,
            }
        )
        for indice, columna in enumerate(df.columns):
            hoja.write(0, indice, str(columna), formato_encabezado)
            ancho = max(len(str(columna)), int(df[columna].astype(str).str.len().max() or 10))
            hoja.set_column(indice, indice, min(max(ancho + 2, 12), 38))
        hoja.freeze_panes(1, 0)
        hoja.autofilter(0, 0, len(df), max(len(df.columns) - 1, 0))
    return buffer.getvalue()


def _a_csv(df: pd.DataFrame) -> bytes:
    # BOM para que Excel abra correctamente los acentos.
    return df.to_csv(index=False).encode("utf-8-sig")


def generar_archivo(muestra_id: str, formato: str) -> tuple[bytes, str] | None:
    """Devuelve ``(contenido, nombre_archivo)`` o ``None`` si no existe la muestra."""
    definicion = _POR_ID.get(muestra_id)
    if definicion is None or formato not in ("xlsx", "csv"):
        return None

    clave = (muestra_id, formato)
    if clave not in _CACHE:
        df = definicion.generador()
        _CACHE[clave] = _a_excel(df, definicion.nombre) if formato == "xlsx" else _a_csv(df)

    return _CACHE[clave], f"{muestra_id}.{formato}"


def construir_catalogo(prefijo_url: str = "/api/muestras") -> CatalogoMuestras:
    """Catálogo con las 5 muestras en cada formato (5 Excel + 5 CSV)."""
    excel: list[ArchivoMuestra] = []
    csv: list[ArchivoMuestra] = []

    for definicion in MUESTRAS:
        df = definicion.generador()
        for formato, destino in (("xlsx", excel), ("csv", csv)):
            destino.append(
                ArchivoMuestra(
                    id=definicion.id,
                    nombre=definicion.nombre,
                    descripcion=definicion.descripcion,
                    formato=formato,
                    filas=int(df.shape[0]),
                    columnas=int(df.shape[1]),
                    tipos_incluidos=TODOS_LOS_TIPOS,
                    url=f"{prefijo_url}/{definicion.id}/{formato}",
                )
            )

    return CatalogoMuestras(excel=excel, csv=csv)
