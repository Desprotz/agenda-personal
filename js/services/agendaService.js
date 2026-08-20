// services/agendaService.js
// CRUD de la tabla `eventos` (ver PROYECTO.md sección 5), más la lógica de
// expansión de recurrencia que comparten calendario.js (vista Agenda) y
// checklistHoy.js (vista Hoy) para que ambas vistas siempre coincidan.
//
// Usa apiFetch('/eventos', ...) de config/apiClient.js -> netlify/functions/eventos.js.

import { apiFetch } from '../config/apiClient.js';
import { formatearFechaISO } from '../utils/fechas.js';

// ============================================================
// CRUD
// ============================================================

/** Lista todos los eventos "crudos" (sin expandir recurrencia). */
export async function listarEventos() {
  const { eventos } = await apiFetch('/eventos');
  return eventos;
}

/** Crea un evento nuevo. `datos` sigue la forma que arma modalEvento.js (leerFormulario). */
export async function crearEvento(datos) {
  const { evento } = await apiFetch('/eventos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return evento;
}

/** Actualiza (parcialmente) un evento existente. */
export async function actualizarEvento(id, datos) {
  const { evento } = await apiFetch(`/eventos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return evento;
}

/** Elimina un evento (borra en cascada sus cumplimientos, ver schema.sql). */
export async function eliminarEvento(id) {
  return apiFetch(`/eventos/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ============================================================
// Recurrencia
// ============================================================

/** dias_semana llega de la API como texto '1,3,5' o null. */
function diasSemanaComoArray(evento) {
  if (!evento.dias_semana) return [];
  return String(evento.dias_semana)
    .split(',')
    .filter((s) => s !== '')
    .map(Number);
}

/** ¿Es un evento recurrente (se repite en más de un día)? 'puntual' y 'rango' no lo son. */
export function esRecurrente(evento) {
  return evento.tipo === 'diario' || evento.tipo === 'dias_especificos';
}

/**
 * ¿Ocurre `evento` en el día calendario `fecha` (objeto Date, se ignora la hora)?
 * Es la única fuente de verdad sobre recurrencia — la usan tanto el render del
 * calendario como el cálculo de racha (cumplimientoService.calcularRacha).
 */
export function eventoOcurreEnFecha(evento, fecha) {
  const iso = formatearFechaISO(fecha);

  switch (evento.tipo) {
    case 'diario':
      if (evento.fecha_inicio && iso < evento.fecha_inicio) return false;
      return true;

    case 'dias_especificos': {
      if (evento.fecha_inicio && iso < evento.fecha_inicio) return false;
      const dias = diasSemanaComoArray(evento);
      return dias.includes(fecha.getDay());
    }

    case 'puntual':
      return Boolean(evento.fecha_inicio) && evento.fecha_inicio === iso;

    case 'rango': {
      if (!evento.fecha_inicio || !evento.fecha_fin) return false;
      return iso >= evento.fecha_inicio && iso <= evento.fecha_fin;
    }

    default:
      return false;
  }
}

/**
 * Filtra `eventos` (lista cruda de la API) a los que ocurren en `fecha`.
 * Devuelve los eventos tal cual (mismo shape que la fila de la API) para que
 * quien la use pueda seguir accediendo a hora_inicio, etiqueta_id, etc.
 */
export function eventosParaFecha(eventos, fecha) {
  return eventos.filter((ev) => eventoOcurreEnFecha(ev, fecha));
}

/**
 * Descripción corta y legible de cuándo ocurre un evento, para mostrar como
 * texto secundario en la vista Hoy (ej. "todos los días", "Lun · Mié · Vie",
 * "hasta el 30 de agosto"). `formatearDiasSemana` se recibe por parámetro
 * (viene de utils/fechas.js) para no crear una dependencia circular.
 */
export function describirRecurrencia(evento, fecha, formatearDiasSemana) {
  switch (evento.tipo) {
    case 'diario':
      return 'todos los días';
    case 'dias_especificos':
      return formatearDiasSemana(diasSemanaComoArray(evento));
    case 'puntual':
      return 'actividad puntual';
    case 'rango':
      return evento.fecha_fin ? `hasta ${evento.fecha_fin}` : 'rango de fechas';
    default:
      return '';
  }
}
