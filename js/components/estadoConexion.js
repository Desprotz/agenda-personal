// components/estadoConexion.js
// Fase 2: pinta en la tarjeta "Cuenta" de ajustes.html si hay conexión real
// con la base de datos (Turso, vía Netlify Functions). Sin ningún tipo de
// login (ver PROYECTO.md) — solo confirma que las Functions pueden hablar
// con Turso y que las tablas responden.
// Solo se usa en ajustes.html.

function pintar(html) {
  const el = document.getElementById('estado-cuenta');
  if (!el) return;
  el.innerHTML = `<p class="text-meta">${html}</p>`;
}

document.addEventListener('agenda:conexion-lista', (ev) => {
  const { ok, motivo } = ev.detail;

  if (ok) {
    pintar('✅ Conectado a Turso');
    return;
  }

  if (motivo === 'no-configurado') {
    pintar(
      '⚠️ Turso no está configurado todavía — completa ' +
      '<code>TURSO_DATABASE_URL</code> y <code>TURSO_AUTH_TOKEN</code> en ' +
      'las variables de entorno de Netlify (Site settings → Environment variables).'
    );
    return;
  }

  pintar('❌ No se pudo conectar con Turso. Revisa la consola del navegador para más detalle.');
});
