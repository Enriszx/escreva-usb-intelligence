#!/usr/bin/env node
/**
 * Testes de ponta a ponta no Chromium real (Playwright), contra o build de produção.
 *   npm run build && npm run e2e
 */
import { spawn } from 'node:child_process';
import { loadPlaywright } from './pw.mjs';

const { chromium } = await loadPlaywright();
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
const errors = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(['PASSOU', name]);
  } catch (e) {
    if (e.message === '__pulou__') return;
    results.push(['FALHOU', `${name} — ${e.message.split('\n')[0]}`]);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/falha-${name.slice(0, 2).replace(/\W/g, '')}.png`, fullPage: true }).catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

// A senha tem seu próprio teste; nos demais, a sessão já entra liberada.
const UNLOCK = () => { try { sessionStorage.setItem('usbi.acesso', '1'); } catch { /* sem sessionStorage */ } };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
// Força o caminho de download (o seletor "Salvar como" abriria uma janela nativa).
await context.addInitScript(() => { delete window.showSaveFilePicker; });
await context.addInitScript(UNLOCK);
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} @ ${page.url()} ${m.location().url}:${m.location().lineNumber}`));
page.on('pageerror', (e) => errors.push(`${e.message} @ ${page.url()} :: ${(e.stack || '').split('\n').slice(1, 4).join(' | ')}`));
const go = async (r) => { await page.goto(`${BASE}#${r}`); await page.waitForLoadState('networkidle'); };
const toast = (t) => page.locator('.toast', { hasText: t }).first().waitFor({ timeout: 8000 });

await test('1. Página inicial abre com título, ações e fluxo interativo', async () => {
  await go('/');
  assert(/encaixe o pendrive/i.test(await page.locator('h1').innerText()), 'título ausente');
  await page.getByRole('link', { name: /Começar agora/ }).waitFor();
  await page.getByRole('link', { name: /Ver como funciona/ }).click();
  await page.waitForTimeout(800);
  assert(await page.locator('#como-funciona').isVisible(), 'seção como funciona');
  await page.getByRole('button', { name: /Acha cópias/ }).click();
  assert(/Compara conteúdo, não nome/.test(await page.locator('.flow-detail').innerText()), 'etapa interativa');
  assert(await page.locator('.bb').count(), 'fundo inspirado na bandeira');
  await page.locator('#experiencia .seg label', { hasText: 'Quantidade' }).click();
  assert(/Quantidade por tipo/.test(await page.locator('#experiencia .chart-title').innerText()), 'gráfico alterna a medida');
});

await test('2. Navegação: todas as rotas do índice abrem', async () => {
  // O Modo apresentação cobre a tela inteira: fica por último.
  const titles = ['Início', 'Modo automático', 'Central de arquivos', 'Casos reais', 'Laboratório 3D', 'Meu personagem', 'Segurança', 'Relatórios', 'Histórico', 'Configurações', 'Ajuda e diagnóstico', 'Modo apresentação'];
  for (const t of titles) {
    await page.getByRole('button', { name: 'Menu' }).click();
    assert((await page.locator('#indice .index-group').count()) === 4, 'menu em 4 grupos');
    await page.locator('#indice').getByRole('link', { name: new RegExp(`^${t}`) }).click();
    await page.waitForTimeout(500);
    assert(!(await page.getByText('Erro 404').count()), `${t} caiu no 404`);
    assert(await page.locator('main h1').count(), `${t} sem h1`);
  }
  await go('/rota-que-nao-existe');
  await page.getByText(/Fora/).first().waitFor({ timeout: 5000 });
});

await test('3. Objeto 3D é renderizado (canvas WebGL com pixels)', async () => {
  await go('/laboratorio');
  await page.waitForTimeout(1500);
  const box = await page.locator('.lab-stage canvas').boundingBox();
  assert(box && box.width > 200, 'canvas ausente');
  const buf = await page.screenshot({ clip: box });
  assert(buf.length > 20000, 'canvas vazio');
});

await test('4. Controles do personagem alteram o modelo 3D', async () => {
  await go('/personagem');
  await page.waitForTimeout(1800);
  const clip = await page.locator('.char-stage canvas').boundingBox();
  const before = await page.screenshot({ clip });
  await page.getByRole('button', { name: /Núcleo Azul/ }).click();
  await page.waitForTimeout(1500);
  const after = await page.screenshot({ clip });
  assert(!before.equals(after), 'preset não mudou a cena');
  const hex = await page.getByLabel('Cor principal em hexadecimal').inputValue();
  assert(hex === '#1464f4', `cor principal ${hex}`);
  await page.getByRole('button', { name: 'Usar #ffd600' }).first().click();
  await page.waitForTimeout(1200);
  const after2 = await page.screenshot({ clip });
  assert(!after.equals(after2), 'cor não mudou a cena');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  assert((await page.getByLabel('Cor principal em hexadecimal').inputValue()) === '#1464f4', 'desfazer');
});

await test('5. Salvar personagem e restaurar após recarregar', async () => {
  await page.getByLabel('Nome', { exact: true }).fill('Teste E2E');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await toast('Personagem salvo');
  await page.reload();
  await page.waitForTimeout(1500);
  assert(await page.locator('.saved-list').getByText('Teste E2E').count(), 'não restaurou da coleção');
  assert((await page.getByLabel('Nome', { exact: true }).inputValue()) === 'Teste E2E', 'rascunho não restaurou');
});

await test('6. Importação rejeita JSON inválido sem perder a configuração', async () => {
  const hexBefore = await page.getByLabel('Cor principal em hexadecimal').inputValue();
  await page.locator('input[type=file][accept*=json]').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, colors: { primary: 'verde' }, head: 'chapeu' })) });
  await page.getByText('Importação recusada').waitFor();
  await page.getByRole('button', { name: 'Entendi' }).click();
  assert((await page.getByLabel('Cor principal em hexadecimal').inputValue()) === hexBefore, 'configuração alterada');
  await page.locator('input[type=file][accept*=json]').setInputFiles({ name: 'texto.json', mimeType: 'application/json', buffer: Buffer.from('{nao é json') });
  await page.getByText('não é um JSON válido').waitFor();
  await page.getByRole('button', { name: 'Entendi' }).click();
});

const files = [
  { name: 'relatorio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('conteudo A do relatorio') },
  { name: 'copia-com-outro-nome.pdf', mimeType: 'application/pdf', buffer: Buffer.from('conteudo A do relatorio') },
  { name: 'relatorio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('conteudo B diferente!!!') },
  { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5000, 7) },
  { name: 'musica.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(1234, 1) },
];
const totalBytes = files.reduce((s, f) => s + f.buffer.length, 0);

await test('7/8. Seleção de arquivos e cálculo de tamanho', async () => {
  await go('/arquivos');
  await page.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles(files);
  await toast('5 arquivos organizados');
  const status = await page.locator('.files-status').innerText();
  assert(status.includes('5 arquivos'), `contagem: ${status}`);
  const kb = (totalBytes / 1024).toFixed(1).replace('.', ',');
  assert(status.includes(`${kb} KB`), `tamanho esperado ${kb} KB em: ${status}`);
  await page.getByRole('searchbox', { name: /Pesquisar/ }).fill('musica');
  assert((await page.locator('.ftable-row').count()) === 1, 'pesquisa');
  await page.getByRole('searchbox', { name: /Pesquisar/ }).fill('');
  await page.getByRole('button', { name: /Imagens/ }).click();
  assert((await page.locator('.ftable-row').count()) === 1, 'filtro');
  await page.getByRole('button', { name: /Todas/ }).click();
});

await test('10. Duplicados diferenciam nome igual de conteúdo igual', async () => {
  await page.getByRole('button', { name: /Análise completa/ }).click();
  await toast('Análise concluída');
  await page.getByRole('tab', { name: /Duplicados/ }).click();
  assert((await page.locator('.dup-group').count()) === 1, 'esperado 1 grupo');
  const g = await page.locator('.dup-group').innerText();
  assert(g.includes('relatorio.pdf') || g.includes('copia-com-outro-nome.pdf'), 'grupo errado');
  assert((await page.locator('.dups-total').innerText()).includes('23 B'), 'espaço recuperável');
  await page.getByRole('tab', { name: /Nomes/ }).click();
  assert(await page.locator('.name-group', { hasText: 'conteúdo diferente' }).count(), 'nomes iguais com conteúdo diferente');
});

await test('11. Gráficos usam os resultados calculados', async () => {
  await page.getByRole('tab', { name: /Visão geral/ }).click();
  const center = await page.locator('.donut-center').innerText();
  const kb = (totalBytes / 1024).toFixed(1).replace('.', ',');
  assert(center.includes(kb), `centro do gráfico: ${center}`);
  assert(/3 arquivos/i.test(await page.locator('.legend-item', { hasText: 'Documentos' }).innerText()), 'legenda');
  await page.locator('.legend-item', { hasText: 'Imagens' }).click();
  assert((await page.locator('section[aria-labelledby=g-ext] .bar-row').count()) === 1, 'filtro cruzado');
  // gráficos novos usam os mesmos dados calculados
  assert((await page.locator('#g-cats').locator('xpath=..').locator('.bar-row').count()) === 3, 'barras de espaço: uma por tipo com volume, com valor escrito');
  assert(/Concluído\s*5/.test((await page.locator('.stack-legend').innerText()).replace(/\n/g, ' ')), 'status: 5 concluídos');
  assert((await page.locator('.kpi-card').first().innerText()).includes('5'), 'KPI total');
});

await test('12. Relatórios exportam JSON e CSV corretos', async () => {
  await page.getByRole('tab', { name: /Duplicados/ }).click();
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  const csv = (await (await import('node:fs')).promises.readFile(await d.path(), 'utf8'));
  assert(csv.includes('grupo;papel;nome') && csv.includes('copia-com-outro-nome.pdf'), 'CSV de duplicados');
  await go('/relatorios');
  await page.locator('.rp-title').first().click();
  const [j] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).click()]);
  const json = JSON.parse(await (await import('node:fs')).promises.readFile(await j.path(), 'utf8'));
  assert(json.totals.arquivos === 5 && json.totals.gruposDuplicados === 1, 'JSON do relatório');
  await go('/historico');
  await page.locator('.h-item', { hasText: 'Análise completa' }).first().waitFor({ timeout: 5000 });
});

// A senha não fica no repositório: o teste usa E2E_SENHA (e um build feito com VITE_PASS_HASH).
const SENHA = process.env.E2E_SENHA;
await test('18. Senha: recusa errada, aceita a certa (com espaço e outra caixa), limita tentativas', async () => {
  if (!SENHA) {
    results.push(['PULOU', '18. Senha — defina E2E_SENHA (e VITE_PASS_HASH no build) para testar']);
    throw new Error('__pulou__');
  }
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await c.newPage();
  await g.goto(`${BASE}#/`);
  await g.locator('#senha').waitFor();
  assert(/intelligence/i.test(await g.locator('main h1').innerText()), 'tela de senha');
  assert(!(await g.locator('.hero').count()), 'app não carrega antes da senha');
  await g.locator('#senha').fill('errada');
  await g.getByRole('button', { name: 'Entrar' }).click();
  await g.getByRole('alert').filter({ hasText: 'Senha incorreta' }).waitFor();
  await g.locator('#senha').fill(`${SENHA}x`);
  await g.getByRole('button', { name: 'Entrar' }).click();
  await g.getByRole('alert').filter({ hasText: 'Senha incorreta' }).waitFor();
  // teclado de celular: espaço no fim e caixa trocada continuam valendo
  await g.locator('#senha').fill(`${SENHA.toLowerCase()} `);
  await g.getByRole('button', { name: 'Entrar' }).click();
  await g.locator('.hero').waitFor();
  await g.reload();
  await g.locator('.hero').waitFor(); // continua liberado na mesma aba
  const g2 = await (await browser.newContext()).newPage();
  await g2.goto(`${BASE}#/`);
  for (let i = 0; i < 5; i++) {
    await g2.locator('#senha').fill(`x${i}`);
    await g2.getByRole('button', { name: 'Entrar' }).click();
    await g2.waitForTimeout(150);
  }
  await g2.getByText(/Muitas tentativas/).first().waitFor();
  assert(await g2.locator('#senha').isDisabled(), 'campo travado após 5 erros');
  assert(!(await g2.locator('.hero').count()), 'continua bloqueado');
  await c.close();
});

await test('19. Tema: alterna automático → claro → escuro e persiste', async () => {
  await go('/relatorios');
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? 'automatico');
  assert((await theme()) === 'automatico', 'começa automático');
  await page.getByRole('button', { name: /^Tema automático/ }).click();
  assert((await theme()) === 'light', 'claro');
  await page.getByRole('button', { name: /^Tema claro/ }).click();
  assert((await theme()) === 'dark', 'escuro');
  const lum = (css) => css.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0);
  await go('/relatorios'); // página desenhada em gelo, agora escura
  const dark = lum(await page.evaluate(() => getComputedStyle(document.querySelector('.app')).backgroundColor));
  assert(dark < 200, `relatórios deveria ficar escuro (soma RGB ${dark})`);
  await page.reload();
  await page.waitForTimeout(800);
  assert((await theme()) === 'dark', 'tema persistiu após recarregar');
  await page.getByRole('button', { name: /^Tema escuro/ }).click();
  assert((await theme()) === 'automatico', 'volta ao automático');
});

await test('13. Estados de erro: hash divergente e senha errada no cofre', async () => {
  await go('/seguranca');
  await page.locator('.hash-tool input[type=file]').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') });
  await page.locator('.hash-big').waitFor();
  assert((await page.locator('.hash-big').innerText()) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha-256 de "abc"');
  await page.getByLabel(/Hash de referência/).fill('0'.repeat(64));
  await page.getByText('Não corresponde.').waitFor();
  await page.getByLabel(/Hash de referência/).fill('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  a.txt');
  await page.getByText('Corresponde.').waitFor();
  // cofre: cifra e tenta abrir com senha errada
  await page.locator('.vault-form input[type=file]').setInputFiles({ name: 'segredo.txt', mimeType: 'text/plain', buffer: Buffer.from('segredo') });
  await page.locator('#pw1').fill('senha-forte-123');
  await page.locator('#pw2').fill('senha-forte-123');
  await page.locator('.ack input').check();
  const [enc] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Cifrar e salvar/ }).click()]);
  const encPath = await enc.path();
  await page.getByRole('radio', { name: /Abrir cofre/ }).check();
  await page.locator('.vault-form input[type=file]').setInputFiles(encPath);
  await page.locator('#pw-open').fill('senha-errada');
  await page.getByRole('button', { name: /Abrir e salvar/ }).click();
  await page.getByText('Senha incorreta ou arquivo alterado').waitFor({ timeout: 30000 });
  await page.locator('#pw-open').fill('senha-forte-123');
  const [dec] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Abrir e salvar/ }).click()]);
  assert(dec.suggestedFilename() === 'segredo.txt', 'nome original');
  assert((await (await import('node:fs')).promises.readFile(await dec.path(), 'utf8')) === 'segredo', 'conteúdo recuperado');
});

await test('20. Biblioteca: grade, agrupar por tipo, Planilhas/Apresentações e arquivos de sistema', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const p = await c.newPage();
  await p.goto(`${BASE}#/arquivos`);
  await p.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([
    { name: 'orcamento.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('planilha') },
    { name: 'aula.pptx', mimeType: 'application/octet-stream', buffer: Buffer.from('slides!') },
    { name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') },
    { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') },
    { name: 'Thumbs.db', mimeType: 'application/octet-stream', buffer: Buffer.from('lixo') },
    { name: '.DS_Store', mimeType: 'application/octet-stream', buffer: Buffer.from('lixo2') },
  ]);
  const t = p.locator('.toast').first();
  await t.waitFor();
  const txt = await t.innerText();
  assert(/4 arquivos organizados/.test(txt), `aviso de importação: ${txt}`);
  assert(/2 arquivos de sistema ou ocultos ignorados/.test(txt), `aviso de ignorados: ${txt}`);
  assert((await p.locator('.ftable-row').count()) === 4, 'só 4 linhas (sistema ficou de fora)');
  await p.getByRole('button', { name: /Planilhas/ }).click();
  assert((await p.locator('.ftable-row').count()) === 1, 'filtro Planilhas');
  await p.getByRole('button', { name: /Todas/ }).click();
  await p.getByRole('button', { name: /Mudar para grade/ }).click();
  assert((await p.locator('.fcard').count()) === 4, 'grade com 4 cartões');
  assert((await p.locator('.fcard-thumb img').count()) === 1, 'miniatura real da imagem');
  await p.waitForFunction(() => { const i = document.querySelector('.fcard-thumb img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
  assert((await p.locator('.fcard-thumb img').evaluate((i) => i.naturalWidth)) === 1, 'miniatura carregou de verdade');
  await p.getByLabel('Agrupar por').selectOption('tipo');
  const heads = await p.locator('.file-sec-head h3').allInnerTexts();
  assert(['Documentos', 'Planilhas', 'Apresentações', 'Imagens'].every((h) => heads.some((x) => x.toLowerCase() === h.toLowerCase())), `grupos: ${heads.join(',')}`);
  await p.getByLabel('Agrupar por').selectOption('formato');
  assert((await p.locator('.file-sec').count()) === 4, 'um grupo por formato');
  await p.reload();
  await p.locator('.fcard, .ftable').first().waitFor();
  assert((await p.locator('.fgrid').count()) > 0 && (await p.locator('.ftable').count()) === 0, 'preferência de grade lembrada');
  await c.close();
});

await test('21. Registro: lembra os arquivos ao recarregar e reabre a leitura ao escolher de novo', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usbi-'));
  const a = path.join(dir, 'a.txt');
  const b = path.join(dir, 'b.pdf');
  fs.writeFileSync(a, 'conteudo A');
  fs.writeFileSync(b, 'conteudo B!');
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const p = await c.newPage();
  await p.goto(`${BASE}#/arquivos`);
  await p.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([a, b]);
  await p.getByRole('button', { name: /Análise completa/ }).click();
  await p.locator('.toast', { hasText: 'Análise concluída' }).first().waitFor({ timeout: 10000 });
  await p.reload();
  await p.locator('.files-status', { hasText: '2 arquivos' }).waitFor({ timeout: 10000 });
  assert((await p.locator('.fhash-reg').count()) === 2, 'itens marcados como registro, com hash guardado');
  assert(/registro/.test(await p.locator('.analysis-bar').innerText()), 'barra explica que é só registro');
  // escolher de novo os mesmos arquivos: reabre a leitura sem duplicar
  await p.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([a, b]);
  await p.locator('.toast', { hasText: /voltaram a ser analisável/ }).first().waitFor();
  assert((await p.locator('.ftable-row').count()) === 2, 'sem duplicar o registro');
  assert((await p.locator('.fhash-reg').count()) === 0, 'não são mais só registro');
  // apagar o registro nas configurações: depois de recarregar, a lista volta vazia
  await p.goto(`${BASE}#/configuracoes`);
  await p.locator('.clear-list li', { hasText: 'Registro de arquivos' }).getByRole('button', { name: /Apagar/ }).click();
  await p.locator('.modal').getByRole('button', { name: 'Apagar', exact: true }).click();
  await p.locator('.toast', { hasText: 'Registro de arquivos: apagado' }).first().waitFor();
  await p.reload();
  await p.goto(`${BASE}#/arquivos`);
  await p.getByText('Nenhum arquivo selecionado.').waitFor();
  await c.close();
});

await test('22. Soltar arquivos em qualquer lugar da página importa e abre a Central', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const p = await c.newPage();
  await p.goto(`${BASE}#/`);
  await p.locator('.hero').waitFor();
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['olá'], 'solto.txt', { type: 'text/plain' }));
    dt.items.add(new File(['x'], 'Thumbs.db'));
    document.body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await p.waitForFunction(() => location.hash === '#/arquivos');
  await p.locator('.fname-btn', { hasText: 'solto.txt' }).waitFor();
  assert((await p.locator('.ftable-row').count()) === 1, 'só o arquivo real entrou');
  await c.close();
});

await test('23. Assistente sem IA: resumo, personagem e tema por comando', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const p = await c.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}#/arquivos`);
  await p.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('igual') },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: Buffer.from('igual') },
    { name: 'c.png', mimeType: 'image/png', buffer: Buffer.from('outro conteudo') },
  ]);
  await p.getByRole('button', { name: /Abrir o assistente/ }).click();
  await p.locator('.ai-engine', { hasText: 'Sem IA' }).waitFor();
  const ask = async (text) => {
    const before = await p.locator('.ai-msg.is-assistant').count();
    await p.locator('#ai-input').fill(text);
    await p.locator('#ai-input').press('Enter');
    const last = p.locator('.ai-msg.is-assistant').nth(before);
    await last.locator('.ai-text').waitFor();
    return last.innerText();
  };
  assert(/3 arquivo/.test(await ask('quantos arquivos eu tenho?')), 'resumo');
  assert(/Análise completa concluída: 3/.test(await ask('analisar')), 'análise pelo assistente');
  assert(/1 grupo/.test(await ask('mostrar duplicados')), 'duplicados depois da análise');
  assert((await p.evaluate(() => location.hash)).includes('aba=duplicados'), 'abriu a aba Duplicados');
  await ask('estilo Núcleo Azul');
  await p.waitForFunction(() => location.hash.startsWith('#/personagem'));
  await p.waitForFunction(() => document.querySelector('[aria-label="Cor principal em hexadecimal"]')?.value === '#1464f4', null, { timeout: 8000 });
  await ask('tema escuro');
  assert((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'tema escuro pelo assistente');
  assert(/Não entendi/.test(await ask('xyzzy')), 'pedido desconhecido explica os comandos');
  assert(!perr.length, perr.join(' | '));
  await c.close();
});

await test('24. IA grátis do aparelho: sem Claude, escolha de modelo e ativação honesta', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const externos = [];
  c.on('request', (r) => { if (/anthropic\.com|claude\.ai/.test(r.url())) externos.push(r.url()); });
  const p = await c.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}#/configuracoes#assistente`);
  const sec = p.locator('#assistente');
  await sec.waitFor();
  assert((await p.locator('#ai-model option').count()) === 3, 'três modelos para escolher');
  assert(/Qwen2\.5 1,5B/.test(await p.locator('#ai-model option:checked').innerText()), 'recomendado selecionado');
  assert(!(await p.locator('#ai-key').count()), 'não pede chave de API');
  // Sem WebGPU no Chromium de teste: explica; com WebGPU: oferece o download.
  await sec.locator('.error-text, button:has-text("Baixar e ativar")').first().waitFor();
  const texto = await sec.innerText();
  assert(/WebGPU|Baixar e ativar/.test(texto), 'estado da WebGPU explicado');
  assert(!/Claude|Anthropic|sk-ant/.test(texto), 'nada de Claude nas configurações');
  await p.locator('#ai-model').selectOption({ index: 0 });
  await p.locator('.toast', { hasText: 'Modelo escolhido' }).first().waitFor({ timeout: 8000 });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ai-model')?.value?.startsWith('Qwen2.5-0.5B'), null, { timeout: 8000 })
    .catch(() => { throw new Error('modelo escolhido persiste'); });
  await p.getByRole('button', { name: /Abrir o assistente/ }).click();
  await p.locator('.ai-engine', { hasText: 'Sem IA' }).waitFor();
  assert(/Nada sai deste aparelho/i.test(await p.locator('.ai-panel').innerText()), 'privacidade');
  await p.locator('#ai-input').fill('quantos arquivos eu tenho?');
  await p.locator('#ai-input').press('Enter');
  await p.locator('.ai-msg.is-assistant .ai-text').waitFor();
  assert(!externos.length, `nenhuma chamada externa de IA (${externos.join(', ')})`);
  assert(!perr.length, perr.join(' | '));
  await c.close();
});

await test('25. IA online grátis: ativa com um toque, usa ferramenta, formata, lembra a conversa e tem plano B', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(UNLOCK);
  const bodies = [];
  let falhar = false;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  const sse = (chunks) => chunks.map((d) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: d }] })}\n\n`).join('') + 'data: [DONE]\n\n';
  await c.route('https://text.pollinations.ai/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (falhar) return route.fulfill({ status: 500, headers: cors, body: 'erro' });
    const body = req.postDataJSON();
    bodies.push(body);
    const last = body.messages.at(-1);
    const chunks = last.role === 'tool'
      ? [{ content: `Você tem **${JSON.parse(last.content).arquivos} arquivos**:\n- um PDF\n- uma imagem` }]
      : [{ reasoning: 'vou consultar' }, { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'resumo_biblioteca', arguments: '{}' } }] }];
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse(chunks) });
  });
  const p = await c.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}#/arquivos`);
  await p.locator('.intake input[type=file]:not([webkitdirectory])').first().setInputFiles([
    { name: 'nota.pdf', mimeType: 'application/pdf', buffer: Buffer.from('1') },
    { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('22') },
  ]);
  await p.getByRole('button', { name: /Abrir o assistente/ }).click();
  assert(!bodies.length, 'nada é enviado antes de ativar');
  await p.getByRole('button', { name: 'Ativar IA online grátis' }).click();
  await p.locator('.ai-engine', { hasText: /online/i }).waitFor();
  await p.locator('#ai-input').fill('o que tem na minha biblioteca?');
  await p.locator('#ai-input').press('Enter');
  const msg = p.locator('.ai-msg.is-assistant').last();
  await msg.locator('.md strong', { hasText: '2 arquivos' }).waitFor({ timeout: 15000 });
  assert(await msg.locator('.md li').count() === 2, 'lista formatada');
  assert(/resumo da biblioteca/i.test(await msg.locator('.ai-tools').innerText()), 'mostrou a ferramenta usada');
  assert(bodies.length === 2 && bodies[0].stream === true && bodies[0].tools.some((t) => t.function.name === 'renomear'), 'streaming com as ferramentas do app');
  assert(!JSON.stringify(bodies).includes('"content":"1"'), 'conteúdo de arquivo não vai para o serviço');
  // A conversa continua depois de recarregar.
  await p.reload();
  await p.getByRole('button', { name: /Abrir o assistente/ }).click();
  await p.locator('.ai-msg.is-assistant .md strong', { hasText: '2 arquivos' }).waitFor();
  // Plano B: serviço fora do ar → comandos, com aviso.
  falhar = true;
  await p.locator('#ai-input').fill('tema escuro');
  await p.locator('#ai-input').press('Enter');
  await p.locator('.ai-note', { hasText: /modo de comandos/ }).waitFor({ timeout: 15000 });
  assert((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'plano B executou o comando');
  assert(!perr.length, perr.join(' | '));
  await c.close();
});

await test('26. Modo automático: um toque na 1ª vez; depois detecta, executa, solta e repete sozinho', async () => {
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addInitScript(UNLOCK);
  // Pendrive simulado: uma pasta real no OPFS. "Remover" = apagar a pasta; "encaixar" = recriá-la.
  await c.addInitScript(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('AUTO', { create: true }); });
  const p = await c.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  const plug = () => p.evaluate(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('AUTO', { create: true });
    const put = async (name, text) => { const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put('foto.jpg', 'IMAGEM-123'); await put('foto (1).jpg', 'IMAGEM-123'); await put('nota.txt', 'texto'); await put('planilha.xlsx', 'xlsx');
  });
  const unplug = () => p.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('AUTO', { recursive: true }));
  const tree = () => p.evaluate(async () => { const out = []; const walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, pre + n + '/'); else out.push(pre + n); } }; await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('AUTO'), ''); return out.sort(); });
  const toast = (t, ms = 20000) => p.locator('.toast', { hasText: t }).first().waitFor({ timeout: ms });
  const steps = async () => (await p.locator('.sv').allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  await p.goto(`${BASE}#/automatico`);
  await p.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('AUTO', { recursive: true }).catch(() => {}));
  await plug();
  assert(/Configurar pendrive/.test(await p.locator('.chip').innerText()), 'chip pede configuração');
  await p.getByRole('button', { name: 'Conectar pendrive' }).click();
  await toast('pronto');
  let st = await steps();
  assert(/4 arquivos/.test(st[1]) && /4 arquivos verificados/.test(st[2]) && /1 cópia extra/.test(st[3]), `1ª execução: ${st.join(' | ')}`);
  assert(/Não executado/.test(st[4]) && /Salvo em Relatórios/.test(st[5]), 'sem mover nada por padrão; relatório salvo');
  assert((await p.locator('.stat-grid .stat').count()) === 4 && (await p.locator('.auto-result .bar-row').count()) >= 3, 'KPIs e barras com dados reais');
  assert((await tree()).length === 4, 'nada mudou no pendrive por padrão');
  await unplug();
  await toast('Pendrive removido', 15000);
  assert(/Aguardando/.test(await p.locator('.chip').innerText()), 'chip aguardando');
  for (const label of ['Cópias extras para a lixeira', 'Organizar em pastas']) {
    await p.locator('label.switch', { hasText: label }).locator('input').click();
    await p.getByRole('button', { name: 'Ligar' }).click();
  }
  await p.waitForTimeout(500);
  await plug(); // nenhum toque daqui em diante
  await p.waitForFunction(() => /lixeira do app/.test(document.querySelectorAll('.sv')[3]?.textContent ?? '') && /Salvo/.test(document.querySelectorAll('.sv')[5]?.textContent ?? ''), null, { timeout: 30000 })
    .catch(() => {});
  st = await steps();
  assert(/1 na lixeira do app/.test(st[3]) && /movidos/.test(st[4]), `2ª execução: ${st.join(' | ')}`);
  const t = await tree();
  assert(t.includes('Imagens/foto.jpg') && t.includes('Documentos/nota.txt') && t.some((x) => x.startsWith('.usbi-lixeira/')), `pendrive organizado: ${t.join(', ')}`);
  assert(!perr.length, perr.join(' | '));
  await c.close();
});

await test('27. Casos reais, Verificador de backup e Modo apresentação', async () => {
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addInitScript(UNLOCK);
  const p = await c.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}#/casos`);
  await p.locator('.case').first().waitFor();
  const total = await p.locator('.case').count();
  assert(total === 12, `12 casos (${total})`);
  assert((await p.locator('.case-src[href^="https://"]').count()) === 12, 'todo caso tem fonte');
  await p.getByRole('radio', { name: /Vazamento e mídia perdida/ }).click();
  assert((await p.locator('.case').count()) === 2, 'filtro por tipo');
  // Verificador: a cópia tem um arquivo alterado (mesmo tamanho) e um faltando.
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usbi-bc-'));
  const mk = (dir, files) => { const d = path.join(tmp, dir); fs.mkdirSync(d); for (const [n, t] of files) fs.writeFileSync(path.join(d, n), t); return d; };
  const orig = mk('Original', [['a.txt', 'igual'], ['b.txt', 'AAAA'], ['c.txt', 'só na origem']]);
  const copia = mk('Copia', [['a.txt', 'igual'], ['b.txt', 'BBBB'], ['d.txt', 'extra']]);
  await p.getByLabel('Escolher pasta original').setInputFiles(orig);
  await p.getByLabel('Escolher cópia (backup)').setInputFiles(copia);
  await p.getByRole('button', { name: 'Comparar origem e cópia' }).click();
  await p.locator('.bc-result').waitFor();
  const out = (await p.locator('.bc-result').innerText()).replace(/\s+/g, ' ');
  assert(/não é confiável/.test(out) && /IGUAIS 1/i.test(out) && /DIFERENTES 1/i.test(out) && /FALTANDO NA CÓPIA 1/i.test(out) && /SÓ NA CÓPIA 1/i.test(out), `veredito: ${out}`);
  assert(/conteúdo diferente \(SHA-256\)/.test(out), 'detecta conteúdo diferente com mesmo tamanho');
  // Checklist 3-2-1 lembra o progresso.
  await p.locator('.r321-item').first().click();
  await p.reload();
  assert(/1\/5/.test(await p.locator('.r321-score').innerText()), 'checklist salvo');
  // Apresentação: teclado e QR code.
  await p.goto(`${BASE}#/apresentacao`);
  await p.locator('.present').waitFor();
  assert(/Slide 1 de 8/.test(await p.locator('.present-stage').getAttribute('aria-label')), 'começa no slide 1');
  await p.keyboard.press('ArrowRight');
  assert(/gigantes/.test(await p.locator('.present-stage').innerText()), 'seta avança');
  await p.keyboard.press('End');
  assert(await p.locator('.present .qr rect').count() > 100, 'QR code desenhado');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => location.hash === '#/');
  assert(!perr.length, perr.join(' | '));
  await c.close();
});

await test('14a. Manifesto PWA válido e instalável', async () => {
  const r = await page.request.get(`${BASE}manifest.webmanifest`);
  assert(r.ok(), `manifesto HTTP ${r.status()}`);
  const m = await r.json();
  assert(m.name && m.start_url && m.display === 'standalone', 'campos obrigatórios');
  for (const size of ['192x192', '512x512']) assert(m.icons.some((i) => i.sizes === size && i.type === 'image/png'), `ícone ${size}`);
  for (const i of m.icons) assert((await page.request.get(new URL(i.src, BASE).href)).ok(), `ícone ausente: ${i.src}`);
  const sw = await (await page.request.get(`${BASE}sw.js`)).text();
  assert(sw.includes('"manifest.webmanifest"'), 'manifesto fora do cache offline');
});

await test('14. Funciona offline depois da preparação', async () => {
  await go('/ajuda');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 });
  await page.getByText(/de \d+ arquivos da versão/).waitFor({ timeout: 10000 });
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(1500);
  assert(await page.locator('main h1').count(), 'não abriu offline');
  await page.locator('.status-bar', { hasText: 'Sem conexão' }).waitFor();
  await page.goto(`${BASE}#/personagem`);
  await page.waitForTimeout(1800);
  assert(await page.locator('.char-stage canvas').count(), 'personagem offline');
  await page.goto(`${BASE}#/arquivos`);
  await page.locator('.intake input[type=file]').first().setInputFiles(files.slice(0, 2));
  await page.getByRole('button', { name: /Análise completa/ }).click();
  await toast('Análise concluída');
  await context.setOffline(false);
});

await test('17. Pasta conectada: renomear, mover, lixeira, organizar, apagar e desfazer (arquivos reais)', async () => {
  const fx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await fx.addInitScript(UNLOCK);
  // O seletor de pasta nativo não abre em modo automático: entrega uma pasta real do OPFS.
  await fx.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('PENDRIVE', { create: true });
    };
  });
  const p = await fx.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}#/arquivos`);
  await p.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('PENDRIVE', { recursive: true }).catch(() => {});
    const d = await root.getDirectoryHandle('PENDRIVE', { create: true });
    const put = async (dir, name, text) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
    await put(d, 'foto.jpg', 'IMAGEM-123');
    await put(d, 'foto (1).jpg', 'IMAGEM-123');
    await put(d, 'nota.txt', 'texto');
    const sub = await d.getDirectoryHandle('antigos', { create: true });
    await put(sub, 'velho.pdf', 'PDF');
  });
  const tree = () => p.evaluate(async () => {
    const out = [];
    const walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, pre + n + '/'); else out.push(pre + n); } };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('PENDRIVE'), '');
    return out.sort();
  });
  const t = (txt) => p.locator('.toast', { hasText: txt }).first().waitFor({ timeout: 10000 });
  await p.getByRole('button', { name: 'Conectar pasta' }).click();
  await t('conectada');
  assert((await p.locator('.ftable-row').count()) === 4, 'listou 4 arquivos');

  // renomear
  await p.getByRole('button', { name: 'Renomear nota.txt' }).click();
  await p.getByLabel('Novo nome').fill('anotacoes.txt');
  await p.getByRole('button', { name: 'Renomear', exact: true }).click();
  await t('Renomeado');
  assert((await tree()).includes('anotacoes.txt') && !(await tree()).includes('nota.txt'), 'renomeou no disco');
  // nome inválido é recusado antes de tocar no disco
  await p.getByRole('button', { name: 'Renomear anotacoes.txt' }).click();
  await p.getByLabel('Novo nome').fill('a:b.txt');
  assert(await p.getByRole('button', { name: 'Renomear', exact: true }).isDisabled(), 'nome inválido bloqueado');
  await p.getByRole('button', { name: 'Cancelar' }).click();

  // desfazer o renome
  await p.getByRole('button', { name: /Desfazer renomear/ }).click();
  await t('Desfeito');
  assert((await tree()).includes('nota.txt'), 'desfez renome');

  // mover
  await p.getByRole('checkbox', { name: 'Selecionar nota.txt' }).check();
  await p.getByRole('button', { name: 'Mover', exact: true }).click();
  await p.getByLabel(/Pasta de destino/).fill('Documentos/Textos');
  await p.getByRole('button', { name: /Mover para Documentos/ }).click();
  await t('movido');
  assert((await tree()).includes('Documentos/Textos/nota.txt'), 'moveu no disco');

  // duplicados -> lixeira
  await p.getByRole('button', { name: /Só duplicados/ }).click();
  await t('Análise concluída');
  await p.getByRole('tab', { name: /Duplicados/ }).click();
  await p.getByRole('button', { name: /Cópias para a lixeira/ }).click();
  await p.getByRole('button', { name: 'Mandar para a lixeira' }).click();
  await t('lixeira');
  const afterTrash = await tree();
  assert(afterTrash.filter((x) => x.startsWith('foto')).length === 1, 'sobrou 1 foto');
  assert(afterTrash.some((x) => x.startsWith('.usbi-lixeira/') && x.endsWith('.jpg')), 'cópia está na lixeira');
  assert(afterTrash.includes('.usbi-lixeira/manifesto.json'), 'manifesto');

  // restaurar pela aba Lixeira
  await p.getByRole('tab', { name: /Lixeira/ }).click();
  await p.getByRole('checkbox', { name: 'Selecionar tudo' }).check();
  await p.getByRole('button', { name: /Restaurar/ }).click();
  await t('restaurado');
  assert((await tree()).filter((x) => x.startsWith('foto')).length === 2, 'restaurou');

  // organizar de verdade
  await p.getByRole('tab', { name: /Organização/ }).click();
  await p.getByRole('button', { name: 'Aplicar organização' }).click();
  await p.getByRole('button', { name: 'Mover arquivos' }).click();
  await t('Organização aplicada');
  const org = await tree();
  assert(org.includes('Imagens/foto.jpg') && org.includes('Documentos/velho.pdf') && org.includes('Documentos/nota.txt'), `organizado: ${org.join(', ')}`);

  // apagar definitivo exige digitar APAGAR
  await p.getByRole('tab', { name: /Acervo/ }).click();
  await p.getByRole('checkbox', { name: 'Selecionar velho.pdf' }).check();
  await p.getByRole('button', { name: /Apagar de vez/ }).click();
  const confirmBtn = p.locator('.modal').getByRole('button', { name: 'Apagar de vez' });
  assert(await confirmBtn.isDisabled(), 'confirmação exige digitação');
  await p.locator('.modal input').fill('APAGAR');
  await confirmBtn.click();
  await t('apagado');
  assert(!(await tree()).some((x) => x.includes('velho.pdf')), 'apagou do disco');

  // histórico registrou as operações reais
  await p.goto(`${BASE}#/historico`);
  await p.locator('.h-item', { hasText: 'Apagou definitivamente' }).first().waitFor();
  await p.locator('.h-item', { hasText: 'Renomeou' }).first().waitFor();
  assert(!perr.length, perr.join(' | '));
  await fx.close();
});

await test('15. Telas pequenas (360 px): sem rolagem horizontal', async () => {
  const m = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await m.addInitScript(UNLOCK);
  const p = await m.newPage();
  for (const r of ['/', '/arquivos', '/laboratorio', '/personagem', '/seguranca', '/relatorios', '/historico', '/configuracoes', '/ajuda']) {
    await p.goto(`${BASE}#${r}`);
    await p.waitForTimeout(900);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `${r} transborda ${over}px`);
  }
  assert(await p.locator('.tabs-mobile').isVisible(), 'barra inferior');
  await m.close();
});

await test('16. Sem botões falsos (href="#", sem nome) e sem erros no console', async () => {
  for (const r of ['/', '/arquivos', '/personagem', '/seguranca', '/configuracoes']) {
    await go(r);
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a').forEach((a) => { const h = a.getAttribute('href'); if (!h || h === '#') out.push(`link sem destino: ${a.textContent}`); });
      document.querySelectorAll('button').forEach((b) => { if (!(b.textContent || '').trim() && !b.getAttribute('aria-label')) out.push(`botão sem nome: ${b.outerHTML.slice(0, 80)}`); });
      return out;
    });
    assert(!bad.length, `${r}: ${bad.join('; ')}`);
  }
  const real = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  if (real.length && process.env.E2E_SHOTS) (await import('node:fs')).writeFileSync(`${process.env.E2E_SHOTS}/console-errors.txt`, real.join('\n----\n'));
  assert(!real.length, real.map((e) => e.replace(/\s+/g, ' ')).join(' | '));
});

await browser.close();
server.kill();
for (const [s, n] of results) console.log(`${s === 'PASSOU' ? '✔' : s === 'PULOU' ? '–' : '✘'} ${s}  ${n}`);
const failed = results.filter((r) => r[0] === 'FALHOU').length;
const skipped = results.filter((r) => r[0] === 'PULOU').length;
console.log(`\n${results.length - failed - skipped}/${results.length - skipped} grupos de teste passaram${skipped ? ` (${skipped} pulado)` : ''}.`);
process.exit(failed ? 1 : 0);
