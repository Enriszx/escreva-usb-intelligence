import { useMemo, useState } from 'react';
import { ChevronDown, Download, ListX } from 'lucide-react';
import { useFiles } from './store';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { formatBytes, formatDateTime, formatInt, plural } from '../../lib/format';
import { saveCSV, saveJSON, stamp } from '../../lib/export';
import { useConfirm, useToast } from '../../app/feedback';
import { addHistory } from '../../lib/storage/repos';
import { useSettings } from '../../app/settings';

export function DuplicatesTab() {
  const { entries, run, analyze, remove } = useFiles();
  const { settings } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const dup = useMemo(() => findDuplicates(entries), [entries]);
  const [open, setOpen] = useState<string | null>(null);
  const checked = dup.candidates - dup.unresolved.length;

  const exportRows = () =>
    dup.groups.flatMap((g, i) =>
      g.files.map((f, j) => ({ grupo: i + 1, papel: j === 0 ? 'manter (primeiro da lista)' : 'cópia', nome: f.name, caminho: f.path, bytes: f.size, sha256: g.sha256 })),
    );

  const doExport = async (kind: 'csv' | 'json') => {
    const name = `usbi-duplicados-${stamp()}.${kind}`;
    const res = kind === 'csv'
      ? await saveCSV(exportRows(), name)
      : await saveJSON({ app: 'usb-intelligence', tipo: 'duplicados', geradoEm: new Date().toISOString(), espacoRecuperavelBytes: dup.recoverable, grupos: dup.groups.map((g) => ({ sha256: g.sha256, bytes: g.size, arquivos: g.files.map((f) => f.path) })) }, name);
    if (res === 'cancelado') return;
    toast({ tone: 'ok', title: res === 'salvo' ? 'Arquivo salvo' : 'Download iniciado', body: name });
    if (settings.saveHistory) addHistory({ type: 'exportacao', title: `Exportou duplicados (${kind.toUpperCase()})`, files: dup.groups.reduce((s, g) => s + g.files.length, 0), bytes: dup.recoverable, durationMs: 0, result: 'sucesso', notes: [name] }).catch(() => {});
  };

  const dropCopies = async () => {
    const copies = dup.groups.flatMap((g) => g.files.slice(1));
    const ok = await confirm({
      title: 'Tirar as cópias da lista de análise?',
      body: (
        <>
          <p>{plural(copies.length, 'cópia sai', 'cópias saem')} desta lista; fica o primeiro arquivo de cada grupo.</p>
          <p><strong>Nada é apagado do aparelho ou do pendrive.</strong> Um site não tem permissão para excluir arquivos que você só selecionou. Para liberar espaço, exporte a lista (CSV) e apague as cópias pelo gerenciador de arquivos.</p>
        </>
      ),
      confirm: 'Tirar cópias da lista',
    });
    if (!ok) return;
    remove(copies.map((f) => f.id));
    toast({ tone: 'ok', title: 'Cópias tiradas da lista', body: 'Os arquivos originais não foram alterados.' });
  };

  if (!entries.length) return <p className="empty-line">Adicione arquivos para procurar duplicados.</p>;

  return (
    <div className="dups">
      <div className="dups-method">
        <ol className="method-steps">
          <li><span className="num">{formatInt(entries.length)}</span> arquivos selecionados</li>
          <li><span className="num">{formatInt(dup.uniqueBySize)}</span> descartados por tamanho único — não podem ter cópia</li>
          <li><span className="num">{formatInt(checked)}</span> de {formatInt(dup.candidates)} candidatos comparados por SHA-256</li>
          <li><span className="num">{formatInt(dup.groups.length)}</span> grupos de conteúdo idêntico</li>
        </ol>
        {dup.unresolved.length > 0 && (
          <div className="callout">
            <p>{plural(dup.unresolved.length, 'candidato ainda não foi lido', 'candidatos ainda não foram lidos')}. Sem hash, não há como afirmar que são cópias.</p>
            <button className="btn btn-primary btn-sm" disabled={!!run} onClick={() => analyze('duplicados')}>Comparar agora</button>
          </div>
        )}
      </div>

      {dup.groups.length > 0 ? (
        <>
          <div className="dups-head">
            <p className="dups-total">
              <strong className="num">{formatBytes(dup.recoverable)}</strong>
              <span className="muted"> poderiam ser liberados mantendo uma cópia de cada grupo. Cada arquivo é contado uma vez só.</span>
            </p>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')}><Download aria-hidden /> CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('json')}><Download aria-hidden /> JSON</button>
              <button className="btn btn-ghost btn-sm" onClick={dropCopies} disabled={!!run}><ListX aria-hidden /> Tirar cópias da lista</button>
            </div>
          </div>
          <ul className="dup-groups">
            {dup.groups.map((g, i) => {
              const isOpen = open === g.sha256;
              return (
                <li key={g.sha256} className={`dup-group ${isOpen ? 'is-open' : ''}`}>
                  <button className="dup-sum" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.sha256)}>
                    <span className="mono dup-n">G{String(i + 1).padStart(2, '0')}</span>
                    <span className="dup-name">{g.files[0].name}{g.files.length > 1 && <span className="muted"> + {g.files.length - 1}</span>}</span>
                    <span className="num">{formatBytes(g.size)} × {g.files.length}</span>
                    <span className="num dup-rec">−{formatBytes(g.recoverable)}</span>
                    <ChevronDown aria-hidden className="dup-chev" />
                  </button>
                  {isOpen && (
                    <div className="dup-body">
                      <p className="mono muted">SHA-256 <span className="num">{g.sha256}</span></p>
                      <ul>
                        {g.files.map((f, j) => (
                          <li key={f.id}>
                            <span className={`tag ${j === 0 ? 'ok' : ''}`}>{j === 0 ? 'manter' : 'cópia'}</span>
                            <span className="mono">{f.path}</span>
                            <span className="mono muted">{f.lastModified ? formatDateTime(f.lastModified) : ''}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="hint">“Manter” é só uma sugestão: o primeiro da lista. Você decide qual cópia apagar.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="empty-line">
          {dup.candidates === 0
            ? 'Nenhum par de arquivos com o mesmo tamanho: não há duplicados nesta seleção.'
            : dup.unresolved.length
              ? 'Ainda não há grupos confirmados. Rode a comparação acima.'
              : 'Comparação feita: nenhum conteúdo idêntico encontrado.'}
        </p>
      )}
    </div>
  );
}
