import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        id: '/?source=pwa',
        name: 'FlowTrack — Centro de Control',
        short_name: 'FlowTrack',
        description: 'Tu centro de control personal en el bolsillo: agenda, tareas, finanzas, producción y más.',
        theme_color: '#8b5cf6',
        background_color: '#0d1117',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'es-CL',
        dir: 'ltr',
        categories: ['productivity', 'business', 'lifestyle'],
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Dashboard', url: '/?source=pwa', description: 'Resumen general', icons: [{ src: '/logo.png', sizes: '96x96' }] },
          { name: 'Agenda', url: '/agenda?source=pwa', description: 'Ver agenda', icons: [{ src: '/logo.png', sizes: '96x96' }] },
          { name: 'Nueva Idea', url: '/nueva-idea?source=pwa', description: 'Crear idea rápida', icons: [{ src: '/logo.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Google Fonts — cache first, long TTL
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static Google Fonts assets
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
});
