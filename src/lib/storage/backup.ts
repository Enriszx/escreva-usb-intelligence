import { STORES, dumpAll, put, type StoreName } from './db';
import { validateCharacter } from '../../features/character/model';

export const BACKUP_KIND = 'backup';

export async function makeBackup() {
  return { app: 'usb-intelligence', tipo: BACKUP_KIND, versao: 1, criadoEm: new Date().toISOString(), dados: await dumpAll() };
}

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  counts: Partial<Record<StoreName, number>>;
  data?: Partial<Record<StoreName, Record<string, unknown>[]>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valida um backup antes de gravar qualquer coisa. Registro inválido = backup recusado inteiro. */
export function checkBackup(input: unknown): BackupCheck {
  const errors: string[] = [];
  if (!isObj(input) || input.app !== 'usb-intelligence' || input.tipo !== BACKUP_KIND) {
    return { ok: false, errors: ['Este arquivo não é um backup do USB Intelligence.'], counts: {} };
  }
  if (input.versao !== 1) errors.push('Versão de backup não suportada.');
  const dados = input.dados;
  if (!isObj(dados)) return { ok: false, errors: [...errors, 'Campo "dados" ausente.'], counts: {} };
  const data: Partial<Record<StoreName, Record<string, unknown>[]>> = {};
  const counts: Partial<Record<StoreName, number>> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (!(STORES as readonly string[]).includes(k)) {
      errors.push(`Coleção desconhecida: "${k}".`);
      continue;
    }
    const store = k as StoreName;
    if (!Array.isArray(v)) {
      errors.push(`"${k}" precisa ser uma lista.`);
      continue;
    }
    const keyField = store === 'settings' ? 'key' : 'id';
    v.forEach((rec, i) => {
      if (!isObj(rec) || typeof rec[keyField] !== 'string' || !(rec[keyField] as string).length) errors.push(`${k}[${i}]: falta "${keyField}".`);
      else if (store === 'characters' && (typeof rec.name !== 'string' || !validateCharacter(rec.config).ok)) errors.push(`${k}[${i}]: personagem inválido.`);
      else if ((store === 'history' || store === 'reports' || store === 'integrity') && typeof rec.at !== 'number') errors.push(`${k}[${i}]: data ausente.`);
    });
    data[store] = v as Record<string, unknown>[];
    counts[store] = v.length;
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 20), counts, data: errors.length ? undefined : data };
}

/** Grava os registros do backup. Itens com o mesmo id são substituídos; os demais são mantidos. */
export async function restoreBackup(data: Partial<Record<StoreName, Record<string, unknown>[]>>) {
  let n = 0;
  for (const [store, list] of Object.entries(data) as [StoreName, Record<string, unknown>[]][]) {
    for (const rec of list) {
      await put(store, rec);
      n++;
    }
  }
  return n;
}
