/**
 * Contrato comum para "pasta conectada": qualquer lugar onde o app pode
 * listar, renomear, mover e apagar arquivos de verdade.
 *  - web:     File System Access API (Chrome/Edge no computador)
 *  - android: plugin nativo com Storage Access Framework (app instalado)
 * Todos os caminhos são relativos à raiz conectada, separados por "/".
 */
export interface ScannedFile {
  path: string;
  name: string;
  size: number;
  lastModified: number;
  mime: string;
  /** Na web, o File já vem da varredura (leitura preguiçosa, não carrega o conteúdo). */
  file?: File;
}

export interface TrashItem {
  id: string;
  original: string;
  stored: string;
  at: number;
  size: number;
}

export interface FolderBackend {
  readonly kind: 'web' | 'android';
  readonly rootName: string;
  /** Pede (de novo) permissão de leitura e escrita. Exige gesto do usuário em alguns navegadores. */
  ensurePermission(): Promise<boolean>;
  scan(opts?: { signal?: AbortSignal; onProgress?: (found: number) => void }): Promise<ScannedFile[]>;
  /** Conteúdo atual do arquivo, para hash. */
  getBlob(path: string): Promise<Blob>;
  /** Hash calculado no próprio backend (Android faz no nativo). Opcional. */
  sha256?(path: string, onProgress?: (bytes: number) => void): Promise<string>;
  rename(path: string, newName: string): Promise<string>;
  move(path: string, destDir: string, newName?: string): Promise<string>;
  mkdir(path: string): Promise<void>;
  /** Move para a lixeira do USB Intelligence, dentro da própria pasta conectada. */
  trash(path: string): Promise<TrashItem>;
  /** Apaga de verdade. Não volta. */
  remove(path: string): Promise<void>;
  listTrash(): Promise<TrashItem[]>;
  restore(item: TrashItem): Promise<string>;
  purge(item: TrashItem): Promise<void>;
}

export const TRASH_DIR = '.usbi-lixeira';
export const TRASH_MANIFEST = 'manifesto.json';

export class FsOpError extends Error {
  constructor(public code: 'conflito' | 'nome' | 'permissao' | 'ausente' | 'falha', message: string) {
    super(message);
    this.name = 'FsOpError';
  }
}

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

/**
 * Valida um nome de arquivo pensando no pior caso: pendrive em FAT32/exFAT
 * lido no Windows e no Android. Devolve a mensagem de erro ou null.
 */
export function validateName(name: string): string | null {
  if (!name || !name.trim()) return 'O nome não pode ficar vazio.';
  if (name !== name.trim()) return 'O nome não pode começar nem terminar com espaço.';
  if (name === '.' || name === '..') return 'Nome reservado.';
  if (FORBIDDEN.test(name)) return 'Não use / \\ : * ? " < > | no nome.';
  if (name.endsWith('.')) return 'O nome não pode terminar com ponto (o Windows e o FAT32 recusam).';
  if (RESERVED.test(name)) return 'Este nome é reservado pelo Windows.';
  if (new TextEncoder().encode(name).length > 255) return 'Nome longo demais (máximo de 255 bytes).';
  if (name === TRASH_DIR) return 'Este nome é usado pela lixeira do USB Intelligence.';
  return null;
}

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/');
  return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i), name: path.slice(i + 1) };
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** Normaliza e valida um caminho de pasta digitado pelo usuário ("Fotos/2024"). */
export function normalizeDir(input: string): { ok: true; dir: string } | { ok: false; error: string } {
  const parts = input.split('/').map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const err = validateName(p);
    if (err) return { ok: false, error: `“${p}”: ${err}` };
  }
  return { ok: true, dir: parts.join('/') };
}

/** Sugere "nome (2).ext" quando o destino já existe. */
export function withSuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

export function newTrashId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Lixeira genérica sobre primitivas de arquivo. Os itens vão para
 * .usbi-lixeira/<id>/<nome> e um manifesto JSON guarda o caminho original,
 * então a lixeira funciona igual no navegador e no Android — e viaja no pendrive.
 */
export abstract class TrashingBackend {
  abstract move(path: string, destDir: string, newName?: string): Promise<string>;
  abstract remove(path: string): Promise<void>;
  abstract getSize(path: string): Promise<number>;
  protected abstract readText(path: string): Promise<string | null>;
  protected abstract writeText(path: string, text: string): Promise<void>;
  protected abstract exists(path: string): Promise<boolean>;
  protected abstract removeDir(path: string): Promise<void>;

  private get manifestPath() {
    return `${TRASH_DIR}/${TRASH_MANIFEST}`;
  }

  private async readManifest(): Promise<TrashItem[]> {
    try {
      const t = await this.readText(this.manifestPath);
      const data = t ? JSON.parse(t) : null;
      return Array.isArray(data?.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  private async writeManifest(items: TrashItem[]) {
    await this.writeText(this.manifestPath, JSON.stringify({ app: 'usb-intelligence', tipo: 'lixeira', versao: 1, items }, null, 1));
  }

  async trash(path: string): Promise<TrashItem> {
    const id = newTrashId();
    const { name } = splitPath(path);
    const size = await this.getSize(path);
    const stored = await this.move(path, `${TRASH_DIR}/${id}`, name);
    const item: TrashItem = { id, original: path, stored, at: Date.now(), size };
    await this.writeManifest([...(await this.readManifest()), item]);
    return item;
  }

  async listTrash(): Promise<TrashItem[]> {
    return (await this.readManifest()).sort((a, b) => b.at - a.at);
  }

  async restore(item: TrashItem): Promise<string> {
    const { dir, name } = splitPath(item.original);
    let target = name;
    for (let n = 2; await this.exists(joinPath(dir, target)); n++) target = withSuffix(name, n);
    const restored = await this.move(item.stored, dir, target);
    await this.dropFromTrash(item);
    return restored;
  }

  async purge(item: TrashItem): Promise<void> {
    await this.remove(item.stored).catch((e: FsOpError) => {
      if (e.code !== 'ausente') throw e;
    });
    await this.dropFromTrash(item);
  }

  private async dropFromTrash(item: TrashItem) {
    await this.writeManifest((await this.readManifest()).filter((i) => i.id !== item.id));
    await this.removeDir(`${TRASH_DIR}/${item.id}`).catch(() => {});
  }
}
