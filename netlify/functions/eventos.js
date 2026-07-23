// netlify/functions/eventos.js
// API de la tabla `eventos`, consumida por js/services/agendaService.js.
// TODO (Fase 3): GET (listar/filtrar por rango de fecha), POST (crear),
// PUT (actualizar), DELETE — usando getDb() de ./_db.js con SQL parametrizado.

import { json } from './_db.js';

export default async function handler() {
  return json(501, { error: 'Todavía no implementado — llega en la Fase 3, ver PROYECTO.md' });
}

export const config = { path: '/api/eventos' };
