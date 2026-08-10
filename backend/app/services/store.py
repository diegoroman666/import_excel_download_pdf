"""Almacén en memoria de los datasets cargados.

Evita reprocesar el archivo en cada interacción del dashboard. Es un caché con
TTL y tope de entradas: al superarlos se descarta el dataset más antiguo
(política LRU por último acceso).
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import pandas as pd

from app.core.config import settings
from app.core.errors import DatasetNotFoundError
from app.services.classification import Clasificacion


@dataclass
class DatasetGuardado:
    dataset_id: str
    df: pd.DataFrame
    clasificaciones: dict[str, Clasificacion]
    nombre_archivo: str
    hoja: str | None
    tamano_bytes: int
    filas_originales: int
    avisos: list[str] = field(default_factory=list)
    creado_en: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ultimo_acceso: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def expira_en(self) -> datetime:
        return self.ultimo_acceso + timedelta(seconds=settings.dataset_ttl_seconds)


class AlmacenDatasets:
    """Caché seguro para uso concurrente desde varios workers de FastAPI."""

    def __init__(self) -> None:
        self._datos: dict[str, DatasetGuardado] = {}
        self._lock = threading.Lock()

    def _purgar(self) -> None:
        """Elimina entradas vencidas y respeta el tope de datasets."""
        ahora = datetime.now(timezone.utc)
        vencidos = [k for k, v in self._datos.items() if v.expira_en < ahora]
        for clave in vencidos:
            self._datos.pop(clave, None)

        while len(self._datos) > settings.max_datasets:
            mas_antiguo = min(self._datos.items(), key=lambda item: item[1].ultimo_acceso)[0]
            self._datos.pop(mas_antiguo, None)

    def guardar(
        self,
        df: pd.DataFrame,
        clasificaciones: dict[str, Clasificacion],
        *,
        nombre_archivo: str,
        hoja: str | None,
        tamano_bytes: int,
        filas_originales: int,
        avisos: list[str],
    ) -> DatasetGuardado:
        registro = DatasetGuardado(
            dataset_id=uuid.uuid4().hex[:16],
            df=df,
            clasificaciones=clasificaciones,
            nombre_archivo=nombre_archivo,
            hoja=hoja,
            tamano_bytes=tamano_bytes,
            filas_originales=filas_originales,
            avisos=avisos,
        )
        with self._lock:
            self._datos[registro.dataset_id] = registro
            self._purgar()
        return registro

    def obtener(self, dataset_id: str) -> DatasetGuardado:
        with self._lock:
            self._purgar()
            registro = self._datos.get(dataset_id)
            if registro is None:
                raise DatasetNotFoundError(
                    "El dataset ya no está disponible.",
                    detail="La sesión expiró o el servidor se reinició; vuelva a subir el archivo.",
                )
            registro.ultimo_acceso = datetime.now(timezone.utc)
            return registro

    def eliminar(self, dataset_id: str) -> bool:
        with self._lock:
            return self._datos.pop(dataset_id, None) is not None

    def limpiar(self) -> None:
        with self._lock:
            self._datos.clear()

    def __len__(self) -> int:  # pragma: no cover - utilidad de diagnóstico
        with self._lock:
            return len(self._datos)


almacen = AlmacenDatasets()
