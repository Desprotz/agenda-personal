// services/notificacionesService.js
// Permisos de notificación + registro del Service Worker + disparo de
// notificaciones. Ver PROYECTO.md sección 4.3 y 10.1 para las restricciones
// reales de iOS/Safari:
//   - Push a una pestaña normal NO funciona; solo con la PWA instalada.
//   - El permiso solo se puede pedir en respuesta directa a un tap del
//     usuario, nunca automáticamente al cargar la página — por eso
//     `pedirPermiso()` existe como función aparte y quien la llama (el botón
//     de ajustes.html, ver alarmaManager.js) es responsable de invocarla
//     solo dentro de un manejador de click.
//
// MVP de la Fase 5 (decisión documentada en PROYECTO.md sección 4.3, opción
// 2): notificaciones locales mientras la PWA está abierta o recientemente
// activa, sin servidor de por medio. No hay Web Push real vía APNs todavía
// — si el evento resulta poco confiable con la app en background, ese es el
// siguiente paso (Netlify Scheduled Function + suscripción guardada en
// Turso), no un rediseño desde cero de este archivo.

const RUTA_SERVICE_WORKER = '/sw/service-worker.js';
const ICONO = '/assets/icons/icon-192.png';

/** ¿El navegador soporta lo mínimo necesario (Notification API + Service Worker)? */
export function soportado() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/** Estado actual del permiso: 'granted' | 'denied' | 'default' | 'unsupported'. */
export function permisoActual() {
  return soportado() ? Notification.permission : 'unsupported';
}

/** Registra (o reutiliza, si ya está registrado) el Service Worker. */
export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(RUTA_SERVICE_WORKER);
  } catch (error) {
    console.error('[notificacionesService] No se pudo registrar el Service Worker:', error.message);
    return null;
  }
}

/**
 * Pide permiso de notificaciones al usuario. IMPORTANTE: debe llamarse
 * siempre desde dentro de un manejador de click/tap (nunca en
 * DOMContentLoaded ni similar) — en iOS Safari, pedir el permiso sin una
 * interacción directa del usuario simplemente no muestra nada y queda en
 * 'default' para siempre.
 * Devuelve el permiso resultante: 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export async function pedirPermiso() {
  if (!soportado()) return 'unsupported';

  // Se registra el SW igual antes de pedir permiso: si el usuario ya lo
  // había concedido en una visita anterior, esto deja todo listo sin
  // volver a preguntar (Notification.requestPermission() con permiso ya
  // resuelto no muestra diálogo, solo devuelve el valor actual).
  await registrarServiceWorker();

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error('[notificacionesService] Falló requestPermission():', error.message);
    return Notification.permission;
  }
}

/**
 * Muestra una notificación. Se prefiere el Service Worker registrado
 * (`registro.showNotification`) porque es más confiable con la PWA en
 * background reciente que `new Notification()` directo; si por lo que sea
 * no hay SW disponible, cae de vuelta a la API simple.
 * No hace nada si el permiso no está concedido (llamarlo sin chequear antes
 * es seguro).
 */
export async function notificar(titulo, opciones = {}) {
  if (permisoActual() !== 'granted') return;

  const config = {
    icon: ICONO,
    badge: ICONO,
    ...opciones,
  };

  try {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro) {
      await registro.showNotification(titulo, config);
      return;
    }
  } catch (error) {
    console.error('[notificacionesService] Falló showNotification vía Service Worker:', error.message);
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(titulo, config);
  } catch (error) {
    console.error('[notificacionesService] Falló new Notification():', error.message);
  }
}
