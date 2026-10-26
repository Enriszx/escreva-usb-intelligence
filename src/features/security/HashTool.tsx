import { useRef, useState } from 'react';
import { BookmarkPlus, Copy, FileSearch, Square } from 'lucide-react';
import { sha256OfBlob, CancelledError } from '../../lib/analysis/hashing';
import { formatBytes, formatInt } from '../../lib/format';
import { useToast } from '../../app/feedback';
import { addHistory, saveIntegrityRef } from '../../lib/storage/repos';
import { useSettings } from '../../app/settings';

export function normalizeHash(s: string): string {
  // Aceita "hash  nome" (formato sha256sum) e hashes com espaços ou maiúsculas.
  return s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^0-9a-f]/g, '') ?? '';
}

export function HashTool({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const { settings } = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [label, setLabel] = useState('');
  const refNorm = normalizeHash(ref);
  const refValid = refNorm.length === 64;
  const verdict = hash && refValid ? hash === refNorm : null;

  const run = async (f: File) => {
    setFile(f);
    setHash(null);
    setProgress(0);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const t0 = Date.now();
    try {
      const h = await sha256OfBlob(f, { signal: ctrl.signal, onProgress: (b) => setProgress(f.size ? b / f.size : 1) });
      setHash(h);
      if (settings.saveHistory) addHistory({ type: 'hash', title: `SHA-256 de ${f.name}`, files: 1, bytes: f.size, durationMs: Date.now() - t0, result: 'sucesso', notes: [h] }).catch(() => {});
    } catch (e) {
      if (e instanceof CancelledError) toast({ tone: 'aviso', title: 'Cálculo cancelado' });
      else toast({ tone: 'erro', title: 'Não foi possível ler o arquivo', body: (e as Error).message });
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const recordVerification = (ok: boolean) => {
    if (!file || !hash || !settings.saveHistory) return;
    addHistory({ type: 'verificacao', title: `Verificação de ${file.name}`, files: 1, bytes: file.size, durationMs: 0, result: ok ? 'sucesso' : 'erro', notes: [ok ? 'Hash corresponde à referência.' : 'Hash DIFERENTE da referência.', `calculado: ${hash}`, `referência: ${refNorm}`] }).catch(() => {});
  };

  return (
    <div className="hash-tool">
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={progress !== null}>
          <FileSearch aria-hidden /> {file ? 'Escolher outro arquivo' : 'Escolher arquivo'}
        </button>
        <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ''; }} />
        {file && <span className="mono muted">{file.name} · {formatBytes(file.size)}</span>}
      </div>

      {progress !== null && (
        <div className="hash-progress" role="status">
          <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>
          <span className="mono">{Math.round(progress * 100)}% de {formatBytes(file?.size ?? 0)}</span>
          <button className="btn btn-danger btn-sm" onClick={() => abort.current?.abort()}><Square aria-hidden /> Cancelar</button>
        </div>
      )}

      {hash && (
        <div className="hash-result">
          <span className="label">SHA-256 calculado agora</span>
          <code className="hash-big num">{hash}</code>
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(hash).then(() => toast({ tone: 'ok', title: 'Hash copiado' }), () => toast({ tone: 'erro', title: 'Área de transferência indisponível' }))}>
              <Copy aria-hidden /> Copiar
            </button>
          </div>
        </div>
      )}

      <label className="field">
        <span>Hash de referência (opcional)</span>
        <input className="input num" placeholder="Cole aqui o SHA-256 publicado pelo autor do arquivo" value={ref} onChange={(e) => setRef(e.target.value)} aria-invalid={!!ref && !refValid} aria-describedby="ref-hint" spellCheck={false} />
      </label>
      <p id="ref-hint" className={ref && !refValid ? 'error-text' : 'hint'}>
        {ref && !refValid ? `Um SHA-256 tem 64 caracteres hexadecimais; este tem ${formatInt(refNorm.length)}.` : 'Aceita também a linha no formato “hash  nome-do-arquivo”.'}
      </p>

      {verdict !== null && (
        <div className={`verdict ${verdict ? 'is-ok' : 'is-bad'}`} role="status">
          <strong>{verdict ? 'Corresponde.' : 'Não corresponde.'}</strong>
          <p>
            {verdict
              ? 'O conteúdo deste arquivo é idêntico ao do arquivo que gerou a referência.'
              : 'O conteúdo é diferente do esperado: o arquivo pode estar incompleto, alterado ou ser outra versão. Isto não diz qual é a causa.'}
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => { recordVerification(verdict); toast({ tone: 'ok', title: 'Resultado registrado no histórico' }); }} disabled={!settings.saveHistory}>
            Registrar no histórico
          </button>
        </div>
      )}

      {hash && file && (
        <form
          className="save-ref"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveIntegrityRef({ name: file.name, size: file.size, sha256: hash, label: label.trim() || file.name });
              setLabel('');
              onSaved();
              toast({ tone: 'ok', title: 'Referência guardada', body: 'Use-a depois para verificar se o arquivo continua igual.' });
            } catch (err) {
              toast({ tone: 'erro', title: 'Não foi possível guardar', body: (err as Error).message });
            }
          }}
        >
          <label className="field">
            <span>Guardar como referência para verificar depois</span>
            <input className="input" placeholder={`Ex.: backup do pendrive — ${file.name}`} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button className="btn btn-ghost" type="submit"><BookmarkPlus aria-hidden /> Guardar referência</button>
        </form>
      )}
    </div>
  );
}
