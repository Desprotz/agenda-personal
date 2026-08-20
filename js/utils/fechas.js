// utils/fechas.js
// Utilidades de fecha/hora compartidas por toda la app.

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Devuelve algo como "Martes 22 de julio" a partir de un objeto Date. */
export function formatearFechaLarga(fecha) {
  const dia = DIAS[fecha.getDay()];
  const diaCapitalizado = dia.charAt(0).toUpperCase() + dia.slice(1);
  const mes = MESES[fecha.getMonth()];
  return `${diaCapitalizado} ${fecha.getDate()} de ${mes}`;
}

/** Devuelve "HH:MM" con ceros a la izquierda. */
export function formatearHora(fecha) {
  const h = String(fecha.getHours()).padStart(2, '0');
  const m = String(fecha.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Minutos transcurridos desde medianoche para una fecha dada. */
export function minutosDesdeMedianoche(fecha) {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

/** Nombres cortos de día, empezando en lunes (para encabezados de semana/mes). */
export const DIAS_CORTOS_LUN = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** ¿Son el mismo día calendario (año/mes/día), ignorando la hora? */
export function esMismoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Devuelve una nueva fecha a las 00:00 (sin mutar la original). */
export function iniciarDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve el lunes de la semana que contiene `fecha` (semana lunes→domingo). */
export function inicioDeSemana(fecha) {
  const d = iniciarDia(fecha);
  const dia = d.getDay(); // 0 = domingo ... 6 = sábado
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Suma (o resta, si n es negativo) `n` días a una fecha. */
export function sumarDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

/** Suma (o resta) `n` meses a una fecha, fijando el día 1 para evitar desbordes. */
export function sumarMeses(fecha, n) {
  const d = new Date(fecha);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** "20 – 26 de julio" o "28 jul – 3 ago" si la semana cruza de mes. */
export function formatearRangoSemana(inicio, fin) {
  const mismoMes = inicio.getMonth() === fin.getMonth();
  if (mismoMes) {
    return `${inicio.getDate()} – ${fin.getDate()} de ${MESES[inicio.getMonth()]}`;
  }
  const mesInicioCorto = MESES[inicio.getMonth()].slice(0, 3);
  const mesFinCorto = MESES[fin.getMonth()].slice(0, 3);
  return `${inicio.getDate()} ${mesInicioCorto} – ${fin.getDate()} ${mesFinCorto}`;
}

/** "Julio 2026" */
export function formatearMesAnio(fecha) {
  const mes = MESES[fecha.getMonth()];
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()}`;
}

/**
 * 'YYYY-MM-DD' en horario LOCAL (no UTC) — importante porque `toISOString()`
 * convierte a UTC primero y puede correr la fecha un día en zonas horarias
 * negativas (Colombia, UTC-5). Esta es la que se manda a las Netlify Functions.
 */
export function formatearFechaISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Inversa de formatearFechaISO: 'YYYY-MM-DD' -> Date a medianoche local. */
export function parsearFechaISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Nombres cortos lun→dom (mismo orden que DIAS_CORTOS_LUN) indexados por getDay(). */
const DIAS_CORTOS_POR_GETDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Nombres cortos de mes (para fechas compactas, ej. "vie 9 ago"). */
const MESES_CORTOS = MESES.map((m) => m.slice(0, 3));

/**
 * "vie 9 ago" — fecha compacta con día de semana. Usada por el widget de
 * "próxima alarma" (Fase 5) cuando la alarma no es hoy ni mañana.
 */
export function formatearFechaCorta(fecha) {
  return `${DIAS_CORTOS_POR_GETDAY[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

/** "Lun · Mié · Vie" a partir de un arreglo de números de getDay() (0=domingo). */
export function formatearDiasSemana(diasSemana) {
  return [...diasSemana]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)) // domingo al final
    .map((d) => DIAS_CORTOS_POR_GETDAY[d])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' · ');
}