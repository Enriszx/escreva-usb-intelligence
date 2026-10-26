import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { deleteReport, listHistory, listReports, type HistoryEntry, type Report } from '../../lib/storage/repos';
import { formatBytes, formatDateTime, formatInt } from '../../lib/format';
import { useDocumentTitle } from '../../app/hooks';
import { useConfirm, useToast } from '../../app/feedback';
import { Timeline } from '../../components/charts/Timeline';
import { KIND_LABEL, ReportView, exportReport } from './ReportView';
import './reports.css';

export default function ReportsPage() {
  useDocumentTitle('Relatórios');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Report['kind'] | 'todos'>('todos');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const openId = params.get('id');

  const load = () => {
    Promise.all([listReports(), listHistory()])
      .then(([r, h]) => { setReports(r); setHistory(h); })
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const open = reports?.find((r) => r.id === openId);
  const filtered = useMemo(() => (reports ?? []).filter((r) => kind === 'todos' || r.kind === kind), [reports, kind]);
  const analyses = history.filter((h) => h.type === 'analise' || h.type === 'duplicados');
  const last = reports?.find((r) => r.kind === 'analise' || r.kind === 'duplicados');

  if (error) return <div className="page wrap"><p className="error-text">Não foi possível ler os relatórios: {error}</p></div>;
  if (!reports) return <div className="page wrap"><p className="muted">Lendo relatórios…</p></div>;

  if (openId) {
    return (
      <div className="page wrap reports-page">
        <Link to="/relatorios" className="btn btn-quiet no-print"><ArrowLeft aria-hidden /> Todos os relatórios</Link>
        {open ? <ReportView report={open} /> : <p className="empty-line">Este relatório não existe mais neste dispositivo.</p>}
      </div>
    );
  }

  return (
    <div className="page reports-page">
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>06</span>
          <div>
            <span className="label">Relatórios</span>
            <h1 className="h1">O que os<br />números dizem.</h1>
          </div>
          <p className="lead muted">Cada relatório nasce de uma operação real neste aparelho e guarda só metadados: nomes, tamanhos, hashes. Nunca o conteúdo.</p>
        </header>

        {reports.length === 0 ? (
          <div className="empty-hero">
            <p className="h2">Nenhum relatório ainda.</p>
            <p className="muted">Rode uma análise na Central de arquivos ou salve um plano de organização.</p>
            <Link to="/arquivos" className="btn btn-primary">Começar uma análise</Link>
          </div>
        ) : (
          <>
            <section className="rp-overview" aria-label="Resumo">
              <div className="rp-stat">
                <span className="label">Relatórios salvos</span>
                <strong className="num">{formatInt(reports.length)}</strong>
              </div>
              <div className="rp-stat">
                <span className="label">Última análise</span>
                <strong className="num">{last ? formatInt(last.totals.arquivos ?? 0) : '—'}</strong>
                <span className="muted">{last ? `arquivos · ${formatBytes(last.totals.bytes ?? 0)} · ${formatDateTime(last.at)}` : 'nenhuma'}</span>
              </div>
              <div className="rp-stat">
                <span className="label">Recuperável na última</span>
                <strong className="num">{last ? formatBytes(last.totals.bytesRecuperaveis ?? 0) : '—'}</strong>
                <span className="muted">{last ? `${formatInt(last.totals.gruposDuplicados ?? 0)} grupos duplicados` : ''}</span>
              </div>
            </section>

            {analyses.length > 0 && (
              <section className="rp-timeline" aria-labelledby="tl-title">
                <h2 id="tl-title" className="h3">Análises ao longo do tempo</h2>
                <p className="mono muted">Fonte: histórico local · altura = arquivos analisados · cor = resultado</p>
                <Timeline
                  title="Linha do tempo das análises"
                  points={analyses.map((h) => ({ key: h.id, at: h.at, value: h.files, label: h.title, tone: h.result === 'sucesso' ? 'ok' : h.result === 'erro' ? 'err' : 'warn' }))}
                  format={(n) => formatInt(n)}
                  onOpen={(id) => { const h = analyses.find((x) => x.id === id); if (h?.reportId) navigate(`/relatorios?id=${h.reportId}`); }}
                />
                <ul className="tl-legend mono">
                  <li><i style={{ background: 'var(--st-ok)' }} /> sucesso</li>
                  <li><i style={{ background: 'var(--st-warn)' }} /> parcial ou cancelada</li>
                  <li><i style={{ background: 'var(--st-err)' }} /> erro</li>
                </ul>
              </section>
            )}

            <div className="rp-filter seg" role="radiogroup" aria-label="Tipo de relatório">
              {(['todos', 'analise', 'duplicados', 'organizacao'] as const).map((k) => (
                <label key={k}>
                  <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                  <span>{k === 'todos' ? 'Todos' : KIND_LABEL[k]}</span>
                </label>
              ))}
            </div>

            <ul className="rp-list">
              {filtered.map((r) => (
                <li key={r.id} className="rp-row">
                  <span className="mono rp-date">{formatDateTime(r.at)}</span>
                  <span className="tag info">{KIND_LABEL[r.kind]}</span>
                  <Link to={`/relatorios?id=${r.id}`} className="rp-title">{r.title}</Link>
                  <span className="num muted rp-meta">{formatInt(r.totals.arquivos ?? 0)} arq. · {formatBytes(r.totals.bytes ?? 0)}</span>
                  <span className="rp-actions">
                    <button className="btn btn-ghost btn-sm" onClick={async () => { if ((await exportReport(r, 'csv')) !== 'cancelado') toast({ tone: 'ok', title: 'CSV exportado' }); }} aria-label={`Exportar CSV de ${r.title}`}><Download aria-hidden /> CSV</button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      aria-label={`Excluir ${r.title}`}
                      onClick={async () => {
                        if (await confirm({ title: 'Excluir relatório?', body: <p>O relatório some deste dispositivo. O registro no histórico continua, mas sem o link.</p>, confirm: 'Excluir', danger: true })) {
                          await deleteReport(r.id);
                          load();
                        }
                      }}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
              {filtered.length === 0 && <li className="empty-line">Nenhum relatório deste tipo.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
