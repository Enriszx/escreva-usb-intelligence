import { useChartTip } from './tip';

export interface StackSeg {
  key: string;
  label: string;
  value: number;
  color: string;
  hint?: string;
}

/** Barra empilhada com legenda escrita: o estado de cada arquivo, em números. */
export function StackedBar({ segments, title }: { segments: StackSeg[]; title: string }) {
  const { box, bind, layer } = useChartTip();
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="chart-box" ref={box}>
      <div className="stackbar" role="img" aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {total === 0 && <i className="stack-empty" />}
        {segments.filter((s) => s.value).map((s) => (
          <i key={s.key} style={{ flex: s.value, background: s.color }} {...bind(<><strong>{s.label}</strong><br /><span className="num">{s.value}</span>{s.hint && <><br /><span className="mono">{s.hint}</span></>}</>)} />
        ))}
      </div>
      <ul className="stack-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} aria-hidden />
            <span>{s.label}</span>
            <b className="num">{s.value}</b>
          </li>
        ))}
      </ul>
      {layer}
    </div>
  );
}
