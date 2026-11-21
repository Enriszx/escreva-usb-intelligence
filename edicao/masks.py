# Recorte da pessoa (MODNet) em todos os quadros, 960x540, com suavização temporal leve dentro de cada cena.
import onnxruntime as ort, numpy as np, cv2, json, subprocess
so = ort.SessionOptions(); so.intra_op_num_threads = 4
s = ort.InferenceSession("models/modnet.onnx", so, providers=["CPUExecutionProvider"]); nm = s.get_inputs()[0].name
M = json.load(open("mapa.json")); cuts = [c[0] for c in M["cenas"]]
N = int(round(M["fim_video"] * 30))
out = np.lib.format.open_memmap("masks.npy", mode="w+", dtype=np.uint8, shape=(N, 540, 960))
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", "bruto_1080.mp4", "-vf", "fps=30,scale=672:384", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
prev = None
for i in range(N):
    b = p.stdout.read(672 * 384 * 3)
    if len(b) < 672 * 384 * 3: break
    x = np.frombuffer(b, np.uint8).reshape(384, 672, 3).astype(np.float32) / 127.5 - 1
    m = s.run(None, {nm: x.transpose(2, 0, 1)[None]})[0][0, 0]
    m = cv2.resize(m, (960, 540), interpolation=cv2.INTER_LINEAR)
    t = i / 30
    if prev is not None and not any(abs(t - c) < 1 / 30 + 1e-6 and t >= c for c in cuts): m = .65 * m + .35 * prev  # evita tremido
    prev = m; out[i] = np.clip(m * 255, 0, 255).astype(np.uint8)
    if i % 300 == 0: print(i, flush=True)
out.flush(); print("ok", N)
