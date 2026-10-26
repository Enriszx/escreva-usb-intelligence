import type { DuplicateGroup, DuplicateResult, FileEntry } from './types';

/**
 * Etapa 1: agrupa por tamanho. Arquivos de tamanho único não podem ter
 * conteúdo idêntico a nenhum outro, então não precisam ser lidos.
 */
export function sizeCandidates(files: FileEntry[]): FileEntry[] {
  const bySize = new Map<number, FileEntry[]>();
  for (const f of files) {
    const list = bySize.get(f.size);
    if (list) list.push(f);
    else bySize.set(f.size, [f]);
  }
  const out: FileEntry[] = [];
  for (const list of bySize.values()) if (list.length > 1) out.push(...list);
  return out;
}

/**
 * Etapa 2: agrupa candidatos pelo SHA-256 já calculado. Nome nunca entra
 * na comparação. Cada arquivo aparece em no máximo um grupo, e o espaço
 * recuperável conta (n - 1) cópias por grupo — nunca o original.
 */
export function findDuplicates(files: FileEntry[]): DuplicateResult {
  const candidates = sizeCandidates(files);
  const byHash = new Map<string, FileEntry[]>();
  const unresolved: FileEntry[] = [];
  for (const f of candidates) {
    if (!f.sha256) {
      unresolved.push(f);
      continue;
    }
    const key = `${f.size}:${f.sha256}`;
    const list = byHash.get(key);
    if (list) list.push(f);
    else byHash.set(key, [f]);
  }
  const groups: DuplicateGroup[] = [];
  for (const list of byHash.values()) {
    if (list.length < 2) continue;
    const size = list[0].size;
    groups.push({ sha256: list[0].sha256!, size, files: list, recoverable: size * (list.length - 1) });
  }
  groups.sort((a, b) => b.recoverable - a.recoverable);
  return {
    groups,
    recoverable: groups.reduce((s, g) => s + g.recoverable, 0),
    candidates: candidates.length,
    uniqueBySize: files.length - candidates.length,
    unresolved,
  };
}
