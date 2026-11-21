# Tracking das mãos do Enrique (61,5–63,53 s): pele dentro do recorte da pessoa, abaixo do rosto.
import numpy as np, cv2, json
M = json.load(open("mapa.json")); MS = np.load("masks.npy", mmap_mode="r")
F = json.load(open("faces.json"))
cap = cv2.VideoCapture("bruto_1080.mp4"); i0, i1 = int(61.4 * 30), int(63.53 * 30)
cap.set(cv2.CAP_PROP_POS_FRAMES, i0)
out = []
for i in range(i0, i1):
    ok, f = cap.read()
    if not ok: break
    f = cv2.resize(f, (960, 540)); m = np.asarray(MS[min(i, len(MS) - 1)]) > 110
    fc = min((x for x in F if "cx" in x), key=lambda x: abs(x["t"] - i / 30))
    ycc = cv2.cvtColor(f, cv2.COLOR_BGR2YCrCb)
    skin = (ycc[..., 1] > 135) & (ycc[..., 1] < 180) & (ycc[..., 2] > 85) & (ycc[..., 2] < 135) & m
    fy1 = int((fc["cy"] + .62 * fc["h"]) * 540)          # abaixo do queixo
    skin[:fy1 + 10] = False
    skin = cv2.morphologyEx(skin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(skin)
    fx = fc["cx"] * 960; res = {"t": round(i / 30, 3)}
    for side, cond in (("L", lambda x: x < fx - 60), ("R", lambda x: x > fx + 60)):
        c = [(st[k, 4], k) for k in range(1, n) if st[k, 4] > 250 and cond(cen[k][0])]
        if c:
            a, k = max(c); x, y, w, h = st[k, :4]
            res[side] = [round(float(cen[k][0]) / 960, 4), round(float(y + h * .25) / 540, 4), int(a)]
    out.append(res)
json.dump(out, open("hands.json", "w"))
for r in out[::6]: print(r)
