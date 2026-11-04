import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, CheckCircle2, Copy, FileBarChart2, FolderTree, Fingerprint, Lock, Presentation, RotateCcw, ScanSearch, Sparkles, Undo2, Usb, WifiOff, Zap,
} from 'lucide-react';
import { DeviceIllustration } from '../../components/three/Fallbacks';
import { HomeAvatar } from './HomeAvatar';
import { GROUPS, ROUTES } from '../../app/routes';
import { useSettings } from '../../app/settings';
import { useDocumentTitle, usePWA } from '../../app/hooks';
import { promptInstall } from '../../lib/pwa/pwa';
import { useToast } from '../../app/feedback';
import { BarList } from '../../components/charts/BarList';
import { CAT_VAR } from '../../components/charts/colors';
import { HashPlayground } from './HashPlayground';
import { useFiles } from '../files/store';
import { useAuto } from '../auto/auto';
import { formatBytes, pct, plural } from '../../lib/format';
import { CATEGORY_LABEL, type Category } from '../../lib/analysis/types';

const HeroScene = lazy(() => import('./HeroScene'));

/* Amostra FICTÍCIA para a demonstração. Nunca se mistura com os dados do usuário. */
const DEMO: Record<Category, { bytes: number; count: number }> = {
  videos: { bytes: 6_800_000_000, count: 64 },
  imagens: { bytes: 3_100_000_000, count: 1_420 },
  compactados: { bytes: 1_250_000_000, count: 38 },
  audios: { bytes: 960_000_000, count: 212 },
  documentos: { bytes: 412_000_000, count: 860 },
  apresentacoes: { bytes: 240_000_000, count: 47 },
  outros: { bytes: 180_000_000, count: 95 },
  planilhas: { bytes: 85_000_000, count: 131 },
};
const DEMO_TOTAL = Object.values(DEMO).reduce((a, b) => ({ bytes: a.bytes + b.bytes, count: a.count + b.count }), { bytes: 0, count: 0 });

const FLOW = [
  { Icon: Usb, title: 'Detecta', text: 'Você encaixa o pendrive. O app percebe sozinho, sem procurar menus.' },
  { Icon: ScanSearch, title: 'Lê e classifica', text: 'Cada arquivo vira um tipo: documentos, imagens, vídeos, planilhas e mais.' },
  { Icon: Fingerprint, title: 'Verifica', text: 'Calcula a impressão digital SHA-256 de cada arquivo, no próprio aparelho.' },
  { Icon: Copy, title: 'Acha cópias', text: 'Compara conteúdo, não nome. Mostra quanto espaço dá para recuperar.' },
  { Icon: FolderTree, title: 'Organiza', text: 'Monta pastas por tipo, data ou tamanho — e move, se você permitir.' },
  { Icon: FileBarChart2, title: 'Relata', text: 'Gera o relatório com números reais, pronto para exportar em CSV ou JSON.' },
];

export default function HomePage() {
  useDocumentTitle('');
  const { reducedMotion, loaded, settings } = useSettings();
  const files = useFiles();
  const auto = useAuto();
  const pwa = usePWA();
  const toast = useToast();
  const explode = useRef(0);
  const spin = useRef(0);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<'bytes' | 'count'>('bytes');
  const intro = loaded && settings.intro && !reducedMotion;

  // A rolagem separa levemente as camadas do objeto 3D.
  useEffect(() => {
    const on = () => { explode.current = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9))); };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // O fluxo avança sozinho (como o próprio app), até a pessoa tocar numa etapa.
  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = setInterval(() => setActive((a) => (a + 1) % FLOW.length), 2600);
    return () => clearInterval(id);
  }, [paused, reducedMotion]);

  const fade = (i: number) => (intro ? { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.06 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } } : { initial: false as const });
  const lib = files.entries;
  const r = auto.result;

  const demoRows = (Object.keys(DEMO) as Category[])
    .map((c) => ({ c, ...DEMO[c] }))
    .sort((a, b) => (view === 'bytes' ? b.bytes - a.bytes : b.count - a.count));

  return (
    <>
      {/* ===================== ABERTURA ===================== */}
      <section className="hero" data-tone="grafite" aria-labelledby="hero-title">
        <HomeAvatar />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <motion.span className="eyebrow" {...fade(0)}>
              <FlagDot /> Plataforma brasileira de inteligência de arquivos
            </motion.span>
            <motion.h1 id="hero-title" className="mega" {...fade(1)}>
              Encaixe o pendrive. <span className="grad-text">O resto é automático.</span>
            </motion.h1>
            <motion.p className="lead" {...fade(2)}>
              O USB Intelligence lê, verifica, encontra cópias, organiza e gera relatórios sozinho — com processamento 100% no seu aparelho,
              criptografia AES-256 e uma IA que entende português.
            </motion.p>
            <motion.div className="btn-row" {...fade(3)}>
              <Link to="/automatico" className="btn btn-primary btn-lg"><Zap aria-hidden /> Começar agora</Link>
              <a
                href="#como-funciona"
                className="btn btn-ghost btn-lg"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('como-funciona')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
                  (document.getElementById('como-funciona-t') as HTMLElement | null)?.focus({ preventScroll: true });
                }}
              >
                Ver como funciona <ArrowDown className="arrow" aria-hidden />
              </a>
            </motion.div>
            <motion.ul className="trust" {...fade(4)}>
              <li><Lock aria-hidden /> 100% no aparelho</li>
              <li><Fingerprint aria-hidden /> SHA-256 · AES-256</li>
              <li><WifiOff aria-hidden /> Funciona offline</li>
              <li><Sparkles aria-hidden /> IA grátis integrada</li>
            </motion.ul>
            <motion.div {...fade(5)}>
              <Link to="/apresentacao" className="btn btn-quiet"><Presentation aria-hidden /> Modo apresentação</Link>
            </motion.div>
          </div>

          <motion.div className="hero-visual" {...fade(2)}>
            <div className="hero-stage card">
              <Suspense fallback={<div className="stage stage-fallback"><DeviceIllustration note={false} /></div>}>
                <HeroScene explode={explode} spin={spin} />
              </Suspense>
              <div className="float-chip fc-1">
                <span className={`dot ${auto.phase === 'pronto' ? 'on' : auto.phase === 'executando' ? 'busy' : ''}`} aria-hidden />
                <span>
                  <small>Modo automático</small>
                  <strong>{auto.phase === 'pronto' ? `${auto.drive ?? 'Pendrive'} conectado` : auto.phase === 'executando' ? 'Analisando…' : auto.phase === 'aguardando' ? 'Aguardando pendrive' : auto.phase === 'indisponivel' ? 'Use o app Android' : 'Pronto para configurar'}</strong>
                </span>
              </div>
              <div className="float-chip fc-2">
                <CheckCircle2 aria-hidden />
                <span>
                  <small>{r ? 'Última execução' : lib.length ? 'Sua biblioteca' : 'Seus arquivos'}</small>
                  <strong className="num">
                    {r ? `${plural(r.files, 'arquivo', 'arquivos')} · ${plural(r.copies, 'cópia', 'cópias')}` : lib.length ? `${plural(lib.length, 'arquivo', 'arquivos')} · ${formatBytes(lib.reduce((s, f) => s + f.size, 0))}` : 'Nunca saem daqui'}
                  </strong>
                </span>
              </div>
              <button className="hero-recenter btn btn-ghost btn-sm" onClick={() => (spin.current = 0)}>
                <RotateCcw aria-hidden /> Recentralizar
              </button>
              <span className="hero-hint mono">Arraste para girar</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===================== INSTALAR ===================== */}
      {!pwa.installed && (
        <section className="install-cta" aria-label="Instalar o app">
          <div className="wrap install-cta-inner">
            <div>
              <strong>Instalar no seu aparelho</strong>
              <p>Use como app no celular ou computador. Funcione offline, arraste arquivos de fora e receba lembretes.</p>
            </div>
            {pwa.installable ? (
              <button className="btn btn-primary btn-sm" onClick={async () => { const r = await promptInstall(); if (r === 'accepted') toast({ tone: 'ok', title: 'App instalado!' }); }}>Instalar app</button>
            ) : (
              <small className="muted">No celular: navegador → menu ⋮ → Instalar app. No computador: Chrome/Edge → ⋮ → Instalar.</small>
            )}
          </div>
        </section>
      )}

      {/* ===================== COMO FUNCIONA ===================== */}
      <section id="como-funciona" className="sec" aria-labelledby="como-funciona-t">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Como funciona</span>
            <h2 id="como-funciona-t" className="h2" tabIndex={-1}>Do encaixe ao relatório, sozinho.</h2>
            <p className="lead">Seis etapas que o app executa sozinho depois de uma única autorização. Toque em uma para ver o detalhe.</p>
          </div>
          <div className="flow" onMouseLeave={() => setPaused(false)}>
            <div className="flow-rail" aria-hidden><i style={{ width: `${(active / (FLOW.length - 1)) * 100}%` }} /></div>
            <ol className="flow-steps">
              {FLOW.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    className={`flow-step ${i === active ? 'is-on' : ''} ${i < active ? 'is-done' : ''}`}
                    aria-pressed={i === active}
                    onClick={() => { setActive(i); setPaused(true); }}
                    onMouseEnter={() => { setActive(i); setPaused(true); }}
                  >
                    <span className="flow-ico"><s.Icon aria-hidden /></span>
                    <span className="flow-n mono">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flow-title">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="flow-detail card" aria-live="polite">
              <strong>{FLOW[active].title}.</strong> {FLOW[active].text}
            </p>
          </div>
        </div>
      </section>

      {/* ===================== RESULTADO (DEMONSTRAÇÃO) ===================== */}
      <section id="experiencia" className="sec" aria-labelledby="experiencia-title">
        <div className="wrap result-grid">
          <div className="sec-head">
            <span className="demo-flag">Demonstração · dados de exemplo, não são seus arquivos</span>
            <h2 id="experiencia-title" className="h2" tabIndex={-1}>Números que respondem, não que enfeitam.</h2>
            <p className="lead">
              Cada gráfico mostra o valor escrito ao lado da barra e a parte do total. Sem legenda para decifrar, sem efeito 3D, sem pizza confusa.
            </p>
            <Link to="/automatico" className="btn btn-ghost">Ver com o meu pendrive <ArrowRight className="arrow" aria-hidden /></Link>
          </div>
          <div className="card demo-card">
            <dl className="stat-grid">
              <div className="stat"><dt>Arquivos</dt><dd className="num">{DEMO_TOTAL.count.toLocaleString('pt-BR')}</dd><dd className="stat-sub muted">{formatBytes(DEMO_TOTAL.bytes)}</dd></div>
              <div className="stat"><dt>Verificados</dt><dd className="num">100%</dd><dd className="stat-sub muted">SHA-256</dd></div>
              <div className="stat"><dt>Cópias extras</dt><dd className="num">183</dd><dd className="stat-sub muted">{formatBytes(2_340_000_000)} recuperáveis</dd></div>
              <div className="stat"><dt>Pastas</dt><dd className="num">8</dd><dd className="stat-sub muted">por tipo</dd></div>
            </dl>
            <div className="chart-head">
              <h3 className="chart-title">{view === 'bytes' ? 'Espaço por tipo de arquivo' : 'Quantidade por tipo de arquivo'}</h3>
              <div className="seg" role="radiogroup" aria-label="Medida do gráfico">
                <label><input type="radio" name="demo-view" checked={view === 'bytes'} onChange={() => setView('bytes')} /><span>Espaço</span></label>
                <label><input type="radio" name="demo-view" checked={view === 'count'} onChange={() => setView('count')} /><span>Quantidade</span></label>
              </div>
            </div>
            <BarList
              title={`${view === 'bytes' ? 'Espaço' : 'Quantidade'} por tipo (exemplo)`}
              data={demoRows.map((d) => ({
                key: d.c,
                label: CATEGORY_LABEL[d.c],
                value: view === 'bytes' ? d.bytes : d.count,
                color: CAT_VAR[d.c],
                detail: view === 'bytes' ? `${pct(d.bytes, DEMO_TOTAL.bytes)} do espaço` : `${pct(d.count, DEMO_TOTAL.count)} dos arquivos`,
              }))}
              format={view === 'bytes' ? formatBytes : (v) => v.toLocaleString('pt-BR')}
            />
          </div>
        </div>
      </section>

      {/* ===================== ÁREAS ===================== */}
      <section className="sec" aria-labelledby="areas-t">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Plataforma</span>
            <h2 id="areas-t" className="h2">Tudo organizado em quatro frentes.</h2>
            <p className="lead">{ROUTES.length - 1} áreas que funcionam de verdade. O que depende de permissão do sistema está dito lá dentro.</p>
          </div>
          <div className="areas">
            {GROUPS.map((g) => (
              <div key={g} className="area-group">
                <h3 className="label">{g}</h3>
                {ROUTES.filter((r) => r.group === g && r.path !== '/').map((r) => (
                  <Link key={r.path} to={r.path} className="area-card card">
                    <span className="area-ico" aria-hidden><r.icon /></span>
                    <span className="area-title">{r.title}</span>
                    <span className="area-desc">{r.blurb}</span>
                    <ArrowUpRight className="area-arrow" aria-hidden />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PROVA (HASH AO VIVO) ===================== */}
      <section className="sec" aria-labelledby="prova-t">
        <div className="wrap">
          <div className="card proof">
            <div className="sec-head">
              <span className="label">Comprove agora</span>
              <h2 id="prova-t" className="h2">Cópia é conteúdo igual — não nome igual.</h2>
              <p className="lead">Edite os textos abaixo. O cálculo SHA-256 é real e acontece no seu aparelho: é assim que o detector de duplicados decide.</p>
            </div>
            <HashPlayground />
          </div>
        </div>
      </section>

      {/* ===================== COMPROMISSOS ===================== */}
      <section className="sec" aria-labelledby="comp-t">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Segurança e confiança</span>
            <h2 id="comp-t" className="h2">Feito para dados que importam.</h2>
          </div>
          <ul className="pillars">
            <li className="card"><Lock aria-hidden /><h3 className="h3">Privado por padrão</h3><p className="muted">Nenhum arquivo sai do aparelho. A IA online é opcional e nunca recebe o conteúdo dos arquivos.</p></li>
            <li className="card"><Fingerprint aria-hidden /><h3 className="h3">Integridade verificável</h3><p className="muted">SHA-256 para cada arquivo e cofre AES-256-GCM com chave derivada da sua senha.</p></li>
            <li className="card"><Undo2 aria-hidden /><h3 className="h3">Tudo reversível</h3><p className="muted">Nada é apagado sem confirmação. Cópias vão para uma lixeira restaurável e cada ação fica no histórico.</p></li>
          </ul>
        </div>
      </section>

      {/* ===================== CHAMADA FINAL ===================== */}
      <section className="sec" aria-labelledby="cta-t">
        <div className="wrap">
          <div className="cta card">
            <div>
              <h2 id="cta-t" className="h2">Pronto para deixar o pendrive em ordem?</h2>
              <p className="lead">Configure uma vez. Nas próximas, é só encaixar.</p>
            </div>
            <div className="btn-row">
              <Link to="/automatico" className="btn btn-primary btn-lg"><Zap aria-hidden /> Ativar o modo automático</Link>
              <Link to="/arquivos" className="btn btn-ghost btn-lg">Escolher arquivos manualmente</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Mini selo com as cores da bandeira (estilizado). */
function FlagDot() {
  return (
    <svg className="flagdot" viewBox="0 0 18 12" aria-hidden>
      <rect width="18" height="12" rx="3" fill="#009c3b" />
      <path d="M9 1.6 L16.2 6 L9 10.4 L1.8 6 Z" fill="#ffdf00" />
      <circle cx="9" cy="6" r="2.6" fill="#002776" />
    </svg>
  );
}
