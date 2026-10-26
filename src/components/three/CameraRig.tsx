import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

export interface CameraView {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface RigHandle {
  setView: (v: string) => void;
  zoom: (factor: number) => void;
  capture: () => Promise<Blob | null>;
}

interface OrbitImpl {
  target: THREE.Vector3;
  update: () => void;
}

/**
 * Órbita com limites + transições de câmera suaves para vistas nomeadas.
 * Qualquer arraste do usuário interrompe a transição em curso.
 */
export function CameraRig({
  handle, views, initial, minDistance, maxDistance, minPolar = 0.2, maxPolar = 1.8,
}: {
  handle: MutableRefObject<RigHandle | null>;
  views: Record<string, CameraView>;
  initial: string;
  minDistance: number;
  maxDistance: number;
  minPolar?: number;
  maxPolar?: number;
}) {
  const { camera, gl, scene, invalidate } = useThree();
  const controls = useRef<OrbitImpl>(null);
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  handle.current = {
    setView: (v) => {
      const view = views[v];
      if (!view) return;
      anim.current = { pos: new THREE.Vector3(...view.pos), target: new THREE.Vector3(...view.target) };
      invalidate();
    },
    zoom: (factor) => {
      const target = controls.current?.target ?? new THREE.Vector3(...views[initial].target);
      const dir = camera.position.clone().sub(target);
      const dist = THREE.MathUtils.clamp(dir.length() * factor, minDistance, maxDistance);
      anim.current = { pos: target.clone().add(dir.setLength(dist)), target: target.clone() };
      invalidate();
    },
    capture: () => {
      gl.render(scene, camera);
      return new Promise((resolve) => gl.domElement.toBlob((b) => resolve(b), 'image/png'));
    },
  };

  useFrame((_, delta) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    const k = 1 - Math.exp(-7 * Math.min(delta, 0.05));
    camera.position.lerp(a.pos, k);
    c.target.lerp(a.target, k);
    c.update();
    if (camera.position.distanceTo(a.pos) < 0.005 && c.target.distanceTo(a.target) < 0.005) anim.current = null;
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      target={views[initial].target}
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolar}
      maxPolarAngle={maxPolar}
      enableDamping
      dampingFactor={0.08}
      onStart={() => (anim.current = null)}
    />
  );
}
