# Gera o fundo panorâmico contínuo (12 slides): escuridão -> papel envelhecido (borda queimada) -> escuridão
import numpy as np
from PIL import Image, ImageFilter
W,H=12960,1350
rng=np.random.default_rng(1517)
def field(w,h,blur):
    a=rng.random((h,w)).astype(np.float32)
    im=Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    im=im.resize((W,H),Image.BICUBIC)
    f=np.asarray(im,dtype=np.float32)/255.
    return (f-f.mean())/(f.std()+1e-6)
low=field(260,28,2.2)      # manchas grandes
mid=field(1300,135,1.6)    # mosqueado
fine=field(4320,450,0.8)
grain=(rng.random((H,W)).astype(np.float32)-.5)

x=np.arange(W,dtype=np.float32)
def ramp(x,a,b): return np.clip((x-a)/(b-a),0,1)
L=ramp(x,4050,4650)*(1-ramp(x,10560,11240))          # 0 escuro / 1 papel
L=np.broadcast_to(L,(H,W))
edge=L+low*0.09+mid*0.02+fine*0.006-0.5                          # borda irregular
paper=np.clip(edge*60+.5,0,1)
char=np.exp(-(edge*16)**2)                             # faixa queimada
# papel
base=np.array([228,214,184],np.float32)
stain=np.array([168,122,66],np.float32)
y=np.arange(H,dtype=np.float32)[:,None]
vy=np.clip(1-((y-H/2)/(H/2))**2,0,1)**.35             # escurece topo/base
p=base[None,None,:]*(0.95+0.016*mid[...,None]+0.012*fine[...,None]+0.035*grain[...,None])
st=np.clip(low*0.45+0.1,0,1)[...,None]*0.16
p=p*(1-st)+stain*st
p=p*(0.80+0.20*vy[...,None])
# escuro (tinta)
d=np.array([16,12,10],np.float32)[None,None,:]*(1+0.10*low[...,None]+0.06*grain[...,None])
out=d*(1-paper[...,None])+p*paper[...,None]
# chamuscado: o papel escurece em direção à borda queimada
sc=np.exp(-np.clip(edge,0,None)*26)[...,None]*paper[...,None]
scorch=np.array([62,38,20],np.float32)
out=out*(1-0.85*sc)+scorch*0.85*sc
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save('assets/fundo.jpg',quality=90)
print('ok')
