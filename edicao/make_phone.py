# Celular com telas do USB Intelligence (montadas a partir dos cards), para o mockup 3D ao lado do Gustavo.
from PIL import Image, ImageDraw, ImageFont
import os
W, H = 600, 1260; R = 90; B = 22
INTER = "/usr/share/fonts/opentype/inter/"
def F(n, s): return ImageFont.truetype(INTER + n, s)
def phone(cards, name):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=R, fill=(28, 30, 36, 255))            # aro
    d.rounded_rectangle([3, 3, W - 4, H - 4], radius=R - 3, outline=(120, 126, 140, 255), width=3)
    d.rounded_rectangle([B, B, W - B, H - B], radius=R - B, fill=(9, 11, 16, 255))          # tela
    d.rounded_rectangle([W // 2 - 70, B + 18, W // 2 + 70, B + 58], radius=20, fill=(0, 0, 0, 255))  # ilha
    d.text((B + 44, B + 24), "9:41", font=F("Inter-SemiBold.otf", 26), fill=(236, 240, 248))
    d.rounded_rectangle([W - B - 92, B + 30, W - B - 50, B + 48], radius=5, outline=(236, 240, 248), width=2)
    d.rectangle([W - B - 89, B + 33, W - B - 60, B + 45], fill=(236, 240, 248))
    y = B + 92; inner = W - 2 * B - 36
    for c in cards:
        cm = Image.open(f"cards/{c}.png"); k = inner / cm.width
        cm = cm.resize((inner, int(cm.height * k)), Image.LANCZOS)
        if y + cm.height > H - B - 40: break
        im.alpha_composite(cm, (B + 18, y)); y += cm.height + 18
    d.rounded_rectangle([W // 2 - 80, H - B - 22, W // 2 + 80, H - B - 14], radius=4, fill=(200, 205, 215, 255))
    im.save(f"cards/phone_{name}.png")
phone(["dashboard", "donut"], "dash"); phone(["importer", "library"], "offline"); phone(["ai", "dups"], "ia")
print(sorted(os.listdir("cards")))
