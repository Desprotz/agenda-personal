// netlify/functions/notas.js
// API de la tabla `notas` (+ notas_imagenes / notas_audio), consumida por
// js/services/notasService.js.
//
// GET    /api/notas                    -> lista notas (más recientes primero).
//   ?fecha=YYYY-MM-DD                     filtra por fecha exacta.
//   ?evento_id=X                          filtra por evento vinculado.
//   ?etiqueta_id=X                        filtra por etiqueta.
//   ?q=texto                              busca en título y contenido (LIKE).
//   (los filtros se pueden combinar, se aplican todos con AND)
// POST   /api/notas   { titulo?, contenido?, fecha?, evento_id?, etiqueta_id?,
//                        imagenes?: [{url_storage, orden}],
//                        audio?: [{url_storage, duracion_segundos}] }
// PUT    /api/notas/:id  -> igual que POST pero parcial. Si se manda la llave
//                           `imagenes` o `audio` (aunque sea arreglo vacío),
//                           se reemplaza todo el set anterior (y se borran del
//                           storage las que ya no queden referenciadas).
// DELETE /api/notas/:id  -> borra la nota; antes borra del storage (Netlify
//                           Blobs) las imágenes/audio que tenía (best-effort:
//                           si falla borrar un blob, se sigue con el resto y
//                           con el borrado de la fila igual, para no dejar
//                           una nota "atascada" por un blob huérfano).
//
// Fase 4 (ver PROYECTO.md sección 6). Formato de respuesta: siempre Response
// real vía json() de _db.js, igual que el resto de las funciones.

import { getStore } from '@netlify/blobs';
import { getDb, json } from './_db.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function idDesdeRuta(request, context) {
  if (context?.params?.id) return context.params.id;
  const url = new URL(request.url);
  const partes = url.pathname.split('/').filter(Boolean); // ['api', 'notas', ':id'?]
  return partes[2] || null;
}

/** Trae imagenes/audio de un conjunto de notas y las agrupa por nota_id. */
async function cargarAdjuntos(db, notaIds) {
  if (notaIds.length === 0) return { imagenesPorNota: new Map(), audioPorNota: new Map() };

  const placeholders = notaIds.map(() => '?').join(',');

  const [imagenes, audio] = await Promise.all([
    db.execute({
      sql: `select id, nota_id, url_storage, orden from notas_imagenes
            where nota_id in (${placeholders}) order by orden asc`,
      args: notaIds,
    }),
    db.execute({
      sql: `select id, nota_id, url_storage, duracion_segundos, created_at from notas_audio
            where nota_id in (${placeholders}) order by created_at asc`,
      args: notaIds,
    }),
  ]);

  const imagenesPorNota = new Map();
  for (const fila of imagenes.rows) {
    if (!imagenesPorNota.has(fila.nota_id)) imagenesPorNota.set(fila.nota_id, []);
    imagenesPorNota.get(fila.nota_id).push(fila);
  }

  const audioPorNota = new Map();
  for (const fila of audio.rows) {
    if (!audioPorNota.has(fila.nota_id)) audioPorNota.set(fila.nota_id, []);
    audioPorNota.get(fila.nota_id).push(fila);
  }

  return { imagenesPorNota, audioPorNota };
}

function ensamblarNota(fila, imagenesPorNota, audioPorNota) {
  return {
    ...fila,
    imagenes: imagenesPorNota.get(fila.id) || [],
    audio: audioPorNota.get(fila.id) || [],
  };
}

/** Borra del storage (Netlify Blobs) una lista de keys, sin tirar si alguna falla. */
async function borrarBlobs(keys) {
  if (keys.length === 0) return;
  const store = getStore('notas-media');
  await Promise.all(
    keys.map((key) =>
      store.delete(key).catch((error) => {
        console.error(`[notas] No se pudo borrar el blob "${key}":`, error.message);
      })
    )
  );
}

/** Normaliza y valida el body de creación/edición. */
function validarNota(datos, { parcial = false } = {}) {
  const errores = [];
  const limpio = {};

  if (datos.titulo !== undefined) {
    const titulo = datos.titulo ? String(datos.titulo).trim() : '';
    if (titulo.length > 120) errores.push('El título es demasiado largo (máx. 120 caracteres).');
    limpio.titulo = titulo || null;
  }

  if (datos.contenido !== undefined) {
    limpio.contenido = datos.contenido ? String(datos.contenido).trim() : null;
  }

  if (datos.fecha !== undefined) {
    const fecha = datos.fecha || null;
    if (fecha && !FECHA_RE.test(fecha)) errores.push('fecha debe tener formato YYYY-MM-DD.');
    limpio.fecha = fecha;
  }

  if (datos.evento_id !== undefined) limpio.evento_id = datos.evento_id || null;
  if (datos.etiqueta_id !== undefined) limpio.etiqueta_id = datos.etiqueta_id || null;

  // Una nota necesita al menos un contenido: texto, imagen o audio.
  if (!parcial) {
    const tieneTexto = Boolean((limpio.titulo || '').trim() || (limpio.contenido || '').trim());
    const tieneImagenes = Array.isArray(datos.imagenes) && datos.imagenes.length > 0;
    const tieneAudio = Array.isArray(datos.audio) && datos.audio.length > 0;
    if (!tieneTexto && !tieneImagenes && !tieneAudio) {
      errores.push('La nota necesita al menos texto, una imagen o un audio.');
    }
  }

  if (datos.imagenes !== undefined) {
    if (!Array.isArray(datos.imagenes)) {
      errores.push('imagenes debe ser un arreglo.');
    } else {
      const validas = datos.imagenes.every((img) => img && typeof img.url_storage === 'string' && img.url_storage);
      if (!validas) errores.push('Cada imagen necesita url_storage.');
    }
  }

  if (datos.audio !== undefined) {
    if (!Array.isArray(datos.audio)) {
      errores.push('audio debe ser un arreglo.');
    } else {
      const validos = datos.audio.every((a) => a && typeof a.url_storage === 'string' && a.url_storage);
      if (!validos) errores.push('Cada audio necesita url_storage.');
    }
  }

  return { errores, limpio };
}

async function insertarAdjuntos(db, notaId, imagenes, audio) {
  if (Array.isArray(imagenes)) {
    for (let i = 0; i < imagenes.length; i++) {
      await db.execute({
        sql: 'insert into notas_imagenes (id, nota_id, url_storage, orden) values (?, ?, ?, ?)',
        args: [crypto.randomUUID(), notaId, imagenes[i].url_storage, imagenes[i].orden ?? i],
      });
    }
  }
  if (Array.isArray(audio)) {
    for (const a of audio) {
      await db.execute({
        sql: 'insert into notas_audio (id, nota_id, url_storage, duracion_segundos) values (?, ?, ?, ?)',
        args: [crypto.randomUUID(), notaId, a.url_storage, a.duracion_segundos ?? null],
      });
    }
  }
}

/** Reemplaza el set de imágenes o audio de una nota, borrando del storage lo que sobra. */
async function reemplazarAdjuntos(db, notaId, tabla, nuevosRegistros, insertarUno) {
  const actuales = await db.execute({
    sql: `select id, url_storage from ${tabla} where nota_id = ?`,
    args: [notaId],
  });

  await db.execute({ sql: `delete from ${tabla} where nota_id = ?`, args: [notaId] });
  await borrarBlobs(actuales.rows.map((f) => f.url_storage));

  for (let i = 0; i < nuevosRegistros.length; i++) {
    await insertarUno(nuevosRegistros[i], i);
  }
}

export default async function handler(request, context) {
  const db = getDb();
  const id = idDesdeRuta(request, context);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const fecha = url.searchParams.get('fecha');
      const eventoId = url.searchParams.get('evento_id');
      const etiquetaId = url.searchParams.get('etiqueta_id');
      const q = url.searchParams.get('q');

      if (fecha && !FECHA_RE.test(fecha)) return json(400, { error: 'fecha debe tener formato YYYY-MM-DD.' });

      const condiciones = [];
      const args = [];
      if (fecha) { condiciones.push('fecha = ?'); args.push(fecha); }
      if (eventoId) { condiciones.push('evento_id = ?'); args.push(eventoId); }
      if (etiquetaId) { condiciones.push('etiqueta_id = ?'); args.push(etiquetaId); }
      if (q) { condiciones.push('(titulo like ? or contenido like ?)'); args.push(`%${q}%`, `%${q}%`); }

      const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';
      const resultado = await db.execute({
        sql: `select id, titulo, contenido, fecha, evento_id, etiqueta_id, created_at
              from notas ${where} order by fecha desc, created_at desc`,
        args,
      });

      const notaIds = resultado.rows.map((f) => f.id);
      const { imagenesPorNota, audioPorNota } = await cargarAdjuntos(db, notaIds);
      const notas = resultado.rows.map((fila) => ensamblarNota(fila, imagenesPorNota, audioPorNota));

      return json(200, { notas });
    }

    if (request.method === 'POST') {
      const cuerpo = await request.json().catch(() => ({}));
      const { errores, limpio } = validarNota(cuerpo);
      if (errores.length) return json(400, { error: errores.join(' ') });

      const nuevoId = crypto.randomUUID();
      await db.execute({
        sql: `insert into notas (id, titulo, contenido, fecha, evento_id, etiqueta_id)
              values (?, ?, ?, coalesce(?, date('now')), ?, ?)`,
        args: [
          nuevoId,
          limpio.titulo ?? null,
          limpio.contenido ?? null,
          limpio.fecha ?? null,
          limpio.evento_id ?? null,
          limpio.etiqueta_id ?? null,
        ],
      });

      await insertarAdjuntos(db, nuevoId, cuerpo.imagenes, cuerpo.audio);

      const resultado = await db.execute({ sql: 'select * from notas where id = ?', args: [nuevoId] });
      const { imagenesPorNota, audioPorNota } = await cargarAdjuntos(db, [nuevoId]);
      return json(201, { nota: ensamblarNota(resultado.rows[0], imagenesPorNota, audioPorNota) });
    }

    if (request.method === 'PUT') {
      if (!id) return json(400, { error: 'Falta el id de la nota en la ruta.' });

      const actual = await db.execute({ sql: 'select * from notas where id = ?', args: [id] });
      if (!actual.rows[0]) return json(404, { error: 'No existe una nota con ese id.' });

      const cuerpo = await request.json().catch(() => ({}));
      const { errores, limpio } = validarNota(cuerpo, { parcial: true });
      if (errores.length) return json(400, { error: errores.join(' ') });

      if (Object.keys(limpio).length > 0) {
        const sets = Object.keys(limpio).map((campo) => `${campo} = ?`).join(', ');
        const args = [...Object.values(limpio), id];
        await db.execute({ sql: `update notas set ${sets} where id = ?`, args });
      }

      if (cuerpo.imagenes !== undefined) {
        await reemplazarAdjuntos(db, id, 'notas_imagenes', cuerpo.imagenes, (img, i) =>
          db.execute({
            sql: 'insert into notas_imagenes (id, nota_id, url_storage, orden) values (?, ?, ?, ?)',
            args: [crypto.randomUUID(), id, img.url_storage, img.orden ?? i],
          })
        );
      }
      if (cuerpo.audio !== undefined) {
        await reemplazarAdjuntos(db, id, 'notas_audio', cuerpo.audio, (a) =>
          db.execute({
            sql: 'insert into notas_audio (id, nota_id, url_storage, duracion_segundos) values (?, ?, ?, ?)',
            args: [crypto.randomUUID(), id, a.url_storage, a.duracion_segundos ?? null],
          })
        );
      }

      const actualizado = await db.execute({ sql: 'select * from notas where id = ?', args: [id] });
      const { imagenesPorNota, audioPorNota } = await cargarAdjuntos(db, [id]);
      return json(200, { nota: ensamblarNota(actualizado.rows[0], imagenesPorNota, audioPorNota) });
    }

    if (request.method === 'DELETE') {
      if (!id) return json(400, { error: 'Falta el id de la nota en la ruta.' });

      const [imagenes, audio] = await Promise.all([
        db.execute({ sql: 'select url_storage from notas_imagenes where nota_id = ?', args: [id] }),
        db.execute({ sql: 'select url_storage from notas_audio where nota_id = ?', args: [id] }),
      ]);
      await borrarBlobs([...imagenes.rows, ...audio.rows].map((f) => f.url_storage));

      const resultado = await db.execute({ sql: 'delete from notas where id = ?', args: [id] });
      if (resultado.rowsAffected === 0) return json(404, { error: 'No existe una nota con ese id.' });

      return json(200, { ok: true });
    }

    return json(405, { error: `Método ${request.method} no soportado en /api/notas` });
  } catch (error) {
    console.error('[notas] Error:', error.message);
    return json(500, { error: 'Error interno consultando notas.' });
  }
}

export const config = { path: ['/api/notas', '/api/notas/:id'] };
