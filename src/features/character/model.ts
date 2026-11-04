/**
 * Modelo de dados do Vigia — o personagem do USB Intelligence.
 * Toda opção listada aqui tem correspondência geométrica em VigiaModel.tsx;
 * se uma opção sair do modelo 3D, ela deve sair daqui também.
 */
export const FINISHES = ['fosco', 'acetinado', 'metalico'] as const;
export const BODIES = ['menino', 'menina', 'neutro'] as const;
export const BUILDS = ['magro', 'medio', 'forte'] as const;
export const EYES = ['humano', 'visor', 'duplo', 'anel'] as const;
export const MOUTHS = ['sorriso', 'neutro', 'aberto', 'serio'] as const;
export const HAIRS = ['curto', 'raspado', 'franja', 'cacheado', 'blackpower', 'longo', 'rabo', 'coque', 'trancas', 'crista', 'careca'] as const;
export const HEADS = ['nenhum', 'capacete', 'bone', 'capuz', 'tiara'] as const;
export const OUTFITS = ['macacao', 'jaqueta', 'armadura', 'moletom', 'vestido', 'social', 'esportivo'] as const;
export const POSES = ['alerta', 'aceno', 'repouso', 'vitoria', 'pensativo'] as const;
export const ACCESSORIES = ['mochila', 'antena', 'cachecol', 'lanterna', 'bracelete', 'oculos', 'fones', 'capa', 'colar', 'brincos'] as const;

export type Finish = (typeof FINISHES)[number];
export type Body = (typeof BODIES)[number];
export type Build = (typeof BUILDS)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Hair = (typeof HAIRS)[number];
export type Eyes = (typeof EYES)[number];
export type Head = (typeof HEADS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Pose = (typeof POSES)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface CharacterConfig {
  version: 1;
  colors: { primary: string; secondary: string; detail: string; glow: string; skin: string; hair: string; iris: string };
  finish: Finish;
  glow: { enabled: boolean; intensity: number };
  body: Body;
  build: Build;
  /** Altura relativa, 0,88 a 1,12. */
  height: number;
  eyes: Eyes;
  mouth: Mouth;
  hair: Hair;
  head: Head;
  outfit: Outfit;
  pose: Pose;
  accessories: Record<Accessory, boolean>;
}

export interface SavedCharacter {
  id: string;
  name: string;
  config: CharacterConfig;
  presetId: string | null;
  createdAt: number;
  updatedAt: number;
}

export const LABELS = {
  finish: { fosco: 'Fosco', acetinado: 'Acetinado', metalico: 'Metálico' } as Record<Finish, string>,
  body: { menino: 'Menino', menina: 'Menina', neutro: 'Neutro' } as Record<Body, string>,
  build: { magro: 'Magro', medio: 'Médio', forte: 'Forte' } as Record<Build, string>,
  eyes: { humano: 'Olhos humanos', visor: 'Visor contínuo', duplo: 'Olhos duplos', anel: 'Anel óptico' } as Record<Eyes, string>,
  mouth: { sorriso: 'Sorriso', neutro: 'Neutra', aberto: 'Animada', serio: 'Séria' } as Record<Mouth, string>,
  hair: {
    curto: 'Curto', raspado: 'Raspado', franja: 'Com franja', cacheado: 'Cacheado', blackpower: 'Black power', longo: 'Longo',
    rabo: 'Rabo de cavalo', coque: 'Coque', trancas: 'Tranças', crista: 'Crista', careca: 'Careca',
  } as Record<Hair, string>,
  head: { nenhum: 'Sem cobertura', capacete: 'Capacete', bone: 'Boné técnico', capuz: 'Capuz', tiara: 'Tiara' } as Record<Head, string>,
  outfit: {
    macacao: 'Macacão de campo', jaqueta: 'Jaqueta corta-vento', armadura: 'Placas de proteção', moletom: 'Moletom', vestido: 'Vestido',
    social: 'Social com gravata', esportivo: 'Esportivo',
  } as Record<Outfit, string>,
  pose: { alerta: 'Alerta', aceno: 'Aceno', repouso: 'Repouso', vitoria: 'Vitória', pensativo: 'Pensativo' } as Record<Pose, string>,
  accessories: {
    mochila: 'Mochila-drive', antena: 'Antena de sinal', cachecol: 'Cachecol', lanterna: 'Lanterna de ombro', bracelete: 'Bracelete de dados',
    oculos: 'Óculos', fones: 'Fones de ouvido', capa: 'Capa', colar: 'Colar', brincos: 'Brincos',
  } as Record<Accessory, string>,
};

export interface Preset {
  id: string;
  name: string;
  note: string;
  config: CharacterConfig;
}

const acc = (...on: Accessory[]): Record<Accessory, boolean> =>
  Object.fromEntries(ACCESSORIES.map((a) => [a, on.includes(a)])) as Record<Accessory, boolean>;

export const PRESETS: Preset[] = [
  {
    id: 'guardiao-verde',
    name: 'Guardião Verde',
    note: 'Macacão de mata, placas grafite, visor em sinal verde.',
    config: {
      version: 1,
      colors: { primary: '#0b5a43', secondary: '#1b201c', detail: '#ffd600', glow: '#00e676', skin: '#8d5a3b', hair: '#17110d', iris: '#3b2414' },
      finish: 'acetinado', glow: { enabled: true, intensity: 1.4 },
      body: 'neutro', build: 'medio', height: 1, eyes: 'visor', mouth: 'sorriso', hair: 'curto', head: 'capacete', outfit: 'macacao', pose: 'alerta', accessories: acc('mochila', 'antena'),
    },
  },
  {
    id: 'explorador-digital',
    name: 'Explorador Digital',
    note: 'Corta-vento gelo, boné técnico e lanterna para trilhas de dados.',
    config: {
      version: 1,
      colors: { primary: '#e8ece4', secondary: '#063d2e', detail: '#1464f4', glow: '#ffd600', skin: '#c58c63', hair: '#5a3a22', iris: '#2f5d3a' },
      finish: 'fosco', glow: { enabled: true, intensity: 1 },
      body: 'menino', build: 'magro', height: 1, eyes: 'duplo', mouth: 'aberto', hair: 'franja', head: 'bone', outfit: 'jaqueta', pose: 'aceno', accessories: acc('mochila', 'lanterna', 'cachecol'),
    },
  },
  {
    id: 'nucleo-azul',
    name: 'Núcleo Azul',
    note: 'Placas metálicas em azul de rede, anel óptico.',
    config: {
      version: 1,
      colors: { primary: '#1464f4', secondary: '#07152d', detail: '#f4f7f2', glow: '#6c9dff', skin: '#5e3b27', hair: '#0b0b0b', iris: '#1f3f8a' },
      finish: 'metalico', glow: { enabled: true, intensity: 2 },
      body: 'neutro', build: 'forte', height: 1.06, eyes: 'anel', mouth: 'serio', hair: 'raspado', head: 'capacete', outfit: 'armadura', pose: 'alerta', accessories: acc('bracelete', 'antena'),
    },
  },
  {
    id: 'energia-solar',
    name: 'Energia Solar',
    note: 'Amarelo de meio-dia, crista e cachecol ao vento.',
    config: {
      version: 1,
      colors: { primary: '#ffd600', secondary: '#101311', detail: '#00e676', glow: '#fff3a0', skin: '#e0ac82', hair: '#ffd600', iris: '#6b4423' },
      finish: 'acetinado', glow: { enabled: true, intensity: 1.2 },
      body: 'menina', build: 'medio', height: 0.97, eyes: 'humano', mouth: 'sorriso', hair: 'crista', head: 'nenhum', outfit: 'jaqueta', pose: 'aceno', accessories: acc('cachecol', 'bracelete'),
    },
  },
  {
    id: 'cyber-brasileiro',
    name: 'Cyber Brasileiro',
    note: 'Verde, amarelo e azul em doses certas, sem virar bandeira.',
    config: {
      version: 1,
      colors: { primary: '#063d2e', secondary: '#ffd600', detail: '#1464f4', glow: '#00e676', skin: '#7a4b31', hair: '#17110d', iris: '#3b2414' },
      finish: 'metalico', glow: { enabled: true, intensity: 1.8 },
      body: 'neutro', build: 'medio', height: 1, eyes: 'visor', mouth: 'neutro', hair: 'curto', head: 'capuz', outfit: 'armadura', pose: 'repouso', accessories: acc('mochila', 'antena', 'bracelete', 'lanterna'),
    },
  },
  {
    id: 'pesquisadora',
    name: 'Pesquisadora de Dados',
    note: 'Jaleco-moletom, óculos, tranças e fones para longas análises.',
    config: {
      version: 1,
      colors: { primary: '#f4f7f2', secondary: '#1464f4', detail: '#ffd600', glow: '#6c9dff', skin: '#7a4b31', hair: '#1a120c', iris: '#4a2c17' },
      finish: 'fosco', glow: { enabled: true, intensity: 1 },
      body: 'menina', build: 'magro', height: 0.98, eyes: 'humano', mouth: 'sorriso', hair: 'trancas', head: 'nenhum', outfit: 'moletom', pose: 'pensativo', accessories: acc('oculos', 'fones', 'colar'),
    },
  },
  {
    id: 'capitao-cerrado',
    name: 'Capitão do Cerrado',
    note: 'Social com gravata, capa verde e vitória garantida.',
    config: {
      version: 1,
      colors: { primary: '#0b5a43', secondary: '#101311', detail: '#ffd600', glow: '#00e676', skin: '#c58c63', hair: '#2a1a10', iris: '#2f5d3a' },
      finish: 'acetinado', glow: { enabled: true, intensity: 1.2 },
      body: 'menino', build: 'forte', height: 1.08, eyes: 'humano', mouth: 'aberto', hair: 'cacheado', head: 'nenhum', outfit: 'social', pose: 'vitoria', accessories: acc('capa', 'bracelete'),
    },
  },
];

export const DEFAULT_CONFIG: CharacterConfig = structuredCloneSafe(PRESETS[0].config);

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
export const cloneConfig = structuredCloneSafe<CharacterConfig>;

/* ---------- Validação ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ValidationResult {
  ok: boolean;
  value?: CharacterConfig;
  name?: string;
  errors: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida uma configuração vinda de fora (arquivo JSON). Aceita o envelope
 * exportado pelo app ou a configuração pura. Nunca devolve objeto parcial.
 */
export function validateCharacter(input: unknown): ValidationResult {
  const errors: string[] = [];
  let name: string | undefined;
  let cfg: unknown = input;
  if (isObj(input) && input.app === 'usb-intelligence') {
    if (input.kind !== 'character') errors.push('O arquivo é do USB Intelligence, mas não é um personagem.');
    if (isObj(input.character)) {
      if (typeof input.character.name === 'string') name = input.character.name;
      cfg = input.character.config;
    } else {
      errors.push('Campo "character" ausente.');
    }
  }
  if (!isObj(cfg)) return { ok: false, errors: [...errors, 'A configuração precisa ser um objeto JSON.'] };

  if (cfg.version !== 1) errors.push('Versão da configuração não suportada (esperado 1).');
  const colors = cfg.colors;
  if (!isObj(colors)) errors.push('Campo "colors" ausente.');
  else {
    for (const k of ['primary', 'secondary', 'detail', 'glow', 'skin']) {
      if (typeof colors[k] !== 'string' || !HEX.test(colors[k] as string)) errors.push(`Cor "${k}" inválida (use #RRGGBB).`);
    }
    // Cores novas: opcionais (arquivos antigos não têm), mas válidas quando vierem.
    for (const k of ['hair', 'iris']) {
      if (colors[k] !== undefined && (typeof colors[k] !== 'string' || !HEX.test(colors[k] as string))) errors.push(`Cor "${k}" inválida (use #RRGGBB).`);
    }
  }
  const oneOf = (field: string, list: readonly string[], optional = false) => {
    if (optional && cfg[field] === undefined) return;
    if (!list.includes(cfg[field] as string)) errors.push(`"${field}" deve ser um de: ${list.join(', ')}.`);
  };
  // Formato antigo: "crista" e "nenhum" eram coberturas; viraram cabelo.
  const legacyHead = cfg.head === 'crista';
  oneOf('finish', FINISHES);
  oneOf('eyes', EYES);
  if (!legacyHead) oneOf('head', HEADS);
  oneOf('outfit', OUTFITS);
  oneOf('pose', POSES);
  oneOf('body', BODIES, true);
  oneOf('build', BUILDS, true);
  oneOf('mouth', MOUTHS, true);
  oneOf('hair', HAIRS, true);
  if (cfg.height !== undefined && (typeof cfg.height !== 'number' || !Number.isFinite(cfg.height) || cfg.height < 0.88 || cfg.height > 1.12)) errors.push('"height" deve ser um número entre 0,88 e 1,12.');
  const glow = cfg.glow;
  if (!isObj(glow) || typeof glow.enabled !== 'boolean' || typeof glow.intensity !== 'number' || !Number.isFinite(glow.intensity) || glow.intensity < 0 || glow.intensity > 3) {
    errors.push('"glow" precisa de enabled (true/false) e intensity entre 0 e 3.');
  }
  const accessories = cfg.accessories;
  if (!isObj(accessories)) errors.push('Campo "accessories" ausente.');
  else {
    for (const a of ACCESSORIES) if (accessories[a] !== undefined && typeof accessories[a] !== 'boolean') errors.push(`Acessório "${a}" precisa ser true ou false.`);
    for (const a of ['mochila', 'antena', 'cachecol', 'lanterna', 'bracelete']) if (typeof accessories[a] !== 'boolean') errors.push(`Acessório "${a}" precisa ser true ou false.`);
    for (const k of Object.keys(accessories)) if (!(ACCESSORIES as readonly string[]).includes(k)) errors.push(`Acessório desconhecido: "${k}".`);
  }
  if (name !== undefined && (name.trim().length === 0 || name.length > 40)) errors.push('Nome deve ter de 1 a 40 caracteres.');
  if (errors.length) return { ok: false, errors };

  const c = cfg as unknown as CharacterConfig & { head: string };
  const d = DEFAULT_CONFIG;
  const value: CharacterConfig = {
    version: 1,
    colors: {
      primary: c.colors.primary.toLowerCase(), secondary: c.colors.secondary.toLowerCase(), detail: c.colors.detail.toLowerCase(),
      glow: c.colors.glow.toLowerCase(), skin: c.colors.skin.toLowerCase(),
      hair: (c.colors.hair ?? d.colors.hair).toLowerCase(), iris: (c.colors.iris ?? d.colors.iris).toLowerCase(),
    },
    finish: c.finish, glow: { enabled: c.glow.enabled, intensity: c.glow.intensity },
    body: c.body ?? 'neutro', build: c.build ?? 'medio', height: c.height ?? 1,
    eyes: c.eyes, mouth: c.mouth ?? 'sorriso',
    hair: c.hair ?? (legacyHead ? 'crista' : 'curto'),
    head: legacyHead ? 'nenhum' : (c.head as Head),
    outfit: c.outfit, pose: c.pose,
    accessories: Object.fromEntries(ACCESSORIES.map((a) => [a, c.accessories[a] ?? false])) as Record<Accessory, boolean>,
  };
  return { ok: true, value, name: name?.trim(), errors: [] };
}

export function exportEnvelope(name: string, config: CharacterConfig) {
  return { app: 'usb-intelligence', kind: 'character', version: 1, exportedAt: new Date().toISOString(), character: { name, config } };
}

/* ---------- Aleatorização ---------- */
const PALETTE = ['#063d2e', '#0b5a43', '#00e676', '#ffd600', '#1464f4', '#07152d', '#f4f7f2', '#101311', '#e2572b', '#6c9dff', '#b9e769'];
const SKINS = ['#5e3b27', '#7a4b31', '#8d5a3b', '#a8714c', '#c58c63', '#e0ac82', '#f1c9a5'];

const HAIR_COLORS = ['#0b0b0b', '#17110d', '#3b2414', '#5a3a22', '#8a5a2b', '#c99a5b', '#e8d3a2', '#b33a2e', '#6c9dff', '#ffd600'];

export function randomConfig(rng: () => number = Math.random): CharacterConfig {
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
  let primary = pick(PALETTE);
  let secondary = pick(PALETTE);
  while (secondary === primary) secondary = pick(PALETTE);
  let detail = pick(PALETTE);
  while (detail === primary || detail === secondary) detail = pick(PALETTE);
  primary = primary.toLowerCase();
  secondary = secondary.toLowerCase();
  return {
    version: 1,
    colors: { primary, secondary, detail, glow: pick(['#00e676', '#ffd600', '#6c9dff', '#fff3a0']), skin: pick(SKINS), hair: pick(HAIR_COLORS), iris: pick(['#3b2414', '#2f5d3a', '#1f3f8a', '#6b4423', '#4a4a4a']) },
    finish: pick(FINISHES),
    glow: { enabled: rng() > 0.2, intensity: Math.round((0.6 + rng() * 1.8) * 10) / 10 },
    body: pick(BODIES),
    build: pick(BUILDS),
    height: Math.round((0.9 + rng() * 0.2) * 100) / 100,
    eyes: pick(EYES),
    mouth: pick(MOUTHS),
    hair: pick(HAIRS),
    head: pick(HEADS),
    outfit: pick(OUTFITS),
    pose: pick(POSES),
    accessories: Object.fromEntries(ACCESSORIES.map((a) => [a, rng() > 0.6])) as Record<Accessory, boolean>,
  };
}

export function sameConfig(a: CharacterConfig, b: CharacterConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
