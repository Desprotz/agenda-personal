// services/authService.js
// Fase 2: conexión con Supabase Auth.
//
// Esta app es de un solo usuario y, por decisión del 2026-07-22 (ver
// PROYECTO.md, bitácora), NO tiene pantalla de login. Para que RLS siga
// protegiendo los datos (cada fila filtrada por auth.uid() = usuario_id) se
// usa un inicio de sesión ANÓNIMO de Supabase: la primera vez que se abre la
// app en un dispositivo, Supabase crea un usuario anónimo y guarda la sesión
// en el navegador; en visitas siguientes reutiliza esa misma sesión sin
// pedir nada. No hay contraseña ni correo de por medio.
//
// Importante (documentado también en PROYECTO.md): esto ata los datos a
// *ese dispositivo/navegador*. Si se borran datos de sitio en Safari o se
// reinstala la PWA, se crea una identidad anónima nueva y ya no se ven los
// datos viejos (siguen en la base de datos, ligados al usuario_id anterior,
// pero no accesibles sin esa sesión). Si más adelante se quiere usar desde
// varios dispositivos, se puede "vincular" la sesión anónima a un email sin
// perder los datos (supabase.auth.updateUser + linkIdentity) — evaluar si
// hace falta cuando llegue el momento.

import { supabase } from '../config/supabaseClient.js';

let sesionListo = null;

/**
 * Garantiza que exista una sesión de Supabase (la existente, o crea una
 * anónima nueva). Hay que esperar (`await`) esto antes de leer/escribir en
 * cualquier tabla, porque las políticas RLS dependen de auth.uid().
 * Devuelve la sesión, o null si Supabase no está configurado o falló.
 */
export async function asegurarSesion() {
  if (!supabase) return null;
  if (sesionListo) return sesionListo;

  sesionListo = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[authService] No se pudo iniciar sesión anónima:', error.message);
      return null;
    }
    return data.session;
  })();

  return sesionListo;
}

/** Devuelve el id del usuario actual (anónimo o no), o null si no hay sesión. */
export async function obtenerUsuarioId() {
  const session = await asegurarSesion();
  return session?.user?.id ?? null;
}

/** Suscribirse a cambios de sesión (útil para depurar o mostrar estado en Ajustes). */
export function alCambiarSesion(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evento, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
