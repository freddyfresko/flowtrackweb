import { supabase } from '../supabase';
import type { Job } from '../types';

export type VideoclipWithExtras = {
  id: string;
  job_id: string;
  artist: string | null;
  song: string | null;
  idea: string | null;
  concept: string | null;
  references: string | null;
  locations: string | null;
  equipment: string | null;
  preproduction_date: string | null;
  recording_date: string | null;
  first_delivery_date: string | null;
  final_delivery_date: string | null;
  included_changes: number | null;
  requested_changes: string | null;
  project_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  job_title: string;
  job_status: string;
  client_name?: string | null;
};

export type VideoclipFilters = { search?: string; status?: string };

function statusFromVideoclip(data: any = {}): string {
  if (data.status) return data.status;
  if (data.final_delivery_date) return 'final_delivery';
  if (data.first_delivery_date) return 'first_delivery';
  if (data.recording_date) return 'recording';
  if (data.preproduction_date || data.locations || data.equipment) return 'preproduction';
  if (data.idea || data.concept || data.references) return 'concept';
  return 'idea';
}

const STATUS_PRIORITY: Record<string, number> = {
  recording: 0, editing: 1, first_delivery: 2,
  changes: 3, preproduction: 4, concept: 5,
  idea: 6, final_delivery: 7,
};

export async function getVideoclips(filters: VideoclipFilters = {}): Promise<VideoclipWithExtras[]> {
  void backfillVideoclipsFromJobs();

  let q = supabase
    .from('filmmaker_videoclips')
    .select('*, jobs!inner(id, title, status, clients(name))')
    .eq('jobs.type', 'filmmaker_videoclip')
    .eq('jobs.is_archived', false);

  if (filters.status) {
    q = q.eq('status', filters.status);
  }
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(
      `jobs.title.ilike.%${s}%,artist.ilike.%${s}%,song.ilike.%${s}%`
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);

  const rows = (data as any[]) || [];
  const items: VideoclipWithExtras[] = rows.map((row) => ({
    id: row.id,
    job_id: row.job_id,
    artist: row.artist ?? null,
    song: row.song ?? null,
    idea: row.idea ?? null,
    concept: row.concept ?? null,
    references: row.references ?? null,
    locations: row.locations ?? null,
    equipment: row.equipment ?? null,
    preproduction_date: row.preproduction_date ?? null,
    recording_date: row.recording_date ?? null,
    first_delivery_date: row.first_delivery_date ?? null,
    final_delivery_date: row.final_delivery_date ?? null,
    included_changes: row.included_changes ?? null,
    requested_changes: row.requested_changes ?? null,
    project_path: row.project_path ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    job_title: row.jobs?.title ?? '',
    job_status: row.jobs?.status ?? '',
    client_name: row.jobs?.clients?.name ?? null,
  }));

  items.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 8;
    const pb = STATUS_PRIORITY[b.status] ?? 8;
    if (pa !== pb) return pa - pb;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });

  return items;
}

export async function getVideoclipStats(): Promise<{
  total: number;
  active: number;
  preproduction: number;
  recording: number;
  review: number;
  delivered: number;
}> {
  void backfillVideoclipsFromJobs();

  const { data: all, error } = await supabase
    .from('filmmaker_videoclips')
    .select('id, status, jobs!inner(id)')
    .eq('jobs.type', 'filmmaker_videoclip')
    .eq('jobs.is_archived', false);

  if (error) throw new Error(`DB error: ${error.message}`);

  const rows = all || [];
  const total = rows.length;
  const active = rows.filter((r) =>
    ['idea', 'concept', 'preproduction', 'recording', 'editing', 'first_delivery', 'changes'].includes(r.status as string)
  ).length;
  const preproduction = rows.filter((r) =>
    ['concept', 'preproduction'].includes(r.status as string)
  ).length;
  const recording = rows.filter((r) => r.status === 'recording').length;
  const review = rows.filter((r) =>
    ['first_delivery', 'changes'].includes(r.status as string)
  ).length;
  const delivered = rows.filter((r) => r.status === 'final_delivery').length;

  return { total, active, preproduction, recording, review, delivered };
}

export async function updateVideoclip(id: string, data: Partial<VideoclipWithExtras>): Promise<void> {
  const allowed: (keyof VideoclipWithExtras)[] = [
    'artist', 'song', 'idea', 'concept', 'references', 'locations', 'equipment',
    'preproduction_date', 'recording_date', 'first_delivery_date', 'final_delivery_date',
    'included_changes', 'requested_changes', 'project_path', 'status',
  ];
  const updateData: Record<string, unknown> = {};
  for (const field of allowed) {
    if ((data as any)[field] !== undefined) updateData[field] = (data as any)[field];
  }
  if (Object.keys(updateData).length === 0) return;
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase.from('filmmaker_videoclips').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function backfillVideoclipsFromJobs(): Promise<void> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('type', 'filmmaker_videoclip')
    .eq('is_archived', false);

  if (error) throw new Error(`DB error: ${error.message}`);
  for (const job of (jobs || []) as unknown as Job[]) {
    await syncVideoclipForJob(job);
  }
}

export async function syncVideoclipForJob(job: Job, data: any = {}): Promise<void> {
  if (job.type !== 'filmmaker_videoclip' || job.status === 'cancelled' || job.is_archived) return;

  const { data: existing, error: findError } = await supabase
    .from('filmmaker_videoclips')
    .select('*')
    .eq('job_id', job.id)
    .limit(1)
    .maybeSingle();

  if (findError) throw new Error(`DB error: ${findError.message}`);

  const nextStatus = statusFromVideoclip(data);
  const now = new Date().toISOString();

  if (existing) {
    const updateData: Record<string, unknown> = { updated_at: now };
    for (const field of ['artist', 'song', 'idea', 'concept', 'references', 'locations', 'equipment', 'preproduction_date', 'recording_date', 'first_delivery_date', 'final_delivery_date', 'included_changes', 'requested_changes', 'project_path']) {
      if ((data as any)[field] !== undefined && (data as any)[field] !== '') {
        updateData[field] = (data as any)[field];
      }
    }
    if ((data as any).status || nextStatus !== 'idea') {
      updateData.status = nextStatus;
    }
    const { error } = await supabase.from('filmmaker_videoclips').update(updateData).eq('id', existing.id);
    if (error) throw new Error(`DB error: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('filmmaker_videoclips').insert({
    id: crypto.randomUUID(),
    job_id: job.id,
    artist: data.artist || null,
    song: data.song || job.title,
    idea: data.idea || job.description || null,
    concept: data.concept || data.idea || null,
    references: data.references || null,
    locations: data.locations || null,
    equipment: data.equipment || null,
    preproduction_date: data.preproduction_date || null,
    recording_date: data.recording_date || null,
    first_delivery_date: data.first_delivery_date || null,
    final_delivery_date: data.final_delivery_date || null,
    included_changes: data.included_changes || 0,
    requested_changes: data.requested_changes || null,
    project_path: data.project_path || null,
    status: nextStatus,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
}
