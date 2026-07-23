// components/calendario.js
// Renderiza la vista Agenda en sus 3 modos: día, semana y mes.
//
// En esta fase (maquetado estático) los eventos salen de un "pool" de datos
// de ejemplo que se repiten según el día de la semana, para poder ver algo
// parecido a datos reales (incluyendo recurrencia) en las 3 vistas.
// A partir de la Fase 3 esto se reemplaza por datos reales de agendaService.js,
// pero la forma de los eventos ({ titulo, inicio, fin, categoria }) se mantiene
// para que el reemplazo sea sencillo.

import {
  formatearHora,
  formatearFechaLarga,
  formatearRangoSemana,
  formatearMesAnio,
  minutosDesdeMedianoche,
  esMismoDia,
  iniciarDia,
  inicioDeSemana,
  sumarDias,
  sumarMeses,
  DIAS_CORTOS_LUN,
} from '../utils/fechas.js';

const HORA_INICIO = 6;   // 06:00
const HORA_FIN = 23;     // 23:00
const ALTO_FILA_DIA = 64;     // debe coincidir con --hour row height en agenda.css (vista día)
const ALTO_FILA_SEMANA = 48;  // debe coincidir con --week-row-height en agenda.css

// --- Pool de eventos de ejemplo, con recurrencia por día de la semana ---
// dias: 0 = domingo ... 6 = sábado
const POOL_EVENTOS = [
  { titulo: 'Gimnasio', inicio: '07:00', fin: '08:00', categoria: 'salud', dias: [1, 3, 5] },
  { titulo: 'Entrega módulo de autenticación', inicio: '10:00', fin: '12:00', categoria: 'trabajo', dias: [2] },
  { titulo: 'Reunión de equipo', inicio: '17:30', fin: '18:30', categoria: 'trabajo', dias: [2, 4] },
  { titulo: 'Clase de inglés', inicio: '19:00', fin: '20:00', categoria: 'estudio', dias: [1, 3] },
  { titulo: 'Leer 20 páginas', inicio: '21:00', fin: '21:30', categoria: 'personal', dias: [0, 1, 2, 3, 4, 5, 6] },
  { titulo: 'Repaso semanal', inicio: '09:00', fin: '10:30', categoria: 'estudio', dias: [6] },
  { titulo: 'Mercado', inicio: '11:00', fin: '12:00', categoria: 'personal', dias: [6] },
];

// --- Estado de la vista ---
const estado = {
  vista: 'dia',        // 'dia' | 'semana' | 'mes'
  fechaActual: new Date(),
  categoriasActivas: new Set(), // vacío = mostrar todas
};

function minutosDesdeTexto(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Devuelve los eventos de ejemplo para una fecha dada, ya filtrados por categoría activa. */
function obtenerEventosParaFecha(fecha) {
  const diaSemana = fecha.getDay();
  return POOL_EVENTOS
    .filter((ev) => ev.dias.includes(diaSemana))
    .filter((ev) => estado.categoriasActivas.size === 0 || estado.categoriasActivas.has(ev.categoria))
    .map((ev) => ({ ...ev }));
}

// ============================================================
// Vista DÍA
// ============================================================
function renderGutterDia(contenedor) {
  contenedor.innerHTML = '';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const div = document.createElement('div');
    div.className = 'timeline__hour-label';
    div.textContent = `${String(h).padStart(2, '0')}:00`;
    contenedor.appendChild(div);
  }
}

function renderFilasDia(contenedor) {
  contenedor.innerHTML = '';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const fila = document.createElement('div');
    fila.className = 'timeline__hour-row';
    fila.dataset.hora = h;
    contenedor.appendChild(fila);
  }
}

function renderEventosDia(contenedor, fecha) {
  const inicioTimelineMin = HORA_INICIO * 60;
  obtenerEventosParaFecha(fecha).forEach((ev) => {
    const inicioMin = minutosDesdeTexto(ev.inicio);
    const finMin = minutosDesdeTexto(ev.fin);
    const top = ((inicioMin - inicioTimelineMin) / 60) * ALTO_FILA_DIA;
    const alto = ((finMin - inicioMin) / 60) * ALTO_FILA_DIA;

    const bloque = document.createElement('div');
    bloque.className = `event-block event-block--${ev.categoria}`;
    bloque.style.top = `${top}px`;
    bloque.style.height = `${Math.max(alto, 28)}px`;
    bloque.innerHTML = `
      <div class="event-block__title">${ev.titulo}</div>
      <div class="event-block__meta">${ev.inicio} – ${ev.fin}</div>
    `;
    contenedor.appendChild(bloque);
  });
}

function renderLineaAhoraDia(contenedor, fecha) {
  const ahora = new Date();
  if (!esMismoDia(ahora, fecha)) return; // solo se dibuja si el día visible es hoy

  const minAhora = minutosDesdeMedianoche(ahora);
  const inicioTimelineMin = HORA_INICIO * 60;
  const finTimelineMin = HORA_FIN * 60 + 60;
  if (minAhora < inicioTimelineMin || minAhora > finTimelineMin) return;

  const top = ((minAhora - inicioTimelineMin) / 60) * ALTO_FILA_DIA;
  const linea = document.createElement('div');
  linea.className = 'now-line';
  linea.style.top = `${top}px`;
  linea.dataset.time = formatearHora(ahora);
  contenedor.appendChild(linea);
}

function renderVistaDia() {
  const gutter = document.getElementById('timeline-gutter');
  const horas = document.getElementById('timeline-hours');
  if (!gutter || !horas) return;

  renderGutterDia(gutter);
  renderFilasDia(horas);
  renderEventosDia(horas, estado.fechaActual);
  renderLineaAhoraDia(horas, estado.fechaActual);
}

// ============================================================
// Vista SEMANA
// ============================================================
function renderVistaSemana() {
  const grid = document.getElementById('week-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const inicioSemana = inicioDeSemana(estado.fechaActual);
  const hoy = new Date();
  const numHoras = HORA_FIN - HORA_INICIO + 1;

  // --- Columna de horas (gutter) ---
  const colGutter = document.createElement('div');
  colGutter.className = 'week-col week-col--gutter';

  const headerGutter = document.createElement('div');
  headerGutter.className = 'week-col__header';
  colGutter.appendChild(headerGutter);

  const horasGutter = document.createElement('div');
  horasGutter.className = 'week-col__hours';
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    const fila = document.createElement('div');
    fila.className = 'week-col__hour-row';
    fila.textContent = `${String(h).padStart(2, '0')}:00`;
    horasGutter.appendChild(fila);
  }
  colGutter.appendChild(horasGutter);
  grid.appendChild(colGutter);

  // --- 7 columnas de día ---
  for (let i = 0; i < 7; i++) {
    const fechaCol = sumarDias(inicioSemana, i);
    const esHoy = esMismoDia(fechaCol, hoy);

    const col = document.createElement('div');
    col.className = `week-col week-col--dia${esHoy ? ' week-col--hoy' : ''}`;
    col.dataset.fecha = fechaCol.toISOString();

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'week-col__header';
    header.style.cssText = 'width:100%; border:none; cursor:pointer;';
    header.innerHTML = `
      <span class="week-col__header-dia">${DIAS_CORTOS_LUN[i]}</span>
      <span class="week-col__header-num">${fechaCol.getDate()}</span>
    `;
    header.addEventListener('click', () => {
      estado.fechaActual = fechaCol;
      cambiarVista('dia');
    });
    col.appendChild(header);

    const horasCol = document.createElement('div');
    horasCol.className = 'week-col__hours';
    horasCol.style.height = `${numHoras * ALTO_FILA_SEMANA}px`;

    for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
      const fila = document.createElement('div');
      fila.className = 'week-col__hour-row';
      horasCol.appendChild(fila);
    }

    const inicioTimelineMin = HORA_INICIO * 60;
    obtenerEventosParaFecha(fechaCol).forEach((ev) => {
      const inicioMin = minutosDesdeTexto(ev.inicio);
      const finMin = minutosDesdeTexto(ev.fin);
      const top = ((inicioMin - inicioTimelineMin) / 60) * ALTO_FILA_SEMANA;
      const alto = ((finMin - inicioMin) / 60) * ALTO_FILA_SEMANA;

      const bloque = document.createElement('div');
      bloque.className = `week-event week-event--${ev.categoria}`;
      bloque.style.top = `${top}px`;
      bloque.style.height = `${Math.max(alto, 20)}px`;
      bloque.innerHTML = `
        <span class="week-event__title">${ev.titulo}</span>
        <span class="week-event__meta">${ev.inicio}</span>
      `;
      horasCol.appendChild(bloque);
    });

    if (esHoy) {
      const ahora = new Date();
      const minAhora = minutosDesdeMedianoche(ahora);
      const finTimelineMin = HORA_FIN * 60 + 60;
      if (minAhora >= inicioTimelineMin && minAhora <= finTimelineMin) {
        const linea = document.createElement('div');
        linea.className = 'week-now-line';
        linea.style.top = `${((minAhora - inicioTimelineMin) / 60) * ALTO_FILA_SEMANA}px`;
        horasCol.appendChild(linea);
      }
    }

    col.appendChild(horasCol);
    grid.appendChild(col);
  }
}

// ============================================================
// Vista MES
// ============================================================
function renderVistaMes() {
  const weekdaysEl = document.getElementById('month-weekdays');
  const gridEl = document.getElementById('month-grid');
  if (!weekdaysEl || !gridEl) return;

  weekdaysEl.innerHTML = DIAS_CORTOS_LUN.map((d) => `<span>${d}</span>`).join('');
  gridEl.innerHTML = '';

  const hoy = new Date();
  const primerDiaMes = new Date(estado.fechaActual.getFullYear(), estado.fechaActual.getMonth(), 1);
  const inicioCuadricula = inicioDeSemana(primerDiaMes);

  for (let i = 0; i < 42; i++) {
    const fechaCelda = sumarDias(inicioCuadricula, i);
    const fueraDeMes = fechaCelda.getMonth() !== estado.fechaActual.getMonth();
    const esHoy = esMismoDia(fechaCelda, hoy);

    const celda = document.createElement('button');
    celda.type = 'button';
    celda.className = 'month-cell';
    if (fueraDeMes) celda.classList.add('month-cell--fuera-de-mes');
    if (esHoy) celda.classList.add('month-cell--hoy');

    const eventosDia = obtenerEventosParaFecha(fechaCelda);
    const categoriasDia = [...new Set(eventosDia.map((ev) => ev.categoria))];
    const dots = categoriasDia
      .slice(0, 4)
      .map((cat) => `<span class="month-cell__dot month-cell__dot--${cat}"></span>`)
      .join('');
    const extra = eventosDia.length > 4
      ? `<span class="month-cell__mas">+${eventosDia.length - 4}</span>`
      : '';

    celda.innerHTML = `
      <span class="month-cell__num">${fechaCelda.getDate()}</span>
      <span class="month-cell__dots">${dots}${extra}</span>
    `;
    celda.addEventListener('click', () => {
      estado.fechaActual = fechaCelda;
      cambiarVista('dia');
    });

    gridEl.appendChild(celda);
  }
}

// ============================================================
// Encabezado (rango de fecha) + navegación + cambio de vista
// ============================================================
function actualizarEncabezado() {
  const el = document.getElementById('agenda-rango-fecha');
  if (!el) return;

  if (estado.vista === 'dia') {
    el.textContent = formatearFechaLarga(estado.fechaActual);
  } else if (estado.vista === 'semana') {
    const inicio = inicioDeSemana(estado.fechaActual);
    const fin = sumarDias(inicio, 6);
    el.textContent = formatearRangoSemana(inicio, fin);
  } else {
    el.textContent = formatearMesAnio(estado.fechaActual);
  }
}

function renderVistaActual() {
  actualizarEncabezado();
  if (estado.vista === 'dia') renderVistaDia();
  else if (estado.vista === 'semana') renderVistaSemana();
  else renderVistaMes();
}

function cambiarVista(nuevaVista) {
  estado.vista = nuevaVista;

  document.querySelectorAll('.view-switcher__btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.vista === nuevaVista));
  });
  document.querySelectorAll('[data-vista-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.vistaPanel !== nuevaVista;
  });

  renderVistaActual();
}

function navegar(direccion) {
  // direccion: -1 (anterior) o 1 (siguiente)
  if (estado.vista === 'dia') {
    estado.fechaActual = sumarDias(estado.fechaActual, direccion);
  } else if (estado.vista === 'semana') {
    estado.fechaActual = sumarDias(estado.fechaActual, direccion * 7);
  } else {
    estado.fechaActual = sumarMeses(estado.fechaActual, direccion);
  }
  renderVistaActual();
}

function irAHoy() {
  estado.fechaActual = iniciarDia(new Date());
  renderVistaActual();
}

function inicializarControles() {
  document.querySelectorAll('.view-switcher__btn').forEach((btn) => {
    btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
  });

  document.getElementById('nav-anterior')?.addEventListener('click', () => navegar(-1));
  document.getElementById('nav-siguiente')?.addEventListener('click', () => navegar(1));
  document.getElementById('nav-hoy')?.addEventListener('click', irAHoy);

  document.querySelectorAll('.filter-bar .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.categoria;
      const activo = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!activo));
      if (activo) estado.categoriasActivas.delete(cat);
      else estado.categoriasActivas.add(cat);
      renderVistaActual();
    });
  });
}

function inicializarAgenda() {
  const timeline = document.getElementById('vista-dia');
  if (!timeline) return; // esta página no es agenda.html

  estado.fechaActual = iniciarDia(new Date());
  inicializarControles();
  renderVistaActual();
}

document.addEventListener('DOMContentLoaded', inicializarAgenda);
