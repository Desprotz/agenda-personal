// netlify/functions/notas.js
// API de la tabla `notas` (+ notas_imagenes / notas_audio), consumida por
// js/services/notasService.js.
// TODO (Fase 4): GET (listar/filtrar por fecha o evento vinculado), POST
// (crear), PUT (actualizar), DELETE — usando getDb() de ./_db.js.

import { json } from './_db.js';

export default async function handler() {
  return json(501, { error: 'Todavía no implementado — llega en la Fase 4, ver PROYECTO.md' });
}

export const config = { path: '/api/notas' };
