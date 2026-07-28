import { supabase } from '../supabase';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── Monthly Records ───

export async function getMonthlyRecords(entity: string, year?: number): Promise<{ month: string; value: number }[]> {
  const y = year || new Date().getFullYear();
  const ym = String(y);

  const ARCHIVABLE = new Set(['tasks', 'reels', 'youtube_videos']);

  async function countFor(table: string, dateCol: string): Promise<{ month: string; value: number }[]> {
    let q = supabase
      .from(table)
      .select(`${dateCol}, id`)
      .gte(dateCol, `${ym}-01-01`)
      .lte(dateCol, `${ym}-12-31`);
    if (ARCHIVABLE.has(table)) q = q.eq('is_archived', false);
    const { data } = await q;
    const months: Record<string, number> = {};
    for (const row of ((data || []) as unknown as Record<string, unknown>[])) {
      const m = (row[dateCol] as string || '').slice(5, 7);
      if (m) months[m] = (months[m] || 0) + 1;
    }
    return Object.entries(months).map(([month, value]) => ({ month, value }));
  }

  async function sumFor(table: string, dateCol: string, amountCol: string): Promise<{ month: string; value: number }[]> {
    let q = supabase
      .from(table)
      .select(`${dateCol}, ${amountCol}`)
      .gte(dateCol, `${ym}-01-01`)
      .lte(dateCol, `${ym}-12-31`);
    if (ARCHIVABLE.has(table)) q = q.eq('is_archived', false);
    const { data } = await q;
    const months: Record<string, number> = {};
    for (const row of ((data || []) as unknown as Record<string, unknown>[])) {
      const m = (row[dateCol] as string || '').slice(5, 7);
      if (m) months[m] = (months[m] || 0) + (row[amountCol] as number || 0);
    }
    return Object.entries(months).map(([month, value]) => ({ month, value }));
  }

  async function countCompletedMonthly(table: string): Promise<{ month: string; value: number }[]> {
    let q = supabase
      .from(table)
      .select('status, updated_at')
      .eq('status', 'completed')
      .gte('updated_at', `${ym}-01-01`)
      .lte('updated_at', `${ym}-12-31`);
    if (ARCHIVABLE.has(table)) q = q.eq('is_archived', false);
    const { data } = await q;
    const months: Record<string, number> = {};
    for (const row of ((data || []) as unknown as Record<string, unknown>[])) {
      const m = (row.updated_at as string || '').slice(5, 7);
      if (m) months[m] = (months[m] || 0) + 1;
    }
    return Object.entries(months).map(([month, value]) => ({ month, value }));
  }

  let raw: { month: string; value: number }[];
  switch (entity) {
    case 'income':
      raw = await sumFor('income', 'date', 'amount');
      break;
    case 'expenses':
      raw = await sumFor('expenses', 'date', 'amount');
      break;
    case 'tasks_done':
      raw = await countCompletedMonthly('tasks');
      break;
    case 'tasks_created':
      raw = await countFor('tasks', 'created_at');
      break;
    case 'reels_created':
      raw = await countFor('reels', 'created_at');
      break;
    case 'reels_published':
      raw = await countFor('reels', 'published_date');
      break;
    case 'youtube_created':
      raw = await countFor('youtube_videos', 'created_at');
      break;
    case 'youtube_published':
      raw = await countFor('youtube_videos', 'published_date');
      break;
    default:
      raw = [];
  }

  return fillMissing(raw, y);
}

function fillMissing(data: { month: string; value: number }[], _year: number): { month: string; value: number }[] {
  const months: { month: string; value: number }[] = [];
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, '0');
    const found = data.find(d => d.month === m);
    months.push({ month: m, value: found ? found.value : 0 });
  }
  return months;
}

// ─── Productivity ───

export interface ProductivityReport {
  total_created: number;
  total_completed: number;
  completion_rate: number;
  overdue: number;
  blocked: number;
  by_area: { area: string; count: number; completed: number }[];
  weekly: { week: string; created: number; completed: number }[];
}

export async function getProductivityReport(): Promise<ProductivityReport> {
  const { data: allTasks } = await supabase.from('tasks').select('status, area, created_at, due_date').eq('is_archived', false);
  const tasks = allTasks || [];

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const overdue = tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && !['completed', 'cancelled'].includes(t.status)).length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;

  const areaMap: Record<string, { count: number; completed: number }> = {};
  for (const t of tasks) {
    const area = t.area || 'sin área';
    if (!areaMap[area]) areaMap[area] = { count: 0, completed: 0 };
    areaMap[area].count++;
    if (t.status === 'completed') areaMap[area].completed++;
  }
  const by_area = Object.entries(areaMap)
    .map(([area, v]) => ({ area, count: v.count, completed: v.completed }))
    .sort((a, b) => b.count - a.count);

  // Weekly: last 8 weeks
  const weekMap: Record<string, { created: number; completed: number }> = {};
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const cutoff = eightWeeksAgo.toISOString().slice(0, 10);
  for (const t of tasks) {
    if (!t.created_at || t.created_at < cutoff) continue;
    const d = new Date(t.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const wk = weekStart.toISOString().slice(0, 10);
    if (!weekMap[wk]) weekMap[wk] = { created: 0, completed: 0 };
    weekMap[wk].created++;
    if (t.status === 'completed') weekMap[wk].completed++;
  }
  const weekly = Object.entries(weekMap)
    .map(([week, v]) => ({ week, created: v.created, completed: v.completed }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return {
    total_created: total,
    total_completed: completed,
    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    overdue,
    blocked,
    by_area,
    weekly,
  };
}

// ─── Content Report ───

export interface ContentReport {
  reels: { total: number; published: number; in_production: number; discarded: number };
  youtube: { total: number; published: number; in_production: number; paused: number };
  reels_by_status: { status: string; count: number }[];
  youtube_by_status: { status: string; count: number }[];
}

export async function getContentReport(): Promise<ContentReport> {
  const { data: allReels } = await supabase.from('reels').select('status').eq('is_archived', false);
  const { data: allYt } = await supabase.from('youtube_videos').select('status').eq('is_archived', false);
  const reels = allReels || [];
  const yt = allYt || [];

  const reelsPublished = reels.filter(r => r.status === 'published').length;
  const reelsInProd = reels.filter(r => ['idea', 'script', 'ready_to_record', 'recorded', 'editing', 'reviewing'].includes(r.status)).length;
  const reelsDiscarded = reels.filter(r => ['paused', 'discarded'].includes(r.status)).length;

  const ytPublished = yt.filter(v => v.status === 'published').length;
  const ytInProd = yt.filter(v => ['idea', 'research', 'script', 'ready_to_record', 'recorded', 'editing', 'thumbnail', 'review'].includes(v.status)).length;
  const ytPaused = yt.filter(v => ['paused', 'discarded'].includes(v.status)).length;

  const reelsByStatus = aggregateCounts(reels, 'status');
  const ytByStatus = aggregateCounts(yt, 'status');

  return {
    reels: { total: reels.length, published: reelsPublished, in_production: reelsInProd, discarded: reelsDiscarded },
    youtube: { total: yt.length, published: ytPublished, in_production: ytInProd, paused: ytPaused },
    reels_by_status: reelsByStatus,
    youtube_by_status: ytByStatus,
  };
}

function aggregateCounts(rows: any[], field: string): { status: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const key = r[field] || 'unknown';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

// ─── Projects Report ───

export interface ProjectsReport {
  total: number; active: number; stalled: number; launched: number;
  by_status: { status: string; count: number }[];
  avg_progress: number;
}

export async function getProjectsReport(): Promise<ProjectsReport> {
  const { data } = await supabase.from('digital_projects').select('status, progress').eq('is_archived', false);
  const projects = data || [];
  const active = projects.filter(p => ['development', 'planning'].includes(p.status)).length;
  const stalled = projects.filter(p => ['paused', 'blocked', 'idea'].includes(p.status)).length;
  const launched = projects.filter(p => ['launched', 'maintenance'].includes(p.status)).length;
  const by_status = aggregateCounts(projects, 'status');
  const progresses = projects.filter(p => p.progress != null).map(p => p.progress);
  const avg_progress = progresses.length > 0 ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0;
  return { total: projects.length, active, stalled, launched, by_status, avg_progress };
}

// ─── Finance Report ───

export interface FinanceReport {
  total_income: number; total_expenses: number; profit: number;
  pending_debt: number; income_by_category: { category: string; total: number }[];
  expense_by_category: { category: string; total: number }[];
}

export async function getFinanceReport(): Promise<FinanceReport> {
  const { data: income } = await supabase.from('income').select('amount, category, status');
  const { data: expenses } = await supabase.from('expenses').select('amount, category');
  const { data: debtRows } = await supabase.from('receivables').select('balance, status');

  const paidIncome = (income || []).filter(i => ['paid', 'partial'].includes(i.status));
  const total_income = Math.round(paidIncome.reduce((s, i) => s + (i.amount || 0), 0));
  const total_expenses = Math.round((expenses || []).reduce((s, e) => s + (e.amount || 0), 0));
  const pending_debt = Math.round((debtRows || []).filter(r => ['pending', 'partial', 'overdue'].includes(r.status)).reduce((s, r) => s + (r.balance || 0), 0));

  const incomeByCat = aggregateSums(paidIncome, 'category', 'amount');
  const expenseByCat = aggregateSums(expenses || [], 'category', 'amount');

  return { total_income, total_expenses, profit: total_income - total_expenses, pending_debt, income_by_category: incomeByCat, expense_by_category: expenseByCat };
}

function aggregateSums(rows: any[], groupField: string, sumField: string): { category: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const key = r[groupField] || 'sin categoría';
    map[key] = (map[key] || 0) + (r[sumField] || 0);
  }
  return Object.entries(map).map(([category, total]) => ({ category, total: Math.round(total) })).sort((a, b) => b.total - a.total);
}

// ─── Time Report ───

export interface TimeReport {
  total_hours: number; session_count: number;
  by_type: { session_type: string; total_minutes: number }[];
  recent: { date: string; description: string; duration: number; project_name: string }[];
}

export async function getTimeReport(): Promise<TimeReport> {
  const { data: sessions } = await supabase.from('work_sessions').select('duration, session_type, start_time, description');
  const sess = sessions || [];

  const total_minutes = sess.reduce((s, s2) => s + (s2.duration || 0), 0);
  const typeMap: Record<string, number> = {};
  for (const s of sess) {
    const t = s.session_type || 'other';
    typeMap[t] = (typeMap[t] || 0) + (s.duration || 0);
  }
  const by_type = Object.entries(typeMap).map(([session_type, total_minutes2]) => ({ session_type, total_minutes: total_minutes2 })).sort((a, b) => b.total_minutes - a.total_minutes);

  // Recent: last 10 sessions — sin join porque no hay FK con digital_projects
  const { data: recent } = await supabase
    .from('work_sessions')
    .select('start_time, description, duration')
    .order('start_time', { ascending: false })
    .limit(10);
  const recentSessions = (recent || []).map((s: any) => ({
    date: s.start_time || '',
    description: s.description || '',
    duration: s.duration || 0,
    project_name: '',
  }));

  return {
    total_hours: Math.round(total_minutes / 60),
    session_count: sess.length,
    by_type,
    recent: recentSessions,
  };
}

export { MONTH_NAMES };
