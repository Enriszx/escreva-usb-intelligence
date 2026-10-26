import { Link } from 'react-router-dom';
import { Gauge, ScanSearch, Square } from 'lucide-react';
import { useFiles } from './store';
import { formatBytes, formatInt, plural } from '../../lib/format';
import { sizeCandidates } from '../../lib/analysis/duplicates';
import { useMemo } from 'react';

export function AnalysisBar() {
  const { entries, run, lastRun, analyze, cancel } = useFiles();
  const pendingAll = entries.filter((f) => !f.sha256);
  const pendingCandidates = useMemo(() => sizeCandidates(entries).filter((f) => !f.sha256), [entries]);
  const bytesAll = pendingAll.reduce((s, f) => s + f.size, 0);
  const bytesCand = pendingCandidates.reduce((s, f) => s + f.size, 0);

  if (run) {
    const pct = run.totalBytes ? (run.doneBytes / run.totalBytes) * 100 : run.filesTotal ? (run.filesDone / run.filesTotal) * 100 : 100;
    const elapsed = (Date.now() - run.startedAt) / 1000;
    const rate = elapsed > 0.5 ? run.doneBytes / elapsed : 0;
    const eta = rate > 0 ? (run.totalBytes - run.doneBytes) / rate : null;
    return (
      <div className="analysis-bar is-running" role="status" aria-live="polite">
        <div className="ab-copy">
          <span className="label">{run.kind === 'completa' ? 'Análise completa' : 'Busca de duplicados'} em andamento</span>
          <p className="num">
            {formatInt(run.filesDone)} / {formatInt(run.filesTotal)} arquivos · {formatBytes(run.doneBytes)} de {formatBytes(run.totalBytes)}
            {eta !== null && eta > 1 && ` · ~${Math.ceil(eta)} s restantes`}
          </p>
        </div>
        <div className="progress ab-progress" aria-hidden><i style={{ width: `${pct}%` }} /></div>
        <button className="btn btn-danger btn-sm" onClick={cancel}>
          <Square aria-hidden /> Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="analysis-bar">
      <div className="ab-copy">
        <span className="label">Análise</span>
        {entries.length === 0 ? (
          <p className="muted">Adicione arquivos para analisar.</p>
        ) : pendingAll.length === 0 ? (
          <p>Todos os arquivos já têm SHA-256 calculado.</p>
        ) : (
          <p className="muted">
            Completa lê {plural(pendingAll.length, 'arquivo', 'arquivos')} ({formatBytes(bytesAll)}). A busca rápida lê só os{' '}
            {formatInt(pendingCandidates.length)} que dividem tamanho com outro ({formatBytes(bytesCand)}).
          </p>
        )}
        {lastRun && (
          <p className="mono muted ab-last">
            Última: {lastRun.cancelled ? 'cancelada' : 'concluída'} em {(lastRun.durationMs / 1000).toFixed(1)} s
            {lastRun.reportId && <> · <Link to={`/relatorios?id=${lastRun.reportId}`}>abrir relatório</Link></>}
          </p>
        )}
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={!pendingAll.length} onClick={() => analyze('completa')}>
          <ScanSearch aria-hidden /> Análise completa
        </button>
        <button className="btn btn-ghost" disabled={!pendingCandidates.length} onClick={() => analyze('duplicados')}>
          <Gauge aria-hidden /> Só duplicados
        </button>
      </div>
    </div>
  );
}
