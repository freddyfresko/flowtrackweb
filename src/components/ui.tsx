// Mobile UI primitives — reutilizables en todas las páginas.
// Diseño premium native-grade: chips suaves, avatares color hash, skeletons con shimmer.

import { useEffect, useState } from 'react';

// ─── Avatar con inicial + color hash determinístico ───

const AVATAR_PALETTE = [
  { bg: 'bg-rose-500/15',    text: 'text-rose-400' },
  { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
  { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  { bg: 'bg-teal-500/15',    text: 'text-teal-400' },
  { bg: 'bg-cyan-500/15',    text: 'text-cyan-400' },
  { bg: 'bg-sky-500/15',     text: 'text-sky-400' },
  { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
  { bg: 'bg-indigo-500/15',  text: 'text-indigo-400' },
  { bg: 'bg-violet-500/15', text: 'text-violet-400' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  { bg: 'bg-pink-500/15',    text: 'text-pink-400' },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const idx = hashString(name || '?') % AVATAR_PALETTE.length;
  const c = AVATAR_PALETTE[idx];
  const dims = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm' }[size];
  return (
    <span className={`${dims} ${c.bg} ${c.text} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {(name || '?')[0]?.toUpperCase()}
    </span>
  );
}

// ─── Status chip (color por estado) ───

const STATUS_STYLES: Record<string, { bg: string; text: string; label?: string }> = {
  // Genéricos
  pending:         { bg: 'bg-gray-500/15',   text: 'text-gray-400' },
  in_progress:     { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
  in_review:       { bg: 'bg-purple-500/15',  text: 'text-purple-400' },
  with_changes:    { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
  blocked:         { bg: 'bg-red-500/15',      text: 'text-red-400' },
  done:            { bg: 'bg-green-500/15',    text: 'text-green-400' },
  completed:       { bg: 'bg-green-500/15',   text: 'text-green-400' },
  delivered:       { bg: 'bg-green-500/15',   text: 'text-green-400' },
  cancelled:       { bg: 'bg-red-500/15',      text: 'text-red-400' },
  archived:        { bg: 'bg-gray-500/15',     text: 'text-gray-400' },
  // Clientes
  active:          { bg: 'bg-green-500/15',    text: 'text-green-400' },
  prospect:        { bg: 'bg-sky-500/15',      text: 'text-sky-400' },
  inactive:        { bg: 'bg-gray-500/15',     text: 'text-gray-400' },
  frequent:        { bg: 'bg-purple-500/15',   text: 'text-purple-400' },
  // Trabajos
  waiting_client:  { bg: 'bg-amber-500/15',    text: 'text-amber-400' },
  // Social
  idea:            { bg: 'bg-indigo-500/15',   text: 'text-indigo-400' },
  scheduled:       { bg: 'bg-cyan-500/15',     text: 'text-cyan-400' },
  published:       { bg: 'bg-green-500/15',   text: 'text-green-400' },
  paused:          { bg: 'bg-gray-500/15',     text: 'text-gray-400' },
  // Finance
  overdue:         { bg: 'bg-red-500/15',      text: 'text-red-400' },
  partial:         { bg: 'bg-yellow-500/15',   text: 'text-yellow-400' },
  paid:            { bg: 'bg-green-500/15',    text: 'text-green-400' },
  // Asesorías
  requested:       { bg: 'bg-sky-500/15',      text: 'text-sky-400' },
  confirmed:       { bg: 'bg-green-500/15',    text: 'text-green-400' },
  in_follow_up:    { bg: 'bg-amber-500/15',    text: 'text-amber-400' },
  closed:          { bg: 'bg-gray-500/15',      text: 'text-gray-400' },
  // Proyectos
  development:     { bg: 'bg-blue-500/15',     text: 'text-blue-400' },
  planning:        { bg: 'bg-indigo-500/15',   text: 'text-indigo-400' },
  testing:         { bg: 'bg-amber-500/15',    text: 'text-amber-400' },
  launched:        { bg: 'bg-green-500/15',    text: 'text-green-400' },
  research:        { bg: 'bg-violet-500/15',   text: 'text-violet-400' },
  stalled:         { bg: 'bg-red-500/15',      text: 'text-red-400' },
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  if (!status) return null;
  const s = STATUS_STYLES[status] || { bg: 'bg-gray-500/15', text: 'text-gray-400' };
  const text = label || status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      {text}
    </span>
  );
}

// ─── Priority ring/dot ───

const PRIORITY_STYLES: Record<string, { dot: string; ring: string; label: string }> = {
  urgent: { dot: 'bg-red-500',     ring: 'ring-red-500/40',     label: 'Urgente' },
  high:   { dot: 'bg-orange-500',  ring: 'ring-orange-500/40',  label: 'Alta' },
  medium: { dot: 'bg-blue-500',    ring: 'ring-blue-500/40',    label: 'Media' },
  low:    { dot: 'bg-gray-400',    ring: 'ring-gray-400/30',    label: 'Baja' },
};

export function PriorityDot({ priority }: { priority: string }) {
  const p = PRIORITY_STYLES[priority];
  if (!p) return null;
  return (
    <span className={`w-2 h-2 rounded-full ${p.dot}`} title={p.label} />
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  const p = PRIORITY_STYLES[priority];
  if (!p) return null;
  const colors: Record<string, string> = {
    urgent: 'bg-red-500/15 text-red-400',
    high: 'bg-orange-500/15 text-orange-400',
    medium: 'bg-blue-500/15 text-blue-400',
    low: 'bg-gray-500/15 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colors[priority] || ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

// ─── Skeleton shimmer (no solo pulse — shimmer más elegante) ───

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-[var(--color-surface)] ${className}`}>
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}

export function SkeletonRow({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 ${className}`}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-2 w-3/4" />
    </div>
  );
}

// ─── Card reutilizable con borde + elevation sutil ───

export function Card({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`block w-full text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${
        onClick ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

// ─── Empty state ───

export function EmptyState({ icon, title, subtitle, action }: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 animate-fade-in">
      <span className="text-3xl opacity-50">{icon}</span>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      {subtitle && <p className="text-xs text-[var(--color-text-tertiary)] -mt-1">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-4 py-1.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-medium active:scale-95 transition cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Error state ───

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 animate-fade-in">
      <span className="text-3xl">⚠️</span>
      <p className="text-sm text-red-400 text-center max-w-[260px]">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-text-on-accent)] text-sm font-medium active:scale-95 transition cursor-pointer"
      >
        Reintentar
      </button>
    </div>
  );
}

// ─── Section header ───

export function SectionHeader({ icon, title, action }: {
  icon: string;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h2>
      {action && (
        <button
          onClick={action.onClick}
          className="text-[11px] text-[var(--color-primary)] active:scale-95 transition cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Pull-to-refresh hint (sutil) ───

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useState({ current: 0 })[0];

  useEffect(() => {
    let active = false;
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        active = true;
        startY.current = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 80 && !refreshing) setPulling(true);
    };
    const onTouchEnd = async () => {
      if (pulling && !refreshing) {
        setRefreshing(true);
        setPulling(false);
        try { await onRefresh(); } finally {
          setRefreshing(false);
        }
      }
      active = false;
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pulling, refreshing, onRefresh, startY]);

  return { pulling, refreshing };
}
