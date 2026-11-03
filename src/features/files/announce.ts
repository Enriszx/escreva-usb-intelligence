import { formatInt, plural } from '../../lib/format';
import type { AddResult } from './store';

/** Texto do aviso depois de adicionar arquivos: diz o que entrou, o que ficou de fora e por quê. */
export function describeAdd(r: AddResult): { tone: 'ok' | 'aviso' | 'info'; title: string; body: string } {
  const parts: string[] = [];
  const exts = Object.entries(r.byExt).sort((a, b) => b[1] - a[1]);
  if (exts.length) {
    const top = exts.slice(0, 4).map(([k, v]) => `${formatInt(v)} ${k}`).join(', ');
    parts.push(top + (exts.length > 4 ? ` e mais ${exts.length - 4} formato(s)` : ''));
  }
  if (r.folders) parts.push(`de ${plural(r.folders, 'pasta', 'pastas')}`);
  if (r.reattached) parts.push(`${plural(r.reattached, 'item do registro voltou', 'itens do registro voltaram')} a ser analisável`);
  if (r.repeated) parts.push(`${plural(r.repeated, 'já estava na lista', 'já estavam na lista')}`);
  if (r.lookalikes) parts.push(`${plural(r.lookalikes, 'item tem', 'itens têm')} nome, tamanho e data iguais a outro: se for o mesmo arquivo escolhido duas vezes, tire-o no Acervo`);
  if (r.ignored) parts.push(`${plural(r.ignored, 'arquivo de sistema ou oculto ignorado', 'arquivos de sistema ou ocultos ignorados')}`);
  const added = r.added + r.reattached;
  return {
    tone: !added ? 'info' : r.lookalikes ? 'aviso' : 'ok',
    title: added ? plural(added, 'arquivo organizado', 'arquivos organizados') : 'Nada novo',
    body: parts.join(' · ') || 'Nada foi lido ainda: só nome, tipo, tamanho e data.',
  };
}
