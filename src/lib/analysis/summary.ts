import { CATEGORIES, type FileEntry, type Summary, type ExtensionStat } from './types';

export function summarize(files: FileEntry[]): Summary {
  const cat = new Map(CATEGORIES.map((c) => [c, { category: c, count: 0, bytes: 0 }]));
  const ext = new Map<string, ExtensionStat>();
  let bytes = 0;
  let largest: FileEntry | null = null;
  let hashed = 0;
  let hashErrors = 0;
  for (const f of files) {
    bytes += f.size;
    const c = cat.get(f.category)!;
    c.count++;
    c.bytes += f.size;
    const key = f.ext || '(sem extensão)';
    const e = ext.get(key) ?? { ext: key, count: 0, bytes: 0, category: f.category };
    e.count++;
    e.bytes += f.size;
    ext.set(key, e);
    if (!largest || f.size > largest.size) largest = f;
    if (f.sha256) hashed++;
    if (f.hashError) hashErrors++;
  }
  return {
    count: files.length,
    bytes,
    byCategory: [...cat.values()],
    byExtension: [...ext.values()].sort((a, b) => b.bytes - a.bytes || b.count - a.count),
    largest,
    hashed,
    hashErrors,
  };
}
