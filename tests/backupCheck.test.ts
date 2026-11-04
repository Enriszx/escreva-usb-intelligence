import { describe, expect, it } from 'vitest';
import { compareSets, needsHash, relativePath } from '../src/lib/analysis/backupCheck';

describe('verificador de backup', () => {
  it('tira o nome da pasta escolhida do caminho', () => {
    expect(relativePath('Fotos/2024/a.jpg', 'a.jpg')).toBe('2024/a.jpg');
    expect(relativePath('', 'solto.txt')).toBe('solto.txt');
    expect(relativePath('Backup\\b.txt', 'b.txt')).toBe('b.txt');
  });

  it('só pede hash de quem está nos dois lados com o mesmo tamanho', () => {
    expect(needsHash([{ path: 'a', size: 1 }, { path: 'b', size: 2 }, { path: 'c', size: 3 }], [{ path: 'a', size: 1 }, { path: 'b', size: 9 }])).toEqual(['a']);
  });

  it('classifica igual, diferente, faltando e extra', () => {
    const r = compareSets(
      [{ path: 'a', size: 1, sha256: 'x' }, { path: 'b', size: 2, sha256: 'y' }, { path: 'c', size: 3 }, { path: 'd', size: 4 }],
      [{ path: 'a', size: 1, sha256: 'x' }, { path: 'b', size: 2, sha256: 'z' }, { path: 'd', size: 5 }, { path: 'e', size: 1 }],
    );
    expect(r.counts).toEqual({ igual: 1, diferente: 2, faltando: 1, extra: 1 });
    expect(r.rows[0]).toMatchObject({ path: 'c', verdict: 'faltando' });
    expect(r.rows.find((x) => x.path === 'b')?.why).toMatch(/conteúdo diferente/);
    expect(r.trustworthy).toBe(false);
  });

  it('cópia idêntica é confiável; extras na cópia não atrapalham', () => {
    const r = compareSets([{ path: 'a', size: 1, sha256: 'x' }], [{ path: 'a', size: 1, sha256: 'x' }, { path: 'novo', size: 1 }]);
    expect(r.trustworthy).toBe(true);
    expect(r.counts.extra).toBe(1);
  });

  it('origem vazia nunca é "confiável"', () => {
    expect(compareSets([], [{ path: 'a', size: 1 }]).trustworthy).toBe(false);
  });
});
