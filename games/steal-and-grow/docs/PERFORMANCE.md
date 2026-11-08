# Performance em celular fraco

O pedido era "bonito e rodando em celular fraco". Isso só é compatível se as
coisas caras forem as primeiras a cair e as coisas baratas carregarem a direção
de arte.

## O que carrega a beleza (nunca é desligado)

- Paleta saturada e silhuetas legíveis
- `ColorCorrectionEffect` (saturação +0,14, contraste +0,08) — o efeito de
  maior impacto visual por frame gasto, e o único post-process que sobrevive
  no tier mais baixo
- Gradientes de UI, cantos arredondados, tipografia Gotham Black
- Névoa colorida como máscara de distância (esconde o pop-in do streaming e
  ao mesmo tempo dá profundidade atmosférica de graça)
- Iluminação por evento: Lua de Sangue deixa o mundo inteiro vermelho. Custa
  um tween de 5 propriedades.

## O que cai primeiro

| Tier | Gate de FPS | Detalhe/planta | Partículas | Sombras | Post-FX | Plantas visíveis | Distância |
|---|---|---|---|---|---|---|---|
| Potato | 0 | 1 | ✗ | ✗ | ✗ | 90 | 180 |
| Low | 24 | 1 | ✗ | ✗ | ✗ | 160 | 260 |
| Medium | 38 | 2 | ✓ | ✗ | ✓ | 280 | 360 |
| High | 52 | 3 | ✓ | ✓ | ✓ | 480 | 520 |

Seleção por **percentil 20 do FPS**, não pela média: travada é o que o jogador
sente. Reavaliação a cada 20s, com histerese de +8 FPS para subir de tier, para
que um engasgo não rebaixe o visual permanentemente. Começa no Medium, nunca no
High — é muito melhor promover o jogador para "bonito" do que mostrar 12 FPS
nos primeiros quatro segundos.

Override manual nas Opções, porque algumas pessoas preferem 60 FPS com plantas
chapadas e outras querem o visual completo num aparelho que mal segura 25.

## As cinco decisões que fazem a diferença

**1. Nenhum asset.** Tudo é construído de primitivas em runtime. Zero download,
então o jogo fica jogável ~2s depois do join numa conexão ruim (que é a maioria
do público mobile), e não existe hitch de streaming de `MeshPart` num Android
de 2GB. Como bônus, um reskin sazonal é mudar constantes de cor.

**2. Planta é dado, não `Instance`.** O servidor nunca cria partes de planta e
nunca as replica. Um servidor cheio seriam ~3.000 partes replicadas para cada
cliente; em vez disso são ~576 tabelas pequenas. É a diferença entre 60 e 12
FPS no aparelho de entrada.

**3. LOD de três níveis.** Longe ou em aparelho fraco, uma planta é 1 parte
esférica da cor certa — ainda lê como "planta daquele tipo" a 60 studs. Perto e
em aparelho bom: haste, 3 folhas, N frutos, aura com luz e partículas.

**4. Pooling de tudo.** `Pool` com 900 partes e 180 billboards, pré-aquecido com
220/40 no boot. Andar por 12 fazendas cria e destrói zero `Instance` depois da
primeira passada. Churn de `Instance.new`/`Destroy` na thread de render é a
maior fonte de engasgo do gênero.

**5. Um único driver, com orçamento.** `PlotRenderer` roda a 15 Hz (suficiente
para crescimento visual), ordena as plantas candidatas por distância e atende
só até o orçamento do tier. 500 plantas no mundo custam o mesmo que 90 se o
tier disser 90.

## Rede

O servidor envia deltas minúsculos: `{plotId, tile, plant}`. Crescimento,
contagem regressiva e barra de progresso são **calculados no cliente** a partir
de `plantedAt + duration` — dois números que já estão lá. Nada de replicar
progresso 60 vezes por segundo.

## Servidor

Sem loop por planta. Uma varredura de 1 Hz percorre só os canteiros dos
jogadores presentes, e só para detectar a transição "não-maduro → maduro" (o
momento em que as mutações são roladas). Multiplicadores são colapsados numa
struct com cache de 1,5s, então uma fazenda de 48 canteiros custa uma avaliação,
não 48.

## Toque

- Nenhum `ProximityPrompt`: com 576 canteiros eles custam tempo de frame real
  e não são tematizáveis. Em vez disso, um **botão de ação contextual** no
  rodapé que sempre mostra a melhor ação por perto (resolvido a 6 Hz por
  distância, que é grátis), mais toque direto no canteiro para precisão.
- Todo elemento tocável tem no mínimo 46px (`Theme.minTouch`).
- Painéis são folhas quase-fullscreen no celular e cards centrados no desktop,
  decidido pelo aspecto da viewport (funciona também em tablet e em janela
  redimensionada).
- Um `UIScale` global derivado da altura da viewport: 4K e 720p leem igual.
- Raycast só acontece no input, nunca por frame.
