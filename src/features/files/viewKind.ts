/**
 * Como abrir cada arquivo dentro do navegador. O que o navegador não sabe
 * mostrar (Word, Excel, ZIP, programas…) vira "baixar para abrir no computador".
 */
export type ViewKind = 'imagem' | 'video' | 'audio' | 'pdf' | 'tabela' | 'texto' | 'externo';

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'];
const VID = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const AUD = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'];
const TAB = ['csv', 'tsv'];
const SPREADSHEET = ['xlsx', 'xls', 'ods'];
const TXT = ['txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'sh', 'bat', 'ps1', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'log', 'sql', 'srt', 'vtt', 'env', 'toml', 'rtf'];

export function viewKind(ext: string, mime = ''): ViewKind {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (IMG.includes(e) || mime.startsWith('image/')) return 'imagem';
  if (VID.includes(e) || mime.startsWith('video/')) return 'video';
  if (AUD.includes(e) || mime.startsWith('audio/')) return 'audio';
  if (e === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (TAB.includes(e) || SPREADSHEET.includes(e) || mime === 'text/csv' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel') return 'tabela';
  if (TXT.includes(e) || mime.startsWith('text/') || mime === 'application/json') return 'texto';
  return 'externo';
}

export const KIND_LABEL: Record<ViewKind, string> = {
  imagem: 'Imagem', video: 'Vídeo', audio: 'Áudio', pdf: 'PDF', tabela: 'Planilha (CSV)', texto: 'Texto', externo: 'Abrir no computador',
};

/** Lê no máximo `max` caracteres (arquivos grandes não travam a tela). */
export async function readTextStart(blob: Blob, max = 1_000_000): Promise<{ text: string; cut: boolean }> {
  const cut = blob.size > max;
  const part = blob.slice(0, max);
  // Blob.text() não existe em navegadores antigos: FileReader cobre todos.
  const text = typeof part.text === 'function'
    ? await part.text()
    : await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(part); });
  return { text, cut };
}

/** Lê Excel/ODS como CSV text via SheetJS (carrega sob demanda). */
export async function readSpreadsheet(blob: Blob): Promise<{ text: string; sheets: string[] }> {
  const XLSX = await import('xlsx');
  const buf = await blob.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames;
  const parts: string[] = [];
  for (const name of sheets) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { FS: ',', RS: '\n' });
    if (csv.trim()) parts.push(sheets.length > 1 ? `=== ${name} ===\n${csv}` : csv);
  }
  return { text: parts.join('\n\n').slice(0, 60_000), sheets };
}

/** CSV simples: respeita aspas, detecta ; ou , ou tab. Limita linhas para a tela. */
export function parseCsv(text: string, maxRows = 300): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if ((cell || row.length) && rows.length < maxRows) { row.push(cell); rows.push(row); }
  return rows;
}

/** Pedir de qualquer lugar (inclusive da IA) para abrir um arquivo no visualizador. */
export const OPEN_EVENT = 'usbi:abrir-arquivo';
export function openFile(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }));
}
