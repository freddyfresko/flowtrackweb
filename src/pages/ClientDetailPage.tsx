import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClientById } from '../lib/db/clients';
import { getJobs } from '../lib/db/jobs';
import { getProjects } from '../lib/db/projects';
import type { Client, Job, DigitalProject } from '../lib/types';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<DigitalProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getClientById(id).catch(() => null),
      getJobs({ client_id: id } as any).catch(() => []),
      getProjects().catch(() => []),
    ]).then(([c, j, p]) => {
      setClient(c);
      setJobs(j as Job[]);
      setProjects((p as DigitalProject[]).filter((pr) => pr.id === id));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-20 rounded-xl bg-[var(--color-surface)] animate-pulse" />
        <div className="h-32 rounded-xl bg-[var(--color-surface)] animate-pulse" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-sm text-red-500">
        <span>⚠️ Cliente no encontrado</span>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white cursor-pointer text-sm">Volver</button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    prospect: 'bg-blue-500/20 text-blue-400',
    inactive: 'bg-gray-500/20 text-gray-400',
    frequent: 'bg-purple-500/20 text-purple-400',
    archived: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] animate-page-enter">
      {/* Back + header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg active:scale-90 cursor-pointer">←</button>
        <h1 className="text-sm font-bold text-[var(--color-text)] truncate">{client.name}</h1>
      </div>

      <div className="p-3 space-y-3">
        {/* Info */}
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
                {client.name[0]?.toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{client.name}</p>
                {client.artist_name && <p className="text-[10px] text-[var(--color-text-tertiary)]">{client.artist_name}</p>}
              </div>
            </div>
            {client.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[client.status] || ''}`}>
                {client.status}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {client.email && <InfoRow label="Email" value={client.email} />}
            {client.phone && <InfoRow label="Teléfono" value={client.phone} />}
            {client.company && <InfoRow label="Empresa" value={client.company} />}
            {client.social_media && <InfoRow label="Redes" value={client.social_media} />}
          </div>
          {client.notes && (
            <div>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">Notas</p>
              <p className="text-xs text-[var(--color-text)] whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Trabajos asociados */}
        {jobs.length > 0 && (
          <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-1">
            <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider">💼 Trabajos ({jobs.length})</p>
            {jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-divider)] last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--color-text)] truncate">{job.title}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{job.type} · {job.status}</p>
                </div>
                {job.budget != null && (
                  <span className="text-[10px] font-semibold ml-2">{'$' + Math.round(job.budget).toLocaleString('es-CL')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="text-xs text-[var(--color-text)]">{value}</p>
    </div>
  );
}
