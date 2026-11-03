import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Tooltip compartilhado pelos gráficos. Cada marca chama bind(conteúdo): o mesmo texto
 * aparece ao passar o cursor e ao focar com Tab (o foco usa a posição da própria marca).
 */
export function useChartTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const show = useCallback((el: Element, content: ReactNode, pointer?: { x: number; y: number }) => {
    const host = box.current?.getBoundingClientRect();
    if (!host) return;
    const r = el.getBoundingClientRect();
    const x = (pointer?.x ?? r.left + r.width / 2) - host.left;
    const y = (pointer?.y ?? r.top) - host.top;
    setTip({ x, y, content });
  }, []);

  const bind = useCallback((content: ReactNode) => ({
    onPointerEnter: (e: React.PointerEvent) => show(e.currentTarget, content, { x: e.clientX, y: e.clientY }),
    onPointerMove: (e: React.PointerEvent) => show(e.currentTarget, content, { x: e.clientX, y: e.clientY }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => show(e.currentTarget, content),
    onBlur: () => setTip(null),
  }), [show]);

  const layer = tip ? (
    <div className="chart-tip" role="tooltip" style={{ left: tip.x, top: tip.y } as CSSProperties}>
      {tip.content}
    </div>
  ) : null;

  return { box, bind, layer };
}
