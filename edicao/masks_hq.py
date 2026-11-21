# Recorte em alta (896x512), sem suavização temporal, só nas cenas do Gustavo (mãos rápidas na frente do celular).
import onnxruntime as ort, numpy as np, cv2, subprocess
so = ort.SessionOptions(); so.intra_op_num_threads = 4
s = ort.InferenceSession("models/modnet.onnx", so, providers=["CPUExecutionProvider"]); nm = s.get_inputs()[0].name
a, b = int(37.53 * 30), int(51.77 * 30)
M = np.load("masks.npy", mmap_mode="r+")
p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{a/30:.4f}", "-i", "bruto_1080.mp4", "-vf", "fps=30,scale=896:512", "-frames:v", str(b - a + 2), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
for i in range(a, b + 1):
    buf = p.stdout.read(896 * 512 * 3)
    if len(buf) < 896 * 512 * 3: break
    x = np.frombuffer(buf, np.uint8).reshape(512, 896, 3).astype(np.float32) / 127.5 - 1
    m = s.run(None, {nm: x.transpose(2, 0, 1)[None]})[0][0, 0]
    M[i] = np.clip(cv2.resize(m, (960, 540), interpolation=cv2.INTER_AREA) * 255, 0, 255).astype(np.uint8)
    if i % 100 == 0: print(i, flush=True)
M.flush(); print("ok")
