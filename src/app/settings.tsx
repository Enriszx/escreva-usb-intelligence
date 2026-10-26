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
