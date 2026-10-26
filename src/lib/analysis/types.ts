export type Category = 'documentos' | 'imagens' | 'videos' | 'audios' | 'compactados' | 'outros';

export const CATEGORIES: Category[] = ['documentos', 'imagens', 'videos', 'audios', 'compactados', 'outros'];

export const CATEGORY_LABEL: Record<Category, string> = {
  documentos: 'Documentos',
  imagens: 'Imagens',
  videos: 'Vídeos',
  audios: 'Áudios',
  compactados: 'Compactados',
  outros: 'Outros',
};

/** Metadados de um arquivo selecionado. O conteúdo fica no File, nunca é persistido. */
export interface FileEntry {
  id: string;
  name: string;
  /** Caminho relativo quando o navegador fornece (seleção de pasta). */
  path: string;
  ext: string;
  mime: string;
  size: number;
  lastModified: number;
  category: Category;
  /** Preenchido após o cálculo; undefined = ainda não calculado. */
  sha256?: string;
  hashError?: string;
  /** 'pasta' = veio de uma pasta conectada (pode ser renomeado/movido/apagado). */
  source?: 'selecao' | 'pasta';
}

export interface CategoryStat {
  category: Category;
  count: number;
  bytes: number;
}

export interface ExtensionStat {
  ext: string;
  count: number;
  bytes: number;
  category: Category;
}

export interface Summary {
  count: number;
  bytes: number;
  byCategory: CategoryStat[];
  byExtension: ExtensionStat[];
  largest: FileEntry | null;
  hashed: number;
  hashErrors: number;
}

export interface DuplicateGroup {
  sha256: string;
  size: number;
  files: FileEntry[];
  /** Bytes liberados se todas as cópias, menos uma, deixassem de existir. */
  recoverable: number;
}

export interface DuplicateResult {
  groups: DuplicateGroup[];
  recoverable: number;
  /** Arquivos que dividem o tamanho com outro e por isso precisaram de hash. */
  candidates: number;
  /** Arquivos descartados na etapa de tamanho (tamanho único → não podem ser cópias). */
  uniqueBySize: number;
  /** Candidatos sem hash (erro de leitura ou análise cancelada). */
  unresolved: FileEntry[];
}

export interface NameGroup {
  key: string;
  kind: 'identico' | 'semelhante';
  files: FileEntry[];
  /** Quantos destes também têm o mesmo conteúdo (por hash), se já calculado. */
  sameContent: boolean | null;
}
