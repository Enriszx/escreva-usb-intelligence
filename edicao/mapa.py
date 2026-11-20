# Mapa da legenda e do motion (etapa 2). Fonte única para a renderização.
# Gera mapa.json (usado pelo render) e mapa.md (para o Enrique aprovar).
import json

# cena: (início, fim, pessoa, cor de destaque, altura da legenda no peito 0-1)
CENAS = [
    (0.00, 4.50, "Fábio (bike)", "#C9D65A", 0.62),
    (4.50, 13.23, "Fábio (deitado)", "#C9D65A", 0.30),
    (13.23, 18.07, "Higor (plano A)", "#4FB3E8", 0.76),
    (18.07, 22.47, "Higor (plano B)", "#4FB3E8", 0.70),
    (22.47, 37.53, "Marielly", "#F2C38B", 0.80),
    (37.53, 45.27, "Gustavo (plano 1)", "#A6E36B", 0.52),
    (45.27, 51.77, "Gustavo (plano 2)", "#A6E36B", 0.52),
    (51.77, 53.60, "Enrique (entra no quadro)", "#F0B45A", 0.70),
    (53.60, 63.53, "Enrique", "#F0B45A", 0.72),
]

# Legenda. tipo: P = pequena (cor da cena), M = média branca, K = destaque grande
# (linha 1 Anton branca + linha 2 Crimson itálica colorida, que entra no tempo t2).
# pos: "peito" (padrão), "esq", "dir", "centro", "topo" (fixa no alto)
# flag "?" = tempo/palavra a confirmar no áudio
L = [
    # Fábio
    ("quantas vezes", 4.82, "M"), ("você", 5.56, "P"), ("plugou um", 5.96, "P"),
    ("pendrive", 6.32, "K"),
    ("e não", 6.76, "M"), ("achou", 6.96, "M"), ("o arquivo", 7.24, "P"), ("que procurava", 7.48, "P"),
    ("hoje", 8.26, "M"), ("apresentamos", 8.58, "P"),
    ("USB|intelligence", 9.30, "K", {"logo": True, "t2": 9.46, "fica_no_topo_ate": 12.9}),
    ("o", 10.24, "P"),
    ("organizador|inteligente", 10.76, "K", {"t2": 11.32}),
    ("de arquivos", 11.88, "P", {"fim": 12.8}),
    # Higor
    ("ele gera", 14.16, "M"),
    ("relatórios", 15.08, "K"),
    ("mantendo", 15.88, "P"), ("tudo organizado", 16.44, "M", {"fim": 17.9}),
    ("o painel", 18.36, "P"), ("mostra", 19.02, "P"),
    ("gráficos", 19.28, "K", {"pos": "esq"}),
    ("e encontra", 19.88, "P"), ("arquivos", 20.14, "P"),
    ("duplicados", 20.66, "K", {"pos": "dir", "fim": 21.9}),
    # Marielly
    ("você importa", 23.10, "M"), ("seus arquivos", 23.96, "P"), ("que ficam", 24.66, "P"),
    ("organizados", 25.14, "P"), ("na", 25.68, "P"),
    ("biblioteca|pesquisável", 25.80, "K", {"t2": 26.98}),
    ("com tags", 27.54, "P", {"fim": 28.3}),
    ("já funciona", 28.38, "M"), ("no celular", 29.44, "P"), ("android", 29.96, "P"),
    ("via", 30.24, "P"), ("adaptador", 30.46, "P"),
    ("OTG", 31.76, "K", {"pos": "dir"}),
    ("e em breve", 32.36, "P"), ("terá a mesma", 33.66, "P"), ("experiência", 34.34, "P"), ("também", 34.72, "P"),
    ("para o", 35.08, "P"),
    ("computador|em breve", 35.36, "K", {"t2": 35.6, "fim": 36.8}),
    # Gustavo
    ("apesar de", 37.96, "M", {"flag": "?"}), ("tudo isso", 39.08, "M"), ("temos", 39.60, "P"),
    ("aplicações", 39.78, "P"), ("que podem", 40.26, "P"), ("funcionar", 40.54, "P"),
    ("sem internet", 40.94, "K", {"fica_no_topo_ate": 44.9}),
    ("com acesso", 41.58, "P"), ("para qualquer", 42.42, "P"), ("usuário", 42.96, "P"),
    ("de pequenas", 43.46, "P"), ("ou grandes", 43.94, "P"), ("empresas", 44.30, "M"),
    ("por exemplo", 44.98, "M"), ("tem", 45.94, "P"),
    ("inteligência|artificial", 46.06, "K", {"t2": 46.40, "pos": "esq"}),
    ("também", 46.66, "P"), ("já é", 47.10, "P"), ("opção", 47.54, "P"), ("de vocês", 47.98, "P"),
    ("é|opcional", 48.44, "K", {"t2": 48.54, "pos": "dir"}),
    ("você quer", 49.08, "M"), ("usar", 49.48, "P"), ("ou não", 49.72, "M", {"fim": 50.7}),
    # Enrique
    ("esse vídeo", 53.04, "M", {"pos": "esq"}), ("também mostra", 53.90, "P"), ("como a", 54.44, "P"),
    ("nossa produção", 54.74, "P"), ("funciona", 55.24, "P"),
    ("roteiro", 55.84, "C"), ("gravação", 56.28, "C"), ("edição", 56.90, "C"), ("e entrega", 57.46, "C", {"fim": 58.1}),
    ("cada etapa", 58.12, "M"), ("foi planejada", 58.92, "P"), ("para explicar", 59.68, "P"),
    ("o produto", 60.22, "P"), ("de uma", 61.10, "P"), ("maneira", 61.42, "P"),
    ("clara|e visual", 61.70, "K", {"t2": 62.20, "fim": 62.75}),
]

# Plaquinha de nome (~2 s, canto inferior esquerdo, Inter)
NOMES = [("Fábio", 5.0), ("Higor", 13.8), ("Marielly", 22.9), ("Gustavo", 37.8), ("Enrique", 53.8)]

# Cards 3D (telas do app, sem números): (card, entra, sai, lado)
CARDS = [
    ("logo", 2.6, 4.5, "centro-topo"),            # empinada
    ("importer", 6.3, 8.2, "esq-topo"),          # "plugou um pendrive"
    ("dashboard", 14.6, 17.9, "esq"),            # "gera relatórios" (abertura estilo ref: 2 cards)
    ("donut", 15.0, 17.9, "dir"),
    ("dashboard", 18.6, 20.4, "dir"),            # "o painel mostra gráficos"
    ("dups", 20.4, 22.3, "esq"),                 # "duplicados"
    ("importer", 23.4, 25.6, "esq"),             # "você importa seus arquivos"
    ("library", 25.8, 28.2, "dir"),              # "biblioteca pesquisável com tags"
    ("library", 33.2, 36.4, "esq"),              # "mesma experiência para computador" (tela de computador)
    ("importer", 39.6, 44.6, "dir"),             # "funcionar sem internet" (selo Offline)
    ("ai", 46.0, 50.4, "dir"),                   # "inteligência artificial ... opcional"
    ("logo", 62.6, 63.53, "centro"),             # encerramento, fundo desfocado
]

# Zoom de câmera: (tempo, nível, tipo) tipo: snap = 1,3 -> nível em 7 quadros; punch = seco em 4 quadros
ZOOM = [
    (0.0, 1.00, "inicio"), (2.8, 1.15, "punch"),
    (4.5, 1.00, "snap"), (6.32, 1.15, "punch"), (8.26, 1.00, "punch"), (9.30, 1.08, "punch"), (10.76, 1.22, "punch"),
    (13.23, 1.00, "snap"), (15.08, 1.12, "punch"), (16.44, 1.22, "punch"),
    (18.07, 1.00, "snap"), (19.28, 1.12, "punch"), (20.66, 1.22, "punch"),
    (22.47, 1.00, "snap"), (23.96, 1.10, "punch"), (25.80, 1.00, "punch"), (26.98, 1.18, "punch"),
    (28.38, 1.00, "punch"), (29.90, 1.10, "punch"), (31.76, 1.20, "punch"), (33.16, 1.05, "punch"), (35.08, 1.15, "punch"),
    (37.53, 1.00, "snap"), (39.60, 1.20, "punch"), (40.94, 1.40, "punch"), (42.42, 1.15, "punch"),
    (45.27, 1.00, "snap"), (46.06, 1.30, "punch"), (47.98, 1.12, "punch"), (48.44, 1.40, "punch"), (49.72, 1.15, "punch"),
    (51.77, 1.00, "snap"), (53.60, 1.00, "snap"), (54.74, 1.12, "punch"), (55.84, 1.00, "punch"),
    (58.12, 1.18, "punch"), (59.68, 1.08, "punch"), (61.10, 1.25, "punch"), (62.6, 1.00, "punch"),
]

def cena(t):
    for c in CENAS:
        if c[0] <= t < c[1]: return c
    return CENAS[-1]

# monta legenda com tempo final (início da próxima, ou "fim")
leg = []
for i, it in enumerate(L):
    txt, t0, tipo = it[:3]; o = it[3] if len(it) > 3 else {}
    nxt = L[i + 1][1] if i + 1 < len(L) else t0 + 1.0
    t1 = o.get("fim", nxt if nxt - t0 < 1.6 else t0 + 1.2)
    c = cena(t0)
    leg.append({"txt": txt, "t0": t0, "t1": round(t1, 2), "tipo": tipo, "cor": c[3], "y": c[4], **o})

json.dump({"cenas": CENAS, "legenda": leg, "nomes": NOMES, "cards": CARDS, "zoom": ZOOM},
          open("mapa.json", "w"), ensure_ascii=False, indent=1)

TIPO = {"P": "pequena", "M": "média branca", "K": "**DESTAQUE**", "C": "**colorida palavra a palavra**"}
md = ["# Mapa da legenda e do motion (etapa 2)", "",
      "Legenda em minúsculas e sem pontuação (como na referência), sempre batendo com a boca. ",
      "`?` = palavra/tempo a confirmar no áudio. Linha 2 dos destaques em Crimson itálica colorida.", ""]
for c in CENAS:
    md += [f"## {c[2]} · {c[0]:.2f}–{c[1]:.2f} · cor {c[3]}", "",
           "| Tempo | Legenda | Tipo | Posição | Card / zoom / nome |", "|---|---|---|---|---|"]
    evs = []
    for x in leg:
        if c[0] <= x["t0"] < c[1]:
            t = x["txt"].replace("|", " / *") + ("*" if "|" in x["txt"] else "")
            extra = []
            if x.get("logo"): extra.append("logo ao lado")
            if x.get("fica_no_topo_ate"): extra.append(f"fica fixa no topo até {x['fica_no_topo_ate']}")
            evs.append((x["t0"], f"{t}{' ?' if x.get('flag') else ''}", TIPO[x["tipo"]],
                        x.get("pos", "peito") + (" · " + ", ".join(extra) if extra else ""), ""))
    for n, t in NOMES:
        if c[0] <= t < c[1]: evs.append((t, "", "", "", f"plaquinha **{n}**"))
    for k, a, b, lado in CARDS:
        if c[0] <= a < c[1]: evs.append((a, "", "", "", f"card `{k}` entra ({lado}), sai {b}"))
    for t, z, tp in ZOOM:
        if c[0] <= t < c[1]: evs.append((t, "", "", "", f"zoom {z:.2f} ({tp})"))
    evs.sort(key=lambda e: e[0])
    for e in evs: md.append(f"| {e[0]:.2f} | {e[1]} | {e[2]} | {e[3]} | {e[4]} |")
    md.append("")
open("mapa.md", "w").write("\n".join(md))
print(len(leg), "legendas,", len(CARDS), "cards,", len(ZOOM), "zooms")
