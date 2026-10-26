import type { Category } from './types';

const MAP: Record<string, Category> = {};
const add = (cat: Category, exts: string) => exts.split(' ').forEach((e) => (MAP[e] = cat));

add('documentos', 'pdf doc docx odt rtf txt md csv tsv xls xlsx ods ppt pptx odp epub json xml html htm tex pages numbers key log');
add('imagens', 'jpg jpeg png gif webp avif heic heif bmp tif tiff svg ico raw cr2 nef arw dng psd');
add('videos', 'mp4 mkv mov avi webm m4v 3gp wmv flv mpg mpeg ts');
add('audios', 'mp3 wav flac aac ogg oga opus m4a wma aiff aif mid midi amr');
add('compactados', 'zip rar 7z tar gz tgz bz2 xz zst iso dmg apk');

export function extensionOf(name: string): string {
  const base = name.split('/').pop() ?? name;
  const i = base.lastIndexOf('.');
  if (i <= 0 || i === base.length - 1) return '';
  return base.slice(i + 1).toLowerCase();
}

/** Classifica pela extensão; o MIME do navegador só entra como desempate. */
export function categorize(name: string, mime = ''): Category {
  const ext = extensionOf(name);
  if (ext && MAP[ext]) return MAP[ext];
  if (mime.startsWith('image/')) return 'imagens';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  if (mime.startsWith('text/') || mime === 'application/pdf') return 'documentos';
  return 'outros';
}
