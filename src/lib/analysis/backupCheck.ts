/**
 * Verificador de backup: compara a pasta original com a cópia, arquivo por
 * arquivo, pelo caminho relativo e pelo conteúdo (SHA-256). Responde à lição
 * mais repetida nos casos reais (Pixar, GitLab, Kyoto): backup que ninguém
 * conferiu não é backup.
 */
export interface SideFile {
  /** Caminho relativo à pasta escolhida (sem o nome da própria pasta). */
  path: string;
  size: number;
  sha256?: string;
}

export type Verdict = 'igual' | 'diferente' | 'faltando' | 'extra';

export interface CompareRow {
  path: string;
  verdict: Verdict;
  origSize?: number;
  copySize?: number;
  /** Motivo legível, quando não é igual. */
  why?: string;
}

export interface CompareResult {
  rows: CompareRow[];
  counts: Record<Verdict, number>;
  /** A cópia contém todos os arquivos da origem, com o mesmo conteúdo. */
  trustworthy: boolean;
}

/** "Fotos/2024/a.jpg" escolhido como pasta "Fotos" → "2024/a.jpg". */
export function relativePath(webkitRelativePath: string, name: string): string {
  const p = (webkitRelativePath || name).replace(/\\/g, '/');
  const i = p.indexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

/** Arquivos que precisam de hash: estão nos dois lados com o mesmo tamanho. */
export function needsHash(orig: SideFile[], copy: SideFile[]): string[] {
  const c = new Map(copy.map((f) => [f.path, f]));
  return orig.filter((f) => c.get(f.path)?.size === f.size).map((f) => f.path);
}

export function compareSets(orig: SideFile[], copy: SideFile[]): CompareResult {
  const o = new Map(orig.map((f) => [f.path, f]));
  const c = new Map(copy.map((f) => [f.path, f]));
  const rows: CompareRow[] = [];
  for (const f of orig) {
    const g = c.get(f.path);
    if (!g) rows.push({ path: f.path, verdict: 'faltando', origSize: f.size, why: 'Não existe na cópia' });
    else if (g.size !== f.size) rows.push({ path: f.path, verdict: 'diferente', origSize: f.size, copySize: g.size, why: 'Tamanho diferente' });
    else if (f.sha256 && g.sha256 && f.sha256 !== g.sha256) rows.push({ path: f.path, verdict: 'diferente', origSize: f.size, copySize: g.size, why: 'Mesmo tamanho, conteúdo diferente (SHA-256)' });
    else if (!f.sha256 || !g.sha256) rows.push({ path: f.path, verdict: 'diferente', origSize: f.size, copySize: g.size, why: 'Não foi possível ler para comparar' });
    else rows.push({ path: f.path, verdict: 'igual', origSize: f.size, copySize: g.size });
  }
  for (const g of copy) if (!o.has(g.path)) rows.push({ path: g.path, verdict: 'extra', copySize: g.size, why: 'Só existe na cópia' });
  const counts: Record<Verdict, number> = { igual: 0, diferente: 0, faltando: 0, extra: 0 };
  for (const r of rows) counts[r.verdict]++;
  const order: Record<Verdict, number> = { faltando: 0, diferente: 1, extra: 2, igual: 3 };
  rows.sort((a, b) => order[a.verdict] - order[b.verdict] || a.path.localeCompare(b.path));
  return { rows, counts, trustworthy: orig.length > 0 && counts.faltando === 0 && counts.diferente === 0 };
}
