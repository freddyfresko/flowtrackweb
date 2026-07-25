import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForJob } from './automaticTasks';
import { syncMusicProjectForAudioJob } from './music';
import { syncVideoclipForJob } from './videoclips';
import { syncYouTubeForJob } from './youtube';
import { syncConsultancyForJob } from './consultancies';
import type { Job } from '../types';

const REEL_STATUS_FLOW = ['idea', 'script', 'ready_to_record', 'recorded', 'editing', 'reviewing', 'scheduled', 'published'];

function linkedReelStatus(data: any = {}): string {
  if (Number(data.delivered_count || 0) > 0) return 'reviewing';
  if (Number(data.edited_count || 0) > 0 || data.status === 'editing') return 'editing';
  if (Number(data.recorded_count || 0) > 0 || data.status === 'recorded') return 'recorded';
  if (data.recording_date) return 'ready_to_record';
  if (data.scripts) return 'script';
  return 'idea';
}

function shouldAdvanceReelStatus(current: string | null | undefined, next: string): boolean {
  return REEL_STATUS_FLOW.indexOf(next) > REEL_STATUS_FLOW.indexOf(current || 'idea');
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function coerceJobRow(row: Record<string, unknown>): JobWithExtras {
  const out = { ...row };
  out.client_name = (out.clients as { name?: string } | null)?.name ?? out.client_name ?? undefined;
  delete out.clients;
  if (typeof out.is_archived === 'boolean') out.is_archived = out.is_archived ? 1 : 0;
  return out as unknown as JobWithExtras;
}

const JOB_STATUS_SORT: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  waiting_client: 2,
  in_review: 3,
  with_changes: 4,
  blocked: 6,
  delivered: 7,
  cancelled: 8,
};

function sortJobs(a: JobWithExtras, b: JobWithExtras): number {
  const sa = JOB_STATUS_SORT[a.status] ?? 9;
  const sb = JOB_STATUS_SORT[b.status] ?? 9;
  if (sa !== sb) return sa - sb;
  return b.created_at.localeCompare(a.created_at);
}

async function countRows(table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);
  return count ?? 0;
}

function sanitizeSearch(value: string): string {
  return value.trim().replace(/%/g, '');
}

export interface JobFilters {
  search?: string;
  type?: string;
  status?: string;
  client_id?: string;
}

export interface JobWithExtras extends Job {
  client_name?: string;
  sub_status?: string;
  sub_title?: string;
}

async function syncContentReelForJob(job: JobWithExtras, data: any = {}): Promise<void> {
  const { data: current, error: getError } = await supabase
    .from('reels')
    .select('*')
    .eq('job_id', job.id)
    .limit(1)
    .maybeSingle();

  if (getError) throw new Error(`DB query error: ${getError.message}`);

  if (!['filmmaker_reels', 'social_video'].includes(job.type) || job.status === 'cancelled' || job.is_archived) {
    if (current) {
      const { error } = await supabase
        .from('reels')
        .update({ is_archived: true, updated_at: nowStr() })
        .eq('id', current.id);
      if (error) throw new Error(`DB update error: ${error.message}`);
    }
    return;
  }

  const nextStatus = linkedReelStatus(data);
  const now = nowStr();
  const notes = ['Creado automáticamente desde Trabajos.', job.notes].filter(Boolean).join('\n\n');

  if (current) {
    const updateData: Record<string, unknown> = {
      job_id: job.id,
      title: job.title,
      updated_at: now,
    };

    if (current.is_archived) updateData.is_archived = false;
    if (data.ideas) updateData.idea = data.ideas;
    if (data.scripts) updateData.script = data.scripts;
    if (data.recording_date) updateData.recording_date = data.recording_date;
    if (data.delivery_date) updateData.scheduled_date = data.delivery_date;
    if (!current.project) updateData.project = job.title;
    if (!current.notes) updateData.notes = notes;
    if (shouldAdvanceReelStatus(current.status, nextStatus)) updateData.status = nextStatus;

    const { error } = await supabase.from('reels').update(updateData).eq('id', current.id);
    if (error) throw new Error(`DB update error: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('reels').insert({
    id: crypto.randomUUID(),
    job_id: job.id,
    title: job.title,
    idea: data.ideas || job.description || null,
    script: data.scripts || null,
    project: job.title,
    platform: 'instagram',
    category: 'promocion',
    objective: 'ventas',
    recording_date: data.recording_date || null,
    scheduled_date: data.delivery_date || null,
    notes,
    priority: 'medium',
    status: nextStatus,
    created_at: now,
    updated_at: now,
    is_archived: false,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);
}

export async function getJobs(filters: JobFilters = {}, limit?: number, offset?: number): Promise<JobWithExtras[]> {
  let q = supabase
    .from('jobs')
    .select('*, clients!left(name)')
    .eq('is_archived', false);

  if (filters.type) q = q.eq('type', filters.type);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.client_id) q = q.eq('client_id', filters.client_id);

  if (limit !== undefined && offset !== undefined) {
    q = q.range(offset, offset + limit - 1);
  }

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);

  let jobs = ((data as Record<string, unknown>[]) || []).map(coerceJobRow);
  if (filters.search) {
    const search = sanitizeSearch(filters.search).toLowerCase();
    jobs = jobs.filter((job) =>
      job.title.toLowerCase().includes(search)
      || (job.description || '').toLowerCase().includes(search)
      || (job.client_name || '').toLowerCase().includes(search)
    );
  }

  return jobs.sort(sortJobs);
}

export async function getJobById(id: string): Promise<JobWithExtras | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, clients!left(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data ? coerceJobRow(data as Record<string, unknown>) : null;
}

export async function getClientsForSelect(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as { id: string; name: string }[];
}

// ─── Create Job ───

export async function createJob(data: Partial<Job>): Promise<Job> {
  const id = crypto.randomUUID();
  const now = nowStr();

  const { error } = await supabase.from('jobs').insert({
    id,
    client_id: data.client_id || null,
    type: data.type || 'other',
    title: data.title || 'Sin título',
    description: data.description || null,
    status: data.status || 'in_progress',
    budget: data.budget || null,
    deposit: data.deposit || null,
    balance: data.balance || null,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
    is_archived: false,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const job = (await getJobById(id))!;
  await syncAutomaticTasksForJob(job);
  await syncContentReelForJob(job);
  await syncMusicProjectForAudioJob(job);
  await syncVideoclipForJob(job);
  await syncYouTubeForJob(job);
  await syncConsultancyForJob(job);
  return job;
}

export async function updateJob(id: string, data: Partial<Job>): Promise<JobWithExtras | null> {
  const updateData: Record<string, unknown> = {};
  const allowed: (keyof Job)[] = ['client_id', 'type', 'title', 'description', 'status', 'budget', 'deposit', 'balance', 'notes'];
  for (const field of allowed) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (Object.keys(updateData).length === 0) return getJobById(id);

  updateData.updated_at = nowStr();

  const { error } = await supabase.from('jobs').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);

  const job = await getJobById(id);
  if (job) {
    await syncAutomaticTasksForJob(job);
    await syncContentReelForJob(job);
    await syncMusicProjectForAudioJob(job);
    await syncVideoclipForJob(job);
    await syncYouTubeForJob(job);
    await syncConsultancyForJob(job);
  }
  return job;
}

export async function archiveJob(id: string): Promise<void> {
  const now = nowStr();
  const updates = [
    supabase.from('jobs').update({ is_archived: true, updated_at: now }).eq('id', id),
    supabase.from('reels').update({ is_archived: true, updated_at: now }).eq('job_id', id),
    supabase.from('music_projects').update({ is_archived: true, updated_at: now }).eq('job_id', id),
    supabase.from('youtube_videos').update({ is_archived: true, updated_at: now }).eq('job_id', id),
    supabase.from('consultancies').update({ is_archived: true, updated_at: now }).eq('job_id', id),
  ];

  for (const result of await Promise.all(updates)) {
    if (result.error) throw new Error(`DB archive error: ${result.error.message}`);
  }

  await archiveAutomaticTasksForSource('job', id);
}

export async function deleteJob(id: string): Promise<void> {
  const [musicProjectsResult, audioJobsResult] = await Promise.all([
    supabase.from('music_projects').select('id').eq('job_id', id),
    supabase.from('audio_jobs').select('id').eq('job_id', id),
  ]);

  if (musicProjectsResult.error) throw new Error(`DB query error: ${musicProjectsResult.error.message}`);
  if (audioJobsResult.error) throw new Error(`DB query error: ${audioJobsResult.error.message}`);

  const musicProjectIds = (musicProjectsResult.data || []).map((row) => row.id);
  const audioJobIds = (audioJobsResult.data || []).map((row) => row.id);

  if (musicProjectIds.length > 0) {
    const { error } = await supabase.from('music_tracks').delete().in('music_project_id', musicProjectIds);
    if (error) throw new Error(`DB delete error: ${error.message}`);
  }

  if (audioJobIds.length > 0) {
    const { error } = await supabase.from('audio_tracks').delete().in('audio_job_id', audioJobIds);
    if (error) throw new Error(`DB delete error: ${error.message}`);
  }

  const deletes = [
    supabase.from('income').delete().eq('job_id', id),
    supabase.from('expenses').delete().eq('job_id', id),
    supabase.from('receivables').delete().eq('job_id', id),
    supabase.from('work_sessions').delete().eq('job_id', id),
    supabase.from('tasks').delete().eq('job_id', id),
    supabase.from('reels').delete().eq('job_id', id),
    supabase.from('youtube_videos').delete().eq('job_id', id),
    supabase.from('consultancies').delete().eq('job_id', id),
    supabase.from('music_projects').delete().eq('job_id', id),
    supabase.from('filmmaker_videoclips').delete().eq('job_id', id),
    supabase.from('filmmaker_reels').delete().eq('job_id', id),
    supabase.from('audio_jobs').delete().eq('job_id', id),
    supabase.from('jobs').delete().eq('id', id),
  ];

  for (const result of await Promise.all(deletes)) {
    if (result.error) throw new Error(`DB delete error: ${result.error.message}`);
  }

  await deleteAutomaticTasksForSource('job', id);
}

// ─── Sub-type queries ───

async function getRecordByJobId(table: string, jobId: string): Promise<any> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data || null;
}

async function upsertRecordByJobId(table: string, jobId: string, data: any): Promise<void> {
  const existing = await getRecordByJobId(table, jobId);
  const now = nowStr();

  if (existing) {
    const { error } = await supabase
      .from(table)
      .update({ ...data, updated_at: now })
      .eq('job_id', jobId);
    if (error) throw new Error(`DB update error: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from(table)
    .insert({
      ...data,
      id: crypto.randomUUID(),
      job_id: jobId,
      created_at: now,
      updated_at: now,
    });

  if (error) throw new Error(`DB insert error: ${error.message}`);
}

export async function getVideoclip(jobId: string): Promise<any> {
  return getRecordByJobId('filmmaker_videoclips', jobId);
}

export async function saveVideoclip(jobId: string, data: any): Promise<void> {
  await upsertRecordByJobId('filmmaker_videoclips', jobId, data);
  const job = await getJobById(jobId);
  if (job) await syncVideoclipForJob(job, data);
}

export async function getFilmmakerReel(jobId: string): Promise<any> {
  return getRecordByJobId('filmmaker_reels', jobId);
}

export async function saveFilmmakerReel(jobId: string, data: any): Promise<void> {
  await upsertRecordByJobId('filmmaker_reels', jobId, data);
  const job = await getJobById(jobId);
  if (job) await syncContentReelForJob(job, data);
}

export async function getAudioJob(jobId: string): Promise<any> {
  return getRecordByJobId('audio_jobs', jobId);
}

export async function saveAudioJob(jobId: string, data: any): Promise<void> {
  await upsertRecordByJobId('audio_jobs', jobId, data);
  const job = await getJobById(jobId);
  if (job) await syncMusicProjectForAudioJob(job, data);
}

export async function getAudioTracks(audioJobId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('audio_tracks')
    .select('*')
    .eq('audio_job_id', audioJobId)
    .order('track_number', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data || [];
}

export async function saveAudioTracks(audioJobId: string, tracks: { title: string; track_number: number }[]): Promise<void> {
  const { error: deleteError } = await supabase.from('audio_tracks').delete().eq('audio_job_id', audioJobId);
  if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);

  if (tracks.length === 0) return;

  const now = nowStr();
  const { error } = await supabase.from('audio_tracks').insert(
    tracks.map((track) => ({
      id: crypto.randomUUID(),
      audio_job_id: audioJobId,
      title: track.title,
      track_number: track.track_number,
      created_at: now,
    }))
  );

  if (error) throw new Error(`DB insert error: ${error.message}`);
}

// ─── Stats ───

export async function getJobStats(): Promise<{
  active: number; pending_delivery: number; payment_due: number; delivered_this_month: number;
}> {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // e.g. "2026-07"
  // Last day of current month (day 0 of next month = last day of current)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${month}-${lastDay}`;

  const [active, pending, paymentDue, delivered] = await Promise.all([
    countRows('jobs', (q) => q.in('status', ['pending', 'in_progress', 'waiting_client', 'in_review', 'with_changes', 'blocked']).eq('is_archived', false)),
    countRows('jobs', (q) => q.in('status', ['pending', 'in_progress', 'waiting_client']).eq('is_archived', false)),
    countRows('jobs', (q) => q.gt('balance', 0).not('status', 'in', '("cancelled","archived")').eq('is_archived', false)),
    countRows('jobs', (q) => q.eq('status', 'delivered').gte('updated_at', `${month}-01`).lte('updated_at', monthEnd).eq('is_archived', false)),
  ]);

  return { active, pending_delivery: pending, payment_due: paymentDue, delivered_this_month: delivered };
}

// ─── Demo ───

export async function seedDemoJobs(): Promise<void> {
  const existing = await countRows('jobs');
  if (existing > 0) return;

  const clients = await getClientsForSelect();
  const c = (i: number) => clients[i % clients.length]?.id || null;
  const cn = (i: number) => clients[i % clients.length]?.name || 'Cliente';

  // Videoclip
  const j1 = await createJob({ client_id: c(0), type: 'filmmaker_videoclip', title: `Videoclip "${cn(0)} - Nuevo Sencillo"`, status: 'in_progress', budget: 800000, deposit: 300000, balance: 500000 });
  await saveVideoclip(j1.id, { artist: cn(0), song: 'Nuevo Sencillo', idea: 'Concepto urbano nocturno', locations: 'Estación Mapocho, Barrio Yungay', recording_date: '2026-07-28', status: 'preproduction' });

  // Reels package
  const j2 = await createJob({ client_id: c(1), type: 'filmmaker_reels', title: `Paquete de reels - ${cn(1)}`, status: 'in_progress', budget: 350000, deposit: 150000, balance: 200000 });
  await saveFilmmakerReel(j2.id, { quantity: 4, total_value: 350000, payments: 150000, balance: 200000, recorded_count: 3, edited_count: 2, delivered_count: 0, status: 'editing' });

  // Mix & Master - canción
  const j3 = await createJob({ client_id: c(2), type: 'audio_mix', title: `Mezcla - "${cn(2)} - Track Nuevo"`, status: 'in_progress', budget: 200000, deposit: 100000, balance: 100000 });
  await saveAudioJob(j3.id, { audio_type: 'song', artist: cn(2), project_name: 'Track Nuevo', total_tracks: 1, bpm: '90', key: 'Am', status: 'mixing' });

  // EP
  const j4 = await createJob({ client_id: c(3), type: 'audio_ep', title: `EP "${cn(3)} - Proyecto EP"`, status: 'in_progress', budget: 600000, deposit: 200000, balance: 400000 });
  await saveAudioJob(j4.id, { audio_type: 'ep', artist: cn(3), project_name: 'Proyecto EP', total_tracks: 5, status: 'waiting_stems' });

  // Delivered
  const j5 = await createJob({ client_id: c(0), type: 'filmmaker_videoclip', title: `Videoclip "${cn(0)} - Track Anterior"`, status: 'delivered', budget: 700000, deposit: 700000, balance: 0 });
  await saveVideoclip(j5.id, { artist: cn(0), song: 'Track Anterior', status: 'final_delivery' });
}
