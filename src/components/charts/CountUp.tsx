import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { formatInt } from '../../lib/format';

/** Número que sobe até o valor em ~700 ms. Pula a animação com movimento reduzido. */
export function CountUp({ value }: { value: number }) {
  const { reducedMotion } = useSettings();
  const [shown, setShown] = useState(reducedMotion ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);
  return (
    <>
      <span className="sr-only">{formatInt(value)}</span>
      <span aria-hidden>{formatInt(shown)}</span>
    </>
  );
}
