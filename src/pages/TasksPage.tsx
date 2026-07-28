import { useState, useEffect, useCallback, useMemo } from 'react';
import { localDateKey } from '../lib/date';
import { getTasks, createTask, updateTask, getSubtasks } from '../lib/db/tasks';
import type { Task } from '../lib/types';
import { SkeletonRow, EmptyState, ErrorState } from '../components/ui';
import { useToast } from '../components/Toast';

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-red-500/50',
  high: 'ring-2 ring-orange-500/40',
  medium: 'ring-1 ring-blue-500/30',
  low: 'ring-1 ring-gray-400/30',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const SECTION_CONFIG: { key: string; label: string; icon: string; color: string; textColor: string; bgColor: string }[] = [
  { key: 'pending', label: 'Pendientes', icon: '📋', color: 'bg-yellow-500', textColor: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  { key: 'in_progress', label: 'En proceso', icon: '🔄', color: 'bg-blue-500', textColor: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { key: 'blocked', label: 'Bloqueadas', icon: '🚫', color: 'bg-red-500', textColor: 'text-red-500', bgColor: 'bg-red-500/10' },
  { key: 'testing', label: 'En prueba', icon: '🧪', color: 'bg-purple-500', textColor: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { key: 'completed', label: 'Terminadas', icon: '✅', color: 'bg-green-500', textColor: 'text-green-500', bgColor: 'bg-green-500/10' },
];

const AREA_LABELS: Record<string, string> = {
  content: '🎬 Contenido',
  video: '🎥 Video',
  development: '🛠️ Dev',
  admin: '📋 Admin',
  finance: '💰 Finanzas',
  consultancy: '🎓 Asesoría',
  design: '🎨 Diseño',
  production: '🎧 Producción',
};

function getAreaLabel(area: string): string {
  return AREA_LABELS[area] || area;
}

function isFinished(task: Task): boolean {
  return task.status === 'completed' || task.status === 'cancelled';
}

export function TasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const today = localDateKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasks({ status: statusFilter || undefined, area: areaFilter || undefined });
      data.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
      setTasks(data);
      setError('');
    } catch (e: any) {
      setError(String(e?.message || e));
      toast.error('Error cargando tareas');
    } finally {
      setLoading(false);
    }
  }, [toast, statusFilter, areaFilter]);

  useEffect(() => { load(); }, [load]);

  const onToggle = async (task: Task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateTask(task.id, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
      toast.success(next === 'completed' ? 'Tarea completada ✓' : 'Tarea reabierta');
    } catch (e) {
      console.error('toggle task:', e);
      toast.error('No se pudo actualizar', { label: 'Reintentar', onClick: load });
    }
  };

  const onStatusChange = async (task: Task, newStatus: Task['status']) => {
    try {
      await updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      toast.success(`Tarea movida a ${newStatus}`);
    } catch (e) {
      console.error('status change:', e);
      toast.error('No se pudo cambiar estado');
    }
  };

  const onCreate = async (title: string, dueDate: string, priority: string) => {
    try {
      await createTask({ title, due_date: dueDate || null, priority, status: 'pending' });
      setShowCreate(false);
      load();
      toast.success('Tarea creada ✓');
    } catch (e) {
      console.error('create task:', e);
      toast.error('Error creando tarea');
    }
  };

  // Stats
  const stats = useMemo(() => ({
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => t.due_date != null && t.due_date < today && !isFinished(t)).length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }), [tasks, today]);

  // Agrupar por status
  const sections = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const s of SECTION_CONFIG) grouped[s.key] = [];
    for (const t of tasks) {
      if (!grouped[t.status]) grouped[t.status] = [];
      grouped[t.status].push(t);
    }
    return grouped;
  }, [tasks]);

  if (loading) {
    return (
      <div className="px-3 pt-2">
        <SkeletonRow count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 pt-2">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur-xl px-3 py-2 flex items-center justify-between border-b border-[var(--color-border)]">
        <h1 className="text-base font-bold text-[var(--color-text)]">✅ Tareas</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 rounded-full bg-[var(--color-primary)] text-[var(--color-text-on-accent)] text-xs font-semibold active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm shadow-[var(--color-primary)]/30"
        >
          <span className="text-base leading-none">+</span> Nueva
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2 border-b border-[var(--color-border)]">
        <StatCard label="Pendientes" value={stats.pending} color="text-yellow-500" />
        <StatCard label="En proceso" value={stats.in_progress} color="text-blue-500" />
        {stats.overdue > 0 ? (
          <StatCard label="Vencidas" value={stats.overdue} color="text-red-500" />
        ) : (
          <StatCard label="Completadas" value={stats.completed} color="text-green-500" />
        )}
        <StatCard label="Total" value={tasks.length} color="text-[var(--color-text-secondary)]" />
      </div>

      {/* Filtros inline */}
      <div className="sticky top-[88px] z-10 bg-[var(--color-bg)]/95 backdrop-blur-xl px-3 py-1.5 border-b border-[var(--color-border)]">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {['', 'pending', 'in_progress', 'blocked', 'testing', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition active:scale-95 cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-on-accent)]'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
              }`}
            >
              {s ? { pending: 'Pendiente', in_progress: 'En curso', blocked: 'Bloqueada', testing: 'En prueba', completed: 'Completada' }[s] : 'Todas'}
            </button>
          ))}
          <span className="w-px bg-[var(--color-border)] mx-1" />
          {['', 'content', 'video', 'development', 'admin', 'finance', 'consultancy', 'design'].map((a) => (
            <button
              key={a}
              onClick={() => setAreaFilter(a === areaFilter ? '' : a)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition active:scale-95 cursor-pointer whitespace-nowrap ${
                areaFilter === a
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
              }`}
            >
              {a ? { content: '🎬 Contenido', video: '🎥 Video', development: '🛠️ Dev', admin: '📋 Admin', finance: '💰 Finanzas', consultancy: '🎓 Asesoría', design: '🎨 Diseño' }[a] : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Secciones por status */}
      <div className="px-3 pt-3 space-y-4">
        {SECTION_CONFIG.map((section) => {
          const items = sections[section.key] || [];
          if (items.length === 0 && section.key !== 'pending') return null;
          return (
            <div key={section.key}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">{section.icon}</span>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${section.textColor}`}>
                  {section.label}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-xs text-[var(--color-text-tertiary)]">
                  <span>Sin tareas pendientes ✨</span>
                  {section.key === 'pending' && (
                    <button onClick={() => setShowCreate(true)} className="mt-1 text-[var(--color-primary)] active:scale-95 transition cursor-pointer">
                      + Crear primera tarea
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={onToggle}
                      onStatusChange={onStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && <CreateTaskSheet onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  );
}

// ─── Sub-components ───

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-2 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-[var(--color-text-tertiary)] truncate">{label}</p>
    </div>
  );
}

function TaskRow({ task, onToggle, onStatusChange }: {
  task: Task;
  onToggle: (t: Task) => void;
  onStatusChange: (t: Task, s: Task['status']) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isDone = task.status === 'completed';
  const isOverdue = task.due_date != null && task.due_date < localDateKey(new Date()) && !isDone;
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 250);
    onToggle(task);
  };

  const statusSteps: Task['status'][] = ['pending', 'in_progress', 'blocked', 'testing', 'completed'];

  return (
    <>
      <div
        onClick={() => setShowMenu(true)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer active:scale-[0.98] transition-all duration-200 ${
          isDone
            ? 'opacity-50 border-[var(--color-border)] border-dashed bg-transparent'
            : 'bg-[var(--color-surface)] border-[var(--color-border)]'
        } ${animating ? 'scale-[0.96] bg-[var(--color-surface-hover)]' : ''}`}
      >
        {/* Checkbox */}
        <span
          onClick={(e) => { e.stopPropagation(); handleToggle(); }}
          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
            isDone
              ? 'bg-green-500/20 text-green-500'
              : `border-2 border-[var(--color-border-strong)] ${task.priority ? PRIORITY_RING[task.priority] : ''}`
          }`}
        >
          {isDone ? '✓' : ''}
        </span>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium text-[var(--color-text)] truncate ${isDone ? 'line-through' : ''}`}>
            {task.title}
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1.5 mt-0.5">
            {task.due_date ? (
              <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
                {isOverdue ? '⚠️ ' : ''}{task.due_date?.slice(5)}
              </span>
            ) : (
              <span>Sin fecha</span>
            )}
            {task.area && (
              <>
                <span className="text-[var(--color-text-disabled)]">·</span>
                <span className="truncate">{getAreaLabel(task.area)}</span>
              </>
            )}
            {(task.subtask_count || 0) > 0 && (
              <>
                <span className="text-[var(--color-text-disabled)]">·</span>
                <span className="text-[var(--color-text-tertiary)]">{task.subtask_count} sub</span>
              </>
            )}
          </p>
        </div>

        {task.priority && task.priority !== 'medium' && (
          <span className="flex items-center gap-1 text-[10px] flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
            <span className="text-[var(--color-text-tertiary)] hidden xs:inline">{PRIORITY_LABEL[task.priority]}</span>
          </span>
        )}
      </div>

      {/* Status quick-menu */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowMenu(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-sm mx-3 mb-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 animate-pop-in"
          >
            <p className="text-xs font-bold text-[var(--color-text)] mb-2 truncate">{task.title}</p>
            <div className="space-y-1">
              {statusSteps.map((s) => {
                const active = task.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (!active) onStatusChange(task, s);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                      active
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${SECTION_CONFIG.find((c) => c.key === s)?.color || 'bg-gray-400'}`} />
                    {SECTION_CONFIG.find((c) => c.key === s)?.label || s}
                    {active && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowMenu(false)}
              className="mt-2 w-full py-2 rounded-xl bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-tertiary)] active:scale-[0.98] transition cursor-pointer"
            >Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}

function CreateTaskSheet({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (title: string, dueDate: string, priority: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(localDateKey(new Date()));
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    await onCreate(title.trim(), dueDate, priority);
    setSaving(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] animate-sheet-in">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
        <div className="flex items-center justify-between mb-4 mt-1">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Nueva Tarea</h2>
          <button onClick={onClose} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">Cancelar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            placeholder="¿Qué hay que hacer?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
          />

          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Prioridad</p>
            <div className="flex gap-1.5">
              {[
                { k: 'low', label: 'Baja', color: 'bg-gray-500' },
                { k: 'medium', label: 'Media', color: 'bg-blue-500' },
                { k: 'high', label: 'Alta', color: 'bg-orange-500' },
                { k: 'urgent', label: 'Urgente', color: 'bg-red-500' },
              ].map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => setPriority(p.k)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition active:scale-95 cursor-pointer ${
                    priority === p.k
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-accent)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
          >
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </form>
      </div>
    </>
  );
}
