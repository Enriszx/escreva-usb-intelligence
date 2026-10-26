import { CancelledError, sha256OfBlob } from './hashing';
import type { HashWorkerOut } from '../../workers/hash.worker';

export interface HashJob {
  id: string;
  size: number;
  /** Conteúdo para o worker. */
  file?: Blob;
  /** Ou um cálculo feito fora (ex.: no Android nativo). */
  hasher?: (onProgress: (bytes: number) => void) => Promise<string>;
}

export interface HashCallbacks {
  onProgress?: (doneBytes: number, totalBytes: number) => void;
  onResult?: (id: string, result: { sha256?: string; error?: string }) => void;
  signal?: AbortSignal;
}

/**
 * Calcula hashes num Web Worker para não travar a interface. Cancelar encerra
 * o worker imediatamente; os resultados já entregues continuam válidos.
 */
export async function hashFiles(all: HashJob[], cb: HashCallbacks = {}): Promise<{ cancelled: boolean }> {
  const total = all.reduce((s, j) => s + j.size, 0);
  const blobJobs = all.filter((j): j is HashJob & { file: Blob } => !!j.file);
  const external = all.filter((j) => !j.file && j.hasher);
  const first = blobJobs.length ? await hashBlobs(blobJobs, total, cb) : { cancelled: false };
  if (first.cancelled || !external.length) return first;
  let base = blobJobs.reduce((s, j) => s + j.size, 0);
  for (const j of external) {
    if (cb.signal?.aborted) return { cancelled: true };
    try {
      const sha256 = await j.hasher!((b) => cb.onProgress?.(base + b, total));
      cb.onResult?.(j.id, { sha256 });
    } catch (e) {
      cb.onResult?.(j.id, { error: (e as Error).message });
    }
    base += j.size;
  }
  return { cancelled: false };
}

function hashBlobs(jobs: (HashJob & { file: Blob })[], total: number, cb: HashCallbacks): Promise<{ cancelled: boolean }> {
  if (typeof Worker === 'undefined') return hashOnMainThread(jobs, total, cb);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../../workers/hash.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      hashOnMainThread(jobs, total, cb).then(resolve);
      return;
    }
    const sizes = new Map(jobs.map((j) => [j.id, j.file.size]));
    const current = new Map<string, number>();
    const doneIds = new Set<string>();
    let finishedBytes = 0;
    const emit = () => {
      let inFlight = 0;
      current.forEach((b) => (inFlight += b));
      cb.onProgress?.(finishedBytes + inFlight, total);
    };
    const stop = () => {
      worker.terminate();
      resolve({ cancelled: true });
    };
    if (cb.signal?.aborted) return stop();
    cb.signal?.addEventListener('abort', stop, { once: true });
    worker.onmessage = (ev: MessageEvent<HashWorkerOut>) => {
      const m = ev.data;
      if (m.type === 'progress') {
        current.set(m.id, m.bytes);
        emit();
      } else if (m.type === 'done' || m.type === 'error') {
        current.delete(m.id);
        doneIds.add(m.id);
        finishedBytes += sizes.get(m.id) ?? 0;
        emit();
        cb.onResult?.(m.id, m.type === 'done' ? { sha256: m.sha256 } : { error: m.message });
      } else if (m.type === 'finished') {
        cb.signal?.removeEventListener('abort', stop);
        worker.terminate();
        resolve({ cancelled: false });
      }
    };
    worker.onerror = () => {
      // Worker indisponível (ex.: aberto via file://): segue na thread principal.
      cb.signal?.removeEventListener('abort', stop);
      worker.terminate();
      const pending = jobs.filter((j) => !doneIds.has(j.id));
      hashOnMainThread(pending, total, cb, finishedBytes).then(resolve);
    };
    worker.postMessage({ type: 'hash', jobs });
  });
}

async function hashOnMainThread(jobs: (HashJob & { file: Blob })[], total: number, cb: HashCallbacks, base = 0) {
  let done = base;
  for (const j of jobs) {
    try {
      const sha256 = await sha256OfBlob(j.file, { signal: cb.signal, onProgress: (b) => cb.onProgress?.(done + b, total) });
      cb.onResult?.(j.id, { sha256 });
    } catch (e) {
      if (e instanceof CancelledError) return { cancelled: true };
      cb.onResult?.(j.id, { error: (e as Error).message });
    }
    done += j.file.size;
  }
  return { cancelled: false };
}
