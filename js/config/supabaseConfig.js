// config/supabaseConfig.js
// Datos de conexión al proyecto de Supabase. Se completan a mano después de
// crear el proyecto en https://supabase.com/dashboard (Fase 2, ver PROYECTO.md).
//
// Dónde encontrarlos: dashboard del proyecto → Project Settings → API.
//   - SUPABASE_URL      = "Project URL"
//   - SUPABASE_ANON_KEY = "anon public" key
//
// Nota de seguridad: la anon key NO es secreta — está diseñada para vivir en
// el frontend (por eso es seguro que quede en este archivo, incluso en un
// repo público). Lo que protege los datos es Row Level Security, definida en
// supabase/schema.sql (cada fila solo la puede ver/editar su dueño, vía
// auth.uid() = usuario_id). La clave que JAMÁS debe tocar el frontend es la
// "service_role" key — esa sí es secreta y no se usa en este proyecto.

export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';
