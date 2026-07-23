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
