import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { categorize, extensionOf } from '../../lib/analysis/categories';
import { sizeCandidates } from '../../lib/analysis/duplicates';
import { hashFiles } from '../../lib/analysis/hashService';
import type { FileEntry } from '../../lib/analysis/types';
import { isJunkFile } from '../../lib/analysis/junk';
import { addHistory, listLibrary, saveReport, type LibraryRecord, type Report } from '../../lib/storage/repos';
import { clear as clearStore, delMany, putMany, uid } from '../../lib/storage/db';
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

export interface AddResult {
  added: number;
  repeated: number;
  lookalikes: number;
  /** Arquivos de sistema/ocultos deixados de fora. */
  ignored: number;
  /** Itens do registro que voltaram a ter o arquivo aberto. */
  reattached: number;
  /** Contagem por extensão (maiúscula) dos itens novos. */
  byExt: Record<string, number>;
  folders: number;
}

const toRecord = (e: FileEntry): LibraryRecord => ({
  id: e.id, name: e.name, path: e.path, mime: e.mime, size: e.size, lastModified: e.lastModified,
  importedAt: e.importedAt, sha256: e.sha256, hashError: e.hashError,
});

const fromRecord = (r: LibraryRecord): FileEntry => ({
  id: r.id, name: r.name, path: r.path || r.name, ext: extensionOf(r.name), mime: r.mime || '', size: r.size,
  lastModified: r.lastModified, importedAt: r.importedAt, category: categorize(r.name, r.mime || ''),
  sha256: r.sha256, hashError: r.hashError, source: 'registro',
});

interface FilesCtx {
  entries: FileEntry[];
  run: RunState | null;
  lastRun: LastRun | null;
  addFiles: (list: IncomingFile[]) => AddResult;
  remove: (ids: string[]) => void;
  /** Esvazia a lista e o registro guardado neste aparelho. */
  clear: () => void;
  /** Esvazia só a sessão (pasta conectada, p.ex.) e volta ao registro guardado. */
  reset: () => Promise<void>;
  /** Endereço temporário (object URL) para miniatura de imagem; null se não há arquivo aberto. */
  thumbUrl: (id: string) => string | null;
  /** Há arquivo aberto para ler agora (não é só registro)? */
  isReadable: (id: string) => boolean;
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
  const thumbs = useRef(new Map<string, string>());
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const abort = useRef<AbortController | null>(null);
  const { settings, loaded } = useSettings();
  const toast = useToast();
  const externalHasher = useRef<ExternalHasher | null>(null);
  const setExternalHasher = useCallback((fn: ExternalHasher | null) => { externalHasher.current = fn; }, []);
  const saveLibrary = settings.saveLibrary;
  const warned = useRef(false);

  const keyOf = (e: { path: string; size: number; lastModified: number }) => `${e.path}|${e.size}|${e.lastModified}`;

  const forgetThumb = (id: string) => {
    const u = thumbs.current.get(id);
    if (u) URL.revokeObjectURL(u);
    thumbs.current.delete(id);
  };

  /** Guarda só metadados. Falha de armazenamento não derruba a análise: avisa uma vez. */
  const persist = useCallback(async (list: FileEntry[]) => {
    if (!saveLibrary) return;
    const rows = list.filter((e) => e.source === 'selecao' || e.source === 'registro').map(toRecord);
    try {
      await putMany('library', rows);
    } catch (e) {
      if (!warned.current) {
        warned.current = true;
        toast({ tone: 'aviso', title: 'Registro não foi salvo', body: `${(e as Error).message} A análise continua funcionando.` });
      }
    }
  }, [saveLibrary, toast]);

  const loadRegistry = useCallback(async () => {
    try {
      const rows = await listLibrary();
      const restored = rows.map(fromRecord);
      for (const e of restored) keys.current.set(keyOf(e), e.id);
      setEntries((cur) => {
        const have = new Set(cur.map((c) => c.id));
        return [...cur, ...restored.filter((r) => !have.has(r.id))];
      });
    } catch { /* sem armazenamento: segue só com a sessão */ }
  }, []);

  const registryLoaded = useRef(false);
  useEffect(() => {
    if (!loaded || registryLoaded.current) return;
    registryLoaded.current = true;
    if (saveLibrary) loadRegistry();
  }, [loaded, saveLibrary, loadRegistry]);

  useEffect(() => () => { thumbs.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const replaceAll = useCallback((list: { entry: Omit<FileEntry, 'id'>; file?: File }[]) => {
    abort.current?.abort();
    files.current.clear();
    keys.current.clear();
    thumbs.current.forEach((u) => URL.revokeObjectURL(u));
    thumbs.current.clear();
    const fresh = list.map(({ entry, file }) => {
      const id = uid('f');
      if (file) files.current.set(id, file);
      keys.current.set(keyOf(entry), id);
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

  const addFiles = useCallback((list: IncomingFile[]): AddResult => {
    const fresh: FileEntry[] = [];
    const reattachedIds = new Map<string, FileEntry>();
    const byId = new Map(entriesRef.current.map((e) => [e.id, e]));
    const byExt: Record<string, number> = {};
    const dirs = new Set<string>();
    let repeated = 0, lookalikes = 0, ignored = 0;
    const now = Date.now();
    for (const { file, path } of list) {
      const p = path || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      if (isJunkFile(file.name, p)) {
        ignored++;
        continue;
      }
      const key = `${p}|${file.size}|${file.lastModified}`;
      const existingId = keys.current.get(key);
      if (existingId) {
        const existing = byId.get(existingId);
        if (existing?.source === 'registro') {
          // Mesmo arquivo de uma sessão anterior: reabre a leitura sem duplicar o registro.
          files.current.set(existingId, file);
          reattachedIds.set(existingId, { ...existing, source: 'selecao' });
          continue;
        }
        // Com caminho de pasta, é certamente o mesmo arquivo escolhido de novo: ignora.
        // Só com o nome, pode ser uma cópia legítima em outra pasta: mantém e avisa.
        if (p.includes('/')) {
          repeated++;
          continue;
        }
        lookalikes++;
      }
      const id = uid('f');
      keys.current.set(key, id);
      files.current.set(id, file);
      const ext = extensionOf(file.name);
      fresh.push({
        id, name: file.name, path: p, ext, mime: file.type, size: file.size, lastModified: file.lastModified,
        importedAt: now, category: categorize(file.name, file.type), source: 'selecao',
      });
      const label = (ext || 'sem ext.').toUpperCase();
      byExt[label] = (byExt[label] ?? 0) + 1;
      if (p.includes('/')) dirs.add(p.split('/').slice(0, -1).join('/'));
    }
    if (fresh.length || reattachedIds.size) {
      setEntries((cur) => [...cur.map((e) => reattachedIds.get(e.id) ?? e), ...fresh]);
      persist([...fresh, ...reattachedIds.values()]);
    }
    return { added: fresh.length, repeated, lookalikes, ignored, reattached: reattachedIds.size, byExt, folders: dirs.size };
  }, [persist]);

  const remove = useCallback((ids: string[]) => {
    const set = new Set(ids);
    for (const [k, id] of keys.current) if (set.has(id)) keys.current.delete(k);
    ids.forEach((id) => { files.current.delete(id); forgetThumb(id); });
    setEntries((e) => e.filter((x) => !set.has(x.id)));
    delMany('library', ids).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    abort.current?.abort();
    files.current.clear();
    keys.current.clear();
    thumbs.current.forEach((u) => URL.revokeObjectURL(u));
    thumbs.current.clear();
    setEntries([]);
    setLastRun(null);
    clearStore('library').catch(() => {});
  }, []);

  const reset = useCallback(async () => {
    abort.current?.abort();
    files.current.clear();
    keys.current.clear();
    thumbs.current.forEach((u) => URL.revokeObjectURL(u));
    thumbs.current.clear();
    setEntries([]);
    setLastRun(null);
    if (saveLibrary) await loadRegistry();
  }, [saveLibrary, loadRegistry]);

  const cancel = useCallback(() => abort.current?.abort(), []);

  const analyze = useCallback(async (kind: RunKind) => {
    if (abort.current) return;
    const current = entriesRef.current;
    const readable = current.filter((f) => f.source !== 'registro');
    const pool = kind === 'completa' ? readable : sizeCandidates(readable);
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
    persist(finalEntries.filter((f) => all.has(f.id)));
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
  }, [settings.saveHistory, toast, persist]);

  const getFile = useCallback((id: string) => files.current.get(id), []);
  const isReadable = useCallback((id: string) => files.current.has(id), []);
  const thumbUrl = useCallback((id: string) => {
    const cached = thumbs.current.get(id);
    if (cached) return cached;
    const f = files.current.get(id);
    if (!f) return null;
    const u = URL.createObjectURL(f);
    thumbs.current.set(id, u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ entries, run, lastRun, addFiles, remove, clear, reset, thumbUrl, isReadable, analyze, cancel, getFile, replaceAll, patch, setExternalHasher }),
    [entries, run, lastRun, addFiles, remove, clear, reset, thumbUrl, isReadable, analyze, cancel, getFile, replaceAll, patch, setExternalHasher],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFiles() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFiles fora do FilesProvider');
  return c;
}
