# Despliegue

La aplicación son **dos servicios**:

| Servicio | Tecnología | Dónde va |
|---|---|---|
| Interfaz | Next.js | Netlify ✅ *(ya desplegado)* |
| Motor de datos | Python · FastAPI · Pandas | **Fuera de Netlify** |

---

## Por qué el motor de datos no puede ir en Netlify

Netlify Functions admite **JavaScript, TypeScript y Go**. Python no es un
runtime nativo, así que no hay forma de ejecutar allí FastAPI ni Pandas.

Esto no depende de tener o no una base de datos: **la aplicación no usa base de
datos**. Analiza el archivo que se sube y devuelve los resultados; los datasets
viven en memoria una hora y se descartan. Añadir Netlify DB no haría que el
motor arrancara, porque lo que falta es un intérprete de Python.

> Si prefiere tener absolutamente todo en Netlify, la única vía es reescribir el
> motor en TypeScript como Netlify Functions. Implicaría reimplementar la
> ingesta de Excel, la clasificación de variables, la estadística descriptiva,
> las tablas de frecuencia, los filtros y la validación, y perder Pandas junto
> con las 104 pruebas de `pytest`. Es una decisión de arquitectura, no un ajuste
> de configuración.

---

## 1. Motor de datos

El repositorio incluye `backend/Dockerfile`, así que sirve cualquier proveedor
que ejecute contenedores. Todos los citados tienen plan gratuito.

### Opción rápida: Render (blueprint incluido)

`render.yaml` describe el servicio ya configurado:

1. En Render: **New → Blueprint** y seleccione este repositorio.
2. Render lee `render.yaml` y crea el servicio. No hay que rellenar nada.
3. Al terminar, copie la URL del servicio (`https://ALGO.onrender.com`).

Compruebe que responde:

```bash
curl https://ALGO.onrender.com/api/salud
# {"estado":"ok","servicio":"Motor de Datos Inteligente",...}
```

### Otras opciones

Con el mismo `Dockerfile`:

| Proveedor | Cómo |
|---|---|
| Railway | New Project → Deploy from repo → raíz `backend` |
| Fly.io | `fly launch --dockerfile backend/Dockerfile` |
| Cloud Run | `gcloud run deploy --source backend` |

Sin contenedor, en cualquier VPS:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Variable obligatoria en el motor

```
CORS_ORIGINS=https://excelviewanddownloadtopdf.netlify.app
```

Debe ser el dominio exacto del sitio. Si usa uno propio, añádalo separado por
comas. En el blueprint de Render ya viene puesto.

---

## 2. Conectar la interfaz con el motor

En Netlify → **Site configuration → Environment variables**:

```
BACKEND_URL = https://ALGO.onrender.com
```

Sin barra final. Después **vuelva a desplegar el sitio**: la variable se lee al
compilar, así que un cambio no surte efecto hasta el siguiente build.

### Por qué hace falta

`next.config.mjs` reescribe `/api/*` hacia `BACKEND_URL`, de modo que el
navegador siempre llama al mismo origen y no hay CORS entre interfaz y motor. Si
la variable no está definida, la reescritura apunta a `http://127.0.0.1:8000`,
que en Netlify no existe, y todas las llamadas fallan.

---

## Comprobación final

Con las dos piezas en marcha, verifique en este orden:

1. `https://excelviewanddownloadtopdf.netlify.app/api/salud` devuelve
   `{"estado":"ok",...}`. Si falla, el problema está en `BACKEND_URL` o en el
   motor.
2. La sección **Descargas** lista 5 archivos Excel y 5 CSV.
3. Descargue una muestra y súbala: deben aparecer las fichas de clasificación.
4. Aplique un filtro y confirme que métricas y gráficos cambian.

---

## Sobre Netlify DB

Netlify DB (Postgres gestionado por Neon) existe y se provisiona con
`netlify db init` o desde el panel, pero **hoy la aplicación no la necesita ni
la usaría**: no hay ninguna consulta SQL en el código.

Tendría sentido si quisiera añadir funcionalidad que ahora no existe:

- Historial de archivos analizados, para recuperar un análisis anterior.
- Enlaces permanentes para compartir un análisis.
- Cuentas de usuario.

Eso son funciones nuevas, con su modelo de datos y su interfaz. Si le interesan,
conviene abordarlas como un trabajo aparte una vez que el motor esté en marcha.

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| «No se pudo contactar con el motor de datos» | `BACKEND_URL` sin definir, mal escrita, con barra final, o el sitio no se redesplegó tras añadirla |
| Error de CORS en la consola | `CORS_ORIGINS` del motor no incluye el dominio de Netlify |
| `/api/salud` da 502 | El motor está caído o dormido (los planes gratuitos suspenden el servicio por inactividad; la primera petición tarda unos segundos) |
| El build de Netlify no encuentra `package.json` | Se sobreescribió el directorio base; debe ser `frontend` |
| Los datos «se pierden» tras un rato | Comportamiento esperado: los datasets viven en memoria una hora (`DATASET_TTL_SECONDS`) |
