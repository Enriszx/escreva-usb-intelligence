import { useEffect, useMemo, useState } from 'react';
import { useChartTip } from './tip';

export interface DayPoint {
  start: number;
  count: number;
}

const H = 190;
const L = 34;
const TOP = 25;
const BASE = 150;

/** Importações por dia no período. Cada ponto é focável e mostra a data e a contagem. */
export function DailyLine({ days, title }: { days: DayPoint[]; title: string }) {
  const { box, bind, layer } = useChartTip();
  // O desenho usa a largura real em pixels: rótulos mantêm tamanho legível no celular.
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  const R = W - 14;
  const max = Math.max(1, ...days.map((d) => d.count));
  const n = days.length;
  const x = (i: number) => (n === 1 ? (L + R) / 2 : L + (i * (R - L)) / (n - 1));
  const y = (c: number) => BASE - (c / max) * (BASE - TOP);
  const path = useMemo(() => {
    if (!n) return '';
    let d = `M${x(0)} ${y(days[0].count)}`;
    for (let i = 1; i < n; i++) {
      const m = (x(i - 1) + x(i)) / 2;
      d += `C${m} ${y(days[i - 1].count)} ${m} ${y(days[i].count)} ${x(i)} ${y(days[i].count)}`;
    }
    return d;
  }, [days, W]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const total = days.reduce((s, d) => s + d.count, 0);
  const dense = n > 30;
  return (
    <figure className="chart-box" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${total} importados em ${n} dias, máximo de ${max} por dia`}>
        <defs>
          <linearGradient id="dl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--signal)" stopOpacity=".32" />
            <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <line key={i} x1={L} x2={R} y1={TOP + i * ((BASE - TOP) / 2)} y2={TOP + i * ((BASE - TOP) / 2)} stroke="var(--line)" strokeDasharray="3 4" />
        ))}
        <text className="chart-axis" x={L - 6} y={TOP + 4} textAnchor="end">{max}</text>
        <text className="chart-axis" x={L - 6} y={BASE + 4} textAnchor="end">0</text>
        {n > 0 && <path d={`${path}L${x(n - 1)} ${BASE}L${x(0)} ${BASE}z`} fill="url(#dl-area)" />}
        {n > 0 && <path d={path} fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" />}
        {days.map((d, i) => (
          <g key={d.start} tabIndex={0} role="img" aria-label={`${fmt(d.start)}: ${d.count} importado(s)`} {...bind(<><strong className="num">{d.count}</strong> importado(s)<br /><span className="mono">{fmt(d.start)}</span></>)}>
            <circle cx={x(i)} cy={y(d.count)} r={dense ? 7 : 14} fill="transparent" />
            <circle cx={x(i)} cy={y(d.count)} r={dense ? 1.6 : 4} fill="var(--signal)" stroke="var(--bg-2)" strokeWidth="2" />
          </g>
        ))}
        {n > 0 && <text className="chart-axis" x={L} y={H - 6}>{fmt(days[0].start)}</text>}
        <text className="chart-axis" x={R} y={H - 6} textAnchor="end">hoje</text>
      </svg>
      {layer}
      <details className="data-table">
        <summary>Ver dados em tabela</summary>
        <table>
          <thead><tr><th>Dia</th><th>Importados</th></tr></thead>
          <tbody>{[...days].reverse().map((d) => <tr key={d.start}><td>{new Date(d.start).toLocaleDateString('pt-BR')}</td><td className="num">{d.count}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
