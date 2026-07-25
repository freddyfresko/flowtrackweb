import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey } from '../lib/date';
import { createReel } from '../lib/db/reels';
import { createYouTubeVideo } from '../lib/db/youtube';
import { createTask } from '../lib/db/tasks';
import { createAgendaItem } from '../lib/db/agenda';
import { createProject } from '../lib/db/projects';

type IdeaType = 'reel' | 'youtube' | 'task' | 'agenda' | 'project';

const TYPE_OPTIONS: { key: IdeaType; icon: string; label: string; sub: string; gradient: string }[] = [
  { key: 'reel',    icon: '🎬', label: 'Idea Reel',   sub: 'Para grabar pronto',     gradient: 'from-pink-500/15 to-rose-500/15' },
  { key: 'youtube', icon: '📹', label: 'Idea YouTube', sub: 'Video largo',            gradient: 'from-red-500/15 to-orange-500/15' },
  { key: 'task',    icon: '✅', label: 'Tarea',        sub: 'Pendiente con fecha',   gradient: 'from-blue-500/15 to-sky-500/15' },
  { key: 'agenda',  icon: '🗓️', label: 'Agenda',       sub: 'Evento programado',     gradient: 'from-amber-500/15 to-yellow-500/15' },
  { key: 'project', icon: '🛠️', label: 'Proyecto',     sub: 'Desarrollo digital',    gradient: 'from-violet-500/15 to-purple-500/15' },
];

export function NewIdeaPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<IdeaType | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type || saving) return;
    setSaving(true);
    try {
      switch (type) {
        case 'reel':
          await createReel({ title: title.trim(), idea: notes || null, status: 'idea', priority } as any);
          break;
        case 'youtube':
          await createYouTubeVideo({ provisional_title: title.trim(), idea: notes || null, status: 'idea', priority } as any);
          break;
        case 'task':
          await createTask({ title: title.trim(), notes: notes || null, due_date: date || null, priority, status: 'pending' } as any);
          break;
        case 'agenda':
          await createAgendaItem({ title: title.trim(), description: notes || null, date, time: time || null, item_type: 'reminder', status: 'pending', priority } as any);
          break;
        case 'project':
          await createProject({ name: title.trim(), notes: notes || null, status: 'idea', priority } as any);
          break;
      }
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Error creating idea:', err);
    } finally {
      setSaving(false);
    }
  };

  // Pantalla de éxito
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] text-center animate-scale-pop">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-4xl mb-4 animate-glow">
          ✨
        </div>
        <p className="text-base font-semibold text-[var(--color-text)]">¡Idea guardada!</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Redirigiendo al inicio...</p>
        <div className="mt-4 w-32 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] animate-[shimmer_1.5s_ease-in-out]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-[var(--color-text)]">💡 Nueva Idea</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 transition cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      {!type ? (
        /* Step 1: pick type — cards con gradiente */
        <div className="space-y-2 animate-xfade">
          <p className="text-xs text-[var(--color-text-tertiary)] mb-2">¿Qué tipo de idea es?</p>
          {TYPE_OPTIONS.map((opt, i) => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br ${opt.gradient} border border-[var(--color-border)] active:scale-[0.98] transition cursor-pointer stagger-item ${i > 4 ? '' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="w-10 h-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                {opt.icon}
              </span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">{opt.label}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{opt.sub}</p>
              </div>
              <span className="text-[var(--color-text-tertiary)] text-sm">→</span>
            </button>
          ))}
        </div>
      ) : (
        /* Step 2: fill details */
        <form onSubmit={handleSubmit} className="space-y-3 animate-slide-in-right">
          {/* Breadcrumb tipo seleccionado */}
          <button
            type="button"
            onClick={() => { setType(null); setTitle(''); setNotes(''); }}
            className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] active:scale-95 transition cursor-pointer"
          >
            ← Cambiar tipo:
            <span className="font-medium">
              {TYPE_OPTIONS.find(o => o.key === type)?.icon} {TYPE_OPTIONS.find(o => o.key === type)?.label}
            </span>
          </button>

          <input
            autoFocus
            placeholder={
              type === 'reel' ? '¿De qué va el reel?' :
              type === 'youtube' ? 'Título del video' :
              type === 'project' ? 'Nombre del proyecto' :
              '¿Qué hay que hacer?'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />

          <textarea
            placeholder="Notas adicionales (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)] resize-none"
          />

          {(type === 'task' || type === 'agenda') && (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
              />
              {type === 'agenda' && (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
                />
              )}
            </div>
          )}

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
            {saving ? 'Guardando...' : '💾 Guardar idea'}
          </button>
        </form>
      )}
    </div>
  );
}
