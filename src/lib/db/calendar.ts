import { supabase } from '../supabase';
import { addLocalDays, localDateKey } from '../date';
import { getAgendaCalendarEvents } from './agenda';

// ─── Unified Calendar Events ───

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'task' | 'reel' | 'youtube' | 'consultancy' | 'payment' | 'delivery' | 'recording' | 'editing' | 'scheduled' | 'deadline' | 'music' | 'videoclip' | 'preproduction' | 'review' | 'agenda';
  entity_type: string;
  entity_id: string;
  status?: string;
  priority?: string;
  client_name?: string;
  source_module?: string;
}

export const CALENDAR_SOURCE_MODULES: { value: string; label: string; icon: string; color: string }[] = [
  { value: 'agenda', label: 'Agenda', icon: '🗒️', color: 'amber' },
  { value: 'tasks', label: 'Tareas', icon: '✅', color: 'blue' },
  { value: 'social', label: 'Redes Sociales', icon: '📱', color: 'orange' },
  { value: 'content', label: 'Contenido', icon: '🎬', color: 'red' },
  { value: 'music', label: 'Producción Musical', icon: '🎧', color: 'emerald' },
  { value: 'consultancies', label: 'Asesorías', icon: '🎓', color: 'purple' },
  { value: 'projects', label: 'Proyectos', icon: '🛠️', color: 'violet' },
  { value: 'finance', label: 'Finanzas', icon: '💰', color: 'green' },
];

export async function getCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  // Launch ALL 9 queries in parallel
  const [tasksResult, reelsResult, ytResult, videoclipsResult, musicResult,
         consResult, recsResult, agendaEvents, projsResult] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date, priority, status')
      .like('due_date', `${ym}%`).eq('is_archived', false)
      .not('status', 'in', '("completed","cancelled")'),
    supabase.from('reels').select('id, title, scheduled_date, recording_date, published_date, priority, status')
      .or(`scheduled_date.like.${ym}%,recording_date.like.${ym}%,published_date.like.${ym}%`)
      .eq('is_archived', false),
    supabase.from('youtube_videos').select('id, provisional_title, recording_date, editing_date, published_date, priority, status')
      .or(`recording_date.like.${ym}%,editing_date.like.${ym}%,published_date.like.${ym}%`)
      .eq('is_archived', false),
    supabase.from('filmmaker_videoclips').select('id, title, song, artist, preproduction_date, recording_date, first_delivery_date, final_delivery_date, status, jobs!left(title, is_archived)')
      .or(`preproduction_date.like.${ym}%,recording_date.like.${ym}%,first_delivery_date.like.${ym}%,final_delivery_date.like.${ym}%`),
    supabase.from('music_projects').select('id, title, artist, start_date, target_date, status, priority, clients!left(name)')
      .eq('is_archived', false)
      .or(`start_date.like.${ym}%,target_date.like.${ym}%`),
    supabase.from('consultancies').select('id, topic, date, status, clients!left(name)')
      .like('date', `${ym}%`).eq('is_archived', false)
      .not('status', 'in', '("closed","cancelled")'),
    supabase.from('receivables').select('id, total_amount, balance, due_date, status, clients!left(name)')
      .like('due_date', `${ym}%`)
      .in('status', ['pending', 'partial', 'overdue']),
    getAgendaCalendarEvents(year, month),
    supabase.from('digital_projects').select('id, name, start_date, target_date, status, priority')
      .eq('is_archived', false)
      .or(`start_date.like.${ym}%,target_date.like.${ym}%`),
  ]);

  const events: CalendarEvent[] = [];

  // Tasks
  for (const t of tasksResult.data || []) {
    events.push({ id: `task-${t.id}`, date: t.due_date, title: t.title, type: 'task', entity_type: 'task', entity_id: t.id, status: t.status, priority: t.priority, source_module: 'tasks' });
  }

  // Reels
  for (const r of reelsResult.data || []) {
    if (r.scheduled_date?.startsWith(ym)) events.push({ id: `reel-sched-${r.id}`, date: r.scheduled_date, title: `\u{1F4F1} Programado: ${r.title}`, type: 'scheduled', entity_type: 'reel', entity_id: r.id, status: r.status, priority: r.priority, source_module: 'social' });
    if (r.recording_date?.startsWith(ym)) events.push({ id: `reel-rec-${r.id}`, date: r.recording_date, title: `\u{1F3A5} Grabacion: ${r.title}`, type: 'recording', entity_type: 'reel', entity_id: r.id, status: r.status, priority: r.priority, source_module: 'content' });
    if (r.published_date?.startsWith(ym)) events.push({ id: `reel-pub-${r.id}`, date: r.published_date, title: `\u2705 Publicado: ${r.title}`, type: 'task', entity_type: 'reel', entity_id: r.id, status: r.status, priority: r.priority, source_module: 'social' });
  }

  // YouTube
  for (const v of ytResult.data || []) {
    if (v.recording_date?.startsWith(ym)) events.push({ id: `yt-rec-${v.id}`, date: v.recording_date, title: `\u{1F3A5} Grabacion YT: ${v.provisional_title}`, type: 'recording', entity_type: 'youtube', entity_id: v.id, status: v.status, priority: v.priority, source_module: 'content' });
    if (v.editing_date?.startsWith(ym)) events.push({ id: `yt-edit-${v.id}`, date: v.editing_date, title: `\u2702\uFE0F Edicion YT: ${v.provisional_title}`, type: 'editing', entity_type: 'youtube', entity_id: v.id, status: v.status, priority: v.priority, source_module: 'content' });
    if (v.published_date?.startsWith(ym)) events.push({ id: `yt-pub-${v.id}`, date: v.published_date, title: `\u2705 Publicado YT: ${v.provisional_title}`, type: 'task', entity_type: 'youtube', entity_id: v.id, status: v.status, priority: v.priority, source_module: 'content' });
  }

  // Videoclips
  for (const v of videoclipsResult.data || []) {
    const job = v.jobs as any;
    const title = v.title || v.song || job?.title;
    const who = v.artist;
    const suffix = who ? ` - ${who}` : '';
    if (v.preproduction_date?.startsWith(ym)) events.push({ id: `vc-pre-${v.id}`, date: v.preproduction_date, title: `\u{1F4CB} Prepro: ${title}${suffix}`, type: 'preproduction', entity_type: 'videoclip', entity_id: v.id, status: v.status, source_module: 'content' });
    if (v.recording_date?.startsWith(ym)) events.push({ id: `vc-rec-${v.id}`, date: v.recording_date, title: `\u{1F3AC} Rodaje: ${title}${suffix}`, type: 'recording', entity_type: 'videoclip', entity_id: v.id, status: v.status, source_module: 'content' });
    if (v.first_delivery_date?.startsWith(ym)) events.push({ id: `vc-first-${v.id}`, date: v.first_delivery_date, title: `\u{1F440} Primer corte: ${title}${suffix}`, type: 'review', entity_type: 'videoclip', entity_id: v.id, status: v.status, source_module: 'content' });
    if (v.final_delivery_date?.startsWith(ym)) events.push({ id: `vc-final-${v.id}`, date: v.final_delivery_date, title: `\u{1F4E6} Entrega: ${title}${suffix}`, type: 'delivery', entity_type: 'videoclip', entity_id: v.id, status: v.status, source_module: 'content' });
  }

  // Music
  for (const m of musicResult.data || []) {
    const clientName = (m.clients as { name?: string } | null)?.name;
    const suffix = (m.artist || clientName) ? ` - ${m.artist || clientName}` : '';
    if (m.start_date?.startsWith(ym)) events.push({ id: `music-start-${m.id}`, date: m.start_date, title: `\u{1F3B5} Inicio musica: ${m.title}${suffix}`, type: 'music', entity_type: 'music', entity_id: m.id, status: m.status, priority: m.priority, client_name: clientName, source_module: 'music' });
    if (m.target_date?.startsWith(ym)) events.push({ id: `music-delivery-${m.id}`, date: m.target_date, title: `\u{1F3B5} Entrega musica: ${m.title}${suffix}`, type: 'delivery', entity_type: 'music', entity_id: m.id, status: m.status, priority: m.priority, client_name: clientName, source_module: 'music' });
  }

  // Consultancies
  for (const c of consResult.data || []) {
    const clientName = (c.clients as { name?: string } | null)?.name;
    events.push({ id: `cons-${c.id}`, date: c.date, title: `\u{1F393} ${c.topic}${clientName ? ` - ${clientName}` : ''}`, type: 'consultancy', entity_type: 'consultancy', entity_id: c.id, status: c.status, client_name: clientName, source_module: 'consultancies' });
  }

  // Receivables
  for (const r of recsResult.data || []) {
    const clientName = (r.clients as { name?: string } | null)?.name;
    events.push({ id: `rec-${r.id}`, date: r.due_date, title: `\u{1F4B0} Pago: $${Math.round(r.balance).toLocaleString('es-CL')}${clientName ? ` - ${clientName}` : ''}`, type: 'payment', entity_type: 'receivable', entity_id: r.id, status: r.status, source_module: 'finance' });
  }

  // Agenda items
  for (const a of agendaEvents) {
    events.push({ id: a.id, date: a.date, title: a.title, type: 'agenda', entity_type: 'agenda', entity_id: a.entity_id, status: a.status, priority: a.priority, client_name: a.client_name, source_module: 'agenda' });
  }

  // Projects
  for (const p of projsResult.data || []) {
    if (p.start_date?.startsWith(ym)) events.push({ id: `proj-start-${p.id}`, date: p.start_date, title: `\u{1F6E0}\uFE0F Inicio: ${p.name}`, type: 'task', entity_type: 'project', entity_id: p.id, status: p.status, priority: p.priority, source_module: 'projects' });
    if (p.target_date?.startsWith(ym)) events.push({ id: `proj-target-${p.id}`, date: p.target_date, title: `\u{1F4C5} Entrega: ${p.name}`, type: 'deadline', entity_type: 'project', entity_id: p.id, status: p.status, priority: p.priority, source_module: 'projects' });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

// ─── Global Search ───

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  icon: string;
  entity_type: string;
  entity_id: string;
}

export async function globalSearch(query_str: string): Promise<SearchResult[]> {
  if (!query_str.trim()) return [];
  const q = query_str.trim().replace(/%/g, '');
  const results: SearchResult[] = [];
  const limit = 5;

  const clientsPromise = supabase.from('clients').select('id, name, artist_name, company').eq('is_archived', false).or(`name.ilike.%${q}%,artist_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`).limit(limit);
  const tasksPromise = supabase.from('tasks').select('id, title, status').eq('is_archived', false).or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(limit);
  const reelsPromise = supabase.from('reels').select('id, title, status').eq('is_archived', false).or(`title.ilike.%${q}%,idea.ilike.%${q}%`).limit(limit);
  const ytPromise = supabase.from('youtube_videos').select('id, provisional_title, status').eq('is_archived', false).or(`provisional_title.ilike.%${q}%,final_title.ilike.%${q}%,idea.ilike.%${q}%`).limit(limit);
  const projectsPromise = supabase.from('digital_projects').select('id, name, status').eq('is_archived', false).or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(limit);
  const consPromise = supabase.from('consultancies').select('id, topic, status, clients!left(name)').eq('is_archived', false).or(`topic.ilike.%${q}%,objective.ilike.%${q}%`).limit(limit);
  const agendaPromise = supabase.from('agenda_items').select('id, title, date, status').eq('is_archived', false).or(`title.ilike.%${q}%,description.ilike.%${q}%,tags.ilike.%${q}%`).limit(limit);

  const [
    { data: clients }, { data: tasks }, { data: reels }, { data: yt },
    { data: proj }, { data: cons }, { data: agenda },
  ] = await Promise.all([
    clientsPromise, tasksPromise, reelsPromise, ytPromise,
    projectsPromise, consPromise, agendaPromise,
  ]);

  for (const c of clients || []) results.push({ id: `client-${c.id}`, title: c.name, subtitle: c.artist_name || c.company || '', type: 'Cliente', icon: '👤', entity_type: 'client', entity_id: c.id });
  for (const t of tasks || []) results.push({ id: `task-${t.id}`, title: t.title, subtitle: t.status, type: 'Tarea', icon: '✅', entity_type: 'task', entity_id: t.id });
  for (const r of reels || []) results.push({ id: `reel-${r.id}`, title: r.title, subtitle: r.status, type: 'Reel', icon: '🎬', entity_type: 'reel', entity_id: r.id });
  for (const v of yt || []) results.push({ id: `yt-${v.id}`, title: v.provisional_title, subtitle: v.status, type: 'YouTube', icon: '▶️', entity_type: 'youtube', entity_id: v.id });
  for (const p of proj || []) results.push({ id: `proj-${p.id}`, title: p.name, subtitle: p.status, type: 'Proyecto', icon: '🛠️', entity_type: 'project', entity_id: p.id });
  for (const c of cons || []) {
    const clientName = (c.clients as { name?: string } | null)?.name;
    results.push({ id: `cons-${c.id}`, title: c.topic, subtitle: clientName || c.status, type: 'Asesoría', icon: '🎓', entity_type: 'consultancy', entity_id: c.id });
  }
  for (const a of agenda || []) results.push({ id: `agenda-${a.id}`, title: a.title, subtitle: a.date, type: 'Agenda', icon: '🗒️', entity_type: 'agenda', entity_id: a.id });

  return results;
}

// ─── Dashboard Alerts ───

export interface Alert {
  type: 'warning' | 'danger' | 'info';
  message: string;
  entity_type?: string;
  entity_id?: string;
}

export async function getAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = localDateKey();
  const nextWeek = addLocalDays(new Date(), 7);
  const nw = localDateKey(nextWeek);

  const [overdueTasks, overdueRecs, overdueDebt, todayReels, todayCons, upcomingPay] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).not('due_date', 'is', null).lt('due_date', today).not('status', 'in', '("completed","cancelled")').eq('is_archived', false),
    supabase.from('receivables').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    supabase.from('receivables').select('balance').eq('status', 'overdue'),
    supabase.from('reels').select('id', { count: 'exact', head: true }).eq('scheduled_date', today).eq('is_archived', false),
    supabase.from('consultancies').select('id', { count: 'exact', head: true }).eq('date', today).in('status', ['scheduled', 'confirmed']).eq('is_archived', false),
    supabase.from('receivables').select('id', { count: 'exact', head: true }).gte('due_date', today).lte('due_date', nw).in('status', ['pending', 'partial']),
  ]);

  if (overdueTasks.count && overdueTasks.count > 0) {
    alerts.push({ type: 'danger', message: `${overdueTasks.count} tarea(s) vencida(s)`, entity_type: 'tasks' });
  }

  if (overdueRecs.count && overdueRecs.count > 0) {
    const debt = (overdueDebt.data || []).reduce((sum: number, r: any) => sum + (r.balance || 0), 0);
    alerts.push({ type: 'danger', message: `${overdueRecs.count} pago(s) vencido(s) por $${Math.round(debt).toLocaleString('es-CL')}`, entity_type: 'finance' });
  }

  // Stalled projects — fetch via supabase.from() and filter date math client-side
  const { data: stalledProjects } = await supabase
    .from('digital_projects')
    .select('last_activity')
    .in('status', ['development', 'planning', 'testing', 'idea', 'research'])
    .eq('is_archived', false);
  const FOURTEEN_DAYS_MS = 14 * 86400_000;
  const stalledCount = ((stalledProjects || []) as { last_activity: string | null }[]).filter(
    (p) => !p.last_activity || Date.now() - new Date(p.last_activity).getTime() > FOURTEEN_DAYS_MS
  ).length;
  if (stalledCount > 0) {
    alerts.push({ type: 'warning', message: `${stalledCount} proyecto(s) sin actividad reciente (>14 días)`, entity_type: 'projects' });
  }

  if (todayReels.count && todayReels.count > 0) {
    alerts.push({ type: 'info', message: `${todayReels.count} reel(es) programado(s) para hoy`, entity_type: 'content' });
  }

  if (todayCons.count && todayCons.count > 0) {
    alerts.push({ type: 'info', message: `${todayCons.count} asesoría(s) hoy`, entity_type: 'consultancies' });
  }

  if (upcomingPay.count && upcomingPay.count > 0) {
    alerts.push({ type: 'warning', message: `${upcomingPay.count} pago(s) por vencer en los próximos 7 días`, entity_type: 'finance' });
  }

  return alerts;
}
