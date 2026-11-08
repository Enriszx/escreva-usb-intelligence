# Lançamento — passo a passo

Leitura honesta primeiro: **o que é automatizável e o que não é.**

| Etapa | Automatizável? | Como |
|---|---|---|
| Construir o arquivo `.rbxl` | ✅ sim | `scripts/build.sh` |
| Publicar/atualizar o place | ✅ sim | `scripts/publish.sh` (Open Cloud) |
| Atualizar a cada push | ✅ sim | `.github/workflows/roblox-deploy.yml` |
| **Criar a experiência** | ❌ não | Open Cloud não cria universos |
| **Criar gamepasses/produtos** | ❌ não | não existe endpoint público |
| Ligar os IDs no código | ✅ sim | `scripts/set-ids.py` |

As duas linhas vermelhas são limitações atuais da plataforma, não do projeto:
a API de place publishing publica versões de um place que já existe, e a
criação de experiências por Open Cloud é um pedido aberto no DevForum.
São dois passos manuais, uma única vez, ~10 minutos.

---

## 1. Criar a experiência (~2 min, manual)

1. Abra o Roblox Studio → **New** → *Baseplate* → **File ▸ Publish to Roblox**.
2. Nome: `STEAL & GROW: Império Mutante`. Publique.
3. Em [create.roblox.com](https://create.roblox.com) → **Creations**, abra a
   experiência e anote:
   - **Universe ID** (na URL: `/dashboard/creations/experiences/<UNIVERSE_ID>/...`)
   - **Place ID** (em *Places* → o place inicial → *Configure*)

> **Desligue o Team Create** nesse place. Com Team Create ligado, a API de
> publicação devolve `403 publish not allowed on place`.

## 2. Criar a chave de API (~2 min, manual)

1. [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials)
   → **Create API Key**.
2. Nome: `steal-and-grow-deploy`.
3. **Add API System** → *Place Publishing*.
4. Em *Experiences*, selecione a sua experiência.
5. **Operations**: marque `write` (`universe-places:write`).
6. **Accepted IP Addresses**: `0.0.0.0/0` para começar (restrinja depois).
7. Copie a chave. **Ela só aparece uma vez.**

## 3. Primeira publicação (automática)

```bash
cd games/steal-and-grow
export ROBLOX_API_KEY="sua-chave"
export ROBLOX_UNIVERSE_ID="123456789"
export ROBLOX_PLACE_ID="987654321"

./scripts/publish.sh
```

O jogo já está jogável neste ponto: mundo, fazenda, mutações, roubo, pets,
eventos, rankings. Só a monetização está inativa.

## 4. Criar os passes e produtos (~6 min, manual)

Na experiência → **Monetization ▸ Passes ▸ Create a Pass**. Crie os 13 abaixo
com exatamente esses nomes e preços (as descrições estão em
`src/shared/Config/Passes.luau` — copie e cole):

| key | Nome | Robux |
|---|---|---|
| `ultimate` | ⭐ PACOTE SUPREMO ⭐ | 1999 |
| `vip` | VIP | 399 |
| `autoHarvest` | Colheita Automática | 299 |
| `autoPlant` | Plantio Automático | 349 |
| `extraTiles` | +6 Canteiros | 449 |
| `megaLuck` | Mega Sorte | 499 |
| `fastGrow` | Crescimento Turbo | 399 |
| `shield` | Escudo da Fazenda | 299 |
| `masterThief` | Mestre Ladrão | 449 |
| `petSlots` | +2 Slots de Pet | 349 |
| `autoSell` | Venda Automática | 249 |
| `radar` | Radar de Raridades | 199 |
| `offlineGrowth` | Fazenda Eterna | 399 |

Depois **Monetization ▸ Developer Products** para os 18 produtos de
`src/shared/Config/Products.luau` (mesma ideia).

> Comece pelos 5 que respondem pela maior parte da receita:
> `starterPack` (199), `ultimate` (1999), `vip` (399), `coinsL` (799),
> `boostLuck` (249). Os outros podem vir no dia seguinte — o jogo esconde
> automaticamente qualquer item com `id = 0` e avisa o jogador em vez de falhar.

## 5. Ligar os IDs e republicar (automático)

```bash
python3 scripts/set-ids.py pass \
  ultimate=1111 vip=2222 autoHarvest=3333 autoPlant=4444 extraTiles=5555 \
  megaLuck=6666 fastGrow=7777 shield=8888 masterThief=9999 petSlots=1010 \
  autoSell=1111 radar=1212 offlineGrowth=1313

python3 scripts/set-ids.py product \
  starterPack=2001 coinsS=2002 coinsM=2003 coinsL=2004 coinsXL=2005 \
  gemsS=2006 gemsM=2007 gemsL=2008 boostCoins=2009 boostLuck=2010 \
  boostGrow=2011 boostServer=2012 instantGrow=2013 shopReroll=2014 \
  extraPlot=2015 revengeSteal=2016 rebirthToken=2017 comebackPack=2018

python3 scripts/set-ids.py --check   # confirma que não sobrou nada em 0
./scripts/publish.sh
```

## 6. Configurar a experiência para crescer

Em **Settings** da experiência:

- **Playability**: Public
- **Devices**: ✅ Computer, ✅ Phone, ✅ Tablet, ✅ Console
- **Genre**: Simulator
- **Max players**: `12` (o jogo tem 12 fazendas — ver `Balance.plotCount`)
- **Allow third-party sales**: On (necessário para os prompts de compra)
- **Age**: 9+ (o roubo é PvP leve, sem violência)
- **Title/Descrição**: use palavras que as pessoas realmente buscam —
  `Steal`, `Grow`, `Garden`, `Mutation`, `Tycoon`, `Simulator`
- **Avatar**: Player Choice
- Ative **Analytics** (o jogo já envia funil, economia e eventos customizados
  via `AnalyticsService` — ver `Services/Analytics.luau`)

Preencha seu `UserId` em `Config.Balance.admins` para ter o console (`F2`) em
produção.

## 7. Deploy contínuo (automático)

No GitHub: **Settings ▸ Secrets and variables ▸ Actions** → adicione
`ROBLOX_API_KEY`, `ROBLOX_UNIVERSE_ID`, `ROBLOX_PLACE_ID`.

A partir daí, todo push em `main` que toque `games/steal-and-grow/src/**`
constrói e publica sozinho. `workflow_dispatch` permite publicar como `Saved`
(rascunho) para testar antes de ir ao ar.

---

## Resolução de problemas

| Sintoma | Causa | Correção |
|---|---|---|
| `401 Unauthorized` | escopo errado, universo não selecionado na chave, ou IP bloqueado | recrie a chave com `universe-places:write` e `0.0.0.0/0` |
| `403 publish not allowed` | Team Create ligado | desligue no place |
| `400` | place não pertence ao universo informado | confira os dois IDs |
| Publica mas não cria versão | o arquivo é idêntico ao anterior | faça uma mudança real |
| Compras não abrem | `id = 0`, ou *third-party sales* desligado | `set-ids.py` + Settings |
| Jogador cai com "outro servidor está salvando" | session lock funcionando como esperado | esperar ~30s; nada é perdido |
