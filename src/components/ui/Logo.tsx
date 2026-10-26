/** Marca: a boca de uma porta USB-A vista de frente, com a lingueta deslocada formando um "i". */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect x="2.5" y="7.5" width="27" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="6" y="11" width="15" height="5" fill="currentColor" />
      <rect x="24" y="11" width="2.6" height="10" fill="var(--c-sol)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark />
      <span className="wordmark-text">
        <b>USB</b> Intelligence
      </span>
    </span>
  );
}
