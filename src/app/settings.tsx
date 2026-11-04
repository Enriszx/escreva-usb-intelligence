import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../lib/storage/repos';

interface SettingsCtx {
  settings: Settings;
  loaded: boolean;
  storageError: string | null;
  update: (patch: Partial<Settings>) => Promise<void>;
  /** Movimento reduzido efetivo: preferência do app ou do sistema. */
  reducedMotion: boolean;
  /** Qualidade 3D efetiva depois de resolver "auto". */
  quality: 'economia' | 'alta';
}

const Ctx = createContext<SettingsCtx | null>(null);

function systemReduced(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function detectQuality(): 'economia' | 'alta' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (mem <= 4 || cores <= 4 || (touch && cores <= 6)) return 'economia';
  return 'alta';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [sysReduced, setSysReduced] = useState(systemReduced);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e: Error) => setStorageError(e.message))
      .finally(() => setLoaded(true));
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSysReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const reducedMotion = settings.motion === 'reduzido' || (settings.motion === 'sistema' && sysReduced);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion === 'sistema' ? (sysReduced ? 'reduzido' : 'sistema') : settings.motion;
  }, [settings.motion, sysReduced]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'claro') root.dataset.theme = 'light';
    else if (settings.theme === 'escuro') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
  }, [settings.theme]);

  // Aparência personalizada (pelo usuário ou pelo assistente): um <style> que vence os temas.
  useEffect(() => {
    document.getElementById('usbi-aparencia')?.remove();
    document.documentElement.style.fontSize = settings.uiFont && settings.uiFont !== 1 ? `${Math.round(settings.uiFont * 100)}%` : '';
    const css = customCss(settings);
    if (!css) return;
    const el = document.createElement('style');
    el.id = 'usbi-aparencia';
    el.textContent = css;
    document.head.appendChild(el);
  }, [settings.uiAccent, settings.uiRadius, settings.uiFont, settings.uiBackdrop]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    let next: Settings = DEFAULT_SETTINGS;
    setSettings((s) => (next = { ...s, ...patch }));
    try {
      await saveSettings(next);
      setStorageError(null);
    } catch (e) {
      setStorageError((e as Error).message);
      throw e;
    }
  }, []);

  const quality = settings.quality === 'auto' ? detectQuality() : settings.quality;

  const value = useMemo(
    () => ({ settings, loaded, storageError, update, reducedMotion, quality }),
    [settings, loaded, storageError, update, reducedMotion, quality],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings fora do SettingsProvider');
  return c;
}

/** Texto escuro ou claro sobre a cor de destaque, pelo contraste (WCAG). */
export function accentText(hex: string): string {
  const v = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * v(1) + 0.7152 * v(3) + 0.0722 * v(5);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#0b1a00' : '#ffffff';
}

export function customCss(s: Pick<Settings, 'uiAccent' | 'uiRadius' | 'uiBackdrop'>): string {
  const out: string[] = [];
  if (/^#[0-9a-f]{6}$/i.test(s.uiAccent)) {
    const fg = accentText(s.uiAccent);
    out.push(`[data-tone], html[data-theme] [data-tone] { --accent: ${s.uiAccent} !important; --accent-fg: ${fg} !important; --glow-y: ${s.uiAccent}55 !important; }`);
  }
  if (s.uiRadius === 'reto') out.push(':root { --r-1: 2px; --r-2: 4px; --r-3: 6px; --r-4: 8px; }');
  if (s.uiRadius === 'redondo') out.push(':root { --r-1: 12px; --r-2: 18px; --r-3: 26px; --r-4: 34px; }');
  if (s.uiBackdrop === 'suave') out.push('.bb-front, .bb-mid { opacity: 0.35 !important; }');
  if (s.uiBackdrop === 'desligado') out.push('.bb-layer { display: none !important; }');
  return out.join('\n');
}
