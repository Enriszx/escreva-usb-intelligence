import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Circle, FileSearch, Loader2, MinusCircle, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone, Usb } from 'lucide-react';
import { useAuto, type AutoPhase, type StepStatus } from './auto';
import { useFiles } from '../files/store';
import { useSettings } from '../../app/settings';
import { useConfirm, useToast } from '../../app/feedback';
import { useDocumentTitle } from '../../app/hooks';
import { BarList } from '../../components/charts/BarList';
import { CAT_VAR } from '../../components/charts/colors';
import { CRITERION_LABEL, type OrganizeCriterion } from '../../lib/analysis/organize';
import { CATEGORY_LABEL } from '../../lib/analysis/types';
import { formatBytes, formatDateTime, pct, plural } from '../../lib/format';
import type { Settings } from '../../lib/storage/repos';
import './auto.css';

const TITLE: Record<AutoPhase, string> = {
  indisponivel: 'Este navegador não acessa pastas',
  'sem-config': 'Conecte o pendrive uma vez',
  aguardando: 'Aguardando o pendrive',
  'precisa-toque': 'Falta só uma confirmação',
  executando: 'Trabalhando no seu pendrive',
  pronto: 'Pendrive pronto',
  erro: 'O automático parou',
};

const STATUS_ICON: Record<StepStatus, typeof Circle> = { pendente: Circle, andamento: Loader2, feito: CheckCircle2, pulado: MinusCircle, erro: AlertCircle };
const STATUS_TEXT: Record<StepStatus, string> = { pendente: 'Na fila', andamento: 'Em andamento', feito: 'Concluído', pulado: 'Não executado', erro: 'Erro' };

const secs = (ms: number) => (ms < 1000 ? 'menos de 1 s' : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

export default function AutoPage() {
  useDocumentTitle('Modo automático');
  const auto = useAuto();
  const files = useFiles();
  const { settings, update } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const [view, setView] = useState<'bytes' | 'count'>('bytes');
  const run = files.run;
  const r = auto.result;
  const busy = auto.phase === 'executando';

  const set = async (p: Partial<Settings>, msg: string) => {
    try {
      await update(p);
      toast({ tone: 'ok', title: msg, body: 'Salvo neste aparelho.' });
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: (e as Error).message });
    }
  };

  const toggleTrash = async (on: boolean) => {
    if (on && !(await confirm({
      title: 'Mandar cópias extras para a lixeira sozinho?',
      body: 'Em cada grupo de arquivos idênticos (mesmo SHA-256), fica o mais antigo. As outras cópias vão para a lixeira do app, uma pasta “.usbi-lixeira” no próprio pendrive. Nada é apagado de vez: dá para restaurar na Central de arquivos → Lixeira.',
      confirm: 'Ligar',
    }))) return;
    await set({ autoTrashDupes: on }, on ? 'Cópias irão para a lixeira sozinhas' : 'Cópias só serão apontadas');
  };
  const toggleOrganize = async (on: boolean) => {
    if (on && !(await confirm({
      title: 'Organizar em pastas sozinho?',
      body: `Os arquivos serão MOVIDOS para pastas dentro do pendrive (critério: ${CRITERION_LABEL[settings.autoCriterion].toLowerCase()}). Nada é apagado. Para voltar, use “Desfazer” na Central de arquivos antes de remover o pendrive ou recarregar a página.`,
      confirm: 'Ligar',
    }))) return;
    await set({ autoOrganize: on }, on ? 'Organização automática ligada' : 'Organização só como plano');
  };

  const primary = (() => {
    switch (auto.phase) {
      case 'sem-config': return { label: 'Conectar pendrive', act: auto.start, Icon: Usb };
      case 'precisa-toque': return { label: `Continuar com “${auto.drive}”`, act: auto.start, Icon: ShieldCheck };
      case 'aguardando': return null;
      case 'executando': return null;
      case 'pronto': return { label: 'Executar de novo', act: auto.runNow, Icon: RefreshCw };
      case 'erro': return { label: 'Tentar de novo', act: auto.start, Icon: RefreshCw };
      default: return null;
    }
  })();

  const cats = (r?.byCategory ?? []).filter((c) => c.count > 0).sort((a, b) => (view === 'bytes' ? b.bytes - a.bytes : b.count - a.count));
  const totalBytes = r?.bytes ?? 0;
  const totalCount = r?.files ?? 0;

  return (
    <div className="page wrap auto-page">
      <header className="page-head">
        <div>
          <span className="label">Operação</span>
          <h1 className="h1">Encaixe o pendrive. <span className="grad-text">O resto é automático.</span></h1>
        </div>
        <p className="lead">
          Depois de autorizar uma vez, o USB Intelligence percebe quando o pendrive é encaixado e faz tudo sozinho: lê, verifica cada arquivo,
          encontra cópias, organiza e gera o relatório. Tudo neste aparelho.
        </p>
        <span className="page-n outline-num" aria-hidden>02</span>
      </header>

      <div className="auto-top">
        {/* ---------- Estado ---------- */}
        <section className={`card auto-status is-${auto.phase}`} aria-labelledby="auto-status-t" aria-live="polite">
          <DriveArt phase={auto.phase} />
          <div className="auto-status-body">
            <span className="label">Estado</span>
            <h2 id="auto-status-t" className="h2">{TITLE[auto.phase]}</h2>
            <p className="muted">
              {auto.phase === 'indisponivel' && 'O navegador do celular (e o Firefox/Safari) não deixa sites abrirem pastas. Instale o app Android, onde o automático funciona, ou escolha os arquivos manualmente na Central.'}
              {auto.phase === 'sem-config' && 'Toque abaixo e escolha a pasta raiz do pendrive (por exemplo, E:\\). Se o navegador perguntar, escolha “Permitir em todas as visitas”: assim, nas próximas vezes, basta encaixar.'}
              {auto.phase === 'aguardando' && `Encaixe ${auto.drive ? `“${auto.drive}”` : 'o pendrive'} e eu começo sozinho. Esta página pode ficar aberta em segundo plano.`}
              {auto.phase === 'precisa-toque' && 'O navegador guardou a pasta, mas pede um toque seu antes de liberar o acesso de novo. Para não precisar mais, escolha “Permitir em todas as visitas”.'}
              {auto.phase === 'executando' && 'Pode continuar usando o app. Eu aviso quando terminar.'}
              {auto.phase === 'pronto' && (r ? `Última execução ${formatDateTime(r.at)}, em ${secs(r.durationMs)}. Remova o pendrive quando quiser; ao encaixar de novo, eu repito tudo.` : 'Conectado. Toque em executar para começar.')}
              {auto.phase === 'erro' && 'Algo impediu uma das etapas (veja abaixo). Confira se o pendrive continua encaixado e tente de novo.'}
            </p>
            {busy && run && (
              <div className="auto-progress">
                <div className="progress"><i style={{ width: `${run.totalBytes ? (run.doneBytes / run.totalBytes) * 100 : 0}%` }} /></div>
                <span className="mono muted num">{run.filesDone}/{run.filesTotal} arquivos · {formatBytes(run.doneBytes)} de {formatBytes(run.totalBytes)}</span>
              </div>
            )}
            <div className="btn-row">
              {primary && (
                <button className="btn btn-primary btn-lg" onClick={() => primary.act()} disabled={busy}>
                  <primary.Icon aria-hidden /> {primary.label}
                </button>
              )}
              {auto.supported && auto.phase !== 'sem-config' && (
                <button className="btn btn-ghost" onClick={() => auto.choose()} disabled={busy}>Escolher outro pendrive</button>
              )}
              {auto.phase === 'indisponivel' && (
                <>
                  <Link className="btn btn-primary" to="/arquivos"><FileSearch aria-hidden /> Escolher arquivos</Link>
                  <Link className="btn btn-ghost" to="/ajuda">Instalar o app Android</Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Etapas ---------- */}
        <section className="card auto-steps" aria-labelledby="auto-steps-t">
          <div className="card-head">
            <h2 id="auto-steps-t" className="h3">Etapas</h2>
            <span className="mono muted">{auto.steps.filter((s) => s.status === 'feito').length}/{auto.steps.length}</span>
          </div>
          <ol className="steps-v">
            {auto.steps.map((s, i) => {
              const Icon = STATUS_ICON[s.status];
              return (
                <li key={s.key} className={`sv is-${s.status}`}>
                  <span className="sv-ico" aria-hidden><Icon /></span>
                  <div className="sv-body">
                    <p className="sv-title"><span className="mono muted">{String(i + 1).padStart(2, '0')}</span> {s.label}</p>
                    <p className="sv-detail muted">
                      <span className="sr-only">{STATUS_TEXT[s.status]}. </span>
                      {s.status === 'andamento' && s.key === 'verificar' && run ? `${run.filesDone}/${run.filesTotal} arquivos verificados…` : s.detail ?? STATUS_TEXT[s.status]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="auto-bottom">
        {/* ---------- Resultado ---------- */}
        <section className="card auto-result" aria-labelledby="auto-res-t">
          <div className="card-head">
            <div>
              <h2 id="auto-res-t" className="h3">Resultado</h2>
              <p className="muted small">{r ? `${r.drive} · ${formatDateTime(r.at)}` : 'Aparece aqui depois da primeira execução.'}</p>
            </div>
            {r?.reportId && <Link className="btn btn-ghost btn-sm" to={`/relatorios?id=${r.reportId}`}>Abrir relatório <ArrowRight className="arrow" aria-hidden /></Link>}
          </div>
          {r ? (
            <>
              <dl className="stat-grid">
                <div className="stat"><dt>Arquivos</dt><dd className="num">{r.files.toLocaleString('pt-BR')}</dd><dd className="stat-sub muted">{formatBytes(r.bytes)}</dd></div>
                <div className="stat"><dt>Verificados</dt><dd className="num">{pct(r.hashed, r.files)}</dd><dd className="stat-sub muted">{r.hashed.toLocaleString('pt-BR')} com SHA-256</dd></div>
                <div className="stat"><dt>Cópias extras</dt><dd className="num">{r.copies.toLocaleString('pt-BR')}</dd><dd className="stat-sub muted">{formatBytes(r.recoverable)} recuperáveis</dd></div>
                <div className="stat"><dt>{r.organized ? 'Organizados' : 'A organizar'}</dt><dd className="num">{(r.organized || r.planned).toLocaleString('pt-BR')}</dd><dd className="stat-sub muted">{r.organized ? `em ${plural(r.plannedFolders, 'pasta', 'pastas')}` : `plano: ${plural(r.plannedFolders, 'pasta', 'pastas')}`}</dd></div>
              </dl>
              <div className="chart-head">
                <h3 className="chart-title">{view === 'bytes' ? 'Espaço por tipo de arquivo' : 'Quantidade por tipo de arquivo'}</h3>
                <div className="seg" role="radiogroup" aria-label="Medida do gráfico">
                  <label><input type="radio" name="auto-view" checked={view === 'bytes'} onChange={() => setView('bytes')} /><span>Espaço</span></label>
                  <label><input type="radio" name="auto-view" checked={view === 'count'} onChange={() => setView('count')} /><span>Quantidade</span></label>
                </div>
              </div>
              <BarList
                title={view === 'bytes' ? 'Espaço por tipo de arquivo' : 'Quantidade por tipo de arquivo'}
                data={cats.map((c) => ({
                  key: c.category,
                  label: CATEGORY_LABEL[c.category],
                  value: view === 'bytes' ? c.bytes : c.count,
                  color: CAT_VAR[c.category],
                  detail: view === 'bytes' ? `${pct(c.bytes, totalBytes)} do espaço · ${plural(c.count, 'arquivo', 'arquivos')}` : `${pct(c.count, totalCount)} dos arquivos · ${formatBytes(c.bytes)}`,
                }))}
                format={view === 'bytes' ? formatBytes : (v) => v.toLocaleString('pt-BR')}
              />
            </>
          ) : (
            <div className="empty-state">
              <Usb aria-hidden />
              <p className="muted">Nenhuma execução ainda. Conecte o pendrive para ver números reais aqui.</p>
            </div>
          )}
        </section>

        {/* ---------- Ajustes ---------- */}
        <section className="card auto-settings" aria-labelledby="auto-set-t">
          <div className="card-head"><h2 id="auto-set-t" className="h3">O que fazer sozinho</h2></div>
          <label className="switch">
            <span><strong>Executar ao detectar o pendrive</strong><small className="hint">Desligado: só conecta; você toca em executar.</small></span>
            <input type="checkbox" checked={settings.autoRun} onChange={(e) => set({ autoRun: e.target.checked }, e.target.checked ? 'Execução automática ligada' : 'Execução automática desligada')} />
          </label>
          <label className="switch">
            <span><strong>Verificação completa (SHA-256)</strong><small className="hint">Desligado: verifica só os que podem ser cópias — bem mais rápido.</small></span>
            <input type="checkbox" checked={settings.autoDeep} onChange={(e) => set({ autoDeep: e.target.checked }, e.target.checked ? 'Verificação completa' : 'Verificação rápida')} />
          </label>
          <label className="switch">
            <span><strong>Cópias extras para a lixeira do app</strong><small className="hint">Fica o mais antigo de cada grupo. Restaurável.</small></span>
            <input type="checkbox" checked={settings.autoTrashDupes} onChange={(e) => toggleTrash(e.target.checked)} />
          </label>
          <label className="switch">
            <span><strong>Organizar em pastas</strong><small className="hint">Move os arquivos dentro do pendrive. Desligado: só gera o plano.</small></span>
            <input type="checkbox" checked={settings.autoOrganize} onChange={(e) => toggleOrganize(e.target.checked)} />
          </label>
          <label className="field" htmlFor="auto-crit">
            <span>Critério das pastas</span>
            <select id="auto-crit" className="select" value={settings.autoCriterion} onChange={(e) => set({ autoCriterion: e.target.value as OrganizeCriterion }, 'Critério atualizado')}>
              {(Object.keys(CRITERION_LABEL) as OrganizeCriterion[]).map((c) => <option key={c} value={c}>{CRITERION_LABEL[c]}</option>)}
            </select>
          </label>
          <p className="hint">Nada é apagado de vez pelo automático. Toda ação fica no Histórico.</p>
        </section>
      </div>

      {/* ---------- Onde funciona ---------- */}
      <section className="auto-where" aria-labelledby="auto-where-t">
        <h2 id="auto-where-t" className="h3">Onde o automático funciona</h2>
        <ul className="where-grid">
          <li className="card"><MonitorSmartphone aria-hidden /><strong>Computador · Chrome ou Edge</strong><span className="muted">Detecta o pendrive sozinho. Escolha “Permitir em todas as visitas” na primeira vez.</span><span className="tag ok">Automático</span></li>
          <li className="card"><Smartphone aria-hidden /><strong>Celular · app Android (APK)</strong><span className="muted">Com o adaptador OTG. O acesso à pasta fica salvo no Android.</span><span className="tag ok">Automático</span></li>
          <li className="card"><Smartphone aria-hidden /><strong>Celular · navegador</strong><span className="muted">O navegador não abre pastas. Escolha os arquivos na Central: a análise é a mesma.</span><span className="tag warn">Manual</span></li>
        </ul>
      </section>
    </div>
  );
}

/** Ilustração do pendrive: entra na porta quando conectado, pulsa enquanto trabalha. */
function DriveArt({ phase }: { phase: AutoPhase }) {
  return (
    <svg className="drive-art" viewBox="0 0 262 140" aria-hidden>
      <defs>
        <linearGradient id="da-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00b347" />
          <stop offset="1" stopColor="#006b2c" />
        </linearGradient>
      </defs>
      <rect className="da-port" x="8" y="44" width="62" height="52" rx="10" />
      <rect className="da-slot" x="52" y="58" width="22" height="24" rx="3" />
      <g className="da-drive">
        <rect x="70" y="60" width="26" height="20" rx="2" fill="#c9d3cc" />
        <rect x="74" y="64" width="6" height="5" fill="#7d8a82" /><rect x="86" y="64" width="6" height="5" fill="#7d8a82" />
        <rect x="96" y="46" width="112" height="48" rx="12" fill="url(#da-body)" />
        <path d="M152 52 L176 70 L152 88 L128 70 Z" fill="#ffdf00" />
        <circle cx="152" cy="70" r="9" fill="#0a2b78" />
        <circle className="da-led" cx="198" cy="58" r="4" />
      </g>
      {phase === 'pronto' && <path className="da-check" d="M30 70 l8 8 l16 -16" />}
    </svg>
  );
}
