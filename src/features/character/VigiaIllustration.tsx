import type { CharacterConfig } from './model';

/**
 * Silhueta vetorial do Vigia para aparelhos sem WebGL. Usa as cores e partes
 * escolhidas — é uma representação plana do mesmo personagem, não uma captura.
 */
export function VigiaIllustration({ config }: { config: CharacterConfig }) {
  const c = config.colors;
  const glow = config.glow.enabled ? c.glow : '#1a1f1c';
  return (
    <figure className="fallback-figure">
      <svg viewBox="0 0 200 300" width="240" role="img" aria-label="Ilustração plana do personagem com as cores escolhidas">
        {config.accessories.mochila && <rect x="62" y="96" width="76" height="90" fill={c.secondary} />}
        <rect x="70" y="190" width="24" height="80" fill={c.primary} />
        <rect x="106" y="190" width="24" height="80" fill={c.primary} />
        <rect x="66" y="262" width="32" height="16" fill={c.secondary} />
        <rect x="102" y="262" width="32" height="16" fill={c.secondary} />
        <rect x="64" y="176" width="72" height="22" fill={c.secondary} />
        <rect x="58" y="100" width="84" height="84" rx="16" fill={c.primary} />
        <rect x="40" y="104" width="18" height="76" rx="9" fill={c.primary} transform={config.pose === 'aceno' ? 'rotate(150 49 104)' : undefined} />
        <rect x="142" y="104" width="18" height="76" rx="9" fill={c.primary} />
        <rect x="58" y="172" width="84" height="7" fill={c.detail} />
        <circle cx="100" cy="64" r="36" fill={c.skin} />
        {config.head !== 'nenhum' && <path d="M62 60 A38 38 0 0 1 138 60 Z" fill={config.head === 'crista' ? c.detail : c.primary} />}
        {config.eyes === 'visor' ? <rect x="72" y="62" width="56" height="10" fill={glow} /> : <><circle cx="88" cy="68" r="5" fill={glow} /><circle cx="112" cy="68" r="5" fill={glow} /></>}
        {config.accessories.cachecol && <rect x="76" y="96" width="48" height="10" fill={c.detail} />}
      </svg>
      <figcaption className="mono muted">Sem WebGL neste navegador: prévia plana. As opções continuam sendo salvas normalmente.</figcaption>
    </figure>
  );
}
