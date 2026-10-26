import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, X } from 'lucide-react';
import { Wordmark } from '../ui/Logo';
import { ROUTES, routeFor } from '../../app/routes';
import { useSettings } from '../../app/settings';

export function Header() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const current = routeFor(pathname);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="USB Intelligence — início">
          <Wordmark />
        </Link>
        <div className="where mono" aria-hidden>
          {current && (
            <>
              <span className="where-n">{current.n}</span>
              <span className="where-sep" />
              <span>{current.title}</span>
            </>
          )}
        </div>
        <nav className="quick" aria-label="Atalhos">
          {ROUTES.slice(1, 5).map((r) => (
            <NavLink key={r.path} to={r.path} className="quick-link">
              {r.short}
            </NavLink>
          ))}
        </nav>
        <button className="index-btn" aria-expanded={open} aria-controls="indice" onClick={() => setOpen(true)}>
          <span className="index-btn-bars" aria-hidden><i /><i /></span>
          <span>Índice</span>
        </button>
      </header>
      <AnimatePresence>{open && <IndexMenu onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function IndexMenu({ onClose }: { onClose: () => void }) {
  const { reducedMotion } = useSettings();
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    (document.querySelector('#indice a') as HTMLElement | null)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const d = reducedMotion ? 0 : 1;
  const hovered = ROUTES.find((r) => r.path === hover);
  return (
    <motion.div
      id="indice"
      className="index-menu"
      data-tone="mata"
      role="dialog"
      aria-modal="true"
      aria-label="Índice do USB Intelligence"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.5 * d, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="index-top">
        <span className="label">Índice — 9 áreas</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar <X aria-hidden />
        </button>
      </div>
      <nav className="index-list" aria-label="Todas as áreas">
        {ROUTES.map((r, i) => (
          <motion.div
            key={r.path}
            initial={{ y: 40 * d, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: (0.12 + i * 0.035) * d, duration: 0.45 * d, ease: [0.16, 1, 0.3, 1] }}
          >
            <NavLink
              to={r.path}
              end
              className="index-item"
              onMouseEnter={() => setHover(r.path)}
              onFocus={() => setHover(r.path)}
              onClick={onClose}
            >
              <span className="index-n mono">{r.n}</span>
              <span className="index-title">{r.title}</span>
              <ArrowUpRight className="index-arrow" aria-hidden />
            </NavLink>
          </motion.div>
        ))}
      </nav>
      <p className="index-blurb" aria-live="polite">
        {hovered ? hovered.blurb : 'Tudo roda neste aparelho. Nenhum arquivo sai daqui.'}
      </p>
    </motion.div>
  );
}

export function MobileTabs() {
  const tabs = [ROUTES[0], ROUTES[1], ROUTES[3], ROUTES[4], ROUTES[5]];
  return (
    <nav className="tabs-mobile" aria-label="Navegação principal">
      {tabs.map((r) => (
        <NavLink key={r.path} to={r.path} end className="tab-m">
          <r.icon aria-hidden />
          <span>{r.short}</span>
        </NavLink>
      ))}
    </nav>
  );
}
