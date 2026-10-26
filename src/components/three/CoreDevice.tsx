import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { topoSegments } from '../../lib/topo';

/**
 * Núcleo USBI — pendrive conceitual em camadas, modelado só com geometria.
 * As camadas são uma leitura didática de um pendrive (carcaça, placa,
 * memória, conector); não é o desenho técnico de um produto real.
 */
export type CoreLayerId = 'tampa' | 'nucleo' | 'placa' | 'base' | 'conector' | 'colar';

export const CORE_LAYERS: { id: CoreLayerId; name: string; text: string }[] = [
  { id: 'tampa', name: 'Tampa gravada', text: 'Carcaça superior em metal escovado com as curvas de nível do USB Intelligence gravadas.' },
  { id: 'nucleo', name: 'Núcleo translúcido', text: 'Camada de vidro verde que deixa ver o caminho dos dados. Puramente estética.' },
  { id: 'placa', name: 'Placa e memória', text: 'Placa de circuito com controlador e dois chips de memória flash — onde os arquivos ficam de fato num pendrive.' },
  { id: 'base', name: 'Base', text: 'Carcaça inferior fosca, com o LED de atividade na traseira.' },
  { id: 'colar', name: 'Colar solar', text: 'Anel amarelo que marca a transição entre corpo e conector.' },
  { id: 'conector', name: 'Conector USB-A', text: 'Luva metálica, lingueta e quatro contatos dourados: alimentação, dados − , dados + e terra.' },
];

export type CoreMode = 'produto' | 'raio-x' | 'secao';

export interface CoreDeviceProps {
  /** Separação das camadas, 0 a 1. Pode ser um ref para animar sem re-render. */
  explode?: number | MutableRefObject<number>;
  mode?: CoreMode;
  highlight?: CoreLayerId | null;
  led?: boolean;
  idle?: boolean;
  /** Rotação extra vinda do arraste (radianos), lida a cada quadro. */
  spin?: MutableRefObject<number>;
  followPointer?: boolean;
  quality?: 'economia' | 'alta';
  onSelect?: (id: CoreLayerId) => void;
}

function useTopoTexture(seed: number) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#fff';
    g.lineWidth = 1.4;
    g.beginPath();
    for (const s of topoSegments({ w: c.width, h: c.height, cols: 90, levels: 9, seed, scale: 2.4 })) {
      g.moveTo(s[0], s[1]);
      g.lineTo(s[2], s[3]);
    }
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [seed]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0001);

export function CoreDevice({
  explode = 0, mode = 'produto', highlight = null, led = true, idle = true, spin, followPointer = false, quality = 'alta', onSelect,
}: CoreDeviceProps) {
  const root = useRef<THREE.Group>(null);
  const parts = useRef<Record<string, THREE.Object3D | null>>({});
  const ledMat = useRef<THREE.MeshStandardMaterial>(null);
  const current = useRef(0);
  const topo = useTopoTexture(11);
  const { invalidate } = useThree();
  const wire = mode === 'raio-x';
  const clip = mode === 'secao' ? [SECTION_PLANE] : [];
  const glassHigh = quality === 'alta' && mode === 'produto';

  useEffect(() => invalidate(), [mode, highlight, led, explode, invalidate]);

  useFrame((state, delta) => {
    const target = typeof explode === 'number' ? explode : explode.current;
    const d = Math.min(delta, 0.05);
    current.current = THREE.MathUtils.damp(current.current, target, 6, d);
    const e = current.current;
    const p = parts.current;
    if (p.tampa) p.tampa.position.y = 0.17 + e * 0.95;
    if (p.nucleo) p.nucleo.position.y = 0.06 + e * 0.5;
    if (p.placa) p.placa.position.y = -0.04 + e * 0.05;
    if (p.base) p.base.position.y = -0.15 - e * 0.55;
    if (p.colar) p.colar.position.x = 1.52 + e * 0.35;
    if (p.conector) p.conector.position.x = 2.06 + e * 0.95;
    if (p.argola) p.argola.position.x = -1.86 - e * 0.5;

    const g = root.current;
    if (g) {
      const t = state.clock.elapsedTime;
      const baseY = idle ? Math.sin(t * 0.8) * 0.05 : 0;
      g.position.y = THREE.MathUtils.damp(g.position.y, baseY, 4, d);
      const px = followPointer ? state.pointer.x : 0;
      const py = followPointer ? state.pointer.y : 0;
      const targetY = (spin?.current ?? 0) + px * 0.35 + (idle ? Math.sin(t * 0.25) * 0.12 : 0);
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 5, d);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -py * 0.18, 5, d);
    }
    if (ledMat.current) {
      ledMat.current.emissiveIntensity = led ? (idle ? 2.2 + Math.sin(state.clock.elapsedTime * 3) * 0.8 : 2.4) : 0;
    }
    // Em modo sob demanda, continua pedindo quadros só enquanto há transição.
    if (Math.abs(target - e) > 0.001) invalidate();
  });

  const hl = (id: CoreLayerId) => (highlight === id ? 0.55 : 0);
  const pick = (id: CoreLayerId) => (onSelect ? { onClick: (ev: { stopPropagation: () => void }) => { ev.stopPropagation(); onSelect(id); } } : {});
  const reg = (id: string) => (o: THREE.Object3D | null) => { parts.current[id] = o; };
  const hlColor = '#ffd600';

  return (
    <group ref={root}>
      {/* pose de repouso: três quartos, mostrando a tampa gravada */}
      <group rotation={[0.62, -0.5, 0.16]}>
        {/* Tampa com curvas de nível gravadas */}
        <group ref={reg('tampa')} position={[0, 0.17, 0]} {...pick('tampa')}>
          <RoundedBox args={[3.2, 0.1, 1.2]} radius={0.045} smoothness={quality === 'alta' ? 4 : 2}>
            <meshStandardMaterial color="#20262a" metalness={0.85} roughness={0.32} emissive={hlColor} emissiveIntensity={hl('tampa')} wireframe={wire} clippingPlanes={clip} clipShadows />
          </RoundedBox>
          <mesh position={[-0.1, 0.0515, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.7, 1.0]} />
            <meshStandardMaterial color="#1a1f1c" emissive="#00e676" emissiveMap={topo} emissiveIntensity={wire ? 0.2 : 0.55} transparent alphaMap={topo} metalness={0.4} roughness={0.5} clippingPlanes={clip} />
          </mesh>
        </group>

        {/* Núcleo de vidro */}
        <group ref={reg('nucleo')} position={[0, 0.06, 0]} {...pick('nucleo')}>
          <RoundedBox args={[3.02, 0.11, 1.08]} radius={0.03} smoothness={2}>
            {glassHigh ? (
              <meshPhysicalMaterial color="#00e676" transmission={0.92} thickness={0.6} roughness={0.12} ior={1.4} metalness={0} emissive={hlColor} emissiveIntensity={hl('nucleo')} attenuationColor="#063d2e" attenuationDistance={0.8} clippingPlanes={clip} />
            ) : (
              <meshStandardMaterial color="#00b85e" transparent opacity={wire ? 1 : 0.55} roughness={0.15} emissive={highlight === 'nucleo' ? hlColor : '#063d2e'} emissiveIntensity={highlight === 'nucleo' ? 0.55 : 0.6} wireframe={wire} clippingPlanes={clip} depthWrite={false} />
            )}
          </RoundedBox>
        </group>

        {/* Placa, controlador e memória */}
        <group ref={reg('placa')} position={[0, -0.04, 0]} {...pick('placa')}>
          <mesh>
            <boxGeometry args={[2.86, 0.04, 0.98]} />
            <meshStandardMaterial color="#063d2e" roughness={0.7} emissive={hlColor} emissiveIntensity={hl('placa')} wireframe={wire} clippingPlanes={clip} />
          </mesh>
          {[-0.75, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.045, 0]}>
              <boxGeometry args={[0.62, 0.05, 0.62]} />
              <meshStandardMaterial color="#121514" roughness={0.45} metalness={0.2} wireframe={wire} clippingPlanes={clip} />
            </mesh>
          ))}
          <mesh position={[0.8, 0.04, 0]}>
            <boxGeometry args={[0.36, 0.04, 0.36]} />
            <meshStandardMaterial color="#1464f4" roughness={0.35} metalness={0.5} emissive="#1464f4" emissiveIntensity={0.25} wireframe={wire} clippingPlanes={clip} />
          </mesh>
          {/* trilhas */}
          {[-0.3, -0.15, 0.15, 0.3].map((z) => (
            <mesh key={z} position={[0.4, 0.022, z]}>
              <boxGeometry args={[2.2, 0.004, 0.018]} />
              <meshStandardMaterial color="#c9a227" metalness={1} roughness={0.3} clippingPlanes={clip} />
            </mesh>
          ))}
        </group>

        {/* Base fosca + LED */}
        <group ref={reg('base')} position={[0, -0.15, 0]} {...pick('base')}>
          <RoundedBox args={[3.2, 0.12, 1.2]} radius={0.05} smoothness={quality === 'alta' ? 4 : 2}>
            <meshStandardMaterial color="#101311" roughness={0.85} metalness={0.1} emissive={hlColor} emissiveIntensity={hl('base')} wireframe={wire} clippingPlanes={clip} />
          </RoundedBox>
          <mesh position={[-1.605, 0.02, 0.36]}>
            <boxGeometry args={[0.02, 0.05, 0.18]} />
            <meshStandardMaterial ref={ledMat} color="#00e676" emissive="#00e676" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>

        {/* Colar solar */}
        <group ref={reg('colar')} position={[1.52, 0.01, 0]} {...pick('colar')}>
          <RoundedBox args={[0.16, 0.44, 1.26]} radius={0.04} smoothness={2}>
            <meshStandardMaterial color="#ffd600" roughness={0.3} metalness={0.55} emissive={hlColor} emissiveIntensity={hl('colar') * 0.4} wireframe={wire} clippingPlanes={clip} />
          </RoundedBox>
        </group>

        {/* Conector USB-A: luva, lingueta, contatos */}
        <group ref={reg('conector')} position={[2.06, 0.0, 0]} {...pick('conector')}>
          {([[0, 0.115, 0, 0.92, 0.018, 0.62], [0, -0.115, 0, 0.92, 0.018, 0.62], [0, 0, 0.305, 0.92, 0.23, 0.018], [0, 0, -0.305, 0.92, 0.23, 0.018]] as const).map((b, i) => (
            <mesh key={i} position={[b[0], b[1], b[2]]}>
              <boxGeometry args={[b[3], b[4], b[5]]} />
              <meshStandardMaterial color="#c8ced0" metalness={1} roughness={0.22} emissive={hlColor} emissiveIntensity={hl('conector') * 0.5} wireframe={wire} clippingPlanes={clip} side={THREE.DoubleSide} />
            </mesh>
          ))}
          {[-0.14, 0.14].map((z) => (
            <mesh key={z} position={[0.18, 0.125, z]}>
              <boxGeometry args={[0.16, 0.004, 0.1]} />
              <meshStandardMaterial color="#050605" roughness={1} />
            </mesh>
          ))}
          <mesh position={[0.02, -0.035, 0]}>
            <boxGeometry args={[0.84, 0.06, 0.5]} />
            <meshStandardMaterial color="#f4f7f2" roughness={0.6} wireframe={wire} clippingPlanes={clip} />
          </mesh>
          {[-0.15, -0.05, 0.05, 0.15].map((z) => (
            <mesh key={z} position={[0.3, -0.0035, z]}>
              <boxGeometry args={[0.2, 0.006, 0.065]} />
              <meshStandardMaterial color="#e6b422" metalness={1} roughness={0.25} emissive="#7a5600" emissiveIntensity={0.3} clippingPlanes={clip} />
            </mesh>
          ))}
        </group>

        {/* Argola */}
        <group ref={reg('argola')} position={[-1.86, 0.01, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.04, 12, quality === 'alta' ? 48 : 24]} />
            <meshStandardMaterial color="#c8ced0" metalness={1} roughness={0.25} wireframe={wire} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Luz de estúdio montada só com luzes simples: nada de HDR baixado da internet. */
export function StudioLights({ tone = 'grafite' }: { tone?: 'grafite' | 'noite' | 'mata' }) {
  const rim = tone === 'noite' ? '#1464f4' : tone === 'mata' ? '#ffd600' : '#00e676';
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#f4f7f2', '#063d2e', 0.55]} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#fff8e6" />
      <directionalLight position={[-5, 1.5, -3]} intensity={1.6} color={rim} />
      <pointLight position={[0, -3, 2]} intensity={2.5} distance={9} color="#ffd600" />
      {/* Reflexos de estúdio gerados na GPU com painéis de luz: nenhum arquivo HDR externo. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#f4f7f2" position={[0, 4, 2]} scale={[8, 1.4, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.4} color={rim} position={[-5, 1, -1]} scale={[4, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.35} color="#ffd600" position={[5, -1, 1]} scale={[3, 3, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
    </>
  );
}
