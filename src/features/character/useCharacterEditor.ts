import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneConfig, DEFAULT_CONFIG, PRESETS, randomConfig, sameConfig, type CharacterConfig, type SavedCharacter } from './model';
import { del, get, getAll, put, uid } from '../../lib/storage/db';

const HISTORY_MAX = 60;
const DRAFT_KEY = 'characterDraft';

interface Draft {
  config: CharacterConfig;
  name: string;
  currentId: string | null;
  presetId: string | null;
}

/**
 * Estado do editor: configuração atual, pilha de desfazer, rascunho salvo
 * automaticamente e a coleção de personagens no IndexedDB.
 */
export function useCharacterEditor() {
  const [config, setConfig] = useState<CharacterConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [name, setName] = useState('Meu Vigia');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id);
  const [past, setPast] = useState<CharacterConfig[]>([]);
  const [saved, setSaved] = useState<SavedCharacter[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const refresh = useCallback(async () => {
    const list = await getAll<SavedCharacter>('characters');
    setSaved(list.sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const draft = await get<{ key: string; value: Draft }>('settings', DRAFT_KEY);
        if (draft?.value) {
          setConfig(draft.value.config);
          setName(draft.value.name);
          setCurrentId(draft.value.currentId);
          setPresetId(draft.value.presetId);
        }
        await refresh();
      } catch (e) {
        setStorageError((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  // Rascunho: guarda o estado de edição a cada mudança para sobreviver a um fechamento acidental.
  useEffect(() => {
    if (!ready) return;
    put('settings', { key: DRAFT_KEY, value: { config, name, currentId, presetId } satisfies Draft }).catch(() => {});
  }, [config, name, currentId, presetId, ready]);

  const commit = useCallback((next: CharacterConfig, keepPreset = false) => {
    const prev = configRef.current;
    if (sameConfig(prev, next)) return;
    setPast((p) => [...p.slice(-HISTORY_MAX + 1), prev]);
    setConfig(next);
    if (!keepPreset) setPresetId(null);
  }, []);

  const update = useCallback((fn: (c: CharacterConfig) => void) => {
    const next = cloneConfig(configRef.current);
    fn(next);
    commit(next);
  }, [commit]);

  const pastRef = useRef(past);
  pastRef.current = past;
  const undo = useCallback(() => {
    const p = pastRef.current;
    if (!p.length) return;
    setConfig(p[p.length - 1]);
    setPast(p.slice(0, -1));
    setPresetId(null);
  }, []);

  const applyPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    commit(cloneConfig(p.config), true);
    setPresetId(id);
  }, [commit]);

  const randomize = useCallback(() => commit(randomConfig()), [commit]);
  const resetDefault = useCallback(() => {
    commit(cloneConfig(DEFAULT_CONFIG), true);
    setPresetId(PRESETS[0].id);
  }, [commit]);

  const saveCurrent = useCallback(async (asNew: boolean) => {
    const now = Date.now();
    const existing = saved.find((s) => s.id === currentId);
    const item: SavedCharacter = asNew || !existing
      ? { id: uid('c'), name: name.trim() || 'Sem nome', config: cloneConfig(configRef.current), presetId, createdAt: now, updatedAt: now }
      : { ...existing, name: name.trim() || existing.name, config: cloneConfig(configRef.current), presetId, updatedAt: now };
    await put('characters', item);
    setCurrentId(item.id);
    await refresh();
    return item;
  }, [saved, currentId, name, presetId, refresh]);

  const load = useCallback((item: SavedCharacter) => {
    commit(cloneConfig(item.config), true);
    setPresetId(item.presetId);
    setName(item.name);
    setCurrentId(item.id);
  }, [commit]);

  const rename = useCallback(async (id: string, newName: string) => {
    const item = saved.find((s) => s.id === id);
    if (!item) return;
    await put('characters', { ...item, name: newName.trim(), updatedAt: Date.now() });
    if (id === currentId) setName(newName.trim());
    await refresh();
  }, [saved, currentId, refresh]);

  const remove = useCallback(async (id: string) => {
    await del('characters', id);
    if (id === currentId) setCurrentId(null);
    await refresh();
  }, [currentId, refresh]);

  const importConfig = useCallback((cfg: CharacterConfig, importedName?: string) => {
    commit(cloneConfig(cfg));
    if (importedName) setName(importedName);
    setCurrentId(null);
  }, [commit]);

  const current = saved.find((s) => s.id === currentId);
  const dirty = !current || !sameConfig(current.config, config) || current.name !== name.trim();

  return {
    config, name, setName, currentId, presetId, canUndo: past.length > 0, saved, ready, storageError, dirty,
    update, undo, applyPreset, randomize, resetDefault, saveCurrent, load, rename, remove, importConfig,
  };
}
