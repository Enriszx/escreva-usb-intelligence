import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Build, CharacterConfig, Finish, Hair, Pose } from './model';

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
  aceno: { L: [0.05, 0.18, -0.25], R: [0, 2.45, -0.35], head: -0.05 },
  repouso: { L: [0.05, 0.1, -0.12], R: [0.05, -0.1, -0.12], head: 0.12 },
  vitoria: { L: [0, -2.35, -0.25], R: [0, 2.35, -0.25], head: -0.12 },
  pensativo: { L: [0.1, 0.25, -0.3], R: [-1.45, -0.15, -2.1], head: 0.18 },
};

/** Proporções do corpo: menino, menina ou neutro, e o porte. */
const BUILD: Record<Build, number> = { magro: 0.88, medio: 1, forte: 1.14 };
function bodyShape(body: CharacterConfig['body'], build: Build) {
  const b = BUILD[build];
  if (body === 'menina') return { shoulder: 0.36 * b, torsoW: 0.54 * b, waist: 0.86, hipW: 0.5 * b, legX: 0.14 };
  if (body === 'menino') return { shoulder: 0.42 * b, torsoW: 0.64 * b, waist: 1, hipW: 0.46 * b, legX: 0.15 };
  return { shoulder: 0.4 * b, torsoW: 0.6 * b, waist: 1, hipW: 0.46 * b, legX: 0.15 };
}
const COVERS_HAIR = (head: CharacterConfig['head'], hair: Hair) => head === 'capacete' || (head === 'capuz' && !['longo', 'trancas'].includes(hair));

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
    white: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4, metalness: 0 }),
    iris: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0 }),
    cape: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide }),
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
  const cape = useRef<THREE.Mesh>(null);
  const first = useRef(true);
  const seg = quality === 'alta' ? 32 : 16;

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const k = first.current ? 1 : 1 - Math.exp(-8 * d); // primeira vez aplica direto
    first.current = false;
    const c = config.colors;
    const f = FINISH[config.finish];
    for (const [mat, hex] of [[m.primary, c.primary], [m.secondary, c.secondary], [m.detail, c.detail], [m.skin, c.skin], [m.hair, c.hair], [m.iris, c.iris]] as const) {
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
    if (cape.current) cape.current.rotation.x = 0.12 + Math.sin(t * 1.8) * 0.05 * move;
    m.cape.color.lerp(tmp.set(c.detail), k);
  });

  const a = config.accessories;
  const o = config.outfit;
  const sh = bodyShape(config.body, config.build);
  const fem = config.body === 'menina';

  const arm = (side: 1 | -1, ref: RefObject<THREE.Group>, fore: RefObject<THREE.Group>) => (
    <group ref={ref} position={[side * sh.shoulder, 1.42, 0]}>
      {/* ombro */}
      <mesh material={o === 'armadura' ? m.secondary : m.primary} position={[0, 0, 0]}>
        <sphereGeometry args={[o === 'armadura' ? 0.15 : 0.12, seg, seg / 2]} />
      </mesh>
      <mesh material={m.primary} position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.085, 0.26, 6, seg / 2]} />
      </mesh>
      <group ref={fore} position={[0, -0.4, 0]}>
        <mesh material={o === 'jaqueta' || o === 'moletom' || o === 'social' ? m.primary : o === 'vestido' || o === 'esportivo' ? m.skin : m.secondary} position={[0, -0.16, 0]}>
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
    <group scale={config.height}>
      {/* sombra de contato barata */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>

      <group ref={body}>
        {/* pernas e botas */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * sh.legX, 0, 0]}>
            <mesh material={o === 'esportivo' ? m.skin : m.primary} position={[0, 0.52, 0]}>
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
        <RoundedBox args={[sh.hipW, 0.2, 0.3]} radius={0.06} smoothness={2} position={[0, 0.84, 0]} material={m.secondary} />
        {o === 'vestido' && (
          <mesh material={m.primary} position={[0, 0.74, 0]}>
            <cylinderGeometry args={[sh.hipW * 0.55, sh.hipW * 0.95, 0.46, seg, 1, true]} />
          </mesh>
        )}
        {o === 'esportivo' && (
          <RoundedBox args={[sh.hipW + 0.04, 0.26, 0.32]} radius={0.06} smoothness={2} position={[0, 0.78, 0]} material={m.secondary} />
        )}
        {!['jaqueta', 'vestido', 'moletom', 'esportivo'].includes(o) && (
          <mesh material={m.detail} position={[0, 0.93, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.32]} />
          </mesh>
        )}

        {/* tronco */}
        <RoundedBox args={[sh.torsoW, 0.62, 0.36]} radius={0.16} smoothness={quality === 'alta' ? 4 : 2} position={[0, 1.22, 0]} scale={[1, 1, 1]} material={o === 'social' ? m.secondary : m.primary} />
        {fem && <RoundedBox args={[sh.torsoW * sh.waist, 0.2, 0.34]} radius={0.08} smoothness={2} position={[0, 1.0, 0]} material={o === 'social' ? m.secondary : m.primary} />}
        {o === 'moletom' && (
          <>
            <RoundedBox args={[sh.torsoW * 0.62, 0.16, 0.04]} radius={0.03} smoothness={2} position={[0, 1.06, 0.17]} material={m.secondary} />
            {[-0.05, 0.05].map((x) => (
              <mesh key={x} material={m.detail} position={[x, 1.42, 0.18]}>
                <boxGeometry args={[0.012, 0.14, 0.012]} />
              </mesh>
            ))}
            <mesh material={m.primary} position={[0, 1.56, -0.12]} rotation={[0.5, 0, 0]}>
              <sphereGeometry args={[0.2, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
          </>
        )}
        {o === 'social' && (
          <>
            <mesh material={m.white} position={[0, 1.36, 0.17]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.1, 0.3, 3]} />
            </mesh>
            <mesh material={m.detail} position={[0, 1.3, 0.19]}>
              <boxGeometry args={[0.045, 0.26, 0.02]} />
            </mesh>
            <mesh material={m.detail} position={[0, 1.46, 0.19]}>
              <boxGeometry args={[0.06, 0.04, 0.025]} />
            </mesh>
          </>
        )}
        {o === 'esportivo' && [-1, 1].map((sd) => (
          <mesh key={sd} material={m.detail} position={[sd * sh.torsoW * 0.47, 1.22, 0]}>
            <boxGeometry args={[0.03, 0.6, 0.37]} />
          </mesh>
        ))}
        {o === 'vestido' && (
          <mesh material={m.detail} position={[0, 0.98, 0]}>
            <boxGeometry args={[sh.torsoW * 0.9, 0.04, 0.34]} />
          </mesh>
        )}

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

        {a.capa && (
          <mesh ref={cape} material={m.cape} position={[0, 1.55, -0.2]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[sh.torsoW + 0.12, 0.02, 0.02]} />
          </mesh>
        )}
        {a.capa && (
          <mesh material={m.cape} position={[0, 1.05, -0.24]} rotation={[0.1, 0, 0]}>
            <planeGeometry args={[sh.torsoW + 0.16, 1.0]} />
          </mesh>
        )}
        {a.colar && (
          <group position={[0, 1.53, 0]}>
            <mesh material={m.gold} rotation={[Math.PI / 2.4, 0, 0]}>
              <torusGeometry args={[0.13, 0.012, 8, seg]} />
            </mesh>
            <mesh material={m.glow} position={[0, -0.07, 0.15]}>
              <sphereGeometry args={[0.03, 12, 8]} />
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
          {config.eyes === 'humano' && (
            <>
              {[-1, 1].map((s2) => (
                <group key={s2} position={[s2 * 0.085, 0.03, 0.212]}>
                  <mesh material={m.white} scale={[1, 0.8, 0.5]}>
                    <sphereGeometry args={[0.042, 16, 12]} />
                  </mesh>
                  <mesh material={m.iris} position={[0, 0, 0.018]}>
                    <circleGeometry args={[0.024, 20]} />
                  </mesh>
                  <mesh material={m.dark} position={[0, 0, 0.019]}>
                    <circleGeometry args={[0.011, 16]} />
                  </mesh>
                  <mesh material={m.glow} position={[0.008, 0.009, 0.02]}>
                    <circleGeometry args={[0.004, 8]} />
                  </mesh>
                  {/* sobrancelha */}
                  <mesh material={m.hair} position={[0, 0.058, 0.004]} rotation={[0, 0, s2 * (config.mouth === 'serio' ? 0.18 : -0.06)]}>
                    <boxGeometry args={[0.07, 0.013, 0.012]} />
                  </mesh>
                  {/* cílios */}
                  {fem && [-1, 0, 1].map((l) => (
                    <mesh key={l} material={m.dark} position={[l * 0.016 + s2 * 0.022, 0.036, 0.012]} rotation={[0, 0, s2 * (0.5 + l * 0.15)]}>
                      <boxGeometry args={[0.004, 0.018, 0.004]} />
                    </mesh>
                  ))}
                </group>
              ))}
            </>
          )}
          {/* boca */}
          {config.mouth === 'sorriso' && (
            <mesh material={m.dark} position={[0, -0.085, 0.226]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.04, 0.008, 6, 16, Math.PI]} />
            </mesh>
          )}
          {config.mouth === 'aberto' && (
            <mesh material={m.dark} position={[0, -0.1, 0.226]} scale={[1, 0.75, 0.4]}>
              <sphereGeometry args={[0.032, 16, 12]} />
            </mesh>
          )}
          {config.mouth === 'neutro' && (
            <mesh material={m.dark} position={[0, -0.1, 0.228]}>
              <boxGeometry args={[0.07, 0.012, 0.01]} />
            </mesh>
          )}
          {config.mouth === 'serio' && (
            <mesh material={m.dark} position={[0, -0.105, 0.228]}>
              <boxGeometry args={[0.05, 0.009, 0.01]} />
            </mesh>
          )}

          {/* cabelo */}
          {!COVERS_HAIR(config.head, config.hair) && <HairMesh hair={config.hair} m={m} seg={seg} />}

          {/* óculos */}
          {a.oculos && (
            <group position={[0, 0.035, 0.235]}>
              {[-1, 1].map((s2) => (
                <mesh key={s2} material={m.dark} position={[s2 * 0.085, 0, 0]}>
                  <torusGeometry args={[0.05, 0.008, 8, seg]} />
                </mesh>
              ))}
              <mesh material={m.dark} position={[0, 0.005, 0]}>
                <boxGeometry args={[0.06, 0.008, 0.008]} />
              </mesh>
            </group>
          )}
          {/* fones */}
          {a.fones && (
            <>
              <mesh material={m.secondary} position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.29, 0.02, 8, seg, Math.PI]} />
              </mesh>
              {[-1, 1].map((s2) => (
                <mesh key={s2} material={m.detail} position={[s2 * 0.28, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.075, 0.075, 0.07, seg]} />
                </mesh>
              ))}
            </>
          )}
          {/* brincos */}
          {a.brincos && [-1, 1].map((s2) => (
            <mesh key={s2} material={m.gold} position={[s2 * 0.25, -0.07, 0.01]}>
              <sphereGeometry args={[0.018, 12, 8]} />
            </mesh>
          ))}
          {config.head === 'tiara' && (
            <mesh material={m.detail} position={[0, 0.04, 0.02]} rotation={[0.3, 0, 0]}>
              <torusGeometry args={[0.262, 0.016, 8, seg, Math.PI]} />
            </mesh>
          )}

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
                <sphereGeometry args={[0.275, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
              </mesh>
              <mesh material={m.secondary} position={[0, 0.1, 0.24]} rotation={[0.18, 0, 0]} scale={[1, 1, 1.25]}>
                <cylinderGeometry args={[0.17, 0.17, 0.02, seg, 1, false, -Math.PI / 2, Math.PI]} />
              </mesh>
              <mesh material={m.detail} position={[0, 0.27, 0]}>
                <sphereGeometry args={[0.03, 10, 8]} />
              </mesh>
            </>
          )}
          {config.head === 'capuz' && (
            <mesh material={m.primary} position={[0, 0.02, -0.02]} rotation={[-0.15, 0, 0]}>
              <sphereGeometry args={[0.3, seg, seg, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.82]} />
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

type Mats = ReturnType<typeof useMaterials>;

/** Os 11 penteados, todos feitos com primitivas sobre a cabeça (raio 0,25). */
function HairMesh({ hair, m, seg }: { hair: Hair; m: Mats; seg: number }) {
  const cap = (r = 0.258, open = 0.38, y = 0.02) => (
    <mesh material={m.hair} position={[0, y, -0.01]}>
      <sphereGeometry args={[r, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * open]} />
    </mesh>
  );
  const back = (
    <mesh material={m.hair} position={[0, -0.02, -0.06]} rotation={[0.3, 0, 0]}>
      <sphereGeometry args={[0.262, seg, seg / 2, Math.PI * 0.75, Math.PI * 1.5, 0, Math.PI * 0.6]} />
    </mesh>
  );
  switch (hair) {
    case 'careca': return null;
    case 'raspado': return cap(0.253, 0.32, 0.025);
    case 'curto': return <>{cap()}{back}</>;
    case 'franja': return (
      <>{cap(0.262, 0.4)}{back}
        <mesh material={m.hair} position={[0.04, 0.13, 0.2]} rotation={[0.9, 0, -0.25]}>
          <boxGeometry args={[0.3, 0.16, 0.05]} />
        </mesh>
      </>
    );
    case 'cacheado': return (
      <>{cap(0.26, 0.42)}{back}
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          const y = 0.14 + (i % 3) * 0.04;
          return <mesh key={i} material={m.hair} position={[Math.cos(a) * 0.2, y, Math.sin(a) * 0.2 - 0.02]}><sphereGeometry args={[0.06, 10, 8]} /></mesh>;
        })}
      </>
    );
    case 'blackpower': return (
      // Volume para cima e para trás: a frente fica na linha da testa, sem cobrir o rosto.
      <mesh material={m.hair} position={[0, 0.16, -0.1]} scale={[1.05, 0.95, 0.9]}>
        <sphereGeometry args={[0.34, seg, seg]} />
      </mesh>
    );
    case 'longo': return (
      <>{cap(0.264, 0.45)}
        <mesh material={m.hair} position={[0, -0.18, -0.12]}>
          <boxGeometry args={[0.46, 0.5, 0.12]} />
        </mesh>
        {[-1, 1].map((s) => <mesh key={s} material={m.hair} position={[s * 0.23, -0.12, 0.04]}><boxGeometry args={[0.07, 0.42, 0.14]} /></mesh>)}
      </>
    );
    case 'rabo': return (
      <>{cap(0.262, 0.42)}{back}
        <mesh material={m.hair} position={[0, 0.02, -0.33]} rotation={[-0.5, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.32, 6, 12]} />
        </mesh>
        <mesh material={m.detail} position={[0, 0.12, -0.26]} rotation={[1.1, 0, 0]}>
          <torusGeometry args={[0.05, 0.014, 6, 16]} />
        </mesh>
      </>
    );
    case 'coque': return (
      <>{cap(0.262, 0.42)}{back}
        <mesh material={m.hair} position={[0, 0.27, -0.1]}>
          <sphereGeometry args={[0.11, 16, 12]} />
        </mesh>
      </>
    );
    case 'trancas': return (
      <>{cap(0.262, 0.42)}{back}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.2, -0.05, -0.04]}>
            {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} material={m.hair} position={[s * 0.01 * i, -i * 0.065, 0.02]}><sphereGeometry args={[0.042 - i * 0.003, 10, 8]} /></mesh>)}
            <mesh material={m.detail} position={[s * 0.06, -0.41, 0.02]}><sphereGeometry args={[0.022, 8, 6]} /></mesh>
          </group>
        ))}
      </>
    );
    case 'crista': return (
      <>{cap(0.258, 0.38)}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={m.hair} position={[0, 0.24 - Math.abs(i - 1.5) * 0.02, 0.16 - i * 0.09]} rotation={[-0.35 + i * 0.22, 0, 0]}>
            <coneGeometry args={[0.055, 0.2 - Math.abs(i - 1.5) * 0.025, 8]} />
          </mesh>
        ))}
      </>
    );
  }
}
