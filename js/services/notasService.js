// services/notasService.js
// CRUD de la tabla `notas` + vínculo opcional a `eventos` e imágenes/audio.
// Usa apiFetch('/notas', ...) de config/apiClient.js -> netlify/functions/notas.js.

import { apiFetch } from '../config/apiClient.js';

/**
 * Lista notas, más recientes primero. `filtros` opcionales:
 * { fecha, evento_id, etiqueta_id, q }.
 */
export async function listarNotas(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.fecha) params.set('fecha', filtros.fecha);
  if (filtros.evento_id) params.set('evento_id', filtros.evento_id);
  if (filtros.etiqueta_id) params.set('etiqueta_id', filtros.etiqueta_id);
  if (filtros.q) params.set('q', filtros.q);

  const query = params.toString();
  const { notas } = await apiFetch(`/notas${query ? `?${query}` : ''}`);
  return notas;
}

/** Últimas `limite` notas (usado en la vista Hoy). */
export async function listarUltimasNotas(limite = 3) {
  const notas = await listarNotas();
  return notas.slice(0, limite);
}

/**
 * Crea una nota nueva. `datos`: { titulo?, contenido?, fecha?, evento_id?,
 * etiqueta_id?, imagenes?: [{url_storage, orden}], audio?: [{url_storage,
 * duracion_segundos}] } — las imágenes/audio ya deben estar subidas (ver
 * storageService.subirImagen/subirAudio) antes de llamar a esto.
 */
export async function crearNota(datos) {
  const { nota } = await apiFetch('/notas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return nota;
}

/**
 * Actualiza (parcialmente) una nota existente. Si `datos.imagenes` o
 * `datos.audio` vienen presentes (aunque sea `[]`), reemplazan por completo
 * el set anterior — el backend se encarga de borrar del storage lo que sobre.
 */
export async function actualizarNota(id, datos) {
  const { nota } = await apiFetch(`/notas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return nota;
}

/** Elimina una nota (y sus imágenes/audio, tanto en BD como en el storage). */
export async function eliminarNota(id) {
  return apiFetch(`/notas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
