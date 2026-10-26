import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal, useToast } from '../../app/feedback';
import type { ExportRequest } from '../../lib/export';
import { formatBytes } from '../../lib/format';
import { IS_ARTIFACT } from '../../lib/platform';

const TEXT_LIMIT = 2 * 1024 * 1024;

/**
 * Na versão publicada não há downloads. Exportações de texto (JSON, CSV, TXT)
 * aparecem aqui para copiar e colar; binárias explicam onde fazer.
 */
export function ExportFallback() {
  const toast = useToast();
  const [req, setReq] = useState<(ExportRequest & { text: string | null }) | null>(null);
  useEffect(() => {
    if (!IS_ARTIFACT) return;
    const on = async (e: Event) => {
      const { blob, fileName } = (e as CustomEvent<ExportRequest>).detail;
      const isText = /^(text\/|application\/json)/.test(blob.type) || /\.(json|csv|txt)$/i.test(fileName);
      setReq({ blob, fileName, text: isText && blob.size <= TEXT_LIMIT ? (await blob.text()).replace(/^﻿/, '') : null });
    };
    window.addEventListener('usbi:export', on);
    return () => window.removeEventListener('usbi:export', on);
  }, []);
  if (!req) return null;
  return (
    <Modal title={req.fileName} onClose={() => setReq(null)} wide>
      <div className="modal-body">
        <p>Esta versão publicada não pode baixar arquivos. {req.text !== null ? 'Copie o conteúdo abaixo e salve num arquivo com este nome.' : 'Para gerar este arquivo, use a versão instalada (PWA, servidor local ou app Android).'}</p>
        {req.text !== null && (
          <textarea id="export-fallback" className="textarea export-text" readOnly value={req.text} onFocus={(e) => e.target.select()} />
        )}
        <p className="mono muted">{formatBytes(req.blob.size)}</p>
      </div>
      <div className="btn-row modal-actions">
        <button className="btn btn-ghost" onClick={() => setReq(null)}>Fechar</button>
        {req.text !== null && (
          <button
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(req.text!).then(
                () => toast({ tone: 'ok', title: 'Conteúdo copiado', body: req.fileName }),
                () => {
                  (document.getElementById('export-fallback') as HTMLTextAreaElement | null)?.select();
                  toast({ tone: 'info', title: 'Texto selecionado', body: 'Use Ctrl+C (ou Copiar) para copiar.' });
                },
              );
            }}
          >
            <Copy aria-hidden /> Copiar conteúdo
          </button>
        )}
      </div>
    </Modal>
  );
}
