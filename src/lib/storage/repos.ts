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
  /** 'automatico' respeita o desenho de cada página; claro/escuro forçam todas. */
  theme: 'automatico' | 'claro' | 'escuro';
  /** Guarda o registro (nome, tamanho, hash) dos arquivos importados; nunca o conteúdo. */
  saveLibrary: boolean;
  /** Assistente (Vigia IA) visível. */
  assistant: boolean;
  /** Modelo de IA que roda no próprio aparelho (WebLLM). */
  aiModel: string;
  /** Modelo que já foi baixado e carregado com sucesso neste aparelho. */
  aiInstalled: string | null;
  /** IA online grátis (gpt-oss-20b via Pollinations) autorizada pelo usuário. */
  aiOnline: boolean;
  /** Seu nome (o assistente usa para falar com você). */
  userName: string;
  /** Como o assistente deve te chamar (ex.: "Enrique", "chefe", "senhor"). Vazio = pelo nome. */
  userCall: string;
  /** Concordância: masculino, feminino ou neutro. */
  userGender: 'masculino' | 'feminino' | 'neutro';
  /** Nome do assistente (padrão: Vigia). */
  aiName: string;
  /** Aparência personalizada (vazio/padrão = desenho original). */
  uiAccent: string;
  uiRadius: 'reto' | 'padrao' | 'redondo';
  uiFont: number;
  uiBackdrop: 'forte' | 'suave' | 'desligado';
  /** O Vigia fala as respostas em voz alta. */
  aiVoice: boolean;
  /** Deixa a IA ler o conteúdo dos arquivos sem pedir confirmação a cada vez. */
  aiAutoRead: boolean;
  /** Modo automático: ao detectar o pendrive, executa as etapas sozinho. */
  autoRun: boolean;
  /** Verificação completa (SHA-256 de tudo) em vez de só candidatos a duplicado. */
  autoDeep: boolean;
  /** Organiza em pastas sozinho (reversível com Desfazer). Desligado por padrão. */
  autoOrganize: boolean;
  autoCriterion: 'categoria' | 'extensao' | 'categoria-ano' | 'ano-mes' | 'tamanho';
  /** Manda as cópias extras para a lixeira do app (restaurável). Desligado por padrão. */
  autoTrashDupes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  intro: true,
  motion: 'sistema',
  quality: 'auto',
  saveHistory: true,
  theme: 'automatico',
  saveLibrary: true,
  assistant: true,
  aiModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  aiInstalled: null,
  aiOnline: false,
  aiVoice: false,
  aiAutoRead: false,
  uiAccent: '',
  uiRadius: 'padrao',
  uiFont: 1,
  uiBackdrop: 'forte',
  userName: '',
  userCall: '',
  userGender: 'neutro',
  aiName: 'Vigia',
  autoRun: true,
  autoDeep: true,
  autoOrganize: false,
  autoCriterion: 'categoria',
  autoTrashDupes: false,
};

export async function loadSettings(): Promise<Settings> {
  const row = await get<{ key: string; value: Partial<Settings> }>('settings', 'app');
  const s = { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  // Versões antigas usavam o Claude: troca pelo modelo grátis e apaga a chave guardada.
  if (s.aiModel.startsWith('claude')) {
    s.aiModel = DEFAULT_SETTINGS.aiModel;
    forgetOldApiKey();
  }
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  await put('settings', { key: 'app', value: s });
}

/* ---------- Biblioteca (registro de arquivos; nunca o conteúdo) ---------- */
export interface LibraryRecord {
  id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  lastModified: number;
  importedAt: number;
  sha256?: string;
  hashError?: string;
}

export const listLibrary = () => getAll<LibraryRecord>('library');

/* ---------- Chave antiga da API (versões anteriores) ---------- */
/** Linha que versões antigas usavam para a chave da Anthropic. Não é mais usada: apagamos e nunca exportamos. */
export const API_KEY_ROW = 'anthropicKey';
export const forgetOldApiKey = () => del('settings', API_KEY_ROW).catch(() => {});
