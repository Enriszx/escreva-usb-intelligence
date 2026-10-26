import { useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eraser } from 'lucide-react';
import { useFiles } from './store';
import { Intake } from './Intake';
import { AnalysisBar } from './AnalysisBar';
import { ArchiveTab } from './ArchiveTab';
import { DashboardTab } from './DashboardTab';
import { DuplicatesTab } from './DuplicatesTab';
import { NamesTab } from './NamesTab';
import { OrganizeTab } from './OrganizeTab';
import { useDocumentTitle } from '../../app/hooks';
import { useConfirm } from '../../app/feedback';
import { formatBytes, plural } from '../../lib/format';
import type { Category } from '../../lib/analysis/types';
import './files.css';

const TABS = [
  { id: 'acervo', label: 'Acervo' },
  { id: 'painel', label: 'Painel' },
  { id: 'duplicados', label: 'Duplicados' },
  { id: 'nomes', label: 'Nomes' },
  { id: 'organizacao', label: 'Organização' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function FilesPage() {
  useDocumentTitle('Central de arquivos');
  const { entries, clear, run } = useFiles();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('aba'))?.id ?? 'acervo') as TabId;
  const setTab = (id: TabId) => setParams((p) => { p.set('aba', id); return p; }, { replace: true });
  const [category, setCategory] = useState<Category | null>(null);
  const [ext, setExt] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const total = entries.reduce((s, f) => s + f.size, 0);
  const hashed = entries.filter((f) => f.sha256).length;

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const n = TABS.length;
    const go = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (go < 0) return;
    e.preventDefault();
    setTab(TABS[go].id);
    tabRefs.current[go]?.focus();
  };

  return (
    <div className="page files-page">
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>02</span>
          <div>
            <span className="label">Central de arquivos</span>
            <h1 className="h1">O acervo<br />na mesa.</h1>
          </div>
          <div className="files-status">
            {entries.length ? (
              <p className="lead">
                <strong className="num">{plural(entries.length, 'arquivo', 'arquivos')}</strong> · <span className="num">{formatBytes(total)}</span>
                <br /><span className="muted">{hashed} com SHA-256 calculado</span>
              </p>
            ) : (
              <p className="lead muted">Nenhum arquivo selecionado.</p>
            )}
            {entries.length > 0 && (
              <button
                className="btn btn-quiet btn-sm"
                disabled={!!run}
                onClick={async () => {
                  if (await confirm({ title: 'Esvaziar a lista?', body: <p>A lista de análise fica vazia. <strong>Nenhum arquivo é apagado</strong>; relatórios já salvos continuam em Relatórios.</p>, confirm: 'Esvaziar lista' })) {
                    clear();
                    setCategory(null);
                    setExt(null);
                  }
                }}
              >
                <Eraser aria-hidden /> Esvaziar lista
              </button>
            )}
          </div>
        </header>

        <Intake compact={entries.length > 0} />
        <AnalysisBar />

        {entries.length > 0 ? (
          <>
            <div className="tabs" role="tablist" aria-label="Ferramentas da central">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => (tabRefs.current[i] = el)}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  className="tab"
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  <span className="mono">0{i + 1}</span> {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
              {tab === 'acervo' && <ArchiveTab category={category} setCategory={setCategory} ext={ext} setExt={setExt} />}
              {tab === 'painel' && <DashboardTab category={category} setCategory={setCategory} setExt={setExt} goArchive={() => setTab('acervo')} />}
              {tab === 'duplicados' && <DuplicatesTab />}
              {tab === 'nomes' && <NamesTab />}
              {tab === 'organizacao' && <OrganizeTab />}
            </div>
          </>
        ) : (
          <EmptyGuide />
        )}
      </div>
    </div>
  );
}

function EmptyGuide() {
  return (
    <div className="empty-guide">
      <p className="label">O que acontece depois</p>
      <ol>
        <li><span className="outline-num">1</span><p><strong>Acervo.</strong> Nome, tipo, tamanho e data de cada arquivo, com busca, filtros e ordenação.</p></li>
        <li><span className="outline-num">2</span><p><strong>Painel.</strong> Gráficos por categoria e extensão, calculados da sua seleção.</p></li>
        <li><span className="outline-num">3</span><p><strong>Duplicados.</strong> Agrupa por tamanho, confirma por SHA-256 e soma o espaço recuperável.</p></li>
        <li><span className="outline-num">4</span><p><strong>Organização.</strong> Propõe pastas e exporta o plano. Nada se move sem você.</p></li>
      </ol>
    </div>
  );
}
