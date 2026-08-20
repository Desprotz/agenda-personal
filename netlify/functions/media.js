// netlify/functions/media.js
// Sube y sirve imágenes (notas) y audio (notas de voz) usando Netlify Blobs,
// consumido por js/services/storageService.js. Reemplaza al antiguo bucket
// `notas-media` de Supabase Storage (ver PROYECTO.md sección 4.2 y 8).
//
// POST   /api/media       -> { tipo: 'imagen'|'audio', contentType, data (base64) }
//                             sube el archivo y devuelve { key, url }.
// GET    /api/media/:key  -> sirve el archivo de vuelta (Content-Type real).
// DELETE /api/media/:key  -> borra el archivo (usado al reemplazar o borrar
//                             una nota, ver notas.js).
//
// Fase 4 (ver PROYECTO.md sección 6). Las keys nunca llevan '/' — así el
// parámetro de ruta `:id` de Netlify Functions v2 las captura enteras, sin
// depender de un splat. El nombre del store ('notas-media') es fijo y no
// hace falta configurarlo aparte: Netlify Blobs se autoconfigura dentro de
// una Netlify Function (usa las credenciales del sitio automáticamente).

import { getStore } from '@netlify/blobs';
import { json } from './_db.js';

const TIPOS_VALIDOS = ['imagen', 'audio'];

// Content-Types que aceptamos, y la extensión que le damos a la key.
const CONTENT_TYPES_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

// Límite generoso pero seguro para el tamaño del payload de una Netlify
// Function (el body JSON completo, con el base64 ya es ~33% más grande que
// el archivo original). 6 MB decodificados ~= 8 MB en base64.
const MAX_BYTES_DECODIFICADOS = 6 * 1024 * 1024;

function idDesdeRuta(request, context) {
  if (context?.params?.id) return context.params.id;
  const url = new URL(request.url);
  const partes = url.pathname.split('/').filter(Boolean); // ['api', 'media', ':key'?]
  return partes[2] || null;
}

/** Decodifica un data URL o un base64 "pelado" a Uint8Array. */
function decodificarBase64(data) {
  const limpio = data.includes(',') ? data.split(',', 2)[1] : data;
  const binario = atob(limpio);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export default async function handler(request, context) {
  const key = idDesdeRuta(request, context);

  try {
    const store = getStore('notas-media');

    if (request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const { tipo, contentType, data } = cuerpo;

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return json(400, { error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` });
      }
      const extension = CONTENT_TYPES_PERMITIDOS[contentType];
      if (!extension) {
        return json(400, { error: `contentType no soportado: ${contentType || '(vacío)'}.` });
      }
      if (!data || typeof data !== 'string') {
        return json(400, { error: 'Falta data (archivo en base64).' });
      }

      let bytes;
      try {
        bytes = decodificarBase64(data);
      } catch {
        return json(400, { error: 'data no es un base64 válido.' });
      }
      if (bytes.byteLength === 0) return json(400, { error: 'El archivo está vacío.' });
      if (bytes.byteLength > MAX_BYTES_DECODIFICADOS) {
        return json(413, { error: `El archivo es demasiado grande (máx. ${MAX_BYTES_DECODIFICADOS / 1024 / 1024} MB).` });
      }

      const prefijo = tipo === 'imagen' ? 'img' : 'aud';
      const nuevaKey = `${prefijo}_${crypto.randomUUID()}.${extension}`;

      await store.set(nuevaKey, bytes, { metadata: { contentType } });

      return json(201, { key: nuevaKey, url: `/api/media/${nuevaKey}` });
    }

    if (request.method === 'GET') {
      if (!key) return json(400, { error: 'Falta la key del archivo en la ruta.' });

      const resultado = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!resultado) return json(404, { error: 'No existe un archivo con esa key.' });

      const contentType = resultado.metadata?.contentType || 'application/octet-stream';
      return new Response(resultado.data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          // Las keys son aleatorias e inmutables (nunca se reescribe una
          // key existente) -> cachear agresivo es seguro.
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    if (request.method === 'DELETE') {
      if (!key) return json(400, { error: 'Falta la key del archivo en la ruta.' });
      await store.delete(key);
      return json(200, { ok: true });
    }

    return json(405, { error: `Método ${request.method} no soportado en /api/media` });
  } catch (error) {
    console.error('[media] Error:', error.message);
    return json(500, { error: 'Error interno gestionando el archivo.' });
  }
}

export const config = { path: ['/api/media', '/api/media/:id'] };
