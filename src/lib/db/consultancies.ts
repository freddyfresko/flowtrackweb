import { supabase } from '../supabase';
import type { Job } from '../types';
import {
  archiveAutomaticTasksForSource,
  deleteAutomaticTasksForSource,
  syncAutomaticTasksForConsultancy,
} from './automaticTasks';
import { deleteFinanceForSource } from './finance';

export interface ConsultancyFilters {
  search?: string;
  status?: string;
  payment_status?: string;
}

export async function getConsultancies(
  filters: ConsultancyFilters = {}
): Promise<any[]> {

  let q = supabase
    .from('consultancies')
    .select('*, clients(name)')
    .eq('is_archived', false);

  if (filters.status) {
    q = q.eq('status', filters.status);
  }
  if (filters.payment_status) {
    q = q.eq('payment_status', filters.payment_status);
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    q = q.or(
      `topic.ilike.${s},contact_name.ilike.${s},clients.name.ilike.${s}`
    );
  }

  q = q.order('date', { ascending: false }).order('time', { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error('getConsultancies error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  return (data || []).map(({ clients, ...row }: any) => ({
    ...row,
    client_name: clients?.name || null,
  }));
}

export async function getConsultancyById(id: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('consultancies')
    .select('*, clients(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getConsultancyById error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  if (!data) return null;

  const { clients, ...row } = data as any;
  return { ...row, client_name: clients?.name || null };
}

export async function createConsultancy(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const payload = {
    id,
    job_id: data.job_id || null,
    client_id: data.client_id || null,
    contact_name: data.contact_name || null,
    topic: data.topic || 'Sin tema',
    objective: data.objective || null,
    date: data.date || now.slice(0, 10),
    time: data.time || null,
    duration: data.duration ? parseInt(data.duration, 10) : null,
    contact_method: data.contact_method || null,
    payment_status: data.payment_status || 'pending',
    amount: data.amount ? parseFloat(data.amount) : null,
    pre_notes: data.pre_notes || null,
    diagnosis: data.diagnosis || null,
    agreements: data.agreements || null,
    next_steps: data.next_steps || null,
    follow_up: data.follow_up || null,
    files: data.files || null,
    status: data.status || 'requested',
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('consultancies').insert(payload);
  if (error) {
    console.error('createConsultancy error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  const consultancy = await getConsultancyById(id);
  if (consultancy) await syncAutomaticTasksForConsultancy(consultancy);
  return consultancy;
}

export async function updateConsultancy(
  id: string,
  data: any
): Promise<any | null> {
  const allowed = [
    'job_id',
    'client_id',
    'contact_name',
    'topic',
    'objective',
    'date',
    'time',
    'duration',
    'contact_method',
    'payment_status',
    'amount',
    'pre_notes',
    'diagnosis',
    'agreements',
    'next_steps',
    'follow_up',
    'files',
    'status',
  ];

  const updates: Record<string, unknown> = {};
  for (const f of allowed) {
    if (data[f] !== undefined) {
      updates[f] =
        f === 'duration' || f === 'amount'
          ? data[f]
            ? parseFloat(data[f])
            : null
          : data[f];
    }
  }

  if (Object.keys(updates).length === 0) return getConsultancyById(id);

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('consultancies')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('updateConsultancy error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  const consultancy = await getConsultancyById(id);
  if (consultancy) await syncAutomaticTasksForConsultancy(consultancy);
  return consultancy;
}

export async function archiveConsultancy(id: string): Promise<void> {
  const { error } = await supabase
    .from('consultancies')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('archiveConsultancy error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  await archiveAutomaticTasksForSource('consultancy', id);
}

export async function deleteConsultancy(id: string): Promise<void> {
  const { error } = await supabase
    .from('consultancies')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteConsultancy error:', error);
    throw new Error(`DB error: ${error.message}`);
  }

  await deleteAutomaticTasksForSource('consultancy', id);
  await deleteFinanceForSource('consultancy', id);
}

export async function syncConsultancyForJob(_job: Job, _data: any = {}): Promise<void> {
  // Jobs module deprecated — no-op
}

export async function backfillConsultanciesFromJobs(): Promise<void> {
  // Jobs module deprecated — no-op
}

export async function getConsultancyStats(): Promise<{
  total: number;
  upcoming: number;
  pending_payment: number;
  completed_this_month: number;
}> {

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startOfMonth = `${year}-${month}-01`;
  const nextMonthDate = new Date(year, now.getMonth() + 1, 1);
  const startOfNextMonth = nextMonthDate.toISOString().slice(0, 10);

  const notArchived = supabase
    .from('consultancies')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false);

  const [{ count: total }, { count: upcoming }, { count: pendingPay }, {
    count: completed,
  }] = await Promise.all([
    notArchived,
    notArchived.then(() =>
      supabase
        .from('consultancies')
        .select('*', { count: 'exact', head: true })
        .in('status', ['requested', 'scheduled', 'confirmed'])
        .eq('is_archived', false)
    ),
    notArchived.then(() =>
      supabase
        .from('consultancies')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pending')
        .not('status', 'eq', 'cancelled')
        .eq('is_archived', false)
    ),
    notArchived.then(() =>
      supabase
        .from('consultancies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('date', startOfMonth)
        .lt('date', startOfNextMonth)
        .eq('is_archived', false)
    ),
  ]);

  return {
    total: total ?? 0,
    upcoming: upcoming ?? 0,
    pending_payment: pendingPay ?? 0,
    completed_this_month: completed ?? 0,
  };
}

export async function seedDemoConsultancies(): Promise<void> {
  const { count, error: countError } = await supabase
    .from('consultancies')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('seedDemoConsultancies count error:', countError);
    throw new Error(`DB error: ${countError.message}`);
  }

  if (count && count > 0) return;

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_archived', false)
    .limit(3);

  if (clientsError) {
    console.error('seedDemoConsultancies clients error:', clientsError);
    throw new Error(`DB error: ${clientsError.message}`);
  }

  const c = (i: number) => (clients ? clients[i] || null : null);

  await createConsultancy({
    client_id: c(0)?.id,
    contact_name: c(0)?.name,
    topic: 'Estrategia de lanzamiento',
    objective: 'Planificar lanzamiento del sencillo',
    date: '2026-08-05',
    time: '15:00',
    duration: 60,
    contact_method: 'zoom',
    amount: 80000,
    payment_status: 'pending',
    pre_notes: 'Cliente quiere lanzar en agosto',
    status: 'scheduled',
  });
  await createConsultancy({
    client_id: c(1)?.id,
    contact_name: c(1)?.name,
    topic: 'Asesoría de mixing',
    objective: 'Revisar mezcla del EP',
    date: '2026-07-28',
    time: '11:00',
    duration: 90,
    contact_method: 'presencial',
    amount: 120000,
    payment_status: 'paid',
    pre_notes: 'Traer stems y referencias',
    diagnosis: 'Mezcla necesita más claridad en bajos',
    agreements: 'Enviar correcciones en una semana',
    status: 'completed',
  });
  await createConsultancy({
    client_id: c(2)?.id,
    contact_name: c(2)?.name,
    topic: 'Mentoría redes sociales',
    objective: 'Crear plan de contenido mensual',
    date: '2026-08-10',
    time: '10:00',
    duration: 60,
    contact_method: 'telegram',
    amount: 60000,
    payment_status: 'pending',
    status: 'requested',
  });
}
