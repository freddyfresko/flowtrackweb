import { supabase } from '../supabase';
import { localDateKey } from '../date';
import { archiveAutomaticTasksForSource, syncAutomaticTasksForJob } from './automaticTasks';
import type { Task } from '../types';

export interface TaskFilters {
  status?: string;
  priority?: string;
  area?: string;
  project_id?: string;
  client_id?: string;
  job_id?: string;
  search?: string;
  overdue?: boolean;
  exclude_completed?: boolean;
  limit?: number;
  offset?: number;
}

// ─── Helpers ───

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Coerce PG booleans back to 0/1 to match the Task TS type (which says `number`). */
function coerceTaskRow(row: Record<string, unknown>): Task {
  const out = { ...row };
  for (const key of ['is_archived', 'auto_generated', 'is_recurring'] as const) {
    if (typeof out[key] === 'boolean') out[key] = out[key] ? 1 : 0;
  }
  return out as unknown as Task;
}

function coerceTaskRows(rows: unknown[] | null): Task[] {
  return ((rows as Record<string, unknown>[]) || []).map(coerceTaskRow);
}

const PRIORITY_SORT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortTasks(a: Task, b: Task): number {
  const pa = PRIORITY_SORT[a.priority] ?? 2;
  const pb = PRIORITY_SORT[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return b.created_at.localeCompare(a.created_at);
}

// ─── CRUD ───

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  // Sync not needed here — runs once at startup via DataStore.initialize()
  // The create/update functions already sync per-entity.

  let q = supabase
    .from('tasks')
    .select('*')
    .eq('is_archived', false);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.area) q = q.eq('area', filters.area);
  if (filters.project_id) q = q.eq('project_id', filters.project_id);
  if (filters.client_id) q = q.eq('client_id', filters.client_id);
  if (filters.job_id) q = q.eq('job_id', filters.job_id);
  if (filters.search) {
    const s = filters.search.replace(/%/g, '');
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,notes.ilike.%${s}%`);
  }
  if (filters.overdue) {
    q = q.lt('due_date', localDateKey());
    q = q.not('status', 'in', '("completed","cancelled")');
    q = q.not('due_date', 'is', null);
  }
  if (filters.exclude_completed) {
    q = q.not('status', 'in', '("completed","cancelled")');
  }

  if (filters.limit) q = q.limit(filters.limit);
  if (filters.offset) q = q.range(filters.offset, filters.offset + (filters.limit || 200) - 1);

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);

  const tasks = coerceTaskRows(data);

  // Embed subtask counts via a single batch query
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length > 0) {
    const { data: subtasks } = await supabase
      .from('tasks')
      .select('parent_task_id')
      .in('parent_task_id', taskIds)
      .eq('is_archived', false);

    const subtaskCounts: Record<string, number> = {};
    for (const s of (subtasks || []) as { parent_task_id: string }[]) {
      subtaskCounts[s.parent_task_id] = (subtaskCounts[s.parent_task_id] || 0) + 1;
    }
    for (const task of tasks) {
      (task as unknown as Record<string, unknown>).subtask_count = subtaskCounts[task.id] || 0;
    }
  }

  tasks.sort(sortTasks);
  return tasks;
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data ? coerceTaskRow(data as Record<string, unknown>) : null;
}

export async function getSubtasks(parentId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', parentId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return coerceTaskRows(data);
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  const id = crypto.randomUUID();
  const now = nowStr();

  const { error } = await supabase.from('tasks').insert({
    id,
    title: data.title || 'Untitled Task',
    description: data.description || null,
    area: data.area || null,
    client_id: data.client_id || null,
    job_id: data.job_id || null,
    project_id: data.project_id || null,
    source_type: data.source_type || null,
    source_id: data.source_id || null,
    rule_key: data.rule_key || null,
    auto_generated: data.auto_generated ? true : false,
    priority: data.priority || 'medium',
    status: data.status || 'pending',
    due_date: data.due_date || null,
    estimated_time: data.estimated_time || null,
    actual_time: data.actual_time || null,
    tags: data.tags || null,
    notes: data.notes || null,
    parent_task_id: data.parent_task_id || null,
    is_recurring: data.is_recurring ? true : false,
    recurrence_rule: data.recurrence_rule || null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const task = (await getTaskById(id))!;
  if (task.job_id) await syncAutomaticTasksForJob(task as any);
  return task;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const updateData: Record<string, unknown> = {};

  const allowedFields: (keyof Task)[] = [
    'title', 'description', 'area', 'client_id', 'job_id', 'project_id',
    'source_type', 'source_id', 'rule_key', 'auto_generated',
    'priority', 'status', 'due_date', 'estimated_time', 'actual_time',
    'tags', 'notes', 'is_recurring', 'recurrence_rule',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      // Convert 0/1 booleans to true/false for PG boolean columns
      if (field === 'auto_generated' || field === 'is_recurring') {
        updateData[field] = data[field] ? true : false;
      } else {
        updateData[field] = data[field];
      }
    }
  }

  if (Object.keys(updateData).length === 0) return getTaskById(id);

  updateData.updated_at = nowStr();

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(`DB update error: ${error.message}`);

  const task = await getTaskById(id);
  if (task?.job_id) await syncAutomaticTasksForJob(task as any);
  return task;
}

export async function archiveTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      is_archived: true,
      updated_at: nowStr(),
    })
    .eq('id', id);

  if (error) throw new Error(`DB archive error: ${error.message}`);

  const task = await getTaskById(id);
  if (task?.source_type && task?.source_id) await archiveAutomaticTasksForSource(task.source_type, task.source_id);
}

export async function deleteTask(id: string): Promise<void> {
  // Also delete subtasks
  await supabase.from('tasks').delete().eq('parent_task_id', id);
  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) throw new Error(`DB delete error: ${error.message}`);
}

export async function getTaskStats(): Promise<{
  pending: number;
  in_progress: number;
  overdue: number;
  completed_this_month: number;
}> {
  // Sync not needed here — runs once at startup via DataStore.initialize()

  const today = localDateKey();
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const { data, error } = await supabase
    .from('tasks')
    .select('status, due_date, created_at, updated_at')
    .eq('is_archived', false);

  if (error) throw new Error(`DB query error: ${error.message}`);

  const rows = (data || []) as { status: string; due_date: string | null; created_at: string; updated_at: string }[];

  let pending = 0;
  let inProgress = 0;
  let overdue = 0;
  let completedThisMonth = 0;

  for (const row of rows) {
    if (row.status === 'pending') pending++;
    if (row.status === 'in_progress') inProgress++;
    if (row.status === 'completed' && row.updated_at.slice(0, 7) === monthPrefix) completedThisMonth++;
    if (row.due_date && row.due_date < today && !['completed', 'cancelled'].includes(row.status)) overdue++;
  }

  return {
    pending,
    in_progress: inProgress,
    overdue,
    completed_this_month: completedThisMonth,
  };
}
