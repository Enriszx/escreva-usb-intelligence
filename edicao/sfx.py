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
PAN = {"esq": -.5, "esq-topo": -.5, "dir": .5, "dir-topo": .5, "centro": 0, "centro-topo": 0}
for name, a, b, lado in M["cards"]:
    put(whoosh(.5 if lado != "centro" else .9, peak=-27 if lado != "centro" else -24), a - .18, PAN[lado])
for c in M["legenda"]:
    if c["tipo"] in "KC": put(tick(-31), c["t0"] - .01)
for n, t in M["nomes"]: put(whoosh(.35, 900, 3200, -33), t - .05, -.6)
st = np.stack([L, R], 1)[:int(TOT * SR)]
o = wave.open("sfx.wav", "wb"); o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR)
o.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
import subprocess
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "voz_final.wav", "-i", "sfx.wav", "-filter_complex",
    f"[0:a]apad=whole_dur={TOT}[v];[v][1:a]amix=inputs=2:duration=first:normalize=0,afade=t=out:st={TOT-0.6}:d=0.6,alimiter=limit=0.89:level=false[o]",
    "-map", "[o]", "-c:a", "pcm_s24le", "-ar", "48000", "mix.wav"], check=True)
print("mix ok", TOT)
