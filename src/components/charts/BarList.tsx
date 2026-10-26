export interface Bar {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
}

/** Barras horizontais com rótulo e valor escritos: gráfico e tabela ao mesmo tempo. */
export function BarList({
  data, format, selected, onSelect, max: maxRows = 12, title,
}: {
  data: Bar[];
  format: (v: number) => string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  max?: number;
  title: string;
}) {
  const rows = data.slice(0, maxRows);
  const rest = data.slice(maxRows);
  const max = Math.max(...rows.map((d) => d.value), 1);
  return (
    <div className="barlist" role="group" aria-label={title}>
      {rows.map((d) => (
        <button
          key={d.key}
          type="button"
          className={`bar-row ${selected === d.key ? 'is-on' : ''} ${selected && selected !== d.key ? 'is-dim' : ''}`}
          aria-pressed={onSelect ? selected === d.key : undefined}
          disabled={!onSelect}
          onClick={() => onSelect?.(selected === d.key ? null : d.key)}
        >
          <span className="bar-label mono">{d.label}</span>
          <span className="bar-track" aria-hidden>
            <i style={{ width: `${Math.max((d.value / max) * 100, 0.8)}%`, background: d.color }} />
          </span>
          <span className="bar-val num">{format(d.value)}</span>
          {d.detail && <span className="bar-detail mono muted">{d.detail}</span>}
        </button>
      ))}
      {rest.length > 0 && (
        <p className="mono muted bar-rest">
          + {rest.length} outras ({format(rest.reduce((s, d) => s + d.value, 0))})
        </p>
      )}
    </div>
  );
}
