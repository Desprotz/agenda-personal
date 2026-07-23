// main.js
// Punto de entrada común a todas las páginas.
// Fase 1: solo manejaba presentación (fecha de hoy).
// Fase 2: además, verifica la conexión con la base de datos (Turso, vía
// Netlify Functions) al cargar cualquier página (sin ningún tipo de login,
// ver PROYECTO.md) y avisa al resto de la app cuando el chequeo terminó,
// mediante el evento 'agenda:conexion-lista'.

import { formatearFechaLarga } from './utils/fechas.js';
import { verificarConexion } from './config/apiClient.js';

function inicializarFechaHoy() {
  const el = document.getElementById('fecha-hoy');
  if (!el) return;
  el.textContent = formatearFechaLarga(new Date());
}

async function inicializarConexion() {
  const resultado = await verificarConexion();
  document.dispatchEvent(new CustomEvent('agenda:conexion-lista', { detail: resultado }));
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarFechaHoy();
  inicializarConexion();
});
