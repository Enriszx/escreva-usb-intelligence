import type { IncomingFile } from '../../features/files/store';

/** Lê o que foi solto na página, incluindo pastas quando o navegador expõe entradas. */
export async function filesFromDrop(dt: DataTransfer): Promise<IncomingFile[]> {
  const items = [...dt.items].filter((i) => i.kind === 'file');
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null);
  if (entries.some((e) => e?.isDirectory)) {
    const out: IncomingFile[] = [];
    for (const e of entries) if (e) await walk(e, '', out);
    return out;
  }
  return [...dt.files].map((file) => ({ file }));
}

async function walk(entry: FileSystemEntry, prefix: string, out: IncomingFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, path: `${prefix}${file.name}` });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries devolve em lotes; precisa repetir até vir vazio.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    for (const child of batch) await walk(child, `${prefix}${entry.name}/`, out);
  }
}

export function supportsFolderInput(): boolean {
  const i = document.createElement('input');
  return 'webkitdirectory' in i;
}

export function supportsDirectoryWrite(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function' && window.isSecureContext;
}
