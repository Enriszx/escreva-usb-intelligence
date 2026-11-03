import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import { useFiles } from './store';
import { useFolder } from './folder';
import { useToast } from '../../app/feedback';
import { filesFromDrop } from '../../lib/files/intake';
import { describeAdd } from './announce';

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

/**
 * Soltar arquivos em qualquer lugar da página os adiciona à biblioteca.
 * A zona de entrada da Central trata o próprio drop; aqui só entra o que sobrou.
 */
export function GlobalDrop() {
  const { addFiles } = useFiles();
  const folder = useFolder();
  const toast = useToast();
  const navigate = useNavigate();
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const live = useRef(!!folder.backend);
  live.current = !!folder.backend;

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      depth.current = 0;
      setOver(false);
      if (e.defaultPrevented || !e.dataTransfer || !hasFiles(e)) return;
      e.preventDefault();
      if (live.current) {
        toast({ tone: 'aviso', title: 'Há uma pasta conectada', body: 'Desconecte a pasta na Central de arquivos para analisar arquivos soltos.' });
        return;
      }
      try {
        const list = await filesFromDrop(e.dataTransfer);
        const d = describeAdd(addFiles(list));
        toast({ tone: d.tone, title: d.title, body: d.body });
        if (list.length) navigate('/arquivos');
      } catch (err) {
        toast({ tone: 'erro', title: 'Não foi possível ler o que foi solto', body: (err as Error).message });
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles, navigate, toast]);

  if (!over) return null;
  return (
    <div className="drop-veil" aria-hidden>
      <div className="drop-veil-box">
        <UploadCloud />
        <strong>Solte para importar</strong>
        <span className="mono">Só nome, tipo, tamanho e data são lidos. O conteúdo fica no aparelho.</span>
      </div>
    </div>
  );
}
