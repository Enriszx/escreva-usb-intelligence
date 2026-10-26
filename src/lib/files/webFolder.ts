import { IS_ARTIFACT } from '../platform';
import {
  FsOpError, TRASH_DIR, TrashingBackend, joinPath, splitPath, validateName,
  type FolderBackend, type ScannedFile,
} from './backend';

/* Tipos da File System Access API que o lib.dom do TypeScript ainda não traz por completo. */
type Perm = { mode: 'read' | 'readwrite' };
export interface DirHandle extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  queryPermission?(p: Perm): Promise<PermissionState>;
  requestPermission?(p: Perm): Promise<PermissionState>;
}
interface FileHandle extends FileSystemFileHandle {
  move?(dest: FileSystemDirectoryHandle, name?: string): Promise<void>;
  move?(name: string): Promise<void>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export function supportsFolderAccess(): boolean {
  if (IS_ARTIFACT) return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function' && window.isSecureContext;
}

export async function pickFolder(): Promise<DirHandle> {
  const w = window as unknown as { showDirectoryPicker: (o: unknown) => Promise<DirHandle> };
  return w.showDirectoryPicker({ mode: 'readwrite', id: 'usbi-pasta' });
}

function translate(e: unknown, path: string): FsOpError {
  if (e instanceof FsOpError) return e;
  const name = (e as DOMException)?.name;
  if (name === 'NotFoundError') return new FsOpError('ausente', `“${path}” não existe mais (foi movido ou apagado fora do app?).`);
  if (name === 'NotAllowedError' || name === 'SecurityError') return new FsOpError('permissao', 'O navegador negou a permissão de escrita nesta pasta.');
  if (name === 'InvalidModificationError') return new FsOpError('conflito', `Já existe um item com esse nome em “${path}”.`);
  if (name === 'NoModificationAllowedError') return new FsOpError('permissao', `“${path}” está bloqueado (somente leitura ou em uso por outro programa).`);
  if (name === 'QuotaExceededError') return new FsOpError('falha', 'Sem espaço no destino.');
  return new FsOpError('falha', (e as Error)?.message || 'Falha desconhecida no sistema de arquivos.');
}

export class WebFolderBackend extends TrashingBackend implements FolderBackend {
  readonly kind = 'web' as const;
  constructor(private root: DirHandle) {
    super();
  }
  get rootName() {
    return this.root.name;
  }
  get handle() {
    return this.root;
  }

  async ensurePermission(): Promise<boolean> {
    const p: Perm = { mode: 'readwrite' };
    if (!this.root.queryPermission) return true;
    if ((await this.root.queryPermission(p)) === 'granted') return true;
    return (await this.root.requestPermission?.(p)) === 'granted';
  }

  private async dir(path: string, create = false): Promise<DirHandle> {
    let d = this.root;
    for (const seg of path.split('/').filter(Boolean)) d = (await d.getDirectoryHandle(seg, { create })) as DirHandle;
    return d;
  }

  private async fileHandle(path: string): Promise<{ parent: DirHandle; handle: FileHandle; name: string }> {
    const { dir, name } = splitPath(path);
    const parent = await this.dir(dir);
    return { parent, handle: (await parent.getFileHandle(name)) as FileHandle, name };
  }

  private async hasEntry(dir: DirHandle, name: string): Promise<boolean> {
    try {
      await dir.getFileHandle(name);
      return true;
    } catch {
      try {
        await dir.getDirectoryHandle(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  async scan(opts: { signal?: AbortSignal; onProgress?: (n: number) => void } = {}): Promise<ScannedFile[]> {
    const out: ScannedFile[] = [];
    const walk = async (d: DirHandle, prefix: string) => {
      for await (const [name, h] of d.entries()) {
        if (opts.signal?.aborted) throw new DOMException('cancelado', 'AbortError');
        if (!prefix && name === TRASH_DIR) continue;
        if (h.kind === 'directory') await walk(h as DirHandle, joinPath(prefix, name));
        else {
          const f = await (h as FileSystemFileHandle).getFile();
          out.push({ path: joinPath(prefix, name), name, size: f.size, lastModified: f.lastModified, mime: f.type, file: f });
          if (out.length % 25 === 0) opts.onProgress?.(out.length);
        }
      }
    };
    await walk(this.root, '');
    opts.onProgress?.(out.length);
    return out;
  }

  async getBlob(path: string): Promise<Blob> {
    try {
      return await (await this.fileHandle(path)).handle.getFile();
    } catch (e) {
      throw translate(e, path);
    }
  }

  async mkdir(path: string): Promise<void> {
    for (const seg of path.split('/').filter(Boolean)) {
      const err = validateName(seg);
      if (err) throw new FsOpError('nome', err);
    }
    try {
      await this.dir(path, true);
    } catch (e) {
      throw translate(e, path);
    }
  }

  /**
   * Move de verdade. Usa FileSystemHandle.move() quando existe; senão copia,
   * confere o tamanho e só então apaga a origem — nunca apaga antes de
   * ter a cópia completa.
   */
  async move(path: string, destDir: string, newName?: string): Promise<string> {
    const target = newName ?? splitPath(path).name;
    const err = validateName(target);
    if (err) throw new FsOpError('nome', err);
    const destPath = joinPath(destDir, target);
    if (destPath === path) return path;
    try {
      const { parent, handle, name } = await this.fileHandle(path);
      const dest = await this.dir(destDir, true);
      const sameDir = splitPath(path).dir === destDir;
      // Mudança só de maiúsculas/minúsculas é o mesmo arquivo em FAT32/NTFS.
      const caseOnly = sameDir && name.toLowerCase() === target.toLowerCase();
      if (!caseOnly && (await this.hasEntry(dest, target))) throw new FsOpError('conflito', `Já existe “${target}” em “${destDir || this.rootName}”.`);
      if (typeof handle.move === 'function') {
        try {
          if (sameDir) await (handle.move as (n: string) => Promise<void>)(target);
          else await (handle.move as (d: FileSystemDirectoryHandle, n: string) => Promise<void>)(dest, target);
          return destPath;
        } catch (e) {
          // Alguns navegadores só movem dentro do armazenamento privado: cai para cópia.
          if ((e as DOMException).name === 'InvalidModificationError') throw e;
        }
      }
      if (caseOnly) {
        // Sem move nativo, troca de caixa precisa de um nome intermediário.
        const tmp = `${target}.usbi-tmp-${Date.now()}`;
        await this.copyThenRemove(parent, handle, name, dest, tmp);
        const tmpHandle = (await dest.getFileHandle(tmp)) as FileHandle;
        await this.copyThenRemove(dest, tmpHandle, tmp, dest, target);
        return destPath;
      }
      await this.copyThenRemove(parent, handle, name, dest, target);
      return destPath;
    } catch (e) {
      throw translate(e, path);
    }
  }

  private async copyThenRemove(parent: DirHandle, handle: FileHandle, name: string, dest: DirHandle, target: string) {
    const src = await handle.getFile();
    const out = (await dest.getFileHandle(target, { create: true })) as FileHandle;
    const w = await out.createWritable();
    await src.stream().pipeTo(w as unknown as WritableStream<Uint8Array>);
    const copied = await out.getFile();
    if (copied.size !== src.size) {
      await dest.removeEntry(target).catch(() => {});
      throw new FsOpError('falha', `A cópia de “${name}” ficou incompleta; o original foi mantido.`);
    }
    await parent.removeEntry(name);
  }

  async rename(path: string, newName: string): Promise<string> {
    return this.move(path, splitPath(path).dir, newName);
  }

  async remove(path: string): Promise<void> {
    try {
      const { dir, name } = splitPath(path);
      await (await this.dir(dir)).removeEntry(name);
    } catch (e) {
      throw translate(e, path);
    }
  }

  /* ---------- Primitivas usadas pela lixeira (TrashingBackend) ---------- */
  async getSize(path: string): Promise<number> {
    return (await this.getBlob(path)).size;
  }

  protected async readText(path: string): Promise<string | null> {
    try {
      return await (await this.fileHandle(path)).handle.getFile().then((f) => f.text());
    } catch {
      return null;
    }
  }

  protected async writeText(path: string, text: string): Promise<void> {
    const { dir, name } = splitPath(path);
    const d = await this.dir(dir, true);
    const w = await ((await d.getFileHandle(name, { create: true })) as FileHandle).createWritable();
    await w.write(text);
    await w.close();
  }

  protected async exists(path: string): Promise<boolean> {
    const { dir, name } = splitPath(path);
    try {
      return await this.hasEntry(await this.dir(dir), name);
    } catch {
      return false;
    }
  }

  protected async removeDir(path: string): Promise<void> {
    const { dir, name } = splitPath(path);
    await (await this.dir(dir)).removeEntry(name, { recursive: true });
  }
}
