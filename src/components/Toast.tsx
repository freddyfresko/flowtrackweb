// Toast/snackbar system — feedback premium para acciones
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastCtx {
  toast: (msg: string, opts?: { type?: ToastType; duration?: number; action?: { label: string; onClick: () => void } }) => void;
  success: (msg: string, action?: { label: string; onClick: () => void }) => void;
  error: (msg: string, action?: { label: string; onClick: () => void }) => void;
  info: (msg: string, action?: { label: string; onClick: () => void }) => void;
}

const Ctx = createContext<ToastCtx>(null as any);

const STYLE_MAP: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'bg-green-500/15',    border: 'border-green-500/30',    text: 'text-green-400',    icon: '✓' },
  error:   { bg: 'bg-red-500/15',      border: 'border-red-500/30',      text: 'text-red-400',      icon: '✕' },
  info:    { bg: 'bg-blue-500/15',     border: 'border-blue-500/30',     text: 'text-blue-400',     icon: 'ℹ' },
  warning: { bg: 'bg-yellow-500/15',   border: 'border-yellow-500/30',   text: 'text-yellow-400',   icon: '⚠' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastCtx['toast']>((msg, opts) => {
    const id = nextId++;
    const t: Toast = {
      id,
      message: msg,
      type: opts?.type || 'info',
      duration: opts?.duration || 3000,
      action: opts?.action,
    };
    setToasts((prev) => [...prev, t]);
    setTimeout(() => remove(id), t.duration);
  }, [remove]);

  const success = useCallback((msg: string, action?: { label: string; onClick: () => void }) =>
    toast(msg, { type: 'success', action }), [toast]);
  const error = useCallback((msg: string, action?: { label: string; onClick: () => void }) =>
    toast(msg, { type: 'error', duration: 5000, action }), [toast]);
  const info = useCallback((msg: string, action?: { label: string; onClick: () => void }) =>
    toast(msg, { type: 'info', action }), [toast]);

  return (
    <Ctx.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Container — fixed top, blureado, stack vertical */}
      <div className="fixed top-14 left-0 right-0 z-50 flex flex-col items-center gap-1.5 px-3 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {toasts.map((t) => {
          const s = STYLE_MAP[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${s.bg} ${s.border} backdrop-blur-xl bg-[var(--color-surface)]/90 max-w-[92%] w-fit shadow-lg animate-toast-in`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${s.bg} ${s.text} flex-shrink-0`}>
                {s.icon}
              </span>
              <span className="text-xs text-[var(--color-text)] font-medium whitespace-normal break-words">
                {t.message}
              </span>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); remove(t.id); }}
                  className={`text-xs font-semibold ${s.text} px-2 py-0.5 rounded-md active:scale-95 transition cursor-pointer flex-shrink-0`}
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => remove(t.id)}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] px-1 active:scale-90 transition cursor-pointer flex-shrink-0"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
