import { useState } from 'react';
import { FolderOpen, FolderPlus, PlugZap, RefreshCw, Undo2, Unplug } from 'lucide-react';
import { useFolder } from './folder';
import { useFiles } from './store';
import { NewFolderDialog } from './fileDialogs';
import { useConfirm } from '../../app/feedback';
import { isNativeAndroid } from '../../lib/files/androidFolder';

/** Faixa que aparece quando há (ou houve) uma pasta conectada com permissão de escrita. */
export function FolderBar() {
  const f = useFolder();
  const { run } = useFiles();
  const confirm = useConfirm();
  const [mk, setMk] = useState(false);

  if (!f.backend) {
    if (!f.supported) return null;
    return (
      <div className="folder-bar is-off">
        <div className="fb-copy">
          <span className="label">Gerenciar arquivos de verdade</span>
          <p className="muted">
            Conecte uma pasta {isNativeAndroid() ? '(ou a raiz do pendrive OTG)' : 'do computador ou do pendrive'} para renomear, mover, organizar e apagar.
            O {isNativeAndroid() ? 'Android' : 'navegador'} pede sua permissão e o app só alcança essa pasta.
          </p>
        </div>
        <div className="btn-row">
          {f.remembered && <button className="btn btn-ghost" onClick={f.reconnect}><PlugZap aria-hidden /> Reconectar “{f.remembered}”</button>}
          <button className="btn btn-primary" onClick={f.connect}><FolderOpen aria-hidden /> Conectar pasta</button>
        </div>
      </div>
    );
  }

  const disabled = !!f.busy || !!run;
  return (
    <div className="folder-bar is-on" role="region" aria-label="Pasta conectada">
      <div className="fb-copy">
        <span className="label">Pasta conectada · alterações são reais</span>
        <p className="fb-name"><FolderOpen aria-hidden /> {f.backend.rootName}</p>
        {f.busy && (
          <div className="fb-busy" role="status">
            <div className={`progress ${f.busy.total ? '' : 'indet'}`}><i style={{ width: f.busy.total ? `${(f.busy.done / f.busy.total) * 100}%` : undefined }} /></div>
            <span className="mono">{f.busy.label}{f.busy.total ? ` · ${f.busy.done}/${f.busy.total}` : f.busy.done ? ` · ${f.busy.done} arquivos` : '…'}</span>
          </div>
        )}
      </div>
      <div className="btn-row">
        {f.undoLabel && <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={f.undo}><Undo2 aria-hidden /> Desfazer {f.undoLabel}</button>}
        <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => setMk(true)}><FolderPlus aria-hidden /> Nova pasta</button>
        <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={f.rescan}><RefreshCw aria-hidden /> Reler</button>
        <button className="btn btn-quiet btn-sm" disabled={disabled} onClick={async () => {
          if (await confirm({ title: 'Desconectar a pasta?', body: <p>A lista é esvaziada e o app deixa de ter acesso. Nada é apagado.</p>, confirm: 'Desconectar' })) f.disconnect();
        }}><Unplug aria-hidden /> Desconectar</button>
      </div>
      {mk && <NewFolderDialog onClose={() => setMk(false)} onCreate={f.mkdir} />}
    </div>
  );
}
