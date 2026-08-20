// components/proximaAlarma.js
// Calcula y actualiza el texto de la franja "próxima alarma"
// (.next-alarm-strip, id="next-alarm-strip") a partir de datos reales, en
// vez del texto fijo de ejemplo que traía desde la Fase 1. Solo corre en las
// páginas que tienen ese widget en el HTML: index.html y pages/agenda.html.
//
// Busca la alarma más próxima entre hoy y los próximos DIAS_A_BUSCAR días
// (no solo hoy — si hoy no queda ninguna, igual tiene sentido mostrar la de
// mañana o pasado en vez de dejar el widget vacío).

import * as agendaService from '../services/agendaService.js';
import {
  iniciarDia, sumarDias, esMismoDia, formatearHora, formatearFechaCorta,
} from '../utils/fechas.js';

const DIAS_A_BUSCAR = 14;
const INTERVALO_REFRESCO_MS = 60_000; // cada minuto es suficiente para un texto informativo

/** Combina una hora "HH:MM" con la fecha (Date) del día que corresponde. */
function horaEnFecha(fecha, horaStr) {
  const [h, m] = horaStr.split(':').map(Number);
  const d = new Date(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Recorre eventos con alarma día por día (desde hoy) y devuelve la próxima
 * ocurrencia futura, o null si no hay ninguna en el horizonte de búsqueda.
 * Como se recorre en orden cronológico, apenas un día produce un candidato
 * ya no hace falta seguir mirando días posteriores.
 */
function calcularProximaAlarma(eventos, ahora) {
  let mejor = null;

  for (let i = 0; i < DIAS_A_BUSCAR; i += 1) {
    const dia = sumarDias(iniciarDia(ahora), i);
    const ocurrencias = agendaService
      .eventosParaFecha(eventos, dia)
      .filter((ev) => ev.tiene_alarma && ev.hora_inicio);

    for (const ev of ocurrencias) {
      const horaEvento = horaEnFecha(dia, ev.hora_inicio);
      const minutosAntes = ev.minutos_antes_alarma || 0;
      const horaAlarma = new Date(horaEvento.getTime() - minutosAntes * 60_000);
      if (horaAlarma < ahora) continue; // ya pasó (aplica sobre todo al día de hoy)

      if (!mejor || horaAlarma < mejor.horaAlarma) {
        mejor = { horaAlarma, horaEvento, evento: ev };
      }
    }

    if (mejor) break;
  }

  return mejor;
}

/** "17:30", "mañana 08:00" o "vie 9 ago · 08:00" según qué tan lejos esté. */
function formatearCuando(horaEvento, ahora) {
  const hoy = iniciarDia(ahora);
  const dia = iniciarDia(horaEvento);
  const horaTxt = formatearHora(horaEvento);

  if (esMismoDia(dia, hoy)) return horaTxt;
  if (esMismoDia(dia, sumarDias(hoy, 1))) return `mañana ${horaTxt}`;
  return `${formatearFechaCorta(dia)} · ${horaTxt}`;
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function actualizar() {
  const strip = document.getElementById('next-alarm-strip');
  const texto = document.getElementById('proxima-alarma-texto');
  if (!strip || !texto) return; // esta página no tiene el widget

  try {
    const eventos = await agendaService.listarEventos();
    const resultado = calcularProximaAlarma(eventos, new Date());

    if (!resultado) {
      strip.hidden = true;
      return;
    }

    strip.hidden = false;
    const cuando = formatearCuando(resultado.horaEvento, new Date());
    texto.innerHTML = `${cuando} · ${escaparHtml(resultado.evento.titulo)}`;
  } catch (error) {
    console.error('[proximaAlarma] No se pudo calcular la próxima alarma:', error.message);
    strip.hidden = true;
  }
}

function inicializar() {
  if (!document.getElementById('next-alarm-strip')) return;
  actualizar();
  setInterval(actualizar, INTERVALO_REFRESCO_MS);
}

document.addEventListener('DOMContentLoaded', inicializar);
