import { useState } from 'react';
import { ExternalLink, RefreshCw, Send } from 'lucide-react';
import { REPO_URL } from '../assistant/tools';

const API = 'https://api.github.com/repos/Enriszx/escreva-usb-intelligence/issues?labels=pedido-site&state=all&per_page=10';

interface Issue { number: number; title: string; state: 'open' | 'closed'; html_url: string; comments: number; updated_at: string }

/** Pedidos de mudança no código: vão para o Claude no GitHub do projeto. */
export function ChangeRequests() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [list, setList] = useState<Issue[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const link = `${REPO_URL}/issues/new?${new URLSearchParams({
    title: `[Pedido] ${title.trim() || 'Mudança no site'}`,
    body: `@claude ${desc.trim()}\n\n---\nInstruções: faça a mudança no código deste repositório seguindo o CONTINUIDADE.md, rode \`npm test\`, \`npm run build\` e \`npm run audit\`, abra um pull request e responda aqui com o link. Pedido criado pelo site.`,
    labels: 'pedido-site',
  }).toString()}`;

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status === 403 ? 'O GitHub limitou as consultas por agora. Tente em alguns minutos.' : `GitHub respondeu ${r.status}.`);
      setList((await r.json()) as Issue[]);
    } catch (e) {
      setErr((e as Error).message.startsWith('Failed') ? 'Sem conexão com o GitHub.' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pedidos" className="set-sec set-wide" aria-labelledby="st-ped">
      <h2 id="st-ped" className="h3">Pedidos de mudança no site</h2>
      <p className="hint">
        Para mudanças que precisam mexer no código (uma página nova, um recurso novo). O pedido vai para o Claude no GitHub do projeto:
        ele faz, testa e responde no próprio pedido com o link. O assistente também cria pedidos: “quero uma página de contato”.
      </p>
      <label className="field" htmlFor="ped-titulo"><span>Título</span><input id="ped-titulo" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Página de contato" /></label>
      <label className="field" htmlFor="ped-desc"><span>O que mudar</span><textarea id="ped-desc" className="textarea" value={desc} maxLength={4000} onChange={(e) => setDesc(e.target.value)} placeholder="Descreva onde, o que e como deve ficar." /></label>
      <div className="btn-row">
        {desc.trim() ? (
          <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer"><Send aria-hidden /> Enviar pedido ao Claude</a>
        ) : (
          <button className="btn btn-primary btn-sm" disabled title="Descreva o pedido primeiro"><Send aria-hidden /> Enviar pedido ao Claude</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}><RefreshCw aria-hidden /> {loading ? 'Consultando…' : 'Ver andamento'}</button>
      </div>
      <p className="hint">No GitHub, toque em “Submit new issue”. Precisa estar logado na conta dona do projeto. Para o Claude responder, o segredo CLAUDE_CODE_OAUTH_TOKEN deve estar configurado (veja o README).</p>
      {err && <p className="error-text" role="alert">{err}</p>}
      {list && (list.length ? (
        <ul className="ped-list">
          {list.map((i) => (
            <li key={i.number}>
              <span className={`tag ${i.state === 'open' ? 'warn' : 'ok'}`}>{i.state === 'open' ? 'Em andamento' : 'Concluído'}</span>
              <a href={i.html_url} target="_blank" rel="noopener noreferrer">#{i.number} {i.title} <ExternalLink aria-hidden /></a>
              <span className="muted small">{i.comments} resposta(s) · {new Date(i.updated_at).toLocaleDateString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nenhum pedido ainda.</p>)}
    </section>
  );
}
