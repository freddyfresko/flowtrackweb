import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobById } from '../lib/db/jobs';
import { getClientById } from '../lib/db/clients';
import { formatCurrency } from '../lib/utils/format';
import type { Job, Client } from '../lib/types';

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
        setJob(j);
        if (j?.client_id) {
          getClientById(j.client_id).then((c) => setClient(c)).catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-20 rounded-xl bg-[var(--color-surface)] animate-pulse" />
        <div className="h-32 rounded-xl bg-[var(--color-surface)] animate-pulse" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-sm text-red-500">
        <span>⚠️ Trabajo no encontrado</span>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white cursor-pointer text-sm">Volver</button>
      </div>
    );
  }

  const typeLabel = job.type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Otro';
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    waiting_client: 'bg-yellow-500/20 text-yellow-400',
    in_review: 'bg-purple-500/20 text-purple-400',
    with_changes: 'bg-orange-500/20 text-orange-400',
    blocked: 'bg-red-500/20 text-red-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
    archived: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] animate-page-enter">
      {/* Back + header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">←</button>
        <h1 className="text-sm font-bold text-[var(--color-text)] truncate">{job.title}</h1>
      </div>

      <div className="p-3 space-y-3">
        {/* Info principal */}
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">{typeLabel}</span>
              <p className="text-sm font-semibold text-[var(--color-text)]">{job.title}</p>
            </div>
            {job.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[job.status] || ''}`}>
                {job.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Cliente */}
          {client && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)]">
                {client.name[0]?.toUpperCase()}
              </span>
              <span className="text-[var(--color-text)]">{client.name}</span>
            </div>
          )}
        </div>

        {/* Finanzas */}
        {(job.budget != null || job.deposit != null || job.balance != null) && (
          <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
            <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider">💰 Finanzas</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {job.budget != null && <InfoStat label="Presupuesto" value={formatCurrency(job.budget)} />}
              {job.deposit != null && <InfoStat label="Abono" value={formatCurrency(job.deposit)} />}
              {job.balance != null && <InfoStat label="Saldo" value={formatCurrency(job.balance)} />}
            </div>
          </div>
        )}

        {/* Notas */}
        {job.notes && (
          <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3">
            <p className="text-[10px] text-[var(--color-text-tertiary)] mb-1">Notas</p>
            <p className="text-xs text-[var(--color-text)] whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="text-xs font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}
