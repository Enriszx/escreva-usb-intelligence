import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Float, Sparkles, RoundedBox, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Monolito — objeto 3D central do hero. Abstrato e sofisticado (nada de
 * personagem): bloco metálico escuro com uma costura verde emissiva, girando
 * devagar e inclinando conforme o ponteiro. Fundo escuro reflexivo com
 * partículas. Reflexos vêm de Lightformers embutidos (sem rede, funciona offline).
 */
function Monolith() {
  const group = useRef<THREE.Group>(null);
  const tilt = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.28;
    // Inclina suavemente seguindo o ponteiro (reação ao mouse — padrão premiado).
    tilt.current.x += (state.pointer.y * 0.25 - tilt.current.x) * 0.04;
    tilt.current.y += (state.pointer.x * 0.35 - tilt.current.y) * 0.04;
    g.rotation.x = tilt.current.x;
    g.position.x = tilt.current.y * 0.6;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.6}>
      <group ref={group}>
        <RoundedBox args={[1.15, 2.5, 0.52]} radius={0.14} smoothness={6} castShadow>
          <meshStandardMaterial color="#0b1512" metalness={0.92} roughness={0.22} />
        </RoundedBox>
        {/* Costura verde emissiva (frente e verso). */}
        {[0.27, -0.27].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <planeGeometry args={[0.12, 1.9]} />
            <meshStandardMaterial color="#39e38f" emissive="#39e38f" emissiveIntensity={3} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Dois pontos de leitura emissivos, como um "núcleo". */}
        {[0.62, -0.62].map((y) => (
          <mesh key={y} position={[0, y, 0.27]}>
            <circleGeometry args={[0.05, 24]} />
            <meshStandardMaterial color="#eafff4" emissive="#39e38f" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <spotLight position={[4, 6, 4]} angle={0.3} penumbra={1} intensity={60} color="#bfffe0" castShadow />
      <pointLight position={[-4, -2, 3]} intensity={30} color="#5f86ff" />
      <Monolith />
      <Sparkles count={46} scale={[7, 7, 4]} size={1.6} speed={0.3} opacity={0.5} color="#8affc8" />
      <ContactShadows position={[0, -1.7, 0]} opacity={0.55} scale={9} blur={2.6} far={3} color="#000000" />
      {/* Reflexos do metal: luzes de estúdio embutidas (sem HDR remoto). */}
      <Environment resolution={256}>
        <Lightformer intensity={3} position={[0, 3, 4]} scale={[6, 6, 1]} color="#aaffd6" />
        <Lightformer intensity={1.4} position={[-4, -1, 2]} scale={[4, 4, 1]} color="#6f9bff" />
        <Lightformer intensity={1} position={[4, 1, -2]} scale={[4, 4, 1]} color="#ffffff" />
      </Environment>
    </>
  );
}

export default function HeroMonolith() {
  return (
    <Canvas
      className="h2-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 32 }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
