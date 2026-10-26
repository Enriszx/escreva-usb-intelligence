import { useEffect, useState } from 'react';
import { sha256OfText } from '../../lib/analysis/hashing';

/** Hash ao vivo: mostra, com cálculo real, por que nome não importa e um caractere importa. */
export function HashPlayground() {
  const [a, setA] = useState({ name: 'contrato.pdf', body: 'Pagamento em 10 de março.' });
  const [b, setB] = useState({ name: 'contrato-final (1).pdf', body: 'Pagamento em 10 de março.' });
  const [ha, setHa] = useState('');
  const [hb, setHb] = useState('');
  useEffect(() => { sha256OfText(a.body).then(setHa); }, [a.body]);
  useEffect(() => { sha256OfText(b.body).then(setHb); }, [b.body]);
  const same = ha && ha === hb;
  const diffAt = (x: string, y: string) => [...x].map((ch, i) => ch !== y[i]);
  const mark = diffAt(ha, hb);
  return (
    <div className="hashplay">
      {[{ v: a, set: setA, h: ha, id: 'a' }, { v: b, set: setB, h: hb, id: 'b' }].map(({ v, set, h, id }) => (
        <div className="hashplay-col" key={id}>
          <label className="field">
            <span>Nome do arquivo {id.toUpperCase()}</span>
            <input className="input" value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Conteúdo {id.toUpperCase()}</span>
            <textarea className="textarea" value={v.body} onChange={(e) => set({ ...v, body: e.target.value })} rows={3} />
          </label>
          <p className="hash-out num" aria-label={`SHA-256 do conteúdo ${id.toUpperCase()}`}>
            {[...h].map((ch, i) => (
              <span key={i} className={mark[i] ? 'hx-diff' : undefined}>{ch}</span>
            ))}
          </p>
        </div>
      ))}
      <p className={`hashplay-verdict ${same ? 'is-same' : 'is-diff'}`} aria-live="polite">
        <strong>{same ? 'Conteúdo idêntico.' : 'Conteúdos diferentes.'}</strong>{' '}
        {same
          ? a.name === b.name ? 'Mesmo nome e mesmo conteúdo.' : 'Nomes diferentes não importam: para o detector, isto é uma cópia.'
          : a.name.trim().toLowerCase() === b.name.trim().toLowerCase() ? 'O nome é igual, mas não é cópia.' : 'Mude um único caractere e o hash inteiro muda.'}
      </p>
    </div>
  );
}
