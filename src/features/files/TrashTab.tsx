import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useFolder } from './folder';
import { useConfirm } from '../../app/feedback';
import { formatBytes, formatDateTime, plural } from '../../lib/format';
import { TRASH_DIR } from '../../lib/files/backend';

export function TrashTab() {
  const f = useFolder();
  const confirm = useConfirm();
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { f.refreshTrash(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const items = f.trash;
  const chosen = items.filter((i) => sel.has(i.id));
  const total = items.reduce((s, i) => s + i.size, 0);

  if (!f.backend) return <p className="empty-line">A lixeira existe só com uma pasta conectada.</p>;
  return (
    <div className="trash">
      <p className="muted trash-intro">
        Itens enviados à lixeira ficam em <code className="inline">{TRASH_DIR}</code> dentro de “{f.backend.rootName}”, com o caminho original anotado.
        Ainda ocupam espaço até você apagá-los de vez. A lixeira viaja junto com o pendrive.
      </p>
      {items.length === 0 ? (
        <p className="empty-line">A lixeira está vazia.</p>
      ) : (
        <>
          <div className="selection-bar">
            <label className="check">
              <input type="checkbox" checked={chosen.length === items.length} onChange={() => setSel(chosen.length === items.length ? new Set() : new Set(items.map((i) => i.id)))} />
              <span>Selecionar tudo</span>
            </label>
            <span className="mono muted">{plural(items.length, 'item', 'itens')} · {formatBytes(total)}</span>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" disabled={!chosen.length || !!f.busy} onClick={async () => { await f.restore(chosen); setSel(new Set()); }}>
                <RotateCcw aria-hidden /> Restaurar ({chosen.length})
              </button>
              <button className="btn btn-danger btn-sm" disabled={!items.length || !!f.busy} onClick={async () => {
                const list = chosen.length ? chosen : items;
                if (await confirm({ title: `Apagar de vez ${plural(list.length, 'item', 'itens')}?`, body: <p>{formatBytes(list.reduce((s, i) => s + i.size, 0))} serão apagados permanentemente. Não há como recuperar depois.</p>, confirm: 'Apagar de vez', danger: true, typeToConfirm: 'APAGAR' })) {
                  await f.purge(list);
                  setSel(new Set());
                }
              }}>
                <Trash2 aria-hidden /> {chosen.length ? `Apagar selecionados (${chosen.length})` : 'Esvaziar lixeira'}
              </button>
            </div>
          </div>
          <ul className="trash-list">
            {items.map((i) => (
              <li key={i.id}>
                <input type="checkbox" aria-label={`Selecionar ${i.original}`} checked={sel.has(i.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} />
                <span className="trash-name">
                  <strong>{i.original.split('/').pop()}</strong>
                  <span className="mono muted">veio de {i.original} · {formatDateTime(i.at)}</span>
                </span>
                <span className="num muted">{formatBytes(i.size)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
