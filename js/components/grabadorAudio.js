// components/grabadorAudio.js
// Interacción de UI para el botón de "grabar nota de voz". La grabación real
// (Web Audio API / MediaRecorder) y la subida a Netlify Blobs se conectan
// en la Fase 4 (ver PROYECTO.md, roadmap). Por ahora solo maneja el estado
// visual del botón para validar el diseño.

function inicializarBotonGrabar() {
  const boton = document.querySelector('[title="Grabar nota de voz"]');
  if (!boton) return;

  let grabando = false;
  boton.addEventListener('click', () => {
    grabando = !grabando;
    boton.dataset.recording = String(grabando);
    boton.classList.toggle('btn--record', true);
    boton.setAttribute('aria-pressed', String(grabando));
  });
}

document.addEventListener('DOMContentLoaded', inicializarBotonGrabar);
