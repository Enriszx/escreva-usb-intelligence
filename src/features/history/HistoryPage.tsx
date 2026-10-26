import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Download, Trash2 } from 'lucide-react';
import { deleteHistory, listHistory, HISTORY_LABEL, type HistoryEntry, type HistoryResult, type HistoryType } from '../../lib/storage/repos';
import { formatBytes, formatDateTime, formatInt, plural } from '../../lib/format';
import { useDocumentTitle } from '../../app/hooks';
import { saveCSV, saveJSON, stamp } from '../../lib/export';
import { useConfirm, useToast } from '../../app/feedback';
import { useSettings } from '../../app/settings';
import '../reports/reports.css';

const RESULT: Record<HistoryResult, { label: string; cls: string }> = {
  sucesso: { label: 'sucesso', cls: 'ok' },
  parcial: { label: 'parcial', cls: 'warn' },
  cancelado: { label: 'cancelado', cls: 'warn' },
  erro: { label: 'erro', cls: 'err' },
};

function dayStart(s: string) { return s ? new Date(`${s}T00:00:00`).getTime() : -Infinity; }
function dayEnd(s: string) { return s ? new Date(`${s}T23:59:59.999`).getTime() : Infinity; }

export default function HistoryPage() {
  useDocumentTitle('Histórico');
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<HistoryType | ''>('');
  const [result, setResult] = useState<HistoryResult | ''>('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const load = () => { listHistory().then(setItems).catch((e: Error) => setError(e.message)); };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const a = dayStart(from), b = dayEnd(to);
    return (items ?? []).filter((h) =>
      (!type || h.type === type) && (!result || h.result === result) && h.at >= a && h.at <= b &&
      (!needle || h.title.toLowerCase().includes(needle) || h.notes.some((n) => n.toLowerCase().includes(needle))));
  }, [items, type, result, q, from, to]);

  const rows = () => filtered.map((h) => ({ dataHora: formatDateTime(h.at), iso: new Date(h.at).toISOString(), tipo: HISTORY_LABEL[h.type], titulo: h.title, arquivos: h.files, bytes: h.bytes, duracaoMs: h.durationMs, resultado: h.result, observacoes: h.notes.join(' | '), relatorio: h.reportId ?? '' }));
  const doExport = async (k: 'csv' | 'json') => {
    const name = `usbi-historico-${stamp()}.${k}`;
    const res = k === 'csv' ? await saveCSV(rows(), name) : await saveJSON({ app: 'usb-intelligence', tipo: 'historico', exportadoEm: new Date().toISOString(), filtros: { type, result, q, from, to }, registros: filtered }, name);
    if (res !== 'cancelado') toast({ tone: 'ok', title: 'Histórico exportado', body: `${plural(filtered.length, 'registro', 'registros')} em ${k.toUpperCase()}.` });
  };
  const usedTypes = [...new Set((items ?? []).map((h) => h.type))];
  const anyFilter = type || result || q || from || to;

  return (
    <div className="page history-page">
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>07</span>
          <div>
            <span className="label">Histórico</span>
            <h1 className="h1">Tudo o que<br />aconteceu.</h1>
          </div>
          <p className="lead muted">
            {settings.saveHistory ? 'Seu histórico está salvo neste dispositivo, com o horário do relógio local.' : 'O registro de histórico está desligado em Configurações: novas operações não entram aqui.'}
          </p>
        </header>

        {error && <p className="error-text">Não foi possível ler o histórico: {error}</p>}
        {items && items.length === 0 && (
          <div className="empty-hero">
            <p className="h2">Nada registrado ainda.</p>
            <p className="muted">Análises, verificações, cofres e exportações aparecem aqui quando acontecem — e só quando acontecem.</p>
            <Link to="/arquivos" className="btn btn-primary">Ir para a central de arquivos</Link>
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <form className="h-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filtros do histórico">
              <label className="field"><span>Buscar</span><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do arquivo, título…" /></label>
              <label className="field"><span>Tipo</span>
                <select className="select" value={type} onChange={(e) => setType(e.target.value as HistoryType | '')}>
                  <option value="">Todos</option>
                  {usedTypes.map((t) => <option key={t} value={t}>{HISTORY_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="field"><span>Resultado</span>
                <select className="select" value={result} onChange={(e) => setResult(e.target.value as HistoryResult | '')}>
                  <option value="">Todos</option>
                  {(Object.keys(RESULT) as HistoryResult[]).map((r) => <option key={r} value={r}>{RESULT[r].label}</option>)}
                </select>
              </label>
              <label className="field"><span>De</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="field"><span>Até</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!from && !!to && to < from} /></label>
            </form>
            {from && to && to < from && <p className="error-text">A data final é anterior à inicial.</p>}

            <div className="h-bar">
              <span className="mono muted">{plural(filtered.length, 'registro', 'registros')}{anyFilter ? ` de ${formatInt(items.length)}` : ''}</span>
              <div className="btn-row">
                {anyFilter && <button className="btn btn-quiet btn-sm" onClick={() => { setType(''); setResult(''); setQ(''); setFrom(''); setTo(''); }}>Limpar filtros</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')} disabled={!filtered.length}><Download aria-hidden /> CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={() => doExport('json')} disabled={!filtered.length}><Download aria-hidden /> JSON</button>
              </div>
            </div>

            <ol className="h-list">
              {filtered.map((h) => {
                const isOpen = open === h.id;
                return (
                  <li key={h.id} className={`h-item ${isOpen ? 'is-open' : ''}`}>
                    <button className="h-sum" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : h.id)}>
                      <span className="mono h-date">{formatDateTime(h.at)}</span>
                      <span className="h-type mono">{HISTORY_LABEL[h.type]}</span>
                      <span className="h-title">{h.title}</span>
                      <span className={`tag ${RESULT[h.result].cls}`}>{RESULT[h.result].label}</span>
                      <ChevronDown aria-hidden className="h-chev" />
                    </button>
                    {isOpen && (
                      <div className="h-body">
                        <dl className="h-facts">
                          <div><dt className="mono muted">Arquivos</dt><dd className="num">{formatInt(h.files)}</dd></div>
                          <div><dt className="mono muted">Volume</dt><dd className="num">{formatBytes(h.bytes)}</dd></div>
                          <div><dt className="mono muted">Duração</dt><dd className="num">{h.durationMs ? `${(h.durationMs / 1000).toFixed(2).replace('.', ',')} s` : '—'}</dd></div>
                        </dl>
                        {h.notes.length > 0 && <ul className="h-notes">{h.notes.map((n, i) => <li key={i} className={n.length > 60 && /^[0-9a-f:\s]+$/i.test(n.split(': ').pop() ?? '') ? 'mono' : ''}>{n}</li>)}</ul>}
                        <div className="btn-row">
                          {h.reportId && <Link className="btn btn-primary btn-sm" to={`/relatorios?id=${h.reportId}`}>Abrir relatório</Link>}
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if (await confirm({ title: 'Excluir este registro?', body: <p>Somente este item do histórico é removido. O relatório vinculado (se houver) continua em Relatórios.</p>, confirm: 'Excluir', danger: true })) {
                              await deleteHistory(h.id);
                              load();
                            }
                          }}><Trash2 aria-hidden /> Excluir registro</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
