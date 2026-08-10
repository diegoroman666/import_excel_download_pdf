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

Tener una base de datos no cambia nada al respecto: la base de datos sólo añade
el historial (véase más abajo), pero el análisis lo hace Pandas y Pandas
necesita Python. Provisionar una base de datos en Netlify no haría arrancar el
motor allí.

> Si prefiere tener absolutamente todo en Netlify, la única vía es reescribir el
> motor en TypeScript como Netlify Functions. Implicaría reimplementar la
> ingesta de Excel, la clasificación de variables, la estadística descriptiva,
> las tablas de frecuencia, los filtros y la validación, y perder Pandas junto
> con las 122 pruebas de `pytest`. Es una decisión de arquitectura, no un ajuste
> de configuración.

---

## 1. Motor de datos

El repositorio incluye `backend/Dockerfile`, así que sirve cualquier proveedor
que ejecute contenedores. Todos los citados tienen plan gratuito.

### Opción rápida: Render (blueprint incluido)

`render.yaml` describe el servicio **y la base de datos del historial**, ya
conectados entre sí:

1. En Render: **New → Blueprint** y seleccione este repositorio.
2. Render crea el servicio web y un PostgreSQL, e inyecta `DATABASE_URL` por su
   cuenta. No hay que rellenar nada ni copiar credenciales.
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
5. En **Historial** debe figurar el archivo recién subido, con sus botones de
   abrir y borrar. Si dice que el historial no está disponible, falta
   `DATABASE_URL` en el motor.

---

## Base de datos e historial

La aplicación **funciona sin base de datos**: se sube un archivo, se analiza y
se descargan los resultados. Con una base de datos se activa además el
**historial**, que conserva los archivos analizados para reabrirlos o borrarlos.

La conexión se toma de `DATABASE_URL`, **en el servicio del motor de datos**.
No va en Netlify: la interfaz nunca habla con la base de datos, sólo con el
motor.

### Con el blueprint de Render

`render.yaml` ya declara un Postgres y lo conecta al servicio mediante
`fromDatabase`, así que la cadena de conexión se inyecta sola y no hay que
copiar ninguna credencial.

> **El Postgres gratuito de Render caduca 30 días después de crearse.** Pasado
> ese plazo quedan 14 días para pasarlo a un plan de pago; después Render lo
> borra con todos sus datos. Para un historial que deba durar, conviene un
> proveedor sin caducidad.

### Con otro proveedor (sin caducidad)

Sirve cualquier PostgreSQL. Neon —lo que hay detrás de Netlify DB— tiene un
plan gratuito que no caduca, y su cadena de conexión se puede usar desde el
motor alojado en Render:

1. Borre el bloque `databases:` de `render.yaml`.
2. Cambie el `fromDatabase` de `DATABASE_URL` por `sync: false`.
3. Pegue la cadena de conexión en el panel de Render, en las variables del
   servicio.

Se admiten los tres esquemas habituales (`postgres://`, `postgresql://` y
`postgresql+psycopg://`): el motor los normaliza al arrancar.

### Cómo funciona el historial

- Se guarda el **archivo original comprimido**, no el análisis ya calculado. Al
  reabrirlo se reprocesa con el código vigente, así que una entrada antigua
  nunca queda descrita por una versión anterior del motor.
- Cada navegador tiene un identificador anónimo (`localStorage`) que viaja en la
  cabecera `X-Cliente`. No hay cuentas, pero el historial de una persona no
  aparece en el navegador de otra.
- Límites configurables: `MAX_BYTES_HISTORIAL` (8 MB por archivo) y
  `MAX_HISTORIAL` (25 análisis por navegador; al superarlo se descartan los más
  antiguos).
- Si la base de datos no está disponible, la interfaz lo explica y **el resto de
  la aplicación sigue funcionando igual**.

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| «No se pudo contactar con el motor de datos» | `BACKEND_URL` sin definir, mal escrita, con barra final, o el sitio no se redesplegó tras añadirla |
| Error de CORS en la consola | `CORS_ORIGINS` del motor no incluye el dominio de Netlify |
| `/api/salud` da 502 | El motor está caído o dormido (los planes gratuitos suspenden el servicio por inactividad; la primera petición tarda unos segundos) |
| El build de Netlify no encuentra `package.json` | Se sobreescribió el directorio base; debe ser `frontend` |
| Los datos «se pierden» tras un rato | Comportamiento esperado: los datasets viven en memoria una hora (`DATASET_TTL_SECONDS`). El historial, en cambio, es persistente |
| El historial aparece como no disponible | Falta `DATABASE_URL` en el motor, o la conexión falló (revise los registros del servicio) |
| El historial desapareció de golpe | Si usa el Postgres gratuito de Render, pudo caducar a los 30 días |
