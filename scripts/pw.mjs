// Carrega o Playwright local (devDependency) ou o instalado globalmente.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return createRequire(import.meta.url)(join(root, 'playwright'));
  }
}
