# 땅굴 다양성 비교: 찍은 방 그림으로 "얼마나 다른지" 숫자와 그림 만들기 (2026-11-18, docs/room-diversity-2026-11-18.md)
# 사용 (저장소 루트에서, capture.mjs 다음에):  python -I tools/room-diversity/analyze.py
# 입력 (capture.mjs): out/raw/ = 방문자 뷰 그대로(두더지 있음) · out/raw-nomole/ = 두더지만 숨김 · out/raw-wall01/ = 두더지 숨김 + 벽지 01 고정
#        각 폴더의 z-empty = 관심사 0개 빈 방 (26개 방 숫자에는 안 들어감)
# 출력: out/data.json (페이지에 넣을 숫자 · 사람 · 방에 놓인 것), out/img/ (카드 · 크게 보기 · 두더지 뺀 그림 · 차이 지도 2장 · 평균 방 · 빈 방 · 방마다 다른 곳)
#
# 계산 (페이지에 한 줄로 적는 것)
# - 두더지를 숨기고 찍은 그림에서 방 둘레만 잘라(장면 가로 130~1310px) 반으로 줄여(590×418) 비교. 방 바깥 흙색 배경은 뺌
# - "평균 방" = 26개 방 그림의 칸마다 가운데 값(중앙값). 방마다 평균 방과 색 차이(CIE ΔE76)가 10 넘는 칸을 "다름"으로 셈
#   (ΔE 2~3 = 겨우 알아챔, 10 = 나란히 두면 바로 보이는 차이)
# - 방마다 숫자 = 다른 칸 / 방 칸.  차이 지도 1 = 칸마다 "평균 방과 다른 방의 비율"
# - 둘씩 비교 = 두 방 그림끼리 ΔE 10 넘는 칸의 비율
# - 벽지를 모두 같게 찍은 그림(raw-wall01)에서 빈 방과 다른 칸 = 관심사 가구·소품이 차지한 넓이. 차이 지도 2 = 칸마다 "관심사 물건이 놓인 방의 비율"
import base64
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
IMG = os.path.join(OUT, 'img')
CROP = (130, 0, 1310, 836)  # 장면 px: 방(돔 + 바닥) 둘레
T = 10.0                    # ΔE76 "다름" 기준
CELL = 5                    # 차이 지도 마우스 올림용 칸 (반 해상도 px)
EMPTY = 'z-empty'

# 방에 늘 있는 것 (furnitureCatalog.json type base·deco): 정말 안 바뀌는지 재는 상자 (잘라 낸 그림 px, 전체 해상도). 빈 방 그림에서 물건만 들어가게 고름
REGIONS = {
    'bed': ('침대', (60, 585, 230, 715)),
    'nightstand': ('협탁 + 버섯 스탠드', (320, 560, 395, 655)),
    'table': ('원탁 + 찻주전자', (462, 552, 548, 598)),
    'cushions': ('방석 둘', (430, 606, 610, 662)),
    'rug': ('둥근 러그', (400, 665, 800, 730)),
    'lamp': ('천장 버섯 램프', (545, 210, 635, 268)),
    'lights': ('전구 줄', (335, 185, 520, 252)),
    'bunting': ('가랜드', (440, 300, 760, 352)),
    'floor_front': ('바닥 앞쪽 가운데', (430, 745, 760, 830)),
    'wall_top': ('벽 위쪽 (벽지만 보이는 곳)', (440, 60, 560, 150)),
    'shelf_row': ('벽 선반 줄 (선반 소품 12칸)', (270, 380, 970, 440)),
}

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def to_lab(rgb):
    c = rgb.astype(np.float32) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]], np.float32)
    xyz = (c @ m.T) / np.array([0.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de(a, b):
    return np.sqrt(((a - b) ** 2).sum(-1))


def order_key(k):
    return (0 if k.startswith('a') else 1 if k != 'b-me' else 2, k)


def load(dirname):
    raw = os.path.join(OUT, dirname)
    keys = sorted([os.path.basename(f)[:-5] for f in glob.glob(os.path.join(raw, '*.json'))
                   if not os.path.basename(f).startswith(('_', 'z-'))], key=order_key)
    recs = [json.load(open(os.path.join(raw, k + '.json'), encoding='utf-8')) for k in keys]
    full = [Image.open(os.path.join(raw, k + '.png')).convert('RGB').crop(CROP) for k in keys]
    empty = Image.open(os.path.join(raw, EMPTY + '.png')).convert('RGB').crop(CROP)
    return keys, recs, full, empty


keys, recs, seen_full, seen_empty = load('raw')            # 보이는 그대로 (카드 · 크게 보기)
keysA, _, nm_full, nm_empty = load('raw-nomole')          # 두더지 뺌, 벽지는 관심사대로 → 숫자 · 차이 지도 1
keysB, _, w1_full, w1_empty = load('raw-wall01')           # 두더지 뺌, 벽지 01 → 빈 방과 비교 · 차이 지도 2
assert keys == keysA == keysB, '세 번 찍은 목록이 달라요'
cap = json.load(open(os.path.join(OUT, 'raw', '_capture.json'), encoding='utf-8'))
half = np.stack([np.asarray(im.reduce(2)) for im in nm_full])
half2 = np.stack([np.asarray(im.reduce(2)) for im in w1_full])
N, HH, HW = half.shape[:3]
print(f'방 {N}개, 비교 크기 {HW}×{HH}')

# 방 칸: 흙색 배경(왼쪽 위 칸 색)과 다른 곳을 줄마다 왼쪽 끝~오른쪽 끝으로 채움
bg = half[0, 2, 2].astype(int)
room = (np.abs(np.concatenate([half, half2]).astype(int) - bg).max(-1) > 6).any(0)
for y in range(HH):
    xs = np.nonzero(room[y])[0]
    if len(xs):
        room[y, xs.min():xs.max() + 1] = True
area = room
# 참고: 처음 들어갔을 때 두더지 두 마리가 가리는 넓이 (찍을 때 받은 두더지 사각형, 방 넓이 대비)
mole = np.zeros((HH, HW), bool)
for r in recs:
    m, s = r.get('mole'), r['scene']
    if m:
        mole[max(0, int((m['y0'] - s['y']) / 2)):max(0, int((m['y1'] - s['y']) / 2)), max(0, int((m['x0'] - s['x'] - CROP[0]) / 2)):max(0, int((m['x1'] - s['x'] - CROP[0]) / 2))] = True
mole_share = float((room & mole).sum() / room.sum())
print(f'방 칸 {room.mean():.3f} · 두더지 사각형 {mole_share:.3f} (방 넓이 대비, 참고)')


def stats(stack, label):
    lab = np.stack([to_lab(h) for h in stack])
    med = np.median(stack, axis=0).astype(np.uint8)
    dist = np.stack([de(lab[i], to_lab(med)) for i in range(N)])
    diff = dist > T
    score = np.array([diff[i][area].mean() for i in range(N)])
    pair = np.zeros((N, N))
    for i in range(N):
        for j in range(i + 1, N):
            pair[i, j] = pair[j, i] = (de(lab[i], lab[j]) > T)[area].mean()
    iu = np.triu_indices(N, 1)
    pv = pair[iu]
    lo, hi = int(np.argmin(pv)), int(np.argmax(pv))
    heat = diff.mean(0)
    hA = heat[area]
    sens = {str(t): round(float(np.median([(dist[i] > t)[area].mean() for i in range(N)])) * 100, 1) for t in (5, 10, 15, 20)}
    s = {
        'never': float((hA == 0).mean()), 'any': float((hA > 0).mean()), 'half': float((hA > .5).mean()),
        'scoreMedian': float(np.median(score)), 'scoreMean': float(score.mean()), 'scoreMin': float(score.min()), 'scoreMax': float(score.max()),
        'pairMedian': float(np.median(pv)), 'pairMin': float(pv.min()), 'pairMax': float(pv.max()),
        'pairLo': [keys[iu[0][lo]], keys[iu[1][lo]]], 'pairHi': [keys[iu[0][hi]], keys[iu[1][hi]]],
        'pairUnder5': float((pv < .05).mean()), 'pairUnder10': float((pv < .10).mean()),
        'sensitivity': sens,
    }
    print(label, json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in s.items()}, ensure_ascii=False))
    return {'lab': lab, 'diff': diff, 'score': score, 'pair': pair, 'heat': heat, 'summary': s}


A = stats(half, '보이는 그대로 (두더지 뺌)')
B = stats(half2, '벽지 같게 (두더지 뺌)')
# 빈 방(관심사 0개, 벽지 01)과 다른 칸 = 관심사 가구·소품이 차지한 넓이
empty_lab = to_lab(np.asarray(w1_empty.reduce(2)))
E_diff = np.stack([de(B['lab'][i], empty_lab) > T for i in range(N)])
vs_empty = np.array([E_diff[i][area].mean() for i in range(N)])
E = {'diff': E_diff, 'heat': E_diff.mean(0)}
eA = E['heat'][area]
E['summary'] = {'never': float((eA == 0).mean()), 'any': float((eA > 0).mean()), 'half': float((eA > .5).mean()),
                'median': float(np.median(vs_empty)), 'min': float(vs_empty.min()), 'max': float(vs_empty.max())}
print(f'빈 방과 다른 넓이: 가운데 값 {np.median(vs_empty) * 100:.1f}% · {vs_empty.min() * 100:.1f}~{vs_empty.max() * 100:.1f}% · '
      f'관심사 물건이 한 번이라도 놓인 넓이 {E["summary"]["any"] * 100:.1f}% · 절반 넘는 방 {E["summary"]["half"] * 100:.1f}%')

regions = {}
for rid, (name, (x0, y0, x1, y1)) in REGIONS.items():
    sl = (slice(y0 // 2, y1 // 2), slice(x0 // 2, x1 // 2))
    a = area[sl]
    # 상자 안 2% 넘게 바뀐 방 (보이는 그대로는 평균 방과, 가구만은 빈 방과)
    seen = [keys[i] for i in range(N) if A['diff'][i][sl][a].mean() > .02]
    furn = [keys[i] for i in range(N) if E['diff'][i][sl][a].mean() > .02]
    regions[rid] = {'name': name, 'box': [x0, y0, x1, y1], 'seen': seen, 'furn': furn}
    print(f"  {name}: 바뀐 방 {len(seen)}/{N} (벽지 같게·빈 방과 {len(furn)}/{N}) {furn[:6]}")

# ---------- 그림 ----------
for d in ('rooms', 'full', 'nomole', 'mask'):
    os.makedirs(os.path.join(IMG, d), exist_ok=True)


def save_jpg(im, path, q, limit):
    while True:
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= limit or q <= 60:
            return os.path.getsize(path)
        q -= 4


sizes = {}
med_nm = Image.fromarray(np.median(np.stack([np.asarray(im) for im in nm_full]), axis=0).astype(np.uint8))
for k, im, nm in list(zip(keys, seen_full, nm_full)) + [('median', med_nm, med_nm), ('empty', seen_empty, nm_empty)]:
    sizes[k] = (save_jpg(im.resize((640, 453), Image.LANCZOS), os.path.join(IMG, 'rooms', k + '.jpg'), 80, 120_000),
                save_jpg(im, os.path.join(IMG, 'full', k + '.jpg'), 80, 240_000))
    sizes[k + '/nomole'] = (0, save_jpg(nm, os.path.join(IMG, 'nomole', k + '.jpg'), 80, 240_000))

# 방마다 "평균 방과 다른 곳" (파란 반투명, 반 해상도 PNG → 페이지에서 두더지 뺀 그림 위에 겹침)
for i, k in enumerate(keys):
    a = np.zeros((HH, HW, 4), np.uint8)
    a[A['diff'][i] & area] = (28, 92, 171, 170)
    Image.fromarray(a, 'RGBA').save(os.path.join(IMG, 'mask', k + '.png'), optimize=True)
    sizes[k + '/mask'] = (0, os.path.getsize(os.path.join(IMG, 'mask', k + '.png')))

# 차이 지도: 기준 방을 흐린 회색으로 깔고, 칸마다 비율을 파란 한 색 단계로 (연함 = 몇 방만, 진함 = 거의 모든 방)
RAMP = np.array([[205, 226, 251], [134, 182, 239], [57, 135, 229], [28, 92, 171], [13, 54, 107]], np.float32)  # 100 · 250 · 400 · 550 · 700


def ramp(h):
    x = np.clip(h, 0, 1) * (len(RAMP) - 1)
    i = np.minimum(x.astype(int), len(RAMP) - 2)
    t = (x - i)[..., None]
    return RAMP[i] * (1 - t) + RAMP[i + 1] * t


def diffmap(S, base_img, name):
    gray = np.asarray(base_img.convert('L'), np.float32)
    canvas = np.repeat((255 - (255 - gray) * .32)[..., None], 3, -1)
    size = base_img.size
    hf = np.asarray(Image.fromarray((S['heat'] * 255).astype(np.uint8)).resize(size, Image.BILINEAR), np.float32) / 255
    rf = np.asarray(Image.fromarray(room.astype(np.uint8) * 255).resize(size, Image.NEAREST)) > 127
    alpha = np.where(hf > 0.015, np.clip(.35 + hf * .65, 0, 1), 0)[..., None]
    canvas = canvas * (1 - alpha) + ramp(hf) * alpha
    canvas[~rf] = 255
    sizes[name] = (0, save_jpg(Image.fromarray(canvas.clip(0, 255).astype(np.uint8)), os.path.join(IMG, name + '.jpg'), 86, 290_000))


def grid_of(S):
    # 마우스 올림용 칸 (CELL×CELL 반 해상도 px): 0~N = 그 칸의 절반 넘게 다른 방 수, 255 = 방 밖
    gh, gw = HH // CELL, HW // CELL
    g = np.full((gh, gw), 255, np.uint8)
    for gy in range(gh):
        for gx in range(gw):
            ys, xs = slice(gy * CELL, gy * CELL + CELL), slice(gx * CELL, gx * CELL + CELL)
            a = area[ys, xs]
            if a.mean() >= .5:
                g[gy, gx] = int((S['diff'][:, ys, xs][:, a].mean(1) > .5).sum())
    return {'w': gw, 'h': gh, 'b64': base64.b64encode(g.tobytes()).decode()}


diffmap(A, med_nm, 'diffmap')
diffmap(E, w1_empty, 'diffmap-furn')

# ---------- 사람 · 방에 놓인 것 ----------
rooms = []
for i, (k, r) in enumerate(zip(keys, recs)):
    o, s = r['lab']['owner'], r['lab']['summary']
    items = s['items']
    cats = {c['id']: c for c in s['categories']}
    furn = [it for it in items if it['type'] == 'category_furniture']
    shelf = [it for it in items if it['type'] == 'sub_prop' and it['kind'] == 'shelf']
    floor = [it for it in items if it['type'] == 'sub_prop' and it['kind'] == 'floor']
    petg = [it for it in items if it['type'] == 'sub_prop' and it['kind'] == 'pet_floor']
    pets = [it for it in items if it['type'] == 'pet']
    # 대분류마다: 가구 세트를 빌려 쓰는지, 다른 대분류가 먼저 놓아서 이 대분류 몫 가구가 없는지
    sets = []
    for c in s['categories']:
        mine = [it['name'] for it in furn if it['cat'] == c['id']]
        sets.append({'cat': c['id'], 'name': c['name'], 'kit': c['kit'], 'furniture': mine, 'borrowed': bool(c['substitute']),
                     'sharedWith': None if mine else next((cats[it['cat']]['name'] for it in furn if it['id'] in c['furniture']), None)})
    pa = A['pair'][i]
    near = min((j for j in range(N) if j != i), key=lambda j: pa[j])
    far = max(range(N), key=lambda j: pa[j])
    rooms.append({
        'key': k, 'group': r['group'], 'kind': r['kind'], 'seat': r.get('seat'),
        'name': ('나' if k == 'b-me' else o['nickname']),
        'interests': [{'name': p['name'], 'cat': p['cat'], 'prop': p['prop']} for p in s['picks']],
        'wallpaper': s['wallpaper'], 'mood': s['mood'], 'topCategory': s['topCategory'],
        'sets': sets,
        'shelf': [it['name'] for it in shelf], 'floor': [it['name'] for it in floor],
        'petGoods': [it['name'] for it in petg], 'pets': [it['name'] for it in pets],
        'noProp': [p['name'] for p in s['picks'] if not p['prop']],
        'worn': o.get('worn', []),
        'score': round(float(A['score'][i]), 4), 'scoreFurn': round(float(B['score'][i]), 4), 'vsEmpty': round(float(vs_empty[i]), 4),
        'near': {'key': keys[near], 'v': round(float(pa[near]), 4)},
        'far': {'key': keys[far], 'v': round(float(pa[far]), 4)},
    })

wp_count = {}
for rr in rooms:
    n = f"{rr['wallpaper']['no']:02d} {rr['wallpaper']['name']}"
    wp_count[n] = wp_count.get(n, 0) + 1
data = {
    'meta': {'renderer': cap.get('renderer'), 'viewport': cap.get('viewport'), 'date': cap.get('date'), 'crop': CROP, 'half': [HW, HH], 'cell': CELL,
             'threshold': T, 'moleShare': mole_share, 'n': N},
    'seen': A['summary'], 'furn': B['summary'], 'vsEmpty': E['summary'],
    'wallpapers': dict(sorted(wp_count.items())), 'regions': regions, 'rooms': rooms,
    'pair': [[round(float(v), 4) for v in row] for row in A['pair']],
    'grid': grid_of(A), 'gridFurn': grid_of(E),
}
with open(os.path.join(OUT, 'data.json'), 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
tot = sum(a + b for a, b in sizes.values())
print(f'그림 합계 {tot / 1e6:.2f}MB · 크게 보기 가장 큰 것 {max(b for a, b in sizes.values()) / 1e3:.0f}KB · 카드 가장 큰 것 {max(a for a, b in sizes.values()) / 1e3:.0f}KB')
print('벽지', wp_count)
for rr in sorted(rooms, key=lambda x: x['score']):
    print(f"  {rr['score'] * 100:5.1f}% (벽지 같게 {rr['scoreFurn'] * 100:4.1f}% · 빈 방과 {rr['vsEmpty'] * 100:4.1f}%)  {rr['key']:<12} {rr['name']:<6} 벽지 {rr['wallpaper']['no']:02d} · "
          f"세트 {sum(1 for x in rr['sets'] if x['furniture'])} · 선반 {len(rr['shelf'])} · 가까운 {rr['near']['key']} {rr['near']['v'] * 100:.1f}%")
