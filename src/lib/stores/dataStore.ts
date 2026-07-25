import { create } from 'zustand';
import { getTaskStats, getTasks } from '../db/tasks';
import { getAlerts, type Alert } from '../db/calendar';
import { getFinanceStats } from '../db/finance';
import { getJobStats } from '../db/jobs';
import { getProjectStats } from '../db/projects';
import { getReelStats } from '../db/reels';
import { getYouTubeStats } from '../db/youtube';
import { getAgendaItems } from '../db/agenda';
import { getConsultancies } from '../db/consultancies';
import { getMusicStats } from '../db/music';
import { getVideoclipStats } from '../db/videoclips';
import { getCombinedMetrics, getSocialAccountByPlatform } from '../db/social';
import { localDateKey } from '../date';
import type { Task, AgendaItem } from '../types';

/**
 * DataStore móvil — solo carga lo que el dashboard resumen necesita.
 * El resto de las pantallas hacen sus propias queries on-demand.
 */

async function safeGet<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn('[DataStore:web] query failed:', e);
    return fallback;
  }
}

export interface DashboardMobile {
  taskStats: Awaited<ReturnType<typeof getTaskStats>>;
  financeStats: Awaited<ReturnType<typeof getFinanceStats>>;
  jobStats: Awaited<ReturnType<typeof getJobStats>>;
  reelStats: Awaited<ReturnType<typeof getReelStats>>;
  youTubeStats: Awaited<ReturnType<typeof getYouTubeStats>>;
  projectStat: Awaited<ReturnType<typeof getProjectStats>>;
  musicStats: Awaited<ReturnType<typeof getMusicStats>>;
  videoclipStats: Awaited<ReturnType<typeof getVideoclipStats>>;
  alerts: Alert[];
  todayTasks: Task[];
  overdueTasks: Task[];
  agendaItems: AgendaItem[];
  consultancies: Awaited<ReturnType<typeof getConsultancies>>;
  social: {
    igFollowers: number; ytFollowers: number;
    views: number; likes: number; comments: number;
    igConnected: boolean; ytConnected: boolean;
  } | null;
}

interface DataState {
  dashboard: DashboardMobile | null;
  dashboardStatus: 'idle' | 'loading' | 'ok' | 'error';
  dashboardError: string;
  initialiseDashboard: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  dashboard: null,
  dashboardStatus: 'idle',
  dashboardError: '',

  initialiseDashboard: async () => {
    if (get().dashboardStatus === 'loading') return;
    set({ dashboardStatus: 'loading', dashboardError: '' });
    try {
      const todayStr = localDateKey(new Date());
      const [
        taskStats, financeStats, jobStats, reelStats, youTubeStats,
        projectStat, musicStats, videoclipStats, alerts, allTasks,
        agendaItems, consultancies, combinedMetrics, igAcct, ytAcct,
      ] = await Promise.all([
        safeGet(() => getTaskStats(), { pending: 0, in_progress: 0, overdue: 0, completed_this_month: 0 }),
        safeGet(() => getFinanceStats(), { income_month: 0, expense_month: 0, result_month: 0, pending_receivables: 0, overdue_receivables: 0, quotes_pending: 0, total_debt: 0 }),
        safeGet(() => getJobStats(), { active: 0, pending_delivery: 0, payment_due: 0, delivered_this_month: 0 }),
        safeGet(() => getReelStats(), { total: 0, in_production: 0, scheduled: 0, published_this_month: 0 }),
        safeGet(() => getYouTubeStats(), { total: 0, in_production: 0, published_this_month: 0, paused: 0 }),
        safeGet(() => getProjectStats(), { total: 0, active: 0, stalled: 0, launched: 0, avg_progress: 0 }),
        safeGet(() => getMusicStats(), { total: 0, personal: 0, client: 0, active: 0, mixing: 0, mastering: 0, review: 0, delivered: 0 }),
        safeGet(() => getVideoclipStats(), { total: 0, active: 0, preproduction: 0, recording: 0, review: 0, delivered: 0 }),
        safeGet(() => getAlerts(), []),
        safeGet(() => getTasks(), []),
        safeGet(() => getAgendaItems(), []),
        safeGet(() => getConsultancies(), []),
        safeGet(() => getCombinedMetrics(), null),
        safeGet(() => getSocialAccountByPlatform('instagram'), null),
        safeGet(() => getSocialAccountByPlatform('youtube'), null),
      ]);
      const todayTasks = allTasks.filter((t) => t.due_date === todayStr && t.status !== 'completed' && !t.is_archived);
      const overdueTasks = allTasks.filter((t) => t.due_date && t.due_date < todayStr && t.status !== 'completed' && !t.is_archived);
      const social = combinedMetrics || igAcct || ytAcct ? {
        igFollowers: igAcct?.followers_count || 0,
        ytFollowers: ytAcct?.followers_count || 0,
        views: combinedMetrics?.total_views || 0,
        likes: combinedMetrics?.total_likes || 0,
        comments: combinedMetrics?.total_comments || 0,
        igConnected: igAcct?.connection_status === 'connected',
        ytConnected: ytAcct?.connection_status === 'connected',
      } : null;
      set({
        dashboard: {
          taskStats, financeStats, jobStats, reelStats, youTubeStats,
          projectStat, musicStats, videoclipStats, alerts,
          todayTasks, overdueTasks, agendaItems, consultancies, social,
        },
        dashboardStatus: 'ok',
      });
    } catch (e: any) {
      set({ dashboardStatus: 'error', dashboardError: String(e?.message || e) });
    }
  },
}));
