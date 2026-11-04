import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { ArrowLeft, ArrowRight, Copy, Expand, FileBarChart2, Fingerprint, FolderTree, Lock, ScanSearch, ShieldCheck, Sparkles, Undo2, Usb, X } from 'lucide-react';
import { useDocumentTitle } from '../../app/hooks';
import { LogoMark } from '../../components/ui/Logo';
import { CASES, ROOT_CAUSES } from '../cases/cases';
import './present.css';

export const PUBLIC_URL = 'https://enriszx.github.io/escreva-usb-intelligence/';

/** QR desenhado como elementos SVG (sem HTML injetado). */
function QR({ text, size = 220 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const out: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push([c, r]);
    return { n, out };
  }, [text]);
  const m = 2;
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${cells.n + m * 2} ${cells.n + m * 2}`} role="img" aria-label={`QR code para ${text}`} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      {cells.out.map(([x, y]) => <rect key={`${x}-${y}`} x={x + m} y={y + m} width="1" height="1" fill="#04120c" />)}
    </svg>
  );
}

interface Slide { id: string; render: () => ReactNode; notes: string }

const STEPS = [
  { Icon: Usb, t: 'Detecta' }, { Icon: ScanSearch, t: 'Lê' }, { Icon: Fingerprint, t: 'Verifica' },
  { Icon: Copy, t: 'Acha cópias' }, { Icon: FolderTree, t: 'Organiza' }, { Icon: FileBarChart2, t: 'Relata' },
];

/**
 * Modo apresentação: slides em tela cheia para mostrar o projeto.
 * Setas/Espaço avançam, Home/End vão ao início/fim, F alterna tela cheia,
 * N mostra as notas do apresentador, Esc sai.
 */
export default function PresentationPage() {
  useDocumentTitle('Apresentação');
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const slides: Slide[] = [
    {
      id: 'capa', notes: 'Apresente o nome e a frase. Diga que é uma plataforma brasileira e que tudo roda no aparelho.',
      render: () => (
        <div className="sl sl-cover">
          <LogoMark size={88} />
          <h1 className="mega">USB Intelligence</h1>
          <p className="sl-sub"><span className="grad-text">Encaixe o pendrive. O resto é automático.</span></p>
          <p className="muted">Plataforma brasileira de inteligência de arquivos</p>
        </div>
      ),
    },
    {
      id: 'problema', notes: 'Cite os números: cada um é um caso real com fonte na área Casos reais.',
      render: () => (
        <div className="sl">
          <span className="label">O problema</span>
          <h2 className="h1">Perder dados acontece com gigantes.</h2>
          <ul className="sl-stats">
            <li><strong className="num">77 TB</strong><span>apagados de um backup na Universidade de Kyoto (2021)</span></li>
            <li><strong className="num">50 mi</strong><span>de músicas perdidas pelo MySpace numa migração (2019)</span></li>
            <li><strong className="num">460 mil</strong><span>moradores num pendrive perdido em Amagasaki (2022)</span></li>
            <li><strong className="num">223 mi</strong><span>de CPFs expostos no megavazamento no Brasil (2021)</span></li>
          </ul>
        </div>
      ),
    },
    {
      id: 'causas', notes: 'Pesquisamos 12 casos. As causas se repetem. Cada uma tem uma resposta no app.',
      render: () => (
        <div className="sl">
          <span className="label">Pesquisa · {CASES.length} casos reais</span>
          <h2 className="h1">As causas se repetem.</h2>
          <ol className="sl-causes">
            {ROOT_CAUSES.map((r) => <li key={r.cause}><strong>{r.cause}</strong><span>{r.answer}</span></li>)}
          </ol>
        </div>
      ),
    },
    {
      id: 'solucao', notes: 'Explique o modo automático: uma autorização na primeira vez e depois é só encaixar.',
      render: () => (
        <div className="sl">
          <span className="label">A solução</span>
          <h2 className="h1">Seis etapas, todas sozinhas.</h2>
          <ol className="sl-steps">
            {STEPS.map((s, n) => <li key={s.t}><span className="sl-ico"><s.Icon aria-hidden /></span><span className="num">{String(n + 1).padStart(2, '0')}</span><strong>{s.t}</strong></li>)}
          </ol>
          <p className="muted">Depois de uma autorização, o app percebe o pendrive, faz tudo sozinho e repete a cada vez que ele é encaixado.</p>
        </div>
      ),
    },
    {
      id: 'seguranca', notes: 'Reforce: nada sai do aparelho, e nada é apagado sem confirmação.',
      render: () => (
        <div className="sl">
          <span className="label">Segurança</span>
          <h2 className="h1">Feito para dados que importam.</h2>
          <ul className="sl-grid">
            <li><Lock aria-hidden /><strong>100% no aparelho</strong><span>Nenhum arquivo é enviado para servidor.</span></li>
            <li><Fingerprint aria-hidden /><strong>SHA-256</strong><span>Cópia é conteúdo igual, não nome igual.</span></li>
            <li><ShieldCheck aria-hidden /><strong>AES-256-GCM</strong><span>Cofre para levar dado sensível no pendrive.</span></li>
            <li><Undo2 aria-hidden /><strong>Reversível</strong><span>Lixeira restaurável, Desfazer e Histórico.</span></li>
          </ul>
        </div>
      ),
    },
    {
      id: 'ia', notes: 'Mostre o botão Pergunte ao Vigia. A IA online é grátis e não recebe o conteúdo dos arquivos.',
      render: () => (
        <div className="sl">
          <span className="label">Inteligência artificial</span>
          <h2 className="h1">Uma IA que entende português.</h2>
          <ul className="sl-grid sl-grid-3">
            <li><Sparkles aria-hidden /><strong>Vigia IA</strong><span>Responde dúvidas e age no app: analisa, organiza, troca o tema.</span></li>
            <li><Lock aria-hidden /><strong>Grátis</strong><span>Modelos abertos: gpt-oss-20b online e Qwen2.5 no próprio aparelho.</span></li>
            <li><ShieldCheck aria-hidden /><strong>Privada</strong><span>Recebe só nomes e tamanhos, nunca o conteúdo dos arquivos.</span></li>
          </ul>
        </div>
      ),
    },
    {
      id: 'demo', notes: 'Abra as áreas ao vivo. Volte para a apresentação pelo menu → Modo apresentação.',
      render: () => (
        <div className="sl">
          <span className="label">Demonstração ao vivo</span>
          <h2 className="h1">Veja funcionando.</h2>
          <div className="sl-links">
            <Link className="btn btn-primary btn-lg" to="/automatico">Modo automático <ArrowRight aria-hidden /></Link>
            <Link className="btn btn-ghost btn-lg" to="/casos">Casos reais e Verificador de backup</Link>
            <Link className="btn btn-ghost btn-lg" to="/arquivos">Central de arquivos</Link>
            <Link className="btn btn-ghost btn-lg" to="/seguranca">Segurança e cofre</Link>
          </div>
        </div>
      ),
    },
    {
      id: 'fim', notes: 'Peça para a plateia apontar a câmera para o QR code.',
      render: () => (
        <div className="sl sl-end">
          <div>
            <span className="label">Obrigado</span>
            <h2 className="h1">Abra no seu celular.</h2>
            <p className="sl-url num">{PUBLIC_URL.replace('https://', '')}</p>
            <p className="muted">Funciona no navegador, instala como app e roda offline.</p>
          </div>
          <QR text={PUBLIC_URL} />
        </div>
      ),
    },
  ];

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(slides.length - 1, n))), [slides.length]);
  const toggleFs = useCallback(() => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(i + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(slides.length - 1);
      else if (e.key.toLowerCase() === 'f') toggleFs();
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else if (e.key === 'Escape' && !document.fullscreenElement) navigate('/');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [i, go, toggleFs, navigate, slides.length]);

  // Deslizar no celular/tablet.
  const touch = useRef<number | null>(null);
  const s = slides[i];

  return (
    <div
      ref={root}
      className="present"
      data-tone="grafite"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="present-stage" aria-live="polite" aria-roledescription="slide" aria-label={`Slide ${i + 1} de ${slides.length}`} key={s.id}>
        {s.render()}
      </div>
      {notes && <p className="present-notes" role="note"><strong>Notas:</strong> {s.notes}</p>}
      <div className="present-bar">
        <button className="btn btn-ghost btn-sm pbtn-exit" onClick={() => navigate('/')} aria-label="Sair da apresentação"><X aria-hidden /> <span className="pbtn-t">Sair</span></button>
        <div className="present-dots" role="tablist" aria-label="Slides">
          {slides.map((x, n) => (
            <button key={x.id} role="tab" aria-selected={n === i} aria-label={`Ir para o slide ${n + 1}`} className={`pdot ${n === i ? 'is-on' : ''}`} onClick={() => go(n)} />
          ))}
        </div>
        <span className="num muted present-count">{i + 1}/{slides.length}</span>
        <button className="btn btn-ghost btn-sm pbtn-notes" onClick={() => setNotes((v) => !v)} aria-pressed={notes}>Notas</button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleFs} aria-label="Tela cheia (F)" title="Tela cheia (F)"><Expand aria-hidden /></button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Slide anterior"><ArrowLeft aria-hidden /></button>
        <button className="btn btn-primary btn-sm btn-icon" onClick={() => go(i + 1)} disabled={i === slides.length - 1} aria-label="Próximo slide"><ArrowRight aria-hidden /></button>
      </div>
    </div>
  );
}
