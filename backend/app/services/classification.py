"""Clasificación automática del tipo estadístico de cada variable.

Los cuatro tipos exigidos son:

* **Cualitativo Nominal**  — categorías sin orden natural (color, país).
* **Cualitativo Ordinal**  — categorías con orden (bajo < medio < alto).
* **Cuantitativo Discreto** — números contables, sin valores intermedios.
* **Cuantitativo Continuo** — números medibles, admiten decimales.

La decisión combina el dtype de Pandas con el contenido real de la columna y
con el nombre del encabezado, y siempre devuelve una justificación legible
para que el usuario pueda auditar (y corregir) el resultado.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.core.config import settings
from app.models.schemas import RolVariable, TipoVariable

# ---------------------------------------------------------------------------
# Diccionarios de apoyo
# ---------------------------------------------------------------------------

#: Escalas ordinales frecuentes. Se comparan en minúsculas y sin tildes.
ESCALAS_ORDINALES: tuple[tuple[str, ...], ...] = (
    ("bajo", "medio", "alto"),
    ("muy bajo", "bajo", "medio", "alto", "muy alto"),
    ("malo", "regular", "bueno", "excelente"),
    ("pesimo", "malo", "regular", "bueno", "excelente"),
    ("nunca", "casi nunca", "a veces", "casi siempre", "siempre"),
    ("totalmente en desacuerdo", "en desacuerdo", "neutral", "de acuerdo", "totalmente de acuerdo"),
    ("muy insatisfecho", "insatisfecho", "neutral", "satisfecho", "muy satisfecho"),
    ("nada", "poco", "algo", "bastante", "mucho"),
    ("primaria", "secundaria", "tecnico", "universitario", "postgrado"),
    ("inicial", "primaria", "secundaria", "superior"),
    ("xs", "s", "m", "l", "xl", "xxl"),
    ("pequeno", "mediano", "grande"),
    ("baja", "media", "alta"),
    ("leve", "moderado", "grave"),
    ("bronce", "plata", "oro", "platino", "diamante"),
    ("junior", "semi senior", "senior"),
    ("a", "b", "c", "d", "e", "f"),
    ("primero", "segundo", "tercero", "cuarto", "quinto"),
    ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"),
    (
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ),
    ("q1", "q2", "q3", "q4"),
    ("trimestre 1", "trimestre 2", "trimestre 3", "trimestre 4"),
    ("desaprobado", "aprobado", "destacado"),
    ("no", "tal vez", "si"),
)

#: Encabezados que sugieren orden aunque los valores sean numéricos.
PISTAS_ORDINALES = (
    "nivel", "grado", "rango", "ranking", "puesto", "posicion", "orden",
    "escala", "likert", "satisfaccion", "calificacion", "clasificacion",
    "prioridad", "severidad", "categoria de riesgo", "estrato", "rating",
    "puntuacion", "valoracion", "estrellas", "semestre", "trimestre",
    "etapa", "fase", "talla", "intensidad", "frecuencia de uso",
)

#: Encabezados que sugieren un identificador (nominal aunque sea numérico).
PISTAS_IDENTIFICADOR = (
    "id", "codigo", "cod", "clave", "folio", "dni", "ruc", "nit", "cui",
    "matricula", "legajo", "serie", "sku", "isbn", "expediente", "ticket",
    "numero de documento", "num documento", "identificador", "uuid", "guid",
)

#: Encabezados que sugieren un conteo (discreto).
PISTAS_CONTEO = (
    "cantidad", "cant", "numero de", "num de", "nro", "total de", "conteo",
    "unidades", "hijos", "habitaciones", "personas", "empleados", "visitas",
    "clicks", "pedidos", "items", "stock", "existencias", "asistencias",
    "faltas", "goles", "productos", "veces",
)

#: Encabezados que sugieren una magnitud continua.
PISTAS_CONTINUA = (
    "precio", "monto", "importe", "costo", "coste", "salario", "sueldo",
    "ingreso", "venta", "peso", "altura", "estatura", "talla en", "temperatura",
    "distancia", "duracion", "tiempo", "velocidad", "porcentaje", "tasa",
    "indice", "promedio", "media", "densidad", "volumen", "area", "presion",
    "humedad", "saldo", "utilidad", "margen", "imc",
)

#: Valores que representan booleanos.
VALORES_BOOLEANOS = (
    {"si", "no"}, {"sí", "no"}, {"true", "false"}, {"verdadero", "falso"},
    {"y", "n"}, {"yes", "no"}, {"1", "0"}, {"activo", "inactivo"},
    {"aprobado", "reprobado"}, {"m", "f"}, {"masculino", "femenino"},
)


def normalizar(texto: object) -> str:
    """Minúsculas, sin tildes y con espacios colapsados."""
    if texto is None:
        return ""
    crudo = str(texto).strip().lower()
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", crudo) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[\s_\-]+", " ", sin_tildes).strip()


def _contiene_pista(nombre_normalizado: str, pistas: tuple[str, ...]) -> str | None:
    """Devuelve la pista encontrada como palabra/segmento del encabezado."""
    tokens = set(nombre_normalizado.split())
    for pista in pistas:
        if " " in pista:
            if pista in nombre_normalizado:
                return pista
        elif pista in tokens:
            return pista
    return None


def detectar_escala_ordinal(valores: list[str]) -> list[str] | None:
    """Si los valores encajan en una escala ordinal conocida, la devuelve ordenada.

    Se exige que la columna use al menos 3 niveles de la escala (o los 2 de una
    escala binaria ordenada) y que **todos** sus valores pertenezcan a ella.
    """
    normalizados = {normalizar(v) for v in valores if normalizar(v)}
    if len(normalizados) < 2:
        return None

    mejor: list[str] | None = None
    for escala in ESCALAS_ORDINALES:
        conjunto = set(escala)
        if not normalizados.issubset(conjunto):
            continue
        if len(normalizados) < min(3, len(escala)):
            continue
        # Se conserva el orden de la escala, sólo con los niveles presentes.
        presentes = [nivel for nivel in escala if nivel in normalizados]
        if mejor is None or len(presentes) > len(mejor):
            mejor = presentes
    return mejor


def _es_booleana(valores: list[str]) -> bool:
    normalizados = {normalizar(v) for v in valores if normalizar(v)}
    return any(normalizados == conjunto or normalizados < conjunto for conjunto in VALORES_BOOLEANOS) and len(normalizados) <= 2


def _sin_decimales(serie: pd.Series) -> bool:
    limpia = serie.dropna()
    if limpia.empty:
        return True
    if pd.api.types.is_integer_dtype(limpia):
        return True
    valores = limpia.to_numpy(dtype="float64", na_value=np.nan)
    finitos = valores[np.isfinite(valores)]
    if finitos.size == 0:
        return True
    return bool(np.all(np.isclose(finitos, np.round(finitos), rtol=0, atol=1e-9)))


@dataclass
class Clasificacion:
    tipo: TipoVariable
    rol: RolVariable
    confianza: float
    justificacion: str
    escala_orden: list[str] | None = None


def clasificar_columna(serie: pd.Series, nombre: str) -> Clasificacion:
    """Determina el tipo estadístico de una columna."""
    nombre_norm = normalizar(nombre)
    no_nulos = serie.dropna()
    total_no_nulos = len(no_nulos)
    unicos = int(no_nulos.nunique()) if total_no_nulos else 0

    # --- Columna vacía -----------------------------------------------------
    if total_no_nulos == 0:
        return Clasificacion(
            tipo=TipoVariable.NOMINAL,
            rol=RolVariable.CATEGORIA,
            confianza=0.2,
            justificacion="La columna no tiene valores; se asume nominal por defecto.",
        )

    # --- Fechas ------------------------------------------------------------
    if pd.api.types.is_datetime64_any_dtype(serie):
        return Clasificacion(
            tipo=TipoVariable.ORDINAL,
            rol=RolVariable.TEMPORAL,
            confianza=0.95,
            justificacion=(
                "Contiene fechas: sus valores tienen un orden natural en el tiempo, "
                "por lo que se trata como cualitativo ordinal (escala de intervalo)."
            ),
        )

    # --- Booleanos ---------------------------------------------------------
    if pd.api.types.is_bool_dtype(serie):
        return Clasificacion(
            tipo=TipoVariable.NOMINAL,
            rol=RolVariable.BOOLEANO,
            confianza=0.98,
            justificacion="Variable dicotómica (verdadero/falso): nominal de dos categorías.",
        )

    muestra_texto = [str(v) for v in no_nulos.unique()[:60]]
    pista_id = _contiene_pista(nombre_norm, PISTAS_IDENTIFICADOR)
    ratio_unicos = unicos / total_no_nulos

    # --- Numéricas ---------------------------------------------------------
    if pd.api.types.is_numeric_dtype(serie):
        entera = _sin_decimales(no_nulos)

        # Un identificador numérico no es una medida: es una etiqueta.
        if pista_id and (ratio_unicos >= 0.9 or entera):
            return Clasificacion(
                tipo=TipoVariable.NOMINAL,
                rol=RolVariable.IDENTIFICADOR,
                confianza=0.88,
                justificacion=(
                    f"El encabezado sugiere un identificador ('{pista_id}') y los valores "
                    "sólo etiquetan registros; las operaciones aritméticas no tienen sentido."
                ),
            )

        pista_ordinal = _contiene_pista(nombre_norm, PISTAS_ORDINALES)
        if pista_ordinal and entera and unicos <= 12:
            niveles = sorted(pd.to_numeric(no_nulos.unique()))
            return Clasificacion(
                tipo=TipoVariable.ORDINAL,
                rol=RolVariable.CATEGORIA,
                confianza=0.82,
                justificacion=(
                    f"Escala numérica codificada ('{pista_ordinal}') con {unicos} niveles "
                    "enteros: los números representan un orden, no una cantidad medible."
                ),
                escala_orden=[str(int(n)) if float(n).is_integer() else str(n) for n in niveles],
            )

        if entera and unicos == 2 and set(np.unique(no_nulos.to_numpy(dtype="float64"))) == {0.0, 1.0}:
            return Clasificacion(
                tipo=TipoVariable.NOMINAL,
                rol=RolVariable.BOOLEANO,
                confianza=0.85,
                justificacion="Sólo toma dos valores (0/1): actúa como variable dicotómica nominal.",
            )

        pista_continua = _contiene_pista(nombre_norm, PISTAS_CONTINUA)
        if not entera:
            return Clasificacion(
                tipo=TipoVariable.CONTINUA,
                rol=RolVariable.MEDIDA,
                confianza=0.95 if pista_continua else 0.9,
                justificacion=(
                    "Valores numéricos con parte decimal: puede tomar cualquier valor dentro "
                    "de un intervalo, por lo tanto es una magnitud medible (continua)."
                ),
            )

        pista_conteo = _contiene_pista(nombre_norm, PISTAS_CONTEO)
        if pista_conteo:
            return Clasificacion(
                tipo=TipoVariable.DISCRETA,
                rol=RolVariable.CONTEO,
                confianza=0.93,
                justificacion=(
                    f"Valores enteros y encabezado de conteo ('{pista_conteo}'): "
                    "se cuenta en unidades indivisibles."
                ),
            )

        if pista_continua:
            return Clasificacion(
                tipo=TipoVariable.CONTINUA,
                rol=RolVariable.MEDIDA,
                confianza=0.72,
                justificacion=(
                    f"Aunque los valores están redondeados a enteros, el encabezado "
                    f"('{pista_continua}') describe una magnitud medible, que por naturaleza "
                    "es continua."
                ),
            )

        if unicos <= settings.discrete_max_unique:
            return Clasificacion(
                tipo=TipoVariable.DISCRETA,
                rol=RolVariable.CONTEO,
                confianza=0.85,
                justificacion=(
                    f"Valores enteros con sólo {unicos} valores distintos: variable contable "
                    "sin valores intermedios (discreta)."
                ),
            )

        if ratio_unicos >= settings.identifier_unique_ratio and total_no_nulos > 20:
            return Clasificacion(
                tipo=TipoVariable.NOMINAL,
                rol=RolVariable.IDENTIFICADOR,
                confianza=0.6,
                justificacion=(
                    f"Enteros prácticamente únicos ({unicos} de {total_no_nulos} filas): "
                    "se comportan como identificador y no como medida."
                ),
            )

        return Clasificacion(
            tipo=TipoVariable.DISCRETA,
            rol=RolVariable.CONTEO,
            confianza=0.7,
            justificacion=(
                "Todos los valores son enteros, por lo que se interpreta como una variable "
                "cuantitativa discreta."
            ),
        )

    # --- Texto -------------------------------------------------------------
    escala = detectar_escala_ordinal(muestra_texto)
    if escala:
        return Clasificacion(
            tipo=TipoVariable.ORDINAL,
            rol=RolVariable.CATEGORIA,
            confianza=0.94,
            justificacion=(
                "Sus categorías coinciden con una escala ordenada reconocida "
                f"({' < '.join(escala)}), por lo que existe una jerarquía entre ellas."
            ),
            escala_orden=escala,
        )

    if _es_booleana(muestra_texto):
        return Clasificacion(
            tipo=TipoVariable.NOMINAL,
            rol=RolVariable.BOOLEANO,
            confianza=0.9,
            justificacion="Variable dicotómica de texto (dos categorías sin jerarquía).",
        )

    if pista_id or (ratio_unicos >= settings.identifier_unique_ratio and total_no_nulos > 20):
        motivo = (
            f"el encabezado sugiere un identificador ('{pista_id}')"
            if pista_id
            else f"casi todos los valores son distintos ({unicos} de {total_no_nulos})"
        )
        return Clasificacion(
            tipo=TipoVariable.NOMINAL,
            rol=RolVariable.IDENTIFICADOR,
            confianza=0.8,
            justificacion=f"Texto que identifica registros: {motivo}.",
        )

    pista_ordinal = _contiene_pista(nombre_norm, PISTAS_ORDINALES)
    if pista_ordinal and unicos <= 12:
        return Clasificacion(
            tipo=TipoVariable.ORDINAL,
            rol=RolVariable.CATEGORIA,
            confianza=0.6,
            justificacion=(
                f"El encabezado ('{pista_ordinal}') indica una escala ordenada, aunque sus "
                "etiquetas no coinciden con ninguna escala conocida; revise el orden sugerido."
            ),
            escala_orden=sorted({str(v) for v in muestra_texto}),
        )

    longitud_media = float(no_nulos.astype(str).str.len().mean())
    if longitud_media > 40 and ratio_unicos > 0.6:
        return Clasificacion(
            tipo=TipoVariable.NOMINAL,
            rol=RolVariable.TEXTO_LIBRE,
            confianza=0.65,
            justificacion=(
                "Texto largo y mayormente único (comentarios o descripciones): "
                "se trata como nominal, sin orden entre valores."
            ),
        )

    return Clasificacion(
        tipo=TipoVariable.NOMINAL,
        rol=RolVariable.CATEGORIA,
        confianza=0.88,
        justificacion=(
            f"Categorías de texto sin jerarquía natural ({unicos} valores distintos): "
            "sólo permiten agrupar y contar."
        ),
    )


def clasificar_dataframe(df: pd.DataFrame) -> dict[str, Clasificacion]:
    """Clasifica todas las columnas de un ``DataFrame``."""
    return {str(columna): clasificar_columna(df[columna], str(columna)) for columna in df.columns}
