// sw/service-worker.js
// Service Worker: necesario para que la PWA funcione instalada en iPhone y
// para mostrar notificaciones vía registro.showNotification() (ver
// notificacionesService.js) incluso cuando la pestaña está en background
// reciente. Ver PROYECTO.md sección 4.3 y 10.1.
//
// Fase 5:
//  - Cache básico de assets estáticos para que la app abra (shell) sin red.
//  - 'notificationclick' enfoca o abre la app.
//
// IMPORTANTE: las llamadas a /api/* (Netlify Functions -> Turso) NUNCA se
// cachean — siempre van a la red. Cachear respuestas de la API mostraría
// datos desactualizados (eventos/notas viejos) sin avisar, que es peor que
// no tener nada offline. Este SW solo cachea el "shell" estático.

const CACHE_VERSION = 'agenda-shell-v1';

const ASSETS_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/layout.css',
  '/css/componentes.css',
  '/css/hoy.css',
  '/js/main.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS_SHELL)).catch((error) => {
      // No se aborta la instalación por esto: peor caso, no hay shell offline
      // pero el resto del Service Worker (notificaciones) sigue funcionando.
      console.error('[service-worker] No se pudo precachear el shell:', error);
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET, mismo origen, y nunca /api/* (ver nota arriba).
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first con fallback a cache: prioriza contenido fresco cuando hay
  // red, y solo usa lo cacheado si falla la conexión (offline real).
  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copia));
        return respuesta;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existente = clientes.find((c) => 'focus' in c);
      if (existente) {
        existente.focus();
        return;
      }
      await self.clients.openWindow('/');
    })(),
  );
});
