// config/apiClient.js
// Reemplaza a los antiguos supabaseClient.js / supabaseConfig.js.
//
// Con Supabase, el frontend hablaba directo con la base de datos usando el
// anon key (pensado para vivir en el navegador). Con Turso el token SÍ es
// sensible, así que el frontend ya no toca la base de datos directamente:
// llama a las Netlify Functions (carpeta `netlify/functions/`), que son las
// únicas que conocen TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (ver
// netlify/functions/_db.js). Por eso este archivo no tiene ninguna clave —
// no hace falta configurar nada aquí, las credenciales se ponen una sola vez
// en Netlify (Site settings → Environment variables, ver PROYECTO.md sección 7).
//
// Todos los *Service.js (agendaService, notasService, etc.) importan
// `apiFetch` de aquí en vez de importar un cliente de base de datos.

const BASE_URL = '/api';

/**
 * Wrapper de fetch para las Netlify Functions. Lanza un Error legible si la
 * función responde con un status de error, para que los *Service.js puedan
 * hacer try/catch sin tener que revisar `response.ok` cada vez.
 */
export async function apiFetch(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const mensaje = cuerpo?.error || `Error ${respuesta.status} llamando a ${ruta}`;
    throw new Error(mensaje);
  }

  return cuerpo;
}

/**
 * Ping simple para confirmar que Netlify Functions puede hablar con Turso
 * (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN bien puestos, tablas creadas). Se
 * usa desde Ajustes para mostrar el estado de conexión, igual que antes con
 * `verificarConexion()` de Supabase.
 */
export async function verificarConexion() {
  try {
    const resultado = await apiFetch('/ping');
    return resultado;
  } catch (error) {
    console.error('[apiClient] Falló el ping de conexión:', error.message);
    return { ok: false, motivo: 'error', error };
  }
}
