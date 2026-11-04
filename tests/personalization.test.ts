// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ACCESSORIES, BODIES, DEFAULT_CONFIG, HAIRS, randomConfig, validateCharacter } from '../src/features/character/model';
import { profileLine, onlinePrompt } from '../src/features/assistant/prompt';
import { accentText, customCss } from '../src/app/settings';
import { TOOLS, type ToolContext } from '../src/features/assistant/tools';
import { DEFAULT_SETTINGS } from '../src/lib/storage/repos';

const tool = (n: string) => TOOLS.find((t) => t.name === n)!;
function ctx() {
  const updateSettings = vi.fn(async () => {});
  return { updateSettings, ctx: { settings: DEFAULT_SETTINGS, updateSettings, report: () => {} } as unknown as ToolContext };
}

describe('personagem v2', () => {
  it('arquivo antigo (sem corpo/cabelo, cobertura "crista") é migrado', () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    for (const k of ['body', 'build', 'height', 'mouth', 'hair']) delete old[k];
    delete old.colors.hair;
    delete old.colors.iris;
    old.head = 'crista';
    old.accessories = { mochila: true, antena: false, cachecol: false, lanterna: false, bracelete: false };
    const r = validateCharacter(old);
    expect(r.ok).toBe(true);
    expect(r.value!.hair).toBe('crista');
    expect(r.value!.head).toBe('nenhum');
    expect(r.value!.body).toBe('neutro');
    expect(r.value!.height).toBe(1);
    expect(Object.keys(r.value!.accessories)).toHaveLength(ACCESSORIES.length);
  });
  it('recusa valores novos inválidos', () => {
    expect(validateCharacter({ ...DEFAULT_CONFIG, body: 'robo' }).ok).toBe(false);
    expect(validateCharacter({ ...DEFAULT_CONFIG, height: 2 }).ok).toBe(false);
    expect(validateCharacter({ ...DEFAULT_CONFIG, colors: { ...DEFAULT_CONFIG.colors, hair: 'preto' } }).ok).toBe(false);
  });
  it('aleatório sempre gera configuração válida e cobre as opções', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bodies = new Set<string>();
    const hairs = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = randomConfig(rng);
      expect(validateCharacter(c).ok).toBe(true);
      bodies.add(c.body);
      hairs.add(c.hair);
    }
    expect(bodies.size).toBe(BODIES.length);
    expect(hairs.size).toBeGreaterThan(HAIRS.length - 3);
  });
});

describe('perfil e tratamento', () => {
  it('profileLine usa apelido, nome e concordância', () => {
    const s = profileLine({ userName: 'Ana', userCall: 'chefe', userGender: 'feminino', aiName: 'Íris' });
    expect(s).toContain('Seu nome é Íris');
    expect(s).toContain('"chefe"');
    expect(s).toContain('Ana');
    expect(s).toMatch(/feminino/);
    expect(profileLine({})).toBe('Seu nome é Vigia.');
  });
  it('o prompt online leva o perfil', () => {
    expect(onlinePrompt(new Date(2026, 0, 1), 'Seu nome é Íris.')).toContain('Seu nome é Íris.');
  });
  it('meu_perfil grava só o que veio', async () => {
    const { ctx: c, updateSettings } = ctx();
    await tool('meu_perfil').execute({ como_chamar: 'patrão', genero: 'masculino' }, c);
    expect(updateSettings).toHaveBeenCalledWith({ userCall: 'patrão', userGender: 'masculino' });
    await expect(tool('meu_perfil').execute({}, c)).rejects.toThrow();
  });
});

describe('visual do site', () => {
  it('personalizar_visual valida a cor e limita o texto', async () => {
    const { ctx: c, updateSettings } = ctx();
    await tool('personalizar_visual').execute({ cor_destaque: '#FF0066', tamanho_texto: 3, cantos: 'redondo' }, c);
    expect(updateSettings).toHaveBeenCalledWith({ uiAccent: '#ff0066', uiFont: 1.25, uiRadius: 'redondo' });
    await expect(tool('personalizar_visual').execute({ cor_destaque: 'azul' }, c)).rejects.toThrow(/Cor inválida/);
    await tool('personalizar_visual').execute({ restaurar: true }, c);
    expect(updateSettings).toHaveBeenLastCalledWith({ uiAccent: '', uiRadius: 'padrao', uiFont: 1, uiBackdrop: 'forte' });
  });
  it('texto sobre o destaque tem contraste', () => {
    expect(accentText('#ffdf00')).toBe('#0b1a00');
    expect(accentText('#002776')).toBe('#ffffff');
  });
  it('customCss só escreve o que mudou', () => {
    expect(customCss({ uiAccent: '', uiRadius: 'padrao', uiBackdrop: 'forte' })).toBe('');
    const css = customCss({ uiAccent: '#002776', uiRadius: 'reto', uiBackdrop: 'desligado' });
    expect(css).toContain('--accent: #002776');
    expect(css).toContain('--r-1: 2px');
    expect(css).toContain('display: none');
    expect(customCss({ uiAccent: 'red;}body{', uiRadius: 'padrao', uiBackdrop: 'forte' })).toBe('');
  });
});

describe('pedido de mudança', () => {
  it('monta o link do GitHub com @claude e o rótulo', async () => {
    const r = (await tool('pedir_mudanca').execute({ titulo: 'Página de contato', descricao: 'Criar uma página com formulário.' }, ctx().ctx)) as { link: string };
    const u = new URL(r.link);
    expect(u.href.startsWith('https://github.com/Enriszx/escreva-usb-intelligence/issues/new')).toBe(true);
    expect(u.searchParams.get('title')).toBe('[Pedido] Página de contato');
    expect(u.searchParams.get('body')).toMatch(/^@claude Criar uma página/);
    expect(u.searchParams.get('labels')).toBe('pedido-site');
  });
});
