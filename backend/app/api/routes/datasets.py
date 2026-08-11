"""Endpoints del adjuntador inteligente: carga, análisis reactivo y exportación."""

from __future__ import annotations

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, File, Form, Header, Query, UploadFile
from fastapi.responses import Response

from app.core.config import settings
from app.core.descargas import cabecera_descarga
from app.core.errors import DataEngineError, EmptyDatasetError, FileTooLargeError
from app.models.schemas import (
    InformeAnalisis,
    InformeValidacion,
    MetadatosDataset,
    RespuestaAnalisis,
    RespuestaCarga,
    SolicitudAnalisis,
    TablasFrecuencia,
)
from app.services import export, history, ingestion, scraping
from app.services.classification import clasificar_dataframe
from app.services.filtering import aplicar_filtros
from app.services.statistics import (
    analizar_dataframe,
    construir_tablas_frecuencia,
    filas_serializables,
)
from app.services.store import DatasetGuardado, almacen

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _construir_informe(
    registro: DatasetGuardado,
    df_filtrado: pd.DataFrame,
    filtros_aplicados: int,
) -> InformeAnalisis:
    columnas, correlacion, filtros, resumen = analizar_dataframe(
        df_filtrado, registro.clasificaciones
    )
    return InformeAnalisis(
        dataset_id=registro.dataset_id,
        resumen=resumen,
        columnas=columnas,
        correlacion=correlacion,
        filtros_disponibles=filtros,
        filas_filtradas=int(len(df_filtrado)),
        filas_totales=int(len(registro.df)),
        filtros_aplicados=filtros_aplicados,
    )


def procesar_contenido(
    *,
    contenido: bytes,
    nombre_archivo: str,
    hoja: str | None,
    cliente: str | None,
) -> RespuestaCarga:
    """Analiza unos bytes y devuelve el informe completo.

    Lo comparten la subida de un archivo nuevo y la reapertura de una entrada
    del historial, de modo que un análisis recuperado pasa exactamente por el
    mismo camino que uno recién subido.

    Con `cliente` se guarda además una copia en el historial; al reabrir se pasa
    ``None`` para no duplicar la entrada existente.
    """
    resultado = ingestion.leer_dataset(contenido, nombre_archivo, hoja)

    clasificaciones = clasificar_dataframe(resultado.df)
    registro = almacen.guardar(
        resultado.df,
        clasificaciones,
        nombre_archivo=nombre_archivo,
        hoja=resultado.hoja,
        tamano_bytes=len(contenido),
        filas_originales=resultado.filas_originales,
        avisos=resultado.avisos,
    )

    informe = _construir_informe(registro, resultado.df, 0)

    if cliente:
        resumen_tipos: dict[str, int] = {}
        for columna in informe.columnas:
            clave = columna.tipo.value
            resumen_tipos[clave] = resumen_tipos.get(clave, 0) + 1

        history.guardar(
            cliente=cliente,
            nombre_archivo=nombre_archivo,
            hoja=resultado.hoja,
            contenido=contenido,
            filas=int(len(resultado.df)),
            columnas=int(resultado.df.shape[1]),
            resumen_tipos=resumen_tipos,
        )

    truncado = len(resultado.df) > settings.preview_rows
    avisos = list(resultado.avisos)
    if truncado:
        avisos.append(
            f"Se enviaron {settings.preview_rows} filas al navegador para el modo reactivo; "
            "las métricas usan el total del archivo."
        )

    return RespuestaCarga(
        metadatos=MetadatosDataset(
            dataset_id=registro.dataset_id,
            nombre_archivo=registro.nombre_archivo,
            hoja=registro.hoja,
            filas=int(len(resultado.df)),
            columnas=int(resultado.df.shape[1]),
            filas_enviadas=min(len(resultado.df), settings.preview_rows),
            truncado=truncado,
            tamano_bytes=len(contenido),
            creado_en=registro.creado_en.isoformat(),
            expira_en=registro.expira_en.isoformat(),
            celdas_vacias=int(resultado.df.isna().sum().sum()),
            filas_duplicadas=int(resultado.df.duplicated().sum()),
        ),
        informe=informe,
        columnas_orden=[str(c) for c in resultado.df.columns],
        filas=filas_serializables(resultado.df, settings.preview_rows),
        avisos=avisos,
    )


@router.post("", response_model=RespuestaCarga, summary="Subir y analizar un archivo")
async def subir_dataset(
    archivo: Annotated[UploadFile, File(description="Archivo .xlsx, .xls o .csv")],
    hoja: Annotated[str | None, Form()] = None,
    x_cliente: Annotated[str | None, Header()] = None,
) -> RespuestaCarga:
    contenido = await archivo.read()

    if len(contenido) > settings.max_upload_bytes:
        limite_mb = settings.max_upload_bytes / (1024 * 1024)
        raise FileTooLargeError(
            f"El archivo supera el límite de {limite_mb:.0f} MB.",
            detail="Reduzca el número de filas o divida el archivo.",
        ).as_http()
    if not contenido:
        raise EmptyDatasetError("El archivo está vacío.").as_http()

    try:
        return procesar_contenido(
            contenido=contenido,
            nombre_archivo=archivo.filename or "datos.xlsx",
            hoja=hoja,
            cliente=(x_cliente or "").strip() or None,
        )
    except DataEngineError as error:
        raise error.as_http() from error


@router.post(
    "/{dataset_id}/analisis",
    response_model=RespuestaAnalisis,
    summary="Recalcular el informe aplicando filtros",
)
def analizar(dataset_id: str, solicitud: SolicitudAnalisis) -> RespuestaAnalisis:
    try:
        registro = almacen.obtener(dataset_id)
        df_filtrado, activos = aplicar_filtros(registro.df, solicitud.filtros)
    except DataEngineError as error:
        raise error.as_http() from error

    informe = _construir_informe(registro, df_filtrado, activos)
    filas = (
        filas_serializables(df_filtrado, max(1, min(solicitud.limite_filas, settings.preview_rows)))
        if solicitud.incluir_filas
        else None
    )
    return RespuestaAnalisis(informe=informe, filas=filas)


@router.post(
    "/{dataset_id}/frecuencias",
    response_model=TablasFrecuencia,
    summary="Tablas de frecuencia (agrupada y no agrupada) de una columna",
)
def frecuencias(
    dataset_id: str,
    columna: Annotated[str, Query(description="Nombre de la columna")],
    solicitud: SolicitudAnalisis | None = None,
) -> TablasFrecuencia:
    try:
        registro = almacen.obtener(dataset_id)
        filtros = solicitud.filtros if solicitud else []
        df_filtrado, _ = aplicar_filtros(registro.df, filtros)
        if columna not in df_filtrado.columns:
            raise EmptyDatasetError(f"La columna '{columna}' no existe en el dataset.")
    except DataEngineError as error:
        raise error.as_http() from error

    clasificacion = registro.clasificaciones[columna]
    return construir_tablas_frecuencia(
        df_filtrado[columna], clasificacion.tipo, columna, clasificacion.escala_orden
    )


@router.post(
    "/{dataset_id}/validacion",
    response_model=InformeValidacion,
    summary="Validación de consistencia por scraping simulado",
)
def validar(dataset_id: str, solicitud: SolicitudAnalisis | None = None) -> InformeValidacion:
    try:
        registro = almacen.obtener(dataset_id)
        filtros = solicitud.filtros if solicitud else []
        df_filtrado, _ = aplicar_filtros(registro.df, filtros)
    except DataEngineError as error:
        raise error.as_http() from error

    return scraping.validar_consistencia(df_filtrado, dataset_id)


@router.post("/{dataset_id}/exportar", summary="Descargar los datos filtrados")
def exportar(
    dataset_id: str,
    formato: Annotated[str, Query(pattern="^(xlsx|csv|informe)$")] = "xlsx",
    solicitud: SolicitudAnalisis | None = None,
) -> Response:
    try:
        registro = almacen.obtener(dataset_id)
        filtros = solicitud.filtros if solicitud else []
        df_filtrado, _ = aplicar_filtros(registro.df, filtros)
    except DataEngineError as error:
        raise error.as_http() from error

    base = (registro.nombre_archivo.rsplit(".", 1)[0] or "datos").strip() or "datos"

    if formato == "csv":
        contenido = export.datos_a_csv(df_filtrado)
        medio, nombre = "text/csv; charset=utf-8", f"{base}_filtrado.csv"
    elif formato == "informe":
        columnas, _, _, _ = analizar_dataframe(df_filtrado, registro.clasificaciones)
        contenido = export.informe_a_excel(df_filtrado, columnas)
        medio, nombre = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{base}_informe.xlsx",
        )
    else:
        contenido = export.datos_a_excel(df_filtrado)
        medio, nombre = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{base}_filtrado.xlsx",
        )

    return Response(
        content=contenido,
        media_type=medio,
        headers=cabecera_descarga(nombre),
    )


@router.delete("/{dataset_id}", summary="Liberar el dataset de memoria")
def eliminar(dataset_id: str) -> dict[str, bool]:
    return {"eliminado": almacen.eliminar(dataset_id)}
