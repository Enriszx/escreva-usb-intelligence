import { BarChart3, BookOpenCheck, Box, FolderSearch, HelpCircle, History, Home, Presentation, Settings, ShieldCheck, UserRound, Zap, type LucideIcon } from 'lucide-react';

export type Tone = 'grafite' | 'mata' | 'noite' | 'gelo';
export type Group = 'Operação' | 'Proteção e controle' | 'Experiência' | 'Sistema';

export interface RouteMeta {
  path: string;
  n: string;
  title: string;
  short: string;
  blurb: string;
  tone: Tone;
  icon: LucideIcon;
  group: Group;
}

export const ROUTES: RouteMeta[] = [
  { path: '/', n: '01', title: 'Início', short: 'Início', blurb: 'Visão geral da plataforma e como ela funciona.', tone: 'grafite', icon: Home, group: 'Sistema' },
  { path: '/automatico', n: '02', title: 'Modo automático', short: 'Automático', blurb: 'Encaixe o pendrive: analisa, organiza e relata sozinho.', tone: 'grafite', icon: Zap, group: 'Operação' },
  { path: '/arquivos', n: '03', title: 'Central de arquivos', short: 'Arquivos', blurb: 'Selecione, analise, ache duplicados e planeje pastas.', tone: 'grafite', icon: FolderSearch, group: 'Operação' },
  { path: '/relatorios', n: '04', title: 'Relatórios', short: 'Relatórios', blurb: 'Painel das análises e exportação em JSON e CSV.', tone: 'gelo', icon: BarChart3, group: 'Operação' },
  { path: '/seguranca', n: '05', title: 'Segurança', short: 'Segurança', blurb: 'SHA-256, verificação de integridade e cofre AES-GCM.', tone: 'noite', icon: ShieldCheck, group: 'Proteção e controle' },
  { path: '/casos', n: '11', title: 'Casos reais', short: 'Casos', blurb: '12 incidentes reais, as lições e o Verificador de backup.', tone: 'grafite', icon: BookOpenCheck, group: 'Proteção e controle' },
  { path: '/historico', n: '06', title: 'Histórico', short: 'Histórico', blurb: 'Tudo o que foi feito, com data e hora.', tone: 'gelo', icon: History, group: 'Proteção e controle' },
  { path: '/laboratorio', n: '07', title: 'Laboratório 3D', short: 'Laboratório', blurb: 'Abra o Núcleo USBI camada por camada.', tone: 'noite', icon: Box, group: 'Experiência' },
  { path: '/personagem', n: '08', title: 'Meu personagem', short: 'Personagem', blurb: 'Monte o seu Vigia e salve versões.', tone: 'mata', icon: UserRound, group: 'Experiência' },
  { path: '/configuracoes', n: '09', title: 'Configurações', short: 'Ajustes', blurb: 'Automação, tema, IA, movimento e dados locais.', tone: 'grafite', icon: Settings, group: 'Sistema' },
  { path: '/apresentacao', n: '12', title: 'Modo apresentação', short: 'Apresentar', blurb: 'Slides em tela cheia para apresentar o projeto, com QR code.', tone: 'grafite', icon: Presentation, group: 'Sistema' },
  { path: '/ajuda', n: '10', title: 'Ajuda e diagnóstico', short: 'Ajuda', blurb: 'Offline, pendrive, Android e limites.', tone: 'grafite', icon: HelpCircle, group: 'Sistema' },
];

export const GROUPS: Group[] = ['Operação', 'Proteção e controle', 'Experiência', 'Sistema'];

export function routeFor(pathname: string): RouteMeta | undefined {
  return ROUTES.find((r) => r.path === pathname);
}

export const byPath = (p: string) => ROUTES.find((r) => r.path === p)!;
