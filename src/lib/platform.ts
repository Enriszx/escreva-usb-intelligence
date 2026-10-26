/**
 * Build publicado como Artifact do Claude: roda num quadro protegido que não
 * permite service worker, downloads, impressão nem acesso a pastas.
 * Nesse build, esses recursos ficam ocultos ou ganham alternativa honesta.
 */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';
