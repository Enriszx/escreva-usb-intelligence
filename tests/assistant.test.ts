// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runLocal } from '../src/features/assistant/local';
import { DEVICE_PROMPT, parseDecision, runDevice, toolCatalog } from '../src/features/assistant/engines';
import { completeJSON, type ChatMsg } from '../src/features/assistant/webllm';

vi.mock('../src/features/assistant/webllm', async (orig) => ({
  ...(await orig<typeof import('../src/features/assistant/webllm')>()),
  completeJSON: vi.fn(),
}));
import { TOOLS, type ToolContext } from '../src/features/assistant/tools';
import { entry } from './helpers';
import { DEFAULT_SETTINGS } from '../src/lib/storage/repos';

function makeCtx(over: Partial<ToolContext> = {}) {
  const files = [entry('contrato.pdf', 'AAAA'), entry('copia.pdf', 'AAAA'), entry('foto.jpg', 'imagem!'), entry('planilha.xlsx', 'x')].map((x) => x.entry);
  files[0].sha256 = files[1].sha256 = 'a'.repeat(64);
  files[2].sha256 = 'b'.repeat(64);
  files[3].sha256 = 'c'.repeat(64);
  const navigate = vi.fn();
  const updateSettings = vi.fn(async () => {});
  const confirm = vi.fn(async () => true);
  const remove = vi.fn();
  const ctx = {
    files: { entries: files, run: null, remove } as unknown as ToolContext['files'],
    folder: { backend: null } as unknown as ToolContext['folder'],
    navigate, settings: DEFAULT_SETTINGS, updateSettings, confirm, report: () => {},
    ...over,
  } as ToolContext;
  return { ctx, navigate, updateSettings, confirm, remove, files };
}

const noop = () => {};

describe('ferramentas do assistente', () => {
  it('todas têm nome válido, descrição e schema de objeto', () => {
    const names = new Set<string>();
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z_]{3,64}$/);
      expect(names.has(t.name)).toBe(false);
      names.add(t.name);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.description.length).toBeLessThan(1000);
      expect(t.inputSchema.type).toBe('object');
      expect(JSON.stringify(t.inputSchema).length).toBeLessThan(4000);
    }
  });

  it('resumo usa os dados reais', async () => {
    const { ctx } = makeCtx();
    const r = (await TOOLS.find((t) => t.name === 'resumo_biblioteca')!.execute({}, ctx)) as { arquivos: number; duplicados: { grupos: number; copias: number } };
    expect(r.arquivos).toBe(4);
    expect(r.duplicados).toMatchObject({ grupos: 1, copias: 1 });
  });

  it('listar filtra por tipo e ordena por tamanho', async () => {
    const { ctx } = makeCtx();
    const t = TOOLS.find((x) => x.name === 'listar_arquivos')!;
    const docs = (await t.execute({ tipo: 'Documentos' }, ctx)) as { total_encontrado: number };
    expect(docs.total_encontrado).toBe(2);
    const big = (await t.execute({ ordenar: 'tamanho', decrescente: true, limite: 1 }, ctx)) as { arquivos: { nome: string }[] };
    expect(big.arquivos[0].nome).toBe('foto.jpg');
  });

  it('sem pasta conectada, ações em arquivos recusam com explicação', async () => {
    const { ctx, confirm } = makeCtx();
    await expect(TOOLS.find((t) => t.name === 'enviar_para_lixeira')!.execute({ ids: [ctx.files.entries[0].id] }, ctx)).rejects.toThrow(/Conectar pasta/);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('lixeira respeita a recusa do usuário', async () => {
    const trashItems = vi.fn();
    const { ctx } = makeCtx({ confirm: vi.fn(async () => false) });
    ctx.folder = { backend: { rootName: 'PENDRIVE' }, trashItems } as unknown as ToolContext['folder'];
    const r = await TOOLS.find((t) => t.name === 'enviar_para_lixeira')!.execute({ ids: [ctx.files.entries[1].id] }, ctx);
    expect(r).toMatchObject({ enviados: 0 });
    expect(trashItems).not.toHaveBeenCalled();
  });

  it('ids inventados são recusados', async () => {
    const { ctx } = makeCtx();
    await expect(TOOLS.find((t) => t.name === 'tirar_da_lista')!.execute({ ids: ['nao-existe'] }, ctx)).rejects.toThrow(/Ids desconhecidos/);
  });
});

describe('modo sem IA (comandos)', () => {
  it('resumo, duplicados e maiores', async () => {
    const { ctx } = makeCtx();
    expect(await runLocal('quantos arquivos eu tenho?', ctx, noop)).toMatch(/4 arquivo/);
    expect(await runLocal('mostrar duplicados', ctx, noop)).toMatch(/1 grupo/);
    expect(await runLocal('maiores arquivos', ctx, noop)).toMatch(/foto\.jpg/);
  });

  it('busca por tipo abre o acervo filtrado', async () => {
    const { ctx, navigate } = makeCtx();
    expect(await runLocal('mostrar meus PDFs', ctx, noop)).toMatch(/2 encontrado/);
    expect(navigate).toHaveBeenLastCalledWith('/arquivos?aba=acervo&cat=documentos');
  });

  it('organizar por formato abre o plano sem mover nada', async () => {
    const { ctx, navigate } = makeCtx();
    expect(await runLocal('organizar por formato', ctx, noop)).toMatch(/Nada foi movido/);
    expect(navigate).toHaveBeenLastCalledWith('/arquivos?aba=organizacao&criterio=extensao');
  });

  it('tema e ajuda', async () => {
    const { ctx, updateSettings } = makeCtx();
    await runLocal('tema escuro', ctx, noop);
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'escuro' });
    expect(await runLocal('o que você faz?', ctx, noop)).toMatch(/comandos/);
    expect(await runLocal('xyzzy plugh', ctx, noop)).toMatch(/Não entendi/);
  });
});

describe('IA grátis no aparelho', () => {
  const cb = () => ({ signal: new AbortController().signal, onText: noop, onTool: vi.fn() });

  it('catálogo cita todas as ferramentas e cabe na memória curta do modelo', () => {
    const cat = toolCatalog();
    for (const t of TOOLS) expect(cat).toContain(`- ${t.name}(`);
    // ~4 caracteres por token: instruções + catálogo bem abaixo de 4096 tokens.
    expect(DEVICE_PROMPT.length).toBeLessThan(9000);
  });

  it('lê a decisão mesmo com texto em volta', () => {
    expect(parseDecision('{"acao":"responder","texto":"oi"}')).toMatchObject({ texto: 'oi' });
    expect(parseDecision('claro! {"acao":"ferramenta","ferramenta":"duplicados"} ok')).toMatchObject({ ferramenta: 'duplicados' });
    expect(parseDecision('sem json')).toBeNull();
  });

  it('comando direto vai pelo caminho rápido, sem chamar o modelo', async () => {
    const { ctx } = makeCtx();
    vi.mocked(completeJSON).mockReset();
    const h: ChatMsg[] = [];
    expect(await runDevice('m', h, 'tema escuro', ctx, cb())).toMatch(/tema escuro/);
    expect(completeJSON).not.toHaveBeenCalled();
    expect(h).toHaveLength(2);
  });

  it('pedido de explicação com palavra de comando vai para a IA, não para o atalho', async () => {
    const { ctx } = makeCtx();
    const m = vi.mocked(completeJSON).mockReset().mockResolvedValueOnce('{"acao":"responder","texto":"É uma impressão digital do conteúdo."}');
    const c = cb();
    expect(await runDevice('m', [], 'Explique em uma frase o que é um hash SHA-256.', ctx, c)).toMatch(/impressão digital/);
    expect(m).toHaveBeenCalledTimes(1);
    expect(c.onTool).not.toHaveBeenCalled();
  });

  it('pergunta aberta: o modelo usa uma ferramenta real e responde com o resultado', async () => {
    const { ctx } = makeCtx();
    const m = vi.mocked(completeJSON).mockReset();
    m.mockResolvedValueOnce('{"acao":"ferramenta","ferramenta":"resumo_biblioteca","argumentos":{}}');
    m.mockImplementationOnce(async (_id, msgs) => {
      const last = String(msgs.at(-1)!.content);
      expect(last).toMatch(/^Resultado de resumo_biblioteca: .*"arquivos":4/);
      return '{"acao":"responder","texto":"Você tem 4 arquivos e uma cópia sobrando."}';
    });
    const c = cb();
    const h: ChatMsg[] = [];
    const out = await runDevice('m', h, 'me conta como está minha bagunça', ctx, c);
    expect(out).toBe('Você tem 4 arquivos e uma cópia sobrando.');
    expect(c.onTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'resumo_biblioteca' }));
    expect(m.mock.calls[0][1][0]).toMatchObject({ role: 'system' });
    expect(h.map((x) => x.role)).toEqual(['user', 'assistant']);
  });

  it('ferramenta inventada não executa nada', async () => {
    const { ctx } = makeCtx();
    const m = vi.mocked(completeJSON).mockReset();
    m.mockResolvedValueOnce('{"acao":"ferramenta","ferramenta":"apagar_tudo"}');
    m.mockResolvedValueOnce('{"acao":"responder","texto":"Não posso fazer isso."}');
    const c = cb();
    expect(await runDevice('m', [], 'faça uma mágica qualquer', ctx, c)).toBe('Não posso fazer isso.');
    expect(c.onTool).not.toHaveBeenCalled();
  });

  it('falha ao carregar vira erro explicado', async () => {
    const { ctx } = makeCtx();
    vi.mocked(completeJSON).mockReset().mockRejectedValueOnce(new Error('Não consegui baixar a IA.'));
    await expect(runDevice('m', [], 'conte uma história', ctx, cb())).rejects.toThrow(/baixar a IA/);
  });
});
