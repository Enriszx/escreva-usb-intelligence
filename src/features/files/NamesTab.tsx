import { useMemo } from 'react';
import { useFiles } from './store';
import { findNameGroups } from '../../lib/analysis/names';
import { formatBytes } from '../../lib/format';

export function NamesTab() {
  const { entries } = useFiles();
  const groups = useMemo(() => findNameGroups(entries), [entries]);
  if (!entries.length) return <p className="empty-line">Adicione arquivos para comparar nomes.</p>;
  if (!groups.length) return <p className="empty-line">Nenhum nome repetido ou parecido nesta seleção.</p>;
  return (
    <div className="names">
      <p className="muted names-intro">
        Nome repetido não é o mesmo que cópia. “Idêntico” = mesmo nome de arquivo. “Semelhante” = mesmo nome depois de ignorar acentos,
        maiúsculas e sufixos como “(1)” ou “- Cópia”. A coluna de conteúdo só afirma algo quando todos os arquivos do grupo têm hash.
      </p>
      <ul className="name-groups">
        {groups.map((g) => (
          <li key={`${g.kind}:${g.key}`} className="name-group">
            <div className="name-head">
              <span className={`tag ${g.kind === 'identico' ? 'info' : ''}`}>{g.kind === 'identico' ? 'nome idêntico' : 'nome semelhante'}</span>
              <strong>{g.key}</strong>
              <span className={`tag ${g.sameContent === true ? 'ok' : g.sameContent === false ? 'warn' : ''}`}>
                {g.sameContent === true ? 'conteúdo igual' : g.sameContent === false ? 'conteúdo diferente' : 'conteúdo não verificado'}
              </span>
            </div>
            <ul className="name-files">
              {g.files.map((f) => (
                <li key={f.id}>
                  <span className="mono">{f.path}</span>
                  <span className="num muted">{formatBytes(f.size)}</span>
                  <span className="mono muted">{f.sha256 ? f.sha256.slice(0, 12) : '—'}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
