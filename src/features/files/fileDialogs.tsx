import { useMemo, useState } from 'react';
import { Modal } from '../../app/feedback';
import { normalizeDir, splitPath, validateName } from '../../lib/files/backend';
import type { FileEntry } from '../../lib/analysis/types';
import { formatBytes, plural } from '../../lib/format';

export function RenameFileDialog({ entry, siblings, onClose, onSave }: { entry: FileEntry; siblings: string[]; onClose: () => void; onSave: (name: string) => Promise<boolean> }) {
  const [v, setV] = useState(entry.name);
  const [busy, setBusy] = useState(false);
  const clash = v !== entry.name && v.toLowerCase() !== entry.name.toLowerCase() && siblings.some((s) => s.toLowerCase() === v.toLowerCase());
  const err = v === entry.name ? null : validateName(v) ?? (clash ? 'Já existe um arquivo com esse nome nesta pasta.' : null);
  const dot = entry.name.lastIndexOf('.');
  const extChanged = dot > 0 && !v.toLowerCase().endsWith(entry.name.slice(dot).toLowerCase());
  return (
    <Modal title="Renomear arquivo" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (err || v === entry.name) return; setBusy(true); if (await onSave(v)) onClose(); else setBusy(false); }}>
        <p className="mono muted" style={{ marginBottom: 12, textTransform: 'none', letterSpacing: 0 }}>{entry.path}</p>
        <label className="field">
          <span>Novo nome</span>
          <input
            className="input"
            value={v}
            autoFocus
            onFocus={(e) => e.target.setSelectionRange(0, dot > 0 ? dot : v.length)}
            onChange={(e) => setV(e.target.value)}
            aria-invalid={!!err}
            aria-describedby="rn-err"
          />
        </label>
        {err && <p id="rn-err" className="error-text">{err}</p>}
        {!err && extChanged && <p className="hint">Atenção: a extensão mudou. O arquivo pode deixar de abrir no programa certo.</p>}
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!!err || v === entry.name || busy}>{busy ? 'Renomeando…' : 'Renomear'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function MoveDialog({ entries, folders, rootName, onClose, onMove }: { entries: FileEntry[]; folders: string[]; rootName: string; onClose: () => void; onMove: (dir: string) => Promise<unknown> }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const n = normalizeDir(v);
  const dir = n.ok ? n.dir : '';
  const already = useMemo(() => entries.filter((e) => splitPath(e.path).dir === dir).length, [entries, dir]);
  const bytes = entries.reduce((s, e) => s + e.size, 0);
  return (
    <Modal title={`Mover ${plural(entries.length, 'arquivo', 'arquivos')}`} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (!n.ok) return; setBusy(true); await onMove(dir); onClose(); }}>
        <p className="muted" style={{ marginBottom: 12 }}>{formatBytes(bytes)} dentro de “{rootName}”. Pastas que não existem são criadas.</p>
        <label className="field">
          <span>Pasta de destino (vazio = raiz)</span>
          <input className="input" list="pastas-existentes" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex.: Fotos/2024" autoFocus aria-invalid={!n.ok} />
          <datalist id="pastas-existentes">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        {!n.ok && <p className="error-text">{n.error}</p>}
        {n.ok && already > 0 && <p className="hint">{plural(already, 'arquivo já está', 'arquivos já estão')} nesta pasta e não serão alterados.</p>}
        <p className="hint">Se já existir um arquivo com o mesmo nome no destino, aquele item não é movido (nada é sobrescrito).</p>
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!n.ok || busy}>{busy ? 'Movendo…' : `Mover para ${dir || 'a raiz'}`}</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewFolderDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (path: string) => Promise<boolean> }) {
  const [v, setV] = useState('');
  const n = normalizeDir(v);
  return (
    <Modal title="Nova pasta" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (n.ok && n.dir && (await onCreate(n.dir))) onClose(); }}>
        <label className="field">
          <span>Caminho da pasta</span>
          <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex.: Documentos/Contratos" autoFocus aria-invalid={!n.ok} />
        </label>
        {!n.ok && <p className="error-text">{n.error}</p>}
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!n.ok || !n.dir}>Criar pasta</button>
        </div>
      </form>
    </Modal>
  );
}

/** Pastas que existem (derivadas dos arquivos listados), para sugerir destinos. */
export function foldersOf(entries: FileEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const parts = splitPath(e.path).dir.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('/'));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
