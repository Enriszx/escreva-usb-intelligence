import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Moon, Sun, SunMoon, Usb, X } from 'lucide-react';
import { Wordmark } from '../ui/Logo';
import { GROUPS, ROUTES, byPath } from '../../app/routes';
import { useSettings } from '../../app/settings';
import { useOnline } from '../../app/hooks';
import { useToast } from '../../app/feedback';
import { useAuto, type AutoPhase } from '../../features/auto/auto';

const QUICK = ['/', '/automatico', '/arquivos', '/relatorios', '/seguranca'];

function chipFor(phase: AutoPhase, drive: string | null): { text: string; cls: string } | null {
  switch (phase) {
    case 'indisponivel': return null;
    case 'sem-config': return { text: 'Configurar pendrive', cls: '' };
    case 'aguardando': return { text: drive ? `Aguardando “${drive}”` : 'Aguardando pendrive', cls: 'is-wait' };
    case 'precisa-toque': return { text: 'Toque para continuar', cls: 'is-busy' };
    case 'executando': return { text: `Analisando ${drive ?? ''}…`, cls: 'is-busy' };
    case 'pronto': return { text: `${drive ?? 'Pendrive'} conectado`, cls: 'is-on' };
    case 'erro': return { text: 'Automático parou', cls: 'is-busy' };
  }
}

export function Header() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const online = useOnline();
  const { settings, update } = useSettings();
  const toast = useToast();
  const auto = useAuto();
  useEffect(() => setOpen(false), [pathname]);
  const THEMES = ['automatico', 'claro', 'escuro'] as const;
  const THEME_LABEL = { automatico: 'automático', claro: 'claro', escuro: 'escuro' } as const;
  const next = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length];
  const ThemeIcon = settings.theme === 'claro' ? Sun : settings.theme === 'escuro' ? Moon : SunMoon;
  const chip = chipFor(auto.phase, auto.drive);
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="USB Intelligence — início">
          <Wordmark />
        </Link>
        <nav className="quick" aria-label="Atalhos">
          {QUICK.map((p) => {
            const r = byPath(p);
            return (
              <NavLink key={p} to={p} end className="quick-link">
                <r.icon aria-hidden />
                {r.short}
              </NavLink>
            );
          })}
        </nav>
        <div className="head-actions">
          {chip && (
            <Link to="/automatico" className={`chip ${chip.cls}`} title="Estado do modo automático">
              <span className="dot" aria-hidden />
              <Usb aria-hidden />
              <span>{chip.text}</span>
            </Link>
          )}
          <span className={`net ${online ? 'on' : 'off'}`} role="status">
            <span className="sr-only">Conexão: </span><span className="net-t">{online ? 'Online' : 'Offline'}</span>
          </span>
          <button
            className="theme-btn"
            aria-label={`Tema ${THEME_LABEL[settings.theme]}. Alternar para ${THEME_LABEL[next]}`}
            title={`Tema: ${THEME_LABEL[settings.theme]} (toque para ${THEME_LABEL[next]})`}
            onClick={() => update({ theme: next }).then(() => toast({ tone: 'info', title: `Tema ${THEME_LABEL[next]}`, body: next === 'automatico' ? 'Segue o tema do seu sistema.' : 'Aplicado a todas as páginas.' })).catch(() => {})}
          >
            <ThemeIcon aria-hidden />
          </button>
          <button className="index-btn" aria-label="Menu" aria-expanded={open} aria-controls="indice" onClick={() => setOpen(true)}>
            <span className="index-btn-bars" aria-hidden><i /><i /></span>
            <span>Menu</span>
          </button>
        </div>
      </header>
      <AnimatePresence>{open && <IndexMenu onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function IndexMenu({ onClose }: { onClose: () => void }) {
  const { reducedMotion } = useSettings();
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
  return (
    <motion.div
      id="indice"
      className="index-menu"
      data-tone="grafite"
      role="dialog"
      aria-modal="true"
      aria-label="Menu do USB Intelligence"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 * d }}
    >
      <div className="index-top">
        <span className="label">Menu · {ROUTES.length} áreas em {GROUPS.length} grupos</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar <X aria-hidden />
        </button>
      </div>
      <nav className="index-groups" aria-label="Todas as áreas">
        {GROUPS.map((g, gi) => (
          <motion.section
            key={g}
            className="index-group"
            aria-label={g}
            initial={{ y: 24 * d, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: (0.05 + gi * 0.06) * d, duration: 0.4 * d, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="index-group-title label">{g}</h2>
            {ROUTES.filter((r) => r.group === g).map((r) => (
              <NavLink key={r.path} to={r.path} end className="index-item" onClick={onClose}>
                <span className="index-ico" aria-hidden><r.icon /></span>
                <span className="index-title">{r.title}</span>
                <span className="index-desc">{r.blurb}</span>
                <ArrowUpRight className="index-arrow" aria-hidden />
              </NavLink>
            ))}
          </motion.section>
        ))}
      </nav>
      <p className="index-blurb">Tudo roda neste aparelho. Nenhum arquivo sai daqui.</p>
    </motion.div>
  );
}

export function MobileTabs() {
  const tabs = ['/', '/automatico', '/arquivos', '/relatorios', '/seguranca'].map(byPath);
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
