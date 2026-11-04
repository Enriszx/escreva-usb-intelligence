import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCsv, viewKind, OPEN_EVENT } from '../src/features/files/viewKind';
import { speakable } from '../src/features/assistant/voice';
import { TOOLS, REMINDER_EVENT, type ToolContext } from '../src/features/assistant/tools';
import { runLocal } from '../src/features/assistant/local';
import { DEFAULT_SETTINGS } from '../src/lib/storage/repos';
import { entry } from './helpers';

const tool = (n: string) => TOOLS.find((t) => t.name === n)!;

function ctx(confirmAnswer = true) {
  const a = entry('anotacoes.txt', 'Reunião às 15h com a diretoria.');
  const b = entry('foto da praia.jpg', 'JPEGDATA');
  const files = new Map([[a.entry.id, a.blob], [b.entry.id, b.blob]]);
  const c = {
    files: { entries: [a.entry, b.entry], run: null, getFile: (id: string) => files.get(id) } as unknown as ToolContext['files'],
    folder: { backend: null } as unknown as ToolContext['folder'],
    navigate: vi.fn(), settings: DEFAULT_SETTINGS, updateSettings: vi.fn(async () => {}), confirm: vi.fn(async () => confirmAnswer), report: () => {},
    auto: { phase: 'pronto', drive: 'PENDRIVE', runNow: vi.fn(async () => {}) },
  } as ToolContext;
  return { c, a: a.entry, b: b.entry };
}

afterEach(() => vi.useRealTimers());

describe('visualizador de arquivos', () => {
  it('escolhe como abrir cada tipo', () => {
    expect(viewKind('JPG')).toBe('imagem');
    expect(viewKind('mp4')).toBe('video');
    expect(viewKind('mp3')).toBe('audio');
    expect(viewKind('pdf')).toBe('pdf');
    expect(viewKind('csv')).toBe('tabela');
    expect(viewKind('py')).toBe('texto');
    expect(viewKind('html')).toBe('texto'); // mostrado como texto, nunca executado
    expect(viewKind('docx')).toBe('externo');
    expect(viewKind('', 'text/plain')).toBe('texto');
  });
  it('lê CSV com ; e aspas', () => {
    expect(parseCsv('nome;valor\n"Silva; João";10\nAna;"5"')).toEqual([['nome', 'valor'], ['Silva; João', '10'], ['Ana', '5']]);
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('voz', () => {
  it('fala sem Markdown e sem ler links longos', () => {
    expect(speakable('**Pronto!** Veja:\n- item um\n- item dois\nhttps://exemplo.com/a/b')).toBe('Pronto! Veja: item um item dois o link na tela');
    expect(speakable('x'.repeat(2000)).length).toBeLessThan(760);
  });
});

describe('novas ações do Vigia', () => {
  it('abre um arquivo no visualizador', async () => {
    const { c, b } = ctx();
    const got = vi.fn();
    window.addEventListener(OPEN_EVENT, (e) => got((e as CustomEvent).detail.id), { once: true });
    expect(await tool('abrir_arquivo').execute({ id: b.id }, c)).toMatchObject({ aberto: 'foto da praia.jpg', como: 'Imagem' });
    expect(got).toHaveBeenCalledWith(b.id);
  });

  it('só lê o conteúdo com permissão', async () => {
    const sim = ctx(true);
    expect(await tool('ler_arquivo').execute({ id: sim.a.id }, sim.c)).toMatchObject({ lido: true, texto: 'Reunião às 15h com a diretoria.' });
    expect(sim.c.confirm).toHaveBeenCalled();
    const nao = ctx(false);
    expect(await tool('ler_arquivo').execute({ id: nao.a.id }, nao.c)).toMatchObject({ lido: false });
    await expect(tool('ler_arquivo').execute({ id: nao.b.id }, nao.c)).rejects.toThrow(/não dá para ler como texto/);
  });

  it('executa o modo automático quando o pendrive está pronto', async () => {
    const { c } = ctx();
    expect(await tool('modo_automatico').execute({ acao: 'executar' }, c)).toMatchObject({ executando: true, pendrive: 'PENDRIVE' });
    expect(c.auto!.runNow).toHaveBeenCalled();
  });

  it('cria lembrete que dispara depois do tempo', async () => {
    vi.useFakeTimers();
    const { c } = ctx();
    const got = vi.fn();
    window.addEventListener(REMINDER_EVENT, (e) => got((e as CustomEvent).detail.texto), { once: true });
    await tool('lembrete').execute({ minutos: 2, texto: 'beber água' }, c);
    vi.advanceTimersByTime(119_000);
    expect(got).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(got).toHaveBeenCalledWith('beber água');
  });

  it('comando de voz "abrir a foto da praia" funciona sem IA', async () => {
    const { c, b } = ctx();
    const got = vi.fn();
    window.addEventListener(OPEN_EVENT, (e) => got((e as CustomEvent).detail.id), { once: true });
    expect(await runLocal('abrir a foto da praia', c, () => {})).toMatch(/Abri foto da praia\.jpg/);
    expect(got).toHaveBeenCalledWith(b.id);
  });
});
