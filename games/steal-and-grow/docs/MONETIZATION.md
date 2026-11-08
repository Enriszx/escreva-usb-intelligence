# Monetização

## Princípio

Nada aqui bloqueia progresso. Todo item é **multiplicador** ou
**conveniência**. O jogo é inteiro e vencível de graça — essa é a condição para
que ele cresça, e crescimento é o que gera receita no Roblox.

## Estrutura de preços

Três faixas, desenhadas para funcionarem juntas:

| Faixa | Robux | Função |
|---|---|---|
| Impulso | 99–249 | compra por reflexo, sem pensar |
| Núcleo | 299–499 | onde está a maior parte da receita |
| Âncora | 1999 | existe principalmente para fazer a faixa núcleo parecer barata |

O **PACOTE SUPREMO** (1999) entrega tudo de todos os passes, somado e
amplificado. Ele converte pouco em volume e muito em valor, e seu trabalho
principal é contexto de preço: depois de ver 1999, um passe de 399 lê como
barato. Isso é ancoragem, não engano — o pacote realmente vale mais do que a
soma das partes.

## Os 13 passes

Divididos por intenção de compra:

- **Multiplicadores diretos** — VIP (×2 moedas), Crescimento Turbo (×2),
  Mega Sorte (×2,5 sorte). Quem quer números maiores.
- **Conveniência** — Colheita/Plantio/Venda Automática. Quem quer jogar menos
  e progredir igual. Historicamente a categoria com melhor retenção pós-compra.
- **Capacidade** — +6 Canteiros, +2 Slots de Pet, Fazenda Eterna (24h offline).
  Aumentam o teto, não a velocidade.
- **PvP** — Escudo da Fazenda (60% de bloqueio), Mestre Ladrão (roubo 2× mais
  rápido, anonimato). O único par competitivo, e ambos têm contrapartida
  gratuita (cerca elétrica, botas silenciosas, pets de defesa/roubo).

## Os 18 produtos

**Moedas escaladas, não fixas.** Um pacote de "50.000 moedas" é generoso no
minuto 5 e insultante na hora 50. Aqui os pacotes vendem *tempo*: "20 minutos
da sua melhor produção". `MonetizationService:scaledCoins` calcula isso a
partir da melhor semente que o jogador pode comprar, com um piso para que um
jogador novo ainda receba algo que pareça grande. Resultado: o pacote de 99
Robux nunca fica obsoleto e nunca quebra a economia.

**Poções (30 min).** Sinergia desenhada: Poção de Sorte durante Fenda Cósmica
dá ×40 de sorte. Jogadores descobrem isso e passam a esperar o evento com a
poção na mão.

**Bônus do Servidor (399).** Dá ×2 para *todo mundo* e anuncia o nome do
comprador globalmente. Vende status, e todos os outros jogadores veem que
comprar tem efeito visível — a melhor propaganda interna que existe.

**PACOTE INICIANTE (199).** Só na primeira hora, uma vez por conta, com valor
real de ~5× o preço. É o item de maior conversão em simuladores do Roblox, e
também o mais honesto: quem compra fica, porque recebeu muito.

**PACOTE DE VOLTA (499).** Aparece para quem ficou 3+ dias fora. Transforma
reativação em receita em vez de só em visita.

## Integridade técnica

- `ProcessReceipt` é **idempotente por `PurchaseId`** (gravado numa DataStore
  antes de conceder). A Roblox reenvia recibos; um handler não-idempotente é
  exatamente como simuladores acidentalmente entregam 10× o prometido.
- Se o jogador saiu antes da concessão, retorna `NotProcessedYet` — a Roblox
  reentrega no próximo join. Nada se perde.
- Depois de conceder, força um `Store.save` imediato: o Robux já foi, a
  concessão não pode morrer num crash antes do autosave.
- Posse de passe é cacheada por sessão (`UserOwnsGamePassAsync` é lento e tem
  rate limit) e atualizada na hora por
  `PromptGamePassPurchaseFinished` — ninguém precisa reentrar.
- Limites one-time (`oncePerAccount`) e empilháveis (`maxStack`) são checados
  **no servidor**, não só escondidos na UI.

## O que foi deliberadamente evitado

- Loot box paga com moeda de Robux direta (os ovos custam moedas/gemas ganhas).
- Timer que só avança pagando.
- Vantagem de PvP sem contrapartida gratuita.
- Esconder taxa de drop.
- "Energia" ou qualquer limite de sessão.
