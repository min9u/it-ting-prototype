# 문서용 나란히 그림 (2026-11-18, docs/room-diversity-2-2026-11-18.md)
# 사용: python -I tools/room-diversity/montage.py <출력.jpg> <폭> <그림1> <이름1> [<그림2> <이름2> ...]
# - 그림마다 방 둘레(가로 130~1310px)를 잘라 같은 폭으로 줄이고 위에 이름표를 붙여 가로로 나란히. 200KB 넘으면 품질을 낮춤
import os
import sys

from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

out, width = sys.argv[1], int(sys.argv[2])
pairs = list(zip(sys.argv[3::2], sys.argv[4::2]))
CROP = (130, 0, 1310, 836)
font = None
for f in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf', '/System/Library/Fonts/AppleSDGothicNeo.ttc'):
    if os.path.exists(f):
        font = ImageFont.truetype(f, 15)
        break
tiles = []
for path, label in pairs:
    im = Image.open(path).convert('RGB')
    if im.width >= CROP[2]:
        im = im.crop(CROP)
    im = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    tw = d.textlength(label, font=font) if font else len(label) * 8
    d.rectangle((0, 0, tw + 16, 26), fill=(255, 250, 244))
    d.text((8, 4), label, fill=(62, 42, 31), font=font)
    tiles.append(im)
gap = 6
W = sum(t.width for t in tiles) + gap * (len(tiles) - 1)
H = max(t.height for t in tiles)
sheet = Image.new('RGB', (W, H), (255, 255, 255))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0))
    x += t.width + gap
q = 84
while True:
    sheet.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= 200_000 or q <= 55:
        break
    q -= 5
print(f'{out} {sheet.size} {os.path.getsize(out) // 1000}KB q{q}')
