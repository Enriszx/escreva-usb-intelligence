import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, FolderInput, LayoutGrid, List, ListX, Pencil, Search, Trash2, X } from 'lucide-react';
import { useFiles } from './store';
import { CATEGORIES, CATEGORY_LABEL, type Category, type FileEntry } from '../../lib/analysis/types';
import { formatBytes, formatDate, formatInt, plural } from '../../lib/format';
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CAT_VAR } from '../../components/charts/colors';
import { useConfirm, useToast } from '../../app/feedback';
import { FileDetails } from './FileDetails';
import { useFolder } from './folder';
import { MoveDialog, RenameFileDialog, foldersOf } from './fileDialogs';
import { splitPath } from '../../lib/files/backend';

type SortKey = 'nome' | 'tamanho' | 'extensao' | 'data' | 'importado';
type View = 'lista' | 'grade';
type Group = 'nenhum' | 'formato' | 'tipo';
const PAGE = 150;
const PAGE_GRID = 60;
const PREFS_KEY = 'usbi.acervo';

function loadPrefs(): { view: View; group: Group; sort: SortKey } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      view: p.view === 'grade' ? 'grade' : 'lista',
      group: p.group === 'formato' || p.group === 'tipo' ? p.group : 'nenhum',
      sort: ['nome', 'tamanho', 'extensao', 'data', 'importado'].includes(p.sort) ? p.sort : 'nome',
    };
  } catch {
    return { view: 'lista', group: 'nenhum', sort: 'nome' };
  }
}

interface Section {
  key: string;
  title: string | null;
  color: string;
  note: string;
  items: FileEntry[];
}

export function ArchiveTab({ category, setCategory, ext, setExt }: { category: Category | null; setCategory: (c: Category | null) => void; ext: string | null; setExt: (e: string | null) => void }) {
  const { entries, remove, run } = useFiles();
  const confirm = useConfirm();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const qParam = params.get('q');
  useEffect(() => { if (qParam !== null) setQ(qParam); }, [qParam]);
  const prefs = useMemo(loadPrefs, []);
  const [sort, setSort] = useState<SortKey>(prefs.sort);
  const [view, setView] = useState<View>(prefs.view);
  const [group, setGroup] = useState<Group>(prefs.group);
  const [asc, setAsc] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const { thumbUrl } = useFiles();
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ view, group, sort })); } catch { /* preferência é só conveniência */ }
  }, [view, group, sort]);
  const resetLimits = useCallback(() => setLimits({}), []);
  const [detail, setDetail] = useState<FileEntry | null>(null);
  const folder = useFolder();
  const live = !!folder.backend;
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [moving, setMoving] = useState<FileEntry[] | null>(null);
  const busy = !!run || !!folder.busy;

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
      importado: (a, b) => a.importedAt - b.importedAt || a.name.localeCompare(b.name, 'pt-BR'),
    };
    return list.sort((a, b) => cmp[sort](a, b) * dir);
  }, [entries, q, category, ext, sort, asc]);

  const sections = useMemo<Section[]>(() => {
    const sum = (l: FileEntry[]) => `${plural(l.length, 'arquivo', 'arquivos')} · ${formatBytes(l.reduce((a, f) => a + f.size, 0))}`;
    if (group === 'nenhum') return [{ key: '_', title: null, color: '', note: '', items: visible }];
    if (group === 'tipo') {
      return CATEGORIES.map((c) => ({ c, items: visible.filter((f) => f.category === c) }))
        .filter((x) => x.items.length)
        .map((x) => ({ key: x.c, title: CATEGORY_LABEL[x.c], color: CAT_VAR[x.c], note: sum(x.items), items: x.items }));
    }
    const m = new Map<string, FileEntry[]>();
    for (const f of visible) m.set(f.ext || 'sem extensão', [...(m.get(f.ext || 'sem extensão') ?? []), f]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, items]) => ({
      key: k, title: k.toUpperCase(), color: CAT_VAR[items[0].category], note: `${CATEGORY_LABEL[items[0].category]} · ${sum(items)}`, items,
    }));
  }, [visible, group]);

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

  const trashSelected = async (list: FileEntry[]) => {
    const bytes = list.reduce((a, f) => a + f.size, 0);
    if (!(await confirm({ title: `Mandar ${plural(list.length, 'arquivo', 'arquivos')} para a lixeira?`, body: <p>{formatBytes(bytes)} vão para a lixeira do USB Intelligence dentro da pasta conectada. Dá para restaurar ou desfazer.</p>, confirm: 'Mandar para a lixeira' }))) return;
    await folder.trashItems(list.map((f) => f.id));
    setSel(new Set());
  };
  const destroySelected = async (list: FileEntry[]) => {
    const bytes = list.reduce((a, f) => a + f.size, 0);
    if (!(await confirm({
      title: `Apagar ${plural(list.length, 'arquivo', 'arquivos')} definitivamente?`,
      body: <><p><strong>{formatBytes(bytes)} serão apagados do disco/pendrive e não vão para lixeira nenhuma</strong> — nem a do sistema.</p><p>Prefira “Lixeira” se tiver dúvida.</p></>,
      confirm: 'Apagar de vez', danger: true, typeToConfirm: 'APAGAR',
    }))) return;
    await folder.destroy(list.map((f) => f.id));
    setSel(new Set());
  };

  const toggle = (id: string) => setSel((st) => { const n = new Set(st); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const hashCell = (f: FileEntry) =>
    f.hashError ? <span className="tag err">erro de leitura</span>
      : f.sha256 ? <span title={f.sha256}>{f.sha256.slice(0, 10)}…{f.source === 'registro' && <span className="tag fhash-reg">registro</span>}</span>
        : f.source === 'registro' ? <span className="tag">só registro</span> : <span className="muted">não calculado</span>;

  return (
    <div className="archive">
      {!live && <p className="hint archive-mode">Modo leitura: arquivos escolhidos pelo seletor só podem ser analisados. Para renomear, mover ou apagar, use “Conectar pasta”{folder.supported ? ' acima' : ' (disponível no Chrome/Edge do computador ou no app Android)'}.</p>}
      <div className="toolbar">
        <label className="search">
          <Search aria-hidden />
          <span className="sr-only">Pesquisar por nome ou caminho</span>
          <input className="input" type="search" placeholder="Pesquisar por nome" value={q} onChange={(e) => { setQ(e.target.value); resetLimits(); }} />
        </label>
        <label className="field sort-field">
          <span className="sr-only">Ordenar por</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="nome">Ordenar: nome</option>
            <option value="tamanho">Ordenar: tamanho</option>
            <option value="extensao">Ordenar: extensão</option>
            <option value="data">Ordenar: modificação</option>
            <option value="importado">Ordenar: importação</option>
          </select>
        </label>
        <label className="field sort-field">
          <span className="sr-only">Agrupar por</span>
          <select className="select" value={group} onChange={(e) => { setGroup(e.target.value as Group); resetLimits(); }}>
            <option value="nenhum">Sem agrupar</option>
            <option value="formato">Agrupar por formato</option>
            <option value="tipo">Agrupar por tipo</option>
          </select>
        </label>
        <button className="btn btn-ghost btn-icon" onClick={() => { setView(view === 'lista' ? 'grade' : 'lista'); resetLimits(); }} aria-label={view === 'lista' ? 'Mudar para grade com miniaturas' : 'Mudar para lista'} aria-pressed={view === 'grade'}>
          {view === 'lista' ? <LayoutGrid aria-hidden /> : <List aria-hidden />}
        </button>
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
        {selected.length > 0 && (live ? (
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMoving(selected)}><FolderInput aria-hidden /> Mover</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => trashSelected(selected)}><Trash2 aria-hidden /> Lixeira</button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => destroySelected(selected)}><Trash2 aria-hidden /> Apagar de vez</button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={removeSelected} disabled={!!run}>
            <ListX aria-hidden /> Tirar da lista
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty-line">Nenhum arquivo corresponde a esta busca ou filtro.</p>
      ) : (
        sections.map((sec, si) => {
          const page = view === 'grade' ? PAGE_GRID : PAGE;
          const limit = limits[sec.key] ?? page;
          const shown = sec.items.slice(0, limit);
          return (
            <section key={sec.key} className="file-sec" aria-label={sec.title ?? 'Arquivos'}>
              {sec.title && (
                <div className="file-sec-head">
                  <i style={{ background: sec.color }} aria-hidden />
                  <h3 className="h3">{sec.title}</h3>
                  <span className="mono muted">{sec.note}</span>
                </div>
              )}
              {view === 'lista' ? (
                <div className="ftable" role="table" aria-label={sec.title ? `Arquivos: ${sec.title}` : 'Arquivos selecionados'}>
                  <div className={`ftable-head ${si > 0 ? 'sr-only' : ''}`} role="row">
                    <span role="columnheader"><span className="sr-only">Seleção</span></span>
                    <span role="columnheader">Nome</span>
                    <span role="columnheader">Tipo</span>
                    <span role="columnheader" className="r">Tamanho</span>
                    <span role="columnheader">Modificado</span>
                    <span role="columnheader">SHA-256</span>
                  </div>
                  {shown.map((f) => (
                    <div key={f.id} className={`ftable-row ${sel.has(f.id) ? 'is-sel' : ''}`} role="row">
                      <span role="cell">
                        <input type="checkbox" aria-label={`Selecionar ${f.name}`} checked={sel.has(f.id)} onChange={() => toggle(f.id)} />
                      </span>
                      <span role="cell" className="fname">
                        <button className="fname-btn" onClick={() => setDetail(f)}>
                          <i style={{ background: CAT_VAR[f.category] }} aria-hidden />
                          <span>{f.name}</span>
                        </button>
                        {f.path !== f.name && <span className="fpath mono muted">{f.path}</span>}
                        {live && <button className="row-rename" aria-label={`Renomear ${f.name}`} disabled={busy} onClick={() => setRenaming(f)}><Pencil aria-hidden /></button>}
                      </span>
                      <span role="cell" className="mono ftype">{f.ext ? `.${f.ext}` : '—'} <span className="muted">{CATEGORY_LABEL[f.category]}</span></span>
                      <span role="cell" className="num r">{formatBytes(f.size)}</span>
                      <span role="cell" className="mono muted fdate">{f.lastModified ? formatDate(f.lastModified) : '—'}</span>
                      <span role="cell" className="mono fhash">{hashCell(f)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="fgrid">
                  {shown.map((f) => {
                    const url = f.category === 'imagens' && f.ext !== 'heic' && f.ext !== 'svg' ? thumbUrl(f.id) : null;
                    return (
                      <li key={f.id} className={`fcard ${sel.has(f.id) ? 'is-sel' : ''}`}>
                        <label className="fcard-check">
                          <input type="checkbox" aria-label={`Selecionar ${f.name}`} checked={sel.has(f.id)} onChange={() => toggle(f.id)} />
                        </label>
                        <button className="fcard-thumb" onClick={() => setDetail(f)} aria-label={`Detalhes de ${f.name}`}>
                          {url ? (
                            <img src={url} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className="fcard-ext" style={{ color: CAT_VAR[f.category], borderColor: CAT_VAR[f.category] }}>{(f.ext || '?').toUpperCase().slice(0, 4)}</span>
                          )}
                        </button>
                        <b className="fcard-name" title={f.name}>{f.name}</b>
                        <span className="mono muted fcard-meta">{CATEGORY_LABEL[f.category]} · {formatBytes(f.size)}</span>
                        {f.path !== f.name && <span className="mono muted fcard-meta fcard-path" title={f.path}>{f.path}</span>}
                        <span className="fcard-foot">
                          {hashCell(f)}
                          {live && <button className="row-rename-inline" aria-label={`Renomear ${f.name}`} disabled={busy} onClick={() => setRenaming(f)}><Pencil aria-hidden /></button>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {sec.items.length > limit && (
                <button className="btn btn-ghost more-btn" onClick={() => setLimits((l) => ({ ...l, [sec.key]: limit + page }))}>
                  Mostrar mais {Math.min(page, sec.items.length - limit)} de {formatInt(sec.items.length - limit)} restantes
                </button>
              )}
            </section>
          );
        })
      )}
      {renaming && (
        <RenameFileDialog
          entry={renaming}
          siblings={entries.filter((e) => e.id !== renaming.id && splitPath(e.path).dir === splitPath(renaming.path).dir).map((e) => e.name)}
          onClose={() => setRenaming(null)}
          onSave={(n) => folder.rename(renaming.id, n)}
        />
      )}
      {moving && folder.backend && <MoveDialog entries={moving} folders={foldersOf(entries)} rootName={folder.backend.rootName} onClose={() => setMoving(null)} onMove={async (d) => { await folder.move(moving.map((m) => m.id), d); setSel(new Set()); }} />}
      {detail && <FileDetails entry={entries.find((e) => e.id === detail.id) ?? detail} onClose={() => setDetail(null)} onRename={live ? () => { setRenaming(entries.find((e) => e.id === detail.id) ?? detail); setDetail(null); } : undefined} onMove={live ? () => { setMoving([detail]); setDetail(null); } : undefined} onTrash={live ? () => { const d = detail; setDetail(null); trashSelected([d]); } : undefined} />}
    </div>
  );
}
