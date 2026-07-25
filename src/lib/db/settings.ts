import { supabase } from '../supabase';

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  if (keys.length === 0) return {};

  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', keys);

  if (error) throw new Error(`DB query error: ${error.message}`);

  const result: Record<string, string | null> = Object.fromEntries(keys.map((key) => [key, null]));
  for (const row of data || []) result[row.key] = row.value ?? null;
  return result;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }, { onConflict: 'key' });

  if (error) throw new Error(`DB upsert error: ${error.message}`);
}

export async function clearTables(tables: string[]): Promise<void> {
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '__none__');
    if (error) throw new Error(`DB clear error (${table}): ${error.message}`);
  }
}
