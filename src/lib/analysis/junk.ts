/**
 * Arquivos que o sistema cria sozinho. Ficam de fora da análise para não
 * poluir os números (e porque quase nunca interessam a quem organiza).
 */
const JUNK_NAMES = new Set(['thumbs.db', 'desktop.ini', '.ds_store', 'ehthumbs.db']);
const JUNK_PATHS = ['system volume information', '$recycle.bin', '.trashes', '.spotlight-v100', '.fseventsd', '.usbi-lixeira'];

export function isJunkFile(name: string, path = ''): boolean {
  const lower = name.toLowerCase();
  if (JUNK_NAMES.has(lower)) return true;
  if (name.startsWith('.')) return true;
  const p = path.toLowerCase();
  return JUNK_PATHS.some((s) => p.includes(s));
}
