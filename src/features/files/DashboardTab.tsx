import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Copy, FileDown, FolderTree, Layers, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFiles } from './store';
import { summarize } from '../../lib/analysis/summary';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { findNameGroups } from '../../lib/analysis/names';
import { planOrganization } from '../../lib/analysis/organize';
import { CATEGORY_LABEL, type Category, type FileEntry } from '../../lib/analysis/types';
import { formatBytes, formatDate, formatInt, pct, plural } from '../../lib/format';
import { Donut } from '../../components/charts/Donut';
import { BarList } from '../../components/charts/BarList';
import { Sparkline } from '../../components/charts/Spark';
import { DailyLine } from '../../components/charts/DailyLine';
import { WeekBars } from '../../components/charts/WeekBars';
import { StackedBar } from '../../components/charts/StackedBar';
import { CountUp } from '../../components/charts/CountUp';
import { CAT_VAR } from '../../components/charts/colors';
import { listHistory, listReports, type HistoryEntry } from '../../lib/storage/repos';
import { saveCSV, stamp } from '../../lib/export';
import { useToast } from '../../app/feedback';

type Unit = 'auto' | 'KB' | 'MB' | 'GB';
const DIV: Record<Exclude<Unit, 'auto'>, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
const DAY = 864e5;

function bytesIn(unit: Unit, b: number): string {
  if (unit === 'auto') return formatBytes(b);
  return `${(b / DIV[unit]).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Contagem (ou bytes) de importações por dia, dos últimos `n` dias terminando hoje. */
function perDay(entries: FileEntry[], n: number, weight: 'count' | 'bytes'): { start: number; count: number }[] {
  const today = startOfDay(Date.now());
  return Array.from({ length: n }, (_, i) => {
    const s = today - (n - 1 - i) * DAY;
    const count = entries.filter((f) => f.importedAt >= s && f.importedAt < s + DAY).reduce((a, f) => a + (weight === 'bytes' ? f.size : 1), 0);
    return { start: s, count };
  });
}

/**
 * Visão geral. Tudo aqui sai de summarize()/findDuplicates() e dos registros reais
 * de importação (data/hora de cada arquivo); nada é exemplo.
 */
export function DashboardTab({
  category, setCategory, setExt, goArchive, goTab,
}: {
  category: Category | null;
  setCategory: (c: Category | null) => void;
  setExt: (e: string | null) => void;
  goArchive: () => void;
  goTab: (id: 'organizacao' | 'duplicados') => void;
}) {
  const { entries, lastRun, run } = useFiles();
  const toast = useToast();
  const [metric, setMetric] = useState<'bytes' | 'count'>('bytes');
  const [unit, setUnit] = useState<Unit>('auto');
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [reports, setReports] = useState<number | null>(null);
  const [acts, setActs] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    listReports().then((r) => setReports(r.length)).catch(() => setReports(null));
    listHistory().then((h) => setActs(h.slice(0, 5))).catch(() => setActs([]));
  }, [lastRun]);

  const s = useMemo(() => summarize(entries), [entries]);
  const dup = useMemo(() => findDuplicates(entries), [entries]);
  const names = useMemo(() => findNameGroups(entries), [entries]);
  const scoped = useMemo(() => (category ? summarize(entries.filter((f) => f.category === category)) : s), [entries, category, s]);
  const fmtBytes = (b: number) => bytesIn(unit, b);
  const fmt = metric === 'bytes' ? fmtBytes : (n: number) => formatInt(n);

  const spark14 = useMemo(() => perDay(entries, 14, 'count').map((d) => d.count), [entries]);
  const sparkBytes = useMemo(() => perDay(entries, 14, 'bytes').map((d) => d.count), [entries]);
  const days = useMemo(() => perDay(entries, period, 'count'), [entries, period]);
  const week = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    entries.forEach((f) => c[new Date(f.importedAt).getDay()]++);
    return c;
  }, [entries]);

  const readable = entries.filter((f) => f.source !== 'registro');
  const done = entries.filter((f) => f.sha256).length;
  const failed = entries.filter((f) => f.hashError).length;
  const registered = entries.filter((f) => f.source === 'registro' && !f.sha256).length;
  const processing = run ? Math.max(0, run.filesTotal - run.filesDone) : 0;
  const pending = Math.max(0, readable.filter((f) => !f.sha256 && !f.hashError).length - processing);
  const catsUsed = s.byCategory.filter((c) => c.count).length;

  const topFolders = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((f) => {
      const i = f.path.lastIndexOf('/');
      if (i > 0) m.set(f.path.slice(0, i), (m.get(f.path.slice(0, i)) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [entries]);
  const biggest = useMemo(() => [...entries].sort((a, b) => b.size - a.size).slice(0, 5), [entries]);
  const recent = useMemo(() => [...entries].sort((a, b) => b.importedAt - a.importedAt).slice(0, 5), [entries]);

  const exportPlan = async () => {
    const plan = planOrganization(entries, 'extensao');
    const dest = new Map(plan.operations.map((o) => [o.fileId, o.folder]));
    const rows = entries.map((f) => ({
      nome: f.name, 'pasta atual': f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '', formato: f.ext, tipo: CATEGORY_LABEL[f.category],
      bytes: f.size, sha256: f.sha256 ?? '', estado: f.hashError ? 'falhou' : f.sha256 ? 'concluído' : 'pendente', 'pasta sugerida': dest.get(f.id) ?? '',
    }));
    const r = await saveCSV(rows, `plano-organizacao-${stamp()}.csv`);
    if (r !== 'cancelado') toast({ tone: 'ok', title: 'Plano exportado', body: 'CSV com a pasta sugerida para cada arquivo. Nada foi movido.' });
  };

  const kpi = (Icon: LucideIcon, label: string, value: number | string, hint: string, series: number[], color: string, lead = false) => (
    <div className={`kpi-card ${lead ? 'is-lead' : ''}`}>
      <span className="kpi-ic" style={{ color }}><Icon aria-hidden /></span>
      <strong className="kpi-v num">{typeof value === 'number' ? <CountUp value={value} /> : value}</strong>
      <b>{label}</b>
      <small>{hint}</small>
      <Sparkline values={series} color={lead ? 'currentColor' : color} />
    </div>
  );

  const unitSeg = (
    <div className="seg" role="radiogroup" aria-label="Unidade de tamanho">
      {(['auto', 'KB', 'MB', 'GB'] as Unit[]).map((u) => (
        <label key={u}><input type="radio" name="unit" checked={unit === u} onChange={() => setUnit(u)} /><span>{u === 'auto' ? 'Auto' : u}</span></label>
      ))}
    </div>
  );

  return (
    <div className="dash">
      <div className="dash-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => goTab('organizacao')}><FolderTree aria-hidden /> Ver plano de organização</button>
        <button className="btn btn-ghost btn-sm" onClick={exportPlan} disabled={!entries.length}><FileDown aria-hidden /> Exportar plano (CSV)</button>
        <Link className="btn btn-ghost btn-sm" to="/ajuda"><Wifi aria-hidden /> Verificar modo offline</Link>
      </div>

      <div className="kpi-row">
        {kpi(Layers, 'Total de arquivos', s.count, 'Itens na biblioteca', spark14, 'var(--signal)', true)}
        {kpi(FolderTree, 'Espaço utilizado', formatBytes(s.bytes), s.largest ? `Maior: ${s.largest.name}` : 'Soma dos tamanhos', sparkBytes, 'var(--cat-1)')}
        {kpi(CheckCircle2, 'Analisados', done, 'Com hash SHA-256', spark14, 'var(--st-ok)')}
        {kpi(Copy, 'Duplicados', dup.groups.reduce((a, g) => a + g.files.length - 1, 0), `${plural(dup.groups.length, 'grupo', 'grupos')} · ${formatBytes(dup.recoverable)} recuperáveis`, spark14, 'var(--cat-4)')}
        {kpi(ClipboardList, 'Categorias', catsUsed, 'Com ao menos um arquivo', spark14, 'var(--cat-5)')}
        {kpi(FolderTree, 'Pendentes', pending + registered, registered ? `${formatInt(pending)} abertos · ${formatInt(registered)} só registro` : 'Ainda sem hash', spark14, 'var(--st-err)')}
      </div>

      <div className="dash-controls">
        <div className="seg" role="radiogroup" aria-label="Medida dos gráficos">
          <label><input type="radio" name="metric" checked={metric === 'bytes'} onChange={() => setMetric('bytes')} /><span>Por tamanho</span></label>
          <label><input type="radio" name="metric" checked={metric === 'count'} onChange={() => setMetric('count')} /><span>Por quantidade</span></label>
        </div>
        {metric === 'bytes' && unitSeg}
        {category && <button className="btn btn-quiet btn-sm" onClick={() => setCategory(null)}>Limpar destaque de {CATEGORY_LABEL[category]}</button>}
      </div>

      <div className="dash-grid">
        <section className="dash-panel" aria-labelledby="g-cat">
          <h3 id="g-cat" className="h3">Tipos de arquivo</h3>
          <p className="mono muted dash-src">Fonte: extensão de cada arquivo · toque para destacar</p>
          <Donut
            title={`Distribuição por tipo (${metric === 'bytes' ? 'tamanho' : 'quantidade'})`}
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

        <section className="dash-panel" aria-labelledby="g-line">
          <div className="dash-panel-head">
            <h3 id="g-line" className="h3">Evolução das importações</h3>
            <div className="seg" role="radiogroup" aria-label="Período">
              {([7, 30, 90] as const).map((p) => (
                <label key={p}><input type="radio" name="period" checked={period === p} onChange={() => setPeriod(p)} /><span>{p} dias</span></label>
              ))}
            </div>
          </div>
          <p className="mono muted dash-src">Fonte: data e hora de cada importação neste aparelho</p>
          <DailyLine days={days} title={`Importações nos últimos ${period} dias`} />
        </section>

        <section className="dash-panel" aria-labelledby="g-week">
          <h3 id="g-week" className="h3">Importações por dia da semana</h3>
          <p className="mono muted dash-src">Quando você mais importa arquivos</p>
          <WeekBars counts={week} />
        </section>

        <section className="dash-panel" aria-labelledby="g-cats">
          <h3 id="g-cats" className="h3">Espaço por categoria</h3>
          <p className="mono muted dash-src">Fonte: soma dos tamanhos de cada tipo</p>
          <BarList
            title="Espaço por categoria"
            data={[...s.byCategory].filter((c) => c.count).sort((a, b) => b.bytes - a.bytes).map((c) => ({ key: c.category, label: CATEGORY_LABEL[c.category], value: c.bytes, color: CAT_VAR[c.category], detail: plural(c.count, 'arquivo', 'arquivos') }))}
            format={fmtBytes}
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
              .map((e) => ({ key: e.ext, label: e.ext.startsWith('(') ? e.ext : `.${e.ext}`, value: metric === 'bytes' ? e.bytes : e.count, color: CAT_VAR[e.category], detail: metric === 'bytes' ? plural(e.count, 'arquivo', 'arquivos') : fmtBytes(e.bytes) }))}
            format={fmt}
            onSelect={(k) => { if (k) { setExt(k); goArchive(); } }}
          />
        </section>

        <section className="dash-panel" aria-labelledby="g-status">
          <h3 id="g-status" className="h3">Status dos processamentos</h3>
          <p className="mono muted dash-src">Estado da leitura (hash) de cada arquivo</p>
          <StackedBar
            title="Status dos processamentos"
            segments={[
              { key: 'p', label: 'Pendente', value: pending, color: 'var(--st-warn)', hint: 'Ainda sem hash' },
              { key: 'e', label: 'Em processamento', value: processing, color: 'var(--signal)' },
              { key: 'c', label: 'Concluído', value: done, color: 'var(--st-ok)', hint: 'Com SHA-256' },
              { key: 'f', label: 'Falhou', value: failed, color: 'var(--st-err)', hint: 'Erro de leitura' },
              { key: 'r', label: 'Só registro', value: registered, color: 'var(--cat-0)', hint: 'Arquivo não está aberto' },
            ]}
          />
        </section>

        <section className="dash-panel" aria-labelledby="g-big">
          <h3 id="g-big" className="h3">Maiores arquivos</h3>
          <BarList
            title="Maiores arquivos"
            data={biggest.map((f) => ({ key: f.id, label: f.name, value: f.size, color: CAT_VAR[f.category], detail: CATEGORY_LABEL[f.category] }))}
            format={fmtBytes}
          />
        </section>

        <section className="dash-panel" aria-labelledby="g-fold">
          <h3 id="g-fold" className="h3">Pastas com mais arquivos</h3>
          {topFolders.length ? (
            <BarList title="Pastas com mais arquivos" data={topFolders.map(([k, v]) => ({ key: k, label: k, value: v, color: 'var(--signal)', detail: plural(v, 'arquivo', 'arquivos') }))} format={(n) => formatInt(n)} />
          ) : (
            <p className="muted">Escolha uma pasta ou o pendrive para ver quais pastas concentram mais arquivos.</p>
          )}
        </section>

        <section className="dash-panel" aria-labelledby="g-rec">
          <div className="dash-panel-head">
            <h3 id="g-rec" className="h3">Arquivos recentes</h3>
            <button className="btn btn-quiet btn-sm" onClick={goArchive}>Ver todos</button>
          </div>
          <ul className="mini-list">
            {recent.map((f) => (
              <li key={f.id}>
                <i style={{ background: CAT_VAR[f.category] }} aria-hidden />
                <span className="nm" title={f.name}>{f.name}</span>
                <small className="num">{formatBytes(f.size)}</small>
                <span className={`tag ${f.hashError ? 'err' : f.sha256 ? 'ok' : ''}`}>{f.hashError ? 'falhou' : f.sha256 ? 'concluído' : f.source === 'registro' ? 'registro' : 'pendente'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-panel" aria-labelledby="g-act">
          <div className="dash-panel-head">
            <h3 id="g-act" className="h3">Últimas atividades</h3>
            <Link className="btn btn-quiet btn-sm" to="/historico">Ver todas</Link>
          </div>
          {acts.length ? (
            <ul className="mini-list">
              {acts.map((a) => (
                <li key={a.id}>
                  <span className="nm" title={a.title}>{a.title}</span>
                  <small className="mono">{formatDate(a.at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">As operações realizadas aparecem aqui.</p>
          )}
        </section>
      </div>

      <p className="dash-foot mono muted">
        {reports !== null && <>Relatórios salvos neste aparelho: {formatInt(reports)} · <Link to="/relatorios">abrir relatórios</Link> · </>}
        {names.filter((n) => n.kind === 'identico').length > 0 && <>{plural(names.filter((n) => n.kind === 'identico').length, 'grupo de nome repetido', 'grupos de nome repetido')} · <button className="btn btn-quiet btn-sm" onClick={() => goTab('duplicados')}>ver duplicados</button> · </>}
        {pct(dup.recoverable, s.bytes)} do volume é recuperável · tudo calculado agora, a partir da sua seleção e do registro local.
      </p>
    </div>
  );
}
