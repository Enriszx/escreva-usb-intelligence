# Tratamento de áudio natural: DeepFilterNet (atenuação limitada a 15 dB, mantém ambiente)
# -> nivelamento por pessoa -> EQ leve, de-esser, compressão suave -> loudness -14 LUFS.
import subprocess, json, re, wave, numpy as np
CORTES = [0, 4.5, 13.23, 22.47, 37.53, 51.77, 63.53]
def lufs(f, a, b):
    o = subprocess.run(["ffmpeg", "-v", "info", "-ss", str(a), "-to", str(b), "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", o)[-1])
w = wave.open("voz_df15.wav"); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2).mean(1) / 32768
g = np.ones_like(x); alvo = -19.0
for a, b in zip(CORTES[1:-1], CORTES[2:]):  # trechos com fala (a bike fica como está)
    l = lufs("voz_df15.wav", a, b); db = np.clip(alvo - l, -6, 6); print(f"{a:6.2f}-{b:6.2f} {l:6.1f} LUFS -> {db:+.1f} dB")
    i0, i1 = int(a * sr), int(b * sr); g[i0:i1] = 10 ** (db / 20)
k = int(.02 * sr); g = np.convolve(g, np.ones(k) / k, mode="same")  # rampas de 20 ms nos cortes
y = np.clip(x * g, -1, 1)
o = wave.open("voz_nivel.wav", "wb"); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((y * 32767).astype(np.int16).tobytes()); o.close()
CH = ("highpass=f=90:poles=2,highpass=f=90:poles=2,equalizer=f=220:t=q:w=1.0:g=-2.5,equalizer=f=3200:t=q:w=1.2:g=2.0,"
      "equalizer=f=9000:t=q:w=0.8:g=1.0,deesser=i=0.35:f=0.5,"
      "acompressor=threshold=0.1:ratio=2.5:attack=12:release=180:makeup=1.6:knee=4")
m = subprocess.run(["ffmpeg", "-v", "info", "-i", "voz_nivel.wav", "-af", CH + ",loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
ln = f"loudnorm=I=-14:TP=-1.5:LRA=7:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "voz_nivel.wav", "-af", CH + "," + ln + ",aresample=48000", "-ac", "2", "-c:a", "pcm_s24le", "voz_final.wav"], check=True)
print("final", lufs("voz_final.wav", 0, 63.53), "LUFS")
