import { useThree, type RootState } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CameraRig, type CameraView, type RigHandle } from '../../components/three/CameraRig';
import { Stage } from '../../components/three/Stage';
import { StudioLights } from '../../components/three/CoreDevice';
import { VigiaModel } from './VigiaModel';
import type { CharacterConfig } from './model';
import { useSettings } from '../../app/settings';
import { VigiaIllustration } from './VigiaIllustration';

export type View = 'frente' | 'perfil' | 'costas' | 'rosto';
const VIEWS: Record<View, CameraView> = {
  frente: { pos: [1.0, 1.55, 5.0], target: [0, 1.05, 0] },
  perfil: { pos: [4.4, 1.4, 0.2], target: [0, 1.08, 0] },
  costas: { pos: [-1.2, 1.7, -4.2], target: [0, 1.15, 0] },
  rosto: { pos: [0.35, 1.95, 1.6], target: [0, 1.82, 0] },
};
export const MIN_DIST = 1.4;
export const MAX_DIST = 7;

export type SceneHandle = RigHandle;

export const CharacterScene = forwardRef<SceneHandle, { config: CharacterConfig }>(function CharacterScene({ config }, ref) {
  const { quality, reducedMotion } = useSettings();
  const inner = useRef<RigHandle | null>(null);
  useImperativeHandle(ref, () => ({
    setView: (v) => inner.current?.setView(v),
    zoom: (f) => inner.current?.zoom(f),
    capture: () => inner.current?.capture() ?? Promise.resolve(null),
  }));
  return (
    <Stage
      className="char-stage"
      label="Personagem Vigia em 3D. Arraste para girar, use pinça ou a roda do mouse para aproximar."
      camera={{ position: VIEWS.frente.pos, fov: 30 }}
      fallback={<VigiaIllustration config={config} />}
      capture
      onCreated={(s: RootState) => s.gl.setClearColor(0x000000, 0)}
    >
      <StudioLights tone="mata" />
      <Floor />
      <VigiaModel config={config} animate={!reducedMotion} quality={quality} />
      <CameraRig handle={inner} views={VIEWS} initial="frente" minDistance={MIN_DIST} maxDistance={MAX_DIST} minPolar={0.25} maxPolar={1.75} />
      <Invalidator config={config} />
    </Stage>
  );
});

/** Com movimento reduzido a cena roda sob demanda: cada mudança pede novos quadros. */
function Invalidator({ config }: { config: CharacterConfig }) {
  const { invalidate } = useThree();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      invalidate();
      if (++n > 30) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [config, invalidate]);
  return null;
}

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.95, 1.0, 64]} />
        <meshBasicMaterial color="#ffd600" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[0.95, 64]} />
        <meshStandardMaterial color="#0a4a38" roughness={0.9} />
      </mesh>
      {[1.25, 1.55, 1.9].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
          <ringGeometry args={[r, r + 0.008, 96]} />
          <meshBasicMaterial color="#f4f7f2" transparent opacity={0.16 - i * 0.04} />
        </mesh>
      ))}
    </group>
  );
}
