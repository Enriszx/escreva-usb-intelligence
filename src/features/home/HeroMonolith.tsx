import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Float, Sparkles, RoundedBox, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

/** Textura radial (glow) desenhada no canvas — brilho aditivo sem postprocessing. */
function useGlow(color: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(0.5, color.replace(')', ', 0.35)').replace('rgb', 'rgba'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color]);
}

/**
 * Monolito — objeto 3D central, encorpado e com impacto. Bloco metálico escuro
 * com costura verde emissiva e núcleos; gira devagar e inclina seguindo o cursor.
 * Reflexos nas cores do Brasil (verde/amarelo/azul) por Lightformers embutidos.
 */
function Monolith() {
  const group = useRef<THREE.Group>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const glow = useGlow('rgb(70,235,150)');

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.26;
    tilt.current.x += (state.pointer.y * 0.22 - tilt.current.x) * 0.045;
    tilt.current.y += (state.pointer.x * 0.32 - tilt.current.y) * 0.045;
    g.rotation.x = tilt.current.x;
    g.position.x = tilt.current.y * 0.5;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.12} floatIntensity={0.7}>
      <group ref={group}>
        {/* Glow traseiro (bloom falso, aditivo). */}
        <mesh position={[0, 0, -0.6]} scale={[4.6, 6, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.9} />
        </mesh>

        <RoundedBox args={[1.5, 3.35, 0.62]} radius={0.16} smoothness={7} castShadow>
          <meshStandardMaterial color="#0a1612" metalness={0.95} roughness={0.18} envMapIntensity={1.4} />
        </RoundedBox>

        {/* Costura verde emissiva (frente e verso). */}
        {[0.32, -0.32].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <planeGeometry args={[0.14, 2.5]} />
            <meshStandardMaterial color="#5cffab" emissive="#39e38f" emissiveIntensity={3.4} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Núcleos de leitura: verde no centro, um nó âmbar (Brasil) em cima. */}
        {[0.95, 0.2, -0.55].map((y, i) => (
          <mesh key={y} position={[0, y, 0.32]}>
            <circleGeometry args={[i === 0 ? 0.07 : 0.05, 28]} />
            <meshStandardMaterial color={i === 0 ? '#fff1b0' : '#eafff4'} emissive={i === 0 ? '#ffd23a' : '#39e38f'} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function HaloRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.4; });
  return (
    <mesh ref={ref} position={[0, -1.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.5, 0.018, 16, 120]} />
      <meshStandardMaterial color="#39e38f" emissive="#39e38f" emissiveIntensity={2.6} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <spotLight position={[5, 7, 5]} angle={0.3} penumbra={1} intensity={90} color="#caffe4" castShadow />
      <pointLight position={[-5, -2, 3]} intensity={40} color="#4f7cff" />
      <pointLight position={[3, 4, -2]} intensity={24} color="#ffd23a" />
      <Monolith />
      <HaloRing />
      <Sparkles count={60} scale={[8, 8, 5]} size={1.8} speed={0.3} opacity={0.55} color="#9affd0" />
      <ContactShadows position={[0, -2, 0]} opacity={0.6} scale={11} blur={2.8} far={3.2} color="#000000" />
      {/* Reflexos nas cores do Brasil (sem HDR remoto). */}
      <Environment resolution={256}>
        <Lightformer intensity={3.2} position={[0, 3, 4]} scale={[7, 7, 1]} color="#aaffd6" />
        <Lightformer intensity={1.6} position={[-4, -1, 2]} scale={[5, 5, 1]} color="#5f86ff" />
        <Lightformer intensity={1.3} position={[4, 2, -1]} scale={[4, 4, 1]} color="#ffe58a" />
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
      camera={{ position: [0, 0, 6.4], fov: 34 }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
