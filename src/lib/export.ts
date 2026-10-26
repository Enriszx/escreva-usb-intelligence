import { IS_ARTIFACT } from './platform';

/** CSV com ; (padrão do Excel em pt-BR) e BOM para manter acentos. */
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n');
}

export function safeFileName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'arquivo';
}

export function stamp(ts = Date.now()): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Entrega um arquivo ao usuário. Usa o seletor "Salvar como" quando o navegador
 * oferece (o usuário escolhe o destino, inclusive o pendrive); senão, download.
 */
async function saveNative(blob: Blob, fileName: string): Promise<'salvo' | 'cancelado'> {
  const { registerPlugin } = await import('@capacitor/core');
  const plugin = registerPlugin<{ saveFile(o: { name: string; mime: string; base64: string }): Promise<{ saved: boolean }> }>('UsbiFiles');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const r = await plugin.saveFile({ name: fileName, mime: blob.type || 'application/octet-stream', base64: btoa(bin) });
  return r.saved ? 'salvo' : 'cancelado';
}

function isNative(): boolean {
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}

export interface ExportRequest {
  blob: Blob;
  fileName: string;
}

export async function saveBlob(blob: Blob, fileName: string): Promise<'salvo' | 'baixado' | 'cancelado'> {
  if (IS_ARTIFACT) {
    // Sem downloads neste quadro: mostra o conteúdo para copiar (ver ExportFallback).
    window.dispatchEvent(new CustomEvent<ExportRequest>('usbi:export', { detail: { blob, fileName } }));
    return 'cancelado';
  }
  // No app Android, downloads da WebView não funcionam: usa o "Salvar como" do sistema.
  if (isNative()) return saveNative(blob, fileName);
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> };
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: fileName });
      const writable = await (handle as unknown as { createWritable: () => Promise<WritableStream & { write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable();
      await writable.write(blob);
      await writable.close();
      return 'salvo';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelado';
      // Falhou por outra razão (permissão, contexto): cai para o download comum.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'baixado';
}

export function saveJSON(data: unknown, fileName: string) {
  return saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName);
}

export function saveCSV(rows: Record<string, unknown>[], fileName: string, columns?: string[]) {
  return saveBlob(new Blob([toCSV(rows, columns)], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function saveText(text: string, fileName: string) {
  return saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName);
}
