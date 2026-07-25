import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForJob, syncAutomaticTasksForReel } from './automaticTasks';
import type { Job, JobStatus, Reel } from '../types';

function jobStatusFromReelStatus(status: Reel['status']): JobStatus {
  if (status === 'published') return 'delivered';
  if (status === 'reviewing') return 'in_review';
  if (status === 'paused') return 'blocked';
  if (status === 'discarded') return 'cancelled';
  return 'in_progress';
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function coerceReel(row: Record<string, unknown>): Reel {
  const out = { ...row };
  if (typeof out.is_archived === 'boolean') out.is_archived = out.is_archived ? 1 : 0;
  return out as unknown as Reel;
}

async function syncLinkedJobFromReel(reel: Reel): Promise<void> {
  if (!reel.job_id) return;

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', reel.job_id)
    .eq('is_archived', false)
    .maybeSingle();

  if (!job || !['filmmaker_reels', 'social_video'].includes(job.type as string)) return;

  const now = nowStr();
  const newStatus = jobStatusFromReelStatus(reel.status);

  await supabase.from('jobs').update({
    title: reel.title,
    status: newStatus,
    updated_at: now,
  }).eq('id', reel.job_id);

  await syncAutomaticTasksForJob({ ...job, title: reel.title, status: newStatus, updated_at: now } as unknown as Job);

  await supabase.from('filmmaker_reels').update({
    ideas: reel.idea ?? null,
    scripts: reel.script ?? null,
    recording_date: reel.recording_date ?? null,
    delivery_date: reel.scheduled_date ?? null,
    status: reel.status,
    updated_at: now,
  }).eq('job_id', reel.job_id);
}

export interface ReelFilters {
  search?: string;
  status?: string;
  platform?: string;
  priority?: string;
  project?: string;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export async function getReels(filters: ReelFilters = {}): Promise<Reel[]> {
  let q = supabase.from('reels').select('*').eq('is_archived', false);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.platform) q = q.eq('platform', filters.platform);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.project) q = q.like('project', `%${filters.project}%`);
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(`title.ilike.%${s}%,idea.ilike.%${s}%,script.ilike.%${s}%,notes.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);

  const items = ((data as Record<string, unknown>[]) || []).map(coerceReel);
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if ((a.scheduled_date || '') !== (b.scheduled_date || '')) {
      return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  return items;
}

export async function getReelById(id: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return data ? coerceReel(data as Record<string, unknown>) : null;
}

export async function createReel(data: Partial<Reel>): Promise<Reel> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('reels').insert({
    id,
    job_id: data.job_id ?? null,
    title: data.title || 'Sin título',
    idea: data.idea ?? null,
    script: data.script ?? null,
    project: data.project ?? null,
    platform: data.platform ?? null,
    category: data.category ?? null,
    objective: data.objective ?? null,
    call_to_action: data.call_to_action ?? null,
    recording_date: data.recording_date ?? null,
    editing_date: data.editing_date ?? null,
    scheduled_date: data.scheduled_date ?? null,
    published_date: data.published_date ?? null,
    file_path: data.file_path ?? null,
    reference_link: data.reference_link ?? null,
    publication_link: data.publication_link ?? null,
    notes: data.notes ?? null,
    priority: data.priority || 'medium',
    status: data.status || 'idea',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  const reel = (await getReelById(id))!;
  await syncAutomaticTasksForReel(reel);
  await syncLinkedJobFromReel(reel);
  return reel;
}

const REEL_EDITABLE: (keyof Reel)[] = [
  'job_id', 'title', 'idea', 'script', 'project', 'platform', 'category', 'objective',
  'call_to_action', 'recording_date', 'editing_date', 'scheduled_date',
  'published_date', 'file_path', 'reference_link', 'publication_link',
  'notes', 'priority', 'status',
];

export async function updateReel(id: string, data: Partial<Reel>): Promise<Reel | null> {
  const updateData: Record<string, unknown> = {};
  for (const f of REEL_EDITABLE) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (Object.keys(updateData).length === 0) return getReelById(id);
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('reels').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);

  const reel = await getReelById(id);
  if (reel) {
    await syncAutomaticTasksForReel(reel);
    await syncLinkedJobFromReel(reel);
  }
  return reel;
}

export async function archiveReel(id: string): Promise<void> {
  const { error } = await supabase
    .from('reels')
    .update({ is_archived: true, updated_at: nowStr() })
    .eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  await archiveAutomaticTasksForSource('reel', id);
}

export async function deleteReel(id: string): Promise<void> {
  const { error } = await supabase.from('reels').delete().eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  await deleteAutomaticTasksForSource('reel', id);
}

export async function getReelStats(): Promise<{
  total: number;
  in_production: number;
  scheduled: number;
  published_this_month: number;
}> {
  const { data: all } = await supabase.from('reels').select('id, status, created_at').eq('is_archived', false);
  const rows = all || [];
  const total = rows.length;
  const in_production = rows.filter(r => ['idea', 'script', 'ready_to_record', 'recorded', 'editing', 'reviewing'].includes(r.status as string)).length;
  const scheduled = rows.filter(r => r.status === 'scheduled').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const published_this_month = rows.filter(r => {
    if (r.status !== 'published') return false;
    const d = (r as any).created_at as string;
    return d ? d.slice(0, 7) === thisMonth : false;
  }).length;
  return { total, in_production, scheduled, published_this_month };
}

export async function seedDemoReels(): Promise<void> {
  const { data: existing } = await supabase.from('reels').select('id').limit(1);
  if (existing && existing.length > 0) return;

  const demos: Partial<Reel>[] = [
    {
      title: 'Nuevo beat - adelanto', idea: 'Mostrar proceso de creación del beat en estudio',
      script: 'Apertura con el beat sonando de fondo, plano del estudio, texto mostrando el nombre del beat',
      project: 'Hiphopizados', platform: 'instagram', category: 'musical',
      objective: 'promocion', call_to_action: 'Comenta que te parece',
      recording_date: '2026-07-20', editing_date: '2026-07-22', scheduled_date: '2026-07-25',
      priority: 'high', status: 'scheduled',
    },
    {
      title: 'Tip de mezcla: ecualización', idea: 'Explicar rápido cómo ecualizar una vocal',
      script: '1. Muestra vocal sin ecualizar 2. Aplica EQ 3. Muestra resultado final',
      project: 'CLUBHH', platform: 'instagram', category: 'educational',
      objective: 'engagement', call_to_action: 'Guarda este tip',
      recording_date: '2026-07-18', editing_date: '2026-07-19',
      priority: 'medium', status: 'editing',
    },
    {
      title: 'Behind the scenes - videoclip', idea: 'Mostrar detrás de cámaras de la grabación del videoclip',
      script: 'Toma de la locación, equipo trabajando, artista en acción, resultado final',
      project: 'Hiphopizados', platform: 'instagram', category: 'detras_de_camaras',
      objective: 'contenido', call_to_action: 'Sigue para más',
      recording_date: '2026-07-15',
      priority: 'medium', status: 'recorded',
    },
    {
      title: 'Colaboración con @artista', idea: 'Anunciar colaboración con otro artista',
      project: 'Personal', platform: 'tiktok', category: 'colaboracion',
      objective: 'alcance', call_to_action: 'Prendete del link',
      priority: 'urgent', status: 'idea',
    },
    {
      title: 'Resumen semanal CLUBHH', idea: 'Resumen de los mejores momentos de la semana en CLUBHH',
      project: 'CLUBHH', platform: 'instagram', category: 'weekly',
      objective: 'retencion', call_to_action: 'Síguenos',
      scheduled_date: '2026-07-28',
      priority: 'low', status: 'script',
    },
    {
      title: 'Tutorial: cómo subir tu música', idea: 'Guía rápida para que artistas independientes suban su música a plataformas',
      script: '1. Escoge distribuidora 2. Prepara arte 3. Sube 4. Promociona',
      project: 'HHTickets', platform: 'youtube_shorts', category: 'tutorial',
      objective: 'educational', call_to_action: 'Comparte',
      priority: 'low', status: 'idea',
    },
  ];

  for (const reel of demos) {
    await createReel(reel);
  }
}
