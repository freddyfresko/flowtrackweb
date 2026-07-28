# FlowTrack v0.5.4 — Documentación de la App Desktop (Tauri+React+Supabase)

> Generado el 2026-07-28 basado en el codebase actual en `E:\dev\WorkStation\flowtrack`

---

## 1. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | React 19 + TypeScript 6.0 |
| **Build** | Vite 8.1, @vitejs/plugin-react 6.0 |
| **Estilos** | Tailwind CSS v4.3 + CSS custom properties (theming) |
| **Routing** | react-router-dom 7.18 (usado solo para `/script-viewer`) |
| **Navegación** | Zustand store (`useNavStore`) — SPA con TabPanel keep-alive |
| **Estado Global** | Zustand v5 — `useDataStore` (datos precargados), `useThemeStore`, `useSystemSettings` |
| **Backend/DB** | Supabase JS v2.110 (PostgreSQL con Realtime) |
| **Desktop** | Tauri v2 (API + plugin-autostart, plugin-shell) |
| **Formularios** | react-hook-form 7.82 + zod 4.4 |
| **Gráficos** | recharts 3.10 |
| **Tablas** | @tanstack/react-table 8.21 |
| **Servicios** | Instagram Graph API (v22.0), YouTube Data API (v3), Facebook Insights |
| **Linter** | oxlint 1.71 |

---

## 2. Arquitectura General

### 2.1 Estructura de Directorios

```
src/
├── App.tsx                    # Entry point: splash + router + realtime
├── main.tsx                   # Mount point
├── index.css                  # Tailwind + temas CSS + animaciones
├── components/
│   ├── ui/index.tsx           # UI Kit: Button, Input, Select, Textarea, Card, Badge, Modal, TabPanel, StatCard, AnimatedItem
│   ├── layout/Sidebar.tsx     # Sidebar navegación + theme toggle
│   ├── layout/Topbar.tsx      # Topbar + búsqueda global
│   ├── ClockWidget.tsx        # Reloj dashboard
│   └── ErrorBoundary.tsx      # Error boundary con retry
├── lib/
│   ├── supabase.ts            # Cliente Supabase singleton
│   ├── date.ts                # Helpers de fecha (localDateKey, localMonthKey, etc.)
│   ├── scriptViewer.ts        # Script viewer popup/window
│   ├── types/index.ts         # Tipos TypeScript de todas las entidades
│   ├── utils/format.ts        # formatCurrency, formatNumber, formatDate, etc.
│   ├── hooks/useCrud.ts       # Hook genérico CRUD (modal + form state)
│   ├── services/              # APIs externas
│   │   ├── instagramApi.ts    # Instagram Graph API client
│   │   ├── instagramMock.ts   # Mock para desarrollo
│   │   ├── instagramProvider.ts # Provider pattern
│   │   ├── instagramSync.ts   # Sync service
│   │   ├── facebookInsights.ts # Facebook cross-post metrics
│   │   ├── youtubeApi.ts      # YouTube Data API client
│   │   ├── youtubeMock.ts     # Mock
│   │   ├── youtubeProvider.ts # Provider pattern
│   │   └── youtubeSync.ts     # Sync service
│   ├── stores/
│   │   ├── index.ts           # ThemeStore + NavStore
│   │   ├── dataStore.ts       # DataStore — carga todo al inicio, invalidación parcial
│   │   └── systemSettings.ts  # launchAtStartup + minimizeToTray
│   └── db/
│       ├── index.ts           # testConnection + saveDb (no-op para Supabase)
│       ├── tasks.ts           # CRUD Tareas + subtask counts
│       ├── reels.ts           # CRUD Reels + linked job sync
│       ├── youtube.ts         # CRUD YouTube videos
│       ├── projects.ts        # CRUD Proyectos + prompts + documentos + work sessions
│       ├── clients.ts         # CRUD Clientes + RPC get_clients_with_counts (con fallback)
│       ├── consultancies.ts   # CRUD Asesorías
│       ├── agenda.ts          # CRUD Agenda + reminders + calendar events projection
│       ├── calendar.ts        # Unified calendar events (9 queries paralelas) + global search + alerts
│       ├── finance.ts         # CRUD Income, Expenses, Quotes, Receivables + syncs automáticos
│       ├── music.ts           # CRUD Music Projects + Tracks + audio jobs backfill
│       ├── videoclips.ts      # CRUD Videoclips + sync desde jobs
│       ├── automaticTasks.ts  # Sistema de tareas automáticas por reglas de estado
│       ├── social.ts          # Social accounts, posts, metrics, links, sync logs
│       ├── reports.ts         # Reportes (productividad, contenido, proyectos, finanzas, tiempo)
│       ├── settings.ts        # Settings key-value
│       └── backup.ts          # Backup/export/import
├── hooks/
│   └── useTrayBehavior.ts     # Tauri tray behavior
├── types/
│   └── database.types.ts      # Supabase DB types auto-generados
└── pages/
    ├── index.tsx              # Page exports
    ├── DashboardPage.tsx       # Dashboard principal (3-column grid)
    ├── TasksPage.tsx           # Tareas (lista + kanban)
    ├── ContentPage.tsx         # Contenido (Reels + YouTube + Videoclips tabs)
    ├── ReelsPage.tsx           # CRUD Reels
    ├── YouTubePage.tsx         # CRUD YouTube
    ├── VideoclipsPage.tsx      # CRUD Videoclips
    ├── SocialPage.tsx          # Redes Sociales (Instagram + YouTube + analytics)
    ├── MusicProductionPage.tsx # Producción Musical (proyectos + tracks)
    ├── ConsultanciesPage.tsx   # Asesorías (pipeline + CRUD)
    ├── ClientsPage.tsx         # Clientes
    ├── ProjectsPage.tsx        # Proyectos (overview + documentos + prompts + sesiones)
    ├── FinancePage.tsx         # Finanzas (overview + income + expenses + receivables + quotes)
    ├── AgendaPage.tsx          # Agenda
    ├── CalendarPage.tsx        # Calendario (month/week/day view)
    ├── ReportsPage.tsx         # Reportes (5 tabs con gráficos recharts)
    ├── SettingsPage.tsx        # Configuración (temas, autostart, tray, backup, import/export, seed)
    └── ScriptViewerPage.tsx    # Viewer de guion en pantalla completa
```

### 2.2 Patrón de Carga de Datos

**Filosofía: CARGAR TODO ANTES DE ENTRAR — sin estados vacíos ni skeletons.**

1. App.tsx monta `MainApp`
2. `useEffect` llama `testConnection()` para verificar Supabase
3. Si OK, lanza `Promise.all([
     useDataStore.getState().initialize(),  # Carga TODOS los datos
     preloadAllPages(),                       # Precarga chunks lazy
   ])`
4. `initialize()` corre **11 loaders en paralelo** (dashboard, tasks, finance, clients, projects, agenda, reels, youtube, consultancies, music, videoclips)
5. Cada loader usa `safeGet()` que retorna fallback si falla (nunca bloquea)
6. **SplashScreen** muestra progreso (Conectando → Cargando datos → Listo)
7. Botón "Comenzar" se habilita cuando `ready=true`
8. **Después** de que el usuario entra, corren syncs en background (tareas automáticas, finance syncs, prune orphans)
9. **Supabase Realtime** escucha cambios en todas las tablas e invalida dominios específicos automáticamente

### 2.3 Patrón de UI

- **Keep-alive routing**: `TabPanel` mantiene todas las páginas montadas, ocultas con opacidad/transform. Cambio de tab = cross-fade.
- **CSS Theme System**: 3 temas (dark, neutral, light) vía CSS custom properties + clase en `<html>`.
- **Animaciones**: `animate-page-enter` en cada página, `animate-stagger` para grids de cards, `AnimatedItem` para items con enter/exit.
- **Modal**: `createPortal(document.body)` con fade-in/fade-out.
- **Colores por tipo**: Cards con `border-l-{color}` (rojo para peligro, verde para éxito, etc.)

---

## 3. Módulos / Features

### 3.1 Dashboard (DashboardPage)
- 4 big stats cards (ingresos, tareas, producción, cuentas x cobrar)
- 3-column grid: Tareas (barras + tareas de hoy), Agenda (próximos/semana/vencidos), Acción rápida
- 3-column row: Reels, YouTube, Producción Musical (barras + totales)
- 3-column row: Videoclips, Redes Sociales (métricas IG+YT), Proyectos (stats + sesiones)
- 3-column row: Finanzas, Asesorías
- Right sidebar: Calendar widget mes actual (semana empieza Lunes)
- Alerts bar: tareas vencidas, pagos vencidos, proyectos estancados, reels/asesorías de hoy
- Refresh button con spinner mínimo 600ms

### 3.2 Tareas (TasksPage)
- Vista Kanban (pendiente, en proceso, bloqueada, en prueba, terminada, descartada)
- Vista Lista con subtareas expandibles
- Filtros: status, prioridad, área, vencidas
- Auto-invalidation via dataStore
- Subtasks con batch count query
- Stats: pendientes, en proceso, vencidas, completadas del mes

### 3.3 Contenido (ContentPage)
- 3 subtabs keep-alive: Reels, Videoclips, YouTube
- **Reels**: Pipeline (idea → script → ready_to_record → recorded → editing → reviewing → scheduled → published)
- **YouTube**: Pipeline similar + miniatura + investigación
- **Videoclips**: Pipeline filmmaker con fechas de preproducción, rodaje, primera entrega, cambios, entrega final
- Todos con CRUD completo + sync de linked jobs

### 3.4 Redes Sociales (SocialPage)
- Conexión Instagram (Graph API) y YouTube (Data API v3)
- Auto-sync de publicaciones al abrir la app
- Vinculación manual/automática de posts con reels y videos locales
- Métricas: alcance, impresiones, likes, comments, saves, shares, plays
- Facebook cross-post metrics (cuando el reel se cruza a FB)
- Combined metrics dashboard
- Historial de syncs

### 3.5 Producción Musical (MusicProductionPage)
- Proyectos musicales (personal o client_job)
- Pipeline: idea → preproducción → grabando → editando → mezcla → mastering → revisión → entregado
- Tracks por proyecto (CRUD individual)
- Stats: total, personales, trabajos, activos, mezcla, master, revisión, entregados
- Backfill automático desde audio_jobs

### 3.6 Asesorías (ConsultanciesPage)
- Pipeline: solicitada → agendada → confirmada → realizada → en seguimiento → cerrada
- CRUD con notas pre/diagnóstico/acuerdos/next steps/follow-up
- Payment status + amount
- Auto-sync a finanzas (income + receivables automáticos)
- Tareas automáticas por estado

### 3.7 Clientes (ClientsPage)
- CRUD completo con status (prospecto, activo, frecuente, inactivo, archivado)
- Job count, consultancy count, total debt (via RPC o fallback JS)
- Seed data + demo

### 3.8 Proyectos (ProjectsPage)
- CRUD con pipeline (idea → research → planning → development → testing → launched → maintenance)
- Sub-tabs: Overview, Documentos, Prompts, Sesiones de trabajo
- Progress % + last activity + days inactive
- Tech stack, local folder, repo, url

### 3.9 Finanzas (FinancePage)
- 5 subtabs: Resumen, Ingresos, Gastos, Cuentas x Cobrar, Cotizaciones
- Resumen con barras por categoría (ingresos/gastos)
- Stats: ingreso mes, gasto mes, resultado, pendientes, vencidos, cotizaciones pendientes, deuda total
- CRUD completo en cada subtab
- Auto-sync desde asesorías (income + receivables automáticos)
- Prune de registros huérfanos

### 3.10 Agenda (AgendaPage)
- CRUD con tipos (meeting, call, recording, music_production, consultancy, delivery, event, reminder, other)
- Reminders por item
- Filtros: status, priority, type, source_module, client, search, date range, overdue
- Calendar projection

### 3.11 Calendario (CalendarPage)
- 9 queries paralelas: tasks, reels, youtube, videoclips, music, consultancies, receivables, agenda, projects
- Vistas: month, week, day
- Filtros por módulo (source module)
- Semester/year navigation
- Colores por tipo de evento

### 3.12 Reportes (ReportsPage)
- 5 tabs con gráficos recharts:
  - **Productividad**: tareas completadas, vencidas vs mes
  - **Contenido**: reels/videos publicados, producción
  - **Proyectos**: proyectos por estado, prompts
  - **Finanzas**: ingresos/gastos mensuales, categorías
  - **Tiempo**: work sessions por proyecto

### 3.13 Tareas Automáticas (automaticTasks.ts)
Sistema basado en reglas que genera automáticamente la **siguiente acción** para cada entidad según su estado actual:

- **Reels**: 8 reglas (idea→script, script→preparar grabación, etc.)
- **YouTube**: 10 reglas (idea→research, research→script, etc.)
- **Proyectos**: 8 reglas (idea→objetivo, research→cerrar, etc.)
- **Asesorías**: 4 reglas (requested→agendar, scheduled→preparar, etc.)
- **Clientes**: 2 reglas (prospect→follow up, inactive→reactivar)
- **Cuentas x Cobrar**: 3 reglas (pending→cobrar, partial→saldo, overdue→vencido)
- **Agenda**: 3 reglas (pending→preparar, confirmed→ejecutar, in_progress→finalizar)
- **Videoclips**: 7 reglas (idea→guion, concept→preproducción, etc.)

**Filosofía**: 1 tarea por entidad = siguiente paso. Las tareas se actualizan (no duplican) cuando el estado avanza. Si la entidad está terminada, se archivan las tareas viejas.

### 3.14 Settings (SettingsPage)
- Temas: Oscuro, Gris oscuro, Claro
- Launch at startup (Tauri plugin)
- Minimize to tray (Tauri)
- Backup/Restore: export JSON, import JSON
- Clear all data (con confirmación)
- Seed demo data

---

## 4. Base de Datos (Supabase)

### 4.1 Tablas Principales

| Tabla | Propósito |
|-------|-----------|
| `tasks` | Tareas (manuales + automáticas) |
| `reels` | Reels de Instagram/TikTok |
| `youtube_videos` | Videos de YouTube |
| `clients` | Clientes |
| `digital_projects` | Proyectos digitales |
| `consultancies` | Asesorías |
| `agenda_items` | Items de agenda |
| `agenda_reminders` | Recordatorios de agenda |
| `income` | Ingresos |
| `expenses` | Gastos |
| `quotes` | Cotizaciones |
| `receivables` | Cuentas por cobrar |
| `jobs` | Trabajos (módulo deprecated) |
| `music_projects` | Proyectos musicales |
| `music_tracks` | Pistas de proyectos musicales |
| `filmmaker_videoclips` | Videoclips filmmaker |
| `social_accounts` | Cuentas sociales conectadas |
| `social_media_posts` | Posts de redes sociales |
| `reel_social_links` | Vinculación reel ↔ post |
| `youtube_social_links` | Vinculación youtube ↔ post |
| `social_media_metric_snapshots` | Snapshots de métricas |
| `social_account_snapshots` | Snapshots de cuenta |
| `social_sync_logs` | Logs de sync |
| `work_sessions` | Sesiones de trabajo |
| `prompts` | Prompts de IA por proyecto |
| `documents` | Documentos por proyecto |
| `settings` | Settings key-value |
| `backups` | Historial de backups |

### 4.2 Convenciones
- `id`: UUID v4 generado en cliente (`crypto.randomUUID()`)
- `created_at`, `updated_at`: timestamps en formato ISO SQL (`YYYY-MM-DD HH:mm:ss`)
- `is_archived`: soft-delete booleano (no se elimina, se archiva)
- Soft-delete en: tasks, reels, youtube_videos, clients, digital_projects, consultancies, agenda_items, music_projects, quotes
- Hard-delete en: income, expenses, receivables (finanzas)
- Joins con `!left` para LEFT JOINs que no fallen si la FK no existe
- RPC: `get_clients_with_counts(p_search, p_status)` con fallback JS

---

## 5. Servicios Externos

### 5.1 Instagram Graph API
- Provider pattern: `instagramProvider.ts` → elige entre `instagramApi.ts` (real) o `instagramMock.ts` (mock)
- Endpoints: account info, media list, media insights (reach, impressions, likes, comments, saves, shares, plays)
- Token management via `social_accounts`
- Sync: `instagramSync.ts` con modo manual/auto/on_open

### 5.2 YouTube Data API v3
- Mismo provider pattern
- Endpoints: channel info, video list, video statistics (views, likes, comments)
- Sync: `youtubeSync.ts`

### 5.3 Facebook Insights
- Cross-post metrics vía `/{facebook_post_id}/video_insights`
- Se añade a las métricas de Instagram cuando el reel se cruzó a Facebook

---

## 6. Store/Datos Globales

### useDataStore (dataStore.ts)
- `dashboard: DashboardData` — todos los datos precargados
- `financeOverview: FinanceOverview` — resumen financiero con stats + categorías
- `initialize()` — carga todo al inicio
- `refreshAll()` — recarga todo
- `invalidate(...keys)` — recarga dominios específicos (ej: `invalidate('tasks', 'finance')`)
- Safe wrappers: cada domain loader usa `safeGet()` que retorna fallback
- Syncs en background sin bloquear entrada

### useThemeStore
- Temas: dark, neutral, light, system
- Persistencia en localStorage (`flowtrack-theme`)
- Clases CSS: `theme-dark`, `theme-neutral`, `theme-light`
- Dark mode class: `dark` para Tailwind

### useNavStore
- Navegación por ID (dashboard, social, content, music, consultancies, clients, projects, agenda, tasks, calendar, finance, reports, settings)
- Separadores entre grupos
- Sidebar colapsable

### useSystemSettings
- `launchAtStartup`: vía Tauri plugin-autostart
- `minimizeToTray`: localStorage + Tauri window.hide()
- Loaded flag para evitar race conditions

---

## 7. UX/UI Detalles

- **Dashboard**: 3-column grid responsive, cards full-click navegan a la página
- **Semana empieza Lunes** (chilensis)
- **Tabs con cross-fade**: `opacity + translateY + scale` transition 300ms
- **Inline status dropdown**: cambia estado y hace silent reload + invalidate
- **Modal con Portal**: `createPortal(document.body)` para evitar problemas con containing blocks
- **Animaciones**: page-enter, stagger, pop-in, slide-in-right, fade-in/out
- **ErrorBoundary**: atrapa errores de React y ofrece reintentar
- **Sin console errors** de Supabase FK-less JOINs
- **Fuente**: Inter de Google Fonts
- **Scrollbar**: personalizada (6px, colores del tema)
- **Focus ring**: outline primary en inputs/selects/buttons

---

## 8. Tauri-specific

- `useTrayBehavior`: minimize-to-tray usando `@tauri-apps/api/window`
- `@tauri-apps/plugin-autostart`: launch at startup
- `systemSettings` maneja try/catch por si no está en Tauri (dev web)
- `scriptViewer.ts` usa `WebviewWindow` para abrir ventana externa de guion
- Sidebar version badge: v0.3.0

---

## 9. Dependencias Node (package.json v0.5.4)

```json
{
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "@supabase/supabase-js": "^2.110.8",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-table": "^8.21.3",
    "@tauri-apps/api": "^2.11.1",
    "@tauri-apps/plugin-autostart": "^2.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-hook-form": "^7.82.0",
    "react-router-dom": "^7.18.1",
    "recharts": "^3.10.0",
    "tailwindcss": "^4.3.3",
    "zod": "^4.4.3",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.4",
    "vite": "^8.1.1",
    "typescript": "~6.0.2",
    "oxlint": "^1.71.0"
  }
}
```

---

## 10. Scripts

- `npm run dev` — Vite dev server (port 1420)
- `npm run build` — tsc -b && vite build
- `npm run lint` — oxlint
- `npm run tauri` — Tauri CLI

---

## 11. Archivos de Configuración

- `vite.config.ts`: react + tailwindcss + visualizer plugins, port 1420
- `tsconfig.json`: references `tsconfig.app.json` + `tsconfig.node.json`
- Tauri conf: `src-tauri/` (no documentado aquí)
