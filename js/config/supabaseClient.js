// config/supabaseClient.js
// Cliente único de Supabase, importado por todos los *Service.js.
//
// Fase 2: ya inicializado de verdad (antes era un placeholder = null).
// Si SUPABASE_URL / SUPABASE_ANON_KEY todavía tienen los valores de ejemplo
// de supabaseConfig.js, `supabase` queda en null y se avisa por consola, para
// que el resto de la app pueda seguir cargando (con datos de ejemplo) en vez
// de romperse por completo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';

const configurado =
  Boolean(SUPABASE_URL) && !SUPABASE_URL.includes('TU-PROYECTO') &&
  Boolean(SUPABASE_ANON_KEY) && !SUPABASE_ANON_KEY.includes('TU-ANON-KEY');

export const supabase = configurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!configurado) {
  console.warn(
    '[supabaseClient] Falta configurar SUPABASE_URL / SUPABASE_ANON_KEY en ' +
    'js/config/supabaseConfig.js. La app sigue funcionando con datos de ' +
    'ejemplo, pero todavía no hay conexión real a la base de datos.'
  );
}
