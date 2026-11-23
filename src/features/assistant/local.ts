import type { AssistantTool, ToolContext } from './tools';
import { toolByName } from './tools';
import { PRESETS } from '../character/model';

/**
 * Modo sem IA: entende um conjunto fixo de comandos em português, usando as
 * mesmas ferramentas. Funciona offline e não envia nada para lugar nenhum.
 */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const CAT_WORDS: [RegExp, string][] = [
  [/\b(pdfs?|documentos?|docs?|textos?)\b/, 'Documentos'],
  [/\b(planilhas?|excel|xlsx|csv)\b/, 'Planilhas'],
  [/\b(apresentac(ao|oes)|slides?|pptx?)\b/, 'Apresentações'],
  [/\b(fotos?|imagens?|jpe?g|png)\b/, 'Imagens'],
  [/\b(videos?|filmes?|mp4)\b/, 'Vídeos'],
  [/\b(musicas?|audios?|mp3)\b/, 'Áudios'],
  [/\b(zips?|compactados?|rar)\b/, 'Compactados'],
];
const COLOR_WORDS: [RegExp, string][] = [
  [/\bazul\b/, '#3d7bff'], [/\bverde\b/, '#2fd57f'], [/\bamarel[oa]\b/, '#ffdf00'], [/\blaranja\b/, '#ff7a1a'],
  [/\brosa\b/, '#e5487a'], [/\broxo\b/, '#9b6bff'], [/\bbranc[oa]\b/, '#f4f7f2'], [/\bvermelh[oa]\b/, '#ff4d4d'],
];
const HAIR_WORDS: [RegExp, string][] = [
  [/black ?power/, 'blackpower'], [/cachead/, 'cacheado'], [/tranca/, 'trancas'], [/rabo/, 'rabo'], [/coque/, 'coque'], [/franja/, 'franja'],
  [/raspad/, 'raspado'], [/careca/, 'careca'], [/crista|moicano/, 'crista'], [/(cabelo )?longo/, 'longo'], [/(cabelo )?curto/, 'curto'],
];

const AREA_WORDS: [RegExp, string][] = [
  [/\b(inicio|home|comeco)\b/, 'inicio'], [/\b(central|arquivos?|acervo)\b/, 'arquivos'], [/\blaboratorio|3d\b/, 'laboratorio'],
  [/\bpersonagem|vigia 3d\b/, 'personagem'], [/\bseguranca|cofre|hash\b/, 'seguranca'], [/\brelatorios?\b/, 'relatorios'],
  [/\bhistorico\b/, 'historico'], [/\b(configurac(ao|oes)|ajustes)\b/, 'configuracoes'], [/\b(ajuda|diagnostico)\b/, 'ajuda'],
];

export const LOCAL_HELP = `Sem IA conectada, eu entendo comandos diretos, por exemplo:
• "resumo" ou "quantos arquivos eu tenho?"
• "analisar" / "procurar duplicados"
• "mostrar duplicados"
• "maiores arquivos"
• "buscar contrato" / "mostrar PDFs" / "fotos"
• "organizar por tipo" (ou por formato, data, tamanho)
• "tema escuro" / "tema claro"
• "abrir segurança" / "ir para relatórios"
• "estilo Núcleo Azul", "personagem menina", "cabelo cacheado"
• "deixa o site azul" / "cantos redondos" / "letra maior" / "visual original"
• "me chama de chefe" / "sou mulher" / "seu nome é Íris"
• "desfazer" / "restaurar lixeira" / "fazer backup"
• "falar as respostas" / "parar de falar"
Para conversar livremente, ative a IA grátis em Configurações → Assistente.`;

type Run = (name: string, input?: Record<string, unknown>) => Promise<unknown>;

/**
 * `strict`: devolve null quando não reconhece o pedido (em vez da ajuda),
 * para a IA do aparelho cuidar das perguntas abertas.
 */
export async function runLocal(text: string, ctx: ToolContext, onTool: (t: AssistantTool) => void): Promise<string>;
export async function runLocal(text: string, ctx: ToolContext, onTool: (t: AssistantTool) => void, strict: true): Promise<string | null>;
export async function runLocal(text: string, ctx: ToolContext, onTool: (t: AssistantTool) => void, strict = false): Promise<string | null> {
  const t = norm(text);
  const run: Run = async (name, input = {}) => {
    const tool = toolByName(name)!;
    onTool(tool);
    return tool.execute(input, ctx);
  };
  type Sum = { arquivos: number; volume: string; por_tipo: { tipo: string; arquivos: number; volume: string }[]; duplicados: { grupos: number; copias: number; recuperavel: string; sem_hash_ainda: number }; com_hash: number };

  if (!t) return strict ? null : LOCAL_HELP;
  // Com a IA ligada, o caminho rápido só pega comandos curtos e diretos ("tema escuro",
  // "procurar duplicados"). Perguntas abertas e pedidos de explicação ficam com a IA.
  if (strict && (t.split(/\s+/).length > 6 || /\b(explic|o que (e|eh|sao|significa)|por ?que|como (funciona|faz|eu|posso)|diferenc|significa|conte|fale|me ajud|pode me|voce acha|devo)/.test(t))) return null;
  if (!strict && /\b(ajuda|comandos?|o que (voce|vc) (faz|sabe))\b/.test(t)) return LOCAL_HELP;

  const theme = /\btema\s+(claro|escuro|automatico)\b/.exec(t) ?? (/\bmodo\s+(claro|escuro)\b/.exec(t));
  if (theme) {
    await run('mudar_tema', { tema: theme[1] });
    return `Pronto: tema ${theme[1]}.`;
  }

  // Visual do site
  const cor = COLOR_WORDS.find(([re]) => re.test(t));
  if (cor && /\b(site|cor|destaque|visual|deixa|muda|troca|botoes)\b/.test(t) && !/personagem/.test(t)) {
    await run('personalizar_visual', { cor_destaque: cor[1] });
    return `Pronto: destaque ${cor[1]} no site inteiro.`;
  }
  if (/\b(visual|aparencia) (original|padrao)\b|\brestaura(r)? (o )?visual/.test(t)) {
    await run('personalizar_visual', { restaurar: true });
    return 'Voltei o visual original.';
  }
  if (/\bcantos?\b/.test(t)) {
    const cantos = /ret|quadrad/.test(t) ? 'reto' : /redond/.test(t) ? 'redondo' : 'padrao';
    await run('personalizar_visual', { cantos });
    return `Cantos: ${cantos}.`;
  }
  if (/\b(letra|texto|fonte)s? (maior|menor|normal)/.test(t)) {
    const tamanho_texto = /maior/.test(t) ? Math.min(1.25, ctx.settings.uiFont + 0.1) : /menor/.test(t) ? Math.max(0.9, ctx.settings.uiFont - 0.1) : 1;
    await run('personalizar_visual', { tamanho_texto });
    return 'Tamanho do texto ajustado.';
  }

  // Perfil
  const chama = /\b(me chama|me chame|pode me chamar)\s+de\s+(.+)$/.exec(t);
  if (chama) {
    const nome = text.trim().slice(-chama[2].length).replace(/[.!?]+$/, '');
    await run('meu_perfil', { como_chamar: nome });
    return `Combinado, ${nome}.`;
  }
  const nomeIa = /\b(seu nome (e|sera|vai ser)|voce (se chama|vai se chamar)|te chamar de)\s+(.+)$/.exec(t);
  if (nomeIa) {
    const nome = text.trim().slice(-nomeIa[4].length).replace(/[.!?]+$/, '');
    await run('meu_perfil', { nome_assistente: nome });
    return `Gostei. Agora eu sou ${nome}.`;
  }
  if (/\bsou (mulher|menina|moca)\b|\bno feminino\b/.test(t)) { await run('meu_perfil', { genero: 'feminino' }); return 'Anotado: falo com você no feminino.'; }
  if (/\bsou (homem|menino|rapaz)\b|\bno masculino\b/.test(t)) { await run('meu_perfil', { genero: 'masculino' }); return 'Anotado: falo com você no masculino.'; }

  // Operações da pasta e dados
  if (/^desfaz|\bdesfazer\b/.test(t)) {
    const r = (await run('desfazer')) as { desfeito: boolean; operacao?: string; motivo?: string };
    return r.desfeito ? `Desfeito: ${r.operacao}.` : r.motivo ?? 'Nada para desfazer.';
  }
  if (/lixeira/.test(t) && /restaur|recuper|volta/.test(t)) {
    const r = (await run('lixeira', { acao: 'restaurar' })) as { restaurados: number; motivo?: string };
    return r.restaurados ? `Restaurei ${r.restaurados} arquivo(s) da lixeira.` : r.motivo ?? 'Nada restaurado.';
  }
  if (/\bbackup\b/.test(t)) {
    await run('backup');
    return 'Backup gerado. Guarde o arquivo em outro lugar (pendrive, nuvem).';
  }
  if (/\b(fala|falar|leia|ler) (as )?respostas|\bfala em voz alta|\bliga(r)? a voz/.test(t)) { await run('configurar', { falar_respostas: true }); return 'Vou falar as respostas em voz alta.'; }
  if (/\b(para|parar|pare) de falar|\bdesliga(r)? a voz|\bsem voz\b/.test(t)) { await run('configurar', { falar_respostas: false }); return 'Ok, só por texto.'; }

  // Personagem por partes
  if (/\bpersonagem\b|\bvigia 3d\b/.test(t) && /menin[oa]|cabelo|black|tranca|cachead|coque|vestido|moletom|social|capa|oculos|\bcor\b/.test(t)) {
    const input: Record<string, unknown> = {};
    if (/menina|feminin/.test(t)) input.corpo = 'menina'; else if (/menino|masculin/.test(t)) input.corpo = 'menino';
    const h = HAIR_WORDS.find(([re]) => re.test(t)); if (h) input.cabelo = h[1];
    if (/vestido/.test(t)) input.traje = 'vestido'; else if (/moletom/.test(t)) input.traje = 'moletom'; else if (/social|gravata/.test(t)) input.traje = 'social'; else if (/esportiv/.test(t)) input.traje = 'esportivo';
    const c = COLOR_WORDS.find(([re]) => re.test(t)); if (c) input.cor_principal = c[1];
    await run('personagem', input);
    return 'Personagem atualizado. Toque em Salvar no editor para guardar.';
  }

  const preset = PRESETS.find((p) => t.includes(norm(p.name)));
  if (preset) {
    await run('personagem', { estilo: preset.name });
    return `Apliquei o estilo ${preset.name} no personagem. Toque em Salvar no editor para guardar.`;
  }

  if (/\b(analis|calcul|hash)/.test(t) && !/\bmostr/.test(t)) {
    const modo = /duplic|rapid/.test(t) ? 'duplicados' : 'completa';
    const r = (await run('analisar', { modo })) as { com_hash: number; grupos_duplicados: number; recuperavel: string; erros: number };
    return `Análise ${modo === 'completa' ? 'completa' : 'rápida'} concluída: ${r.com_hash} arquivo(s) com hash, ${r.grupos_duplicados} grupo(s) de duplicados (${r.recuperavel} recuperáveis)${r.erros ? `, ${r.erros} com erro de leitura` : ''}.`;
  }

  if (/duplic|copias|repetid/.test(t)) {
    const d = (await run('duplicados')) as { total_grupos: number; recuperavel: string; candidatos_sem_hash: number; grupos: { arquivos: { caminho: string }[] }[] };
    await run('abrir_area', { area: 'arquivos', aba: 'duplicados' });
    if (!d.total_grupos) return d.candidatos_sem_hash ? `Ainda não dá para afirmar: ${d.candidatos_sem_hash} arquivo(s) dividem tamanho com outro e precisam de hash. Diga "analisar duplicados".` : 'Nenhum duplicado encontrado.';
    return `${d.total_grupos} grupo(s) de conteúdo idêntico; manter uma cópia de cada liberaria ${d.recuperavel}. Abri a aba Duplicados.\n` + d.grupos.slice(0, 3).map((g) => `• ${g.arquivos.map((a) => a.caminho).join('  =  ')}`).join('\n');
  }

  const org = /organiz/.test(t);
  if (org) {
    const criterio = /formato|extens/.test(t) ? 'extensao' : /mes|data|ano/.test(t) ? (/tipo|categoria/.test(t) ? 'categoria-ano' : 'ano-mes') : /tamanho/.test(t) ? 'tamanho' : 'categoria';
    const p = (await run('plano_organizacao', { criterio })) as { arquivos: number; pastas: { pasta: string; arquivos: number }[]; pode_aplicar: boolean };
    if (!p.arquivos) return 'Ainda não há arquivos para organizar. Escolha arquivos ou conecte uma pasta na Central de arquivos e peça de novo.';
    return `Plano por ${criterio}: ${p.arquivos} arquivo(s) em ${p.pastas.length} pasta(s) — ${p.pastas.slice(0, 5).map((x) => `${x.pasta} (${x.arquivos})`).join(', ')}${p.pastas.length > 5 ? '…' : ''}. Abri a aba Organização. ${p.pode_aplicar ? 'Para mover de verdade, toque em "Aplicar organização".' : 'Nada foi movido.'}`;
  }

  if (/\bmaior/.test(t)) {
    const r = (await run('listar_arquivos', { ordenar: 'tamanho', decrescente: true, limite: 5 })) as { arquivos: { nome: string; tamanho: string }[] };
    if (!r.arquivos.length) return 'Ainda não há arquivos na biblioteca.';
    return 'Maiores arquivos:\n' + r.arquivos.map((a) => `• ${a.nome} — ${a.tamanho}`).join('\n');
  }

  const busca = /\b(busca|buscar|procura|procurar|encontra|encontrar|ache|achar|onde esta)\s+(.+)/.exec(t);
  const cat = CAT_WORDS.find(([re]) => re.test(t));
  if (busca || (cat && /\b(mostr|lista|ver|quais|quantos?|meus|minhas)\b/.test(t)) || (cat && t.split(' ').length <= 2)) {
    const termo = busca?.[2]?.replace(/^(o|a|os|as|arquivo|arquivos)\s+/, '').trim();
    const input = cat && !busca ? { tipo: cat[1], limite: 10 } : { busca: termo, limite: 10 };
    const r = (await run('listar_arquivos', input)) as { total_encontrado: number; arquivos: { nome: string; tamanho: string }[] };
    await run('abrir_area', { area: 'arquivos', aba: 'acervo', ...(cat && !busca ? { tipo: cat[1] } : { busca: termo }) });
    if (!r.total_encontrado) return 'Não encontrei nada com isso.';
    return `${r.total_encontrado} encontrado(s). Abri o acervo filtrado.\n` + r.arquivos.slice(0, 8).map((a) => `• ${a.nome} — ${a.tamanho}`).join('\n');
  }

  if (/\b(resumo|quant|total|espaco|ocupa)/.test(t)) {
    const s = (await run('resumo_biblioteca')) as Sum;
    if (!s.arquivos) return 'A biblioteca está vazia. Escolha arquivos ou conecte uma pasta na Central de arquivos.';
    return `Você tem ${s.arquivos} arquivo(s), ${s.volume} no total. Por tipo: ${s.por_tipo.map((x) => `${x.tipo} ${x.arquivos}`).join(', ')}. ${s.com_hash} com hash; ${s.duplicados.grupos} grupo(s) de duplicados (${s.duplicados.recuperavel} recuperáveis).`;
  }

  // "abrir contrato", "mostra a foto da praia": abre o arquivo cujo nome bate melhor.
  const ab = /\b(abr[aei]r?|abre|mostr[ae]r?|ver|visualiz[ae]r?)\s+(?:o |a |os |as )?(?:arquivo |foto |documento |video |musica )?(.+)$/.exec(t);
  if (ab) {
    const want = ab[2].replace(/[.?!]+$/, '').trim();
    const scored = ctx.files.entries
      .map((f) => { const n = norm(f.name); const base = n.replace(/\.[^.]+$/, ''); return { f, s: base === want ? 3 : n === want ? 3 : n.startsWith(want) ? 2 : n.includes(want) ? 1 : 0 }; })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length);
    if (scored.length) {
      const f = scored[0].f;
      await run('abrir_arquivo', { id: f.id });
      return scored.length > 1 ? `Abri ${f.name}. Encontrei ${scored.length} arquivos parecidos; diga o nome completo para abrir outro.` : `Abri ${f.name}.`;
    }
  }

  const area = AREA_WORDS.find(([re]) => re.test(t));
  if (area && /\b(abr|ir|va|vai|leva|mostr|entra)/.test(t)) {
    await run('abrir_area', { area: area[1] });
    return 'Abri.';
  }

  if (strict) return null;
  return `Não entendi esse pedido no modo sem IA.\n\n${LOCAL_HELP}`;
}
