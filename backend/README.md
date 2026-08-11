# Motor de Datos Inteligente

Servicio FastAPI que analiza archivos Excel y CSV con Pandas.

## Ejecución

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Documentación interactiva: <http://localhost:8000/docs>
- Estado del servicio: <http://localhost:8000/api/salud>

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/salud` | Estado y límites configurados |
| `POST` | `/api/datasets` | Sube un archivo y devuelve el informe inicial |
| `POST` | `/api/datasets/{id}/analisis` | Recalcula el informe aplicando filtros |
| `POST` | `/api/datasets/{id}/frecuencias?columna=` | Tablas de frecuencia de una columna |
| `POST` | `/api/datasets/{id}/validacion` | Validación por scraping simulado |
| `POST` | `/api/datasets/{id}/exportar?formato=` | Descarga `xlsx`, `csv` o `informe` |
| `DELETE` | `/api/datasets/{id}` | Libera el dataset de memoria |
| `GET` | `/api/muestras` | Catálogo de muestras (5 Excel + 5 CSV) |
| `GET` | `/api/muestras/{id}/{formato}` | Descarga una muestra |

Los datasets viven en memoria con un TTL de una hora (`store.py`). No se
escribe nada en disco: el archivo subido se procesa y se descarta.

## Configuración

Todos los límites se ajustan por variable de entorno (`core/config.py`):

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `MAX_UPLOAD_BYTES` | `26214400` (25 MB) | Tamaño máximo del archivo. Depende de la RAM del alojamiento: `render.yaml` lo baja a 10 MB porque el plan gratuito da 512 MB y Pandas expande el Excel en memoria |
| `MAX_ROWS` | `200000` | Filas analizadas como máximo |
| `MAX_COLUMNS` | `200` | Columnas analizadas como máximo |
| `PREVIEW_ROWS` | `5000` | Filas enviadas al navegador |
| `DATASET_TTL_SECONDS` | `3600` | Vida de un dataset en memoria |
| `MAX_DATASETS` | `24` | Datasets simultáneos en caché |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Orígenes permitidos, separados por comas |

## Pruebas

```bash
python -m pytest          # 104 pruebas
python -m pytest -v       # detalle por caso
```

Cubren la ingesta (formatos, delimitadores, codificaciones, números locales),
la clasificación de los cuatro tipos de variable, la estadística descriptiva,
los filtros, la generación de muestras, la validación de consistencia y la API
completa de extremo a extremo.
