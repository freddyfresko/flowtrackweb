import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useThemeStore } from './lib/stores';
import { useSystemSettings } from './lib/stores/systemSettings';
import { useDataStore } from './lib/stores/dataStore';
import { initRuntimeConfig } from './lib/supabase';
import { testConnection } from './lib/db';
import { MobileLayout } from './components/MobileLayout';
import { SplashScreen } from './components/SplashScreen';

// Eager — Dashboard is the first thing users see, keep it in main bundle
import { DashboardPage } from './pages/DashboardPage';

// Lazy — loaded on demand to split chunks
const AgendaPage = lazy(() => import('./pages/AgendaPage').then(m => ({ default: m.AgendaPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const NewIdeaPage = lazy(() => import('./pages/NewIdeaPage').then(m => ({ default: m.NewIdeaPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage').then(m => ({ default: m.JobDetailPage })));

// Page loader — skeleton-style with stagger
function PageLoader() {
  return (
    <div className="p-3 space-y-2">
      <div className="h-10 rounded-xl bg-[var(--color-surface)] overflow-hidden relative">
        <div className="absolute inset-0 skeleton-shimmer" />
      </div>
      <div className="h-20 rounded-2xl bg-[var(--color-surface)] overflow-hidden relative">
        <div className="absolute inset-0 skeleton-shimmer" />
      </div>
      <div className="h-20 rounded-2xl bg-[var(--color-surface)] overflow-hidden relative">
        <div className="absolute inset-0 skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function App() {
  const initTheme = useThemeStore((s) => s.init);
  const initSystemSettings = useSystemSettings((s) => s.init);
  const initDashboard = useDataStore((s) => s.initialiseDashboard);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [dbError, setDbError] = useState('');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initTheme();
    initSystemSettings();
    // En producción, primero carga la config desde el server
    initRuntimeConfig()
      .then(() => testConnection())
      .then(() => {
        setDbStatus('ok');
        // Carga dashboard en paralelo con splash
        initDashboard().catch(() => {});
      })
      .catch((e) => {
        setDbStatus('error');
        setDbError(String(e?.message || e));
      });
  }, [initTheme, initSystemSettings, initDashboard]);

  const ready = dbStatus === 'ok';

  return (
    <Routes>
      <Route
        path="/"
        element={
          showSplash ? (
            <SplashScreen
              dbStatus={dbStatus}
              dbError={dbError}
              ready={ready}
              onEnter={() => setShowSplash(false)}
            />
          ) : (
            <MobileLayout />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<Suspense fallback={<PageLoader />}><AgendaPage /></Suspense>} />
        <Route path="calendario" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
        <Route path="tareas" element={<Suspense fallback={<PageLoader />}><TasksPage /></Suspense>} />
        <Route path="nueva-idea" element={<Suspense fallback={<PageLoader />}><NewIdeaPage /></Suspense>} />
        <Route path="buscar" element={<Suspense fallback={<PageLoader />}><SearchPage /></Suspense>} />
        <Route path="clientes/:id" element={<Suspense fallback={<PageLoader />}><ClientDetailPage /></Suspense>} />
        <Route path="trabajos/:id" element={<Suspense fallback={<PageLoader />}><JobDetailPage /></Suspense>} />
      </Route>
    </Routes>
  );
}
