#!/usr/bin/env node
// Gera release/usb-intelligence/ (pronto para copiar ao pendrive) e um .zip do código-fonte.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'release', 'usb-intelligence');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

console.log('Compilando…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('build não gerou dist/index.html');
rmSync(join(root, 'release'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'dist'), join(out, 'app'), { recursive: true });
cpSync(join(root, 'scripts', 'serve-local.mjs'), join(out, 'servir.mjs'));
writeFileSync(join(out, 'LEIA-ME.txt'), `USB Intelligence ${pkg.version}
================================

Esta pasta contém o aplicativo compilado e um servidor local sem dependências.

COMO ABRIR NUM COMPUTADOR
1. Instale o Node.js 18 ou mais novo (https://nodejs.org) — só na primeira vez.
2. Abra um terminal nesta pasta e rode:   node servir.mjs
3. Abra no navegador:                     http://localhost:4321

Por que não basta dar dois cliques no index.html?
Navegadores bloqueiam módulos JavaScript, service worker e criptografia em
páginas abertas como arquivo (file://). O servidor local resolve isso.

NO ANDROID
Use a versão publicada em HTTPS e instale pelo Chrome (menu ⋮ > Instalar app).
Esta pasta no pendrive serve como cópia de segurança do app e para uso no PC.

SEUS DADOS
Configurações, personagens, histórico e relatórios ficam no navegador de cada
aparelho. Para levar ao pendrive: Configurações > Exportar backup.

Nenhum arquivo é enviado para a internet. O app não abre o pendrive sozinho.
`);
// Pacote do código-fonte (sem node_modules, dist ou caches regeneráveis)
const zip = join(root, 'release', `usb-intelligence-fonte-${pkg.version}.zip`);
try {
  execSync(`git ls-files -co --exclude-standard | zip -q -@ "${zip}"`, { cwd: root, stdio: 'inherit', shell: '/bin/sh' });
  console.log(`Código-fonte: ${zip}`);
} catch {
  console.log('zip/git indisponível: pacote de código-fonte não gerado (a pasta release/usb-intelligence está pronta).');
}
try {
  execSync(`cd release && zip -qr usb-intelligence-pendrive-${pkg.version}.zip usb-intelligence`, { cwd: root, shell: '/bin/sh' });
  console.log(`Pacote para pendrive: release/usb-intelligence-pendrive-${pkg.version}.zip`);
} catch { /* opcional */ }
console.log(`Pasta pronta para copiar ao pendrive: ${out}`);
