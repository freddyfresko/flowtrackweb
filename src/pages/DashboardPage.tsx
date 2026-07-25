import { useDataStore } from '../lib/stores/dataStore';
import { formatCurrency, formatNumber } from '../lib/utils/format';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function DashboardPage() {
  const d = useDataStore((s) => s.dashboard);
  const status = useDataStore((s) => s.dashboardStatus);
  const reload = useDataStore((s) => s.initialiseDashboard);

  if (status === 'loading' && !d) {
    return (
      <div className="p-4 space-y-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 rounded-xl bg-[var(--color-surface)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!d) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-sm text-[var(--color-text-tertiary)]">
        <span className="text-3xl">📡</span>
        <p>No se pudieron cargar los datos</p>
        <button onClick={reload} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-accent)] text-sm cursor-pointer">
          Reintentar
        </button>
      </div>
    );
  }

  const { taskStats, financeStats, jobStats, reelStats, youTubeStats, projectStat, musicStats, social } = d;
  const monthName = MONTHS[new Date().getMonth()];

  return (
    <div className="p-3 pb-4 space-y-3 animate-page-enter">

      {/* Saludo + fecha */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-xs text-[var(--color-text-tertiary)]">{monthName} 2026</p>
        </div>
        <button onClick={reload} className="text-xs text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 transition cursor-pointer">
          🔄
        </button>
      </div>

      {/* Alerts */}
      {(d.alerts ?? []).length > 0 && (
        <div className="space-y-1">
          {d.alerts.slice(0, 3).map((a: any) => (
            <div key={a.id} className="px-3 py-2 rounded-xl text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20">
              ⚠️ {a.message || a.title}
            </div>
          ))}
        </div>
      )}

      {/* Tareas HOY */}
      <CardGrid>
        <SummaryCard
          icon="✅"
          label="Tareas hoy"
          value={String(taskStats.in_progress + taskStats.pending > 0 ? taskStats.in_progress + taskStats.pending : 0)}
          sub={`${taskStats.overdue} atrasadas`}
          href="/tareas"
          color="var(--color-primary)"
        />
        <SummaryCard
          icon="💰"
          label="Mes"
          value={formatCurrency(financeStats.result_month)}
          sub={`${formatCurrency(financeStats.income_month)} ing`}
          color="var(--color-success)"
        />
        <SummaryCard
          icon="💼"
          label="Trabajos"
          value={String(jobStats.active)}
          sub={`${jobStats.pending_delivery} por entregar`}
          href="/buscar"
          color="var(--color-warning)"
        />
      </CardGrid>

      {/* Finanzas rápidas */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">💰 Finanzas</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--color-text-tertiary)]">Pendiente cobrar</span>
            <p className="font-semibold text-[var(--color-text)]">{formatCurrency(financeStats.pending_receivables)}</p>
          </div>
          <div>
            <span className="text-[var(--color-text-tertiary)]">Vencido</span>
            <p className="font-semibold text-red-500">{formatCurrency(financeStats.overdue_receivables)}</p>
          </div>
          <div>
            <span className="text-[var(--color-text-tertiary)]">Deuda total</span>
            <p className="font-semibold text-[var(--color-text)]">{formatCurrency(financeStats.total_debt)}</p>
          </div>
          <div>
            <span className="text-[var(--color-text-tertiary)]">Cotizaciones</span>
            <p className="font-semibold text-[var(--color-text)]">{financeStats.quotes_pending}</p>
          </div>
        </div>
      </div>

      {/* Contenido / Producción */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">🎬 Producción</div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <MiniStat label="Reels activos" value={String(reelStats.in_production)} />
          <MiniStat label="YT activos" value={String(youTubeStats.in_production)} />
          <MiniStat label="Proyectos" value={String(projectStat.active)} />
          <MiniStat label="Música" value={String(musicStats.active)} />
        </div>
      </div>

      {/* Redes Sociales rápidas */}
      {social && (
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">📱 Redes Sociales</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--color-text-tertiary)]">Instagram</span>
              <p className="font-semibold">{formatNumber(social.igFollowers)} seguidores</p>
            </div>
            <div>
              <span className="text-[var(--color-text-tertiary)]">YouTube</span>
              <p className="font-semibold">{formatNumber(social.ytFollowers)} suscriptores</p>
            </div>
            <div>
              <span className="text-[var(--color-text-tertiary)]">Views</span>
              <p className="font-semibold">{formatNumber(social.views)}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-tertiary)]">Likes</span>
              <p className="font-semibold">{formatNumber(social.likes)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Agenda próxima */}
      {d.agendaItems.length > 0 && (
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">🗓️ Próximos agenda</span>
            <a href="/agenda" className="text-xs text-[var(--color-primary)]">Ver todas</a>
          </div>
          <div className="space-y-1">
            {d.agendaItems.slice(0, 3).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-1">
                <span className="truncate flex-1">{item.title}</span>
                <span className="text-[var(--color-text-tertiary)] ml-2">
                  {item.time ? item.time.slice(0, 5) : item.date?.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tareas atrasadas (si hay) */}
      {taskStats.overdue > 0 && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-xs flex items-center justify-between">
          <span className="text-red-400 font-medium">🔴 {taskStats.overdue} tareas atrasadas</span>
          <a href="/tareas" className="text-xs text-[var(--color-primary)]">Ver</a>
        </div>
      )}

      <div className="text-[10px] text-center text-[var(--color-text-disabled)] py-2">
        FlowTrack Móvil v0.1
      </div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function SummaryCard({ icon, label, value, sub, href, color }: {
  icon: string; label: string; value: string; sub: string; href?: string; color: string;
}) {
  const content = (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 flex flex-col gap-0.5 active:scale-95 transition-transform h-full">
      <span className="text-lg">{icon}</span>
      <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">{label}</span>
      <span className="text-sm font-bold text-[var(--color-text)]">{value}</span>
      <span className="text-[9px] text-[var(--color-text-tertiary)]">{sub}</span>
    </div>
  );
  if (href) return <a href={href} className="block">{content}</a>;
  return content;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-bold text-sm text-[var(--color-text)]">{value}</span>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{label}</p>
    </div>
  );
}
