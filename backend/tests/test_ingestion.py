"""Pruebas de lectura y saneamiento de archivos."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.core.errors import EmptyDatasetError, UnsupportedFileError
from app.services.ingestion import leer_dataset


def test_lee_csv(csv_bytes):
    resultado = leer_dataset(csv_bytes, "datos.csv")
    assert resultado.df.shape == (12, 5)
    assert resultado.hoja is None


def test_lee_xlsx_y_reporta_la_hoja(xlsx_bytes):
    resultado = leer_dataset(xlsx_bytes, "datos.xlsx")
    assert resultado.df.shape == (12, 5)
    assert resultado.hoja == "Datos"


def test_detecta_separador_punto_y_coma():
    contenido = "a;b;c\n1;2;3\n4;5;6\n".encode()
    resultado = leer_dataset(contenido, "datos.csv")
    assert list(resultado.df.columns) == ["a", "b", "c"]
    assert any("Delimitador" in aviso for aviso in resultado.avisos)


def test_extension_no_soportada():
    with pytest.raises(UnsupportedFileError):
        leer_dataset(b"contenido", "documento.pdf")


def test_archivo_sin_filas_utiles():
    with pytest.raises(EmptyDatasetError):
        leer_dataset("a,b\n,\n,\n".encode(), "vacio.csv")


def test_los_encabezados_siempre_quedan_unicos():
    contenido = "Nombre,Nombre,\nx,y,z\n1,2,3\n".encode()
    resultado = leer_dataset(contenido, "dup.csv")
    columnas = list(resultado.df.columns)
    assert len(columnas) == len(set(columnas))
    assert columnas[0] == "Nombre"


def test_renombra_encabezados_que_colisionan_al_recortar_espacios():
    # Pandas los distingue por los espacios; tras normalizar colisionarían.
    contenido = "Ciudad, Ciudad \nLima,Cusco\nPiura,Ica\n".encode()
    resultado = leer_dataset(contenido, "dup.csv")
    assert list(resultado.df.columns) == ["Ciudad", "Ciudad (1)"]
    assert any("duplicado" in aviso for aviso in resultado.avisos)


def test_columna_unica_con_comas_decimales_no_se_parte():
    contenido = "Monto\n1.234,56\n2.500,00\n".encode()
    resultado = leer_dataset(contenido, "montos.csv")
    assert list(resultado.df.columns) == ["Monto"]


def test_descarta_columnas_completamente_vacias():
    contenido = "a,b,c\n1,,3\n2,,4\n".encode()
    resultado = leer_dataset(contenido, "vacia.csv")
    assert list(resultado.df.columns) == ["a", "c"]


def test_convierte_numeros_en_formato_europeo():
    contenido = "Monto\n1.234,56\n2.500,00\n980,25\n".encode()
    resultado = leer_dataset(contenido, "montos.csv")
    assert pd.api.types.is_numeric_dtype(resultado.df["Monto"])
    assert resultado.df["Monto"].tolist() == [1234.56, 2500.0, 980.25]


def test_convierte_numeros_en_formato_anglosajon():
    contenido = "Monto\n1,234.56\n2,500.00\n".encode()
    resultado = leer_dataset(contenido, "montos.csv")
    assert resultado.df["Monto"].tolist() == [1234.56, 2500.0]


def test_no_convierte_columnas_mayoritariamente_de_texto():
    contenido = "Clave\nA1\nB2\nC3\n4\n".encode()
    resultado = leer_dataset(contenido, "claves.csv")
    assert not pd.api.types.is_numeric_dtype(resultado.df["Clave"])


def test_detecta_fechas():
    contenido = "Fecha\n01/02/2024\n15/03/2024\n28/04/2024\n".encode()
    resultado = leer_dataset(contenido, "fechas.csv")
    assert pd.api.types.is_datetime64_any_dtype(resultado.df["Fecha"])


def test_recorta_espacios_en_texto():
    contenido = "Ciudad\n  Lima  \nCusco\n".encode()
    resultado = leer_dataset(contenido, "ciudades.csv")
    assert resultado.df["Ciudad"].tolist() == ["Lima", "Cusco"]


def test_lee_archivo_con_codificacion_latin1():
    contenido = "Región\nAndalucía\nCataluña\n".encode("latin-1")
    resultado = leer_dataset(contenido, "regiones.csv")
    assert "Región" in resultado.df.columns
    assert resultado.df.shape[0] == 2


def test_avisa_cuando_el_libro_tiene_varias_hojas(df_mixto):
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as escritor:
        df_mixto.to_excel(escritor, index=False, sheet_name="Primera")
        df_mixto.to_excel(escritor, index=False, sheet_name="Segunda")

    resultado = leer_dataset(buffer.getvalue(), "multi.xlsx")
    assert resultado.hoja == "Primera"
    assert any("2 hojas" in aviso for aviso in resultado.avisos)

    seleccionada = leer_dataset(buffer.getvalue(), "multi.xlsx", hoja="Segunda")
    assert seleccionada.hoja == "Segunda"
