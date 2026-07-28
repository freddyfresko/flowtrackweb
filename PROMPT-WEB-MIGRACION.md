# PROMPT: Migrar FlowTrack Desktop → Web (Next.js App Router)

> Basado en FlowTrack v0.5.4 (Tauri + React + Vite + Supabase)
> Prompt para que un agente de IA construya la versión web

---

## 🎯 Objetivo

Crear una versión **web** de FlowTrack usando **Next.js 15+ App Router**, manteniendo **TODOS** los módulos, funcionalidades y patrones de la versión desktop actual (Tauri + React 19 + Vite + Supabase). La versión web debe ser **idéntica en funcionalidad**, con los mismos datos, misma UX y mismo backend Supabase.

---

## 📋 Stack Objetivo

- **Framework**: Next.js 15+ (App Router)
- **Lenguaje**: TypeScript 5.x
- **Estilos**: Tailwind CSS v4 + CSS custom properties (theming) — **copiar exactamente** el sistema de temas actual
- **Estado Global**: Zustand (mantener stores)
- **Backend**: Supabase (mismo proyecto, mismas tablas)
- **Formularios**: react-hook-form + zod (opcional, mantener)
- **Gráficos**: recharts (mantener)
- **Auth**: Supabase Auth (anon key, persistSession = true)
- **PWA**: next-pwa o similar para soporte offline parcial

---

## 📦 Módulos a Implementar (TODOS)

### 1. Dashboard (página principal `/`)
- [x] Splash screen con logo + progreso (conectando DB → cargando datos → listo)
- [x] 4 big stats cards (ingresos mes, tareas pendientes, en producción, cuentas x cobrar)
- [x] 3-column grid: Tareas (barras + today tasks), Agenda (próximos/semana/vencidos), Acción rápida
- [x] 3-column row: Reels, YouTube, Producción Musical (barras + totales)
- [x] 3-column row: Videoclips, Redes Sociales (métricas IG+YT), Proyectos (stats + sesiones)
- [x] 3-column row: Finanzas, Asesorías
- [x] Right sidebar: Calendar widget (semana empieza LUNES)
- [x] Alerts bar: tareas vencidas, pagos vencidos, proyectos estancados, eventos de hoy
- [x] Refresh button con spinner

### 2. Navegación (Layout Principal)
- [x] Sidebar colapsable con iconos + labels (español)
- [x] Secciones: Dashboard, Redes Sociales, Contenido, Producción Musical, Asesorías, Clientes, Proyectos, Agenda, Tareas, Calendario, Finanzas, Reportes, Configuración
- [x] Separadores entre grupos lógicos
- [x] Theme toggle (Oscuro / Gris oscuro / Claro)
- [x] Topbar con título de página + búsqueda global
- [x] Búsqueda global: busca en clientes, tareas, reels, youtube, proyectos, asesorías, agenda

### 3. Tareas (`/tasks`)
- [x] CRUD completo (crear, editar, archivar, eliminar)
- [x] Vista Kanban (pendiente, en proceso, bloqueada, en prueba, terminada, descartada)
- [x] Vista Lista con subtareas expandibles
- [x] Filtros: status, prioridad, área, vencidas
- [x] Stats cards: pendientes, en proceso, vencidas, completadas del mes
- [x] Subtareas con conteo batch
- [x] **Sistema de tareas automáticas** (copiar EXACTAMENTE `automaticTasks.ts`):
  - Reels: 8 reglas (idea→script, script→grabar, etc.)
  - YouTube: 10 reglas (idea→research, research→script, etc.)
  - Proyectos: 8 reglas
  - Asesorías: 4 reglas
  - Clientes: 2 reglas
  - Cuentas x Cobrar: 3 reglas
  - Agenda: 3 reglas
  - Videoclips: 7 reglas
  - Filosofía: 1 tarea/entidad = siguiente paso, actualizar no duplicar

### 4. Contenido (`/content`)
- [x] 3 subtabs keep-alive: Reels, Videoclips, YouTube
- [x] **Reels**: CRUD con pipeline (idea→script→ready_to_record→recorded→editing→reviewing→scheduled→published)
- [x] **Videoclips**: CRUD con pipeline filmmaker (idea→concept→preproduction→recording→editing→first_delivery→changes→final_delivery)
- [x] **YouTube**: CRUD con pipeline (idea→research→script→ready_to_record→recorded→editing→thumbnail→review→scheduled→published)
- [x] Prioridades, fechas, work_type, payment_status, amount
- [x] Script viewer (popup/window para ver guion en pantalla completa con auto-scroll)

### 5. Redes Sociales (`/social`)
- [x] Conexión Instagram (Graph API) y YouTube (Data API v3)
- [x] Auto-sync de publicaciones al abrir la app
- [x] Vinculación manual de posts con reels/videos locales
- [x] Métricas: alcance, impresiones, likes, comments, saves, shares, plays
- [x] Facebook cross-post metrics
- [x] Combined metrics dashboard
- [x] Vista de publicaciones con filtros (platform, media type, sync status)
- [x] Snapshot history

### 6. Producción Musical (`/music`)
- [x] CRUD proyectos musicales (personal o client_job)
- [x] Pipeline: idea→preproducción→grabando→editando→mezcla→mastering→revisión→entregado
- [x] Tracks por proyecto con CRUD individual
- [x] Stats: total, personales, trabajos, activos, mezcla, master, revisión, entregados
- [x] Backfill desde audio_jobs

### 7. Asesorías (`/consultancies`)
- [x] CRUD con pipeline: solicitada→agendada→confirmada→realizada→en seguimiento→cerrada
- [x] Payment status + amount
- [x] Auto-sync a finanzas (income + receivables automáticos)
- [x] Notas pre/diagnóstico/acuerdos/next steps/follow-up

### 8. Clientes (`/clients`)
- [x] CRUD con status (prospecto, activo, frecuente, inactivo, archivado)
- [x] Job count, consultancy count, total debt (RPC o fallback JS)
- [x] Búsqueda por nombre, artista, empresa, email, teléfono

### 9. Proyectos (`/projects`)
- [x] CRUD con pipeline (idea→research→planning→development→testing→launched→maintenance)
- [x] Sub-tabs: Overview, Documentos, Prompts, Sesiones de trabajo
- [x] Progress %, last activity, days inactive
- [x] Tech stack, local folder, repo, url

### 10. Finanzas (`/finance`)
- [x] 5 subtabs keep-alive: Resumen, Ingresos, Gastos, Cuentas x Cobrar, Cotizaciones
- [x] Resumen: stats cards + barras por categoría (ingresos/gastos)
- [x] CRUD completo en cada subtab
- [x] Auto-sync desde asesorías
- [x] Prune de registros huérfanos

### 11. Agenda (`/agenda`)
- [x] CRUD con tipos: meeting, call, recording, music_production, consultancy, delivery, event, reminder, other
- [x] Reminders por item
- [x] Filtros: status, priority, type, source_module, client, search, date range, overdue
- [x] Calendar projection (eventos en el calendario)

### 12. Calendario (`/calendar`)
- [x] Vistas: mes, semana, día
- [x] 9 orígenes parallel: tasks, reels, youtube, videoclips, music, consultancies, receivables, agenda, projects
- [x] Filtros por módulo (source module)
- [x] Colores por tipo de evento
- [x] Navegación mes/ano + botón Hoy

### 13. Reportes (`/reports`)
- [x] 5 tabs con gráficos recharts:
  - Productividad: tareas completadas vs mes
  - Contenido: reels/videos publicados
  - Proyectos: proyectos por estado
  - Finanzas: ingresos/gastos mensuales
  - Tiempo: work sessions

### 14. Configuración (`/settings`)
- [x] Temas: Oscuro, Gris oscuro, Claro
- [x] Backup/Restore: export JSON, import JSON
- [x] Seed demo data
- [x] Clear all data

---

## 🏛️ Patrones de Arquitectura (OBLIGATORIOS)

### Data Loading
- **Cargar TODOS los datos antes de que el usuario entre** (filosofía actual)
- Usar Zustand store con carga inicial en paralelo (11 dominios)
- SafeGet pattern: cada loader retorna fallback si falla, nunca bloquea
- Syncs en background después de mostrar la UI
- Supabase Realtime: invalidar dominios específicos cuando cambian datos

### UI Patterns
- **Keep-alive tabs**: todos los tabs mantienen estado con opacity/transform hide
- **Cross-fade transitions**: `opacity + translateY + scale` en 300ms
- **CSS Theme System**: 3 temas exactos (dark/neutral/light) con CSS custom properties
- **Modal con Portal**: `createPortal(document.body)` — NO posicionamiento absoluto dentro de contenedores animados
- **Semana empieza LUNES** (índice: 0=Lun, 6=Dom)
- **Idioma español chileno**: labels, fechas, moneda (es-CL), formato $1.234.567
- **Fuente**: Inter de Google Fonts
- **Animaciones**: page-enter, stagger, pop-in, slide-in-right, fade-in/out
- **Inline status dropdown** en listas → silent update + invalidate
- **ErrorBoundary** por página

### Database Layer
- **Misma base de datos Supabase** (migrar los modules `src/lib/db/*.ts` exactamente)
- `id`: UUID v4 generado en cliente (`crypto.randomUUID()`)
- Timestamps: `YYYY-MM-DD HH:mm:ss`
- Soft-delete (`is_archived`) en entidades principales
- Hard-delete en finanzas
- Joins con `!left` para LEFT JOIN (no romper por FK faltante)
- RPC con fallback JS: `get_clients_with_counts`

### Zustand Stores
- **useDataStore**: dashboard data + finance overview + initialize() + refreshAll() + invalidate()
- **useThemeStore**: tema + persistencia localStorage
- **useNavStore**: navegación + sidebar collapse (adaptar a router)
- **useSystemSettings**: settings de sistema (sin Tauri, usar localStorage)

### Tareas Automáticas
- **Copiar EXACTAMENTE** `src/lib/db/automaticTasks.ts` — no cambiar reglas ni lógica
- Misma estructura de reglas (ReelStatus → AutomaticTaskRule)
- Misma función `syncAllAutomaticTasks()`
- Mismo patrón: 1 tarea por entidad, actualizar existente, archivar stale

---

## ❌ Qué NO incluir (específico de Tauri)

- `useTrayBehavior` — no aplica en web
- `@tauri-apps/api` imports — eliminar
- `@tauri-apps/plugin-autostart` — eliminar
- `systemSettings.launchAtStartup` — no aplica
- `systemSettings.minimizeToTray` — no aplica
- `isTauri()` checks — eliminar
- `WebviewWindow` — reemplazar con `window.open()` para script viewer
- Sidebar version badge — actualizar a v0.5.4 o eliminar

---

## ✅ Lo que SÍ debe cambiar para web

- **Routing**: usar Next.js App Router (`page.tsx`, `layout.tsx`) en vez de TabPanel + navStore
- **Mantener keep-alive**: usar `hidden` con CSS en vez de `<TabPanel>` para preservar estado
- **Auth**: implementar Supabase Auth (persistSession=true) para login
- **PWA**: agregar manifest.json + service worker (la app desktop no tiene, pero la web sí debería)
- **Script Viewer**: reemplazar `window.open()` por ruta Next.js `script-viewer/page.tsx`
- **Vite → Next.js**: migrar config de build, Vite plugins no aplican
- **Env vars**: VITE_SUPABASE_URL → NEXT_PUBLIC_SUPABASE_URL, etc.
- **Server Components**: solo donde no haya interactividad (layout, headers, metadata)
- **Omitir Tauri deps**: package.json sin @tauri-apps/*

---

## 🎨 Temas CSS (COPIA EXACTA)

Incluir en `globals.css` los 3 temas EXACTOS de `src/index.css`:

- `.theme-dark` / `.dark`: bg #0d1117, primary #8b5cf6 (violeta)
- `.theme-neutral`: bg #1a1f26, primary #6366f1 (índigo)
- `.theme-light`: bg #f5f6f8, primary #2563eb (azul)

Mismas variables: `--color-bg`, `--color-surface`, `--color-surface-hover`, `--color-border`, `--color-text`, `--color-text-secondary`, `--color-text-tertiary`, `--color-primary`, `--color-primary-hover`, `--color-primary-rgb`, etc.

Mismas animaciones: `page-enter`, `stagger`, `pop-in`, `slide-in-right`, `fade-in`, `fade-out`.

---

## 🔄 Data Flow

1. Usuario abre `/`
2. Layout principal carga
3. `useDataStore.initialize()` dispara 11 loaders en paralelo
4. Mientras carga, mostrar splash screen con progreso
5. Cuando listo, mostrar botón "Comenzar" → splash se va, UI aparece
6. Background syncs corren después de mostrar UI
7. Realtime subscription escucha cambios e invalida dominios

---

## 📁 Páginas Next.js (App Router)

```
app/
├── layout.tsx          # Layout principal con Sidebar + Topbar
├── page.tsx            # DashboardPage (redirección / → /dashboard)
├── loading.tsx         # Pantalla de carga global
├── dashboard/page.tsx  # DashboardPage
├── tasks/page.tsx      # TasksPage
├── content/
│   ├── page.tsx        # ContentPage (tabs: reels, videoclips, youtube)
│   ├── reels/page.tsx  # ReelsPage
│   ├── youtube/page.tsx # YouTubePage
│   └── videoclips/page.tsx # VideoclipsPage
├── social/page.tsx     # SocialPage
├── music/page.tsx      # MusicProductionPage
├── consultancies/page.tsx # ConsultanciesPage
├── clients/page.tsx    # ClientsPage
├── projects/page.tsx   # ProjectsPage
├── finance/page.tsx    # FinancePage
├── agenda/page.tsx     # AgendaPage
├── calendar/page.tsx   # CalendarPage
├── reports/page.tsx    # ReportsPage
├── settings/page.tsx   # SettingsPage
└── script-viewer/page.tsx # ScriptViewerPage
```

Pero OPCIONALMENTE se puede mantener la app como SPA con Zustand navigation + TabPanel (igual que la desktop) dentro de una sola ruta de Next.js, y solo usar el App Router para el script-viewer. Esto reduce la fricción de migración.

---

## 🧪 Seed Data

Incluir los mismos seeders de demo:
- `seedDemoClients()` — 6 clientes de ejemplo
- `seedDemoReels()` — 6 reels de ejemplo
- `seedDemoYouTube()` — 5 videos de ejemplo
- `seedDemoProjects()` — 4 proyectos + prompts + documentos + sesiones
- `seedDemoConsultancies()` — 3 asesorías
- `seedDemoFinance()` — 5 ingresos + 5 gastos + 2 cotizaciones + 2 cuentas por cobrar

---

## 📦 Migración de Archivos Clave

Los siguientes archivos se migran **casi sin cambios** (solo limpiar imports Tauri):

| Origen (Tauri) | Destino (Next.js) | Cambios |
|----------------|-------------------|---------|
| `src/lib/supabase.ts` | `lib/supabase.ts` | NONE (ya funciona en web) |
| `src/lib/db/*.ts` | `lib/db/*.ts` | NONE (solo imports de supabase) |
| `src/lib/stores/*.ts` | `lib/stores/*.ts` | Quitar systemSettings Tauri parts |
| `src/lib/types/index.ts` | `lib/types/index.ts` | NONE |
| `src/lib/date.ts` | `lib/date.ts` | NONE |
| `src/lib/utils/format.ts` | `lib/utils/format.ts` | NONE |
| `src/lib/hooks/useCrud.ts` | `lib/hooks/useCrud.ts` | NONE |
| `src/components/ui/index.tsx` | `components/ui/index.tsx` | NONE (quitar Tauri refs) |
| `src/components/layout/*.tsx` | `components/layout/*.tsx` | Adaptar a Next.js routing |
| `src/pages/*.tsx` | `app/*/page.tsx` | Adaptar imports + routing |
| `src/hooks/useTrayBehavior.ts` | ❌ ELIMINAR | No aplica en web |
| `src/lib/scriptViewer.ts` | `lib/scriptViewer.ts` | Quitar Tauri WebviewWindow |
| `src/index.css` | `app/globals.css` | COPIAR EXACTO (temas + animaciones) |

---

## ✅ Checklist Final

- [ ] Todos los módulos funcionan (14 pages)
- [ ] Tareas automáticas generan/actualizan correctamente
- [ ] Supabase Realtime invalida datos correctamente
- [ ] Seeder crea datos de demo
- [ ] Búsqueda global funciona
- [ ] Script viewer abre en nueva ventana/pestaña
- [ ] Keep-alive tabs preservan scroll y estado
- [ ] Temas (oscuro/neutro/claro) funcionan
- [ ] Dashboard carga todo antes de mostrar
- [ ] Alertas del dashboard funcionan
- [ ] Sin errores de consola
- [ ] Build exitoso
