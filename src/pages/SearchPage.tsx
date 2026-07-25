import { useState, useCallback, useEffect, useRef } from 'react';
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
import { localDateKey } from '../lib/date';
import type { Client, Job, DigitalProject, Consultancy, MusicProject, Reel, YouTubeVideo, AgendaItem, Task } from '../lib/types';

type ModuleKey = 'clients' | 'jobs' | 'projects' | 'music' | 'consultancies' | 'reels' | 'youtube' | 'videoclips';

const MODULES: { key: ModuleKey; icon: string; label: string; count?: number }[] = [
  { key: 'clients', icon: '👥', label: 'Clientes' },
  { key: 'jobs', icon: '💼', label: 'Trabajos' },
  { key: 'projects', icon: '🛠️', label: 'Proyectos' },
  { key: 'music', icon: '🎧', label: 'Producción Musical' },
  { key: 'consultancies', icon: '🎓', label: 'Asesorías' },
  { key: 'reels', icon: '🎬', label: 'Reels' },
  { key: 'youtube', icon: '📹', label: 'YouTube' },
  { key: 'videoclips', icon: '🎥', label: 'Videoclips' },
];

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ module: string; items: any[] }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(query.trim()), 300);
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
        getVideoclips().catch(() => [] as any[]),
        getAgendaItems({} as any).catch(() => [] as AgendaItem[]),
        getTasks({} as any).catch(() => [] as Task[]),
      ]);

      const match = (fields: (string | null | undefined)[]) =>
        fields.some((f) => f?.toLowerCase().includes(lower));

      const r: { module: string; items: any[] }[] = [];
      const filteredClients = clients.filter((c) => match([c.name, c.artist_name, c.company, c.email, c.phone]));
      if (filteredClients.length) r.push({ module: 'Clientes', items: filteredClients.slice(0, 5) });
      const filteredJobs = jobs.filter((j) => match([j.title, j.description, j.type]));
      if (filteredJobs.length) r.push({ module: 'Trabajos', items: filteredJobs.slice(0, 5) });
      const filteredProjects = projects.filter((p) => match([p.name, p.description]));
      if (filteredProjects.length) r.push({ module: 'Proyectos', items: filteredProjects.slice(0, 5) });
      const filteredReels = reels.filter((r) => match([r.title, r.idea, r.project]));
      if (filteredReels.length) r.push({ module: 'Reels', items: filteredReels.slice(0, 5) });
      const filteredYT = youtube.filter((v) => match([v.provisional_title, v.final_title, v.idea]));
      if (filteredYT.length) r.push({ module: 'YouTube', items: filteredYT.slice(0, 5) });
      const filteredTasks = tasks.filter((t) => match([t.title, t.description, t.area]));
      if (filteredTasks.length) r.push({ module: 'Tareas', items: filteredTasks.slice(0, 5) });
      setResults(r);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="pb-3 animate-page-enter">
      {/* Search bar */}
      <div className="px-3 pt-2 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">🔍</span>
          <input
            autoFocus
            placeholder="Buscar clientes, trabajos, reels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-disabled)]"
          />
        </div>
      </div>

      {query.trim() ? (
        /* Search results */
        <div className="px-3 space-y-4">
          {searching ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-tertiary)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" /> Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-tertiary)]">Sin resultados</div>
          ) : (
            results.map((group) => (
              <div key={group.module}>
                <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider mb-1">{group.module}</p>
                {group.items.map((item: any) => (
                  <ResultRow key={item.id} item={item} module={group.module} navigate={navigate} />
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Module grid — acceso rápido a cada módulo */
        <div className="px-3">
          <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider mb-2">Módulos</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map((mod) => (
              <button
                key={mod.key}
                onClick={() => navigate(`/buscar?mod=${mod.key}`)}
                className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] active:scale-[0.98] transition cursor-pointer"
              >
                <span className="text-base">{mod.icon}</span>
                <span className="text-xs font-medium text-[var(--color-text)] truncate">{mod.label}</span>
              </button>
            ))}
          </div>

          {/* Stats rápidos */}
          <div className="mt-4 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <p className="text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider mb-2">📊 Resumen rápido</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStatButton icon="👥" label="Clientes" onClick={() => navigate('/buscar?mod=clients')} />
              <MiniStatButton icon="💼" label="Trabajos" onClick={() => navigate('/buscar?mod=jobs')} />
              <MiniStatButton icon="🎬" label="Reels" onClick={() => navigate('/buscar?mod=reels')} />
              <MiniStatButton icon="💰" label="Finanzas" onClick={() => navigate('/buscar?mod=jobs')} />
            </div>
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
  return (
    <div
      onClick={() => { if (linkTo() !== '#') navigate(linkTo()); }}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg active:bg-[var(--color-surface-hover)] transition cursor-pointer"
    >
      <span className="text-xs flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)]">
        {getTitle()[0]?.toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text)] truncate">{getTitle()}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)]">{getSub()}</p>
      </div>
      <span className="text-[10px] text-[var(--color-text-tertiary)]">→</span>
    </div>
  );
}

function MiniStatButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-[var(--color-surface-hover)] transition cursor-pointer">
      <span className="text-base">{icon}</span>
      <span className="text-[9px] text-[var(--color-text-tertiary)]">{label}</span>
    </button>
  );
}
