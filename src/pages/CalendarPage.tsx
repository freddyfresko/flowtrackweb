import { useState, useEffect, useMemo } from 'react';
import { getCalendarEvents, type CalendarEvent } from '../lib/db/calendar';
import { localDateKey } from '../lib/date';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['L','M','X','J','V','S','D'];

// Color del dot por tipo de evento (mismo set visual que la PC)
const TYPE_DOT: Record<string, string> = {
  task: 'bg-blue-500',
  reel: 'bg-orange-500',
  youtube: 'bg-red-500',
  music: 'bg-emerald-500',
  videoclip: 'bg-rose-500',
  consultancy: 'bg-purple-500',
  payment: 'bg-green-500',
  delivery: 'bg-cyan-500',
  recording: 'bg-pink-500',
  editing: 'bg-yellow-500',
  scheduled: 'bg-indigo-500',
  deadline: 'bg-red-500',
  preproduction: 'bg-violet-500',
  review: 'bg-sky-500',
  agenda: 'bg-amber-500',
};

// Color del borde izquierdo para la lista del día
const TYPE_BORDER: Record<string, string> = {
  task: 'border-l-blue-500 bg-blue-500/10 text-blue-500',
  reel: 'border-l-orange-500 bg-orange-500/10 text-orange-500',
  youtube: 'border-l-red-500 bg-red-500/10 text-red-500',
  music: 'border-l-emerald-500 bg-emerald-500/10 text-emerald-500',
  videoclip: 'border-l-rose-500 bg-rose-500/10 text-rose-500',
  consultancy: 'border-l-purple-500 bg-purple-500/10 text-purple-500',
  payment: 'border-l-green-500 bg-green-500/10 text-green-500',
  delivery: 'border-l-cyan-500 bg-cyan-500/10 text-cyan-500',
  recording: 'border-l-pink-500 bg-pink-500/10 text-pink-500',
  editing: 'border-l-yellow-500 bg-yellow-500/10 text-yellow-500',
  scheduled: 'border-l-indigo-500 bg-indigo-500/10 text-indigo-500',
  deadline: 'border-l-red-500 bg-red-500/10 text-red-500',
  preproduction: 'border-l-violet-500 bg-violet-500/10 text-violet-500',
  review: 'border-l-sky-500 bg-sky-500/10 text-sky-500',
  agenda: 'border-l-amber-500 bg-amber-500/10 text-amber-500',
};

const TYPE_ICON: Record<string, string> = {
  task: '✅',
  reel: '🎬',
  youtube: '▶️',
  music: '🎧',
  videoclip: '🎥',
  consultancy: '🎓',
  payment: '💰',
  delivery: '📦',
  recording: '🎥',
  editing: '✂️',
  scheduled: '📱',
  deadline: '⚠️',
  preproduction: '🎬',
  review: '👀',
  agenda: '🗒️',
};

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga eventos del mes cuando cambian año/mes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCalendarEvents(year, month)
      .then((evs) => { if (!cancelled) { setEvents(evs); setLoading(false); } })
      .catch((e) => { if (!cancelled) { console.error('calendar:', e); setEvents([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7; // 0=Lun, 6=Dom
  const todayStr = localDateKey(today);

  const dateKey = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayEvents = (d: number) => events.filter((e) => e.date.startsWith(dateKey(d)));
  const selectedEvents = dayEvents(selectedDay);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1);
    setSelectedDay(1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1);
    setSelectedDay(1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
  };

  return (
    <div className="pb-4 animate-page-enter">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] px-3 py-2 flex items-center justify-between border-b border-[var(--color-border)]">
        <h1 className="text-base font-bold text-[var(--color-text)]">📅 Calendario</h1>
        <button
          onClick={goToday}
          className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] active:scale-95 transition cursor-pointer"
        >
          Hoy
        </button>
      </div>

      {/* Navegación mes */}
      <div className="px-3 py-2 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center active:scale-90 transition cursor-pointer"
          aria-label="Mes anterior"
        >←</button>
        <div className="text-center">
          <p className="text-sm font-bold text-[var(--color-text)]">{MONTHS[month - 1]}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">{year} · {loading ? '…' : `${events.length} eventos`}</p>
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center active:scale-90 transition cursor-pointer"
          aria-label="Mes siguiente"
        >→</button>
      </div>

      {/* Grid calendario — semana empieza Lunes */}
      <div className="px-3">
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS.map((d, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-semibold text-[var(--color-text-tertiary)] py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {/* Huecos del mes anterior */}
          {Array.from({ length: mondayOffset }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square rounded-lg bg-transparent" />
          ))}

          {/* Días del mes */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const evs = dayEvents(day);
            const isToday = dateKey(day) === todayStr;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-start pt-1 transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]'
                    : 'bg-[var(--color-surface)] active:scale-95'
                }`}
              >
                <span className={`text-[11px] font-medium ${
                  isToday
                    ? 'bg-[var(--color-primary)] text-white rounded-full w-5 h-5 flex items-center justify-center'
                    : isSelected
                      ? 'text-[var(--color-primary)] font-semibold'
                      : 'text-[var(--color-text-secondary)]'
                }`}>
                  {day}
                </span>
                {evs.length > 0 && (
                  <div className="absolute bottom-1 flex gap-0.5 flex-wrap justify-center max-w-[80%]">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`w-1 h-1 rounded-full ${TYPE_DOT[e.type] || 'bg-gray-400'}`}
                      />
                    ))}
                    {evs.length > 3 && (
                      <span className="text-[7px] text-[var(--color-text-tertiary)]">+{evs.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de eventos del día seleccionado */}
      <div className="px-3 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[var(--color-text)]">
            {selectedDay} de {MONTHS[month - 1]}
          </h2>
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {selectedEvents.length} evento{selectedEvents.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="space-y-1.5">
            {[1,2,3].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-[var(--color-surface)] animate-pulse" />
            ))}
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-xs text-[var(--color-text-tertiary)]">
            <span className="text-3xl">🗓️</span>
            <p>Sin eventos este día</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {selectedEvents.map((e) => (
              <div
                key={e.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-xl border-l-2 ${TYPE_BORDER[e.type] || 'border-l-gray-500 bg-gray-500/10'}`}
              >
                <span className="text-sm flex-shrink-0">{TYPE_ICON[e.type] || '•'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text)] leading-snug">{e.title}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                    {e.type}{e.client_name ? ` · ${e.client_name}` : ''}{e.status ? ` · ${e.status}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leyenda compacta */}
      <div className="px-3 mt-4">
        <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider mb-1.5">Leyenda</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { type: 'task', label: 'Tareas' },
            { type: 'reel', label: 'Reels' },
            { type: 'youtube', label: 'YouTube' },
            { type: 'agenda', label: 'Agenda' },
            { type: 'consultancy', label: 'Asesorías' },
            { type: 'payment', label: 'Pagos' },
            { type: 'recording', label: 'Grabaciones' },
            { type: 'delivery', label: 'Entregas' },
            { type: 'music', label: 'Música' },
          ].map((l) => (
            <div key={l.type} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[l.type] || 'bg-gray-400'}`} />
              <span className="truncate">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
