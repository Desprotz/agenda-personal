// components/checklistHoy.js
// Vista "Hoy" (index.html): horario del día con checklist "hecho hoy" para
// tareas recurrentes (racha incluida) — parte de la Fase 3, ver PROYECTO.md
// sección 6. Solo toca la sección "Horario de hoy"; "Últimas notas" sigue
// siendo maqueta estática hasta la Fase 4.

import { iniciarDia, formatearFechaISO, formatearDiasSemana } from '../utils/fechas.js';
import * as agendaService from '../services/agendaService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import * as cumplimientoService from '../services/cumplimientoService.js';
import { initModalEvento, abrirParaCrear, abrirParaEditar } from './modalEvento.js';

let etiquetasPorId = new Map();

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function estiloChip(etiqueta) {
  return etiqueta ? `style="--chip-color: ${etiqueta.color}"` : '';
}

async function renderItem(ev, hoy) {
  const etiqueta = etiquetasPorId.get(ev.etiqueta_id) || null;
  const esRecurrente = agendaService.esRecurrente(ev);

  let hecho = false;
  let racha = 0;
  if (esRecurrente) {
    const cumplimientos = await cumplimientoService.listarCumplimientosDeEvento(ev.id);
    hecho = cumplimientos.some((c) => c.fecha === formatearFechaISO(hoy) && c.hecho);
    racha = cumplimientoService.calcularRacha(ev, cumplimientos, hoy);
  }

  const meta = agendaService.describirRecurrencia(ev, hoy, formatearDiasSemana);
  const chipHtml = etiqueta
    ? `<span class="chip" ${estiloChip(etiqueta)}>${escaparHtml(etiqueta.nombre)}</span>`
    : '';

  const checkHtml = esRecurrente
    ? `<button class="task-check" data-done="${hecho}" data-evento-id="${ev.id}"
         aria-label="${hecho ? 'Marcar como no hecho' : 'Marcar como hecho'}"
         title="${hecho ? 'Hecho hoy' : 'Marcar hecho'}">${hecho ? '✓' : ''}</button>`
    : '';

  return { hecho, racha, esRecurrente, html: `
    <div class="hoy-item${hecho ? ' hoy-item--done' : ''}" data-evento-id="${ev.id}">
      <span class="hoy-item__time">${ev.hora_inicio || '·'}</span>
      <div class="hoy-item__body">
        <div class="hoy-item__meta">
          ${checkHtml}
          <span class="hoy-item__title">${escaparHtml(ev.titulo)}</span>
        </div>
        <div class="hoy-item__meta">
          ${chipHtml}
          <span class="text-meta">${meta}</span>
        </div>
      </div>
    </div>
  `};
}

async function marcarDesdeChecklist(eventoId, hoy, marcarComo) {
  await cumplimientoService.marcarHecho(eventoId, hoy, marcarComo);
  await cargarHoy();
}

async function cargarHoy() {
  const contenedor = document.getElementById('lista-horario-hoy');
  const badge = document.getElementById('racha-badge');
  if (!contenedor) return;

  try {
    const hoy = iniciarDia(new Date());
    const [eventos, etiquetas] = await Promise.all([
      agendaService.listarEventos(),
      etiquetasService.listarEtiquetas(),
    ]);
    etiquetasPorId = new Map(etiquetas.map((et) => [et.id, et]));

    const ocurrencias = agendaService.eventosParaFecha(eventos, hoy);

    if (ocurrencias.length === 0) {
      contenedor.innerHTML = '<div class="empty-state">sin actividades para hoy — toca "+ Actividad" para agregar una</div>';
      badge.hidden = true;
      return;
    }

    const items = await Promise.all(ocurrencias.map((ev) => renderItem(ev, hoy)));
    contenedor.innerHTML = items.map((it) => it.html).join('');

    const mejorRacha = Math.max(0, ...items.filter((it) => it.esRecurrente).map((it) => it.racha));
    const hayRecurrentes = items.some((it) => it.esRecurrente);
    if (hayRecurrentes) {
      badge.hidden = false;
      badge.textContent = `racha: ${mejorRacha} ${mejorRacha === 1 ? 'día' : 'días'}`;
    } else {
      badge.hidden = true;
    }

    contenedor.querySelectorAll('.task-check').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const yaHecho = btn.dataset.done === 'true';
        marcarDesdeChecklist(btn.dataset.eventoId, hoy, !yaHecho);
      });
    });

    contenedor.querySelectorAll('.hoy-item').forEach((item) => {
      item.addEventListener('click', () => {
        const ev = eventos.find((e) => e.id === item.dataset.eventoId);
        if (ev) abrirParaEditar(ev);
      });
    });
  } catch (error) {
    console.error('[checklistHoy] No se pudo cargar el horario de hoy:', error.message);
    contenedor.innerHTML = `<div class="empty-state">no se pudo cargar el horario de hoy — ${error.message}</div>`;
    badge.hidden = true;
  }
}

function inicializar() {
  const contenedor = document.getElementById('lista-horario-hoy');
  if (!contenedor) return; // esta página no es index.html (Hoy)

  initModalEvento({
    onGuardado: () => cargarHoy(),
    onEliminado: () => cargarHoy(),
  });

  document.getElementById('btn-nueva-actividad')?.addEventListener('click', () => {
    abrirParaCrear(new Date());
  });

  cargarHoy();
}

document.addEventListener('DOMContentLoaded', inicializar);