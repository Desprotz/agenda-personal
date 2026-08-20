// components/grabadorAudio.js
// Interacción real del botón "grabar nota de voz" (🎙 en notas.html), usando
// MediaRecorder. Al terminar de grabar, abre modalNota.js en modo "crear"
// con el audio ya adjunto — el título/etiqueta/vínculo se completan ahí y el
// archivo se sube a Netlify Blobs recién al guardar (ver modalNota.js ->
// subirAdjuntosPendientes).

import { abrirParaCrearNotaConAudio } from './modalNota.js';

// MediaRecorder produce mimeType con parámetros (ej. 'audio/webm;codecs=opus');
// netlify/functions/media.js valida por el tipo "pelado", así que probamos en
// orden de preferencia y nos quedamos con el primero que el navegador soporte.
const MIME_CANDIDATOS = ['audio/webm', 'audio/ogg', 'audio/mp4'];

function elegirMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  return MIME_CANDIDATOS.find((tipo) => MediaRecorder.isTypeSupported(tipo)) || null;
}

function inicializarBotonGrabar() {
  const boton = document.querySelector('[title="Grabar nota de voz"]');
  if (!boton) return;

  let mediaRecorder = null;
  let stream = null;
  let chunks = [];
  let inicioMs = 0;
  let grabando = false;

  async function iniciarGrabacion() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Este navegador no soporta grabar audio.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('[grabadorAudio] No se pudo acceder al micrófono:', error.message);
      alert('No se pudo acceder al micrófono. Revisa los permisos de la app/navegador.');
      return;
    }

    const mimeType = elegirMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunks = [];
    inicioMs = Date.now();

    mediaRecorder.addEventListener('dataavailable', (evt) => {
      if (evt.data && evt.data.size > 0) chunks.push(evt.data);
    });

    mediaRecorder.addEventListener('stop', () => {
      const contentTypeCompleto = mediaRecorder.mimeType || mimeType || 'audio/webm';
      const contentType = contentTypeCompleto.split(';')[0]; // quita ";codecs=..."
      const blob = new Blob(chunks, { type: contentType });
      const duracionSegundos = (Date.now() - inicioMs) / 1000;

      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      chunks = [];

      if (blob.size > 0 && duracionSegundos >= 0.5) {
        abrirParaCrearNotaConAudio(blob, contentType, duracionSegundos);
      }
    });

    mediaRecorder.start();
    grabando = true;
    boton.dataset.recording = 'true';
    boton.classList.add('btn--record');
    boton.setAttribute('aria-pressed', 'true');
    boton.title = 'Detener grabación';
  }

  function detenerGrabacion() {
    grabando = false;
    boton.dataset.recording = 'false';
    boton.classList.remove('btn--record');
    boton.setAttribute('aria-pressed', 'false');
    boton.title = 'Grabar nota de voz';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  boton.addEventListener('click', () => {
    if (grabando) detenerGrabacion();
    else iniciarGrabacion();
  });
}

document.addEventListener('DOMContentLoaded', inicializarBotonGrabar);
