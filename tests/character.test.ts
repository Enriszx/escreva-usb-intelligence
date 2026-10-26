// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, exportEnvelope, PRESETS, randomConfig, validateCharacter } from '../src/features/character/model';

describe('validação do personagem', () => {
  it('aceita todos os presets e o envelope exportado', () => {
    for (const p of PRESETS) expect(validateCharacter(p.config).ok).toBe(true);
    const env = JSON.parse(JSON.stringify(exportEnvelope('Meu Vigia', DEFAULT_CONFIG)));
    const r = validateCharacter(env);
    expect(r.ok).toBe(true);
    expect(r.name).toBe('Meu Vigia');
    expect(r.value).toEqual(DEFAULT_CONFIG);
  });

  it('rejeita estruturas inválidas com mensagens claras', () => {
    expect(validateCharacter(null).ok).toBe(false);
    expect(validateCharacter('texto').ok).toBe(false);
    const bad = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    bad.colors.primary = 'verde';
    bad.head = 'chapeu-de-cangaceiro';
    bad.glow.intensity = 99;
    bad.accessories.jetpack = true;
    const r = validateCharacter(bad);
    expect(r.ok).toBe(false);
    expect(r.value).toBeUndefined();
    expect(r.errors.join(' ')).toMatch(/primary/);
    expect(r.errors.join(' ')).toMatch(/head/);
    expect(r.errors.join(' ')).toMatch(/glow/);
    expect(r.errors.join(' ')).toMatch(/jetpack/);
  });

  it('remove campos extras e normaliza cores', () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.colors.primary = '#ABCDEF';
    cfg.malicioso = '<script>';
    const r = validateCharacter(cfg);
    expect(r.ok).toBe(true);
    expect(r.value!.colors.primary).toBe('#abcdef');
    expect((r.value as unknown as Record<string, unknown>).malicioso).toBeUndefined();
  });

  it('aleatorização sempre gera configuração válida', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) expect(validateCharacter(randomConfig(rng)).ok).toBe(true);
  });
});
