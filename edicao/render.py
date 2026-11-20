# Renderizador da edição USB Intelligence.
# Uso: python3 render.py <saida.mp4> [--preview 1|2|final] [--frames t1,t2,...]
#  preview 1 = zooms + legenda (720p) · preview 2 = + cards 3D + SFX · final = 1080p do 4K
import json, sys, subprocess, math, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

args = sys.argv[1:]
OUT = args[0]
MODE = args[args.index("--preview") + 1] if "--preview" in args else "1"
ONLY = [float(x) for x in args[args.index("--frames") + 1].split(",")] if "--frames" in args else None

M = json.load(open("mapa.json"))
FPS = 30
W, H = (1920, 1080) if MODE == "final" else (1280, 720)
S = W / 1920  # escala do layout (layout desenhado em 1920x1080)
SRC = "bruto.mp4" if MODE == "final" else "bruto_1080.mp4"
SW, SH = (3840, 2160) if MODE == "final" else (1920, 1080)
FIM = M["fim_video"]; CONG = M["congela"]
NF = int(round(FIM * FPS)); NTOT = NF + int(CONG * FPS)

FONT = {"anton": "/root/.fonts/Anton-Regular.ttf",
        "ital": "/root/.fonts/CrimsonText-SemiBoldItalic.ttf",
        "inter_b": "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
        "inter_xb": "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
        "inter_sb": "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"}
_fc = {}
def font(k, px):
    key = (k, int(px))
    if key not in _fc: _fc[key] = ImageFont.truetype(FONT[k], int(px))
    return _fc[key]

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def clamp(x, a, b): return max(a, min(b, x))
def ease_out_cubic(x): x = clamp(x, 0, 1); return 1 - (1 - x) ** 3
def ease_out_back(x, s=1.7):
    x = clamp(x, 0, 1) - 1; return 1 + (s + 1) * x ** 3 + s * x ** 2

CENAS = M["cenas"]
def cena_idx(t):
    for i, c in enumerate(CENAS):
        if c[0] <= t < c[1]: return i
    return len(CENAS) - 1

# ---------- centro do rosto (suavizado por cena) ----------
F = json.load(open("faces.json"))
def face_track():
    ft = np.array([f["t"] for f in F]); cx = np.array([f.get("cx", np.nan) for f in F]); cy = np.array([f.get("cy", np.nan) for f in F])
    h = np.array([f.get("h", np.nan) for f in F])
    sc = np.array([cena_idx(t) for t in ft])
    ox, oy = np.full_like(cx, .5), np.full_like(cy, .45)
    for i in range(len(CENAS)):
        m = sc == i
        if not m.any(): continue
        ok = m & ~np.isnan(cx)
        if ok.sum() < max(3, .3 * m.sum()): ox[m], oy[m] = .5, .45; continue
        # mediana móvel de ±0,5 s, só dentro da cena (não atravessa corte)
        idx = np.where(m)[0]
        for j in idx:
            w = idx[np.abs(ft[idx] - ft[j]) <= .6]; w = w[~np.isnan(cx[w])]
            if len(w): ox[j] = np.median(cx[w]); oy[j] = np.median(cy[w]) + .35 * np.nanmedian(h[w])  # mira um pouco abaixo do rosto
            else: ox[j], oy[j] = np.nanmedian(cx[ok]), np.nanmedian(cy[ok])
    return ft, ox, oy
FT, FX, FY = face_track()
def center(t):
    return float(np.interp(t, FT, FX)), float(np.interp(t, FT, FY))

# ---------- zoom ----------
Z = M["zoom"]
def zoom(t):
    t = min(t, FIM - 1e-3) if t < FIM else t
    prev = 1.0; k = 0
    for i, (tk, z, tp) in enumerate(Z):
        if tk <= t: k = i
    tk, z, tp = Z[k]; zprev = Z[k - 1][1] if k > 0 else z
    dt = t - tk
    if tp == "snap": a = ease_out_cubic(dt * FPS / 7); val = z * 1.3 + (z - z * 1.3) * a  # 1,3x -> nível em 7 quadros
    elif tp == "punch": a = ease_out_cubic(dt * FPS / 4); val = zprev + (z - zprev) * a
    else: val = z
    return val * (1 + .005 * dt)  # empurrão lento contínuo

# ---------- sprites de texto ----------
def shadowed(img, rad=10, op=150, dy=4):
    a = img.split()[3]
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0)); sh.putalpha(a.point(lambda v: v * op // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(rad * S))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0)); out.alpha_composite(sh, (0, int(dy * S))); out.alpha_composite(img)
    return out

def text_img(txt, fk, px, color, pad=40):
    f = font(fk, px * S); bb = f.getbbox(txt)
    w, h = bb[2] - bb[0], bb[3] - bb[1]; p = int(pad * S)
    im = Image.new("RGBA", (w + 2 * p, h + 2 * p), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((p - bb[0], p - bb[1]), txt, font=f, fill=color)
    return im

LOGO_ICON = Image.open("cards/logo.png").crop((30, 40, 130, 140))

_spr = {}
def sprite(c, line2=True):
    key = (c["txt"], c["tipo"], line2, c.get("cor"))
    if key in _spr: return _spr[key]
    cor = hexrgb(c["cor"]) + (255,)
    tp = c["tipo"]
    if tp == "P": im = text_img(c["txt"], "inter_xb", 68, cor)
    elif tp == "M": im = text_img(c["txt"], "inter_xb", 86, (255, 255, 255, 255))
    elif tp == "C": im = text_img(c["txt"], "anton", 190, cor)
    else:  # K
        a, _, b = c["txt"].partition("|")
        l1 = text_img(a, "anton", 180, (255, 255, 255, 255))
        if c.get("logo"):
            ic = LOGO_ICON.resize((int(120 * S), int(120 * S)), Image.LANCZOS)
            nl = Image.new("RGBA", (l1.width + ic.width + int(10 * S), max(l1.height, ic.height)), (0, 0, 0, 0))
            nl.alpha_composite(ic, (0, (nl.height - ic.height) // 2)); nl.alpha_composite(l1, (ic.width + int(10 * S), (nl.height - l1.height) // 2)); l1 = nl
        if b and line2:
            l2 = text_img(b, "ital", 165, cor)
            ov = int(l2.height * .50)  # linha 2 encaixada embaixo, sobreposta
            w = max(l1.width, l2.width + int(80 * S))
            im = Image.new("RGBA", (w, l1.height + l2.height - ov), (0, 0, 0, 0))
            im.alpha_composite(l1, ((w - l1.width) // 2, 0)); im.alpha_composite(l2, ((w - l2.width) // 2 + int(50 * S), l1.height - ov))
        else: im = l1
    if im.width > W * .92: im = im.resize((int(W * .92), int(im.height * W * .92 / im.width)), Image.LANCZOS)
    im = shadowed(im, 12 if tp in "KC" else 8, 170 if tp in "KC" else 150)
    _spr[key] = im
    return im

SCENE_X = {1: .30, 7: .26, 8: .26}  # Enrique: legenda à esquerda para não cobrir o "Jovem" da camiseta
POS_X = {"esq": .25, "dir": .75, "centro": .5}

def place(base, spr, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.BILINEAR)
    if alpha < 1: a = spr.split()[3].point(lambda v: int(v * alpha)); spr = spr.copy(); spr.putalpha(a)
    x = int(cx * W - spr.width / 2); y = int(cy * H - spr.height / 2)
    x = clamp(x, 0, W - spr.width); y = clamp(y, 0, H - spr.height)
    base.alpha_composite(spr, (x, y))

def draw_captions(base, t):
    for c in M["legenda"]:
        t0, t1 = c["t0"], c["t1"]; top = c.get("fica_no_topo_ate")
        end = top if top else t1
        if not (t0 <= t < end): continue
        ci = cena_idx(t0)
        x = POS_X.get(c.get("pos"), SCENE_X.get(ci, .5)); y = c["y"]
        if c["tipo"] == "K" and c.get("pos") in ("esq", "dir"): y = min(y, .62)
        pop = ease_out_back((t - t0) * FPS / 3)
        sc = .82 + .18 * pop
        if top and t >= t1:  # sobe e fica fixa no topo, menor
            a = ease_out_cubic((t - t1) * FPS / 6)
            x = x + (.5 - x) * a; y = y + (.10 - y) * a; sc = 1 - .5 * a
        has2 = "|" in c["txt"] and t >= c.get("t2", t0)
        spr = sprite(c, has2)
        if has2 and c.get("t2") and t - c["t2"] < 3 / FPS:  # linha 2 entra com pop
            sc *= .96 + .04 * ease_out_back((t - c["t2"]) * FPS / 3)
        place(base, spr, x, y, sc)

_name = {}
def draw_names(base, t):
    for n, tn in M["nomes"]:
        if not (tn <= t < tn + 2.2): continue
        ci = cena_idx(tn); cor = hexrgb(CENAS[ci][3])
        if n not in _name:
            f = font("inter_sb", 46 * S); tw = f.getbbox(n)[2]
            pw, ph = int(tw + 64 * S), int(64 * S)
            im = Image.new("RGBA", (pw, ph), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
            d.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=int(16 * S), fill=(12, 15, 22, 200))
            d.rounded_rectangle([int(14 * S), int(16 * S), int(20 * S), ph - int(16 * S)], radius=int(3 * S), fill=cor + (255,))
            d.text((int(42 * S), ph // 2), n, font=f, fill=(255, 255, 255, 255), anchor="lm")
            _name[n] = shadowed(im, 10, 120)
        im = _name[n]; dt = t - tn
        a = ease_out_cubic(dt * FPS / 8) if dt < 1 else 1 - ease_out_cubic((dt - 1.95) * FPS / 8) if dt > 1.95 else 1
        dx = (1 - ease_out_cubic(dt * FPS / 10)) * -40 * S
        tmp = im.copy(); tmp.putalpha(im.split()[3].point(lambda v: int(v * a)))
        base.alpha_composite(tmp, (int(70 * S + dx), int(H - 170 * S)))

# ---------- quadros ----------
def reader():
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE, bufsize=SW * SH * 3 * 2)
    n = SW * SH * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(SH, SW, 3)

def frame_at(src, t):
    z = zoom(t); cx, cy = center(min(t, FIM - .05))
    cw, ch = SW / z, SH / z
    x0 = clamp(cx * SW - cw / 2, 0, SW - cw); y0 = clamp(cy * SH - ch / 2, 0, SH - ch)
    Mx = np.array([[W / cw, 0, -x0 * W / cw], [0, H / ch, -y0 * H / ch]], np.float32)
    img = cv2.warpAffine(src, Mx, (W, H), flags=cv2.INTER_LINEAR if MODE != "final" else cv2.INTER_LANCZOS4)
    rgb = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert("RGBA")
    draw_captions(rgb, t); draw_names(rgb, t)
    return np.asarray(rgb.convert("RGB"))

def main():
    if ONLY:
        os.makedirs("frames", exist_ok=True)
        want = {int(round(t * FPS)): t for t in ONLY}; last = None
        for i, src in enumerate(reader()):
            last = src
            if i in want: Image.fromarray(frame_at(src, i / FPS)).save(f"frames/f_{want[i]:06.2f}.jpg", quality=90)
            if i > max(want): break
        for i, t in want.items():
            if i >= NF: Image.fromarray(frame_at(last, t)).save(f"frames/f_{t:06.2f}.jpg", quality=90)
        return
    crf = "18" if MODE == "final" else "23"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", "bruto.mp4", "-map", "0:v", "-map", "1:a", "-af", f"apad=pad_dur={CONG}",
                            "-c:v", "libx264", "-crf", crf, "-preset", "veryfast", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-b:a", "192k", "-t", f"{NTOT / FPS:.3f}", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    last = None
    for i, src in enumerate(reader()):
        if i >= NF: break
        last = src; enc.stdin.write(frame_at(src, i / FPS).tobytes())
        if i % 150 == 0: print(f"{i}/{NTOT}", flush=True)
    for i in range(NF, NTOT): enc.stdin.write(frame_at(last, i / FPS).tobytes())
    enc.stdin.close(); enc.wait(); print("ok", OUT)

main()
