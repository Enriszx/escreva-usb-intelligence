// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { categorize, extensionOf } from '../src/lib/analysis/categories';
import { summarize } from '../src/lib/analysis/summary';
import { findDuplicates, sizeCandidates } from '../src/lib/analysis/duplicates';
import { findNameGroups, normalizeName } from '../src/lib/analysis/names';
import { planOrganization, planToInstructions } from '../src/lib/analysis/organize';
import { sha256OfBlob } from '../src/lib/analysis/hashing';
import { entry } from './helpers';

async function hashed(list: ReturnType<typeof entry>[]) {
  for (const x of list) x.entry.sha256 = await sha256OfBlob(x.blob);
  return list.map((x) => x.entry);
}

describe('categorias', () => {
  it('extensão e categoria', () => {
    expect(extensionOf('Foto.JPG')).toBe('jpg');
    expect(extensionOf('.bashrc')).toBe('');
    expect(extensionOf('arquivo.')).toBe('');
    expect(extensionOf('a.tar.gz')).toBe('gz');
    expect(categorize('nota.pdf')).toBe('documentos');
    expect(categorize('musica.flac')).toBe('audios');
    expect(categorize('clip.mkv')).toBe('videos');
    expect(categorize('pacote.7z')).toBe('compactados');
    expect(categorize('semext', 'image/png')).toBe('imagens');
    expect(categorize('x.qqq')).toBe('outros');
  });
});

describe('resumo', () => {
  it('soma tamanhos e quantidades exatamente', () => {
    const files = [entry('a.pdf', 'aaaa'), entry('b.png', 'bb'), entry('c.png', 'cccccc'), entry('d', '')].map((x) => x.entry);
    const s = summarize(files);
    expect(s.count).toBe(4);
    expect(s.bytes).toBe(12);
    expect(s.byCategory.find((c) => c.category === 'imagens')).toEqual({ category: 'imagens', count: 2, bytes: 8 });
    expect(s.byCategory.reduce((a, c) => a + c.bytes, 0)).toBe(12);
    expect(s.byExtension[0]).toMatchObject({ ext: 'png', count: 2, bytes: 8 });
    expect(s.largest?.name).toBe('c.png');
  });
});

describe('duplicados', () => {
  it('diferencia nome igual de conteúdo igual', async () => {
    const files = await hashed([
      entry('relatorio.pdf', 'conteudo-A', { path: 'pasta1/relatorio.pdf' }),
      entry('relatorio.pdf', 'conteudo-B', { path: 'pasta2/relatorio.pdf' }), // mesmo nome e tamanho, conteúdo diferente
      entry('foto.jpg', 'imagem-123'),
      entry('outro-nome.jpg', 'imagem-123'), // nomes diferentes, conteúdo idêntico
      entry('unico.txt', 'tamanho-unico-aqui'),
    ]);
    const dup = findDuplicates(files);
    expect(dup.groups).toHaveLength(1);
    expect(dup.groups[0].files.map((f) => f.name).sort()).toEqual(['foto.jpg', 'outro-nome.jpg']);
    expect(dup.recoverable).toBe(10);
    expect(dup.uniqueBySize).toBe(1);

    const names = findNameGroups(files);
    const rel = names.find((g) => g.key === 'relatorio.pdf');
    expect(rel?.kind).toBe('identico');
    expect(rel?.sameContent).toBe(false);
  });

  it('espaço recuperável não conta o original nem duas vezes', async () => {
    const files = await hashed([entry('1.bin', 'xxxxx'), entry('2.bin', 'xxxxx'), entry('3.bin', 'xxxxx'), entry('4.bin', 'yyyyy'), entry('5.bin', 'yyyyy')]);
    const dup = findDuplicates(files);
    expect(dup.groups).toHaveLength(2);
    expect(dup.recoverable).toBe(5 * 2 + 5 * 1);
  });

  it('só pede hash de quem divide tamanho', () => {
    const files = [entry('a', '1'), entry('b', '22'), entry('c', '33')].map((x) => x.entry);
    expect(sizeCandidates(files).map((f) => f.name)).toEqual(['b', 'c']);
  });

  it('sem hash, candidatos ficam como não resolvidos (não viram duplicados)', () => {
    const files = [entry('a', '11'), entry('b', '22')].map((x) => x.entry);
    const dup = findDuplicates(files);
    expect(dup.groups).toHaveLength(0);
    expect(dup.unresolved).toHaveLength(2);
  });
});

describe('nomes', () => {
  it('normaliza sufixos de cópia e acentos', () => {
    expect(normalizeName('Relatório (1).pdf')).toBe('relatorio.pdf');
    expect(normalizeName('relatorio - Cópia.PDF')).toBe('relatorio.pdf');
    expect(normalizeName('foto_copy.jpg')).toBe('foto.jpg');
  });
});

describe('organização', () => {
  it('propõe pastas, resolve conflitos e não perde arquivos', () => {
    const files = [
      entry('a.pdf', '1', { path: 'x/a.pdf' }), entry('a.pdf', '22', { path: 'y/a.pdf' }), entry('b.png', '333'), entry('c.mp3', '4444'),
    ].map((x) => x.entry);
    const plan = planOrganization(files, 'categoria', 0);
    expect(plan.totalFiles).toBe(4);
    expect(plan.totalBytes).toBe(10);
    expect(plan.operations).toHaveLength(4);
    expect(plan.conflicts).toBe(1);
    const targets = plan.operations.map((o) => o.to);
    expect(new Set(targets.map((t) => t.toLowerCase())).size).toBe(4);
    expect(targets).toContain('Documentos/a (2).pdf');
    expect(plan.folders.map((f) => f.folder)).toEqual(['Áudios', 'Documentos', 'Imagens']);
    expect(planToInstructions(plan)).toContain('Nenhum arquivo foi movido');
  });

  it('critério por extensão e por data', () => {
    const files = [entry('a.pdf', '1', { lastModified: new Date(2023, 2, 5).getTime() })].map((x) => x.entry);
    expect(planOrganization(files, 'extensao').operations[0].to).toBe('Documentos/PDF/a.pdf');
    expect(planOrganization(files, 'ano-mes').operations[0].to).toBe('2023/03-mar/a.pdf');
  });
});
