import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFiles } from '../files/store';
import { useFolder } from '../files/folder';
import { useSettings } from '../../app/settings';
import { useToast } from '../../app/feedback';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { planOrganization, CRITERION_LABEL } from '../../lib/analysis/organize';
import { summarize } from '../../lib/analysis/summary';
import type { CategoryStat, DuplicateGroup, FileEntry } from '../../lib/analysis/types';
import { addHistory } from '../../lib/storage/repos';
import { get, put } from '../../lib/storage/db';
import { formatBytes, plural } from '../../lib/format';

/**
 * Modo automático. Depois que o usuário autoriza a pasta do pendrive uma vez,
 * este vigia confere a cada poucos segundos se ele está encaixado. Quando
 * aparece, executa sozinho: ler → verificar (SHA-256) → duplicados →
 * organizar (opcional) → relatório. Quando some, solta a pasta e espera.
 *
 * Limites honestos do navegador: a primeira autorização sempre exige um toque.
 * No Chrome/Edge do computador, escolha "Permitir em todas as visitas" e as
 * próximas vezes não perguntam. No app Android, o acesso fica salvo. No
 * navegador do celular não existe acesso a pastas: lá o automático não roda.
 */

export type AutoPhase = 'indisponivel' | 'sem-config' | 'aguardando' | 'precisa-toque' | 'executando' | 'pronto' | 'erro';
export type StepKey = 'detectar' | 'ler' | 'verificar' | 'duplicados' | 'organizar' | 'relatorio';
export type StepStatus = 'pendente' | 'andamento' | 'feito' | 'pulado' | 'erro';
export interface Step { key: StepKey; label: string; status: StepStatus; detail?: string }

export interface AutoResult {
  at: number;
  drive: string;
  durationMs: number;
  files: number;
  bytes: number;
  hashed: number;
  groups: number;
  copies: number;
  recoverable: number;
  trashed: number;
  organized: number;
  planned: number;
  plannedFolders: number;
  criterion: string;
  byCategory: CategoryStat[];
  reportId?: string;
}

const STEP_LABEL: Record<StepKey, string> = {
  detectar: 'Detectar o pendrive',
  ler: 'Ler os arquivos',
  verificar: 'Verificar o conteúdo (SHA-256)',
  duplicados: 'Encontrar duplicados',
  organizar: 'Organizar em pastas',
  relatorio: 'Gerar relatório',
};
const ORDER: StepKey[] = ['detectar', 'ler', 'verificar', 'duplicados', 'organizar', 'relatorio'];
const freshSteps = (): Step[] => ORDER.map((key) => ({ key, label: STEP_LABEL[key], status: 'pendente' }));
const LAST_KEY = 'autoUltimo';
const POLL_MS = 3000;
const SETTLE_MS = 1500;

/** Quem fica num grupo de cópias: o mais antigo; empate → caminho mais curto. */
export function pickKeeper(g: DuplicateGroup): FileEntry {
  return [...g.files].sort((a, b) => a.lastModified - b.lastModified || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))[0];
}

interface AutoCtx {
  phase: AutoPhase;
  supported: boolean;
  drive: string | null;
  steps: Step[];
  result: AutoResult | null;
  /** Toque do usuário: configura (escolhe a pasta) ou reconecta, e executa. */
  start: () => Promise<void>;
  /** Escolher outro pendrive/pasta. */
  choose: () => Promise<void>;
  /** Executa de novo agora, com o pendrive já conectado. */
  runNow: () => Promise<void>;
}

const Ctx = createContext<AutoCtx | null>(null);
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export function AutoProvider({ children }: { children: ReactNode }) {
  const files = useFiles();
  const folder = useFolder();
  const { settings } = useSettings();
  const toast = useToast();
  const [phase, setPhase] = useState<AutoPhase>(folder.supported ? 'sem-config' : 'indisponivel');
  const [steps, setSteps] = useState<Step[]>(freshSteps);
  const [result, setResult] = useState<AutoResult | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const running = useRef(false);
  const pendingRun = useRef(false);

  useEffect(() => {
    get<{ key: string; value: AutoResult }>('settings', LAST_KEY).then((r) => r?.value && setResult(r.value)).catch(() => {});
  }, []);

  const mark = (key: StepKey, status: StepStatus, detail?: string) =>
    setSteps((all) => all.map((s) => (s.key === key ? { ...s, status, detail } : s)));

  const run = useCallback(async () => {
    const f = folderRef.current;
    const b = f.backend;
    if (running.current || !b) return;
    running.current = true;
    const s = settingsRef.current;
    const t0 = Date.now();
    let current: StepKey = 'detectar';
    setSteps(freshSteps());
    setPhase('executando');
    const entries = () => filesRef.current.entries.filter((e) => e.source === 'pasta');
    try {
      mark('detectar', 'feito', `“${b.rootName}” encaixado`);

      current = 'ler';
      mark('ler', 'andamento');
      await tick();
      const sum0 = summarize(entries());
      mark('ler', 'feito', `${plural(sum0.count, 'arquivo', 'arquivos')} · ${formatBytes(sum0.bytes)}`);

      current = 'verificar';
      mark('verificar', 'andamento', s.autoDeep ? 'Calculando a impressão digital de cada arquivo…' : 'Só os que podem ser cópias…');
      await filesRef.current.analyze(s.autoDeep ? 'completa' : 'duplicados');
      await tick(250);
      const hashed = entries().filter((e) => e.sha256).length;
      mark('verificar', 'feito', `${plural(hashed, 'arquivo verificado', 'arquivos verificados')}`);

      current = 'duplicados';
      mark('duplicados', 'andamento');
      const dup = findDuplicates(entries());
      const copies = dup.groups.reduce((n, g) => n + g.files.length - 1, 0);
      let trashed = 0;
      if (s.autoTrashDupes && copies) {
        const ids = dup.groups.flatMap((g) => { const keep = pickKeeper(g); return g.files.filter((x) => x.id !== keep.id).map((x) => x.id); });
        trashed = (await folderRef.current.trashItems(ids)).ok;
        await tick(250);
      }
      mark('duplicados', 'feito', copies
        ? `${plural(dup.groups.length, 'grupo', 'grupos')} · ${plural(copies, 'cópia extra', 'cópias extras')} · ${formatBytes(dup.recoverable)} recuperáveis${trashed ? ` · ${trashed} na lixeira do app` : ''}`
        : 'Nenhuma cópia encontrada');

      current = 'organizar';
      mark('organizar', 'andamento');
      const plan = planOrganization(entries(), s.autoCriterion);
      let organized = 0;
      if (s.autoOrganize && plan.operations.length) {
        organized = (await folderRef.current.applyPlan(plan)).ok;
        await tick(250);
        mark('organizar', 'feito', `${plural(organized, 'arquivo movido', 'arquivos movidos')} para ${plural(plan.folders.length, 'pasta', 'pastas')} (${CRITERION_LABEL[s.autoCriterion].toLowerCase()})`);
      } else if (!plan.operations.length) {
        mark('organizar', 'feito', 'Tudo já está no lugar');
      } else {
        mark('organizar', 'pulado', `Plano pronto: ${plural(plan.operations.length, 'arquivo', 'arquivos')} → ${plural(plan.folders.length, 'pasta', 'pastas')}. Mover sozinho está desligado.`);
      }

      current = 'relatorio';
      const reportId = filesRef.current.lastRun?.reportId;
      if (!settingsRef.current.saveHistory) mark('relatorio', 'pulado', 'Histórico desligado nas configurações');
      else if (reportId) mark('relatorio', 'feito', 'Salvo em Relatórios');
      else mark('relatorio', 'pulado', 'Sem arquivos novos para verificar, nenhum relatório novo');

      const sum = summarize(entries());
      const res: AutoResult = {
        at: Date.now(), drive: b.rootName, durationMs: Date.now() - t0,
        files: sum.count, bytes: sum.bytes, hashed: sum.hashed,
        groups: dup.groups.length, copies, recoverable: dup.recoverable, trashed, organized,
        planned: plan.operations.length, plannedFolders: plan.folders.length, criterion: CRITERION_LABEL[s.autoCriterion],
        byCategory: sum.byCategory, reportId,
      };
      setResult(res);
      await put('settings', { key: LAST_KEY, value: res }).catch(() => {});
      if (settingsRef.current.saveHistory) {
        await addHistory({
          type: 'analise', title: `Execução automática em ${b.rootName}`, files: res.files, bytes: res.bytes, durationMs: res.durationMs, result: 'sucesso',
          notes: [`${res.hashed} verificados`, `${res.groups} grupos de duplicados (${formatBytes(res.recoverable)})`, `${res.trashed} cópias na lixeira`, `${res.organized} organizados`],
          reportId,
        }).catch(() => {});
      }
      setPhase('pronto');
      toast({ tone: 'ok', title: `Pendrive “${b.rootName}” pronto`, body: `${plural(res.files, 'arquivo', 'arquivos')} · ${res.groups ? `${plural(res.copies, 'cópia', 'cópias')} encontrada(s)` : 'sem cópias'}${res.organized ? ` · ${res.organized} organizados` : ''}.` });
    } catch (e) {
      mark(current, 'erro', (e as Error).message);
      setPhase('erro');
      toast({ tone: 'erro', title: 'O modo automático parou', body: (e as Error).message });
    } finally {
      running.current = false;
    }
  }, [toast]);

  // Vigia: detecta o pendrive encaixado e removido.
  useEffect(() => {
    if (!folder.supported) return;
    let alive = true;
    let checking = false;
    const check = async () => {
      if (!alive || checking || running.current || document.hidden) return;
      const f = folderRef.current;
      if (f.busy || filesRef.current.run) return;
      checking = true;
      try {
        if (!f.backend) {
          if (!f.remembered) { setPhase((p) => (p === 'executando' ? p : 'sem-config')); return; }
          const r = await f.attach(false);
          if (r === 'conectado') {
            if (settingsRef.current.autoRun) afterConnect(true);
            else setPhase('pronto');
          } else setPhase(r === 'ausente' ? 'aguardando' : r);
        } else if (!(await f.probe())) {
          await f.detach();
          setPhase('aguardando');
          setSteps(freshSteps());
          toast({ tone: 'info', title: 'Pendrive removido', body: 'Encaixe de novo e eu continuo sozinho.' });
        } else {
          setPhase((p) => (p === 'sem-config' || p === 'aguardando' || p === 'precisa-toque' ? 'pronto' : p));
        }
      } finally {
        checking = false;
      }
    };
    check();
    const id = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [folder.supported, toast]);

  // A pasta acabou de ser lida (attach/connect só resolvem depois do scan): espera o estado assentar e roda.
  // `settle`: o pendrive acabou de aparecer sozinho; o sistema pode ainda estar montando.
  // Espera um instante e relê a lista antes de começar.
  const afterConnect = useCallback((settle = false) => {
    pendingRun.current = false;
    const go = async () => {
      if (settle) {
        await tick(SETTLE_MS);
        await folderRef.current.rescan().catch(() => {});
      }
      await tick(60);
      runRef.current();
    };
    void go();
  }, []);
  const runRef = useRef(run);
  runRef.current = run;

  const start = useCallback(async () => {
    const f = folderRef.current;
    if (f.backend) return run();
    const r = f.remembered ? await f.attach(true) : 'sem-config';
    if (r === 'conectado') return afterConnect();
    if (r === 'ausente') {
      setPhase('aguardando');
      toast({ tone: 'info', title: 'Encaixe o pendrive', body: `Assim que “${f.remembered}” aparecer, eu começo sozinho.` });
      return;
    }
    if (await f.connect()) afterConnect();
  }, [run, toast, afterConnect]);

  const choose = useCallback(async () => {
    if (await folderRef.current.connect()) afterConnect();
  }, [afterConnect]);

  const value = useMemo<AutoCtx>(() => ({
    phase, supported: folder.supported, drive: folder.backend?.rootName ?? folder.remembered, steps, result, start, choose, runNow: run,
  }), [phase, folder.supported, folder.backend, folder.remembered, steps, result, start, choose, run]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuto(): AutoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuto fora do AutoProvider');
  return c;
}
