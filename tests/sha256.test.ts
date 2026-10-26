// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Sha256 } from '../src/lib/analysis/sha256';
import { sha256OfBlob, sha256OfText, CHUNK, NATIVE_LIMIT, CancelledError } from '../src/lib/analysis/hashing';

const ref = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('SHA-256 incremental', () => {
  it('confere com vetores oficiais', () => {
    expect(new Sha256().update(new Uint8Array()).digestHex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(new Sha256().update(new TextEncoder().encode('abc')).digestHex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('dá o mesmo resultado em qualquer divisão de blocos', () => {
    const data = new Uint8Array(200_003).map((_, i) => (i * 31 + 7) & 255);
    for (const step of [1, 63, 64, 65, 1000, 65536]) {
      const h = new Sha256();
      for (let i = 0; i < data.length; i += step) h.update(data.subarray(i, i + step));
      expect(h.digestHex()).toBe(ref(data));
    }
  });

  it('sha256OfText usa o texto real', async () => {
    expect(await sha256OfText('USB Intelligence')).toBe(ref(new TextEncoder().encode('USB Intelligence')));
  });

  it('caminho em blocos (arquivo grande) reporta progresso e confere com o nativo', async () => {
    const size = NATIVE_LIMIT + CHUNK + 17;
    const data = new Uint8Array(size).map((_, i) => i & 255);
    const progress: number[] = [];
    const hex = await sha256OfBlob(new Blob([data]), { onProgress: (b) => progress.push(b) });
    expect(hex).toBe(ref(data));
    expect(progress.at(-1)).toBe(size);
    expect(progress.length).toBeGreaterThan(10);
  }, 60_000);

  it('cancela de verdade', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(sha256OfBlob(new Blob(['x']), { signal: ctrl.signal })).rejects.toBeInstanceOf(CancelledError);
  });
});
