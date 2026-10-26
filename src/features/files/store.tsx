import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { categorize, extensionOf } from '../../lib/analysis/categories';
import { sizeCandidates } from '../../lib/analysis/duplicates';
import { hashFiles } from '../../lib/analysis/hashService';
import type { FileEntry } from '../../lib/analysis/types';
import { addHistory, saveReport, type Report } from '../../lib/storage/repos';
import { useSettings } from '../../app/settings';
import { useToast } from '../../app/feedback';
import { buildAnalysisReport } from './report';
import { formatBytes, plural } from '../../lib/format';

export type RunKind = 'completa' | 'duplicados';

export interface RunState {
  kind: RunKind;
  startedAt: number;
  doneBytes: number;
  totalBytes: number;
  filesDone: number;
  filesTotal: number;
}

export interface LastRun {
  kind: RunKind;
  at: number;
  durationMs: number;
  cancelled: boolean;
  reportId?: string;
}

export interface IncomingFile {
  file: File;
  path?: string;
}

interface FilesCtx {
  entries: FileEntry[];
  run: RunState | null;
  lastRun: LastRun | null;
  addFiles: (list: IncomingFile[]) => { added: number; repeated: number; lookalikes: number };
  remove: (ids: string[]) => void;
  clear: () => void;
  analyze: (kind: RunKind) => Promise<void>;
  cancel: () => void;
  getFile: (id: string) => File | undefined;
  /** Substitui a lista inteira (usado ao conectar uma pasta). */
  replaceAll: (list: { entry: Omit<FileEntry, 'id'>; file?: File }[]) => string[];
  /** Atualiza um item após renomear/mover, opcionalmente com o novo File. */
  patch: (id: string, patch: Partial<FileEntry>, file?: File) => void;
  /** Hash alternativo para itens sem File (ex.: Android nativo). */
  setExternalHasher: (fn: ExternalHasher | null) => void;
}

export type ExternalHasher = (id: string, onProgress: (bytes: number) => void) => Promise<string>;

const Ctx = createContext<FilesCtx | null>(null);

export function FilesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const files = useRef(new Map<string, File>());
  const keys = useRef(new Map<string, string>()); // identidade → id
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const { settings } = useSettings();
  const toast = useToast();
  const externalHasher = useRef<ExternalHasher | null>(null);
  const setExternalHasher = useCallback((fn: ExternalHasher | null) => { externalHasher.current = fn; }, []);

  const replaceAll = useCallback((list: { entry: Omit<FileEntry, 'id'>; file?: File }[]) => {
    abort.current?.abort();
    files.current.clear();
    keys.current.clear();
    const fresh = list.map(({ entry, file }) => {
      const id = `f${++seq.current}`;
      if (file) files.current.set(id, file);
      keys.current.set(`${entry.path}|${entry.size}|${entry.lastModified}`, id);
      return { ...entry, id };
    });
    setEntries(fresh);
    setLastRun(null);
    return fresh.map((f) => f.id);
  }, []);

  const patch = useCallback((id: string, p: Partial<FileEntry>, file?: File) => {
    if (file) files.current.set(id, file);
    setEntries((list) => list.map((f) => (f.id === id ? { ...f, ...p } : f)));
  }, []);

  const addFiles = useCallback((list: IncomingFile[]) => {
    const fresh: FileEntry[] = [];
    let repeated = 0;
    let lookalikes = 0;
    for (const { file, path } of list) {
      const p = path || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const key = `${p}|${file.size}|${file.lastModified}`;
      if (keys.current.has(key)) {
        // Com caminho de pasta, é certamente o mesmo arquivo escolhido de novo: ignora.
        // Só com o nome, pode ser uma cópia legítima em outra pasta: mantém e avisa.
        if (p.includes('/')) {
          repeated++;
          continue;
        }
        lookalikes++;
      }
      const id = `f${++seq.current}`;
      keys.current.set(key, id);
      files.current.set(id, file);
      fresh.push({
        id, name: file.name, path: p, ext: extensionOf(file.name), mime: file.type, size: file.size,
        lastModified: file.lastModified, category: categorize(file.name, file.type),
      });
    }
    if (fresh.length) setEntries((e) => [...e, ...fresh]);
    return { added: fresh.length, repeated, lookalikes };
  }, []);

  const remove = useCallback((ids: string[]) => {
    const set = new Set(ids);
    for (const [k, id] of keys.current) if (set.has(id)) keys.current.delete(k);
    ids.forEach((id) => files.current.delete(id));
    setEntries((e) => e.filter((x) => !set.has(x.id)));
  }, []);

  const clear = useCallback(() => {
    abort.current?.abort();
    files.current.clear();
    keys.current.clear();
    setEntries([]);
    setLastRun(null);
  }, []);

  const cancel = useCallback(() => abort.current?.abort(), []);

  const analyze = useCallback(async (kind: RunKind) => {
    if (abort.current) return;
    const current = entriesRef.current;
    const pool = kind === 'completa' ? current : sizeCandidates(current);
    const hasher = externalHasher.current;
    const jobs = pool
      .filter((f) => !f.sha256 && (files.current.has(f.id) || hasher))
      .map((f) => {
        const file = files.current.get(f.id);
        return file ? { id: f.id, file, size: f.size } : { id: f.id, size: f.size, hasher: (cb: (b: number) => void) => hasher!(f.id, cb) };
      });
    const ctrl = new AbortController();
    abort.current = ctrl;
    const startedAt = Date.now();
    const totalBytes = jobs.reduce((s, j) => s + j.size, 0);
    setRun({ kind, startedAt, doneBytes: 0, totalBytes, filesDone: 0, filesTotal: jobs.length });

    // Resultados chegam aos milhares: acumula e aplica em lotes.
    const pending = new Map<string, { sha256?: string; error?: string }>();
    const all = new Map<string, { sha256?: string; error?: string }>();
    let filesDone = 0;
    const flush = () => {
      if (!pending.size) return;
      const batch = new Map(pending);
      pending.clear();
      setEntries((list) => list.map((f) => {
        const r = batch.get(f.id);
        return r ? { ...f, sha256: r.sha256, hashError: r.error } : f;
      }));
    };
    const timer = setInterval(flush, 150);
    const { cancelled } = await hashFiles(jobs, {
      signal: ctrl.signal,
      onProgress: (doneBytes) => setRun((r) => (r ? { ...r, doneBytes } : r)),
      onResult: (id, r) => {
        pending.set(id, r);
        all.set(id, r);
        filesDone++;
        setRun((s) => (s ? { ...s, filesDone } : s));
      },
    });
    clearInterval(timer);
    // Reaplica todos os resultados desta rodada (idempotente) sobre o estado atual.
    pending.clear();
    const finalEntries = entriesRef.current.map((f) => {
      const r = all.get(f.id);
      return r ? { ...f, sha256: r.sha256, hashError: r.error } : f;
    });
    setEntries(finalEntries);
    abort.current = null;
    setRun(null);
    const durationMs = Date.now() - startedAt;

    let report: Report | undefined;
    const errors = finalEntries.filter((f) => f.hashError).length;
    if (settings.saveHistory) {
      try {
        report = await saveReport(buildAnalysisReport(finalEntries, kind, cancelled));
        await addHistory({
          type: kind === 'completa' ? 'analise' : 'duplicados',
          title: report.title,
          files: finalEntries.length,
          bytes: finalEntries.reduce((s, f) => s + f.size, 0),
          durationMs,
          result: cancelled ? 'cancelado' : errors ? 'parcial' : 'sucesso',
          notes: [
            `${plural(filesDone, 'arquivo lido', 'arquivos lidos')} (${formatBytes(totalBytes)}) para cálculo de hash.`,
            ...(errors ? [`${errors} arquivo(s) com erro de leitura.`] : []),
            ...(cancelled ? ['Cancelada pelo usuário.'] : []),
          ],
          reportId: report.id,
        });
      } catch (e) {
        toast({ tone: 'erro', title: 'Análise feita, mas não foi salva', body: (e as Error).message });
      }
    }
    setLastRun({ kind, at: Date.now(), durationMs, cancelled, reportId: report?.id });
    if (cancelled) toast({ tone: 'aviso', title: 'Análise cancelada', body: `${plural(filesDone, 'arquivo concluído', 'arquivos concluídos')} antes da parada. Os resultados parciais continuam na tela.` });
    else toast({ tone: errors ? 'aviso' : 'ok', title: 'Análise concluída', body: errors ? `${errors} arquivo(s) não puderam ser lidos.` : `${plural(jobs.length, 'arquivo lido', 'arquivos lidos')} em ${(durationMs / 1000).toFixed(1)} s.` });
  }, [settings.saveHistory, toast]);

  const getFile = useCallback((id: string) => files.current.get(id), []);

  const value = useMemo(
    () => ({ entries, run, lastRun, addFiles, remove, clear, analyze, cancel, getFile, replaceAll, patch, setExternalHasher }),
    [entries, run, lastRun, addFiles, remove, clear, analyze, cancel, getFile, replaceAll, patch, setExternalHasher],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFiles() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFiles fora do FilesProvider');
  return c;
}
