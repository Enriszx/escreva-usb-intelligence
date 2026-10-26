import { categorize, extensionOf } from '../src/lib/analysis/categories';
import type { FileEntry } from '../src/lib/analysis/types';

let n = 0;
export function entry(name: string, content: string | Uint8Array, extra: Partial<FileEntry> = {}): { entry: FileEntry; blob: Blob } {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const blob = new Blob([bytes]);
  return {
    blob,
    entry: {
      id: `f${n++}`, name, path: extra.path ?? name, ext: extensionOf(name), mime: '', size: bytes.length,
      lastModified: extra.lastModified ?? Date.UTC(2024, 4, 10), category: categorize(name), ...extra,
    },
  };
}
