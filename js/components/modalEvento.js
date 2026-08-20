// components/modalEvento.js
// Modal para crear/editar un evento de agenda (tipo, horario, etiqueta, alarma).
// Se inyecta una sola vez en <body> la primera vez que se abre (singleton),
// así que tanto agenda.html como index.html (vista Hoy) pueden importarlo y
// usarlo sin duplicar markup.
//
// Uso:
//   import { abrirParaCrear, abrirParaEditar, initModalEvento } from './modalEvento.js';
//   initModalEvento({ onGuardado: (evento) => ..., onEliminado: (id) => ... });
//   abrirParaCrear();               // crear, sin fecha sugerida
//   abrirParaCrear(unaFecha);       // crear, con fecha_inicio precargada
//   abrirParaEditar(eventoCrudo);   // editar (evento tal cual sale de la API)

import * as agendaService from '../services/agendaService.js';
import * as etiquetasService from '../services/etiquetasService.js';
import { validarFormularioEvento, validarEtiqueta } from '../utils/validaciones.js';
import { formatearFechaISO } from '../utils/fechas.js';

const DIAS_SEMANA_OPCIONES = [
  { valor: 1, corto: 'L' }, { valor: 2, corto: 'M' }, { valor: 3, corto: 'X' },
  { valor: 4, corto: 'J' }, { valor: 5, corto: 'V' }, { valor: 6, corto: 'S' },
  { valor: 0, corto: 'D' },
];
const MINUTOS_ALARMA_OPCIONES = [5, 10, 15, 30, 60];

let elModal = null;
let elForm = null;
let elError = null;
let elBtnEliminar = null;
let elSelectEtiqueta = null;
let elNuevaEtiquetaForm = null;
let etiquetas = [];
let eventoEnEdicion = null; // null = creando
let callbacks = { onGuardado: () => {}, onEliminado: () => {} };

export function initModalEvento(cb = {}) {
  callbacks = { ...callbacks, ...cb };
}

function construirMarkup() {
  const diasHtml = DIAS_SEMANA_OPCIONES.map(({ valor, corto }) => `
    <input type="checkbox" id="dia-${valor}" name="dias_semana" value="${valor}">
    <label for="dia-${valor}">${corto}</label>
  `).join('');

  const minutosHtml = MINUTOS_ALARMA_OPCIONES.map((m) => `<option value="${m}">${m} min antes</option>`).join('');

  const html = `
    <div class="modal-backdrop" id="modal-evento-backdrop" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-evento-titulo">
        <div class="modal__header">
          <h2 id="modal-evento-titulo">Nueva actividad</h2>
          <button type="button" class="modal__close" id="modal-evento-cerrar" aria-label="Cerrar">×</button>
        </div>
        <form id="form-evento" novalidate>
          <div class="modal__body">
            <div class="modal__error" id="modal-evento-error"></div>

            <div class="field">
              <label for="ev-titulo">Título</label>
              <input type="text" id="ev-titulo" name="titulo" maxlength="120" required>
            </div>

            <div class="field">
              <label for="ev-descripcion">Descripción</label>
              <textarea id="ev-descripcion" name="descripcion"></textarea>
            </div>

            <div class="field">
              <label for="ev-tipo">Tipo de actividad</label>
              <select id="ev-tipo" name="tipo">
                <option value="diario">Recurrente diaria</option>
                <option value="dias_especificos">Recurrente por días específicos</option>
                <option value="puntual">Puntual</option>
                <option value="rango">Rango de tiempo / tarea larga</option>
              </select>
            </div>

            <div class="field" data-tipo-visible="dias_especificos" hidden>
              <label>Días de la semana</label>
              <div class="dias-semana-picker">${diasHtml}</div>
            </div>

            <div class="field-row" data-tipo-visible="puntual,rango" hidden>
              <div class="field">
                <label for="ev-fecha-inicio" id="label-fecha-inicio">Fecha</label>
                <input type="date" id="ev-fecha-inicio" name="fecha_inicio">
              </div>
              <div class="field" data-tipo-visible="rango" hidden>
                <label for="ev-fecha-fin">Fecha de fin</label>
                <input type="date" id="ev-fecha-fin" name="fecha_fin">
              </div>
            </div>

            <div class="field-row" data-tipo-visible="diario,dias_especificos,puntual" hidden>
              <div class="field">
                <label for="ev-hora-inicio">Hora de inicio</label>
                <input type="time" id="ev-hora-inicio" name="hora_inicio">
              </div>
              <div class="field">
                <label for="ev-hora-fin">Hora de fin</label>
                <input type="time" id="ev-hora-fin" name="hora_fin">
              </div>
            </div>

            <div class="field">
              <label for="ev-etiqueta">Etiqueta</label>
              <div class="etiqueta-picker">
                <select id="ev-etiqueta" name="etiqueta_id">
                  <option value="">Sin etiqueta</option>
                </select>
                <button type="button" class="btn btn--ghost btn--icon" id="btn-nueva-etiqueta" aria-label="Nueva etiqueta" title="Nueva etiqueta">+</button>
              </div>
              <div class="nueva-etiqueta-form" id="nueva-etiqueta-form" hidden>
                <input type="text" id="nueva-etiqueta-nombre" placeholder="nombre" maxlength="40">
                <input type="color" id="nueva-etiqueta-color" value="#5FD4D0">
                <button type="button" class="btn btn--ghost" id="btn-crear-etiqueta">crear</button>
              </div>
            </div>

            <div class="alarma-field">
              <label>
                <input type="checkbox" id="ev-tiene-alarma" name="tiene_alarma">
                Avisarme con alarma
              </label>
              <select id="ev-minutos-alarma" name="minutos_antes_alarma" hidden>${minutosHtml}</select>
            </div>
          </div>

          <div class="modal__footer">
            <button type="button" class="btn btn--danger-outline" id="btn-eliminar-evento" hidden>eliminar</button>
            <button type="button" class="btn btn--ghost" id="btn-cancelar-evento">cancelar</button>
            <button type="submit" class="btn btn--primary">guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  elModal = document.getElementById('modal-evento-backdrop');
  elForm = document.getElementById('form-evento');
  elError = document.getElementById('modal-evento-error');
  elBtnEliminar = document.getElementById('btn-eliminar-evento');
  elSelectEtiqueta = document.getElementById('ev-etiqueta');
  elNuevaEtiquetaForm = document.getElementById('nueva-etiqueta-form');

  document.getElementById('modal-evento-cerrar').addEventListener('click', cerrar);
  document.getElementById('btn-cancelar-evento').addEventListener('click', cerrar);
  elModal.addEventListener('click', (evt) => { if (evt.target === elModal) cerrar(); });

  document.getElementById('ev-tipo').addEventListener('change', actualizarCamposVisibles);
  document.getElementById('ev-tiene-alarma').addEventListener('change', (evt) => {
    document.getElementById('ev-minutos-alarma').hidden = !evt.target.checked;
  });

  document.getElementById('btn-nueva-etiqueta').addEventListener('click', () => {
    elNuevaEtiquetaForm.hidden = !elNuevaEtiquetaForm.hidden;
  });
  document.getElementById('btn-crear-etiqueta').addEventListener('click', crearEtiquetaDesdeModal);

  elBtnEliminar.addEventListener('click', eliminarDesdeModal);
  elForm.addEventListener('submit', guardarDesdeModal);
}

function ensureInit() {
  if (!elModal) construirMarkup();
}

function actualizarCamposVisibles() {
  const tipo = document.getElementById('ev-tipo').value;
  document.querySelectorAll('[data-tipo-visible]').forEach((el) => {
    const tipos = el.dataset.tipoVisible.split(',');
    el.hidden = !tipos.includes(tipo);
  });

  const labelFecha = document.getElementById('label-fecha-inicio');
  if (labelFecha) labelFecha.textContent = tipo === 'rango' ? 'Fecha de inicio' : 'Fecha';
}

async function cargarEtiquetas() {
  try {
    etiquetas = await etiquetasService.listarEtiquetas();
  } catch (error) {
    console.error('[modalEvento] No se pudieron cargar las etiquetas:', error.message);
    etiquetas = [];
  }
  const actual = elSelectEtiqueta.value;
  elSelectEtiqueta.innerHTML = '<option value="">Sin etiqueta</option>' +
    etiquetas.map((et) => `<option value="${et.id}">${escaparHtml(et.nombre)}</option>`).join('');
  if (actual) elSelectEtiqueta.value = actual;
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function crearEtiquetaDesdeModal() {
  const nombre = document.getElementById('nueva-etiqueta-nombre').value.trim();
  const color = document.getElementById('nueva-etiqueta-color').value;
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
    document.getElementById('nueva-etiqueta-nombre').value = '';
    mostrarError('');
  } catch (error) {
    mostrarError(error.message);
  }
}

function mostrarError(mensaje) {
  elError.textContent = mensaje || '';
}

function rellenarFormulario(evento) {
  elForm.reset();
  actualizarCamposVisibles();
  document.getElementById('nueva-etiqueta-nombre').value = '';
  elNuevaEtiquetaForm.hidden = true;

  if (!evento) return;

  document.getElementById('ev-titulo').value = evento.titulo || '';
  document.getElementById('ev-descripcion').value = evento.descripcion || '';
  document.getElementById('ev-tipo').value = evento.tipo || 'diario';
  actualizarCamposVisibles();

  document.getElementById('ev-fecha-inicio').value = evento.fecha_inicio || '';
  document.getElementById('ev-fecha-fin').value = evento.fecha_fin || '';
  document.getElementById('ev-hora-inicio').value = evento.hora_inicio || '';
  document.getElementById('ev-hora-fin').value = evento.hora_fin || '';
  elSelectEtiqueta.value = evento.etiqueta_id || '';

  const dias = (evento.dias_semana || '').split(',').filter(Boolean);
  document.querySelectorAll('input[name="dias_semana"]').forEach((input) => {
    input.checked = dias.includes(input.value);
  });

  const tieneAlarma = Boolean(evento.tiene_alarma);
  document.getElementById('ev-tiene-alarma').checked = tieneAlarma;
  document.getElementById('ev-minutos-alarma').hidden = !tieneAlarma;
  if (evento.minutos_antes_alarma) {
    document.getElementById('ev-minutos-alarma').value = String(evento.minutos_antes_alarma);
  }
}

function leerFormulario() {
  const fd = new FormData(elForm);
  const tipo = fd.get('tipo');
  const tieneAlarma = fd.get('tiene_alarma') === 'on';

  return {
    titulo: (fd.get('titulo') || '').trim(),
    descripcion: (fd.get('descripcion') || '').trim() || null,
    tipo,
    dias_semana: tipo === 'dias_especificos' ? fd.getAll('dias_semana').map(Number) : null,
    fecha_inicio: (tipo === 'puntual' || tipo === 'rango') ? (fd.get('fecha_inicio') || null) : null,
    fecha_fin: tipo === 'rango' ? (fd.get('fecha_fin') || null) : null,
    hora_inicio: tipo !== 'rango' ? (fd.get('hora_inicio') || null) : null,
    hora_fin: tipo !== 'rango' ? (fd.get('hora_fin') || null) : null,
    etiqueta_id: fd.get('etiqueta_id') || null,
    tiene_alarma: tieneAlarma,
    minutos_antes_alarma: tieneAlarma ? Number(fd.get('minutos_antes_alarma')) : null,
  };
}

async function guardarDesdeModal(evt) {
  evt.preventDefault();
  const datos = leerFormulario();

  const errores = validarFormularioEvento(datos);
  if (errores.length) {
    mostrarError(errores.join(' '));
    return;
  }
  mostrarError('');

  const btnGuardar = elForm.querySelector('button[type="submit"]');
  btnGuardar.disabled = true;
  try {
    let evento;
    if (eventoEnEdicion) {
      evento = await agendaService.actualizarEvento(eventoEnEdicion.id, datos);
    } else {
      evento = await agendaService.crearEvento(datos);
    }
    cerrar();
    callbacks.onGuardado(evento);
  } catch (error) {
    mostrarError(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
}

async function eliminarDesdeModal() {
  if (!eventoEnEdicion) return;
  const confirmado = window.confirm(`¿Eliminar "${eventoEnEdicion.titulo}"? Esta acción no se puede deshacer.`);
  if (!confirmado) return;

  try {
    await agendaService.eliminarEvento(eventoEnEdicion.id);
    const id = eventoEnEdicion.id;
    cerrar();
    callbacks.onEliminado(id);
  } catch (error) {
    mostrarError(error.message);
  }
}

function cerrar() {
  if (elModal) elModal.hidden = true;
  eventoEnEdicion = null;
}

export async function abrirParaCrear(fechaSugerida = null) {
  ensureInit();
  eventoEnEdicion = null;
  document.getElementById('modal-evento-titulo').textContent = 'Nueva actividad';
  elBtnEliminar.hidden = true;
  mostrarError('');
  rellenarFormulario(null);
  await cargarEtiquetas();
  if (fechaSugerida) {
    document.getElementById('ev-fecha-inicio').value = formatearFechaISO(fechaSugerida);
    document.getElementById('ev-fecha-fin').value = formatearFechaISO(fechaSugerida);
  }
  elModal.hidden = false;
  document.getElementById('ev-titulo').focus();
}

export async function abrirParaEditar(evento) {
  ensureInit();
  eventoEnEdicion = evento;
  document.getElementById('modal-evento-titulo').textContent = 'Editar actividad';
  elBtnEliminar.hidden = false;
  mostrarError('');
  await cargarEtiquetas();
  rellenarFormulario(evento);
  elModal.hidden = false;
  document.getElementById('ev-titulo').focus();
}