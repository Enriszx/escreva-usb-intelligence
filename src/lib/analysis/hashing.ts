import { Sha256, toHex } from './sha256';

export const CHUNK = 4 * 1024 * 1024;
/** Até este tamanho usamos a Web Crypto nativa (mais rápida); acima, blocos. */
export const NATIVE_LIMIT = 64 * 1024 * 1024;

export class CancelledError extends Error {
  constructor() {
    super('Operação cancelada');
    this.name = 'CancelledError';
  }
}

export interface HashOptions {
  signal?: AbortSignal;
  onProgress?: (bytesRead: number) => void;
}

async function readSlice(blob: Blob, start: number, end: number): Promise<ArrayBuffer> {
  const part = blob.slice(start, end);
  if (typeof part.arrayBuffer === 'function') return part.arrayBuffer();
  return new Response(part).arrayBuffer();
}

/** Calcula o SHA-256 de um Blob/File lendo o conteúdo real. */
export async function sha256OfBlob(blob: Blob, opts: HashOptions = {}): Promise<string> {
  const { signal, onProgress } = opts;
  if (signal?.aborted) throw new CancelledError();
  const subtle = globalThis.crypto?.subtle;
  if (subtle && blob.size <= NATIVE_LIMIT) {
    const buf = await readSlice(blob, 0, blob.size);
    if (signal?.aborted) throw new CancelledError();
    const out = await subtle.digest('SHA-256', buf);
    onProgress?.(blob.size);
    return toHex(out);
  }
  const h = new Sha256();
  for (let pos = 0; pos < blob.size; pos += CHUNK) {
    if (signal?.aborted) throw new CancelledError();
    const buf = await readSlice(blob, pos, Math.min(pos + CHUNK, blob.size));
    h.update(new Uint8Array(buf));
    onProgress?.(Math.min(pos + CHUNK, blob.size));
  }
  if (blob.size === 0) onProgress?.(0);
  return h.digestHex();
}

export async function sha256OfText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) return toHex(await crypto.subtle.digest('SHA-256', data));
  return new Sha256().update(data).digestHex();
}
