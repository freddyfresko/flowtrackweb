import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForClient } from './automaticTasks';
import { deleteFinanceForSource } from './finance';
import type { Client } from '../types';

export interface ClientFilters {
  search?: string;
  status?: string;
}

async function fallbackGetClients(filters: ClientFilters = {}, limit?: number, offset?: number): Promise<Client[]> {
  let q = supabase
    .from('clients')
    .select('*')
    .eq('is_archived', false);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(`name.ilike.%${s}%,artist_name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  if (limit !== undefined && offset !== undefined) q = q.range(offset, offset + limit - 1);
  q = q.order('name', { ascending: true });

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: \${error.message}`);

  const clients = (data || []) as Client[];
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);
  const [jobResult, conResult, recResult] = await Promise.all([
    supabase.from('jobs').select('client_id').in('client_id', clientIds).eq('is_archived', false),
    supabase.from('consultancies').select('client_id').in('client_id', clientIds).eq('is_archived', false),
    supabase.from('receivables').select('client_id, balance').in('client_id', clientIds).in('status', ['pending', 'partial', 'overdue']),
  ]);

  const jobCountMap = new Map<string, number>();
  for (const j of jobResult.data || []) jobCountMap.set(j.client_id, (jobCountMap.get(j.client_id) || 0) + 1);
  const conCountMap = new Map<string, number>();
  for (const c of conResult.data || []) conCountMap.set(c.client_id, (conCountMap.get(c.client_id) || 0) + 1);
  const debtMap = new Map<string, number>();
  for (const r of recResult.data || []) debtMap.set(r.client_id, (debtMap.get(r.client_id) || 0) + Number(r.balance || 0));

  return clients.map((client) => ({
    ...client,
    job_count: jobCountMap.get(client.id) || 0,
    consultancy_count: conCountMap.get(client.id) || 0,
    total_debt: debtMap.get(client.id) || 0,
  })) as (Client & { job_count: number; consultancy_count: number; total_debt: number })[];
}

export async function getClients(filters: ClientFilters = {}, limit?: number, offset?: number): Promise<Client[]> {
  let q = supabase
    .from('clients')
    .select('*')
    .eq('is_archived', false);

  if (filters.status) {
    q = q.eq('status', filters.status);
  }
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(
      `name.ilike.%${s}%,artist_name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
    );
  }

  if (limit !== undefined && offset !== undefined) {
    q = q.range(offset, offset + limit - 1);
  }

  q = q.order('name', { ascending: true });

  // Use RPC: single query with LEFT JOINs
  const { data, error } = await supabase.rpc('get_clients_with_counts', {
    p_search: filters.search || null,
    p_status: filters.status || null,
  });

  if (error) {
    // Fallback: Native query with JS aggregation if RPC not deployed yet
    console.warn('[clients] RPC not available, using fallback:', error.message);
    return fallbackGetClients(filters, limit, offset);
  }

  return (data || []) as unknown as (Client & { job_count: number; consultancy_count: number; total_debt: number })[];
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data as Client | null;
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { error } = await supabase.from('clients').insert({
    id,
    name: data.name || 'Sin nombre',
    artist_name: data.artist_name ?? null,
    company: data.company ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    social_media: data.social_media ?? null,
    preferred_contact: data.preferred_contact ?? null,
    notes: data.notes ?? null,
    first_contact_date: data.first_contact_date ?? null,
    status: data.status || 'prospect',
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const client = (await getClientById(id))!;
  await syncAutomaticTasksForClient(client);
  return client;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
  const allowedFields: (keyof Client)[] = [
    'name', 'artist_name', 'company', 'phone', 'email', 'social_media',
    'preferred_contact', 'notes', 'first_contact_date', 'status',
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) return getClientById(id);

  updateData.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(`DB update error: ${error.message}`);

  const client = await getClientById(id);
  if (client) await syncAutomaticTasksForClient(client);
  return client;
}

export async function archiveClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    .eq('id', id);

  if (error) throw new Error(`DB archive error: ${error.message}`);
  await archiveAutomaticTasksForSource('client', id);
}

export async function deleteClient(id: string): Promise<void> {
  const { error: err1 } = await supabase
    .from('income')
    .delete()
    .eq('client_id', id);
  if (err1) throw new Error(`DB delete income error: ${err1.message}`);

  const { error: err2 } = await supabase
    .from('receivables')
    .delete()
    .eq('client_id', id);
  if (err2) throw new Error(`DB delete receivables error: ${err2.message}`);

  const { error: err3 } = await supabase
    .from('quotes')
    .delete()
    .eq('client_id', id);
  if (err3) throw new Error(`DB delete quotes error: ${err3.message}`);

  const { error: err4 } = await supabase
    .from('jobs')
    .update({ client_id: null })
    .eq('client_id', id);
  if (err4) throw new Error(`DB update jobs error: ${err4.message}`);

  const { error: err5 } = await supabase
    .from('consultancies')
    .update({ client_id: null })
    .eq('client_id', id);
  if (err5) throw new Error(`DB update consultancies error: ${err5.message}`);

  const { error: err6 } = await supabase
    .from('tasks')
    .update({ client_id: null })
    .eq('client_id', id);
  if (err6) throw new Error(`DB update tasks error: ${err6.message}`);

  const { error: err7 } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  if (err7) throw new Error(`DB delete client error: ${err7.message}`);

  await deleteAutomaticTasksForSource('client', id);
  await deleteFinanceForSource('client', id);
}

export async function getClientStats(): Promise<{ total: number; active: number; with_debt: number }> {
  const { count: total, error: err1 } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false);

  if (err1) throw new Error(`DB query error: ${err1.message}`);

  const { count: active, error: err2 } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'frequent'])
    .eq('is_archived', false);

  if (err2) throw new Error(`DB query error: ${err2.message}`);

  // DISTINCT count via JS since Supabase doesn't support COUNT(DISTINCT ...)
  const { data: receivables, error: err3 } = await supabase
    .from('receivables')
    .select('client_id')
    .in('status', ['pending', 'partial', 'overdue'])
    .not('client_id', 'is', null);

  if (err3) throw new Error(`DB query error: ${err3.message}`);

  const uniqueClients = new Set((receivables || []).map((r) => r.client_id));

  return {
    total: total ?? 0,
    active: active ?? 0,
    with_debt: uniqueClients.size,
  };
}

/** Seed demo clients */
export async function seedDemoClients(): Promise<void> {
  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  if (count && count > 0) return;

  const demos: {
    name: string; artist_name: string | null; company: string | null;
    phone: string; email: string; status: Client['status'];
    first_contact_date: string; notes: string;
  }[] = [
    { name: 'Andrea Martínez', artist_name: 'Andre MC', company: 'Flow Music', phone: '+56 9 1234 5678', email: 'andre@flowmusic.cl', status: 'active' as Client['status'], first_contact_date: '2025-11-15', notes: 'Cliente frecuente, reels mensuales' },
    { name: 'Carlos Soto', artist_name: 'Kastro', company: null, phone: '+56 9 8765 4321', email: 'kastro@example.com', status: 'active' as Client['status'], first_contact_date: '2026-01-20', notes: 'Videoclip en producción' },
    { name: 'Daniela Rojas', artist_name: 'Dani Flow', company: 'Independiente', phone: '+56 9 5555 1234', email: 'dani@example.com', status: 'frequent' as Client['status'], first_contact_date: '2025-08-10', notes: 'Asesoría mensual de marketing musical' },
    { name: 'Estudio Sur', artist_name: null, company: 'Estudio Sur Producciones', phone: '+56 2 2345 6789', email: 'info@estudiosur.cl', status: 'active' as Client['status'], first_contact_date: '2026-03-05', notes: 'Mezcla y mastering, varios artistas' },
    { name: 'Francisca Lagos', artist_name: 'Franka', company: null, phone: '+56 9 7777 8888', email: 'franka@example.com', status: 'prospect' as Client['status'], first_contact_date: '2026-06-01', notes: 'Contactó por redes, interesada en videoclip' },
    { name: 'Gabriel Torres', artist_name: 'Gabo', company: 'Torres Music', phone: '+56 9 3333 4444', email: 'gabo@torresmusic.cl', status: 'inactive' as Client['status'], first_contact_date: '2025-05-20', notes: 'Proyecto pausado, retomar en septiembre' },
  ];

  for (const client of demos) {
    await createClient(client);
  }
}
