import { useChartTip } from './tip';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Importações por dia da semana, a partir da data real de cada importação. */
export function WeekBars({ counts }: { counts: number[] }) {
  const { box, bind, layer } = useChartTip();
  const max = Math.max(1, ...counts);
  return (
    <div className="chart-box" ref={box}>
      <div className="weekbars" role="group" aria-label="Importações por dia da semana">
        {counts.map((c, i) => (
          <div key={DAYS[i]} className="wb-col" tabIndex={0} aria-label={`${LONG[i]}: ${c} importado(s)`} {...bind(<><strong className="num">{c}</strong> importado(s)<br /><span className="mono">{LONG[i]}</span></>)}>
            <span className="num wb-n">{c}</span>
            <span className="wb-bar"><i style={{ height: `${Math.max(3, (c / max) * 100)}%` }} /></span>
            <span className="mono wb-d">{DAYS[i]}</span>
          </div>
        ))}
      </div>
      {layer}
    </div>
  );
}
