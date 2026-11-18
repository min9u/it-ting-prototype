# 대분류 색 묶음 12개 견본 그림 (문서용, docs/room-diversity-2-2026-11-18.md)
# 사용: python -I tools/room-diversity/themes-image.py <out/data.json> <출력.jpg>
# data.json(후 묶음)의 themes 를 카드로: 벽 · 바닥 · 나무 · 러그 + 가구 팔레트 8자리, 아래에 그 묶음의 방 사진(후, 대분류 하나만 고른 사람)
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
OUT = os.path.dirname(os.path.abspath(sys.argv[1]))
A = data['sets']['after']
font = bold = None
for f in ('C:/Windows/Fonts/malgun.ttf', '/System/Library/Fonts/AppleSDGothicNeo.ttc'):
    if os.path.exists(f):
        font = ImageFont.truetype(f, 13)
        bold = ImageFont.truetype(f.replace('malgun.ttf', 'malgunbd.ttf') if os.path.exists(f.replace('malgun.ttf', 'malgunbd.ttf')) else f, 16)
        break
PAL = ['cream', 'green', 'orange', 'sky', 'yellow', 'wood_light', 'wood_dark', 'stone']
# 대분류 하나만 고른 사람 (A 1~12) 의 방 사진
one = {r['theme']['id']: r['key'] for r in A['rooms'] if r['group'] == 'a' and r['theme'] and r['key'][1:3].isdigit() and int(r['key'][1:3]) <= 12}
CW, CH = 300, 330
cols = 4
themes = sorted(A['themes'], key=lambda t: list(one.keys()).index(t['id']) if t['id'] in one else 99)
rows = (len(themes) + cols - 1) // cols
sheet = Image.new('RGB', (cols * CW + (cols + 1) * 10, rows * CH + (rows + 1) * 10), (251, 244, 236))
for i, t in enumerate(themes):
    x0, y0 = 10 + (i % cols) * (CW + 10), 10 + (i // cols) * (CH + 10)
    d = ImageDraw.Draw(sheet)
    d.rounded_rectangle((x0, y0, x0 + CW, y0 + CH), 12, fill=(255, 250, 244), outline=(232, 211, 191))
    d.text((x0 + 12, y0 + 8), t['name'], fill=(62, 42, 31), font=bold)
    d.text((x0 + 12, y0 + 30), t['note'], fill=(138, 114, 98), font=font)
    sh = t['shell']
    sw = [(sh['wall'], '벽', 84), (sh['floor'], '바닥', 56), (sh['wood'], '나무', 56), (t['rug'], '러그', 56)]
    x = x0 + 12
    for c, n, w in sw:
        d.rounded_rectangle((x, y0 + 54, x + w, y0 + 88), 6, fill=c, outline=(0, 0, 0, 30))
        d.text((x + 4, y0 + 70), n, fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        x += w + 4
    pw = (CW - 24 - 7 * 3) / 8
    for k, p in enumerate(PAL):
        px = x0 + 12 + k * (pw + 3)
        d.rounded_rectangle((px, y0 + 94, px + pw, y0 + 106), 3, fill=t['colors'][p])
    key = one.get(t['id'])
    if key:
        im = Image.open(os.path.join(OUT, 'img', 'after', 'rooms', key + '.jpg')).convert('RGB')
        im = im.resize((CW - 24, round((CW - 24) * im.height / im.width)), Image.LANCZOS)
        sheet.paste(im, (x0 + 12, y0 + 114))
q = 84
while True:
    sheet.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= 200_000 or q <= 50:
        break
    q -= 4
print(f'{out} {sheet.size} {os.path.getsize(out) // 1000}KB q{q}')
