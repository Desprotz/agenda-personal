// components/modalNota.js
// Modal para crear/editar una nota del diario (texto, imágenes, audio,
// vínculo opcional a un evento). Se inyecta una sola vez en <body> (singleton,
// mismo patrón que modalEvento.js) — así notas.html e index.html (vista Hoy)
// pueden usarlo sin duplicar markup.
//
// Uso:
//   import { initModalNota, abrirParaCrearNota, abrirParaEditarNota,
//            abrirParaCrearNotaConAudio } from './modalNota.js';
//   initModalNota({ onGuardado: (nota) => ..., onEliminado: (id) => ... });
//   abrirParaCrearNota();                  // crear, sin fecha sugerida
//   abrirParaCrearNota(new Date());        // crear, con fecha precargada
//   abrirParaEditarNota(notaCruda);        // editar (nota tal cual sale de la API)
//   abrirParaCrearNotaConAudio(blob, tipo, seg); // crear, con un audio ya
//                                           // grabado adjunto (usado por
//                                           // grabadorAudio.js)

import * as notasService from '../services/notasService.js';
import * as agendaService from '../services/agendaService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import * as storageService from '../services/storageService.js';
import { validarEtiqueta } from '../utils/validaciones.js';
import { formatearFechaISO } from '../utils/fechas.js';

let elModal = null;
let elForm = null;
let elError = null;
let elBtnEliminar = null;
let elSelectEtiqueta = null;
let elNuevaEtiquetaForm = null;
let elSelectEvento = null;
let elImagenesInput = null;
let elImagenesPreview = null;
let elAudioPreview = null;

let etiquetas = [];
let eventos = [];
let notaEnEdicion = null; // null = creando

// Imágenes: existentes (ya en la BD, {id, url_storage, orden}) menos las
// marcadas para borrar, más los archivos nuevos aún no subidos (File).
let imagenesExistentes = [];
let imagenesNuevas = []; // [{file, previewUrl}]

// Audio: como mucho un adjunto a la vez (aunque el esquema permite varios).
let audioExistente = null; // {id, url_storage, duracion_segundos} | null
let audioNuevo = null; // {blob, contentType, duracionSegundos} | null

let callbacks = { onGuardado: () => {}, onEliminado: () => {} };

export function initModalNota(cb = {}) {
  callbacks = { ...callbacks, ...cb };
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function formatearDuracion(segundos) {
  const s = Math.round(segundos || 0);
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

function construirMarkup() {
  const html = `
    <div class="modal-backdrop" id="modal-nota-backdrop" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-nota-titulo">
        <div class="modal__header">
          <h2 id="modal-nota-titulo">Nueva nota</h2>
          <button type="button" class="modal__close" id="modal-nota-cerrar" aria-label="Cerrar">×</button>
        </div>
        <form id="form-nota" novalidate>
          <div class="modal__body">
            <div class="modal__error" id="modal-nota-error"></div>

            <div class="field">
              <label for="nt-titulo">Título</label>
              <input type="text" id="nt-titulo" name="titulo" maxlength="120" placeholder="(opcional)">
            </div>

            <div class="field">
              <label for="nt-contenido">Contenido</label>
              <textarea id="nt-contenido" name="contenido" rows="5" placeholder="Escribe aquí..."></textarea>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="nt-fecha">Fecha</label>
                <input type="date" id="nt-fecha" name="fecha">
              </div>
              <div class="field">
                <label for="nt-evento">Vincular a evento</label>
                <select id="nt-evento" name="evento_id">
                  <option value="">Sin vincular</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label for="nt-etiqueta">Etiqueta</label>
              <div class="etiqueta-picker">
                <select id="nt-etiqueta" name="etiqueta_id">
                  <option value="">Sin etiqueta</option>
                </select>
                <button type="button" class="btn btn--ghost btn--icon" id="btn-nota-nueva-etiqueta" aria-label="Nueva etiqueta" title="Nueva etiqueta">+</button>
              </div>
              <div class="nueva-etiqueta-form" id="nota-nueva-etiqueta-form" hidden>
                <input type="text" id="nota-nueva-etiqueta-nombre" placeholder="nombre" maxlength="40">
                <input type="color" id="nota-nueva-etiqueta-color" value="#5FD4D0">
                <button type="button" class="btn btn--ghost" id="btn-nota-crear-etiqueta">crear</button>
              </div>
            </div>

            <div class="field">
              <label for="nt-imagenes">Imágenes</label>
              <input type="file" id="nt-imagenes" accept="image/*" multiple>
              <div class="nota-imagenes-preview" id="nota-imagenes-preview"></div>
            </div>

            <div class="field" id="nota-audio-field" hidden>
              <label>Audio</label>
              <div class="note-entry__audio" id="nota-audio-preview"></div>
            </div>
          </div>

          <div class="modal__footer">
            <button type="button" class="btn btn--danger-outline" id="btn-eliminar-nota" hidden>eliminar</button>
            <button type="button" class="btn btn--ghost" id="btn-cancelar-nota">cancelar</button>
            <button type="submit" class="btn btn--primary" id="btn-guardar-nota">guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  elModal = document.getElementById('modal-nota-backdrop');
  elForm = document.getElementById('form-nota');
  elError = document.getElementById('modal-nota-error');
  elBtnEliminar = document.getElementById('btn-eliminar-nota');
  elSelectEtiqueta = document.getElementById('nt-etiqueta');
  elNuevaEtiquetaForm = document.getElementById('nota-nueva-etiqueta-form');
  elSelectEvento = document.getElementById('nt-evento');
  elImagenesInput = document.getElementById('nt-imagenes');
  elImagenesPreview = document.getElementById('nota-imagenes-preview');
  elAudioPreview = document.getElementById('nota-audio-preview');

  document.getElementById('modal-nota-cerrar').addEventListener('click', cerrar);
  document.getElementById('btn-cancelar-nota').addEventListener('click', cerrar);
  elModal.addEventListener('click', (evt) => { if (evt.target === elModal) cerrar(); });

  document.getElementById('btn-nota-nueva-etiqueta').addEventListener('click', () => {
    elNuevaEtiquetaForm.hidden = !elNuevaEtiquetaForm.hidden;
  });
  document.getElementById('btn-nota-crear-etiqueta').addEventListener('click', crearEtiquetaDesdeModal);

  elImagenesInput.addEventListener('change', (evt) => {
    const archivos = Array.from(evt.target.files || []);
    archivos.forEach((file) => {
      imagenesNuevas.push({ file, previewUrl: URL.createObjectURL(file) });
    });
    elImagenesInput.value = '';
    renderPreviewImagenes();
  });

  elBtnEliminar.addEventListener('click', eliminarDesdeModal);
  elForm.addEventListener('submit', guardarDesdeModal);
}

function ensureInit() {
  if (!elModal) construirMarkup();
}

async function cargarEtiquetas() {
  try {
    etiquetas = await etiquetasService.listarEtiquetas();
  } catch (error) {
    console.error('[modalNota] No se pudieron cargar las etiquetas:', error.message);
    etiquetas = [];
  }
  const actual = elSelectEtiqueta.value;
  elSelectEtiqueta.innerHTML = '<option value="">Sin etiqueta</option>' +
    etiquetas.map((et) => `<option value="${et.id}">${escaparHtml(et.nombre)}</option>`).join('');
  if (actual) elSelectEtiqueta.value = actual;
}

async function cargarEventos() {
  try {
    eventos = await agendaService.listarEventos();
  } catch (error) {
    console.error('[modalNota] No se pudieron cargar los eventos:', error.message);
    eventos = [];
  }
  const actual = elSelectEvento.value;
  elSelectEvento.innerHTML = '<option value="">Sin vincular</option>' +
    eventos.map((ev) => `<option value="${ev.id}">${escaparHtml(ev.titulo)}</option>`).join('');
  if (actual) elSelectEvento.value = actual;
}

async function crearEtiquetaDesdeModal() {
  const nombre = document.getElementById('nota-nueva-etiqueta-nombre').value.trim();
  const color = document.getElementById('nota-nueva-etiqueta-color').value;
  const errores = validarEtiqueta({ nombre, color });
  if (errores.length) {
    mostrarError(errores.join(' '));
    return;
  }
  try {
    const nueva = await etiquetasService.crearEtiqueta(nombre, color);
    await cargarEtiquetas();
    elSelectEtiqueta.value = nueva.id;
    elNuevaEtiquetaForm.hidden = true;
    document.getElementById('nota-nueva-etiqueta-nombre').value = '';
    mostrarError('');
  } catch (error) {
    mostrarError(error.message);
  }
}

function mostrarError(mensaje) {
  elError.textContent = mensaje || '';
}

// --- Imágenes ---

function renderPreviewImagenes() {
  const existentesHtml = imagenesExistentes.map((img, i) => `
    <div class="nota-imagenes-preview__item">
      <img src="${storageService.obtenerUrlPublica(img.url_storage)}" alt="Imagen adjunta">
      <button type="button" class="nota-imagenes-preview__quitar" data-existente="${i}" aria-label="Quitar imagen">×</button>
    </div>
  `).join('');

  const nuevasHtml = imagenesNuevas.map((img, i) => `
    <div class="nota-imagenes-preview__item">
      <img src="${img.previewUrl}" alt="Imagen nueva">
      <button type="button" class="nota-imagenes-preview__quitar" data-nueva="${i}" aria-label="Quitar imagen">×</button>
    </div>
  `).join('');

  elImagenesPreview.innerHTML = existentesHtml + nuevasHtml;

  elImagenesPreview.querySelectorAll('[data-existente]').forEach((btn) => {
    btn.addEventListener('click', () => {
      imagenesExistentes.splice(Number(btn.dataset.existente), 1);
      renderPreviewImagenes();
    });
  });
  elImagenesPreview.querySelectorAll('[data-nueva]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [eliminada] = imagenesNuevas.splice(Number(btn.dataset.nueva), 1);
      if (eliminada) URL.revokeObjectURL(eliminada.previewUrl);
      renderPreviewImagenes();
    });
  });
}

// --- Audio ---

function renderPreviewAudio() {
  const campo = document.getElementById('nota-audio-field');
  const adjunto = audioNuevo || audioExistente;

  if (!adjunto) {
    campo.hidden = true;
    elAudioPreview.innerHTML = '';
    return;
  }

  campo.hidden = false;
  const duracion = audioNuevo ? audioNuevo.duracionSegundos : audioExistente.duracion_segundos;
  elAudioPreview.innerHTML = `
    <span>🎙</span>
    <span>Nota de voz · ${formatearDuracion(duracion)}</span>
    <button type="button" class="btn btn--ghost btn--icon" id="btn-quitar-audio" aria-label="Quitar audio" title="Quitar audio">×</button>
  `;
  document.getElementById('btn-quitar-audio').addEventListener('click', () => {
    audioNuevo = null;
    audioExistente = null;
    renderPreviewAudio();
  });
}

/** Llamado por grabadorAudio.js justo después de terminar una grabación. */
export function adjuntarAudioGrabado(blob, contentType, duracionSegundos) {
  audioNuevo = { blob, contentType, duracionSegundos };
  audioExistente = null;
  if (elModal) renderPreviewAudio();
}

// --- Formulario ---

function limpiarEstadoAdjuntos() {
  imagenesNuevas.forEach((img) => URL.revokeObjectURL(img.previewUrl));
  imagenesNuevas = [];
  imagenesExistentes = [];
  audioNuevo = null;
  audioExistente = null;
}

function rellenarFormulario(nota) {
  elForm.reset();
  document.getElementById('nota-nueva-etiqueta-nombre').value = '';
  elNuevaEtiquetaForm.hidden = true;
  limpiarEstadoAdjuntos();

  document.getElementById('nt-fecha').value = formatearFechaISO(new Date());

  if (nota) {
    document.getElementById('nt-titulo').value = nota.titulo || '';
    document.getElementById('nt-contenido').value = nota.contenido || '';
    document.getElementById('nt-fecha').value = nota.fecha || formatearFechaISO(new Date());
    elSelectEvento.value = nota.evento_id || '';
    elSelectEtiqueta.value = nota.etiqueta_id || '';
    imagenesExistentes = [...(nota.imagenes || [])];
    audioExistente = (nota.audio || [])[0] || null;
  }

  renderPreviewImagenes();
  renderPreviewAudio();
}

function leerFormulario() {
  const fd = new FormData(elForm);
  return {
    titulo: (fd.get('titulo') || '').trim() || null,
    contenido: (fd.get('contenido') || '').trim() || null,
    fecha: fd.get('fecha') || formatearFechaISO(new Date()),
    evento_id: fd.get('evento_id') || null,
    etiqueta_id: fd.get('etiqueta_id') || null,
  };
}

async function subirAdjuntosPendientes() {
  const imagenesSubidas = await Promise.all(
    imagenesNuevas.map((img) => storageService.subirImagen(img.file))
  );

  const imagenesFinal = [
    ...imagenesExistentes.map((img, i) => ({ url_storage: img.url_storage, orden: i })),
    ...imagenesSubidas.map((res, i) => ({ url_storage: res.key, orden: imagenesExistentes.length + i })),
  ];

  let audioFinal = [];
  if (audioNuevo) {
    const subido = await storageService.subirAudio(audioNuevo.blob, audioNuevo.contentType);
    audioFinal = [{ url_storage: subido.key, duracion_segundos: Math.round(audioNuevo.duracionSegundos || 0) }];
  } else if (audioExistente) {
    audioFinal = [{ url_storage: audioExistente.url_storage, duracion_segundos: audioExistente.duracion_segundos }];
  }

  return { imagenesFinal, audioFinal };
}

async function guardarDesdeModal(evt) {
  evt.preventDefault();
  const datos = leerFormulario();

  const tieneTexto = Boolean(datos.titulo || datos.contenido);
  const tieneAdjuntos = imagenesExistentes.length > 0 || imagenesNuevas.length > 0 || audioExistente || audioNuevo;
  if (!tieneTexto && !tieneAdjuntos) {
    mostrarError('La nota necesita al menos texto, una imagen o un audio.');
    return;
  }
  mostrarError('');

  const btnGuardar = document.getElementById('btn-guardar-nota');
  btnGuardar.disabled = true;
  try {
    const { imagenesFinal, audioFinal } = await subirAdjuntosPendientes();
    const payload = { ...datos, imagenes: imagenesFinal, audio: audioFinal };

    let nota;
    if (notaEnEdicion) {
      nota = await notasService.actualizarNota(notaEnEdicion.id, payload);
    } else {
      nota = await notasService.crearNota(payload);
    }
    cerrar();
    callbacks.onGuardado(nota);
  } catch (error) {
    mostrarError(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
}

async function eliminarDesdeModal() {
  if (!notaEnEdicion) return;
  const confirmado = window.confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.');
  if (!confirmado) return;

  try {
    await notasService.eliminarNota(notaEnEdicion.id);
    const id = notaEnEdicion.id;
    cerrar();
    callbacks.onEliminado(id);
  } catch (error) {
    mostrarError(error.message);
  }
}

function cerrar() {
  if (elModal) elModal.hidden = true;
  notaEnEdicion = null;
}

export async function abrirParaCrearNota(fechaSugerida = null) {
  ensureInit();
  notaEnEdicion = null;
  document.getElementById('modal-nota-titulo').textContent = 'Nueva nota';
  elBtnEliminar.hidden = true;
  mostrarError('');
  rellenarFormulario(null);
  await Promise.all([cargarEtiquetas(), cargarEventos()]);
  if (fechaSugerida) document.getElementById('nt-fecha').value = formatearFechaISO(fechaSugerida);
  elModal.hidden = false;
  document.getElementById('nt-titulo').focus();
}

export async function abrirParaEditarNota(nota) {
  ensureInit();
  notaEnEdicion = nota;
  document.getElementById('modal-nota-titulo').textContent = 'Editar nota';
  elBtnEliminar.hidden = false;
  mostrarError('');
  await Promise.all([cargarEtiquetas(), cargarEventos()]);
  rellenarFormulario(nota);
  elModal.hidden = false;
  document.getElementById('nt-titulo').focus();
}

/** Abre el modal de "nueva nota" con un audio recién grabado ya adjunto. */
export async function abrirParaCrearNotaConAudio(blob, contentType, duracionSegundos) {
  await abrirParaCrearNota();
  adjuntarAudioGrabado(blob, contentType, duracionSegundos);
}
