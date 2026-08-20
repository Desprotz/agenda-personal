// services/cumplimientoService.js
// Maneja la tabla `cumplimientos`: marcar "hecho hoy" en una tarea recurrente
// sin alterar la definición general del evento, y calcular rachas.
// Usa apiFetch('/cumplimientos', ...) de config/apiClient.js -> netlify/functions/cumplimientos.js.

import { apiFetch } from '../config/apiClient.js';
import { formatearFechaISO, sumarDias } from '../utils/fechas.js';
import { eventoOcurreEnFecha } from './agendaService.js';

const TOPE_DIAS_RACHA = 730; // 2 años hacia atrás como máximo, para no iterar sin fin

/** Cumplimientos de un evento específico (para calcular su racha). */
export async function listarCumplimientosDeEvento(eventoId) {
  const { cumplimientos } = await apiFetch(`/cumplimientos?evento_id=${encodeURIComponent(eventoId)}`);
  return cumplimientos;
}

/** Cumplimientos de todos los eventos en una fecha (para pintar los checks de "Hoy"). */
export async function listarCumplimientosDeFecha(fecha) {
  const iso = formatearFechaISO(fecha);
  const { cumplimientos } = await apiFetch(`/cumplimientos?fecha=${iso}`);
  return cumplimientos;
}

/** Marca (o desmarca) un evento como hecho en una fecha concreta. */
export async function marcarHecho(eventoId, fecha, hecho = true) {
  const iso = formatearFechaISO(fecha);
  return apiFetch('/cumplimientos', {
    method: 'POST',
    body: JSON.stringify({ evento_id: eventoId, fecha: iso, hecho }),
  });
}

/**
 * Racha actual de un evento recurrente: días consecutivos "hacia atrás" desde
 * `hastaFecha` (incluida) en los que el evento ocurría y quedó marcado como
 * hecho. Los días en los que el evento simplemente no ocurre (ej. gimnasio en
 * martes cuando es lunes/miércoles/viernes) no rompen la racha, se saltan.
 *
 * `cumplimientos` es la lista cruda que devuelve listarCumplimientosDeEvento().
 */
export function calcularRacha(evento, cumplimientos, hastaFecha = new Date()) {
  const hechos = new Set(
    cumplimientos.filter((c) => c.hecho).map((c) => c.fecha)
  );

  let racha = 0;
  let cursor = new Date(hastaFecha);

  for (let i = 0; i < TOPE_DIAS_RACHA; i++) {
    if (evento.fecha_inicio && formatearFechaISO(cursor) < evento.fecha_inicio) break;

    if (eventoOcurreEnFecha(evento, cursor)) {
      if (hechos.has(formatearFechaISO(cursor))) {
        racha += 1;
      } else if (i === 0) {
        // El día de hoy (i === 0) todavía puede marcarse más tarde — no
        // cuenta para la racha, pero tampoco la rompe. Sí rompe la racha
        // cualquier día anterior que haya quedado sin marcar.
      } else {
        break;
      }
    }
    cursor = sumarDias(cursor, -1);
  }

  return racha;
}