import type { ChatCompletionMessageParam, WebWorkerMLCEngine } from '@mlc-ai/web-llm';

/**
 * IA própria e grátis: um modelo aberto (Qwen2.5, licença Apache 2.0) que roda
 * dentro do navegador pela WebGPU, com a biblioteca WebLLM (MLC, código aberto).
 * Não há conta, chave nem cobrança. O modelo é baixado uma vez (Hugging Face) e
 * fica guardado no aparelho; depois funciona até sem internet. As conversas
 * nunca saem do aparelho.
 */
// vramMB: com shader-f16 / sem (variante q4f32), segundo o prebuiltAppConfig do WebLLM.
export const LOCAL_MODELS = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Leve · Qwen2.5 0,5B', vramMB: [945, 1060], note: 'Para celulares e computadores simples. Entende menos.' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Equilibrado · Qwen2.5 1,5B (recomendado)', vramMB: [1630, 1889], note: 'Bom português e boa velocidade na maioria dos aparelhos.' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Mais esperto · Qwen2.5 3B', vramMB: [2505, 2894], note: 'Responde melhor, mas pede um aparelho mais forte.' },
] as const;

export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS[1].id;
export const modelInfo = (id: string) => LOCAL_MODELS.find((m) => m.id === id) ?? LOCAL_MODELS[1];

export type GpuStatus = 'verificando' | 'ok' | 'sem-webgpu' | 'sem-placa';

let gpuCache: Promise<{ status: GpuStatus; f16: boolean }> | null = null;
function probeGpu() {
  gpuCache ??= (async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    if (!gpu) return { status: 'sem-webgpu' as const, f16: false };
    try {
      const a = await gpu.requestAdapter();
      return a ? { status: 'ok' as const, f16: a.features.has('shader-f16') } : { status: 'sem-placa' as const, f16: false };
    } catch {
      return { status: 'sem-placa' as const, f16: false };
    }
  })();
  return gpuCache;
}
/** A IA precisa da WebGPU (Chrome/Edge atuais, Android com Chrome recente, Safari 26+). */
export const checkGpu = async (): Promise<GpuStatus> => (await probeGpu()).status;
/** Muitas placas (inclusive de celular) não têm shader-f16: aí usamos a variante q4f32 do mesmo modelo. */
export const hasF16 = async () => (await probeGpu()).f16;
const runtimeId = async (id: string) => ((await hasF16()) ? id : id.replace('q4f16_1', 'q4f32_1'));

export const GPU_MESSAGE: Record<Exclude<GpuStatus, 'ok' | 'verificando'>, string> = {
  'sem-webgpu': 'Este navegador não tem WebGPU, que a IA do aparelho precisa. Use o Chrome ou o Edge atualizados (no Android, o Chrome).',
  'sem-placa': 'O navegador tem WebGPU, mas não liberou a placa de vídeo deste aparelho. Atualize o navegador ou tente em outro aparelho.',
};

export interface LoadState {
  phase: 'parado' | 'carregando' | 'pronta' | 'erro';
  progress: number;
  text: string;
  model: string | null;
}

let engine: WebWorkerMLCEngine | null = null;
let engineModel: string | null = null;
let pending: { id: string; p: Promise<WebWorkerMLCEngine> } | null = null;
let worker: Worker | null = null;
let state: LoadState = { phase: 'parado', progress: 0, text: '', model: null };
const listeners = new Set<(s: LoadState) => void>();

export const getLoadState = () => state;
export function onLoadState(fn: (s: LoadState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(s: LoadState) {
  state = s;
  listeners.forEach((f) => f(s));
}

function explain(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  if (/quota|storage|space/i.test(m)) return 'Falta espaço no aparelho para guardar a IA. Libere espaço ou escolha o modelo Leve.';
  if (/fetch|network|Failed to fetch|NetworkError|load failed/i.test(m)) return 'Não consegui baixar a IA. Confira a internet (o primeiro download precisa dela) e tente de novo.';
  if (/webgpu|adapter|device|gpu/i.test(m)) return 'A placa de vídeo não aguentou este modelo. Tente o modelo Leve ou feche outras abas.';
  return `A IA não carregou: ${m}`;
}

/** Baixa (na primeira vez) e carrega o modelo. Chamadas repetidas reaproveitam o mesmo carregamento. */
export function loadModel(id: string): Promise<WebWorkerMLCEngine> {
  if (engine && engineModel === id) return Promise.resolve(engine);
  if (pending?.id === id) return pending.p;
  const p = (async () => {
    setState({ phase: 'carregando', progress: 0, text: 'Preparando a IA…', model: id });
    try {
      const real = await runtimeId(id);
      if (engine) await engine.unload().catch(() => {});
      engine = null;
      engineModel = null;
      worker?.terminate();
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
      const e = await CreateWebWorkerMLCEngine(worker, real, {
        initProgressCallback: (r) => setState({ phase: 'carregando', progress: r.progress, text: r.text, model: id }),
      });
      engine = e;
      engineModel = id;
      setState({ phase: 'pronta', progress: 1, text: 'IA pronta', model: id });
      return e;
    } catch (err) {
      console.warn('[Vigia IA] falha ao carregar o modelo', err);
      worker?.terminate();
      worker = null;
      const msg = explain(err);
      setState({ phase: 'erro', progress: 0, text: msg, model: id });
      throw new Error(msg);
    } finally {
      pending = null;
    }
  })();
  pending = { id, p };
  return p;
}

/** Apaga o modelo guardado no aparelho (libera o espaço). */
export async function deleteModel(id: string): Promise<void> {
  if (engineModel === id) {
    await engine?.unload().catch(() => {});
    worker?.terminate();
    engine = null;
    engineModel = null;
    worker = null;
  }
  const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
  for (const v of new Set([id, id.replace('q4f16_1', 'q4f32_1')])) await deleteModelAllInfoInCache(v);
  setState({ phase: 'parado', progress: 0, text: '', model: null });
}

export type ChatMsg = ChatCompletionMessageParam;

/** Uma resposta em JSON que segue `schema` (a geração é restrita por gramática). */
export async function completeJSON(id: string, messages: ChatMsg[], schema: object, signal: AbortSignal): Promise<string> {
  const e = await loadModel(id);
  if (signal.aborted) throw new DOMException('parado', 'AbortError');
  const stop = () => e.interruptGenerate();
  signal.addEventListener('abort', stop, { once: true });
  try {
    const r = await e.chat.completions.create({
      messages,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object', schema: JSON.stringify(schema) },
    });
    if (signal.aborted) throw new DOMException('parado', 'AbortError');
    return r.choices[0]?.message?.content ?? '';
  } finally {
    signal.removeEventListener('abort', stop);
  }
}
