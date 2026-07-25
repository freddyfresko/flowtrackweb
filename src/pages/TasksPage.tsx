import { useState, useEffect, useCallback } from 'react';
import { localDateKey } from '../lib/date';
import { getTasks, createTask, updateTask } from '../lib/db/tasks';
import type { Task } from '../lib/types';
import { SkeletonRow, EmptyState, ErrorState } from '../components/ui';

type TabKey = 'today' | 'upcoming' | 'overdue' | 'done';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'upcoming', label: 'Próximas' },
  { key: 'overdue', label: 'Atrasadas' },
  { key: 'done', label: 'Hechas' },
];

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

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('today');
  const [showCreate, setShowCreate] = useState(false);
  const today = localDateKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasks();
      data.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
      setTasks(data);
      setError('');
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onToggle = async (task: Task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateTask(task.id, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    } catch (e) {
      console.error('toggle task:', e);
    }
  };

  const onCreate = async (title: string, dueDate: string, priority: string) => {
    try {
      await createTask({ title, due_date: dueDate || null, priority, status: 'pending' });
      setShowCreate(false);
      load();
    } catch (e) {
      console.error('create task:', e);
    }
  };

  const filtered = tasks.filter((t) => {
    const isDone = t.status === 'completed' || t.status === 'cancelled';
    if (tab === 'done') return isDone;
    if (isDone) return false;
    const due = t.due_date;
    if (tab === 'today') return due === today;
    if (tab === 'overdue') return due != null && due < today;
    if (tab === 'upcoming') return due == null || due > today;
    return true;
  });

  const counts = {
    today: tasks.filter((t) => t.due_date === today && t.status !== 'completed' && t.status !== 'cancelled').length,
    overdue: tasks.filter((t) => t.due_date != null && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled').length,
  };

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

      {/* Tabs — pill style */}
      <div className="flex bg-[var(--color-bg)]/95 backdrop-blur-xl sticky top-[44px] z-10 px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex gap-1 bg-[var(--color-surface)] rounded-full p-1 w-full">
          {TABS.map((t) => {
            const active = tab === t.key;
            const showCount = counts[t.key] > 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${
                  active
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-accent)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                {t.label}
                {showCount && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                    active ? 'bg-white/20' : 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                  }`}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pt-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={tab === 'done' ? '🎉' : '📋'}
            title={tab === 'done' ? 'Sin tareas completadas' : tab === 'today' ? 'Todo al día' : 'Sin tareas aquí'}
            subtitle={tab === 'today' ? 'Disfruta el momento ✨' : undefined}
            action={tab !== 'done' ? { label: '+ Crear tarea', onClick: () => setShowCreate(true) } : undefined}
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTaskSheet onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const isDone = task.status === 'completed';
  const isOverdue = task.due_date != null && task.due_date < localDateKey(new Date()) && !isDone;
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 250);
    onToggle(task);
  };

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer active:scale-[0.98] transition-all duration-200 ${
        isDone
          ? 'opacity-50 border-[var(--color-border)] border-dashed bg-transparent'
          : 'bg-[var(--color-surface)] border-[var(--color-border)]'
      } ${animating ? 'scale-[0.96] bg-[var(--color-surface-hover)]' : ''}`}
    >
      {/* Checkbox circular con priority ring */}
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        isDone
          ? 'bg-green-500/20 text-green-500'
          : `border-2 border-[var(--color-border-strong)] ${task.priority ? PRIORITY_RING[task.priority] : ''}`
      }`}>
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
              <span className="truncate">{task.area}</span>
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

          {/* Prioridad — chips */}
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
