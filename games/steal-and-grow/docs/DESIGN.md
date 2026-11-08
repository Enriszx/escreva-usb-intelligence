# Design

## Por que este gênero

A pesquisa de mercado (nov/2026) aponta uma direção só: **simulador/tycoon com
mecânica de roubo**. Grow a Garden (22,3M CCU em ago/2025, 1 bilhão de visitas
em 33 dias), Steal a Brainrot (25,8M CCU, recorde absoluto), Steal An Egg
(~1,36M de média em out/2026). Os guias de receita convergem em simuladores
como o gênero mais consistentemente lucrativo, e em "steal-and-defend" como o
híbrido que cresce mais rápido.

Os três motivos pelos quais essa fórmula funciona, e que este jogo copia de
propósito:

1. **Progresso sem habilidade.** Qualquer pessoa consegue plantar. Nenhum
   jogador é eliminado por ser ruim de mira ou de parkour.
2. **Jackpot visível.** A mutação é um evento público, com cor, som e anúncio
   no chat. Jogadores tiram print e mandam para amigos — é a aquisição mais
   barata que existe.
3. **Conflito social com consequência leve.** Roubar gera história ("o cara
   levou minha Melancia Celestial"), mas ninguém perde horas de progresso.

## O que foi feito diferente

Copiar a fórmula não basta. Estes são os pontos em que o projeto tenta ser
melhor que a média do gênero:

**Mutações em dois slots.** A maioria dos jogos sorteia uma mutação. Aqui são
duas independentes (Elemento × Aura), que multiplicam entre si. "Congelada
Arco-Íris" (×180) é uma combinação que o jogador descobre, não só recebe. O
espaço de combinações é 11×9 = 99, com um teto de ×2500.

**Roubo com tempo proporcional ao prêmio.** O tempo de canalização cresce com
a raridade *e* com o multiplicador de mutação da planta. A planta mais valiosa
é exatamente a mais difícil de levar embora — então roubar é uma decisão, não
um clique.

**Sair do servidor não protege nada.** A fazenda fica "em espera" por 120s
depois que o dono sai, e continua roubável (com 50% de penalidade, para que
farmar jogadores AFK não seja ótimo). Isso remove a estratégia degenerada de
desconectar para salvar a colheita.

**Decaimento da planta madura.** Depois de 1h pronta, a planta perde valor
(piso de 35%). Isso cria o verdadeiro dilema do gênero: deixar crescendo é
seguro mas improdutivo; deixar madura é valioso mas exposto. E dá valor real ao
passe de Colheita Automática sem que ele seja obrigatório.

**Proteção de novato.** 120s de imunidade. Perder a primeira colheita para um
jogador de rebirth 15 é a maneira mais rápida de perder um jogador novo.

**Odds honestas na tela.** A tela de ovos mostra a chance real do melhor pet
("1 em 500"). Jogos que escondem a taxa de drop ganham a primeira compra e
perdem a quinta.

## Economia

Curva base: custo ×2,8 por semente, valor ×2,9, tempo de crescimento ×1,28.
O efeito é que cada tier roughly dobra moedas/segundo, então subir de tier
sempre *parece* grande, e a planta de tier 9 (`devfruit`, 25T de base) continua
na mesma escala matemática da cenoura (26).

Multiplicadores se combinam assim:

```
valor = base × mutação × tamanho × decaimento × multiplicadorDeMoedas
multiplicadorDeMoedas = (1 + rebirths×0,3 + upgrades) × passes × poções × evento
```

Rebirth é **aditivo** (+30% cada) de propósito: os primeiros rebirths precisam
valer a pena, e um multiplicador exponencial tornaria o rebirth 20 absurdo.
Passes e poções são **multiplicativos**, para que o dinheiro gasto sempre
sinta diferença, inclusive no late game.

Custo de rebirth: `250.000 × 2,2^n`, com endgame declarado em **rebirth 30**.
A taxa de crescimento não é livre: moedas são travadas em `9e15` (2^53, o
último inteiro exato em double), então a escada inteira tem que caber embaixo
disso. `250.000 × 2,2^29 = 2,1e15` deixa o último rebirth com folga. Uma
curva mais agressiva (×7,5, que foi a primeira tentativa) tornava literalmente
inalcançável tudo acima do rebirth 12 — incluindo metade dos ranks e as duas
sementes secretas. Depois do rebirth 30 o conteúdo infinito é o índice de
coleção, pets 5⭐ e os rankings globais.

Lucro base por ciclo: ~2,6× no tier 1, caindo para ~1,8× nos tiers altos. A
margem fina no fim é intencional: lá o valor vem das mutações, não da planta.

Teto de sorte em 500. Sem teto, uma poção de sorte ×5 empilhada com Mega Sorte
e Fenda Cósmica garantiria Omega, e o item mais raro do jogo deixaria de
existir.

## Retenção

| Camada | Mecanismo | Volta em |
|---|---|---|
| Minuto | planta pronta, mutação rolada | segundos |
| Sessão | tier novo de semente, ovo chocando | minutos |
| Dia | missões diárias, login de 7 dias, estoque da loja | 24h |
| Semana | missão semanal, rebirth, rank novo | dias |
| Infinito | índice de coleção, pets 5⭐, rankings globais | sempre |

Eventos globais a cada 15 min existem para dar um motivo de **não** sair agora.
A mudança de iluminação (Lua de Sangue deixa o mundo vermelho) é o que torna o
evento perceptível sem ler texto.

## Anti-golpe na troca

Uma regra resolve 90% dos golpes: **qualquer mudança em qualquer oferta zera as
duas confirmações.** A UI diz isso em voz alta. O servidor revalida posse de
cada item no instante da execução, e pets equipados não podem ser oferecidos.
