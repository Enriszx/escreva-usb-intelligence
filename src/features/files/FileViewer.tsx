import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { Modal } from '../../app/feedback';
import { useFiles } from './store';
import { useFolder } from './folder';
import { KIND_LABEL, OPEN_EVENT, parseCsv, readTextStart, viewKind, type ViewKind } from './viewKind';
import { formatBytes } from '../../lib/format';
import type { FileEntry } from '../../lib/analysis/types';
import './viewer.css';

type Loaded =
  | { state: 'carregando' }
  | { state: 'pronto'; url: string; kind: ViewKind; text?: string; rows?: string[][]; cut?: boolean }
  | { state: 'indisponivel'; why: string };

/**
 * Visualizador: abre de verdade imagens, vídeos, áudios, PDFs, planilhas CSV e
 * textos/códigos. Fica montado no app inteiro e atende a `openFile(id)`
 * (Central de arquivos, detalhes e a IA usam o mesmo caminho).
 * Texto é mostrado como texto: um .html nunca é executado aqui.
 */
export function FileViewerHost() {
  const files = useFiles();
  const folder = useFolder();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => setId((e as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  const list = files.entries;
  const index = list.findIndex((f) => f.id === id);
  const entry = index >= 0 ? list[index] : null;
  if (!entry) return null;
  const go = (d: number) => setId(list[(index + d + list.length) % list.length].id);
  return <Viewer key={entry.id} entry={entry} pos={`${index + 1} de ${list.length}`} onPrev={list.length > 1 ? () => go(-1) : undefined} onNext={list.length > 1 ? () => go(1) : undefined} onClose={() => setId(null)} getBlob={async () => {
    const f = files.getFile(entry.id);
    if (f) return f;
    if (folder.backend?.kind === 'web' && entry.source === 'pasta') return folder.backend.getBlob(entry.path);
    return null;
  }} />;
}

function Viewer({ entry, pos, onPrev, onNext, onClose, getBlob }: { entry: FileEntry; pos: string; onPrev?: () => void; onNext?: () => void; onClose: () => void; getBlob: () => Promise<Blob | null> }) {
  const [data, setData] = useState<Loaded>({ state: 'carregando' });
  const kind = useMemo(() => viewKind(entry.ext, entry.mime), [entry.ext, entry.mime]);
  const blobRef = useRef(getBlob);
  blobRef.current = getBlob;

  useEffect(() => {
    let url = '';
    let alive = true;
    (async () => {
      try {
        const blob = await blobRef.current();
        if (!alive) return;
        if (!blob) {
          setData({ state: 'indisponivel', why: entry.source === 'registro'
            ? 'Este item é só o registro salvo (nome, tamanho, hash). Escolha o arquivo de novo na Central para abrir o conteúdo.'
            : 'No app Android o conteúdo fica com o sistema. Abra este arquivo pelo gerenciador de arquivos do celular.' });
          return;
        }
        // PDF e mídia precisam do tipo certo para o navegador tocar/mostrar.
        const typed = kind === 'pdf' && blob.type !== 'application/pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob;
        url = URL.createObjectURL(typed);
        if (kind === 'texto' || kind === 'tabela') {
          const { text, cut } = await readTextStart(blob);
          if (!alive) return;
          setData({ state: 'pronto', url, kind, text, cut, rows: kind === 'tabela' ? parseCsv(text) : undefined });
        } else setData({ state: 'pronto', url, kind });
      } catch (e) {
        if (alive) setData({ state: 'indisponivel', why: `Não foi possível ler o arquivo: ${(e as Error).message}` });
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [entry.id, entry.source, kind]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, video, audio')) return;
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onPrev, onNext]);

  return (
    <Modal title={entry.name} onClose={onClose} wide>
      <div className="viewer">
        <p className="viewer-meta mono muted">{KIND_LABEL[kind]} · {formatBytes(entry.size)} · {entry.path} · {pos}</p>
        <div className={`viewer-body is-${kind}`}>
          {data.state === 'carregando' && <p className="muted">Abrindo…</p>}
          {data.state === 'indisponivel' && <p className="viewer-msg">{data.why}</p>}
          {data.state === 'pronto' && data.kind === 'imagem' && <img src={data.url} alt={entry.name} />}
          {data.state === 'pronto' && data.kind === 'video' && <video src={data.url} controls playsInline aria-label={entry.name} />}
          {data.state === 'pronto' && data.kind === 'audio' && <audio src={data.url} controls aria-label={entry.name} />}
          {data.state === 'pronto' && data.kind === 'pdf' && <iframe src={data.url} title={`PDF: ${entry.name}`} />}
          {data.state === 'pronto' && data.kind === 'texto' && <pre className="viewer-text" tabIndex={0} aria-label={`Conteúdo de ${entry.name}`}>{data.text}</pre>}
          {data.state === 'pronto' && data.kind === 'tabela' && data.rows && (
            <div className="viewer-table" tabIndex={0} role="region" aria-label={`Tabela de ${entry.name}`}>
              <table>
                <thead><tr>{(data.rows[0] ?? []).map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                <tbody>{data.rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {data.state === 'pronto' && data.kind === 'externo' && (
            <p className="viewer-msg">
              O navegador não mostra arquivos <strong>.{entry.ext || 'sem extensão'}</strong> por dentro (Word, Excel, ZIP e programas, por exemplo).
              Toque em “Baixar e abrir” para abrir no programa do seu computador ou celular.
            </p>
          )}
          {data.state === 'pronto' && data.cut && <p className="hint">Mostrando o primeiro 1 MB. Baixe para ver o arquivo inteiro.</p>}
        </div>
        <div className="btn-row viewer-actions">
          {onPrev && <button className="btn btn-ghost btn-sm" onClick={onPrev} aria-label="Arquivo anterior"><ChevronLeft aria-hidden /> Anterior</button>}
          {onNext && <button className="btn btn-ghost btn-sm" onClick={onNext} aria-label="Próximo arquivo">Próximo <ChevronRight aria-hidden /></button>}
          <span style={{ flex: 1 }} />
          {data.state === 'pronto' && (data.kind === 'pdf' || data.kind === 'imagem' || data.kind === 'video') && (
            <a className="btn btn-ghost btn-sm" href={data.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir em nova aba</a>
          )}
          {data.state === 'pronto' && <a className={`btn ${data.kind === 'externo' ? 'btn-primary' : 'btn-ghost'} btn-sm`} href={data.url} download={entry.name}><Download aria-hidden /> {data.kind === 'externo' ? 'Baixar e abrir' : 'Baixar'}</a>}
        </div>
      </div>
    </Modal>
  );
}
