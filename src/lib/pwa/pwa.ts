/**
 * Registro do service worker e estado offline. Só registra em build de
 * produção servido por HTTPS ou localhost — exigência dos navegadores.
 */
type Listener = () => void;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAState {
  supported: boolean;
  secure: boolean;
  registered: boolean;
  controlled: boolean;
  updateWaiting: boolean;
  installable: boolean;
  installed: boolean;
  error: string | null;
}

const state: PWAState = {
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  secure: typeof window !== 'undefined' && window.isSecureContext,
  registered: false,
  controlled: typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
  updateWaiting: false,
  installable: false,
  installed: typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
  error: null,
};

let registration: ServiceWorkerRegistration | null = null;
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function getPWAState(): PWAState {
  return state;
}

export function subscribePWA(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function set(patch: Partial<PWAState>) {
  Object.assign(state, patch);
  // nova referência para useSyncExternalStore perceber a mudança
  snapshot = { ...state };
  emit();
}
let snapshot: PWAState = { ...state };
export const getPWASnapshot = () => snapshot;

export function registerPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    set({ installable: true });
  });
  window.addEventListener('appinstalled', () => set({ installed: true, installable: false }));

  if (!state.supported || !state.secure || import.meta.env.DEV) return;
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      registration = reg;
      set({ registered: true });
      if (reg.waiting && navigator.serviceWorker.controller) set({ updateWaiting: true });
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) set({ updateWaiting: true });
        });
      });
    })
    .catch((e: Error) => set({ error: e.message }));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    set({ controlled: true });
    if (state.updateWaiting && !reloading) {
      reloading = true;
      location.reload();
    }
  });
}

export function applyUpdate() {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'indisponivel'> {
  if (!installEvent) return 'indisponivel';
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  set({ installable: false });
  return outcome;
}

export interface CacheStatus {
  version: string;
  total: number;
  cached: number;
  missing: string[];
}

/** Pergunta ao service worker quais arquivos essenciais já estão no cache. */
export function cacheStatus(timeout = 3000): Promise<CacheStatus | null> {
  const ctrl = navigator.serviceWorker?.controller;
  if (!ctrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', on);
      resolve(null);
    }, timeout);
    const on = (ev: MessageEvent) => {
      if (ev.data?.type !== 'STATUS') return;
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener('message', on);
      resolve(ev.data as CacheStatus);
    };
    navigator.serviceWorker.addEventListener('message', on);
    ctrl.postMessage({ type: 'GET_STATUS' });
  });
}
