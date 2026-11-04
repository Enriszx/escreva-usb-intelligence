import { useEffect, useState } from 'react';
import { get, getAll } from '../../lib/storage/db';
import { DEFAULT_CONFIG, type CharacterConfig, type SavedCharacter } from '../character/model';
import { DRAFT_KEY, type Draft } from '../character/useCharacterEditor';

/**
 * Lê o personagem do usuário do IndexedDB (rascunho ou salvo mais recente).
 * Se não houver nenhum, devolve null — a home não mostra o avatar.
 */
export function useHomeAvatar() {
  const [config, setConfig] = useState<CharacterConfig | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Primeiro tenta o rascunho (é o que está ativo no editor).
        const draft = await get<{ key: string; value: Draft }>('settings', DRAFT_KEY);
        if (draft?.value?.config) {
          setConfig(draft.value.config);
          setName(draft.value.name || '');
          return;
        }
        // Se não houver rascunho, pega o personagem salvo mais recente.
        const saved = await getAll<SavedCharacter>('characters');
        if (saved.length) {
          const latest = saved.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setConfig(latest.config);
          setName(latest.name);
          return;
        }
        // Nenhum personagem? Usa o padrão.
        setConfig(DEFAULT_CONFIG);
        setName('Vigia');
      } catch {
        setConfig(DEFAULT_CONFIG);
        setName('Vigia');
      }
    })();
  }, []);

  return { config, name };
}
