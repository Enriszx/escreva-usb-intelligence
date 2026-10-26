# USB Intelligence

Ecossistema de arquivos para o navegador: seleção e análise de arquivos, detecção de duplicados por SHA-256, planejamento de organização, verificação de integridade, cofre AES-256-GCM, relatórios, histórico — e um laboratório 3D com um pendrive conceitual e um personagem (“o Vigia”) personalizável. Tudo roda no aparelho; nada é enviado para servidores.

## Tecnologias

| Necessidade | Escolha |
|---|---|
| Interface | React 18 + TypeScript + Vite 5 |
| 3D | three.js, React Three Fiber, Drei (OrbitControls, RoundedBox, Environment com Lightformers — sem HDR externo) |
| Movimento | Motion (`motion/react`) |
| Ícones | lucide-react |
| Dados locais | IndexedDB (wrapper próprio em `src/lib/storage/db.ts`) |
| Criptografia | Web Crypto API (SHA-256, PBKDF2, AES-GCM) + SHA-256 incremental próprio para arquivos grandes |
| Offline | Service worker gerado no build (`scripts/vite-plugin-sw.ts`) |
| Testes | Vitest (unidade) + Playwright (ponta a ponta, `scripts/e2e.mjs`) |
| Fontes | Bricolage Grotesque e IBM Plex Mono, empacotadas localmente via Fontsource (SIL OFL) |

Gráficos são SVG próprios (`src/components/charts`) com paleta validada para daltonismo e contraste.

## Comandos

```bash
npm install            # dependências
npm run dev            # desenvolvimento em http://localhost:5173 (service worker desligado)
npm test               # testes de unidade (Vitest)
npm run build          # versão de produção em dist/
npm run preview        # serve dist/ em http://localhost:4173 (com service worker)
npm run e2e            # testes no Chromium (exige build antes)
npm run serve:local    # servidor local sem dependências para dist/ (porta 4321)
npm run package:usb    # gera release/ com a pasta para o pendrive e o .zip do código-fonte
```

## Estrutura

```
src/
  app/            shell, rotas, contextos (configurações, avisos, confirmação), hooks
  components/     layout, gráficos, 3D compartilhado (Stage, CoreDevice, CameraRig), UI
  features/       home, files, lab, character, security, reports, history, settings, help
  lib/            regras de negócio sem React: analysis/, crypto/, storage/, files/, pwa/
  workers/        hash.worker.ts (SHA-256 fora da thread de interface)
  styles/         tokens do sistema de design, base, layout
scripts/          plugin do service worker, servidor local, empacotador, e2e, ícones
tests/            testes de unidade
```

## Sistema de design (resumo)

- **Tons de seção** (`data-tone`): `grafite`, `mata`, `noite`, `gelo`. Cada página usa um par principal; as outras cores ficam para estado e detalhe.
- **Tipografia:** Bricolage Grotesque variável — títulos a 800 de peso e 75% de largura, caixa alta, entrelinha 0,86; interface no mesmo família em largura normal. IBM Plex Mono para índices, rótulos e números.
- **Assinaturas:** recorte de conector no canto superior direito (botões primários, painéis), curvas de nível procedurais (`src/lib/topo.ts`), numeração editorial vazada, marca derivada da boca de uma porta USB-A.
- **Movimento:** curtas transições com `ease-out`; `prefers-reduced-motion` e a opção do app desligam animações contínuas e trocam o 3D para renderização sob demanda.

## Instalar como PWA (Android)

1. Publique `dist/` em qualquer hospedagem **HTTPS** estática (o app usa caminhos relativos e `HashRouter`, então funciona em subpastas e sem regras de reescrita).
2. Abra no Chrome do Android → menu ⋮ → **Instalar app**.
3. Visite as áreas uma vez com internet. Em **Ajuda e diagnóstico**, “Arquivos essenciais em cache” deve mostrar todos os arquivos. Daí em diante, funciona offline.

Atualizações: um novo build gera nova versão do cache; o app mostra “Nova versão pronta — Atualizar agora”.

## Pendrive, servidor local, PWA e app nativo

| Forma | O que acontece |
|---|---|
| PWA instalada (HTTPS) | Ícone na tela inicial, offline após a primeira visita. Acesso só aos arquivos que o usuário escolhe. |
| Arquivos copiados no pendrive | **Não rodam sozinhos.** Abrir `index.html` por `file://` é bloqueado pelos navegadores (módulos ES, service worker, Web Crypto). |
| Servidor local | `node servir.mjs` serve a pasta em `http://localhost:4321` — contexto seguro, tudo funciona, sem internet. |
| App nativo (futuro) | Empacotar com Tauri (desktop) ou Capacitor (Android) para acessar pastas inteiras com permissão do sistema. A lógica em `src/lib` já é independente da interface. |

### Copiar para o pendrive

```bash
npm run package:usb
```
Copie `release/usb-intelligence/` para o pendrive (≈2 MB). Ela contém `app/`, `servir.mjs` e `LEIA-ME.txt`. Num computador com Node.js 18+: `node servir.mjs` dentro da pasta.

Dados do usuário (configurações, personagens, histórico, relatórios) ficam no navegador de cada aparelho. Para levá-los: **Configurações → Exportar backup** e salvar o JSON no pendrive; no outro aparelho, **Restaurar backup** (o arquivo é validado antes de gravar).

### Uso no Android com OTG

Conecte pendrive → adaptador OTG → celular. No app, **Escolher arquivos** abre o seletor do Android; o pendrive aparece no menu lateral. Pendrives FAT32/exFAT funcionam na maioria dos aparelhos; NTFS geralmente não. Relatórios exportados vão para Downloads; mova-os para o pendrive pelo app Arquivos. O app nunca detecta nem abre o pendrive sozinho.

## O que está implementado

- **Início:** abertura com título editorial, objeto 3D real (arraste lateral gira, rolagem separa as camadas, cursor inclina), abertura opcional e salva, demonstração identificada com hash ao vivo real.
- **Central de arquivos:** seleção de arquivos/pasta/arrastar-e-soltar, deduplicação de seleção repetida, busca, filtro por categoria e extensão, ordenação, seleção múltipla, remover da lista (sem tocar nos originais), detalhes por arquivo, hash individual.
- **Análise:** completa ou só candidatos (agrupamento por tamanho), SHA-256 num Web Worker com progresso real, estimativa de tempo e cancelamento; resultados parciais mantidos; relatório e histórico gravados.
- **Duplicados:** grupos por conteúdo (nunca por nome), espaço recuperável contando (n−1) cópias, exportação CSV/JSON, “tirar cópias da lista” com confirmação.
- **Nomes:** nomes idênticos e semelhantes (acentos, “(1)”, “- Cópia”), dizendo se o conteúdo é igual, diferente ou não verificado.
- **Organização:** 5 critérios, prévia em árvore, contagens, conflitos resolvidos, exportação TXT/CSV, salvar plano, e **cópia organizada** real numa pasta escolhida (File System Access; nunca sobrescreve nem apaga).
- **Painel:** volume, duplicados, recuperável, integridade de leitura, nomes repetidos; rosca por categoria e barras por extensão interativas, alternando tamanho/quantidade, com filtro cruzado para o acervo.
- **Laboratório 3D:** Núcleo USBI em camadas; separação, modos Produto/Raio-X/Seção (plano de corte real), 4 vistas de câmera, zoom limitado por botão ou gesto, LED, seleção de peças por toque.
- **Personagem:** cores (principal, secundária, detalhes, pele, luz), acabamento, luz on/off e intensidade, 3 olhos, 5 coberturas, 3 trajes, 3 poses, 5 acessórios — todos geometria real com transição suave de cor; 5 estilos; desfazer, aleatório, padrão; salvar/salvar como novo/carregar/renomear/excluir; rascunho automático; JSON exportar/importar com validação; PNG por captura real do canvas.
- **Segurança:** SHA-256 com comparação à referência (aceita formato `sha256sum`), referências guardadas e verificação posterior, cofre `.usbi` (AES-256-GCM, PBKDF2-SHA-256 600 mil iterações, salt/nonce aleatórios, cabeçalho autenticado), informações de armazenamento e pedido de persistência.
- **Relatórios:** painel com linha do tempo, lista filtrável, detalhe com gráficos, exportação JSON/CSV e impressão/PDF pelo navegador.
- **Histórico:** filtros por texto, tipo, resultado e período; detalhes; exportação; exclusão por item.
- **Configurações:** movimento, abertura, qualidade 3D, histórico on/off, backup exportar/restaurar, apagar por coleção ou tudo (exige digitar APAGAR).
- **Ajuda e diagnóstico:** verificações reais de capacidades, estado do cache offline arquivo a arquivo, instalar app, limpar cache, guias.

## Depende de permissão ou plataforma

- Seleção de pasta inteira (`webkitdirectory`): geralmente indisponível no Android.
- Cópia organizada e “Salvar como…”: Chrome/Edge de computador (File System Access API).
- Modo offline, instalação e cofre: exigem HTTPS ou localhost.
- 3D: exige WebGL; sem ele, ilustrações vetoriais equivalentes.
- Armazenamento persistente: concedido a critério do navegador.

## Limitações conhecidas

- Um site não apaga, move nem renomeia os arquivos selecionados; por isso a organização é plano exportável ou cópia.
- Hash não detecta malware nem corrupção semântica; só compara conteúdo.
- Cofre processa em memória (limite de 1 GB por arquivo).
- O acesso a arquivos selecionados não sobrevive a recarregar a página (os relatórios sim).
- O chunk do three.js tem ~680 KB (~176 KB gzip); só carrega nas áreas com 3D.

## Próximas melhorias sugeridas

- Persistir `FileSystemHandle`s (Chrome) para reanalisar pastas sem selecionar de novo.
- Cofre em fluxo (streaming por blocos) para arquivos acima de 1 GB.
- Empacotamento Tauri (desktop) e Capacitor (Android) reaproveitando `src/lib`.
- Detecção de imagens quase iguais (hash perceptual) como categoria separada de “idêntico”.
- Exportação PDF dedicada, se a impressão do navegador não bastar.
