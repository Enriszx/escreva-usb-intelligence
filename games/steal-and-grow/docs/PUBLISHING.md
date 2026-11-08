# Lançamento — passo a passo

Leitura honesta primeiro: **o que é automatizável e o que não é.**

| Etapa | Automatizável? | Como |
|---|---|---|
| Construir o arquivo `.rbxl` | ✅ sim | `scripts/build.sh` |
| Publicar/atualizar o place | ✅ sim | `scripts/publish.sh` (Assets API) |
| Atualizar a cada push | ✅ sim | `.github/workflows/roblox-deploy.yml` |
| **Criar a experiência** | ❌ não | Open Cloud não cria experiências |
| **Criar gamepasses/produtos** | ❌ não | não existe endpoint público |
| Ligar os IDs no código | ✅ sim | `scripts/set-ids.py` |

As duas linhas vermelhas são limitações da plataforma, não do projeto.
São dois passos manuais, uma única vez.

---

## 1. Criar a experiência (~2 min, manual)

Caminho mais curto: abra o `.rbxl` gerado (`build/StealAndGrow.rbxl`) direto no
Roblox Studio, pressione **F5** para testar, e use **File ▸ Publish to Roblox**.
Isso já põe o jogo no ar, sem API nenhuma.

Depois anote o **Place ID**: no Creator Dashboard, clique na experiência →
aba **Places** → clique no place. O ID está na URL:

```
create.roblox.com/dashboard/creations/experiences/0000000/places/111111/configure
                                                                      ^^^^^^
                                                                      Place ID
```

> **Desligue o Team Create** nesse place. Com ele ligado a API devolve `403`.

**Você não precisa do Universe ID.** A Assets API endereça o place diretamente,
e o asset id de um place *é* o Place ID dele.

## 2. Criar a chave de API (~3 min, manual)

**Creator Dashboard → aba API Keys:**
[create.roblox.com/dashboard/credentials?activeTab=ApiKeysTab](https://create.roblox.com/dashboard/credentials?activeTab=ApiKeysTab)
→ botão **Create API Key**.

Preencha exatamente assim:

| Campo na tela | O que colocar |
|---|---|
| **Name** | `STEAL_AND_GROW_DEPLOY` |
| **Access Permissions** → *Select API System* | **`assets`** |
| **Restrict by Experience** | deixe **ligado** e selecione a sua experiência |
| *Select Operations* | marque **`Read`** e **`Write`** (as duas) |
| **Security** → *Restrict IP addresses* | deixe **desligado** |
| Expiração | opcional — ver a nota abaixo |
| | botão **Save & Generate key** |

A chave aparece **uma única vez**. Copie na hora.

**Por que `assets` e não "Place Publishing":** o guia oficial de place
publishing instrui a adicionar `assets` em *Access Permissions* com as
operações *Read* e *Write*. O endpoint de publicação hoje é a Assets API; o
antigo `universes/v1/.../places/.../versions` é legado.

**Por que o IP desligado:** o campo é opcional, e a própria documentação avisa
para **não** usar restrição de IP quando a chave é usada em places da Roblox.
Runners do GitHub Actions também têm IP dinâmico, então não há faixa fixa para
travar. Se quiser restringir de verdade, a única via é um runner self-hosted
com IP fixo.

**Expiração:** se marcar uma data, o deploy automático para de funcionar
naquele dia e o workflow falha com `401`. Independente disso, **uma chave sem
uso por 60 dias auto-expira** — então uma chave de deploy que fica meses
parada morre sozinha.

**Experiência de grupo:** para criar chave de uma experiência de grupo você
precisa ser dono do grupo ou ter um cargo com a permissão de administrar
chaves de API.

## 3. Publicar pela linha de comando

```bash
cd games/steal-and-grow
export ROBLOX_API_KEY="sua-chave"
export ROBLOX_PLACE_ID="111111"

./scripts/publish.sh --saved   # sobe SEM publicar — use para testar a chave
./scripts/publish.sh           # publica de verdade
```

A chamada é **assíncrona**: o `PATCH` devolve um id de operação e o script
fica consultando `assets/v1/operations/{id}` até terminar. Um `200` no upload
sozinho não significa que publicou — é por isso que o script espera.

## 4. Criar os passes e produtos (~6 min, manual)

Na experiência → **Monetization ▸ Passes ▸ Create a Pass**. Crie os 13 abaixo
com esses nomes e preços (as descrições estão em
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
`src/shared/Config/Products.luau`.

> Comece pelos 5 que respondem pela maior parte da receita:
> `starterPack` (199), `ultimate` (1999), `vip` (399), `coinsL` (799),
> `boostLuck` (249). O jogo esconde sozinho qualquer item com `id = 0` e avisa
> o jogador em vez de falhar, então os outros podem vir depois.

## 5. Ligar os IDs e republicar

```bash
python3 scripts/set-ids.py pass vip=1111 ultimate=2222 autoHarvest=3333 ...
python3 scripts/set-ids.py product starterPack=4444 coinsL=5555 ...
python3 scripts/set-ids.py --check     # confirma que não sobrou nada em 0
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
- **Título/Descrição**: use palavras que as pessoas buscam —
  `Steal`, `Grow`, `Garden`, `Mutation`, `Tycoon`, `Simulator`
- Ative **Analytics** (o jogo já envia funil, economia e eventos customizados
  via `AnalyticsService` — ver `Services/Analytics.luau`)

Preencha seu `UserId` em `Config.Balance.admins` para ter o console (`F2`) em
produção.

## 7. Deploy contínuo

No GitHub: **Settings ▸ Secrets and variables ▸ Actions** → adicione
`ROBLOX_API_KEY` e `ROBLOX_PLACE_ID`.

A partir daí, todo push em `main` que toque `games/steal-and-grow/src/**`
constrói e publica sozinho. O `workflow_dispatch` tem a opção `publish: false`
para subir sem ir ao ar.

---

## Resolução de problemas

| Sintoma | Causa | Correção |
|---|---|---|
| `401 Unauthorized` | falta `assets`, falta operação `Read` ou `Write`, experiência não marcada, chave expirada (inclusive por 60 dias sem uso), ou restrição de IP ativa | recrie a chave conforme o §2 |
| `403` | Team Create ligado no place | desligue |
| `400` | Place ID inválido ou arquivo não é um place | confira o ID |
| `404` | Place ID não existe | confira o ID |
| Upload aceita mas nada muda | `published` ficou `false` | rode sem `--saved` |
| Operação nunca termina | processamento travado do lado da Roblox | confira o histórico de versões do place |
| Compras não abrem | `id = 0`, ou *third-party sales* desligado | `set-ids.py` + Settings |
| Instâncias não atualizam | a Assets API não atualiza `EditableImage`, `EditableMesh`, `PartOperation`, `SurfaceAppearance` nem `BaseWrap` | publique essas do Studio |
| Jogador cai com "outro servidor está salvando" | session lock funcionando | esperar ~30s; nada é perdido |

Fontes: [Manage API keys](https://create.roblox.com/docs/cloud/auth/api-keys) ·
[Usage guide for place publishing](https://create.roblox.com/docs/cloud/guides/usage-place-publishing)
