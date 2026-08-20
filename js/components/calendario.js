// components/calendario.js
// Renderiza la vista Agenda en sus 3 modos: día, semana y mes.
//
// Fase 3: los eventos ya no salen de un "pool" de ejemplo (POOL_EVENTOS,
// eliminado en esta fase) — vienen de verdad de Turso vía agendaService.js.
// La recurrencia (diario / dias_especificos / puntual / rango) se expande en
// el cliente con agendaService.eventosParaFecha(), la misma función que usa
// la vista Hoy, para que ambas coincidan siempre.

import {
  formatearHora,
  formatearFechaLarga,
  formatearRangoSemana,
  formatearMesAnio,
  minutosDesdeMedianoche,
  esMismoDia,
  iniciarDia,
  inicioDeSemana,
  sumarDias,
  sumarMeses,
  DIAS_CORTOS_LUN,
} from '../utils/fechas.js';
import * as agendaService from '../services/agendaService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import { initModalEvento, abrirParaCrear, abrirParaEditar } from './modalEvento.js';

const HORA_INICIO = 6;   // 06:00
const HORA_FIN = 23;     // 23:00
const ALTO_FILA_DIA = 64;     // debe coincidir con --hour row height en agenda.css (vista día)
const ALTO_FILA_SEMANA = 48;  // debe coincidir con --week-row-height en agenda.css

// --- Estado de la vista ---
const estado = {
  vista: 'dia',        // 'dia' | 'semana' | 'mes'
  fechaActual: new Date(),
  etiquetasActivas: new Set(), // vacío = mostrar todas
  eventos: [],          // filas crudas de la tabla `eventos`
  etiquetas: [],         // filas crudas de la tabla `etiquetas`
};

function etiquetaPorId(id) {
  return estado.etiquetas.find((et) => et.id === id) || null;
}

function minutosDesdeTexto(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Eventos que ocurren en `fecha`, ya filtrados por etiqueta activa y
 * "preparados" para render: hora garantizada (los 'rango' sin horario se
 * marcan todoElDia y se tratan como si cubrieran el día completo visible).
 */
function obtenerEventosParaFecha(fecha) {
  const ocurrencias = agendaService.eventosParaFecha(estado.eventos, fecha);

  return ocurrencias
    .filter((ev) => estado.etiquetasActivas.size === 0 || estado.etiquetasActivas.has(ev.etiqueta_id))
    .map((ev) => ({
      id: ev.id,
      titulo: ev.titulo,
      inicio: ev.hora_inicio || `${String(HORA_INICIO).padStart(2, '0')}:00`,
      fin: ev.hora_fin || `${String(HORA_FIN).padStart(2, '0')}:59`,
      todoElDia: !ev.hora_inicio,
      etiqueta: etiquetaPorId(ev.etiqueta_id),
      raw: ev,
    }));
}

function estiloColor(variable, etiqueta) {
  return etiqueta ? `${variable}: ${etiqueta.color};` : '';
}

// ============================================================
// Vista DÍA
// ============================================================
function renderGutterDia(contenedor) {
  contenedor.innerHTML = '';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const div = document.createElement('div');
    div.className = 'timeline__hour-label';
    div.textContent = `${String(h).padStart(2, '0')}:00`;
    contenedor.appendChild(div);
  }
}

function renderFilasDia(contenedor) {
  contenedor.innerHTML = '';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const fila = document.createElement('div');
    fila.className = 'timeline__hour-row';
    fila.dataset.hora = h;
    contenedor.appendChild(fila);
  }
}

function renderEventosDia(contenedor, fecha) {
  const inicioTimelineMin = HORA_INICIO * 60;
  obtenerEventosParaFecha(fecha).forEach((ev) => {
    const inicioMin = minutosDesdeTexto(ev.inicio);
    const finMin = minutosDesdeTexto(ev.fin);
    const top = ((inicioMin - inicioTimelineMin) / 60) * ALTO_FILA_DIA;
    const alto = ((finMin - inicioMin) / 60) * ALTO_FILA_DIA;

    const bloque = document.createElement('div');
    bloque.className = `event-block${ev.todoElDia ? ' event-block--todo-el-dia' : ''}`;
    bloque.style.cssText = `top:${top}px; height:${Math.max(alto, 28)}px; ${estiloColor('--block-color', ev.etiqueta)}`;
    bloque.innerHTML = `
      <div class="event-block__title">${ev.titulo}</div>
      <div class="event-block__meta">${ev.todoElDia ? 'todo el día' : `${ev.inicio} – ${ev.fin}`}</div>
    `;
    bloque.addEventListener('click', () => abrirParaEditar(ev.raw));
    contenedor.appendChild(bloque);
  });
}

function renderLineaAhoraDia(contenedor, fecha) {
  const ahora = new Date();
  if (!esMismoDia(ahora, fecha)) return; // solo se dibuja si el día visible es hoy

  const minAhora = minutosDesdeMedianoche(ahora);
  const inicioTimelineMin = HORA_INICIO * 60;
  const finTimelineMin = HORA_FIN * 60 + 60;
  if (minAhora < inicioTimelineMin || minAhora > finTimelineMin) return;

  const top = ((minAhora - inicioTimelineMin) / 60) * ALTO_FILA_DIA;
  const linea = document.createElement('div');
  linea.className = 'now-line';
  linea.style.top = `${top}px`;
  linea.dataset.time = formatearHora(ahora);
  contenedor.appendChild(linea);
}

function renderVistaDia() {
  const gutter = document.getElementById('timeline-gutter');
  const horas = document.getElementById('timeline-hours');
  if (!gutter || !horas) return;

  renderGutterDia(gutter);
  renderFilasDia(horas);
  renderEventosDia(horas, estado.fechaActual);
  renderLineaAhoraDia(horas, estado.fechaActual);
}

// ============================================================
// Vista SEMANA
// ============================================================
function renderVistaSemana() {
  const grid = document.getElementById('week-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const inicioSemana = inicioDeSemana(estado.fechaActual);
  const hoy = new Date();
  const numHoras = HORA_FIN - HORA_INICIO + 1;

  // --- Columna de horas (gutter) ---
  const colGutter = document.createElement('div');
  colGutter.className = 'week-col week-col--gutter';

  const headerGutter = document.createElement('div');
  headerGutter.className = 'week-col__header';
  colGutter.appendChild(headerGutter);

  const horasGutter = document.createElement('div');
  horasGutter.className = 'week-col__hours';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const fila = document.createElement('div');
    fila.className = 'week-col__hour-row';
    fila.textContent = `${String(h).padStart(2, '0')}:00`;
    horasGutter.appendChild(fila);
  }
  colGutter.appendChild(horasGutter);
  grid.appendChild(colGutter);

  // --- 7 columnas de día ---
  for (let i = 0; i < 7; i++) {
    const fechaCol = sumarDias(inicioSemana, i);
    const esHoy = esMismoDia(fechaCol, hoy);

    const col = document.createElement('div');
    col.className = `week-col week-col--dia${esHoy ? ' week-col--hoy' : ''}`;
    col.dataset.fecha = fechaCol.toISOString();

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'week-col__header';
    header.style.cssText = 'width:100%; border:none; cursor:pointer;';
    header.innerHTML = `
      <span class="week-col__header-dia">${DIAS_CORTOS_LUN[i]}</span>
      <span class="week-col__header-num">${fechaCol.getDate()}</span>
    `;
    header.addEventListener('click', () => {
      estado.fechaActual = fechaCol;
      cambiarVista('dia');
    });
    col.appendChild(header);

    const horasCol = document.createElement('div');
    horasCol.className = 'week-col__hours';
    horasCol.style.height = `${numHoras * ALTO_FILA_SEMANA}px`;

    for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
      const fila = document.createElement('div');
      fila.className = 'week-col__hour-row';
      horasCol.appendChild(fila);
    }

    const inicioTimelineMin = HORA_INICIO * 60;
    obtenerEventosParaFecha(fechaCol).forEach((ev) => {
      const inicioMin = minutosDesdeTexto(ev.inicio);
      const finMin = minutosDesdeTexto(ev.fin);
      const top = ((inicioMin - inicioTimelineMin) / 60) * ALTO_FILA_SEMANA;
      const alto = ((finMin - inicioMin) / 60) * ALTO_FILA_SEMANA;

      const bloque = document.createElement('div');
      bloque.className = `week-event${ev.todoElDia ? ' week-event--todo-el-dia' : ''}`;
      bloque.style.cssText = `top:${top}px; height:${Math.max(alto, 20)}px; ${estiloColor('--block-color', ev.etiqueta)}`;
      bloque.innerHTML = `
        <span class="week-event__title">${ev.titulo}</span>
        <span class="week-event__meta">${ev.todoElDia ? 'todo el día' : ev.inicio}</span>
      `;
      bloque.addEventListener('click', (evt) => {
        evt.stopPropagation();
        abrirParaEditar(ev.raw);
      });
      horasCol.appendChild(bloque);
    });

    if (esHoy) {
      const ahora = new Date();
      const minAhora = minutosDesdeMedianoche(ahora);
      const finTimelineMin = HORA_FIN * 60 + 60;
      if (minAhora >= inicioTimelineMin && minAhora <= finTimelineMin) {
        const linea = document.createElement('div');
        linea.className = 'week-now-line';
        linea.style.top = `${((minAhora - inicioTimelineMin) / 60) * ALTO_FILA_SEMANA}px`;
        horasCol.appendChild(linea);
      }
    }

    col.appendChild(horasCol);
    grid.appendChild(col);
  }
}

// ============================================================
// Vista MES
// ============================================================
function renderVistaMes() {
  const weekdaysEl = document.getElementById('month-weekdays');
  const gridEl = document.getElementById('month-grid');
  if (!weekdaysEl || !gridEl) return;

  weekdaysEl.innerHTML = DIAS_CORTOS_LUN.map((d) => `<span>${d}</span>`).join('');
  gridEl.innerHTML = '';

  const hoy = new Date();
  const primerDiaMes = new Date(estado.fechaActual.getFullYear(), estado.fechaActual.getMonth(), 1);
  const inicioCuadricula = inicioDeSemana(primerDiaMes);

  for (let i = 0; i < 42; i++) {
    const fechaCelda = sumarDias(inicioCuadricula, i);
    const fueraDeMes = fechaCelda.getMonth() !== estado.fechaActual.getMonth();
    const esHoy = esMismoDia(fechaCelda, hoy);

    const celda = document.createElement('button');
    celda.type = 'button';
    celda.className = 'month-cell';
    if (fueraDeMes) celda.classList.add('month-cell--fuera-de-mes');
    if (esHoy) celda.classList.add('month-cell--hoy');

    const eventosDia = obtenerEventosParaFecha(fechaCelda);
    // Un punto por etiqueta distinta ese día (o un punto gris si no tiene etiqueta).
    const vistas = new Set();
    const dotsHtml = [];
    eventosDia.forEach((ev) => {
      const clave = ev.etiqueta ? ev.etiqueta.id : 'sin-etiqueta';
      if (vistas.has(clave) || dotsHtml.length >= 4) return;
      vistas.add(clave);
      dotsHtml.push(`<span class="month-cell__dot" style="${estiloColor('--dot-color', ev.etiqueta)}"></span>`);
    });
    const extra = eventosDia.length > 4
      ? `<span class="month-cell__mas">+${eventosDia.length - 4}</span>`
      : '';

    celda.innerHTML = `
      <span class="month-cell__num">${fechaCelda.getDate()}</span>
      <span class="month-cell__dots">${dotsHtml.join('')}${extra}</span>
    `;
    celda.addEventListener('click', () => {
      estado.fechaActual = fechaCelda;
      cambiarVista('dia');
    });

    gridEl.appendChild(celda);
  }
}

// ============================================================
// Filtro por etiqueta (dinámico, viene de la tabla `etiquetas`)
// ============================================================
function renderFiltroEtiquetas() {
  const contenedor = document.getElementById('filtro-etiquetas');
  if (!contenedor) return;

  if (estado.etiquetas.length === 0) {
    contenedor.innerHTML = '<span class="text-meta">Sin etiquetas todavía — créalas desde "+ Actividad".</span>';
    return;
  }

  contenedor.innerHTML = estado.etiquetas.map((et) => `
    <button class="chip" type="button" data-etiqueta-id="${et.id}"
      style="--chip-color: ${et.color}"
      aria-pressed="${estado.etiquetasActivas.has(et.id)}">${escaparHtml(et.nombre)}</button>
  `).join('');

  contenedor.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.etiquetaId;
      const activo = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!activo));
      if (activo) estado.etiquetasActivas.delete(id);
      else estado.etiquetasActivas.add(id);
      renderVistaActual();
    });
  });
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ============================================================
// Encabezado (rango de fecha) + navegación + cambio de vista
// ============================================================
function actualizarEncabezado() {
  const el = document.getElementById('agenda-rango-fecha');
  if (!el) return;

  if (estado.vista === 'dia') {
    el.textContent = formatearFechaLarga(estado.fechaActual);
  } else if (estado.vista === 'semana') {
    const inicio = inicioDeSemana(estado.fechaActual);
    const fin = sumarDias(inicio, 6);
    el.textContent = formatearRangoSemana(inicio, fin);
  } else {
    el.textContent = formatearMesAnio(estado.fechaActual);
  }
}

function renderVistaActual() {
  actualizarEncabezado();
  if (estado.vista === 'dia') renderVistaDia();
  else if (estado.vista === 'semana') renderVistaSemana();
  else renderVistaMes();
}

function cambiarVista(nuevaVista) {
  estado.vista = nuevaVista;

  document.querySelectorAll('.view-switcher__btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.vista === nuevaVista));
  });
  document.querySelectorAll('[data-vista-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.vistaPanel !== nuevaVista;
  });

  renderVistaActual();
}

function navegar(direccion) {
  // direccion: -1 (anterior) o 1 (siguiente)
  if (estado.vista === 'dia') {
    estado.fechaActual = sumarDias(estado.fechaActual, direccion);
  } else if (estado.vista === 'semana') {
    estado.fechaActual = sumarDias(estado.fechaActual, direccion * 7);
  } else {
    estado.fechaActual = sumarMeses(estado.fechaActual, direccion);
  }
  renderVistaActual();
}

function irAHoy() {
  estado.fechaActual = iniciarDia(new Date());
  renderVistaActual();
}

function inicializarControles() {
  document.querySelectorAll('.view-switcher__btn').forEach((btn) => {
    btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
  });

  document.getElementById('nav-anterior')?.addEventListener('click', () => navegar(-1));
  document.getElementById('nav-siguiente')?.addEventListener('click', () => navegar(1));
  document.getElementById('nav-hoy')?.addEventListener('click', irAHoy);

  document.getElementById('btn-nueva-actividad')?.addEventListener('click', () => {
    abrirParaCrear(estado.fechaActual);
  });
}

// ============================================================
// Carga de datos reales (Turso, vía Netlify Functions)
// ============================================================
async function cargarDatos() {
  const contenedor = document.getElementById('vista-dia');
  try {
    const [eventos, etiquetas] = await Promise.all([
      agendaService.listarEventos(),
      etiquetasService.listarEtiquetas(),
    ]);
    estado.eventos = eventos;
    estado.etiquetas = etiquetas;
    renderFiltroEtiquetas();
    renderVistaActual();
  } catch (error) {
    console.error('[calendario] No se pudieron cargar los eventos:', error.message);
    if (contenedor) {
      contenedor.innerHTML = `<div class="empty-state">no se pudieron cargar los eventos — ${error.message}</div>`;
    }
  }
}

function inicializarAgenda() {
  const timeline = document.getElementById('vista-dia');
  if (!timeline) return; // esta página no es agenda.html

  estado.fechaActual = iniciarDia(new Date());
  inicializarControles();

  initModalEvento({
    onGuardado: () => cargarDatos(),
    onEliminado: () => cargarDatos(),
  });

  cargarDatos();
}

document.addEventListener('DOMContentLoaded', inicializarAgenda);