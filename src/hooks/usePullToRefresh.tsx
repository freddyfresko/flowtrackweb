// Pull-to-refresh hook real — detecta pull cuando el scroll está arriba
// Integración: observar window.scrollY en touchstart/touchmove/touchend.
// Visual: el consumidor renderiza un indicator con la distancia/porcentaje.

import { useEffect, useRef, useState, useCallback } from 'react';

const THRESHOLD = 70;   // distancia mínima para disparar refresh
const RESISTANCE = 2.5; // resistencia del pull (más resistencia = se siente más natural)
const MAX_PULL = 110;   // cap visual del indicator

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const shouldRefresh = useRef(false);

  useEffect(() => {
    const el = window;
    let active = false;

    const canPull = () => {
      // Solo se puede hacer pull cuando el scroll está arriba del todo
      const main = document.querySelector('main');
      if (!main) return window.scrollY <= 0;
      return main.scrollTop <= 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!canPull()) { active = false; return; }
      startY.current = e.touches[0].clientY;
      active = true;
      pulling.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      pulling.current = true;
      // Resistencia — los primeros px ceden fácil, después cuesta más
      const effective = Math.min(MAX_PULL, delta / RESISTANCE);
      setPullDistance(effective);
      shouldRefresh.current = effective >= THRESHOLD;
      // Prevenir scroll nativo para evitar bounce feo
      if (delta > 10) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!active || !pulling.current || refreshing) {
        active = false;
        setPullDistance(0);
        return;
      }
      if (shouldRefresh.current && !refreshing) {
        setRefreshing(true);
        setPullDistance(MAX_PULL);
        // Haptic feedback nativo si está disponible
        if ('vibrate' in navigator) {
          try { navigator.vibrate(15); } catch {}
        }
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Snap back animado
        setPullDistance(0);
      }
      active = false;
      pulling.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshing, onRefresh]);

  const pct = Math.min(100, (pullDistance / THRESHOLD) * 100);
  const ready = pullDistance >= THRESHOLD;

  return { pullDistance, refreshing, pct, ready };
}

// Indicator visual — usa el hook y renderiza el UI
export function PullToRefreshIndicator({ pullDistance, refreshing, pct, ready }: {
  pullDistance: number;
  refreshing: boolean;
  pct: number;
  ready: boolean;
}) {
  if (pullDistance === 0 && !refreshing) return null;
  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-20"
      style={{
        transform: `translateY(${Math.max(0, pullDistance - 6)}px)`,
        transition: refreshing ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${
          refreshing ? 'bg-[var(--color-primary)] text-white animate-spin' :
          ready ? 'bg-[var(--color-primary)] text-white' :
          'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
        }`}
        style={{ opacity: pullDistance > 0 ? 1 : 0 }}
      >
        {refreshing ? '🔄' : ready ? '↓' : '↓'}
      </div>
    </div>
  );
}
