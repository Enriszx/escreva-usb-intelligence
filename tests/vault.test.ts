// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decryptBytes, encryptBytes, passwordStrength, VaultError } from '../src/lib/crypto/vault';

const ITER = 100_000; // menor que o padrão só para o teste rodar rápido

describe('cofre AES-GCM', () => {
  const data = new TextEncoder().encode('conteúdo secreto do pendrive');
  const meta = { name: 'notas.txt', type: 'text/plain', size: data.length };

  it('cifra e abre com a mesma senha', async () => {
    const enc = await encryptBytes(data, meta, 'senha-longa-123!', ITER);
    expect(new TextDecoder().decode(enc).includes('secreto')).toBe(false);
    const out = await decryptBytes(enc, 'senha-longa-123!');
    expect(out.meta).toEqual(meta);
    expect(new TextDecoder().decode(out.data)).toBe('conteúdo secreto do pendrive');
  });

  it('usa salt e IV novos a cada vez', async () => {
    const a = await encryptBytes(data, meta, 'x', ITER);
    const b = await encryptBytes(data, meta, 'x', ITER);
    expect(Buffer.from(a.slice(9, 37)).equals(Buffer.from(b.slice(9, 37)))).toBe(false);
  });

  it('senha errada falha sem revelar conteúdo', async () => {
    const enc = await encryptBytes(data, meta, 'certa', ITER);
    await expect(decryptBytes(enc, 'errada')).rejects.toBeInstanceOf(VaultError);
  });

  it('detecta adulteração no cabeçalho e no corpo', async () => {
    const enc = await encryptBytes(data, meta, 'certa', ITER);
    const body = enc.slice(); body[body.length - 1] ^= 1;
    await expect(decryptBytes(body, 'certa')).rejects.toThrow(/Senha incorreta ou arquivo alterado/);
    const head = enc.slice(); head[20] ^= 1;
    await expect(decryptBytes(head, 'certa')).rejects.toThrow();
  });

  it('rejeita arquivo que não é cofre', async () => {
    await expect(decryptBytes(new Uint8Array(100), 'x')).rejects.toThrow(/não é um cofre/);
  });

  it('força da senha', () => {
    expect(passwordStrength('123').label).toBe('Fraca');
    expect(passwordStrength('Pendrive-Verde-2026!').score).toBeGreaterThanOrEqual(3);
  });
});
