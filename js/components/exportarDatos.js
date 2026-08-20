// components/exportarDatos.js
// Conecta el botón "Exportar backup (.json)" de pages/ajustes.html con
// exportService.exportarTodoComoJSON(). Fase 6 (ver PROYECTO.md sección 6).
// Solo se usa en ajustes.html (si el botón no existe en la página, no hace nada).

import { exportarTodoComoJSON } from '../services/exportService.js';

function inicializar() {
  const boton = document.getElementById('btn-exportar');
  if (!boton) return; // esta página no es ajustes.html

  const textoOriginal = boton.textContent;

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.textContent = 'exportando…';
    try {
      const nombreArchivo = await exportarTodoComoJSON();
      boton.textContent = `✅ ${nombreArchivo}`;
    } catch (error) {
      console.error('[exportarDatos] Falló la exportación:', error.message);
      boton.textContent = '❌ no se pudo exportar';
      alert(`No se pudo generar el backup: ${error.message}`);
    } finally {
      setTimeout(() => {
        boton.disabled = false;
        boton.textContent = textoOriginal;
      }, 2500);
    }
  });
}

document.addEventListener('DOMContentLoaded', inicializar);
