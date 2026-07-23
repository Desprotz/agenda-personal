// netlify/functions/cumplimientos.js
// API de la tabla `cumplimientos` ("hecho hoy" / rachas de tareas recurrentes),
// consumida por js/services/cumplimientoService.js.
// TODO (Fase 3): POST marcarHecho(eventoId, fecha), GET calcularRacha(eventoId)
// — usando getDb() de ./_db.js.

import { json } from './_db.js';

export default async function handler() {
  return json(501, { error: 'Todavía no implementado — llega en la Fase 3, ver PROYECTO.md' });
}

export const config = { path: '/api/cumplimientos' };
