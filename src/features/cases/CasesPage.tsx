import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, ExternalLink, Store, TriangleAlert } from 'lucide-react';
import { useDocumentTitle } from '../../app/hooks';
import { CASES, KIND_LABEL, ROOT_CAUSES, RULE_321, type CaseKind } from './cases';
import { BackupCheck } from './BackupCheck';
import './cases.css';

const RULE_KEY = 'usbi.regra321';

export default function CasesPage() {
  useDocumentTitle('Casos reais');
  const { hash } = useLocation();
  const [kind, setKind] = useState<CaseKind | 'todos'>('todos');
  const [done, setDone] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RULE_KEY) ?? '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(RULE_KEY, JSON.stringify(done)); } catch { /* sem armazenamento: vale até fechar */ }
  }, [done]);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const list = kind === 'todos' ? CASES : CASES.filter((c) => c.kinds.includes(kind));
  const counts = (Object.keys(KIND_LABEL) as CaseKind[]).map((k) => [k, CASES.filter((c) => c.kinds.includes(k)).length] as const);
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));

  return (
    <div className="page wrap cases-page">
      <header className="page-head">
        <div>
          <span className="label">Proteção e controle</span>
          <h1 className="h1">Casos reais. <span className="grad-text">Lições aplicadas.</span></h1>
        </div>
        <p className="lead">
          {CASES.length} incidentes de empresas grandes e pequenas, no Brasil e no mundo, com fonte. Para cada um: o que aconteceu, a lição, o que o
          USB Intelligence faz a respeito e o que nenhum app resolve sozinho.
        </p>
        <span className="page-n outline-num" aria-hidden>11</span>
      </header>

      {/* ---------- Causas que se repetem ---------- */}
      <section className="card" aria-labelledby="causas-t">
        <h2 id="causas-t" className="h3">As 6 causas que se repetem — e a resposta do app</h2>
        <ul className="causes">
          {ROOT_CAUSES.map((r) => (
            <li key={r.cause}>
              <TriangleAlert aria-hidden />
              <div>
                <strong>{r.cause}</strong>
                <span className="muted small">Casos: {r.cases.map((id) => byId[id].org.split(' (')[0]).join(', ')}</span>
              </div>
              <Link to={r.to} className="cause-fix">{r.answer} <ArrowRight className="arrow" aria-hidden /></Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Casos ---------- */}
      <section aria-labelledby="lista-t" className="cases-sec">
        <div className="cases-head">
          <h2 id="lista-t" className="h3">Os casos</h2>
          <div className="chips-filter" role="radiogroup" aria-label="Filtrar por tipo de problema">
            <button type="button" role="radio" aria-checked={kind === 'todos'} className={`fchip ${kind === 'todos' ? 'is-on' : ''}`} onClick={() => setKind('todos')}>Todos ({CASES.length})</button>
            {counts.map(([k, n]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`fchip ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>{KIND_LABEL[k]} ({n})</button>
            ))}
          </div>
        </div>
        <ul className="case-grid">
          {list.map((c) => (
            <li key={c.id} className="card case" id={`caso-${c.id}`}>
              <div className="case-top">
                <span className="case-year num">{c.year}</span>
                <span className="tag">{c.size === 'grande' ? <Building2 aria-hidden /> : <Store aria-hidden />}{c.size === 'grande' ? 'Grande porte' : 'Pequeno porte / terceirizada'}</span>
              </div>
              <h3 className="case-org">{c.org}</h3>
              <p className="case-title">{c.title}</p>
              <p className="muted small">{c.what}</p>
              <p className="case-lesson"><strong>Lição:</strong> {c.lesson}</p>
              <div className="case-fixes">
                <span className="label plain">Como o app ajuda</span>
                {c.fixes.map((f) => <Link key={f.label} to={f.to} className="tag ok">{f.label}</Link>)}
              </div>
              {c.limit && <p className="case-limit small"><strong>Limite honesto:</strong> {c.limit}</p>}
              <a className="case-src small" href={c.source.url} target="_blank" rel="noopener noreferrer">Fonte: {c.source.label} <ExternalLink aria-hidden /></a>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Ferramentas ---------- */}
      <div className="cases-tools">
        <section id="verificador" className="card" aria-labelledby="verif-t">
          <span className="label">Ferramenta</span>
          <h2 id="verif-t" className="h2">Verificador de backup</h2>
          <p className="muted">
            A lição de Pixar, GitLab, MySpace e Kyoto: conferir a cópia. Escolha a pasta original e a pasta da cópia. O app compara cada arquivo
            pelo caminho e pelo conteúdo (SHA-256) e diz o que falta, o que mudou e o que está igual. Nada sai do aparelho.
          </p>
          <BackupCheck />
        </section>

        <section id="regra-321" className="card" aria-labelledby="r321-t">
          <span className="label">Checklist</span>
          <h2 id="r321-t" className="h2">Regra 3-2-1</h2>
          <p className="muted">A prática que teria evitado os casos OVH, UniSuper e Code Spaces. Marque o que você já cumpre.</p>
          <ul className="r321">
            {RULE_321.map((r) => (
              <li key={r.id}>
                <label className="r321-item">
                  <input type="checkbox" checked={done.includes(r.id)} onChange={(e) => setDone((d) => (e.target.checked ? [...d, r.id] : d.filter((x) => x !== r.id)))} />
                  <span>{r.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="r321-score" aria-live="polite">
            <div className="progress"><i style={{ width: `${(done.length / RULE_321.length) * 100}%` }} /></div>
            <span className="num"><strong>{done.length}/{RULE_321.length}</strong> {done.length === RULE_321.length ? '— seus dados estão bem protegidos.' : '— ainda há riscos como os dos casos acima.'}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
