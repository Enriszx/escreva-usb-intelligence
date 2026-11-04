import { useEffect, useRef } from 'react';
import { useSettings } from '../../app/settings';

/**
 * Fundo inspirado na bandeira do Brasil: campo verde, losango dourado, globo
 * anil com o Cruzeiro do Sul e a faixa branca. É uma composição estilizada
 * (cores e transparências de interface), não a reprodução oficial do símbolo
 * nacional — a Lei 5.700/71 pede que a bandeira não seja alterada.
 * Reage ao ponteiro e à rolagem (paralaxe leve), salvo com movimento reduzido.
 */
const VB = '0 0 1600 1100';

// Estrelas dentro do globo (centro 800,550; raio 270). As cinco primeiras formam o Cruzeiro do Sul.
const STARS: [number, number, number][] = [
  [800, 598, 4.6], [800, 702, 4.2], [762, 652, 3.8], [838, 646, 3.6], [818, 676, 2.4],
  [700, 610, 2.6], [905, 600, 3], [680, 690, 2.2], [930, 700, 2.4], [880, 740, 2],
  [720, 745, 2.6], [760, 780, 2], [850, 790, 2.2], [965, 650, 1.8], [640, 650, 1.8],
  [890, 660, 1.6], [742, 710, 1.6], [990, 590, 2], [612, 600, 1.6], [800, 770, 3], [665, 735, 1.6],
];

export function BrasilBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useSettings();

  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion) {
      el?.style.setProperty('--mx', '0');
      el?.style.setProperty('--my', '0');
      el?.style.setProperty('--sy', '0');
      return;
    }
    let raf = 0;
    let mx = 0, my = 0, sy = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--mx', mx.toFixed(3));
      el.style.setProperty('--my', my.toFixed(3));
      el.style.setProperty('--sy', sy.toFixed(3));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
      queue();
    };
    const onScroll = () => {
      sy = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      queue();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div ref={root} className="bb" aria-hidden>
      {/* Camada 1: brilhos e grade de pontos */}
      <svg className="bb-layer bb-back" viewBox={VB} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="bb-gg" cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: 'var(--bb-green)', stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: 'var(--bb-green)', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="bb-gb" cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: 'var(--bb-blue)', stopOpacity: 0.5 }} />
            <stop offset="1" style={{ stopColor: 'var(--bb-blue)', stopOpacity: 0 }} />
          </radialGradient>
          <pattern id="bb-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" style={{ fill: 'var(--bb-dot)' }} />
          </pattern>
          <radialGradient id="bb-fade" cx="50%" cy="45%" r="65%">
            <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="bb-mask"><rect width="1600" height="1100" fill="url(#bb-fade)" /></mask>
        </defs>
        <ellipse cx="240" cy="160" rx="620" ry="420" fill="url(#bb-gg)" />
        <ellipse cx="1420" cy="980" rx="640" ry="440" fill="url(#bb-gb)" />
        <ellipse cx="1450" cy="120" rx="420" ry="300" fill="url(#bb-gg)" opacity="0.6" />
        <rect width="1600" height="1100" fill="url(#bb-dots)" mask="url(#bb-mask)" />
      </svg>

      {/* Camada 2: o losango */}
      <svg className="bb-layer bb-mid" viewBox={VB} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bb-rh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--bb-gold-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--bb-gold-2)' }} />
          </linearGradient>
          <linearGradient id="bb-rh-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--bb-gold-1)', stopOpacity: 0 }} />
            <stop offset="0.5" style={{ stopColor: 'var(--bb-gold-1)', stopOpacity: 1 }} />
            <stop offset="1" style={{ stopColor: 'var(--bb-gold-1)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <polygon className="bb-rh-fill" points="800,95 1530,550 800,1005 70,550" fill="url(#bb-rh)" />
        <polygon className="bb-rh-stroke" points="800,95 1530,550 800,1005 70,550" fill="none" stroke="url(#bb-rh-line)" strokeWidth="2" />
        <polygon className="bb-rh-inner" points="800,150 1440,550 800,950 160,550" fill="none" stroke="var(--bb-gold-1)" strokeWidth="1" strokeDasharray="2 10" />
      </svg>

      {/* Camada 3: globo, faixa, estrelas e órbita */}
      <svg className="bb-layer bb-front" viewBox={VB} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="bb-globe" cx="40%" cy="35%" r="75%">
            <stop offset="0" style={{ stopColor: 'var(--bb-globe-1)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--bb-globe-2)' }} />
            <stop offset="1" style={{ stopColor: 'var(--bb-globe-3)' }} />
          </radialGradient>
          <clipPath id="bb-clip"><circle cx="800" cy="550" r="270" /></clipPath>
        </defs>
        <circle className="bb-halo" cx="800" cy="550" r="300" fill="none" stroke="var(--bb-halo)" strokeWidth="40" />
        <circle className="bb-globe" cx="800" cy="550" r="270" fill="url(#bb-globe)" />
        <g clipPath="url(#bb-clip)">
          <path className="bb-band" d="M 520 500 Q 800 410 1085 610" fill="none" stroke="var(--bb-band)" strokeWidth="34" strokeLinecap="round" />
          {STARS.map(([x, y, r], i) => (
            <circle key={i} className="bb-star" cx={x} cy={y} r={r} style={{ animationDelay: `${(i * 0.37) % 4}s` }} />
          ))}
        </g>
        <ellipse className="bb-orbit" cx="800" cy="550" rx="390" ry="128" fill="none" stroke="var(--bb-orbit)" strokeWidth="1.4" strokeDasharray="3 9" transform="rotate(-18 800 550)" />
        {!reducedMotion && (
          <g transform="rotate(-18 800 550)">
            <circle className="bb-sat" r="5" fill="var(--c-sol)">
              <animateMotion dur="26s" repeatCount="indefinite" path="M 1190 550 A 390 128 0 1 1 410 550 A 390 128 0 1 1 1190 550" />
            </circle>
          </g>
        )}
      </svg>

      <div className="bb-vignette" />
    </div>
  );
}
