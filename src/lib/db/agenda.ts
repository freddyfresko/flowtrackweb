import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForAgenda } from './automaticTasks';
import { localDateKey } from '../date';
import type { AgendaItem, AgendaReminder } from '../types';

export interface AgendaFilters {
  status?: string;
  priority?: string;
  item_type?: string;
  source_module?: string;
  client_id?: string;
  project_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  overdue?: boolean;
}

// ─── Helpers ───

function flattenAgendaItem(row: Record<string, unknown>): AgendaItem {
  const item = { ...row } as Record<string, unknown>;
  // Supabase returns JOIN results as nested objects { clients: { name: ... } }
  item.client_name = (item.clients as { name?: string } | null)?.name ?? undefined;
  item.project_name = undefined;
  delete item.clients;
  delete item.digital_projects;
  // PG returns BOOLEAN but the type says `number` — coerce for backward compat
  if (typeof item.is_archived === 'boolean') {
    item.is_archived = item.is_archived ? 1 : 0;
  }
  return item as unknown as AgendaItem;
}

async function getAgendaItemRaw(id: string): Promise<AgendaItem | null> {
  const { data, error } = await supabase
    .from('agenda_items')
    .select('*, clients!left(name)')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data ? flattenAgendaItem(data as Record<string, unknown>) : null;
}

const PRIORITY_SORT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortByPriorityDate(a: AgendaItem, b: AgendaItem): number {
  const pa = PRIORITY_SORT[a.priority] ?? 2;
  const pb = PRIORITY_SORT[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.time || '').localeCompare(b.time || '');
}

// ─── CRUD ───

export async function getAgendaItems(filters: AgendaFilters = {}): Promise<AgendaItem[]> {
  let q = supabase
    .from('agenda_items')
    .select('*, clients!left(name)')
    .eq('is_archived', false);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.item_type) q = q.eq('item_type', filters.item_type);
  if (filters.source_module) q = q.eq('source_module', filters.source_module);
  if (filters.client_id) q = q.eq('client_id', filters.client_id);
  if (filters.project_id) q = q.eq('project_id', filters.project_id);
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,tags.ilike.%${s}%,location.ilike.%${s}%`);
  }
  if (filters.date_from) q = q.gte('date', filters.date_from);
  if (filters.date_to) q = q.lte('date', filters.date_to);
  if (filters.overdue) {
    q = q.lt('date', localDateKey());
    q = q.not('status', 'in', '("done","cancelled")');
  }

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);

  const items = ((data as Record<string, unknown>[]) || []).map(flattenAgendaItem);
  items.sort(sortByPriorityDate);
  return items;
}

export async function getAgendaItemById(id: string): Promise<AgendaItem | null> {
  return getAgendaItemRaw(id);
}

export async function createAgendaItem(data: Partial<AgendaItem>): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { error } = await supabase
    .from('agenda_items')
    .insert({
      id,
      title: data.title,
      description: data.description ?? null,
      item_type: data.item_type ?? 'meeting',
      source_module: data.source_module ?? null,
      client_id: data.client_id ?? null,
      project_id: data.project_id ?? null,
      job_id: data.job_id ?? null,
      date: data.date,
      time: data.time ?? null,
      duration: data.duration ?? null,
      priority: data.priority ?? 'medium',
      status: data.status ?? 'pending',
      location: data.location ?? null,
      tags: data.tags ?? null,
      created_at: now,
      updated_at: now,
      is_archived: false,
    });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const item = await getAgendaItemRaw(id);
  if (item) await syncAutomaticTasksForAgenda(item);
  return id;
}

export async function updateAgendaItem(id: string, data: Partial<AgendaItem>): Promise<void> {
  const editable: (keyof AgendaItem)[] = [
    'title', 'description', 'item_type', 'source_module',
    'client_id', 'project_id', 'job_id',
    'date', 'time', 'duration', 'priority', 'status', 'location', 'tags',
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of editable) {
    if (key in data) {
      updateData[key] = data[key] as unknown;
    }
  }

  if (Object.keys(updateData).length === 0) return;

  updateData.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { error } = await supabase
    .from('agenda_items')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(`DB update error: ${error.message}`);

  const item = await getAgendaItemRaw(id);
  if (item) await syncAutomaticTasksForAgenda(item);
}

export async function archiveAgendaItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('agenda_items')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    .eq('id', id);

  if (error) throw new Error(`DB archive error: ${error.message}`);
  await archiveAutomaticTasksForSource('agenda', id);
}

export async function deleteAgendaItem(id: string): Promise<void> {
  const { error: err1 } = await supabase
    .from('agenda_reminders')
    .delete()
    .eq('agenda_item_id', id);
  if (err1) throw new Error(`DB delete reminders error: ${err1.message}`);

  const { error: err2 } = await supabase
    .from('agenda_items')
    .delete()
    .eq('id', id);
  if (err2) throw new Error(`DB delete item error: ${err2.message}`);

  await deleteAutomaticTasksForSource('agenda', id);
}

// ─── Reminders ───

export async function getReminders(agendaItemId: string): Promise<AgendaReminder[]> {
  const { data, error } = await supabase
    .from('agenda_reminders')
    .select('*')
    .eq('agenda_item_id', agendaItemId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as unknown as AgendaReminder[];
}

export async function addReminder(agendaItemId: string, data: Partial<AgendaReminder>): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { error } = await supabase
    .from('agenda_reminders')
    .insert({
      id,
      agenda_item_id: agendaItemId,
      reminder_offset: data.reminder_offset ?? null,
      reminder_unit: data.reminder_unit ?? 'minutes',
      reminder_time: data.reminder_time ?? null,
      fired: false,
      created_at: now,
    });

  if (error) throw new Error(`DB insert reminder error: ${error.message}`);
  return id;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('agenda_reminders')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`DB delete reminder error: ${error.message}`);
}

// ─── Stats ───

export interface AgendaStats {
  pending: number;
  confirmed: number;
  in_progress: number;
  done: number;
  overdue: number;
  this_week: number;
}

export async function getAgendaStats(): Promise<AgendaStats> {
  const today = localDateKey();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = localDateKey(weekEnd);

  // Single query: get all non-archived items with status + date, count in JS
  const { data, error } = await supabase
    .from('agenda_items')
    .select('status, date')
    .eq('is_archived', false);

  if (error) throw new Error(`DB query error: ${error.message}`);

  const stats: AgendaStats = { pending: 0, confirmed: 0, in_progress: 0, done: 0, overdue: 0, this_week: 0 };

  for (const item of data || []) {
    const s = item.status as string;
    if (s === 'pending') stats.pending++;
    else if (s === 'confirmed') stats.confirmed++;
    else if (s === 'in_progress') stats.in_progress++;
    else if (s === 'done') stats.done++;

    if (s !== 'done' && s !== 'cancelled') {
      const d = item.date as string;
      if (d < today) stats.overdue++;
      if (d >= today && d <= weekEndStr) stats.this_week++;
    }
  }

  return stats;
}

// ─── Calendar projection ───

export interface AgendaCalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'agenda';
  entity_type: string;
  entity_id: string;
  status?: string;
  priority?: string;
  client_name?: string;
  source_module: string;
}

export async function getAgendaCalendarEvents(year: number, month: number): Promise<AgendaCalendarEvent[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('agenda_items')
    .select('id, title, date, item_type, source_module, status, priority, clients!left(name)')
    .like('date', `${ym}%`)
    .eq('is_archived', false)
    .not('status', 'in', '("done","cancelled")');

  if (error) throw new Error(`DB query error: ${error.message}`);

  return ((data as Record<string, unknown>[]) || []).map((r) => {
    const typeIcon = AGENDA_TYPE_ICONS[r.item_type as string] ?? '📋';
    return {
      id: `agenda-${r.id}`,
      date: r.date as string,
      title: `${typeIcon} ${r.title}`,
      type: 'agenda' as const,
      entity_type: 'agenda',
      entity_id: r.id as string,
      status: r.status as string,
      priority: r.priority as string,
      client_name: (r.clients as { name?: string } | null)?.name ?? undefined,
      source_module: (r.source_module as string) ?? 'agenda',
    };
  });
}

// ─── Constants ───

export const AGENDA_TYPE_ICONS: Record<string, string> = {
  meeting: '👥',
  call: '📞',
  recording: '🎥',
  music_production: '🎧',
  consultancy: '🎓',
  delivery: '📦',
  event: '🎉',
  reminder: '⏰',
  other: '📋',
};

export const AGENDA_TYPE_LABELS: Record<string, string> = {
  meeting: 'Reunión',
  call: 'Llamado',
  recording: 'Grabación',
  music_production: 'Producción musical',
  consultancy: 'Asesoría',
  delivery: 'Entrega',
  event: 'Evento',
  reminder: 'Recordatorio',
  other: 'Otro',
};

export const AGENDA_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En proceso',
  done: 'Completado',
  cancelled: 'Cancelado',
};

export const AGENDA_PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const AGENDA_ITEM_TYPE_OPTIONS = Object.entries(AGENDA_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const AGENDA_STATUS_OPTIONS = Object.entries(AGENDA_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const AGENDA_PRIORITY_OPTIONS = Object.entries(AGENDA_PRIORITY_LABELS).map(([value, label]) => ({ value, label }));

export const AGENDA_SOURCE_MODULES: { value: string; label: string }[] = [
  { value: '', label: 'Sin módulo' },
  { value: 'content', label: 'Contenido' },
  { value: 'social', label: 'Redes Sociales' },
  { value: 'music', label: 'Producción Musical' },
  { value: 'consultancies', label: 'Asesorías' },
  { value: 'jobs', label: 'Trabajos' },
  { value: 'projects', label: 'Proyectos' },
  { value: 'finance', label: 'Finanzas' },
];
