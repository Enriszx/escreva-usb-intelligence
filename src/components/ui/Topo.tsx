import { memo, useMemo } from 'react';
import { segmentsToPath, topoSegments } from '../../lib/topo';

/** Fundo de curvas de nível. Decorativo: escondido de leitores de tela. */
export const Topo = memo(function Topo({ seed = 7, levels = 10, className = '', density = 64 }: { seed?: number; levels?: number; className?: string; density?: number }) {
  const d = useMemo(() => segmentsToPath(topoSegments({ w: 1600, h: 1000, cols: density, levels, seed })), [seed, levels, density]);
  return (
    <svg className={`topo ${className}`} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <path d={d} fill="none" stroke="var(--topo)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
});
