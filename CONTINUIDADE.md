# USB Intelligence — documento de continuidade

> Para a próxima sessão de desenvolvimento. Leia tudo antes de mexer no código.
> Atualizado em 03/11/2026. Inclui a troca do Claude pela IA grátis no aparelho (WebLLM + Qwen2.5).

---

## 0. Resumo em 30 segundos

- **O que é:** web app 3D "USB Intelligence", com estética brasileira futurista. Usa React 18, TypeScript, Vite 5, three.js e React Three Fiber. Analisa arquivos de verdade (SHA-256, duplicados por conteúdo, plano de organização), gerencia pastas reais (renomear, mover, lixeira, apagar, desfazer) e tem cofre AES-GCM, personagem 3D editável, relatórios, histórico e PWA offline. Tem também app Android (Capacitor + plugin SAF próprio) e o assistente **Vigia IA**.
- **Idioma:** tudo em **português do Brasil**: interface, commits, README e respostas ao usuário.
- **Estado atual:** todos os testes passam: **87 unitários (Vitest)** e **27 grupos e2e (Playwright)**. Visual "Brasil Moderno" e Modo automático no ar (seção 6b). Os builds `dist/` e `dist-artifact/` estão gerados, e os pacotes `.zip` em `release/` foram regenerados.
- **Publicado:** Artifact privado em https://claude.ai/artifact/2sEcU5zeBd4jDTUN19HXXS (prévia). Ele não usa mais nenhuma capacidade do Claude.
- **GitHub:** https://github.com/Enriszx/escreva-usb-intelligence (repositório **público**). Tudo foi enviado, e o site público está em https://enriszx.github.io/escreva-usb-intelligence/. **A senha nunca vai para o repositório**: ela entra no build pela variável `VITE_PASS_HASH` (seção 4).
- **Decisão do usuário (03/11):** "desconecte do Claude e coloque um código de IA PRÓPRIO e grátis que não gaste nada". Por isso não há mais SDK da Anthropic nem capacidade `sample`. Não reintroduzir sem pedido.

---

## 1. Quem é o usuário e como trabalhar com ele

- Escreve em português, de forma curta e informal, às vezes com erro de digitação. Por exemplo, "adicionei uma IA" queria dizer "adicione".
- Não é programador. Prefere que tudo seja feito por nós, e quer **links prontos** e passo a passo em cliques quando precisar agir.
- Usa celular Android com frequência. Testar sempre em 360–390 px.
- **Nunca peça para colar token, chave de API ou senha no chat.**
- Ele quer tudo **grátis**: nada de serviço pago, chave ou conta para a IA.
- Prefere resultado funcionando a explicação longa. Respostas finais curtas, em português, com o link e o que falta.

## 2. Linha do tempo dos pedidos

1. **Master prompt** ("USB INTELLIGENCE MASTER PROMPT", seções 1–30). Pedia:
   - home com hero cinematográfico e objeto 3D real;
   - 9 áreas: Início, Central de arquivos, Laboratório 3D, Meu personagem, Segurança, Relatórios, Histórico, Configurações, Ajuda e diagnóstico;
   - análise real de arquivos, dashboard com dados reais, cofre AES-GCM, IndexedDB, PWA offline, guia pendrive/Android/OTG e acessibilidade;
   - **honestidade:** nada de dados falsos, botões falsos ou promessas que o navegador não cumpre;
   - testes e entregáveis (ZIPs e instruções).
2. "publique e eu quero que tenha como apagar, renomear, e tudo" → gerenciamento real de arquivos e app Android.
3. "Posta no Google" → "quero um link público". Firebase ficou sem credenciais, então mudamos para **GitHub Pages**. O usuário criou o repositório `Enriszx/escreva-usb-intelligence` e instalou o app Claude no GitHub. O push funcionou. No Actions, o job do APK passou e o do Pages falhou só no deploy, porque o Pages ainda não estava ativado.
4. "Adiciona todas as opções desse arquivo para cá, e a senha é [a senha dele]" (anexo `index-1.html`, "www.br.USB"). Foram implementados:
   - tela de senha;
   - tema claro e escuro;
   - registro persistente da biblioteca;
   - grade e agrupamento;
   - Visão geral completa;
   - Planilhas e Apresentações;
   - soltar arquivos em qualquer lugar da página;
   - arquivos de sistema (junk).
5. "A senha não está indo" → nunca esclarecido. Como precaução, o `AuthGate` passou a tolerar espaço nas pontas e maiúsculas/minúsculas, e o campo desliga a correção automática do teclado.
6. "Adicione uma IA organizadora e que corresponde a tudo quanto eu pedir, no site" → **Vigia IA**, primeiro com o Claude.
7. "Faça uma transferência completa desta sessão para uma nova sessão" → este documento.
8. "Faça isso agr, desconecte do Claude e coloque um código de IA PRÓPRIO e grátis que não gaste nada" → motor trocado para **WebLLM + Qwen2.5** rodando no navegador (seção 6). A senha saiu do código para poder enviar ao repositório público.
9. "Quero que funcione como uma IA completa e lance um HTTPS…" → IA online grátis gpt-oss-20b (seção 6a) e site público no GitHub Pages.
10. "Mude todo o visual… MODERNO e PROFISSIONAL… lembre o Brasil… bandeira como fundo… para mandar para uma empresa gigante… interativo, gráficos objetivos… organizar em mais partes… encaixar o pendrive e fazer tudo sozinho" → redesign "Brasil Moderno" + Modo automático (seção 6b).

## 3. Como rodar

```bash
npm ci
npm run dev            # desenvolvimento
npm run build          # tsc -b && vite build  → dist/
npm test               # Vitest (56 testes)
npm run e2e            # Playwright: precisa de build antes; sobe vite preview na porta 4179
npm run package:usb    # gera release/*.zip e release/usb-intelligence/ (pasta para pendrive)
npm run serve:local    # servidor local para rodar do pendrive
npm run android:apk    # precisa do Android SDK (não existe no container; o GitHub Actions compila)
npm run deploy:firebase  # precisa de FIREBASE_PROJECT e FIREBASE_SERVICE_ACCOUNT_JSON (não temos)
```

### Playwright no container de nuvem

O Chromium já vem instalado. **Não rode `playwright install`.** O `scripts/pw.mjs` (`loadPlaywright()`) carrega a cópia local ou a global. Para scripts avulsos fora do projeto:

```js
import { loadPlaywright } from '/caminho/do/projeto/scripts/pw.mjs';
const { chromium } = await loadPlaywright();
```

### Rodar o e2e sem confusão

- Use um arquivo de saída **novo** a cada rodada. O e2e leva cerca de 4–6 minutos.
- O fim da execução tem a linha `N/23 grupos de teste passaram.`. Grave também `exit=$?` no arquivo.
- `E2E_SHOTS=/pasta` salva captura de tela das falhas.
- No e2e, a senha é pulada pelo init script `UNLOCK`, que grava `sessionStorage['usbi.acesso']='1'`.

## 4. Arquitetura

### Pastas principais

```
src/
  main.tsx              App dentro de <AuthGate> (senha)
  app/                  App.tsx (rotas, GlobalDrop, Assistant, ExportFallback), AuthGate.tsx,
                        settings.tsx (tema via html[data-theme]), feedback.tsx (useConfirm, toasts),
                        hooks.ts (useOnline...), routes.ts (as 9 áreas, tons de cor)
  components/           layout/ (Header, Footer, StatusBar, ExportFallback), three/ (Stage, CoreDevice,
                        CameraRig, Fallbacks, webgl), charts/ (Donut, Treemap, BarList, Timeline...), ui/
  features/
    assistant/          Vigia IA (seção 6)
    files/              Central de arquivos: store.tsx (estado), folder.tsx (pasta conectada),
                        FilesPage + abas (Dashboard "Visão geral", Archive, Duplicates, Names,
                        Organize, Trash), GlobalDrop, Intake, FolderBar, fileDialogs
    character/          editor do personagem (useCharacterEditor.ts exporta DRAFT_KEY e Draft)
    home/ lab/ security/ reports/ history/ settings/ help/
  lib/
    analysis/           sha256, hashing, hashService (worker), duplicates, organize, summary,
                        categories, names, junk
    files/              backend.ts (contrato + TrashingBackend), webFolder.ts (File System Access),
                        androidFolder.ts (plugin Capacitor UsbiFiles), applyPlan.ts, intake.ts
    storage/            db.ts (IndexedDB, DB_VERSION 2, stores incl. 'library'), repos.ts,
                        backup.ts (exporta e importa; filtra a linha antiga da chave)
    crypto/vault.ts     cofre AES-GCM (PBKDF2)
    platform.ts         IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact'
  workers/hash.worker.ts
scripts/                e2e.mjs, pw.mjs, vite-plugin-sw.ts + sw.template.js (service worker gerado),
                        package-usb.mjs, serve-local.mjs, make-icons.mjs, deploy-firebase.sh
android/                projeto Capacitor; plugin SAF em
                        android/app/src/main/java/br/usbintelligence/app/UsbiFilesPlugin.java
.github/workflows/android.yml   jobs "apk" (artifact usb-intelligence-apk) e "pages" (GitHub Pages)
tests/                  Vitest: analysis, assistant, character, folder (fakeFs), sha256, storage, vault
```

### Decisões técnicas importantes

- `vite.config.ts` usa `base: './'` e o app usa **HashRouter**. Assim o mesmo build funciona em HTTPS, em subpasta e no pendrive.
- O **service worker** é gerado por um plugin próprio (`scripts/vite-plugin-sw.ts`), com manifesto offline. No build Artifact não há SW.
- **Contrato de pasta** (`lib/files/backend.ts`): toda operação real passa pelo backend. O `TrashingBackend` manda para a lixeira (`.usbi-lixeira`) antes de apagar de vez, e o desfazer usa essa lixeira.
- **Tema:** atributo `html[data-theme='light'|'dark']`. Cada área tem `data-tone` (grafite, mata, noite, gelo). Há blocos de override `[data-tone='gelo'], html[data-theme='light'] [data-tone]`, e no tema escuro o tom gelo vira grafite. Cores de status ficam em `--st-*`, e as de texto em `--ink-ok/warn/err/info`.
- **Gráficos:** paleta validada com o script da skill *dataviz*, em `components/charts/colors.ts`.
- **Senha** (`AuthGate.tsx`): compara com `import.meta.env.VITE_PASS_HASH`, o SHA-256 de `"usbi|senha"`. Se a variável estiver vazia, o app abre sem senha. Ela vem de `.env.local` (fora do Git; já existe neste container) ou do segredo `USBI_PASS_HASH` no GitHub Actions. O usuário sabe a senha; não a escreva em arquivos versionados. A liberação fica em `sessionStorage['usbi.acesso']`; 5 erros travam a entrada por 15 s. **Não é segurança de verdade** (o código é público), e isso está explicado no próprio arquivo.
- **Configurações** (`repos.ts` → `Settings`): `intro, motion, quality, saveHistory, theme, saveLibrary, assistant, aiModel, aiInstalled`. Padrão: `aiModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'` e `aiInstalled: null` (vira o id do modelo depois do primeiro carregamento bem-sucedido). O `loadSettings` migra `aiModel` antigo (`claude-*`) e apaga a chave antiga `anthropicKey` (`forgetOldApiKey`).

### Dois builds

| Build | Comando | Uso |
|---|---|---|
| Normal | `npm run build` → `dist/` | GitHub Pages, pendrive, Android (`webDir: dist`), Firebase |
| Artifact | `VITE_TARGET=artifact npx vite build --outDir dist-artifact --emptyOutDir` + transformação (seção 7) | página privada no claude.ai |

No build Artifact (`IS_ARTIFACT`) ficam escondidos ou ganham alternativa: service worker, downloads (usa o `ExportFallback`) e conectar pasta. A IA do aparelho provavelmente não baixa dentro do claude.ai (o quadro protegido pode bloquear o Hugging Face); nesse caso o painel mostra o erro e segue com comandos.

## 5. O que está pronto

- As 9 áreas da seção 2.
- **Central de arquivos:**
  - escolher arquivos ou pasta, soltar em qualquer lugar;
  - registro persistente (lembra os arquivos ao recarregar e reabre a leitura quando o usuário escolhe de novo);
  - análise completa ou só duplicados, em worker;
  - duplicados por SHA-256 (nunca por nome) e nomes parecidos;
  - plano de organização por categoria, extensão, categoria-ano, ano-mês ou tamanho;
  - grade e lista, agrupar e ordenar, miniaturas;
  - Visão geral com gráficos reais;
  - arquivos de sistema (junk).
- **Pasta conectada** (File System Access no Chrome desktop e Android via SAF): renomear, mover, lixeira, apagar de vez (com confirmação), aplicar organização e desfazer.
- **Segurança:** hash e verificação de integridade, referências de integridade, cofre AES-GCM.
- **Personagem 3D:** editor, presets (por exemplo "Núcleo Azul"), salvar e restaurar, importar e exportar JSON.
- **Relatórios** (JSON e CSV), **Histórico**, **Configurações** (backup, armazenamento, assistente), **Ajuda e diagnóstico**.
- **PWA instalável** e offline, com manifesto e ícones.
- **Senha (por variável de build), tema e Vigia IA com IA grátis no aparelho.**

## 6d. Visualizador de arquivos e Vigia com voz (04/11, mais recente)

Pedido: "IA integrada que nem o J.A.R.V.I.S." e "site todo funcional, como abrir arquivos". O nome do personagem não foi usado; o Vigia ganhou a postura de mordomo digital.
- **Visualizador:**
  - `src/features/files/viewKind.ts`: `viewKind`, `parseCsv`, `readTextStart` (com FileReader de reserva), `openFile(id)` via o evento `usbi:abrir-arquivo`;
  - `FileViewer.tsx` (`FileViewerHost`, montado no App): imagem, vídeo, áudio, PDF (iframe de blob), CSV em tabela, texto em `<pre>`; o resto vira download;
  - o blob vem de `files.getFile` ou `folder.backend.getBlob`; no Android o conteúdo não atravessa a ponte (mensagem honesta);
  - na Central (`ArchiveTab`), o nome e a miniatura abrem o arquivo; o botão ⓘ abre os detalhes; os detalhes têm "Abrir arquivo".
- **Voz** (`src/features/assistant/voice.ts`): `listenOnce` (SpeechRecognition pt-BR), `speak`/`speakable` (speechSynthesis).
  - No painel: botão de microfone, alto-falante (`Settings.aiVoice`) e modo conversa (volta a ouvir depois de falar).
  - **Nos testes, simule `window.SpeechRecognition` E `webkitSpeechRecognition`** (o Chromium já tem o nativo) e use `Object.defineProperty` para `speechSynthesis`.
- **Ferramentas novas** (`tools.ts`): `abrir_arquivo`, `ler_arquivo` (confirm a cada leitura; até 15 mil caracteres; só texto/CSV), `modo_automatico` (`ToolContext.auto`), `lembrete` (evento `usbi:lembrete`, toast + fala).
  - `abrir_area` ganhou automatico, casos e apresentacao.
  - O prompt diz que conteúdo só entra via `ler_arquivo` e traz data e hora.
  - `local.ts` ganhou o comando "abrir <nome>".
- Toasts ganharam `data-tone` (no tema claro estavam sem as variáveis de cor, e o contraste falhava).
- A auditoria passou a abrir visualizador, aviso e painel nos dois temas (56 verificações).
- Testes: `tests/viewer-voice.test.ts` (8) e o e2e 28.

## 6c. Casos reais, apresentação e auditoria (04/11, mais recente)

Pedido: pesquisar problemas reais de armazenamento/organização, "jogar no site e resolver", site sem nenhum erro, facilitar a apresentação, e passar o site para uma "ferramenta manual de criação de site" para dizer que foi o usuário quem fez.
- **Respondido ao usuário:** não ajudei a apresentar o trabalho como feito à mão. Ofereci exportar para uma ferramenta visual que ele mesmo edite, apresentando o projeto como feito com apoio de IA. Ficou aguardando qual ferramenta ele quer.
- `src/features/cases/cases.ts`: 12 casos com fonte, `ROOT_CAUSES` (6 causas) e `RULE_321`. `CasesPage.tsx` tem filtros, causas, `BackupCheck` (comparação por caminho e SHA-256, lógica em `src/lib/analysis/backupCheck.ts` com testes) e checklist 3-2-1 (localStorage `usbi.regra321`).
- `src/features/present/PresentationPage.tsx`: 8 slides e QR (`qrcode-generator`, desenhado em SVG sem HTML injetado). Na rota `/apresentacao` o App esconde cabeçalho, rodapé, tab bar e assistente.
- `scripts/audit.mjs` (`npm run audit`), com axe-core. Achou e foram corrigidos:
  - `dl` com `span` solto (agora `dd.stat-sub`);
  - botão Menu sem nome abaixo de 430 px;
  - barra da apresentação estourando em 360 px;
  - **`input[type=checkbox]` global em files.css encolhia todos os interruptores depois de abrir a Central** (agora `:not(.switch input)`).
- e2e 27: casos, filtro, verificador com pastas reais (`setInputFiles(diretório)`), checklist persistente, apresentação por teclado e QR.

## 6b. Redesign "Brasil Moderno" e Modo automático (o trabalho mais recente, 04/11)

**Visual** (vale para todas as páginas):
- `src/styles/tokens.css`: paleta da bandeira, superfícies de vidro (`--bg-2` rgba + blur), sombras, raios. Os nomes antigos (`--c-sol`, `--c-mata`…) foram mantidos com valores novos. Todos os `data-tone` usam a mesma paleta escura. O claro vem de `html[data-theme='light']` ou do sistema (`prefers-color-scheme`) quando o tema é "automático".
- `src/styles/base.css`: Inter (texto) + Plus Jakarta Sans (títulos), botões arredondados, `.card`/`.panel` de vidro, `.eyebrow`, `.grad-text`.
- `src/styles/layout.css`: cabeçalho de vidro com faixa verde-amarelo-azul, menu agrupado (`.index-groups`), rodapé por grupos, tab bar flutuante no celular, fundo `.bb`.
- `src/components/layout/BrasilBackdrop.tsx`: fundo estilizado inspirado na bandeira (losango, globo, Cruzeiro do Sul, faixa, órbita com satélite). Paralaxe via `--mx/--my/--sy`. Desligado com movimento reduzido. Fora da home (`.app:not(.is-home)`) fica mais apagado. É estilizado de propósito (Lei 5.700/71).
- `src/components/ui/Logo.tsx`: selo verde com losango, globo e conector USB.
- `src/app/routes.ts`: 10 rotas com `group` (Operação, Proteção e controle, Experiência, Sistema), `GROUPS` e `byPath`. A rota nova é `/automatico` (02); as demais foram renumeradas.
- `src/features/home/HomePage.tsx` + `src/styles/pages.css`: hero "Encaixe o pendrive. O resto é automático." com o 3D num cartão e chips ao vivo; fluxo de 6 etapas interativo (avança sozinho e pausa ao tocar); demonstração com KPIs e barras (Espaço/Quantidade); áreas por grupo; hash ao vivo; pilares; CTA. A seção de exemplo tem o selo "Demonstração".
- Gráficos objetivos: o treemap da Visão geral foi removido (duplicava as barras). Os KPIs novos usam `.stat-grid/.stat`, porque `.kpi` já existia em `files.css` e colidia. A paleta categórica foi revalidada com o script da skill dataviz nos dois temas; o claro pede rótulo visível, e o `BarList` mostra o valor.

**Modo automático:**
- `src/features/auto/auto.tsx` (`AutoProvider`, dentro do `FolderProvider`): o vigia a cada 3 s, com fases `indisponivel | sem-config | aguardando | precisa-toque | executando | pronto | erro`.
  - Sem pasta: `folder.attach(false)`, que é silencioso e só funciona se o navegador já der permissão.
  - Com pasta: `folder.probe()`. Se falhar, `folder.detach()` e "Pendrive removido".
  - Ao detectar sozinho: espera `SETTLE_MS` = 1,5 s, `rescan()` e roda.
  - O pipeline: ler → `files.analyze` (completa ou duplicados) → duplicados (`autoTrashDupes`: fica o mais antigo, `pickKeeper`; as cópias vão para `trashItems`) → plano (`autoOrganize`: `applyPlan`) → relatório (o `reportId` vem do `analyze`).
  - O resultado fica em `settings` com a chave `autoUltimo`, e o Histórico registra "Execução automática em X".
- `src/features/files/folder.tsx`:
  - `connect()` agora devolve boolean;
  - novos `attach(interactive)`, `probe()` e `detach()`;
  - `activate(b, handle, quiet)`;
  - o nome lembrado fica separado (`pastaConectadaNome`).
  - **O handle é lido do IndexedDB uma vez e fica em memória (`memo`).** Reconstruir do IndexedDB um handle OPFS cuja pasta foi apagada **derruba o Chromium** (reproduzido). Na memória, o mesmo handle dá NotFoundError e volta a funcionar.
- Configurações novas: `autoRun` (true), `autoDeep` (true), `autoOrganize` (false), `autoCriterion` ('categoria'), `autoTrashDupes` (false). As ações que mexem em arquivos pedem confirmação ao serem ligadas.
- `src/features/auto/AutoPage.tsx` + `auto.css`: estado com ilustração animada do pendrive, etapas, resultado (KPIs + barras com alternância Espaço/Quantidade), ajustes e "Onde funciona".
- `Header.tsx`: chip do estado do pendrive (link para /automatico), atalhos com ícones, botão "Menu" (antes "Índice"), menu agrupado. Tab bar: Início, Automático, Arquivos, Relatórios, Segurança.
- e2e 26: pendrive simulado em OPFS. 1ª execução com um toque; "remover" (apagar a pasta) → "Aguardando"; ligar lixeira e organizar; "encaixar" (recriar) → roda sozinho, sem toques, e confere a árvore no disco.

## 6a. IA online grátis (03/11 à noite)

Pedido do usuário: "quero que funcione como uma IA completa e lance um HTTPS... pronto para abrir no Google".

- `src/features/assistant/online.ts`: `runOnline(history, texto, ctx, cb)` faz `POST https://text.pollinations.ai/openai` (model `openai` = **gpt-oss-20b**, aberto), `stream: true`, `tools` no formato OpenAI (as 15 ferramentas), laço de até 8 rodadas. O `readSSE` junta linhas partidas e ignora os deltas `reasoning`.
- Erros tipados (`OnlineError`):
  - 429/503: espera `Retry-After` (até 20 s) e tenta 2 vezes;
  - 402/429 persistente: `limite`;
  - 403: `servico`;
  - rede: `rede`.
  - Se a rodada falhar, o histórico volta ao estado anterior.
- **Testado de verdade (curl):** sem chave, CORS `*`, com tool calls em streaming. **Origem `localhost` recebe 403 "Missing Turnstile token"; origem `https://enriszx.github.io` funciona.** Logo, só funciona no site publicado. Pendrive, `serve:local` e APK (origem `https://localhost`) caem no plano B. Ideia ainda não testada para o APK: `server.hostname` no Capacitor.
- `gen.pollinations.ai/v1` exige chave; não usar.
- `prompt.ts`: `onlinePrompt()` (IA completa, de uso geral, com a data de hoje) e `DEVICE_RULES` (só para a IA do aparelho).
- `Settings.aiOnline` (padrão `false`): o usuário liga com um toque ("Ativar IA online grátis") porque os dados saem do aparelho.
- Ordem dos motores: `online` (ligado e com internet) → `aparelho` → `local`. Se o online falhar, o plano B é o aparelho ou os comandos (`runLocal` strict), com aviso em `.ai-note`.
- `Markdown.tsx`: formatador seguro (sem HTML cru; links só http/https). Botão copiar. A conversa fica em `localStorage['usbi.vigia.conversa']`.
- Testes: `tests/online.test.ts` (8; inclui nova tentativa quando a conexão cai ou a resposta vem vazia), `tests/markdown.test.tsx` (3) e o e2e 25 (serviço simulado com `c.route`).

## 6. Vigia IA: IA no aparelho

**Motor:** [WebLLM](https://github.com/mlc-ai/web-llm) (`@mlc-ai/web-llm@0.2.86`, Apache 2.0) roda o modelo **Qwen2.5** (Apache 2.0) no navegador pela **WebGPU**. Não há servidor, conta, chave nem custo. Os pesos vêm do Hugging Face (`huggingface.co/mlc-ai/...`), e o WebLLM os guarda no Cache API (não nos caches `usbi-*` do service worker). A biblioteca de wasm vem do GitHub (`raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs`).

Arquivos em `src/features/assistant/`:

- `webllm.ts`:
  - `LOCAL_MODELS`: Leve (Qwen2.5 0,5B, ~945 MB de VRAM), Equilibrado (1,5B, ~1630 MB, padrão) e Mais esperto (3B, ~2505 MB). Todos `q4f16_1-MLC`, contexto de 4096 tokens. Os números vêm do `prebuiltAppConfig` da biblioteca.
  - `checkGpu()` devolve `ok | sem-webgpu | sem-placa`, e `GPU_MESSAGE` explica cada caso.
  - `hasF16()`: sem o recurso `shader-f16` da placa (comum em celulares e no SwiftShader), `loadModel` usa sozinho a variante `q4f32_1` do mesmo modelo. `aiModel` e `aiInstalled` guardam sempre o id `q4f16_1`, e `deleteModel` apaga as duas variantes. Sem isso, a carga falha com erro de WebGPU, como aconteceu no primeiro teste real.
  - `loadModel(id)`: cria o worker `llm.worker.ts` e chama `CreateWebWorkerMLCEngine`. O progresso é publicado em `onLoadState`/`getLoadState` (`parado | carregando | pronta | erro`), e os erros são traduzidos por `explain()`. Chamadas repetidas reaproveitam o mesmo carregamento.
  - `deleteModel(id)` usa `deleteModelAllInfoInCache`.
  - `completeJSON(id, msgs, schema, signal)`: `chat.completions.create` com `response_format: {type:'json_object', schema}` (geração restrita por gramática), `temperature 0.2`, `max_tokens 500`. O botão parar chama `interruptGenerate()`.
- `llm.worker.ts`: `WebWorkerMLCEngineHandler`. A IA roda fora da thread da tela.
- `engines.ts`:
  - `EngineKind = 'aparelho' | 'local'`.
  - `runDevice(model, history, texto, ctx, cb)`:
    1. Tenta `runLocal(..., strict=true)`. Comando direto reconhecido é executado na hora, sem o modelo (rápido e exato).
    2. Senão, faz um laço de até 4 passos. O modelo responde `{"acao":"ferramenta","ferramenta","argumentos"}` ou `{"acao":"responder","texto"}`. A ferramenta roda (resultado cortado em 1500 caracteres) e volta como mensagem de usuário `Resultado de X: ...`.
    3. Se não sair resposta, cai no `runLocal` normal.
  - O histórico guarda só a pergunta e a resposta final; vão as 8 últimas mensagens.
  - `DEVICE_PROMPT` = `SYSTEM_PROMPT` + `toolCatalog()` (uma linha por ferramenta, com os argumentos) + o formato. O teste garante menos de 9000 caracteres.
  - `parseDecision()` tolera texto em volta do JSON. Ferramenta inexistente não executa nada.
- `local.ts`: `runLocal(texto, ctx, onTool, strict?)`. Com `strict`, devolve `null` quando não entende.
- `tools.ts`: inalterado. São 15 ferramentas: `resumo_biblioteca, listar_arquivos, duplicados, analisar, abrir_area, plano_organizacao, aplicar_organizacao, renomear, mover, enviar_para_lixeira, tirar_da_lista, exportar, mudar_tema, personagem, historico`. As que mexem em arquivos exigem pasta conectada e `ctx.confirm`.
- `Assistant.tsx`:
  - O motor é `aparelho` quando `gpu === 'ok' && settings.aiInstalled === modelo`.
  - Sem isso, o painel mostra o cartão "Ative a IA grátis", com barra de progresso, ou a mensagem de falta de WebGPU, e segue com comandos.
  - Enquanto o modelo carrega, a mensagem mostra "Carregando a IA… N%".
  - O contexto das ferramentas usa getters (`live()`), para nunca ler arquivos desatualizados.
- `src/features/settings/AssistantSettings.tsx`: seção `#assistente` com o select `#ai-model`, a memória de vídeo, o estado da WebGPU, "Baixar e ativar a IA", progresso, "Apagar do aparelho" e o aviso de que uma IA pequena erra mais.
- **Service worker:** o plugin (`scripts/vite-plugin-sw.ts`) **não pré-cacheia arquivos acima de 3 MB**. São os dois pedaços de cerca de 6 MB do WebLLM (o do worker e o do lado da página). Eles entram no cache no primeiro uso, pelo fetch cache-first, e então a IA funciona offline.

**Testes:**
- `tests/assistant.test.ts` (16): mocka `completeJSON` e cobre catálogo, `parseDecision`, caminho rápido sem o modelo, ferramenta real seguida de resposta, ferramenta inventada e erro de carga.
- e2e 23: modo de comandos.
- e2e 24: três modelos, sem campo de chave, estado da WebGPU explicado, nenhuma menção a Claude, modelo escolhido persiste, nenhuma requisição para anthropic/claude.
- **Teste real no container (03/11):**
  - Com `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader`, o Chromium ganha WebGPU por software (sem `shader-f16`).
  - O Playwright precisa de `proxy: {server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1'}` e `ignoreHTTPSErrors: true`. Sem o `bypass`, até o localhost passa pelo proxy e dá 405.
  - Verificado de verdade: download do Qwen2.5 0,5B q4f32 (~260 MB em ~7 s), carga, "IA ativa", motor "IA no aparelho · grátis" e caminho rápido com dados reais.
  - **Não deu para verificar a qualidade das respostas:** o SwiftShader faz 0,4 token/s e gera lixo até num exemplo mínimo do WebLLM sem o nosso código. Isso exige um aparelho com placa de vídeo real. Peça ao usuário para testar no celular e no PC.
- Atenção a um detalhe de teste: a interface mostra rótulos em maiúsculas por CSS, e o `innerText` devolve maiúsculas. Use regex com `/i`.

**Limites honestos:** modelos de 0,5–3B erram mais que IAs grandes, e o primeiro download é grande (centenas de MB a ~2 GB). Precisa de WebGPU: Chrome/Edge atuais, Chrome no Android em aparelhos compatíveis, Safari 26+. Firefox no Android não funciona.

**Ideias seguintes, se o usuário pedir:**
- respostas em streaming (hoje a resposta é JSON completo);
- usar a IA embutida do Chrome (Prompt API / Gemini Nano) quando existir, sem download;
- histórico de conversas salvo.

## 7. Republicar o Artifact (mesmo link)

```bash
VITE_TARGET=artifact npx vite build --outDir dist-artifact --emptyOutDir
python3 - <<'PYEOF'
import re, os, json, glob
src=open('dist-artifact/index.html').read()
head=re.search(r'<head>(.*)</head>', src, re.S).group(1)
body=re.search(r'<body>(.*)</body>', src, re.S).group(1)
for pat in [r'\s*<meta charset[^>]*>', r'\s*<meta name="viewport"[^>]*>', r'\s*<link rel="manifest"[^>]*>', r'\s*<title>.*?</title>']:
    head=re.sub(pat,'',head)
open('dist-artifact/artifact.html','w').write('<title>USB Intelligence</title>\n'+head.strip()+'\n'+body.strip()+'\n')
# Se algum pacote tiver U+FFFD literal, o publicador recusa. Trocar pelo escape equivalente:
for f in glob.glob('dist-artifact/assets/*.js'):
    s=open(f,encoding='utf8').read()
    if '�' in s: open(f,'w',encoding='utf8').write(s.replace('�','\\uFFFD'))
files={}
for root,_,fs in os.walk('dist-artifact'):
    for f in fs:
        full=os.path.join(root,f); rel=os.path.relpath(full,'dist-artifact')
        if rel in ('index.html','artifact.html','sw.js','offline-manifest.json','manifest.webmanifest'): continue
        files[rel]=full
print(json.dumps(files))
PYEOF
```

Depois publique com a ferramenta Artifact:
- `file_path: dist-artifact/artifact.html`
- `url: https://claude.ai/artifact/2sEcU5zeBd4jDTUN19HXXS`
- `files`: o JSON impresso acima

Não passe `capabilities`: elas foram limpas com `{}`, e omitir mantém assim. Em outra conversa, faça antes um `action: "read"` do link. Os pedaços do WebLLM têm cerca de 6 MB cada, abaixo do limite de 16 MB por arquivo. Rode o build Artifact sem `.env.local` se a prévia não deve ter senha (o Vite lê `.env.local` sozinho).

## 8. Armadilhas já conhecidas (não repetir)

- **Nunca** use `open(p,'w').write(open(p).read())` em Python: o arquivo é truncado antes da leitura e fica vazio. Isso já apagou o `scripts/e2e.mjs` uma vez; foi restaurado com `git checkout`. Leia para uma variável, depois grave.
- Nas edições por script, confira se o trecho existe (`assert a in s`) antes de substituir.
- Ao rodar e2e em segundo plano, use um arquivo de saída novo e espere `exit=`.
- R3F no e2e: evitar `connect null` (o `Stage` usa `safeEvents`).
- O Playwright em `request.headers()` não traz todos os cabeçalhos. Use `allHeaders()`.
- O `sed -i` com `?`, `[` ou `'` quebra fácil; prefira Python com `assert`.
- Ações bloqueadas pelo sistema de permissões nesta sessão, que **não devem ser contornadas**:
  - espelho para `dl.google.com` (Android SDK);
  - `git push` do `dd75b2f` (motivo: hash da senha em repositório público);
  - `git commit --amend --reset-author`.
- Toda alegação na interface precisa ser verdadeira: sem botão falso, sem número inventado. O e2e 16 verifica `href="#"` e botões sem nome.
- **Nunca** releia do IndexedDB, em laço, o handle de uma pasta que pode ter sumido (derruba o Chromium). Use o `memo` do `folder.tsx`.
- `img, svg { max-width: 100% }` (base.css) corta camadas maiores que a tela: o fundo usa `max-width: none`.
- Classes globais novas não podem repetir nomes que já existem em CSS de página carregado sob demanda (caso `.kpi`).
- `pkill -f <padrão>` dentro de um comando Bash mata o próprio shell, se o padrão aparecer no comando. Mate por PID.

## 9. Pendências (por prioridade)

1. **GitHub: feito (03/11).** O commit `b60a445` foi enviado ao `main`: os commits locais antigos, que tinham a senha, viraram um único commit limpo. O GitHub Actions passou nos dois jobs (`apk` e `pages`). **Site público no ar:** https://enriszx.github.io/escreva-usb-intelligence/ (sem tela de senha até o segredo do item 2 existir). O APK fica em *Actions → execução → Artifacts → usb-intelligence-apk*.
2. **Senha no site público.** Para o GitHub Pages e o APK terem a tela de senha, o usuário precisa criar o segredo `USBI_PASS_HASH` em *Settings → Secrets and variables → Actions* com o SHA-256 de `usbi|<senha>`. O workflow já lê esse segredo. Sem ele, o site abre direto. Nunca peça a senha no chat; dê o comando para ele gerar o hash (README, seção "Acesso por senha").
3. **GitHub Pages:** já ativo e funcionando. O workflow publica a cada push no `main`.
4. **Autor dos commits.** Os commits já no GitHub (e41a6fc, b0ba737, 4cf4404) têm autor `enriquenormando014@gmail.com`; o hook da sessão reclama disso. Reescrevê-los exigiria push forçado, e a ação foi negada antes. Só com pedido explícito do usuário.
5. **"A senha não está indo".** Nunca foi esclarecido. Agora a senha tolera espaço e maiúsculas/minúsculas. Se ele voltar a reclamar, pergunte onde (site do GitHub sem o segredo não tem senha; prévia do claude.ai; APK) e verifique o cache do service worker.
6. **IA no celular.** Testar num Android real com Chrome. A WebGPU no Android depende do aparelho. Se ficar lento, recomende o modelo Leve.
7. **APK.** Sai pelo GitHub Actions (artifact `usb-intelligence-apk`) depois do push. No container não há Android SDK. Atenção: a WebView do Android pode não ter WebGPU; nesse caso o app mostra a explicação e usa comandos.
8. **Firebase** (opcional): `firebase.json` e `scripts/deploy-firebase.sh` estão prontos; faltam credenciais (segredos do ambiente). Nunca peça no chat.

## 10. Convenções

- Commits em português, terminando com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <link da sessão atual>
  ```
- Não colocar identificador de modelo em commit, PR ou código, exceto o valor de configuração `aiModel` e a lista `MODELS`, que são funcionais.
- Não criar PR sem pedido.
- Textos de interface: diretos, em segunda pessoa ("você"), honestos sobre limites do navegador.
- Acessibilidade: toda ação com nome acessível, foco visível, `aria-live` para anúncios (`features/files/announce.ts`), sem rolagem horizontal em 360 px (e2e 15).

## 11. Checklist ao assumir

1. `npm ci && npm test` deve dar 74 aprovados.
2. `npm run build && npm run e2e` deve dar 24/24, com o teste 18 (senha) pulado. Com senha: build com `VITE_PASS_HASH` (o `.env.local` só existe neste container; peça ao usuário para recriar se precisar) e `E2E_SENHA=<senha> npm run e2e` dá 25/25.
3. Ler a seção 9 e perguntar ao usuário só o que estiver bloqueado (envio ao GitHub e a senha).
4. Depois de qualquer mudança visível: rodar os testes, olhar capturas em desktop e celular, republicar o Artifact (seção 7), `npm run package:usb`, commit e, se liberado, push.
