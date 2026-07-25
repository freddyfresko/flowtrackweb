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
  idea: { ruleKey: 'reel_write_script', title: (r) => `Escribir guion: ${r.title}`, description: (r) => `Convertir la idea del reel en guion listo para grabar.${r.idea ? `\n\nIdea: ${r.idea}` : ''}`, status: 'pending', area: 'content', estimatedTime: 45 },
  script: { ruleKey: 'reel_prepare_recording', title: (r) => `Preparar grabación: ${r.title}`, description: () => 'Revisar guion, locación, recursos y dejar el reel listo para grabar.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (r) => r.recording_date },
  ready_to_record: { ruleKey: 'reel_record', title: (r) => `Grabar reel: ${r.title}`, description: () => 'Grabar el material del reel según el guion y objetivo definido.', status: 'in_progress', area: 'video', estimatedTime: 60, dueDate: (r) => r.recording_date },
  recorded: { ruleKey: 'reel_edit', title: (r) => `Editar reel: ${r.title}`, description: () => 'Editar el material grabado, ritmo, cortes, subtítulos y audio final.', status: 'in_progress', area: 'video', estimatedTime: 90, dueDate: (r) => r.editing_date },
  editing: { ruleKey: 'reel_review', title: (r) => `Revisar reel editado: ${r.title}`, description: () => 'Revisar edición final, copy, CTA, portada y calidad antes de programar.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (r) => r.scheduled_date },
  reviewing: { ruleKey: 'reel_schedule', title: (r) => `Programar publicación: ${r.title}`, description: () => 'Programar el reel en la plataforma definida y dejar copy/hashtags listos.', status: 'in_progress', area: 'content', estimatedTime: 20, dueDate: (r) => r.scheduled_date },
  scheduled: { ruleKey: 'reel_publish_check', title: (r) => `Verificar publicación: ${r.title}`, description: () => 'Confirmar que el reel se publicó correctamente y guardar enlace de publicación.', status: 'in_progress', area: 'content', estimatedTime: 15, dueDate: (r) => r.published_date || r.scheduled_date },
  published: { ruleKey: 'reel_review_metrics', title: (r) => `Revisar métricas: ${r.title}`, description: () => 'Revisar rendimiento inicial del reel y anotar aprendizajes para próximos contenidos.', status: 'pending', area: 'content', estimatedTime: 20 },
};

const YOUTUBE_TASK_RULES: Partial<Record<YouTubeStatus, AutomaticTaskRule<YouTubeVideo>>> = {
  idea: { ruleKey: 'youtube_research_angle', title: (v) => `Investigar enfoque YouTube: ${v.provisional_title}`, description: (v) => `Definir objetivo, referencias y ángulo del video.${v.idea ? `\n\nIdea: ${v.idea}` : ''}`, status: 'pending', area: 'content', estimatedTime: 60 },
  research: { ruleKey: 'youtube_write_script', title: (v) => `Escribir guion YouTube: ${v.provisional_title}`, description: () => 'Convertir la investigación en guion estructurado con intro, desarrollo, CTA y cierre.', status: 'in_progress', area: 'content', estimatedTime: 120 },
  script: { ruleKey: 'youtube_prepare_recording', title: (v) => `Preparar grabación YouTube: ${v.provisional_title}`, description: () => 'Revisar guion, recursos, material de apoyo y setup de grabación.', status: 'in_progress', area: 'content', estimatedTime: 45, dueDate: (v) => v.recording_date },
  ready_to_record: { ruleKey: 'youtube_record', title: (v) => `Grabar video YouTube: ${v.provisional_title}`, description: () => 'Grabar el video completo y respaldar material bruto.', status: 'in_progress', area: 'video', estimatedTime: 120, dueDate: (v) => v.recording_date },
  recorded: { ruleKey: 'youtube_edit', title: (v) => `Editar video YouTube: ${v.provisional_title}`, description: () => 'Editar corte base, ritmo, audio, B-roll, capítulos y elementos visuales.', status: 'in_progress', area: 'video', estimatedTime: 180, dueDate: (v) => v.editing_date },
  editing: { ruleKey: 'youtube_thumbnail', title: (v) => `Crear miniatura YouTube: ${v.provisional_title}`, description: () => 'Diseñar miniatura, título final y descripción optimizada.', status: 'in_progress', area: 'design', estimatedTime: 45 },
  thumbnail: { ruleKey: 'youtube_review', title: (v) => `Revisar video YouTube: ${v.provisional_title}`, description: () => 'Revisar export final, miniatura, título, descripción, tags y calidad antes de publicar.', status: 'in_progress', area: 'content', estimatedTime: 45 },
  review: { ruleKey: 'youtube_schedule', title: (v) => `Programar publicación YouTube: ${v.provisional_title}`, description: () => 'Subir/programar el video y verificar metadata completa.', status: 'in_progress', area: 'content', estimatedTime: 30, dueDate: (v) => v.published_date },
  scheduled: { ruleKey: 'youtube_publish_check', title: (v) => `Verificar publicación YouTube: ${v.provisional_title}`, description: () => 'Confirmar que el video quedó publicado correctamente y guardar enlace.', status: 'in_progress', area: 'content', estimatedTime: 15, dueDate: (v) => v.published_date },
  published: { ruleKey: 'youtube_review_metrics', title: (v) => `Revisar métricas YouTube: ${v.final_title || v.provisional_title}`, description: () => 'Revisar rendimiento inicial, retención, CTR y aprendizajes para próximos videos.', status: 'pending', area: 'content', estimatedTime: 30 },
};

const JOB_TASK_RULES: Partial<Record<Job['status'], AutomaticTaskRule<Job>>> = {
  pending: { ruleKey: 'job_define_scope', title: (j) => `Definir alcance: ${j.title}`, description: () => 'Aterrizar requerimientos, entregables, presupuesto, anticipo y próximos pasos.', status: 'in_progress', area: 'admin', estimatedTime: 30 },
  in_progress: { ruleKey: 'job_advance_delivery', title: (j) => `Avanzar trabajo: ${j.title}`, description: (j) => `Ejecutar el siguiente bloque de producción.${j.notes ? `\n\nNotas: ${j.notes}` : ''}`, status: 'in_progress', area: 'production', estimatedTime: 90 },
  waiting_client: { ruleKey: 'job_contact_client', title: (j) => `Pedir respuesta al cliente: ${j.title}`, description: () => 'Contactar al cliente para destrabar materiales, aprobación o feedback pendiente.', status: 'in_progress', area: 'admin', estimatedTime: 15, priority: () => 'high' },
  in_review: { ruleKey: 'job_review_feedback', title: (j) => `Revisar feedback: ${j.title}`, description: () => 'Revisar observaciones, documentar cambios y preparar respuesta/entrega final.', status: 'in_progress', area: 'production', estimatedTime: 45 },
  with_changes: { ruleKey: 'job_apply_changes', title: (j) => `Aplicar cambios: ${j.title}`, description: () => 'Ejecutar cambios solicitados y preparar nueva versión para revisión.', status: 'in_progress', area: 'production', estimatedTime: 90, priority: () => 'high' },
  blocked: { ruleKey: 'job_unblock', title: (j) => `Desbloquear trabajo: ${j.title}`, description: () => 'Identificar bloqueo, definir acción concreta y destrabar el trabajo.', status: 'blocked', area: 'admin', estimatedTime: 30, priority: () => 'urgent' },
};

const PROJECT_TASK_RULES: Partial<Record<DigitalProject['status'], AutomaticTaskRule<DigitalProject>>> = {
  idea: { ruleKey: 'project_define_objective', title: (p) => `Definir objetivo: ${p.name}`, description: (p) => `Convertir la idea en objetivo accionable.${p.description ? `\n\nDescripción: ${p.description}` : ''}`, status: 'pending', area: 'development', estimatedTime: 45 },
  research: { ruleKey: 'project_finish_research', title: (p) => `Cerrar investigación: ${p.name}`, description: () => 'Reunir referencias, riesgos y decisión técnica para pasar a planificación.', status: 'in_progress', area: 'development', estimatedTime: 60 },
  planning: { ruleKey: 'project_plan_next_block', title: (p) => `Planificar siguiente bloque: ${p.name}`, description: (p) => p.next_step || 'Definir tareas, dependencias y primer hito implementable.', status: 'in_progress', area: 'development', estimatedTime: 45, dueDate: (p) => p.target_date },
  development: { ruleKey: 'project_execute_next_step', title: (p) => `Ejecutar siguiente paso: ${p.name}`, description: (p) => p.next_step || 'Avanzar el siguiente hito del proyecto.', status: 'in_progress', area: 'development', estimatedTime: 90, dueDate: (p) => p.target_date },
  testing: { ruleKey: 'project_test_release', title: (p) => `Probar release: ${p.name}`, description: () => 'Ejecutar pruebas, revisar errores y dejar lista la entrega/lanzamiento.', status: 'testing', area: 'development', estimatedTime: 60, dueDate: (p) => p.target_date },
  blocked: { ruleKey: 'project_unblock', title: (p) => `Desbloquear proyecto: ${p.name}`, description: (p) => p.next_step || 'Identificar bloqueo real y decidir la acción mínima para continuar.', status: 'blocked', area: 'development', estimatedTime: 30, priority: () => 'urgent' },
  paused: { ruleKey: 'project_reactivate_or_archive', title: (p) => `Decidir continuidad: ${p.name}`, description: () => 'Revisar si se reactiva, se posterga con fecha o se archiva el proyecto.', status: 'in_progress', area: 'development', estimatedTime: 30 },
  maintenance: { ruleKey: 'project_maintenance_check', title: (p) => `Revisión de mantenimiento: ${p.name}`, description: () => 'Revisar estado, pendientes, dependencias y próximos ajustes de mantenimiento.', status: 'in_progress', area: 'development', estimatedTime: 45 },
};

const CONSULTANCY_TASK_RULES: Partial<Record<Consultancy['status'], AutomaticTaskRule<Consultancy>>> = {
  requested: { ruleKey: 'consultancy_schedule', title: (c) => `Agendar asesoría: ${c.topic}`, description: () => 'Confirmar fecha, hora, objetivo y medio de contacto con el cliente.', status: 'in_progress', area: 'consultancy', estimatedTime: 15, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  scheduled: { ruleKey: 'consultancy_prepare', title: (c) => `Preparar asesoría: ${c.topic}`, description: (c) => c.pre_notes || c.objective || 'Preparar diagnóstico, pauta y materiales para la sesión.', status: 'in_progress', area: 'consultancy', estimatedTime: 45, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  confirmed: { ruleKey: 'consultancy_run_session', title: (c) => `Realizar asesoría: ${c.topic}`, description: () => 'Realizar sesión, registrar diagnóstico, acuerdos y próximos pasos.', status: 'in_progress', area: 'consultancy', estimatedTime: 60, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  paid: { ruleKey: 'consultancy_run_paid_session', title: (c) => `Ejecutar/cerrar asesoría pagada: ${c.topic}`, description: () => 'Realizar o cerrar la sesión pagada con acuerdos documentados.', status: 'in_progress', area: 'consultancy', estimatedTime: 60, dueDate: (c) => c.date, clientId: (c) => c.client_id },
  in_follow_up: { ruleKey: 'consultancy_follow_up', title: (c) => `Seguimiento asesoría: ${c.topic}`, description: (c) => c.follow_up || 'Contactar al cliente, revisar avances y acordar siguiente paso.', status: 'in_progress', area: 'consultancy', estimatedTime: 30, dueDate: (c) => c.follow_up || c.date, clientId: (c) => c.client_id },
};

const CLIENT_TASK_RULES: Partial<Record<Client['status'], AutomaticTaskRule<Client>>> = {
  prospect: { ruleKey: 'client_first_follow_up', title: (c) => `Hacer seguimiento a prospecto: ${c.name}`, description: (c) => `Contactar y definir próximo paso comercial.${c.notes ? `\n\nNotas: ${c.notes}` : ''}`, status: 'in_progress', area: 'admin', estimatedTime: 15, dueDate: (c) => c.first_contact_date, clientId: (c) => c.id },
  inactive: { ruleKey: 'client_reactivate', title: (c) => `Reactivar cliente: ${c.name}`, description: () => 'Revisar historial y enviar propuesta/mensaje para reactivar relación comercial.', status: 'in_progress', area: 'admin', estimatedTime: 20, priority: () => 'medium', clientId: (c) => c.id },
};

const RECEIVABLE_TASK_RULES: Partial<Record<Receivable['status'], AutomaticTaskRule<Receivable>>> = {
  pending: { ruleKey: 'receivable_collect_pending', title: (r) => `Cobrar pago pendiente${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Gestionar cobro pendiente y registrar avance del pago.', status: 'in_progress', area: 'finance', estimatedTime: 15, dueDate: (r) => r.due_date, priority: () => 'high', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
  partial: { ruleKey: 'receivable_collect_balance', title: (r) => `Cobrar saldo pendiente${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Gestionar cobro del saldo restante.', status: 'in_progress', area: 'finance', estimatedTime: 15, dueDate: (r) => r.due_date, priority: () => 'high', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
  overdue: { ruleKey: 'receivable_collect_overdue', title: (r) => `Cobro vencido${r.balance ? `: $${Math.round(r.balance).toLocaleString('es-CL')}` : ''}`, description: (r) => r.notes || 'Contactar al cliente por pago vencido y definir compromiso de pago.', status: 'in_progress', area: 'finance', estimatedTime: 20, dueDate: (r) => r.due_date, priority: () => 'urgent', clientId: (r) => r.client_id, jobId: (r) => r.job_id },
};

const AGENDA_TASK_RULES: Partial<Record<AgendaItem['status'], AutomaticTaskRule<AgendaItem>>> = {
  pending: { ruleKey: 'agenda_prepare', title: (a) => `Preparar compromiso: ${a.title}`, description: (a) => a.description || 'Preparar materiales, revisar agenda y confirmar detalles del compromiso.', status: 'pending', area: 'admin', estimatedTime: 15, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
  confirmed: { ruleKey: 'agenda_execute', title: (a) => `Ejecutar compromiso: ${a.title}`, description: (a) => a.description || 'Asistir y ejecutar el compromiso según lo planificado.', status: 'in_progress', area: 'admin', estimatedTime: 30, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, priority: () => 'high', tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
  in_progress: { ruleKey: 'agenda_finish', title: (a) => `Finalizar compromiso: ${a.title}`, description: (a) => a.description || 'Cerrar el compromiso, registrar resultados y próximos pasos.', status: 'in_progress', area: 'admin', estimatedTime: 15, dueDate: (a) => a.date, clientId: (a) => a.client_id, jobId: (a) => a.job_id, projectId: (a) => a.project_id, priority: () => 'high', tags: (a) => ['auto', 'agenda', a.item_type, a.priority].filter(Boolean).join(', ') },
};

type JobActionRule = {
  ruleKey: string;
  title: (job: Job) => string;
  description: (job: Job) => string;
  area: string;
  estimatedTime: number;
  priority?: Task['priority'];
};

const JOB_TYPE_ACTIONS: Record<Job['type'], JobActionRule[]> = {
  youtube_video: [
    { ruleKey: 'job_action_youtube_define_brief', title: () => 'Definir idea, objetivo y guion base', description: (j) => `Bajar ${j.title} a idea, objetivo, estructura de guion y recursos necesarios.`, area: 'content', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_youtube_record_edit', title: () => 'Planificar grabación, edición y miniatura', description: () => 'Coordinar material, jornada de grabación, edición, miniatura, descripción y fecha de publicación.', area: 'video', estimatedTime: 60 },
  ],
  social_video: [
    { ruleKey: 'job_action_social_video_hooks', title: () => 'Definir hooks, formato y pauta de redes', description: (j) => `Convertir ${j.title} en piezas cortas para redes: hook, objetivo, formato y CTA.`, area: 'content', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_social_video_batch', title: () => 'Coordinar grabación y entregas para redes', description: () => 'Organizar grabación, edición vertical, revisión y paquete final para publicación en redes.', area: 'video', estimatedTime: 45 },
  ],
  music_production: [
    { ruleKey: 'job_action_music_define_project', title: () => 'Definir proyecto musical y materiales', description: () => 'Confirmar artista, canción/proyecto, referencias, BPM, tonalidad, stems y objetivo de producción.', area: 'audio', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_music_execute_versions', title: () => 'Preparar sesión y primera versión', description: () => 'Ordenar sesión, avanzar producción/mezcla/master y enviar una versión controlada para revisión.', area: 'audio', estimatedTime: 90 },
  ],
  consultancy: [
    { ruleKey: 'job_action_consultancy_prepare', title: () => 'Preparar diagnóstico de asesoría', description: (j) => `Reunir contexto, objetivo, preguntas clave y material previo para ${j.title}.`, area: 'consulting', estimatedTime: 30, priority: 'high' },
    { ruleKey: 'job_action_consultancy_followup', title: () => 'Registrar acuerdos y seguimiento', description: () => 'Documentar diagnóstico, acuerdos, próximos pasos y fecha de seguimiento posterior a la sesión.', area: 'consulting', estimatedTime: 30 },
  ],
  filmmaker_videoclip: [
    { ruleKey: 'job_action_videoclip_brief', title: () => 'Levantar brief, concepto y referencias', description: (j) => `Definir concepto visual, referencias, locaciones tentativas y criterios de aprobación para ${j.title}.`, area: 'preproduction', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_videoclip_schedule', title: () => 'Coordinar fecha, locaciones y recursos de rodaje', description: () => 'Confirmar día de grabación, permisos, equipo, responsables y material necesario.', area: 'video', estimatedTime: 45 },
    { ruleKey: 'job_action_videoclip_delivery', title: () => 'Planificar primera entrega y revisión del cliente', description: () => 'Definir formato de entrega, fecha de primer corte, canal de feedback y cambios incluidos.', area: 'production', estimatedTime: 30 },
  ],
  filmmaker_reels: [
    { ruleKey: 'job_action_reels_plan_batch', title: () => 'Definir pauta e ideas del paquete de reels', description: (j) => `Bajar la propuesta a una pauta grabable con ideas, hooks y objetivo de cada reel para ${j.title}.`, area: 'content', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_reels_record_batch', title: () => 'Agendar grabación por bloque', description: () => 'Coordinar fecha, recursos, locación y orden de grabación para optimizar el paquete completo.', area: 'video', estimatedTime: 30 },
    { ruleKey: 'job_action_reels_delivery_tracker', title: () => 'Controlar edición, revisiones y entregas por reel', description: () => 'Llevar conteo de reels grabados, editados, enviados y aprobados.', area: 'production', estimatedTime: 45 },
  ],
  audio_mix: [
    { ruleKey: 'job_action_audio_collect_stems', title: () => 'Solicitar y ordenar stems', description: () => 'Pedir multitracks, referencias, BPM, tonalidad, letra si aplica y notas del cliente.', area: 'audio', estimatedTime: 30, priority: 'high' },
    { ruleKey: 'job_action_audio_prepare_session', title: () => 'Preparar sesión de mezcla', description: () => 'Crear proyecto, ordenar pistas, limpiar material, ruteos base y ganancia inicial.', area: 'audio', estimatedTime: 60 },
    { ruleKey: 'job_action_audio_first_bounce', title: () => 'Exportar primera versión para revisión', description: () => 'Enviar primer bounce con notas claras y registrar feedback del cliente.', area: 'audio', estimatedTime: 90 },
  ],
  audio_mastering: [
    { ruleKey: 'job_action_mastering_collect_mix', title: () => 'Solicitar mix final y referencias', description: () => 'Confirmar archivo WAV final, headroom, referencias, plataforma objetivo y metadata.', area: 'audio', estimatedTime: 20, priority: 'high' },
    { ruleKey: 'job_action_mastering_process', title: () => 'Masterizar y preparar versiones', description: () => 'Procesar master, controlar loudness, exportar versiones WAV/MP3 y revisar calidad.', area: 'audio', estimatedTime: 60 },
  ],
  audio_ep: [
    { ruleKey: 'job_action_ep_collect_assets', title: () => 'Reunir stems, referencias y orden del EP', description: () => 'Confirmar tracks, orden, referencias, BPM/tonalidad y estado de archivos por canción.', area: 'audio', estimatedTime: 45, priority: 'high' },
    { ruleKey: 'job_action_ep_plan_versions', title: () => 'Planificar avances por canción', description: () => 'Dividir el EP en entregas controlables: mezcla, revisión, cambios y masters finales.', area: 'production', estimatedTime: 45 },
    { ruleKey: 'job_action_ep_final_package', title: () => 'Preparar paquete final del EP', description: () => 'Exportar masters, instrumentales/acapellas si corresponde, metadata y carpeta final.', area: 'audio', estimatedTime: 60 },
  ],
  audio_album: [
    { ruleKey: 'job_action_album_map_project', title: () => 'Mapear álbum completo', description: () => 'Confirmar cantidad de canciones, estado de cada sesión, prioridades, calendario y dependencias.', area: 'production', estimatedTime: 60, priority: 'high' },
    { ruleKey: 'job_action_album_plan_milestones', title: () => 'Crear hitos de mezcla/master por bloque', description: () => 'Separar el álbum en bloques de avance con fechas de revisión y entregas parciales.', area: 'production', estimatedTime: 60 },
    { ruleKey: 'job_action_album_final_qc', title: () => 'Control de calidad y paquete final del álbum', description: () => 'Revisar consistencia entre canciones, loudness, metadata, archivos finales y respaldo.', area: 'audio', estimatedTime: 90 },
  ],
  other: [
    { ruleKey: 'job_action_other_define_next_steps', title: () => 'Definir acciones concretas del trabajo', description: (j) => j.description || 'Convertir el trabajo en pasos claros, responsables y criterios de entrega.', area: 'admin', estimatedTime: 30, priority: 'high' },
    { ruleKey: 'job_action_other_schedule_delivery', title: () => 'Planificar entrega y revisión', description: () => 'Definir fecha objetivo, canal de entrega, revisión y condiciones de cierre.', area: 'production', estimatedTime: 30 },
  ],
};

function shouldSyncJobActions(job: Job): boolean {
  return !job.is_archived && !['delivered', 'cancelled', 'archived'].includes(job.status);
}

function nowSql(): string {
  return localDateTimeSql();
}

async function archiveStaleAutomaticTasks(sourceType: string, sourceId: string, activeRuleKey: string | null): Promise<void> {
  const now = nowSql();
  let q = supabase.from('tasks').update({ is_archived: true, updated_at: now })
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('auto_generated', true)
    .not('status', 'in', '("completed","cancelled")')
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
  const { error } = await supabase.from('tasks').insert({
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
  if (error) throw new Error(`DB error: ${error.message}`);
  return getTaskByIdUnsafe(newTaskId);
}

async function syncAutomaticSubtasksForParent(parentTask: Task, job: Job, actions: JobActionRule[]): Promise<void> {
  const activeRuleKeys = actions.map((a) => a.ruleKey);
  const now = nowSql();

  if (activeRuleKeys.length > 0) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_archived: true, updated_at: now })
      .eq('parent_task_id', parentTask.id)
      .eq('auto_generated', true)
      .not('rule_key', 'in', `(${activeRuleKeys.map(k => `"${k}"`).join(',')})`)
      .not('status', 'in', '("completed","cancelled")')
      .eq('is_archived', false);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  for (const action of actions) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parentTask.id)
      .eq('rule_key', action.ruleKey)
      .eq('auto_generated', true)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const status: Task['status'] = parentTask.status === 'blocked' ? 'blocked' : 'in_progress';
    const priority = action.priority || parentTask.priority;
    const tags = ['auto', 'job', 'action', job.type].join(', ');

    if (existing) {
      if (existing.status === 'completed' || existing.status === 'cancelled') continue;
      const { error } = await supabase.from('tasks').update({
        title: action.title(job), description: action.description(job),
        area: action.area, client_id: job.client_id || null, job_id: job.id,
        priority, status, estimated_time: action.estimatedTime,
        tags, notes: AUTO_NOTE, updated_at: now,
      }).eq('id', (existing as any).id);
      if (error) throw new Error(`DB error: ${error.message}`);
      continue;
    }

    const { error } = await supabase.from('tasks').insert({
      id: crypto.randomUUID(), title: action.title(job), description: action.description(job),
      area: action.area, client_id: job.client_id || null, job_id: job.id,
      source_type: 'job', source_id: job.id, rule_key: action.ruleKey,
      auto_generated: true, priority, status, estimated_time: action.estimatedTime,
      tags, notes: AUTO_NOTE, parent_task_id: parentTask.id,
      created_at: now, updated_at: now,
    });
    if (error) throw new Error(`DB error: ${error.message}`);
  }
}

export async function syncAutomaticTasksForReel(reel: Reel): Promise<void> {
  const rule = reel.is_archived || ['discarded', 'paused', 'published'].includes(reel.status)
    ? null : REEL_TASK_RULES[reel.status];
  await syncAutomaticTask('reel', reel, rule);
}

export async function syncAutomaticTasksForYouTube(video: YouTubeVideo): Promise<void> {
  const rule = video.is_archived || ['discarded', 'paused', 'published'].includes(video.status)
    ? null : YOUTUBE_TASK_RULES[video.status];
  await syncAutomaticTask('youtube', video, rule);
}

export async function syncAutomaticTasksForJob(job: Job): Promise<void> {
  const rule = shouldSyncJobActions(job) ? JOB_TASK_RULES[job.status] : null;
  const parentTask = await syncAutomaticTask('job', job, rule);
  if (!parentTask || !shouldSyncJobActions(job)) return;
  await syncAutomaticSubtasksForParent(parentTask, job, JOB_TYPE_ACTIONS[job.type] || JOB_TYPE_ACTIONS.other);
}

export async function syncAutomaticTasksForProject(project: DigitalProject): Promise<void> {
  const rule = project.is_archived || ['launched', 'archived'].includes(project.status)
    ? null : PROJECT_TASK_RULES[project.status];
  if (!rule) {
    await syncAutomaticTask('project', project, null);
    return;
  }
  await syncAutomaticTask('project', project, { ...rule, projectId: () => project.id, tags: (p) => ['auto', 'project', (p as any).technologies].filter(Boolean).join(', ') });
}

export async function syncAutomaticTasksForConsultancy(consultancy: Consultancy): Promise<void> {
  const rule = consultancy.is_archived || ['completed', 'closed', 'cancelled'].includes(consultancy.status)
    ? null : CONSULTANCY_TASK_RULES[consultancy.status];
  await syncAutomaticTask('consultancy', consultancy, rule);
}

export async function syncAutomaticTasksForClient(client: Client): Promise<void> {
  const rule = client.is_archived || ['active', 'frequent', 'archived'].includes(client.status)
    ? null : CLIENT_TASK_RULES[client.status];
  await syncAutomaticTask('client', client, rule);
}

export async function syncAutomaticTasksForReceivable(receivable: Receivable): Promise<void> {
  if (receivable.job_id) {
    await syncAutomaticTask('receivable', receivable, null);
    return;
  }
  const rule = ['paid', 'cancelled'].includes(receivable.status) ? null : RECEIVABLE_TASK_RULES[receivable.status];
  await syncAutomaticTask('receivable', receivable, rule);
}

export async function syncAutomaticTasksForAgenda(item: AgendaItem): Promise<void> {
  const rule = item.is_archived || ['done', 'cancelled'].includes(item.status)
    ? null : AGENDA_TASK_RULES[item.status];
  await syncAutomaticTask('agenda', item, rule);
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

    const [reelsResult, videosResult, jobsResult, projectsResult, consultanciesResult, clientsResult, receivablesResult, agendaResult] = await Promise.all([
      supabase.from('reels').select('*').eq('is_archived', false),
      supabase.from('youtube_videos').select('*').eq('is_archived', false),
      supabase.from('jobs').select('*').eq('is_archived', false),
      supabase.from('digital_projects').select('*').eq('is_archived', false),
      supabase.from('consultancies').select('*').eq('is_archived', false),
      supabase.from('clients').select('*').eq('is_archived', false),
      supabase.from('receivables').select('*').in('status', ['pending', 'partial', 'overdue']),
      supabase.from('agenda_items').select('*').eq('is_archived', false).not('status', 'in', '("done","cancelled")'),
    ]);

    const reels = (reelsResult.data || []) as unknown as Reel[];
    const videos = (videosResult.data || []) as unknown as YouTubeVideo[];
    const jobs = (jobsResult.data || []) as unknown as Job[];
    const projects = (projectsResult.data || []) as unknown as DigitalProject[];
    const consultancies = (consultanciesResult.data || []) as unknown as Consultancy[];
    const clients = (clientsResult.data || []) as unknown as Client[];
    const receivables = (receivablesResult.data || []) as unknown as Receivable[];
    const agendaItems = (agendaResult.data || []) as unknown as AgendaItem[];

    for (const r of reels) await syncAutomaticTasksForReel(r);
    for (const v of videos) await syncAutomaticTasksForYouTube(v);
    for (const j of jobs) await syncAutomaticTasksForJob(j);
    for (const p of projects) await syncAutomaticTasksForProject(p);
    for (const c of consultancies) await syncAutomaticTasksForConsultancy(c);
    for (const c of clients) await syncAutomaticTasksForClient(c);
    for (const r of receivables) await syncAutomaticTasksForReceivable(r);
    for (const a of agendaItems) await syncAutomaticTasksForAgenda(a);
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
