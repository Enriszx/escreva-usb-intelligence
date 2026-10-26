import { BarChart3, Box, FolderSearch, HelpCircle, History, Home, Settings, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';

export type Tone = 'grafite' | 'mata' | 'noite' | 'gelo';

export interface RouteMeta {
  path: string;
  n: string;
  title: string;
  short: string;
  blurb: string;
  tone: Tone;
  icon: LucideIcon;
}

export const ROUTES: RouteMeta[] = [
  { path: '/', n: '01', title: 'Início', short: 'Início', blurb: 'A porta de entrada e a demonstração.', tone: 'grafite', icon: Home },
  { path: '/arquivos', n: '02', title: 'Central de arquivos', short: 'Arquivos', blurb: 'Selecione, analise, ache duplicados e planeje pastas.', tone: 'grafite', icon: FolderSearch },
  { path: '/laboratorio', n: '03', title: 'Laboratório 3D', short: 'Laboratório', blurb: 'Abra o Núcleo USBI camada por camada.', tone: 'noite', icon: Box },
  { path: '/personagem', n: '04', title: 'Meu personagem', short: 'Personagem', blurb: 'Monte o seu Vigia e salve versões.', tone: 'mata', icon: UserRound },
  { path: '/seguranca', n: '05', title: 'Segurança', short: 'Segurança', blurb: 'SHA-256, verificação e cofre AES-GCM.', tone: 'noite', icon: ShieldCheck },
  { path: '/relatorios', n: '06', title: 'Relatórios', short: 'Relatórios', blurb: 'Painel das análises e exportação.', tone: 'gelo', icon: BarChart3 },
  { path: '/historico', n: '07', title: 'Histórico', short: 'Histórico', blurb: 'Tudo o que foi feito, com data e hora.', tone: 'gelo', icon: History },
  { path: '/configuracoes', n: '08', title: 'Configurações', short: 'Ajustes', blurb: 'Movimento, qualidade 3D e dados locais.', tone: 'grafite', icon: Settings },
  { path: '/ajuda', n: '09', title: 'Ajuda e diagnóstico', short: 'Ajuda', blurb: 'Offline, pendrive, Android e limites.', tone: 'grafite', icon: HelpCircle },
];

export function routeFor(pathname: string): RouteMeta | undefined {
  return ROUTES.find((r) => r.path === pathname);
}
