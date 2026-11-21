# Redução de ruído de voz com DeepFilterNet3, com limite de atenuação para soar natural.
import sys, wave, numpy as np, torch
from df.enhance import enhance, init_df
lim = float(sys.argv[1]) if len(sys.argv) > 1 else 15
model, st, _ = init_df(model_base_dir="/root/.cache/DeepFilterNet/DeepFilterNet3", log_level="ERROR")
w = wave.open("audio48k_16.wav"); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, ch).T / 32768
y = enhance(model, st, torch.from_numpy(x.copy()), atten_lim_db=lim).numpy()
o = wave.open(f"voz_df{int(lim)}.wav", "wb"); o.setnchannels(ch); o.setsampwidth(2); o.setframerate(sr)
o.writeframes((np.clip(y.T, -1, 1) * 32767).astype(np.int16).tobytes()); o.close(); print("ok", sr, ch)
