import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, ArrowUpRight, Copy, FileBarChart2, FolderTree, Fingerprint, Lock, ScanSearch, Undo2, Usb,
} from 'lucide-react';
import { ROUTES } from '../../app/routes';
import { useSettings } from '../../app/settings';
import { useDocumentTitle, usePWA } from '../../app/hooks';
import { promptInstall } from '../../lib/pwa/pwa';
import { useToast } from '../../app/feedback';
import { BarList } from '../../components/charts/BarList';
import { CAT_VAR } from '../../components/charts/colors';
import { HashPlayground } from './HashPlayground';
import { formatBytes, pct } from '../../lib/format';
import { CATEGORY_LABEL, type Category } from '../../lib/analysis/types';
import '../../styles/home-v2.css';

/* Amostra FICTÍCIA para a demonstração. Nunca se mistura com os dados do usuário. */
const DEMO: Record<Category, { bytes: number; count: number }> = {
  videos: { bytes: 6_800_000_000, count: 64 },
  imagens: { bytes: 3_100_000_000, count: 1_420 },
  compactados: { bytes: 1_250_000_000, count: 38 },
  audios: { bytes: 960_000_000, count: 212 },
  documentos: { bytes: 412_000_000, count: 860 },
  apresentacoes: { bytes: 240_000_000, count: 47 },
  outros: { bytes: 180_000_000, count: 95 },
  planilhas: { bytes: 85_000_000, count: 131 },
};
const DEMO_TOTAL = Object.values(DEMO).reduce((a, b) => ({ bytes: a.bytes + b.bytes, count: a.count + b.count }), { bytes: 0, count: 0 });

const FLOW = [
  { Icon: Usb, title: 'Detecta o pendrive', text: 'Você encaixa; o app percebe sozinho e assume a partir daí.' },
  { Icon: ScanSearch, title: 'Lê e classifica', text: 'Cada arquivo recebe um tipo: documento, imagem, vídeo, planilha, áudio.' },
  { Icon: Fingerprint, title: 'Verifica por SHA-256', text: 'Calcula a impressão digital de cada arquivo, inteira no aparelho.' },
  { Icon: Copy, title: 'Encontra cópias', text: 'Compara conteúdo, não nome. Mostra quanto espaço há para recuperar.' },
  { Icon: FolderTree, title: 'Organiza', text: 'Monta pastas por tipo, data ou tamanho — e move, com a sua permissão.' },
  { Icon: FileBarChart2, title: 'Relata', text: 'Gera o relatório com números reais, pronto para exportar em CSV ou JSON.' },
];

const PILLARS = [
  { Icon: Lock, title: 'Privado por projeto', text: 'Nenhum arquivo sai do aparelho. A IA é opcional e nunca recebe o conteúdo.' },
  { Icon: Fingerprint, title: 'Integridade verificável', text: 'SHA-256 por arquivo e cofre AES-256-GCM com chave derivada da sua senha.' },
  { Icon: Undo2, title: 'Reversível', text: 'Nada é apagado sem confirmação. Cópias vão para uma lixeira restaurável.' },
];

export default function HomePage() {
  useDocumentTitle('');
  const { reducedMotion, loaded, settings } = useSettings();
  const pwa = usePWA();
  const toast = useToast();
  const [view, setView] = useState<'bytes' | 'count'>('bytes');
  const intro = loaded && settings.intro && !reducedMotion;

  // Garante o modo calmo de fundo mesmo se a classe do shell não tiver sido aplicada ainda.
  useEffect(() => {
    document.querySelector('.app')?.classList.add('is-home2');
    return () => { document.querySelector('.app')?.classList.remove('is-home2'); };
  }, []);

  const rise = (i: number) => (intro
    ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.04 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } }
    : { initial: false as const });

  const demoRows = (Object.keys(DEMO) as Category[])
    .map((c) => ({ c, ...DEMO[c] }))
    .sort((a, b) => (view === 'bytes' ? b.bytes - a.bytes : b.count - a.count));
  const topThree = demoRows.slice(0, 3);
  const maxBytes = topThree[0]?.bytes ?? 1;

  return (
    <div className="home2">
      {/* ===================== HERO ===================== */}
      <section className="h2-hero" aria-labelledby="h2-title">
        <div className="wrap h2-hero-grid">
          <div className="h2-hero-copy">
            <motion.span className="h2-eyebrow" {...rise(0)}>USB Intelligence · inteligência de arquivos <span>local</span></motion.span>
            <motion.h1 id="h2-title" className="h2-title" {...rise(1)}>
              Arquivos sob controle,<br /><em>sem sair do aparelho.</em>
            </motion.h1>
            <motion.p className="h2-sub" {...rise(2)}>
              Leitura, verificação por SHA-256, detecção de cópias e organização do conteúdo de
              qualquer pendrive — com o processamento inteiro no seu dispositivo.
            </motion.p>
            <motion.div className="h2-actions" {...rise(3)}>
              <Link to="/automatico" className="h2-btn h2-btn-primary">Começar <ArrowRight aria-hidden /></Link>
              <Link to="/arquivos" className="h2-btn h2-btn-ghost">Abrir a central de arquivos</Link>
            </motion.div>
            <motion.dl className="h2-facts" {...rise(4)}>
              <div className="h2-fact"><dt>Processamento</dt><dd>No aparelho</dd></div>
              <div className="h2-fact"><dt>Verificação</dt><dd>SHA-256</dd></div>
              <div className="h2-fact"><dt>Cofre</dt><dd>AES-256</dd></div>
            </motion.dl>
          </div>

          <motion.div className="h2-panel" {...rise(2)} aria-hidden>
            <div className="h2-panel-bar">
              <span className="dot" />
              <strong>Resultado da análise</strong>
              <span className="tail">demonstração</span>
            </div>
            <div className="h2-panel-body">
              <div className="h2-readout">
                <div><span>Arquivos</span><b>{DEMO_TOTAL.count.toLocaleString('pt-BR')}</b></div>
                <div><span>Recuperável</span><b className="accent">{formatBytes(2_340_000_000)}</b></div>
              </div>
              <div className="h2-bars">
                {topThree.map((d) => (
                  <div className="h2-bars-row" key={d.c}>
                    <span className="lbl">{CATEGORY_LABEL[d.c]}</span>
                    <span className="track"><i style={{ width: `${Math.max(10, (d.bytes / maxBytes) * 100)}%` }} /></span>
                    <span className="val">{formatBytes(d.bytes)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h2-panel-foot"><Fingerprint aria-hidden /> 100% verificado · dados de exemplo, não são seus arquivos</div>
          </motion.div>
        </div>
      </section>

      {/* ===================== INSTALAR ===================== */}
      {!pwa.installed && (
        <section className="wrap" aria-label="Instalar o app">
          <div className="h2-install">
            <div>
              <strong>Instalar no aparelho</strong>
              <p>Use como app no celular ou computador: funciona offline e recebe arquivos de fora.</p>
            </div>
            {pwa.installable ? (
              <button className="h2-btn h2-btn-ghost" onClick={async () => { const r = await promptInstall(); if (r === 'accepted') toast({ tone: 'ok', title: 'App instalado' }); }}>Instalar</button>
            ) : (
              <small>Celular: menu do navegador → Instalar app. Computador: Chrome/Edge → Instalar.</small>
            )}
          </div>
        </section>
      )}

      {/* ===================== COMO FUNCIONA ===================== */}
      <section className="h2-sec" aria-labelledby="h2-fluxo">
        <div className="wrap">
          <div className="h2-sec-head">
            <span className="h2-kicker"><b>01</b> Como funciona</span>
            <h2 id="h2-fluxo" className="h2-h">Do encaixe ao relatório, em seis passos — executados sozinho.</h2>
          </div>
          <div className="h2-steps">
            {FLOW.map((s, i) => (
              <div className="h2-step" key={s.title}>
                <span className="h2-step-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="h2-step-t"><s.Icon aria-hidden /> {s.title}</span>
                <span className="h2-step-d">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== DADOS (DEMONSTRAÇÃO) ===================== */}
      <section className="h2-sec" aria-labelledby="h2-dados">
        <div className="wrap h2-data">
          <div className="h2-sec-head" style={{ marginBottom: 0 }}>
            <span className="h2-kicker"><b>02</b> Leitura de verdade</span>
            <h2 id="h2-dados" className="h2-h">Números que respondem, não que enfeitam.</h2>
            <p className="h2-lead">Cada barra mostra o valor e a fração do total. Sem legenda para decifrar, sem efeito, sem pizza.</p>
            <Link to="/automatico" className="h2-btn h2-btn-ghost" style={{ marginTop: 4 }}>Ver com o meu pendrive <ArrowRight aria-hidden /></Link>
          </div>
          <div className="h2-data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="h2-data-tag">Dados de exemplo</span>
              <div className="seg" role="radiogroup" aria-label="Medida">
                <label><input type="radio" name="h2-view" checked={view === 'bytes'} onChange={() => setView('bytes')} /><span>Espaço</span></label>
                <label><input type="radio" name="h2-view" checked={view === 'count'} onChange={() => setView('count')} /><span>Quantidade</span></label>
              </div>
            </div>
            <dl className="h2-metrics">
              <div className="h2-metric"><dt>Arquivos</dt><dd>{DEMO_TOTAL.count.toLocaleString('pt-BR')}</dd><small>{formatBytes(DEMO_TOTAL.bytes)}</small></div>
              <div className="h2-metric"><dt>Verificados</dt><dd>100%</dd><small>SHA-256</small></div>
              <div className="h2-metric"><dt>Cópias extras</dt><dd>183</dd><small>{formatBytes(2_340_000_000)} recuperáveis</small></div>
              <div className="h2-metric"><dt>Pastas sugeridas</dt><dd>8</dd><small>por tipo</small></div>
            </dl>
            <BarList
              title={`${view === 'bytes' ? 'Espaço' : 'Quantidade'} por tipo (exemplo)`}
              data={demoRows.map((d) => ({
                key: d.c,
                label: CATEGORY_LABEL[d.c],
                value: view === 'bytes' ? d.bytes : d.count,
                color: CAT_VAR[d.c],
                detail: view === 'bytes' ? `${pct(d.bytes, DEMO_TOTAL.bytes)} do espaço` : `${pct(d.count, DEMO_TOTAL.count)} dos arquivos`,
              }))}
              format={view === 'bytes' ? formatBytes : (v) => v.toLocaleString('pt-BR')}
            />
          </div>
        </div>
      </section>

      {/* ===================== PROVA (HASH) ===================== */}
      <section className="h2-sec" aria-labelledby="h2-prova">
        <div className="wrap">
          <div className="h2-proof">
            <div className="h2-sec-head" style={{ marginBottom: 18 }}>
              <span className="h2-kicker"><b>03</b> Comprove agora</span>
              <h2 id="h2-prova" className="h2-h">Cópia é conteúdo igual — não nome igual.</h2>
              <p className="h2-lead">Edite os textos. O cálculo SHA-256 é real e acontece no seu aparelho: é assim que o detector de duplicados decide.</p>
            </div>
            <HashPlayground />
          </div>
        </div>
      </section>

      {/* ===================== ÁREAS ===================== */}
      <section className="h2-sec" aria-labelledby="h2-areas">
        <div className="wrap">
          <div className="h2-sec-head">
            <span className="h2-kicker"><b>04</b> Plataforma</span>
            <h2 id="h2-areas" className="h2-h">Onde o trabalho acontece.</h2>
          </div>
          <div className="h2-areas">
            {ROUTES.filter((r) => r.path !== '/').map((r) => (
              <Link key={r.path} to={r.path} className="h2-area">
                <span className="h2-area-n">{r.n}</span>
                <span className="h2-area-t">{r.title}</span>
                <ArrowUpRight className="h2-area-x" aria-hidden />
                <span className="h2-area-d">{r.blurb}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== COMPROMISSOS ===================== */}
      <section className="h2-sec" aria-labelledby="h2-seg">
        <div className="wrap">
          <div className="h2-sec-head">
            <span className="h2-kicker"><b>05</b> Segurança</span>
            <h2 id="h2-seg" className="h2-h">Feito para dados que importam.</h2>
          </div>
          <div className="h2-pillars">
            {PILLARS.map((p) => (
              <div className="h2-pillar" key={p.title}>
                <p.Icon aria-hidden />
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FECHAMENTO ===================== */}
      <section className="wrap">
        <div className="h2-close">
          <h2>Configure uma vez. Depois, é só encaixar.</h2>
          <p className="h2-lead">Sem conta, sem nuvem, sem servidor recebendo seus arquivos.</p>
          <div className="h2-actions">
            <Link to="/automatico" className="h2-btn h2-btn-primary">Ativar o modo automático <ArrowRight aria-hidden /></Link>
            <Link to="/arquivos" className="h2-btn h2-btn-ghost">Escolher arquivos manualmente</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
