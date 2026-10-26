import { Link } from 'react-router-dom';
import { ROUTES } from '../../app/routes';
import { LogoMark } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="site-footer" data-tone="grafite">
      <div className="wrap footer-grid">
        <div className="footer-mark">
          <LogoMark size={44} />
          <p className="h3">Seus dados ficam com você.</p>
          <p className="muted">
            O USB Intelligence processa tudo neste aparelho. Não há servidor recebendo seus arquivos e nenhuma coleta silenciosa.
          </p>
        </div>
        <ul className="footer-links">
          {ROUTES.map((r) => (
            <li key={r.path}>
              <Link to={r.path}><span className="mono">{r.n}</span> {r.title}</Link>
            </li>
          ))}
        </ul>
        <p className="mono muted footer-meta">
          Versão {__APP_VERSION__} · Projeto aberto · Tipografia Bricolage Grotesque e IBM Plex Mono (SIL OFL)
        </p>
      </div>
    </footer>
  );
}
