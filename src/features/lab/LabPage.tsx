import { useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Stage } from '../../components/three/Stage';
import { CameraRig, type CameraView, type RigHandle } from '../../components/three/CameraRig';
import { CORE_LAYERS, CoreDevice, StudioLights, type CoreLayerId, type CoreMode } from '../../components/three/CoreDevice';
import { DeviceIllustration } from '../../components/three/Fallbacks';
import { useSettings } from '../../app/settings';
import { useDocumentTitle } from '../../app/hooks';
import './lab.css';

const VIEWS: Record<string, CameraView> = {
  perspectiva: { pos: [5.4, 4.2, 8.2], target: [0.3, 0, 0] },
  frente: { pos: [0.3, 0.5, 9.5], target: [0.3, 0, 0] },
  topo: { pos: [0.3, 10, 0.01], target: [0.3, 0, 0] },
  conector: { pos: [5.2, 0.9, 1.6], target: [2, 0, 0] },
};
const VIEW_LABEL: Record<string, string> = { perspectiva: 'Perspectiva', frente: 'Frente', topo: 'Topo', conector: 'Conector' };
const MODES: { id: CoreMode; label: string; note: string }[] = [
  { id: 'produto', label: 'Produto', note: 'Materiais finais: metal, vidro, placa.' },
  { id: 'raio-x', label: 'Raio-X', note: 'Só a malha: mostra como cada peça foi construída.' },
  { id: 'secao', label: 'Seção', note: 'Plano de corte ao meio, revelando o interior.' },
];

export default function LabPage() {
  useDocumentTitle('Laboratório 3D');
  const { quality, reducedMotion } = useSettings();
  const rig = useRef<RigHandle | null>(null);
  const [explode, setExplode] = useState(0.35);
  const [mode, setMode] = useState<CoreMode>('produto');
  const [view, setView] = useState('perspectiva');
  const [highlight, setHighlight] = useState<CoreLayerId | null>(null);
  const [led, setLed] = useState(true);
  const [idle, setIdle] = useState(!reducedMotion);
  const layer = CORE_LAYERS.find((l) => l.id === highlight);

  const go = (v: string) => {
    setView(v);
    rig.current?.setView(v);
  };

  return (
    <div className="lab-page">
      <div className="lab-grid">
        <section className="lab-stage-col" aria-label="Núcleo USBI em 3D">
          <header className="lab-head">
            <span className="label">03 — Laboratório 3D</span>
            <h1 className="h1">Abra o<br />núcleo.</h1>
          </header>
          <Stage
            className="lab-stage"
            label="Núcleo USBI. Arraste para orbitar, use pinça ou roda para zoom, toque numa peça para destacá-la."
            camera={{ position: VIEWS.perspectiva.pos, fov: 32 }}
            fallback={<DeviceIllustration />}
            clipping
          >
            <StudioLights tone="noite" />
            <CoreDevice explode={explode} mode={mode} highlight={highlight} led={led} idle={idle && !reducedMotion} quality={quality} onSelect={(id) => setHighlight((h) => (h === id ? null : id))} />
            <CameraRig handle={rig} views={VIEWS} initial="perspectiva" minDistance={2.4} maxDistance={15} minPolar={0.01} maxPolar={Math.PI - 0.01} />
          </Stage>
          {layer && (
            <div className="layer-card" role="status">
              <span className="label">Peça selecionada</span>
              <strong className="h3">{layer.name}</strong>
              <p>{layer.text}</p>
            </div>
          )}
        </section>

        <aside className="lab-panel" aria-label="Controles do laboratório">
          <p className="lead muted">
            O Núcleo USBI é um pendrive conceitual, modelado em código. Separe as camadas, troque o modo de leitura e gire à vontade.
          </p>

          <div className="lab-ctrl">
            <label className="field">
              <span>Separação das camadas — {Math.round(explode * 100)}%</span>
              <input className="range" type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
            </label>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" onClick={() => setExplode(0)}>Fechar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setExplode(1)}>Abrir tudo</button>
            </div>
          </div>

          <div className="lab-ctrl">
            <span className="label">Modo de leitura</span>
            <div className="seg seg-wrap" role="radiogroup" aria-label="Modo de leitura">
              {MODES.map((m) => (
                <label key={m.id}>
                  <input type="radio" name="modo" checked={mode === m.id} onChange={() => setMode(m.id)} />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <p className="hint">{MODES.find((m) => m.id === mode)?.note}</p>
          </div>

          <div className="lab-ctrl">
            <span className="label">Câmera</span>
            <div className="seg seg-wrap" role="radiogroup" aria-label="Vista da câmera">
              {Object.keys(VIEWS).map((v) => (
                <label key={v}>
                  <input type="radio" name="vista" checked={view === v} onChange={() => go(v)} />
                  <span>{VIEW_LABEL[v]}</span>
                </label>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm btn-icon" aria-label="Aproximar" onClick={() => rig.current?.zoom(0.8)}><Plus aria-hidden /></button>
              <button className="btn btn-ghost btn-sm btn-icon" aria-label="Afastar" onClick={() => rig.current?.zoom(1.25)}><Minus aria-hidden /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => go('perspectiva')}><RotateCcw aria-hidden /> Redefinir câmera</button>
            </div>
          </div>

          <div className="lab-ctrl">
            <label className="switch"><span>LED de atividade</span><input type="checkbox" checked={led} onChange={(e) => setLed(e.target.checked)} /></label>
            <label className="switch"><span>Flutuação em repouso</span><input type="checkbox" checked={idle} disabled={reducedMotion} onChange={(e) => setIdle(e.target.checked)} /></label>
            {reducedMotion && <p className="hint">Movimento reduzido está ativo: a cena só redesenha quando algo muda.</p>}
          </div>

          <div className="lab-ctrl">
            <span className="label">Peças</span>
            <ol className="layer-list">
              {CORE_LAYERS.map((l, i) => (
                <li key={l.id}>
                  <button className={`layer-btn ${highlight === l.id ? 'is-on' : ''}`} aria-pressed={highlight === l.id} onClick={() => setHighlight(highlight === l.id ? null : l.id)}>
                    <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                    <span>{l.name}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <p className="mono muted lab-perf">
            Qualidade 3D: {quality === 'alta' ? 'alta' : 'economia'} · pixel ratio até {quality === 'alta' ? '2' : '1,5'} · renderização {reducedMotion ? 'sob demanda' : 'contínua, pausada fora da tela'}
          </p>
        </aside>
      </div>
    </div>
  );
}
