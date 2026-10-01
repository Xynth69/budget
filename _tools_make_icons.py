"""Generate the app icons: three budget bars on white. Run: python3 _tools_make_icons.py [outdir]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

S = 2048  # draw large, downsample for anti-aliasing
TRACK = (233, 235, 241)
BARS = [((52, 178, 102), 0.86), ((245, 160, 40), 0.55), ((226, 72, 60), 0.24)]

def icon(scale):
    img = Image.new('RGB', (S, S), (255, 255, 255))
    d = ImageDraw.Draw(img)
    w, h, gap = S * 0.62 * scale, S * 0.11 * scale, S * 0.075 * scale
    x0 = (S - w) / 2
    y = (S - (3 * h + 2 * gap)) / 2
    for color, level in BARS:
        d.rounded_rectangle([x0, y, x0 + w, y + h], h / 2, fill=TRACK)
        d.rounded_rectangle([x0, y, x0 + max(h, w * level), y + h], h / 2, fill=color)
        y += h + gap
    return img

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'icons')
out.mkdir(exist_ok=True)
full, safe = icon(1.0), icon(0.8)
for name, src, px in [('apple-touch-icon.png', full, 180), ('icon-192.png', full, 192),
                      ('icon-512.png', full, 512), ('icon-maskable-512.png', safe, 512)]:
    src.resize((px, px), Image.LANCZOS).save(out / name, optimize=True)
    print('wrote', out / name)
