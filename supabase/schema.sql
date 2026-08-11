-- Esquema del historial de análisis para Supabase (PostgreSQL).
--
-- Uso: Supabase → SQL Editor → New query → pegar este archivo → Run.
--
-- No es estrictamente obligatorio: el motor crea la tabla solo al arrancar
-- (`Base.metadata.create_all`). Conviene ejecutarlo igualmente porque además de
-- la tabla aplica el blindaje de acceso del final, que el ORM no hace.
--
-- Es idempotente: se puede volver a ejecutar sin romper nada.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------
-- Refleja exactamente el modelo `AnalisisGuardado` de backend/app/db/base.py.
-- Se guarda el archivo original comprimido con gzip (`contenido`), no el
-- análisis calculado: al reabrir una entrada se reprocesa con el código
-- vigente.
create table if not exists public.analisis_guardado (
    id             varchar(32)  primary key,

    -- Identificador anónimo del navegador (localStorage → cabecera X-Cliente).
    -- No hay cuentas ni datos personales: sólo separa el historial de cada
    -- navegador del de los demás.
    cliente        varchar(64)  not null,

    nombre_archivo varchar(255) not null,
    hoja           varchar(120),
    filas          integer      not null,
    columnas       integer      not null,
    tamano_bytes   integer      not null,

    -- Recuento por tipo de variable, para pintar la lista sin reprocesar nada.
    resumen_tipos  json         not null default '{}'::json,

    -- Archivo original comprimido (gzip). El límite por archivo lo aplica el
    -- motor con MAX_BYTES_HISTORIAL (8 MB por omisión).
    contenido      bytea        not null,

    creado_en      timestamptz  not null default now()
);

-- Consulta habitual: «las N entradas más recientes de este navegador».
create index if not exists ix_analisis_cliente_fecha
    on public.analisis_guardado (cliente, creado_en);

-- ---------------------------------------------------------------------------
-- Blindaje de acceso
-- ---------------------------------------------------------------------------
-- Todo lo que vive en el esquema `public` queda expuesto por la API REST de
-- Supabase, alcanzable con la clave anónima. Esta tabla no debe leerse por ahí:
-- el único que la usa es el motor de datos, que se conecta por SQL directo.
revoke all on table public.analisis_guardado from anon, authenticated;

-- Segunda barrera, por si en el futuro se concede algún permiso por descuido:
-- con RLS activo y sin políticas, `anon` y `authenticated` no ven ninguna fila.
--
-- Esto NO afecta al motor. El rol `postgres` de la cadena de conexión es el
-- propietario de la tabla, y en PostgreSQL el propietario no queda sujeto a RLS
-- salvo que se declare FORCE ROW LEVEL SECURITY, cosa que aquí no se hace.
alter table public.analisis_guardado enable row level security;

-- ---------------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------------
-- Debe devolver una fila: rls_activo = true y sin_permisos_anonimos = true.
select
    c.relrowsecurity                                          as rls_activo,
    not has_table_privilege('anon', 'public.analisis_guardado', 'select')
                                                              as sin_permisos_anonimos,
    (select count(*) from public.analisis_guardado)           as entradas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'analisis_guardado';
