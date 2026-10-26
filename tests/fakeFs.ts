/** Sistema de arquivos em memória com a mesma forma da File System Access API. */
type Node = FakeDir | FakeFile;

function notFound() { return Object.assign(new Error('not found'), { name: 'NotFoundError' }); }
function typeMismatch() { return Object.assign(new Error('type'), { name: 'TypeMismatchError' }); }

export class FakeFile {
  kind = 'file' as const;
  data = new Uint8Array();
  mtime = Date.now();
  constructor(public name: string, public parent: FakeDir, private withMove: boolean) {}
  async getFile() { return new File([this.data], this.name, { lastModified: this.mtime }); }
  async createWritable() {
    const chunks: Uint8Array[] = [];
    const self = this;
    const stream = new WritableStream<Uint8Array>({
      write(c) { chunks.push(typeof c === 'string' ? new TextEncoder().encode(c) : new Uint8Array(c)); },
      close() { const n = chunks.reduce((s, c) => s + c.length, 0); const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } self.data = out; },
    });
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    const w = () => (writer ??= stream.getWriter());
    return Object.assign(stream, {
      write: async (c: string | Uint8Array) => { await w().write(typeof c === 'string' ? new TextEncoder().encode(c) : c); },
      close: async () => { await w().close(); },
    }) as unknown as WritableStream & { write: (c: string) => Promise<void>; close: () => Promise<void> };
  }
  get move() {
    if (!this.withMove) return undefined;
    return async (a: FakeDir | string, b?: string) => {
      const dest = typeof a === 'string' ? this.parent : a;
      const name = typeof a === 'string' ? a : (b ?? this.name);
      if (dest.children.has(name) && dest.children.get(name) !== this) throw Object.assign(new Error('exists'), { name: 'InvalidModificationError' });
      this.parent.children.delete(this.name);
      this.name = name;
      this.parent = dest;
      dest.children.set(name, this);
    };
  }
}

export class FakeDir {
  kind = 'directory' as const;
  children = new Map<string, Node>();
  constructor(public name: string, public withMove = true) {}
  async getDirectoryHandle(n: string, o?: { create?: boolean }) {
    const c = this.children.get(n);
    if (c) { if (c.kind !== 'directory') throw typeMismatch(); return c; }
    if (!o?.create) throw notFound();
    const d = new FakeDir(n, this.withMove);
    this.children.set(n, d);
    return d;
  }
  async getFileHandle(n: string, o?: { create?: boolean }) {
    const c = this.children.get(n);
    if (c) { if (c.kind !== 'file') throw typeMismatch(); return c; }
    if (!o?.create) throw notFound();
    const f = new FakeFile(n, this, this.withMove);
    this.children.set(n, f);
    return f;
  }
  async removeEntry(n: string, o?: { recursive?: boolean }) {
    const c = this.children.get(n);
    if (!c) throw notFound();
    if (c.kind === 'directory' && c.children.size && !o?.recursive) throw Object.assign(new Error('not empty'), { name: 'InvalidModificationError' });
    this.children.delete(n);
  }
  async *entries(): AsyncIterableIterator<[string, Node]> { for (const e of [...this.children]) yield e; }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  /** utilitário de teste */
  put(path: string, text: string) {
    const parts = path.split('/');
    let d: FakeDir = this;
    for (const p of parts.slice(0, -1)) {
      let c = d.children.get(p) as FakeDir | undefined;
      if (!c) { c = new FakeDir(p, this.withMove); d.children.set(p, c); }
      d = c;
    }
    const f = new FakeFile(parts.at(-1)!, d, this.withMove);
    f.data = new TextEncoder().encode(text);
    d.children.set(f.name, f);
  }
  tree(prefix = ''): string[] {
    return [...this.children.values()].flatMap((c) => c.kind === 'directory' ? c.tree(`${prefix}${c.name}/`) : [`${prefix}${c.name}`]).sort();
  }
}
