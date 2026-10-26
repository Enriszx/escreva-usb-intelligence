import { Canvas, type RootState } from '@react-three/fiber';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { hasWebGL } from './webgl';
import { useSettings } from '../../app/settings';

interface StageProps {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
  camera?: { position: [number, number, number]; fov?: number };
  label: string;
  /** Mantém o buffer para captura de imagem (custa um pouco de desempenho). */
  capture?: boolean;
  onCreated?: (s: RootState) => void;
  clipping?: boolean;
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Palco 3D compartilhado: limita pixel ratio, pausa quando sai da tela,
 * troca para renderização sob demanda com movimento reduzido e cai para
 * uma ilustração vetorial se não houver WebGL.
 */
export function Stage({ children, fallback, className = '', camera, label, capture, onCreated, clipping }: StageProps) {
  const { quality, reducedMotion } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [supported] = useState(hasWebGL);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden && el.getBoundingClientRect().bottom > 0);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!supported || lost) return <div className={`stage stage-fallback ${className}`}>{fallback}</div>;

  return (
    <div ref={ref} className={`stage ${className}`} role="img" aria-label={label}>
      <GLBoundary fallback={fallback}>
        <Canvas
          frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'}
          dpr={quality === 'alta' ? [1, 2] : [1, 1.5]}
          camera={{ position: camera?.position ?? [0, 0.6, 6], fov: camera?.fov ?? 32 }}
          gl={{ antialias: quality === 'alta', preserveDrawingBuffer: !!capture, alpha: true, powerPreference: 'high-performance' }}
          shadows={false}
          onCreated={(s) => {
            s.gl.localClippingEnabled = !!clipping;
            s.gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setLost(true);
            });
            onCreated?.(s);
          }}
        >
          {children}
        </Canvas>
      </GLBoundary>
    </div>
  );
}
