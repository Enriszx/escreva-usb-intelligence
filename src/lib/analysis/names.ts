import type { FileEntry, NameGroup } from './types';

/**
 * Normaliza nomes para achar "a mesma coisa salva duas vezes":
 * remove acentos, caixa, sufixos de cópia ("(1)", "- Cópia", "copy", "_2").
 */
export function normalizeName(name: string): string {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  let stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  stem = stem
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)$/, '')
    .replace(/\s*[-_ ]\s*(copia|copy|c[oó]pia)(\s*\d+)?$/i, '')
    .replace(/[-_ ]\d{1,2}$/, '')
    .replace(/[\s_\-.]+/g, ' ')
    .trim();
  return ext ? `${stem}.${ext}` : stem;
}

function contentVerdict(files: FileEntry[]): boolean | null {
  if (files.some((f) => !f.sha256)) return null;
  return files.every((f) => f.sha256 === files[0].sha256 && f.size === files[0].size);
}

/** Grupos de nomes repetidos. Diz se o conteúdo também é igual, quando sabe. */
export function findNameGroups(files: FileEntry[]): NameGroup[] {
  const exact = new Map<string, FileEntry[]>();
  for (const f of files) {
    const k = f.name.toLowerCase();
    exact.set(k, [...(exact.get(k) ?? []), f]);
  }
  const groups: NameGroup[] = [];
  const inExact = new Set<string>();
  for (const [key, list] of exact) {
    if (list.length < 2) continue;
    list.forEach((f) => inExact.add(f.id));
    groups.push({ key, kind: 'identico', files: list, sameContent: contentVerdict(list) });
  }
  const similar = new Map<string, FileEntry[]>();
  for (const f of files) {
    const k = normalizeName(f.name);
    similar.set(k, [...(similar.get(k) ?? []), f]);
  }
  for (const [key, list] of similar) {
    if (list.length < 2) continue;
    // Só vira "semelhante" se não for apenas o mesmo grupo de nomes idênticos.
    const names = new Set(list.map((f) => f.name.toLowerCase()));
    if (names.size < 2) continue;
    groups.push({ key, kind: 'semelhante', files: list, sameContent: contentVerdict(list) });
  }
  return groups.sort((a, b) => b.files.length - a.files.length);
}
