// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runLocal } from '../src/features/assistant/local';
import { TOOLS, type ToolContext } from '../src/features/assistant/tools';
import { DEFAULT_SETTINGS } from '../src/lib/storage/repos';

function ctx(folder: Partial<ToolContext['folder']> = {}) {
  const updateSettings = vi.fn(async () => {});
  const c = {
    files: { entries: [], remove: vi.fn() }, folder: { backend: null, ...folder }, navigate: vi.fn(),
    settings: DEFAULT_SETTINGS, updateSettings, confirm: vi.fn(async () => true), report: () => {},
  } as unknown as ToolContext;
  return { c, updateSettings };
}
const noop = () => {};

describe('comandos sem IA (novos)', () => {
  it('muda a cor do site', async () => {
    const { c, updateSettings } = ctx();
    expect(await runLocal('deixa o site azul', c, noop)).toMatch(/#3d7bff/);
    expect(updateSettings).toHaveBeenCalledWith({ uiAccent: '#3d7bff' });
  });
  it('grava como chamar e o nome da IA, mantendo acentos', async () => {
    const { c, updateSettings } = ctx();
    await runLocal('me chama de Chefe', c, noop);
    expect(updateSettings).toHaveBeenCalledWith({ userCall: 'Chefe' });
    await runLocal('seu nome é Íris', c, noop);
    expect(updateSettings).toHaveBeenCalledWith({ aiName: 'Íris' });
    await runLocal('sou mulher', c, noop);
    expect(updateSettings).toHaveBeenCalledWith({ userGender: 'feminino' });
  });
  it('liga e desliga a voz', async () => {
    const { c, updateSettings } = ctx();
    await runLocal('fala as respostas', c, noop);
    expect(updateSettings).toHaveBeenCalledWith({ aiVoice: true });
    await runLocal('para de falar', c, noop);
    expect(updateSettings).toHaveBeenLastCalledWith({ aiVoice: false });
  });
  it('desfazer e lixeira sem pasta explicam o motivo', async () => {
    const { c } = ctx();
    await expect(runLocal('desfazer', c, noop)).rejects.toThrow(/Conectar pasta/);
  });
  it('desfazer e restaurar com pasta conectada', async () => {
    const undo = vi.fn(async () => {});
    const restore = vi.fn(async () => ({ ok: 2, failed: [] }));
    const item = { id: 't1', original: 'a.txt', stored: 'x', at: 0, size: 1 };
    const { c } = ctx({ backend: { listTrash: async () => [item, { ...item, id: 't2' }] } as never, undoLabel: 'mover 1 arquivo', undo, restore, refreshTrash: async () => {} });
    expect(await runLocal('desfazer', c, noop)).toMatch(/mover 1 arquivo/);
    expect(undo).toHaveBeenCalled();
    expect(await runLocal('restaurar a lixeira', c, noop)).toMatch(/Restaurei 2/);
  });
  it('verificar_hash compara com a referência', async () => {
    const { c } = ctx();
    (c.files as unknown as { entries: unknown[] }).entries = [{ id: 'f', name: 'a.iso', sha256: 'a'.repeat(64) }];
    const r = (await TOOLS.find((t) => t.name === 'verificar_hash')!.execute({ id: 'f', referencia: `${'a'.repeat(64)}  a.iso` }, c)) as { confere: boolean };
    expect(r.confere).toBe(true);
  });
  it('configurar só grava o que veio', async () => {
    const { c, updateSettings } = ctx();
    await TOOLS.find((t) => t.name === 'configurar')!.execute({ qualidade_3d: 'economia', auto_executar: true }, c);
    expect(updateSettings).toHaveBeenCalledWith({ quality: 'economia', autoRun: true });
  });
});
