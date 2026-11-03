// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSSE, runOnline, OnlineError, ONLINE_URL, type OAMsg } from '../src/features/assistant/online';
import type { ToolContext } from '../src/features/assistant/tools';
import { entry } from './helpers';
import { DEFAULT_SETTINGS } from '../src/lib/storage/repos';

const sse = (chunks: object[]) => {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
  // Corta em pedaços tortos para provar que o leitor junta linhas partidas.
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(ctl) {
      for (let i = 0; i < bytes.length; i += 7) ctl.enqueue(bytes.slice(i, i + 7));
      ctl.close();
    },
  });
};
const delta = (d: object) => ({ choices: [{ index: 0, delta: d }] });
const ok = (chunks: object[]) => new Response(sse(chunks), { status: 200, headers: { 'content-type': 'text/event-stream' } });

function ctx(): ToolContext {
  const files = [entry('a.pdf', 'x'), entry('b.jpg', 'yy')].map((e) => e.entry);
  return {
    files: { entries: files, run: null } as unknown as ToolContext['files'],
    folder: { backend: null } as unknown as ToolContext['folder'],
    navigate: vi.fn(), settings: DEFAULT_SETTINGS, updateSettings: vi.fn(async () => {}), confirm: vi.fn(async () => true), report: () => {},
  } as ToolContext;
}
const cb = () => ({ signal: new AbortController().signal, onText: vi.fn(), onTool: vi.fn() });

afterEach(() => vi.unstubAllGlobals());

describe('IA online grátis', () => {
  it('lê SSE partido em pedaços, ignorando o raciocínio', async () => {
    const got: string[] = [];
    await readSSE(sse([delta({ reasoning: 'pensando' }), delta({ content: 'Olá' }), delta({ content: ', mundo' })]), (d) => d.content && got.push(d.content));
    expect(got.join('')).toBe('Olá, mundo');
  });

  it('chama a ferramenta real, devolve o resultado e mostra a resposta em streaming', async () => {
    const bodies: { messages: OAMsg[]; tools: unknown[]; stream: boolean }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(ONLINE_URL);
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? ok([delta({ tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'resumo_biblioteca', arguments: '' } }] }), delta({ tool_calls: [{ index: 0, function: { arguments: '{}' } }] })])
        : ok([delta({ content: 'Você tem ' }), delta({ content: '2 arquivos.' })]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const h: OAMsg[] = [];
    const c = cb();
    expect(await runOnline(h, 'quantos arquivos?', ctx(), c)).toBe('Você tem 2 arquivos.');
    expect(c.onTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'resumo_biblioteca' }));
    expect(c.onText).toHaveBeenLastCalledWith('Você tem 2 arquivos.');
    expect(bodies[0].stream).toBe(true);
    expect(bodies[0].tools.length).toBeGreaterThan(10);
    expect(bodies[0].messages[0].role).toBe('system');
    const toolMsg = bodies[1].messages.find((m) => m.role === 'tool') as { content: string };
    expect(JSON.parse(toolMsg.content).arquivos).toBe(2);
    expect(h.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
  });

  it('espera e tenta de novo no limite (429)', async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '1' } }) : ok([delta({ content: 'ok' })]))));
    const p = runOnline([], 'oi', ctx(), cb());
    await vi.advanceTimersByTimeAsync(1100);
    expect(await p).toBe('ok');
    expect(n).toBe(2);
    vi.useRealTimers();
  });

  it('sem rede: erro explicado e histórico intacto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const h: OAMsg[] = [{ role: 'user', content: 'antes' }, { role: 'assistant', content: 'oi' }];
    await expect(runOnline(h, 'nova', ctx(), cb())).rejects.toMatchObject({ kind: 'rede' });
    expect(h).toHaveLength(2);
  });

  it('ferramenta inventada não executa nada', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1
      ? ok([delta({ tool_calls: [{ index: 0, id: 'x', function: { name: 'apagar_tudo', arguments: '{}' } }] })])
      : ok([delta({ content: 'Não posso.' })]))));
    const c = cb();
    expect(await runOnline([], 'apague tudo', ctx(), c)).toBe('Não posso.');
    expect(c.onTool).not.toHaveBeenCalled();
  });

  it('é um erro tipado', () => expect(new OnlineError('x', 'limite')).toBeInstanceOf(Error));
});
