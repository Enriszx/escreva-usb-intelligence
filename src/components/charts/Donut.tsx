import { useMemo, useState } from 'react';

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Rosca com legenda clicável. A legenda é o caminho por teclado e também a
 * leitura sem cor (nome + valor escritos). Segmentos menores que 0,5% ainda
 * aparecem na legenda.
 */
export function Donut({
  data, format, centerLabel, selected, onSelect, size = 240, title,
}: {
  data: Slice[];
  format: (v: number) => string;
  centerLabel: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  size?: number;
  title: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 14;
  const segs = useMemo(() => {
    let a = -Math.PI / 2;
    const gap = data.filter((d) => d.value > 0).length > 1 ? 0.018 : 0;
    return data.filter((d) => d.value > 0).map((d) => {
      const span = total ? (d.value / total) * Math.PI * 2 : 0;
      const s = { ...d, a0: a + gap / 2, a1: a + Math.max(span - gap / 2, gap / 2 + 0.0001) };
      a += span;
      return s;
    });
  }, [data, total]);
  const focus = hover ?? selected ?? null;
  const active = data.find((d) => d.key === focus);
  return (
    <figure className="donut">
      <div className="donut-plot" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={1} />
          {segs.map((s) => {
            const on = !focus || focus === s.key;
            return (
              <path
                key={s.key}
                d={segs.length === 1 ? `M${size / 2} ${size / 2 - r}a${r} ${r} 0 1 1 -0.01 0` : arc(size / 2, size / 2, r, s.a0, s.a1)}
                fill="none"
                stroke={s.color}
                strokeWidth={focus === s.key ? 26 : 20}
                opacity={on ? 1 : 0.28}
                style={{ transition: 'stroke-width 200ms, opacity 200ms', cursor: onSelect ? 'pointer' : 'default' }}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onSelect?.(selected === s.key ? null : s.key)}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <strong className="num">{active ? format(active.value) : format(total)}</strong>
          <span className="mono muted">{active ? active.label : centerLabel}</span>
          {active && total > 0 && <span className="mono muted">{((active.value / total) * 100).toFixed(1).replace('.', ',')}%</span>}
        </div>
      </div>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="legend" aria-label={`Legenda: ${title}`}>
        {data.map((d) => (
          <li key={d.key}>
            <button
              type="button"
              className={`legend-item ${selected === d.key ? 'is-on' : ''}`}
              aria-pressed={onSelect ? selected === d.key : undefined}
              disabled={!onSelect || d.value === 0}
              onPointerEnter={() => setHover(d.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(d.key)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(selected === d.key ? null : d.key)}
            >
              <i style={{ background: d.color }} aria-hidden />
              <span className="legend-label">{d.label}</span>
              <span className="legend-val num">{format(d.value)}</span>
              {d.detail && <span className="legend-detail mono muted">{d.detail}</span>}
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
