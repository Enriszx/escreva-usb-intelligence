import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { summarize } from '../../lib/analysis/summary';
import { findDuplicates } from '../../lib/analysis/duplicates';
import { CRITERION_LABEL, planOrganization, type OrganizeCriterion } from '../../lib/analysis/organize';
import { CATEGORIES, CATEGORY_LABEL, type Category, type FileEntry } from '../../lib/analysis/types';
import { formatBytes } from '../../lib/format';
import { listHistory, HISTORY_LABEL, type Settings } from '../../lib/storage/repos';
import { saveCSV, stamp } from '../../lib/export';
import { put } from '../../lib/storage/db';
import { ACCESSORIES, EYES, FINISHES, HEADS, OUTFITS, POSES, PRESETS, cloneConfig, validateCharacter, type CharacterConfig } from '../character/model';
import { DRAFT_KEY } from '../character/useCharacterEditor';
import { KIND_LABEL, openFile, readTextStart, viewKind } from '../files/viewKind';

/** Lembretes criados pela IA chegam por este evento (o painel mostra e fala). */
export const REMINDER_EVENT = 'usbi:lembrete';
import type { useFiles } from '../files/store';
import type { useFolder } from '../files/folder';
import type { ConfirmOptions } from '../../app/feedback';

/**
 * Ferramentas que o assistente pode usar. São as mesmas funções do app:
 * nenhuma ferramenta faz algo que o usuário não conseguiria fazer clicando.
 * Toda mudança em arquivos passa por uma confirmação do próprio app, e o
 * assistente nunca apaga nada de vez (só manda para a lixeira, que restaura).
 */
export interface ToolContext {
  files: ReturnType<typeof useFiles>;
  folder: ReturnType<typeof useFolder>;
  navigate: NavigateFunction;
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => Promise<void>;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Registra o que a ferramenta está fazendo, para o painel mostrar. */
  report: (line: string) => void;
  /** Modo automático (opcional: nos testes pode faltar). */
  auto?: { phase: string; drive: string | null; runNow: () => Promise<void> };
}

export interface AssistantTool {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  /** Texto curto para o painel enquanto a ferramenta roda. */
  label: string;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

const AREAS: Record<string, string> = {
  inicio: '/', arquivos: '/arquivos', laboratorio: '/laboratorio', personagem: '/personagem', seguranca: '/seguranca',
  relatorios: '/relatorios', historico: '/historico', configuracoes: '/configuracoes', ajuda: '/ajuda',
  automatico: '/automatico', casos: '/casos', apresentacao: '/apresentacao',
};
const TABS = ['acervo', 'painel', 'duplicados', 'nomes', 'organizacao', 'lixeira'];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []);

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function asCategory(v: unknown): Category | null {
  const s = norm(str(v));
  if (!s) return null;
  const hit = CATEGORIES.find((c) => c === s || norm(CATEGORY_LABEL[c]) === s);
  if (hit) return hit;
  const alias: Record<string, Category> = { fotos: 'imagens', foto: 'imagens', musicas: 'audios', musica: 'audios', audio: 'audios', video: 'videos', pdfs: 'documentos', zip: 'compactados', planilha: 'planilhas', apresentacao: 'apresentacoes', slides: 'apresentacoes' };
  return alias[s] ?? null;
}

const fileRow = (f: FileEntry) => ({
  id: f.id, nome: f.name, caminho: f.path, tipo: CATEGORY_LABEL[f.category], extensao: f.ext || null, tamanho: formatBytes(f.size), bytes: f.size,
  modificado: f.lastModified ? new Date(f.lastModified).toISOString().slice(0, 10) : null,
  sha256: f.sha256 ? `${f.sha256.slice(0, 12)}…` : f.hashError ? 'erro de leitura' : 'não calculado',
  aberto: f.source !== 'registro',
});

function requireFolder(ctx: ToolContext) {
  if (!ctx.folder.backend) {
    throw new Error('Nenhuma pasta conectada. Renomear, mover e lixeira só funcionam depois que o usuário toca em "Conectar pasta" na Central de arquivos (Chrome/Edge no computador ou app Android). Peça para ele fazer isso; você não pode conectar sozinho.');
  }
}

function pick(entries: FileEntry[], wanted: string[]) {
  const set = new Set(wanted);
  const found = entries.filter((e) => set.has(e.id));
  const missing = wanted.filter((w) => !found.some((f) => f.id === w));
  if (missing.length) throw new Error(`Ids desconhecidos: ${missing.slice(0, 5).join(', ')}. Use listar_arquivos para pegar os ids atuais.`);
  return found;
}

function listBlock(list: FileEntry[], max = 12): ReactNode {
  return list.slice(0, max).map((f) => `• ${f.path}`).join('\n') + (list.length > max ? `\n… e mais ${list.length - max}` : '');
}

export const TOOLS: AssistantTool[] = [
  {
    name: 'resumo_biblioteca',
    label: 'Lendo o resumo da biblioteca',
    description: 'Resumo dos arquivos que o usuário tem no app agora: totais, tipos, extensões, duplicados, quantos têm hash, se há pasta conectada. Use antes de responder perguntas sobre os arquivos.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_input, ctx) {
      const e = ctx.files.entries;
      const s = summarize(e);
      const dup = findDuplicates(e);
      return {
        arquivos: s.count, volume: formatBytes(s.bytes), bytes: s.bytes,
        por_tipo: s.byCategory.filter((c) => c.count).map((c) => ({ tipo: CATEGORY_LABEL[c.category], arquivos: c.count, volume: formatBytes(c.bytes) })),
        extensoes_principais: s.byExtension.slice(0, 10).map((x) => ({ extensao: x.ext, arquivos: x.count, volume: formatBytes(x.bytes) })),
        com_hash: s.hashed, erros_de_leitura: s.hashErrors,
        so_registro: e.filter((f) => f.source === 'registro').length,
        duplicados: { grupos: dup.groups.length, copias: dup.groups.reduce((a, g) => a + g.files.length - 1, 0), recuperavel: formatBytes(dup.recoverable), sem_hash_ainda: dup.unresolved.length },
        maior: s.largest ? { nome: s.largest.name, tamanho: formatBytes(s.largest.size) } : null,
        pasta_conectada: ctx.folder.backend ? ctx.folder.backend.rootName : null,
        analise_em_andamento: !!ctx.files.run,
      };
    },
  },
  {
    name: 'listar_arquivos',
    label: 'Procurando arquivos',
    description: 'Lista arquivos da biblioteca com filtros. Devolve id, nome, caminho, tipo, tamanho e estado do hash. Os ids servem para renomear, mover, lixeira e tirar da lista.',
    inputSchema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Trecho do nome ou do caminho (sem acento e sem diferenciar maiúsculas).' },
        tipo: { type: 'string', enum: CATEGORIES.map((c) => CATEGORY_LABEL[c]) },
        extensao: { type: 'string', description: 'Ex.: pdf, jpg (sem ponto).' },
        ordenar: { type: 'string', enum: ['nome', 'tamanho', 'modificacao', 'importacao'] },
        decrescente: { type: 'boolean' },
        limite: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    async execute(input, ctx) {
      const needle = norm(str(input.busca));
      const cat = asCategory(input.tipo);
      const ext = norm(str(input.extensao)).replace(/^\./, '');
      let list = ctx.files.entries.filter((f) => (!needle || norm(f.path).includes(needle)) && (!cat || f.category === cat) && (!ext || f.ext === ext));
      const key = str(input.ordenar);
      const cmp: Record<string, (a: FileEntry, b: FileEntry) => number> = {
        nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR'), tamanho: (a, b) => a.size - b.size,
        modificacao: (a, b) => a.lastModified - b.lastModified, importacao: (a, b) => a.importedAt - b.importedAt,
      };
      if (cmp[key]) list = [...list].sort(cmp[key]);
      if (input.decrescente) list.reverse();
      const limit = Math.min(50, Math.max(1, num(input.limite, 20)));
      return { total_encontrado: list.length, mostrando: Math.min(limit, list.length), arquivos: list.slice(0, limit).map(fileRow) };
    },
  },
  {
    name: 'duplicados',
    label: 'Conferindo duplicados',
    description: 'Grupos de arquivos com conteúdo idêntico (por SHA-256, nunca por nome) e o espaço que liberaria manter uma cópia. Se houver candidatos sem hash, diga que é preciso analisar.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_input, ctx) {
      const d = findDuplicates(ctx.files.entries);
      return {
        grupos: d.groups.slice(0, 20).map((g) => ({ tamanho: formatBytes(g.size), arquivos: g.files.map((f) => ({ id: f.id, caminho: f.path })), liberaria: formatBytes(g.recoverable) })),
        total_grupos: d.groups.length, recuperavel: formatBytes(d.recoverable), candidatos_sem_hash: d.unresolved.length,
      };
    },
  },
  {
    name: 'analisar',
    label: 'Analisando arquivos (SHA-256)',
    description: 'Calcula o SHA-256 dos arquivos abertos. modo "duplicados" lê só quem divide tamanho com outro (rápido); "completa" lê todos. Espera terminar e devolve o resultado.',
    inputSchema: { type: 'object', properties: { modo: { type: 'string', enum: ['completa', 'duplicados'] } }, required: ['modo'], additionalProperties: false },
    async execute(input, ctx) {
      if (!ctx.files.entries.length) throw new Error('Não há arquivos. Peça ao usuário para escolher arquivos ou conectar uma pasta na Central de arquivos.');
      if (ctx.files.run) throw new Error('Já existe uma análise em andamento.');
      ctx.report(input.modo === 'duplicados' ? 'Lendo só candidatos a duplicado…' : 'Lendo todos os arquivos…');
      await ctx.files.analyze(input.modo === 'duplicados' ? 'duplicados' : 'completa');
      await new Promise((r) => setTimeout(r, 80));
      const s = summarize(ctx.files.entries);
      const d = findDuplicates(ctx.files.entries);
      return { concluida: true, com_hash: s.hashed, erros: s.hashErrors, grupos_duplicados: d.groups.length, recuperavel: formatBytes(d.recoverable) };
    },
  },
  {
    name: 'abrir_area',
    label: 'Abrindo a área',
    description: 'Leva o usuário a uma área do app. Em "arquivos" dá para abrir uma aba e já aplicar busca, tipo ou extensão no acervo, ou um critério na aba organizacao.',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: Object.keys(AREAS) },
        aba: { type: 'string', enum: TABS },
        busca: { type: 'string' },
        tipo: { type: 'string', enum: CATEGORIES.map((c) => CATEGORY_LABEL[c]) },
        extensao: { type: 'string' },
        criterio: { type: 'string', enum: Object.keys(CRITERION_LABEL) },
      },
      required: ['area'],
      additionalProperties: false,
    },
    async execute(input, ctx) {
      const path = AREAS[str(input.area)];
      if (!path) throw new Error('Área desconhecida.');
      const qs = new URLSearchParams();
      if (path === '/arquivos') {
        const aba = str(input.aba);
        if (TABS.includes(aba)) qs.set('aba', aba);
        if (str(input.busca)) qs.set('q', str(input.busca));
        const cat = asCategory(input.tipo);
        if (cat) qs.set('cat', cat);
        if (str(input.extensao)) qs.set('ext', norm(str(input.extensao)).replace(/^\./, ''));
        if (str(input.criterio) in CRITERION_LABEL) qs.set('criterio', str(input.criterio));
      }
      ctx.navigate(qs.size ? `${path}?${qs}` : path);
      return { aberta: path, filtros: Object.fromEntries(qs) };
    },
  },
  {
    name: 'plano_organizacao',
    label: 'Montando o plano de organização',
    description: 'Propõe pastas para os arquivos sem mexer em nada. criterio: categoria, extensao (tipo/formato), categoria-ano, ano-mes ou tamanho. Abre a aba Organização com o plano.',
    inputSchema: { type: 'object', properties: { criterio: { type: 'string', enum: Object.keys(CRITERION_LABEL) } }, required: ['criterio'], additionalProperties: false },
    async execute(input, ctx) {
      const c = (str(input.criterio) in CRITERION_LABEL ? str(input.criterio) : 'categoria') as OrganizeCriterion;
      const plan = planOrganization(ctx.files.entries, c);
      ctx.navigate(`/arquivos?aba=organizacao&criterio=${c}`);
      return {
        criterio: CRITERION_LABEL[c], arquivos: plan.totalFiles, volume: formatBytes(plan.totalBytes), conflitos_de_nome: plan.conflicts,
        pastas: plan.folders.slice(0, 25).map((f) => ({ pasta: f.folder, arquivos: f.count, volume: formatBytes(f.bytes) })),
        pode_aplicar: !!ctx.folder.backend,
        observacao: ctx.folder.backend ? 'Para mover de verdade, use aplicar_organizacao.' : 'Sem pasta conectada: só dá para exportar o plano. Para aplicar, o usuário precisa conectar a pasta.',
      };
    },
  },
  {
    name: 'aplicar_organizacao',
    label: 'Pedindo confirmação para organizar',
    description: 'Move de verdade os arquivos da pasta conectada para as pastas do plano. O app pede confirmação ao usuário; se ele recusar, nada muda. Pode ser desfeito.',
    inputSchema: { type: 'object', properties: { criterio: { type: 'string', enum: Object.keys(CRITERION_LABEL) } }, required: ['criterio'], additionalProperties: false },
    async execute(input, ctx) {
      requireFolder(ctx);
      const c = (str(input.criterio) in CRITERION_LABEL ? str(input.criterio) : 'categoria') as OrganizeCriterion;
      const plan = planOrganization(ctx.files.entries, c);
      const ops = plan.operations.filter((o) => ctx.files.entries.find((e) => e.id === o.fileId)?.path !== o.to);
      if (!ops.length) return { aplicado: false, motivo: 'Tudo já está organizado por esse critério.' };
      const ok = await ctx.confirm({
        title: `O assistente quer organizar ${ops.length} arquivo(s)`,
        body: `Critério: ${CRITERION_LABEL[c]}. Os arquivos serão MOVIDOS dentro de “${ctx.folder.backend!.rootName}” para ${plan.folders.length} pasta(s). Nada é apagado nem sobrescrito, e dá para desfazer.`,
        confirm: 'Organizar',
      });
      if (!ok) return { aplicado: false, motivo: 'O usuário não autorizou.' };
      const r = await ctx.folder.applyPlan({ ...plan, operations: ops });
      return { aplicado: true, movidos: r.ok, falhas: r.failed.slice(0, 10) };
    },
  },
  {
    name: 'renomear',
    label: 'Pedindo confirmação para renomear',
    description: 'Renomeia um arquivo da pasta conectada (pelo id). O app confirma com o usuário. Pode ser desfeito.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, novo_nome: { type: 'string' } }, required: ['id', 'novo_nome'], additionalProperties: false },
    async execute(input, ctx) {
      requireFolder(ctx);
      const [f] = pick(ctx.files.entries, [str(input.id)]);
      const name = str(input.novo_nome);
      if (!name) throw new Error('Informe o novo nome.');
      const ok = await ctx.confirm({ title: 'O assistente quer renomear um arquivo', body: `${f.path}\n→ ${name}`, confirm: 'Renomear' });
      if (!ok) return { renomeado: false, motivo: 'O usuário não autorizou.' };
      const done = await ctx.folder.rename(f.id, name);
      return { renomeado: done };
    },
  },
  {
    name: 'mover',
    label: 'Pedindo confirmação para mover',
    description: 'Move arquivos da pasta conectada (pelos ids) para outra pasta dentro dela, criando-a se precisar. O app confirma com o usuário. Pode ser desfeito.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, pasta: { type: 'string', description: 'Caminho relativo, ex.: Documentos/2024. Vazio = raiz.' } }, required: ['ids', 'pasta'], additionalProperties: false },
    async execute(input, ctx) {
      requireFolder(ctx);
      const list = pick(ctx.files.entries, ids(input.ids));
      const dest = str(input.pasta).replace(/^\/+|\/+$/g, '');
      const ok = await ctx.confirm({ title: `O assistente quer mover ${list.length} arquivo(s)`, body: `Para: ${dest || '(raiz)'}\n\n${listBlock(list)}`, confirm: 'Mover' });
      if (!ok) return { movidos: 0, motivo: 'O usuário não autorizou.' };
      const r = await ctx.folder.move(list.map((f) => f.id), dest);
      return { movidos: r.ok, falhas: r.failed.slice(0, 10) };
    },
  },
  {
    name: 'enviar_para_lixeira',
    label: 'Pedindo confirmação para a lixeira',
    description: 'Manda arquivos da pasta conectada para a lixeira do app (restaurável). O app confirma com o usuário. Você NÃO pode apagar de vez: se o usuário pedir, explique que ele faz isso na aba Lixeira.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'], additionalProperties: false },
    async execute(input, ctx) {
      requireFolder(ctx);
      const list = pick(ctx.files.entries, ids(input.ids));
      const ok = await ctx.confirm({ title: `O assistente quer mandar ${list.length} arquivo(s) para a lixeira`, body: `${formatBytes(list.reduce((a, f) => a + f.size, 0))}. Dá para restaurar na aba Lixeira.\n\n${listBlock(list)}`, confirm: 'Mandar para a lixeira' });
      if (!ok) return { enviados: 0, motivo: 'O usuário não autorizou.' };
      const r = await ctx.folder.trashItems(list.map((f) => f.id));
      return { enviados: r.ok, falhas: r.failed.slice(0, 10) };
    },
  },
  {
    name: 'tirar_da_lista',
    label: 'Tirando itens da lista',
    description: 'Tira arquivos só da lista de análise (não toca no arquivo original). Funciona sem pasta conectada.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'], additionalProperties: false },
    async execute(input, ctx) {
      const list = pick(ctx.files.entries, ids(input.ids));
      ctx.files.remove(list.map((f) => f.id));
      return { tirados: list.length };
    },
  },
  {
    name: 'exportar',
    label: 'Gerando arquivo',
    description: 'Gera um arquivo CSV para o usuário salvar: "plano" (pasta sugerida para cada arquivo), "duplicados" ou "lista" (todos os arquivos).',
    inputSchema: { type: 'object', properties: { o_que: { type: 'string', enum: ['plano', 'duplicados', 'lista'] } }, required: ['o_que'], additionalProperties: false },
    async execute(input, ctx) {
      const e = ctx.files.entries;
      if (!e.length) throw new Error('Não há arquivos para exportar.');
      const what = str(input.o_que);
      let rows: Record<string, unknown>[];
      if (what === 'duplicados') {
        rows = findDuplicates(e).groups.flatMap((g, i) => g.files.map((f, j) => ({ grupo: i + 1, papel: j ? 'cópia' : 'manter', caminho: f.path, bytes: f.size, sha256: g.sha256 })));
        if (!rows.length) throw new Error('Não há duplicados confirmados (talvez falte analisar).');
      } else if (what === 'plano') {
        const plan = planOrganization(e, 'extensao');
        rows = plan.operations.map((o) => ({ origem: o.from, destino: o.to, bytes: o.size }));
      } else {
        rows = e.map((f) => ({ nome: f.name, caminho: f.path, tipo: CATEGORY_LABEL[f.category], bytes: f.size, sha256: f.sha256 ?? '' }));
      }
      const r = await saveCSV(rows, `usbi-${what}-${stamp()}.csv`);
      return { resultado: r === 'cancelado' ? 'o usuário cancelou ou o arquivo foi mostrado para copiar' : r, linhas: rows.length };
    },
  },
  {
    name: 'mudar_tema',
    label: 'Trocando o tema',
    description: 'Troca o tema visual: automatico (cada página no seu desenho), claro ou escuro.',
    inputSchema: { type: 'object', properties: { tema: { type: 'string', enum: ['automatico', 'claro', 'escuro'] } }, required: ['tema'], additionalProperties: false },
    async execute(input, ctx) {
      const t = str(input.tema) as Settings['theme'];
      if (!['automatico', 'claro', 'escuro'].includes(t)) throw new Error('Tema inválido.');
      await ctx.updateSettings({ theme: t });
      return { tema: t };
    },
  },
  {
    name: 'personagem',
    label: 'Ajustando o personagem',
    description: `Muda o personagem 3D (o Vigia) e abre a tela dele. Estilos: ${PRESETS.map((p) => p.name).join(', ')}. Cores em #RRGGBB. A mudança pode ser desfeita no editor; para guardar, o usuário toca em Salvar.`,
    inputSchema: {
      type: 'object',
      properties: {
        estilo: { type: 'string', enum: PRESETS.map((p) => p.name) },
        cor_principal: { type: 'string' }, cor_secundaria: { type: 'string' }, cor_detalhes: { type: 'string' }, cor_luz: { type: 'string' },
        acabamento: { type: 'string', enum: [...FINISHES] }, olhos: { type: 'string', enum: [...EYES] }, cobertura: { type: 'string', enum: [...HEADS] },
        traje: { type: 'string', enum: [...OUTFITS] }, pose: { type: 'string', enum: [...POSES] },
        acessorios: { type: 'array', items: { type: 'string', enum: [...ACCESSORIES] }, description: 'Lista completa dos acessórios que devem ficar ligados.' },
      },
      additionalProperties: false,
    },
    async execute(input, ctx) {
      const preset = PRESETS.find((p) => p.name === str(input.estilo));
      const base: CharacterConfig = cloneConfig(preset?.config ?? (await currentCharacter()));
      const c = JSON.parse(JSON.stringify(base)) as CharacterConfig;
      const color = (k: keyof CharacterConfig['colors'], v: unknown) => { if (str(v)) c.colors[k] = str(v).toLowerCase(); };
      color('primary', input.cor_principal); color('secondary', input.cor_secundaria); color('detail', input.cor_detalhes); color('glow', input.cor_luz);
      if (str(input.acabamento)) c.finish = str(input.acabamento) as CharacterConfig['finish'];
      if (str(input.olhos)) c.eyes = str(input.olhos) as CharacterConfig['eyes'];
      if (str(input.cobertura)) c.head = str(input.cobertura) as CharacterConfig['head'];
      if (str(input.traje)) c.outfit = str(input.traje) as CharacterConfig['outfit'];
      if (str(input.pose)) c.pose = str(input.pose) as CharacterConfig['pose'];
      if (Array.isArray(input.acessorios)) for (const a of ACCESSORIES) c.accessories[a] = input.acessorios.includes(a);
      const v = validateCharacter(c);
      if (!v.ok || !v.value) throw new Error(v.errors.join(' '));
      const draft = { config: v.value, name: 'Meu Vigia', currentId: null, presetId: preset?.id ?? null };
      await put('settings', { key: DRAFT_KEY, value: draft }).catch(() => {});
      window.dispatchEvent(new CustomEvent('usbi:personagem', { detail: { config: v.value, presetId: preset?.id ?? null } }));
      ctx.navigate('/personagem');
      return { aplicado: true, configuracao: v.value };
    },
  },
  {
    name: 'historico',
    label: 'Lendo o histórico',
    description: 'Últimas operações registradas no aparelho (análises, organizações, exportações…), com data.',
    inputSchema: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 30 } }, additionalProperties: false },
    async execute(input) {
      const h = await listHistory();
      return h.slice(0, Math.min(30, num(input.limite, 10))).map((x) => ({ quando: new Date(x.at).toLocaleString('pt-BR'), tipo: HISTORY_LABEL[x.type], titulo: x.title, resultado: x.result }));
    },
  },
  {
    name: 'abrir_arquivo',
    label: 'Abrindo o arquivo',
    description: 'Abre um arquivo da biblioteca no visualizador do app (imagem, vídeo, áudio, PDF, planilha CSV, texto ou código; outros tipos oferecem baixar). Use o id de listar_arquivos.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    async execute(input, ctx) {
      const [f] = pick(ctx.files.entries, [str(input.id)]);
      openFile(f.id);
      return { aberto: f.name, como: KIND_LABEL[viewKind(f.ext, f.mime)] };
    },
  },
  {
    name: 'ler_arquivo',
    label: 'Lendo o conteúdo do arquivo',
    description: 'Lê o TEXTO de um arquivo de texto, código ou CSV (até 15 mil caracteres) para resumir, explicar, revisar ou responder perguntas sobre ele. Só funciona com permissão do usuário, que o app pede. Não lê PDF, Word ou imagens.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    async execute(input, ctx) {
      const [f] = pick(ctx.files.entries, [str(input.id)]);
      const k = viewKind(f.ext, f.mime);
      if (k !== 'texto' && k !== 'tabela') throw new Error(`"${f.name}" não é um arquivo de texto (${KIND_LABEL[k]}). Ofereça abrir_arquivo para o usuário ver.`);
      const blob = ctx.files.getFile(f.id) ?? (ctx.folder.backend?.kind === 'web' && f.source === 'pasta' ? await ctx.folder.backend.getBlob(f.path) : null);
      if (!blob) throw new Error('O conteúdo deste item não está disponível agora (é só o registro salvo). Peça para escolher o arquivo de novo.');
      const ok = await ctx.confirm({
        title: `Deixar a IA ler “${f.name}”?`,
        body: 'O texto do arquivo será lido pela IA para responder ao seu pedido. Com a IA online ligada, esse texto vai para o serviço gratuito (Pollinations). Com a IA do aparelho, nada sai daqui.',
        confirm: 'Permitir leitura',
      });
      if (!ok) return { lido: false, motivo: 'O usuário não autorizou a leitura.' };
      const { text, cut } = await readTextStart(blob, 15_000);
      return { lido: true, arquivo: f.name, cortado: cut, texto: text };
    },
  },
  {
    name: 'modo_automatico',
    label: 'Modo automático',
    description: 'Consulta o estado do modo automático do pendrive ou manda executar de novo (ler, verificar, duplicados, organizar, relatório). Se o pendrive ainda não foi configurado, leva o usuário à tela certa: a primeira conexão exige um toque dele.',
    inputSchema: { type: 'object', properties: { acao: { type: 'string', enum: ['estado', 'executar'] } }, required: ['acao'], additionalProperties: false },
    async execute(input, ctx) {
      const a = ctx.auto;
      if (!a) throw new Error('Modo automático indisponível.');
      if (str(input.acao) === 'executar') {
        if (a.phase === 'pronto' || a.phase === 'erro') {
          void a.runNow();
          ctx.navigate('/automatico');
          return { executando: true, pendrive: a.drive };
        }
        ctx.navigate('/automatico');
        return { executando: false, estado: a.phase, observacao: a.phase === 'indisponivel' ? 'Este navegador não acessa pastas (celular): use o app Android ou escolha os arquivos na Central.' : 'Peça ao usuário para tocar em "Conectar pendrive" ou encaixar o pendrive; depois tudo roda sozinho.' };
      }
      return { estado: a.phase, pendrive: a.drive };
    },
  },
  {
    name: 'lembrete',
    label: 'Criando lembrete',
    description: 'Cria um lembrete que aparece na tela (e é falado, se a voz estiver ligada) daqui a N minutos. Vale enquanto o site estiver aberto.',
    inputSchema: { type: 'object', properties: { minutos: { type: 'number', minimum: 0.1, maximum: 720 }, texto: { type: 'string' } }, required: ['minutos', 'texto'], additionalProperties: false },
    async execute(input) {
      const min = Math.min(720, Math.max(0.1, num(input.minutos, 5)));
      const texto = str(input.texto).slice(0, 200) || 'Lembrete';
      setTimeout(() => window.dispatchEvent(new CustomEvent(REMINDER_EVENT, { detail: { texto } })), min * 60_000);
      const at = new Date(Date.now() + min * 60_000);
      return { criado: true, quando: at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), texto, aviso: 'Só funciona com o site aberto.' };
    },
  },
];

async function currentCharacter(): Promise<CharacterConfig> {
  const { get } = await import('../../lib/storage/db');
  const d = await get<{ key: string; value: { config: CharacterConfig } }>('settings', DRAFT_KEY).catch(() => undefined);
  return d?.value?.config ?? PRESETS[0].config;
}

export function toolByName(name: string) {
  return TOOLS.find((t) => t.name === name);
}
