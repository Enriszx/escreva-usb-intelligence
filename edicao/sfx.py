# SFX discretos sintetizados (whoosh de ar e "tick" suave) + mixagem com a voz tratada.
import json, wave, numpy as np
from scipy.signal import butter, sosfilt
SR = 48000; rng = np.random.default_rng(7)
M = json.load(open("mapa.json")); TOT = M["fim_video"] + M["congela"]
def db(x): return 10 ** (x / 20)
def whoosh(dur=.5, f0=500, f1=2600, peak=-27):
    n = int(dur * SR); x = rng.standard_normal(n)
    out = np.zeros(n); seg = 256
    for i in range(0, n, seg):  # passa-faixa que sobe e desce (ar passando)
        p = i / n; fc = f0 + (f1 - f0) * np.sin(np.pi * p) ** 1.5
        sos = butter(2, [fc * .6, min(fc * 1.6, 20000)], "bandpass", fs=SR, output="sos")
        out[i:i + seg] = sosfilt(sos, x[max(0, i - 2048):i + seg])[-len(out[i:i + seg]):]
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2.2
    y = out * env; return y / np.abs(y).max() * db(peak)
def tick(peak=-30):
    n = int(.09 * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (1500 * t - 3000 * t * t)) * np.exp(-t / .014)
    y += sosfilt(butter(2, 3000, "highpass", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / .004) * .25
    return y / np.abs(y).max() * db(peak)
L = np.zeros(int(TOT * SR) + SR); R = np.zeros_like(L)
def put(sig, t, pan=0.0):
    i = int(t * SR); n = min(len(sig), len(L) - i)
    L[i:i + n] += sig[:n] * np.sqrt((1 - pan) / 2) * 1.414; R[i:i + n] += sig[:n] * np.sqrt((1 + pan) / 2) * 1.414
def boom(peak=-15):
    n = int(.9 * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * (52 * t - 14 * t * t)) * np.exp(-t / .22) + .5 * np.sin(2 * np.pi * 84 * t) * np.exp(-t / .12))
    nz = sosfilt(butter(2, 900, "lowpass", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / .06) * .9
    y = y + nz; return y / np.abs(y).max() * db(peak)
def debris(dur=.6, peak=-30):
    n = int(dur * SR); y = np.zeros(n)
    for k in range(40):
        i = int(rng.uniform(0, .5) ** 1.6 * SR); m = int(.012 * SR)
        if i + m < n: y[i:i + m] += sosfilt(butter(2, [1500, 7000], "bandpass", fs=SR, output="sos"), rng.standard_normal(m)) * np.exp(-np.arange(m) / (.003 * SR)) * rng.uniform(.3, 1)
    return y / np.abs(y).max() * db(peak)
def shimmer(dur=.7, peak=-30):
    n = int(dur * SR); t = np.arange(n) / SR
    y = sosfilt(butter(2, [5000, 12000], "bandpass", fs=SR, output="sos"), rng.standard_normal(n)) * np.sin(np.pi * t / dur) ** 2
    return y / np.abs(y).max() * db(peak)
for tc, kind in M["transicoes"]:
    if kind == "leak": put(shimmer(.8, -29), tc - .4); put(whoosh(.45, 400, 2000, -29), tc - .2)
    elif kind == "zoom": put(whoosh(.55, 300, 3200, -24), tc - .3)
    else: put(whoosh(.40, 500, 2600, -24), tc - .2, -.3 if kind == "whip_h" else 0)
ph = M["phone"]
put(whoosh(.6, 3200, 700, -26), ph["land"] - .58, .5)          # assobio da queda
put(boom(-15), ph["land"] - .01, .35); put(debris(.6, -29), ph["land"] + .02, .4)
for _, ts in ph["telas"][1:]: put(tick(-33), ts, .4)
for nm, a_, *_ in [(p[0], p[1]) for p in [("importer", 7.75), ("dashboard", 18.55), ("dups", 20.35), ("importer", 23.55), ("library", 25.75), ("library", 33.10)]]:
    put(whoosh(.45, 600, 2400, -30), a_ - .1)
for c in M["legenda"]:
    if c["tipo"] in "KC": put(tick(-32), c["t0"] - .01)
for n, t, *_ in M["nomes"]: put(whoosh(.45, 700, 3000, -30), t - .08, 0); put(tick(-34), t + .1)
put(shimmer(.5, -31), 61.80, -.5); put(shimmer(.5, -31), 62.30, .5); put(tick(-31), 61.80, -.5); put(tick(-31), 62.30, .5)
put(whoosh(.9, 400, 2000, -25), 63.45)  # logo final
st = np.stack([L, R], 1)[:int(TOT * SR)]
o = wave.open("sfx.wav", "wb"); o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR)
o.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
import subprocess
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "voz_final.wav", "-i", "sfx.wav", "-filter_complex",
    f"[0:a]apad=whole_dur={TOT}[v];[v][1:a]amix=inputs=2:duration=first:normalize=0,afade=t=out:st={TOT-0.6}:d=0.6,alimiter=limit=0.89:level=false[o]",
    "-map", "[o]", "-c:a", "pcm_s24le", "-ar", "48000", "mix.wav"], check=True)
print("mix ok", TOT)
