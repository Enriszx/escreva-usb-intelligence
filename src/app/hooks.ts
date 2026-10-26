import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPWASnapshot, subscribePWA } from '../lib/pwa/pwa';

export function usePWA() {
  return useSyncExternalStore(subscribePWA, getPWASnapshot, getPWASnapshot);
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — USB Intelligence` : 'USB Intelligence';
  }, [title]);
}
