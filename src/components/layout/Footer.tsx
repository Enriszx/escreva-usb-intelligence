import { Link } from 'react-router-dom';
import { GROUPS, ROUTES } from '../../app/routes';
import { Wordmark } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="site-footer" data-tone="grafite">
      <div className="wrap footer-grid">
        <div className="footer-mark">
          <Wordmark />
          <p className="muted">
            Plataforma brasileira de inteligência de arquivos. Tudo é processado neste aparelho: não há servidor recebendo seus arquivos e nenhuma coleta silenciosa.
          </p>
          <span className="flag-strip" aria-hidden><i /><i /><i /><i /></span>
        </div>
        <nav className="footer-cols" aria-label="Mapa do site">
          {GROUPS.map((g) => (
            <div key={g}>
              <h3>{g}</h3>
              <ul className="footer-links">
                {ROUTES.filter((r) => r.group === g).map((r) => (
                  <li key={r.path}><Link to={r.path}>{r.title}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="footer-meta">
          <p className="mono muted">Versão {__APP_VERSION__} · Projeto aberto · Feito no Brasil</p>
          <p className="mono muted">Inter e Plus Jakarta Sans (SIL OFL) · IA: WebLLM + Qwen2.5 e gpt-oss-20b</p>
        </div>
      </div>
    </footer>
  );
}
