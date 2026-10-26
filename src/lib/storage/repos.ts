import { del, get, getAll, put, uid } from './db';

/* ---------- Histórico ---------- */
export type HistoryType = 'arquivos' | 'analise' | 'duplicados' | 'hash' | 'verificacao' | 'organizacao' | 'criptografia' | 'descriptografia' | 'exportacao' | 'dados';
export type HistoryResult = 'sucesso' | 'parcial' | 'cancelado' | 'erro';

export const HISTORY_LABEL: Record<HistoryType, string> = {
  arquivos: 'Gerenciamento de arquivos',
  analise: 'Análise de arquivos',
  duplicados: 'Busca de duplicados',
  hash: 'Cálculo de hash',
  verificacao: 'Verificação de integridade',
  organizacao: 'Organização',
  criptografia: 'Criptografia',
  descriptografia: 'Abertura de cofre',
  exportacao: 'Exportação',
  dados: 'Dados locais',
};

export interface HistoryEntry {
  id: string;
  at: number;
  type: HistoryType;
  title: string;
  files: number;
  bytes: number;
  durationMs: number;
  result: HistoryResult;
  notes: string[];
  reportId?: string;
}

export async function addHistory(e: Omit<HistoryEntry, 'id' | 'at'> & { at?: number }): Promise<HistoryEntry> {
  const entry: HistoryEntry = { ...e, id: uid('h'), at: e.at ?? Date.now() };
  await put('history', entry);
  return entry;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  return (await getAll<HistoryEntry>('history')).sort((a, b) => b.at - a.at);
}

export const deleteHistory = (id: string) => del('history', id);

/* ---------- Relatórios ---------- */
export type ReportKind = 'analise' | 'duplicados' | 'organizacao' | 'integridade';

export interface ReportFileRow {
  nome: string;
  caminho: string;
  categoria: string;
  extensao: string;
  bytes: number;
  modificado: string;
  sha256: string;
  observacao: string;
}

export interface Report {
  id: string;
  at: number;
  kind: ReportKind;
  title: string;
  /** Números calculados no momento da análise. */
  totals: Record<string, number>;
  byCategory?: { category: string; count: number; bytes: number }[];
  byExtension?: { ext: string; count: number; bytes: number }[];
  duplicateGroups?: { sha256: string; size: number; files: string[] }[];
  folders?: { folder: string; count: number; bytes: number }[];
  rows: ReportFileRow[];
  limitations: string[];
  source: string;
}

export async function saveReport(r: Omit<Report, 'id' | 'at'>): Promise<Report> {
  const report: Report = { ...r, id: uid('r'), at: Date.now() };
  await put('reports', report);
  return report;
}

export async function listReports(): Promise<Report[]> {
  return (await getAll<Report>('reports')).sort((a, b) => b.at - a.at);
}

export const getReport = (id: string) => get<Report>('reports', id);
export const deleteReport = (id: string) => del('reports', id);

/* ---------- Referências de integridade ---------- */
export interface IntegrityRef {
  id: string;
  at: number;
  name: string;
  size: number;
  sha256: string;
  label: string;
  lastCheck?: { at: number; ok: boolean };
}

export async function saveIntegrityRef(r: Omit<IntegrityRef, 'id' | 'at'>): Promise<IntegrityRef> {
  const ref: IntegrityRef = { ...r, id: uid('i'), at: Date.now() };
  await put('integrity', ref);
  return ref;
}

export const updateIntegrityRef = (r: IntegrityRef) => put('integrity', r);
export async function listIntegrityRefs(): Promise<IntegrityRef[]> {
  return (await getAll<IntegrityRef>('integrity')).sort((a, b) => b.at - a.at);
}
export const deleteIntegrityRef = (id: string) => del('integrity', id);

/* ---------- Configurações ---------- */
export interface Settings {
  intro: boolean;
  motion: 'sistema' | 'reduzido' | 'completo';
  quality: 'auto' | 'economia' | 'alta';
  saveHistory: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  intro: true,
  motion: 'sistema',
  quality: 'auto',
  saveHistory: true,
};

export async function loadSettings(): Promise<Settings> {
  const row = await get<{ key: string; value: Partial<Settings> }>('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await put('settings', { key: 'app', value: s });
}
