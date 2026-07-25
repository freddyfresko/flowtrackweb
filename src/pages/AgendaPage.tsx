import { useState, useEffect, useCallback } from 'react';
import { localDateKey } from '../lib/date';
import { getAgendaItems, createAgendaItem, updateAgendaItem } from '../lib/db/agenda';
import type { AgendaItem } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  meeting: 'Reunión', call: 'Llamada', recording: 'Grabación',
  music_production: 'Prod. Musical', consultancy: 'Asesoría',
  delivery: 'Entrega', event: 'Evento', reminder: 'Recordatorio', other: 'Otro',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500',
};

export function AgendaPage() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const today = localDateKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgendaItems({});
      data.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '00:00').localeCompare(b.time || '00:00'));
      setItems(data);
      setError('');
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onStatusToggle = async (item: AgendaItem) => {
    const next = item.status === 'done' ? 'pending' : 'done';
    try {
      await updateAgendaItem(item.id, { status: next } as any);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    } catch (e: any) {
      console.error('Failed to update agenda status:', e);
    }
  };

  const onCreate = async (title: string, date: string, time: string) => {
    try {
      await createAgendaItem({ title, date, time: time || null, item_type: 'reminder', status: 'pending', priority: 'medium' } as any);
      setShowCreate(false);
      load();
    } catch (e: any) {
      console.error('Failed to create agenda item:', e);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done');
  const pendingItems = items.filter((i) => i.status !== 'done');
  const todayItems = pendingItems.filter((i) => i.date === today);
  const upcomingItems = pendingItems.filter((i) => i.date > today);
  const overdueItems = pendingItems.filter((i) => i.date < today);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-[var(--color-surface)] animate-pulse" />)}
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
        <h1 className="text-base font-bold text-[var(--color-text)]">🗓️ Agenda</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium cursor-pointer"
        >
          + Nuevo
        </button>
      </div>

      {/* Pending count badge */}
      {pendingItems.length > 0 && (
        <div className="px-3 py-2 text-[10px] text-[var(--color-text-tertiary)]">
          {todayItems.length > 0 && <span>📌 Hoy: {todayItems.length} · </span>}
          {overdueItems.length > 0 && <span className="text-red-400">⚠️ Atrasadas: {overdueItems.length} · </span>}
          Próximas: {upcomingItems.length}
        </div>
      )}

      <div className="px-3 space-y-1">
        {/* Atrasadas */}
        {overdueItems.slice(0, 10).map((item) => (
          <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} overdue />
        ))}

        {/* Hoy */}
        {todayItems.map((item) => (
          <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} />
        ))}

        {/* Próximas (limit 15) */}
        {upcomingItems.slice(0, 15).map((item) => (
          <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} />
        ))}

        {/* Hechas (collapsible) */}
        {doneItems.length > 0 && (
          <>
            <div className="pt-4 pb-1 text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider">
              ✅ Hechas ({doneItems.length})
            </div>
            {doneItems.slice(0, 5).map((item) => (
              <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} done />
            ))}
          </>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-[var(--color-text-tertiary)]">
            <span className="text-3xl">📅</span>
            <p>Sin eventos agendados</p>
            <button onClick={() => setShowCreate(true)} className="text-xs text-[var(--color-primary)] cursor-pointer">+ Crear primero</button>
          </div>
        )}
      </div>

      {/* Create sheet */}
      {showCreate && <CreateSheet onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  );
}

function AgendaRow({ item, onToggle, overdue, done }: {
  item: AgendaItem; onToggle: (i: AgendaItem) => void; overdue?: boolean; done?: boolean;
}) {
  return (
    <div
      onClick={() => onToggle(item)}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer active:scale-[0.98] transition-all ${
        done ? 'opacity-50' : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
      } ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
    >
      <span className="text-xs flex-shrink-0">
        {done ? '✅' : overdue ? '🔴' : '⬜'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate text-[var(--color-text)] ${done ? 'line-through' : ''}`}>{item.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)]">
          {item.date?.slice(5)} {item.time ? `· ${item.time.slice(0, 5)}` : ''}
          {item.item_type && ` · ${TYPE_LABELS[item.item_type] || item.item_type}`}
        </p>
      </div>
      {item.priority && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLORS[item.priority] || 'bg-gray-500'}`} />
      )}
    </div>
  );
}

function CreateSheet({ onClose, onCreate }: {
  onClose: () => void; onCreate: (title: string, date: string, time: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    await onCreate(title.trim(), date, time);
    setSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 pb-[calc(env(safe-area-inset-bottom)+12px)] animate-sheet-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Nuevo en Agenda</h2>
          <button onClick={onClose} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">Cancelar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            placeholder="Título del evento..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
          </div>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-text-on-accent)] text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>
    </>
  );
}
