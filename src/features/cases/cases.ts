/**
 * Casos reais de perda, exposição ou indisponibilidade de dados, pesquisados em
 * 04/11/2026. Cada um traz a fonte. Quando as fontes divergem, o texto diz.
 * `fix` aponta a área do app que responde à lição; `limit` diz o que nenhum
 * app resolve sozinho (honestidade: não prometemos o impossível).
 */
export type CaseKind = 'acidente' | 'backup' | 'migracao' | 'desastre' | 'ataque' | 'exposicao';

export const KIND_LABEL: Record<CaseKind, string> = {
  acidente: 'Apagado por engano',
  backup: 'Backup que falhou',
  migracao: 'Migração e sincronização',
  desastre: 'Desastre físico',
  ataque: 'Ataque e ransomware',
  exposicao: 'Vazamento e mídia perdida',
};

export interface Fix { label: string; to: string }

export interface DataCase {
  id: string;
  year: string;
  org: string;
  size: 'grande' | 'pequena';
  kinds: CaseKind[];
  title: string;
  what: string;
  lesson: string;
  fixes: Fix[];
  limit?: string;
  source: { label: string; url: string };
}

const F = {
  verificador: { label: 'Verificador de backup', to: '/casos#verificador' },
  lixeira: { label: 'Lixeira restaurável e Desfazer', to: '/arquivos' },
  integridade: { label: 'SHA-256 e verificação de integridade', to: '/seguranca' },
  cofre: { label: 'Cofre AES-256-GCM', to: '/seguranca' },
  automatico: { label: 'Modo automático com relatório', to: '/automatico' },
  regra321: { label: 'Checklist 3-2-1', to: '/casos#regra-321' },
  local: { label: 'Processamento 100% local', to: '/ajuda' },
  historico: { label: 'Histórico de cada ação', to: '/historico' },
} satisfies Record<string, Fix>;

export const CASES: DataCase[] = [
  {
    id: 'pixar', year: '1998', org: 'Pixar (Toy Story 2)', size: 'grande', kinds: ['acidente', 'backup'],
    title: 'Um comando apagou quase todo o filme, e o backup não funcionava',
    what: 'Um comando de exclusão rodou na pasta com os arquivos do filme. O sistema de backup, descobriu-se, não vinha funcionando. O filme foi salvo por uma cópia que a supervisora técnica mantinha em casa. Os relatos divergem sobre o comando exato e o tamanho da perda.',
    lesson: 'Backup que nunca foi conferido pode não existir. E apagar não pode ser imediato nem irreversível.',
    fixes: [F.verificador, F.lixeira],
    source: { label: 'Techdirt (relato de Oren Jacob)', url: 'https://www.techdirt.com/2012/05/18/how-toy-story-2-almost-got-deleted-except-that-one-person-made-home-backup' },
  },
  {
    id: 'gitlab', year: '2017', org: 'GitLab', size: 'grande', kinds: ['acidente', 'backup'],
    title: 'Diretório errado apagado; as rotinas de backup tinham falhado em silêncio',
    what: 'Durante uma manutenção, os dados do banco principal foram removidos por engano. Na hora de restaurar, os backups falharam: o bucket com os dumps estava vazio por incompatibilidade de versões. Um snapshot manual de 6 horas antes salvou o restante; cerca de 6 horas de dados se perderam.',
    lesson: 'Teste a restauração, não só a cópia. Falha de backup precisa gerar alerta.',
    fixes: [F.verificador, F.automatico, F.historico],
    source: { label: 'GitLab — postmortem oficial', url: 'https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/' },
  },
  {
    id: 'myspace', year: '2019', org: 'MySpace', size: 'grande', kinds: ['migracao', 'backup'],
    title: '12 anos de músicas perdidos numa migração de servidores',
    what: 'A empresa informou que arquivos foram corrompidos na migração e não puderam ser transferidos: cerca de 50 milhões de músicas enviadas entre 2003 e 2015, além de fotos e vídeos. Disse não haver como recuperar.',
    lesson: 'Antes de apagar a origem, confira a cópia arquivo por arquivo, pelo conteúdo.',
    fixes: [F.verificador, F.integridade],
    source: { label: 'Rolling Stone', url: 'https://www.rollingstone.com/music/music-news/Myspace-lost-music-809455/' },
  },
  {
    id: 'kyoto', year: '2021', org: 'Universidade de Kyoto + HPE', size: 'grande', kinds: ['backup', 'acidente'],
    title: 'Script de limpeza com bug apagou 77 TB do disco de backup',
    what: 'Uma atualização do script que deveria apagar logs antigos foi aplicada com a versão anterior em execução, e o script removeu os arquivos errados: cerca de 77 TB (34 milhões de arquivos) de 14 grupos de pesquisa. Parte não pôde ser recuperada. A HPE assumiu 100% da responsabilidade.',
    lesson: 'Automação que apaga precisa de lixeira, limite e registro. Nada de exclusão direta.',
    fixes: [F.lixeira, F.automatico, F.historico],
    source: { label: 'DatacenterDynamics', url: 'https://www.datacenterdynamics.com/en/news/kyoto-university-loses-77tb-of-supercomputer-data-after-buggy-update-to-hpe-backup-program/' },
  },
  {
    id: 'ovh', year: '2021', org: 'OVHcloud (Estrasburgo) e clientes', size: 'grande', kinds: ['desastre', 'backup'],
    title: 'Incêndio destruiu um datacenter; quem tinha o backup no mesmo prédio perdeu tudo',
    what: 'Em março de 2021, um incêndio destruiu o prédio SBG2. Clientes perderam dados de vez, entre eles empresas pequenas cujo backup ficava no mesmo prédio. A Justiça francesa condenou a OVH a indenizar clientes.',
    lesson: 'Regra 3-2-1: três cópias, em dois meios diferentes, uma fora do local.',
    fixes: [F.regra321, F.verificador],
    limit: 'O app não guarda cópias na nuvem: ele ajuda a fazer e conferir a cópia no pendrive ou em outro disco.',
    source: { label: 'Blocks & Files', url: 'https://blocksandfiles.com/2023/03/23/ovh-cloud-must-pay-damages-for-lost-backup-data/' },
  },
  {
    id: 'unisuper', year: '2024', org: 'UniSuper + Google Cloud', size: 'grande', kinds: ['acidente', 'backup'],
    title: 'Erro de configuração apagou a nuvem privada de um fundo de previdência',
    what: 'Uma configuração errada no provisionamento apagou a assinatura de nuvem privada do fundo, inclusive nas duas regiões com cópias. Os serviços voltaram depois de mais de uma semana, com a ajuda de um backup guardado em outro fornecedor.',
    lesson: 'Tenha uma cópia que não dependa do mesmo fornecedor nem da mesma conta.',
    fixes: [F.regra321, F.verificador],
    limit: 'Nenhum app no seu aparelho impede erros dentro de um provedor de nuvem; uma cópia independente, sim.',
    source: { label: 'DatacenterDynamics', url: 'https://www.datacenterdynamics.com/en/news/google-cloud-accidentally-deleted-unisupers-private-cloud-subscription' },
  },
  {
    id: 'codespaces', year: '2014', org: 'Code Spaces', size: 'pequena', kinds: ['ataque', 'backup'],
    title: 'Invasor apagou dados e backups pelo mesmo painel; a empresa fechou',
    what: 'Com acesso ao painel da nuvem, o invasor pediu resgate e, sem pagamento, apagou servidores, discos e backups em cerca de 12 horas. Os backups eram controlados pelo mesmo painel. A empresa encerrou as atividades.',
    lesson: 'Backup isolado (offline) e senha forte com segundo fator.',
    fixes: [F.regra321, F.cofre],
    limit: 'Segurança de contas na nuvem (MFA, permissões) fica fora do app.',
    source: { label: 'Network World', url: 'https://www.networkworld.com/article/2366862/a-wakeup-call-for-the-cloud.html' },
  },
  {
    id: 'gdrive', year: '2023', org: 'Google Drive para computador', size: 'grande', kinds: ['migracao'],
    title: 'Bug de sincronização fez arquivos sumirem para parte dos usuários',
    what: 'Nas versões 84.0.0.0 a 84.0.4.0 do Drive para computador, alterações locais ainda não sincronizadas se perderam. O Google lançou uma ferramenta de recuperação, que não funcionou para todos.',
    lesson: 'Sincronizar não é fazer backup: um erro sincronizado se espalha.',
    fixes: [F.local, F.verificador],
    source: { label: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/news/google/google-shares-fix-for-deleted-google-drive-files' },
  },
  {
    id: 'wd', year: '2021', org: 'Western Digital My Book Live', size: 'grande', kinds: ['ataque'],
    title: 'Discos ligados à internet foram apagados remotamente',
    what: 'Falhas antigas, sem correção porque a linha não recebia mais atualizações, permitiram que atacantes mandassem um reset de fábrica pela internet. Muitos donos perderam tudo; a recuperação raramente funcionou.',
    lesson: 'Dispositivo de armazenamento exposto à internet e sem atualização é um risco.',
    fixes: [F.local, F.regra321],
    source: { label: 'Engadget', url: 'https://www.engadget.com/western-digital-my-book-live-factory-reset-two-vulnerabilities-044122712.html' },
  },
  {
    id: 'amagasaki', year: '2022', org: 'Prefeitura de Amagasaki (Japão), via terceirizada', size: 'pequena', kinds: ['exposicao'],
    title: 'Pendrive com dados de todos os 460 mil moradores perdido após um jantar',
    what: 'Um funcionário de empresa contratada levou pendrives com nome, endereço, data de nascimento e dados bancários de beneficiários, e os perdeu após sair de um bar. Os dados estavam cifrados e com senha. Os pendrives foram encontrados.',
    lesson: 'Pendrive com dado pessoal deve ir cifrado, e o dado deve ser apagado quando o trabalho acaba.',
    fixes: [F.cofre, F.lixeira],
    source: { label: 'CBS News', url: 'https://www.cbsnews.com/news/amagasaki-japan-lost-usb-data-460000-residents/' },
  },
  {
    id: 'stj', year: '2020', org: 'Superior Tribunal de Justiça (Brasil)', size: 'grande', kinds: ['ataque', 'backup'],
    title: 'Ransomware paralisou o tribunal por mais de uma semana',
    what: 'Em novembro de 2020, um ataque criptografou sistemas e interrompeu sessões. O tribunal afirmou que os dados estavam preservados em backup; reportagens relataram backups também atingidos. As fontes divergem sobre a extensão.',
    lesson: 'Mantenha um backup desconectado e um registro de hashes para provar o que mudou.',
    fixes: [F.integridade, F.regra321, F.verificador],
    source: { label: 'ConJur', url: 'https://www.conjur.com.br/2020-nov-05/stj-processos-preservados-conta-inteligencia-exercito/' },
  },
  {
    id: 'cpfs', year: '2021', org: 'Megavazamento de 223 milhões de CPFs (Brasil)', size: 'grande', kinds: ['exposicao'],
    title: 'Base com dados de quase todos os brasileiros circulou na internet',
    what: 'Em janeiro de 2021 foi descoberta uma base com cerca de 223 milhões de CPFs, com endereço, telefone, score e outros dados, distribuída em um fórum. A ANPD investigou e a PF prendeu um suspeito. A origem exata não foi confirmada publicamente.',
    lesson: 'Guarde só o necessário e cifre o que for sensível (LGPD).',
    fixes: [F.cofre, F.local],
    limit: 'O app não protege bases de outras empresas: ele evita que os seus arquivos saiam do seu aparelho.',
    source: { label: 'Tecnoblog', url: 'https://tecnoblog.net/especiais/megavazamento-de-223-milhoes-de-cpfs-um-ano-se-passou-e-ainda-ha-perguntas-sem-resposta/' },
  },
];

/** As causas que se repetem nos casos e a resposta do app a cada uma. */
export const ROOT_CAUSES: { cause: string; cases: string[]; answer: string; to: string }[] = [
  { cause: 'Backup existia, mas ninguém conferia', cases: ['pixar', 'gitlab', 'myspace', 'kyoto'], answer: 'Verificador de backup: compara origem e cópia pelo SHA-256 e mostra o que falta ou mudou.', to: '/casos#verificador' },
  { cause: 'Exclusão imediata e sem volta', cases: ['pixar', 'gitlab', 'kyoto'], answer: 'Nada é apagado de vez sem confirmação: lixeira restaurável, Desfazer e Histórico.', to: '/arquivos' },
  { cause: 'Cópia no mesmo lugar ou na mesma conta', cases: ['ovh', 'unisuper', 'codespaces'], answer: 'Checklist 3-2-1 e verificação da cópia externa no pendrive.', to: '/casos#regra-321' },
  { cause: 'Migração ou sincronização sem conferência', cases: ['myspace', 'gdrive'], answer: 'Hash antes e depois; o app trabalha local e nunca sincroniza sozinho.', to: '/seguranca' },
  { cause: 'Dado sensível sem criptografia', cases: ['amagasaki', 'cpfs'], answer: 'Cofre AES-256-GCM com senha que não é guardada em lugar nenhum.', to: '/seguranca' },
  { cause: 'Equipamento exposto ou ataque', cases: ['wd', 'codespaces', 'stj'], answer: 'Processamento 100% offline e registro de hashes para provar alterações.', to: '/seguranca' },
];

export const RULE_321 = [
  { id: 'tres', text: 'Tenho 3 cópias dos arquivos importantes (a original + 2).' },
  { id: 'dois', text: 'As cópias estão em 2 tipos de mídia diferentes (ex.: computador e pendrive).' },
  { id: 'um', text: '1 cópia fica fora de casa ou do escritório (ou desconectada).' },
  { id: 'testei', text: 'Conferi a cópia no Verificador de backup nos últimos 30 dias.' },
  { id: 'cifrei', text: 'O que é pessoal ou sigiloso vai cifrado no Cofre.' },
] as const;
