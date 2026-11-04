#!/usr/bin/env node
/**
 * Auditoria completa: abre TODAS as páginas, nos temas claro e escuro, no
 * computador (1440 px) e no celular (360 px), e procura:
 *  - erros de JavaScript e mensagens de erro no console;
 *  - requisições que falharam (do próprio site);
 *  - problemas de acessibilidade graves ou críticos (axe-core, WCAG 2.1 AA);
 *  - rolagem horizontal (conteúdo mais largo que a tela);
 *  - links internos que apontam para rotas que não existem;
 *  - imagens sem texto alternativo e botões sem nome.
 *   npm run build && npm run audit
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadPlaywright } from './pw.mjs';

const { chromium } = await loadPlaywright();
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 4183;
const BASE = `http://localhost:${PORT}/`;
const ROUTES = ['/', '/automatico', '/arquivos', '/relatorios', '/seguranca', '/casos', '/historico', '/laboratorio', '/personagem', '/configuracoes', '/apresentacao', '/ajuda'];
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
let checks = 0;
for (const scheme of ['dark', 'light']) {
  for (const [vw, vh] of [[1440, 900], [360, 780]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('usbi.acesso', '1'); } catch { /* */ } });
    const page = await ctx.newPage();
    let where = '';
    const add = (kind, msg) => problems.push({ where, kind, msg: String(msg).replace(/\s+/g, ' ').slice(0, 300) });
    page.on('pageerror', (e) => add('erro JS', e.message));
    page.on('console', (m) => { if (m.type() === 'error') add('console', m.text()); });
    page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) add('requisição', `${r.url()} ${r.failure()?.errorText}`); });
    for (const route of ROUTES) {
      where = `${route} · ${scheme} · ${vw}px`;
      await page.goto(`${BASE}#${route}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(900);
      checks++;
      const ovf = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      // Cenas 3D se ajustam ao carregar: só conta se continuar depois de assentar.
      if ((await ovf()) > 1) { await page.waitForTimeout(2500); const o = await ovf(); if (o > 1) add('rolagem horizontal', `${o}px a mais que a tela`); }
      const clipped = await page.evaluate(() => {
        const W = window.innerWidth;
        const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
        return [...document.querySelectorAll('main h1, main h2, main p, main button, main a, .present h1, .present h2, .present p, .present a, .present button')]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > W + 2 && !el.closest('.bb') && !scroller(el); })
          .slice(0, 3).map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" passa ${Math.round(el.getBoundingClientRect().right - W)}px da tela`);
      });
      for (const c of clipped) add('conteúdo cortado', c);
      const bad = await page.evaluate((known) => {
        const out = [];
        for (const a of document.querySelectorAll('a[href]')) {
          const h = a.getAttribute('href');
          if (h === '#' || h === '') out.push(`link vazio: "${a.textContent.trim().slice(0, 40)}"`);
          if (h.startsWith('#/')) { const p = h.slice(1).split(/[?#]/)[0]; if (!known.includes(p)) out.push(`link para rota inexistente: ${h}`); }
        }
        for (const b of document.querySelectorAll('button')) if (!(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('title'))) out.push('botão sem nome');
        for (const i of document.querySelectorAll('img')) if (!i.hasAttribute('alt')) out.push(`imagem sem alt: ${i.src.slice(-40)}`);
        if (!document.querySelector('main h1, .present h1, .present h2')) out.push('página sem título h1');
        return out;
      }, ROUTES);
      for (const b of bad) add('estrutura', b);
      await page.addScriptTag({ content: AXE });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      });
      for (const v of axe) add('acessibilidade', v);
    }
    await ctx.close();
  }
}
// Telas que só aparecem com interação: visualizador, aviso (toast) e painel do Vigia.
for (const scheme of ['dark', 'light']) {
  for (const vw of [1440, 360]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 800 }, colorScheme: scheme, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('usbi.acesso', '1'); } catch { /* */ } });
    const page = await ctx.newPage();
    const where = `interações · ${scheme} · ${vw}px`;
    const add = (kind, msg) => problems.push({ where, kind, msg: String(msg).replace(/\s+/g, ' ').slice(0, 300) });
    page.on('pageerror', (e) => add('erro JS', e.message));
    page.on('console', (m) => { if (m.type() === 'error') add('console', m.text()); });
    await page.goto(`${BASE}#/arquivos`);
    await page.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') }, { name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from('x;y\n1;2') },
    ]);
    const axeNow = async (label) => {
      checks++;
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.filter((x) => ['serious', 'critical'].includes(x.impact)).map((x) => `${x.id} (${x.impact}): ${x.help} — ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
      for (const x of v) add('acessibilidade', `${label}: ${x}`);
    };
    await page.locator('.toast').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.locator('.fname-btn', { hasText: 'b.csv' }).click();
    await page.locator('.viewer-table').waitFor();
    await axeNow('visualizador + aviso');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Abrir o assistente/ }).click();
    await page.locator('.ai-panel').waitFor();
    await axeNow('painel do Vigia');
    await page.getByRole('button', { name: 'Menu' }).first().click().catch(() => {});
    await ctx.close();
  }
}
await browser.close();
server.kill();
console.log(`Auditoria: ${checks} verificações (${ROUTES.length} páginas × 2 temas × 2 tamanhos + telas de interação).`);
if (!problems.length) console.log('✔ Nenhum problema encontrado.');
else {
  const seen = new Set();
  for (const p of problems) {
    const k = `${p.kind}|${p.msg}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const n = problems.filter((x) => `${x.kind}|${x.msg}` === k).length;
    console.log(`✘ [${p.kind}] ${p.msg}\n    em: ${p.where}${n > 1 ? ` (+${n - 1} outros lugares)` : ''}`);
  }
  console.log(`\n${seen.size} problema(s) distinto(s).`);
}
process.exit(problems.length ? 1 : 0);
