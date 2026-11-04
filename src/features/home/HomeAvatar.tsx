import { Link } from 'react-router-dom';
import type { CharacterConfig } from '../character/model';
import { useHomeAvatar } from './useHomeAvatar';

/**
 * Miniatura do personagem salvo, no canto superior esquerdo do hero.
 * Clicável: leva para o editor de personagem.
 */
export function HomeAvatar() {
  const { config, name } = useHomeAvatar();
  if (!config) return null;
  return (
    <Link to="/personagem" className="home-avatar" title={name ? `${name} — toque para editar` : 'Seu personagem'} aria-label={name ? `Personagem ${name} — toque para editar` : 'Editar personagem'}>
      <MiniVigia config={config} />
    </Link>
  );
}

/** SVG compacto do personagem, inspirado na VigiaIllustration mas menor e mais redondo. */
function MiniVigia({ config }: { config: CharacterConfig }) {
  const c = config.colors;
  const glow = config.glow.enabled ? c.glow : '#1a1f1c';
  return (
    <svg viewBox="0 0 200 300" width="100%" aria-hidden>
      {/* Mochila (atrás do corpo) */}
      {config.accessories.mochila && <rect x="62" y="96" width="76" height="90" rx="8" fill={c.secondary} opacity={0.6} />}
      {/* Pernas */}
      <rect x="70" y="190" width="24" height="80" rx="12" fill={c.primary} />
      <rect x="106" y="190" width="24" height="80" rx="12" fill={c.primary} />
      {/* Sapatos */}
      <rect x="64" y="258" width="34" height="18" rx="9" fill={c.secondary} />
      <rect x="102" y="258" width="34" height="18" rx="9" fill={c.secondary} />
      {/* Cinto / cintura */}
      <rect x="64" y="176" width="72" height="22" rx="4" fill={c.secondary} />
      {/* Tronco */}
      <rect x="58" y="100" width="84" height="84" rx="16" fill={c.primary} />
      {/* Braços */}
      <rect
        x="38" y="104" width="20" height="76" rx="10" fill={c.primary}
        transform={config.pose === 'aceno' ? 'rotate(-60 48 104)' : config.pose === 'vitoria' ? 'rotate(-45 48 104)' : undefined}
      />
      <rect
        x="142" y="104" width="20" height="76" rx="10" fill={c.primary}
        transform={config.pose === 'vitoria' ? 'rotate(45 152 104)' : undefined}
      />
      {/* Detalhe no peito */}
      <rect x="58" y="170" width="84" height="8" rx="2" fill={c.detail} />
      {/* Cabeça */}
      <circle cx="100" cy="64" r="38" fill={c.skin} />
      {/* Cabelo */}
      {config.hair !== 'careca' && (
        <path d="M60 58 A40 40 0 0 1 140 58 Q140 42 100 36 Q60 42 60 58Z" fill={c.hair} />
      )}
      {(config.hair === 'longo' || config.hair === 'trancas' || config.hair === 'rabo') && (
        <rect x="60" y="56" width="14" height="54" rx="7" fill={c.hair} />
      )}
      {(config.hair === 'longo' || config.hair === 'trancas') && (
        <rect x="126" y="56" width="14" height="54" rx="7" fill={c.hair} />
      )}
      {config.hair === 'blackpower' && (
        <ellipse cx="100" cy="46" rx="48" ry="32" fill={c.hair} />
      )}
      {config.hair === 'cacheado' && (
        <path d="M58 60 Q58 28 100 26 Q142 28 142 60 Q140 44 100 40 Q60 44 58 60Z" fill={c.hair} />
      )}
      {/* Cobertura */}
      {config.head === 'capacete' && <path d="M58 56 A42 42 0 0 1 142 56 L138 60 Q100 48 62 60 Z" fill={c.primary} />}
      {config.head === 'bone' && <><path d="M56 56 A44 44 0 0 1 144 56 L140 60 Q100 50 60 60 Z" fill={c.primary} /><rect x="50" y="52" width="40" height="8" rx="3" fill={c.detail} /></>}
      {config.head === 'capuz' && <path d="M54 66 A46 46 0 0 1 146 66 L142 74 Q100 56 58 74 Z" fill={c.secondary} />}
      {config.head === 'tiara' && <rect x="62" y="42" width="76" height="6" rx="3" fill={c.detail} />}
      {/* Olhos */}
      {config.eyes === 'visor' ? (
        <rect x="70" y="60" width="60" height="12" rx="6" fill={glow} />
      ) : config.eyes === 'anel' ? (
        <><circle cx="86" cy="66" r="8" fill="none" stroke={glow} strokeWidth="3" /><circle cx="114" cy="66" r="8" fill="none" stroke={glow} strokeWidth="3" /></>
      ) : (
        <><circle cx="86" cy="66" r="6" fill={glow} /><circle cx="114" cy="66" r="6" fill={glow} /></>
      )}
      {/* Boca */}
      {config.mouth === 'sorriso' && <path d="M88 80 Q100 90 112 80" fill="none" stroke={c.detail} strokeWidth="2.5" strokeLinecap="round" />}
      {config.mouth === 'aberto' && <ellipse cx="100" cy="82" rx="8" ry="5" fill={c.detail} />}
      {config.mouth === 'serio' && <line x1="88" y1="82" x2="112" y2="82" stroke={c.detail} strokeWidth="2.5" strokeLinecap="round" />}
      {config.mouth === 'neutro' && <path d="M90 82 Q100 84 110 82" fill="none" stroke={c.detail} strokeWidth="2" strokeLinecap="round" />}
      {/* Cachecol */}
      {config.accessories.cachecol && <rect x="72" y="94" width="56" height="12" rx="4" fill={c.detail} />}
      {/* Óculos */}
      {config.accessories.oculos && (
        <><rect x="74" y="58" width="22" height="16" rx="4" fill="none" stroke={c.detail} strokeWidth="2" /><rect x="104" y="58" width="22" height="16" rx="4" fill="none" stroke={c.detail} strokeWidth="2" /><line x1="96" y1="66" x2="104" y2="66" stroke={c.detail} strokeWidth="2" /></>
      )}
      {/* Fones */}
      {config.accessories.fones && (
        <><rect x="52" y="52" width="12" height="20" rx="6" fill={c.secondary} /><rect x="136" y="52" width="12" height="20" rx="6" fill={c.secondary} /><path d="M58 52 Q100 30 142 52" fill="none" stroke={c.secondary} strokeWidth="3" /></>
      )}
      {/* Colar */}
      {config.accessories.colar && <path d="M76 98 Q100 112 124 98" fill="none" stroke={c.detail} strokeWidth="3" strokeLinecap="round" />}
      {/* Brincos */}
      {config.accessories.brincos && <><circle cx="60" cy="72" r="4" fill={c.detail} /><circle cx="140" cy="72" r="4" fill={c.detail} /></>}
      {/* Capa */}
      {config.accessories.capa && <path d="M62 100 Q60 220 70 260 L100 250 L130 260 Q140 220 138 100 Z" fill={c.secondary} opacity={0.35} />}
      {/* Brilho */}
      {config.glow.enabled && <circle cx="100" cy="140" r="6" fill={c.glow} opacity={0.5} />}
    </svg>
  );
}
