import { useRef, useState } from 'react';
import { CheckCircle2, FolderInput, ShieldAlert, Square } from 'lucide-react';
import { compareSets, needsHash, relativePath, type CompareResult, type SideFile } from '../../lib/analysis/backupCheck';
import { sha256OfBlob, CancelledError } from '../../lib/analysis/hashing';
import { formatBytes, plural } from '../../lib/format';
import { useToast } from '../../app/feedback';

type Pick = { name: string; files: File[] } | null;

const VERDICT_LABEL = { igual: 'Iguais', diferente: 'Diferentes', faltando: 'Faltando na cópia', extra: 'Só na cópia' } as const;

/**
 * Compara a pasta original com a cópia (backup), arquivo por arquivo.
 * Funciona no navegador do computador (escolha de pasta) e, no celular,
 * escolhendo os arquivos. Tudo local: nada é enviado.
 */
export function BackupCheck() {
  const toast = useToast();
  const [orig, setOrig] = useState<Pick>(null);
  const [copy, setCopy] = useState<Pick>(null);
  const [busy, setBusy] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const pickFrom = (set: (p: Pick) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!list.length) return;
    const root = (list[0].webkitRelativePath || '').split('/')[0] || `${list.length} arquivos`;
    set({ name: root, files: list });
    setResult(null);
  };

  const side = (p: NonNullable<Pick>): Map<string, File> => new Map(p.files.map((f) => [relativePath(f.webkitRelativePath, f.name), f]));

  const run = async () => {
    if (!orig || !copy) return;
    const o = side(orig);
    const c = side(copy);
    const base = (m: Map<string, File>): SideFile[] => [...m].map(([path, f]) => ({ path, size: f.size }));
    const so = base(o);
    const sc = base(c);
    const todo = needsHash(so, sc);
    const controller = new AbortController();
    ctl.current = controller;
    setBusy({ done: 0, total: todo.length, bytes: 0 });
    let bytes = 0;
    try {
      const ho = new Map<string, string>();
      const hc = new Map<string, string>();
      for (const [i, path] of todo.entries()) {
        const a = o.get(path)!;
        const b = c.get(path)!;
        try { ho.set(path, await sha256OfBlob(a, { signal: controller.signal })); } catch (e) { if (e instanceof CancelledError) throw e; }
        try { hc.set(path, await sha256OfBlob(b, { signal: controller.signal })); } catch (e) { if (e instanceof CancelledError) throw e; }
        bytes += a.size + b.size;
        setBusy({ done: i + 1, total: todo.length, bytes });
      }
      const r = compareSets(so.map((f) => ({ ...f, sha256: ho.get(f.path) })), sc.map((f) => ({ ...f, sha256: hc.get(f.path) })));
      setResult(r);
      toast(r.trustworthy
        ? { tone: 'ok', title: 'Cópia confiável', body: `Os ${r.counts.igual} arquivos da origem estão na cópia, idênticos.` }
        : { tone: 'aviso', title: 'A cópia tem problemas', body: `${r.counts.faltando} faltando · ${r.counts.diferente} diferentes.` });
    } catch (e) {
      if (e instanceof CancelledError) toast({ tone: 'info', title: 'Verificação parada' });
      else toast({ tone: 'erro', title: 'Não foi possível verificar', body: (e as Error).message });
    } finally {
      setBusy(null);
      ctl.current = null;
    }
  };

  const problems = result?.rows.filter((r) => r.verdict !== 'igual') ?? [];
  const dirAttrs = { webkitdirectory: '', directory: '' } as Record<string, string>;

  return (
    <div className="bc">
      <div className="bc-picks">
        {([['orig', 'Pasta original', orig, setOrig], ['copy', 'Cópia (backup)', copy, setCopy]] as const).map(([id, label, p, set]) => (
          <label key={id} className={`bc-pick card ${p ? 'is-set' : ''}`}>
            <FolderInput aria-hidden />
            <span className="bc-pick-label">{label}</span>
            <span className="muted small">{p ? `${p.name} · ${plural(p.files.length, 'arquivo', 'arquivos')} · ${formatBytes(p.files.reduce((s, f) => s + f.size, 0))}` : 'Toque para escolher a pasta'}</span>
            <input className="sr-only" type="file" multiple {...dirAttrs} onChange={pickFrom(set)} aria-label={`Escolher ${label.toLowerCase()}`} disabled={!!busy} />
          </label>
        ))}
      </div>
      <div className="btn-row">
        {busy ? (
          <button className="btn btn-ghost" onClick={() => ctl.current?.abort()}><Square aria-hidden /> Parar</button>
        ) : (
          <button className="btn btn-primary" onClick={run} disabled={!orig || !copy}>Comparar origem e cópia</button>
        )}
        {busy && <span className="mono muted num" aria-live="polite">{busy.done}/{busy.total} comparados · {formatBytes(busy.bytes)} lidos</span>}
      </div>
      {result && (
        <div className={`bc-result ${result.trustworthy ? 'is-ok' : 'is-bad'}`} aria-live="polite">
          <p className="bc-verdict">
            {result.trustworthy ? <CheckCircle2 aria-hidden /> : <ShieldAlert aria-hidden />}
            <strong>{result.trustworthy ? 'Cópia confiável.' : 'Esta cópia não é confiável.'}</strong>
            <span className="muted">{result.trustworthy ? 'Todo arquivo da origem está na cópia com o mesmo conteúdo.' : 'Conserte os itens abaixo antes de contar com este backup.'}</span>
          </p>
          <dl className="stat-grid">
            {(Object.keys(VERDICT_LABEL) as (keyof typeof VERDICT_LABEL)[]).map((k) => (
              <div key={k} className={`stat bc-${k}`}><dt>{VERDICT_LABEL[k]}</dt><dd className="num">{result.counts[k].toLocaleString('pt-BR')}</dd></div>
            ))}
          </dl>
          {problems.length > 0 && (
            <ul className="bc-list">
              {problems.slice(0, 200).map((r) => (
                <li key={r.verdict + r.path}>
                  <span className={`tag ${r.verdict === 'extra' ? 'info' : r.verdict === 'faltando' ? 'err' : 'warn'}`}>{VERDICT_LABEL[r.verdict]}</span>
                  <span className="bc-path">{r.path}</span>
                  <span className="muted small">{r.why}</span>
                </li>
              ))}
              {problems.length > 200 && <li className="muted small">+ {problems.length - 200} itens</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
