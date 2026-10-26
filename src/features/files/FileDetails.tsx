import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Hash } from 'lucide-react';
import { Modal, useToast } from '../../app/feedback';
import { useFiles } from './store';
import { CATEGORY_LABEL, type FileEntry } from '../../lib/analysis/types';
import { formatBytes, formatDateTime, formatInt } from '../../lib/format';
import { sha256OfBlob } from '../../lib/analysis/hashing';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { normalizeName } from '../../lib/analysis/names';

export function FileDetails({ entry, onClose, onRename, onMove, onTrash }: { entry: FileEntry; onClose: () => void; onRename?: () => void; onMove?: () => void; onTrash?: () => void }) {
  const { entries, getFile, remove } = useFiles();
  const toast = useToast();
  const [hashing, setHashing] = useState<number | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const hash = entry.sha256 ?? local;

  const twins = useMemo(() => {
    const dup = findDuplicates(entries.map((e) => (e.id === entry.id && local ? { ...e, sha256: local } : e)));
    return dup.groups.find((g) => g.files.some((f) => f.id === entry.id))?.files.filter((f) => f.id !== entry.id) ?? [];
  }, [entries, entry.id, local]);
  const sameName = entries.filter((e) => e.id !== entry.id && normalizeName(e.name) === normalizeName(entry.name));

  const calc = async () => {
    const file = getFile(entry.id);
    if (!file) {
      toast({ tone: 'info', title: 'Use “Análise completa”', body: 'Neste modo o hash é calculado pela análise.' });
      return;
    }
    setHashing(0);
    try {
      const h = await sha256OfBlob(file, { onProgress: (b) => setHashing(file.size ? b / file.size : 1) });
      setLocal(h);
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível ler o arquivo', body: (e as Error).message });
    } finally {
      setHashing(null);
    }
  };

  const rows: [string, ReactNode][] = [
    ['Caminho', entry.path],
    ['Categoria', CATEGORY_LABEL[entry.category]],
    ['Extensão', entry.ext ? `.${entry.ext}` : 'sem extensão'],
    ['Tipo informado pelo navegador', entry.mime || 'não informado'],
    ['Tamanho', `${formatBytes(entry.size)} (${formatInt(entry.size)} bytes)`],
    ['Última modificação', entry.lastModified ? formatDateTime(entry.lastModified) : 'não informada'],
  ];

  return (
    <Modal title={entry.name} onClose={onClose} wide>
      <dl className="details">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="mono muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt className="mono muted">SHA-256</dt>
          <dd>
            {entry.hashError ? (
              <span className="tag err">{entry.hashError}</span>
            ) : hash ? (
              <span className="hash-line">
                <code className="num">{hash}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(hash).then(() => toast({ tone: 'ok', title: 'Hash copiado' }), () => toast({ tone: 'erro', title: 'A área de transferência não está disponível' }))}>
                  <Copy aria-hidden /> Copiar
                </button>
              </span>
            ) : hashing !== null ? (
              <span className="hash-line"><span className="progress" style={{ width: 160 }}><i style={{ width: `${hashing * 100}%` }} /></span> <span className="mono muted">lendo…</span></span>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={calc}><Hash aria-hidden /> Calcular agora</button>
            )}
          </dd>
        </div>
        <div>
          <dt className="mono muted">Cópias de conteúdo idêntico</dt>
          <dd>{hash ? (twins.length ? twins.map((t) => <div key={t.id} className="mono">{t.path}</div>) : 'Nenhuma entre os arquivos analisados com hash.') : 'Calcule o hash deste e dos demais arquivos para saber.'}</dd>
        </div>
        <div>
          <dt className="mono muted">Nomes iguais ou semelhantes</dt>
          <dd>{sameName.length ? sameName.map((t) => <div key={t.id} className="mono">{t.path}</div>) : 'Nenhum.'}</dd>
        </div>
      </dl>
      <p className="hint" style={{ marginTop: 16 }}>Hash prova se dois conteúdos são idênticos. Ele não diz se o arquivo está corrompido nem se tem vírus.</p>
      <div className="btn-row modal-actions">
        {onRename && <button className="btn btn-ghost" onClick={onRename}>Renomear</button>}
        {onMove && <button className="btn btn-ghost" onClick={onMove}>Mover</button>}
        {onTrash && <button className="btn btn-danger" onClick={onTrash}>Lixeira</button>}
        {!onTrash && <button className="btn btn-ghost" onClick={() => { remove([entry.id]); onClose(); toast({ tone: 'ok', title: 'Tirado da lista', body: 'O arquivo original não foi alterado.' }); }}>
          Tirar da lista
        </button>}
        <button className="btn btn-primary" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
