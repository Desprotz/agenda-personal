// netlify/functions/etiquetas.js
// API de la tabla `etiquetas`, consumida por js/services/etiquetasService.js.
// TODO (Fase 3): GET (listar), POST (crear), PUT (renombrar/cambiar color),
// DELETE — usando getDb() de ./_db.js.

import { json } from './_db.js';

export default async function handler() {
  return json(501, { error: 'Todavía no implementado — llega en la Fase 3, ver PROYECTO.md' });
}

export const config = { path: '/api/etiquetas' };
