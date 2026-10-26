import { useRef, type MutableRefObject } from 'react';
import { Stage } from '../../components/three/Stage';
import { CoreDevice, StudioLights } from '../../components/three/CoreDevice';
import { DeviceIllustration } from '../../components/three/Fallbacks';
import { useSettings } from '../../app/settings';

/**
 * Cena da abertura. Arraste horizontal gira o objeto; arraste vertical
 * continua rolando a página (touch-action: pan-y), então o 3D nunca prende o dedo.
 */
export default function HeroScene({ explode, spin }: { explode: MutableRefObject<number>; spin: MutableRefObject<number> }) {
  const { quality, reducedMotion } = useSettings();
  const drag = useRef<{ x: number; start: number } | null>(null);
  return (
    <div
      className="hero-stage-wrap"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: spin.current };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        spin.current = drag.current.start + (e.clientX - drag.current.x) * 0.012;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <Stage
        className="hero-stage"
        label="Núcleo USBI, um pendrive conceitual em camadas. Arraste para os lados para girar."
        camera={{ position: [0, 0.4, 7.4], fov: 30 }}
        fallback={<DeviceIllustration />}
      >
        <StudioLights />
        <group scale={0.82} position={[0.15, -0.1, 0]}>
          <CoreDevice explode={explode} spin={spin} followPointer={!reducedMotion} idle={!reducedMotion} quality={quality} />
        </group>
      </Stage>
    </div>
  );
}
