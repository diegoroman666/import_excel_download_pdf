"""Errores de dominio traducidos a respuestas HTTP coherentes."""

from __future__ import annotations

from fastapi import HTTPException, status


class DataEngineError(Exception):
    """Error de negocio del motor de datos."""

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail

    def as_http(self) -> HTTPException:
        return HTTPException(
            status_code=self.status_code,
            detail={"error": self.message, "detalle": self.detail},
        )


class UnsupportedFileError(DataEngineError):
    """Extensión o contenido de archivo no soportado."""

    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


class FileTooLargeError(DataEngineError):
    status_code = 413  # Content Too Large


class EmptyDatasetError(DataEngineError):
    """El archivo se leyó pero no contiene filas o columnas utilizables."""


class DatasetNotFoundError(DataEngineError):
    status_code = status.HTTP_404_NOT_FOUND


class InvalidFilterError(DataEngineError):
    status_code = 422  # Unprocessable Content
