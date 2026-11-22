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

class Layer:
    """camada do mundo: cor pré-multiplicada P, alfa A e escurecimento D (sombras)."""
    def __init__(self, h, w):
        self.P = np.zeros((h, w, 3), np.float32); self.A = np.zeros((h, w, 1), np.float32); self.D = np.ones((h, w, 1), np.float32)

def blend(tg, ya, yb, xa, xb, rgb, aa):
    """aplica 'over' com alfa aa (h,w,1) e cor rgb (h,w,3 ou 3) em srcf ou Layer."""
    if isinstance(tg, Layer):
        tg.P[ya:yb, xa:xb] = tg.P[ya:yb, xa:xb] * (1 - aa) + rgb * aa
        tg.A[ya:yb, xa:xb] = tg.A[ya:yb, xa:xb] * (1 - aa) + aa
    else:
        tg[ya:yb, xa:xb] = tg[ya:yb, xa:xb] * (1 - aa) + rgb * aa

def darken(tg, ya, yb, xa, xb, s):
    if isinstance(tg, Layer): tg.D[ya:yb, xa:xb] *= (1 - s)
    else: tg[ya:yb, xa:xb] *= (1 - s)

_BG = None   # quadro original (para luz de borda)

# ---------- tracking de câmera (homografias por cena, de camtrack.json)
_CT = None
def cam_H(i):
    global _CT
    if _CT is None:
        _CT = json.load(open("camtrack.json"))
        _CT = [(d["i0"], [np.array(h, np.float64) for h in d["H"]]) for _, d in sorted(_CT.items(), key=lambda kv: int(kv[0]))]
    for i0, Hs in reversed(_CT):
        if i >= i0:
            k = min(i - i0, len(Hs) - 1); S = np.diag([R.SW / 960, R.SH / 540, 1.0])
            return i0, S @ Hs[k] @ np.linalg.inv(S)
    return 0, np.eye(3)

def track_G(td, t):
    """homografia que leva a posição desenhada no instante td para o quadro do instante t (mesma cena)."""
    i = min(int(round(t * R.FPS)), R.NF - 1); j = min(int(round(td * R.FPS)), R.NF - 1)
    a, Hi = cam_H(i); b, Hj = cam_H(j)
    if a != b: return np.eye(3)
    return Hi @ np.linalg.inv(Hj)

def apply_layer(srcf, L, G):
    if not np.allclose(G, np.eye(3), atol=1e-4):
        sz = (R.SW, R.SH)
        P = cv2.warpPerspective(L.P, G, sz, flags=cv2.INTER_LINEAR)
        A = cv2.warpPerspective(L.A, G, sz, flags=cv2.INTER_LINEAR)[..., None]
        D = cv2.warpPerspective(L.D, G, sz, flags=cv2.INTER_LINEAR, borderValue=1.0)[..., None]
    else: P, A, D = L.P, L.A, L.D
    srcf *= D
    srcf[:] = srcf * (1 - A) + P

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
    src = _BG if _BG is not None else srcf
    bg = np.zeros((h, w, 3), np.float32); bg[ya - y0:yb - y0, xa - x0:xb - x0] = src[ya:yb, xa:xb]
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
    blend(srcf, ya, yb, xa, xb, s[..., :3], a)

def shade(srcf, sh, x0, y0, op):
    """escurece (sombra) com um mapa de alfa."""
    h, w = sh.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
    if xa >= xb or ya >= yb: return
    s = sh[ya - y0:yb - y0, xa - x0:xb - x0, None] * op
    darken(srcf, ya, yb, xa, xb, s)

def project_plane(img, wpx, ry, rx, rz=0.0, f=1600.0, z=0.0):
    """projeta um plano (card) girado; devolve imagem deformada e os 4 cantos relativos ao centro."""
    h, w = img.shape[:2]; hh = wpx * h / w; ff = f * R.SS
    a, b, c = math.radians(ry), math.radians(rx), math.radians(rz)
    pts = []
    for X, Y in ((-wpx / 2, -hh / 2), (wpx / 2, -hh / 2), (wpx / 2, hh / 2), (-wpx / 2, hh / 2)):
        X, Y = X * math.cos(c) - Y * math.sin(c), X * math.sin(c) + Y * math.cos(c)
        x1 = X * math.cos(a) - z * math.sin(a); z1 = X * math.sin(a) + z * math.cos(a)
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
_LOOK = {}
def _drops_overlay(h, w):
    """gotas d'água no vidro (espaço do sprite): devolve (escurecimento, luz) — estáticas, sem 'vida'.
    gota real: borda escura fina, foco de luz embaixo (lente) e brilho pequeno em cima."""
    g = rng(11); dk = np.zeros((h, w), np.float32); lt = np.zeros((h, w), np.float32); u = w / 600
    def drop(x, y, r, ey):
        # corpo levemente mais claro (a água espalha a luz sobre a tela escura), borda escura bem fina,
        # e um brilho pequeno e suave no alto
        cv2.ellipse(lt, (int(x), int(y)), (int(r), int(ey)), 0, 0, 360, .07, -1, cv2.LINE_AA)
        cv2.ellipse(dk, (int(x), int(y)), (int(r), int(ey)), 0, 0, 360, .22, max(1, int(r * .12)), cv2.LINE_AA)
        cv2.circle(lt, (int(x - r * .28), int(y - ey * .38)), max(1, int(r * .20)), .55, -1, cv2.LINE_AA)
    for _ in range(46):
        r = g.uniform(7, 20) * u; drop(g.uniform(.06, .94) * w, (g.uniform(.30, 1.0) ** .6) * h, r, r * g.uniform(1.0, 1.35))
    for _ in range(6):   # escorridos: rastro molhado + gota na ponta
        x = g.uniform(.1, .9) * w; y0 = g.uniform(.35, .75) * h; L = g.uniform(60, 170) * u; wd = g.uniform(7, 11) * u
        cv2.line(lt, (int(x), int(y0)), (int(x), int(y0 + L)), .05, int(wd), cv2.LINE_AA)
        cv2.line(dk, (int(x + wd * .5), int(y0)), (int(x + wd * .5), int(y0 + L)), .10, max(1, int(wd * .15)), cv2.LINE_AA)
        drop(x, y0 + L, wd * 1.2, wd * 1.5)
    return cv2.GaussianBlur(dk, (0, 0), 1.2 * u), cv2.GaussianBlur(lt, (0, 0), 1.4 * u)
def phone_look(name, wet):
    """sprite do celular com volume: sombreamento (lado que vira para longe e base perto da água mais escuros),
    aro de metal com brilho em cima, e gotas d'água depois que cai."""
    k = (name, wet)
    if k in _LOOK: return _LOOK[k]
    img = glare(load(name), .09).copy(); h, w = img.shape[:2]; a = img[..., 3]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sh = (1 - .30 * np.clip((yy / h - .62) / .38, 0, 1) ** 1.5) * (.90 + .10 * (1 - xx / w))
    img[..., :3] *= sh[..., None]
    er = cv2.erode((a > .5).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    rim = np.clip(a - er, 0, 1) * (.25 + .55 * np.clip(1 - yy / (h * .5), 0, 1))
    img[..., :3] = np.clip(img[..., :3] + rim[..., None] * .55, 0, 1)
    if wet:
        dk, lt = _drops_overlay(h, w)
        img[..., :3] = np.clip(img[..., :3] * (1 - dk[..., None]) + lt[..., None] * np.float32([.92, .96, 1.0]), 0, 1)
    _LOOK[k] = img; return img
def phone_side(h, w):
    """cor da lateral de metal (grafite com reflexo do céu em cima)."""
    if ("side", h, w) in _LOOK: return _LOOK[("side", h, w)]
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    base = .16 + .30 * np.exp(-((yy - .08) / .10) ** 2) + .10 * np.exp(-((yy - .55) / .25) ** 2)
    rgb = np.repeat(base[..., None], 3, 2) * np.float32([.96, 1.0, 1.04]) * np.ones((1, w, 1), np.float32)
    _LOOK[("side", h, w)] = rgb; return rgb
PH = None
def phone_cfg():
    global PH
    if PH is None:
        PH = R.M["phone"]; PH["land"] = PH.get("land", PH["entra"] + .55)
    return PH

# planos do Gustavo: base do celular NA ÁGUA (x, y da linha d'água) e altura, em fração da imagem
PH_PLANES = [(37.53, 45.27, (.705, .955), .84, -16), (45.27, 51.77, (.765, 1.035), .98, -16)]

def phone_state(t):
    for a, b, base, hfrac, ry in PH_PLANES:
        if a <= t < b: return base, hfrac, ry
    return None

def wave_rows(img, amp, freq, phase):
    """ondulação horizontal por linha (água)."""
    h, w = img.shape[:2]
    ys = np.arange(h, dtype=np.float32)
    dx = (amp * np.sin(ys / freq + phase) * np.linspace(.3, 1, h)).astype(np.float32)
    mx = np.tile(np.arange(w, dtype=np.float32), (h, 1)) + dx[:, None]
    my = np.tile(ys[:, None], (1, w))
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

def draw_phone(srcf, t, i):
    p = phone_cfg()
    if t < p["entra"] or t >= PH_PLANES[-1][1]: return False
    st = phone_state(t)
    if st is None: return False
    base, hfrac, ry = st
    t0, tl = p["entra"], p["land"]
    scr, prev, cf = p["telas"][0][0], None, 1.0
    for nm, ts in p["telas"]:
        if t >= ts: prev, scr, cf = scr, nm, R.cubic((t - ts) * R.FPS / 9)
    wet = (not (t < PH_PLANES[0][1])) or t >= tl + .12
    img = phone_look("phone_" + scr, wet)
    if prev and cf < 1: img = phone_look("phone_" + prev, wet) * (1 - cf) + img * cf
    hpx = hfrac * R.SH; wpx = hpx * img.shape[1] / img.shape[0]
    bx, wy = base[0] * R.SW, base[1] * R.SH                 # wy = linha d'água
    first = t < PH_PLANES[0][1]
    dy, vel, rz = 0.0, 0.0, 0.0
    if first and t < tl:                                     # queda livre
        u = (t - t0) / (tl - t0); D = wy + hpx * 1.1
        dy = -D * (1 - u * u); vel = 2 * D * u / (tl - t0) / R.FPS
        rz = 5 * (1 - u) * math.sin(u * 4)
    elif first and t < tl + .45:                              # afunda um pouco e volta (só uma vez)
        e = (t - tl) / .45
        dy = math.sin(math.pi * e) * .035 * R.SH * (1 - e * .3)
    quad = project_plane(img, wpx, ry, 1.0, rz)
    bot = (quad[2] + quad[3]) / 2
    sink = .05 * hpx                                          # parte que fica dentro da água
    offv = np.float32([bx - bot[0], wy + sink + dy - bot[1]])
    quad += offv
    # espessura real (~8,5 mm num celular de 75 mm): camadas da lateral de metal, de trás para a frente
    T = wpx * .11; NL = max(8, int(10 * R.SS))
    side = np.dstack([phone_side(img.shape[0], img.shape[1]), img[..., 3:4]])
    settled0 = not first or t >= tl
    for k in range(NL, 0, -1):
        u = k / NL
        q2 = project_plane(img, wpx, ry, 1.0, rz, z=T * u) + offv
        rs = warp_to(side * np.float32([1 - .25 * u, 1 - .25 * u, 1 - .25 * u, 1]), q2)
        if rs is None: continue
        so, sx, sy = rs
        if settled0: comp(srcf, so, sx, sy, clip_y=None)
        else: comp(srcf, so, sx, sy, clip_y=wy + 2 * R.SS)
    r = warp_to(img, quad)
    if r is None: return True
    out, x0, y0 = r
    out = motion_blur_v(out, min(vel * .45, 70 * R.SS))
    out = realism(out, i, tint=(.55, .62, .40), amount=.04, contrast=.96, grain=0)
    out = light_wrap(srcf, out, x0, y0)
    env = _BG if _BG is not None else srcf
    hh_, ww_ = out.shape[:2]; xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + ww_), min(R.SH, y0 + hh_)
    if xa < xb and ya < yb:   # o vidro reflete o mato à frente (espelhado e desfocado)
        ev = np.zeros((hh_, ww_, 3), np.float32); ev[ya - y0:yb - y0, xa - x0:xb - x0] = env[ya:yb, xa:xb]
        ev = cv2.GaussianBlur(np.fliplr(ev), (0, 0), 14 * R.SS)
        out[..., :3] = np.clip(out[..., :3] + ev * .13, 0, 1)
    settled = not first or t >= tl
    if settled:
        ph = t * 2.2
        # reflexo ondulado na água (abaixo da linha d'água)
        hcut = int(max(1, min(out.shape[0], wy - y0)))
        top = out[:hcut]
        refl = np.flipud(top).copy()
        refl[..., :3] *= .55; refl[..., 3] *= np.linspace(.42, 0, refl.shape[0])[:, None]
        refl = wave_rows(refl, 2.5 * R.SS, 5.0 * R.SS, ph)
        comp(srcf, premul_blur(refl, 1.4 * R.SS), x0, int(wy))
        # parte submersa: escura, esverdeada e ondulada
        sub = out[hcut:].copy()
        if sub.shape[0] > 0:
            sub[..., :3] = sub[..., :3] * .35 + np.array([.10, .14, .08], np.float32)
            sub[..., 3] *= np.linspace(.55, .15, sub.shape[0])[:, None]
            comp(srcf, wave_rows(sub, 2 * R.SS, 4 * R.SS, ph + 1), x0, y0 + hcut)
        comp(srcf, out[:hcut], x0, y0)
        # linha d'água: faixa escura de contato + brilho fino
        ln, pad = ellipse_map(int(wpx * 1.08), int(14 * R.SS), 3 * R.SS)
        shade(srcf, ln, int(bx - wpx * .54 - pad), int(wy - 7 * R.SS - pad), .45)
        hl = np.zeros((int(8 * R.SS) + 2, int(wpx * 1.05)), np.float32)
        cv2.ellipse(hl, (hl.shape[1] // 2, hl.shape[0] // 2), (hl.shape[1] // 2 - 2, max(1, hl.shape[0] // 2 - 1)), 0, 180, 360, 1.0, max(1, int(1.5 * R.SS)), cv2.LINE_AA)
        hl = cv2.GaussianBlur(hl, (0, 0), .8 * R.SS) * .22
        x_, y_ = int(bx - hl.shape[1] / 2), int(wy - hl.shape[0] / 2 + 2 * R.SS)
        xa, ya = max(0, x_), max(0, y_); xb, yb = min(R.SW, x_ + hl.shape[1]), min(R.SH, y_ + hl.shape[0])
        if xa < xb and ya < yb:
            aa = hl[ya - y_:yb - y_, xa - x_:xb - x_, None]; blend(srcf, ya, yb, xa, xb, .92, aa)
    else:
        comp(srcf, out, x0, y0, clip_y=wy + 2 * R.SS)          # ainda caindo: some ao tocar a água
    return True

# respingo do impacto na água (determinístico)
_SPL = None
def draw_particles(srcf, t, i):
    global _SPL
    p = phone_cfg(); tl = p["land"]; e = t - tl
    if e < 0 or t >= PH_PLANES[0][1]: return
    (bx, wy), hfrac = PH_PLANES[0][2], PH_PLANES[0][3]
    bx *= R.SW; wy *= R.SH; hpx = hfrac * R.SH; wpx = hpx * .476
    # lâminas de água subindo dos dois lados (coroa do respingo)
    if False:  # lâminas procedurais desligadas (pareciam falsas)
        for side in (-1, 1):
            hs = .20 * R.SH * math.sin(math.pi * min(1.0, e / .75)) ** .8
            if hs < 4: continue
            n = 24; xs = np.linspace(0, 1, n)
            outer = [(bx + side * (wpx * .45 + u * wpx * (.35 + .6 * e)), wy - hs * math.sin(math.pi * (.15 + .85 * u)) * (1 - .35 * u)) for u in xs]
            inner = [(bx + side * (wpx * .45 + u * wpx * (.25 + .45 * e)), wy - hs * .55 * math.sin(math.pi * (.15 + .85 * u))) for u in xs[::-1]]
            poly = np.array(outer + inner, np.float32)
            x0, y0 = int(poly[:, 0].min()) - 8, int(poly[:, 1].min()) - 8
            x1, y1 = int(poly[:, 0].max()) + 9, int(poly[:, 1].max()) + 9
            m = np.zeros((y1 - y0, x1 - x0), np.float32)
            cv2.fillPoly(m, [(poly - [x0, y0]).astype(np.int32)], 1.0, cv2.LINE_AA)
            m = cv2.GaussianBlur(m, (0, 0), 3 * R.SS)
            # textura de água: estrias verticais irregulares
            tex = np.clip(.55 + .45 * np.sin(np.arange(m.shape[1])[None, :] / (3.1 * R.SS) + rng(5).uniform(0, 6)) * np.cos(np.arange(m.shape[0])[:, None] / (7.0 * R.SS)), 0, 1)
            al = m * tex * .42 * clampf(1 - e / .75, 0, 1) ** .7
            xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x1), min(R.SH, y1)
            if xa < xb and ya < yb:
                blend(srcf, ya, yb, xa, xb, np.array([.90, .95, .96], np.float32), al[ya - y0:yb - y0, xa - x0:xb - x0, None])
    if e > 1.4: return
    # espuma branca na base
    fa = .55 * clampf(1 - e / 1.2, 0, 1)
    if fa > 0:
        fm, pad = ellipse_map(int(wpx * (1.1 + .9 * R.cubic(e / .8))), int(28 * R.SS * (1 + e)), 9 * R.SS)
        x_, y_ = int(bx - fm.shape[1] / 2), int(wy - fm.shape[0] / 2 + 4 * R.SS)
        xa, ya = max(0, x_), max(0, y_); xb, yb = min(R.SW, x_ + fm.shape[1]), min(R.SH, y_ + fm.shape[0])
        if xa < xb and ya < yb:
            aa = fm[ya - y_:yb - y_, xa - x_:xb - x_, None] * fa
            blend(srcf, ya, yb, xa, xb, np.array([.90, .94, .92], np.float32), aa)
    draw_splash(srcf, e, bx, wy, wpx)
    return
    # (antigo) gotas procedurais
    if _SPL is None:
        g = rng(7); n = 150
        side = g.choice([-1, 1], n)
        _SPL = dict(x0=side * g.uniform(.15, .62, n), vx=side * g.uniform(.05, .55, n), vy=-g.uniform(.45, 1.35, n),
                    sz=g.uniform(2.0, 6.0, n), life=g.uniform(.5, 1.0, n), br=g.uniform(.80, 1.0, n))
    S_ = _SPL; gpx = 3.2 * R.SH
    for k in range(len(S_["x0"])):
        if e > S_["life"][k]: continue
        v = .62 * R.SH
        x = bx + S_["x0"][k] * wpx + S_["vx"][k] * v * e
        y = wy + S_["vy"][k] * v * e + .5 * gpx * e * e
        if y > wy + 4 * R.SS: continue
        vxp, vyp = S_["vx"][k] * v, S_["vy"][k] * v + gpx * e
        L = .006; x2, y2 = x - vxp * L, y - vyp * L
        a = clampf(1 - e / S_["life"][k], 0, 1) ** .5 * .70
        sz = max(1, int(S_["sz"][k] * R.SS))
        x0_, y0_ = int(min(x, x2)) - sz - 2, int(min(y, y2)) - sz - 2
        x1_, y1_ = int(max(x, x2)) + sz + 3, int(max(y, y2)) + sz + 3
        if x1_ <= 0 or y1_ <= 0 or x0_ >= R.SW or y0_ >= R.SH: continue
        m = np.zeros((y1_ - y0_, x1_ - x0_), np.float32)
        cv2.line(m, (int(x - x0_), int(y - y0_)), (int(x2 - x0_), int(y2 - y0_)), 1.0, sz, cv2.LINE_AA)
        m = cv2.GaussianBlur(m, (0, 0), .7 * R.SS)
        xa, ya = max(0, x0_), max(0, y0_); xb, yb = min(R.SW, x1_), min(R.SH, y1_)
        aa = m[ya - y0_:yb - y0_, xa - x0_:xb - x0_, None] * a
        c = np.array([.86, .92, .93], np.float32) * S_["br"][k]
        blend(srcf, ya, yb, xa, xb, c, aa)

_FLOW = None
FLOW_F0, FLOW_F1, FLOW_SPD = 21, 70, 1.65   # quadro do impacto, fim da coroa, aceleração (o clipe é câmera lenta)
FLOW_C = (960, 815, 780)                     # no clipe: centro x, linha d'água y, largura da base da coroa
def draw_splash(L, e, bx, wy, wpx):
    """respingo filmado (refs/flow_splash.mp4, fundo preto) somado como luz (modo tela) no impacto."""
    global _FLOW
    if _FLOW is None:
        cap = cv2.VideoCapture("refs/flow_splash.mp4"); fr = []
        while True:
            ok, f = cap.read()
            if not ok: break
            fr.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
        _FLOW = fr[FLOW_F0:FLOW_F1 + 2]
    k = e * 24 * FLOW_SPD
    if e < 0 or k >= len(_FLOW) - 1: return
    k0 = int(k); f = k - k0
    g = (_FLOW[k0].astype(np.float32) * (1 - f) + _FLOW[k0 + 1].astype(np.float32) * f) / 255
    g = np.clip((g - .10) / .72, 0, 1) ** 1.15
    H0, W0 = g.shape; cx, cy, cw = FLOW_C
    g[cy + 25:] *= .45                                   # reflexo do respingo na água: mais fraco
    xw = np.clip(np.minimum(np.arange(W0), W0 - 1 - np.arange(W0)) / (W0 * .12), 0, 1)
    yw = np.clip(np.arange(H0) / (H0 * .10), 0, 1)
    g *= np.outer(yw, xw)
    sc = wpx * 1.30 / cw
    g = cv2.resize(g, (max(2, int(W0 * sc)), max(2, int(H0 * sc))), interpolation=cv2.INTER_AREA)
    fade = clampf(1 - (k - (len(_FLOW) - 14)) / 13, 0, 1) * clampf(e / .04, 0, 1)
    x_, y_ = int(bx - cx * sc), int(wy - cy * sc)
    xa, ya = max(0, x_), max(0, y_); xb, yb = min(R.SW, x_ + g.shape[1]), min(R.SH, y_ + g.shape[0])
    if xa >= xb or ya >= yb: return
    add = g[ya - y_:yb - y_, xa - x_:xb - x_, None] * np.float32([.93, .98, .97]) * fade
    if isinstance(L, Layer): L.P[ya:yb, xa:xb] += add
    else: L[ya:yb, xa:xb] = np.clip(L[ya:yb, xa:xb] + add, 0, 1)

def apply_ripples(srcf, t, G):
    """ondas reais: distorce os pixels da água em anéis que se abrem (no quadro final, já com tracking)."""
    p = phone_cfg(); e = t - p["land"]
    if not (0 < e < 3.2) or t >= PH_PLANES[0][1]: return
    (bx, wy), hfrac = PH_PLANES[0][2], PH_PLANES[0][3]
    c = G @ np.array([bx * R.SW, wy * R.SH, 1.0]); cx, cy = c[0] / c[2], c[1] / c[2]
    wpx = hfrac * R.SH * .476
    rmax = wpx * .5 + 3.2 * 260 * R.SS
    x0, x1 = int(max(0, cx - rmax)), int(min(R.SW, cx + rmax)); y0, y1 = int(max(0, cy - 10 * R.SS)), int(min(R.SH, cy + rmax * .16))
    if x1 <= x0 or y1 <= y0: return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    r = np.sqrt(((xx - cx)) ** 2 + ((yy - cy) / .13) ** 2)      # elipse achatada (perspectiva da água)
    front = r - (wpx * .45 + e * 260 * R.SS)
    amp = 5.5 * R.SS * math.exp(-e * 1.1)
    wave = np.exp(-(front / (60 * R.SS)) ** 2) * np.sin(front / (9 * R.SS))
    dy = amp * wave
    mx = xx.astype(np.float32); my = (yy + dy).astype(np.float32)
    reg = cv2.remap(srcf, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    # brilho nas cristas
    reg = np.clip(reg + (np.clip(wave, 0, 1) * .05 * math.exp(-e * 1.2))[..., None], 0, 1)
    srcf[y0:y1, x0:x1] = reg

# instante de referência do desenho em cada cena (as posições foram escolhidas olhando estes quadros)
TD = {1: 7.9, 2: 14.5, 3: 19.5, 4: 26.0, 5: 39.5, 6: 47.5, 8: 57.0}

def draw_world(srcf, t, i):
    """desenha tudo que fica 'no mundo' numa camada e deforma pelo movimento real da câmera."""
    global _BG
    ci = R.cena_idx(t + .5 / R.FPS)
    if ci not in TD: return False
    _BG = srcf
    L = Layer(R.SH, R.SW)
    draw_chart(L, t, i)
    draw_panels(L, t, i)
    draw_signatures(L, t, i)
    if draw_phone(L, t, i): draw_particles(L, t, i)
    if not L.A.any() and (L.D == 1).all(): return False
    G = track_G(TD[ci], t)
    apply_layer(srcf, L, G)
    apply_ripples(srcf, t, G)
    return True

def shake(t):
    p = phone_cfg(); e = t - p["land"]
    if not (0 <= e < .4) or t >= PH_PLANES[0][1]: return 0.0, 0.0
    amp = 6 * math.exp(-e * 9)
    return amp * math.sin(e * 71), amp * .8 * math.cos(e * 53)

# ------------------------------------------------------------ painéis 3D ancorados no ambiente
# (card, entra, sai, base x, base y, altura, rotY, rotX, desfoque, entrada, reflexo)
PAINEIS = [
    ("importer", 7.75, 9.35, .80, .62, .34, -14, -6, .6, "vidro", False),      # flutua ao lado do Fábio
    ("dashboard", 18.55, 20.35, .815, .80, .36, -24, 2, 2.2, "sobe", False),   # Higor B: "o painel mostra gráficos"
    ("dups", 20.35, 22.40, .165, .80, .40, 24, 2, 2.2, "sobe", False),        # Higor B: "duplicados"
    ("importer", 23.55, 25.60, .875, .74, .36, -22, 2, 2.4, "sobe", True),     # Marielly: "você importa"
    ("library", 25.75, 28.30, .165, .74, .40, 22, 2, 2.4, "sobe", True),      # "biblioteca pesquisável com tags"
    ("library", 33.10, 36.50, .225, .66, .34, 22, 2, 2.4, "laptop", False),   # "em breve no computador": notebook
]

_GL = {}
def glass_parts(nm):
    """separa o card em 'tinta' (texto, ícones, cores: fica aceso) e 'vidro' (o fundo escuro vira vidro fosco)."""
    if nm in _GL: return _GL[nm]
    c = load(nm); a = c[..., 3:4]
    lum = c[..., :3].max(2, keepdims=True)
    ink = np.dstack([np.clip(c[..., :3] * 1.08, 0, 1), np.clip((lum - .12) / .20, 0, 1) * a])
    shape = np.dstack([np.ones_like(c[..., :3]), a])
    h, w = a.shape[:2]
    er = cv2.erode((a[..., 0] > .5).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    yy = np.linspace(1, .45, h, dtype=np.float32)[:, None]
    rim = np.dstack([np.ones_like(c[..., :3]), (np.clip(a[..., 0] - er, 0, 1) * yy)[..., None]])
    _GL[nm] = (ink, shape, rim); return _GL[nm]

def glass_draw(srcf, parts, quad, al, frost=.92, glow=.30, streak=True, blur=20, refl_y=None, smoke=False):
    """desenha um elemento de vidro AR (vidro fosco + tinta acesa + brilho + aresta) no quadrilátero dado."""
    ink, shape, rim = parts
    env = _BG if _BG is not None else srcf
    rs = warp_to(shape, quad)
    if rs is None or al <= 0: return
    sh_, x0, y0 = rs; pa = sh_[..., 3:4]
    hh, ww = pa.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + ww), min(R.SH, y0 + hh)
    if xa >= xb or ya >= yb: return
    pad = int(blur * 2 * R.SS); px0, py0 = max(0, xa - pad), max(0, ya - pad); px1, py1 = min(R.SW, xb + pad), min(R.SH, yb + pad)
    fro = cv2.GaussianBlur(env[py0:py1, px0:px1], (0, 0), blur * R.SS)[ya - py0:yb - py0, xa - px0:xb - px0]
    fro = fro * .42 + .04 if smoke else fro * .74 + .19     # vidro fumê quando o texto precisa de contraste
    blend(srcf, ya, yb, xa, xb, fro, pa[ya - y0:yb - y0, xa - x0:xb - x0] * frost * al)
    if refl_y is not None:
        rimg = np.flipud(ink).copy(); rimg[..., 3] *= np.linspace(.22, 0, rimg.shape[0])[:, None]
        rq = quad.copy(); rq[:, 1] = 2 * refl_y - rq[:, 1]; rq = rq[[3, 2, 1, 0]]
        r = warp_to(rimg, rq)
        if r: comp(srcf, premul_blur(r[0], 4 * R.SS), r[1], r[2], al)
    r = warp_to(ink, quad)
    if r is not None:
        io, ix, iy = r
        comp(srcf, io, ix, iy, al * .96)
        if glow > 0:
            g = cv2.GaussianBlur(io[..., :3] * io[..., 3:4], (0, 0), 9 * R.SS) * glow * al
            add_light(srcf, g, ix, iy)
    r = warp_to(rim, quad)
    if r is not None: comp(srcf, r[0], r[1], r[2], al * .75)
    if streak:
        yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
        st = np.clip(1 - np.abs((xx - ww * .45) * .9 + (yy - hh * .5) * .5) / (40 * R.SS), 0, 1)[..., None] * .09 * pa * al
        add_light(srcf, st * np.ones(3, np.float32), x0, y0)

def add_light(srcf, img, x0, y0):
    """soma luz (modo tela aproximado) numa camada ou quadro."""
    h, w = img.shape[:2]
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + w), min(R.SH, y0 + h)
    if xa >= xb or ya >= yb: return
    add = img[ya - y0:yb - y0, xa - x0:xb - x0]
    if isinstance(srcf, Layer): srcf.P[ya:yb, xa:xb] += add
    else: srcf[ya:yb, xa:xb] = np.clip(srcf[ya:yb, xa:xb] + add, 0, 1)

def draw_panels(srcf, t, i):
    """cards como VIDRO DE REALIDADE AUMENTADA: painel fosco flutuando, ícones acesos, aresta iluminada."""
    for nm, a, b, x, y, hf, ry, rx, dof, kind, refl in PAINEIS:
        if not (a <= t < b + .4) or R.cena_idx(t + .5 / R.FPS) != R.cena_idx(a): continue
        fi = (t - a) * R.FPS; fo = (t - b) * R.FPS
        ink, shape, rim = glass_parts(nm)
        if 0 <= fi < 24: ink = R.sweep(ink, fi / 24)
        hpx = hf * R.SH; wpx = hpx * ink.shape[1] / ink.shape[0]
        al = R.cubic(fi / 10); sc = .90 + .10 * R.quint(fi / 16); ryy = ry + 18 * (1 - R.cubic(fi / 18)) * (1 if ry > 0 else -1)
        if fo > 0: al *= 1 - R.cubic(fo / 10); sc *= 1 - .06 * R.cubic(fo / 10)
        if al <= 0: continue
        cx, cy = x * R.SW, y * R.SH - hpx * .62          # flutua acima do chão/água
        quad = project_plane(shape, wpx * sc, ryy, rx) + np.float32([cx, cy])
        if kind == "laptop":                             # base do notebook (teclado) embaixo da tela
            bl, br = quad[3], quad[2]; d = (br - bl)
            base = np.float32([bl, br, br + d * .10 + np.float32([0, hpx * .20]), bl - d * .10 + np.float32([0, hpx * .20])])
            glass_draw(srcf, keyboard_parts(), base, al * .95, streak=False)
        glass_draw(srcf, (ink, shape, rim), quad, al, refl_y=(y * R.SH + hpx * .08) if refl else None)
        if kind == "laptop":                             # selo "em breve" no canto da tela
            pp = pill_parts("embreve", 210, 62, lambda d, W, H: _txt(d, W, H, "em breve", "d_b", 30, (242, 195, 139)))
            pw = wpx * .38 * sc; tr = quad[1] + (quad[1] - quad[0]) * -.02
            pq = project_plane(pp[1], pw, ryy, rx) + np.float32([tr[0] - pw * .35, tr[1] + pw * .08])
            ap = al * R.back(clampf((t - a - .6) * 3, 0, 1), 1.6) if t - a > .6 else 0
            glass_draw(srcf, pp, pq, clampf(ap, 0, 1), streak=False, blur=10)

# ------------------------------------------------------------ peças de vidro feitas na hora (pílulas, blocos, ícones)
_PP = {}
GS = 1.6   # resolução dos sprites (× unidades de 1080p)
def _rim_of(a):
    h = a.shape[0]
    er = cv2.erode((a > .5).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    yy = np.linspace(1, .45, h, dtype=np.float32)[:, None]
    return np.dstack([np.ones(a.shape + (3,), np.float32), (np.clip(a - er, 0, 1) * yy)[..., None]])
def pill_parts(key, w, h, draw_fn, radius=None):
    """vidro arredondado w×h (unidades 1080p) com tinta desenhada por draw_fn(ImageDraw, W, H) em PIL."""
    if key in _PP: return _PP[key]
    W, H = int(w * GS), int(h * GS); r = int((radius if radius is not None else h / 2) * GS)
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, H - 1], r, fill=255)
    a = np.asarray(m, np.float32) / 255
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ink); draw_fn(d, W, H)
    inkf = np.asarray(ink, np.float32) / 255; inkf = np.dstack([inkf[..., :3], inkf[..., 3:] * a[..., None]])
    shape = np.dstack([np.ones((H, W, 3), np.float32), a])
    _PP[key] = (inkf, shape, _rim_of(a)); return _PP[key]
def _txt(d, W, H, txt, fk, px, col, x=None):
    f = R.font(fk, px * GS); bb = d.textbbox((0, 0), txt, font=f)
    xx = (W - (bb[2] - bb[0])) / 2 - bb[0] if x is None else x
    d.text((xx, (H - (bb[3] - bb[1])) / 2 - bb[1]), txt, font=f, fill=tuple(col) + (255,))
def keyboard_parts():
    def fn(d, W, H):
        for k in range(3):
            y = H * (.25 + k * .22)
            for j in range(12):
                x0 = W * (.08 + j * .072 + k * .01); d.rounded_rectangle([x0, y, x0 + W * .06, y + H * .14], 3, fill=(255, 255, 255, 60))
        d.rounded_rectangle([W * .38, H * .84, W * .62, H * .95], 4, fill=(255, 255, 255, 50))
    return pill_parts("teclado", 600, 120, fn, radius=14)
def paste_icon(img, name, cx, cy, size, col):
    """cola um ícone de traço (ICONS) numa imagem PIL RGBA."""
    ic = icon_sprite(name, int(size), 1.0, col)
    a = Image.fromarray(np.uint8(np.clip(ic * 255, 0, 255)), "RGBA")
    img.alpha_composite(a, (int(cx - a.width / 2), int(cy - a.height / 2)))
FTYPE = {"JPG": "#5B8DEF", "PNG": "#EE6AA7", "MP4": "#9B6BF2", "MOV": "#3CC8E0", "PDF": "#E5574F", "DOC": "#4C8DF0", "MP3": "#F0A93B", "WAV": "#4CC46E"}
def tile_parts(lbl):
    def fn(d, W, H):
        c = R.hexrgb(FTYPE[lbl])
        d.rounded_rectangle([W * .14, H * .12, W * .86, H * .62], int(10 * GS), fill=c + (255,))
        _f = R.font("d_b", 21 * GS); bb = d.textbbox((0, 0), lbl, font=_f)
        d.text((W / 2 - (bb[2] - bb[0]) / 2 - bb[0], H * .37 - (bb[3] - bb[1]) / 2 - bb[1]), lbl, font=_f, fill=(255, 255, 255, 255))
        d.rounded_rectangle([W * .18, H * .74, W * .82, H * .80], 4, fill=(255, 255, 255, 110))
        d.rounded_rectangle([W * .18, H * .85, W * .60, H * .90], 4, fill=(255, 255, 255, 70))
    return pill_parts("tile_" + lbl, 96, 104, fn, radius=18)
def quad_at(parts, cx, cy, w, ry=0.0, rx=0.0, rz=0.0):
    return project_plane(parts[1], w, ry, rx, rz) + np.float32([cx, cy])

# ------------------------------------------------------------ FÁBIO: bagunça → importa → organizado
FAB_LBL = ["JPG", "MP4", "PDF", "MP3", "PNG", "MOV", "DOC", "WAV", "JPG", "MP4", "PDF", "MP3"]
FAB_COL = {"Fotos": ["JPG", "PNG"], "Vídeos": ["MP4", "MOV"], "Docs": ["PDF", "DOC"], "Áudio": ["MP3", "WAV"]}
FAB_T = dict(caos=6.72, importa=8.05, card=(1536, 442), organiza=10.74, sai=12.62)
def draw_fabio(srcf, t, i):
    T = FAB_T
    if not (T["caos"] <= t < T["sai"] + .35): return
    g = rng(21); n = len(FAB_LBL); u = R.SS
    chaos = [(g.uniform(1340, 1860), g.uniform(80, 700), g.uniform(-38, 38), g.uniform(-30, 30)) for _ in range(n)]
    cols = list(FAB_COL); xs = [1250, 1400, 1550, 1700]
    slot = []; cnt = {c: 0 for c in cols}
    for lbl in FAB_LBL:
        c = next(k for k in cols if lbl in FAB_COL[k]); slot.append((xs[cols.index(c)], 420 + 108 * cnt[c])); cnt[c] += 1
    fo = clampf((t - T["sai"]) / .3, 0, 1)
    # cabeçalhos das colunas
    if t >= T["organiza"]:
        for k, c in enumerate(cols):
            e = clampf((t - T["organiza"] - k * .06) / .35, 0, 1)
            if e <= 0: continue
            pp = pill_parts("col_" + c, 140, 48, lambda d, W, H, c=c: _txt(d, W, H, c, "d_sb", 22, (255, 255, 255)))
            glass_draw(srcf, pp, quad_at(pp, xs[k] * u, (340 - 18 * (1 - R.quint(e))) * u, 140 * u), R.cubic(e) * (1 - fo), streak=False, blur=12, glow=0)
    cx, cy = T["card"]
    for k, lbl in enumerate(FAB_LBL):
        pp = tile_parts(lbl); x, y, rz, ry = chaos[k]
        x += 7 * math.sin(t * .9 + k); y += 5 * math.cos(t * .8 + k * 1.7); rz += 4 * math.sin(t * .6 + k)
        sc, al = 1.0, 1.0
        e0 = (t - T["caos"] - k * .045) / .30
        if e0 <= 0: continue
        if t < T["organiza"]:
            sc = R.back(clampf(e0, 0, 1), 1.6); al = R.cubic(clampf(e0, 0, 1))
            e1 = clampf((t - T["importa"] - k * .07) / .38, 0, 1)
            if e1 > 0:   # voa para dentro do importador
                q = R.inout(e1); x += (cx - x) * q; y += (cy - y) * q; rz *= 1 - q; ry *= 1 - q; sc *= 1 - .7 * q; al *= 1 - R.cubic(clampf((e1 - .6) / .4, 0, 1))
        else:          # sai do importador e cai no lugar certo
            e2 = clampf((t - T["organiza"] - .15 - k * .055) / .42, 0, 1)
            if e2 <= 0: continue
            q = R.back(e2, 1.2); sx, sy = slot[k]
            x, y = cx + (sx - cx) * q, cy + (sy - cy) * q; rz = 25 * (1 - R.cubic(e2)); ry = 0; sc = .5 + .5 * R.cubic(e2)
            al = R.cubic(clampf(e2 * 3, 0, 1)) * (1 - fo)
        if al <= .01 or sc <= .02: continue
        glass_draw(srcf, pp, quad_at(pp, x * u, y * u, 92 * u * sc, ry=ry, rz=rz), al, streak=False, blur=12, glow=.22)

# ------------------------------------------------------------ MARIELLY: celular + adaptador OTG + pendrive
OTG = dict(a=28.40, b=32.05)
def draw_otg(srcf, t, i):
    a, b = OTG["a"], OTG["b"]
    if not (a <= t < b + .35): return
    u = R.SS; col = R.hexrgb("#F2C38B")
    fo = 1 - R.cubic(clampf((t - b) / .3, 0, 1))
    prog = clampf((t - 29.30) / 2.3, 0, 1)
    def ph(d, W, H, p=round(prog * 20) / 20):
        _txt(d, W, int(H * .16), "Android", "d_sb", 22, (255, 255, 255))
        for k, lbl in enumerate(["JPG", "MP4", "PDF", "MP3"]):
            x0 = W * (.12 + (k % 2) * .40); y0 = H * (.24 + (k // 2) * .17)
            d.rounded_rectangle([x0, y0, x0 + W * .36, y0 + H * .13], int(8 * GS), fill=R.hexrgb(FTYPE[lbl]) + (230 if p > (k + 1) * .2 else 70,))
        d.rounded_rectangle([W * .12, H * .66, W * .88, H * .69], 4, fill=(255, 255, 255, 50))
        d.rounded_rectangle([W * .12, H * .66, W * (.12 + .76 * p), H * .69], 4, fill=col + (255,))
        _txt(d, W, int(H * 1.52), "importando" if p < 1 else "pronto ✓", "d_m", 17, (255, 255, 255))
        d.rounded_rectangle([W * .40, H * .93, W * .60, H * .95], 3, fill=(255, 255, 255, 90))
    pp = pill_parts(("otg_phone", round(prog * 20)), 200, 400, ph, radius=34)
    e = clampf((t - a) / .35, 0, 1)
    glass_draw(srcf, pp, quad_at(pp, 250 * u, (450 + 20 * (1 - R.quint(e))) * u, 200 * u, ry=14), R.cubic(e) * fo, blur=16)
    # pendrive entra pela direita
    e2 = clampf((t - a - .25) / .45, 0, 1)
    def pd(d, W, H):
        d.rounded_rectangle([W * .70, H * .25, W * .97, H * .75], int(6 * GS), outline=(255, 255, 255, 200), width=int(3 * GS))
        _txt(d, int(W * .7), H, "16 GB", "d_b", 24, col)
    pq = pill_parts("otg_pen", 200, 70, pd, radius=18)
    px = (640 + 120 * (1 - R.quint(e2))); py = 720
    glass_draw(srcf, pq, quad_at(pq, px * u, py * u, 200 * u, ry=10), R.cubic(e2) * fo, streak=False, blur=12)
    # adaptador OTG
    e3 = clampf((t - a - .45) / .3, 0, 1)
    pa_ = pill_parts("otg_ad", 92, 48, lambda d, W, H: _txt(d, W, H, "OTG", "d_b", 22, col), radius=12)
    glass_draw(srcf, pa_, quad_at(pa_, 450 * u, py * u, 92 * u), R.back(e3, 1.5) * fo if e3 > 0 else 0, streak=False, blur=10, glow=.4)
    # cabo: pendrive → adaptador → celular (desenha) e dados correndo nele
    path = np.float32([[540, py], [496, py], [404, py], [250, py], [250, 662]])
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    pc = clampf((t - a - .55) / .4, 0, 1) * seg[-1]
    if pc <= 0: return
    x0, y0 = int(200 * u), int(620 * u); W_, H_ = int(400 * u), int(140 * u)
    lay = np.zeros((H_, W_), np.float32); glow = np.zeros_like(lay)
    pts = [path[0]]
    for k in range(1, len(path)):
        if seg[k] <= pc: pts.append(path[k])
        else: pts.append(path[k - 1] + (path[k] - path[k - 1]) * (pc - seg[k - 1]) / (seg[k] - seg[k - 1])); break
    pl = ((np.array(pts) * u - [x0, y0])).astype(np.int32).reshape(-1, 1, 2)
    for a_, b_ in ((0, 1), (2, 3)):   # o cabo some por baixo do adaptador
        pass
    cv2.polylines(lay, [pl], False, .75, max(2, int(4 * u)), cv2.LINE_AA)
    if t > 29.25 and prog < 1:
        for k in range(5):   # pacotes de dados
            s_ = ((t - 29.25) * 260 + k * seg[-1] / 5) % seg[-1]
            j = np.searchsorted(seg, s_) - 1; j = max(0, min(j, len(path) - 2))
            q = path[j] + (path[j + 1] - path[j]) * (s_ - seg[j]) / max(1e-6, seg[j + 1] - seg[j])
            cv2.circle(lay, (int(q[0] * u - x0), int(q[1] * u - y0)), int(6 * u), 1.0, -1, cv2.LINE_AA)
            cv2.circle(glow, (int(q[0] * u - x0), int(q[1] * u - y0)), int(16 * u), 1.0, -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 8 * u) * .6
    c = np.array(col, np.float32) / 255
    for L_, cc in ((glow, c), (lay, c * .5 + .5)):
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + W_), min(R.SH, y0 + H_)
        blend(srcf, ya, yb, xa, xb, cc, np.clip(L_[ya - y0:yb - y0, xa - x0:xb - x0, None] * fo, 0, 1))

# ------------------------------------------------------------ ENRIQUE: timeline de edição + linha de produção
EDIT = (-9.0, -8.0)   # (substituído pela janela do editor em tela)
ETAPAS = [("Roteiro", "script", 150, 55.84), ("Gravação", "rec", 450, 56.28), ("Edição", "cut", 1430, 56.90), ("Entrega", "send", 1715, 57.46)]
LOGO_P = (60.20, 61.55)
EXPORT = (57.46, 58.35)
PIPE = dict(a=55.55, fim=57.95, check=58.40, sai=59.95, y=300)
def draw_enrique(srcf, t, i):
    u = R.SS; col = R.hexrgb("#F0B45A"); c = np.array(col, np.float32) / 255
    a, b = EDIT
    if a <= t < b + .3:     # painel de edição com faixas e cursor andando
        e = clampf((t - a) / .35, 0, 1); al = R.cubic(e) * (1 - R.cubic(clampf((t - b) / .3, 0, 1)))
        ph_ = round(clampf((t - a) / (b - a), 0, 1) * 40) / 40
        def ed(d, W, H, ph_=ph_):
            d.text((W * .05, H * .06), "Produção", font=R.font("d_sb", 24 * GS), fill=(255, 255, 255, 255))
            d.text((W * .70, H * .08), "USB Intelligence", font=R.font("d_m", 15 * GS), fill=(255, 255, 255, 150))
            rows = [[(.04, .30, "#F0B45A"), (.31, .62, "#5B8DEF"), (.63, .96, "#F0B45A")], [(.12, .45, "#9B6BF2"), (.50, .80, "#EE6AA7")]]
            for r, clips in enumerate(rows):
                y0 = H * (.30 + r * .20)
                for x0, x1, cc in clips: d.rounded_rectangle([W * x0, y0, W * x1, y0 + H * .15], int(6 * GS), fill=R.hexrgb(cc) + (220,))
            y0 = H * .72; xs = np.linspace(W * .04, W * .96, 90)
            wv = [(x, y0 + H * .07 + H * .06 * math.sin(x * .05) * math.sin(x * .013)) for x in xs]
            d.line(wv, fill=(76, 196, 110, 230), width=int(3 * GS))
            xp = W * (.04 + .92 * ph_); d.line([(xp, H * .24), (xp, H * .94)], fill=(255, 255, 255, 255), width=int(3 * GS))
            d.polygon([(xp - 9 * GS, H * .22), (xp + 9 * GS, H * .22), (xp, H * .26)], fill=(255, 255, 255, 255))
        pp = pill_parts(("edit", ph_), 520, 300, ed, radius=26)
        glass_draw(srcf, pp, quad_at(pp, 540 * u, (440 + 24 * (1 - R.quint(e))) * u, 460 * u, ry=20), al, blur=18)
    P = PIPE
    if not (P["a"] <= t < LOGO_P[1] + .4): return
    fo = 1 - R.cubic(clampf((t - P["sai"]) / .3, 0, 1))
    qv = R.inout(clampf((t - P["sai"]) / .38, 0, 1))      # etapas voam para o card do produto
    keys = [(P["a"], 80)] + [(tk, x) for _, _, x, tk in ETAPAS] + [(P["fim"], 1840)]
    xh = keys[-1][1]
    for (t0, x0_), (t1, x1_) in zip(keys, keys[1:]):
        if t < t1: xh = x0_ + (x1_ - x0_) * R.inout(clampf((t - t0) / (t1 - t0), 0, 1)); break
    Y = P["y"]
    x0, y0 = int(40 * u), int((Y - 40) * u); W_, H_ = int(1840 * u), int(80 * u)
    lay = np.zeros((H_, W_), np.float32); glow = np.zeros_like(lay)
    cv2.line(lay, (int(80 * u - x0), int(Y * u - y0)), (int(1840 * u - x0), int(Y * u - y0)), .16, max(1, int(2 * u)), cv2.LINE_AA)
    cv2.line(lay, (int(80 * u - x0), int(Y * u - y0)), (int(xh * u - x0), int(Y * u - y0)), 1.0, max(2, int(4 * u)), cv2.LINE_AA)
    cv2.line(glow, (int(80 * u - x0), int(Y * u - y0)), (int(xh * u - x0), int(Y * u - y0)), 1.0, max(4, int(14 * u)), cv2.LINE_AA)
    cv2.circle(glow, (int(xh * u - x0), int(Y * u - y0)), int(22 * u), 1.0, -1, cv2.LINE_AA)
    for k, (nm, ic, x, tk) in enumerate(ETAPAS):
        if t >= tk:
            r = 13 * R.back(clampf((t - tk) / .25, 0, 1), 2.0)
            cv2.circle(lay, (int(x * u - x0), int(Y * u - y0)), max(1, int(r * u)), 1.0, -1, cv2.LINE_AA)
            cv2.circle(glow, (int(x * u - x0), int(Y * u - y0)), max(1, int(r * 2.2 * u)), 1.0, -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 10 * u) * .55
    for L_, cc in ((glow, c), (lay, c * .55 + .45)):
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(R.SW, x0 + W_), min(R.SH, y0 + H_)
        blend(srcf, ya, yb, xa, xb, cc, np.clip(L_[ya - y0:yb - y0, xa - x0:xb - x0, None] * fo, 0, 1))
    for k, (nm, ic, x, tk) in enumerate(ETAPAS):
        e = clampf((t - tk + .04) / .32, 0, 1)
        if e <= 0: continue
        ck = clampf((t - P["check"] - k * .22) / .25, 0, 1)
        def pf(d, W, H, nm=nm, ic=ic, ck=round(ck * 6) / 6):
            img = d._image
            paste_icon(img, ic, H * .55, H / 2, H * .46, col)
            f = R.font("d_sb", 26 * GS); bb = d.textbbox((0, 0), nm, font=f)
            d.text((H * 1.0, H / 2 - (bb[3] - bb[1]) / 2 - bb[1]), nm, font=f, fill=(255, 255, 255, 255))
            if ck > 0:   # ✓ "etapa planejada"
                cx_, cy_, rr = W - H * .45, H / 2, H * .26
                d.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=(76, 196, 110, int(255 * min(1, ck * 2))))
                pts = [(cx_ - rr * .45, cy_), (cx_ - rr * .1, cy_ + rr * .38), (cx_ + rr * .5, cy_ - rr * .35)]
                if ck > .4: d.line(pts, fill=(255, 255, 255, 255), width=int(4 * GS), joint="curve")
        pp = pill_parts(("etapa", k, round(ck * 6)), 250, 80, pf, radius=24)
        px_, py_ = x + (1520 - x) * qv, (Y - 90 + 22 * (1 - R.quint(e))) + (430 - (Y - 90)) * qv
        glass_draw(srcf, pp, quad_at(pp, px_ * u, py_ * u, 250 * u * (1 - .6 * qv)), R.cubic(e) * (1 - R.cubic(clampf((qv - .5) / .5, 0, 1))), streak=False, blur=14)
    # entrega: barra de exportação embaixo
    a_, b_ = EXPORT
    if a_ <= t < b_ + .3:
        pr = clampf((t - a_ - .05) / .45, 0, 1); done = pr >= 1
        e = clampf((t - a_) / .25, 0, 1); al = R.cubic(e) * (1 - R.cubic(clampf((t - b_) / .3, 0, 1)))
        def ex(d, W, H, pr=round(pr * 24) / 24, done=done):
            img = d._image; paste_icon(img, "send", H * .55, H / 2, H * .44, col)
            f = R.font("d_sb", 22 * GS)
            d.text((H * 1.0, H * .18), "entregue" if done else "exportando", font=f, fill=(255, 255, 255, 255))
            pc = "100%" if done else f"{int(pr * 100)}%"; bb = d.textbbox((0, 0), pc, font=f)
            d.text((W - H * .35 - (bb[2] - bb[0]), H * .18), pc, font=f, fill=col + (255,))
            d.rounded_rectangle([H * 1.0, H * .66, W - H * .35, H * .74], 4, fill=(255, 255, 255, 50))
            d.rounded_rectangle([H * 1.0, H * .66, H * 1.0 + (W - H * 1.35) * pr, H * .74], 4, fill=col + (255,))
        pp = pill_parts(("export", round(pr * 24), done), 460, 84, ex, radius=24)
        glass_draw(srcf, pp, quad_at(pp, 960 * u, (930 + 20 * (1 - R.quint(e))) * u, 460 * u), al, streak=False, blur=14)
    # "o produto": card do app
    a_, b_ = LOGO_P
    if a_ <= t < b_ + .35:
        e = clampf((t - a_) / .3, 0, 1); al = R.cubic(e) * (1 - R.cubic(clampf((t - b_) / .3, 0, 1)))
        ink, shape, rim = glass_parts("logo"); hp = 150 * u * (.9 + .1 * R.back(e, 1.6))
        glass_draw(srcf, (ink, shape, rim), quad_at((ink, shape, rim), 1520 * u, 430 * u, hp * ink.shape[1] / ink.shape[0], ry=-14), al, blur=18, smoke=True)

# ------------------------------------------------------------ ENRIQUE: a edição de verdade aparecendo (tela)
import subprocess
NLE = dict(out=(53.70, 54.25), back=(55.18, 55.72))
PV = (468, 52, 1040, 585)              # janela de prévia do editor (unidades 1080p)
TL = (160, 1890)                       # área da timeline em x
VF = (56.22, 56.90)                    # visor de câmera em "gravação"
PUNCH = (56.90, 57.46, 1.05)           # corte com aproximação seca em "edição"
_NLE = {}
def _decode_audio(path, sr=8000):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(p.stdout, np.float32)
def _env(x, n, dur, sr=8000):
    out = np.zeros(n, np.float32); spb = dur * sr / n
    for k in range(n):
        s = x[int(k * spb):int((k + 1) * spb)]
        out[k] = np.sqrt((s ** 2).mean()) if len(s) else 0
    return out / max(1e-6, np.percentile(out, 99))
def _thumb(t, w, h):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", "bruto_1080.mp4", "-frames:v", "1", "-vf", f"scale={w}:{h}",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return Image.frombytes("RGB", (w, h), p.stdout)
def nle_static():
    """interface do editor (fixa): mídia com miniaturas reais, efeitos, timeline com legenda, motion, vídeo, voz e SFX deste vídeo."""
    if "ui" in _NLE: return _NLE["ui"]
    W, H = R.W, R.H; k = W / 1920; dur = R.FIM + R.CONG
    def X(v): return int(v * k)
    im = Image.new("RGB", (W, H), (14, 16, 20)); d = ImageDraw.Draw(im)
    gray, dim, panel = (170, 174, 182), (110, 114, 122), (21, 23, 29)
    acc = R.hexrgb("#F0B45A")
    d.rectangle([0, 0, W, X(40)], fill=(22, 24, 30))
    for j, c in enumerate([(237, 106, 94), (245, 191, 79), (98, 197, 84)]): d.ellipse([X(18 + j * 20), X(14), X(30 + j * 20), X(26)], fill=c)
    d.text((X(90), X(10)), "USB Intelligence  ·  corte final", font=R.font("d_m", 17 * k), fill=gray)
    for j, tb in enumerate(["Montagem", "Cor", "Áudio", "Exportar"]):
        f = R.font("d_sb" if j == 0 else "d_m", 16 * k); d.text((X(820 + j * 120), X(11)), tb, font=f, fill=(255, 255, 255) if j == 0 else dim)
    d.line([X(820), X(37), X(912), X(37)], fill=acc, width=max(1, X(2)))
    # mídia: uma miniatura real de cada plano
    d.rounded_rectangle([X(16), X(52), X(452), X(640)], X(10), fill=panel)
    d.text((X(32), X(64)), "Mídia", font=R.font("d_sb", 18 * k), fill=(255, 255, 255))
    for j, c in enumerate(R.CENAS):
        cx, cy = X(32 + (j % 3) * 140), X(100 + (j // 3) * 128)
        im.paste(_thumb((c[0] + c[1]) / 2, X(128), X(72)), (cx, cy))
        d.text((cx, cy + X(78)), c[2].split(" (")[0], font=R.font("d_m", 13 * k), fill=gray)
    # efeitos ligados (o que este vídeo usa)
    d.rounded_rectangle([X(1524), X(52), X(1904), X(640)], X(10), fill=panel)
    d.text((X(1540), X(64)), "Efeitos", font=R.font("d_sb", 18 * k), fill=(255, 255, 255))
    for j, nm in enumerate(["Legenda dinâmica", "Tracking de câmera", "Recorte da pessoa", "Vidro AR", "Respingo filmado", "Voz −15 LUFS"]):
        y = X(108 + j * 56)
        d.text((X(1540), y), nm, font=R.font("d_m", 16 * k), fill=gray)
        d.rounded_rectangle([X(1836), y, X(1880), y + X(22)], X(11), fill=acc)
        d.ellipse([X(1860), y + X(3), X(1876), y + X(19)], fill=(255, 255, 255))
    d.rectangle([X(PV[0]) - 1, X(PV[1]) - 1, X(PV[0] + PV[2]), X(PV[1] + PV[3])], outline=(60, 64, 72))
    # transporte
    d.polygon([(X(900), X(656)), (X(900), X(680)), (X(920), X(668))], fill=(255, 255, 255))
    d.text((X(1300), X(656)), "01:05:16", font=R.font("d_m", 18 * k), fill=dim)
    # timeline
    d.rounded_rectangle([X(16), X(700), X(1904), X(1064)], X(10), fill=(18, 20, 25))
    x0, x1 = TL; tx = lambda t: X(x0 + (x1 - x0) * t / dur)
    for s in range(0, int(dur) + 1):
        h = 10 if s % 5 == 0 else 5
        d.line([tx(s), X(728 - h), tx(s), X(728)], fill=dim, width=1)
        if s % 5 == 0: d.text((tx(s) + X(3), X(708)), f"0:{s:02d}" if s < 60 else f"1:{s - 60:02d}", font=R.font("d_m", 12 * k), fill=dim)
    rows = [("LEG", 740, 768), ("FX", 776, 818), ("V1", 826, 906), ("A1", 914, 974), ("A2", 982, 1050)]
    for nm, y0, y1 in rows:
        d.text((X(32), X((y0 + y1) / 2 - 8)), nm, font=R.font("d_sb", 14 * k), fill=dim)
        d.rectangle([X(x0), X(y0), X(x1), X(y1)], fill=(24, 26, 32))
    for c in R.LEG:   # legenda: cada palavra no tempo dela
        col = R.hexrgb(c["cor"]) if c["tipo"] in "KC" else (205, 208, 214)
        d.rounded_rectangle([tx(c["t0"]), X(744), max(tx(c["t0"]) + 2, tx(c["t1"]) - 1), X(764)], X(4), fill=col)
    fx = [(CHART[0], CHART[1], "#4FB3E8", "gráfico")] + [(a, b, "#8FA3B8", n) for n, a, b, *_ in PAINEIS] + \
         [(R.M["phone"]["entra"], PH_PLANES[-1][1], "#A6E36B", "celular 3D"), (FAB_T["caos"], FAB_T["sai"], "#EEF5A8", "arquivos"),
          (OTG["a"], OTG["b"], "#F2C38B", "OTG"), (PIPE["a"], PIPE["sai"], "#F0B45A", "etapas")]
    for n_, tn, D, _m in R.M["nomes"]: fx.append((tn, tn + D, "#FFFFFF", n_))
    for a, b, col, nm in fx:
        lane = 0 if nm in [n_ for n_, *_ in R.M["nomes"]] else 1
        ya = X(778 + lane * 20); yb = ya + X(18)
        d.rounded_rectangle([tx(a), ya, tx(b), yb], X(4), fill=R.hexrgb(col) + (), outline=None)
        if tx(b) - tx(a) > X(60): d.text((tx(a) + X(4), ya + X(2)), nm, font=R.font("d_m", 11 * k), fill=(20, 20, 24))
    for c in R.CENAS:   # vídeo: miniaturas reais de cada plano, com os cortes
        a, b = tx(c[0]), tx(min(c[1], R.FIM)); th = _thumb((c[0] + c[1]) / 2, X(142), X(80))
        x = a
        while x < b:
            im.paste(th.crop((0, 0, min(X(142), b - x), X(80))), (x, X(826))); x += X(142)
        d.line([a, X(826), a, X(906)], fill=(14, 16, 20), width=max(2, X(3)))
    for nm, path, y0, y1, col in (("A1", "voz_final.wav", 914, 974, (76, 196, 110)), ("A2", "sfx.wav", 982, 1050, (91, 141, 239))):
        n = X(x1) - X(x0); e = _env(_decode_audio(path), n, dur)
        mid = X((y0 + y1) / 2); amp = X((y1 - y0) / 2 - 3)
        for j in range(n):
            v = min(1.0, e[j]) * amp
            if v >= 1: d.line([X(x0) + j, mid - v, X(x0) + j, mid + v], fill=col)
    _NLE["ui"] = np.asarray(im, np.float32) / 255; _NLE["tx"] = tx; _NLE["k"] = k
    return _NLE["ui"]

def tc(t, fps=30):
    f = int(round(t * fps)); return f"00:00:{f // fps:02d}:{f % fps:02d}" if f < 60 * fps else f"00:01:{f // fps - 60:02d}:{f % fps:02d}"

def editor_view(fr, t):
    a0, a1 = NLE["out"]; b0, b1 = NLE["back"]
    if not (a0 <= t < b1): return fr
    p = R.inout_sine((t - a0) / (a1 - a0)) if t < b0 else 1 - R.inout_sine((t - b0) / (b1 - b0))
    if p <= 0: return fr
    ui = nle_static().copy(); W, H = R.W, R.H; k = _NLE["k"]; tx = _NLE["tx"]
    # cabeçote (no tempo real do vídeo) e timecode
    x = tx(t); ui[int(700 * k):int(1064 * k), max(0, x - 1):x + 1] = (.95, .30, .28)
    cv2.fillConvexPoly(ui, np.int32([[x - 7 * k, 700 * k], [x + 7 * k, 700 * k], [x, 712 * k]]), (.95, .30, .28), cv2.LINE_AA)
    tim = R.pil_text(tc(t), "d_sb", 22 * k, (255, 255, 255, 255)); ta = R.np_rgba(tim[0])
    tx0, ty0 = int(988 * k - ta.shape[1] / 2), int(668 * k - ta.shape[0] / 2)
    ui[ty0:ty0 + ta.shape[0], tx0:tx0 + ta.shape[1]] = ui[ty0:ty0 + ta.shape[0], tx0:tx0 + ta.shape[1]] * (1 - ta[..., 3:]) + ta[..., :3] * ta[..., 3:]
    # o quadro encolhe da tela cheia até a janela de prévia
    rx, ry, rw, rh = [v * k for v in PV]
    X0, Y0, WW = rx * p, ry * p, W + (rw - W) * p
    HH = WW * H / W
    Mx = np.float32([[WW / W, 0, X0], [0, HH / H, Y0]])
    small = cv2.warpAffine(fr, Mx, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    m = np.zeros((H, W), np.float32); cv2.rectangle(m, (int(X0), int(Y0)), (int(X0 + WW) - 1, int(Y0 + HH) - 1), 1.0, -1)
    sh = cv2.GaussianBlur(m, (0, 0), 18 * k)[..., None] * .55 * p
    out = ui * (1 - sh) 
    return out * (1 - m[..., None]) + small * m[..., None]

def viewfinder(fr, t):
    a, b = VF
    if not (a <= t < b): return fr
    al = min(1.0, (t - a) * R.FPS / 3, (b - t) * R.FPS / 3); W, H = R.W, R.H; k = W / 1920
    lay = np.zeros((H, W), np.float32)
    I, L, th = int(64 * k), int(70 * k), max(2, int(3 * k))
    for sx, sy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        x = W - I if sx else I; y = H - I if sy else I; dx = -L if sx else L; dy = -L if sy else L
        cv2.line(lay, (x, y), (x + dx, y), 1.0, th, cv2.LINE_AA); cv2.line(lay, (x, y), (x, y + dy), 1.0, th, cv2.LINE_AA)
    for j in (1, 2):
        cv2.line(lay, (W * j // 3, I + L), (W * j // 3, H - I - L), .22, 1, cv2.LINE_AA)
        cv2.line(lay, (I + L, H * j // 3), (W - I - L, H * j // 3), .22, 1, cv2.LINE_AA)
    # caixa de foco no rosto (assenta com mola)
    fx, fy = face_now(t); s = 1 + .35 * (1 - R.back(clampf((t - a) / .22, 0, 1), 1.8))
    bw = int(120 * k * s); cx, cy = int(fx * W), int(fy * H)
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            x, y = cx + sx_ * bw, cy + sy_ * bw
            cv2.line(lay, (x, y), (x - sx_ * int(26 * k), y), 1.0, th, cv2.LINE_AA); cv2.line(lay, (x, y), (x, y - sy_ * int(26 * k)), 1.0, th, cv2.LINE_AA)
    fr = fr * (1 - lay[..., None] * .9 * al) + lay[..., None] * .9 * al
    def txt(s_, fk, px, x, y, col=(255, 255, 255, 255), right=False):
        sp = R.np_rgba(R.pil_text(s_, fk, px * k, col)[0]); h, w = sp.shape[:2]
        x = int(x - w) if right else int(x); y = int(y)
        fr[y:y + h, x:x + w] = fr[y:y + h, x:x + w] * (1 - sp[..., 3:] * al) + sp[..., :3] * sp[..., 3:] * al
    if int((t - a) * 2.5) % 2 == 0:
        cv2.circle(fr, (int(I + 46 * k), int(I + 52 * k)), int(10 * k), (.92, .20, .18), -1, cv2.LINE_AA)
    txt("REC", "d_b", 26, I + 64 * k, I + 36 * k)
    txt(tc(t), "d_m", 24, W - I - 40 * k, I + 36 * k, right=True)
    txt("4K  ·  60 fps", "d_m", 20, I + 40 * k, H - I - 70 * k)
    txt("ISO 100   1/120", "d_m", 20, W - I - 40 * k, H - I - 70 * k, right=True)
    return fr

def face_now(t):
    """rosto no instante exato (YuNet), sem mediana: a caixa de foco tem que cair no rosto."""
    best = min((f for f in R.F if "cx" in f), key=lambda f: abs(f["t"] - t))
    return best["cx"], best["cy"]

def post_fx(fr, t):
    fr = viewfinder(fr, t)
    fr = editor_view(fr, t)
    return fr

def sig_active(t):
    """momentos 'assinatura' que precisam do recorte da pessoa (para ficarem atrás dela)."""
    return (FAB_T["caos"] <= t < FAB_T["sai"] + .4) or (OTG["a"] <= t < OTG["b"] + .4) or (PIPE["a"] <= t < LOGO_P[1] + .4)

def draw_signatures(srcf, t, i):
    ci = R.cena_idx(t + .5 / R.FPS)
    if ci == 1: draw_fabio(srcf, t, i)
    elif ci == 4: draw_otg(srcf, t, i)
    elif ci == 8: draw_enrique(srcf, t, i)

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
        blend(srcf, ya, yb, xa, xb, c, aa)

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
