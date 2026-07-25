import { supabase } from '../supabase';
import type { Job, MusicProject, MusicTrack } from '../types';

export type MusicProjectWithExtras = MusicProject & {
  client_name?: string | null;
  track_count?: number;
  done_tracks?: number;
};

export type MusicProjectFilters = {
  source_type?: 'personal' | 'client_job';
  status?: string;
  search?: string;
};

const AUDIO_JOB_TYPES = ['music_production', 'audio_mix', 'audio_mastering', 'audio_ep', 'audio_album'];
const ACTIVE_STATUSES = ['idea', 'preproduction', 'recording', 'mixing', 'mastering', 'review'];

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function isAudioJobType(type: string | null | undefined): boolean {
  return !!type && AUDIO_JOB_TYPES.includes(type);
}

function projectTypeFromJob(type: string | null | undefined, audioType?: string | null): MusicProject['project_type'] {
  if (audioType && ['single', 'ep', 'album', 'beat', 'mix', 'mastering', 'recording', 'other'].includes(audioType)) return audioType as MusicProject['project_type'];
  if (type === 'audio_mastering') return 'mastering';
  if (type === 'music_production') return 'recording';
  if (type === 'audio_ep') return 'ep';
  if (type === 'audio_album') return 'album';
  if (type === 'audio_mix') return 'mix';
  return 'other';
}

function statusFromAudio(data: any = {}): MusicProject['status'] {
  const status = data.status;
  if (status === 'delivered' || status === 'final_delivery') return 'delivered';
  if (status === 'mastering') return 'mastering';
  if (status === 'mixing') return 'mixing';
  if (status === 'review' || status === 'changes') return 'review';
  if (status === 'recording') return 'recording';
  if (status === 'waiting_stems') return 'preproduction';
  return 'preproduction';
}

// ─── Helpers ───

function flattenProjectRow(row: Record<string, unknown>): MusicProjectWithExtras {
  const result = { ...row } as Record<string, unknown>;
  result.client_name = (row.clients as { name?: string } | null)?.name ?? undefined;
  delete result.clients;
  return result as unknown as MusicProjectWithExtras;
}

const STATUS_ORDER: Record<string, number> = {
  review: 0, mixing: 1, mastering: 2, recording: 3,
  preproduction: 4, idea: 5, delivered: 6,
};

function sortByStatusDate(a: MusicProjectWithExtras, b: MusicProjectWithExtras): number {
  const oa = STATUS_ORDER[a.status] ?? 7;
  const ob = STATUS_ORDER[b.status] ?? 7;
  if (oa !== ob) return oa - ob;
  return (b.updated_at || '').localeCompare(a.updated_at || '');
}

async function getTrackCounts(projectIds: string[]): Promise<{ count: Record<string, number>; done: Record<string, number> }> {
  const count: Record<string, number> = {};
  const done: Record<string, number> = {};
  if (projectIds.length === 0) return { count, done };

  const { data: tracks, error } = await supabase
    .from('music_tracks')
    .select('music_project_id, status')
    .in('music_project_id', projectIds);

  if (error) throw new Error(`DB error: ${error.message}`);

  for (const t of tracks || []) {
    const pid = t.music_project_id as string;
    count[pid] = (count[pid] || 0) + 1;
    if (typeof t.status === 'string' && ['mixed', 'mastered', 'delivered'].includes(t.status)) {
      done[pid] = (done[pid] || 0) + 1;
    }
  }
  return { count, done };
}

// ─── Backfill ───

export async function backfillMusicProjectsFromAudioJobs(): Promise<void> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      *,
      clients!left(name),
      audio_jobs!left(*)
    `)
    .eq('is_archived', false)
    .in('type', ['music_production', 'audio_mix', 'audio_mastering', 'audio_ep', 'audio_album']);

  if (error) throw new Error(`DB error: ${error.message}`);

  for (const row of (jobs || []) as Record<string, unknown>[]) {
    const { data: existing } = await supabase
      .from('music_projects')
      .select('id')
      .eq('job_id', row.id)
      .maybeSingle();
    if (existing) continue;

    const audioRaw = row.audio_jobs;
    const audio = (Array.isArray(audioRaw) ? audioRaw[0] : audioRaw) || {};
    const client = (row.clients as { name?: string } | null) || null;

    await createMusicProject({
      job_id: row.id as string,
      client_id: (row.client_id as string) || null,
      source_type: 'client_job',
      title: (audio.project_name as string) || (row.title as string),
      artist: (audio.artist as string) || client?.name || null,
      project_type: projectTypeFromJob(row.type as string, audio.audio_type as string),
      status: statusFromAudio({ status: audio.status }),
      priority: 'medium',
      start_date: ((row.created_at as string)?.slice(0, 10)) || null,
      target_date: null,
      total_tracks: (audio.total_tracks as number) ?? null,
      bpm: (audio.bpm != null ? String(audio.bpm) : null) as string | null,
      key: (audio.key as string) ?? null,
      musical_refs: (audio.musical_refs as string) ?? null,
      client_observations: (audio.client_observations as string) || (row.description as string) || null,
      stems_path: (audio.stems_path as string) || null,
      session_path: (audio.sessions_path as string) || null,
      exports_path: (audio.final_files_path as string) || null,
      notes: 'Migrado automáticamente desde trabajo de audio.',
    });
  }
}

// ─── Projects CRUD ───

export async function getMusicProjects(filters: MusicProjectFilters = {}): Promise<MusicProjectWithExtras[]> {
  void backfillMusicProjectsFromAudioJobs();

  let q = supabase
    .from('music_projects')
    .select('*, clients!left(name)')
    .eq('is_archived', false);

  if (filters.source_type) q = q.eq('source_type', filters.source_type);
  if (filters.status) q = q.eq('status', filters.status);

  const { data, error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);

  let rows = ((data || []) as Record<string, unknown>[]).map(flattenProjectRow);

  // JS-side search (covers clients.name which supabase .or() can't reach cross-table)
  if (filters.search) {
    const s = filters.search.replace(/%/g, '').toLowerCase();
    rows = rows.filter(r =>
      (r.title && r.title.toLowerCase().includes(s)) ||
      (r.artist && r.artist.toLowerCase().includes(s)) ||
      (r.client_name && r.client_name.toLowerCase().includes(s))
    );
  }

  // Compute track counts in bulk
  const ids = rows.map(r => r.id);
  const { count: trackCounts, done: doneTrackCounts } = await getTrackCounts(ids);

  const results = rows.map(r => ({
    ...r,
    track_count: trackCounts[r.id] || 0,
    done_tracks: doneTrackCounts[r.id] || 0,
  }));

  results.sort(sortByStatusDate);
  return results;
}

export async function getMusicProjectById(id: string): Promise<MusicProjectWithExtras | null> {
  const { data, error } = await supabase
    .from('music_projects')
    .select('*, clients!left(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data) return null;

  const result = flattenProjectRow(data as Record<string, unknown>);

  const { count: trackCount, error: countErr } = await supabase
    .from('music_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('music_project_id', id);

  if (countErr) throw new Error(`DB error: ${countErr.message}`);
  result.track_count = trackCount || 0;

  return result;
}

export async function createMusicProject(data: Partial<MusicProject>): Promise<MusicProjectWithExtras> {
  const id = crypto.randomUUID();
  const now = nowStr();

  const { error } = await supabase.from('music_projects').insert({
    id,
    job_id: data.job_id || null,
    client_id: data.client_id || null,
    source_type: data.source_type || 'personal',
    title: data.title || 'Sin título',
    artist: data.artist || null,
    project_type: data.project_type || 'single',
    status: data.status || 'idea',
    priority: data.priority || 'medium',
    start_date: data.start_date || now.slice(0, 10),
    target_date: data.target_date || null,
    total_tracks: data.total_tracks || null,
    bpm: data.bpm || null,
    key: data.key || null,
    musical_refs: data.musical_refs || null,
    client_observations: data.client_observations || null,
    stems_path: data.stems_path || null,
    session_path: data.session_path || null,
    exports_path: data.exports_path || null,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB error: ${error.message}`);
  return (await getMusicProjectById(id))!;
}

const MUSIC_PROJECT_EDITABLE: (keyof MusicProject)[] = [
  'job_id', 'client_id', 'source_type', 'title', 'artist', 'project_type', 'status', 'priority',
  'start_date', 'target_date', 'total_tracks', 'bpm', 'key', 'musical_refs', 'client_observations',
  'stems_path', 'session_path', 'exports_path', 'notes',
];

export async function updateMusicProject(id: string, data: Partial<MusicProject>): Promise<MusicProjectWithExtras | null> {
  const updateData: Record<string, unknown> = {};
  for (const field of MUSIC_PROJECT_EDITABLE) {
    if (data[field] !== undefined) updateData[field] = data[field] as unknown;
  }
  if (Object.keys(updateData).length === 0) return getMusicProjectById(id);

  updateData.updated_at = nowStr();
  const { error } = await supabase.from('music_projects').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  return getMusicProjectById(id);
}

export async function archiveMusicProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_projects')
    .update({ is_archived: true, updated_at: nowStr() })
    .eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function deleteMusicProject(id: string): Promise<void> {
  const { error: err1 } = await supabase.from('music_tracks').delete().eq('music_project_id', id);
  if (err1) throw new Error(`DB error: ${err1.message}`);
  const { error: err2 } = await supabase.from('music_projects').delete().eq('id', id);
  if (err2) throw new Error(`DB error: ${err2.message}`);
}

// ─── Tracks CRUD ───

export async function getMusicTracks(projectId: string): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_tracks')
    .select('*')
    .eq('music_project_id', projectId)
    .order('track_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB error: ${error.message}`);
  return (data || []) as unknown as MusicTrack[];
}

export async function createMusicTrack(data: Partial<MusicTrack>): Promise<MusicTrack> {
  const id = crypto.randomUUID();
  const now = nowStr();

  const { error } = await supabase.from('music_tracks').insert({
    id,
    music_project_id: data.music_project_id,
    title: data.title || 'Track sin título',
    track_number: data.track_number ?? null,
    bpm: data.bpm ?? null,
    key: data.key ?? null,
    status: data.status || 'pending',
    notes: data.notes ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  const { data: track, error: fetchErr } = await supabase
    .from('music_tracks')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr) throw new Error(`DB error: ${fetchErr.message}`);
  return track as unknown as MusicTrack;
}

const MUSIC_TRACK_EDITABLE: (keyof MusicTrack)[] = ['title', 'track_number', 'bpm', 'key', 'status', 'notes'];

export async function updateMusicTrack(id: string, data: Partial<MusicTrack>): Promise<void> {
  const updateData: Record<string, unknown> = { updated_at: nowStr() };
  for (const field of MUSIC_TRACK_EDITABLE) {
    if (data[field] !== undefined) updateData[field] = data[field] as unknown;
  }
  if (Object.keys(updateData).length === 1) return;

  const { error } = await supabase.from('music_tracks').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const { error } = await supabase.from('music_tracks').delete().eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

// ─── Stats ───

export async function getMusicStats(): Promise<{
  total: number; personal: number; client: number; active: number;
  mixing: number; mastering: number; review: number; delivered: number;
}> {
  void backfillMusicProjectsFromAudioJobs();

  const { data, error } = await supabase
    .from('music_projects')
    .select('source_type, status')
    .eq('is_archived', false);

  if (error) throw new Error(`DB error: ${error.message}`);

  const stats = { total: 0, personal: 0, client: 0, active: 0, mixing: 0, mastering: 0, review: 0, delivered: 0 };

  for (const row of data || []) {
    stats.total++;
    if (row.source_type === 'personal') stats.personal++;
    else if (row.source_type === 'client_job') stats.client++;
    if (ACTIVE_STATUSES.includes(row.status as string)) stats.active++;
    if (row.status === 'mixing') stats.mixing++;
    else if (row.status === 'mastering') stats.mastering++;
    else if (row.status === 'review') stats.review++;
    else if (row.status === 'delivered') stats.delivered++;
  }

  return stats;
}

// ─── Sync from audio jobs ───

export async function syncMusicProjectForAudioJob(job: Job, data: any = {}): Promise<void> {
  const { data: existing } = await supabase
    .from('music_projects')
    .select('*')
    .eq('job_id', job.id)
    .maybeSingle();

  const current = existing as MusicProject | null;

  if (!isAudioJobType(job.type) || job.status === 'cancelled' || job.is_archived) {
    if (current) await archiveMusicProject(current.id);
    return;
  }

  const payload: Partial<MusicProject> = {
    job_id: job.id,
    client_id: job.client_id || null,
    source_type: 'client_job',
    title: data.project_name || job.title,
    artist: data.artist || null,
    project_type: projectTypeFromJob(job.type, data.audio_type),
    status: statusFromAudio(data),
    total_tracks: data.total_tracks || null,
    bpm: data.bpm || null,
    key: data.key || null,
    musical_refs: data.musical_refs || null,
    client_observations: data.client_observations || job.description || null,
    stems_path: data.stems_path || null,
    session_path: data.sessions_path || null,
    exports_path: data.final_files_path || null,
    notes: job.notes || 'Creado automáticamente desde Trabajos.',
  };

  if (current) {
    await updateMusicProject(current.id, payload);
  } else {
    await createMusicProject({ ...payload, priority: 'medium', start_date: nowStr().slice(0, 10) });
  }
}
