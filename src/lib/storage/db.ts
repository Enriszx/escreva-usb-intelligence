/** Wrapper mínimo de IndexedDB. Sem dependência: só o que o app usa. */
export const DB_NAME = 'usb-intelligence';
export const DB_VERSION = 1;
export const STORES = ['settings', 'characters', 'history', 'reports', 'integrity'] as const;
export type StoreName = (typeof STORES)[number];

export class StorageUnavailableError extends Error {
  constructor(message = 'O armazenamento local (IndexedDB) não está disponível neste navegador ou modo.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailableError());
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (db.objectStoreNames.contains(s)) continue;
        const store = db.createObjectStore(s, { keyPath: s === 'settings' ? 'key' : 'id' });
        if (s === 'history' || s === 'reports') store.createIndex('at', 'at');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new StorageUnavailableError());
    req.onblocked = () => reject(new StorageUnavailableError('Feche outras abas do USB Intelligence e tente de novo.'));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(translate(req.error));
  });
}

function translate(err: DOMException | null): Error {
  if (err?.name === 'QuotaExceededError') {
    return new Error('Sem espaço para salvar neste dispositivo. Exporte e apague dados antigos em Configurações.');
  }
  return err ?? new Error('Falha no armazenamento local.');
}

async function tx(store: StoreName, mode: IDBTransactionMode) {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return wrap((await tx(store, 'readonly')).getAll()) as Promise<T[]>;
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  return wrap((await tx(store, 'readonly')).get(key)) as Promise<T | undefined>;
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  await wrap((await tx(store, 'readwrite')).put(value));
}

export async function del(store: StoreName, key: string): Promise<void> {
  await wrap((await tx(store, 'readwrite')).delete(key));
}

export async function clear(store: StoreName): Promise<void> {
  await wrap((await tx(store, 'readwrite')).clear());
}

export async function clearAll(): Promise<void> {
  for (const s of STORES) await clear(s);
}

export async function dumpAll(): Promise<Record<StoreName, unknown[]>> {
  const out = {} as Record<StoreName, unknown[]>;
  for (const s of STORES) out[s] = await getAll(s);
  return out;
}

export function uid(prefix = ''): string {
  const r = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${r}` : r;
}
