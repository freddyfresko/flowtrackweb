import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../lib/stores/dataStore';
import { formatCurrency, formatNumber } from '../lib/utils/format';
import { localDateKey } from '../lib/date';
import { Skeleton, SkeletonCard, EmptyState, ErrorState, PriorityDot } from '../components/ui';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const AGENDA_TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-500',
  call: 'bg-cyan-500',
  recording: 'bg-pink-500',
  music_production: 'bg-emerald-500',
  consultancy: 'bg-purple-500',
  delivery: 'bg-orange-500',
  event: 'bg-indigo-500',
  reminder: 'bg-yellow-500',
  other: 'bg-gray-400',
};

const ALERT_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  danger:  { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/25',    icon: '🔴' },
  warning: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/25', icon: '🟡' },
  info:    { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/25',   icon: '🔵' },
};

export function DashboardPage() {
  const navigate = useNavigate();
  const d = useDataStore((s) => s.dashboard);
  const status = useDataStore((s) => s.dashboardStatus);
  const reload = useDataStore((s) => s.initialiseDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const start = Date.now();
    await reload();
    const elapsed = Date.now() - start;
    const delay = Math.max(0, 600 - elapsed);
    await new Promise((r) => setTimeout(r, delay));
    refreshingRef.current = false;
    setRefreshing(false);
  }, [reload]);

  if (status === 'loading' && !d) {
    return (
      <div className="p-3 space-y-3">
        <div className="h-24 rounded-2xl bg-[var(--color-surface)] overflow-hidden relative">
          <div className="absolute inset-0 skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!d) {
    return (
      <div className="p-3">
        <ErrorState
          message="No se pudieron cargar los datos. Revisa tu conexión."
          onRetry={reload}
        />
      </div>
    );
  }

  const { taskStats, financeStats, jobStats, reelStats, youTubeStats, projectStat, musicStats, social, alerts, todayTasks, overdueTasks, agendaItems, consultancies } = d;
  const monthName = MONTHS[new Date().getMonth()];
  const todayStr = localDateKey(new Date());

  const inProduction = (reelStats.in_production || 0) + (youTubeStats.in_production || 0);
  const alertsList = (alerts ?? []).slice(0, 8);
  const upcomingAgenda = (agendaItems ?? [])
    .filter((i) => i.date >= todayStr && i.status !== 'done' && i.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'))
    .slice(0, 4);

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between stagger-item">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight">Dashboard</h1>
          <p className="text-xs text-[var(--color-text-tertiary)]">{monthName} {new Date().getFullYear()}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refrescar"
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition cursor-pointer disabled:cursor-default active:scale-90 ${
            refreshing
              ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
              : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'
          }`}
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>🔄</span>
        </button>
      </div>

      {/* Inline status chips */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)] stagger-item">
        <span className="flex items-center gap-1">🔥 <span className="font-semibold text-[var(--color-text-secondary)]">{taskStats.in_progress || 0}</span> en curso</span>
        <span className="text-[var(--color-text-disabled)]">·</span>
        <span className="flex items-center gap-1">⚡ <span className="font-semibold text-[var(--color-text-secondary)]">{taskStats.pending || 0}</span> pendientes</span>
        {taskStats.overdue > 0 && (
          <>
            <span className="text-[var(--color-text-disabled)]">·</span>
            <span className="text-red-400 font-semibold">⚠️ {taskStats.overdue} vencidas</span>
          </>
        )}
      </div>

      {/* Alerts bar — pills scrollables */}
      {alertsList.length > 0 && (
        <div className="-mx-3 px-3 overflow-x-auto no-scrollbar flex gap-2 pb-1 stagger-item">
          {alertsList.map((a, i) => {
            const s = ALERT_STYLES[a.type] || ALERT_STYLES.info;
            return (
              <button
                key={i}
                onClick={() => navigate('/buscar')}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border ${s.bg} ${s.text} ${s.border} active:scale-95 transition`}
              >
                <span>{s.icon}</span>
                <span className="max-w-[180px] truncate">{a.message || a.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Big Stat 1 — Ingresos */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-transform stagger-item relative overflow-hidden">
        {/* Glow decorativo */}
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-medium opacity-80">Ingresos del mes</p>
          <p className="text-2xl font-bold mt-0.5 tracking-tight">{formatCurrency(financeStats.income_month || 0)}</p>
          <p className="text-[10px] mt-1 opacity-70">Gastos: {formatCurrency(financeStats.expense_month || 0)}</p>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p className="opacity-70">Por cobrar</p>
              <p className="font-semibold">{formatCurrency(financeStats.pending_receivables || 0)}</p>
            </div>
            <div>
              <p className="opacity-70">Vencido</p>
              <p className="font-semibold text-red-100">{formatCurrency(financeStats.overdue_receivables || 0)}</p>
            </div>
            <div>
              <p className="opacity-70">Cotiz.</p>
              <p className="font-semibold">{financeStats.quotes_pending || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Big Stat 2 — Producción */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-transform stagger-item relative overflow-hidden">
        <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-medium opacity-80">En producción</p>
          <p className="text-2xl font-bold mt-0.5 tracking-tight">{inProduction}</p>
          <p className="text-[10px] mt-1 opacity-70">{reelStats.in_production || 0} reels · {youTubeStats.in_production || 0} videos</p>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p className="opacity-70">Proyectos</p>
              <p className="font-semibold">{projectStat.active || 0}</p>
            </div>
            <div>
              <p className="opacity-70">Música</p>
              <p className="font-semibold">{musicStats.active || 0}</p>
            </div>
            <div>
              <p className="opacity-70">Asesorías</p>
              <p className="font-semibold">
                {(consultancies ?? []).filter((c) => ['requested','scheduled','confirmed'].includes(c.status)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2 cols — Tareas + Trabajos */}
      <div className="grid grid-cols-2 gap-2">
        <DashboardCard title="📋 Tareas" onClick={() => navigate('/tareas')} className="stagger-item">
          <div className="space-y-1.5">
            <MiniBar label="Pendientes"  value={taskStats.pending || 0}             max={Math.max(taskStats.pending || 0, taskStats.in_progress || 0, taskStats.overdue || 0, taskStats.completed_this_month || 0, 1)} color="bg-yellow-500" />
            <MiniBar label="En curso"    value={taskStats.in_progress || 0}         max={Math.max(taskStats.pending || 0, taskStats.in_progress || 0, taskStats.overdue || 0, taskStats.completed_this_month || 0, 1)} color="bg-blue-500" />
            <MiniBar label="Vencidas"    value={taskStats.overdue || 0}             max={Math.max(taskStats.pending || 0, taskStats.in_progress || 0, taskStats.overdue || 0, 1)} color="bg-red-500" />
            <MiniBar label="Hechas mes"  value={taskStats.completed_this_month || 0} max={Math.max(taskStats.pending || 0, taskStats.in_progress || 0, taskStats.completed_this_month || 0, 1)} color="bg-green-500" />
          </div>
          {(todayTasks ?? []).length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--color-border-light)]">
              <p className="text-[9px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">📌 Para hoy ({todayTasks.length})</p>
              <div className="space-y-0.5">
                {todayTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
                    <PriorityDot priority={t.priority || 'medium'} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="💼 Trabajos" onClick={() => navigate('/buscar')} className="stagger-item">
          <div className="grid grid-cols-3 gap-1 mb-2 text-center">
            <MiniStat label="Activos" value={jobStats.active || 0} color="text-blue-500" />
            <MiniStat label="x entr." value={jobStats.pending_delivery || 0} color="text-orange-500" />
            <MiniStat label="Pagos" value={jobStats.payment_due || 0} color="text-yellow-500" />
          </div>
          <div className="space-y-1.5">
            <MiniBar label="En proceso"  value={jobStats.active || 0}             max={Math.max(jobStats.active || 0, jobStats.pending_delivery || 0, jobStats.delivered_this_month || 0, 1)} color="bg-blue-500" />
            <MiniBar label="x entregar"   value={jobStats.pending_delivery || 0}  max={Math.max(jobStats.active || 0, jobStats.pending_delivery || 0, 1)} color="bg-orange-500" />
            <MiniBar label="Entregados"   value={jobStats.delivered_this_month || 0} max={Math.max(jobStats.active || 0, jobStats.pending_delivery || 0, jobStats.delivered_this_month || 0, 1)} color="bg-green-500" />
          </div>
        </DashboardCard>
      </div>

      {/* Próximos agenda — full width, solo si hay items */}
      {upcomingAgenda.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 stagger-item">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--color-text)]">🗓️ Próximos agenda</h3>
            <button onClick={() => navigate('/agenda')} className="text-[11px] text-[var(--color-primary)] active:scale-95 transition cursor-pointer">Ver todas →</button>
          </div>
          <div className="space-y-1.5">
            {upcomingAgenda.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AGENDA_TYPE_COLORS[item.item_type] || 'bg-gray-400'}`} />
                <span className="truncate flex-1 text-[var(--color-text)] font-medium">{item.title}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] flex-shrink-0">
                  {item.date === todayStr ? 'Hoy' : item.date.slice(5)}{item.time ? ` · ${item.time.slice(0, 5)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redes Sociales card — full width, solo si social */}
      {social && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3 stagger-item">
          <h3 className="text-xs font-bold text-[var(--color-text)]">📱 Redes Sociales</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl p-3 ${social.igConnected ? 'bg-gradient-to-br from-pink-500/15 to-purple-500/15' : 'bg-[var(--color-surface-hover)]'}`}>
              <p className="text-lg font-bold text-pink-500">{formatNumber(social.igFollowers)}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{social.igConnected ? 'Seguidores IG' : 'IG no conectado'}</p>
            </div>
            <div className={`rounded-xl p-3 ${social.ytConnected ? 'bg-gradient-to-br from-red-500/15 to-orange-500/15' : 'bg-[var(--color-surface-hover)]'}`}>
              <p className="text-lg font-bold text-red-500">{formatNumber(social.ytFollowers)}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{social.ytConnected ? 'Suscriptores YT' : 'YT no conectado'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border-light)] text-center">
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">{formatNumber(social.views)}</p>
              <p className="text-[9px] text-[var(--color-text-tertiary)]">Vistas</p>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">{formatNumber(social.likes)}</p>
              <p className="text-[9px] text-[var(--color-text-tertiary)]">Likes</p>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">{formatNumber(social.comments || 0)}</p>
              <p className="text-[9px] text-[var(--color-text-tertiary)]">Comments</p>
            </div>
          </div>
        </div>
      )}

      {/* Tareas atrasadas banner */}
      {(overdueTasks ?? []).length > 0 && (
        <button
          onClick={() => navigate('/tareas')}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-3 flex items-center justify-between text-xs active:scale-[0.98] transition stagger-item"
        >
          <span className="text-red-400 font-semibold flex items-center gap-2">
            <span>🔴</span> {overdueTasks.length} tareas atrasadas
          </span>
          <span className="text-red-400">Ver →</span>
        </button>
      )}

      <div className="text-[10px] text-center text-[var(--color-text-disabled)] py-2">
        FlowTrack Móvil v0.2
      </div>
    </div>
  );
}

// ─── Sub-componentes ───

function DashboardCard({ title, onClick, className = '', children }: {
  title: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 active:scale-[0.98] transition-transform cursor-pointer w-full ${className}`}
    >
      <h3 className="text-xs font-bold text-[var(--color-text)] mb-2">{title}</h3>
      {children}
    </button>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-16 text-[var(--color-text-tertiary)] truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right font-semibold text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-[var(--color-text-tertiary)]">{label}</p>
    </div>
  );
}
