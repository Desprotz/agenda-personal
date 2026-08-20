// components/alarmaManager.js
// Coordina qué alarmas están pendientes y dispara notificaciones en el
// momento correcto, en conjunto con notificacionesService.js y el Service
// Worker. Se carga en TODAS las páginas (ver script tags en cada .html)
// porque las notificaciones deben funcionar sin importar qué vista esté
// abierta — no solo en "Hoy".
//
// Además, en pages/ajustes.html, este mismo archivo conecta el botón
// "Activar notificaciones" (único lugar donde se puede pedir permiso, ver
// PROYECTO.md sección 4.3: tiene que ser en respuesta directa a un tap).
//
// Estrategia (MVP Fase 5, opción 2 de PROYECTO.md 4.3 — sin servidor):
// cada `INTERVALO_CHEQUEO_MS` se revisa si "ahora" cayó dentro de la
// ventana de alguna alarma pendiente de hoy. Se prefiere polling por
// intervalo en vez de un `setTimeout` exacto por alarma porque es más
// simple y se autocorrige solo: si el navegador puso en pausa los timers
// (pestaña en background) y luego se reactiva, el siguiente tick detecta
// igual las alarmas que ya deberían haber sonado, siempre que sigan dentro
// de `VENTANA_GRACIA_MIN`.

import * as agendaService from '../services/agendaService.js';
import * as notasService from '../services/notasService.js';
import * as notificacionesService from '../services/notificacionesService.js';
import { iniciarDia, formatearFechaISO } from '../utils/fechas.js';

const INTERVALO_CHEQUEO_MS = 30_000; // cada 30s
const VENTANA_GRACIA_MIN = 5; // dispara si "ahora" está a lo sumo 5 min después de la hora exacta
const HORA_RECORDATORIO_DIARIO = 21; // 21:00 — ver PROYECTO.md sección 8, "Recordatorio de diario"

let intervaloId = null;
let cacheEventos = null; // se refresca en cada tick, ver obtenerEventosDeHoy()

// ============================================================
// Utilidades de "llave ya disparada" (localStorage, para no repetir avisos
// si se recarga la página o se abre en otra pestaña el mismo día)
// ============================================================

function claveAlarma(eventoId, fechaIso) {
  return `agenda:alarma-disparada:${eventoId}:${fechaIso}`;
}

function claveRecordatorioDiario(fechaIso) {
  return `agenda:recordatorio-diario:${fechaIso}`;
}

function yaDisparada(clave) {
  try {
    return localStorage.getItem(clave) === '1';
  } catch (error) {
    return false; // localStorage no disponible (modo privado, etc.) — se prefiere repetir el aviso a romper la app
  }
}

function marcarDisparada(clave) {
  try {
    localStorage.setItem(clave, '1');
  } catch (error) {
    // Nada que hacer: sin localStorage, el peor caso es repetir el aviso.
  }
}

// ============================================================
// Chequeo de alarmas de eventos
// ============================================================

/** Combina una hora "HH:MM" con la fecha (Date) del día que corresponde. */
function horaEnFecha(fecha, horaStr) {
  const [h, m] = horaStr.split(':').map(Number);
  const d = new Date(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Eventos de hoy que tienen alarma activada y hora fija (sin hora no hay qué disparar). */
async function obtenerEventosDeHoyConAlarma() {
  cacheEventos = await agendaService.listarEventos();
  const hoy = iniciarDia(new Date());
  return agendaService
    .eventosParaFecha(cacheEventos, hoy)
    .filter((ev) => ev.tiene_alarma && ev.hora_inicio);
}

async function chequearAlarmasDeEventos() {
  const eventos = await obtenerEventosDeHoyConAlarma();
  const ahora = new Date();
  const fechaIso = formatearFechaISO(ahora);

  for (const ev of eventos) {
    const clave = claveAlarma(ev.id, fechaIso);
    if (yaDisparada(clave)) continue;

    const horaEvento = horaEnFecha(ahora, ev.hora_inicio);
    const minutosAntes = ev.minutos_antes_alarma || 0;
    const horaAlarma = new Date(horaEvento.getTime() - minutosAntes * 60_000);

    const msDesdeAlarma = ahora - horaAlarma;
    const dentroDeVentana = msDesdeAlarma >= 0 && msDesdeAlarma <= VENTANA_GRACIA_MIN * 60_000;
    if (!dentroDeVentana) continue;

    marcarDisparada(clave);
    const cuerpo = minutosAntes > 0
      ? `en ${minutosAntes} min · ${ev.hora_inicio}`
      : `empieza ahora · ${ev.hora_inicio}`;

    notificacionesService.notificar(ev.titulo, {
      body: cuerpo,
      tag: `agenda-evento-${ev.id}-${fechaIso}`,
    });
  }
}

// ============================================================
// Recordatorio de diario ("Funcionalidades adicionales", PROYECTO.md sección 8):
// si no se ha escrito nota hoy, aviso suave a partir de HORA_RECORDATORIO_DIARIO.
// ============================================================

async function chequearRecordatorioDiario() {
  const ahora = new Date();
  if (ahora.getHours() < HORA_RECORDATORIO_DIARIO) return;

  const fechaIso = formatearFechaISO(ahora);
  const clave = claveRecordatorioDiario(fechaIso);
  if (yaDisparada(clave)) return;

  try {
    const notasDeHoy = await notasService.listarNotas({ fecha: fechaIso });
    marcarDisparada(clave); // se marca aunque sí haya nota — solo se pregunta una vez al día
    if (notasDeHoy.length > 0) return;

    notificacionesService.notificar('¿Cómo estuvo tu día?', {
      body: 'Todavía no has escrito nada en el diario de hoy.',
      tag: `agenda-recordatorio-diario-${fechaIso}`,
    });
  } catch (error) {
    console.error('[alarmaManager] No se pudo chequear el recordatorio de diario:', error.message);
  }
}

// ============================================================
// Motor: arranca el polling solo si ya hay permiso concedido — nunca pide
// permiso por su cuenta (ver notificacionesService.pedirPermiso()).
// ============================================================

async function tick() {
  if (notificacionesService.permisoActual() !== 'granted') return;
  try {
    await chequearAlarmasDeEventos();
    await chequearRecordatorioDiario();
  } catch (error) {
    console.error('[alarmaManager] Error revisando alarmas:', error.message);
  }
}

function iniciarMotor() {
  if (intervaloId) return; // ya está corriendo, evita duplicar el interval
  tick(); // primer chequeo inmediato, no hay que esperar 30s
  intervaloId = setInterval(tick, INTERVALO_CHEQUEO_MS);

  // Cuando la pestaña/PWA vuelve a primer plano (ej. se desbloqueó el
  // iPhone), se revisa de inmediato en vez de esperar al próximo tick —
  // así una alarma que cayó mientras la app estaba en background reciente
  // se avisa apenas se reabre, siempre que siga dentro de la ventana de gracia.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

// ============================================================
// Botón "Activar notificaciones" (solo existe en pages/ajustes.html)
// ============================================================

function pintarEstadoBoton(boton, estadoTexto, permiso) {
  const estados = document.getElementById('estado-notificaciones');
  if (estados) estados.textContent = estadoTexto;

  if (permiso === 'granted') {
    boton.textContent = '✅ Notificaciones activadas';
    boton.disabled = true;
  } else if (permiso === 'denied') {
    boton.textContent = 'Notificaciones bloqueadas';
    boton.disabled = true;
  } else if (permiso === 'unsupported') {
    boton.textContent = 'No disponible en este navegador';
    boton.disabled = true;
  } else {
    boton.textContent = 'Activar notificaciones';
    boton.disabled = false;
  }
}

function textoEstadoInicial(permiso) {
  switch (permiso) {
    case 'granted':
      return 'Las notificaciones están activadas en este dispositivo.';
    case 'denied':
      return 'Bloqueaste las notificaciones para este sitio. Para activarlas, cámbialo desde los ajustes de notificaciones de iOS/Safari para esta app.';
    case 'unsupported':
      return 'Este navegador no soporta notificaciones, o la agenda todavía no está instalada como app (Compartir → Agregar a inicio).';
    default:
      return '';
  }
}

function inicializarBotonAjustes() {
  const boton = document.getElementById('btn-activar-notificaciones');
  if (!boton) return; // no es ajustes.html

  const permisoInicial = notificacionesService.permisoActual();
  pintarEstadoBoton(boton, textoEstadoInicial(permisoInicial), permisoInicial);
  if (permisoInicial === 'granted') iniciarMotor();

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.textContent = 'Pidiendo permiso…';

    const resultado = await notificacionesService.pedirPermiso();

    if (resultado === 'granted') {
      pintarEstadoBoton(boton, 'Listo — te avisaremos cuando empiece una tarea con alarma o al final del día si no has escrito nada.', resultado);
      iniciarMotor();
    } else if (resultado === 'denied') {
      pintarEstadoBoton(boton, textoEstadoInicial(resultado), resultado);
    } else {
      pintarEstadoBoton(boton, 'No se activaron las notificaciones. Puedes volver a intentarlo.', 'default');
    }
  });
}

function inicializar() {
  inicializarBotonAjustes();
  // En cualquier otra página: si el permiso ya fue concedido antes, el
  // motor arranca solo, sin pedir nada de nuevo.
  if (notificacionesService.permisoActual() === 'granted') iniciarMotor();
}

document.addEventListener('DOMContentLoaded', inicializar);
