import { useState, useEffect, useCallback } from 'react';
import { localDateKey } from '../lib/date';
import { getAgendaItems, createAgendaItem, updateAgendaItem } from '../lib/db/agenda';
import type { AgendaItem } from '../lib/types';
import { SkeletonRow, EmptyState, ErrorState } from '../components/ui';

const TYPE_LABELS: Record<string, string> = {
  meeting: 'Reunión', call: 'Llamada', recording: 'Grabación',
  music_production: 'Prod. Musical', consultancy: 'Asesoría',
  delivery: 'Entrega', event: 'Evento', reminder: 'Recordatorio', other: 'Otro',
};

const TYPE_COLORS: Record<string, string> = {
  meeting: 'border-l-blue-500',
  call: 'border-l-cyan-500',
  recording: 'border-l-pink-500',
  music_production: 'border-l-emerald-500',
  consultancy: 'border-l-purple-500',
  delivery: 'border-l-orange-500',
  event: 'border-l-indigo-500',
  reminder: 'border-l-yellow-500',
  other: 'border-l-gray-500',
};

const TYPE_DOT: Record<string, string> = {
  meeting: 'bg-blue-500',
  call: 'bg-cyan-500',
  recording: 'bg-pink-500',
  music_production: 'bg-emerald-500',
  consultancy: 'bg-purple-500',
  delivery: 'bg-orange-500',
  event: 'bg-indigo-500',
  reminder: 'bg-yellow-500',
  other: 'bg-gray-500',
};

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-red-500/50',
  high: 'ring-2 ring-orange-500/40',
  medium: 'ring-1 ring-blue-500/30',
  low: 'ring-1 ring-gray-400/30',
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
      const data = await getAgendaItems();
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
      await updateAgendaItem(item.id, { status: next });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    } catch (e) {
      console.error('update agenda:', e);
    }
  };

  const onCreate = async (title: string, date: string, time: string, itemType: string, priority: string) => {
    try {
      await createAgendaItem({
        title, date, time: time || null, item_type: itemType,
        status: 'pending', priority,
      } as any);
      setShowCreate(false);
      load();
    } catch (e) {
      console.error('create agenda:', e);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done');
  const pendingItems = items.filter((i) => i.status !== 'done');
  const todayItems = pendingItems.filter((i) => i.date === today);
  const upcomingItems = pendingItems.filter((i) => i.date > today);
  const overdueItems = pendingItems.filter((i) => i.date < today);

  if (loading) {
    return (
      <div className="px-3 pt-2 space-y-2">
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
        <div>
          <h1 className="text-base font-bold text-[var(--color-text)]">🗓️ Agenda</h1>
          {pendingItems.length > 0 && (
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              {todayItems.length > 0 && <span>📌 {todayItems.length} hoy</span>}
              {overdueItems.length > 0 && <span className="text-red-400"> · ⚠️ {overdueItems.length} atrasadas</span>}
              {upcomingItems.length > 0 && <span> · {upcomingItems.length} próximas</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 rounded-full bg-[var(--color-primary)] text-[var(--color-text-on-accent)] text-xs font-semibold active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm shadow-[var(--color-primary)]/30"
        >
          <span className="text-base leading-none">+</span> Nuevo
        </button>
      </div>

      <div className="px-3 pt-2">
        {items.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Sin eventos agendados"
            subtitle="Crea tu primer compromiso para empezar a organizarte"
            action={{ label: '+ Crear evento', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="space-y-3">
            {/* Atrasadas */}
            {overdueItems.length > 0 && (
              <Section title="Atrasadas" icon="🔴" count={overdueItems.length} tone="danger">
                {overdueItems.slice(0, 10).map((item) => (
                  <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} overdue />
                ))}
              </Section>
            )}

            {/* Hoy */}
            {todayItems.length > 0 && (
              <Section title="Hoy" icon="📌" count={todayItems.length} tone="primary">
                {todayItems.map((item) => (
                  <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} />
                ))}
              </Section>
            )}

            {/* Próximas */}
            {upcomingItems.length > 0 && (
              <Section title="Próximas" icon="📅" count={Math.min(upcomingItems.length, 15)}>
                {upcomingItems.slice(0, 15).map((item) => (
                  <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} />
                ))}
              </Section>
            )}

            {/* Hechas */}
            {doneItems.length > 0 && (
              <Section title="Hechas" icon="✅" count={doneItems.length} muted>
                {doneItems.slice(0, 5).map((item) => (
                  <AgendaRow key={item.id} item={item} onToggle={onStatusToggle} done />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      {showCreate && <CreateSheet onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  );
}

function Section({ title, icon, count, tone, muted, children }: {
  title: string;
  icon: string;
  count: number;
  tone?: 'primary' | 'danger' | 'default';
  muted?: boolean;
  children: React.ReactNode;
}) {
  const toneColor = tone === 'danger' ? 'text-red-400' : tone === 'primary' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]';
  return (
    <div className="stagger-item">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">{icon}</span>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted ? 'text-[var(--color-text-disabled)]' : toneColor}`}>{title}</span>
        <span className={`text-[10px] ${muted ? 'text-[var(--color-text-disabled)]' : 'text-[var(--color-text-tertiary)]'}`}>({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AgendaRow({ item, onToggle, overdue, done }: {
  item: AgendaItem;
  onToggle: (i: AgendaItem) => void;
  overdue?: boolean;
  done?: boolean;
}) {
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 250);
    onToggle(item);
  };

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer active:scale-[0.98] transition-all duration-200 ${
        done ? 'opacity-50 bg-transparent border border-[var(--color-border)] border-dashed' : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
      } ${overdue ? TYPE_COLORS[item.item_type] || 'border-l-gray-500' : ''} border-l-2 ${
        animating ? 'scale-[0.96] bg-[var(--color-surface-hover)]' : ''
      }`}
    >
      {/* Checkbox circular */}
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        done
          ? 'bg-green-500/20 text-green-500'
          : 'border-2 border-[var(--color-border-strong)]'
      } ${!done && item.priority ? PRIORITY_RING[item.priority] || '' : ''}`}>
        {done ? '✓' : ''}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate text-[var(--color-text)] ${done ? 'line-through' : ''}`}>
          {item.title}
        </p>
        <p className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1.5 mt-0.5">
          <span>{item.date?.slice(5)} {item.time ? `· ${item.time.slice(0, 5)}` : ''}</span>
          {item.item_type && (
            <>
              <span className="text-[var(--color-text-disabled)]">·</span>
              <span className="flex items-center gap-1">
                <span className={`w-1 h-1 rounded-full ${TYPE_DOT[item.item_type] || 'bg-gray-400'}`} />
                {TYPE_LABELS[item.item_type] || item.item_type}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function CreateSheet({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (title: string, date: string, time: string, itemType: string, priority: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  const [itemType, setItemType] = useState('reminder');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    await onCreate(title.trim(), date, time, itemType, priority);
    setSaving(false);
  };

  return (
    <>
      {/* Backdrop con blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] animate-sheet-in">
        {/* Drag handle */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
        <div className="flex items-center justify-between mb-4 mt-1">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Nuevo en Agenda</h2>
          <button onClick={onClose} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">Cancelar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            placeholder="Título del evento..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />

          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
            />
          </div>

          {/* Tipo — chip group */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setItemType(k)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition active:scale-95 cursor-pointer ${
                    itemType === k
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-accent)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-on-accent)] text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
          >
            {saving ? 'Guardando...' : '💾 Guardar evento'}
          </button>
        </form>
      </div>
    </>
  );
}
