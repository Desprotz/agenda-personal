// components/buscadorGlobal.js
// Buscador global (eventos + notas a la vez), accesible desde el botón ⌕ en
// la tabbar de las 4 páginas. Modal singleton (mismo patrón que
// modalNota.js / modalEvento.js) — se inyecta una sola vez en <body> la
// primera vez que se abre. Fase 6 (ver PROYECTO.md sección 6).
//
// Al tocar un resultado, cierra este modal y abre el modal de edición
// correspondiente (modalEvento / modalNota), que ya se encargan de recargar
// sus propias vistas al guardar.

import * as busquedaService from '../services/busquedaService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import { abrirParaEditar as abrirEventoParaEditar } from './modalEvento.js';
import { abrirParaEditarNota } from './modalNota.js';
import { parsearFechaISO, formatearFechaLarga, esMismoDia, sumarDias } from '../utils/fechas.js';

const DEBOUNCE_MS = 300;
const TIPO_LABEL = {
  diario: 'todos los días',
  dias_especificos: 'días específicos',
  puntual: 'actividad puntual',
  rango: 'rango de fechas',
};

let elBackdrop = null;
let elInput = null;
let elResultados = null;
let etiquetasPorId = new Map();
let debounceId = null;
let ultimaBusquedaId = 0; // evita pintar una respuesta vieja si llega tarde (fuera de orden)

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function chipHtml(etiquetaId) {
  const etiqueta = etiquetasPorId.get(etiquetaId);
  if (!etiqueta) return '';
  return `<span class="chip" style="--chip-color: ${etiqueta.color}">${escaparHtml(etiqueta.nombre)}</span>`;
}

/** "Hoy" / "Ayer" / "Lunes 20 jul" — igual que en el listado de notas.js. */
function formatearFechaNota(fechaIso) {
  const fecha = parsearFechaISO(fechaIso);
  const hoy = new Date();
  if (esMismoDia(fecha, hoy)) return 'Hoy';
  if (esMismoDia(fecha, sumarDias(hoy, -1))) return 'Ayer';
  return formatearFechaLarga(fecha);
}

function subtituloEvento(evento) {
  const cuando = TIPO_LABEL[evento.tipo] || evento.tipo;
  const hora = evento.hora_inicio ? ` · ${evento.hora_inicio}` : '';
  return `${cuando}${hora}`;
}

function recortarTexto(texto, maxLen = 120) {
  if (!texto) return '';
  const limpio = texto.trim();
  return limpio.length > maxLen ? `${limpio.slice(0, maxLen).trim()}…` : limpio;
}

function renderResultadoEvento(evento) {
  return `
    <button type="button" class="search-result" data-tipo="evento" data-id="${evento.id}">
      <span class="search-result__icon" aria-hidden="true">◷</span>
      <span class="search-result__texto">
        <span class="search-result__titulo">${escaparHtml(evento.titulo)}</span>
        <span class="search-result__meta">${escaparHtml(subtituloEvento(evento))}</span>
      </span>
      ${chipHtml(evento.etiqueta_id)}
    </button>
  `;
}

function renderResultadoNota(nota) {
  const titulo = nota.titulo || recortarTexto(nota.contenido) || '(nota sin título)';
  return `
    <button type="button" class="search-result" data-tipo="nota" data-id="${nota.id}">
      <span class="search-result__icon" aria-hidden="true">✎</span>
      <span class="search-result__texto">
        <span class="search-result__titulo">${escaparHtml(titulo)}</span>
        <span class="search-result__meta">${escaparHtml(formatearFechaNota(nota.fecha))}</span>
      </span>
      ${chipHtml(nota.etiqueta_id)}
    </button>
  `;
}

function renderSeccion(titulo, itemsHtml) {
  if (!itemsHtml.length) return '';
  return `
    <div class="search-results__section">
      <h3 class="search-results__section-title">${titulo}</h3>
      ${itemsHtml.join('')}
    </div>
  `;
}

function construirMarkup() {
  const html = `
    <div class="modal-backdrop" id="buscador-global-backdrop" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="buscador-global-titulo">
        <div class="modal__header">
          <h2 id="buscador-global-titulo">Buscar</h2>
          <button type="button" class="modal__close" id="buscador-global-cerrar" aria-label="Cerrar">×</button>
        </div>
        <div class="modal__body">
          <div class="search-bar" role="search">
            <span class="search-bar__prompt">›</span>
            <input type="search" id="buscador-global-input" placeholder="Buscar actividades y notas..." aria-label="Buscador global">
          </div>
          <div id="buscador-global-resultados">
            <div class="empty-state">escribe para buscar en tus actividades y notas</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  elBackdrop = document.getElementById('buscador-global-backdrop');
  elInput = document.getElementById('buscador-global-input');
  elResultados = document.getElementById('buscador-global-resultados');

  document.getElementById('buscador-global-cerrar').addEventListener('click', cerrar);
  elBackdrop.addEventListener('click', (evt) => { if (evt.target === elBackdrop) cerrar(); });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && !elBackdrop.hidden) cerrar();
  });

  elInput.addEventListener('input', () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => ejecutarBusqueda(elInput.value), DEBOUNCE_MS);
  });

  elResultados.addEventListener('click', (evt) => {
    const boton = evt.target.closest('.search-result');
    if (!boton) return;
    abrirResultado(boton.dataset.tipo, boton.dataset.id);
  });
}

function ensureInit() {
  if (!elBackdrop) construirMarkup();
}

async function cargarEtiquetas() {
  try {
    const etiquetas = await etiquetasService.listarEtiquetas();
    etiquetasPorId = new Map(etiquetas.map((et) => [et.id, et]));
  } catch (error) {
    console.error('[buscadorGlobal] No se pudieron cargar las etiquetas:', error.message);
    etiquetasPorId = new Map();
  }
}

let ultimosResultados = { eventos: [], notas: [] };

async function ejecutarBusqueda(query) {
  const termino = query.trim();
  const idBusqueda = ++ultimaBusquedaId;

  if (!termino) {
    elResultados.innerHTML = '<div class="empty-state">escribe para buscar en tus actividades y notas</div>';
    return;
  }

  elResultados.innerHTML = '<div class="empty-state">buscando…</div>';

  try {
    const resultado = await busquedaService.buscar(termino);
    if (idBusqueda !== ultimaBusquedaId) return; // llegó una respuesta vieja, se descarta

    ultimosResultados = resultado;
    const { eventos, notas } = resultado;

    if (eventos.length === 0 && notas.length === 0) {
      elResultados.innerHTML = `<div class="empty-state">sin resultados para "${escaparHtml(termino)}"</div>`;
      return;
    }

    const seccionEventos = renderSeccion('Actividades', eventos.map(renderResultadoEvento));
    const seccionNotas = renderSeccion('Notas', notas.map(renderResultadoNota));
    elResultados.innerHTML = seccionEventos + seccionNotas;
  } catch (error) {
    if (idBusqueda !== ultimaBusquedaId) return;
    console.error('[buscadorGlobal] Falló la búsqueda:', error.message);
    elResultados.innerHTML = `<div class="empty-state">no se pudo buscar — ${escaparHtml(error.message)}</div>`;
  }
}

function abrirResultado(tipo, id) {
  if (tipo === 'evento') {
    const evento = ultimosResultados.eventos.find((ev) => ev.id === id);
    if (!evento) return;
    cerrar();
    abrirEventoParaEditar(evento);
  } else if (tipo === 'nota') {
    const nota = ultimosResultados.notas.find((n) => n.id === id);
    if (!nota) return;
    cerrar();
    abrirParaEditarNota(nota);
  }
}

function cerrar() {
  if (elBackdrop) elBackdrop.hidden = true;
}

async function abrir() {
  ensureInit();
  elResultados.innerHTML = '<div class="empty-state">escribe para buscar en tus actividades y notas</div>';
  elInput.value = '';
  await cargarEtiquetas();
  elBackdrop.hidden = false;
  elInput.focus();
}

function inicializar() {
  const boton = document.getElementById('btn-buscador-global');
  if (!boton) return; // página sin acceso al buscador (no debería pasar, está en las 4)
  boton.addEventListener('click', abrir);
}

document.addEventListener('DOMContentLoaded', inicializar);
