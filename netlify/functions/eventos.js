// netlify/functions/eventos.js
// API de la tabla `eventos`, consumida por js/services/agendaService.js.
// GET    /api/eventos       -> listar todos los eventos "crudos" (sin expandir
//                              recurrencia; eso lo hace el frontend, ver
//                              agendaService.js -> ocurrenciasParaFecha, para
//                              no duplicar esa lógica entre servidor y cliente).
// POST   /api/eventos       -> crear evento
// PUT    /api/eventos/:id   -> actualizar evento
// DELETE /api/eventos/:id   -> eliminar evento (borra en cascada sus
//                              cumplimientos, ver turso/schema.sql)
//
// Fase 3 (ver PROYECTO.md sección 6). Formato de respuesta: siempre Response
// real vía json() de _db.js (bug corregido en la Fase 2).

import { getDb, json } from './_db.js';

const TIPOS_VALIDOS = ['diario', 'dias_especificos', 'puntual', 'rango'];
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Netlify Functions v2 expone los parámetros de `config.path` (ej. ":id") en
// `context.params`. Se usa eso como fuente principal y, por si acaso, se cae
// de vuelta a parsear el pathname manualmente (mismo resultado, más robusto
// ante cambios de runtime).
function idDesdeRuta(request, context) {
  if (context?.params?.id) return context.params.id;
  const url = new URL(request.url);
  const partes = url.pathname.split('/').filter(Boolean); // ['api', 'eventos', ':id'?]
  return partes[2] || null;
}

/** Normaliza y valida el body de creación/edición según el tipo de evento. */
function validarEvento(datos, { parcial = false } = {}) {
  const errores = [];
  const limpio = {};

  // --- título ---
  if (!parcial || datos.titulo !== undefined) {
    const titulo = String(datos.titulo || '').trim();
    if (!titulo) errores.push('El título es obligatorio.');
    else if (titulo.length > 120) errores.push('El título es demasiado largo (máx. 120 caracteres).');
    limpio.titulo = titulo;
  }

  // --- descripción (opcional siempre) ---
  if (datos.descripcion !== undefined) {
    limpio.descripcion = datos.descripcion ? String(datos.descripcion).trim() : null;
  }

  // --- tipo ---
  const tipo = datos.tipo !== undefined ? datos.tipo : undefined;
  if (!parcial || tipo !== undefined) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      errores.push(`El tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`);
    }
    limpio.tipo = tipo;
  }

  // --- horas (opcionales solo para 'rango' sin hora fija; requeridas en los demás) ---
  const horaInicio = datos.hora_inicio;
  const horaFin = datos.hora_fin;
  if (horaInicio !== undefined && horaInicio !== null && horaInicio !== '') {
    if (!HORA_RE.test(horaInicio)) errores.push('hora_inicio debe tener formato HH:MM.');
  }
  if (horaFin !== undefined && horaFin !== null && horaFin !== '') {
    if (!HORA_RE.test(horaFin)) errores.push('hora_fin debe tener formato HH:MM.');
  }
  if (horaInicio && horaFin && HORA_RE.test(horaInicio) && HORA_RE.test(horaFin) && horaFin <= horaInicio) {
    errores.push('hora_fin debe ser posterior a hora_inicio.');
  }
  if (datos.hora_inicio !== undefined) limpio.hora_inicio = horaInicio || null;
  if (datos.hora_fin !== undefined) limpio.hora_fin = horaFin || null;

  const tipoEfectivo = limpio.tipo ?? datos.tipoActual; // tipoActual: al editar parcialmente, viene del registro existente
  if (tipoEfectivo && tipoEfectivo !== 'rango') {
    // día/diario/puntual/dias_especificos necesitan horario para ubicarse en el timeline
    if ((limpio.hora_inicio === null || limpio.hora_inicio === undefined) && !parcial) {
      errores.push('hora_inicio es obligatoria para este tipo de actividad.');
    }
    if ((limpio.hora_fin === null || limpio.hora_fin === undefined) && !parcial) {
      errores.push('hora_fin es obligatoria para este tipo de actividad.');
    }
  }

  // --- dias_semana (solo 'dias_especificos') ---
  if (datos.dias_semana !== undefined) {
    if (Array.isArray(datos.dias_semana)) {
      const validos = datos.dias_semana.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!validos) errores.push('dias_semana debe contener enteros entre 0 (domingo) y 6 (sábado).');
      limpio.dias_semana = datos.dias_semana.length ? datos.dias_semana.join(',') : null;
    } else if (datos.dias_semana === null) {
      limpio.dias_semana = null;
    } else {
      errores.push('dias_semana debe ser un arreglo de números.');
    }
  }
  if (tipoEfectivo === 'dias_especificos' && !parcial) {
    if (!limpio.dias_semana) errores.push('dias_semana es obligatorio para el tipo "dias_especificos".');
  }

  // --- fecha_inicio / fecha_fin ---
  if (datos.fecha_inicio !== undefined) {
    if (datos.fecha_inicio && !FECHA_RE.test(datos.fecha_inicio)) {
      errores.push('fecha_inicio debe tener formato YYYY-MM-DD.');
    }
    limpio.fecha_inicio = datos.fecha_inicio || null;
  }
  if (datos.fecha_fin !== undefined) {
    if (datos.fecha_fin && !FECHA_RE.test(datos.fecha_fin)) {
      errores.push('fecha_fin debe tener formato YYYY-MM-DD.');
    }
    limpio.fecha_fin = datos.fecha_fin || null;
  }
  if (limpio.fecha_inicio && limpio.fecha_fin && limpio.fecha_fin < limpio.fecha_inicio) {
    errores.push('fecha_fin no puede ser anterior a fecha_inicio.');
  }
  if ((tipoEfectivo === 'puntual' || tipoEfectivo === 'rango') && !parcial) {
    if (!limpio.fecha_inicio) errores.push('fecha_inicio es obligatoria para este tipo de actividad.');
  }
  if (tipoEfectivo === 'rango' && !parcial) {
    if (!limpio.fecha_fin) errores.push('fecha_fin es obligatoria para una actividad de tipo "rango".');
  }

  // --- etiqueta / alarma ---
  if (datos.etiqueta_id !== undefined) limpio.etiqueta_id = datos.etiqueta_id || null;
  if (datos.tiene_alarma !== undefined) limpio.tiene_alarma = datos.tiene_alarma ? 1 : 0;
  if (datos.minutos_antes_alarma !== undefined) {
    const min = datos.minutos_antes_alarma;
    if (min !== null && (!Number.isInteger(min) || min < 0)) {
      errores.push('minutos_antes_alarma debe ser un entero positivo.');
    }
    limpio.minutos_antes_alarma = min ?? null;
  }

  return { errores, limpio };
}

export default async function handler(request, context) {
  const db = getDb();
  const id = idDesdeRuta(request, context);

  try {
    if (request.method === 'GET') {
      const resultado = await db.execute(
        `select id, titulo, descripcion, tipo, dias_semana, fecha_inicio, fecha_fin,
                hora_inicio, hora_fin, etiqueta_id, tiene_alarma, minutos_antes_alarma, created_at
         from eventos order by created_at asc`
      );
      return json(200, { eventos: resultado.rows });
    }

    if (request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const { errores, limpio } = validarEvento(cuerpo);
      if (errores.length) return json(400, { error: errores.join(' ') });

      const nuevoId = crypto.randomUUID();
      await db.execute({
        sql: `insert into eventos
                (id, titulo, descripcion, tipo, dias_semana, fecha_inicio, fecha_fin,
                 hora_inicio, hora_fin, etiqueta_id, tiene_alarma, minutos_antes_alarma)
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          nuevoId,
          limpio.titulo,
          limpio.descripcion ?? null,
          limpio.tipo,
          limpio.dias_semana ?? null,
          limpio.fecha_inicio ?? null,
          limpio.fecha_fin ?? null,
          limpio.hora_inicio ?? null,
          limpio.hora_fin ?? null,
          limpio.etiqueta_id ?? null,
          limpio.tiene_alarma ?? 0,
          limpio.minutos_antes_alarma ?? null,
        ],
      });

      const resultado = await db.execute({ sql: 'select * from eventos where id = ?', args: [nuevoId] });
      return json(201, { evento: resultado.rows[0] });
    }

    if (request.method === 'PUT') {
      if (!id) return json(400, { error: 'Falta el id del evento en la ruta.' });

      const actual = await db.execute({ sql: 'select * from eventos where id = ?', args: [id] });
      if (!actual.rows[0]) return json(404, { error: 'No existe un evento con ese id.' });

      const cuerpo = await request.json().catch(() => ({}));
      const { errores, limpio } = validarEvento(
        { ...cuerpo, tipoActual: actual.rows[0].tipo },
        { parcial: true }
      );
      if (errores.length) return json(400, { error: errores.join(' ') });
      if (Object.keys(limpio).length === 0) {
        return json(400, { error: 'No se enviaron cambios.' });
      }

      const sets = Object.keys(limpio).map((campo) => `${campo} = ?`).join(', ');
      const args = [...Object.values(limpio), id];
      await db.execute({ sql: `update eventos set ${sets} where id = ?`, args });

      const actualizado = await db.execute({ sql: 'select * from eventos where id = ?', args: [id] });
      return json(200, { evento: actualizado.rows[0] });
    }

    if (request.method === 'DELETE') {
      if (!id) return json(400, { error: 'Falta el id del evento en la ruta.' });

      const resultado = await db.execute({ sql: 'delete from eventos where id = ?', args: [id] });
      if (resultado.rowsAffected === 0) {
        return json(404, { error: 'No existe un evento con ese id.' });
      }
      return json(200, { ok: true });
    }

    return json(405, { error: `Método ${request.method} no soportado en /api/eventos` });
  } catch (error) {
    console.error('[eventos] Error:', error.message);
    return json(500, { error: 'Error interno consultando eventos.' });
  }
}

export const config = { path: ['/api/eventos', '/api/eventos/:id'] };