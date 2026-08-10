# Despliegue

La aplicación son **dos servicios**: la interfaz (Next.js) y el motor de datos
(FastAPI + Pandas). Netlify publica la interfaz; el motor necesita un alojamiento
que ejecute Python.

> Sin el motor de datos, la interfaz carga y se ve, pero cualquier acción sobre
> un archivo devuelve *«No se pudo contactar con el motor de datos»*: la carga,
> el análisis, los filtros y las descargas dependen de él.

---

## 1. Motor de datos (Python)

Netlify no ejecuta procesos Python de larga vida, así que este servicio va en
otro proveedor. Cualquiera que admita un contenedor o un `uvicorn` sirve:
Render, Railway, Fly.io, Google Cloud Run, Azure Container Apps o una VPS.

Configuración del servicio:

| Parámetro | Valor |
|---|---|
| Directorio raíz | `backend` |
| Instalación | `pip install -r requirements.txt` |
| Arranque | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Versión de Python | 3.11 o superior |

Variable de entorno obligatoria en el motor de datos:

```
CORS_ORIGINS=https://SU-SITIO.netlify.app
```

Debe contener el dominio exacto del sitio de Netlify. Si usa un dominio propio,
inclúyalo también, separado por comas.

Compruebe que responde antes de seguir:

```bash
curl https://SU-BACKEND/api/salud
```

---

## 2. Interfaz (Netlify)

El repositorio ya trae `netlify.toml` con el directorio base, el comando de
compilación y el runtime de Next.js, así que basta con conectar el repositorio.

1. **Add new site → Import an existing project** y elija este repositorio.
2. No cambie el comando ni el directorio de publicación: se leen de
   `netlify.toml`.
3. En **Site configuration → Environment variables**, añada:

   ```
   BACKEND_URL = https://SU-BACKEND
   ```

   Sin barra final. Es la URL del servicio del paso 1.

4. Lance el despliegue.

### Por qué hace falta `BACKEND_URL`

`next.config.mjs` reescribe `/api/*` hacia `BACKEND_URL`, de modo que el
navegador siempre llama al mismo origen y no hay CORS entre la interfaz y el
motor. Si la variable no está definida, la reescritura apunta a
`http://127.0.0.1:8000`, que en Netlify no existe, y todas las llamadas fallan.

La variable se lee al compilar: **si la cambia, vuelva a desplegar** para que
tenga efecto.

---

## Comprobación tras el despliegue

Con el sitio publicado, verifique en este orden:

1. `https://SU-SITIO.netlify.app/api/salud` devuelve un JSON con `"estado": "ok"`.
   Si falla, el problema está en `BACKEND_URL` o en el motor de datos.
2. La sección **Descargas** lista 5 archivos Excel y 5 CSV.
3. Descargue una muestra y súbala: deben aparecer las fichas de clasificación
   de variables.
4. Aplique un filtro y confirme que las métricas y el gráfico cambian.

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El build falla por no encontrar `package.json` | Se sobreescribió el directorio base; debe ser `frontend` |
| «No se pudo contactar con el motor de datos» | `BACKEND_URL` sin definir, mal escrita o con barra final |
| Error de CORS en la consola | `CORS_ORIGINS` del backend no incluye el dominio de Netlify |
| El sitio carga pero `/api/salud` da 502 | El motor de datos está caído o dormido (los planes gratuitos suspenden el servicio por inactividad) |
| Los datos «se pierden» tras un rato | Comportamiento esperado: los datasets viven en memoria una hora (`DATASET_TTL_SECONDS`) |
