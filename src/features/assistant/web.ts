/**
 * Busca na web e leitura de páginas para o assistente.
 * Funciona no navegador (lida com CORS).
 *
 * Busca: DuckDuckGo Instant Answers API (direto, CORS ok) +
 *         DuckDuckGo HTML via proxy (resultados completos).
 * Leitura: proxy CORS genérico.
 */

const DDG_API = 'https://api.duckduckgo.com/';
const DDG_HTML = 'https://html.duckduckgo.com/html/';

const PROXY = (url: string) =>
  `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  instant?: string;
  source?: string;
  sourceUrl?: string;
}

function stripHtml(h: string): string {
  return h
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

function timedFetch(url: string, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

/* ── DuckDuckGo Instant Answers (direto, CORS ok) ────────────── */

async function ddgInstant(query: string): Promise<SearchResponse> {
  const url = `${DDG_API}?${new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
  })}`;

  const res = await timedFetch(url, 8_000);
  if (!res.ok) throw new Error(`DDG API ${res.status}`);

  const d = (await res.json()) as Record<string, unknown>;
  const results: SearchResult[] = [];

  const push = (t: Record<string, unknown>) => {
    if (t.FirstURL && t.Text)
      results.push({
        title: String(t.Text).slice(0, 120),
        url: String(t.FirstURL),
        snippet: String(t.Text),
      });
  };

  for (const t of ((d.RelatedTopics as Record<string, unknown>[]) ?? [])) {
    push(t);
    for (const s of ((t.Topics as Record<string, unknown>[]) ?? [])) push(s);
  }
  for (const r of ((d.Results as Record<string, unknown>[]) ?? [])) push(r);

  return {
    results: results.slice(0, 12),
    instant: String(d.AbstractText || d.Answer || '') || undefined,
    source: String(d.AbstractSource || '') || undefined,
    sourceUrl: String(d.AbstractURL || '') || undefined,
  };
}

/* ── DuckDuckGo HTML via proxy (resultados completos) ─────────── */

function decodeDdgUrl(raw: string): string {
  const m = raw.match(/uddg=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (raw.startsWith('http')) return raw;
  return '';
}

async function ddgHtml(query: string): Promise<SearchResult[]> {
  const ddgUrl = `${DDG_HTML}?${new URLSearchParams({ q: query })}`;
  const res = await timedFetch(PROXY(ddgUrl), 12_000);
  if (!res.ok) return [];

  const json = (await res.json()) as { contents?: string };
  const html = json.contents ?? '';

  const results: SearchResult[] = [];
  const blocks = html.split(/class="result /);
  for (const blk of blocks.slice(1)) {
    const hrefM = blk.match(/class="result__a"[^>]*href="([^"]*)"/);
    const titleM = blk.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippM = blk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    if (!hrefM || !titleM) continue;
    const url = decodeDdgUrl(hrefM[1]);
    if (!url) continue;
    results.push({
      title: stripHtml(titleM[1]).slice(0, 120),
      url,
      snippet: snippM ? stripHtml(snippM[1]) : '',
    });
  }
  return results.slice(0, 10);
}

/* ── API pública ──────────────────────────────────────────────── */

export async function searchWeb(query: string): Promise<SearchResponse> {
  const instant = await ddgInstant(query).catch((): SearchResponse => ({
    results: [],
  }));

  if (instant.instant || instant.results.length >= 3) return instant;

  const html = await ddgHtml(query).catch((): SearchResult[] => []);
  return {
    ...instant,
    results: html.length > instant.results.length ? html : instant.results,
  };
}

function extractText(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  t = t.replace(/<\/?(p|div|h[1-6]|li|tr|blockquote|section|article)[^>]*>/gi, '\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = stripHtml(t);
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t.slice(0, 10_000);
}

export async function fetchPage(url: string): Promise<string> {
  const res = await timedFetch(PROXY(url), 15_000);
  if (!res.ok) throw new Error(`Não consegui acessar a página (erro ${res.status}).`);

  const json = (await res.json()) as { contents?: string };
  const html = json.contents ?? '';
  if (!html) throw new Error('A página voltou vazia.');

  return extractText(html);
}
