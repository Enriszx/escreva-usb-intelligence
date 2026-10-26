import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFiles } from './store';
import { summarize } from '../../lib/analysis/summary';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { findNameGroups } from '../../lib/analysis/names';
import { CATEGORY_LABEL, type Category } from '../../lib/analysis/types';
import { formatBytes, formatInt, pct, plural } from '../../lib/format';
import { Donut } from '../../components/charts/Donut';
import { BarList } from '../../components/charts/BarList';
import { CAT_VAR } from '../../components/charts/colors';
import { listReports } from '../../lib/storage/repos';

/**
 * Painel da sessão atual: tudo aqui sai de summarize()/findDuplicates()
 * sobre os arquivos selecionados. Clicar no gráfico filtra o acervo.
 */
export function DashboardTab({ category, setCategory, setExt, goArchive }: { category: Category | null; setCategory: (c: Category | null) => void; setExt: (e: string | null) => void; goArchive: () => void }) {
  const { entries, lastRun } = useFiles();
  const [metric, setMetric] = useState<'bytes' | 'count'>('bytes');
  const [reports, setReports] = useState<number | null>(null);
  useEffect(() => { listReports().then((r) => setReports(r.length)).catch(() => setReports(null)); }, [lastRun]);

  const s = useMemo(() => summarize(entries), [entries]);
  const dup = useMemo(() => findDuplicates(entries), [entries]);
  const names = useMemo(() => findNameGroups(entries), [entries]);
  const scoped = useMemo(() => (category ? summarize(entries.filter((f) => f.category === category)) : s), [entries, category, s]);
  const fmt = metric === 'bytes' ? formatBytes : (n: number) => formatInt(n);
  const pending = s.count - s.hashed - s.hashErrors;

  return (
    <div className="dash">
      <div className="dash-hero">
        <div className="dash-big">
          <span className="label">Volume selecionado</span>
          <strong className="dash-num">{formatBytes(s.bytes)}</strong>
          <span className="muted">{plural(s.count, 'arquivo', 'arquivos')} · maior: {s.largest ? `${s.largest.name} (${formatBytes(s.largest.size)})` : '—'}</span>
        </div>
        <div className="dash-kpis">
          <div className="kpi">
            <span className="label">Duplicados</span>
            <strong className="num">{formatInt(dup.groups.length)}</strong>
            <span className="muted">{dup.groups.length ? `grupos · ${plural(dup.groups.reduce((a, g) => a + g.files.length, 0), 'arquivo', 'arquivos')}` : s.hashed ? 'nenhum grupo' : 'aguardando análise'}</span>
          </div>
          <div className="kpi kpi-accent">
            <span className="label">Recuperável</span>
            <strong className="num">{formatBytes(dup.recoverable)}</strong>
            <span className="muted">se ficar só uma cópia de cada · {pct(dup.recoverable, s.bytes)} do total</span>
          </div>
          <div className="kpi">
            <span className="label">Integridade de leitura</span>
            <strong className="num">{formatInt(s.hashed)}<small>/{formatInt(s.count)}</small></strong>
            <span className="muted">
              com hash{s.hashErrors ? ` · ${s.hashErrors} com erro` : ''}{pending ? ` · ${pending} pendentes` : ''}
            </span>
          </div>
          <div className="kpi">
            <span className="label">Nomes repetidos</span>
            <strong className="num">{formatInt(names.filter((n) => n.kind === 'identico').length)}</strong>
            <span className="muted">grupos idênticos · {names.filter((n) => n.kind === 'semelhante').length} semelhantes</span>
          </div>
        </div>
      </div>

      <div className="dash-controls">
        <div className="seg" role="radiogroup" aria-label="Medida dos gráficos">
          <label><input type="radio" name="metric" checked={metric === 'bytes'} onChange={() => setMetric('bytes')} /><span>Por tamanho</span></label>
          <label><input type="radio" name="metric" checked={metric === 'count'} onChange={() => setMetric('count')} /><span>Por quantidade</span></label>
        </div>
        {category && <button className="btn btn-quiet btn-sm" onClick={() => setCategory(null)}>Limpar destaque de {CATEGORY_LABEL[category]}</button>}
      </div>

      <div className="dash-grid">
        <section className="dash-panel" aria-labelledby="g-cat">
          <h3 id="g-cat" className="h3">Categorias</h3>
          <p className="mono muted dash-src">Fonte: extensão de cada arquivo selecionado</p>
          <Donut
            title={`Distribuição por categoria (${metric === 'bytes' ? 'tamanho' : 'quantidade'})`}
            data={s.byCategory.map((c) => ({
              key: c.category, label: CATEGORY_LABEL[c.category], value: metric === 'bytes' ? c.bytes : c.count, color: CAT_VAR[c.category],
              detail: metric === 'bytes' ? plural(c.count, 'arquivo', 'arquivos') : formatBytes(c.bytes),
            }))}
            format={fmt}
            centerLabel={metric === 'bytes' ? 'no total' : 'arquivos'}
            selected={category}
            onSelect={(k) => setCategory(k as Category | null)}
          />
        </section>
        <section className="dash-panel" aria-labelledby="g-ext">
          <h3 id="g-ext" className="h3">Extensões {category && <span className="muted">em {CATEGORY_LABEL[category]}</span>}</h3>
          <p className="mono muted dash-src">Toque numa barra para ver esses arquivos no acervo</p>
          <BarList
            title="Distribuição por extensão"
            data={[...scoped.byExtension]
              .sort((a, b) => (metric === 'bytes' ? b.bytes - a.bytes : b.count - a.count))
              .map((e) => ({ key: e.ext, label: e.ext.startsWith('(') ? e.ext : `.${e.ext}`, value: metric === 'bytes' ? e.bytes : e.count, color: CAT_VAR[e.category], detail: metric === 'bytes' ? plural(e.count, 'arquivo', 'arquivos') : formatBytes(e.bytes) }))}
            format={fmt}
            onSelect={(k) => { if (k) { setExt(k); goArchive(); } }}
          />
        </section>
      </div>

      <p className="dash-foot mono muted">
        {reports !== null && <>Relatórios salvos neste aparelho: {formatInt(reports)} · <Link to="/relatorios">abrir relatórios</Link> · </>}
        Todos os números desta tela foram calculados agora, a partir da sua seleção.
      </p>
    </div>
  );
}
