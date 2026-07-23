// netlify/functions/media.js
// Sube y sirve imágenes (notas) y audio (notas de voz) usando Netlify Blobs,
// consumido por js/services/storageService.js. Reemplaza al antiguo bucket
// `notas-media` de Supabase Storage (ver PROYECTO.md sección 4.2 y 8).
//
// TODO (Fase 4):
//   POST /api/media   → recibe un archivo, lo guarda con getStore('notas-media')
//                        y devuelve la key para guardar en notas_imagenes /
//                        notas_audio (columna `url_storage`, aquí pasa a ser
//                        una key de blob en vez de una URL de Supabase).
//   GET  /api/media/:key → sirve el archivo de vuelta.
//
// import { getStore } from '@netlify/blobs';

import { json } from './_db.js';

export default async function handler() {
  return json(501, { error: 'Todavía no implementado — llega en la Fase 4, ver PROYECTO.md' });
}

export const config = { path: '/api/media' };
