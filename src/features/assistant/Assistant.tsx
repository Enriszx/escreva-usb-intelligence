import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { ArrowUp, Download, RotateCcw, Square, X } from 'lucide-react';
import { useFiles } from '../files/store';
import { useFolder } from '../files/folder';
import { useSettings } from '../../app/settings';
import { useConfirm } from '../../app/feedback';
import { useOnline } from '../../app/hooks';
import { LogoMark } from '../../components/ui/Logo';
import { AssistantError, runDevice, type EngineKind } from './engines';
import { checkGpu, GPU_MESSAGE, getLoadState, loadModel, modelInfo, onLoadState, type ChatMsg, type GpuStatus, type LoadState } from './webllm';
import { runLocal } from './local';
import type { AssistantTool, ToolContext } from './tools';
import './assistant.css';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  tools: string[];
  state?: 'pensando' | 'erro' | 'parado';
}

const ENGINE_LABEL: Record<EngineKind, string> = {
  aparelho: 'IA no aparelho · grátis',
  local: 'Sem IA · comandos',
};

const SUGGESTIONS = [
  'Faça um resumo dos meus arquivos',
  'Procure duplicados',
  'Quais são os maiores arquivos?',
  'Organize por tipo',
  'Deixe o tema escuro',
  'Mude o personagem para o estilo Núcleo Azul',
];

/**
 * O Vigia IA: um painel de conversa disponível em todas as páginas. Escolhe
 * o motor sozinho (Claude da conta, Claude com chave própria ou comandos
 * offline) e age pelas mesmas funções que os botões do app usam.
 */
export function Assistant() {
  const files = useFiles();
  const folder = useFolder();
  const { settings, update } = useSettings();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpu, setGpu] = useState<GpuStatus>('verificando');
  const [load, setLoad] = useState<LoadState>(getLoadState);
  const seq = useRef(0);
  const ctl = useRef<AbortController | null>(null);
  const history = useRef<ChatMsg[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctxRef = useRef<ToolContext>();
  ctxRef.current = { files, folder, navigate, settings, updateSettings: update, confirm, report: () => {} };

  // Motor: a IA grátis do aparelho, quando há WebGPU e o modelo já foi baixado.
  useEffect(() => { if (open) checkGpu().then(setGpu); }, [open]);
  useEffect(() => onLoadState(setLoad), []);
  const model = modelInfo(settings.aiModel);
  const installed = settings.aiInstalled === model.id;
  const engine: EngineKind = gpu === 'ok' && installed ? 'aparelho' : 'local';

  const activate = useCallback(async () => {
    try {
      await loadModel(model.id);
      await update({ aiInstalled: model.id });
    } catch {
      /* o erro já aparece no cartão */
    }
  }, [model.id, update]);

  // Atalho: Ctrl/⌘ + K abre; Esc fecha.
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open && !document.querySelector('.modal-scrim')) setOpen(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs]);

  const patch = (id: number, p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
    setMsgs((all) => all.map((m) => (m.id === id ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m)));

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft('');
    const uid = ++seq.current;
    const aid = ++seq.current;
    setMsgs((m) => [...m, { id: uid, role: 'user', text: t, tools: [] }, { id: aid, role: 'assistant', text: '', tools: [], state: 'pensando' }]);
    setBusy(true);
    const c = new AbortController();
    ctl.current = c;
    // Getters: cada ferramenta lê o estado atual (a análise muda os arquivos no meio da conversa).
    const live = () => ctxRef.current!;
    const ctx: ToolContext = {
      get files() { return live().files; },
      get folder() { return live().folder; },
      get settings() { return live().settings; },
      navigate: ((...a: unknown[]) => (live().navigate as (...x: unknown[]) => void)(...a)) as NavigateFunction,
      updateSettings: (p) => live().updateSettings(p),
      confirm: (o) => live().confirm(o),
      report: (line) => patch(aid, (m) => ({ tools: [...m.tools, line] })),
    };
    const cb = {
      signal: c.signal,
      onText: (s: string) => patch(aid, { text: s, state: undefined }),
      onTool: (tool: AssistantTool) => patch(aid, (m) => ({ tools: [...m.tools, tool.label] })),
    };
    try {
      const answer = engine === 'aparelho' ? await runDevice(model.id, history.current, t, ctx, cb) : await runLocal(t, ctx, cb.onTool);
      patch(aid, { text: answer, state: undefined });
    } catch (e) {
      const err = e instanceof AssistantError ? e : new AssistantError((e as Error).message);
      patch(aid, (m) => ({ text: m.text ? `${m.text}\n\n${err.message}` : err.message, state: err.kind === 'cancelled' ? 'parado' : 'erro' }));
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  };

  const reset = () => {
    ctl.current?.abort();
    history.current = [];
    setMsgs([]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  if (!settings.assistant) return null;

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Abrir o assistente Vigia IA (Ctrl+K)">
          <LogoMark size={22} />
          <span>Pergunte ao Vigia</span>
        </button>
      )}
      {open && (
        <section className="ai-panel" role="dialog" aria-label="Assistente Vigia IA" data-tone="grafite">
          <header className="ai-head">
            <div className="ai-title">
              <LogoMark size={26} />
              <div>
                <strong>Vigia IA</strong>
                <span className={`ai-engine is-${engine}`}>{ENGINE_LABEL[engine]}</span>
              </div>
            </div>
            <div className="ai-head-actions">
              <button className="ai-icon" onClick={reset} aria-label="Nova conversa" title="Nova conversa" disabled={!msgs.length}><RotateCcw aria-hidden /></button>
              <button className="ai-icon" onClick={() => setOpen(false)} aria-label="Fechar o assistente"><X aria-hidden /></button>
            </div>
          </header>

          <div className="ai-list" ref={list} aria-live="polite">
            {!msgs.length && (
              <div className="ai-empty">
                <p className="ai-hello">Diga o que precisa. Eu analiso, procuro, organizo, mudo o tema, ajusto o personagem e levo você à tela certa.</p>
                {engine === 'local' && gpu !== 'verificando' && (
                  gpu !== 'ok' ? (
                    <p className="hint">{GPU_MESSAGE[gpu]} Enquanto isso, entendo comandos diretos.</p>
                  ) : (
                    <div className="ai-activate">
                      <p><strong>Ative a IA grátis.</strong> Ela roda aqui no aparelho, sem conta e sem custo. Baixa uma vez ({model.label}) e depois funciona até offline.</p>
                      {load.phase === 'carregando' ? (
                        <div className="ai-progress" role="progressbar" aria-label="Baixando a IA" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(load.progress * 100)}>
                          <span style={{ width: `${Math.round(load.progress * 100)}%` }} />
                          <small className="mono">{Math.round(load.progress * 100)}% · {load.text}</small>
                        </div>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={activate} disabled={!online}>
                          <Download aria-hidden /> {online ? 'Baixar e ativar a IA' : 'Precisa de internet para baixar'}
                        </button>
                      )}
                      {load.phase === 'erro' && <p className="error-text">{load.text}</p>}
                      <p className="hint">Até lá, entendo comandos diretos. <Link to="/configuracoes#assistente" onClick={() => setOpen(false)}>Escolher o modelo</Link></p>
                    </div>
                  )
                )}
                <ul className="ai-sugg">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}><button onClick={() => send(s)}>{s}</button></li>
                  ))}
                </ul>
                <p className="ai-privacy mono">
                  Nada sai deste aparelho: a conversa e os arquivos ficam aqui.
                </p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`ai-msg is-${m.role} ${m.state ? `is-${m.state}` : ''}`}>
                {m.tools.length > 0 && (
                  <ul className="ai-tools mono">{m.tools.map((t, i) => <li key={i}>{t}</li>)}</ul>
                )}
                {m.state === 'pensando' && !m.text ? <p className="ai-thinking">{load.phase === 'carregando' ? `Carregando a IA… ${Math.round(load.progress * 100)}%` : 'Pensando…'}</p> : <p className="ai-text">{m.text}</p>}
              </div>
            ))}
          </div>

          <form className="ai-form" onSubmit={onSubmit}>
            <label htmlFor="ai-input" className="sr-only">Mensagem para o assistente</label>
            <textarea
              id="ai-input"
              ref={input}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder={engine === 'local' ? 'Ex.: procurar duplicados' : 'Pergunte ou peça qualquer coisa'}
              maxLength={4000}
            />
            {busy ? (
              <button type="button" className="ai-send is-stop" onClick={() => ctl.current?.abort()} aria-label="Parar"><Square aria-hidden /></button>
            ) : (
              <button type="submit" className="ai-send" disabled={!draft.trim()} aria-label="Enviar"><ArrowUp aria-hidden /></button>
            )}
          </form>
        </section>
      )}
    </>
  );
}
