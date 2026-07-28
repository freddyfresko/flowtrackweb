import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { ToastProvider } from './components/Toast';

// Limpiar cache viejo del SW que podría tener datos stale de Supabase
if ('caches' in window) {
  caches.delete('supabase-cache').catch(() => {});
}

// Escuchar nuevo SW y recargar cuando esté listo
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
