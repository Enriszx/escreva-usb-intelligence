# STEAL & GROW: Império Mutante

Jogo completo para Roblox, pronto para publicar. Gênero: **simulador/tycoon de
fazenda com PvP de roubo** — a combinação que domina o topo do Roblox em
2025/2026 (Grow a Garden chegou a 22,3M de jogadores simultâneos; Steal a
Brainrot a 25,8M; Steal An Egg liderou setembro/2026 com ~13,8M de pico).

**Status:** código 100% completo (~14.900 linhas de Luau em 70 módulos), sem stubs, sem
dependências externas, sem assets para baixar. Falta apenas a criação da
experiência e dos passes no site da Roblox — as duas únicas coisas que a API
da Roblox não permite automatizar. Depois disso, `scripts/publish.sh` publica
e o GitHub Actions mantém atualizado a cada push.

---

## O loop de jogo

1. **Planta** sementes nos canteiros da sua ilha.
2. Elas **crescem em tempo real** (continuam crescendo offline, até 4h, ou 24h
   com o passe Fazenda Eterna).
3. Ao ficarem prontas, **rolam duas mutações** (Elemento + Aura) — de nada até
   `Ω OMEGA Ω` (×2500). Esse é o momento de jackpot do jogo.
4. **Colhe e vende** no mercado. Compra sementes melhores.
5. **Rouba** plantas prontas de outros jogadores do servidor. A vítima recebe
   um alarme com direção, e pode se defender com cercas, pets e escudo.
6. **Renasce** para multiplicar tudo permanentemente e liberar os tiers altos.

Camadas em volta: 20 pets com fusão por estrelas, 4 tipos de ovo, 8 melhorias
permanentes, missões diárias/semanais, login diário de 7 dias, 6 eventos
globais que mudam a iluminação do mundo inteiro, troca entre jogadores com
proteção anti-golpe, índice de coleção, 3 rankings globais e códigos promo.

## Conteúdo

| | |
|---|---|
| Plantas | 42, em 9 tiers (Cenoura → Ω Semente Omega) |
| Mutações | 20, em 2 slots combináveis (×1 a ×2500) |
| Pets | 20, com 6 níveis de estrela por fusão |
| Raridades | 9 (Comum → SECRETO) |
| Melhorias | 8 linhas, até nível 50 |
| Eventos globais | 6, com iluminação própria |
| Gamepasses | 13 |
| Produtos (consumíveis) | 18 |
| Missões | 8 diárias + 4 semanais |

## Arquitetura

```
src/
├── shared/              ReplicatedStorage.Shared — usado pelos dois lados
│   ├── Config/          todo o conteúdo e balanceamento (15 módulos)
│   ├── Util/            Signal, Net, Format, Pool, Spring, RateLimiter…
│   ├── Economy.luau     ÚNICA fonte de verdade de valor/crescimento/sorte
│   ├── Layout.luau      geometria determinística do mundo
│   └── Types.luau
├── server/
│   ├── Data/            Store (session lock + migração) e Template
│   ├── World/Build      construção procedural do mundo
│   └── Services/        16 serviços (init → start, injeção por nome)
└── client/
    ├── State.luau       espelho único do estado
    ├── Controllers/     8 controladores
    └── UI/              Builder, Components e 12 painéis
```

Três decisões carregam o projeto inteiro:

**1. Planta é dado, não objeto.** Uma planta são cinco números
(`seed, plantedAt, duration, element, aura`). "Está pronta?" é aritmética. Não
existe loop, timer ou `Instance` por planta. Um servidor de 12 jogadores com 48
canteiros cada custa ~576 comparações de inteiros por segundo — constante,
independente de quão rico alguém fique. O cliente desenha a planta localmente
a partir desses dados, então nada de geometria trafega pela rede.

**2. `Economy.luau` é a única autoridade de números.** Cliente e servidor
chamam exatamente as mesmas funções: o preview ("isso vai valer ~4,2M") nunca
pode discordar do pagamento, que é a reclamação nº 1 em jogos do gênero.

**3. O cliente nunca envia valores, só intenções.** Ele diz "plantar semente X
no canteiro Y"; o servidor recalcula tudo. Isso elimina por construção a classe
inteira de exploits de moeda — sobram apenas spam de remote (resolvido pelo
`RateLimiter`) e teleporte (resolvido pelo `AntiCheat`).

## Rodando

```bash
# com rojo instalado (aftman install)
rojo serve                              # conecta no Roblox Studio
./scripts/build.sh                      # gera build/StealAndGrow.rbxl
./scripts/publish.sh                    # publica via Open Cloud
python3 scripts/set-ids.py --check      # o que falta configurar
```

No Studio, `Config.Balance.studioGrantAll = true` libera todos os passes para
teste, e `F2` abre o console de admin (`help` lista os comandos).

## Documentação

- **[docs/PUBLISHING.md](docs/PUBLISHING.md)** — passo a passo do lançamento.
  **Comece aqui.**
- [docs/DESIGN.md](docs/DESIGN.md) — por que cada sistema existe e como está balanceado
- [docs/MONETIZATION.md](docs/MONETIZATION.md) — a lógica de preços e conversão
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — como roda bem em celular fraco
- [docs/LIVEOPS.md](docs/LIVEOPS.md) — operação pós-lançamento

## Fontes da pesquisa de mercado

- [List of Roblox games — Wikipedia](https://en.wikipedia.org/wiki/List_of_Roblox_games)
- [Grow a Garden — Wikipedia](https://en.wikipedia.org/wiki/Grow_a_Garden)
- [Most Played Roblox Games Right Now — livecounts](https://livecounts.nl/roblox-charts/)
- [Most-Played Roblox Games Worldwide — MMO Culture](https://mmoculture.com/featured/most-played-roblox-games-worldwide)
- [Most Profitable Roblox Game Types](https://savingsgrove.com/blogs/guides/most-profitable-roblox-games)
- [Roblox Game Genres — creation.dev](https://www.creation.dev/genres)
- [Usage guide for place publishing — Roblox](https://create.roblox.com/docs/cloud/guides/usage-place-publishing)
