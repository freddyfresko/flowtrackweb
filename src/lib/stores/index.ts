import { create } from 'zustand';

type Theme = 'dark' | 'neutral' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'neutral' | 'light';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  init: () => void;
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'neutral' || value === 'light' || value === 'system';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-dark', 'theme-neutral', 'theme-light');
  root.classList.add(`theme-${resolved}`);
  if (resolved === 'dark' || resolved === 'neutral') root.classList.add('dark');
}

export const THEME_OPTIONS: Array<{ value: Exclude<Theme, 'system'>; label: string; shortLabel: string; icon: string }> = [
  { value: 'dark', label: 'Oscuro', shortLabel: 'Oscuro', icon: '🌙' },
  { value: 'neutral', label: 'Gris oscuro', shortLabel: 'Neutro', icon: '☁️' },
  { value: 'light', label: 'Claro', shortLabel: 'Claro', icon: '☀️' },
];

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  setTheme: (theme: Theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
    localStorage.setItem('flowtrack-theme', theme);
  },

  init: () => {
    const savedRaw = localStorage.getItem('flowtrack-theme');
    const saved = isTheme(savedRaw) ? savedRaw : 'dark';
    const resolved = resolveTheme(saved);
    applyTheme(resolved);
    set({ theme: saved, resolvedTheme: resolved });
  },
}));

// Navigation store
type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: number;
  isSeparator?: boolean;
};

const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: '📊' },
  { id: 'sep-1', label: '', path: '', icon: '', isSeparator: true },
  { id: 'social', label: 'Redes Sociales', path: '/social', icon: '📱' },
  { id: 'content', label: 'Contenido', path: '/content', icon: '🎬' },
  { id: 'music', label: 'Producción Musical', path: '/music', icon: '🎧' },
  { id: 'consultancies', label: 'Asesorías', path: '/consultancies', icon: '🎓' },
  { id: 'sep-2', label: '', path: '', icon: '', isSeparator: true },
  { id: 'clients', label: 'Clientes', path: '/clients', icon: '👥' },
  { id: 'jobs', label: 'Trabajos', path: '/jobs', icon: '💼' },
  { id: 'projects', label: 'Proyectos', path: '/projects', icon: '🛠️' },
  { id: 'sep-3', label: '', path: '', icon: '', isSeparator: true },
  { id: 'agenda', label: 'Agenda', path: '/agenda', icon: '🗒️' },
  { id: 'tasks', label: 'Tareas', path: '/tasks', icon: '✅' },
  { id: 'calendar', label: 'Calendario', path: '/calendar', icon: '📅' },
  { id: 'sep-4', label: '', path: '', icon: '', isSeparator: true },
  { id: 'finance', label: 'Finanzas', path: '/finance', icon: '💰' },
  { id: 'reports', label: 'Reportes', path: '/reports', icon: '📈' },
  { id: 'sep-5', label: '', path: '', icon: '', isSeparator: true },
  { id: 'settings', label: 'Configuración', path: '/settings', icon: '⚙️' },
];

interface NavState {
  items: NavigationItem[];
  activeItem: string;
  setActive: (id: string) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  items: navigationItems,
  activeItem: 'dashboard',
  setActive: (id: string) => set({ activeItem: id }),
  collapsed: false,
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
}));
