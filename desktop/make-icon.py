"""The app icon: route 9, in amber LEDs, the way the bus's sign shows it. python make-icon.py -> icon.ico (needs Pillow)."""
from PIL import Image, ImageDraw, ImageFilter

S = 1024
NINE = [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."]
AMBER, DIM = (255, 181, 74), (46, 30, 12)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((40, 40, S - 40, S - 40), radius=150, fill=(14, 13, 15, 255), outline=(52, 46, 40, 255), width=18)

pitch, r = 118, 44
x0 = S // 2 - pitch * 2
y0 = S // 2 - pitch * 3
lit = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(lit)
for row, line in enumerate(NINE):
    for col, ch in enumerate(line):
        cx, cy = x0 + col * pitch, y0 + row * pitch
        box = (cx - r, cy - r, cx + r, cy + r)
        if ch == "#":
            ld.ellipse(box, fill=AMBER + (255,))
        else:
            d.ellipse(box, fill=DIM + (255,))
glow = lit.filter(ImageFilter.GaussianBlur(38))
img = Image.alpha_composite(img, glow)
img = Image.alpha_composite(img, glow)
img = Image.alpha_composite(img, lit)
img.resize((256, 256), Image.LANCZOS).save("icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon.ico")
