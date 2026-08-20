// services/exportService.js
// Exporta todos los datos del usuario (eventos, notas, etiquetas) a un JSON
// descargable, para respaldo/migración manual.
//
// No incluye imágenes/audio en sí (los blobs de Netlify Blobs no son
// prácticos de embeber en un JSON) — sí incluye las referencias
// (url_storage) de cada nota, para que el JSON siga siendo útil como mapa de
// qué archivos le pertenecen a qué nota si algún día se migra el storage.

import { listarEventos } from './agendaService.js';
import { listarNotas } from './notasService.js';
import { listarEtiquetas } from './etiquetasService.js';
import { formatearFechaISO } from '../utils/fechas.js';

/**
 * Trae eventos, notas y etiquetas de la API y arma el objeto de backup.
 * No dispara ninguna descarga por sí sola (ver `descargarBackupJSON` para
 * eso) — separado para poder testear/usar el objeto sin tocar el DOM.
 */
export async function generarBackup() {
  const [eventos, notas, etiquetas] = await Promise.all([
    listarEventos(),
    listarNotas(),
    listarEtiquetas(),
  ]);

  return {
    version: 1,
    generado_en: new Date().toISOString(),
    eventos,
    notas,
    etiquetas,
  };
}

/**
 * Genera el backup y dispara la descarga como archivo .json en el navegador
 * (crea un <a download> temporal — funciona igual dentro de la PWA
 * instalada en iOS). Devuelve el nombre del archivo generado.
 */
export async function exportarTodoComoJSON() {
  const backup = await generarBackup();
  const contenido = JSON.stringify(backup, null, 2);
  const nombreArchivo = `agenda-backup-${formatearFechaISO(new Date())}.json`;

  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  // Liberar el object URL un momento después de disparar la descarga
  // (algunos navegadores necesitan que el <a> siga siendo válido en el
  // instante del click).
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return nombreArchivo;
}
