import { SYSTEM_PROMPT } from './prompt';
import { TOOLS, toolByName, type AssistantTool, type ToolContext } from './tools';
import { runLocal } from './local';
import { completeJSON, type ChatMsg } from './webllm';

/** 'aparelho' = IA grátis rodando no navegador; 'local' = comandos fixos, sem IA. */
export type EngineKind = 'aparelho' | 'local';

export interface TurnCallbacks {
  signal: AbortSignal;
  onText: (text: string) => void;
  onTool: (tool: AssistantTool) => void;
}

/** Erro já traduzido para o usuário. */
export class AssistantError extends Error {
  constructor(message: string, public kind: 'carregar' | 'cancelled' | 'other' = 'other') {
    super(message);
  }
}

async function runTool(t: AssistantTool, input: unknown, ctx: ToolContext, cb: TurnCallbacks): Promise<string> {
  cb.onTool(t);
  try {
    const out = await t.execute((input && typeof input === 'object' ? input : {}) as Record<string, unknown>, ctx);
    const s = typeof out === 'string' ? out : JSON.stringify(out);
    // Modelos pequenos têm memória curta (4 mil tokens): resultado enxuto.
    return s.length > 1500 ? `${s.slice(0, 1500)}…(cortado)` : s;
  } catch (e) {
    return `Erro: ${(e as Error).message}`;
  }
}

type Prop = { type?: string; enum?: string[]; items?: { type?: string } };

/** Catálogo curto das ferramentas: nome(argumentos) — primeira frase da descrição. */
export function toolCatalog(): string {
  return TOOLS.map((t) => {
    const props = (t.inputSchema.properties ?? {}) as Record<string, Prop>;
    const req = new Set((t.inputSchema.required as string[] | undefined) ?? []);
    const args = Object.entries(props)
      .map(([k, p]) => `${k}${req.has(k) ? '' : '?'}: ${p.enum ? p.enum.join('|') : p.type === 'array' ? `lista de ${p.items?.type ?? 'texto'}` : p.type ?? 'texto'}`)
      .join(', ');
    const first = t.description.split(/(?<=\.)\s/)[0].slice(0, 140);
    return `- ${t.name}(${args}) — ${first}`;
  }).join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: ['responder', 'ferramenta'] },
    texto: { type: 'string' },
    ferramenta: { type: 'string', enum: TOOLS.map((t) => t.name) },
    argumentos: { type: 'object' },
  },
  required: ['acao'],
};

export const DEVICE_PROMPT = `${SYSTEM_PROMPT}

Ferramentas (você é quem decide usar):
${toolCatalog()}

Formato: responda SEMPRE com um único objeto JSON, sem nada fora dele.
- Para usar uma ferramenta: {"acao":"ferramenta","ferramenta":"nome","argumentos":{...}}
- Para falar com o usuário: {"acao":"responder","texto":"sua resposta em português"}
Depois de usar uma ferramenta você recebe o resultado e então responde (ou usa outra). Não invente resultados.`;

export interface Decision {
  acao?: string;
  texto?: string;
  ferramenta?: string;
  argumentos?: Record<string, unknown>;
}

/** Lê a decisão do modelo; tolera texto em volta do JSON. */
export function parseDecision(raw: string): Decision | null {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? (v as Decision) : null;
    } catch {
      return null;
    }
  };
  return tryParse(raw.trim()) ?? tryParse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
}

const MAX_STEPS = 4;
const KEEP_HISTORY = 8;

/**
 * Uma rodada com a IA do aparelho. Comandos diretos ("procure duplicados",
 * "tema escuro"...) vão pelo caminho rápido e exato; o resto, a IA decide.
 * `history` guarda só texto de usuário e respostas finais.
 */
export async function runDevice(model: string, history: ChatMsg[], userText: string, ctx: ToolContext, cb: TurnCallbacks): Promise<string> {
  const quick = await runLocal(userText, ctx, cb.onTool, true);
  if (quick !== null) {
    history.push({ role: 'user', content: userText }, { role: 'assistant', content: JSON.stringify({ acao: 'responder', texto: quick }) });
    return quick;
  }

  const recent = history.slice(-KEEP_HISTORY);
  const msgs: ChatMsg[] = [{ role: 'system', content: DEVICE_PROMPT }, ...recent, { role: 'user', content: userText }];
  let answer = '';
  for (let step = 0; step < MAX_STEPS && !answer; step++) {
    let raw: string;
    try {
      raw = await completeJSON(model, msgs, SCHEMA, cb.signal);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new AssistantError('Parado.', 'cancelled');
      throw new AssistantError((e as Error).message, 'carregar');
    }
    const d = parseDecision(raw);
    const tool = d?.acao === 'ferramenta' && d.ferramenta ? toolByName(d.ferramenta) : undefined;
    if (tool) {
      const result = await runTool(tool, d!.argumentos ?? {}, ctx, cb);
      msgs.push({ role: 'assistant', content: raw }, { role: 'user', content: `Resultado de ${tool.name}: ${result}\nAgora responda ao usuário (ou use outra ferramenta se faltar algo).` });
      continue;
    }
    answer = (d?.texto ?? '').trim() || (d ? '' : raw.trim());
    if (!answer && step === MAX_STEPS - 1) break;
    if (!answer) msgs.push({ role: 'assistant', content: raw }, { role: 'user', content: 'Responda ao usuário agora, no formato {"acao":"responder","texto":"..."}.' });
  }
  if (!answer) answer = (await runLocal(userText, ctx, cb.onTool)) ?? 'Não consegui responder agora.';
  history.push({ role: 'user', content: userText }, { role: 'assistant', content: JSON.stringify({ acao: 'responder', texto: answer }) });
  return answer;
}
