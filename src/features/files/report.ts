import { CATEGORY_LABEL, type FileEntry } from '../../lib/analysis/types';
import { summarize } from '../../lib/analysis/summary';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { findNameGroups } from '../../lib/analysis/names';
import type { OrganizationPlan } from '../../lib/analysis/organize';
import { CRITERION_LABEL } from '../../lib/analysis/organize';
import type { Report, ReportFileRow } from '../../lib/storage/repos';

export const SOURCE_NOTE =
  'Calculado neste dispositivo a partir dos arquivos que você selecionou. Tamanhos e datas vêm do sistema de arquivos; o SHA-256 foi calculado lendo o conteúdo de cada arquivo.';

export function fileRows(files: FileEntry[], note?: (f: FileEntry) => string): ReportFileRow[] {
  return files.map((f) => ({
    nome: f.name,
    caminho: f.path,
    categoria: CATEGORY_LABEL[f.category],
    extensao: f.ext,
    bytes: f.size,
    modificado: f.lastModified ? new Date(f.lastModified).toISOString() : '',
    sha256: f.sha256 ?? '',
    observacao: f.hashError ?? note?.(f) ?? '',
  }));
}

export function buildAnalysisReport(
  files: FileEntry[],
  kind: 'completa' | 'duplicados',
  cancelled: boolean,
): Omit<Report, 'id' | 'at'> {
  const s = summarize(files);
  const dup = findDuplicates(files);
  const names = findNameGroups(files);
  const limitations: string[] = [];
  if (cancelled) limitations.push('A análise foi cancelada antes do fim: parte dos arquivos ficou sem hash.');
  if (kind === 'duplicados') limitations.push('Modo rápido: só foram lidos arquivos que dividem o tamanho com outro. Os demais não têm hash.');
  if (s.hashErrors) limitations.push(`${s.hashErrors} arquivo(s) não puderam ser lidos.`);
  if (dup.unresolved.length) limitations.push(`${dup.unresolved.length} candidato(s) a duplicado ficaram sem hash e não foram comparados.`);
  limitations.push('Hash identifica conteúdo idêntico. Não diz se um arquivo está corrompido ou livre de vírus.');
  const dupOf = new Map<string, number>();
  dup.groups.forEach((g, i) => g.files.forEach((f) => dupOf.set(f.id, i + 1)));
  return {
    kind: kind === 'completa' ? 'analise' : 'duplicados',
    title: kind === 'completa' ? `Análise completa de ${s.count} arquivos` : `Busca de duplicados em ${s.count} arquivos`,
    totals: {
      arquivos: s.count,
      bytes: s.bytes,
      comHash: s.hashed,
      errosDeLeitura: s.hashErrors,
      gruposDuplicados: dup.groups.length,
      bytesRecuperaveis: dup.recoverable,
      gruposDeNomeRepetido: names.filter((n) => n.kind === 'identico').length,
      gruposDeNomeSemelhante: names.filter((n) => n.kind === 'semelhante').length,
    },
    byCategory: s.byCategory.filter((c) => c.count).map((c) => ({ category: CATEGORY_LABEL[c.category], count: c.count, bytes: c.bytes })),
    byExtension: s.byExtension.map((e) => ({ ext: e.ext, count: e.count, bytes: e.bytes })),
    duplicateGroups: dup.groups.map((g) => ({ sha256: g.sha256, size: g.size, files: g.files.map((f) => f.path || f.name) })),
    rows: fileRows(files, (f) => (dupOf.has(f.id) ? `Grupo duplicado ${dupOf.get(f.id)}` : '')),
    limitations,
    source: SOURCE_NOTE,
  };
}

export function buildPlanReport(plan: OrganizationPlan, files: FileEntry[], applied: { done: number; failed: string[] } | null): Omit<Report, 'id' | 'at'> {
  const target = new Map(plan.operations.map((o) => [o.fileId, o.to]));
  return {
    kind: 'organizacao',
    title: applied ? `Cópia organizada de ${applied.done} arquivos` : `Plano de organização (${CRITERION_LABEL[plan.criterion]})`,
    totals: {
      arquivos: plan.totalFiles,
      bytes: plan.totalBytes,
      pastas: plan.folders.length,
      conflitosDeNome: plan.conflicts,
      ...(applied ? { copiados: applied.done, falhas: applied.failed.length } : {}),
    },
    folders: plan.folders,
    rows: fileRows(files, (f) => `destino: ${target.get(f.id) ?? ''}`),
    limitations: applied
      ? ['Os originais não foram apagados nem movidos: o app criou cópias organizadas na pasta escolhida.', ...applied.failed]
      : ['Somente um plano: nenhum arquivo foi movido, copiado ou renomeado.'],
    source: SOURCE_NOTE,
  };
}
