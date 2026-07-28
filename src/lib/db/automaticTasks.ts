import { supabase } from '../supabase';
import { localDateTimeSql } from '../date';
import type {
  AgendaItem, Client, Consultancy, DigitalProject, Job, Reel,
  ReelStatus, Task, YouTubeStatus, YouTubeVideo,
} from '../types';

interface AutomaticTaskRule<T> {
  ruleKey: string;
  title: (entity: T) => string;
  description: (entity: T) => string;
  status: Task['status'];
  area: string;
  estimatedTime: number;
  priority?: (entity: T) => Task['priority'];
  dueDate?: (entity: T) => string | null;
  clientId?: (entity: T) => string | null;
  jobId?: (entity: T) => string | null;
  projectId?: (entity: T) => string | null;
  tags?: (entity: T) => string;
  notes?: (entity: T) => string;
}

type Receivable = {
  id: string; client_id: string | null; job_id: string | null;
  balance: number; due_date: string | null;
  status: 'pending' | 'partial' | 'overdue' | 'paid' | 'cancelled';
  notes: string | null;
};

const AUTO_NOTE = 'Tarea automática generada desde el estado del registro. No se duplica: cambia cuando avanza el flujo.';

const REEL_TASK_RULES: Partial<Record<ReelStatus, AutomaticTaskRule<Reel>>> = {
  idea: { ruleKey: 'reel_write_script', title: (r) => `[Reel] Escribir guion: ${r.title}`, description: (r) => `Convertir la idea del reel en guion listo para grabar.${r.idea ? `\n\nIdea: ${r.idea}` : ''}`, status: 'pending', area: 'content', estimatedTime: 45 },
  script: { ruleKey: 'reel_prepare_recording', title: (r) => `[Reel] Preparar grabación: ${r.title}`, description: () => 'Revisar guion, locación, recursos y dejar el reel listo para grabar.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (r) => r.recording_date },
  ready_to_record: { ruleKey: 'reel_record', title: (r) => `[Reel] Grabar: ${r.title}`, description: () => 'Grabar el material del reel según el guion y objetivo definido.', status: 'in_progress', area: 'video', estimatedTime: 60, dueDate: (r) => r.recording_date },
  recorded: { ruleKey: 'reel_edit', title: (r) => `[Reel] Editar: ${r.title}`, description: () => 'Editar el material grabado, ritmo, cortes, subtítulos y audio final.', status: 'in_progress', area: 'video', estimatedTime: 90, dueDate: (r) => r.editing_date },
  editing: { ruleKey: 'reel_review', title: (r) => `[Reel] Revisar edición: ${r.title}`, description: () => 'Revisar edición final, copy, CTA, portada y calidad antes de programar.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (r) => r.scheduled_date },
  reviewing: { ruleKey: 'reel_schedule', title: (r) => `[Reel] Programar publicación: ${r.title}`, description: () => 'Programar el reel en la plataforma definida y dejar copy/hashtags listos.', status: 'in_progress', area: 'content', estimatedTime: 20, dueDate: (r) => r.scheduled_date },
  scheduled: { ruleKey: 'reel_publish_check', title: (r) => `[Reel] Verificar publicación: ${r.title}`, description: () => 'Confirmar que el reel se publicó correctamente y guardar enlace de publicación.', status: 'in_progress', area: 'content', estimatedTime: 15, dueDate: (r) => r.published_date || r.scheduled_date },
  published: { ruleKey: 'reel_review_metrics', title: (r) => `[Reel] Revisar métricas: ${r.title}`, description: () => 'Revisar rendimiento inicial del reel y anotar aprendizajes para próximos contenidos.', status: 'pending', area: 'content', estimatedTime: 20 },
};

const YOUTUBE_TASK_RULES: Partial<Record<YouTubeStatus, AutomaticTaskRule<YouTubeVideo>>> = {
  idea: { ruleKey: 'youtube_research_angle', title: (v) => `[YouTube] Investigar enfoque: ${v.provisional_title}`, description: (v) => `Definir objetivo, referencias y ángulo del video.${v.idea ? `\n\nIdea: ${v.idea}` : ''}`, status: 'pending', area: 'content', estimatedTime: 60 },
  research: { ruleKey: 'youtube_write_script', title: (v) => `[YouTube] Escribir guion: ${v.provisional_title}`, description: () => 'Convertir la investigación en guion estructurado con intro, desarrollo, CTA y cierre.', status: 'in_progress', area: 'content', estimatedTime: 120 },
  script: { ruleKey: 'youtube_prepare_recording', title: (v) => `[YouTube] Preparar grabación: ${v.provisional_title}`, description: () => 'Revisar guion, recursos, material de apoyo y setup de grabación.', status: 'in_progress', area: 'content', estimatedTime: 45, dueDate: (v) => v.recording_date },
  ready_to_record: { ruleKey: 'youtube_record', title: (v) => `[YouTube] Grabar: ${v.provisional_title}`, description: () => 'Grabar el video completo y respaldar material bruto.', status: 'in_progress', area: 'video', estimatedTime: 120, dueDate: (v) => v.recording_date },
  recorded: { ruleKey: 'youtube_edit', title: (v) => `[YouTube] Editar: ${v.provisional_title}`, description: () => 'Editar corte base, ritmo, audio, B-roll, capítulos y elementos visuales.', status: 'in_progress', area: 'video', estimatedTime: 180, dueDate: (v) => v.editing_date },
  editing: { ruleKey: 'youtube_thumbnail', title: (v) => `[YouTube] Crear miniatura: ${v.provisional_title}`, description: () => 'Diseñar miniatura, título final y descripción optimizada.', status: 'in_progress', area: 'design', estimatedTime: 45 },
  thumbnail: { ruleKey: 'youtube_review', title: (v) => `[YouTube] Revisar: ${v.provisional_title}`, description: () => 'Revisar export final, miniatura, título, descripción, tags y calidad antes de publicar.', status: 'in_progress', area: 'content', estimatedTime: 45 },
  review: { ruleKey: 'youtube_schedule', title: (v) => `[YouTube] Programar publicación: ${v.provisional_title}`, description: () => 'Subir/programar el video y verificar metadata completa.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (v) => v.published_date },
  scheduled: { ruleKey: 'youtube_publish_check', title: (v) => `[YouTube] Verificar publicación: ${v.provisional_title}`, description: () => 'Confirmar que el video quedó publicado correctamente y guardar enlace.', status: 'in_progress', area: 'content', estimatedTime: 15, dueDate: (v) => v.published_date },
  published: { ruleKey: 'youtube_review_metrics', title: (v) => `[YouTube] Revisar métricas: ${v.final_title || v.provisional_title}`, description: () => 'Revisar rendimiento inicial, retención, CTR y aprendizajes para próximos videos.', status: 'pending', area: 'content', estimatedTime: 30 },
};


const PROJECT_TASK_RULES: Partial<Record<DigitalProject['status'], AutomaticTaskRule<DigitalProject>>> = {
  idea: { ruleKey: 'project_define_objective', title: (p) => `[Proyecto] Definir objetivo: ${p.name}`, description: (p) => `Convertir la idea en objetivo accionable.${p.description ? `\n\nDescripción: ${p.description}` : ''}`, status: 'pending', area: 'development', estimatedTime: 45 },
  research: { ruleKey: 'project_finish_research', title: (p) => `[Proyecto] Cerrar investigación: ${p.name}`, description: () => 'Reunir referencias, riesgos y decisión técnica para pasar a planificación.', status: 'in_progress', area: 'development', estimatedTime: 60 },
  planning: { ruleKey: 'project_plan_next_block', title: (p) => `[Proyecto] Planificar: ${p.name}`, description: (p) => p.next_step || 'Definir tareas, dependencias y primer hito implementable.', status: 'in_progress', area: 'development', estimatedTime: 45, dueDate: (p) => p.target_date },
  development: { ruleKey: 'project_execute_next_step', title: (p) => `[Proyecto] Ejecutar: ${p.name}`, description: (p) => p.next_step || 'Avanzar el siguiente hito del proyecto.', status: 'in_progress', area: 'development', estimatedTime: 90, dueDate: (p) => p.target_date },
  testing: { ruleKey: 'project_test_release', title: (p) => `[Proyecto] Probar release: ${p.name}`, description: () => 'Ejecutar pruebas, revisar errores y dejar lista la entrega/lanzamiento.', status: 'testing', area: 'development', estimatedTime: 60, dueDate: (p) => p.target_date },
  blocked: { ruleKey: 'project_unblock', title: (p) => `[Proyecto] Desbloquear: ${p.name}`, description: (p) => p.next_step || 'Identificar bloqueo real y decidir la acción mínima para continuar.', status: 'blocked', area: 'development', estimatedTime: 30, priority: () => 'urgent' },
  paused: { ruleKey: 'project_reactivate_or_archive', title: (p) => `[Proyecto] Decidir continuidad: ${p.name}`, description: () => 'Revisar si se reactiva, se posterga con fecha o se archiva el proyecto.', status: 'in_progress', area: 'development', estimatedTime: 30 },
  maintenance: { ruleKey: 'project_maintenance_check', title: (p) => `[Proyecto] Mantenimiento: ${p.name}`, description: () => 'Revisar estado, pendientes, dependencias y próximos ajustes de mantenimiento.', status: 'in_progress', area: 'development', estimatedTime: 45 },
};

const CONSULTANCY_TASK_RULES: Partial<Record<Consultancy['status'], AutomaticTaskRule<Consultancy>>> = {
  requested: { ruleKey: 'consultancy_schedule', title: (c) => `[Asesoría] Agendar: ${c.topic}`, description: () => 'Confirmar fecha, hora, objetivo y medio de contacto con el cliente.', status: 'in_progress', area: 'consultancy', estimatedTime: 15, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  scheduled: { ruleKey: 'consultancy_prepare', title: (c) => `[Asesoría] Preparar: ${c.topic}`, description: (c) => c.pre_notes || c.objective || 'Preparar diagnóstico, pauta y materiales para la sesión.', status: 'in_progress', area: 'consultancy', estimatedTime: 45, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  confirmed: { ruleKey: 'consultancy_run_session', title: (c) => `[Asesoría] Realizar: ${c.topic}`, description: () => 'Realizar sesión, registrar diagnóstico, acuerdos y próximos pasos.', status: 'in_progress', area: 'consultancy', estimatedTime: 60, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  in_follow_up: { ruleKey: 'consultancy_follow_up', title: (c) => `[Asesoría] Seguimiento: ${c.topic}`, description: (c) => c.follow_up || 'Contactar al cliente, revisar avances y acordar siguiente paso.', status: 'in_progress', area: 'consultancy', estimatedTime: 30, dueDate: (c) => c.follow_up || c.date, clientId: (c) => c.client_id },
};

const CLIENT_TASK_RULES: Partial<Record<Client['status'], AutomaticTaskRule<Client>>> = {
  prospect: { ruleKey: 'client_first_follow_up', title: (c) => `[Cliente] Seguimiento prospecto: ${c.name}`, description: (c) => `Contactar y definir próximo paso comercial.${c.notes ? `\n\nNotas: ${c.notes}` : ''}`, status: 'in_progress', area: 'admin', estimatedTime: 15, dueDate: (c) => c.first_contact_date, clientId: (c) => c.id },
  inactive: { ruleKey: 'client_reactivate', title: (c) => `[Cliente] Reactivar: ${c.name}`, description: () => 'Revisar historial y enviar propuesta/mensaje para reactivar relación comercial.', status: 'in_progress', area: 'admin', estimatedTime: 20, priority: () => 'medium', clientId: (c) => c.id },
};

const RECEIVABLE_TASK_RULES: Partial<Record<Receivable['status'], AutomaticTaskRule<Receivable>>> = {
  pending: { ruleKey: 'receivable_collect_pending', title: (r) => `[Cobro] Pago pendiente${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Gestionar cobro pendiente y registrar avance del pago.', status: 'in_progress', area: 'finance', estimatedTime: 15, dueDate: (r) => r.due_date, priority: () => 'high', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
  partial: { ruleKey: 'receivable_collect_balance', title: (r) => `[Cobro] Saldo pendiente${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Gestionar cobro del saldo restante.', status: 'in_progress', area: 'finance', estimatedTime: 15, dueDate: (r) => r.due_date, priority: () => 'high', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
  overdue: { ruleKey: 'receivable_collect_overdue', title: (r) => `[Cobro] Vencido${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Contactar al cliente por pago vencido y definir compromiso de pago.', status: 'in_progress', area: 'finance', estimatedTime: 20, dueDate: (r) => r.due_date, priority: () => 'urgent', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
};

const AGENDA_TASK_RULES: Partial<Record<AgendaItem['status'], AutomaticTaskRule<AgendaItem>>> = {
  pending: { ruleKey: 'agenda_prepare', title: (a) => `[Agenda] Preparar: ${a.title}`, description: (a) => a.description || 'Preparar materiales, revisar agenda y confirmar detalles del compromiso.', status: 'pending', area: 'admin', estimatedTime: 15, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
  confirmed: { ruleKey: 'agenda_execute', title: (a) => `[Agenda] Ejecutar: ${a.title}`, description: (a) => a.description || 'Asistir y ejecutar el compromiso según lo planificado.', status: 'in_progress', area: 'admin', estimatedTime: 30, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, priority: () => 'high', tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
  in_progress: { ruleKey: 'agenda_finish', title: (a) => `[Agenda] Finalizar: ${a.title}`, description: (a) => a.description || 'Cerrar el compromiso, registrar resultados y próximos pasos.', status: 'in_progress', area: 'admin', estimatedTime: 15, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, priority: () => 'high', tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
};

const VIDEOCLIP_FINISHED = ['final_delivery'];
const VIDEOCLIP_TASK_RULES: Record<string, AutomaticTaskRule<{ id: string; title: string; preproduction_date?: string | null; recording_date?: string | null; first_delivery_date?: string | null; final_delivery_date?: string | null; requested_changes?: string | null }>> = {
  idea: { ruleKey: 'videoclip_write_script', title: (v) => `[Videoclip] Escribir guion: ${v.title}`, description: () => 'Desarrollar concepto, guion y referencias visuales para el videoclip.', status: 'pending', area: 'content', estimatedTime: 60 },
  concept: { ruleKey: 'videoclip_pre_production', title: (v) => `[Videoclip] Preproducción: ${v.title}`, description: () => 'Planificar locaciones, equipo, vestuario y cronograma de rodaje.', status: 'in_progress', area: 'video', estimatedTime: 120, dueDate: (v) => v.preproduction_date ?? null },
  preproduction: { ruleKey: 'videoclip_record', title: (v) => `[Videoclip] Grabar: ${v.title}`, description: () => 'Rodar el videoclip según plan de preproducción.', status: 'in_progress', area: 'video', estimatedTime: 480, dueDate: (v) => v.recording_date ?? null },
  recording: { ruleKey: 'videoclip_edit', title: (v) => `[Videoclip] Editar: ${v.title}`, description: () => 'Editar material bruto, colorización, efectos y sincronización.', status: 'in_progress', area: 'video', estimatedTime: 240 },
  editing: { ruleKey: 'videoclip_first_delivery', title: (v) => `[Videoclip] Primera entrega: ${v.title}`, description: () => 'Entregar primer corte al cliente para revisión.', status: 'in_progress', area: 'video', estimatedTime: 60, dueDate: (v) => v.first_delivery_date ?? null },
  first_delivery: { ruleKey: 'videoclip_changes', title: (v) => `[Videoclip] Revisar cambios: ${v.title}`, description: (v) => v.requested_changes ? `Cambios solicitados: ${v.requested_changes}` : 'Aplicar correcciones solicitadas por el cliente.', status: 'in_progress', area: 'video', estimatedTime: 120 },
  changes: { ruleKey: 'videoclip_final_delivery', title: (v) => `[Videoclip] Entrega final: ${v.title}`, description: () => 'Entregar versión final del videoclip con todos los cambios aplicados.', status: 'in_progress', area: 'video', estimatedTime: 60, dueDate: (v) => v.final_delivery_date ?? null },
};



function nowSql(): string {
  return localDateTimeSql();
}

async function archiveStaleAutomaticTasks(sourceType: string, sourceId: string, activeRuleKey: string | null): Promise<void> {
  const now = nowSql();
  let q = supabase.from('tasks').update({ is_archived: true, updated_at: now })
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('auto_generated', true)
    .eq('is_archived', false);

  if (activeRuleKey) {
    q = q.neq('rule_key', activeRuleKey);
  }
  const { error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);
}

async function getTaskByIdUnsafe(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).limit(1).maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return (data as unknown as Task) || null;
}

async function syncAutomaticTask<T extends { id: string; priority?: Task['priority'] | null }>(
  sourceType: string, entity: T, rule: AutomaticTaskRule<T> | null | undefined
): Promise<Task | null> {
  await archiveStaleAutomaticTasks(sourceType, entity.id, rule?.ruleKey || null);
  if (!rule) return null;

  const { data: existing } = await supabase
    .from('tasks')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', entity.id)
    .eq('rule_key', rule.ruleKey)
    .eq('auto_generated', true)
    .is('parent_task_id', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const taskData = {
    title: rule.title(entity),
    description: rule.description(entity),
    area: rule.area,
    client_id: rule.clientId?.(entity) || null,
    job_id: rule.jobId?.(entity) || null,
    project_id: rule.projectId?.(entity) || null,
    priority: rule.priority?.(entity) || entity.priority || 'medium',
    status: rule.status,
    due_date: rule.dueDate?.(entity) || null,
    estimated_time: rule.estimatedTime,
    tags: rule.tags?.(entity) || ['auto', sourceType].join(', '),
    notes: rule.notes?.(entity) || AUTO_NOTE,
  };

  const now = nowSql();

  if (existing) {
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      return existing as unknown as Task;
    }
    const { error } = await supabase.from('tasks').update({ ...taskData, updated_at: now }).eq('id', (existing as any).id);
    if (error) throw new Error(`DB error: ${error.message}`);
    return getTaskByIdUnsafe((existing as any).id);
  }

  const newTaskId = crypto.randomUUID();
  const { error: insertError } = await supabase.from('tasks').insert({
    id: newTaskId,
    ...taskData,
    source_type: sourceType,
    source_id: entity.id,
    rule_key: rule.ruleKey,
    auto_generated: true,
    parent_task_id: null,
    created_at: now,
    updated_at: now,
  });
  if (insertError) {
    // Unique constraint violation — otra instancia ya creó la tarea entre el SELECT y el INSERT
    // Buscamos la existente y la actualizamos
    const { data: raced } = await supabase
      .from('tasks')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', entity.id)
      .eq('rule_key', rule.ruleKey)
      .eq('auto_generated', true)
      .is('parent_task_id', null)
      .eq('is_archived', false)
      .maybeSingle();
    if (raced) {
      await supabase.from('tasks').update({ ...taskData, updated_at: now }).eq('id', (raced as any).id);
      return getTaskByIdUnsafe((raced as any).id);
    }
    throw new Error(`DB error: ${insertError.message}`);
  }
  return getTaskByIdUnsafe(newTaskId);
}


export async function syncAutomaticTasksForReel(reel: Reel): Promise<void> {
  // Main task: next phase based on current status
  // Payment/collection tasks are handled by the receivables module via syncAutomaticTasksForReceivable
  const finished = reel.is_archived || ['discarded', 'paused', 'published'].includes(reel.status);
  const rule = finished ? null : REEL_TASK_RULES[reel.status];
  await syncAutomaticTask('reel', reel, rule);
}

export async function syncAutomaticTasksForYouTube(video: YouTubeVideo): Promise<void> {
  // Main task: next phase based on current status
  // Payment/collection tasks are handled by the receivables module via syncAutomaticTasksForReceivable
  const finished = video.is_archived || ['discarded', 'paused', 'published'].includes(video.status);
  const rule = finished ? null : YOUTUBE_TASK_RULES[video.status];
  await syncAutomaticTask('youtube', video, rule);
}

export async function syncAutomaticTasksForJob(_job: Job): Promise<void> {
  // Jobs module deprecated — no tasks generated
}

export async function syncAutomaticTasksForProject(project: DigitalProject): Promise<void> {
  const finished = project.is_archived || ['launched', 'archived'].includes(project.status);
  const rule = finished ? null : PROJECT_TASK_RULES[project.status];
  if (rule) {
    await syncAutomaticTask('project', project, { ...rule, projectId: () => project.id, tags: (p) => ['auto', 'project', (p as any).technologies].filter(Boolean).join(', ') });
  } else {
    await syncAutomaticTask('project', project, null);
  }
  // Payment/collection tasks are handled by the receivables module via syncAutomaticTasksForReceivable
}

export async function syncAutomaticTasksForConsultancy(consultancy: Consultancy): Promise<void> {
  // 'paid' no genera tarea de trabajo — el módulo finanzas maneja los cobros vía syncConsultanciesIntoFinance
  const rule = consultancy.is_archived || ['paid', 'completed', 'closed', 'cancelled'].includes(consultancy.status)
    ? null : CONSULTANCY_TASK_RULES[consultancy.status];
  await syncAutomaticTask('consultancy', consultancy, rule);
}

export async function syncAutomaticTasksForClient(client: Client): Promise<void> {
  const rule = client.is_archived || ['active', 'frequent', 'archived'].includes(client.status)
    ? null : CLIENT_TASK_RULES[client.status];
  await syncAutomaticTask('client', client, rule);
}

export async function syncAutomaticTasksForReceivable(receivable: Receivable): Promise<void> {
  // All pending receivables get a collection task, even if linked to a job.
  // The job task covers the WORK phase; this covers the PAYMENT phase.
  const finished = ['paid', 'cancelled'].includes(receivable.status);
  const rule = finished ? null : RECEIVABLE_TASK_RULES[receivable.status];

  // If linked to a job, include job context in the task notes
  if (receivable.job_id && rule) {
    const existingNotes = rule.notes ? rule.notes(receivable) : '';
    const enrichedRule: AutomaticTaskRule<Receivable> = {
      ...rule,
      notes: () => `${existingNotes}
Vinculado al trabajo ${receivable.job_id ? receivable.job_id.slice(0, 8) : ''}`,
    };
    await syncAutomaticTask('receivable', receivable, enrichedRule);
  } else {
    await syncAutomaticTask('receivable', receivable, rule);
  }
}

export async function syncAutomaticTasksForAgenda(item: AgendaItem): Promise<void> {
  const rule = item.is_archived || ['done', 'cancelled'].includes(item.status)
    ? null : AGENDA_TASK_RULES[item.status];
  await syncAutomaticTask('agenda', item, rule);
}

export async function syncAutomaticTasksForVideoclip(videoclip: { id: string; title: string; status: string; is_archived?: boolean; preproduction_date?: string | null; recording_date?: string | null; first_delivery_date?: string | null; final_delivery_date?: string | null; requested_changes?: string | null }): Promise<void> {
  const finished = videoclip.is_archived || VIDEOCLIP_FINISHED.includes(videoclip.status);
  const rule = finished ? null : (VIDEOCLIP_TASK_RULES[videoclip.status] || null);
  await syncAutomaticTask('videoclip', videoclip, rule);
}

async function restoreCompletedAutomaticTasks(): Promise<void> {
  const now = nowSql();
  const { error } = await supabase
    .from('tasks')
    .update({ is_archived: false, updated_at: now })
    .eq('auto_generated', true)
    .eq('status', 'completed')
    .eq('is_archived', true);
  if (error) throw new Error(`DB error: ${error.message}`);
}

let syncAllAutomaticTasksRunning = false;

export async function syncAllAutomaticTasks(): Promise<void> {
  if (syncAllAutomaticTasksRunning) return;
  syncAllAutomaticTasksRunning = true;
  try {
    await restoreCompletedAutomaticTasks();

    const [reelsResult, videosResult, projectsResult, consultanciesResult, clientsResult, receivablesResult, videoclipsResult] = await Promise.all([
      supabase.from('reels').select('*').eq('is_archived', false),
      supabase.from('youtube_videos').select('*').eq('is_archived', false),
      supabase.from('digital_projects').select('*').eq('is_archived', false),
      supabase.from('consultancies').select('*').eq('is_archived', false),
      supabase.from('clients').select('*').eq('is_archived', false),
      supabase.from('receivables').select('*').in('status', ['pending', 'partial', 'overdue']),
      supabase.from('filmmaker_videoclips').select('*'),
    ]);

    const reels = (reelsResult.data || []) as unknown as Reel[];
    const videos = (videosResult.data || []) as unknown as YouTubeVideo[];
    const projects = (projectsResult.data || []) as unknown as DigitalProject[];
    const consultancies = (consultanciesResult.data || []) as unknown as Consultancy[];
    const clients = (clientsResult.data || []) as unknown as Client[];
    const receivables = (receivablesResult.data || []) as unknown as Receivable[];
    const videoclips = (videoclipsResult.data || []) as unknown as { id: string; title: string; status: string; is_archived?: boolean; preproduction_date?: string | null; recording_date?: string | null; first_delivery_date?: string | null; final_delivery_date?: string | null; requested_changes?: string | null }[];

    await Promise.allSettled([
      ...reels.map(r => syncAutomaticTasksForReel(r)),
      ...videos.map(v => syncAutomaticTasksForYouTube(v)),
      ...projects.map(p => syncAutomaticTasksForProject(p)),
      ...consultancies.map(c => syncAutomaticTasksForConsultancy(c)),
      ...clients.map(c => syncAutomaticTasksForClient(c)),
      ...receivables.map(r => syncAutomaticTasksForReceivable(r)),
      ...videoclips.map(v => syncAutomaticTasksForVideoclip(v)),
    ]);
  } finally {
    syncAllAutomaticTasksRunning = false;
  }
}

export async function archiveAutomaticTasksForSource(sourceType: string, sourceId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ is_archived: true, updated_at: nowSql() })
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('auto_generated', true);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function deleteAutomaticTasksForSource(sourceType: string, sourceId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('auto_generated', true);
  if (error) throw new Error(`DB error: ${error.message}`);
}
