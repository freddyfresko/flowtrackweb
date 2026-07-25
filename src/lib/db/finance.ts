import { supabase } from '../supabase';
import { deleteAutomaticTasksForSource, syncAutomaticTasksForReceivable } from './automaticTasks';
import { localDateKey, localMonthKey } from '../date';

// ─── Automatic finance sync ───

let financeSyncRunning = false;

type FinanceRow = Record<string, any>;

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function money(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function jobCategory(type: string | null | undefined): string {
  if (!type) return 'trabajos';
  if (type.startsWith('filmmaker')) return 'video';
  if (type.startsWith('audio')) return 'audio';
  return 'trabajos';
}

function parseNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function parseInteger(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function monthMatches(date: string | null | undefined, year?: string, month?: string): boolean {
  if (!date) return false;
  const value = String(date);
  if (year && value.slice(0, 4) !== year) return false;
  if (month && value.slice(5, 7) !== month.padStart(2, '0')) return false;
  return true;
}

function flattenIncome(row: FinanceRow): FinanceRow {
  const out = { ...row };
  out.client_name = row.clients?.name ?? undefined;
  out.job_title = row.jobs?.title ?? undefined;
  delete out.clients;
  delete out.jobs;
  delete out.digital_projects;
  return out;
}

function flattenExpense(row: FinanceRow): FinanceRow {
  const out = { ...row };
  delete out.jobs;
  delete out.digital_projects;
  return out;
}

function flattenQuote(row: FinanceRow): FinanceRow {
  const out = { ...row };
  out.client_name = row.clients?.name ?? undefined;
  delete out.clients;
  return out;
}

function flattenReceivable(row: FinanceRow): FinanceRow {
  const out = { ...row };
  out.client_name = row.clients?.name ?? undefined;
  out.job_title = row.jobs?.title ?? undefined;
  delete out.clients;
  delete out.jobs;
  return out;
}

function isLiveIncome(row: FinanceRow): boolean {
  if (row.job_id && !row.jobs) return false;
  if (row.client_id && !row.clients) return false;
  return true;
}

function isLiveExpense(row: FinanceRow): boolean {
  if (row.job_id && !row.jobs) return false;
  return true;
}

function isLiveReceivable(row: FinanceRow): boolean {
  if (row.job_id && !row.jobs) return false;
  if (row.client_id && !row.clients) return false;
  return true;
}

function isLiveQuote(row: FinanceRow): boolean {
  if (row.client_id && !row.clients) return false;
  return true;
}

async function fetchIncomeRows(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from('income')
    .select('*, clients!left(name), jobs!left(title)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data || []) as FinanceRow[]).filter(isLiveIncome);
}

async function fetchExpenseRows(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, jobs!left(id)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data || []) as FinanceRow[]).filter(isLiveExpense);
}

async function fetchReceivableRows(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from('receivables')
    .select('*, clients!left(name), jobs!left(title)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data || []) as FinanceRow[]).filter(isLiveReceivable);
}

async function fetchQuoteRows(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, clients!left(name)')
    .eq('is_archived', false);
  if (error) throw new Error(`DB query error: ${error.message}`);
  return ((data || []) as FinanceRow[]).filter(isLiveQuote);
}

async function getById(table: string, id: string): Promise<any> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`DB query error: ${error.message}`);
  return data || null;
}

async function upsertAutomaticIncome(data: any): Promise<void> {
  const { data: existing, error } = await supabase
    .from('income')
    .select('id')
    .eq('source_type', data.source_type)
    .eq('source_id', data.source_id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  if (existing?.id) await updateIncome(existing.id, data);
  else await createIncome(data);
}

async function upsertAutomaticReceivable(data: any): Promise<void> {
  const { data: existing, error } = await supabase
    .from('receivables')
    .select('id')
    .eq('source_type', data.source_type)
    .eq('source_id', data.source_id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`DB query error: ${error.message}`);
  if (existing?.id) await updateReceivable(existing.id, data);
  else await createReceivable(data);
}

async function syncJobsIntoFinance(): Promise<void> {
  const { data, error } = await supabase.from('jobs').select('*').eq('is_archived', false);
  if (error) throw new Error(`DB query error: ${error.message}`);

  const jobs = (data || []) as FinanceRow[];
  const liveIds = new Set(jobs.map((j) => String(j.id)));

  for (const job of jobs) {
    // Adopt old manual finance rows linked to this job so the sync updates them
    // instead of creating duplicates after the automation migration.
    const [incomeAdopt, receivableAdopt] = await Promise.all([
      supabase.from('income').update({ source_type: 'job', source_id: job.id }).eq('job_id', job.id).is('source_type', null),
      supabase.from('receivables').update({ source_type: 'job', source_id: job.id }).eq('job_id', job.id).is('source_type', null),
    ]);
    if (incomeAdopt.error) throw new Error(`DB update error: ${incomeAdopt.error.message}`);
    if (receivableAdopt.error) throw new Error(`DB update error: ${receivableAdopt.error.message}`);

    const budget = money(job.budget);
    const explicitBalance = job.balance == null ? null : money(job.balance);
    const deposit = money(job.deposit);
    const paid = explicitBalance == null ? deposit : Math.max(0, budget - explicitBalance);
    const balance = explicitBalance == null ? Math.max(0, budget - paid) : Math.max(0, explicitBalance);
    const cancelled = job.status === 'cancelled' || budget <= 0;

    if (cancelled || paid <= 0) {
      const { error: deleteError } = await supabase.from('income').delete().eq('source_type', 'job').eq('source_id', job.id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    } else {
      await upsertAutomaticIncome({
        date: job.updated_at?.slice(0, 10) || localDateKey(),
        concept: `Trabajo: ${job.title}`,
        amount: paid,
        client_id: job.client_id || null,
        job_id: job.id,
        category: jobCategory(job.type),
        payment_method: 'por definir',
        status: balance > 0 ? 'partial' : 'paid',
        notes: 'Automático desde módulo Trabajos',
        source_type: 'job',
        source_id: job.id,
      });
    }

    if (cancelled || balance <= 0) {
      const { error: deleteError } = await supabase.from('receivables').delete().eq('source_type', 'job').eq('source_id', job.id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    } else {
      await upsertAutomaticReceivable({
        client_id: job.client_id || null,
        job_id: job.id,
        total_amount: budget || balance,
        paid_amount: paid,
        balance,
        status: paid > 0 ? 'partial' : 'pending',
        notes: `Automático desde trabajo: ${job.title}`,
        source_type: 'job',
        source_id: job.id,
      });
    }
  }

  const [autoJobIncome, autoJobReceivables] = await Promise.all([
    supabase.from('income').select('source_id').eq('source_type', 'job'),
    supabase.from('receivables').select('source_id').eq('source_type', 'job'),
  ]);
  if (autoJobIncome.error) throw new Error(`DB query error: ${autoJobIncome.error.message}`);
  if (autoJobReceivables.error) throw new Error(`DB query error: ${autoJobReceivables.error.message}`);

  for (const row of autoJobIncome.data || []) {
    if (!liveIds.has(String(row.source_id))) {
      const { error: deleteError } = await supabase.from('income').delete().eq('source_type', 'job').eq('source_id', row.source_id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    }
  }
  for (const row of autoJobReceivables.data || []) {
    if (!liveIds.has(String(row.source_id))) {
      const { error: deleteError } = await supabase.from('receivables').delete().eq('source_type', 'job').eq('source_id', row.source_id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    }
  }
}

async function syncConsultanciesIntoFinance(): Promise<void> {
  const { data, error } = await supabase.from('consultancies').select('*').eq('is_archived', false);
  if (error) throw new Error(`DB query error: ${error.message}`);

  const items = (data || []) as FinanceRow[];
  const liveIds = new Set(items.map((c) => String(c.id)));

  for (const c of items) {
    const amount = money(c.amount);
    const cancelled = c.status === 'cancelled' || amount <= 0;
    const paid = c.payment_status === 'paid';
    const partial = c.payment_status === 'partial';

    if (!paid || cancelled) {
      const { error: deleteError } = await supabase.from('income').delete().eq('source_type', 'consultancy').eq('source_id', c.id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    } else {
      await upsertAutomaticIncome({
        date: c.date || localDateKey(),
        concept: `Asesoría: ${c.topic}`,
        amount,
        client_id: c.client_id || null,
        category: 'asesorias',
        payment_method: 'por definir',
        status: 'paid',
        notes: 'Automático desde módulo Asesorías',
        source_type: 'consultancy',
        source_id: c.id,
      });
    }

    if (paid || cancelled || amount <= 0) {
      const { error: deleteError } = await supabase.from('receivables').delete().eq('source_type', 'consultancy').eq('source_id', c.id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    } else {
      await upsertAutomaticReceivable({
        client_id: c.client_id || null,
        job_id: null,
        total_amount: amount,
        paid_amount: 0,
        balance: amount,
        due_date: c.date || null,
        status: partial ? 'partial' : 'pending',
        notes: `Automático desde asesoría: ${c.topic}`,
        source_type: 'consultancy',
        source_id: c.id,
      });
    }
  }

  const [autoConsultIncome, autoConsultReceivables] = await Promise.all([
    supabase.from('income').select('source_id').eq('source_type', 'consultancy'),
    supabase.from('receivables').select('source_id').eq('source_type', 'consultancy'),
  ]);
  if (autoConsultIncome.error) throw new Error(`DB query error: ${autoConsultIncome.error.message}`);
  if (autoConsultReceivables.error) throw new Error(`DB query error: ${autoConsultReceivables.error.message}`);

  for (const row of autoConsultIncome.data || []) {
    if (!liveIds.has(String(row.source_id))) {
      const { error: deleteError } = await supabase.from('income').delete().eq('source_type', 'consultancy').eq('source_id', row.source_id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    }
  }
  for (const row of autoConsultReceivables.data || []) {
    if (!liveIds.has(String(row.source_id))) {
      const { error: deleteError } = await supabase.from('receivables').delete().eq('source_type', 'consultancy').eq('source_id', row.source_id);
      if (deleteError) throw new Error(`DB delete error: ${deleteError.message}`);
    }
  }
}

export async function syncFinanceFromOperations(): Promise<void> {
  if (financeSyncRunning) return;
  financeSyncRunning = true;
  try {
    await syncJobsIntoFinance();
    await syncConsultanciesIntoFinance();
  } finally {
    financeSyncRunning = false;
  }
}

// ─── Income ───

export async function getIncome(filters: { year?: string; month?: string } = {}): Promise<any[]> {
  // Sync runs at startup via DataStore
  return (await fetchIncomeRows())
    .filter((row) => monthMatches(row.date, filters.year, filters.month))
    .map(flattenIncome)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function createIncome(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('income').insert({
    id,
    date: data.date || localDateKey(),
    concept: data.concept || 'Sin concepto',
    amount: parseNumber(data.amount),
    client_id: data.client_id || null,
    job_id: data.job_id || null,
    project_id: data.project_id || null,
    category: data.category || null,
    payment_method: data.payment_method || null,
    source_type: data.source_type || null,
    source_id: data.source_id || null,
    status: data.status || 'pending',
    receipt: data.receipt || null,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);
  return getById('income', id);
}

export async function updateIncome(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  for (const key of ['date', 'concept', 'amount', 'client_id', 'job_id', 'project_id', 'category', 'payment_method', 'source_type', 'source_id', 'status', 'receipt', 'notes']) {
    if (data[key] !== undefined) updateData[key] = key === 'amount' ? parseNumber(data[key]) : data[key];
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('income').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);
}

export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from('income').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ─── Expenses ───

export async function getExpenses(filters: { year?: string; month?: string } = {}): Promise<any[]> {
  return (await fetchExpenseRows())
    .filter((row) => monthMatches(row.date, filters.year, filters.month))
    .map(flattenExpense)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function createExpense(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('expenses').insert({
    id,
    date: data.date || localDateKey(),
    concept: data.concept || 'Sin concepto',
    amount: parseNumber(data.amount),
    category: data.category || null,
    project_id: data.project_id || null,
    job_id: data.job_id || null,
    provider: data.provider || null,
    payment_method: data.payment_method || null,
    expense_type: data.expense_type || 'one_time',
    receipt: data.receipt || null,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);
  return getById('expenses', id);
}

export async function updateExpense(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  for (const key of ['date', 'concept', 'amount', 'category', 'project_id', 'job_id', 'provider', 'payment_method', 'expense_type', 'receipt', 'notes']) {
    if (data[key] !== undefined) updateData[key] = key === 'amount' ? parseNumber(data[key]) : data[key];
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('expenses').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ─── Quotes ───

export async function getQuotes(): Promise<any[]> {
  // Sync runs at startup via DataStore
  return (await fetchQuoteRows())
    .map(flattenQuote)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function createQuote(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('quotes').insert({
    id,
    client_id: data.client_id || null,
    service: data.service || 'Sin servicio',
    description: data.description || null,
    discount: parseNumber(data.discount),
    total: parseNumber(data.total),
    validity: data.validity || null,
    payment_conditions: data.payment_conditions || null,
    included_changes: parseInteger(data.included_changes),
    estimated_delivery: data.estimated_delivery || null,
    notes: data.notes || null,
    status: data.status || 'draft',
    created_at: now,
    updated_at: now,
    is_archived: false,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);
  return getById('quotes', id);
}

export async function updateQuote(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  for (const key of ['client_id', 'service', 'description', 'discount', 'total', 'validity', 'payment_conditions', 'included_changes', 'estimated_delivery', 'notes', 'status']) {
    if (data[key] !== undefined) {
      if (key === 'discount' || key === 'total') updateData[key] = parseNumber(data[key]);
      else if (key === 'included_changes') updateData[key] = parseInteger(data[key]);
      else updateData[key] = data[key];
    }
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('quotes').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);
}

export async function archiveQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').update({ is_archived: true, updated_at: nowStr() }).eq('id', id);
  if (error) throw new Error(`DB archive error: ${error.message}`);
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

export async function pruneDeletedEntityFinanceRecords(): Promise<void> {
  const [incomeRows, expenseRows, receivableRows, quoteRows] = await Promise.all([
    fetchIncomeRowsWithOrphans(),
    fetchExpenseRowsWithOrphans(),
    fetchReceivableRowsWithOrphans(),
    fetchQuoteRowsWithOrphans(),
  ]);

  await Promise.all([
    deleteIds('income', incomeRows.filter((row) => !isLiveIncome(row)).map((row) => row.id)),
    deleteIds('expenses', expenseRows.filter((row) => !isLiveExpense(row)).map((row) => row.id)),
    deleteIds('receivables', receivableRows.filter((row) => !isLiveReceivable(row)).map((row) => row.id)),
    deleteIds('quotes', quoteRows.filter((row) => !isLiveQuote(row)).map((row) => row.id)),
  ]);
}

async function deleteIds(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) throw new Error(`DB delete error: ${error.message}`);
}

async function fetchIncomeRowsWithOrphans(): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from('income').select('*, clients!left(name), jobs!left(title)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as FinanceRow[];
}

async function fetchExpenseRowsWithOrphans(): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from('expenses').select('*, jobs!left(id)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as FinanceRow[];
}

async function fetchReceivableRowsWithOrphans(): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from('receivables').select('*, clients!left(name), jobs!left(title)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as FinanceRow[];
}

async function fetchQuoteRowsWithOrphans(): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from('quotes').select('*, clients!left(name)');
  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data || []) as FinanceRow[];
}

// ─── Receivables ───

export async function getReceivables(): Promise<any[]> {
  // Sync runs at startup via DataStore
  const statusSort: Record<string, number> = { overdue: 0, pending: 1, partial: 2, paid: 3 };
  return (await fetchReceivableRows())
    .map(flattenReceivable)
    .sort((a, b) => {
      const sa = statusSort[a.status] ?? 4;
      const sb = statusSort[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      return String(a.due_date || '').localeCompare(String(b.due_date || ''));
    });
}

export async function createReceivable(data: any): Promise<any> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const total = parseNumber(data.total_amount);
  const paid = parseNumber(data.paid_amount);
  const balance = data.balance === undefined ? total - paid : parseNumber(data.balance);

  const { error } = await supabase.from('receivables').insert({
    id,
    client_id: data.client_id || null,
    job_id: data.job_id || null,
    total_amount: total,
    paid_amount: paid,
    balance,
    due_date: data.due_date || null,
    last_contact: data.last_contact || null,
    status: data.status || 'pending',
    notes: data.notes || null,
    source_type: data.source_type || null,
    source_id: data.source_id || null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(`DB insert error: ${error.message}`);

  const receivable = await getById('receivables', id);
  if (receivable) await syncAutomaticTasksForReceivable(receivable as any);
  return receivable;
}

export async function updateReceivable(id: string, data: any): Promise<void> {
  const updateData: Record<string, unknown> = {};
  for (const key of ['client_id', 'job_id', 'total_amount', 'paid_amount', 'balance', 'due_date', 'last_contact', 'status', 'notes', 'source_type', 'source_id']) {
    if (data[key] !== undefined) {
      updateData[key] = ['total_amount', 'paid_amount', 'balance'].includes(key) ? parseNumber(data[key]) : data[key];
    }
  }
  updateData.updated_at = nowStr();

  const { error } = await supabase.from('receivables').update(updateData).eq('id', id);
  if (error) throw new Error(`DB update error: ${error.message}`);

  const receivable = await getById('receivables', id);
  if (receivable) await syncAutomaticTasksForReceivable(receivable as any);
}

export async function deleteReceivable(id: string): Promise<void> {
  const { error } = await supabase.from('receivables').delete().eq('id', id);
  if (error) throw new Error(`DB delete error: ${error.message}`);
  await deleteAutomaticTasksForSource('receivable', id);
}

// ─── Stats / Cash Flow ───

export async function getFinanceStats(): Promise<{
  income_month: number; expense_month: number; result_month: number;
  pending_receivables: number; overdue_receivables: number;
  quotes_pending: number; total_debt: number;
}> {
  // Sync runs once at startup via DataStore.initialize()
  const ym = localMonthKey();
  const [income, expenses, receivables, quotes] = await Promise.all([
    fetchIncomeRows(),
    fetchExpenseRows(),
    fetchReceivableRows(),
    fetchQuoteRows(),
  ]);

  const incomeMonth = income
    .filter((row) => String(row.date || '').slice(0, 7) === ym && ['paid', 'partial'].includes(row.status))
    .reduce((sum, row) => sum + money(row.amount), 0);
  const expenseMonth = expenses
    .filter((row) => String(row.date || '').slice(0, 7) === ym)
    .reduce((sum, row) => sum + money(row.amount), 0);
  const pending = receivables.filter((row) => ['pending', 'partial'].includes(row.status)).length;
  const overdue = receivables.filter((row) => row.status === 'overdue').length;
  const quotesPending = quotes.filter((row) => ['draft', 'sent'].includes(row.status) && !row.is_archived).length;
  const debt = receivables
    .filter((row) => ['pending', 'partial', 'overdue'].includes(row.status))
    .reduce((sum, row) => sum + money(row.balance), 0);

  return {
    income_month: incomeMonth,
    expense_month: expenseMonth,
    result_month: incomeMonth - expenseMonth,
    pending_receivables: pending,
    overdue_receivables: overdue,
    quotes_pending: quotesPending,
    total_debt: debt,
  };
}

export async function getIncomeByCategory(year?: string): Promise<any[]> {
  // Sync runs at startup via DataStore
  const rows = (await fetchIncomeRows())
    .filter((row) => (!year || String(row.date || '').slice(0, 4) === year) && ['paid', 'partial'].includes(row.status));
  return aggregateSums(rows, 'category', 'amount');
}

export async function getExpenseByCategory(year?: string): Promise<any[]> {
  // Sync runs at startup via DataStore
  const rows = (await fetchExpenseRows())
    .filter((row) => !year || String(row.date || '').slice(0, 4) === year);
  return aggregateSums(rows, 'category', 'amount');
}

function aggregateSums(rows: any[], groupField: string, sumField: string): { category: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const key = row[groupField] || 'sin categoría';
    map[key] = (map[key] || 0) + money(row[sumField]);
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total);
}

// ─── Clients for select ───
export async function getFinanceClients(): Promise<any[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return data || [];
}

// ─── Demo ───

export async function seedDemoFinance(): Promise<void> {
  const { count, error } = await supabase.from('income').select('*', { count: 'exact', head: true });
  if (error) throw new Error(`DB query error: ${error.message}`);
  if (count && count > 0) return;

  const clients = await getFinanceClients();
  const c = (i: number) => clients[i]?.id || null;

  await createIncome({ date: '2026-07-15', concept: 'Videoclip - Pago final', amount: 500000, client_id: c(0), category: 'videoclips', payment_method: 'transferencia', status: 'paid' });
  await createIncome({ date: '2026-07-10', concept: 'Mezcla canción', amount: 200000, client_id: c(1), category: 'audio', payment_method: 'transferencia', status: 'paid' });
  await createIncome({ date: '2026-07-05', concept: 'Asesoría marketing', amount: 80000, client_id: c(2), category: 'asesorias', payment_method: 'efectivo', status: 'paid' });
  await createIncome({ date: '2026-07-01', concept: 'Reels paquete - Anticipo', amount: 150000, client_id: c(3), category: 'reels', payment_method: 'transferencia', status: 'partial' });
  await createIncome({ date: '2026-06-28', concept: 'Videoclip - Anticipo', amount: 300000, client_id: c(0), category: 'videoclips', payment_method: 'transferencia', status: 'paid' });

  await createExpense({ date: '2026-07-20', concept: 'Suscripción plugins', amount: 35000, category: 'software', expense_type: 'monthly' });
  await createExpense({ date: '2026-07-15', concept: 'Cafetería reunión', amount: 12000, category: 'movilidad', expense_type: 'one_time' });
  await createExpense({ date: '2026-07-10', concept: 'Hosting servidor', amount: 25000, category: 'servicios', expense_type: 'monthly' });
  await createExpense({ date: '2026-07-05', concept: 'Transporte grabación', amount: 18000, category: 'movilidad', expense_type: 'one_time' });
  await createExpense({ date: '2026-07-01', concept: 'Spotify Premium', amount: 7000, category: 'suscripciones', expense_type: 'monthly' });

  await createQuote({ client_id: c(1), service: 'Mezcla y mastering EP', description: 'Mezcla de 5 canciones + mastering', total: 600000, status: 'sent', validity: '15 días', payment_conditions: '50% anticipo' });
  await createQuote({ client_id: c(2), service: 'Plan de reels mensual', description: '8 reels por mes durante 3 meses', total: 900000, status: 'draft', validity: '7 días' });

  await createReceivable({ client_id: c(3), job_id: null, total_amount: 200000, paid_amount: 150000, balance: 50000, due_date: '2026-08-01', status: 'pending', notes: 'Saldo paquete reels' });
  await createReceivable({ client_id: c(0), job_id: null, total_amount: 500000, paid_amount: 300000, balance: 200000, due_date: '2026-07-15', status: 'overdue', notes: 'Saldo videoclip, ya vencido' });
}
