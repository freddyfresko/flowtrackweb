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
  { to: '/calendario', label: 'Calendario', icon: '📅' },
  { to: '/tareas', label: 'Tareas', icon: '✅' },
  { to: '/buscar', label: 'Buscar', icon: '🔍' },
];

// Altura de la bottom nav (en rem).
const NAV_HEIGHT_REM = 3.5;

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
  const showChrome = !isCreatePage && !isDetail;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[var(--color-bg)] no-select">
      {/* Top bar fijo — blureado como iOS */}
      <header
        className="fixed top-0 left-0 right-0 z-30 h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)] backdrop-blur-xl bg-[var(--color-surface)]/85"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link to="/" className="flex items-center gap-2 active:scale-95 transition">
          <img src="/logo.png" alt="FT" className="w-6 h-6 rounded-md object-cover" />
          <span className="text-sm font-bold text-[var(--color-primary)] tracking-tight">FlowTrack</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="text-base text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] px-2 py-1 rounded-lg active:scale-90 transition cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* Spacer para header fijo */}
      <div
        className="flex-shrink-0"
        style={{ height: 'calc(3rem + env(safe-area-inset-top))' }}
      />

      {/* Contenido scrolleable — cross-fade entre rutas */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          paddingBottom: showChrome ? `calc(${NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 0.5rem)` : '0',
        }}
      >
        <div key={location.pathname} className="animate-xfade">
          <Outlet />
        </div>
      </main>

      {/* FAB "+" con scale-pop — sobre la nav */}
      {showChrome && (
        <button
          onClick={onNewIdea}
          aria-label="Nueva idea"
          className="fixed right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-on-accent)] text-2xl font-light shadow-lg shadow-[rgb(var(--color-primary-rgb)/0.4)] active:scale-90 transition-transform flex items-center justify-center cursor-pointer animate-scale-pop no-select"
          style={{
            bottom: `calc(${NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1rem)`,
          }}
        >
          <span className="leading-none">+</span>
        </button>
      )}

      {/* Bottom tab bar fija — blureada como iOS */}
      {showChrome && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--color-border)] backdrop-blur-xl bg-[var(--color-surface)]/85"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex" style={{ height: `${NAV_HEIGHT_REM}rem` }}>
            {TABS.map((tab) => {
              const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative active:bg-[var(--color-surface-hover)]/50 transition-colors"
                >
                  {/* Pill background */}
                  <span className={`absolute top-1.5 left-1/2 -translate-x-1/2 h-7 rounded-full transition-all duration-300 ${
                    active ? 'bg-[var(--color-primary)]/15 w-10' : 'w-0'
                  }`} />
                  {/* Indicador bar arriba del pill */}
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full bg-[var(--color-primary)]"
                      style={{ width: '1.5rem' }}
                    />
                  )}
                  <span className={`relative text-xl transition-transform duration-200 ${active ? 'scale-110' : 'scale-100'} ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                    {tab.icon}
                  </span>
                  <span className={`relative text-[10px] transition-all ${active ? 'font-semibold text-[var(--color-primary)]' : 'font-medium text-[var(--color-text-tertiary)]'}`}>
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
