# 그래픽 3차 화질 비교 (2026-11-17, docs/rendering-experiments-3.md)
# PYTHONIOENCODING=utf-8 python -I explore/gpu/round3-quality.py <스크린샷 폴더>
# round3-quality.mjs 가 찍은 <화면>-<변형>.png·.json 을 읽어 화면마다 GPU(<화면>-gpu) 대비 PSNR·SSIM 을
#  - 장면 전체 · 배경(두더지 사각형 + 24px 를 뺀 곳) · 두더지(그 사각형) · 가장자리(배경 중 기준 밝기 기울기 상위 10%)
#  로 계산. 두더지 사각형이 없는 화면(랜딩·찻방)은 장면 전체만 (배경 = 전체)
#  장면 = 두더지 사각형의 장면 상자, 없으면 기준 그림에서 페이지 바탕색과 다른 곳의 경계 상자
# 결과: explore/gpu/results/round3/quality.json, 그림 results/round3/img/<이름>.webp, 확대 results/round3/crops/<이름>-{mole,bg}.webp
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results', 'round3')
SHOTS, CROPS = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'crops')  # shots/ 는 .gitignore (**/shots/*) 에 걸려서 img/
os.makedirs(SHOTS, exist_ok=True); os.makedirs(CROPS, exist_ok=True)
REL = 'explore/gpu/results/round3'


def load(name):
    p = os.path.join(SRC, name + '.png')
    if not os.path.exists(p):
        return None, None
    im = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
    meta = json.load(open(os.path.join(SRC, name + '.json'), encoding='utf-8'))
    return im, meta


def psnr(a, b, mask):
    d = ((a - b) ** 2)[mask].mean()
    return 99.0 if d == 0 else round(float(10 * np.log10(255 ** 2 / d)), 2)


def ssim_map(a, b):
    ya, yb = a @ [0.299, 0.587, 0.114], b @ [0.299, 0.587, 0.114]
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = gaussian_filter(ya, 1.5), gaussian_filter(yb, 1.5)
    saa = gaussian_filter(ya * ya, 1.5) - mu_a ** 2
    sbb = gaussian_filter(yb * yb, 1.5) - mu_b ** 2
    sab = gaussian_filter(ya * yb, 1.5) - mu_a * mu_b
    return ((2 * mu_a * mu_b + C1) * (2 * sab + C2)) / ((mu_a ** 2 + mu_b ** 2 + C1) * (saa + sbb + C2))


SCREENS = ['room', 'visit', 'explore', 'onb', 'landing', 'tea']
VARIANTS = ['gpu', 'gpubase', 'base', 'new', 'weak', 'fin']
out = {}
for sc in SCREENS:
    ref, rmeta = load(f'{sc}-gpu')
    if ref is None:
        continue
    H, W = ref.shape[:2]
    m = (rmeta or {}).get('mole')
    scene = np.zeros((H, W), bool)
    if m and m.get('scene'):
        s = m['scene']
        scene[max(s['y0'], 0):min(s['y1'], H), max(s['x0'], 0):min(s['x1'], W)] = True
    else:
        bgc = ref[H - 2, 2]
        diff = np.abs(ref - bgc).sum(2) > 12
        ys, xs = np.nonzero(diff)
        y0, y1, x0, x1 = max(ys.min() - 10, 0), min(ys.max() + 10, H), max(xs.min() - 10, 0), min(xs.max() + 10, W)
        scene[y0:y1, x0:x1] = True
    mole = np.zeros((H, W), bool)
    if m and m.get('x0') is not None:
        pad = 24
        mole[max(m['y0'] - pad, 0):m['y1'] + pad, max(m['x0'] - pad, 0):m['x1'] + pad] = True
        mole &= scene
    bg = scene & ~mole
    y = ref @ [0.299, 0.587, 0.114]
    g = np.hypot(np.gradient(y, axis=0), np.gradient(y, axis=1))
    edge = bg & (g > np.percentile(g[bg], 90))
    # 배경 확대 자리: 기준 그림에서 가장자리가 가장 많은 320×180 칸 (두더지 칸 제외)
    best, bbox = -1, None
    for yy in range(0, H - 180, 60):
        for xx in range(0, W - 320, 80):
            if not bg[yy:yy + 180, xx:xx + 320].all():
                continue
            v = (g[yy:yy + 180, xx:xx + 320] > np.percentile(g[bg], 90)).sum()
            if v > best:
                best, bbox = v, (xx, yy, xx + 320, yy + 180)
    out[sc] = {}
    for v in VARIANTS:
        im, meta = load(f'{sc}-{v}')
        if im is None:
            continue
        name = f'{sc}-{v}'
        sm = ssim_map(ref, im)
        r = {
            'psnr': psnr(ref, im, scene), 'ssim': round(float(sm[scene].mean()), 4),
            'bg': {'psnr': psnr(ref, im, bg), 'ssim': round(float(sm[bg].mean()), 4), 'edgeSsim': round(float(sm[edge].mean()), 4)},
            'mole': {'psnr': psnr(ref, im, mole), 'ssim': round(float(sm[mole].mean()), 4)} if mole.any() else None,
            'renderer': (meta or {}).get('renderer'),
            'shot': f'{REL}/img/{name}.webp', 'crops': {},
        }
        pil = Image.fromarray(im.astype(np.uint8))
        pil.save(os.path.join(SHOTS, name + '.webp'), 'WEBP', quality=82, method=5)
        boxes = {}
        if mole.any():
            boxes['mole'] = (m['x0'] - 50, m['y0'] - 30, m['x1'] + 50, m['y1'] + 20)
        if bbox:
            boxes['bg'] = bbox
        for k, b in boxes.items():
            c = pil.crop(b)
            c = c.resize((c.width * 2, c.height * 2), Image.NEAREST)
            c.save(os.path.join(CROPS, f'{name}-{k}.webp'), 'WEBP', quality=90, method=5)
            r['crops'][k] = f'{REL}/crops/{name}-{k}.webp'
        out[sc][v] = r
        mm = r['mole']
        print(f"{name:14s} 전체 {r['psnr']:6.2f}dB {r['ssim']:.4f} | 배경 {r['bg']['psnr']:6.2f} {r['bg']['ssim']:.4f} 가장자리 {r['bg']['edgeSsim']:.4f} | 두더지 " + (f"{mm['psnr']:6.2f} {mm['ssim']:.4f}" if mm else '-'))
json.dump(out, open(os.path.join(ROOT, 'quality.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
