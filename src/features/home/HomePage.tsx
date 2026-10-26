import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, RotateCcw } from 'lucide-react';
import { Topo } from '../../components/ui/Topo';
import { DeviceIllustration } from '../../components/three/Fallbacks';
import { ROUTES } from '../../app/routes';
import { useSettings } from '../../app/settings';
import { useDocumentTitle } from '../../app/hooks';
import { useToast } from '../../app/feedback';
import { Donut } from '../../components/charts/Donut';
import { CAT_VAR } from '../../components/charts/colors';
import { HashPlayground } from './HashPlayground';
import { formatBytes } from '../../lib/format';
import { CATEGORY_LABEL, type Category } from '../../lib/analysis/types';

const HeroScene = lazy(() => import('./HeroScene'));

/* Amostra FICTÍCIA para a demonstração. Nunca se mistura com os dados do usuário. */
const DEMO: Record<Category, number> = {
  documentos: 412_000_000, imagens: 3_100_000_000, videos: 6_800_000_000, audios: 960_000_000, compactados: 1_250_000_000, outros: 180_000_000,
};

export default function HomePage() {
  useDocumentTitle('');
  const { settings, update, reducedMotion, loaded } = useSettings();
  const toast = useToast();
  const playIntro = loaded && settings.intro && !reducedMotion;
  const explode = useRef(0);
  const spin = useRef(0);
  const hero = useRef<HTMLElement>(null);
  const [demoCat, setDemoCat] = useState<string | null>(null);

  // A rolagem pela abertura separa as camadas do objeto.
  useEffect(() => {
    const on = () => {
      const h = hero.current?.offsetHeight ?? 1;
      explode.current = Math.min(1, Math.max(0, window.scrollY / (h * 0.7)));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -120]);

  const line = (i: number) =>
    playIntro
      ? { initial: { y: '105%' }, animate: { y: '0%' }, transition: { delay: 0.08 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } }
      : { initial: false as const };

  return (
    <>
      {/* ===================== ABERTURA ===================== */}
      <section ref={hero} className="hero" data-tone="grafite" aria-labelledby="hero-title">
        <Topo seed={3} levels={12} className="hero-topo" />
        <div className="hero-meta wrap">
          <span className="label plain">Nº 01 — Ecossistema de arquivos</span>
          <span className="mono muted hero-coords" aria-hidden>15°47′S 47°52′W</span>
        </div>

        <div className="hero-3d">
          <Suspense fallback={<div className="stage stage-fallback"><DeviceIllustration note={false} /></div>}>
            <HeroScene explode={explode} spin={spin} />
          </Suspense>
        </div>

        <motion.div className="hero-copy wrap" style={{ y: titleY }}>
          <h1 id="hero-title" className="mega hero-title">
            <span className="line-mask"><motion.span className="line" {...line(0)}>Seus dados.</motion.span></span>
            <span className="line-mask indent"><motion.span className="line" {...line(1)}>Seu <em>universo.</em></motion.span></span>
          </h1>
        </motion.div>

        <div className="hero-foot wrap">
          <motion.div
            className="hero-lead"
            initial={playIntro ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            <p className="lead">Organize, explore e proteja seus arquivos com inteligência e controle.</p>
            <div className="btn-row">
              <Link to="/arquivos" className="btn btn-primary">
                Entrar no sistema <ArrowRight className="arrow" aria-hidden />
              </Link>
              <a
                href="#experiencia"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('experiencia')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
                  (document.getElementById('experiencia-title') as HTMLElement | null)?.focus({ preventScroll: true });
                }}
              >
                Explorar a experiência <ArrowDown className="arrow" aria-hidden />
              </a>
            </div>
          </motion.div>
          <div className="hero-controls">
            <span className="mono muted">Arraste o objeto para os lados</span>
            <button className="btn btn-ghost btn-sm" onClick={() => (spin.current = 0)}>
              <RotateCcw aria-hidden /> Recentralizar
            </button>
            <label className="switch hero-intro-switch">
              <span className="mono">Animação de abertura</span>
              <input
                type="checkbox"
                checked={settings.intro}
                onChange={(e) =>
                  update({ intro: e.target.checked })
                    .then(() => toast({ tone: 'ok', title: e.target.checked ? 'Abertura ativada' : 'Abertura desativada', body: 'Preferência salva neste dispositivo.' }))
                    .catch(() => {})
                }
              />
            </label>
          </div>
        </div>
        <ul className="hero-ticker mono" aria-hidden>
          <li>Ler</li><li>Classificar</li><li>Comparar</li><li>Proteger</li>
        </ul>
      </section>

      {/* ===================== DEMONSTRAÇÃO ===================== */}
      <section id="experiencia" className="demo" data-tone="mata" aria-labelledby="experiencia-title">
        <Topo seed={21} levels={8} className="demo-topo" />
        <div className="wrap">
          <div className="demo-head">
            <span className="demo-flag">Demonstração · dados de exemplo, não são seus arquivos</span>
            <h2 id="experiencia-title" className="h1" tabIndex={-1}>
              Como o <span className="hl">USB&nbsp;Intelligence</span> pensa.
            </h2>
            <p className="lead">Quatro movimentos. Os dois primeiros usam uma amostra inventada; o terceiro calcula hashes de verdade com o que você digitar.</p>
          </div>

          <ol className="steps">
            <li className="step">
              <div className="step-n outline-num" aria-hidden>01</div>
              <div className="step-body">
                <h3 className="h3">Ler só o que você entrega.</h3>
                <p className="muted">
                  Navegadores não enxergam o celular inteiro — e não deveriam. Você escolhe arquivos (ou uma pasta, quando o navegador permite) e o
                  app trabalha apenas com eles. Nada é enviado para fora.
                </p>
                <Link to="/arquivos" className="btn btn-quiet">Abrir a central de arquivos <ArrowUpRight aria-hidden /></Link>
              </div>
            </li>

            <li className="step step-chart">
              <div className="step-n outline-num" aria-hidden>02</div>
              <div className="step-body">
                <h3 className="h3">Classificar pelo que cada arquivo é.</h3>
                <p className="muted">Extensão e tipo viram seis famílias. Toque numa fatia para destacá-la. Os números abaixo são de uma amostra fictícia de {formatBytes(Object.values(DEMO).reduce((a, b) => a + b, 0))}.</p>
              </div>
              <div className="step-viz">
                <Donut
                  title="Amostra fictícia por categoria"
                  data={(Object.keys(DEMO) as Category[]).map((c) => ({ key: c, label: CATEGORY_LABEL[c], value: DEMO[c], color: CAT_VAR[c] }))}
                  format={formatBytes}
                  centerLabel="amostra fictícia"
                  selected={demoCat}
                  onSelect={setDemoCat}
                  size={220}
                />
              </div>
            </li>

            <li className="step step-wide">
              <div className="step-n outline-num" aria-hidden>03</div>
              <div className="step-body">
                <h3 className="h3">Comparar conteúdo, não nome.</h3>
                <p className="muted">
                  Cada conteúdo gera uma impressão digital SHA-256. Edite os textos: este cálculo é real e acontece no seu aparelho. É assim que o
                  detector separa “nome repetido” de “cópia de verdade”.
                </p>
              </div>
              <HashPlayground />
            </li>

            <li className="step">
              <div className="step-n outline-num" aria-hidden>04</div>
              <div className="step-body">
                <h3 className="h3">Proteger com senha que só você sabe.</h3>
                <p className="muted">
                  O cofre usa AES-256-GCM com chave derivada da sua senha. A senha não é guardada em lugar nenhum: se ela se perder, o arquivo cifrado
                  também se perde. Isso é uma característica, não um defeito.
                </p>
                <Link to="/seguranca" className="btn btn-quiet">Ver segurança e integridade <ArrowUpRight aria-hidden /></Link>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ===================== ÍNDICE EDITORIAL ===================== */}
      <section className="toc" data-tone="grafite" aria-labelledby="toc-title">
        <div className="wrap">
          <div className="toc-head">
            <h2 id="toc-title" className="h2">Oito ferramentas,<br />um só lugar.</h2>
            <p className="muted">Cada linha abre uma área que funciona agora. O que depende de permissão do sistema está dito lá dentro.</p>
          </div>
          <ul className="toc-list">
            {ROUTES.slice(1).map((r) => (
              <li key={r.path}>
                <Link to={r.path} className="toc-row" data-tone-hint={r.tone}>
                  <span className="mono toc-n">{r.n}</span>
                  <span className="toc-title">{r.title}</span>
                  <span className="toc-blurb muted">{r.blurb}</span>
                  <ArrowUpRight className="toc-arrow" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===================== PENDRIVE ===================== */}
      <section className="otg" data-tone="noite" aria-labelledby="otg-title">
        <div className="wrap otg-grid">
          <div>
            <span className="label">Equipamento inicial</span>
            <h2 id="otg-title" className="h2">Celular, OTG,<br />pendrive de 16&nbsp;GB.</h2>
            <p className="lead muted">
              No Android, conecte o pendrive pelo adaptador OTG e escolha os arquivos dele no seletor do sistema. O app não abre o pendrive sozinho —
              quem autoriza é você, arquivo por arquivo.
            </p>
            <Link to="/ajuda" className="btn btn-ghost">Guia de uso no Android <ArrowRight className="arrow" aria-hidden /></Link>
          </div>
          <OtgDiagram />
        </div>
      </section>

      {/* ===================== COMPROMISSOS ===================== */}
      <section className="pledge" data-tone="gelo" aria-label="Compromissos">
        <div className="wrap">
          <p className="pledge-text">
            Nada é <mark>apagado</mark> sem você confirmar. Nada <mark>sai do aparelho</mark> sem você pedir. Nenhum número nesta interface é
            <mark> inventado</mark> — exceto onde está escrito “demonstração”.
          </p>
        </div>
      </section>
    </>
  );
}

function OtgDiagram() {
  return (
    <svg className="otg-diagram" viewBox="0 0 520 300" role="img" aria-label="Diagrama: celular Android ligado a um adaptador OTG, ligado a um pendrive de 16 GB">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="20" y="30" width="130" height="240" />
        <rect x="32" y="52" width="106" height="186" stroke="var(--line-strong)" />
        <line x1="70" y1="40" x2="100" y2="40" />
        <rect x="70" y="270" width="30" height="10" />
        <path d="M85 280 C85 300 200 290 220 230" strokeDasharray="4 4" stroke="var(--signal)" />
        <rect x="205" y="200" width="60" height="30" />
        <rect x="265" y="208" width="26" height="14" />
        <rect x="300" y="190" width="40" height="50" stroke="var(--c-sol)" />
        <rect x="340" y="185" width="150" height="60" />
        <line x1="350" y1="200" x2="470" y2="200" stroke="var(--line-strong)" />
        <line x1="350" y1="215" x2="470" y2="215" stroke="var(--line-strong)" />
      </g>
      <g className="otg-labels" fill="currentColor">
        <text x="20" y="20">ANDROID</text>
        <text x="205" y="190">OTG</text>
        <text x="340" y="175">PENDRIVE 16 GB</text>
        <text x="40" y="150" fill="var(--signal)">USB Intelligence</text>
        <text x="40" y="168" fill="var(--fg-2)">instalado</text>
      </g>
    </svg>
  );
}
