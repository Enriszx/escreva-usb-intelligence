/**
 * Cofre de arquivos: AES-256-GCM com chave derivada da senha por PBKDF2-SHA-256.
 *
 * Formato .usbi (versão 1):
 *   [0..3]   "USBI" (magic)
 *   [4]      versão = 1
 *   [5..8]   iterações PBKDF2 (uint32 big-endian)
 *   [9..24]  salt (16 bytes aleatórios)
 *   [25..36] IV/nonce (12 bytes aleatórios, nunca reutilizado: cada arquivo tem chave e IV novos)
 *   [37..]   AES-GCM(plaintext) incluindo a tag de 16 bytes
 * plaintext = [uint32 tamanho do meta][meta JSON {name,type,size}][bytes originais]
 * O cabeçalho entra como dado autenticado (AAD): qualquer alteração faz a abertura falhar.
 * A senha nunca é armazenada. Sem ela, não há recuperação possível.
 */
export const MAGIC = [0x55, 0x53, 0x42, 0x49];
export const VERSION = 1;
export const DEFAULT_ITERATIONS = 600_000;
const HEADER = 37;

export interface VaultMeta {
  name: string;
  type: string;
  size: number;
}

export class VaultError extends Error {
  constructor(public code: 'formato' | 'senha' | 'suporte', message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new VaultError('suporte', 'A Web Crypto API não está disponível. Use o app por HTTPS ou localhost.');
  return s;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(
  data: Uint8Array,
  meta: VaultMeta,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<Uint8Array> {
  if (!password) throw new VaultError('senha', 'Informe uma senha.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new Uint8Array(HEADER);
  header.set(MAGIC, 0);
  header[4] = VERSION;
  new DataView(header.buffer).setUint32(5, iterations);
  header.set(salt, 9);
  header.set(iv, 25);
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const plain = new Uint8Array(4 + metaBytes.length + data.length);
  new DataView(plain.buffer).setUint32(0, metaBytes.length);
  plain.set(metaBytes, 4);
  plain.set(data, 4 + metaBytes.length);
  const key = await deriveKey(password, salt, iterations);
  const cipher = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plain));
  plain.fill(0);
  const out = new Uint8Array(HEADER + cipher.length);
  out.set(header, 0);
  out.set(cipher, HEADER);
  return out;
}

export function readHeader(bytes: Uint8Array): { iterations: number; salt: Uint8Array; iv: Uint8Array } {
  if (bytes.length < HEADER + 16 || MAGIC.some((m, i) => bytes[i] !== m)) {
    throw new VaultError('formato', 'Este arquivo não é um cofre .usbi.');
  }
  if (bytes[4] !== VERSION) throw new VaultError('formato', `Versão de cofre não suportada (${bytes[4]}).`);
  const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5);
  if (iterations < 100_000 || iterations > 10_000_000) throw new VaultError('formato', 'Cabeçalho do cofre inválido.');
  return { iterations, salt: bytes.slice(9, 25), iv: bytes.slice(25, 37) };
}

export async function decryptBytes(bytes: Uint8Array, password: string): Promise<{ meta: VaultMeta; data: Uint8Array }> {
  const { iterations, salt, iv } = readHeader(bytes);
  const key = await deriveKey(password, salt, iterations);
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(
      await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: bytes.slice(0, HEADER) }, key, bytes.slice(HEADER)),
    );
  } catch {
    // GCM não distingue senha errada de arquivo adulterado — e não deve.
    throw new VaultError('senha', 'Senha incorreta ou arquivo alterado. Nada foi aberto.');
  }
  const metaLen = new DataView(plain.buffer).getUint32(0);
  const meta = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + metaLen))) as VaultMeta;
  return { meta, data: plain.subarray(4 + metaLen) };
}

/** Estimativa simples e honesta: comprimento e variedade, sem prometer "inquebrável". */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(pool || 1);
  const repeated = /(.)\1{3,}/.test(pw);
  const b = repeated ? bits * 0.6 : bits;
  if (pw.length < 8 || b < 35) return { score: pw ? 1 : 0, label: pw ? 'Fraca' : '' };
  if (b < 55) return { score: 2, label: 'Razoável' };
  if (b < 75) return { score: 3, label: 'Boa' };
  return { score: 4, label: 'Forte' };
}
