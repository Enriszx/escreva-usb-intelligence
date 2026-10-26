import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsProvider } from './settings';
import { ConfirmProvider, ToastProvider } from './feedback';
import { FilesProvider } from '../features/files/store';
import { Header, MobileTabs } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { StatusBar } from '../components/layout/StatusBar';
import { routeFor } from './routes';
import HomePage from '../features/home/HomePage';

const FilesPage = lazy(() => import('../features/files/FilesPage'));
const LabPage = lazy(() => import('../features/lab/LabPage'));
const CharacterPage = lazy(() => import('../features/character/CharacterPage'));
const SecurityPage = lazy(() => import('../features/security/SecurityPage'));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const HelpPage = lazy(() => import('../features/help/HelpPage'));
const NotFound = lazy(() => import('./NotFound'));

function PageLoading() {
  return (
    <div className="page-loading" role="status">
      <div className="progress indet" style={{ width: 160 }}><i /></div>
      <span className="mono muted">Carregando área…</span>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const tone = routeFor(pathname)?.tone ?? 'grafite';
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    // Move o foco para o conteúdo novo: leitores de tela anunciam a troca de página.
    if (pathname !== '/') document.getElementById('conteudo')?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div className="app" data-tone={tone}>
      <a className="skip" href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>
        Pular para o conteúdo
      </a>
      <Header />
      <StatusBar />
      <main id="conteudo" tabIndex={-1}>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/arquivos" element={<FilesPage />} />
            <Route path="/laboratorio" element={<LabPage />} />
            <Route path="/personagem" element={<CharacterPage />} />
            <Route path="/seguranca" element={<SecurityPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/ajuda" element={<HelpPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <MobileTabs />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <FilesProvider>
            {/* HashRouter: funciona em qualquer servidor estático e no pendrive, sem regras de reescrita. */}
            <HashRouter>
              <Shell />
            </HashRouter>
          </FilesProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
