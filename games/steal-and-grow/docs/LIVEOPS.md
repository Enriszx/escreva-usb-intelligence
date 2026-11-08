# Operação pós-lançamento

## Primeiras 48h

1. **Observe o log do servidor.** `Services/Analytics.luau` imprime a cada 5
   min: `players, joins, new, harvests, steals, rebirths, purchases, robux`.
   É o jeito mais rápido de ler um lançamento sem dashboard.
2. **Funil de onboarding** (no painel de Analytics da Roblox): passos 1 (join),
   3 (primeira colheita), 6 (primeiro rebirth). Se a queda entre 1 e 3 passar de
   ~40%, o problema é o tutorial ou o tempo da primeira planta — baixe
   `Seeds.carrot.growTime` (hoje 30s).
3. **Conversão.** Se o PACOTE INICIANTE converte abaixo de ~2%, o problema
   normalmente é visibilidade, não preço.

## Console de admin (F2)

Requer estar em `Config.Balance.admins`, ser o dono, ou rank 200+ no grupo.

```
help                      lista tudo
coins <jogador> <qtd>     compensar um jogador
gems <jogador> <qtd>
seed <jogador> <id> <n>   entregar sementes
egg <jogador> <id>
pet <jogador> <id> <⭐>
event <chave> [segundos]  forçar um evento (ex: event BloodMoon 1200)
endevent
restock                   renovar a loja agora
rebirth <jogador> <n>
grow <jogador>            maturar tudo na fazenda dele
boost <jogador> <stat> <valor> <seg>
tiles <jogador> <n>
stats <jogador>           ver multiplicadores resolvidos
announce <mensagem>       anúncio global
save <jogador>
reset <jogador>           apaga o perfil (confirme o nome!)
```

Use `event` para YouTubers: uma Lua de Sangue de 20 min durante a gravação
rende muito mais que qualquer código promocional.

## Rebalancear sem reescrever nada

Tudo que é número vive em `src/shared/Config/`. Casos comuns:

| Quero | Mexa em |
|---|---|
| Jogo mais rápido/lento no começo | `Seeds.luau` tiers 1–3 (`cost`, `growTime`, `baseValue`) |
| Mutações mais/menos frequentes | `Mutations.luau` → `weight` e `luckScale` |
| Rebirth mais acessível | `Balance.rebirthBase` / `rebirthGrowth` |
| Roubo mais/menos agressivo | `Balance.stealBaseTime`, `stealCooldown`, `stealValueCut` |
| Eventos mais frequentes | `Events.interval` (hoje 900s) |
| Mais jogadores por servidor | `Balance.plotCount` + o Max Players nas Settings — **os dois juntos** |
| Teto de canteiros | `Balance.maxTiles` (hoje 48) |

Depois: `./scripts/publish.sh` (ou só um push, se o Actions estiver ligado).

## Códigos promocionais

`src/shared/Config/Codes.luau`. Mantenha a lista curta e rotacione: códigos
expirados ensinam o jogador a parar de olhar, e olhar é o que o traz de volta
às suas redes sociais.

## Migração de save

`Data/Template.luau` é o contrato. **Adicionar** um campo é a migração inteira:
`TableUtil.reconcile` preenche o padrão no próximo load de cada perfil.
**Nunca renomeie** um campo — adicione o novo e escreva um passo explícito em
`Store.migrate` (há dois exemplos lá, v1→v2 e v2→v3). Suba `Template.version`.

## Checklist semanal

- [ ] Ler o funil e a conversão
- [ ] Um evento programado anunciado nas redes
- [ ] Rotacionar um código
- [ ] Olhar o ranking de ladrões: se um só jogador domina, revise
      `stealCooldown`
- [ ] Verificar se algum pass/produto está com `id = 0`
      (`python3 scripts/set-ids.py --check`)
- [ ] Conferir warnings de `[AntiCheat]` no log

## Roadmap sugerido

**Semana 2–4:** biomas (deserto/gelo/vulcão) usando o mesmo `Build.luau` com
outra paleta; sementes exclusivas por bioma. É a expansão mais barata que
existe neste código.

**Mês 2:** guildas/fazendas cooperativas (2–4 jogadores numa ilha maior),
reaproveitando `PlotService` com um `owner` plural.

**Mês 3:** eventos sazonais com moeda temporária e loja própria — o padrão que
mantém os líderes do gênero no topo.
