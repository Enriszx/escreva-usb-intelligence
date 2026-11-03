import { useRef, useState } from 'react';
import { FilePlus2, FolderPlus } from 'lucide-react';
import { useFiles, type IncomingFile } from './store';
import { useToast } from '../../app/feedback';
import { filesFromDrop, supportsFolderInput } from '../../lib/files/intake';
import { describeAdd } from './announce';

/** Entrada de arquivos: seletor do sistema, pasta e arrastar-e-soltar. */
export function Intake({ compact }: { compact: boolean }) {
  const { addFiles } = useFiles();
  const toast = useToast();
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const folderOk = supportsFolderInput();

  const take = (list: IncomingFile[], origem: string) => {
    if (!list.length) {
      toast({ tone: 'aviso', title: 'Nenhum arquivo recebido', body: `O navegador não entregou arquivos ${origem}.` });
      return;
    }
    const d = describeAdd(addFiles(list));
    toast({ tone: d.tone, title: d.title, body: d.body });
  };

  return (
    <div
      className={`intake ${compact ? 'is-compact' : ''} ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        setReading(true);
        try {
          take(await filesFromDrop(e.dataTransfer), 'pelo arraste');
        } catch (err) {
          toast({ tone: 'erro', title: 'Não foi possível ler o que foi solto', body: (err as Error).message });
        } finally {
          setReading(false);
        }
      }}
    >
      {!compact && (
        <div className="intake-copy">
          <p className="intake-big" aria-hidden>{over ? 'Pode soltar.' : 'Traga seus arquivos.'}</p>
          <p className="muted">
            Escolha arquivos — inclusive do pendrive via OTG — ou solte-os aqui no computador. O app só enxerga o que você entregar e nada é
            enviado para a internet.
          </p>
        </div>
      )}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => filesInput.current?.click()} disabled={reading}>
          <FilePlus2 aria-hidden /> {compact ? 'Adicionar arquivos' : 'Escolher arquivos'}
        </button>
        {folderOk && (
          <button className="btn btn-ghost" onClick={() => folderInput.current?.click()} disabled={reading}>
            <FolderPlus aria-hidden /> Escolher pasta
          </button>
        )}
        {reading && <span className="mono muted">Lendo a lista de arquivos…</span>}
        {compact && <span className="mono muted intake-drop-hint">ou solte arquivos nesta faixa</span>}
      </div>
      {!compact && folderOk && <p className="hint">“Escolher pasta” depende do navegador; no Android costuma não estar disponível — use “Escolher arquivos” e marque vários.</p>}
      <input ref={filesInput} type="file" multiple hidden onChange={(e) => { take([...(e.target.files ?? [])].map((file) => ({ file })), 'pelo seletor'); e.target.value = ''; }} />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => { take([...(e.target.files ?? [])].map((file) => ({ file })), 'da pasta'); e.target.value = ''; }}
      />
    </div>
  );
}
