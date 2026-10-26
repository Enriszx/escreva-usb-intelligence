import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { CharacterConfig, Finish, Pose } from './model';

/**
 * O Vigia: guardião de campo do USB Intelligence. Corpo de proporções
 * "action figure" (cabeça grande, mãos simples), feito só de primitivas.
 * Cada opção de model.ts liga/desliga ou recolore uma parte daqui.
 */

const FINISH: Record<Finish, { roughness: number; metalness: number }> = {
  fosco: { roughness: 0.85, metalness: 0.05 },
  acetinado: { roughness: 0.45, metalness: 0.25 },
  metalico: { roughness: 0.22, metalness: 0.85 },
};

// Rotações-alvo (x, z) de ombro e cotovelo para cada pose: [ombroX, ombroZ, cotovelo]
const POSE: Record<Pose, { L: [number, number, number]; R: [number, number, number]; head: number }> = {
  alerta: { L: [0.15, 0.32, -0.55], R: [-0.35, -0.28, -1.2], head: 0.08 },
  aceno: { L: [0.05, 0.18, -0.25], R: [0, -2.55, -0.55], head: -0.05 },
  repouso: { L: [0.05, 0.1, -0.12], R: [0.05, -0.1, -0.12], head: 0.12 },
};

function useMaterials() {
  const mats = useMemo(() => ({
    primary: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), // capuz e capacete são cascas abertas
    secondary: new THREE.MeshStandardMaterial(),
    detail: new THREE.MeshStandardMaterial(),
    skin: new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 }),
    glow: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0, toneMapped: false }),
    dark: new THREE.MeshStandardMaterial({ color: '#0b0d0c', roughness: 0.35, metalness: 0.4 }),
    hair: new THREE.MeshStandardMaterial({ color: '#17110d', roughness: 0.8, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: '#e6b422', roughness: 0.3, metalness: 1 }),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

function useShadowTexture() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const tmp = new THREE.Color();

export function VigiaModel({ config, animate = true, quality = 'alta' }: { config: CharacterConfig; animate?: boolean; quality?: 'economia' | 'alta' }) {
  const m = useMaterials();
  const shadow = useShadowTexture();
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const first = useRef(true);
  const seg = quality === 'alta' ? 32 : 16;

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const k = first.current ? 1 : 1 - Math.exp(-8 * d); // primeira vez aplica direto
    first.current = false;
    const c = config.colors;
    const f = FINISH[config.finish];
    for (const [mat, hex] of [[m.primary, c.primary], [m.secondary, c.secondary], [m.detail, c.detail], [m.skin, c.skin]] as const) {
      mat.color.lerp(tmp.set(hex), k);
    }
    for (const mat of [m.primary, m.secondary]) {
      mat.roughness += (f.roughness - mat.roughness) * k;
      mat.metalness += (f.metalness - mat.metalness) * k;
    }
    m.detail.roughness = 0.35;
    m.detail.metalness = config.finish === 'fosco' ? 0.2 : 0.7;
    m.glow.color.lerp(tmp.set(config.glow.enabled ? c.glow : '#1a1f1c'), k);
    m.glow.emissive.lerp(tmp.set(c.glow), k);
    const gi = config.glow.enabled ? config.glow.intensity * 1.6 : 0;
    m.glow.emissiveIntensity += (gi - m.glow.emissiveIntensity) * k;

    const t = state.clock.elapsedTime;
    const p = POSE[config.pose];
    const move = animate ? 1 : 0;
    const lerpRot = (g: THREE.Group | null, x: number, z: number) => {
      if (!g) return;
      g.rotation.x += (x - g.rotation.x) * k;
      g.rotation.z += (z - g.rotation.z) * k;
    };
    const wave = config.pose === 'aceno' ? Math.sin(t * 6) * 0.35 * move : 0;
    lerpRot(armL.current, p.L[0] + Math.sin(t * 1.4) * 0.03 * move, p.L[1]);
    lerpRot(armR.current, p.R[0], p.R[1] + wave * 0.3);
    lerpRot(foreL.current, p.L[2], 0);
    lerpRot(foreR.current, p.R[2] + wave, 0);
    if (body.current) body.current.position.y = Math.sin(t * 1.6) * 0.012 * move;
    if (head.current) {
      const look = animate ? state.pointer.x * 0.35 : 0;
      head.current.rotation.y += (look - head.current.rotation.y) * k;
      head.current.rotation.x += (p.head - state.pointer.y * 0.12 * move - head.current.rotation.x) * k;
    }
    if (tail.current) tail.current.rotation.z = -0.15 + Math.sin(t * 2.2) * 0.08 * move;
  });

  const a = config.accessories;
  const o = config.outfit;

  const arm = (side: 1 | -1, ref: RefObject<THREE.Group>, fore: RefObject<THREE.Group>) => (
    <group ref={ref} position={[side * 0.4, 1.42, 0]}>
      {/* ombro */}
      <mesh material={o === 'armadura' ? m.secondary : m.primary} position={[0, 0, 0]}>
        <sphereGeometry args={[o === 'armadura' ? 0.15 : 0.12, seg, seg / 2]} />
      </mesh>
      <mesh material={m.primary} position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.085, 0.26, 6, seg / 2]} />
      </mesh>
      <group ref={fore} position={[0, -0.4, 0]}>
        <mesh material={o === 'jaqueta' ? m.primary : m.secondary} position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.075, 0.22, 6, seg / 2]} />
        </mesh>
        <mesh material={m.skin} position={[0, -0.38, 0]}>
          <sphereGeometry args={[0.085, seg, seg / 2]} />
        </mesh>
        {a.bracelete && side === -1 && (
          <mesh material={m.glow} position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.088, 0.022, 8, seg]} />
          </mesh>
        )}
      </group>
    </group>
  );

  return (
    <group>
      {/* sombra de contato barata */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>

      <group ref={body}>
        {/* pernas e botas */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.15, 0, 0]}>
            <mesh material={m.primary} position={[0, 0.52, 0]}>
              <capsuleGeometry args={[0.105, 0.42, 6, seg / 2]} />
            </mesh>
            {o === 'armadura' && (
              <mesh material={m.secondary} position={[0, 0.5, 0.08]}>
                <boxGeometry args={[0.17, 0.2, 0.06]} />
              </mesh>
            )}
            <RoundedBox args={[0.22, 0.15, 0.34]} radius={0.05} smoothness={2} position={[0, 0.08, 0.04]} material={m.secondary} />
            <mesh material={m.detail} position={[0, 0.02, 0.04]}>
              <boxGeometry args={[0.225, 0.03, 0.345]} />
            </mesh>
          </group>
        ))}

        {/* quadril e cinto */}
        <RoundedBox args={[0.46, 0.2, 0.3]} radius={0.06} smoothness={2} position={[0, 0.84, 0]} material={m.secondary} />
        {o !== 'jaqueta' && (
          <mesh material={m.detail} position={[0, 0.93, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.32]} />
          </mesh>
        )}

        {/* tronco */}
        <RoundedBox args={[0.6, 0.62, 0.36]} radius={0.16} smoothness={quality === 'alta' ? 4 : 2} position={[0, 1.22, 0]} material={m.primary} />

        {o === 'macacao' && (
          <>
            <mesh material={m.secondary} position={[0.13, 1.3, 0.172]}>
              <boxGeometry args={[0.14, 0.12, 0.02]} />
            </mesh>
            <mesh material={m.detail} position={[-0.14, 1.36, 0.172]}>
              <boxGeometry args={[0.1, 0.022, 0.02]} />
            </mesh>
          </>
        )}
        {o === 'jaqueta' && (
          <>
            <mesh material={m.secondary} position={[0, 1.18, 0.168]}>
              <boxGeometry args={[0.12, 0.6, 0.02]} />
            </mesh>
            <mesh material={m.detail} position={[0, 1.18, 0.18]}>
              <boxGeometry args={[0.012, 0.58, 0.012]} />
            </mesh>
            <mesh material={m.primary} position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.15, 0.05, 8, seg, Math.PI * 1.6]} />
            </mesh>
            <RoundedBox args={[0.62, 0.12, 0.36]} radius={0.05} smoothness={2} position={[0, 0.95, 0]} material={m.primary} />
          </>
        )}
        {o === 'armadura' && (
          <>
            <RoundedBox args={[0.5, 0.36, 0.08]} radius={0.04} smoothness={2} position={[0, 1.3, 0.16]} material={m.secondary} />
            <mesh material={m.glow} position={[0, 1.3, 0.205]}>
              <boxGeometry args={[0.16, 0.035, 0.01]} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={m.secondary} position={[0, 1.06 - i * 0.075, 0.165]}>
                <boxGeometry args={[0.38 - i * 0.04, 0.05, 0.04]} />
              </mesh>
            ))}
          </>
        )}

        {/* braços */}
        {arm(-1, armL, foreL)}
        {arm(1, armR, foreR)}

        {/* lanterna de ombro */}
        {a.lanterna && (
          <group position={[-0.4, 1.6, 0.04]}>
            <mesh material={m.dark} rotation={[Math.PI / 2.2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.065, 0.14, seg]} />
            </mesh>
            <mesh material={m.glow} position={[0, 0.025, 0.07]} rotation={[Math.PI / 2.2, 0, 0]}>
              <circleGeometry args={[0.045, seg]} />
            </mesh>
          </group>
        )}

        {/* mochila-drive: um pendrive nas costas */}
        {a.mochila && (
          <group position={[0, 1.24, -0.24]}>
            <RoundedBox args={[0.44, 0.56, 0.16]} radius={0.05} smoothness={2} material={m.secondary} />
            <mesh material={m.detail} position={[0, 0.3, 0]}>
              <boxGeometry args={[0.46, 0.06, 0.18]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.39, 0]}>
              <boxGeometry args={[0.2, 0.12, 0.1]} />
            </mesh>
            {[-0.06, -0.02, 0.02, 0.06].map((x) => (
              <mesh key={x} material={m.gold} position={[x, 0.42, 0.051]}>
                <boxGeometry args={[0.025, 0.05, 0.004]} />
              </mesh>
            ))}
            <mesh material={m.glow} position={[0, -0.05, -0.082]}>
              <boxGeometry args={[0.3, 0.025, 0.005]} />
            </mesh>
          </group>
        )}

        {/* pescoço e cachecol */}
        <mesh material={m.skin} position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.12, seg / 2]} />
        </mesh>
        {a.cachecol && (
          <group position={[0, 1.58, 0]}>
            <mesh material={m.detail} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.12, 0.055, 10, seg]} />
            </mesh>
            <mesh ref={tail} material={m.detail} position={[0.1, -0.16, 0.1]}>
              <boxGeometry args={[0.09, 0.28, 0.03]} />
            </mesh>
          </group>
        )}

        {/* cabeça */}
        <group ref={head} position={[0, 1.86, 0]}>
          <mesh material={m.skin}>
            <sphereGeometry args={[0.25, seg, seg]} />
          </mesh>
          {/* orelhas */}
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.skin} position={[s * 0.245, -0.01, 0]} scale={[0.5, 1, 0.8]}>
              <sphereGeometry args={[0.055, 12, 8]} />
            </mesh>
          ))}
          {/* olhos */}
          {config.eyes === 'visor' && (
            <mesh material={m.glow} position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.262, 0.262, 0.085, seg, 1, true, -Math.PI * 0.3, Math.PI * 0.6]} />
            </mesh>
          )}
          {config.eyes === 'duplo' && [-1, 1].map((s) => (
            <mesh key={s} material={m.glow} position={[s * 0.09, 0.03, 0.225]} scale={[1, 1.35, 0.6]}>
              <sphereGeometry args={[0.042, 16, 12]} />
            </mesh>
          ))}
          {config.eyes === 'anel' && (
            <>
              <mesh material={m.dark} position={[0.09, 0.03, 0.235]}>
                <torusGeometry args={[0.06, 0.016, 10, seg]} />
              </mesh>
              <mesh material={m.glow} position={[0.09, 0.03, 0.238]}>
                <circleGeometry args={[0.045, seg]} />
              </mesh>
              <mesh material={m.glow} position={[-0.09, 0.03, 0.232]} scale={[1, 1, 0.5]}>
                <sphereGeometry args={[0.025, 12, 8]} />
              </mesh>
            </>
          )}
          {/* boca discreta */}
          <mesh material={m.dark} position={[0, -0.1, 0.228]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.07, 0.012, 0.01]} />
          </mesh>

          {/* coberturas */}
          {config.head === 'capacete' && (
            <>
              <mesh material={m.primary} position={[0, 0.015, -0.01]}>
                <sphereGeometry args={[0.285, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
              </mesh>
              <mesh material={m.primary} position={[0, 0.0, -0.03]} rotation={[0.25, 0, 0]}>
                <sphereGeometry args={[0.284, seg, seg / 2, Math.PI * 0.7, Math.PI * 1.6, 0, Math.PI * 0.62]} />
              </mesh>
              <mesh material={m.detail} position={[0, 0.17, 0]}>
                <boxGeometry args={[0.05, 0.24, 0.5]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} material={m.secondary} position={[s * 0.27, -0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.06, seg]} />
                </mesh>
              ))}
            </>
          )}
          {config.head === 'bone' && (
            <>
              <mesh material={m.primary} position={[0, 0.03, 0]}>
                <sphereGeometry args={[0.262, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
              </mesh>
              <mesh material={m.secondary} position={[0, 0.1, 0.24]} rotation={[0.18, 0, 0]} scale={[1, 1, 1.25]}>
                <cylinderGeometry args={[0.17, 0.17, 0.02, seg, 1, false, -Math.PI / 2, Math.PI]} />
              </mesh>
              <mesh material={m.detail} position={[0, 0.27, 0]}>
                <sphereGeometry args={[0.03, 10, 8]} />
              </mesh>
            </>
          )}
          {config.head === 'crista' && (
            <>
              <mesh material={m.hair} position={[0, 0.02, -0.01]}>
                <sphereGeometry args={[0.258, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
              </mesh>
              {[0, 1, 2, 3, 4].map((i) => (
                <mesh key={i} material={m.detail} position={[0, 0.24 - Math.abs(i - 1.5) * 0.02, 0.16 - i * 0.09]} rotation={[-0.35 + i * 0.22, 0, 0]}>
                  <coneGeometry args={[0.055, 0.2 - Math.abs(i - 1.5) * 0.025, 8]} />
                </mesh>
              ))}
            </>
          )}
          {config.head === 'capuz' && (
            <mesh material={m.primary} position={[0, 0.02, -0.02]} rotation={[-0.15, 0, 0]}>
              <sphereGeometry args={[0.3, seg, seg, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.82]} />
            </mesh>
          )}
          {config.head === 'nenhum' && (
            <mesh material={m.hair} position={[0, 0.03, -0.015]}>
              <sphereGeometry args={[0.257, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.33]} />
            </mesh>
          )}

          {/* antena */}
          {a.antena && (
            <group position={[-0.2, 0.2, -0.04]} rotation={[0, 0, 0.35]}>
              <mesh material={m.dark} position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.008, 0.012, 0.28, 8]} />
              </mesh>
              <mesh material={m.glow} position={[0, 0.3, 0]}>
                <sphereGeometry args={[0.03, 12, 8]} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </group>
  );
}
