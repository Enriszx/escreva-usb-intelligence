# Elementos "dentro da cena" (antes do zoom): celular que cai do céu, painéis 3D ancorados,
# gráfico atrás do Higor, nomes com eco, palavras nas mãos do Enrique, ícones animados e transições.
import math, json, numpy as np, cv2
from PIL import Image, ImageDraw

R = None  # módulo render (helpers e constantes), preenchido por init()
def init(ns):
    global R
    class _N: pass
    R = _N(); R.__dict__.update(ns)

def rng(seed): return np.random.default_rng(seed)

# ------------------------------------------------------------ recorte só da pessoa
def person_mask(i, t):
    """recorte MODNet limitado ao componente conectado que contém o rosto (evita buracos falsos)."""
    if R.MASKS is None or i >= len(R.MASKS): return None
    m = np.asarray(R.MASKS[i]).astype(np.float32) / 255
    b = (m > .35).astype(np.uint8)
    n, lab = cv2.connectedComponents(b)
    tr = R.track(t)
    if n > 2 and tr:
        fx, fy = int(tr[0] * 960), int(clampf(tr[1], 0, .99) * 540)
        k = lab[min(539, fy), min(959, fx)]
        if k == 0:  # rosto fora: maior componente
            k = 1 + int(np.argmax([(lab == j).sum() for j in range(1, n)]))
        keep = cv2.dilate((lab == k).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
        m = m * keep
    m = cv2.resize(m, (R.SW, R.SH), interpolation=cv2.INTER_LINEAR)
    return cv2.GaussianBlur(m, (0, 0), 1.0 * R.SS)

def clampf(x, a, b): return max(a, min(b, x))

# ------------------------------------------------------------ utilidades de composição
def premul_blur(img, sig):
    if sig < .3: return img
    a = img[..., 3:4]; pm = np.dstack([img[..., :3] * a, a])
    pm = cv2.GaussianBlur(pm, (0, 0), sig)
    a2 = pm[..., 3:4]; return np.dstack([pm[..., :3] / np.maximum(a2, 1e-5), a2])

def motion_blur_v(img, L):
    L = int(L)
    if L < 3: return img
    k = np.zeros((L, 1), np.float32); k[:, 0] = 1 / L
    a = img[..., 3:4]; pm = np.dstack([img[..., :3] * a, a])
    pm = cv2.filter2D(pm, -1, k)
    a2 = pm[..., 3:4]; return np.dstack([pm[..., :3] / np.maximum(a2, 1e-5), a2])

def realism(img, i, tint=(0.0, 0.0, 0.0), amount=.06, contrast=.92, grain=.016):
    """casa o elemento com a filmagem: contraste um pouco menor, tom da cena e granulação."""
    o = img.copy()
    o[..., :3] = (o[..., :3] - .5) * contrast + .5 + .015
    o[..., :3] = o[..., :3] * (1 - amount) + np.array(tint, np.float32) * amount
    if grain:
        o[..., :3] += rng(i * 7 + 3).normal(0, grain, o.shape[:2])[..., None].astype(np.float32)
    o[..., :3] = np.clip(o[..., :3], 0, 1)
    return o

def light_wrap(srcf, spr, x0, y0, k=.45):
    """a luz do fundo 'vaza' nas bordas do objeto, como numa filmagem real."""
    h, w = spr.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
    if xa >= xb or ya >= yb: return spr
    bg = np.zeros((h, w, 3), np.float32); bg[ya - y0:yb - y0, xa - x0:xb - x0] = srcf[ya:yb, xa:xb]
    bg = cv2.GaussianBlur(bg, (0, 0), 10 * R.SS)
    a = spr[..., 3]; inner = cv2.GaussianBlur(a, (0, 0), 6 * R.SS)
    edge = np.clip(a - inner, 0, 1)[..., None] * 2.2
    o = spr.copy(); o[..., :3] = o[..., :3] * (1 - edge * k) + bg * edge * k
    return o

def comp(srcf, spr, x0, y0, alpha=1.0, clip_y=None):
    h, w = spr.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
    if clip_y is not None: yb = min(yb, int(clip_y))
    if xa >= xb or ya >= yb: return
    s = spr[ya - y0:yb - y0, xa - x0:xb - x0]; a = s[..., 3:4] * alpha
    srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a

def shade(srcf, sh, x0, y0, op):
    """escurece (sombra) com um mapa de alfa."""
    h, w = sh.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
    if xa >= xb or ya >= yb: return
    s = sh[ya - y0:yb - y0, xa - x0:xb - x0, None] * op
    srcf[ya:yb, xa:xb] *= (1 - s)

def project_plane(img, wpx, ry, rx, rz=0.0, f=1600.0):
    """projeta um plano (card) girado; devolve imagem deformada e os 4 cantos relativos ao centro."""
    h, w = img.shape[:2]; hh = wpx * h / w; ff = f * R.SS
    a, b, c = math.radians(ry), math.radians(rx), math.radians(rz)
    pts = []
    for X, Y in ((-wpx / 2, -hh / 2), (wpx / 2, -hh / 2), (wpx / 2, hh / 2), (-wpx / 2, hh / 2)):
        X, Y = X * math.cos(c) - Y * math.sin(c), X * math.sin(c) + Y * math.cos(c)
        x1 = X * math.cos(a); z1 = X * math.sin(a)
        y2 = Y * math.cos(b) - z1 * math.sin(b); z2 = Y * math.sin(b) + z1 * math.cos(b)
        k = ff / (ff + z2); pts.append((x1 * k, y2 * k))
    return np.float32(pts)

def warp_to(img, quad):
    """quad em pixels absolutos -> (imagem, x0, y0)"""
    h, w = img.shape[:2]
    x0, y0 = int(math.floor(quad[:, 0].min())) - 2, int(math.floor(quad[:, 1].min())) - 2
    x1, y1 = int(math.ceil(quad[:, 0].max())) + 2, int(math.ceil(quad[:, 1].max())) + 2
    if x1 - x0 < 2 or y1 - y0 < 2 or x1 < 0 or y1 < 0 or x0 > R.SW or y0 > R.SH: return None
    Mt = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), quad - np.float32([x0, y0]))
    out = cv2.warpPerspective(img, Mt, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    return out, x0, y0

def ellipse_map(w, h, blur):
    pad = int(blur * 3) + 2
    m = np.zeros((h + 2 * pad, w + 2 * pad), np.float32)
    cv2.ellipse(m, ((w + 2 * pad) // 2, (h + 2 * pad) // 2), (max(1, w // 2), max(1, h // 2)), 0, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(m, (0, 0), max(.5, blur)), pad

_IMG = {}
def load(name):
    if name not in _IMG: _IMG[name] = R.np_rgba(Image.open(f"cards/{name}.png"))
    return _IMG[name]

def glare(img, k=.10):
    """reflexo diagonal suave no vidro."""
    h, w = img.shape[:2]; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    g = np.clip(1 - np.abs((xx / w - yy / h * .6) - .15) / .25, 0, 1) * k
    o = img.copy(); o[..., :3] = np.clip(o[..., :3] + g[..., None] * img[..., 3:4], 0, 1); return o

# ------------------------------------------------------------ celular que cai do céu (Gustavo)
PH = None
def phone_cfg():
    global PH
    if PH is None:
        PH = R.M["phone"]; PH["land"] = PH.get("land", PH["entra"] + .55)
    return PH

# planos do Gustavo: base do celular (x, y do chão na margem do lago) e altura, em fração da imagem
PH_PLANES = [(37.53, 45.27, (.795, .872), .50, -14), (45.27, 51.77, (.855, .975), .60, -14)]

def phone_state(t):
    p = phone_cfg()
    for a, b, base, hfrac, ry in PH_PLANES:
        if a <= t < b: return base, hfrac, ry
    return None

def draw_phone(srcf, t, i):
    p = phone_cfg()
    if t < p["entra"] or t >= PH_PLANES[-1][1]: return False
    st = phone_state(t)
    if st is None: return False
    base, hfrac, ry0 = st
    t0, tl = p["entra"], p["land"]
    # tela atual (troca com crossfade)
    scr, prev, cf = p["telas"][0][0], None, 1.0
    for nm, ts in p["telas"]:
        if t >= ts: prev, scr, cf = scr, nm, R.cubic((t - ts) * R.FPS / 9)
    img = load("phone_" + scr)
    if prev and cf < 1: img = load("phone_" + prev) * (1 - cf) + img * cf
    img = glare(img, .09)
    hpx = hfrac * R.SH; wpx = hpx * img.shape[1] / img.shape[0]
    bx, by = base[0] * R.SW, base[1] * R.SH
    # queda com gravidade, quique curto e assentamento
    dy, rz, ry, vel, squash = 0.0, 0.0, ry0, 0.0, 1.0
    first_plane = t < PH_PLANES[0][1]
    if first_plane and t < tl:
        u = (t - t0) / (tl - t0); D = by + hpx * 1.15
        dy = -D * (1 - u * u); vel = 2 * D * u / (tl - t0) / R.FPS
        rz = 7 * (1 - u) * math.sin(u * 5); ry = ry0 + 26 * (1 - u)
    elif first_plane and t < tl + .5:
        e = t - tl
        dy = -abs(math.sin(e * 22)) * .022 * R.SH * math.exp(-e * 9)
        squash = 1 - .05 * math.exp(-e * 18) * math.cos(e * 30)
        rz = 1.6 * math.exp(-e * 8) * math.sin(e * 26)
    quad = project_plane(img, wpx, ry, 2.0, rz)
    quad[:, 1] *= squash
    bot = (quad[2] + quad[3]) / 2
    quad += np.float32([bx - bot[0], by + dy - bot[1]])
    # sombras no chão: cresce e escurece com a aproximação
    near = 1.0 if (not first_plane or t >= tl) else clampf((t - t0) / (tl - t0), 0, 1) ** 2
    sw_ = int(wpx * (1.25 + .9 * (1 - near))); sh_ = int(hpx * .07 * (1 + .6 * (1 - near)))
    em, pad = ellipse_map(sw_, sh_, 10 * R.SS * (1 + 2 * (1 - near)))
    shade(srcf, em, int(bx + .10 * wpx - sw_ / 2 - pad), int(by - sh_ / 2 - pad + 4 * R.SS), .55 * near)
    if near > .95:  # sombra de contato bem justa
        cm, pad2 = ellipse_map(int(wpx * 1.05), int(16 * R.SS), 4 * R.SS)
        shade(srcf, cm, int(bx - wpx * .525 - pad2), int(by - 8 * R.SS - pad2), .85)
        am, pad3 = ellipse_map(int(wpx * 1.6), int(60 * R.SS), 22 * R.SS)
        shade(srcf, am, int(bx - wpx * .8 - pad3), int(by - 30 * R.SS - pad3), .35)
    # reflexo na água (abaixo da margem), fraco e desfocado
    if near > .95:
        refl = np.flipud(img)[: int(img.shape[0] * .35)].copy(); refl[..., 3] *= np.linspace(.22, 0, refl.shape[0])[:, None]
        rq = project_plane(refl, wpx, ry, -2.0)
        top = (rq[0] + rq[1]) / 2; rq += np.float32([bx - top[0], by + dy + 6 * R.SS - top[1]])
        r = warp_to(refl, rq)
        if r: comp(srcf, premul_blur(r[0], 3 * R.SS), r[1], r[2])
    r = warp_to(img, quad)
    if r is None: return True
    out, x0, y0 = r
    out = motion_blur_v(out, min(vel * .45, 70 * R.SS))
    out = realism(premul_blur(out, 1.1 * R.SS), i, tint=(.55, .62, .40), amount=.07, contrast=.88)
    out = light_wrap(srcf, out, x0, y0)
    comp(srcf, out, x0, y0)
    return True

# partículas do impacto (determinísticas)
_PART = None
def particles(t):
    global _PART
    p = phone_cfg(); tl = p["land"]
    if not (tl <= t < tl + 1.3) or t >= PH_PLANES[0][1]: return []
    if _PART is None:
        g = rng(42); n = 110
        ang = g.uniform(-1.25, 1.25, n) - math.pi / 2          # para cima, abrindo
        sp = g.uniform(.25, 1.0, n)
        kind = g.choice([0, 1, 2], n, p=[.45, .35, .20])          # 0 terra, 1 folha, 2 poeira grande
        _PART = dict(ang=ang, sp=sp, kind=kind, x0=g.uniform(-.5, .5, n), size=g.uniform(.6, 1.4, n),
                     rot=g.uniform(0, 6.28, n), spin=g.uniform(-12, 12, n), life=g.uniform(.6, 1.2, n))
    return _PART

def draw_particles(srcf, t, i):
    P = particles(t)
    if not P: return
    p = phone_cfg(); e = t - p["land"]
    (bx, by), hfrac = PH_PLANES[0][2], PH_PLANES[0][3]
    bx *= R.SW; by *= R.SH; hpx = hfrac * R.SH; wpx = hpx * .476
    g = 2.6 * R.SH  # gravidade em px/s²
    # poeira (nuvem suave que abre na base)
    for k in range(10):
        a = clampf(1 - e / 1.1, 0, 1) * (.42 if k % 2 else .30)
        if a <= 0: continue
        side = -1 if k < 5 else 1; kk = k % 5
        rad = (18 + 50 * R.cubic(e / .9) * (1 + kk * .25)) * R.SS
        cx = bx + side * (wpx * .25 + (40 + kk * 38) * R.SS * R.cubic(e / .8))
        cy = by - (6 + kk * 6) * R.SS - 30 * R.SS * R.cubic(e / 1.2)
        em, pad = ellipse_map(int(rad * 2.4), int(rad * 1.4), rad * .45)
        col = np.array([.74, .69, .58], np.float32)
        h, w = em.shape; x0, y0 = int(cx - w / 2), int(cy - h / 2)
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
        if xa < xb and ya < yb:
            aa = em[ya - y0:yb - y0, xa - x0:xb - x0, None] * a
            srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - aa) + col * aa
    # terra e folhas (balísticas)
    cols = [np.array(c, np.float32) / 255 for c in ((78, 60, 40), (66, 92, 38), (150, 135, 105))]
    for k in range(len(P["ang"])):
        if e > P["life"][k]: continue
        v = P["sp"][k] * (1.4 if P["kind"][k] == 0 else .9) * R.SH
        x = bx + P["x0"][k] * wpx + math.cos(P["ang"][k]) * v * e
        y = by + math.sin(P["ang"][k]) * v * e + .5 * g * e * e
        if y > by + 8 * R.SS: continue
        a = clampf(1 - e / P["life"][k], 0, 1) ** .6
        sz = P["size"][k] * (4.2 if P["kind"][k] == 0 else 7.0 if P["kind"][k] == 1 else 3.0) * R.SS
        c = cols[P["kind"][k]]
        rot = P["rot"][k] + P["spin"][k] * e
        box = cv2.boxPoints(((x, y), (sz * (2.2 if P["kind"][k] == 1 else 1.2), sz), math.degrees(rot))).astype(np.int32)
        x0, y0 = box[:, 0].min() - 2, box[:, 1].min() - 2; x1, y1 = box[:, 0].max() + 3, box[:, 1].max() + 3
        if x1 <= 0 or y1 <= 0 or x0 >= R.SW or y0 >= R.SH: continue
        m = np.zeros((y1 - y0, x1 - x0), np.float32); cv2.fillConvexPoly(m, box - [x0, y0], 1.0, cv2.LINE_AA)
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x1), min(R.SH, y1)
        aa = m[ya - y0:yb - y0, xa - x0:xb - x0, None] * a
        srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - aa) + c * aa

def shake(t):
    p = phone_cfg(); e = t - p["land"]
    if not (0 <= e < .5) or t >= PH_PLANES[0][1]: return 0.0, 0.0
    amp = 9 * math.exp(-e * 8)
    return amp * math.sin(e * 71), amp * .8 * math.cos(e * 53)

# ------------------------------------------------------------ painéis 3D ancorados no ambiente
# (card, entra, sai, base x, base y, altura, rotY, rotX, desfoque, entrada, reflexo)
PAINEIS = [
    ("importer", 7.75, 9.35, .79, .40, .34, -6, -58, .6, "pousa", False),      # deitado na grama, ao lado do Fábio
    ("dashboard", 18.55, 20.35, .845, .80, .40, -24, 2, 2.2, "sobe", False),   # Higor B: "o painel mostra gráficos"
    ("dups", 20.35, 22.40, .165, .80, .40, 24, 2, 2.2, "sobe", False),        # Higor B: "duplicados"
    ("importer", 23.55, 25.60, .875, .74, .36, -22, 2, 2.4, "sobe", True),     # Marielly: "você importa"
    ("library", 25.75, 28.30, .165, .74, .40, 22, 2, 2.4, "sobe", True),      # "biblioteca pesquisável com tags"
    ("library", 33.10, 36.50, .165, .74, .40, 22, 2, 2.4, "sobe", True),      # "em breve no computador"
]

def draw_panels(srcf, t, i):
    for nm, a, b, x, y, hf, ry, rx, dof, kind, refl in PAINEIS:
        if not (a <= t < b + .4) or R.cena_idx(t + .5 / R.FPS) != R.cena_idx(a): continue
        fi = (t - a) * R.FPS; fo = (t - b) * R.FPS
        img = load(nm)
        if 0 <= fi < 24: img = R.sweep(img, fi / 24)
        hpx = hf * R.SH; wpx = hpx * img.shape[1] / img.shape[0]
        bx, by = x * R.SW, y * R.SH
        al = 1.0; rise = 0.0; drop = 0.0; ryy = ry + 2.5 * math.sin((t - a) * 1.1)
        if kind == "sobe":
            rise = 1 - R.quint(fi / 18)
            if fo > 0: rise = R.cubic(fo / 12)
            ryy += 30 * (1 - R.cubic(fi / 20)) * (1 if ry > 0 else -1)
        else:  # pousa na grama
            drop = 1 - R.back(fi / 14, 1.2); al = R.cubic(fi / 6)
            if fo > 0: al *= 1 - R.cubic(fo / 9); drop = -.4 * R.cubic(fo / 9)
        if al <= 0: continue
        quad = project_plane(img, wpx, ryy, rx)
        bot = (quad[2] + quad[3]) / 2
        if kind == "sobe":
            quad += np.float32([bx - bot[0], by - bot[1] + rise * (hpx * 1.05)])
        else:
            cen = quad.mean(0); quad = (quad - cen) * (1 + .25 * drop) + np.float32([bx, by])
            # sombra no chão (aparece quando encosta)
            sm, pad = ellipse_map(int(wpx * 1.0), int(hpx * .55), 14 * R.SS * (1 + drop * 2))
            shade(srcf, sm, int(bx - wpx * .5 - pad + 18 * R.SS), int(by - hpx * .27 - pad + 22 * R.SS), .42 * al * (1 - .6 * abs(drop)))
        if refl and kind == "sobe":
            rimg = np.flipud(img).copy(); rimg[..., 3] *= np.linspace(.20, 0, rimg.shape[0])[:, None]
            rq = quad.copy(); rq[:, 1] = 2 * (by + rise * hpx * 1.05) - rq[:, 1]; rq = rq[[3, 2, 1, 0]]
            r = warp_to(rimg, rq)
            if r: comp(srcf, premul_blur(r[0], 4 * R.SS), r[1], r[2], al, )
        r = warp_to(img, quad)
        if r is None: continue
        out, x0, y0 = r
        # espessura (borda lateral escura) para não parecer adesivo
        th = np.zeros_like(out); th[..., 3] = out[..., 3]; th[..., :3] = .04
        off = int((5 if ry < 0 else -5) * R.SS)
        out = realism(premul_blur(out, dof * R.SS), i, tint=(.45, .55, .35), amount=.06)
        comp(srcf, premul_blur(th, dof * R.SS), x0 + off, y0 + int(3 * R.SS), al * .9, clip_y=by if kind == "sobe" else None)
        comp(srcf, out, x0, y0, al, clip_y=by if kind == "sobe" else None)

# ------------------------------------------------------------ gráfico que cresce atrás do Higor (ref "chart grow")
CHART = (14.10, 17.95)
def draw_chart(srcf, t, i):
    a, b = CHART
    if not (a <= t < b + .35): return
    col = np.array(R.hexrgb("#4FB3E8"), np.float32) / 255
    fi = (t - a) * R.FPS; fo = (t - b) * R.FPS
    al = 1 - R.cubic(fo / 10) if fo > 0 else 1
    p = R.inout(fi / 70)                                     # desenha a linha em ~2,3 s
    X0, X1, Yb = .06 * R.SW, .94 * R.SW, .66 * R.SH
    pts_n = [(0, .05), (.12, .18), (.22, .12), (.34, .32), (.46, .27), (.58, .48), (.70, .44), (.82, .70), (1, .92)]
    pts = np.array([(X0 + u * (X1 - X0), Yb - v * .42 * R.SH) for u, v in pts_n], np.float32)
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]; L = seg[-1] * p
    draw = [pts[0]]
    for k in range(1, len(pts)):
        if seg[k] <= L: draw.append(pts[k])
        else:
            u = (L - seg[k - 1]) / (seg[k] - seg[k - 1]); draw.append(pts[k - 1] + (pts[k] - pts[k - 1]) * u); break
    draw = np.array(draw)
    x0, y0 = int(X0 - 40 * R.SS), int(Yb - .52 * R.SH); w, h = int(X1 - X0 + 80 * R.SS), int(.56 * R.SH)
    lay = np.zeros((h, w), np.float32); glow = np.zeros((h, w), np.float32)
    # grade fina
    for k in range(5):
        yy = int(Yb - y0 - k * .105 * R.SH)
        cv2.line(lay, (int(40 * R.SS), yy), (w - int(40 * R.SS), yy), .18 * R.cubic(fi / 12), max(1, int(1.2 * R.SS)), cv2.LINE_AA)
    pl = (draw - [x0, y0]).astype(np.int32).reshape(-1, 1, 2)
    if len(pl) > 1:
        cv2.polylines(lay, [pl], False, 1.0, max(2, int(5 * R.SS)), cv2.LINE_AA)
        cv2.polylines(glow, [pl], False, 1.0, max(4, int(16 * R.SS)), cv2.LINE_AA)
        for q in pts:  # pontos já alcançados
            if q[0] <= draw[-1][0] + 1: cv2.circle(lay, (int(q[0] - x0), int(q[1] - y0)), int(7 * R.SS), 1.0, -1, cv2.LINE_AA)
        hx, hy = draw[-1] - [x0, y0]
        cv2.circle(glow, (int(hx), int(hy)), int(26 * R.SS), 1.0, -1, cv2.LINE_AA)
        cv2.circle(lay, (int(hx), int(hy)), int(10 * R.SS), 1.0, -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 14 * R.SS) * .55
    m = R._PM
    for layer, c, op in ((glow, col, .9), (lay, col * .55 + .45, 1.0)):
        a_ = np.clip(layer * op * al, 0, 1)
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
        aa = a_[ya - y0:yb - y0, xa - x0:xb - x0, None]
        if m is not None: aa = aa * (1 - m[ya:yb, xa:xb, None])
        srcf[ya:yb, xa:xb] = srcf[ya:yb, xa:xb] * (1 - aa) + c * aa

# ------------------------------------------------------------ nomes: principal + eco em contorno + rótulo
def outline_text(txt, px, col=(255, 255, 255, 255), stroke=2):
    k = ("outl", txt, int(px), stroke)
    if k in R._cache: return R._cache[k]
    f = R.font("anton", px); bb = f.getbbox(txt, stroke_width=stroke)
    im = Image.new("RGBA", (bb[2] - bb[0] + 8, bb[3] - bb[1] + 8), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4 - bb[0], 4 - bb[1]), txt, font=f, fill=(0, 0, 0, 0), stroke_width=stroke, stroke_fill=col)
    R._cache[k] = R.np_rgba(im); return R._cache[k]

def draw_names(srcf, t, i, m):
    for n, tn, D, modo in R.M["nomes"]:
        if not (tn <= t < tn + D): continue
        tr = R.track(t)
        if tr is None: continue
        cx, cy, h = tr; col = R.hexrgb(R.CENAS[R.cena_idx(tn)][3]); hpx = h * 1080
        f_ = (t - tn) * R.FPS; fo = (t - (tn + D - .32)) * R.FPS
        out_k = R.cubic(fo / 9) if fo > 0 else 0.0
        if modo == "acima": px = clampf(hpx * 1.15, 120, 300) * R.SS
        else:
            px = clampf(hpx * .80, 130, 250) * R.SS
            off, nsc = name_offset(n, tn, modo, px); px *= nsc
        main = R.kinetic_line(n, "anton", px, (255, 255, 255, 255), f_, stagger=1.5, dur=9)
        if 4 <= f_ <= 26:  # faixa de luz
            hh, ww = main.shape[:2]; xx = np.arange(ww)[None, :] / ww
            band = np.exp(-((xx - (f_ - 4) / 18 * 1.4 + .2) / .06) ** 2)[..., None] * .8
            main = main.copy(); main[..., :3] = np.clip(main[..., :3] + band * main[..., 3:4], 0, 1)
        th, tw = main.shape[:2]
        if modo == "acima":
            x = cx * R.SW; y = max((cy - .62 * h) * R.SH - th * .2, th * .5 + 14 * R.SS); edir = -1
        else:
            y = (cy - .28 * h) * R.SH
            x = cx * R.SW + off
            x = clampf(x, tw / 2 + 30 * R.SS, R.SW - tw / 2 - 30 * R.SS); edir = 1
        y -= out_k * 30 * R.SS
        al = 1 - out_k
        # eco: 3 cópias em contorno que deslizam a partir do nome
        ol = outline_text(n, px, stroke=max(2, int(2 * R.SS)))
        for k, a_ in ((2, .16), (1, .34)):
            pk = R.quint((f_ - 3 - k * 2.5) / 10) * (1 - R.cubic((t - (tn + D - .7)) * R.FPS / 10) if t > tn + D - .7 else 1)
            if pk <= 0: continue
            yy = y + edir * k * th * .62 * pk
            occl(srcf, ol, x, yy, m, a_ * pk * al)
        occl(srcf, R.with_shadow(main, 22, .35, 8, .2, R.SS), x, y, m, al)
        # rótulo + traço
        k_ = ("lbl", n)
        if k_ not in R._cache: R._cache[k_] = R.np_rgba(R.pil_text("USB Intelligence", "ital", 54 * R.SS, col + (255,))[0])
        lb = R._cache[k_]; a2 = R.cubic((f_ - 6) / 8) * al
        if a2 > 0:
            if modo == "acima": lx = x + tw * .18
            elif modo == "dir": lx = x + tw / 2 - lb.shape[1] / 2
            else: lx = x - tw / 2 + lb.shape[1] / 2 + 6 * R.SS
            ly = y - th * .5 - 2 * R.SS + (1 - a2) * 10 * R.SS
            if ly - lb.shape[0] / 2 < 8 * R.SS: ly = y + th * .5 + lb.shape[0] * .3
            R.blit_src(srcf, R.with_shadow(lb, 10, .35, 3, .2, R.SS), lx, ly, a2)

_OFF = {}
def name_offset(n, tn, modo, px):
    """acha (deslocamento, escala) para o nome ao lado da cabeça: no máximo ~12% escondido e dentro da tela."""
    if n in _OFF: return _OFF[n]
    tt = tn + 1.0; i = int(round(tt * R.FPS)); tr = R.track(tt)
    cx, cy, h = tr; y = (cy - .28 * h) * R.SH
    m = person_mask(i, tt); sgn = -1 if modo == "esq" else 1
    res = None
    for sc in (1.0, .9, .8, .7, .62, .55):
        full = R.kinetic_line(n, "anton", px * sc, (255, 255, 255, 255), 99)
        th, tw = full.shape[:2]
        for step in range(0, 40):
            off = sgn * (tw / 2 + (-.10 + step * .02) * h * R.SH)
            x = cx * R.SW + off; x0, y0 = int(x - tw / 2), int(y - th / 2)
            if x0 < 24 * R.SS or x0 + tw > R.SW - 24 * R.SS: break
            xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + tw), min(R.SH, y0 + th)
            a = full[ya - y0:yb - y0, xa - x0:xb - x0, 3]
            frac = float((a * m[ya:yb, xa:xb]).sum() / max(1.0, full[..., 3].sum()))
            if frac < .04: res = (off + sgn * .04 * h * R.SH, sc); break
        if res: break
    _OFF[n] = res or (sgn * px, .55); return _OFF[n]

def occl(srcf, spr, cx, cy, m, alpha):
    R.occluded_blit(srcf, spr, cx, cy, m, alpha)

# ------------------------------------------------------------ "clara" e "visual" saindo das mãos do Enrique
HANDS = None
def hand_track():
    global HANDS
    if HANDS is None:
        raw = json.load(open("hands.json")); n = len(raw); ts = np.array([r["t"] for r in raw])
        out = {}
        for s in ("L", "R"):
            ok = np.array([s in r and r[s][2] > 4000 for r in raw])
            if ok.sum() < 2: out[s] = None; continue
            xs = np.array([r[s][0] if s in r else np.nan for r in raw]); ys = np.array([r[s][1] if s in r else np.nan for r in raw])
            x = np.interp(ts, ts[ok], xs[ok]); y = np.interp(ts, ts[ok], ys[ok])
            ker = np.exp(-.5 * (np.arange(-6, 7) / 2.5) ** 2); ker /= ker.sum()
            out[s] = (ts, np.convolve(np.pad(x, 6, mode="edge"), ker, "valid"), np.convolve(np.pad(y, 6, mode="edge"), ker, "valid"))
        HANDS = out
    return HANDS

MAOS = [("clara", 61.80, "L", "anton"), ("visual", 62.30, "R", "ital")]
def hand_pos(s, t):
    H = hand_track()[s]
    if H is None: return None
    ts, x, y = H; tt = min(t, R.FIM - .02)
    return float(np.interp(tt, ts, x)), float(np.interp(tt, ts, y))

def draw_hand_words(srcf, t, i):
    for word, t0, s, fk in MAOS:
        if t < t0 or t >= R.M["fim_video"] + R.M["congela"]: continue
        hp = hand_pos(s, t)
        if hp is None: continue
        hx, hy = hp[0] * R.SW, hp[1] * R.SH
        f_ = (t - t0) * R.FPS
        col = (255, 255, 255, 255) if fk == "anton" else R.hexrgb("#F0B45A") + (255,)
        px = (175 if fk == "anton" else 190) * R.SS
        k = ("hw", word)
        if k not in R._cache: R._cache[k] = R.np_rgba(R.pil_text(word, fk, px, col)[0])
        spr = R._cache[k]
        p = R.back(f_ / 11, 1.3)                       # nasce da mão: escala pequena -> normal, subindo
        sc = .15 + .85 * clampf(p, 0, 1.2)
        s2 = R.scale_spr(R.with_shadow(spr, 18, .45, 6, .3, R.SS), sc)
        lift = (spr.shape[0] * .75 + 30 * R.SS) * R.quint(f_ / 10)
        cxw = clampf(hx, s2.shape[1] / 2 + 20 * R.SS, R.SW - s2.shape[1] / 2 - 20 * R.SS)
        R.blit_src(srcf, s2, cxw, hy - lift, clampf(f_ / 3, 0, 1))
        # brilho/faíscas saindo da mão
        if f_ < 16:
            g = rng(hash(word) % 1000)
            for q in range(14):
                ang = g.uniform(-math.pi * .95, -math.pi * .05); sp = g.uniform(.4, 1.0)
                d = sp * 140 * R.SS * R.cubic(f_ / 14)
                px_, py_ = hx + math.cos(ang) * d, hy + math.sin(ang) * d
                a = clampf(1 - f_ / 16, 0, 1)
                r = max(1, int((2 + 3 * sp) * R.SS))
                cv2.circle(srcf, (int(px_), int(py_)), r, tuple(float(v) for v in (np.array(col[:3]) / 255 * a + srcf[min(R.SH - 1, max(0, int(py_))), min(R.SW - 1, max(0, int(px_)))] * (1 - a))), -1, cv2.LINE_AA)

# ------------------------------------------------------------ ícones animados (traço que se desenha)
def _circle(cx, cy, r, a0=0, a1=360, n=40):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]
ICONS = {
    "usb": [[(.30, .95), (.30, .35), (.70, .35), (.70, .95), (.30, .95)], [(.38, .35), (.38, .08), (.62, .08), (.62, .35)], [(.45, .16), (.45, .24)], [(.55, .16), (.55, .24)]],
    "chart": [[(.1, .1), (.1, .9), (.92, .9)], [(.18, .72), (.38, .52), (.55, .62), (.86, .22)], [(.74, .22), (.86, .22), (.86, .34)]],
    "copy": [[(.1, .3), (.1, .95), (.62, .95), (.62, .3), (.1, .3)], [(.35, .3), (.35, .05), (.9, .05), (.9, .7), (.62, .7)]],
    "search": [_circle(.42, .42, .3), [(.64, .64), (.92, .92)]],
    "cable": [[(.15, .85), (.15, .55), (.35, .55), (.35, .85), (.15, .85)], [(.25, .55), (.25, .30), (.45, .12), (.75, .12)], [(.75, .04), (.95, .04), (.95, .20), (.75, .20), (.75, .04)]],
    "laptop": [[(.18, .70), (.18, .15), (.82, .15), (.82, .70)], [(.05, .70), (.95, .70), (.88, .86), (.12, .86), (.05, .70)]],
    "wifi": [_circle(.5, .85, .70, 225, 315), _circle(.5, .85, .47, 225, 315), _circle(.5, .85, .24, 225, 315), [(.08, .05), (.92, .92)]],
    "spark": [[(.5, .05), (.58, .42), (.95, .5), (.58, .58), (.5, .95), (.42, .58), (.05, .5), (.42, .42), (.5, .05)]],
    "toggle": [_circle(.3, .5, .25, 90, 270, 20) + _circle(.7, .5, .25, -90, 90, 20) + [(.3, .75)]],
    "script": [[(.15, .05), (.65, .05), (.85, .25), (.85, .95), (.15, .95), (.15, .05)], [(.3, .4), (.7, .4)], [(.3, .58), (.7, .58)], [(.3, .76), (.55, .76)]],
    "rec": [[(.05, .25), (.68, .25), (.68, .80), (.05, .80), (.05, .25)], [(.68, .42), (.95, .28), (.95, .77), (.68, .63)]],
    "cut": [[(.05, .2), (.95, .2), (.95, .8), (.05, .8), (.05, .2)], [(.4, .2), (.4, .8)], [(.68, .2), (.68, .8)]],
    "send": [[(.05, .45), (.95, .08), (.62, .95), (.47, .58), (.05, .45)], [(.47, .58), (.95, .08)]],
}
def icon_sprite(name, size, p, col, extra=0.0):
    pad = int(size * .12); S2 = size + 2 * pad
    lay = np.zeros((S2 * 2, S2 * 2), np.float32)
    polys = [np.array(pl, np.float32) for pl in ICONS[name]]
    lens = [np.r_[0, np.cumsum(np.linalg.norm(np.diff(pl, axis=0), axis=1))] for pl in polys]
    tot = sum(l[-1] for l in lens); L = tot * p; lw = max(2, int(size * .075 * 2))
    for pl, ls in zip(polys, lens):
        if L <= 0: break
        use = min(L, ls[-1]); pts = [pl[0]]
        for k in range(1, len(pl)):
            if ls[k] <= use: pts.append(pl[k])
            else:
                u = (use - ls[k - 1]) / max(1e-6, ls[k] - ls[k - 1]); pts.append(pl[k - 1] + (pl[k] - pl[k - 1]) * u); break
        q = ((np.array(pts) * size + pad) * 2).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(lay, [q], False, 1.0, lw, cv2.LINE_AA); L -= ls[-1]
    if name == "toggle" and p >= 1:  # bolinha do interruptor liga
        u = R.back(extra, 1.4); cx = (.3 + .4 * clampf(u, 0, 1.1)) * size + pad
        cv2.circle(lay, (int(cx * 2), int((.5 * size + pad) * 2)), int(size * .17 * 2), 1.0, -1, cv2.LINE_AA)
    lay = cv2.resize(lay, (S2, S2), interpolation=cv2.INTER_AREA)
    out = np.zeros((S2, S2, 4), np.float32); out[..., :3] = np.array(col[:3], np.float32) / 255; out[..., 3] = lay
    return out

# ------------------------------------------------------------ transições variadas
def transition(fr, t, cuts):
    W, H, S = R.W, R.H, R.S
    for tc, kind in cuts:
        d = (t - tc) * R.FPS
        if not (-6 <= d < 6): continue
        k = max(0.0, 1 - abs(d + .5) / 6.0)
        if kind in ("whip_h", "whip_v"):
            if abs(d + .5) > 4.5: continue
            k = 1 - abs(d + .5) / 4.5; L = int(110 * S * k) | 1
            ker = np.zeros((1, L), np.float32) if kind == "whip_h" else np.zeros((L, 1), np.float32)
            ker[...] = 1 / L
            fr = cv2.filter2D(fr, -1, ker, borderType=cv2.BORDER_REFLECT)
            sh = (-1 if d < 0 else 1) * 70 * S * k
            Mx = np.float32([[1, 0, sh], [0, 1, 0]]) if kind == "whip_h" else np.float32([[1, 0, 0], [0, 1, sh]])
            fr = cv2.warpAffine(fr, Mx, (W, H), borderMode=cv2.BORDER_REFLECT)
        elif kind == "zoom":
            # entra "atravessando" a imagem: escala + desfoque radial aproximado por cópias
            z = 1 + (.45 * R.inout((d + 6) / 6) if d < 0 else .45 * (1 - R.cubic(d / 6)))
            acc = np.zeros_like(fr); n = 6
            for j in range(n):
                zz = z * (1 + .045 * k * j)
                Mx = cv2.getRotationMatrix2D((W / 2, H / 2), 0, zz)
                acc += cv2.warpAffine(fr, Mx, (W, H), borderMode=cv2.BORDER_REFLECT)
            fr = acc / n
            fr = np.clip(fr * (1 + .25 * k ** 2), 0, 1)
        elif kind == "leak":
            # luz quente que varre a tela (vazamento de luz) + leve estouro
            yy, xx = np.mgrid[0:H:4, 0:W:4].astype(np.float32)
            cxl = (-.3 + 1.6 * R.inout((d + 6) / 12)) * W
            g = np.exp(-(((xx - cxl) / (W * .32)) ** 2 + ((yy - H * .35) / (H * .75)) ** 2))
            g = cv2.resize(g, (W, H)) * (.95 * k ** .8)
            leak = np.dstack([g * 1.0, g * .62, g * .30]).astype(np.float32)
            fr = 1 - (1 - fr) * (1 - leak)
            fr = np.clip(fr * (1 + .18 * k ** 2), 0, 1)
    return fr
