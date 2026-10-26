import { CATEGORY_LABEL, type FileEntry } from './types';

export type OrganizeCriterion = 'categoria' | 'extensao' | 'categoria-ano' | 'ano-mes' | 'tamanho';

export const CRITERION_LABEL: Record<OrganizeCriterion, string> = {
  categoria: 'Por categoria',
  extensao: 'Por categoria e extensão',
  'categoria-ano': 'Por categoria e ano',
  'ano-mes': 'Por data (ano/mês)',
  tamanho: 'Por faixa de tamanho',
};

export interface PlannedOperation {
  fileId: string;
  from: string;
  to: string;
  folder: string;
  size: number;
  /** true quando o nome foi ajustado para não sobrescrever outro arquivo. */
  renamed: boolean;
}

export interface FolderPlan {
  folder: string;
  count: number;
  bytes: number;
}

export interface OrganizationPlan {
  criterion: OrganizeCriterion;
  createdAt: number;
  folders: FolderPlan[];
  operations: PlannedOperation[];
  totalFiles: number;
  totalBytes: number;
  conflicts: number;
}

const MONTHS = ['01-jan', '02-fev', '03-mar', '04-abr', '05-mai', '06-jun', '07-jul', '08-ago', '09-set', '10-out', '11-nov', '12-dez'];

function sizeBand(size: number): string {
  const MB = 1024 * 1024;
  if (size < MB) return 'Pequenos (até 1 MB)';
  if (size < 100 * MB) return 'Médios (1 a 100 MB)';
  if (size < 1024 * MB) return 'Grandes (100 MB a 1 GB)';
  return 'Enormes (acima de 1 GB)';
}

export function folderFor(f: FileEntry, c: OrganizeCriterion): string {
  const cat = CATEGORY_LABEL[f.category];
  const d = new Date(f.lastModified);
  switch (c) {
    case 'categoria':
      return cat;
    case 'extensao':
      return `${cat}/${(f.ext || 'sem-extensao').toUpperCase()}`;
    case 'categoria-ano':
      return `${cat}/${f.lastModified ? d.getFullYear() : 'sem-data'}`;
    case 'ano-mes':
      return f.lastModified ? `${d.getFullYear()}/${MONTHS[d.getMonth()]}` : 'sem-data';
    case 'tamanho':
      return sizeBand(f.size);
  }
}

function withSuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

/** Gera o plano. Não toca em nenhum arquivo: é só uma proposta revisável. */
export function planOrganization(files: FileEntry[], criterion: OrganizeCriterion, now = Date.now()): OrganizationPlan {
  const taken = new Set<string>();
  const folders = new Map<string, FolderPlan>();
  const operations: PlannedOperation[] = [];
  let conflicts = 0;
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
  for (const f of sorted) {
    const folder = folderFor(f, criterion);
    let name = f.name;
    let n = 2;
    let renamed = false;
    while (taken.has(`${folder}/${name}`.toLowerCase())) {
      name = withSuffix(f.name, n++);
      renamed = true;
    }
    if (renamed) conflicts++;
    taken.add(`${folder}/${name}`.toLowerCase());
    operations.push({ fileId: f.id, from: f.path || f.name, to: `${folder}/${name}`, folder, size: f.size, renamed });
    const fp = folders.get(folder) ?? { folder, count: 0, bytes: 0 };
    fp.count++;
    fp.bytes += f.size;
    folders.set(folder, fp);
  }
  return {
    criterion,
    createdAt: now,
    folders: [...folders.values()].sort((a, b) => a.folder.localeCompare(b.folder, 'pt-BR')),
    operations,
    totalFiles: files.length,
    totalBytes: files.reduce((s, f) => s + f.size, 0),
    conflicts,
  };
}

/** Texto de instruções para quem vai organizar manualmente (ex.: no gerenciador de arquivos do Android). */
export function planToInstructions(plan: OrganizationPlan): string {
  const lines = [
    'USB Intelligence — plano de organização',
    `Gerado em ${new Date(plan.createdAt).toLocaleString('pt-BR')}`,
    `Critério: ${plan.criterion}`,
    `${plan.totalFiles} arquivos, ${plan.folders.length} pastas propostas.`,
    'Nenhum arquivo foi movido pelo aplicativo. Siga os passos abaixo se quiser aplicar.',
    '',
  ];
  for (const fp of plan.folders) {
    lines.push(`[${fp.folder}]  (${fp.count} arquivos)`);
    for (const op of plan.operations.filter((o) => o.folder === fp.folder)) {
      lines.push(`  mover  ${op.from}  →  ${op.to}${op.renamed ? '  (renomeado para evitar conflito)' : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
