import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClients } from '../lib/db/clients';
import { getJobs, type JobFilters } from '../lib/db/jobs';
import { getProjects } from '../lib/db/projects';
import { getConsultancies } from '../lib/db/consultancies';
import { getMusicProjects } from '../lib/db/music';
import { getReels } from '../lib/db/reels';
import { getYouTubeVideos } from '../lib/db/youtube';
import { getVideoclips } from '../lib/db/videoclips';
import { getAgendaItems } from '../lib/db/agenda';
import { getTasks } from '../lib/db/tasks';
import type { Client, Job, DigitalProject, Consultancy, MusicProject, Reel, YouTubeVideo, AgendaItem, Task } from '../lib/types';
import { Avatar, StatusChip, EmptyState } from '../components/ui';

type ModuleKey = 'clients' | 'jobs' | 'projects' | 'music' | 'consultancies' | 'reels' | 'youtube' | 'videoclips';

const MODULES: { key: ModuleKey; icon: string; label: string; gradient: string }[] = [
  { key: 'clients', icon: '👥', label: 'Clientes', gradient: 'from-sky-500/15 to-blue-500/15' },
  { key: 'jobs', icon: '💼', label: 'Trabajos', gradient: 'from-orange-500/15 to-amber-500/15' },
  { key: 'projects', icon: '🛠️', label: 'Proyectos', gradient: 'from-violet-500/15 to-purple-500/15' },
  { key: 'music', icon: '🎧', label: 'Música', gradient: 'from-emerald-500/15 to-teal-500/15' },
  { key: 'consultancies', icon: '🎓', label: 'Asesorías', gradient: 'from-purple-500/15 to-fuchsia-500/15' },
  { key: 'reels', icon: '🎬', label: 'Reels', gradient: 'from-pink-500/15 to-rose-500/15' },
  { key: 'youtube', icon: '📹', label: 'YouTube', gradient: 'from-red-500/15 to-orange-500/15' },
  { key: 'videoclips', icon: '🎥', label: 'Videoclips', gradient: 'from-indigo-500/15 to-blue-500/15' },
];

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ module: string; items: any[] }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = async (q: string) => {
    setSearching(true);
    const lower = q.toLowerCase();
    try {
      const [clients, jobs, projects, music, consultancies, reels, youtube, videoclips, agenda, tasks] = await Promise.all([
        getClients().catch(() => [] as Client[]),
        getJobs({} as JobFilters).catch(() => [] as Job[]),
        getProjects().catch(() => [] as DigitalProject[]),
        getMusicProjects().catch(() => [] as MusicProject[]),
        getConsultancies().catch(() => [] as Consultancy[]),
        getReels({} as any).catch(() => [] as Reel[]),
        getYouTubeVideos({} as any).catch(() => [] as YouTubeVideo[]),
        getVideoclips({} as any).catch(() => [] as any[]),
        getAgendaItems({} as any).catch(() => [] as AgendaItem[]),
        getTasks({} as any).catch(() => [] as Task[]),
      ]);

      const match = (fields: (string | null | undefined)[]) =>
        fields.some((f) => f?.toLowerCase().includes(lower));

      const r: { module: string; items: any[] }[] = [];
      const filteredClients = clients.filter((c) => match([c.name, c.artist_name, c.company, c.email, c.phone]));
      if (filteredClients.length) r.push({ module: 'Clientes', items: filteredClients.slice(0, 6) });
      const filteredJobs = jobs.filter((j) => match([j.title, j.description, j.type]));
      if (filteredJobs.length) r.push({ module: 'Trabajos', items: filteredJobs.slice(0, 6) });
      const filteredProjects = projects.filter((p) => match([p.name, p.description]));
      if (filteredProjects.length) r.push({ module: 'Proyectos', items: filteredProjects.slice(0, 6) });
      const filteredReels = reels.filter((rr) => match([rr.title, rr.idea, rr.project]));
      if (filteredReels.length) r.push({ module: 'Reels', items: filteredReels.slice(0, 6) });
      const filteredYT = youtube.filter((v) => match([v.provisional_title, v.final_title, v.idea]));
      if (filteredYT.length) r.push({ module: 'YouTube', items: filteredYT.slice(0, 6) });
      const filteredTasks = tasks.filter((t) => match([t.title, t.description, t.area]));
      if (filteredTasks.length) r.push({ module: 'Tareas', items: filteredTasks.slice(0, 6) });
      setResults(r);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="pb-3">
      {/* Search bar — sticky con blur */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur-xl px-3 pt-3 pb-2 border-b border-[var(--color-border)]">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)] pointer-events-none">🔍</span>
          <input
            autoFocus
            placeholder="Buscar clientes, trabajos, reels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)] active:scale-90 transition cursor-pointer w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)]"
              aria-label="Limpiar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {query.trim() ? (
        /* Search results */
        <div className="px-3 pt-3 space-y-4 animate-xfade">
          {searching ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-tertiary)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="Sin resultados"
              subtitle={`No encontramos nada para "${query}"`}
            />
          ) : (
            results.map((group) => (
              <div key={group.module} className="stagger-item">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider">
                    {group.module}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-disabled)]">({group.items.length})</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item: any) => (
                    <ResultRow key={item.id} item={item} module={group.module} navigate={navigate} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Module grid — acceso rápido */
        <div className="px-3 pt-3 animate-xfade">
          <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider mb-2">Módulos</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map((mod) => (
              <button
                key={mod.key}
                onClick={() => navigate(`/buscar?mod=${mod.key}`)}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-gradient-to-br ${mod.gradient} border border-[var(--color-border)] active:scale-[0.98] transition-transform cursor-pointer stagger-item`}
              >
                <span className="text-xl">{mod.icon}</span>
                <div className="text-left">
                  <p className="text-xs font-semibold text-[var(--color-text)]">{mod.label}</p>
                  <p className="text-[9px] text-[var(--color-text-tertiary)]">Toca para ver</p>
                </div>
              </button>
            ))}
          </div>

          {/* Tip card */}
          <div className="mt-4 p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1.5 stagger-item">
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">💡 Tip</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Busca por nombre, email, estado o cualquier palabra. Los resultados aparecen agrupados por módulo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ item, module, navigate }: { item: any; module: string; navigate: any }) {
  const getTitle = () => {
    if (item.name) return item.name;
    if (item.title) return item.title;
    if (item.provisional_title) return item.provisional_title;
    return 'Sin título';
  };
  const getSub = () => {
    if (item.status) return item.status;
    if (item.company) return item.company;
    return '';
  };
  const linkTo = () => {
    switch (module) {
      case 'Clientes': return `/clientes/${item.id}`;
      case 'Trabajos': return `/trabajos/${item.id}`;
      default: return '#';
    }
  };

  const showAvatar = module === 'Clientes' || module === 'Trabajos';

  return (
    <div
      onClick={() => { if (linkTo() !== '#') navigate(linkTo()); }}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl active:bg-[var(--color-surface-hover)] transition cursor-pointer ${
        linkTo() === '#' ? '' : 'active:scale-[0.98]'
      }`}
    >
      {showAvatar ? (
        <Avatar name={getTitle()} size="sm" />
      ) : (
        <span className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[11px] font-bold text-[var(--color-primary)] flex-shrink-0">
          {getTitle()[0]?.toUpperCase()}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text)] truncate">{getTitle()}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.status && <StatusChip status={item.status} />}
          {!item.status && item.company && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] truncate">{item.company}</span>
          )}
        </div>
      </div>
      {linkTo() !== '#' && <span className="text-[10px] text-[var(--color-text-tertiary)]">→</span>}
    </div>
  );
}
