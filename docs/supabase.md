# Base de datos en Supabase

Guía para dejar el **historial** funcionando con un proyecto de Supabase, sin
depender del PostgreSQL gratuito de Render (que caduca a los 30 días).

---

## Antes de empezar: qué resuelve Supabase y qué no

| Pieza | Tecnología | Dónde va |
|---|---|---|
| Interfaz | Next.js | Netlify ✅ |
| **Base de datos del historial** | PostgreSQL | **Supabase** ← esta guía |
| Motor de datos | Python · FastAPI · Pandas | Un proveedor de contenedores |

Supabase sustituye a la **base de datos**, no al motor. El análisis lo hace
Pandas, que necesita Python: las Edge Functions de Supabase son Deno/TypeScript
y las Netlify Functions admiten JavaScript, TypeScript y Go, así que en ninguno
de los dos sitios puede ejecutarse FastAPI.

Eso no impide quitarse de encima la caducidad, porque **lo que caducaba a los 30
días era el PostgreSQL gratuito de Render, no su servicio web**. El plan
gratuito de un servicio web de Render no expira: sólo duerme tras 15 minutos sin
tráfico y tarda unos segundos en la primera petición. Combinando ambos:

```
Netlify (interfaz)  →  Render, plan free (motor)  →  Supabase (PostgreSQL)
     no caduca              no caduca                    no caduca
```

Si prefiere otro alojamiento para el motor, `backend/Dockerfile` vale igual en
Fly.io, Railway, Cloud Run o una VPS. Nada de esta guía cambia.

---

## 1. Crear el proyecto en la organización vacía

El plan gratuito de Supabase permite **2 proyectos activos por organización**,
no por cuenta. Un tercer proyecto creado dentro de la segunda organización cuenta
contra esa organización —que está vacía— y no afecta a los dos que ya tiene.

1. Entre en <https://supabase.com/dashboard>.
2. Arriba a la izquierda, en el **selector de organización**, elija la segunda
   organización (la que no tiene proyectos). Es el paso que decide dónde se
   crea; si se salta, Supabase usa la organización activa y el botón de nuevo
   proyecto aparecerá bloqueado por haber llegado al límite.
3. **New project** y rellene:

   | Campo | Valor |
   |---|---|
   | Name | `motor-datos-historial` |
   | Database Password | **Genere una y guárdela** — sólo se muestra ahora |
   | Region | La más cercana al motor. Con Render en Oregón: `West US (Oregon)` |
   | Plan | Free |

4. **Create new project** y espere a que termine de aprovisionar (1-2 minutos).

> Si la contraseña se pierde, no se recupera: se cambia en
> **Project Settings → Database → Reset database password**.

---

## 2. Crear la tabla

**SQL Editor → New query**, pegue el contenido de
[`supabase/schema.sql`](../supabase/schema.sql) y pulse **Run**.

El motor crearía la tabla solo al arrancar, pero conviene ejecutar el archivo:
además de la tabla aplica el blindaje de acceso, que el ORM no hace. Todo lo que
vive en el esquema `public` queda expuesto por la API REST de Supabase, y el
historial no debe leerse por ahí — el script revoca los permisos de `anon` y
`authenticated` y activa RLS.

La última consulta del archivo devuelve la comprobación: `rls_activo = true` y
`sin_permisos_anonimos = true`.

---

## 3. Copiar la cadena de conexión

Botón **Connect**, arriba en el panel del proyecto. Ofrece tres cadenas y la
elección importa:

| Opción | Puerto | Red | Para este proyecto |
|---|---|---|---|
| Direct connection | 5432 | **Sólo IPv6** | ❌ Render no tiene IPv6 |
| **Session pooler** | 5432 | IPv4 | ✅ **la que hay que usar** |
| Transaction pooler | 6543 | IPv4 | Funciona, pero innecesario aquí |

Copie la de **Session pooler**. Tiene esta forma:

```
postgresql://postgres.abcdefghijklmno:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

Cópiela literalmente del panel en lugar de escribirla: el usuario lleva la
referencia del proyecto (`postgres.<ref>`) y el prefijo del anfitrión varía
según el proyecto (`aws-0-`, `aws-1-`…).

Después sustituya `[YOUR-PASSWORD]` por la contraseña del paso 1.

> **Si la contraseña lleva caracteres especiales**, hay que codificarlos o la
> cadena se interpreta mal:
> `@` → `%40` · `:` → `%3A` · `/` → `%2F` · `#` → `%23` · `?` → `%3F` ·
> `&` → `%26` · `%` → `%25`
>
> Es el fallo más habitual de todo este proceso. Lo más cómodo es generar una
> contraseña sólo con letras y números.

El motor acepta los tres esquemas (`postgres://`, `postgresql://` y
`postgresql+psycopg://`), exige TLS por su cuenta y, si detecta el pooler en
modo transacción, desactiva el pool propio y las sentencias preparadas.

---

## 4. Comprobar la cadena antes de desplegar

Sale más barato que desplegar y mirar registros:

```bash
cd backend
pip install -r requirements.txt
DATABASE_URL='postgresql://postgres.abc:clave@aws-0-us-west-1.pooler.supabase.com:5432/postgres' \
    python scripts/verificar_bd.py
```

Conecta, crea las tablas si faltan, escribe una entrada, la lee de vuelta y la
borra. Si algo falla, dice cuál es la causa probable.

---

## 5. Variables de entorno

### En el motor de datos (Render o el proveedor que use)

```
DATABASE_URL = postgresql://postgres.<REF>:<CLAVE>@<REGION>.pooler.supabase.com:5432/postgres
CORS_ORIGINS = https://excelviewanddownloadtopdf.netlify.app
```

`render.yaml` ya declara `DATABASE_URL` con `sync: false`, de modo que Render la
pide en el panel al crear el blueprint y la credencial nunca queda escrita en el
repositorio. Si el servicio ya existe: **Environment → Add environment variable**
y guardar; Render redespliega solo.

### En Netlify

```
BACKEND_URL = https://ALGO.onrender.com
```

Sin barra final. Después **redesplegar el sitio**: la variable se lee al
compilar.

### Sobre la clave anónima y `SUPABASE_URL`

**Este proyecto no las usa, y no hay que ponerlas en Netlify.**

La clave anónima sirve para hablar con las APIs de Supabase (PostgREST, Auth,
Storage) desde el navegador. Aquí la interfaz nunca habla con Supabase: sólo
llama al motor, y es el motor el que abre una conexión SQL con SQLAlchemy usando
`DATABASE_URL`. Publicar la clave anónima como `NEXT_PUBLIC_*` expondría el
proyecto en el navegador sin que ninguna función la aproveche.

Resumido: **la única credencial de Supabase que se usa es `DATABASE_URL`, y vive
en el motor, no en Netlify.**

---

## 6. Comprobación final

1. `https://ALGO.onrender.com/api/salud` → `{"estado":"ok",...}`
2. `https://excelviewanddownloadtopdf.netlify.app/api/salud` → lo mismo.
3. Suba un archivo y mire la sección **Historial**: debe aparecer la entrada con
   sus botones de abrir y borrar.
4. En Supabase, **Table Editor → `analisis_guardado`**: ahí está la fila.

Si el historial dice que no está disponible, la conexión falló. El motivo exacto
está en los registros del motor (en Render, pestaña **Logs**), y el mensaje
incluye la pista correspondiente.

---

## Límites del plan gratuito de Supabase

| Límite | Valor |
|---|---|
| Proyectos activos | 2 por organización |
| Espacio de base de datos | 500 MB |
| Transferencia | 5 GB al mes |
| **Pausa por inactividad** | **7 días sin actividad** |

La pausa es lo único a tener en cuenta: si nadie usa el sitio durante una
semana, Supabase suspende el proyecto y el historial deja de responder hasta
reactivarlo desde el panel (**Restore project**). Los datos no se pierden, y el
resto de la aplicación —subir, analizar, descargar— sigue funcionando igual
mientras tanto, porque el historial es opcional por diseño.

Con 8 MB por archivo (`MAX_BYTES_HISTORIAL`) y 25 análisis por navegador
(`MAX_HISTORIAL`), los 500 MB dan de sobra: los archivos se guardan comprimidos
con gzip.

---

## Problemas frecuentes

| Síntoma en los registros del motor | Causa |
|---|---|
| `Network is unreachable` / `failed to resolve host db.<ref>.supabase.co` | Está usando la conexión directa, que sólo es IPv6. Cambie a la cadena del *Session pooler* |
| `password authentication failed` | La contraseña lleva caracteres especiales sin codificar, o quedó el literal `[YOUR-PASSWORD]` |
| `Tenant or user not found` | El usuario del pooler debe ser `postgres.<ref>`, no `postgres` a secas |
| `invalid connection option "pgbouncer"` | Cadena de otro panel (estilo Prisma). El motor ya descarta ese parámetro; actualice el despliegue |
| `prepared statement "..." already exists` | Pooler en modo transacción sin desactivar preparadas. El motor lo detecta por el puerto 6543; si usó otro puerto, añada `?pgbouncer=true` a la cadena |
| `Max client connections reached` | Demasiadas instancias del motor contra el mismo proyecto |
| El historial funcionaba y dejó de hacerlo tras días sin uso | El proyecto se pausó por inactividad: reactívelo desde el panel |
