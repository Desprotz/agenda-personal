// services/etiquetasService.js
// CRUD de la tabla `etiquetas`, compartida entre eventos y notas.
// Usa apiFetch('/etiquetas', ...) de config/apiClient.js -> netlify/functions/etiquetas.js.

import { apiFetch } from '../config/apiClient.js';

/** Lista todas las etiquetas (orden alfabético, lo resuelve el backend). */
export async function listarEtiquetas() {
  const { etiquetas } = await apiFetch('/etiquetas');
  return etiquetas;
}

/** Crea una etiqueta nueva. */
export async function crearEtiqueta(nombre, color) {
  const { etiqueta } = await apiFetch('/etiquetas', {
    method: 'POST',
    body: JSON.stringify({ nombre, color }),
  });
  return etiqueta;
}

/** Actualiza (parcialmente) una etiqueta existente. */
export async function actualizarEtiqueta(id, cambios) {
  const { etiqueta } = await apiFetch(`/etiquetas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(cambios),
  });
  return etiqueta;
}

/** Elimina una etiqueta (eventos/notas que la usaban quedan con etiqueta_id = null). */
export async function eliminarEtiqueta(id) {
  return apiFetch(`/etiquetas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
