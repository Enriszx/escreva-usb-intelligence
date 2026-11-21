# Mapa da legenda e do motion (etapa 2). Fonte única para a renderização.
# Gera mapa.json (usado pelo render) e mapa.md (para o Enrique aprovar).
import json

# cena: (início, fim, pessoa, cor de destaque, altura da legenda no peito 0-1)
CENAS = [
    (0.00, 4.50, "Fábio (bike)", "#EEF5A8", 0.62),
    (4.50, 13.23, "Fábio (deitado)", "#EEF5A8", 0.74),
    (13.23, 18.07, "Higor (plano A)", "#4FB3E8", 0.76),
    (18.07, 22.47, "Higor (plano B)", "#4FB3E8", 0.70),
    (22.47, 37.53, "Marielly", "#F2C38B", 0.80),
    (37.53, 45.27, "Gustavo (plano 1)", "#A6E36B", 0.60),
    (45.27, 51.77, "Gustavo (plano 2)", "#A6E36B", 0.60),
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
    ("apesar de", 37.96, "M"), ("tudo isso", 39.08, "M"), ("temos", 39.60, "P"),
    ("aplicações", 39.78, "P"), ("que podem", 40.26, "P"), ("funcionar", 40.54, "P"),
    ("sem internet", 40.94, "K", {"atras": True, "fim": 44.9}),
    ("com acesso", 41.58, "P"), ("para qualquer", 42.42, "P"), ("usuário", 42.96, "P"),
    ("de pequenas", 43.46, "P"), ("ou grandes", 43.94, "P"), ("empresas", 44.30, "M"),
    ("por exemplo", 44.98, "M"), ("tem", 45.94, "P"),
    ("inteligência|artificial", 46.06, "K", {"t2": 46.40, "pos": "esq"}),
    ("também", 46.66, "P"), ("já é", 47.10, "P"), ("opção", 47.54, "P"), ("de vocês", 47.98, "P"),
    ("é|opcional", 48.44, "K", {"t2": 48.54, "pos": "esq"}),
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
# nome com tracking, atrás da pessoa: (nome, entra, duração, modo) modo = acima | esq | dir (lado da cabeça)
NOMES = [("Fábio", 5.1, 2.6, "acima"), ("Higor", 13.35, 2.0, "esq"), ("Marielly", 22.7, 2.4, "esq"), ("Gustavo", 37.7, 2.6, "acima"), ("Enrique", 53.75, 2.5, "dir")]

# Celular 3D em pé ao lado do Gustavo (ref 1): entra, troca de tela no assunto e sai
PHONE = {"entra": 38.5, "sai": 50.9, "telas": [["dash", 38.5], ["offline", 40.7], ["ia", 45.9]]}
# Transição com desfoque de movimento nos cortes de cena
TRANSICOES = [13.23, 22.47, 37.53, 51.77]

# Cards 3D (telas do app, sem números): (card, entra, sai, lado)
CARDS = [
    ("logo", 2.6, 4.5, "centro-topo"),            # empinada
    ("importer", 7.85, 9.25, "dir-topo"),          # "plugou um pendrive"
    ("dashboard", 15.25, 17.9, "esq"),            # "gera relatórios" (abertura estilo ref: 2 cards)
    ("donut", 15.5, 17.9, "dir"),
    ("dashboard", 18.6, 20.4, "dir"),            # "o painel mostra gráficos"
    ("dups", 20.4, 22.3, "esq"),                 # "duplicados"
    ("importer", 23.6, 25.6, "dir"),             # "você importa seus arquivos"
    ("library", 25.8, 28.2, "dir"),              # "biblioteca pesquisável com tags"
    ("library", 33.2, 36.4, "esq"),              # "mesma experiência para computador" (tela de computador)
    ("logo", 62.6, 65.53, "centro"),             # encerramento, fundo desfocado (+2 s de quadro congelado)
]

# Zoom de câmera SÓ em frases de impacto: empurrão suave (ease in-out) até o nível, segura, e volta devagar.
# (início, fim, nível, frase)
ZOOM = [
    (8.26, 12.70, 1.12, "Hoje apresentamos o USB Intelligence"),
    (19.95, 21.60, 1.10, "encontra arquivos duplicados"),
    (33.16, 36.40, 1.10, "em breve ... para o computador"),
    (40.40, 44.80, 1.16, "funcionar sem internet"),
    (48.30, 50.60, 1.12, "é opcional"),
    (61.00, 63.53, 1.10, "clara e visual"),
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
    lim, dur = (2.6, 1.8) if tipo in "KC" else (1.6, 1.2)
    t1 = o.get("fim", nxt if nxt - t0 < lim else t0 + dur)
    c = cena(t0)
    leg.append({"txt": txt, "t0": t0, "t1": round(t1, 2), "tipo": tipo, "cor": c[3], "y": c[4], **o})

json.dump({"fim_video": 63.53, "congela": 2.0, "cenas": CENAS, "legenda": leg, "nomes": NOMES, "cards": CARDS, "zoom": ZOOM, "phone": PHONE, "transicoes": TRANSICOES},
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
    for n, t, *_ in NOMES:
        if c[0] <= t < c[1]: evs.append((t, "", "", "", f"plaquinha **{n}**"))
    for k, a, b, lado in CARDS:
        if c[0] <= a < c[1]: evs.append((a, "", "", "", f"card `{k}` entra ({lado}), sai {b}"))
    for t, t1, z, fr in ZOOM:
        if c[0] <= t < c[1]: evs.append((t, "", "", "", f"zoom suave {z:.2f} até {t1} (\"{fr}\")"))
    evs.sort(key=lambda e: e[0])
    for e in evs: md.append(f"| {e[0]:.2f} | {e[1]} | {e[2]} | {e[3]} | {e[4]} |")
    md.append("")
open("mapa.md", "w").write("\n".join(md))
print(len(leg), "legendas,", len(CARDS), "cards,", len(ZOOM), "zooms")
