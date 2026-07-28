import { supabase } from '../supabase';
import { archiveAutomaticTasksForSource, deleteAutomaticTasksForSource, syncAutomaticTasksForProject } from './automaticTasks';
import { deleteFinanceForSource } from './finance';
import type { DigitalProject } from '../types';

// ─── Helpers ───

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function todayStr(): string {
  return nowStr().slice(0, 10);
}

function daysInactive(lastActivity: string | null): number | undefined {
  if (!lastActivity) return undefined;
  const last = new Date(lastActivity).getTime();
  if (Number.isNaN(last)) return undefined;
  return Math.floor((Date.now() - last) / 86_400_000);
}

const PRIORITY_SORT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortProjects(a: DigitalProject, b: DigitalProject): number {
  const pa = PRIORITY_SORT[a.priority] ?? 2;
  const pb = PRIORITY_SORT[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  if (a.last_activity && b.last_activity) return b.last_activity.localeCompare(a.last_activity);
  if (a.last_activity) return -1;
  if (b.last_activity) return 1;
  return b.created_at.localeCompare(a.created_at);
}

function flattenProjectName(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  out.project_name = (out.digital_projects as { name?: string } | null)?.name ?? undefined;
  delete out.digital_projects;
  return out;
}

async function countRows(table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);
  return count ?? 0;
}

// ─── Digital Projects ───

export async function getProjects(): Promise<(DigitalProject & { task_count?: number; days_inactive?: number })[]> {
  const { data, error } = await supabase
    .from('digital_projects')
    .select('*')
    .eq('is_archived', false);

  if (error) throw new Error(`DB query error: ${error.message}`);

  const projects = (data || []) as DigitalProject[];
  const projectIds = projects.map((p) => p.id);

  const taskCounts = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('project_id')
      .in('project_id', projectIds)
      .eq('is_archived', false);

    if (taskError) throw new Error(`DB query error: ${taskError.message}`);
    for (const task of (tasks || []) as { project_id: string | null }[]) {
      if (task.project_id) taskCounts.set(task.project_id, (taskCounts.get(task.project_id) || 0) + 1);
    }
  }

  return projects
    .map((project) => ({
      ...project,
      task_count: taskCounts.get(project.id) || 0,
      days_inactive: daysInactive(project.last_activity),
    }))
    .sort(sortProjects);
}

export async function getProjectById(id: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('digital_projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  if (!data) return null;

  const project = data as unknown as DigitalProject;
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('status')
    .eq('project_id', id)
    .eq('is_archived', false);

  if (taskError) throw new Error(`DB query error: ${taskError.message}`);

  const taskRows = (tasks || []) as { status: string }[];
  return {
    ...project,
    task_count: taskRows.length,
    tasks_done: taskRows.filter((t) => t.status === 'completed').length,
    tasks_blocked: taskRows.filter((t) => t.status === 'blocked').length,
    days_inactive: daysInactive(project.last_activity),
  };
}

export async function createProject(data: Partial<DigitalProject>): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();

  const { error } = await supabase.from('digital_projects').insert({
    id,
    work_type: data.work_type || 'personal',
    client_id: data.client_id ?? null,
    amount: data.amount ?? null,
    payment_status: data.payment_status || 'pending',
    name: data.name || 'Sin nombre',
    description: data.description ?? null,
    current_objective: data.current_objective ?? null,
    status: data.status || 'idea',
    priority: data.priority || 'medium',
    progress: data.progress || 0,
    start_date: data.start_date || todayStr(),
    target_date: data.target_date ?? null,
    last_activity: now,
    next_step: data.next_step ?? null,
    local_folder: data.local_folder ?? null,
    repository: data.repository ?? null,
    url: data.url ?? null,
    technologies: data.technologies ?? null,
    notes: data.notes ?? null,
    created_at: now,
    updated_at: now,
    is_archived: false,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const project = await getProjectById(id);
  if (project) await syncAutomaticTasksForProject(project);
  return project;
}

export async function updateProject(id: string, data: any): Promise<any | null> {
  const updateData: Record<string, unknown> = {};
  const allowed: (keyof DigitalProject)[] = [
    'work_type', 'client_id', 'amount', 'payment_status',
    'name', 'description', 'current_objective', 'status', 'priority', 'progress',
    'start_date', 'target_date', 'next_step', 'local_folder', 'repository', 'url', 'technologies', 'notes',
  ];

  for (const field of allowed) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (Object.keys(updateData).length === 0) return getProjectById(id);

  const now = nowStr();
  updateData.updated_at = now;
  updateData.last_activity = now;

  const { error } = await supabase.from('digital_projects').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);

  const project = await getProjectById(id);
  if (project) await syncAutomaticTasksForProject(project);
  return project;
}

export async function archiveProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('digital_projects')
    .update({ is_archived: true, updated_at: nowStr() })
    .eq('id', id);

  if (error) throw new Error(`DB archive error: ${error.message}`);
  await archiveAutomaticTasksForSource('project', id);
}

export async function deleteProject(id: string): Promise<void> {
  // Hard-delete project-owned data so deleted projects leave no financial/history residue.
  const deletes = [
    supabase.from('income').delete().eq('project_id', id),
    supabase.from('expenses').delete().eq('project_id', id),
    supabase.from('prompts').delete().eq('project_id', id),
    supabase.from('documents').delete().eq('project_id', id),
    supabase.from('work_sessions').delete().eq('project_id', id),
    supabase.from('tasks').delete().eq('project_id', id),
    supabase.from('digital_projects').delete().eq('id', id),
  ];

  for (const result of await Promise.all(deletes)) {
    if (result.error) throw new Error(`DB delete error: ${result.error.message}`);
  }
  await deleteAutomaticTasksForSource('project', id);
  await deleteFinanceForSource('project', id);
}

// ─── Prompts ───

export async function getPrompts(projectId?: string): Promise<any[]> {
  let q = supabase
    .from('prompts')
    .select('*, digital_projects!project_id(name)')
    .order('created_at', { ascending: false });

  if (projectId) q = q.eq('project_id', projectId);

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data as Record<string, unknown>[]) || []).map(flattenProjectName);
}

export async function createPrompt(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('prompts').insert({
    id,
    title: data.title || 'Sin título',
    prompt_text: data.prompt_text || '',
    tool: data.tool ?? null,
    project_id: data.project_id ?? null,
    objective: data.objective ?? null,
    expected_result: data.expected_result ?? null,
    actual_result: data.actual_result ?? null,
    status: data.status || 'draft',
    affected_files: data.affected_files ?? null,
    notes: data.notes ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const { data: row, error: getError } = await supabase.from('prompts').select('*').eq('id', id).maybeSingle();
  if (getError) throw new Error(`DB query error: ${getError.message}`);
  return row || null;
}

export async function updatePrompt(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  const allowed = ['title', 'prompt_text', 'tool', 'project_id', 'objective', 'expected_result', 'actual_result', 'status', 'affected_files', 'notes'];
  for (const field of allowed) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('prompts').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase.from('prompts').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ─── Documents ───

export async function getDocuments(projectId?: string): Promise<any[]> {
  let q = supabase
    .from('documents')
    .select('*, digital_projects!project_id(name)')
    .order('updated_at', { ascending: false });

  if (projectId) q = q.eq('project_id', projectId);

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data as Record<string, unknown>[]) || []).map(flattenProjectName);
}

export async function createDocument(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('documents').insert({
    id,
    project_id: data.project_id ?? null,
    title: data.title || 'Sin título',
    content: data.content ?? null,
    doc_type: data.doc_type || 'general',
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const { data: row, error: getError } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
  if (getError) throw new Error(`DB query error: ${getError.message}`);
  return row || null;
}

export async function updateDocument(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  for (const field of ['title', 'content', 'doc_type', 'project_id']) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('documents').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ─── Work Sessions ───

export async function getWorkSessions(projectId?: string): Promise<any[]> {
  let q = supabase
    .from('work_sessions')
    .select('*')
    .order('start_time', { ascending: false });

  if (projectId) q = q.eq('project_id', projectId);

  const { data, error } = await q;
  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data as Record<string, unknown>[]) || [];
}

export async function createWorkSession(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('work_sessions').insert({
    id,
    project_id: data.project_id ?? null,
    task_id: data.task_id ?? null,
    session_type: data.session_type ?? null,
    start_time: data.start_time || now,
    end_time: data.end_time ?? null,
    duration: data.duration ? parseInt(data.duration, 10) : null,
    description: data.description ?? null,
    result: data.result ?? null,
    notes: data.notes ?? null,
    created_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const { data: row, error: getError } = await supabase.from('work_sessions').select('*').eq('id', id).maybeSingle();
  if (getError) throw new Error(`DB query error: ${getError.message}`);
  return row || null;
}

export async function deleteWorkSession(id: string): Promise<void> {
  const { error } = await supabase.from('work_sessions').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ─── Stats ───

export async function getProjectStats(): Promise<{
  active: number; stalled: number; total: number; prompts: number;
}> {
  const [active, stalled, total, prompts] = await Promise.all([
    countRows('digital_projects', (q) => q.in('status', ['development', 'testing', 'planning']).eq('is_archived', false)),
    countRows('digital_projects', (q) => q.in('status', ['paused', 'blocked', 'idea']).eq('is_archived', false)),
    countRows('digital_projects', (q) => q.eq('is_archived', false)),
    countRows('prompts'),
  ]);

  return { active, stalled, total, prompts };
}

// ─── Demo ───

export async function seedDemoProjects(): Promise<void> {
  const existing = await countRows('digital_projects');
  if (existing > 0) return;

  const p1 = await createProject({
    name: 'Hiphopizados', description: 'Plataforma de contenido y comunidad hip hop', status: 'development',
    priority: 'high', progress: 65, current_objective: 'Implementar sistema de publicaciones',
    next_step: 'Terminar módulo de comentarios', local_folder: 'E:/dev/hiphopizados',
    technologies: 'Next.js, Supabase, Tailwind', target_date: '2026-09-30',
  });
  await createPrompt({ project_id: p1.id, title: 'Generar schema de publicaciones', prompt_text: 'Create a posts table with...', tool: 'Claude', status: 'worked', objective: 'Crear tabla de posts' });
  await createDocument({ project_id: p1.id, title: 'Arquitectura del sistema', doc_type: 'architecture', content: '# Arquitectura\n\nFrontend: Next.js App Router\nBackend: Supabase\nDB: PostgreSQL' });

  const p2 = await createProject({
    name: 'FlowTrack', description: 'Esta misma app', status: 'development',
    priority: 'urgent', progress: 40, current_objective: 'Completar módulos de gestión',
    next_step: 'Implementar finanzas', local_folder: 'E:/dev/WorkStation/flowtrack',
    technologies: 'Tauri, React, SQLite, Tailwind', target_date: '2026-08-30',
  });
  await createWorkSession({ project_id: p2.id, session_type: 'development', duration: 120, description: 'Implementación módulo de tareas', result: 'CRUD completo + vista kanban' });
  await createWorkSession({ project_id: p2.id, session_type: 'development', duration: 90, description: 'Módulo de clientes', result: 'Ficha con búsqueda y demo data' });

  await createProject({ name: 'CLUBHH', description: 'Comunidad de hip hop chileno', status: 'maintenance', priority: 'medium', progress: 90, technologies: 'Next.js, Tailwind' });
  await createProject({ name: 'HHTickets', description: 'Venta de entradas para eventos', status: 'paused', priority: 'low', progress: 30, notes: 'Esperando nuevos requerimientos' });
}
