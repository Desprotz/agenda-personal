// sw/service-worker.js
// Service Worker: necesario para que la PWA funcione instalada en iPhone y,
// más adelante, para recibir Web Push (ver PROYECTO.md sección 4.3 y 11.1).
//
// TODO (Fase 5):
//  - Cachear assets estáticos para uso offline básico.
//  - Escuchar el evento 'push' y mostrar la notificación con self.registration.showNotification().
//  - Escuchar 'notificationclick' para abrir la app en la vista correspondiente.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
