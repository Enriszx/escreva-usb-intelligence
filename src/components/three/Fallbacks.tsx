/**
 * Alternativas vetoriais para quando não há WebGL. Desenhadas à mão no mesmo
 * idioma do 3D (camadas, conector, curvas de nível) — não são capturas.
 */
export function DeviceIllustration({ note = true }: { note?: boolean }) {
  // Projeção isométrica simples de caixas empilhadas
  const iso = (x: number, y: number, z: number) => [300 + (x - z) * 0.866 * 60, 210 + (x + z) * 0.5 * 60 - y * 60] as const;
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill: string, stroke = 'var(--line-strong)') => {
    const p = (x: number, y: number, z: number) => iso(x, y, z).join(',');
    return (
      <g stroke={stroke} strokeWidth="1.2" strokeLinejoin="round">
        <polygon points={`${p(x0, y1, z0)} ${p(x1, y1, z0)} ${p(x1, y1, z1)} ${p(x0, y1, z1)}`} fill={fill} />
        <polygon points={`${p(x0, y0, z1)} ${p(x1, y0, z1)} ${p(x1, y1, z1)} ${p(x0, y1, z1)}`} fill={fill} opacity="0.75" />
        <polygon points={`${p(x1, y0, z0)} ${p(x1, y0, z1)} ${p(x1, y1, z1)} ${p(x1, y1, z0)}`} fill={fill} opacity="0.55" />
      </g>
    );
  };
  return (
    <figure className="fallback-figure">
      <svg viewBox="0 0 600 420" aria-label="Ilustração do Núcleo USBI em camadas">
        {box(-1.6, 1.6, -1.1, -0.95, -0.6, 0.6, '#101311')}
        {box(-1.45, 1.45, -0.55, -0.5, -0.5, 0.5, '#063d2e')}
        {box(-1.5, 1.5, 0.0, 0.12, -0.55, 0.55, 'rgba(0,230,118,0.35)')}
        {box(-1.6, 1.6, 0.55, 0.65, -0.6, 0.6, '#20262a')}
        {box(1.75, 1.9, -0.4, 0.05, -0.62, 0.62, '#ffd600', '#7a5c00')}
        {box(2.1, 3.0, -0.3, -0.08, -0.3, 0.3, '#c8ced0', '#6b7375')}
        <g stroke="var(--c-sinal)" strokeDasharray="3 5" strokeWidth="1">
          <line x1={iso(0, -0.95, 0)[0]} y1={iso(0, -0.95, 0)[1]} x2={iso(0, 0.55, 0)[0]} y2={iso(0, 0.55, 0)[1]} />
        </g>
      </svg>
      {note && <figcaption className="mono muted">Seu navegador não ofereceu WebGL. Esta é uma ilustração estática do objeto 3D.</figcaption>}
    </figure>
  );
}
