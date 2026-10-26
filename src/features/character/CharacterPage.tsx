import { useRef, useState, type ReactNode } from 'react';
import {
  Backpack, Camera, Dices, Download, Flashlight, Minus, Pencil, Plus, RadioTower, Ribbon, RotateCcw, Save, Trash2, Undo2, Upload, Watch, FolderOpen,
} from 'lucide-react';
import { CharacterScene, type SceneHandle, type View } from './CharacterScene';
import { useCharacterEditor } from './useCharacterEditor';
import {
  ACCESSORIES, EYES, FINISHES, HEADS, LABELS, OUTFITS, POSES, PRESETS, exportEnvelope, validateCharacter, type Accessory, type CharacterConfig,
} from './model';
import { Modal, useConfirm, useToast } from '../../app/feedback';
import { useDocumentTitle } from '../../app/hooks';
import { saveBlob, saveJSON, safeFileName, stamp } from '../../lib/export';
import { formatDate } from '../../lib/format';
import './character.css';

const SWATCHES = ['#063d2e', '#0b5a43', '#00e676', '#ffd600', '#1464f4', '#07152d', '#f4f7f2', '#101311', '#e2572b', '#6c9dff'];
const SKINS = ['#5e3b27', '#7a4b31', '#8d5a3b', '#a8714c', '#c58c63', '#e0ac82', '#f1c9a5'];
const ACC_ICON: Record<Accessory, typeof Backpack> = { mochila: Backpack, antena: RadioTower, cachecol: Ribbon, lanterna: Flashlight, bracelete: Watch };
const COLOR_FIELDS: { key: keyof CharacterConfig['colors']; label: string; swatches: string[] }[] = [
  { key: 'primary', label: 'Cor principal', swatches: SWATCHES },
  { key: 'secondary', label: 'Cor secundária', swatches: SWATCHES },
  { key: 'detail', label: 'Detalhes', swatches: SWATCHES },
  { key: 'skin', label: 'Pele', swatches: SKINS },
];

export default function CharacterPage() {
  useDocumentTitle('Meu personagem');
  const ed = useCharacterEditor();
  const scene = useRef<SceneHandle>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<View>('frente');
  const c = ed.config;

  const goView = (v: View) => {
    setView(v);
    scene.current?.setView(v);
  };

  const save = async (asNew: boolean) => {
    try {
      const item = await ed.saveCurrent(asNew);
      toast({ tone: 'ok', title: asNew ? 'Novo personagem salvo' : 'Personagem salvo', body: `“${item.name}” está guardado neste dispositivo.` });
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: (e as Error).message });
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 256 * 1024) {
      setImportErrors(['Arquivo grande demais para ser uma configuração de personagem (limite: 256 KB).']);
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setImportErrors(['O arquivo não é um JSON válido.']);
      return;
    }
    const r = validateCharacter(data);
    if (!r.ok || !r.value) {
      setImportErrors(r.errors);
      return;
    }
    ed.importConfig(r.value, r.name);
    toast({ tone: 'ok', title: 'Configuração importada', body: 'Revise e salve para guardar na coleção. Dá para desfazer.' });
  };

  const exportPng = async () => {
    const blob = await scene.current?.capture();
    if (!blob) {
      toast({ tone: 'erro', title: 'Captura indisponível', body: 'O 3D não está ativo neste navegador. Exporte o JSON.' });
      return;
    }
    const res = await saveBlob(blob, `vigia-${safeFileName(ed.name)}-${stamp()}.png`);
    if (res !== 'cancelado') toast({ tone: 'ok', title: 'Imagem gerada', body: 'Captura real da cena 3D atual.' });
  };

  return (
    <div className="char-page">
      <div className="char-grid">
        {/* ---------- Palco ---------- */}
        <section className="char-stage-col" aria-label="Visualização 3D">
          <div className="char-stage-head">
            <span className="label">04 — Meu personagem</span>
            <h1 className="h2">O Vigia<span className="muted">.</span></h1>
          </div>
          <CharacterScene ref={scene} config={c} />
          <div className="cam-bar" role="toolbar" aria-label="Câmera">
            {(['frente', 'perfil', 'costas', 'rosto'] as View[]).map((v) => (
              <button key={v} className={`cam-btn ${view === v ? 'is-on' : ''}`} aria-pressed={view === v} onClick={() => goView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
            <span className="cam-sep" aria-hidden />
            <button className="cam-btn icon" aria-label="Aproximar" onClick={() => scene.current?.zoom(0.8)}><Plus aria-hidden /></button>
            <button className="cam-btn icon" aria-label="Afastar" onClick={() => scene.current?.zoom(1.25)}><Minus aria-hidden /></button>
            <button className="cam-btn" onClick={() => goView('frente')}><RotateCcw aria-hidden /> Redefinir</button>
          </div>
          <p className="mono muted stage-hint">Arraste para girar · pinça ou roda do mouse para zoom (limitado)</p>
        </section>

        {/* ---------- Editor ---------- */}
        <section className="char-editor" aria-label="Editor do personagem">
          <div className="name-row">
            <label className="field name-field">
              <span>Nome</span>
              <input className="input" value={ed.name} maxLength={40} onChange={(e) => ed.setName(e.target.value)} aria-invalid={!ed.name.trim()} />
            </label>
            <span className={`tag ${ed.dirty ? 'warn' : 'ok'}`}>{ed.dirty ? 'alterações não salvas' : 'salvo'}</span>
          </div>

          <div className="action-bar">
            <button className="btn btn-ghost btn-sm" onClick={ed.undo} disabled={!ed.canUndo}><Undo2 aria-hidden /> Desfazer</button>
            <button className="btn btn-ghost btn-sm" onClick={ed.randomize}><Dices aria-hidden /> Aleatório</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => { if (await confirm({ title: 'Voltar ao Vigia padrão?', body: <p>A configuração atual é substituída pelo estilo Guardião Verde. Você ainda pode desfazer.</p>, confirm: 'Restaurar padrão' })) ed.resetDefault(); }}>
              <RotateCcw aria-hidden /> Padrão
            </button>
            <span className="spacer" />
            {ed.currentId && <button className="btn btn-ghost btn-sm" onClick={() => save(true)} disabled={!ed.name.trim()}>Salvar como novo</button>}
            <button className="btn btn-primary btn-sm" onClick={() => save(false)} disabled={!ed.name.trim()}><Save aria-hidden /> Salvar</button>
          </div>

          <Group n="01" title="Estilos">
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p.id} className={`preset ${ed.presetId === p.id ? 'is-on' : ''}`} aria-pressed={ed.presetId === p.id} onClick={() => ed.applyPreset(p.id)}>
                  <span className="preset-sw" aria-hidden>
                    <i style={{ background: p.config.colors.primary }} /><i style={{ background: p.config.colors.secondary }} /><i style={{ background: p.config.colors.detail }} />
                  </span>
                  <strong>{p.name}</strong>
                  <span className="muted">{p.note}</span>
                </button>
              ))}
            </div>
            <p className="hint">Escolha um estilo e altere à vontade: o original continua disponível aqui.</p>
          </Group>

          <Group n="02" title="Cores">
            {COLOR_FIELDS.map((f) => (
              <ColorField key={f.key} label={f.label} value={c.colors[f.key]} swatches={f.swatches} onChange={(v) => ed.update((x) => { x.colors[f.key] = v; })} />
            ))}
          </Group>

          <Group n="03" title="Material e luz">
            <Choice label="Acabamento" value={c.finish} options={FINISHES} labels={LABELS.finish} onChange={(v) => ed.update((x) => { x.finish = v; })} />
            <label className="switch">
              <span>Elementos luminosos</span>
              <input type="checkbox" checked={c.glow.enabled} onChange={(e) => ed.update((x) => { x.glow.enabled = e.target.checked; })} />
            </label>
            <ColorField label="Cor da luz" value={c.colors.glow} swatches={['#00e676', '#ffd600', '#6c9dff', '#fff3a0', '#ff6b57', '#f4f7f2']} onChange={(v) => ed.update((x) => { x.colors.glow = v; })} disabled={!c.glow.enabled} />
            <label className="field">
              <span>Intensidade da luz: {c.glow.intensity.toFixed(1).replace('.', ',')}</span>
              <input type="range" className="range" min={0} max={3} step={0.1} value={c.glow.intensity} disabled={!c.glow.enabled} onChange={(e) => ed.update((x) => { x.glow.intensity = Number(e.target.value); })} />
            </label>
          </Group>

          <Group n="04" title="Rosto e cabeça">
            <Choice label="Olhos" value={c.eyes} options={EYES} labels={LABELS.eyes} onChange={(v) => ed.update((x) => { x.eyes = v; })} />
            <Choice label="Cobertura" value={c.head} options={HEADS} labels={LABELS.head} onChange={(v) => ed.update((x) => { x.head = v; })} />
          </Group>

          <Group n="05" title="Traje e pose">
            <Choice label="Traje" value={c.outfit} options={OUTFITS} labels={LABELS.outfit} onChange={(v) => ed.update((x) => { x.outfit = v; })} />
            <Choice label="Pose" value={c.pose} options={POSES} labels={LABELS.pose} onChange={(v) => ed.update((x) => { x.pose = v; })} />
          </Group>

          <Group n="06" title="Acessórios">
            <div className="acc-grid">
              {ACCESSORIES.map((a) => {
                const Icon = ACC_ICON[a];
                return (
                  <button key={a} className={`acc ${c.accessories[a] ? 'is-on' : ''}`} aria-pressed={c.accessories[a]} onClick={() => ed.update((x) => { x.accessories[a] = !x.accessories[a]; })}>
                    <Icon aria-hidden />
                    <span>{LABELS.accessories[a]}</span>
                  </button>
                );
              })}
            </div>
            {c.accessories.mochila && <p className="hint">Dica: a mochila aparece melhor na câmera “Costas”.</p>}
          </Group>

          <Group n="07" title="Arquivo">
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" onClick={async () => { const r = await saveJSON(exportEnvelope(ed.name.trim() || 'Vigia', c), `vigia-${safeFileName(ed.name)}.json`); if (r !== 'cancelado') toast({ tone: 'ok', title: 'JSON exportado' }); }}>
                <Download aria-hidden /> Exportar JSON
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => importInput.current?.click()}><Upload aria-hidden /> Importar JSON</button>
              <button className="btn btn-ghost btn-sm" onClick={exportPng}><Camera aria-hidden /> Exportar imagem</button>
            </div>
            <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
          </Group>

          <Group n="08" title={`Coleção (${ed.saved.length})`}>
            {ed.storageError && <p className="error-text">{ed.storageError}</p>}
            {ed.saved.length === 0 ? (
              <p className="muted">Nenhum personagem salvo ainda. Use “Salvar” acima.</p>
            ) : (
              <ul className="saved-list">
                {ed.saved.map((s) => (
                  <li key={s.id} className={s.id === ed.currentId ? 'is-current' : ''}>
                    <span className="preset-sw" aria-hidden>
                      <i style={{ background: s.config.colors.primary }} /><i style={{ background: s.config.colors.secondary }} /><i style={{ background: s.config.colors.detail }} />
                    </span>
                    <span className="saved-name">
                      <strong>{s.name}</strong>
                      <span className="mono muted">editado em {formatDate(s.updatedAt)}{s.id === ed.currentId ? ' · em edição' : ''}</span>
                    </span>
                    <span className="saved-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => ed.load(s)} aria-label={`Carregar ${s.name}`}><FolderOpen aria-hidden /><span className="lbl">Carregar</span></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setRenaming({ id: s.id, name: s.name })} aria-label={`Renomear ${s.name}`}><Pencil aria-hidden /></button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        aria-label={`Excluir ${s.name}`}
                        onClick={async () => {
                          if (await confirm({ title: `Excluir “${s.name}”?`, body: <p>O personagem sai da coleção deste dispositivo. Esta ação não pode ser desfeita — exporte o JSON antes se quiser guardar.</p>, confirm: 'Excluir', danger: true })) {
                            await ed.remove(s.id);
                            toast({ tone: 'ok', title: 'Personagem excluído' });
                          }
                        }}
                      >
                        <Trash2 aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Group>
        </section>
      </div>

      {importErrors && (
        <Modal title="Importação recusada" onClose={() => setImportErrors(null)} tone="danger">
          <div className="modal-body">
            <p>O arquivo não tem uma configuração válida. <strong>Seu personagem atual não foi alterado.</strong></p>
            <ul className="err-list">{importErrors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
          <div className="btn-row modal-actions"><button className="btn btn-primary" onClick={() => setImportErrors(null)}>Entendi</button></div>
        </Modal>
      )}
      {renaming && <RenameDialog initial={renaming.name} onClose={() => setRenaming(null)} onSave={async (n) => { await ed.rename(renaming.id, n); setRenaming(null); toast({ tone: 'ok', title: 'Nome atualizado' }); }} />}
    </div>
  );
}

function Group({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="ed-group">
      <legend><span className="mono">{n}</span> {title}</legend>
      <div className="ed-group-body">{children}</div>
    </fieldset>
  );
}

function Choice<T extends string>({ label, value, options, labels, onChange }: { label: string; value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void }) {
  const name = `opt-${label}`;
  return (
    <div className="field">
      <span id={`${name}-l`}>{label}</span>
      <div className="seg seg-wrap" role="radiogroup" aria-labelledby={`${name}-l`}>
        {options.map((o) => (
          <label key={o}>
            <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
            <span>{labels[o]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ColorField({ label, value, swatches, onChange, disabled }: { label: string; value: string; swatches: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }
  const valid = /^#[0-9a-fA-F]{6}$/.test(text);
  return (
    <div className={`color-field ${disabled ? 'is-disabled' : ''}`}>
      <span className="color-label">{label}</span>
      <div className="color-row">
        <label className="color-native">
          <span className="sr-only">{label}: escolher cor livre</span>
          <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value.toLowerCase())} />
        </label>
        <input
          className="input color-hex num"
          value={text}
          disabled={disabled}
          aria-label={`${label} em hexadecimal`}
          aria-invalid={!valid}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
        />
        <div className="swatches" role="group" aria-label={`${label}: sugestões`}>
          {swatches.map((s) => (
            <button key={s} className={`sw ${value === s ? 'is-on' : ''}`} style={{ background: s }} disabled={disabled} aria-label={`Usar ${s}`} aria-pressed={value === s} onClick={() => onChange(s)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RenameDialog({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (n: string) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const err = !v.trim() ? 'O nome não pode ficar vazio.' : v.length > 40 ? 'Use no máximo 40 caracteres.' : null;
  return (
    <Modal title="Renomear personagem" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!err) onSave(v); }}>
        <label className="field">
          <span>Novo nome</span>
          <input className="input" value={v} onChange={(e) => setV(e.target.value)} aria-invalid={!!err} aria-describedby="rename-err" autoFocus />
        </label>
        {err && <p id="rename-err" className="error-text">{err}</p>}
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!!err}>Salvar nome</button>
        </div>
      </form>
    </Modal>
  );
}
