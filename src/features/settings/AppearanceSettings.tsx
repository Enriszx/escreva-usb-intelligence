import { RotateCcw } from 'lucide-react';
import { useSettings } from '../../app/settings';
import type { Settings } from '../../lib/storage/repos';

const ACCENTS = [
  { hex: '', label: 'Original' }, { hex: '#ffdf00', label: 'Amarelo' }, { hex: '#2fd57f', label: 'Verde' }, { hex: '#3d7bff', label: 'Azul' },
  { hex: '#ff7a1a', label: 'Laranja' }, { hex: '#e5487a', label: 'Rosa' }, { hex: '#9b6bff', label: 'Roxo' }, { hex: '#f4f7f2', label: 'Branco' },
];

/** Aparência do site inteiro. O assistente usa as mesmas opções (ferramenta personalizar_visual). */
export function AppearanceSettings({ set }: { set: (p: Partial<Settings>, msg: string) => Promise<void> }) {
  const { settings } = useSettings();
  const custom = settings.uiAccent || settings.uiRadius !== 'padrao' || settings.uiFont !== 1 || settings.uiBackdrop !== 'forte';
  return (
    <section id="aparencia" className="set-sec set-wide" aria-labelledby="st-ap">
      <h2 id="st-ap" className="h3">Aparência</h2>
      <p className="hint">Mude o visual do site inteiro. Também dá para pedir ao assistente: “deixa o site roxo e com letras maiores”.</p>
      <div className="field">
        <span id="ap-cor-l">Cor de destaque (botões e realces)</span>
        <div className="ap-accents" role="radiogroup" aria-labelledby="ap-cor-l">
          {ACCENTS.map((a) => (
            <button key={a.label} type="button" role="radio" aria-checked={settings.uiAccent === a.hex} className={`ap-sw ${settings.uiAccent === a.hex ? 'is-on' : ''}`} onClick={() => set({ uiAccent: a.hex }, `Destaque: ${a.label.toLowerCase()}`)}>
              <i style={{ background: a.hex || 'linear-gradient(135deg, #ffdf00 50%, #007a37 50%)' }} aria-hidden />
              <span>{a.label}</span>
            </button>
          ))}
          <label className="ap-sw ap-free">
            <input type="color" value={settings.uiAccent || '#ffdf00'} onChange={(e) => set({ uiAccent: e.target.value.toLowerCase() }, 'Cor personalizada')} aria-label="Escolher outra cor de destaque" />
            <span>Outra</span>
          </label>
        </div>
      </div>
      <div className="field">
        <span id="ap-canto-l">Cantos</span>
        <div className="seg" role="radiogroup" aria-labelledby="ap-canto-l">
          {(['reto', 'padrao', 'redondo'] as const).map((r) => (
            <label key={r}><input type="radio" name="ap-canto" checked={settings.uiRadius === r} onChange={() => set({ uiRadius: r }, 'Cantos atualizados')} /><span>{r === 'reto' ? 'Retos' : r === 'padrao' ? 'Padrão' : 'Bem redondos'}</span></label>
          ))}
        </div>
      </div>
      <label className="field" htmlFor="ap-fonte">
        <span>Tamanho do texto: {Math.round(settings.uiFont * 100)}%</span>
        <input id="ap-fonte" type="range" className="range" min={0.9} max={1.25} step={0.05} value={settings.uiFont} onChange={(e) => set({ uiFont: Number(e.target.value) }, 'Tamanho do texto atualizado')} />
      </label>
      <div className="field">
        <span id="ap-fundo-l">Fundo inspirado na bandeira</span>
        <div className="seg" role="radiogroup" aria-labelledby="ap-fundo-l">
          {(['forte', 'suave', 'desligado'] as const).map((b) => (
            <label key={b}><input type="radio" name="ap-fundo" checked={settings.uiBackdrop === b} onChange={() => set({ uiBackdrop: b }, 'Fundo atualizado')} /><span>{b === 'forte' ? 'Forte' : b === 'suave' ? 'Suave' : 'Desligado'}</span></label>
          ))}
        </div>
      </div>
      {custom && (
        <button className="btn btn-ghost btn-sm" onClick={() => set({ uiAccent: '', uiRadius: 'padrao', uiFont: 1, uiBackdrop: 'forte' }, 'Aparência original restaurada')}>
          <RotateCcw aria-hidden /> Voltar ao visual original
        </button>
      )}
    </section>
  );
}
