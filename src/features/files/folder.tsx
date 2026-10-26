import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFiles } from './store';
import { categorize, extensionOf } from '../../lib/analysis/categories';
import type { FileEntry } from '../../lib/analysis/types';
import type { OrganizationPlan } from '../../lib/analysis/organize';
import { FsOpError, splitPath, type FolderBackend, type TrashItem } from '../../lib/files/backend';
import { WebFolderBackend, pickFolder, supportsFolderAccess, type DirHandle } from '../../lib/files/webFolder';
import { isNativeAndroid, pickAndroidFolder, restoreAndroidFolder } from '../../lib/files/androidFolder';
import { addHistory, saveReport } from '../../lib/storage/repos';
import { del, get, put } from '../../lib/storage/db';
import { useSettings } from '../../app/settings';
import { useToast } from '../../app/feedback';
import { buildPlanReport } from './report';
import { formatBytes, plural } from '../../lib/format';

/** Operação reversível guardada para "Desfazer". */
type UndoOp =
  | { kind: 'move'; label: string; items: { id: string; from: string; to: string }[] }
  | { kind: 'trash'; label: string; items: { id: string; trash: TrashItem }[] };

export interface BatchResult {
  ok: number;
  failed: { path: string; error: string }[];
}

interface FolderCtx {
  backend: FolderBackend | null;
  supported: boolean;
  remembered: string | null;
  busy: { label: string; done: number; total: number } | null;
  trash: TrashItem[];
  undoLabel: string | null;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  rescan: () => Promise<void>;
  rename: (id: string, newName: string) => Promise<boolean>;
  move: (ids: string[], destDir: string) => Promise<BatchResult>;
  trashItems: (ids: string[]) => Promise<BatchResult>;
  destroy: (ids: string[]) => Promise<BatchResult>;
  mkdir: (path: string) => Promise<boolean>;
  restore: (items: TrashItem[]) => Promise<BatchResult>;
  purge: (items: TrashItem[]) => Promise<BatchResult>;
  applyPlan: (plan: OrganizationPlan) => Promise<BatchResult>;
  undo: () => Promise<void>;
  refreshTrash: () => Promise<void>;
}

const Ctx = createContext<FolderCtx | null>(null);
const REMEMBER_KEY = 'pastaConectada';

export function FolderProvider({ children }: { children: ReactNode }) {
  const files = useFiles();
  const { settings } = useSettings();
  const toast = useToast();
  const [backend, setBackend] = useState<FolderBackend | null>(null);
  const [remembered, setRemembered] = useState<string | null>(null);
  const [busy, setBusy] = useState<FolderCtx['busy']>(null);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [undoStack, setUndoStack] = useState<UndoOp[]>([]);
  const entriesRef = useRef(files.entries);
  entriesRef.current = files.entries;
  const supported = isNativeAndroid() || supportsFolderAccess();

  const log = useCallback(async (title: string, r: BatchResult, bytes: number, extra: string[] = []) => {
    if (!settings.saveHistory) return;
    await addHistory({
      type: 'arquivos', title, files: r.ok + r.failed.length, bytes, durationMs: 0,
      result: r.failed.length ? (r.ok ? 'parcial' : 'erro') : 'sucesso',
      notes: [...extra, ...r.failed.slice(0, 30).map((f) => `${f.path}: ${f.error}`)],
    }).catch(() => {});
  }, [settings.saveHistory]);

  const load = useCallback(async (b: FolderBackend) => {
    setBusy({ label: `Lendo ${b.rootName}`, done: 0, total: 0 });
    try {
      const list = await b.scan({ onProgress: (n) => setBusy({ label: `Lendo ${b.rootName}`, done: n, total: 0 }) });
      files.replaceAll(list.map((f) => ({
        entry: {
          name: f.name, path: f.path, ext: extensionOf(f.name), mime: f.mime, size: f.size,
          lastModified: f.lastModified, category: categorize(f.name, f.mime), source: 'pasta' as const,
        },
        file: f.file,
      })));
      setTrash(await b.listTrash());
      setUndoStack([]);
      return list.length;
    } finally {
      setBusy(null);
    }
  }, [files]);

  // Android: o hash é calculado no nativo, sem passar o arquivo pela WebView.
  useEffect(() => {
    if (backend?.sha256) {
      const b = backend;
      files.setExternalHasher((id, onProgress) => {
        const e = entriesRef.current.find((x) => x.id === id);
        if (!e) return Promise.reject(new Error('Item não está mais na lista.'));
        return b.sha256!(e.path, onProgress);
      });
    } else files.setExternalHasher(null);
  }, [backend, files]);

  useEffect(() => {
    get<{ key: string; value: { name: string } }>('settings', REMEMBER_KEY)
      .then((r) => setRemembered(r?.value?.name ?? null))
      .catch(() => {});
  }, []);

  const activate = useCallback(async (b: FolderBackend, handle?: DirHandle | string) => {
    if (!(await b.ensurePermission())) {
      toast({ tone: 'erro', title: 'Permissão negada', body: 'Sem permissão de escrita, o app não consegue renomear nem apagar nesta pasta.' });
      return;
    }
    setBackend(b);
    const n = await load(b);
    if (handle) await put('settings', { key: REMEMBER_KEY, value: { name: b.rootName, handle } }).catch(() => {});
    setRemembered(b.rootName);
    toast({ tone: 'ok', title: `Pasta “${b.rootName}” conectada`, body: `${plural(n, 'arquivo encontrado', 'arquivos encontrados')}. Agora dá para renomear, mover e apagar.` });
  }, [load, toast]);

  const connect = useCallback(async () => {
    try {
      if (isNativeAndroid()) {
        const { backend: b, uri } = await pickAndroidFolder();
        await activate(b, uri);
      } else {
        const h = await pickFolder();
        await activate(new WebFolderBackend(h), h);
      }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError' || /cancel/i.test((e as Error).message)) return;
      toast({ tone: 'erro', title: 'Não foi possível conectar a pasta', body: (e as Error).message });
    }
  }, [activate, toast]);

  const reconnect = useCallback(async () => {
    try {
      const r = await get<{ key: string; value: { name: string; handle: DirHandle | string } }>('settings', REMEMBER_KEY);
      if (!r?.value?.handle) return connect();
      const b = typeof r.value.handle === 'string' ? await restoreAndroidFolder(r.value.handle, r.value.name) : new WebFolderBackend(r.value.handle);
      await activate(b);
    } catch (e) {
      toast({ tone: 'erro', title: 'Não deu para reconectar', body: `${(e as Error).message} Escolha a pasta de novo.` });
    }
  }, [activate, connect, toast]);

  const disconnect = useCallback(async () => {
    setBackend(null);
    setTrash([]);
    setUndoStack([]);
    files.clear();
    await del('settings', REMEMBER_KEY).catch(() => {});
    setRemembered(null);
  }, [files]);

  const rescan = useCallback(async () => {
    if (backend) await load(backend);
  }, [backend, load]);

  const refreshTrash = useCallback(async () => {
    if (backend) setTrash(await backend.listTrash());
  }, [backend]);

  /** Após mover/renomear: atualiza nome, caminho, categoria; o hash continua válido (conteúdo é o mesmo). */
  const relocate = useCallback(async (b: FolderBackend, e: FileEntry, newPath: string) => {
    const { name } = splitPath(newPath);
    let file: File | undefined;
    if (b.kind === 'web') file = (await b.getBlob(newPath).catch(() => undefined)) as File | undefined;
    files.patch(e.id, { path: newPath, name, ext: extensionOf(name), category: categorize(name, e.mime) }, file);
  }, [files]);

  const batch = useCallback(async (label: string, ids: string[], fn: (e: FileEntry) => Promise<void>): Promise<BatchResult> => {
    const list = entriesRef.current.filter((e) => ids.includes(e.id));
    const r: BatchResult = { ok: 0, failed: [] };
    setBusy({ label, done: 0, total: list.length });
    for (const [i, e] of list.entries()) {
      try {
        await fn(e);
        r.ok++;
      } catch (err) {
        r.failed.push({ path: e.path, error: (err as Error).message });
      }
      setBusy({ label, done: i + 1, total: list.length });
    }
    setBusy(null);
    return r;
  }, []);

  const requireBackend = useCallback(() => {
    if (!backend) throw new FsOpError('permissao', 'Conecte uma pasta primeiro.');
    return backend;
  }, [backend]);

  const report = useCallback((r: BatchResult, okMsg: string) => {
    if (!r.failed.length) toast({ tone: 'ok', title: okMsg });
    else toast({ tone: r.ok ? 'aviso' : 'erro', title: r.ok ? `${okMsg} (com falhas)` : 'Nada foi alterado', body: `${r.failed.length} problema(s): ${r.failed[0].error}` });
  }, [toast]);

  const rename = useCallback(async (id: string, newName: string) => {
    const b = requireBackend();
    const e = entriesRef.current.find((x) => x.id === id);
    if (!e) return false;
    try {
      const to = await b.rename(e.path, newName);
      await relocate(b, e, to);
      setUndoStack((s) => [...s.slice(-19), { kind: 'move', label: `renomear “${e.name}”`, items: [{ id, from: e.path, to }] }]);
      await log(`Renomeou ${e.name} → ${newName}`, { ok: 1, failed: [] }, e.size, [`${e.path} → ${to}`]);
      toast({ tone: 'ok', title: 'Renomeado', body: `${e.name} → ${newName}` });
      return true;
    } catch (err) {
      toast({ tone: 'erro', title: 'Não foi possível renomear', body: (err as Error).message });
      return false;
    }
  }, [requireBackend, relocate, log, toast]);

  const move = useCallback(async (ids: string[], destDir: string) => {
    const b = requireBackend();
    const done: { id: string; from: string; to: string }[] = [];
    let bytes = 0;
    const r = await batch(`Movendo para ${destDir || b.rootName}`, ids, async (e) => {
      const to = await b.move(e.path, destDir);
      await relocate(b, e, to);
      done.push({ id: e.id, from: e.path, to });
      bytes += e.size;
    });
    if (done.length) setUndoStack((s) => [...s.slice(-19), { kind: 'move', label: `mover ${plural(done.length, 'arquivo', 'arquivos')}`, items: done }]);
    await log(`Moveu ${plural(r.ok, 'arquivo', 'arquivos')} para ${destDir || '(raiz)'}`, r, bytes, done.slice(0, 30).map((d) => `${d.from} → ${d.to}`));
    report(r, `${plural(r.ok, 'arquivo movido', 'arquivos movidos')}`);
    return r;
  }, [requireBackend, batch, relocate, log, report]);

  const trashItems = useCallback(async (ids: string[]) => {
    const b = requireBackend();
    const done: { id: string; trash: TrashItem }[] = [];
    let bytes = 0;
    const r = await batch('Movendo para a lixeira', ids, async (e) => {
      const item = await b.trash(e.path);
      done.push({ id: e.id, trash: item });
      bytes += e.size;
    });
    files.remove(done.map((d) => d.id));
    if (done.length) setUndoStack((s) => [...s.slice(-19), { kind: 'trash', label: `lixeira de ${plural(done.length, 'arquivo', 'arquivos')}`, items: done }]);
    setTrash(await b.listTrash());
    await log(`Enviou ${plural(r.ok, 'arquivo', 'arquivos')} para a lixeira`, r, bytes, done.slice(0, 30).map((d) => d.trash.original));
    report(r, `${plural(r.ok, 'arquivo foi', 'arquivos foram')} para a lixeira`);
    return r;
  }, [requireBackend, batch, files, log, report]);

  const destroy = useCallback(async (ids: string[]) => {
    const b = requireBackend();
    const gone: string[] = [];
    let bytes = 0;
    const r = await batch('Apagando definitivamente', ids, async (e) => {
      await b.remove(e.path);
      gone.push(e.id);
      bytes += e.size;
    });
    files.remove(gone);
    await log(`Apagou definitivamente ${plural(r.ok, 'arquivo', 'arquivos')}`, r, bytes, [`${formatBytes(bytes)} liberados.`]);
    report(r, `${plural(r.ok, 'arquivo apagado', 'arquivos apagados')} (${formatBytes(bytes)} liberados)`);
    return r;
  }, [requireBackend, batch, files, log, report]);

  const mkdir = useCallback(async (path: string) => {
    const b = requireBackend();
    try {
      await b.mkdir(path);
      await log(`Criou a pasta ${path}`, { ok: 1, failed: [] }, 0);
      toast({ tone: 'ok', title: 'Pasta criada', body: path });
      return true;
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível criar a pasta', body: (e as Error).message });
      return false;
    }
  }, [requireBackend, log, toast]);

  const restore = useCallback(async (items: TrashItem[]) => {
    const b = requireBackend();
    const r: BatchResult = { ok: 0, failed: [] };
    setBusy({ label: 'Restaurando', done: 0, total: items.length });
    for (const [i, it] of items.entries()) {
      try {
        await b.restore(it);
        r.ok++;
      } catch (e) {
        r.failed.push({ path: it.original, error: (e as Error).message });
      }
      setBusy({ label: 'Restaurando', done: i + 1, total: items.length });
    }
    setBusy(null);
    await log(`Restaurou ${plural(r.ok, 'arquivo', 'arquivos')} da lixeira`, r, items.reduce((s, i) => s + i.size, 0));
    await load(b);
    report(r, `${plural(r.ok, 'arquivo restaurado', 'arquivos restaurados')}`);
    return r;
  }, [requireBackend, log, load, report]);

  const purge = useCallback(async (items: TrashItem[]) => {
    const b = requireBackend();
    const r: BatchResult = { ok: 0, failed: [] };
    for (const it of items) {
      try {
        await b.purge(it);
        r.ok++;
      } catch (e) {
        r.failed.push({ path: it.original, error: (e as Error).message });
      }
    }
    setTrash(await b.listTrash());
    const bytes = items.reduce((s, i) => s + i.size, 0);
    await log(`Esvaziou ${plural(r.ok, 'item', 'itens')} da lixeira`, r, bytes, [`${formatBytes(bytes)} liberados.`]);
    report(r, `${plural(r.ok, 'item apagado', 'itens apagados')} de vez`);
    return r;
  }, [requireBackend, log, report]);

  const applyPlan = useCallback(async (plan: OrganizationPlan) => {
    const b = requireBackend();
    const t0 = Date.now();
    const byId = new Map(plan.operations.map((o) => [o.fileId, o]));
    const done: { id: string; from: string; to: string }[] = [];
    const r = await batch('Organizando', plan.operations.map((o) => o.fileId), async (e) => {
      const op = byId.get(e.id)!;
      const { dir, name } = splitPath(op.to);
      const to = await b.move(e.path, dir, name);
      await relocate(b, e, to);
      done.push({ id: e.id, from: e.path, to });
    });
    if (done.length) setUndoStack((s) => [...s.slice(-19), { kind: 'move', label: `organização (${plural(done.length, 'arquivo', 'arquivos')})`, items: done }]);
    if (settings.saveHistory) {
      const rep = await saveReport({ ...buildPlanReport(plan, entriesRef.current, { done: r.ok, failed: r.failed.map((f) => `${f.path}: ${f.error}`) }), title: `Organização aplicada: ${plural(r.ok, 'arquivo movido', 'arquivos movidos')}`, limitations: ['Arquivos foram MOVIDOS dentro da pasta conectada. Use “Desfazer” na sessão para voltar.', ...r.failed.map((f) => `${f.path}: ${f.error}`)] }).catch(() => undefined);
      await addHistory({ type: 'organizacao', title: `Organização aplicada em ${b.rootName}`, files: plan.totalFiles, bytes: plan.totalBytes, durationMs: Date.now() - t0, result: r.failed.length ? (r.ok ? 'parcial' : 'erro') : 'sucesso', notes: [`${r.ok} movidos.`, ...r.failed.slice(0, 20).map((f) => `${f.path}: ${f.error}`)], reportId: rep?.id }).catch(() => {});
    }
    report(r, `Organização aplicada: ${plural(r.ok, 'arquivo movido', 'arquivos movidos')}`);
    return r;
  }, [requireBackend, batch, relocate, settings.saveHistory, report]);

  const undo = useCallback(async () => {
    const b = requireBackend();
    const op = undoStack[undoStack.length - 1];
    if (!op) return;
    setUndoStack((s) => s.slice(0, -1));
    const r: BatchResult = { ok: 0, failed: [] };
    if (op.kind === 'move') {
      for (const it of [...op.items].reverse()) {
        try {
          const { dir, name } = splitPath(it.from);
          const back = await b.move(it.to, dir, name);
          const e = entriesRef.current.find((x) => x.id === it.id);
          if (e) await relocate(b, { ...e, path: it.to }, back);
          r.ok++;
        } catch (e) {
          r.failed.push({ path: it.to, error: (e as Error).message });
        }
      }
    } else {
      for (const it of op.items) {
        try {
          await b.restore(it.trash);
          r.ok++;
        } catch (e) {
          r.failed.push({ path: it.trash.original, error: (e as Error).message });
        }
      }
      await load(b);
    }
    await log(`Desfez: ${op.label}`, r, 0);
    report(r, `Desfeito: ${op.label}`);
  }, [requireBackend, undoStack, relocate, load, log, report]);

  const value = useMemo<FolderCtx>(() => ({
    backend, supported, remembered, busy, trash, undoLabel: undoStack.at(-1)?.label ?? null,
    connect, reconnect, disconnect, rescan, rename, move, trashItems, destroy, mkdir, restore, purge, applyPlan, undo, refreshTrash,
  }), [backend, supported, remembered, busy, trash, undoStack, connect, reconnect, disconnect, rescan, rename, move, trashItems, destroy, mkdir, restore, purge, applyPlan, undo, refreshTrash]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFolder() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFolder fora do FolderProvider');
  return c;
}
