# usage: python -I tools/effects-guide/crop.py docs/screenshots/interest-effects tools/effects-guide/out/img
# Crop to a 3:2 frame around each chosen box (grow the short side, clamp to the image), plus full screenshots for the lightbox.
import json, sys, shutil
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
R = 1.5
def fit(box, W, H):
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if w / h < R: w = h * R
    else: h = w / R
    if w > W: w = W; h = w / R
    if h > H: h = H; w = h * R
    x0 = min(max(cx - w / 2, 0), W - w); y0 = min(max(cy - h / 2, 0), H - h)
    return tuple(round(v) for v in (x0, y0, x0 + w, y0 + h))
os_ = __import__('os'); os_.makedirs(out, exist_ok=True)
spec = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'crops.json'), encoding='utf-8'))
used = set()
for name, f, box, hl in spec:
    im = Image.open(f'{src}/{f}').convert('RGB')
    if hl:
        d = ImageDraw.Draw(im)
        for b in hl: d.rounded_rectangle([b[0]-6, b[1]-6, b[2]+6, b[3]+6], radius=14, outline=(200, 100, 58), width=4)
    full = (0, 0, im.width, im.height)
    # 세로로 긴 것(미니맵·이펙트 패널)은 3:2 로 맞추지 않고 고른 상자 그대로
    b = tuple(box or full) if name in ('f-minimap', 'x-panel') else fit(box or full, im.width, im.height)
    c = im.crop(b)
    if c.width > 900: c = c.resize((900, round(c.height * 900 / c.width)), Image.LANCZOS)
    c.save(f'{out}/{name}.jpg', quality=82, optimize=True, progressive=True)
    print(name, c.size)
    if im.width == 1440 and f not in used:
        used.add(f); __import__('os').makedirs(f'{out}/full', exist_ok=True); Image.open(f'{src}/{f}').convert('RGB').save(f'{out}/full/{f}', quality=80, optimize=True, progressive=True)
