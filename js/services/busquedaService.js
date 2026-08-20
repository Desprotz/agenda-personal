// services/busquedaService.js
// Buscador global: busca en `eventos` y `notas` a la vez.
//
// Notas: el filtrado por texto ya lo resuelve el backend (?q=... en
// netlify/functions/notas.js, LIKE sobre título/contenido) — se reutiliza
// notasService.listarNotas({ q }) tal cual.
//
// Eventos: no existe (todavía) un parámetro `q` en netlify/functions/eventos.js,
// y la cantidad de eventos de una agenda personal es pequeña, así que se trae
// la lista completa (agendaService.listarEventos()) y se filtra en el cliente
// por título/descripción. Si el proyecto llegara a crecer mucho, este es el
// punto donde migrar a un parámetro `q` real en la Function, sin cambiar la
// firma de `buscar()`.

import { listarEventos } from './agendaService.js';
import { listarNotas } from './notasService.js';

/**
 * Busca `query` en eventos (título/descripción) y notas (título/contenido,
 * vía la API). Devuelve { eventos: [...], notas: [...] }, ambos arreglos
 * vacíos si `query` está vacío o solo tiene espacios.
 */
export async function buscar(query) {
  const termino = (query || '').trim();
  if (!termino) return { eventos: [], notas: [] };

  const terminoNormalizado = termino.toLowerCase();

  const [todosLosEventos, notas] = await Promise.all([
    listarEventos(),
    listarNotas({ q: termino }),
  ]);

  const eventos = todosLosEventos.filter((evento) => {
    const titulo = (evento.titulo || '').toLowerCase();
    const descripcion = (evento.descripcion || '').toLowerCase();
    return titulo.includes(terminoNormalizado) || descripcion.includes(terminoNormalizado);
  });

  return { eventos, notas };
}
