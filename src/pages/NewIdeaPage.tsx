import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey } from '../lib/date';
import { createReel } from '../lib/db/reels';
import { createYouTubeVideo } from '../lib/db/youtube';
import { createTask } from '../lib/db/tasks';
import { createAgendaItem } from '../lib/db/agenda';
import { createProject } from '../lib/db/projects';

type IdeaType = 'reel' | 'youtube' | 'task' | 'agenda' | 'project';

const TYPE_OPTIONS: { key: IdeaType; icon: string; label: string }[] = [
  { key: 'reel', icon: '🎬', label: 'Idea Reel' },
  { key: 'youtube', icon: '📹', label: 'Idea YouTube' },
  { key: 'task', icon: '✅', label: 'Tarea' },
  { key: 'agenda', icon: '🗓️', label: 'Agenda' },
  { key: 'project', icon: '🛠️', label: 'Proyecto' },
];

export function NewIdeaPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<IdeaType | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type || saving) return;
    setSaving(true);
    try {
      switch (type) {
        case 'reel':
          await createReel({ title: title.trim(), idea: notes || null, status: 'idea', priority: 'medium' } as any);
          break;
        case 'youtube':
          await createYouTubeVideo({ provisional_title: title.trim(), idea: notes || null, status: 'idea', priority: 'medium' } as any);
          break;
        case 'task':
          await createTask({ title: title.trim(), notes: notes || null, due_date: date || null, priority: 'medium', status: 'pending' } as any);
          break;
        case 'agenda':
          await createAgendaItem({ title: title.trim(), description: notes || null, date, time: time || null, item_type: 'reminder', status: 'pending', priority: 'medium' } as any);
          break;
        case 'project':
          await createProject({ name: title.trim(), notes: notes || null, status: 'idea', priority: 'medium' } as any);
          break;
      }
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (e: any) {
      console.error('Error creating idea:', e);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <span className="text-5xl mb-3">✨</span>
        <p className="text-sm font-semibold text-[var(--color-text)]">¡Ideaza guardada!</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Redirigiendo al inicio...</p>
      </div>
    );
  }

  return (
    <div className="p-3 pb-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold text-[var(--color-text)]">💡 Nueva Idea</h1>
        <button onClick={() => navigate(-1)} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">Cancelar</button>
      </div>

      {!type ? (
        /* Step 1: pick type */
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-tertiary)] mb-2">¿Qué tipo de idea es?</p>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] active:scale-[0.98] transition cursor-pointer"
            >
              <span className="text-xl">{opt.icon}</span>
              <span className="text-sm font-medium text-[var(--color-text)]">{opt.label}</span>
              <span className="ml-auto text-[var(--color-text-tertiary)]">→</span>
            </button>
          ))}
        </div>
      ) : (
        /* Step 2: fill details */
        <form onSubmit={handleSubmit} className="space-y-3">
          <button
            type="button"
            onClick={() => { setType(null); setTitle(''); setNotes(''); }}
            className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] cursor-pointer"
          >
            ← Cambiar tipo: {TYPE_OPTIONS.find(o => o.key === type)?.label}
          </button>

          <input
            autoFocus
            placeholder={type === 'reel' ? '¿De qué va el reel?' : type === 'youtube' ? 'Título del video' : type === 'project' ? 'Nombre del proyecto' : '¿Qué hay que hacer?'}
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
              {type === 'task' && (
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
              )}
              {type === 'agenda' && (
                <>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)]" />
                </>
              )}
            </div>
          )}

          <button type="submit" disabled={!title.trim() || saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Guardando...' : '💾 Guardar idea'}
          </button>
        </form>
      )}
    </div>
  );
}
