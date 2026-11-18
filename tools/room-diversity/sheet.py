# 방 여러 장을 격자 한 장으로 (2026-11-18, docs/room-diversity-2-2026-11-18.md)
# 사용: python -I tools/room-diversity/sheet.py <폴더> <출력.jpg> [칸 폭=320] [열=6] [키 거르기(쉼표, 앞부분이 맞으면)]
# - 폴더의 <키>.png 를 방 둘레(가로 130~1310px)만 잘라 칸 폭으로 줄이고 왼쪽 위에 이름(같은 이름 .json 의 lab.owner.nickname)과 테마
# - 200KB 넘으면 품질을 낮춤 (문서용)
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

src, out = sys.argv[1], sys.argv[2]
cw = int(sys.argv[3]) if len(sys.argv) > 3 else 320
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
only = sys.argv[5].split(',') if len(sys.argv) > 5 else None
CROP = (130, 0, 1310, 836)
THEME = {'cat_food': '카페', 'cat_sports': '운동장', 'cat_culture': '극장', 'cat_game': '오락실', 'cat_music_dance': '레코드', 'cat_outdoor': '캠핑장',
         'cat_language_selfdev': '공부방', 'cat_book': '서재', 'cat_photo_video': '암실', 'cat_art_craft': '작업실', 'cat_fandom_collect': '수집', 'cat_pet_plant': '온실'}
font = None
for f in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf', '/System/Library/Fonts/AppleSDGothicNeo.ttc'):
    if os.path.exists(f):
        font = ImageFont.truetype(f, 13)
        break


def order(k):
    return (0 if k.startswith('a') else 1 if k.startswith('b-seat') else 2 if k == 'b-me' else 3, k)


keys = sorted([os.path.basename(p)[:-4] for p in glob.glob(os.path.join(src, '*.png'))], key=order)
if only:
    keys = [k for k in keys if any(k.startswith(o) for o in only)]
tiles = []
for k in keys:
    im = Image.open(os.path.join(src, k + '.png')).convert('RGB').crop(CROP)
    im = im.resize((cw, round(cw * im.height / im.width)), Image.LANCZOS)
    label = k
    j = os.path.join(src, k + '.json')
    if os.path.exists(j):
        rec = json.load(open(j, encoding='utf-8'))
        lab = rec.get('lab') or {}
        nick = 'ë‚˜' if k == 'b-me' else (lab.get('owner') or {}).get('nickname', k)
        nick = '나' if k == 'b-me' else nick
        th = ((lab.get('summary') or {}).get('look') or {}).get('style') or {}
        label = f"{nick} · {THEME.get(th.get('theme'), '디자이너')}"
    d = ImageDraw.Draw(im)
    tw = d.textlength(label, font=font) if font else len(label) * 7
    d.rectangle((0, 0, tw + 12, 20), fill=(255, 250, 244))
    d.text((6, 2), label, fill=(62, 42, 31), font=font)
    tiles.append(im)
rows = (len(tiles) + cols - 1) // cols
th = tiles[0].height
sheet = Image.new('RGB', (cols * cw + (cols - 1) * 4, rows * th + (rows - 1) * 4), (255, 255, 255))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * (cw + 4), (i // cols) * (th + 4)))
q = 82
while True:
    sheet.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= 200_000 or q <= 50:
        break
    q -= 4
print(f'{out} {sheet.size} {len(tiles)}장 {os.path.getsize(out) // 1000}KB q{q}')
