import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { ArrowUp, Check, Copy, Download, Globe, RotateCcw, Square, X } from 'lucide-react';
import { useFiles } from '../files/store';
import { useFolder } from '../files/folder';
import { useSettings } from '../../app/settings';
import { useConfirm } from '../../app/feedback';
import { useOnline } from '../../app/hooks';
import { LogoMark } from '../../components/ui/Logo';
import { AssistantError, runDevice, type EngineKind } from './engines';
import { checkGpu, GPU_MESSAGE, getLoadState, loadModel, modelInfo, onLoadState, type ChatMsg, type GpuStatus, type LoadState } from './webllm';
import { OnlineError, runOnline, type OAMsg } from './online';
import { runLocal } from './local';
import { Markdown } from './Markdown';
import type { AssistantTool, ToolContext } from './tools';
import './assistant.css';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  tools: string[];
  state?: 'pensando' | 'escrevendo' | 'erro' | 'parado';
  note?: string;
}

const ENGINE_LABEL: Record<EngineKind, string> = {
  online: 'IA online · grátis',
  aparelho: 'IA no aparelho · grátis',
  local: 'Sem IA · comandos',
};

const APP_SUGGESTIONS = ['Faça um resumo dos meus arquivos', 'Procure duplicados', 'Organize por tipo', 'Deixe o tema escuro'];
const AI_SUGGESTIONS = ['Explique o que é um hash SHA-256', 'Escreva uma mensagem pedindo uma reunião', 'Como organizar fotos de viagem?'];

/* Conversa guardada neste navegador (conveniência; nunca vai para o backup). */
const STORE = 'usbi.vigia.conversa';
interface Saved { msgs: Msg[]; online: OAMsg[]; device: ChatMsg[] }
function loadSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null;
    return v && Array.isArray(v.msgs) ? v : null;
  } catch {
    return null;
  }
}
function save(v: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ msgs: v.msgs.slice(-60), online: v.online.slice(-40), device: v.device.slice(-16) }));
  } catch {
    /* sem armazenamento: a conversa vale até fechar a página */
  }
}

/**
 * O Vigia IA: conversa disponível em todas as páginas. Motores, em ordem:
 * IA online grátis (se o usuário autorizou), IA no aparelho (se baixada e com
 * WebGPU) e comandos diretos. Age pelas mesmas funções que os botões do app.
 */
export function Assistant() {
  const files = useFiles();
  const folder = useFolder();
  const { settings, update } = useSettings();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const online = useOnline();
  const saved = useRef(loadSaved());
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => saved.current?.msgs.filter((m) => !m.state || m.state === 'erro') ?? []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [gpu, setGpu] = useState<GpuStatus>('verificando');
  const [load, setLoad] = useState<LoadState>(getLoadState);
  const seq = useRef(Math.max(0, ...msgs.map((m) => m.id)));
  const ctl = useRef<AbortController | null>(null);
  const deviceHist = useRef<ChatMsg[]>(saved.current?.device ?? []);
  const onlineHist = useRef<OAMsg[]>(saved.current?.online ?? []);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctxRef = useRef<ToolContext>();
  ctxRef.current = { files, folder, navigate, settings, updateSettings: update, confirm, report: () => {} };

  useEffect(() => { if (open) checkGpu().then(setGpu); }, [open]);
  useEffect(() => onLoadState(setLoad), []);
  useEffect(() => { if (!busy) save({ msgs, online: onlineHist.current, device: deviceHist.current }); }, [msgs, busy]);

  const model = modelInfo(settings.aiModel);
  const deviceReady = gpu === 'ok' && settings.aiInstalled === model.id;
  const engine: EngineKind = settings.aiOnline && online ? 'online' : deviceReady ? 'aparelho' : 'local';

  const activateDevice = useCallback(async () => {
    try {
      await loadModel(model.id);
      await update({ aiInstalled: model.id });
    } catch {
      /* o erro aparece no cartão */
    }
  }, [model.id, update]);
  const activateOnline = () => update({ aiOnline: true });

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
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs, open]);

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
      onText: (s: string) => patch(aid, { text: s, state: 'escrevendo' }),
      onTool: (tool: AssistantTool) => patch(aid, (m) => ({ tools: [...m.tools, tool.label] })),
    };
    try {
      let answer: string;
      let note: string | undefined;
      if (engine === 'online') {
        try {
          answer = await runOnline(onlineHist.current, t, ctx, cb);
        } catch (e) {
          if (!(e instanceof OnlineError) || e.kind === 'cancelled') throw e;
          // A IA online falhou: tenta a do aparelho e, por fim, os comandos.
          const fallback = deviceReady ? await runDevice(model.id, deviceHist.current, t, ctx, cb) : await runLocal(t, ctx, cb.onTool, true);
          if (fallback === null) throw new AssistantError(e.message);
          answer = fallback;
          note = `${e.message} Respondi ${deviceReady ? 'com a IA do aparelho' : 'pelo modo de comandos'}.`;
        }
      } else if (engine === 'aparelho') {
        answer = await runDevice(model.id, deviceHist.current, t, ctx, cb);
      } else {
        answer = await runLocal(t, ctx, cb.onTool);
      }
      patch(aid, { text: answer, state: undefined, note });
    } catch (e) {
      const cancelled = (e instanceof AssistantError || e instanceof OnlineError) && e.kind === 'cancelled';
      const msg = cancelled ? 'Parado.' : (e as Error).message;
      patch(aid, (m) => ({ text: m.text ? `${m.text}\n\n${msg}` : msg, state: cancelled ? 'parado' : 'erro' }));
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  };

  const reset = () => {
    ctl.current?.abort();
    deviceHist.current = [];
    onlineHist.current = [];
    setMsgs([]);
  };

  const copy = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.id);
      setTimeout(() => setCopied((x) => (x === m.id ? null : x)), 1500);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
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

  const pct = Math.round(load.progress * 100);
  const suggestions = engine === 'local' ? APP_SUGGESTIONS : [...APP_SUGGESTIONS.slice(0, 2), ...AI_SUGGESTIONS];

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
                <p className="ai-hello">
                  {engine === 'local'
                    ? 'Diga o que precisa. Eu analiso, procuro, organizo, mudo o tema, ajusto o personagem e levo você à tela certa.'
                    : 'Pergunte qualquer coisa: dúvidas, textos, explicações, ideias. E peça ações no app: analisar, achar duplicados, organizar, mudar o tema ou o personagem.'}
                </p>

                {!settings.aiOnline && (
                  <div className="ai-activate">
                    <p><strong>IA completa, grátis.</strong> Responde qualquer assunto e usa o app por você. Roda num serviço online gratuito (modelo aberto gpt-oss-20b), sem conta e sem chave.</p>
                    <button className="btn btn-primary btn-sm" onClick={activateOnline} disabled={!online}>
                      <Globe aria-hidden /> {online ? 'Ativar IA online grátis' : 'Precisa de internet'}
                    </button>
                    <p className="hint">Vão para o serviço suas mensagens e dados dos arquivos que a IA consultar (nomes, tamanhos, datas). Nunca o conteúdo dos arquivos.</p>
                  </div>
                )}

                {engine !== 'aparelho' && gpu === 'ok' && !deviceReady && (
                  <div className="ai-activate is-alt">
                    <p><strong>{settings.aiOnline ? 'Para usar sem internet:' : 'Ou, 100% privada:'}</strong> baixe a IA para este aparelho ({model.label}). Funciona offline e nada sai daqui; é menor e entende menos.</p>
                    {load.phase === 'carregando' ? (
                      <div className="ai-progress" role="progressbar" aria-label="Baixando a IA" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <span style={{ width: `${pct}%` }} />
                        <small className="mono">{pct}% · {load.text}</small>
                      </div>
                    ) : (
                      <button className="btn btn-sm" onClick={activateDevice} disabled={!online}>
                        <Download aria-hidden /> {online ? 'Baixar IA no aparelho' : 'Precisa de internet para baixar'}
                      </button>
                    )}
                    {load.phase === 'erro' && <p className="error-text">{load.text}</p>}
                  </div>
                )}
                {engine === 'local' && settings.aiOnline && !online && <p className="hint">Sem internet agora: entendo comandos diretos até a conexão voltar.</p>}
                {engine === 'local' && !settings.aiOnline && gpu !== 'ok' && gpu !== 'verificando' && <p className="hint">{GPU_MESSAGE[gpu]}</p>}

                <ul className="ai-sugg">
                  {suggestions.map((s) => (
                    <li key={s}><button onClick={() => send(s)}>{s}</button></li>
                  ))}
                </ul>
                <p className="ai-privacy mono">
                  {engine === 'online'
                    ? 'IA online: suas mensagens vão para o serviço gratuito. Conteúdo de arquivos, nunca.'
                    : 'Nada sai deste aparelho: a conversa e os arquivos ficam aqui.'}{' '}
                  <Link to="/configuracoes#assistente" onClick={() => setOpen(false)}>Ajustes da IA</Link>
                </p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`ai-msg is-${m.role} ${m.state ? `is-${m.state}` : ''}`}>
                {m.tools.length > 0 && (
                  <ul className="ai-tools mono">{m.tools.map((t, i) => <li key={i}>{t}</li>)}</ul>
                )}
                {m.state === 'pensando' && !m.text ? (
                  <p className="ai-thinking">{engine === 'aparelho' && load.phase === 'carregando' ? `Carregando a IA… ${pct}%` : 'Pensando…'}</p>
                ) : m.role === 'assistant' ? (
                  <Markdown text={m.text} />
                ) : (
                  <p className="ai-text">{m.text}</p>
                )}
                {m.note && <p className="ai-note">{m.note}</p>}
                {m.role === 'assistant' && !m.state && m.text && (
                  <button className="ai-copy" onClick={() => copy(m)} aria-label="Copiar resposta" title="Copiar">
                    {copied === m.id ? <Check aria-hidden /> : <Copy aria-hidden />}
                  </button>
                )}
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
              maxLength={8000}
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
