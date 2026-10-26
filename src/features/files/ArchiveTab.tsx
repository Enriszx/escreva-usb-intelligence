import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Search, Trash2, X } from 'lucide-react';
import { useFiles } from './store';
import { CATEGORIES, CATEGORY_LABEL, type Category, type FileEntry } from '../../lib/analysis/types';
import { formatBytes, formatDate, formatInt, plural } from '../../lib/format';
import { CAT_VAR } from '../../components/charts/colors';
import { useConfirm, useToast } from '../../app/feedback';
import { FileDetails } from './FileDetails';

type SortKey = 'nome' | 'tamanho' | 'extensao' | 'data';
const PAGE = 150;

export function ArchiveTab({ category, setCategory, ext, setExt }: { category: Category | null; setCategory: (c: Category | null) => void; ext: string | null; setExt: (e: string | null) => void }) {
  const { entries, remove, run } = useFiles();
  const confirm = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('nome');
  const [asc, setAsc] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<FileEntry | null>(null);

  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    entries.forEach((f) => m.set(f.category, (m.get(f.category) ?? 0) + 1));
    return m;
  }, [entries]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const list = entries.filter((f) => {
      if (category && f.category !== category) return false;
      if (ext && (f.ext || '(sem extensão)') !== ext) return false;
      if (!needle) return true;
      return f.path.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(needle);
    });
    const dir = asc ? 1 : -1;
    const cmp: Record<SortKey, (a: FileEntry, b: FileEntry) => number> = {
      nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
      tamanho: (a, b) => a.size - b.size,
      extensao: (a, b) => a.ext.localeCompare(b.ext) || a.name.localeCompare(b.name, 'pt-BR'),
      data: (a, b) => a.lastModified - b.lastModified,
    };
    return list.sort((a, b) => cmp[sort](a, b) * dir);
  }, [entries, q, category, ext, sort, asc]);

  const visibleBytes = visible.reduce((s, f) => s + f.size, 0);
  const allSelected = visible.length > 0 && visible.every((f) => sel.has(f.id));
  const selected = entries.filter((f) => sel.has(f.id));

  const removeSelected = async () => {
    const ok = await confirm({
      title: `Tirar ${plural(selected.length, 'arquivo', 'arquivos')} da análise?`,
      body: <p>Eles saem apenas desta lista. <strong>Os arquivos originais continuam intactos</strong> no aparelho ou no pendrive.</p>,
      confirm: 'Tirar da lista',
    });
    if (!ok) return;
    remove(selected.map((f) => f.id));
    setSel(new Set());
    toast({ tone: 'ok', title: 'Lista atualizada', body: `${plural(selected.length, 'item removido', 'itens removidos')} da análise.` });
  };

  return (
    <div className="archive">
      <div className="toolbar">
        <label className="search">
          <Search aria-hidden />
          <span className="sr-only">Pesquisar por nome ou caminho</span>
          <input className="input" type="search" placeholder="Pesquisar por nome" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </label>
        <label className="field sort-field">
          <span className="sr-only">Ordenar por</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="nome">Ordenar: nome</option>
            <option value="tamanho">Ordenar: tamanho</option>
            <option value="extensao">Ordenar: extensão</option>
            <option value="data">Ordenar: data</option>
          </select>
        </label>
        <button className="btn btn-ghost btn-icon" onClick={() => setAsc(!asc)} aria-label={asc ? 'Ordem crescente — inverter' : 'Ordem decrescente — inverter'}>
          {asc ? <ArrowDownAZ aria-hidden /> : <ArrowUpAZ aria-hidden />}
        </button>
      </div>

      <div className="chips" role="group" aria-label="Filtrar por categoria">
        <button className={`chip ${!category ? 'is-on' : ''}`} aria-pressed={!category} onClick={() => setCategory(null)}>
          Todas <span className="num">{formatInt(entries.length)}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? 'is-on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)} disabled={!counts.get(c)}>
            <i style={{ background: CAT_VAR[c] }} aria-hidden /> {CATEGORY_LABEL[c]} <span className="num">{formatInt(counts.get(c) ?? 0)}</span>
          </button>
        ))}
        {ext && (
          <button className="chip is-on" onClick={() => setExt(null)}>
            .{ext} <X aria-hidden />
            <span className="sr-only">remover filtro de extensão</span>
          </button>
        )}
      </div>

      <div className="selection-bar" aria-live="polite">
        <label className="check">
          <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(visible.map((f) => f.id)))} disabled={!visible.length} />
          <span>Selecionar visíveis</span>
        </label>
        <span className="mono muted">
          {plural(visible.length, 'arquivo', 'arquivos')} · {formatBytes(visibleBytes)}
          {selected.length > 0 && ` · ${formatInt(selected.length)} selecionados (${formatBytes(selected.reduce((s, f) => s + f.size, 0))})`}
        </span>
        {selected.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={removeSelected} disabled={!!run}>
            <Trash2 aria-hidden /> Tirar da lista
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="empty-line">Nenhum arquivo corresponde a esta busca ou filtro.</p>
      ) : (
        <div className="ftable" role="table" aria-label="Arquivos selecionados">
          <div className="ftable-head" role="row">
            <span role="columnheader"><span className="sr-only">Seleção</span></span>
            <span role="columnheader">Nome</span>
            <span role="columnheader">Tipo</span>
            <span role="columnheader" className="r">Tamanho</span>
            <span role="columnheader">Modificado</span>
            <span role="columnheader">SHA-256</span>
          </div>
          {visible.slice(0, limit).map((f) => (
            <div key={f.id} className={`ftable-row ${sel.has(f.id) ? 'is-sel' : ''}`} role="row">
              <span role="cell">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${f.name}`}
                  checked={sel.has(f.id)}
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}
                />
              </span>
              <span role="cell" className="fname">
                <button className="fname-btn" onClick={() => setDetail(f)}>
                  <i style={{ background: CAT_VAR[f.category] }} aria-hidden />
                  <span>{f.name}</span>
                </button>
                {f.path !== f.name && <span className="fpath mono muted">{f.path}</span>}
              </span>
              <span role="cell" className="mono ftype">{f.ext ? `.${f.ext}` : '—'} <span className="muted">{CATEGORY_LABEL[f.category]}</span></span>
              <span role="cell" className="num r">{formatBytes(f.size)}</span>
              <span role="cell" className="mono muted fdate">{f.lastModified ? formatDate(f.lastModified) : '—'}</span>
              <span role="cell" className="mono fhash">
                {f.hashError ? <span className="tag err">erro de leitura</span> : f.sha256 ? <span title={f.sha256}>{f.sha256.slice(0, 10)}…</span> : <span className="muted">não calculado</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {visible.length > limit && (
        <button className="btn btn-ghost more-btn" onClick={() => setLimit((l) => l + PAGE)}>
          Mostrar mais {Math.min(PAGE, visible.length - limit)} de {formatInt(visible.length - limit)} restantes
        </button>
      )}
      {detail && <FileDetails entry={entries.find((e) => e.id === detail.id) ?? detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
