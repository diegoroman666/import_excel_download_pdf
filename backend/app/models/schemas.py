"""Contratos de datos (Pydantic) compartidos con el frontend.

Los nombres de campo están en español para que el JSON sea legible desde la UI
sin capa de traducción.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Clasificación de variables
# ---------------------------------------------------------------------------
class TipoVariable(str, Enum):
    """Los cuatro tipos estadísticos exigidos por el módulo core."""

    NOMINAL = "Cualitativo Nominal"
    ORDINAL = "Cualitativo Ordinal"
    DISCRETA = "Cuantitativo Discreto"
    CONTINUA = "Cuantitativo Continuo"


class RolVariable(str, Enum):
    """Rol semántico complementario al tipo estadístico."""

    IDENTIFICADOR = "identificador"
    TEMPORAL = "temporal"
    BOOLEANO = "booleano"
    CATEGORIA = "categoria"
    MEDIDA = "medida"
    CONTEO = "conteo"
    TEXTO_LIBRE = "texto_libre"


class ResumenNumerico(BaseModel):
    conteo: int
    media: float | None = None
    mediana: float | None = None
    moda: list[float] = Field(default_factory=list)
    desviacion_estandar: float | None = None
    varianza: float | None = None
    minimo: float | None = None
    maximo: float | None = None
    rango: float | None = None
    q1: float | None = None
    q2: float | None = None
    q3: float | None = None
    iqr: float | None = None
    coeficiente_variacion: float | None = None
    asimetria: float | None = None
    curtosis: float | None = None
    percentiles: dict[str, float] = Field(default_factory=dict)
    deciles: dict[str, float] = Field(default_factory=dict)
    atipicos: int = 0
    suma: float | None = None


class CategoriaFrecuencia(BaseModel):
    valor: str
    frecuencia_absoluta: int
    frecuencia_relativa: float
    frecuencia_acumulada: int
    frecuencia_relativa_acumulada: float


class IntervaloFrecuencia(BaseModel):
    intervalo: str
    limite_inferior: float
    limite_superior: float
    marca_clase: float
    frecuencia_absoluta: int
    frecuencia_relativa: float
    frecuencia_acumulada: int
    frecuencia_relativa_acumulada: float


class ColumnaAnalizada(BaseModel):
    """Ficha completa de una columna del dataset."""

    nombre: str
    clave: str
    tipo: TipoVariable
    rol: RolVariable
    dtype_pandas: str
    confianza: float = Field(ge=0.0, le=1.0)
    justificacion: str
    escala_orden: list[str] | None = None
    total: int
    nulos: int
    porcentaje_nulos: float
    unicos: int
    muestra: list[Any] = Field(default_factory=list)
    resumen_numerico: ResumenNumerico | None = None
    top_categorias: list[CategoriaFrecuencia] = Field(default_factory=list)
    es_numerica: bool = False
    es_graficable_x: bool = True
    es_graficable_y: bool = False


# ---------------------------------------------------------------------------
# Filtros estilo Power BI
# ---------------------------------------------------------------------------
class TipoFiltro(str, Enum):
    CATEGORICO = "categorico"
    RANGO = "rango"
    TEXTO = "texto"
    FECHA = "fecha"
    NULOS = "nulos"


class Filtro(BaseModel):
    columna: str
    tipo: TipoFiltro
    # categorico
    valores: list[str] | None = None
    excluir: bool = False
    # rango / fecha
    minimo: float | None = None
    maximo: float | None = None
    desde: str | None = None
    hasta: str | None = None
    # texto
    contiene: str | None = None
    sensible_mayusculas: bool = False
    # Los nulos no atraviesan un filtro activo salvo que se pidan de forma
    # explícita (equivale a marcar "(Vacío)" en el panel de filtros).
    incluir_nulos: bool = False


class OpcionesFiltroColumna(BaseModel):
    """Metadatos que la UI necesita para pintar cada control de filtro."""

    columna: str
    tipo_control: TipoFiltro
    valores: list[str] = Field(default_factory=list)
    valores_truncados: bool = False
    minimo: float | None = None
    maximo: float | None = None
    paso: float | None = None
    tiene_nulos: bool = False


# ---------------------------------------------------------------------------
# Respuestas de la API
# ---------------------------------------------------------------------------
class MetadatosDataset(BaseModel):
    dataset_id: str
    nombre_archivo: str
    hoja: str | None = None
    filas: int
    columnas: int
    filas_enviadas: int
    truncado: bool
    tamano_bytes: int
    creado_en: str
    expira_en: str
    celdas_vacias: int
    filas_duplicadas: int


class ResumenGlobal(BaseModel):
    filas: int
    columnas: int
    numericas: int
    categoricas: int
    nominales: int
    ordinales: int
    discretas: int
    continuas: int
    celdas_totales: int
    celdas_nulas: int
    completitud: float
    filas_duplicadas: int
    memoria_kb: float


class MatrizCorrelacion(BaseModel):
    columnas: list[str]
    valores: list[list[float | None]]


class InformeAnalisis(BaseModel):
    """Payload principal: todo lo que el dashboard necesita para pintarse."""

    dataset_id: str
    resumen: ResumenGlobal
    columnas: list[ColumnaAnalizada]
    correlacion: MatrizCorrelacion
    filtros_disponibles: list[OpcionesFiltroColumna]
    filas_filtradas: int
    filas_totales: int
    filtros_aplicados: int


class RespuestaCarga(BaseModel):
    metadatos: MetadatosDataset
    informe: InformeAnalisis
    columnas_orden: list[str]
    filas: list[dict[str, Any]]
    avisos: list[str] = Field(default_factory=list)


class SolicitudAnalisis(BaseModel):
    filtros: list[Filtro] = Field(default_factory=list)
    incluir_filas: bool = False
    limite_filas: int = 1000


class RespuestaAnalisis(BaseModel):
    informe: InformeAnalisis
    filas: list[dict[str, Any]] | None = None


class TablasFrecuencia(BaseModel):
    columna: str
    tipo: TipoVariable
    no_agrupada: list[CategoriaFrecuencia]
    agrupada: list[IntervaloFrecuencia] | None = None
    clases_sturges: int | None = None
    amplitud_clase: float | None = None


# ---------------------------------------------------------------------------
# Muestras descargables
# ---------------------------------------------------------------------------
class ArchivoMuestra(BaseModel):
    id: str
    nombre: str
    descripcion: str
    formato: Literal["xlsx", "csv"]
    filas: int
    columnas: int
    tipos_incluidos: list[TipoVariable]
    url: str


class CatalogoMuestras(BaseModel):
    excel: list[ArchivoMuestra]
    csv: list[ArchivoMuestra]


# ---------------------------------------------------------------------------
# Historial persistido
# ---------------------------------------------------------------------------
class EntradaHistorial(BaseModel):
    """Un análisis guardado, tal como se lista en la interfaz."""

    id: str
    nombre_archivo: str
    hoja: str | None = None
    filas: int
    columnas: int
    tamano_bytes: int
    creado_en: str
    resumen_tipos: dict[str, int] = Field(default_factory=dict)


class ListaHistorial(BaseModel):
    disponible: bool
    entradas: list[EntradaHistorial] = Field(default_factory=list)
    motivo: str | None = None


# ---------------------------------------------------------------------------
# Validación por scraping simulado
# ---------------------------------------------------------------------------
class SeveridadHallazgo(str, Enum):
    CRITICO = "critico"
    ADVERTENCIA = "advertencia"
    INFO = "info"


class HallazgoValidacion(BaseModel):
    codigo: str
    severidad: SeveridadHallazgo
    columna: str | None = None
    mensaje: str
    filas_afectadas: int = 0
    ejemplos: list[str] = Field(default_factory=list)
    sugerencia: str | None = None


class FuenteConsultada(BaseModel):
    nombre: str
    url: str
    registros: int
    latencia_ms: int
    estado: str


class InformeValidacion(BaseModel):
    dataset_id: str
    ejecutado_en: str
    duracion_ms: int
    fuentes: list[FuenteConsultada]
    hallazgos: list[HallazgoValidacion]
    puntuacion_consistencia: float
    filas_analizadas: int
    simulado: bool = True
