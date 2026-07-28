import { useState } from 'react';

interface Slide {
  icon: string;
  title: string;
  desc: string;
  gradient: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: '📊',
    title: 'Todo en un bolsillo',
    desc: 'Dashboard, agenda, tareas, finanzas, producción y redes — un solo lugar, siempre contigo.',
    gradient: 'from-violet-500/20 to-purple-500/10',
    accent: 'text-violet-400',
  },
  {
    icon: '💡',
    title: 'Captura ideas rápido',
    desc: 'Botón + flotante crea reels, videos, tareas, eventos o proyectos en segundos. No dejes escapar nada.',
    gradient: 'from-pink-500/20 to-rose-500/10',
    accent: 'text-pink-400',
  },
  {
    icon: '📅',
    title: 'Calendario unificado',
    desc: 'Todos tus compromisos en una vista: grabaciones, pagos, entregas, asesorías y más, con colores.',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    accent: 'text-emerald-400',
  },
];

const STORAGE_KEY = 'flowtrack-web-onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setOnboarded() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const next = () => {
    if (isLast) {
      setOnboarded();
      onDone();
    } else {
      setIdx(idx + 1);
    }
  };

  const skip = () => {
    setOnboarded();
    onDone();
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col no-select relative overflow-hidden">
      {/* Decoro de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-32 -right-32 w-72 h-72 rounded-full bg-gradient-to-br ${slide.gradient} blur-3xl transition-all duration-700`} />
        <div className={`absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-gradient-to-br ${slide.gradient} blur-3xl transition-all duration-700`} />
      </div>

      {/* Botón skip */}
      <div className="relative z-10 flex items-center justify-end p-4">
        <button
          onClick={skip}
          className="text-xs text-[var(--color-text-tertiary)] px-3 py-1.5 rounded-full hover:bg-[var(--color-surface-hover)] active:scale-95 transition cursor-pointer"
        >
          Saltar
        </button>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Icono grande con glow */}
        <div
          key={idx}
          className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-elevated)] flex items-center justify-center text-5xl shadow-2xl shadow-black/30 animate-scale-pop mb-8"
        >
          {slide.icon}
        </div>

        {/* Texto */}
        <div key={`text-${idx}`} className="space-y-3 animate-xfade max-w-sm">
          <h1 className={`text-2xl font-extrabold tracking-tight ${slide.accent}`}>
            {slide.title}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {slide.desc}
          </p>
        </div>
      </div>

      {/* Footer — dots + CTA */}
      <div className="relative z-10 px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] space-y-5">
        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                i === idx
                  ? 'w-6 bg-[var(--color-primary)]'
                  : 'w-1.5 bg-[var(--color-border-strong)]'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={next}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-on-accent)] font-semibold text-sm shadow-lg shadow-[rgb(var(--color-primary-rgb)/0.3)] active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
        >
          {isLast ? (
            <>
              Comenzar <span className="text-base">→</span>
            </>
          ) : (
            <>
              Siguiente <span className="text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
