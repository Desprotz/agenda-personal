// components/notas.js
// Vista "Notas" (pages/notas.html): lista real de notas desde la API,
// buscador de texto, filtro por etiqueta, y conecta con modalNota.js para
// crear/editar/eliminar. Fase 4 (ver PROYECTO.md sección 6).

import * as notasService from '../services/notasService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import * as agendaService from '../services/agendaService.js';
import * as storageService from '../services/storageService.js';
import { parsearFechaISO, formatearFechaLarga, esMismoDia, sumarDias } from '../utils/fechas.js';
import { initModalNota, abrirParaCrearNota, abrirParaEditarNota } from './modalNota.js';

let etiquetasPorId = new Map();
let eventosPorId = new Map();
let etiquetaActiva = null; // id o null = todas
let terminoBusqueda = '';
let debounceBusqueda = null;

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function estiloChip(etiqueta) {
  return etiqueta ? `style="--chip-color: ${etiqueta.color}"` : '';
}

/** "Hoy · 21:40" / "Ayer" / "Lunes 20 jul" según qué tan reciente sea la fecha. */
function formatearFechaNota(fechaIso) {
  const fecha = parsearFechaISO(fechaIso);
  const hoy = new Date();
  if (esMismoDia(fecha, hoy)) return 'Hoy';
  if (esMismoDia(fecha, sumarDias(hoy, -1))) return 'Ayer';
  return formatearFechaLarga(fecha);
}

function renderFiltroEtiquetas(etiquetas) {
  const contenedor = document.getElementById('filtro-etiquetas-notas');
  if (!contenedor) return;

  if (etiquetas.length === 0) {
    contenedor.innerHTML = '';
    return;
  }

  contenedor.innerHTML = etiquetas.map((et) => `
    <button class="chip" type="button" data-etiqueta-id="${et.id}"
      style="--chip-color: ${et.color}"
      aria-pressed="${etiquetaActiva === et.id}">${escaparHtml(et.nombre)}</button>
  `).join('');

  contenedor.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.etiquetaId;
      etiquetaActiva = etiquetaActiva === id ? null : id;
      cargarNotas();
    });
  });
}

function renderNota(nota) {
  const etiqueta = etiquetasPorId.get(nota.etiqueta_id) || null;
  const evento = eventosPorId.get(nota.evento_id) || null;

  const chipHtml = etiqueta
    ? `<span class="chip" ${estiloChip(etiqueta)}>${escaparHtml(etiqueta.nombre)}</span>`
    : '';

  const tituloHtml = nota.titulo
    ? `<h3 class="note-entry__title">${escaparHtml(nota.titulo)}</h3>`
    : '';

  const contenidoHtml = nota.contenido
    ? `<p class="note-entry__body">${escaparHtml(nota.contenido)}</p>`
    : '';

  const imagenesHtml = (nota.imagenes || []).length > 0
    ? `<div class="note-entry__images">${nota.imagenes.map((img) =>
        `<img src="${storageService.obtenerUrlPublica(img.url_storage)}" alt="Imagen adjunta a la nota">`
      ).join('')}</div>`
    : '';

  const primerAudio = (nota.audio || [])[0];
  const audioHtml = primerAudio
    ? `<div class="note-entry__audio">
         <audio controls preload="none" src="${storageService.obtenerUrlPublica(primerAudio.url_storage)}"></audio>
       </div>`
    : '';

  const footerHtml = `
    <div class="note-entry__footer">
      ${evento ? `<span class="note-entry__linked-event">${escaparHtml(evento.titulo)}</span>` : ''}
      <button type="button" class="btn btn--ghost btn--icon note-entry__eliminar" data-nota-id="${nota.id}" aria-label="Eliminar nota" title="Eliminar nota">🗑</button>
    </div>`;

  return `
    <article class="card card--interactive note-entry" data-nota-id="${nota.id}">
      <div class="note-entry__header">
        <span class="note-entry__date">${formatearFechaNota(nota.fecha)}</span>
        ${chipHtml}
      </div>
      ${tituloHtml}
      ${contenidoHtml}
      ${imagenesHtml}
      ${audioHtml}
      ${footerHtml}
    </article>
  `;
}

async function cargarNotas() {
  const contenedor = document.getElementById('lista-notas');
  if (!contenedor) return;

  try {
    const [notas, etiquetas, eventos] = await Promise.all([
      notasService.listarNotas({ etiqueta_id: etiquetaActiva || undefined, q: terminoBusqueda || undefined }),
      etiquetasService.listarEtiquetas(),
      agendaService.listarEventos(),
    ]);

    etiquetasPorId = new Map(etiquetas.map((et) => [et.id, et]));
    eventosPorId = new Map(eventos.map((ev) => [ev.id, ev]));
    renderFiltroEtiquetas(etiquetas);

    if (notas.length === 0) {
      contenedor.innerHTML = '<div class="empty-state">sin notas todavía — toca "+ Nota" para escribir la primera</div>';
      return;
    }

    contenedor.innerHTML = notas.map(renderNota).join('');

    contenedor.querySelectorAll('.note-entry__eliminar').forEach((btn) => {
      btn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const id = btn.dataset.notaId;
        const confirmado = window.confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.');
        if (!confirmado) return;
        try {
          await notasService.eliminarNota(id);
          await cargarNotas();
        } catch (error) {
          alert(`No se pudo eliminar la nota: ${error.message}`);
        }
      });
    });

    contenedor.querySelectorAll('.note-entry').forEach((card) => {
      card.addEventListener('click', (evt) => {
        // No abrir el modal si el clic fue sobre el reproductor de audio o eliminar.
        if (evt.target.closest('audio, .note-entry__eliminar')) return;
        const nota = notas.find((n) => n.id === card.dataset.notaId);
        if (nota) abrirParaEditarNota(nota);
      });
    });
  } catch (error) {
    console.error('[notas] No se pudieron cargar las notas:', error.message);
    contenedor.innerHTML = `<div class="empty-state">no se pudieron cargar las notas — ${error.message}</div>`;
  }
}

function inicializarBuscador() {
  const input = document.querySelector('.search-bar input[type="search"]');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(() => {
      terminoBusqueda = input.value.trim();
      cargarNotas();
    }, 300);
  });
}

function inicializar() {
  const contenedor = document.getElementById('lista-notas');
  if (!contenedor) return; // esta página no es notas.html

  initModalNota({
    onGuardado: () => cargarNotas(),
    onEliminado: () => cargarNotas(),
  });

  document.getElementById('btn-nueva-nota')?.addEventListener('click', () => {
    abrirParaCrearNota();
  });

  inicializarBuscador();
  cargarNotas();
}

document.addEventListener('DOMContentLoaded', inicializar);
