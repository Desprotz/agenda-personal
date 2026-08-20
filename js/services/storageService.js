// services/storageService.js
// Subida de imágenes (notas) y audio (notas de voz) a Netlify Blobs, vía
// netlify/functions/media.js (el frontend nunca toca el storage directo).

import { apiFetch } from '../config/apiClient.js';

/** Lee un File/Blob como base64 "pelado" (sin el prefijo data:...;base64,). */
function leerComoBase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',', 2)[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Sube una imagen (File, ej. de un <input type="file">) y devuelve
 * { key, url } — `key` es lo que se guarda en notas_imagenes.url_storage,
 * `url` (= `/api/media/{key}`) es lista para usar en un <img src>.
 */
export async function subirImagen(file) {
  const data = await leerComoBase64(file);
  return apiFetch('/media', {
    method: 'POST',
    body: JSON.stringify({ tipo: 'imagen', contentType: file.type, data }),
  });
}

/**
 * Sube un audio grabado (Blob de MediaRecorder) y devuelve { key, url } —
 * igual que subirImagen, pero para notas_audio.url_storage.
 */
export async function subirAudio(blob, contentType) {
  const data = await leerComoBase64(blob);
  return apiFetch('/media', {
    method: 'POST',
    body: JSON.stringify({ tipo: 'audio', contentType: contentType || blob.type, data }),
  });
}

/** Borra un archivo del storage por su key (ej. al descartar una grabación sin guardar). */
export async function eliminarArchivo(key) {
  return apiFetch(`/media/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

/** URL pública (relativa) de una key ya subida. */
export function obtenerUrlPublica(key) {
  return `/api/media/${key}`;
}
