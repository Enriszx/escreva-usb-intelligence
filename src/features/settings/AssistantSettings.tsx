import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { useSettings } from '../../app/settings';
import { useConfirm, useToast } from '../../app/feedback';
import { useOnline } from '../../app/hooks';
import type { Settings } from '../../lib/storage/repos';
import { checkGpu, hasF16, deleteModel, getLoadState, GPU_MESSAGE, LOCAL_MODELS, loadModel, modelInfo, onLoadState, type GpuStatus, type LoadState } from '../assistant/webllm';

export function AssistantSettings({ set }: { set: (p: Partial<Settings>, msg: string) => Promise<void> }) {
  const { settings, update } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const online = useOnline();
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const [gpu, setGpu] = useState<GpuStatus>('verificando');
  const [load, setLoad] = useState<LoadState>(getLoadState);
  const [f16, setF16] = useState(true);

  useEffect(() => { checkGpu().then(setGpu); hasF16().then(setF16); }, []);
  useEffect(() => onLoadState(setLoad), []);
  useEffect(() => { if (hash === '#assistente') ref.current?.scrollIntoView({ block: 'start' }); }, [hash]);

  const model = modelInfo(settings.aiModel);
  const installed = settings.aiInstalled === model.id;
  const busy = load.phase === 'carregando';
  const pct = Math.round(load.progress * 100);

  const download = async () => {
    try {
      await loadModel(model.id);
      await update({ aiInstalled: model.id });
      toast({ tone: 'ok', title: 'IA ativada', body: 'O Vigia agora conversa livremente, direto do aparelho.' });
    } catch (e) {
      toast({ tone: 'erro', title: 'A IA não foi ativada', body: (e as Error).message });
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Apagar a IA deste aparelho?', body: 'Libera o espaço. O assistente volta ao modo de comandos até você baixar de novo.', confirm: 'Apagar', danger: true }))) return;
    try {
      await deleteModel(model.id);
      await update({ aiInstalled: null });
      toast({ tone: 'ok', title: 'IA apagada do aparelho' });
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível apagar', body: (e as Error).message });
    }
  };

  return (
    <section ref={ref} id="assistente" className="set-sec set-wide ai-settings" aria-labelledby="st-ai">
      <h2 id="st-ai" className="h3">Assistente (Vigia IA)</h2>
      <label className="switch">
        <span>Mostrar o assistente em todas as páginas</span>
        <input type="checkbox" checked={settings.assistant} onChange={(e) => set({ assistant: e.target.checked }, e.target.checked ? 'Assistente ligado' : 'Assistente desligado')} />
      </label>

      <div className="ai-modes">
        <div>
          <p className="label">Como ele funciona</p>
          <ul className="ai-mode-list">
            <li><strong>IA grátis no aparelho</strong>: um modelo de código aberto (Qwen2.5, da Alibaba, licença Apache 2.0) roda dentro do navegador pela WebGPU, com a biblioteca WebLLM. Não tem conta, chave nem cobrança. É baixado uma vez e depois funciona até sem internet.</li>
            <li><strong>Sem IA (comandos)</strong>: antes de baixar, ou em aparelhos sem WebGPU, ele entende comandos diretos (“procurar duplicados”, “organizar por tipo”…).</li>
          </ul>
          <p className="hint">Nos dois modos, nada sai do aparelho: nem a conversa, nem os arquivos. Mudanças em arquivos sempre pedem sua confirmação, e ele nunca apaga nada de vez. Uma IA pequena erra mais que as grandes da internet; confira o que ela disser.</p>
        </div>

        <div className="ai-key">
          <label className="field" htmlFor="ai-model">
            <span>Modelo</span>
            <select id="ai-model" className="select" value={model.id} disabled={busy} onChange={(e) => set({ aiModel: e.target.value }, 'Modelo escolhido')}>
              {LOCAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <p className="hint">{model.note} Usa cerca de {(model.vramMB[f16 ? 0 : 1] / 1024).toFixed(1).replace('.', ',')} GB de memória de vídeo enquanto conversa.</p>

          {gpu === 'verificando' ? null : gpu !== 'ok' ? (
            <p className="error-text">{GPU_MESSAGE[gpu]}</p>
          ) : busy ? (
            <div className="ai-progress" role="progressbar" aria-label="Baixando a IA" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
              <small className="mono">{pct}% · {load.text}</small>
            </div>
          ) : installed ? (
            <div className="ai-key-row">
              <span className="tag ok">IA ativa neste aparelho</span>
              <button type="button" className="btn btn-danger btn-sm" onClick={remove}><Trash2 aria-hidden /> Apagar do aparelho</button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={!online}>
              <Download aria-hidden /> {online ? 'Baixar e ativar a IA' : 'Precisa de internet para baixar'}
            </button>
          )}
          {load.phase === 'erro' && !busy && <p className="error-text">{load.text}</p>}
          <p className="hint">O download é grande (de algumas centenas de MB a perto de 2 GB, conforme o modelo): prefira o Wi-Fi. Ele fica guardado no navegador; “Apagar do aparelho” libera o espaço.</p>
        </div>
      </div>
    </section>
  );
}
