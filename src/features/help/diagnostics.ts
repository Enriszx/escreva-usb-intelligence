import { hasWebGL } from '../../components/three/webgl';
import { openDB } from '../../lib/storage/db';

export type Status = 'ok' | 'aviso' | 'falha';
export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

/** Cada verificação testa a capacidade de verdade, em vez de só procurar o nome da API. */
export async function runDiagnostics(): Promise<Check[]> {
  const w = window as unknown as Record<string, unknown>;
  const checks: Check[] = [];
  const add = (id: string, label: string, status: Status, detail: string) => checks.push({ id, label, status, detail });

  add('online', 'Conexão', navigator.onLine ? 'ok' : 'aviso', navigator.onLine ? 'Conectado. O app não precisa da internet para as funções locais.' : 'Sem conexão agora. Funções locais seguem disponíveis se o app já foi preparado offline.');
  if (location.protocol === 'file:') add('proto', 'Forma de abertura', 'falha', 'Aberto direto do arquivo (file://). Navegadores bloqueiam módulos e service worker assim. Use o servidor local (veja abaixo).');
  add('secure', 'Contexto seguro', window.isSecureContext ? 'ok' : 'falha', window.isSecureContext ? `${location.protocol}//${location.host}` : 'Sem HTTPS: criptografia, instalação e modo offline ficam indisponíveis.');

  let gpu = '';
  if (hasWebGL()) {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* informação opcional */ }
    add('webgl', 'WebGL (3D)', 'ok', gpu ? `Disponível · ${gpu}` : 'Disponível.');
  } else add('webgl', 'WebGL (3D)', 'aviso', 'Indisponível: as cenas 3D viram ilustrações. Todo o resto funciona.');

  try {
    await openDB();
    add('idb', 'Armazenamento local (IndexedDB)', 'ok', 'Funcionando.');
  } catch (e) {
    add('idb', 'Armazenamento local (IndexedDB)', 'falha', `${(e as Error).message} Em janela anônima alguns navegadores bloqueiam.`);
  }

  add('crypto', 'Web Crypto (SHA-256, AES-GCM)', globalThis.crypto?.subtle ? 'ok' : 'falha', globalThis.crypto?.subtle ? 'Disponível.' : 'Indisponível neste contexto: hashes usam a implementação própria; o cofre fica desativado.');
  add('worker', 'Web Workers', typeof Worker !== 'undefined' ? 'ok' : 'aviso', typeof Worker !== 'undefined' ? 'Hashes são calculados fora da interface.' : 'Indisponível: hashes rodam na thread principal (mais lento).');

  const pick = typeof w.showOpenFilePicker === 'function';
  const dir = typeof w.showDirectoryPicker === 'function';
  const save = typeof w.showSaveFilePicker === 'function';
  add('fsa', 'Acesso a pastas (File System Access)', dir ? 'ok' : 'aviso',
    dir ? 'Disponível: dá para criar a cópia organizada numa pasta escolhida.' : 'Indisponível (comum no Android e no Safari): use o seletor de arquivos e exporte planos.');
  add('save', 'Salvar como…', save ? 'ok' : 'aviso', save ? 'Você escolhe onde salvar relatórios (inclusive no pendrive).' : 'Exportações vão para a pasta de downloads; depois mova para o pendrive.');
  add('folder', 'Seleção de pasta inteira', 'webkitdirectory' in document.createElement('input') ? 'ok' : 'aviso', pick || dir ? 'Suportada por este navegador.' : 'Pode não estar disponível; selecione vários arquivos.');

  const sw = 'serviceWorker' in navigator;
  const ctrl = sw && !!navigator.serviceWorker.controller;
  add('sw', 'Modo offline (service worker)', ctrl ? 'ok' : 'aviso', !sw ? 'Navegador sem suporte a service worker.' : ctrl ? 'Ativo: esta página é servida pelo cache local.' : import.meta.env.DEV ? 'Desligado no modo de desenvolvimento.' : 'Ainda não ativo. Recarregue a página uma vez com internet.');

  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  add('install', 'Instalado como app', standalone ? 'ok' : 'aviso', standalone ? 'Aberto pelo ícone da tela inicial.' : 'Aberto no navegador. Veja como instalar abaixo.');

  try {
    const persisted = await navigator.storage?.persisted?.();
    add('persist', 'Armazenamento persistente', persisted ? 'ok' : 'aviso', persisted ? 'O navegador não apagará os dados para liberar espaço.' : 'Não garantido: o navegador pode limpar dados se faltar espaço. Peça persistência em Configurações.');
  } catch {
    add('persist', 'Armazenamento persistente', 'aviso', 'Não informado pelo navegador.');
  }
  return checks;
}
