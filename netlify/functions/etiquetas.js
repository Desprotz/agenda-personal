// netlify/functions/etiquetas.js
// API de la tabla `etiquetas`, consumida por js/services/etiquetasService.js.
// GET    /api/etiquetas          -> listar todas (orden alfabético)
// POST   /api/etiquetas          -> crear { nombre, color }
// PUT    /api/etiquetas/:id      -> actualizar { nombre?, color? }
// DELETE /api/etiquetas/:id      -> eliminar (eventos/notas que la usaban quedan
//                                   con etiqueta_id = null, ver ON DELETE SET NULL
//                                   en turso/schema.sql)
//
// Fase 3 (ver PROYECTO.md sección 6). Sigue el formato de respuesta corregido
// en la Fase 2: siempre `Response` real vía json() de _db.js, nunca el objeto
// {statusCode, headers, body} del formato viejo de Netlify Functions.

import { getDb, json } from './_db.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function idDesdeRuta(request, context) {
  if (context?.params?.id) return context.params.id;
  const url = new URL(request.url);
  const partes = url.pathname.split('/').filter(Boolean); // ['api', 'etiquetas', ':id'?]
  return partes[2] || null;
}

function validarEtiqueta({ nombre, color }, { parcial = false } = {}) {
  if (!parcial || nombre !== undefined) {
    if (typeof nombre !== 'string' || nombre.trim().length === 0) {
      return 'El nombre de la etiqueta es obligatorio.';
    }
    if (nombre.trim().length > 40) {
      return 'El nombre de la etiqueta es demasiado largo (máx. 40 caracteres).';
    }
  }
  if (!parcial || color !== undefined) {
    if (typeof color !== 'string' || !HEX_RE.test(color)) {
      return 'El color debe ser un hex válido, ej. #E8A33D.';
    }
  }
  return null;
}

export default async function handler(request, context) {
  const db = getDb();
  const id = idDesdeRuta(request, context);

  try {
    if (request.method === 'GET') {
      const resultado = await db.execute(
        'select id, nombre, color, created_at from etiquetas order by nombre collate nocase asc'
      );
      return json(200, { etiquetas: resultado.rows });
    }

    if (request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const nombre = (cuerpo.nombre || '').trim();
      const color = (cuerpo.color || '').trim();

      const error = validarEtiqueta({ nombre, color });
      if (error) return json(400, { error });

      const nuevoId = crypto.randomUUID();
      await db.execute({
        sql: 'insert into etiquetas (id, nombre, color) values (?, ?, ?)',
        args: [nuevoId, nombre, color],
      });

      const resultado = await db.execute({
        sql: 'select id, nombre, color, created_at from etiquetas where id = ?',
        args: [nuevoId],
      });
      return json(201, { etiqueta: resultado.rows[0] });
    }

    if (request.method === 'PUT') {
      if (!id) return json(400, { error: 'Falta el id de la etiqueta en la ruta.' });

      const cuerpo = await request.json().catch(() => ({}));
      const cambios = {};
      if (cuerpo.nombre !== undefined) cambios.nombre = String(cuerpo.nombre).trim();
      if (cuerpo.color !== undefined) cambios.color = String(cuerpo.color).trim();

      const error = validarEtiqueta(cambios, { parcial: true });
      if (error) return json(400, { error });
      if (Object.keys(cambios).length === 0) {
        return json(400, { error: 'No se enviaron cambios (nombre y/o color).' });
      }

      const sets = Object.keys(cambios).map((campo) => `${campo} = ?`).join(', ');
      const args = [...Object.values(cambios), id];
      const resultado = await db.execute({
        sql: `update etiquetas set ${sets} where id = ?`,
        args,
      });

      if (resultado.rowsAffected === 0) {
        return json(404, { error: 'No existe una etiqueta con ese id.' });
      }

      const actualizada = await db.execute({
        sql: 'select id, nombre, color, created_at from etiquetas where id = ?',
        args: [id],
      });
      return json(200, { etiqueta: actualizada.rows[0] });
    }

    if (request.method === 'DELETE') {
      if (!id) return json(400, { error: 'Falta el id de la etiqueta en la ruta.' });

      const resultado = await db.execute({
        sql: 'delete from etiquetas where id = ?',
        args: [id],
      });

      if (resultado.rowsAffected === 0) {
        return json(404, { error: 'No existe una etiqueta con ese id.' });
      }
      return json(200, { ok: true });
    }

    return json(405, { error: `Método ${request.method} no soportado en /api/etiquetas` });
  } catch (error) {
    console.error('[etiquetas] Error:', error.message);
    return json(500, { error: 'Error interno consultando etiquetas.' });
  }
}

export const config = { path: ['/api/etiquetas', '/api/etiquetas/:id'] };