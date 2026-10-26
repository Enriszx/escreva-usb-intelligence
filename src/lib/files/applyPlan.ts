import type { OrganizationPlan } from '../analysis/organize';
import { CancelledError } from '../analysis/hashing';

type DirHandle = FileSystemDirectoryHandle & {
  getDirectoryHandle: (n: string, o?: { create?: boolean }) => Promise<DirHandle>;
  getFileHandle: (n: string, o?: { create?: boolean }) => Promise<FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }>;
  requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export async function pickDestination(): Promise<DirHandle> {
  const w = window as unknown as { showDirectoryPicker: (o: unknown) => Promise<DirHandle> };
  const dir = await w.showDirectoryPicker({ mode: 'readwrite', id: 'usbi-destino' });
  if (dir.requestPermission && (await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    throw new Error('Permissão de escrita negada para a pasta escolhida.');
  }
  return dir;
}

const SAFE_SEGMENT = /^[^/\\:*?"<>|\0]+$/;

/**
 * Cria CÓPIAS organizadas na pasta de destino. Nunca sobrescreve: se o
 * arquivo já existe no destino, ele é pulado e registrado como falha.
 * Nunca apaga nem move os originais (o navegador nem teria acesso a eles).
 */
export async function copyPlan(
  plan: OrganizationPlan,
  dest: DirHandle,
  getFile: (id: string) => File | undefined,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number, bytes: number) => void } = {},
): Promise<{ done: number; failed: string[]; bytes: number }> {
  const failed: string[] = [];
  let done = 0;
  let bytes = 0;
  const dirs = new Map<string, DirHandle>();
  for (const op of plan.operations) {
    if (opts.signal?.aborted) throw new CancelledError();
    const file = getFile(op.fileId);
    if (!file) {
      failed.push(`${op.from}: arquivo não está mais disponível.`);
      continue;
    }
    const parts = op.to.split('/');
    const name = parts.pop()!;
    if (![...parts, name].every((s) => SAFE_SEGMENT.test(s) && s !== '.' && s !== '..')) {
      failed.push(`${op.to}: caminho de destino inválido.`);
      continue;
    }
    try {
      let dir = dest;
      let key = '';
      for (const seg of parts) {
        key += `/${seg}`;
        let next = dirs.get(key);
        if (!next) {
          next = await dir.getDirectoryHandle(seg, { create: true });
          dirs.set(key, next);
        }
        dir = next;
      }
      let exists = true;
      try {
        await dir.getFileHandle(name);
      } catch {
        exists = false;
      }
      if (exists) {
        failed.push(`${op.to}: já existe no destino, não foi sobrescrito.`);
        continue;
      }
      const handle = await dir.getFileHandle(name, { create: true });
      const w = await handle.createWritable();
      await file.stream().pipeTo(w as unknown as WritableStream<Uint8Array>);
      done++;
      bytes += file.size;
    } catch (e) {
      failed.push(`${op.to}: ${(e as Error).message}`);
    }
    opts.onProgress?.(done + failed.length, plan.operations.length, bytes);
  }
  return { done, failed, bytes };
}
