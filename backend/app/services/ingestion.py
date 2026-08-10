"""Lectura y saneamiento de archivos subidos (Excel / CSV) con Pandas."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

import pandas as pd

from app.core.config import settings
from app.core.dtypes import es_texto
from app.core.errors import EmptyDatasetError, UnsupportedFileError

_EXCEL_EXT = {".xlsx", ".xls", ".xlsm"}
_TEXT_EXT = {".csv", ".tsv", ".txt"}
_UNNAMED = re.compile(r"^Unnamed:\s*\d+$")
# Espacios (incluido el no separable) que aparecen como separador de millares.
_ESPACIOS = r"[\s  ]"
# 1.234,56 -> formato europeo; el punto agrupa millares y la coma es decimal.
_FORMATO_EUROPEO = r"^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+,\d+$"
# Carácter que no aparece en archivos reales: fuerza la lectura en una columna.
_SEPARADOR_COLUMNA_UNICA = "\x01"


@dataclass
class ResultadoIngesta:
    df: pd.DataFrame
    hoja: str | None
    avisos: list[str] = field(default_factory=list)
    filas_originales: int = 0


def _extension(nombre: str) -> str:
    punto = nombre.rfind(".")
    return nombre[punto:].lower() if punto != -1 else ""


def _campos_por_linea(lineas: list[str], separador: str) -> list[int]:
    """Número de campos por línea usando el parser CSV (respeta comillas)."""
    try:
        return [len(fila) for fila in csv.reader(lineas, delimiter=separador)]
    except csv.Error:  # pragma: no cover - delimitadores exóticos
        return []


def _detectar_separador(muestra: str) -> str:
    """Elige el delimitador que parte el archivo en columnas consistentes.

    Se exige que el encabezado se divida en 2 o más campos y que todas las
    líneas coincidan en el número de campos. Si ningún candidato lo consigue,
    el archivo es de una sola columna: se devuelve un carácter de control que
    no aparece en el texto para que Pandas no parta valores como ``1.234,56``.
    """
    lineas = [linea for linea in muestra.splitlines() if linea.strip()][:20]
    if not lineas:
        return ","

    mejor, campos_mejor = None, 1
    for candidato in (",", ";", "\t", "|"):
        conteos = _campos_por_linea(lineas, candidato)
        if not conteos or conteos[0] < 2:
            continue
        if len(set(conteos)) == 1 and conteos[0] > campos_mejor:
            mejor, campos_mejor = candidato, conteos[0]

    if mejor is not None:
        return mejor

    # Segunda pasada sin exigir consistencia (archivos con filas irregulares).
    for candidato in (",", ";", "\t", "|"):
        conteos = _campos_por_linea(lineas, candidato)
        if conteos and conteos[0] >= 2:
            return candidato

    return _SEPARADOR_COLUMNA_UNICA


def _leer_texto(contenido: bytes, avisos: list[str]) -> pd.DataFrame:
    texto: str | None = None
    for codificacion in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            texto = contenido.decode(codificacion)
            if codificacion == "latin-1":
                avisos.append("Archivo decodificado como latin-1.")
            break
        except UnicodeDecodeError:
            continue
    if texto is None:  # pragma: no cover - latin-1 nunca falla
        raise UnsupportedFileError("No se pudo decodificar el archivo de texto.")

    separador = _detectar_separador(texto[:8192])
    if separador not in (",", _SEPARADOR_COLUMNA_UNICA):
        nombre = {"\t": "tabulación", ";": "punto y coma", "|": "barra vertical"}[separador]
        avisos.append(f"Delimitador detectado automáticamente: {nombre} ('{separador}').")
    return pd.read_csv(io.StringIO(texto), sep=separador, engine="python", skip_blank_lines=True)


def _leer_excel(contenido: bytes, hoja: str | None, avisos: list[str]) -> tuple[pd.DataFrame, str]:
    libro = pd.ExcelFile(io.BytesIO(contenido))
    hojas = libro.sheet_names
    if not hojas:
        raise EmptyDatasetError("El libro de Excel no contiene hojas.")

    objetivo = hoja if hoja in hojas else hojas[0]
    if hoja and hoja not in hojas:
        avisos.append(f"La hoja '{hoja}' no existe; se usó '{objetivo}'.")
    if len(hojas) > 1:
        avisos.append(f"El libro tiene {len(hojas)} hojas; se analizó '{objetivo}'.")

    return libro.parse(objetivo), objetivo


def _normalizar_encabezados(df: pd.DataFrame, avisos: list[str]) -> pd.DataFrame:
    nombres: list[str] = []
    vistos: dict[str, int] = {}
    anonimas = 0

    for indice, bruto in enumerate(df.columns):
        nombre = "" if bruto is None else str(bruto).strip()
        if not nombre or nombre.lower() == "nan" or _UNNAMED.match(nombre):
            anonimas += 1
            nombre = f"Columna {indice + 1}"
        nombre = re.sub(r"\s+", " ", nombre)

        if nombre in vistos:
            vistos[nombre] += 1
            nombre = f"{nombre} ({vistos[nombre]})"
            avisos.append(f"Encabezado duplicado renombrado a '{nombre}'.")
        else:
            vistos[nombre] = 0
        nombres.append(nombre)

    if anonimas:
        avisos.append(f"{anonimas} columna(s) sin encabezado recibieron un nombre automático.")

    df.columns = nombres
    return df


def _limpiar(df: pd.DataFrame, avisos: list[str]) -> pd.DataFrame:
    """Quita filas/columnas totalmente vacías y espacios sobrantes en texto."""
    antes_filas, antes_cols = df.shape
    df = df.dropna(axis=1, how="all").dropna(axis=0, how="all")

    if df.shape[1] < antes_cols:
        avisos.append(f"Se descartaron {antes_cols - df.shape[1]} columna(s) completamente vacías.")
    if df.shape[0] < antes_filas:
        avisos.append(f"Se descartaron {antes_filas - df.shape[0]} fila(s) completamente vacías.")

    for columna in df.columns:
        if es_texto(df[columna]):
            # .map preserva los valores no textuales de las columnas mixtas.
            limpia = df[columna].map(lambda v: v.strip() if isinstance(v, str) else v)
            df[columna] = limpia.replace({"": None})

    return df.reset_index(drop=True)


def _a_numerico(serie: pd.Series) -> pd.Series:
    """Convierte texto a número admitiendo ``1.234,56`` y ``1,234.56``.

    Los valores no convertibles quedan como ``NaN``.
    """
    texto = serie.astype(str).str.strip().str.replace(_ESPACIOS, "", regex=True)
    europeo = texto.str.match(_FORMATO_EUROPEO)
    normalizado = texto.where(
        ~europeo,
        texto.str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
    )
    # En notación anglosajona la coma sólo agrupa millares.
    normalizado = normalizado.where(europeo, normalizado.str.replace(",", "", regex=False))
    return pd.to_numeric(normalizado, errors="coerce")


def _inferir_tipos(df: pd.DataFrame) -> pd.DataFrame:
    """Convierte a numérico o fecha las columnas de texto que lo permitan.

    Se exige que el 90 % de los valores no nulos sean convertibles para evitar
    romper columnas mixtas donde el texto es significativo.
    """
    for columna in df.columns:
        serie = df[columna]
        if not es_texto(serie):
            continue

        no_nulos = serie.dropna()
        if no_nulos.empty:
            continue

        numerico = _a_numerico(no_nulos)
        if numerico.notna().mean() >= 0.9:
            completa = pd.Series(float("nan"), index=serie.index, dtype="float64")
            completa.loc[numerico.index] = numerico
            df[columna] = completa
            continue

        texto = no_nulos.astype(str)
        # Fecha: sólo si la mayoría parsea y hay separadores típicos.
        if texto.str.contains(r"[-/:]").mean() >= 0.6:
            fechas = pd.to_datetime(no_nulos, errors="coerce", format="mixed", dayfirst=True)
            if fechas.notna().mean() >= 0.9:
                convertida = pd.Series(pd.NaT, index=serie.index, dtype="datetime64[ns]")
                convertida.loc[fechas.index] = fechas
                df[columna] = convertida

    return df


def leer_dataset(
    contenido: bytes,
    nombre_archivo: str,
    hoja: str | None = None,
) -> ResultadoIngesta:
    """Convierte los bytes subidos en un ``DataFrame`` limpio y tipado."""
    avisos: list[str] = []
    extension = _extension(nombre_archivo)

    if extension in _EXCEL_EXT:
        df, hoja_usada = _leer_excel(contenido, hoja, avisos)
    elif extension in _TEXT_EXT:
        df, hoja_usada = _leer_texto(contenido, avisos), None
    else:
        permitidas = ", ".join(settings.allowed_extensions)
        raise UnsupportedFileError(
            f"Formato '{extension or 'desconocido'}' no soportado.",
            detail=f"Formatos admitidos: {permitidas}.",
        )

    if df is None or df.shape[1] == 0:
        raise EmptyDatasetError("El archivo no contiene datos legibles.")

    df = _normalizar_encabezados(df, avisos)
    df = _limpiar(df, avisos)

    if df.empty or df.shape[1] == 0:
        raise EmptyDatasetError("El archivo quedó vacío tras descartar filas y columnas sin datos.")

    filas_originales = len(df)
    if filas_originales > settings.max_rows:
        df = df.head(settings.max_rows)
        avisos.append(
            f"El archivo tiene {filas_originales} filas; "
            f"se analizaron las primeras {settings.max_rows}."
        )
    if df.shape[1] > settings.max_columns:
        df = df.iloc[:, : settings.max_columns]
        avisos.append(f"Se limitó el análisis a las primeras {settings.max_columns} columnas.")

    df = _inferir_tipos(df)

    return ResultadoIngesta(
        df=df,
        hoja=hoja_usada,
        avisos=avisos,
        filas_originales=filas_originales,
    )
