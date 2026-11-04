import { useId } from 'react';

/**
 * Marca: um selo verde com losango dourado e globo anil (inspirado na bandeira),
 * cortado por um conector USB branco. Funciona em 16 px e em 64 px.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false" className="logo-mark">
      <defs>
        <linearGradient id={`lg-g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00b347" />
          <stop offset="1" stopColor="#006b2c" />
        </linearGradient>
        <radialGradient id={`lg-b-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#2c5be0" />
          <stop offset="1" stopColor="#002776" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#lg-g-${id})`} />
      <path d="M16 5.2 L27.4 16 L16 26.8 L4.6 16 Z" fill="#ffdf00" />
      <circle cx="16" cy="16" r="6.4" fill={`url(#lg-b-${id})`} />
      <rect x="13.2" y="12.4" width="5.6" height="7.2" rx="1" fill="#fff" />
      <rect x="14.2" y="10.4" width="1.2" height="2.4" fill="#fff" />
      <rect x="16.6" y="10.4" width="1.2" height="2.4" fill="#fff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark />
      <span>
        <span className="wordmark-text"><b>USB</b> Intelligence</span>
        <span className="wordmark-sub">Brasil · inteligência de arquivos</span>
      </span>
    </span>
  );
}
