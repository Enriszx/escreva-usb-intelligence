import { useMemo, useState } from 'react';

export interface Point {
  key: string;
  at: number;
  value: number;
  label: string;
  tone: 'ok' | 'warn' | 'err';
}

/**
 * Linha do tempo de análises: um ponto por operação no eixo de tempo real,
 * altura = quantidade de arquivos. Cada ponto é focável e mostra detalhes.
 */
export function Timeline({ points, format, onOpen, title }: { points: Point[]; format: (v: number) => string; onOpen?: (key: string) => void; title: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 720, H = 200, P = { l: 48, r: 16, t: 16, b: 28 };
  const { xs, ys, ticks, max } = useMemo(() => {
    const t0 = Math.min(...points.map((p) => p.at));
    const t1 = Math.max(...points.map((p) => p.at));
    const span = Math.max(t1 - t0, 60_000);
    const max = Math.max(...points.map((p) => p.value), 1);
    const xs = (t: number) => P.l + ((t - t0) / span) * (W - P.l - P.r) * (points.length === 1 ? 0 : 1) + (points.length === 1 ? (W - P.l - P.r) / 2 : 0);
    const ys = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
    const ticks = [t0, t0 + span / 2, t0 + span].map((t) => ({ t, x: xs(t) }));
    return { xs, ys, ticks, max };
  }, [points]);
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const active = points.find((p) => p.key === hover);
  const color = { ok: 'var(--st-ok)', warn: 'var(--st-warn)', err: 'var(--st-err)' };
  return (
    <figure className="timeline">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title} preserveAspectRatio="none">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={ys(max * f)} y2={ys(max * f)} stroke="var(--line)" />
            <text x={P.l - 8} y={ys(max * f) + 4} textAnchor="end" className="tl-axis">{format(Math.round(max * f))}</text>
          </g>
        ))}
        {points.length > 1 && (
          <polyline fill="none" stroke="var(--line-strong)" strokeWidth="2" points={sorted.map((p) => `${xs(p.at)},${ys(p.value)}`).join(' ')} />
        )}
        {sorted.map((p) => (
          <g
            key={p.key}
            tabIndex={0}
            role="button"
            aria-label={`${p.label}: ${format(p.value)} arquivos em ${new Date(p.at).toLocaleString('pt-BR')}`}
            onPointerEnter={() => setHover(p.key)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(p.key)}
            onBlur={() => setHover(null)}
            onClick={() => onOpen?.(p.key)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen?.(p.key))}
            style={{ cursor: onOpen ? 'pointer' : 'default' }}
          >
            <circle cx={xs(p.at)} cy={ys(p.value)} r={14} fill="transparent" />
            <circle cx={xs(p.at)} cy={ys(p.value)} r={hover === p.key ? 7 : 5} fill={color[p.tone]} stroke="var(--bg)" strokeWidth="2" />
          </g>
        ))}
        {ticks.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="tl-axis">
            {new Date(t.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} {new Date(t.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
      </svg>
      <figcaption className="tl-readout mono" aria-live="polite">
        {active ? (
          <>
            <strong className="num">{format(active.value)} arquivos</strong> · {active.label} · {new Date(active.at).toLocaleString('pt-BR')}
          </>
        ) : (
          <span className="muted">Passe o cursor ou use Tab nos pontos para ver cada operação.</span>
        )}
      </figcaption>
    </figure>
  );
}
