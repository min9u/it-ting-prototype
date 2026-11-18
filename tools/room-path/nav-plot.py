import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1], encoding='utf-8'))
new, old = d['modes']['new'], d['modes']['old']
rects = new['rects']
S, PAD, cols = 300, 10, 5
picks = [int(x) - 1 for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else list(range(len(new['runs'])))
try:
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
    big = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 15)
except Exception:
    font = big = None
rows = (len(picks) + cols - 1) // cols
img = Image.new('RGB', (cols * S, rows * (S + 26) + 34), 'white')
top = ImageDraw.Draw(img)
top.line([(12, 17), (40, 17)], fill=(235, 104, 52), width=4); top.text((46, 8), '전: 곧장 가다 가구 변에 닿으면 밀려 미끄러짐', fill=(60, 60, 60), font=big)
top.line([(470, 17), (498, 17)], fill=(42, 120, 214), width=4); top.text((504, 8), '후: 가구 모서리를 살짝 돌아감', fill=(60, 60, 60), font=big)
top.ellipse([790, 11, 802, 23], fill=(50, 50, 50)); top.text((808, 8), '출발', fill=(90, 90, 90), font=font); top.ellipse([850, 11, 862, 23], fill=(20, 150, 60)); top.text((868, 8), '도착   (위에서 본 방, 베이지 = 두더지가 못 들어가는 가구 자리)', fill=(90, 90, 90), font=font)
def T(x, z): return (S / 2 + x * (S / 2 - PAD) / 2.9, S / 2 + z * (S / 2 - PAD) / 2.9)
for k, i in enumerate(picks):
    rn, ro = new['runs'][i], old['runs'][i]
    p = Image.new('RGB', (S, S), 'white'); dr = ImageDraw.Draw(p)
    dr.ellipse([T(-2.75, -2.75), T(2.75, 2.75)], outline=(200, 200, 200), width=2)
    for r in rects:
        dr.rectangle([T(r['x0'], r['z0']), T(r['x1'], r['z1'])], fill=(232, 224, 212), outline=(196, 182, 166))
    for run, col in ((ro, (235, 104, 52)), (rn, (42, 120, 214))):
        if run.get('trace'): dr.line([T(q['x'], q['z']) for q in run['trace']], fill=col, width=4)
    for q, col in ((rn['a'], (50, 50, 50)), (rn['b'], (20, 150, 60))):
        x, y = T(q['x'], q['z']); dr.ellipse([x - 6, y - 6, x + 6, y + 6], fill=col)
    ox, oy = (k % cols) * S, 34 + (k // cols) * (S + 26)
    img.paste(p, (ox, oy))
    ImageDraw.Draw(img).text((ox + 8, oy + S + 3), f"#{i+1}  가구 변에 붙은 시간 {round(ro['onEdge']*100)}% → {round(rn['onEdge']*100)}%", fill=(40, 40, 40), font=font)
img.save(sys.argv[2], quality=88)
