# Procesador Inteligente de Datos

Aplicación web para analizar archivos Excel y CSV: clasifica automáticamente el
tipo estadístico de cada variable, calcula estadística descriptiva completa y
presenta un dashboard reactivo con filtros y doce visualizaciones.

El frontend está construido con **Next.js** y **Tailwind CSS**; el motor de
análisis es un servicio **Python / FastAPI** que trabaja sobre **Pandas**.

---

## Arquitectura

```
.
├── backend/                     Motor de datos (FastAPI + Pandas)
│   ├── app/
│   │   ├── main.py              Creación de la app, CORS y manejo de errores
│   │   ├── core/
│   │   │   ├── config.py        Límites y ajustes por variable de entorno
│   │   │   ├── dtypes.py        Compatibilidad de dtypes entre Pandas 2 y 3
│   │   │   └── errors.py        Errores de dominio → respuestas HTTP
│   │   ├── models/schemas.py    Contratos Pydantic compartidos con la UI
│   │   ├── db/base.py           Conexión y tablas (persistencia opcional)
│   │   ├── services/
│   │   │   ├── ingestion.py     Lectura, limpieza e inferencia de tipos
│   │   │   ├── classification.py Clasificación de variables (los 4 tipos)
│   │   │   ├── statistics.py    Descriptivos, frecuencias y correlaciones
│   │   │   ├── filtering.py     Filtros combinables estilo Power BI
│   │   │   ├── samples.py       Generación de los 10 archivos de muestra
│   │   │   ├── scraping.py      Validación por scraping simulado
│   │   │   ├── export.py        Exportación a Excel y CSV
│   │   │   ├── history.py       Historial persistido (opcional)
│   │   │   └── store.py         Caché en memoria de datasets con TTL
│   │   └── api/routes/          Endpoints HTTP
│   ├── tests/                   122 pruebas (pytest)
│   └── requirements.txt
│
└── frontend/                    Interfaz (Next.js App Router + Tailwind v4)
    ├── app/
    │   ├── layout.jsx           Envoltorio, metadatos y fondo animado
    │   ├── page.jsx             Orquestación de todas las secciones
    │   └── globals.css          Sistema de diseño y efectos 3D
    ├── components/
    │   ├── background/          Fondo animado en canvas
    │   ├── scroll3d/            Profundidad al desplazarse e inclinación 3D
    │   ├── layout/              Portada, navegación y secciones
    │   ├── upload/              Adjuntador inteligente
    │   ├── classification/      Ficha de tipos de variable
    │   ├── filters/             Panel de segmentación por columnas
    │   ├── dashboard/           KPIs, selector de gráficos y lienzo
    │   ├── charts/              Envoltorio de Plotly + 12 gráficos
    │   ├── stats/               Tendencia, posición, dispersión y frecuencias
    │   ├── table/               Vista tabular paginada
    │   ├── downloads/           Muestras y exportaciones
    │   ├── history/             Historial de análisis guardados
    │   ├── quality/             Informe de validación de consistencia
    │   └── ui/                  Primitivas (botón, tarjeta, aviso, iconos…)
    ├── lib/                     Cliente de API, filtros, agregaciones, formato
    └── tests/
        ├── unit/                81 pruebas (node:test)
        └── e2e/                 24 comprobaciones de usabilidad (Playwright)
```

---

## Puesta en marcha

Requisitos: **Node.js 20+** y **Python 3.11+**.

### 1. Motor de datos

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Documentación interactiva de la API en <http://localhost:8000/docs>.

### 2. Interfaz

```bash
cd frontend
npm install
npm run dev
```

Aplicación en <http://localhost:3000>.

Next.js redirige `/api/*` al backend, así que no hay CORS ni URLs absolutas en
el código. Para apuntar a otro host, defina `BACKEND_URL` (véase `.env.example`).

---

### Despliegue

Son dos servicios: `netlify.toml` deja la interfaz lista para Netlify, y
`backend/Dockerfile` (con blueprint `render.yaml` incluido) despliega el motor
de datos en cualquier proveedor de contenedores. Netlify Functions sólo admite
JavaScript, TypeScript y Go, así que el motor Python va necesariamente aparte.
Procedimiento completo en [`docs/despliegue.md`](docs/despliegue.md).

---

## Funcionalidad

### Adjuntador inteligente

Admite `.xlsx`, `.xls`, `.xlsm`, `.csv`, `.tsv` y `.txt`. Al recibir el archivo,
Pandas normaliza los encabezados, descarta filas y columnas vacías, detecta el
delimitador e infiere números en formato local (`1.234,56` y `1,234.56`) y
fechas. Todo lo que se corrige se informa como aviso en la interfaz.

### Clasificación de variables

Cada columna se clasifica en uno de los cuatro tipos exigidos:

| Tipo | Descripción | Ejemplo |
|---|---|---|
| **Cualitativo Nominal** | Categorías sin orden natural | Ciudad, color |
| **Cualitativo Ordinal** | Categorías con jerarquía | Bajo < Medio < Alto |
| **Cuantitativo Discreto** | Números contables | Nº de hijos |
| **Cuantitativo Continuo** | Magnitudes medibles | Precio, temperatura |

La decisión combina el dtype de Pandas, el contenido de la columna y el nombre
del encabezado. Cada resultado incluye un grado de confianza y una
justificación en lenguaje natural, consultable desde la propia ficha.

Además del tipo estadístico se detecta el **rol** de la columna —identificador,
fecha, dicotómica, medida, conteo o texto libre—, lo que evita errores clásicos
como tratar un código numérico de pedido como si fuera una cantidad.

### Dashboard reactivo

- **Filtros por columna**: listas de categorías con búsqueda e inversión,
  rangos numéricos, rangos de fechas y búsqueda de texto. Se combinan con AND.
- **Reactividad inmediata**: los gráficos y las métricas se recalculan en el
  navegador en el mismo fotograma, mientras Pandas recalcula el informe
  completo en segundo plano y sustituye el resultado local al llegar.
- **Doce gráficos**: barras, circular, histograma, líneas, dispersión, área,
  radar, barras apiladas, mixto, cajas, mapa de calor y regresión.

### Estadística descriptiva

Tendencia central (media, mediana, moda), posición (cuartiles, deciles,
percentiles), dispersión (rango, varianza, desviación típica, coeficiente de
variación, IQR, asimetría, curtosis, atípicos) y tablas de frecuencia
agrupadas —por la regla de Sturges— y sin agrupar.

### Control de calidad

Un proceso de **scraping simulado** contrasta el dataset con catálogos de
referencia embebidos (regiones, categorías de producto, canales, niveles
educativos) y con rangos admisibles por magnitud. Detecta valores fuera de
catálogo —con sugerencia de corrección por distancia de edición—, rangos
imposibles, identificadores duplicados, exceso de vacíos y variantes de
escritura de una misma categoría. **No realiza peticiones de red**: es
determinista y funciona sin conexión.

### Historial (opcional)

Con una base de datos PostgreSQL configurada en `DATABASE_URL`, los archivos
analizados quedan guardados para reabrirlos o borrarlos. Se conserva el archivo
original comprimido y se reprocesa al abrirlo, de modo que el resultado siempre
corresponde a la versión actual del motor. Cada navegador ve sólo su propio
historial mediante un identificador anónimo. Sin base de datos la aplicación
funciona igual, sin esa sección.

### Descargas

- **5 datasets de muestra en Excel** y **los mismos 5 en CSV**, generados con
  Pandas. Cada uno contiene los cuatro tipos de variable.
- Exportación de los datos filtrados a Excel, CSV y PDF.
- Informe completo en Excel con hojas de datos, clasificación, estadística y
  frecuencias.

### Interfaz

Fondo animado en `<canvas>` con manchas de color a la deriva y una malla de
partículas que reacciona al desplazamiento, más efectos 3D al hacer scroll: las
secciones entran con profundidad y las tarjetas se inclinan siguiendo al
puntero. Todo respeta `prefers-reduced-motion` y la animación se detiene cuando
la pestaña deja de estar visible.

---

## Pruebas

```bash
# Motor de datos — 122 pruebas
cd backend && python -m pytest

# Lógica de la interfaz — 81 pruebas
cd frontend && npm test

# Usabilidad de extremo a extremo — 24 comprobaciones
# (requiere el backend y el frontend en marcha)
cd frontend && node tests/e2e/usabilidad.mjs
```

La prueba de usabilidad conduce Chromium sobre la aplicación real: sube un
archivo, recorre los doce gráficos, aplica filtros, ejecuta la validación,
descarga archivos y comprueba que no haya errores de consola, controles sin
nombre accesible ni desbordamiento horizontal en móvil.

---

## Notas sobre el rediseño

Esta versión sustituye a la aplicación anterior (Vite + React con los cálculos
en el navegador). Se conservan los doce gráficos y las cuatro vistas
estadísticas originales; el análisis pasó a Pandas y se corrigieron varios
defectos heredados, documentados en
[`docs/correcciones.md`](docs/correcciones.md).
