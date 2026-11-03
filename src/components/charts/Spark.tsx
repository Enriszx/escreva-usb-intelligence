/** Linha mínima de tendência (14 pontos), com o último ponto marcado. Decorativa. */
export function Sparkline({ values, color = 'currentColor' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i * 100) / Math.max(1, values.length - 1), 26 - (v / max) * 22] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden focusable="false">
      <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
