import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Copy, Download, FileText, Folder, Save, Square } from 'lucide-react';
import { useFiles } from './store';
import { CRITERION_LABEL, planOrganization, planToInstructions, type OrganizeCriterion } from '../../lib/analysis/organize';
import { formatBytes, formatInt, plural } from '../../lib/format';
import { saveCSV, saveText, stamp } from '../../lib/export';
import { useConfirm, useToast } from '../../app/feedback';
import { addHistory, saveReport } from '../../lib/storage/repos';
import { buildPlanReport } from './report';
import { supportsDirectoryWrite } from '../../lib/files/intake';
import { copyPlan, pickDestination } from '../../lib/files/applyPlan';
import { CancelledError } from '../../lib/analysis/hashing';
import { useSettings } from '../../app/settings';

export function OrganizeTab() {
  const { entries, getFile, run } = useFiles();
  const { settings } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const [criterion, setCriterion] = useState<OrganizeCriterion>('categoria');
  const [open, setOpen] = useState<string | null>(null);
  const [copying, setCopying] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const plan = useMemo(() => planOrganization(entries, criterion), [entries, criterion]);
  const canWrite = supportsDirectoryWrite();

  if (!entries.length) return <p className="empty-line">Adicione arquivos para gerar um plano de organização.</p>;

  const record = async (applied: { done: number; failed: string[] } | null, durationMs = 0, cancelled = false) => {
    if (!settings.saveHistory) return;
    const r = await saveReport(buildPlanReport(plan, entries, applied));
    await addHistory({
      type: 'organizacao', title: r.title, files: applied ? applied.done : plan.totalFiles, bytes: plan.totalBytes, durationMs,
      result: cancelled ? 'cancelado' : applied?.failed.length ? 'parcial' : 'sucesso',
      notes: applied ? [`${applied.done} cópias criadas.`, ...applied.failed.slice(0, 20)] : ['Somente plano. Nenhum arquivo foi alterado.'],
      reportId: r.id,
    });
  };

  const exportTxt = async () => {
    const res = await saveText(planToInstructions(plan), `usbi-plano-${stamp()}.txt`);
    if (res !== 'cancelado') toast({ tone: 'ok', title: 'Plano exportado', body: 'Instruções em texto para organizar manualmente.' });
  };
  const exportCsv = async () => {
    const res = await saveCSV(plan.operations.map((o) => ({ origem: o.from, destino: o.to, pasta: o.folder, bytes: o.size, renomeado: o.renamed ? 'sim' : 'não' })), `usbi-plano-${stamp()}.csv`);
    if (res !== 'cancelado') toast({ tone: 'ok', title: 'Plano exportado em CSV' });
  };
  const savePlan = async () => {
    try {
      await record(null);
      toast({ tone: 'ok', title: 'Plano salvo nos relatórios', body: 'Nenhum arquivo foi movido.' });
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: (e as Error).message });
    }
  };

  const applyCopy = async () => {
    const ok = await confirm({
      title: 'Criar cópia organizada?',
      body: (
        <>
          <p>Você vai escolher uma pasta de destino. O app vai <strong>copiar {plural(plan.totalFiles, 'arquivo', 'arquivos')} ({formatBytes(plan.totalBytes)})</strong> para dentro dela, em {plural(plan.folders.length, 'pasta', 'pastas')} novas.</p>
          <p>Os originais não são movidos nem apagados. Arquivos que já existirem no destino não serão sobrescritos. Verifique se o destino tem espaço livre suficiente.</p>
        </>
      ),
      confirm: 'Escolher pasta e copiar',
    });
    if (!ok) return;
    let dest;
    try {
      dest = await pickDestination();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') toast({ tone: 'erro', title: 'Sem acesso à pasta', body: (e as Error).message });
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    const t0 = Date.now();
    setCopying({ done: 0, total: plan.operations.length, bytes: 0 });
    try {
      const res = await copyPlan(plan, dest, getFile, { signal: ctrl.signal, onProgress: (done, total, bytes) => setCopying({ done, total, bytes }) });
      await record(res, Date.now() - t0).catch(() => {});
      toast({ tone: res.failed.length ? 'aviso' : 'ok', title: 'Cópia organizada concluída', body: `${res.done} copiados${res.failed.length ? `, ${res.failed.length} com problema (veja o histórico)` : ''}.` });
    } catch (e) {
      if (e instanceof CancelledError) {
        await record({ done: 0, failed: ['Cancelada pelo usuário: parte das cópias pode ter sido criada.'] }, Date.now() - t0, true).catch(() => {});
        toast({ tone: 'aviso', title: 'Cópia cancelada', body: 'As cópias já criadas continuam na pasta de destino.' });
      } else toast({ tone: 'erro', title: 'Falha ao copiar', body: (e as Error).message });
    } finally {
      setCopying(null);
      abort.current = null;
    }
  };

  return (
    <div className="organize">
      <fieldset className="org-criteria">
        <legend className="label">Critério de agrupamento</legend>
        <div className="seg">
          {(Object.keys(CRITERION_LABEL) as OrganizeCriterion[]).map((c) => (
            <label key={c}>
              <input type="radio" name="criterio" checked={criterion === c} onChange={() => setCriterion(c)} />
              <span>{CRITERION_LABEL[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="org-stats">
        <div><span className="label">Arquivos afetados</span><strong className="num">{formatInt(plan.totalFiles)}</strong></div>
        <div><span className="label">Espaço envolvido</span><strong className="num">{formatBytes(plan.totalBytes)}</strong></div>
        <div><span className="label">Pastas propostas</span><strong className="num">{formatInt(plan.folders.length)}</strong></div>
        <div><span className="label">Conflitos de nome</span><strong className="num">{formatInt(plan.conflicts)}</strong></div>
      </div>

      <div className="org-layout">
        <div className="org-tree" role="tree" aria-label="Prévia da estrutura proposta">
          <p className="mono muted">Prévia — nada foi alterado</p>
          {plan.folders.map((fp) => {
            const isOpen = open === fp.folder;
            const ops = plan.operations.filter((o) => o.folder === fp.folder);
            return (
              <div key={fp.folder} role="treeitem" aria-expanded={isOpen} className="org-node">
                <button className="org-folder" onClick={() => setOpen(isOpen ? null : fp.folder)}>
                  <ChevronRight aria-hidden className={isOpen ? 'rot' : ''} />
                  <Folder aria-hidden />
                  <span>{fp.folder}</span>
                  <span className="num muted">{formatInt(fp.count)} · {formatBytes(fp.bytes)}</span>
                </button>
                {isOpen && (
                  <ul role="group" className="org-ops">
                    {ops.slice(0, 200).map((o) => (
                      <li key={o.fileId} role="treeitem">
                        <span className="mono muted">{o.from}</span>
                        <span aria-hidden>→</span>
                        <span className="mono">{o.to.split('/').pop()}</span>
                        {o.renamed && <span className="tag warn">renomeado</span>}
                      </li>
                    ))}
                    {ops.length > 200 && <li className="mono muted">+ {ops.length - 200} operações (todas estão no CSV)</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <aside className="org-actions">
          <h3 className="h3">Revise antes de aplicar.</h3>
          <p className="muted">
            Um site não pode mover ou renomear arquivos que você apenas selecionou. Por isso há três caminhos reais:
          </p>
          <ol className="org-paths">
            <li>
              <strong>Exportar o plano</strong> e seguir as instruções no gerenciador de arquivos.
              <div className="btn-row">
                <button className="btn btn-ghost btn-sm" onClick={exportTxt}><FileText aria-hidden /> Instruções (TXT)</button>
                <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Download aria-hidden /> Operações (CSV)</button>
              </div>
            </li>
            <li>
              <strong>Guardar o plano</strong> nos relatórios deste aparelho.
              <div className="btn-row">
                <button className="btn btn-ghost btn-sm" onClick={savePlan} disabled={!settings.saveHistory}><Save aria-hidden /> Salvar plano</button>
              </div>
              {!settings.saveHistory && <p className="hint">O histórico está desligado em Configurações.</p>}
            </li>
            <li>
              <strong>Criar uma cópia organizada</strong> numa pasta que você escolher, sem tocar nos originais.
              {canWrite ? (
                copying ? (
                  <div className="org-progress" role="status">
                    <div className="progress"><i style={{ width: `${(copying.done / Math.max(copying.total, 1)) * 100}%` }} /></div>
                    <span className="mono">{copying.done}/{copying.total} · {formatBytes(copying.bytes)}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => abort.current?.abort()}><Square aria-hidden /> Cancelar</button>
                  </div>
                ) : (
                  <div className="btn-row">
                    <button className="btn btn-primary btn-sm" onClick={applyCopy} disabled={!!run}><Copy aria-hidden /> Escolher destino e copiar</button>
                  </div>
                )
              ) : (
                <p className="hint">Indisponível neste navegador: exige a API de acesso a pastas (Chrome ou Edge no computador). No Android, use o plano exportado.</p>
              )}
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
