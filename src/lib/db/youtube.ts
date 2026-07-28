import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForYouTube } from './automaticTasks';
import { deleteFinanceForSource } from './finance';
import type { Job, YouTubeVideo } from '../types';

export interface YouTubeFilters {
  search?: string;
  status?: string;
  priority?: string;
  project?: string;
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export async function getYouTubeVideos(filters: YouTubeFilters = {}): Promise<YouTubeVideo[]> {

  let q = supabase.from('youtube_videos').select('*').eq('is_archived', false);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.project) q = q.like('project', `%${filters.project}%`);
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(`provisional_title.ilike.%${s}%,final_title.ilike.%${s}%,idea.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);

  const items = (data || []) as YouTubeVideo[];
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if ((a.published_date || '') !== (b.published_date || '')) {
      return (a.published_date || '').localeCompare(b.published_date || '');
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  return items;
}

export async function getYouTubeById(id: string): Promise<YouTubeVideo | null> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return data ? data as unknown as YouTubeVideo : null;
}

export async function createYouTubeVideo(data: Partial<YouTubeVideo>): Promise<YouTubeVideo> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('youtube_videos').insert({
    id,
    job_id: data.job_id ?? null,
    work_type: data.work_type || 'personal',
    client_id: data.client_id ?? null,
    amount: data.amount ?? null,
    payment_status: data.payment_status || 'pending',
    provisional_title: data.provisional_title || 'Sin título',
    final_title: data.final_title ?? null,
    idea: data.idea ?? null,
    objective: data.objective ?? null,
    project: data.project ?? null,
    script: data.script ?? null,
    research: data.research ?? null,
    resources: data.resources ?? null,
    references: data.references ?? null,
    description: data.description ?? null,
    tags: data.tags ?? null,
    thumbnail: data.thumbnail ?? null,
    recording_date: data.recording_date ?? null,
    editing_date: data.editing_date ?? null,
    published_date: data.published_date ?? null,
    material_path: data.material_path ?? null,
    project_path: data.project_path ?? null,
    published_link: data.published_link ?? null,
    notes: data.notes ?? null,
    priority: data.priority || 'medium',
    status: data.status || 'idea',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  const video = (await getYouTubeById(id))!;
  await syncAutomaticTasksForYouTube(video);
  return video;
}

const YT_EDITABLE: (keyof YouTubeVideo)[] = [
  'work_type', 'client_id', 'amount', 'payment_status',
  'provisional_title', 'final_title', 'idea', 'objective', 'project', 'script', 'research',
  'resources', 'references', 'description', 'tags', 'thumbnail', 'recording_date', 'editing_date',
  'published_date', 'material_path', 'project_path', 'published_link', 'notes', 'priority', 'status', 'job_id',
];

export async function updateYouTubeVideo(id: string, data: Partial<YouTubeVideo>): Promise<YouTubeVideo | null> {
  const updateData: Record<string, unknown> = {};
  for (const f of YT_EDITABLE) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (Object.keys(updateData).length === 0) return getYouTubeById(id);
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('youtube_videos').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);

  const video = await getYouTubeById(id);
  if (video) await syncAutomaticTasksForYouTube(video);
  return video;
}

export async function archiveYouTubeVideo(id: string): Promise<void> {
  const { error } = await supabase
    .from('youtube_videos')
    .update({ is_archived: true, updated_at: nowStr() })
    .eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  await archiveAutomaticTasksForSource('youtube', id);
}

export async function deleteYouTubeVideo(id: string): Promise<void> {
  const { error } = await supabase.from('youtube_videos').delete().eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  await deleteAutomaticTasksForSource('youtube', id);
  await deleteFinanceForSource('youtube', id);
}

export async function syncYouTubeForJob(_job: Job, _data: any = {}): Promise<void> {
  // Jobs module deprecated — no-op
}

export async function backfillYouTubeFromJobs(): Promise<void> {
  // Jobs module deprecated — no-op
}

export async function getYouTubeStats(): Promise<{
  total: number; in_production: number; published_this_month: number; paused: number;
}> {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [totalRes, inProdRes, pubRes, pausedRes] = await Promise.all([
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('is_archived', false),
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).in('status', ['idea', 'research', 'script', 'ready_to_record', 'recorded', 'editing', 'thumbnail', 'review']).eq('is_archived', false),
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('created_at', `${thisMonth}-01`).eq('is_archived', false),
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).in('status', ['paused', 'discarded']).eq('is_archived', false),
  ]);

  return {
    total: totalRes.count ?? 0,
    in_production: inProdRes.count ?? 0,
    published_this_month: pubRes.count ?? 0,
    paused: pausedRes.count ?? 0,
  };
}

export async function seedDemoYouTube(): Promise<void> {
  const { data: existing } = await supabase.from('youtube_videos').select('id').limit(1);
  if (existing && existing.length > 0) return;

  const demos: Partial<YouTubeVideo>[] = [
    { provisional_title: 'Cómo mezclar voces como profesional', idea: 'Tutorial completo de mezcla vocal desde cero', project: 'CLUBHH', script: '1. Introducción 2. Corrección de tono 3. Compresión 4. EQ 5. Reverb 6. Demo final', research: 'Ver 3 tutoriales top, anotar técnicas clave', tags: 'mezcla,audio,tutorial,voces', priority: 'high', status: 'script' },
    { provisional_title: 'Historia del Hip Hop Chileno', idea: 'Documental sobre los orígenes y evolución del HH chileno', project: 'Hiphopizados', research: 'Entrevistas, archivos, discografía', resources: 'Pancho, archivo CSMC', tags: 'hiphop,chile,historia,documental', priority: 'medium', status: 'research' },
    { provisional_title: 'Review: Nuevo álbum de Portavoz', final_title: 'Portavoz - Estrategia de Contenido (Review)', idea: 'Análisis del nuevo álbum, producción, letras', project: 'Hiphopizados', script: 'Intro, canción x canción, producción, conclusión', tags: 'review,portavoz,album', priority: 'urgent', status: 'editing', recording_date: '2026-07-18', editing_date: '2026-07-22' },
    { provisional_title: 'Tutorial: Cómo grabar voces en casa', idea: 'Guía para grabar voces con equipo básico', project: 'CLUBHH', tags: 'grabacion,voces,home-studio', priority: 'low', status: 'idea' },
    { provisional_title: 'Entrevista con MC local', idea: 'Entrevista a un MC emergente sobre su proceso creativo', project: 'Hiphopizados', tags: 'entrevista,mc,emergente', priority: 'medium', status: 'scheduled', published_date: '2026-08-01' },
  ];
  for (const v of demos) { await createYouTubeVideo(v); }
}
