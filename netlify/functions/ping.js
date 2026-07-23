// netlify/functions/ping.js
// Health-check simple para confirmar que TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
// están bien puestos y que las tablas ya existen. Lo llama `js/config/apiClient.js`
// desde ajustes.html (tarjeta "Cuenta"), reemplazando al antiguo
// `verificarConexion()` que hablaba directo con Supabase desde el navegador.

import { getDb, json } from './_db.js';

export default async function handler() {
  let db;
  try {
    db = getDb();
  } catch (error) {
    return json(200, { ok: false, motivo: 'no-configurado', error: error.message });
  }

  try {
    await db.execute('select id from etiquetas limit 1');
    return json(200, { ok: true });
  } catch (error) {
    console.error('[ping] Falló el chequeo de conexión:', error.message);
    return json(200, { ok: false, motivo: 'error', error: error.message });
  }
}

export const config = { path: '/api/ping' };
