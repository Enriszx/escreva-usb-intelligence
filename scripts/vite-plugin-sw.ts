import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

function listPublic(dir: string, root = dir): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(listPublic(full, root));
    else out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

/**
 * Gera o service worker no build com a lista exata de arquivos emitidos.
 * A versão é o hash dessa lista + conteúdo, então cada build novo
 * cria um cache novo e o antigo é removido na ativação.
 */
export function offlineServiceWorker(): Plugin {
  return {
    name: 'usbi-offline-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const publicDir = resolve(__dirname, '../public');
      const files = new Set<string>(['./', 'index.html']);
      for (const f of listPublic(publicDir)) files.add(f);
      for (const f of Object.keys(bundle)) {
        if (f.endsWith('.map') || f === 'sw.js') continue;
        files.add(f);
      }
      const list = [...files].sort();
      const hash = createHash('sha256');
      for (const f of list) {
        const item = bundle[f];
        hash.update(f);
        if (item && item.type === 'chunk') hash.update(item.code);
        else if (item && item.type === 'asset') hash.update(item.source);
      }
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(resolve(__dirname, 'sw.template.js'), 'utf8');
      const source = template
        .replace('__USBI_VERSION__', JSON.stringify(version))
        .replace('__USBI_PRECACHE__', JSON.stringify(list, null, 1));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({
        type: 'asset',
        fileName: 'offline-manifest.json',
        source: JSON.stringify({ version, files: list }, null, 1),
      });
    },
  };
}
