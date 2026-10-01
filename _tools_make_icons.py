"""Generate the app icons: two glowing fuel tubes on black. Run: python3 _tools_make_icons.py [outdir]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S = 2048  # draw large, downsample for anti-aliasing
CYAN, AMBER, TUBE, BG_GLOW = (120, 214, 238), (246, 190, 70), (28, 32, 48), (40, 60, 150)

def tube(img, glow, x, top, bottom, w, level, color):
    """Tube outline plus a flat-topped liquid column clipped to the tube's rounded interior."""
    draw, r, inset = ImageDraw.Draw(img), w // 2, S // 90
    draw.rounded_rectangle([x, top, x + w, bottom], r, fill=TUBE, outline=(70, 80, 110), width=S // 160)
    inner = [x + inset, top + inset, x + w - inset, bottom - inset]
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(inner, r - inset, fill=255)
    fill_top = int(bottom - (bottom - top) * level)
    column = Image.new('L', (S, S), 0)
    ImageDraw.Draw(column).rectangle([0, fill_top, S, S], fill=255)
    liquid = Image.composite(column, Image.new('L', (S, S), 0), mask)
    img.paste(color, mask=liquid)
    glow.paste(color, mask=liquid)
    draw.rectangle([inner[0], fill_top, inner[2], fill_top + S // 140], fill=(245, 250, 255))

def icon(scale_content):
    img = Image.new('RGB', (S, S), (0, 0, 0))
    halo = Image.new('RGB', (S, S), (0, 0, 0))
    ImageDraw.Draw(halo).ellipse([S * .1, -S * .35, S * .9, S * .45], fill=BG_GLOW)
    img = Image.blend(img, halo.filter(ImageFilter.GaussianBlur(S // 8)), 0.8)
    glow_layer = Image.new('RGB', (S, S), (0, 0, 0))
    c, w = S / 2, int(S * 0.17 * scale_content)
    top, bottom = c - S * 0.30 * scale_content, c + S * 0.30 * scale_content
    gap = S * 0.06 * scale_content
    tube(img, glow_layer, int(c - gap / 2 - w), top, bottom, w, 0.72, CYAN)
    tube(img, glow_layer, int(c + gap / 2), top, bottom, w, 0.3, AMBER)
    glow = glow_layer.filter(ImageFilter.GaussianBlur(S // 30))
    return Image.blend(img, Image.composite(glow, img, glow.convert('L')), 0.35)

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'icons')
out.mkdir(exist_ok=True)
full, safe = icon(1.0), icon(0.78)
for name, src, px in [('apple-touch-icon.png', full, 180), ('icon-192.png', full, 192),
                      ('icon-512.png', full, 512), ('icon-maskable-512.png', safe, 512)]:
    src.resize((px, px), Image.LANCZOS).save(out / name, optimize=True)
    print('wrote', out / name)
