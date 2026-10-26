import type { Category } from '../../lib/analysis/types';

/**
 * Cores categóricas validadas (separação para daltonismo ≥ 8 ΔE entre vizinhas,
 * contraste ≥ 3:1 no grafite). No tom gelo, os passos claros são trocados via CSS.
 * Ordem fixa por categoria: a cor segue a categoria, nunca a posição no ranking.
 */
export const CAT_VAR: Record<Category, string> = {
  documentos: 'var(--cat-1)',
  imagens: 'var(--cat-2)',
  videos: 'var(--cat-3)',
  audios: 'var(--cat-4)',
  compactados: 'var(--cat-5)',
  outros: 'var(--cat-0)',
};
