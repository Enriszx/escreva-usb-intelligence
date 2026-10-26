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
    results.push(['FALHOU', `${name} — ${e.message.split('\n')[0]}`]);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/falha-${name.slice(0, 2).replace(/\W/g, '')}.png`, fullPage: true }).catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
// Força o caminho de download (o seletor "Salvar como" abriria uma janela nativa).
await context.addInitScript(() => { delete window.showSaveFilePicker; });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} @ ${page.url()} ${m.location().url}:${m.location().lineNumber}`));
page.on('pageerror', (e) => errors.push(`${e.message} @ ${page.url()} :: ${(e.stack || '').split('\n').slice(1, 4).join(' | ')}`));
const go = async (r) => { await page.goto(`${BASE}#${r}`); await page.waitForLoadState('networkidle'); };
const toast = (t) => page.locator('.toast', { hasText: t }).first().waitFor({ timeout: 8000 });

await test('1. Página inicial abre com título e ações', async () => {
  await go('/');
  assert((await page.locator('h1').innerText()).includes('SEUS DADOS'), 'título ausente');
  await page.getByRole('link', { name: /Entrar no sistema/ }).waitFor();
  await page.getByRole('link', { name: /Explorar a experiência/ }).click();
  await page.waitForTimeout(800);
  assert(await page.locator('#experiencia').isVisible(), 'seção de demonstração');
});

await test('2. Navegação: todas as rotas do índice abrem', async () => {
  const titles = ['Início', 'Central de arquivos', 'Laboratório 3D', 'Meu personagem', 'Segurança', 'Relatórios', 'Histórico', 'Configurações', 'Ajuda e diagnóstico'];
  for (const t of titles) {
    await page.getByRole('button', { name: 'Índice' }).click();
    await page.locator('#indice').getByRole('link', { name: new RegExp(t) }).click();
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
  await toast('5 arquivos adicionados');
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
  await page.getByRole('tab', { name: /Painel/ }).click();
  const center = await page.locator('.donut-center').innerText();
  const kb = (totalBytes / 1024).toFixed(1).replace('.', ',');
  assert(center.includes(kb), `centro do gráfico: ${center}`);
  assert(/3 arquivos/i.test(await page.locator('.legend-item', { hasText: 'Documentos' }).innerText()), 'legenda');
  await page.locator('.legend-item', { hasText: 'Imagens' }).click();
  assert((await page.locator('.bar-row').count()) === 1, 'filtro cruzado');
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
for (const [s, n] of results) console.log(`${s === 'PASSOU' ? '✔' : '✘'} ${s}  ${n}`);
const failed = results.filter((r) => r[0] === 'FALHOU').length;
console.log(`\n${results.length - failed}/${results.length} grupos de teste passaram.`);
process.exit(failed ? 1 : 0);
