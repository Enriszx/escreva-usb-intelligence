import { useChartTip } from './tip';

export interface TileDatum {
  key: string;
  label: string;
  value: number;
  color: string;
  valueText: string;
  detail: string;
}

/**
 * Mapa de espaço: cada tipo ocupa área proporcional ao volume. Nome e valor ficam
 * escritos no bloco (nada depende só de cor) e o bloco inteiro é um botão de filtro.
 */
export function Treemap({ data, selected, onSelect, title }: { data: TileDatum[]; selected?: string | null; onSelect?: (key: string | null) => void; title: string }) {
  const { box, bind, layer } = useChartTip();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="chart-box" ref={box}>
      <div className="treemap" role="group" aria-label={title}>
        {data.map((d) => {
          const pct = (d.value / total) * 100;
          return (
            <button
              key={d.key}
              type="button"
              className={`tile ${selected === d.key ? 'is-on' : ''} ${selected && selected !== d.key ? 'is-dim' : ''}`}
              style={{ flex: `${pct} 1 ${Math.round(pct * 2.2 + 96)}px`, ['--tile' as string]: d.color }}
              aria-pressed={onSelect ? selected === d.key : undefined}
              disabled={!onSelect}
              onClick={() => onSelect?.(selected === d.key ? null : d.key)}
              {...bind(<><strong>{d.label}</strong><br /><span className="num">{d.valueText}</span><br /><span className="mono">{d.detail} · {pct.toFixed(1).replace('.', ',')}% do total</span></>)}
            >
              <span className="tile-label">{d.label}</span>
              <span className="tile-val num">{d.valueText}</span>
            </button>
          );
        })}
      </div>
      {layer}
    </div>
  );
}
