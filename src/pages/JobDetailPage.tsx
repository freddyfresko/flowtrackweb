import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobById } from '../lib/db/jobs';
import { getClientById } from '../lib/db/clients';
import { formatCurrency } from '../lib/utils/format';
import type { Job, Client } from '../lib/types';
import { Avatar, StatusChip, Skeleton, EmptyState } from '../components/ui';

const JOB_TYPES: Record<string, { icon: string; label: string }> = {
  youtube_video: { icon: '▶️', label: 'Video YouTube' },
  social_video: { icon: '🎬', label: 'Video Social' },
  music_production: { icon: '🎧', label: 'Prod. Musical' },
  consultancy: { icon: '🎓', label: 'Asesoría' },
  filmmaker_videoclip: { icon: '🎥', label: 'Videoclip' },
  filmmaker_reels: { icon: '📱', label: 'Reels' },
  audio_mix: { icon: '🎛️', label: 'Mezcla Audio' },
  audio_mastering: { icon: '🎚️', label: 'Mastering' },
  audio_ep: { icon: '💿', label: 'EP' },
  audio_album: { icon: '💿', label: 'Álbum' },
  other: { icon: '💼', label: 'Otro' },
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getJobById(id)
      .then((j) => {
        setJob(j as Job | null);
        if (j?.client_id) {
          getClientById(j.client_id).then((c) => setClient(c)).catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-3 animate-slide-in-right">
        <Skeleton className="h-28 w-full" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-3">
        <EmptyState
          icon="⚠️"
          title="Trabajo no encontrado"
          action={{ label: '← Volver', onClick: () => navigate(-1) }}
        />
      </div>
    );
  }

  const typeInfo = JOB_TYPES[job.type] || JOB_TYPES.other;
  const total = job.budget || 0;
  const paid = job.deposit || 0;
  const balance = job.balance != null ? job.balance : (total - paid);
  const paidPct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <div className="animate-slide-in-right pb-4">
      {/* Header sticky con back */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur-xl border-b border-[var(--color-border)] px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center active:scale-90 transition cursor-pointer text-[var(--color-text-tertiary)]"
          aria-label="Volver"
        >
          ←
        </button>
        <h1 className="text-sm font-bold text-[var(--color-text)] truncate flex-1">{job.title}</h1>
        {job.status && <StatusChip status={job.status} />}
      </div>

      <div className="p-3 space-y-3">
        {/* Hero — tipo + título */}
        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-border)] p-4 stagger-item">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
              {typeInfo.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">{typeInfo.label}</p>
              <p className="text-sm font-bold text-[var(--color-text)] leading-snug">{job.title}</p>
            </div>
          </div>
        </div>

        {/* Cliente asociado — tap to view */}
        {client && (
          <button
            onClick={() => navigate(`/clientes/${client.id}`)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex items-center gap-2.5 active:scale-[0.98] transition cursor-pointer stagger-item"
          >
            <Avatar name={client.name} size="md" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] text-[var(--color-text-tertiary)]">Cliente</p>
              <p className="text-sm font-semibold text-[var(--color-text)] truncate">{client.name}</p>
              {client.artist_name && (
                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">🎤 {client.artist_name}</p>
              )}
            </div>
            <span className="text-[var(--color-text-tertiary)] text-xs">→</span>
          </button>
        )}

        {/* Finanzas — card visual con barra de progreso de pago */}
        {(job.budget != null || job.deposit != null || job.balance != null) && total > 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3 stagger-item">
            <h2 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">💰 Finanzas</h2>

            {/* Barra de progreso pago */}
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-[var(--color-text-tertiary)]">Pagado</span>
                <span className="font-semibold text-[var(--color-text)]">{paidPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
            </div>

            {/* 3 mini stats */}
            <div className="grid grid-cols-3 gap-2">
              <FinanceStat label="Presupuesto" value={formatCurrency(total)} color="text-[var(--color-text)]" />
              <FinanceStat label="Abonado" value={formatCurrency(paid)} color="text-green-500" />
              <FinanceStat
                label="Saldo"
                value={formatCurrency(balance)}
                color={balance > 0 ? 'text-orange-500' : 'text-green-500'}
              />
            </div>
          </div>
        )}

        {/* Descripción */}
        {job.description && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 stagger-item">
            <h2 className="text-xs font-bold text-[var(--color-text)] mb-1.5">📝 Descripción</h2>
            <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>
          </div>
        )}

        {/* Notas */}
        {job.notes && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 stagger-item">
            <h2 className="text-xs font-bold text-[var(--color-text)] mb-1.5">🗒️ Notas</h2>
            <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {job.notes}
            </p>
          </div>
        )}

        {/* Metadata creación */}
        {job.created_at && (
          <p className="text-[10px] text-[var(--color-text-disabled)] text-center pt-2">
            Creado el {new Date(job.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}

function FinanceStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-[var(--color-text-tertiary)] mt-0.5">{label}</p>
    </div>
  );
}
