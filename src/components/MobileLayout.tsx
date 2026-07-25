import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useThemeStore } from '../lib/stores';

interface TabItem {
  to: string;
  label: string;
  icon: string;
}

const TABS: TabItem[] = [
  { to: '/', label: 'Inicio', icon: '📊' },
  { to: '/agenda', label: 'Agenda', icon: '🗓️' },
  { to: '/tareas', label: 'Tareas', icon: '✅' },
  { to: '/buscar', label: 'Buscar', icon: '🔍' },
];

export function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const onNewIdea = () => navigate('/nueva-idea');

  // Oculta el FAB si ya estamos en la página de crear idea
  const isCreatePage = location.pathname === '/nueva-idea';
  // Oculta tab bar y FAB si estamos en un detalle (path con id)
  const segments = location.pathname.split('/').filter(Boolean);
  const isDetail = segments.length >= 2 && ['clientes', 'trabajos'].includes(segments[0]);

  return (
    <div
      className="flex flex-col min-h-[100dvh] bg-[var(--color-bg)] no-select"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Top bar compacto con logo + tema */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="FT" className="w-6 h-6 rounded-md object-cover" />
          <span className="text-sm font-bold text-[var(--color-primary)]">FlowTrack</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] px-2 py-1 rounded-lg active:scale-90 transition cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* Contenido scrolleable */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-in">
        <Outlet />
      </main>

      {/* FAB "+" — crear idea/tarea/agenda rápida */}
      {!isCreatePage && !isDetail && (
        <button
          onClick={onNewIdea}
          aria-label="Nueva idea"
          className="absolute right-4 bottom-20 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-on-accent)] text-2xl font-light shadow-lg shadow-[rgb(var(--color-primary-rgb)/0.35)] active:scale-90 transition-transform flex items-center justify-center cursor-pointer z-30 no-select"
        >
          +
        </button>
      )}

      {/* Bottom tab bar */}
      {!isDetail && (
        <nav className="flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] z-20">
          <div className="flex">
            {TABS.map((tab) => {
              const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                    active
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-tertiary)]'
                  }`}
                >
                  <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>
                    {tab.icon}
                  </span>
                  <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
