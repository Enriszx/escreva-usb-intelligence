import { IS_ARTIFACT } from '../../lib/platform';
import { Download, Printer } from 'lucide-react';
import type { Report } from '../../lib/storage/repos';
import { formatBytes, formatDateTime, formatInt, plural } from '../../lib/format';
import { Donut } from '../../components/charts/Donut';
import { BarList } from '../../components/charts/BarList';
import { CATEGORIES, CATEGORY_LABEL } from '../../lib/analysis/types';
import { CAT_VAR } from '../../components/charts/colors';
import { saveCSV, saveJSON, stamp } from '../../lib/export';
import { useToast } from '../../app/feedback';

export const KIND_LABEL: Record<Report['kind'], string> = {
  analise: 'Análise completa',
  duplicados: 'Duplicados',
  organizacao: 'Organização',
  integridade: 'Integridade',
};

const TOTAL_LABEL: Record<string, [string, 'bytes' | 'n']> = {
  arquivos: ['Arquivos', 'n'],
  bytes: ['Volume', 'bytes'],
  comHash: ['Com SHA-256', 'n'],
  errosDeLeitura: ['Erros de leitura', 'n'],
  gruposDuplicados: ['Grupos duplicados', 'n'],
  bytesRecuperaveis: ['Recuperável', 'bytes'],
  gruposDeNomeRepetido: ['Nomes repetidos', 'n'],
  gruposDeNomeSemelhante: ['Nomes semelhantes', 'n'],
  pastas: ['Pastas propostas', 'n'],
  conflitosDeNome: ['Conflitos de nome', 'n'],
  copiados: ['Copiados', 'n'],
  falhas: ['Falhas', 'n'],
};

const labelToCat = Object.fromEntries(CATEGORIES.map((c) => [CATEGORY_LABEL[c], c]));

export async function exportReport(r: Report, kind: 'json' | 'csv') {
  const base = `usbi-relatorio-${r.kind}-${stamp(r.at)}`;
  if (kind === 'json') return saveJSON({ app: 'usb-intelligence', tipo: 'relatorio', ...r, geradoEm: new Date(r.at).toISOString() }, `${base}.json`);
  return saveCSV(r.rows as unknown as Record<string, unknown>[], `${base}.csv`, ['nome', 'caminho', 'categoria', 'extensao', 'bytes', 'modificado', 'sha256', 'observacao']);
}

export function ReportView({ report: r }: { report: Report }) {
  const toast = useToast();
  const out = async (k: 'json' | 'csv') => {
    const res = await exportReport(r, k);
    if (res !== 'cancelado') toast({ tone: 'ok', title: `Relatório exportado em ${k.toUpperCase()}` });
  };
  return (
    <article className="report-view">
      <header className="rv-head">
        <span className="tag info">{KIND_LABEL[r.kind]}</span>
        <h2 className="h2">{r.title}</h2>
        <p className="mono muted">Gerado em {formatDateTime(r.at)} (horário deste aparelho)</p>
        <div className="btn-row no-print">
          <button className="btn btn-ghost btn-sm" onClick={() => out('json')}><Download aria-hidden /> JSON</button>
          <button className="btn btn-ghost btn-sm" onClick={() => out('csv')}><Download aria-hidden /> CSV ({formatInt(r.rows.length)} linhas)</button>
          {!IS_ARTIFACT && <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer aria-hidden /> Imprimir / PDF</button>}
        </div>
      </header>

      <dl className="rv-totals">
        {Object.entries(r.totals).map(([k, v]) => {
          const [label, type] = TOTAL_LABEL[k] ?? [k, 'n'];
          return (
            <div key={k}>
              <dt className="mono muted">{label}</dt>
              <dd className="num">{type === 'bytes' ? formatBytes(v) : formatInt(v)}</dd>
            </div>
          );
        })}
      </dl>

      {(r.byCategory?.length || r.byExtension?.length) ? (
        <div className="rv-charts">
          {r.byCategory && r.byCategory.length > 0 && (
            <section>
              <h3 className="h3">Por categoria</h3>
              <Donut
                title="Volume por categoria neste relatório"
                data={r.byCategory.map((c) => ({ key: c.category, label: c.category, value: c.bytes, color: CAT_VAR[labelToCat[c.category] ?? 'outros'], detail: plural(c.count, 'arquivo', 'arquivos') }))}
                format={formatBytes}
                centerLabel="no total"
                size={200}
              />
            </section>
          )}
          {r.byExtension && r.byExtension.length > 0 && (
            <section>
              <h3 className="h3">Por extensão</h3>
              <BarList title="Volume por extensão" data={r.byExtension.map((e) => ({ key: e.ext, label: e.ext.startsWith('(') ? e.ext : `.${e.ext}`, value: e.bytes, color: 'var(--signal)', detail: plural(e.count, 'arquivo', 'arquivos') }))} format={formatBytes} max={10} />
            </section>
          )}
        </div>
      ) : null}

      {r.duplicateGroups && r.duplicateGroups.length > 0 && (
        <section className="rv-section">
          <h3 className="h3">Grupos de conteúdo idêntico</h3>
          <ol className="rv-dups">
            {r.duplicateGroups.slice(0, 50).map((g) => (
              <li key={g.sha256}>
                <span className="num">{formatBytes(g.size)} × {g.files.length}</span>
                <span className="mono">{g.files.join('  ·  ')}</span>
              </li>
            ))}
          </ol>
          {r.duplicateGroups.length > 50 && <p className="hint">+ {r.duplicateGroups.length - 50} grupos no JSON exportado.</p>}
        </section>
      )}

      {r.folders && r.folders.length > 0 && (
        <section className="rv-section">
          <h3 className="h3">Pastas</h3>
          <ul className="rv-folders">
            {r.folders.map((f) => <li key={f.folder}><span>{f.folder}</span><span className="num muted">{formatInt(f.count)} · {formatBytes(f.bytes)}</span></li>)}
          </ul>
        </section>
      )}

      <section className="rv-section rv-notes">
        <h3 className="h3">Limitações e origem</h3>
        <ul>{r.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="muted">{r.source}</p>
      </section>
    </article>
  );
}
