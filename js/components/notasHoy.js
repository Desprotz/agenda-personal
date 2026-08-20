// components/notasHoy.js
// Sección "Últimas notas" de index.html (vista Hoy): muestra las notas más
// recientes con datos reales. Fase 4 (ver PROYECTO.md sección 6) — hasta
// ahora esta sección era una maqueta estática (ver checklistHoy.js, Fase 3).
// Clic en una nota lleva a pages/notas.html a editarla (el modal de nota
// vive ahí; Hoy solo da un vistazo rápido).

import * as notasService from '../services/notasService.js';
import * as etiquetasService from '../services/etiquetasService.js';

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function extracto(texto, maxLargo = 90) {
  if (!texto) return '';
  const limpio = texto.trim();
  return limpio.length > maxLargo ? `${limpio.slice(0, maxLargo).trim()}...` : limpio;
}

function renderNota(nota, etiquetasPorId) {
  const etiqueta = etiquetasPorId.get(nota.etiqueta_id) || null;
  const tieneImagen = (nota.imagenes || []).length > 0;
  const tieneAudio = (nota.audio || []).length > 0;
  const thumb = tieneImagen ? '🖼' : tieneAudio ? '🎙' : '📝';

  const excerpt = nota.contenido
    ? extracto(nota.contenido)
    : (tieneAudio ? `Nota de voz · ${Math.round(nota.audio[0].duracion_segundos || 0)}s` : '');

  return `
    <a class="card card--interactive note-preview-card" href="pages/notas.html" data-nota-id="${nota.id}">
      <div class="note-preview-card__thumb">${thumb}</div>
      <div class="note-preview-card__body">
        <div class="hoy-item__title">${escaparHtml(nota.titulo || '(sin título)')}</div>
        <p class="note-preview-card__excerpt">${escaparHtml(excerpt)}</p>
        <div class="hoy-item__meta">
          ${etiqueta ? `<span class="chip" style="--chip-color: ${etiqueta.color}">${escaparHtml(etiqueta.nombre)}</span>` : ''}
        </div>
      </div>
    </a>
  `;
}

async function cargarUltimasNotas() {
  const contenedor = document.getElementById('lista-ultimas-notas');
  if (!contenedor) return;

  try {
    const [notas, etiquetas] = await Promise.all([
      notasService.listarUltimasNotas(3),
      etiquetasService.listarEtiquetas(),
    ]);
    const etiquetasPorId = new Map(etiquetas.map((et) => [et.id, et]));

    if (notas.length === 0) {
      contenedor.innerHTML = '<div class="empty-state">sin notas todavía — ve a "notas.html" para escribir la primera</div>';
      return;
    }

    contenedor.innerHTML = notas.map((n) => renderNota(n, etiquetasPorId)).join('');
  } catch (error) {
    console.error('[notasHoy] No se pudieron cargar las últimas notas:', error.message);
    contenedor.innerHTML = `<div class="empty-state">no se pudieron cargar las notas — ${error.message}</div>`;
  }
}

function inicializar() {
  if (!document.getElementById('lista-ultimas-notas')) return; // no es index.html
  cargarUltimasNotas();
}

document.addEventListener('DOMContentLoaded', inicializar);
