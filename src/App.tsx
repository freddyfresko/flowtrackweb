import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useThemeStore } from './lib/stores';
import { useSystemSettings } from './lib/stores/systemSettings';
import { useDataStore } from './lib/stores/dataStore';
import { initRuntimeConfig } from './lib/supabase';
import { testConnection } from './lib/db';
import { MobileLayout } from './components/MobileLayout';
import { SplashScreen } from './components/SplashScreen';

// Lazy pages
import { DashboardPage } from './pages/DashboardPage';
import { AgendaPage } from './pages/AgendaPage';
import { TasksPage } from './pages/TasksPage';
import { NewIdeaPage } from './pages/NewIdeaPage';
import { SearchPage } from './pages/SearchPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { JobDetailPage } from './pages/JobDetailPage';

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
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="tareas" element={<TasksPage />} />
        <Route path="nueva-idea" element={<NewIdeaPage />} />
        <Route path="buscar" element={<SearchPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="trabajos/:id" element={<JobDetailPage />} />
      </Route>
    </Routes>
  );
}
