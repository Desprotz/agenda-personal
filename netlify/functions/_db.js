// netlify/functions/_db.js
// Cliente único de Turso, importado por el resto de las funciones (eventos,
// notas, etiquetas, cumplimientos, ping, media). Este archivo SOLO corre en
// el servidor (Netlify Functions) — es justo la pieza que en la Fase 2
// original (Supabase) vivía en el frontend como `js/config/supabaseClient.js`.
//
// Con Turso el token de acceso SÍ es sensible (a diferencia del anon key de
// Supabase, que estaba pensado para exponerse). Por eso vive únicamente en
// variables de entorno de Netlify (Site settings → Environment variables),
// nunca en un archivo del repo. Ver PROYECTO.md sección 2 y 7.
//
// Variables de entorno esperadas:
//   TURSO_DATABASE_URL  → URL tipo libsql://tu-db-tu-org.turso.io
//   TURSO_AUTH_TOKEN    → token generado con `turso db tokens create`

import { createClient } from '@libsql/client';

let cliente = null;

export function getDb() {
  if (cliente) return cliente;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      'Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en las variables de ' +
      'entorno de Netlify (Site settings → Environment variables). Ver ' +
      'PROYECTO.md sección 7 para el paso a paso.'
    );
  }

  cliente = createClient({ url, authToken });
  return cliente;
}

/** Respuesta JSON estándar para todas las funciones (formato Netlify Functions v2). */
export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}