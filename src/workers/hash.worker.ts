/// <reference lib="webworker" />
import { sha256OfBlob } from '../lib/analysis/hashing';

export type HashWorkerIn = { type: 'hash'; jobs: { id: string; file: Blob }[] };
export type HashWorkerOut =
  | { type: 'progress'; id: string; bytes: number }
  | { type: 'done'; id: string; sha256: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'finished' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<HashWorkerIn>) => {
  if (ev.data.type !== 'hash') return;
  for (const job of ev.data.jobs) {
    try {
      let last = 0;
      const sha256 = await sha256OfBlob(job.file, {
        onProgress: (bytes) => {
          const now = performance.now();
          if (now - last > 80 || bytes === job.file.size) {
            last = now;
            ctx.postMessage({ type: 'progress', id: job.id, bytes } satisfies HashWorkerOut);
          }
        },
      });
      ctx.postMessage({ type: 'done', id: job.id, sha256 } satisfies HashWorkerOut);
    } catch (e) {
      const message = e instanceof DOMException && e.name === 'NotReadableError'
        ? 'Não foi possível ler o arquivo (ele foi movido, apagado ou o acesso expirou).'
        : (e as Error).message || 'Falha ao ler o arquivo.';
      ctx.postMessage({ type: 'error', id: job.id, message } satisfies HashWorkerOut);
    }
  }
  ctx.postMessage({ type: 'finished' } satisfies HashWorkerOut);
};
