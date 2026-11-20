from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cards"); os.makedirs(OUT, exist_ok=True)
INTER = "/usr/share/fonts/opentype/inter/"
def F(w, s): return ImageFont.truetype(INTER + {"r":"Inter-Regular.otf","m":"Inter-Medium.otf","sb":"Inter-SemiBold.otf","b":"Inter-Bold.otf"}[w], s)
ANTON = "/root/.fonts/Anton-Regular.ttf"

BG=(12,15,22); PANEL=(20,24,34); LINE=(40,46,62); TXT=(236,240,248); MUT=(140,150,170)
BLUE=(59,130,246); CYAN=(34,211,238); VIO=(139,92,246); GRN=(34,197,94); AMB=(245,158,11); PNK=(236,72,153)
S=2  # supersample

def base(w,h,title):
    im=Image.new("RGBA",(w*S,h*S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,w*S-1,h*S-1],radius=34*S,fill=BG+(240,),outline=(70,80,105,255),width=2*S)
    # header
    d.ellipse([28*S,26*S,40*S,38*S],fill=(255,95,87)); d.ellipse([48*S,26*S,60*S,38*S],fill=(254,188,46)); d.ellipse([68*S,26*S,80*S,38*S],fill=(40,200,64))
    d.text((100*S,22*S),"USB Intelligence",font=F("sb",17*S),fill=MUT)
    d.text((28*S,62*S),title,font=F("b",30*S),fill=TXT)
    return im,d

def fin(im,name):
    w,h=im.size; im=im.resize((w//S,h//S),Image.LANCZOS); im.save(f"{OUT}/{name}.png")

def p(*v): return [x*S for x in v]

# 1 Dashboard
def dashboard():
    W,H=640,440; im,d=base(W,H,"Dashboard")
    stats=[("Arquivos","12.480",BLUE),("Espaço","14,2 GB",CYAN),("Duplicados","128",PNK)]
    for i,(l,v,c) in enumerate(stats):
        x=28+i*196; d.rounded_rectangle(p(x,112,x+180,200),radius=18*S,fill=PANEL)
        d.text(p(x+16,124),l,font=F("m",15*S),fill=MUT); d.text(p(x+16,148),v,font=F("b",28*S),fill=TXT)
        d.rounded_rectangle(p(x+16,190,x+164,194),radius=2*S,fill=LINE); d.rounded_rectangle(p(x+16,190,x+16+int(148*(0.4+0.2*i)),194),radius=2*S,fill=c)
    d.rounded_rectangle(p(28,216,W-28,H-28),radius=18*S,fill=PANEL)
    d.text(p(46,230),"Importações por semana",font=F("m",15*S),fill=MUT)
    vals=[30,52,41,68,59,84,72,96]; bx=50; bw=56
    for i,v in enumerate(vals):
        x=bx+i*68; y1=H-46; y0=y1-int(v*1.25)
        c=BLUE if i<7 else CYAN
        d.rounded_rectangle(p(x,y0,x+bw,y1),radius=10*S,fill=c if i==7 else c[:3]+(170,))
    fin(im,"dashboard")

# 2 Donut file types
def donut():
    W,H=440,440; im,d=base(W,H,"Tipos de arquivo")
    cx,cy,r=150,265,105; parts=[("Fotos",.42,BLUE),("Vídeos",.26,VIO),("Docs",.18,CYAN),("Áudio",.14,AMB)]
    a=-90
    for n,f,c in parts:
        d.pieslice(p(cx-r,cy-r,cx+r,cy+r),a,a+f*360-1.5,fill=c); a+=f*360
    d.ellipse(p(cx-62,cy-62,cx+62,cy+62),fill=BG)
    d.text(p(cx,cy-10),"16 GB",font=F("b",24*S),fill=TXT,anchor="mm"); d.text(p(cx,cy+18),"pendrive",font=F("m",14*S),fill=MUT,anchor="mm")
    for i,(n,f,c) in enumerate(parts):
        y=180+i*44; d.rounded_rectangle(p(282,y,296,y+14),radius=4*S,fill=c)
        d.text(p(306,y-4),n,font=F("m",16*S),fill=TXT); d.text(p(306,y+16),f"{int(f*100)}%",font=F("r",13*S),fill=MUT)
    fin(im,"donut")

# 3 Library grid
def library():
    W,H=560,440; im,d=base(W,H,"Biblioteca")
    d.rounded_rectangle(p(28,110,W-28,148),radius=19*S,fill=PANEL)
    d.ellipse(p(44,120,60,136),outline=MUT,width=2*S); d.line(p(57,133,64,140),fill=MUT,width=2*S)
    d.text(p(74,118),"Pesquisar arquivos, tags…",font=F("r",16*S),fill=MUT)
    cols=[BLUE,VIO,CYAN,AMB,PNK,GRN,BLUE,CYAN]; ic=["JPG","MP4","PDF","MP3","PNG","DOC","ZIP","MOV"]
    for i in range(8):
        x=28+(i%4)*128; y=166+(i//4)*128
        d.rounded_rectangle(p(x,y,x+116,y+116),radius=16*S,fill=PANEL)
        c=cols[i]; d.rounded_rectangle(p(x+14,y+14,x+102,y+76),radius=10*S,fill=c[:3]+(200,))
        d.text(p(x+58,y+45),ic[i],font=F("b",17*S),fill=(255,255,255),anchor="mm")
        d.rounded_rectangle(p(x+14,y+88,x+86,y+96),radius=4*S,fill=LINE)
    fin(im,"library")

# 4 Duplicates
def dups():
    W,H=520,400; im,d=base(W,H,"Duplicados")
    d.text(p(28,104),"128 arquivos repetidos",font=F("m",17*S),fill=PNK)
    rows=[("IMG_2041.jpg","3 cópias","8,4 MB"),("video_final.mp4","2 cópias","412 MB"),("trabalho.pdf","4 cópias","2,1 MB")]
    for i,(n,c,s) in enumerate(rows):
        y=142+i*62; d.rounded_rectangle(p(28,y,W-28,y+52),radius=14*S,fill=PANEL)
        d.rounded_rectangle(p(40,y+11,70,y+41),radius=8*S,fill=PNK[:3]+(200,))
        d.text(p(84,y+8),n,font=F("sb",16*S),fill=TXT); d.text(p(84,y+28),c,font=F("r",13*S),fill=MUT)
        d.text(p(W-44,y+26),s,font=F("m",14*S),fill=MUT,anchor="rm")
    d.rounded_rectangle(p(28,H-66,W-28,H-24),radius=21*S,fill=PNK)
    d.text(p(W//2,H-45),"Liberar 1,2 GB",font=F("b",17*S),fill=(255,255,255),anchor="mm")
    fin(im,"dups")

# 5 Import from USB
def importer():
    W,H=520,360; im,d=base(W,H,"Importando pendrive")
    # usb icon
    d.rounded_rectangle(p(40,120,150,190),radius=14*S,fill=PANEL,outline=BLUE,width=3*S)
    d.rectangle(p(150,138,186,172),fill=MUT); d.rectangle(p(160,146,168,152),fill=BG); d.rectangle(p(160,158,168,164),fill=BG)
    d.text(p(95,155),"16GB",font=F("b",18*S),fill=TXT,anchor="mm")
    d.text(p(214,122),"Pendrive USB · OTG",font=F("sb",17*S),fill=TXT); d.text(p(214,148),"3.214 de 4.020 arquivos",font=F("r",14*S),fill=MUT)
    d.rounded_rectangle(p(40,222,W-40,240),radius=9*S,fill=PANEL)
    d.rounded_rectangle(p(40,222,40+int((W-80)*.8),240),radius=9*S,fill=CYAN)
    d.text(p(40,256),"80% · organizando por tipo e data",font=F("m",15*S),fill=MUT)
    d.rounded_rectangle(p(40,292,230,330),radius=19*S,fill=BLUE); d.text(p(135,311),"Offline ✓",font=F("b",16*S),fill=(255,255,255),anchor="mm")
    fin(im,"importer")

# 6 AI search
def ai():
    W,H=520,300; im,d=base(W,H,"IA opcional")
    d.rounded_rectangle(p(28,110,W-28,160),radius=25*S,fill=PANEL,outline=VIO,width=2*S)
    d.text(p(52,123),"“fotos do batismo de 2025”",font=F("m",17*S),fill=TXT)
    tags=[("#igreja",VIO),("#2025",BLUE),("#fotos",CYAN)]; x=28
    for t,c in tags:
        w=int(d.textlength(t,font=F("sb",15*S))/S)+28; d.rounded_rectangle(p(x,182,x+w,214),radius=16*S,fill=c[:3]+(60,),outline=c,width=2*S)
        d.text(p(x+14,189),t,font=F("sb",15*S),fill=TXT); x+=w+10
    d.text(p(28,236),"38 resultados em 0,2 s",font=F("m",16*S),fill=GRN)
    fin(im,"ai")

# 7 Logo plate
def logo():
    W,H=560,180; im=Image.new("RGBA",(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle(p(0,0,W-1,H-1),radius=40*S,fill=BG+(235,),outline=(80,90,120,255),width=2*S)
    # icon
    d.rounded_rectangle(p(30,40,130,140),radius=26*S,fill=BLUE)
    d.rounded_rectangle(p(58,62,102,108),radius=6*S,fill=(255,255,255)); d.rectangle(p(66,48,94,62),fill=(255,255,255))
    d.rectangle(p(72,52,77,57),fill=BLUE); d.rectangle(p(83,52,88,57),fill=BLUE)
    d.text(p(154,48),"USB",font=ImageFont.truetype(ANTON,46*S),fill=TXT)
    d.text(p(246,38),"Intelligence",font=ImageFont.truetype("/root/.fonts/CrimsonText-SemiBoldItalic.ttf",54*S),fill=(250,204,21))
    d.text(p(156,112),"organize seu pendrive com inteligência",font=F("m",15*S),fill=MUT)
    fin(im,"logo")

for f in (dashboard,donut,library,dups,importer,ai,logo): f()
print(os.listdir(OUT))
