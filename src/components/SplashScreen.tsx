import { useState, useEffect } from 'react';

interface Props {
  dbStatus: string;
  dbError: string;
  ready: boolean;
  onEnter: () => void;
}

export function SplashScreen({ dbStatus, dbError, ready, onEnter }: Props) {
  const [stage, setStage] = useState<'fadeIn' | 'logo' | 'text' | 'ready'>('fadeIn');

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage('logo'), 100));
    timers.push(window.setTimeout(() => setStage('text'), 600));
    timers.push(window.setTimeout(() => setStage('ready'), 1100));
    return () => timers.forEach(clearTimeout);
  }, []);

  const progress =
    dbStatus === 'error' ? 0 :
    dbStatus === 'ok' ? 100 :
    stage === 'text' ? 60 :
    stage === 'ready' ? 85 :
    25;

  return (
    <div
      className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col items-center justify-center relative overflow-hidden no-select"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Decoro de fondo — gradientes radiales animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-[rgb(var(--color-primary-rgb)/0.18)] blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-[rgb(var(--color-primary-rgb)/0.12)] blur-3xl animate-pulse-slow" style={{ animationDelay: '0.8s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-[rgb(var(--color-primary-rgb)/0.06)] blur-3xl" />
      </div>

      <div className={`relative z-10 flex flex-col items-center gap-7 px-6 transition-all duration-700 ease-out ${
        stage !== 'fadeIn' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        {/* Logo con glow + scale-pop */}
        <div className={`transition-all duration-500 ${stage === 'fadeIn' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-[rgb(var(--color-primary-rgb)/0.35)] animate-glow">
            <img src="/logo.png" alt="FlowTrack" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Texto — entra después del logo */}
        <div className={`text-center space-y-1.5 transition-all duration-500 ${
          stage === 'text' || stage === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
            Hola <span className="text-[var(--color-primary)]">Freddy</span>
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] font-medium">FlowTrack Móvil</p>
          <p className="text-xs text-[var(--color-text-tertiary)] max-w-xs mx-auto">
            Tu centro de control, ahora en el bolsillo.
          </p>
        </div>

        {/* Estado de conexión */}
        <div className={`h-6 flex items-center justify-center transition-all duration-300 ${
          stage === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}>
          {dbStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] animate-fade-in">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-ping" />
              <span>Conectando...</span>
            </div>
          )}
          {dbStatus === 'ok' && (
            <div className="flex items-center gap-2 text-xs text-green-500 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>Listo</span>
            </div>
          )}
          {dbStatus === 'error' && (
            <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center max-w-[280px] animate-fade-in">
              ⚠️ {dbError || 'Error de conexión'}
            </div>
          )}
        </div>

        {/* Barra de progreso — ingeniada con gradient */}
        <div className="w-44 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Botón entrar */}
        <button
          onClick={onEnter}
          disabled={!ready}
          className={`px-8 py-3 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-on-accent)] font-semibold text-sm shadow-lg shadow-[rgb(var(--color-primary-rgb)/0.25)] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:scale-95 cursor-pointer animate-scale-pop ${
            ready ? 'animate-glow' : ''
          }`}
        >
          <span className="flex items-center gap-2">
            Comenzar <span>→</span>
          </span>
        </button>
      </div>

      <p className="absolute bottom-4 text-[10px] text-[var(--color-text-disabled)] tracking-wider">
        Infinity Force Company
      </p>
    </div>
  );
}
