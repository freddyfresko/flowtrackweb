import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClientById } from '../lib/db/clients';
import { getJobs } from '../lib/db/jobs';
import { getProjects } from '../lib/db/projects';
import { getTasks } from '../lib/db/tasks';
import type { Client, Job, DigitalProject, Task } from '../lib/types';
import { Avatar, StatusChip, Skeleton, EmptyState } from '../components/ui';
import { formatCurrency } from '../lib/utils/format';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getClientById(id).catch(() => null),
      getJobs({ client_id: id }).catch(() => []),
      getTasks().catch(() => []),
    ]).then(([c, j, t]) => {
      setClient(c);
      setJobs(j as Job[]);
      setTasks(t);
      setLoading(false);
    });
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

  if (!client) {
    return (
      <div className="p-3">
        <EmptyState
          icon="⚠️"
          title="Cliente no encontrado"
          action={{ label: '← Volver', onClick: () => navigate(-1) }}
        />
      </div>
    );
  }

  const clientTasks = tasks.filter((t) => t.title?.toLowerCase().includes(client.name?.toLowerCase() || '___'));

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
        <h1 className="text-sm font-bold text-[var(--color-text)] truncate flex-1">{client.name}</h1>
        {client.status && <StatusChip status={client.status} />}
      </div>

      <div className="p-3 space-y-3">
        {/* Hero — avatar grande + nombre + rol */}
        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-border)] p-4 flex items-center gap-3 stagger-item">
          <Avatar name={client.name} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[var(--color-text)] truncate">{client.name}</p>
            {client.artist_name && (
              <p className="text-xs text-[var(--color-text-tertiary)] truncate">🎤 {client.artist_name}</p>
            )}
            {client.company && (
              <p className="text-xs text-[var(--color-text-tertiary)] truncate">🏢 {client.company}</p>
            )}
            {client.first_contact_date && (
              <p className="text-[10px] text-[var(--color-text-disabled)] mt-1">
                📅 Cliente desde {client.first_contact_date}
              </p>
            )}
          </div>
        </div>

        {/* Contacto — grid 2 cols */}
        {(client.email || client.phone || client.social_media || client.preferred_contact) && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 stagger-item">
            <h2 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">📇 Contacto</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {client.email && <InfoRow icon="✉️" label="Email" value={client.email} />}
              {client.phone && <InfoRow icon="📞" label="Teléfono" value={client.phone} />}
              {client.social_media && <InfoRow icon="📱" label="Redes" value={client.social_media} />}
              {client.preferred_contact && <InfoRow icon="💬" label="Prefiere" value={client.preferred_contact} />}
            </div>
          </div>
        )}

        {/* Trabajos asociados */}
        {jobs.length > 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 stagger-item">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                💼 Trabajos <span className="text-[10px] text-[var(--color-text-tertiary)]">({jobs.length})</span>
              </h2>
            </div>
            <div className="space-y-1.5">
              {jobs.slice(0, 8).map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/trabajos/${job.id}`)}
                  className="w-full flex items-center gap-2.5 py-2 px-2.5 rounded-xl border border-[var(--color-border)] active:scale-[0.98] transition cursor-pointer hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="w-7 h-7 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-xs flex-shrink-0">
                    {job.type === 'music_production' ? '🎧' :
                     job.type?.includes('video') || job.type?.includes('reels') ? '🎬' :
                     job.type === 'consultancy' ? '🎓' :
                     job.type?.includes('audio') ? '🎵' : '💼'}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-[var(--color-text)] truncate">{job.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {job.status && <StatusChip status={job.status} />}
                      {job.budget != null && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          {formatCurrency(job.budget)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-3 stagger-item">
            <p className="text-xs text-[var(--color-text-tertiary)] text-center">Sin trabajos asociados</p>
          </div>
        )}

        {/* Notas */}
        {client.notes && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 stagger-item">
            <h2 className="text-xs font-bold text-[var(--color-text)] mb-1.5">📝 Notas</h2>
            <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {client.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  // Detectar URLs/emails/tels para hacerlos tap-to-action
  const isEmail = value.includes('@') && !value.includes(' ');
  const isPhone = /^[\d\s+()-]+$/.test(value);
  const isUrl = value.startsWith('http') || value.startsWith('www.');
  const href = isEmail ? `mailto:${value}` : isPhone ? `tel:${value.replace(/\s/g, '')}` : isUrl ? (value.startsWith('http') ? value : `https://${value}`) : null;

  return (
    <div>
      <p className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1">{icon} {label}</p>
      {href ? (
        <a href={href} target={isUrl ? '_blank' : undefined} rel="noopener noreferrer" className="text-xs text-[var(--color-primary)] break-all active:scale-95 transition">
          {value}
        </a>
      ) : (
        <p className="text-xs text-[var(--color-text)] break-words">{value}</p>
      )}
    </div>
  );
}
