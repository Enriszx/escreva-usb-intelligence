import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { FsOpError, TrashingBackend, joinPath, splitPath, validateName, type FolderBackend, type ScannedFile } from './backend';

/**
 * Ponte para o plugin nativo UsbiFiles (android/app/src/main/java/.../UsbiFilesPlugin.java).
 * Ele usa o Storage Access Framework: o usuário escolhe uma pasta (inclusive a
 * raiz do pendrive OTG) e o Android concede acesso persistente só a ela.
 */
interface UsbiFilesPlugin {
  pickFolder(): Promise<{ uri: string; name: string }>;
  checkAccess(o: { uri: string }): Promise<{ granted: boolean; name: string }>;
  list(o: { uri: string; skip: string }): Promise<{ files: ScannedFile[] }>;
  sha256(o: { uri: string; path: string }): Promise<{ hash: string }>;
  rename(o: { uri: string; path: string; newName: string }): Promise<{ path: string }>;
  move(o: { uri: string; path: string; destDir: string; newName: string }): Promise<{ path: string }>;
  mkdir(o: { uri: string; path: string }): Promise<void>;
  remove(o: { uri: string; path: string; recursive?: boolean }): Promise<void>;
  exists(o: { uri: string; path: string }): Promise<{ exists: boolean; size: number }>;
  readText(o: { uri: string; path: string }): Promise<{ text: string | null }>;
  writeText(o: { uri: string; path: string; text: string }): Promise<void>;
  addListener(event: 'hashProgress', fn: (e: { path: string; bytes: number }) => void): Promise<PluginListenerHandle>;
}

const UsbiFiles = registerPlugin<UsbiFilesPlugin>('UsbiFiles');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Erros do nativo chegam com um código no começo da mensagem: "conflito: ...". */
function wrap(e: unknown): FsOpError {
  const msg = (e as Error)?.message ?? String(e);
  const m = /^(conflito|nome|permissao|ausente|falha):\s*(.*)$/s.exec(msg);
  return m ? new FsOpError(m[1] as FsOpError['code'], m[2]) : new FsOpError('falha', msg);
}

async function call<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw wrap(e);
  }
}

export class AndroidFolderBackend extends TrashingBackend implements FolderBackend {
  readonly kind = 'android' as const;
  constructor(private uri: string, readonly rootName: string) {
    super();
  }

  async ensurePermission(): Promise<boolean> {
    return (await UsbiFiles.checkAccess({ uri: this.uri })).granted;
  }

  async scan(): Promise<ScannedFile[]> {
    return (await call(UsbiFiles.list({ uri: this.uri, skip: '.usbi-lixeira' }))).files;
  }

  async getBlob(): Promise<Blob> {
    // O conteúdo não atravessa a ponte: hash e cópias acontecem no nativo.
    throw new FsOpError('falha', 'No app Android o conteúdo é processado no nativo.');
  }

  async sha256(path: string, onProgress?: (bytes: number) => void): Promise<string> {
    const sub = onProgress ? await UsbiFiles.addListener('hashProgress', (e) => e.path === path && onProgress(e.bytes)) : null;
    try {
      return (await call(UsbiFiles.sha256({ uri: this.uri, path }))).hash;
    } finally {
      await sub?.remove();
    }
  }

  async rename(path: string, newName: string): Promise<string> {
    const err = validateName(newName);
    if (err) throw new FsOpError('nome', err);
    return (await call(UsbiFiles.rename({ uri: this.uri, path, newName }))).path;
  }

  async move(path: string, destDir: string, newName?: string): Promise<string> {
    const name = newName ?? splitPath(path).name;
    const err = validateName(name);
    if (err) throw new FsOpError('nome', err);
    if (joinPath(destDir, name) === path) return path;
    return (await call(UsbiFiles.move({ uri: this.uri, path, destDir, newName: name }))).path;
  }

  async mkdir(path: string): Promise<void> {
    for (const seg of path.split('/').filter(Boolean)) {
      const err = validateName(seg);
      if (err) throw new FsOpError('nome', err);
    }
    await call(UsbiFiles.mkdir({ uri: this.uri, path }));
  }

  async remove(path: string): Promise<void> {
    await call(UsbiFiles.remove({ uri: this.uri, path }));
  }

  async getSize(path: string): Promise<number> {
    return (await call(UsbiFiles.exists({ uri: this.uri, path }))).size;
  }

  protected async readText(path: string): Promise<string | null> {
    return (await call(UsbiFiles.readText({ uri: this.uri, path }))).text;
  }

  protected async writeText(path: string, text: string): Promise<void> {
    await call(UsbiFiles.writeText({ uri: this.uri, path, text }));
  }

  protected async exists(path: string): Promise<boolean> {
    return (await call(UsbiFiles.exists({ uri: this.uri, path }))).exists;
  }

  protected async removeDir(path: string): Promise<void> {
    await call(UsbiFiles.remove({ uri: this.uri, path, recursive: true }));
  }
}

export async function pickAndroidFolder(): Promise<{ backend: AndroidFolderBackend; uri: string }> {
  const { uri, name } = await call(UsbiFiles.pickFolder());
  return { backend: new AndroidFolderBackend(uri, name), uri };
}

export async function restoreAndroidFolder(uri: string, name: string): Promise<AndroidFolderBackend> {
  const r = await call(UsbiFiles.checkAccess({ uri }));
  if (!r.granted) throw new FsOpError('permissao', 'O Android não mantém mais o acesso a esta pasta (o pendrive foi removido?).');
  return new AndroidFolderBackend(uri, r.name || name);
}
