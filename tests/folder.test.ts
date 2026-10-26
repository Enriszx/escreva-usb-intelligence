// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FakeDir } from './fakeFs';
import { WebFolderBackend, type DirHandle } from '../src/lib/files/webFolder';
import { FsOpError, normalizeDir, validateName } from '../src/lib/files/backend';

for (const withMove of [true, false]) {
  describe(`pasta conectada (${withMove ? 'com move() nativo' : 'cópia + remoção'})`, () => {
    const setup = () => {
      const root = new FakeDir('PENDRIVE', withMove);
      root.put('fotos/praia.jpg', 'JPEGDATA');
      root.put('doc.pdf', 'PDF');
      root.put('outro.pdf', 'PDF2');
      return { root, b: new WebFolderBackend(root as unknown as DirHandle) };
    };

    it('lista recursivamente com caminhos relativos', async () => {
      const { b } = setup();
      const list = await b.scan();
      expect(list.map((f) => f.path).sort()).toEqual(['doc.pdf', 'fotos/praia.jpg', 'outro.pdf']);
      expect(list.find((f) => f.name === 'praia.jpg')!.size).toBe(8);
    });

    it('renomeia sem perder conteúdo e recusa conflito', async () => {
      const { root, b } = setup();
      expect(await b.rename('doc.pdf', 'contrato.pdf')).toBe('contrato.pdf');
      expect(root.tree()).toEqual(['contrato.pdf', 'fotos/praia.jpg', 'outro.pdf']);
      expect(await (await b.getBlob('contrato.pdf')).text()).toBe('PDF');
      await expect(b.rename('contrato.pdf', 'outro.pdf')).rejects.toMatchObject({ code: 'conflito' });
      expect(await (await b.getBlob('outro.pdf')).text()).toBe('PDF2');
      await expect(b.rename('outro.pdf', 'a/b.pdf')).rejects.toBeInstanceOf(FsOpError);
    });

    it('troca só maiúsculas/minúsculas', async () => {
      const { root, b } = setup();
      await b.rename('doc.pdf', 'DOC.pdf');
      expect(root.tree()).toContain('DOC.pdf');
      expect(root.tree()).not.toContain('doc.pdf');
    });

    it('move criando pastas e nunca sobrescreve', async () => {
      const { root, b } = setup();
      expect(await b.move('doc.pdf', 'Documentos/2024')).toBe('Documentos/2024/doc.pdf');
      root.put('Documentos/2024/outro.pdf', 'JA EXISTE');
      await expect(b.move('outro.pdf', 'Documentos/2024')).rejects.toMatchObject({ code: 'conflito' });
      expect(root.tree()).toContain('outro.pdf');
      expect(await (await b.getBlob('Documentos/2024/outro.pdf')).text()).toBe('JA EXISTE');
    });

    it('lixeira: envia, lista, restaura no lugar e evita conflito', async () => {
      const { root, b } = setup();
      const item = await b.trash('fotos/praia.jpg');
      expect(root.tree()).not.toContain('fotos/praia.jpg');
      expect((await b.scan()).map((f) => f.path)).not.toContain('fotos/praia.jpg');
      expect((await b.listTrash())[0]).toMatchObject({ original: 'fotos/praia.jpg', size: 8 });
      root.put('fotos/praia.jpg', 'NOVA');
      const restored = await b.restore(item);
      expect(restored).toBe('fotos/praia (2).jpg');
      expect(await (await b.getBlob(restored)).text()).toBe('JPEGDATA');
      expect(await b.listTrash()).toEqual([]);
    });

    it('esvaziar lixeira apaga de vez', async () => {
      const { root, b } = setup();
      const item = await b.trash('doc.pdf');
      await b.purge(item);
      expect(root.tree().filter((p) => p.includes('doc.pdf'))).toEqual([]);
      expect(await b.listTrash()).toEqual([]);
    });

    it('apagar definitivo', async () => {
      const { root, b } = setup();
      await b.remove('outro.pdf');
      expect(root.tree()).toEqual(['doc.pdf', 'fotos/praia.jpg']);
      await expect(b.remove('outro.pdf')).rejects.toMatchObject({ code: 'ausente' });
    });
  });
}

describe('nomes seguros para pendrive', () => {
  it('recusa nomes problemáticos no FAT32/Windows', () => {
    expect(validateName('ok.txt')).toBeNull();
    expect(validateName('a:b.txt')).not.toBeNull();
    expect(validateName('fim.')).not.toBeNull();
    expect(validateName(' espaço')).not.toBeNull();
    expect(validateName('CON.txt')).not.toBeNull();
    expect(validateName('.usbi-lixeira')).not.toBeNull();
    expect(validateName('x'.repeat(256))).not.toBeNull();
  });
  it('normaliza caminho de pasta', () => {
    expect(normalizeDir(' Fotos / 2024 /')).toEqual({ ok: true, dir: 'Fotos/2024' });
    expect(normalizeDir('a/b?').ok).toBe(false);
  });
});
