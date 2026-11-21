# Tracking de câmera: segue pontos do FUNDO (fora do recorte da pessoa) e estima, quadro a quadro,
# a homografia do quadro de referência da cena -> quadro atual. Resultado em camtrack.json.
import numpy as np, cv2, json, sys
M = json.load(open("mapa.json")); MS = np.load("masks.npy", mmap_mode="r")
CENAS = [c for c in M["cenas"]]
W2, H2 = 960, 540
def region_mask(name, i):
    pm = np.asarray(MS[min(i, len(MS) - 1)]) > 40
    pm = cv2.dilate(pm.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    m = np.ones((H2, W2), np.uint8) * 255; m[pm] = 0
    return m
out = {}
# lê o vídeo inteiro em sequência (sem pular quadros: o seek do OpenCV é impreciso)
cap = cv2.VideoCapture("bruto_1080.mp4"); G = []
while True:
    ok, f = cap.read()
    if not ok: break
    G.append(cv2.cvtColor(cv2.resize(f, (W2, H2)), cv2.COLOR_BGR2GRAY))
print("quadros", len(G))
diff = [0] + [float(np.abs(G[i].astype(np.int16) - G[i - 1]).mean()) for i in range(1, len(G))]
for ci, (a, b, nome, *_r) in enumerate(CENAS):
    # quadro exato do corte: maior diferença perto do tempo do mapa
    i0 = int(round(a * 30))
    if ci > 0:
        win = range(max(1, i0 - 3), min(len(G) - 1, i0 + 4)); i0 = max(win, key=lambda k: diff[k])
    i1 = min(len(G), int(round(b * 30)) + 3)
    prev = G[i0]; Hacc = np.eye(3); mats = [Hacc.tolist()]
    pts = cv2.goodFeaturesToTrack(prev, 600, .01, 8, mask=region_mask(nome, i0))
    for i in range(i0 + 1, i1):
        g = G[i]
        if pts is None or len(pts) < 80:
            pts = cv2.goodFeaturesToTrack(prev, 600, .01, 8, mask=region_mask(nome, i - 1))
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, winSize=(21, 21), maxLevel=3)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, nxt, None, winSize=(21, 21), maxLevel=3)
        good = (st[:, 0] == 1) & (st2[:, 0] == 1) & (np.linalg.norm((back - pts).reshape(-1, 2), axis=1) < .7)
        pm = np.asarray(MS[min(i, len(MS) - 1)]) > 40
        q = nxt.reshape(-1, 2); inside = pm[np.clip(q[:, 1].astype(int), 0, H2 - 1), np.clip(q[:, 0].astype(int), 0, W2 - 1)]
        good &= ~inside
        p0, p1 = pts.reshape(-1, 2)[good], q[good]
        Hs = None
        if len(p0) >= 12: Hs, inl = cv2.findHomography(p0, p1, cv2.RANSAC, 1.5)
        if Hs is None: Hs = np.eye(3)
        Hacc = Hs @ Hacc; mats.append((Hacc / Hacc[2, 2]).tolist())
        pts = p1.reshape(-1, 1, 2).astype(np.float32); prev = g
    out[str(ci)] = {"i0": i0, "H": mats}
    print(f"{nome:28s} i0={i0} ({i0/30:.3f}s) quadros {len(mats)}", flush=True)
json.dump(out, open("camtrack.json", "w"))
