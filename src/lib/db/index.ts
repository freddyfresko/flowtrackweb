// Database layer — native Supabase client entrypoint
// CRUD lives in feature modules under src/lib/db/*.ts.

import { supabase } from '../supabase';

export async function testConnection(): Promise<string> {
  const { error } = await supabase.from('settings').select('key').limit(1);
  if (error) throw new Error(`DB Error: ${error.message}`);
  return 'Supabase — connected';
}

// No-op saveDb (was used by sql.js to persist to localStorage)
// Kept for backward compat — Supabase persists automatically.
export function saveDb(): void {
  // No-op
}
