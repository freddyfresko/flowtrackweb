import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseUrl: string = '';
let supabaseAnonKey: string = '';
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase no inicializado. Llama a initRuntimeConfig() primero.'
      );
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

export default supabase;

/**
 * Inicializa la config de Supabase:
 * - En dev (Vite): lee de import.meta.env
 * - En prod (Express): lee de window.__SUPABASE_CONFIG__ (inyectado en el HTML)
 */
export async function initRuntimeConfig(): Promise<void> {
  if (import.meta.env.DEV) {
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return;
  }

  // En producción, la config viene inyectada en el HTML por server.js
  const win = window as any;
  if (win.__SUPABASE_CONFIG__) {
    supabaseUrl = win.__SUPABASE_CONFIG__.supabaseUrl;
    supabaseAnonKey = win.__SUPABASE_CONFIG__.supabaseAnonKey;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan variables de Supabase. ' +
      'Asegúrate de setear VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las env vars del backend.'
    );
  }
}
