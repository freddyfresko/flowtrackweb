import { supabase } from '../supabase';
import { formatDateShort, formatTime } from '../utils/format';

// ─── Backup History ───

export async function getBackups(): Promise<any[]> {
  const { data, error } = await supabase
    .from('backups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);
  return data || [];
}

export async function recordBackup(path: string, description?: string): Promise<void> {
  const { error } = await supabase.from('backups').insert({
    id: crypto.randomUUID(),
    file_path: path,
    size: 0,
    description: description || null,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function deleteBackup(id: string): Promise<void> {
  const { error } = await supabase.from('backups').delete().eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

// ─── Export Functions ───

export interface ExportData {
  version: string;
  exported_at: string;
  clients: any[];
  reels: any[];
  youtube_videos: any[];
  jobs: any[];
  tasks: any[];
  consultancies: any[];
  digital_projects: any[];
  prompts: any[];
  documents: any[];
  work_sessions: any[];
  income: any[];
  expenses: any[];
  quotes: any[];
  receivables: any[];
  settings: any[];
}

const EXPORT_TABLES = [
  'clients', 'reels', 'youtube_videos', 'jobs', 'tasks', 'consultancies',
  'digital_projects', 'prompts', 'documents', 'work_sessions', 'income', 'expenses',
  'quotes', 'receivables', 'settings',
];

export async function exportAllData(): Promise<ExportData> {
  const data: any = { version: '1.0', exported_at: new Date().toISOString() };
  for (const table of EXPORT_TABLES) {
    try {
      const { data: rows } = await supabase.from(table).select('*');
      data[table] = rows || [];
    } catch {
      data[table] = [];
    }
  }
  return data as ExportData;
}

export async function exportTableToCSV(table: string): Promise<string> {
  const { data: rows, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!rows || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row: any) =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ].join('\n');
  return csv;
}

export async function exportTableToMarkdown(table: string): Promise<string> {
  const { data: rows, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!rows || rows.length === 0) return `# ${table}\n\n*Sin datos*\n`;

  const headers = Object.keys(rows[0]);
  let md = `# ${table}\n\n`;
  md += `| ${headers.join(' | ')} |\n`;
  md += `| ${headers.map(() => '---').join(' | ')} |\n`;

  for (const row of rows as any[]) {
    md += `| ${headers.map((h: string) => {
      const val = row[h];
      return val === null || val === undefined ? '-' : String(val).slice(0, 100);
    }).join(' | ')} |\n`;
  }
  md += `\n*Exportado: ${formatDateShort(new Date())} ${formatTime(new Date())}*\n`;
  return md;
}

// ─── Import ───

export async function importData(data: ExportData): Promise<{ tables: string[]; records: number }> {
  let totalRecords = 0;
  for (const table of EXPORT_TABLES) {
    const rows = (data as any)[table];
    if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

    // Clear existing data
    const { error: delErr } = await supabase.from(table).delete().neq('id', '__none__');
    if (delErr) throw new Error(`DB error clearing ${table}: ${delErr.message}`);

    // Insert each row
    for (const row of rows) {
      const { error: insErr } = await supabase.from(table).insert(row);
      if (!insErr) totalRecords++;
    }
  }
  return { tables: EXPORT_TABLES, records: totalRecords };
}

// ─── Download helper ───

export function downloadFile(content: string, filename: string, type: string = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: any, filename: string): void {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCSV(table: string): Promise<void> {
  return exportTableToCSV(table).then(csv => {
    if (csv) downloadFile(csv, `flowtrack-${table}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  });
}

export function downloadMarkdown(table: string): Promise<void> {
  return exportTableToMarkdown(table).then(md => {
    if (md) downloadFile(md, `flowtrack-${table}-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown');
  });
}
