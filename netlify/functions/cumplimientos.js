// netlify/functions/cumplimientos.js
// API de la tabla `cumplimientos` ("hecho hoy" / rachas de tareas recurrentes),
// consumida por js/services/cumplimientoService.js.
//
// GET  /api/cumplimientos?evento_id=X        -> lista de cumplimientos de ese evento
//                                               (el cálculo de racha se hace en el
//                                               frontend a partir de esta lista, ver
//                                               cumplimientoService.js -> calcularRacha)
// GET  /api/cumplimientos?fecha=YYYY-MM-DD   -> lista de cumplimientos de todos los
//                                               eventos en esa fecha (para pintar los
//                                               checks de "Hoy" con una sola llamada)
// POST /api/cumplimientos  { evento_id, fecha, hecho } -> upsert (marcar/desmarcar)
//
// Fase 3 (ver PROYECTO.md sección 6).

import { getDb, json } from './_db.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(request) {
  const db = getDb();
  const url = new URL(request.url);

  try {
    if (request.method === 'GET') {
      const eventoId = url.searchParams.get('evento_id');
      const fecha = url.searchParams.get('fecha');

      if (eventoId) {
        const resultado = await db.execute({
          sql: 'select id, evento_id, fecha, hecho from cumplimientos where evento_id = ? order by fecha asc',
          args: [eventoId],
        });
        return json(200, { cumplimientos: resultado.rows });
      }

      if (fecha) {
        if (!FECHA_RE.test(fecha)) return json(400, { error: 'fecha debe tener formato YYYY-MM-DD.' });
        const resultado = await db.execute({
          sql: 'select id, evento_id, fecha, hecho from cumplimientos where fecha = ?',
          args: [fecha],
        });
        return json(200, { cumplimientos: resultado.rows });
      }

      return json(400, { error: 'Falta el parámetro evento_id o fecha.' });
    }

    if (request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const eventoId = cuerpo.evento_id;
      const fecha = cuerpo.fecha;
      const hecho = cuerpo.hecho === undefined ? true : Boolean(cuerpo.hecho);

      if (!eventoId) return json(400, { error: 'Falta evento_id.' });
      if (!fecha || !FECHA_RE.test(fecha)) return json(400, { error: 'fecha debe tener formato YYYY-MM-DD.' });

      const evento = await db.execute({ sql: 'select id from eventos where id = ?', args: [eventoId] });
      if (!evento.rows[0]) return json(404, { error: 'No existe un evento con ese id.' });

      if (!hecho) {
        // Desmarcar = simplemente no hay registro de cumplimiento ese día.
        await db.execute({
          sql: 'delete from cumplimientos where evento_id = ? and fecha = ?',
          args: [eventoId, fecha],
        });
        return json(200, { evento_id: eventoId, fecha, hecho: false });
      }

      // Upsert manual (SQLite/libSQL soporta "on conflict", lo usamos sobre
      // la unique (evento_id, fecha) definida en turso/schema.sql).
      const nuevoId = crypto.randomUUID();
      await db.execute({
        sql: `insert into cumplimientos (id, evento_id, fecha, hecho)
              values (?, ?, ?, 1)
              on conflict(evento_id, fecha) do update set hecho = 1`,
        args: [nuevoId, eventoId, fecha],
      });

      return json(200, { evento_id: eventoId, fecha, hecho: true });
    }

    return json(405, { error: `Método ${request.method} no soportado en /api/cumplimientos` });
  } catch (error) {
    console.error('[cumplimientos] Error:', error.message);
    return json(500, { error: 'Error interno consultando cumplimientos.' });
  }
}

export const config = { path: '/api/cumplimientos' };