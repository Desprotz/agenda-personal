-- turso/schema.sql
-- Esquema de la base de datos (Fase 2). Ver PROYECTO.md sección 5 para el
-- borrador conceptual. Este archivo se ejecuta contra la base de Turso, por
-- ejemplo con:
--   turso db shell <nombre-db> < turso/schema.sql
-- o pegando el contenido en el editor SQL del dashboard de Turso.
--
-- Diferencias clave frente a la versión anterior en Postgres (Supabase):
--   - `uuid` -> `text` con `gen_random_uuid()` reemplazado por generar el id
--     en la aplicación (Netlify Functions, con crypto.randomUUID()) antes del
--     INSERT — SQLite no tiene un generador de UUID nativo confiable.
--   - `timestamptz` / `now()` -> `text` con `datetime('now')` (ISO 8601 en UTC).
--   - `date` / `time` -> `text` (formato 'YYYY-MM-DD' / 'HH:MM'), SQLite no
--     tiene tipos de fecha/hora nativos.
--   - `int[]` (dias_semana) -> `text`, guardando algo como '1,3,5' o JSON
--     ('[1,3,5]') y parseándolo en la aplicación.
--   - No hay Storage ni buckets: las imágenes/audio de notas ahora se guardan
--     en Netlify Blobs (ver netlify/functions/media.js), y `url_storage` pasa
--     a contener la key del blob en vez de una URL pública de Supabase.
--
-- Sin ningún tipo de login (decisión 2026-07-22, ver PROYECTO.md, bitácora):
-- no hay columna `usuario_id`. La protección ya no depende de que una clave
-- de frontend se mantenga "semi-secreta" (como el anon key) — con Turso el
-- token vive únicamente en el servidor (Netlify Functions), así que esta
-- base ya no es alcanzable directamente desde el navegador de nadie.

create table if not exists etiquetas (
  id text primary key,
  nombre text not null,
  color text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists eventos (
  id text primary key,
  titulo text not null,
  descripcion text,
  tipo text not null check (tipo in ('diario', 'dias_especificos', 'puntual', 'rango')),
  dias_semana text,             -- ej. '1,3,5' = lunes, miércoles, viernes
  fecha_inicio text,            -- 'YYYY-MM-DD'
  fecha_fin text,               -- 'YYYY-MM-DD'
  hora_inicio text,             -- 'HH:MM'
  hora_fin text,                -- 'HH:MM'
  etiqueta_id text references etiquetas(id) on delete set null,
  tiene_alarma integer not null default 0,   -- boolean: 0/1
  minutos_antes_alarma integer,
  created_at text not null default (datetime('now'))
);

create table if not exists cumplimientos (
  id text primary key,
  evento_id text not null references eventos(id) on delete cascade,
  fecha text not null,          -- 'YYYY-MM-DD'
  hecho integer not null default 1,          -- boolean: 0/1
  unique (evento_id, fecha)
);

create table if not exists notas (
  id text primary key,
  titulo text,
  contenido text,
  fecha text not null default (date('now')),  -- 'YYYY-MM-DD'
  evento_id text references eventos(id) on delete set null,
  etiqueta_id text references etiquetas(id) on delete set null,
  created_at text not null default (datetime('now'))
);

create table if not exists notas_imagenes (
  id text primary key,
  nota_id text not null references notas(id) on delete cascade,
  url_storage text not null,    -- key del blob en Netlify Blobs (store 'notas-media')
  orden integer not null default 0
);

create table if not exists notas_audio (
  id text primary key,
  nota_id text not null references notas(id) on delete cascade,
  url_storage text not null,    -- key del blob en Netlify Blobs (store 'notas-media')
  duracion_segundos integer,
  created_at text not null default (datetime('now'))
);

-- Nota: no hace falta nada equivalente a "storage.buckets" ni políticas de
-- storage aquí — Netlify Blobs no se configura por SQL, se usa directo desde
-- netlify/functions/media.js con getStore('notas-media'). Ver PROYECTO.md
-- sección 4.2 y 8.
