# 이동 도중 화질 비교 (2026-11-17, docs/explore-move-quality.md)
# PYTHONIOENCODING=utf-8 python -I explore/gpu/move/move-quality.py <스크린샷 폴더>
# move-quality.mjs 가 찍은 <장면>-<변형>.png 를 장면마다 GPU(<장면>-gpu) 대비 PSNR·SSIM 으로:
#  - 배경 = 장면 사각형에서 두더지 사각형(+24px)을 뺀 곳 (이동 중엔 두더지가 땅속이라 장면 전체)
#  - 가장자리 = 배경 중 기준 그림 밝기 기울기 상위 10% (흐림·계단이 드러나는 곳)
#  - 맞춘 SSIM = 32px 칸마다 ±5px 안에서 가장 잘 맞는 위치의 SSIM 평균. 이동 도중 그림은 바닥 평면 가정 때문에 높은 물체가
#    몇 px 어긋나는데(시차), PSNR·SSIM 은 그 어긋남을 흐림보다 크게 벌줌 → 어긋남을 빼고 "모양·선명함"만 보는 값
#  - 선명도 = 배경 밝기 기울기 평균 / 기준(GPU)의 값 (1 = GPU 와 같은 선명함, 흐리면 작아짐)
# 결과: explore/gpu/results/move.json 의 quality, 그림 results/move/<장면>-<변형>.webp (같은 순간 기준/개선/GPU), 확대 results/move/crop-*.webp
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'results')
IMG = os.path.join(ROOT, 'move')
os.makedirs(IMG, exist_ok=True)
REL = 'explore/gpu/results/move'


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


def aligned_ssim(a, b, mask, r=5, blk=32):
    ya, yb = (a @ [0.299, 0.587, 0.114]).astype(np.float32), (b @ [0.299, 0.587, 0.114]).astype(np.float32)
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    g = lambda x: gaussian_filter(x, 1.5)
    mu_a, mu_b = g(ya), g(yb)
    saa, sbb = g(ya * ya) - mu_a ** 2, g(yb * yb) - mu_b ** 2
    H, W = ya.shape
    # 가장자리 mg px 는 뺌 (np.roll 이 반대쪽을 끌어와서 가우스 창(반지름 6) 안이 틀어짐)
    mg = r + 8
    hb, wb = (H - 2 * mg) // blk, (W - 2 * mg) // blk
    best = np.full((hb, wb), -1.0)
    A = (slice(mg, mg + hb * blk), slice(mg, mg + wb * blk))
    sl = lambda x, dy, dx: x[mg + dy:mg + dy + hb * blk, mg + dx:mg + dx + wb * blk]
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            ybs = np.roll(np.roll(yb, -dy, 0), -dx, 1)
            sab = g(ya * ybs)[A] - mu_a[A] * sl(mu_b, dy, dx)
            mb, sb = sl(mu_b, dy, dx), sl(sbb, dy, dx)
            m = ((2 * mu_a[A] * mb + C1) * (2 * sab + C2)) / ((mu_a[A] ** 2 + mb ** 2 + C1) * (saa[A] + sb + C2))
            best = np.maximum(best, m.reshape(hb, blk, wb, blk).mean((1, 3)))
    mk = mask[A].reshape(hb, blk, wb, blk).all((1, 3))
    return round(float(best[mk].mean()), 4)


def sharp(im, mask):
    y = im @ [0.299, 0.587, 0.114]
    return float(np.hypot(np.gradient(y, axis=0), np.gradient(y, axis=1))[mask].mean())


CASES = ['r25', 'r5', 'r75', 'rstop', 'u25', 'u5', 'u75', 'ustop']
VARIANTS = ['old', 'new', 'css', 'weak']
out = {}
for c in CASES:
    ref, rmeta = load(f'{c}-gpu')
    if ref is None:
        continue
    H, W = ref.shape[:2]
    m = (rmeta or {}).get('mole') or {}
    scene = np.zeros((H, W), bool)
    s = m.get('scene') or {'x0': 0, 'y0': 0, 'x1': W, 'y1': H}
    scene[max(s['y0'], 0):min(s['y1'], H), max(s['x0'], 0):min(s['x1'], W)] = True
    mole = np.zeros((H, W), bool)
    if c.endswith('stop') and m.get('x0') is not None:
        pad = 24
        mole[max(m['y0'] - pad, 0):m['y1'] + pad, max(m['x0'] - pad, 0):m['x1'] + pad] = True
    bg = scene & ~mole
    y = ref @ [0.299, 0.587, 0.114]
    g = np.hypot(np.gradient(y, axis=0), np.gradient(y, axis=1))
    thr = np.percentile(g[bg], 90)
    edge = bg & (g > thr)
    # 확대 자리: 기준 그림에서 가장자리가 가장 많은 400×225 칸 (두더지 칸 제외)
    best, bbox = -1, None
    for yy in range(max(s['y0'], 0), min(s['y1'], H) - 225, 45):
        for xx in range(0, W - 400, 80):
            if not bg[yy:yy + 225, xx:xx + 400].all():
                continue
            v = (g[yy:yy + 225, xx:xx + 400] > thr).sum()
            if v > best:
                best, bbox = v, (xx, yy, xx + 400, yy + 225)
    out[c] = {}
    Image.fromarray(ref.astype(np.uint8)).save(os.path.join(IMG, f'{c}-gpu.webp'), 'WEBP', quality=80, method=5)
    crops = [Image.fromarray(ref.astype(np.uint8)).crop(bbox)] if bbox else []
    for v in VARIANTS:
        im, meta = load(f'{c}-{v}')
        if im is None:
            continue
        sm = ssim_map(ref, im)
        r = {
            'psnr': psnr(ref, im, bg), 'ssim': round(float(sm[bg].mean()), 4), 'edgeSsim': round(float(sm[edge].mean()), 4),
            'alignedSsim': aligned_ssim(ref, im, bg), 'sharpness': round(sharp(im, bg) / sharp(ref, bg), 3),
            'slideFrames': (meta.get('slide') or {}).get('n'), 'shot': f'{REL}/{c}-{v}.webp',
        }
        out[c][v] = r
        pil = Image.fromarray(im.astype(np.uint8))
        pil.save(os.path.join(IMG, f'{c}-{v}.webp'), 'WEBP', quality=80, method=5)
        if bbox:
            crops.append(pil.crop(bbox))
        print(f"{c:6s} {v:5s} 배경 PSNR {r['psnr']:6.2f}dB SSIM {r['ssim']:.4f} 가장자리 {r['edgeSsim']:.4f} 맞춘 SSIM {r['alignedSsim']:.4f} 선명도 {r['sharpness']:.3f}  띠 프레임 {r['slideFrames']}")
    # 확대 비교: GPU | 기준(old) | 개선(new) 가로로 (2배)
    if bbox and len(crops) >= 3:
        cw, ch = 400, 225
        sheet = Image.new('RGB', (cw * 3 * 2, ch * 2), 'white')
        for i, cr in enumerate(crops[:3]):
            sheet.paste(cr.resize((cw * 2, ch * 2), Image.NEAREST).crop((0, 0, cw * 2, ch * 2)), (i * cw * 2, 0))
        sheet = sheet.resize((cw * 3, ch), Image.LANCZOS) if False else sheet
        sheet.save(os.path.join(IMG, f'crop-{c}.webp'), 'WEBP', quality=88, method=5)
        out[c]['crop'] = {'file': f'{REL}/crop-{c}.webp', 'box': bbox, 'order': 'GPU | 기준(이동 중 0.33배) | 개선(M)'}
p = os.path.join(ROOT, 'move.json')
data = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
data['quality'] = out
json.dump(data, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
