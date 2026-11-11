import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * Cristal verificado — momento 3D do cabeçalho da Segurança. Um icosaedro
 * metálico escuro com a treliça (arestas) em verde emissivo e um núcleo que
 * pulsa: a "impressão digital" íntegra. Gira devagar, com bloom.
 */
function Crystal() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.002, 0)), []);

  useFrame((state, dt) => {
    if (group.current) { group.current.rotation.y += dt * 0.5; group.current.rotation.x += dt * 0.14; }
    if (core.current) core.current.emissiveIntensity = 2.4 + Math.sin(state.clock.elapsedTime * 2.2) * 1.1;
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.9}>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0c1a14" metalness={0.92} roughness={0.14} envMapIntensity={1.4} />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#39e38f" toneMapped={false} transparent opacity={0.9} />
        </lineSegments>
        <mesh scale={0.4}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial ref={core} color="#9bffd0" emissive="#39e38f" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

export default function SecurityCrystal() {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3.4], fov: 38 }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 3]} intensity={24} color="#caffe4" />
        <pointLight position={[-3, -2, 2]} intensity={14} color="#5f86ff" />
        <Crystal />
        <Environment resolution={128}>
          <Lightformer intensity={3} position={[0, 2, 3]} scale={[5, 5, 1]} color="#aaffd6" />
          <Lightformer intensity={1.4} position={[-3, -1, 2]} scale={[3, 3, 1]} color="#6f9bff" />
        </Environment>
        <EffectComposer multisampling={2}>
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.3} intensity={1.1} radius={0.7} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
