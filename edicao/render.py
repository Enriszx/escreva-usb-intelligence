# Renderizador da edição USB Intelligence (v2).
# Uso: python3 render.py <saida.mp4> [--q preview|final] [--frames t1,t2,...] [--sem-cards]
import json, sys, subprocess, math, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

A = sys.argv[1:]
OUT = A[0]
Q = A[A.index("--q") + 1] if "--q" in A else "preview"
ONLY = [float(x) for x in A[A.index("--frames") + 1].split(",")] if "--frames" in A else None
CARDS_ON = "--sem-cards" not in A

M = json.load(open("mapa.json"))
FPS = 30
W, H = (1920, 1080) if Q == "final" else (1280, 720)
S = W / 1920
SRC, SW, SH = ("bruto.mp4", 2560, 1440) if Q == "final" else ("bruto_1080.mp4", 1920, 1080)
SS = SW / 1920  # escala do espaço da cena (antes do zoom)
FIM, CONG = M["fim_video"], M["congela"]
NF = int(round(FIM * FPS)); NTOT = NF + int(CONG * FPS)
CENAS = M["cenas"]

FONT = {"anton": "/root/.fonts/Anton-Regular.ttf", "ital": "/root/.fonts/CrimsonText-SemiBoldItalic.ttf",
        "d_sb": "/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf",
        "d_b": "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
        "d_m": "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"}
_fc = {}
def font(k, px):
    key = (k, int(round(px)))
    if key not in _fc: _fc[key] = ImageFont.truetype(FONT[k], key[1])
    return _fc[key]

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def clamp(x, a, b): return max(a, min(b, x))
def quint(x): x = clamp(x, 0, 1); return 1 - (1 - x) ** 5
def cubic(x): x = clamp(x, 0, 1); return 1 - (1 - x) ** 3
def inout(x): x = clamp(x, 0, 1); return x * x * (3 - 2 * x) if x < 1 else 1.0
def inout_sine(x): x = clamp(x, 0, 1); return -(math.cos(math.pi * x) - 1) / 2
def back(x, s=1.5): x = clamp(x, 0, 1) - 1; return 1 + (s + 1) * x ** 3 + s * x ** 2

def cena_idx(t):
    for i, c in enumerate(CENAS):
        if c[0] <= t < c[1]: return i
    return len(CENAS) - 1

# ---------------- rosto (só para mirar o zoom) ----------------
F = json.load(open("faces.json"))
def face_at(t):
    ci = cena_idx(t); c = CENAS[ci]
    near = [f for f in F if "cx" in f and c[0] <= f["t"] < c[1] and abs(f["t"] - t) < 1.0]
    if not near: return .5, .45
    return float(np.median([f["cx"] for f in near])), float(np.median([f["cy"] for f in near]))

# ---------------- zoom: só frases de impacto ----------------
Z = []
for t0, t1, z, _ in M["zoom"]:
    cx, cy = face_at(t0 + .3)
    Z.append((t0, t1, z, cx, cy + .04))
def cam(t):
    for t0, t1, z, cx, cy in Z:
        if t0 <= t < t1 + .01 or (t1 >= FIM - .01 and t >= t0):
            up = inout_sine((t - t0) / 1.0)                     # entra em 1 s, suave
            dn = 1 - inout_sine((t - (t1 - .7)) / .7) if t1 < FIM - .01 else 1  # volta em 0,7 s
            k = min(up, dn)
            return 1 + (z - 1) * k, cx, cy
    return 1.0, .5, .5

# ---------------- utilidades de imagem ----------------
def pil_text(txt, fk, px, color):
    f = font(fk, px); bb = f.getbbox(txt)
    im = Image.new("RGBA", (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((2 - bb[0], 2 - bb[1]), txt, font=f, fill=color)
    return im, bb

def np_rgba(im): return np.asarray(im, dtype=np.float32) / 255.0

def with_shadow(a, soft=14, op=.42, dy=5, tight=.30, k=None):
    S_ = k if k else S
    """a: float RGBA. Devolve RGBA com sombra suave (larga) + sombra curta para leitura."""
    p = int(40 * S_); h, w = a.shape[:2]
    out = np.zeros((h + 2 * p, w + 2 * p, 4), np.float32)
    al = np.zeros((h + 2 * p, w + 2 * p), np.float32); al[p:p + h, p:p + w] = a[..., 3]
    s1 = cv2.GaussianBlur(al, (0, 0), soft * S_) * op
    s2 = cv2.GaussianBlur(al, (0, 0), 2.2 * S_) * tight
    sh = np.maximum(np.roll(s1, int(dy * S_), 0), np.roll(s2, int(1.5 * S_), 0))
    out[..., 3] = sh
    fg = np.zeros_like(out); fg[p:p + h, p:p + w] = a
    oa = fg[..., 3:4] + out[..., 3:4] * (1 - fg[..., 3:4])
    rgb = (fg[..., :3] * fg[..., 3:4]) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa])

def blit(frame, spr, cx, cy, alpha=1.0, anchor="center"):
    """frame float RGB HxWx3; spr float RGBA. cx,cy em pixels."""
    h, w = spr.shape[:2]
    x0 = int(round(cx - w / 2)); y0 = int(round(cy - h / 2))
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb: return
    s = spr[ya - y0:yb - y0, xa - x0:xb - x0]
    a = s[..., 3:4] * alpha
    frame[ya:yb, xa:xb] = frame[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a

def fit_x(cx, w, margin=60):
    m = margin * S
    return clamp(cx, w / 2 + m, W - w / 2 - m)

# ---------------- legenda ----------------
LEG = M["legenda"]
PAL_C = ["#C9D65A", "#4FB3E8", "#F2C38B", "#F0B45A"]  # uma cor de cada cena
for j, c in enumerate([c for c in LEG if c["tipo"] == "C"]): c["cor"] = PAL_C[j % 4]
SCENE_X = {1: .70, 7: .27, 8: .27}
POS_X = {"esq": .25, "dir": .75, "centro": .5}
LOGO_ICON = Image.open("cards/logo.png").crop((30, 40, 130, 140))

_cache = {}
def run_sprite(c):
    k = ("run", c["txt"], c["tipo"], c["cor"])
    if k not in _cache:
        if c["tipo"] == "M": im, _ = pil_text(c["txt"], "d_b", 80 * S, (255, 255, 255, 255))
        else:
            im, _ = pil_text(c["txt"], "d_sb", 66 * S, (255, 255, 255, 240))
        _cache[k] = with_shadow(np_rgba(im))
    return _cache[k]

def letters(txt, fk, px, color):
    """sprites por letra + posição x de cada uma (kerning preservado pelo comprimento do prefixo)."""
    k = ("let", txt, fk, int(px), color)
    if k in _cache: return _cache[k]
    f = font(fk, px); asc, desc = f.getmetrics(); hh = asc + desc
    xs, sp = [], []
    for i, ch in enumerate(txt):
        x = f.getlength(txt[:i]); w = int(f.getlength(ch) + px * .3)
        im = Image.new("RGBA", (max(1, w), hh), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((0, 0), ch, font=f, fill=color)
        xs.append(x); sp.append(np_rgba(im))
    tw = int(f.getlength(txt) + px * .3)
    _cache[k] = (xs, sp, tw, hh); return _cache[k]

def kinetic_line(txt, fk, px, color, prog_frames, stagger=1.0, dur=7.0):
    """linha com letras subindo de dentro de uma máscara (recorte da caixa da linha)."""
    xs, sp, tw, hh = letters(txt, fk, px, color)
    can = np.zeros((hh, tw, 4), np.float32)
    for i, (x, s) in enumerate(zip(xs, sp)):
        p = quint((prog_frames - i * stagger) / dur)
        if p <= 0: continue
        dy = int((1 - p) * hh * .9)
        h2 = hh - dy
        if h2 <= 0: continue
        x0 = int(x); w = min(s.shape[1], tw - x0)
        seg = s[:h2, :w]
        dst = can[dy:dy + h2, x0:x0 + w]
        a = seg[..., 3:4]
        dst[..., :3] = dst[..., :3] * (1 - a) + seg[..., :3] * a
        dst[..., 3:4] = dst[..., 3:4] + a * (1 - dst[..., 3:4])
    return can

def wipe(spr, p, soft=.18):
    """revela da esquerda para a direita com borda suave."""
    if p >= 1: return spr
    w = spr.shape[1]; x = np.linspace(0, 1, w)
    m = np.clip((p * (1 + soft) - x) / soft, 0, 1).astype(np.float32)
    o = spr.copy(); o[..., 3] *= m[None, :]; return o

def keyword_sprite(c, t):
    a, _, b = c["txt"].partition("|")
    fr = (t - c["t0"]) * FPS
    big = 190 if c["tipo"] == "K" else 205
    col1 = (255, 255, 255, 255) if c["tipo"] == "K" else hexrgb(c["cor"]) + (255,)
    l1 = kinetic_line(a, "anton", big * S, col1, fr)
    if c.get("logo"):
        ic = np_rgba(LOGO_ICON.resize((int(118 * S), int(118 * S)), Image.LANCZOS))
        ic = ic.copy(); ic[..., 3] *= cubic(fr / 6)
        gap = int(18 * S); nl = np.zeros((max(l1.shape[0], ic.shape[0]), ic.shape[1] + gap + l1.shape[1], 4), np.float32)
        oy = (nl.shape[0] - ic.shape[0]) // 2; nl[oy:oy + ic.shape[0], :ic.shape[1]] = ic
        oy = (nl.shape[0] - l1.shape[0]) // 2; nl[oy:oy + l1.shape[0], ic.shape[1] + gap:] = l1; l1 = nl
    if not b: return l1
    t2 = c.get("t2", c["t0"]); f2 = (t - t2) * FPS
    k = ("ital", b, c["cor"])
    if k not in _cache: _cache[k] = np_rgba(pil_text(b, "ital", 168 * S, hexrgb(c["cor"]) + (255,))[0])
    l2 = wipe(_cache[k], cubic(f2 / 9)) if f2 >= 0 else np.zeros_like(_cache[k])
    ov = int(l2.shape[0] * .42); dx = int(56 * S)
    w = max(l1.shape[1], l2.shape[1] + 2 * dx); h = l1.shape[0] + l2.shape[0] - ov
    can = np.zeros((h, w, 4), np.float32)
    def put(s, x, y):
        d = can[y:y + s.shape[0], x:x + s.shape[1]]; a_ = s[..., 3:4]
        d[..., :3] = d[..., :3] * (1 - a_) + s[..., :3] * a_; d[..., 3:4] = d[..., 3:4] + a_ * (1 - d[..., 3:4])
    put(l1, (w - l1.shape[1]) // 2, 0); put(l2, (w - l2.shape[1]) // 2 + dx, l1.shape[0] - ov)
    return can

def scale_spr(s, k):
    if abs(k - 1) < 1e-3: return s
    return cv2.resize(s, (max(1, int(s.shape[1] * k)), max(1, int(s.shape[0] * k))), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR)

def draw_captions(fr, t):
    for i, c in enumerate(LEG):
        t0, t1 = c["t0"], c["t1"]; top = c.get("fica_no_topo_ate")
        nxt = LEG[i + 1]["t0"] if i + 1 < len(LEG) else 1e9
        end = top if top else t1
        fade_out = c["tipo"] in "PM" and nxt - t1 > .12
        if not (t0 <= t < end + (4 / FPS if fade_out else 0)) or c.get("atras"): continue
        ci = cena_idx(t0)
        x = POS_X.get(c.get("pos"), SCENE_X.get(ci, .5)); y = c["y"]
        if c["tipo"] in "KC" and (c.get("pos") in ("esq", "dir") or ci in (7, 8)): y = min(y, .60)
        fr_ = (t - t0) * FPS
        if c["tipo"] in "PM":
            s = run_sprite(c); p = quint(fr_ / 6)
            a = p * (1 - cubic((t - end) * FPS / 4) if t >= end else 1)
            if p < 1:  # entra subindo, com um leve desfoque que some
                s = cv2.GaussianBlur(s, (0, 0), max(.1, (1 - p) * 5 * S))
            cx = fit_x(x * W, s.shape[1]); cy = y * H + (1 - p) * 22 * S
            blit(fr, s, cx, cy, a)
        else:
            s = with_shadow(keyword_sprite(c, t), 18, .50, 6, .45)
            k = 1.0
            if top and t >= t1:  # sobe e fica fixa no topo, menor
                a_ = inout((t - t1) * FPS / 12)
                x = x + (.5 - x) * a_; y = y + (.115 - y) * a_; k = 1 - .5 * a_
            s = scale_spr(s, k)
            if s.shape[1] > W * .94: s = scale_spr(s, W * .94 / s.shape[1])
            blit(fr, s, fit_x(x * W, s.shape[1], 30), clamp(y * H, s.shape[0] / 2 - 20 * S, H - s.shape[0] / 2 + 10 * S))

# ---------------- plaquinha de nome ----------------
def draw_names(fr, t):
    for n, tn in M["nomes"]:
        D = 2.3
        if not (tn <= t < tn + D): continue
        f_ = (t - tn) * FPS; out = (t - (tn + D - .35)) * FPS
        col = hexrgb(CENAS[cena_idx(tn)][3])
        k = ("nome", n)
        if k not in _cache:
            _cache[k] = np_rgba(pil_text(n, "d_b", 60 * S, (255, 255, 255, 255))[0])
            _cache[k + ("s",)] = np_rgba(pil_text("USB Intelligence", "d_m", 25 * S, (255, 255, 255, 215))[0])
        nm, sub = _cache[k], _cache[k + ("s",)]
        x0, ybase = 96 * S, H - 118 * S
        # barra de cor que cresce
        bh = int(80 * S * cubic(f_ / 8) * (1 - cubic(out / 8) if out > 0 else 1))
        if bh > 0:
            bar = np.zeros((bh, max(2, int(4 * S)), 4), np.float32); bar[..., :3] = np.array(col) / 255; bar[..., 3] = 1
            blit(fr, with_shadow(bar, 8, .3, 2), x0, ybase - bh / 2)
        # nome sobe de dentro da máscara; some descendo
        for spr, yy, dl in ((nm, ybase - 48 * S, 2), (sub, ybase - 4 * S, 5)):
            p = quint((f_ - dl) / 9); q = cubic(out / 7) if out > 0 else 0
            vis = p * (1 - q); h = spr.shape[0]
            if vis <= 0: continue
            dy = int((1 - vis) * h)
            cut = spr[:h - dy] if dy < h else None
            if cut is None or cut.shape[0] < 1: continue
            blit(fr, with_shadow(cut, 10, .35, 3), x0 + 22 * S + cut.shape[1] / 2, yy + dy + cut.shape[0] / 2 - h / 2)

# ---------------- cards 3D ----------------
CARD_IMG = {}
def card_img(name):
    if name not in CARD_IMG: CARD_IMG[name] = np_rgba(Image.open(f"cards/{name}.png"))
    return CARD_IMG[name]
# lugar: (cx, cy, largura em fração da tela, rotY base, rotX base)
PLACE = {"esq": (.19, .40, .29, 22, 4), "dir": (.81, .40, .29, -22, 4), "dir-topo": (.79, .28, .27, -20, 6),
         "esq-topo": (.21, .28, .27, 20, 6), "centro-topo": (.5, .21, .26, 0, 8), "centro": (.5, .5, .40, 0, 0)}

def sweep(img, p):
    """faixa de luz diagonal atravessando o card."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = (xx / w + yy / h * .5) - (p * 2.0 - .4)
    band = np.exp(-(d / .07) ** 2) * .55
    o = img.copy(); o[..., :3] = np.clip(o[..., :3] + band[..., None] * img[..., 3:4], 0, 1); return o

def project(img, cx, cy, wpx, ry, rx, sc):
    h, w = img.shape[:2]; ww = wpx * sc; hh = ww * h / w
    f = 1500 * S
    pts = []
    for X, Y in ((-ww / 2, -hh / 2), (ww / 2, -hh / 2), (ww / 2, hh / 2), (-ww / 2, hh / 2)):
        a, b = math.radians(ry), math.radians(rx)
        x1 = X * math.cos(a); z1 = X * math.sin(a)
        y2 = Y * math.cos(b) - z1 * math.sin(b); z2 = Y * math.sin(b) + z1 * math.cos(b)
        k = f / (f + z2); pts.append((cx + x1 * k, cy + y2 * k))
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]]); dst = np.float32(pts)
    xs, ys = dst[:, 0], dst[:, 1]
    x0, y0 = int(max(0, xs.min() - 60 * S)), int(max(0, ys.min() - 60 * S))
    x1, y1 = int(min(W, xs.max() + 90 * S)), int(min(H, ys.max() + 110 * S))
    if x1 <= x0 or y1 <= y0: return None
    Mt = cv2.getPerspectiveTransform(src, dst - np.float32([x0, y0]))
    out = cv2.warpPerspective(img, Mt, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    return out, x0, y0

def draw_cards(fr, t):
    for name, a, b, lado in M["cards"]:
        if not (a <= t < b + .32): continue
        cx, cy, wf, ry0, rx0 = PLACE[lado]
        fi = (t - a) * FPS; fo = (t - b) * FPS
        if name == "logo" and lado == "centro": continue  # o logo final é desenhado no fim
        p = back(fi / 12, 1.2); al = cubic(fi / 8)
        sc = .55 + .45 * p; ry = ry0 + 55 * (1 - cubic(fi / 12)) * (1 if ry0 >= 0 else -1)
        if fo > 0:  # sai girando para fora
            q = cubic(fo / 9); al *= 1 - q; ry += 60 * q * (1 if ry0 >= 0 else -1); sc *= 1 - .15 * q
        if al <= 0: continue
        ft = t - a
        cyp = cy * H + 8 * S * math.sin(ft * math.pi) ; ry += 3 * math.sin(ft * math.pi + 1)
        img = card_img(name)
        if 0 <= fi <= 22: img = sweep(img, fi / 22)
        r = project(img, cx * W, cyp, wf * W, ry, rx0, sc)
        if r is None: continue
        out, x0, y0 = r; h, w = out.shape[:2]
        # sombra projetada desfocada
        sh = cv2.GaussianBlur(out[..., 3], (0, 0), 22 * S) * .5 * al
        sh = np.roll(np.roll(sh, int(26 * S), 0), int(10 * S), 1)
        reg = fr[y0:y0 + h, x0:x0 + w]
        reg *= (1 - sh[..., None])
        aa = out[..., 3:4] * al
        reg[:] = reg * (1 - aa) + out[..., :3] * aa

# ---------------- final: logo com fundo desfocado ----------------
LOGO_T = next(a for n, a, b, l in M["cards"] if n == "logo" and l == "centro")
def end_card(fr, t):
    if t < LOGO_T: return fr
    p = inout((t - LOGO_T) / .6)
    sig = 1 + 16 * S * p
    b = cv2.GaussianBlur(fr, (0, 0), sig) * (1 - .30 * p)
    fi = (t - LOGO_T) * FPS
    img = card_img("logo"); sc = .7 + .3 * back(fi / 14, 1.1)
    r = project(img if fi > 24 else sweep(img, fi / 24), W / 2, H / 2, .44 * W, 8 * (1 - cubic(fi / 18)) + 2 * math.sin((t - LOGO_T) * 1.4), 0, sc)
    if r:
        out, x0, y0 = r; h, w = out.shape[:2]; al = cubic(fi / 10)
        sh = cv2.GaussianBlur(out[..., 3], (0, 0), 26 * S) * .55 * al
        sh = np.roll(sh, int(28 * S), 0)
        reg = b[y0:y0 + h, x0:x0 + w]; reg *= (1 - sh[..., None]); aa = out[..., 3:4] * al
        reg[:] = reg * (1 - aa) + out[..., :3] * aa
    if t > NTOT / FPS - .5: b *= clamp((NTOT / FPS - t) / .5, 0, 1)  # fade final
    return b

# ---------------- espaço da cena: tracking, nome atrás da pessoa, palavra vazada, celular ----------------
MASKS = np.load("masks.npy", mmap_mode="r") if os.path.exists("masks.npy") else None
def mask_full(i):
    if MASKS is None or i >= len(MASKS): return None
    m = cv2.resize(np.asarray(MASKS[i]), (SW, SH), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    return cv2.GaussianBlur(m, (0, 0), 1.2 * SS)

def build_track():
    """rosto quadro a quadro: interpola as detecções e suaviza (gaussiana) dentro de cada cena."""
    n = NF; t = np.arange(n) / FPS
    ft = np.array([f["t"] for f in F]); ok = np.array(["cx" in f for f in F])
    out = {}
    for k in ("cx", "cy", "h"):
        v = np.array([f.get(k, np.nan) for f in F], float); arr = np.full(n, np.nan)
        for ci, c in enumerate(CENAS):
            m = ok & (ft >= c[0]) & (ft < c[1]); sel = (t >= c[0]) & (t < c[1])
            if m.sum() < 3: continue
            vv = v[m]; tt = ft[m]
            med = np.median(vv); mad = np.median(np.abs(vv - med)) + 1e-3
            keep = np.abs(vv - med) < 4 * mad + .03          # descarta detecções erradas
            x = np.interp(t[sel], tt[keep], vv[keep])
            sig = 4.0 if k != "h" else 8.0
            ker = np.exp(-.5 * (np.arange(-12, 13) / sig) ** 2); ker /= ker.sum()
            xp = np.pad(x, 12, mode="edge"); arr[sel] = np.convolve(xp, ker, "valid")
        out[k] = arr
    return out
TRK = build_track()
def track(t):
    i = clamp(int(round(t * FPS)), 0, NF - 1)
    if np.isnan(TRK["cx"][i]): return None
    return TRK["cx"][i], TRK["cy"][i], TRK["h"][i]

def occluded_blit(srcf, spr, cx, cy, m, alpha=1.0):
    """desenha atrás da pessoa: o recorte (m) tampa o texto."""
    h, w = spr.shape[:2]; x0 = int(round(cx - w / 2)); y0 = int(round(cy - h / 2))
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(SW, x0 + w), min(SH, y0 + h)
    if xa >= xb or ya >= yb: return
    s = spr[ya - y0:yb - y0, xa - x0:xb - x0]
    a = s[..., 3:4] * alpha
    if m is not None: a = a * (1 - m[ya:yb, xa:xb, None])
    srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a

def name_sprite(n, t, tn, D, px, col):
    f_ = (t - tn) * FPS; out = (t - (tn + D - .4)) * FPS
    line = kinetic_line(n, "anton", px, (255, 255, 255, 255), f_, stagger=1.6, dur=9)
    if out > 0:  # sai: letras sobem e somem uma a uma
        q = np.clip((out - np.arange(len(n)) * 1.2) / 8, 0, 1)
        xs, sp, tw, hh = letters(n, "anton", px, (255, 255, 255, 255))
        line = np.zeros((hh, tw, 4), np.float32)
        for j, (x, s_) in enumerate(zip(xs, sp)):
            p = cubic(q[j]); dy = int(p * hh * .5)
            seg = s_.copy(); seg[..., 3] *= 1 - p
            x0 = int(x); w = min(seg.shape[1], tw - x0); hcut = hh - dy
            d = line[0:hcut, x0:x0 + w]; a = seg[dy:dy + hcut, :w, 3:4]
            d[..., :3] = d[..., :3] * (1 - a) + seg[dy:dy + hcut, :w, :3] * a; d[..., 3:4] = d[..., 3:4] + a * (1 - d[..., 3:4])
    # faixa de luz que atravessa o nome na entrada
    if 4 <= f_ <= 26:
        hh, ww = line.shape[:2]; xx = np.arange(ww)[None, :] / ww
        band = np.exp(-((xx - (f_ - 4) / 18 * 1.4 + .2) / .06) ** 2)[..., None] * .8
        line = line.copy(); line[..., :3] = np.clip(line[..., :3] + band * line[..., 3:4], 0, 1)
    # traço fino na cor da cena, embaixo, crescendo do centro
    return line

def draw_names_tracked(srcf, t, m):
    for n, tn, D, modo in M["nomes"]:
        if not (tn <= t < tn + D): continue
        tr = track(t)
        if tr is None: continue
        cx, cy, h = tr; col = hexrgb(CENAS[cena_idx(tn)][3])
        hpx = h * 1080
        if modo == "acima":
            px = clamp(hpx * 1.15, 120, 300) * SS
            spr = name_sprite(n, t, tn, D, px, col); th, tw = spr.shape[:2]
            y = (cy - .62 * h) * SH - th * .5 + th * .30   # 30% de baixo do nome atrás do cabelo
            y = max(y, th * .5 + 14 * SS); x = cx * SW
        else:
            px = clamp(hpx * .80, 130, 250) * SS
            spr = name_sprite(n, t, tn, D, px, col); th, tw = spr.shape[:2]
            fw = .78 * h * SH                                 # largura aproximada da cabeça
            y = (cy - .28 * h) * SH
            x = (cx * SW - fw * .30 - tw / 2) if modo == "esq" else (cx * SW + fw * .36 + tw / 2)
            x = clamp(x, tw / 2 + 30 * SS, SW - tw / 2 - 30 * SS)
        occluded_blit(srcf, with_shadow(spr, 22, .35, 8, .2, SS), x, y, m)
        k = ("lbl", n)
        if k not in _cache: _cache[k] = np_rgba(pil_text("USB Intelligence", "ital", 54 * SS, col + (255,))[0])
        lb = _cache[k]; f_ = (t - tn) * FPS
        a = cubic((f_ - 6) / 8) * (1 - cubic((t - (tn + D - .45)) * FPS / 7))
        if a > 0:
            lx = x - tw / 2 + lb.shape[1] / 2 + 6 * SS if modo != "dir" else x + tw / 2 - lb.shape[1] / 2
            if modo == "acima": lx = x + tw * .18
            ly = y - th * .5 - 2 * SS + (1 - a) * 10 * SS
            if ly - lb.shape[0] / 2 < 8 * SS: ly = y + th * .5 + lb.shape[0] * .3
            blit_src(srcf, with_shadow(lb, 10, .35, 3, .2, SS), lx, ly, a)

def blit_src(srcf, spr, cx, cy, alpha=1.0):
    h, w = spr.shape[:2]; x0 = int(round(cx - w / 2)); y0 = int(round(cy - h / 2))
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(SW, x0 + w), min(SH, y0 + h)
    if xa >= xb or ya >= yb: return
    s = spr[ya - y0:yb - y0, xa - x0:xb - x0]; a = s[..., 3:4] * alpha
    srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a

def draw_behind_words(srcf, t, m):
    for c in LEG:
        if not c.get("atras") or not (c["t0"] <= t < c["t1"] + .3): continue
        tr = track(c["t0"] + .2)
        cx, cy, h = tr if tr else (.5, .3, .2)
        f_ = (t - c["t0"]) * FPS; out = (t - c["t1"]) * FPS
        spr = kinetic_line(c["txt"], "anton", 190 * SS, (255, 255, 255, 255), f_, stagger=1.2, dur=10)
        if spr.shape[1] > SW * .50: spr = scale_spr(spr, SW * .50 / spr.shape[1])
        a = 1 - cubic(out / 8) if out > 0 else 1
        head_top = (cy - .62 * h) * SH
        y = max(head_top - spr.shape[0] * .22, spr.shape[0] * .5 + 10 * SS)
        occluded_blit(srcf, with_shadow(spr, 26, .30, 10, .15, SS), cx * SW, y, m, a)

PH = M.get("phone")
PH_IMG = {}
def draw_phone(srcf, t):
    if not PH or not (PH["entra"] <= t < PH["sai"] + .4): return
    fi = (t - PH["entra"]) * FPS; fo = (t - PH["sai"]) * FPS
    scr = PH["telas"][0][0]; prev = None; cf = 1
    for nm_, ts in PH["telas"]:
        if t >= ts: prev, scr, cf = scr, nm_, cubic((t - ts) * FPS / 9)
    for nm_ in (scr, prev):
        if nm_ and nm_ not in PH_IMG: PH_IMG[nm_] = np_rgba(Image.open(f"cards/phone_{nm_}.png"))
    img = PH_IMG[scr]
    if prev and cf < 1: img = PH_IMG[prev] * (1 - cf) + img * cf
    if fi < 26: img = sweep(img, fi / 26)
    p = back(fi / 16, 1.1); al = cubic(fi / 10)
    ry = -16 + 70 * (1 - cubic(fi / 18)) + 3 * math.sin((t - PH["entra"]) * 1.3)
    cy = (.53 + .25 * (1 - p)) * SH + 6 * SS * math.sin((t - PH["entra"]) * 2.0)
    if fo > 0: q = cubic(fo / 10); al *= 1 - q; ry -= 60 * q; cy += .1 * SH * q
    if al <= 0: return
    cx = .765 * SW; hpx = .64 * SH; wpx = hpx * img.shape[1] / img.shape[0]
    # sombra no chão
    sh = np.zeros((int(60 * SS), int(wpx * 1.3), 4), np.float32); cv2.ellipse(sh, (sh.shape[1] // 2, sh.shape[0] // 2), (sh.shape[1] // 2 - 4, sh.shape[0] // 4), 0, 0, 360, (0, 0, 0, .55), -1)
    sh = cv2.GaussianBlur(sh, (0, 0), 12 * SS)
    blit_src(srcf, sh, cx + 20 * SS, cy + hpx / 2 + 40 * SS, al)
    r = project_src(img, cx, cy, wpx, ry, 3)
    if r is None: return
    out, x0, y0 = r; h, w = out.shape[:2]; aa = out[..., 3:4] * al
    reg = srcf[y0:y0 + h, x0:x0 + w]; reg[:] = reg * (1 - aa) + out[..., :3] * aa

def project_src(img, cx, cy, wpx, ry, rx):
    h, w = img.shape[:2]; ww = wpx; hh = ww * h / w; f = 1600 * SS; pts = []
    for X, Y in ((-ww / 2, -hh / 2), (ww / 2, -hh / 2), (ww / 2, hh / 2), (-ww / 2, hh / 2)):
        a, b = math.radians(ry), math.radians(rx)
        x1 = X * math.cos(a); z1 = X * math.sin(a)
        y2 = Y * math.cos(b) - z1 * math.sin(b); z2 = Y * math.sin(b) + z1 * math.cos(b)
        k = f / (f + z2); pts.append((cx + x1 * k, cy + y2 * k))
    dst = np.float32(pts); x0, y0 = int(max(0, dst[:, 0].min() - 4)), int(max(0, dst[:, 1].min() - 4))
    x1, y1 = int(min(SW, dst[:, 0].max() + 4)), int(min(SH, dst[:, 1].max() + 4))
    if x1 <= x0 or y1 <= y0: return None
    Mt = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), dst - np.float32([x0, y0]))
    return cv2.warpPerspective(img, Mt, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)), x0, y0

def transition(fr, t):
    """desfoque de movimento + deslize horizontal curto nos cortes."""
    for tc in M.get("transicoes", []):
        d = (t - tc) * FPS
        if -4 <= d < 4:
            k = 1 - abs(d + .5) / 4.5; L = int(90 * S * k) | 1
            ker = np.zeros((1, L), np.float32); ker[0] = 1 / L
            fr = cv2.filter2D(fr, -1, ker, borderType=cv2.BORDER_REFLECT)
            dx = (-1 if d < 0 else 1) * 50 * S * k
            fr = cv2.warpAffine(fr, np.float32([[1, 0, dx], [0, 1, 0]]), (W, H), borderMode=cv2.BORDER_REFLECT)
            fr = np.clip(fr * (1 + .12 * k), 0, 1)
    return fr

# ---------------- quadro ----------------
def reader():
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", f"fps={FPS},scale={SW}:{SH}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=SW * SH * 3)
    n = SW * SH * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(SH, SW, 3)

def frame_at(src, t):
    i = min(int(round(t * FPS)), NF - 1)
    srcf = src.astype(np.float32) / 255
    need = any(tn <= t < tn + D for _, tn, D, _m in M["nomes"]) or any(c.get("atras") and c["t0"] <= t < c["t1"] + .3 for c in LEG)
    m = mask_full(i) if need else None
    draw_behind_words(srcf, t, m); draw_names_tracked(srcf, t, m)
    if CARDS_ON: draw_phone(srcf, t)
    z, cx, cy = cam(t)
    cw, ch = SW / z, SH / z
    x0 = clamp(cx * SW - cw / 2, 0, SW - cw); y0 = clamp(cy * SH - ch / 2, 0, SH - ch)
    Mx = np.array([[W / cw, 0, -x0 * W / cw], [0, H / ch, -y0 * H / ch]], np.float32)
    fr = cv2.warpAffine(srcf, Mx, (W, H), flags=cv2.INTER_AREA if W / cw < 1 else cv2.INTER_CUBIC)
    fr = transition(fr, t)
    if CARDS_ON: draw_cards(fr, t)
    if CARDS_ON: fr = end_card(fr, t)
    if not (CARDS_ON and t >= LOGO_T): draw_captions(fr, t)
    return (np.clip(fr, 0, 1) * 255 + .5).astype(np.uint8)

def main():
    if ONLY:
        os.makedirs("frames", exist_ok=True)
        want = {int(round(t * FPS)): t for t in ONLY}; last = None
        for i, src in enumerate(reader()):
            if i >= NF: break
            last = src
            if i in want: Image.fromarray(frame_at(src, i / FPS)).save(f"frames/f_{want[i]:06.2f}.jpg", quality=92)
            if i > max(want): break
        for i, t in want.items():
            if i >= NF: Image.fromarray(frame_at(last, t)).save(f"frames/f_{t:06.2f}.jpg", quality=92)
        return
    crf = "18" if Q == "final" else "20"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", "mix.wav", "-map", "0:v", "-map", "1:a",
                            "-c:v", "libx264", "-crf", crf, "-preset", "veryfast" if Q == "final" else "fast", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-b:a", "192k", "-t", f"{NTOT / FPS:.3f}", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    last = None
    for i, src in enumerate(reader()):
        if i >= NF: break
        last = src; enc.stdin.write(frame_at(src, i / FPS).tobytes())
        if i % 300 == 0: print(f"{i}/{NTOT}", flush=True)
    for i in range(NF, NTOT): enc.stdin.write(frame_at(last, i / FPS).tobytes())
    enc.stdin.close(); enc.wait(); print("ok", OUT)

if __name__ == "__main__": main()
