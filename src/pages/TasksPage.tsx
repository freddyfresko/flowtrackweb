import { useState, useEffect, useCallback } from 'react';
import { localDateKey } from '../lib/date';
import { getTasks, createTask, updateTask } from '../lib/db/tasks';
import type { Task } from '../lib/types';

type TabKey = 'today' | 'upcoming' | 'overdue' | 'done';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'upcoming', label: 'Próximas' },
  { key: 'overdue', label: 'Atrasadas' },
  { key: 'done', label: 'Hechas' },
];

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
      const data = await getTasks({});
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
      await updateTask(task.id, { status: next } as any);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    } catch (e: any) {
      console.error('Failed to toggle task:', e);
    }
  };

  const onCreate = async (title: string, dueDate: string) => {
    try {
      await createTask({ title, due_date: dueDate || null, priority: 'medium', status: 'pending' } as any);
      setShowCreate(false);
      load();
    } catch (e: any) {
      console.error('Failed to create task:', e);
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
      <div className="p-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-[var(--color-surface)] animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-sm text-red-500">
        <span>⚠️ {error}</span>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm cursor-pointer">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="pb-4 animate-page-enter">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] px-3 py-2 flex items-center justify-between border-b border-[var(--color-border)]">
        <h1 className="text-base font-bold text-[var(--color-text)]">✅ Tareas</h1>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium cursor-pointer">
          + Nueva
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg)] sticky top-[44px] z-10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && tab !== t.key && (
              <span className="ml-1 px-1 py-0.5 rounded-full bg-[var(--color-primary)] text-[10px] text-white">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-3 pt-2 space-y-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-[var(--color-text-tertiary)]">
            <span className="text-3xl">{tab === 'done' ? '🎉' : '📋'}</span>
            <p>{tab === 'done' ? 'Sin tareas completadas aún' : 'Todo al día ✨'}</p>
          </div>
        )}
        {filtered.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} />
        ))}
      </div>

      {showCreate && <CreateTaskSheet onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const isDone = task.status === 'completed';
  const isOverdue = task.due_date != null && task.due_date < localDateKey(new Date()) && !isDone;
  const priorityColors: Record<string, string> = {
    urgent: 'border-l-red-500', high: 'border-l-orange-500', medium: 'border-l-blue-500', low: 'border-l-gray-500',
  };

  return (
    <div
      onClick={() => onToggle(task)}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer active:scale-[0.98] transition-all ${
        isDone ? 'opacity-50 border-[var(--color-border)] bg-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)]'
      } ${isOverdue ? 'border-l-2' : ''} ${priorityColors[task.priority] || ''}`}
    >
      <span className="text-sm flex-shrink-0">{isDone ? '✅' : '⬜'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium text-[var(--color-text)] truncate ${isDone ? 'line-through' : ''}`}>{task.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)]">
          {task.due_date ? (isOverdue ? `⚠️ Vence ${task.due_date}` : task.due_date) : 'Sin fecha'}
          {task.area && ` · ${task.area}`}
        </p>
      </div>
      {task.priority && task.priority !== 'medium' && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
          task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : ''
        }`}>{task.priority}</span>
      )}
    </div>
  );
}

function CreateTaskSheet({ onClose, onCreate }: {
  onClose: () => void; onCreate: (title: string, dueDate: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    await onCreate(title.trim(), dueDate);
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 pb-[calc(env(safe-area-inset-bottom)+12px)] animate-sheet-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Nueva Tarea</h2>
          <button onClick={onClose} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">Cancelar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input autoFocus placeholder="¿Qué hay que hacer?" value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
          <button type="submit" disabled={!title.trim() || saving}
            className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>
    </>
  );
}
