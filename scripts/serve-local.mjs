#!/usr/bin/env node
/**
 * Servidor estático mínimo, sem dependências, para rodar o USB Intelligence
 * a partir de uma pasta (inclusive do pendrive). Usa localhost, que os
 * navegadores tratam como contexto seguro: criptografia e offline funcionam.
 *
 *   node servir.mjs [porta] [pasta]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4321);
const candidates = [process.argv[3], join(here, 'app'), join(here, '..', 'dist'), join(here, 'dist')].filter(Boolean);
const root = resolve(candidates.find((p) => existsSync(join(p, 'index.html'))) ?? '');
if (!existsSync(join(root, 'index.html'))) {
  console.error('Não encontrei o app compilado (index.html). Rode "npm run build" ou indique a pasta: node servir.mjs 4321 caminho/da/pasta');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(root, path);
  // Bloqueia qualquer tentativa de sair da pasta do app.
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('Proibido');
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  const immutable = /[\\/]assets[\\/]/.test(file);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`USB Intelligence rodando em http://localhost:${port}`);
  console.log(`Servindo: ${root}`);
  console.log('Ctrl+C para encerrar. Apenas este computador tem acesso (127.0.0.1).');
});
