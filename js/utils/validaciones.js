// utils/validaciones.js
// Validaciones de formularios en el cliente. Devuelven siempre un arreglo de
// strings (vacío = sin errores), consumido por modalEvento.js.
//
// Estas reglas son un espejo de las que ya aplican netlify/functions/eventos.js
// y etiquetas.js del lado del servidor — la API sigue siendo la fuente de
// verdad final (nunca hay que confiar solo en esto), pero validar aquí evita
// el roundtrip innecesario y le da feedback inmediato al usuario.

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TIPOS_VALIDOS = ['diario', 'dias_especificos', 'puntual', 'rango'];

/**
 * Valida el formulario de evento (misma forma que arma modalEvento.js ->
 * leerFormulario): { titulo, tipo, dias_semana, fecha_inicio, fecha_fin,
 * hora_inicio, hora_fin, etiqueta_id, tiene_alarma, minutos_antes_alarma }.
 */
export function validarFormularioEvento(datos) {
  const errores = [];

  // --- título ---
  if (!datos.titulo || !datos.titulo.trim()) {
    errores.push('El título es obligatorio.');
  } else if (datos.titulo.trim().length > 120) {
    errores.push('El título es demasiado largo (máx. 120 caracteres).');
  }

  // --- tipo ---
  if (!TIPOS_VALIDOS.includes(datos.tipo)) {
    errores.push(`El tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`);
  }

  // --- horas (obligatorias salvo para 'rango') ---
  if (datos.hora_inicio && !HORA_RE.test(datos.hora_inicio)) {
    errores.push('La hora de inicio debe tener formato HH:MM.');
  }
  if (datos.hora_fin && !HORA_RE.test(datos.hora_fin)) {
    errores.push('La hora de fin debe tener formato HH:MM.');
  }
  if (datos.hora_inicio && datos.hora_fin && datos.hora_fin <= datos.hora_inicio) {
    errores.push('La hora de fin debe ser posterior a la hora de inicio.');
  }
  if (datos.tipo && datos.tipo !== 'rango') {
    if (!datos.hora_inicio) errores.push('La hora de inicio es obligatoria para este tipo de actividad.');
    if (!datos.hora_fin) errores.push('La hora de fin es obligatoria para este tipo de actividad.');
  }

  // --- dias_semana (solo 'dias_especificos') ---
  if (datos.tipo === 'dias_especificos' && (!datos.dias_semana || datos.dias_semana.length === 0)) {
    errores.push('Selecciona al menos un día de la semana.');
  }

  // --- fecha_inicio / fecha_fin ---
  if (datos.tipo === 'puntual' || datos.tipo === 'rango') {
    if (!datos.fecha_inicio) errores.push('La fecha es obligatoria para este tipo de actividad.');
  }
  if (datos.tipo === 'rango') {
    if (!datos.fecha_fin) errores.push('La fecha de fin es obligatoria para una actividad de tipo "rango".');
    if (datos.fecha_inicio && datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
      errores.push('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }
  }

  // --- alarma ---
  if (datos.tiene_alarma) {
    const min = datos.minutos_antes_alarma;
    if (!Number.isInteger(min) || min < 0) {
      errores.push('Elige cada cuántos minutos antes avisar la alarma.');
    }
  }

  return errores;
}

/** Valida { nombre, color } de una etiqueta. */
export function validarEtiqueta({ nombre, color }) {
  const errores = [];

  if (!nombre || !nombre.trim()) {
    errores.push('El nombre de la etiqueta es obligatorio.');
  } else if (nombre.trim().length > 40) {
    errores.push('El nombre de la etiqueta es demasiado largo (máx. 40 caracteres).');
  }

  if (!color || !HEX_RE.test(color)) {
    errores.push('El color debe ser un hex válido, ej. #E8A33D.');
  }

  return errores;
}
