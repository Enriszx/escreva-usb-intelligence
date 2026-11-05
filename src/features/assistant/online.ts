import { onlinePrompt, profileLine } from './prompt';
import { TOOLS, toolByName, type AssistantTool, type ToolContext } from './tools';

/**
 * IA online grátis: o modelo aberto gpt-oss-20b servido de graça, sem conta e
 * sem chave, pelo Pollinations (text.pollinations.ai, API no formato OpenAI).
 * Vai para lá: a conversa e os metadados que as ferramentas devolvem (nomes,
 * tamanhos, datas, hashes). O conteúdo dos arquivos nunca.
 */
export const ONLINE_URL = 'https://text.pollinations.ai/openai';
export const ONLINE_MODEL = 'openai'; // apelido do gpt-oss-20b no serviço

export interface OAToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export type OAMsg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OAToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface OnlineCallbacks {
  signal: AbortSignal;
  onText: (text: string) => void;
  onTool: (tool: AssistantTool) => void;
}

export class OnlineError extends Error {
  constructor(message: string, public kind: 'rede' | 'limite' | 'servico' | 'cancelled') {
    super(message);
  }
}

const OA_TOOLS = TOOLS.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } }));

interface Delta {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/** Lê um corpo SSE ("data: {...}\n\n") e entrega cada delta. Exportado para teste. */
export async function readSSE(body: ReadableStream<Uint8Array>, onDelta: (d: Delta) => void): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, cut).trim();
      buf = buf.slice(cut + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: Delta }[] };
        const d = j.choices?.[0]?.delta;
        if (d) onDelta(d);
      } catch {
        /* linha parcial ou comentário: ignora */
      }
    }
  }
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); rej(new OnlineError('Parado.', 'cancelled')); }, { once: true });
  });

async function request(messages: OAMsg[], signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(ONLINE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ONLINE_MODEL, messages, tools: OA_TOOLS, stream: true, private: true, referrer: 'usb-intelligence' }),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new OnlineError('Parado.', 'cancelled');
      // Conexão caiu (comum no celular): tenta de novo até 2 vezes antes de desistir.
      if (attempt < 2) {
        await wait(800 * (attempt + 1), signal);
        continue;
      }
      throw new OnlineError('Sem conexão com a IA online. Confira a internet.', 'rede');
    }
    if (res.ok && res.body) return res;
    // Limite do plano grátis: espera o tempo pedido (até 20 s) e tenta de novo, no máximo 2 vezes.
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      const after = Number(res.headers.get('Retry-After')) || 6;
      await wait(Math.min(after, 20) * 1000, signal);
      continue;
    }
    if (res.status === 403) throw new OnlineError('O serviço gratuito só atende pelo site publicado (enriszx.github.io). Nesta cópia local, use a IA do aparelho ou os comandos.', 'servico');
    if (res.status === 429 || res.status === 402) throw new OnlineError('A IA online grátis atingiu o limite de uso agora. Tente de novo em alguns minutos.', 'limite');
    throw new OnlineError(`A IA online não respondeu (erro ${res.status}). Tente de novo.`, 'servico');
  }
}

const MAX_ROUNDS = 20;
const KEEP = 30;

/**
 * Uma rodada de conversa: o modelo responde em streaming e chama as ferramentas
 * do app quando precisa; repetimos até ele dar a resposta final.
 * `history` recebe a conversa completa (inclusive chamadas de ferramenta).
 */
export async function runOnline(history: OAMsg[], userText: string, ctx: ToolContext, cb: OnlineCallbacks): Promise<string> {
  const start = history.length;
  history.push({ role: 'user', content: userText });
  try {
    let shown = '';
    let emptyRetry = true;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Corta o histórico antigo sem separar uma chamada de ferramenta do seu resultado.
      let from = Math.max(0, history.length - KEEP);
      while (from > 0 && history[from].role === 'tool') from--;
      const res = await request([{ role: 'system', content: onlinePrompt(new Date(), profileLine(ctx.settings)) }, ...history.slice(from)], cb.signal);
      let text = '';
      const calls: OAToolCall[] = [];
      try {
        await readSSE(res.body!, (d) => {
          if (d.content) {
            text += d.content;
            cb.onText((shown ? `${shown}\n\n` : '') + text);
          }
          for (const tc of d.tool_calls ?? []) {
            const c = (calls[tc.index] ??= { id: tc.id ?? `call_${round}_${tc.index}`, type: 'function', function: { name: '', arguments: '' } });
            if (tc.id) c.id = tc.id;
            if (tc.function?.name) c.function.name += tc.function.name;
            if (tc.function?.arguments) c.function.arguments += tc.function.arguments;
          }
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw new OnlineError('Parado.', 'cancelled');
        throw new OnlineError('A conexão com a IA online caiu no meio da resposta.', 'rede');
      }
      const real = calls.filter(Boolean);
      // Resposta vazia (conexão cortada no meio): pede de novo uma vez.
      if (!real.length && !text.trim() && emptyRetry) {
        emptyRetry = false;
        continue;
      }
      if (!real.length) {
        const final = text.trim() || 'Não consegui uma resposta agora. Tente perguntar de outro jeito.';
        history.push({ role: 'assistant', content: final });
        return shown ? `${shown}\n\n${final}` : final;
      }
      history.push({ role: 'assistant', content: text || null, tool_calls: real });
      if (text.trim()) shown = shown ? `${shown}\n\n${text.trim()}` : text.trim();
      const results = await Promise.all(real.map(async (c) => {
        const tool = toolByName(c.function.name);
        let out: string;
        if (!tool) out = 'Erro: ferramenta desconhecida.';
        else {
          cb.onTool(tool);
          try {
            const input = c.function.arguments ? JSON.parse(c.function.arguments) : {};
            const r = await tool.execute(input && typeof input === 'object' ? input : {}, ctx);
            out = typeof r === 'string' ? r : JSON.stringify(r);
          } catch (e) {
            out = `Erro: ${(e as Error).message}`;
          }
        }
        return { id: c.id, content: out.length > 24_000 ? `${out.slice(0, 24_000)}…(cortado)` : out };
      }));
      for (const r of results) history.push({ role: 'tool', tool_call_id: r.id, content: r.content });
    }
    const final = 'Parei aqui para não ficar em ciclo. Pode reformular o pedido?';
    history.push({ role: 'assistant', content: final });
    return final;
  } catch (e) {
    // Rodada que falhou não fica pela metade no histórico.
    history.splice(start);
    throw e;
  }
}
