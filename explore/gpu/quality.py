# 화질 비교 (2026-11-16, docs/rendering-experiments-2.md)
# PYTHONIOENCODING=utf-8 python explore/gpu/quality.py <기준 이름> <후보 이름> [<후보 이름> ...]
# results/quality/<이름>.png·.json (cdp-quality.mjs 결과)을 읽어 기준(가속 켠 GPU 고화질) 대비 PSNR·SSIM 을
#  - 장면 전체, 배경(두더지 사각형 + 여유 24px 를 뺀 곳), 두더지(그 사각형 안) 따로 계산
#  - results/quality/<이름>.metrics.json 에 저장, 확대 잘라낸 그림 results/quality/crops/<이름>-{mole,crop,hole}.png (2배, 가까운 이웃)
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results', 'quality')
CROPS = os.path.join(HERE, 'crops')
os.makedirs(CROPS, exist_ok=True)


def load(name):
    im = np.asarray(Image.open(os.path.join(HERE, name + '.png')).convert('RGB')).astype(np.float64)
    meta = json.load(open(os.path.join(HERE, name + '.json'), encoding='utf-8'))
    return im, meta


def psnr(a, b, mask):
    d = ((a - b) ** 2)[mask].mean()
    return 99.0 if d == 0 else 10 * np.log10(255 ** 2 / d)


def ssim_map(a, b):
    # 밝기(Y)로 SSIM (가우시안 창 σ=1.5, Wang et al. 2004 기본 상수)
    ya = a @ [0.299, 0.587, 0.114]
    yb = b @ [0.299, 0.587, 0.114]
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = gaussian_filter(ya, 1.5), gaussian_filter(yb, 1.5)
    saa = gaussian_filter(ya * ya, 1.5) - mu_a ** 2
    sbb = gaussian_filter(yb * yb, 1.5) - mu_b ** 2
    sab = gaussian_filter(ya * yb, 1.5) - mu_a * mu_b
    return ((2 * mu_a * mu_b + C1) * (2 * sab + C2)) / ((mu_a ** 2 + mu_b ** 2 + C1) * (saa + sbb + C2))


ref_name, cands = sys.argv[1], sys.argv[2:]
ref, rmeta = load(ref_name)
# 가장자리(기준 그림의 밝기 기울기 상위 10%): 계단·흐림이 드러나는 곳만 따로 SSIM
_y = ref @ [0.299, 0.587, 0.114]
_g = np.hypot(np.gradient(_y, axis=0), np.gradient(_y, axis=1))
for name in [ref_name] + cands:
    im, meta = load(name)
    sc = rmeta['mole']['scene']
    H, W = im.shape[:2]
    scene = np.zeros((H, W), bool)
    scene[max(sc['y0'], 0):min(sc['y1'], H), max(sc['x0'], 0):min(sc['x1'], W)] = True
    m = rmeta['mole']
    pad = 24
    mole = np.zeros((H, W), bool)
    mole[max(m['y0'] - pad, 0):m['y1'] + pad, max(m['x0'] - pad, 0):m['x1'] + pad] = True
    mole &= scene
    bg = scene & ~mole
    edge = bg & (_g > np.percentile(_g[bg], 90))
    sm = ssim_map(ref, im)
    res = {
        'name': name, 'ref': ref_name,
        'psnr': round(psnr(ref, im, scene), 2), 'ssim': round(float(sm[scene].mean()), 4),
        'psnrBg': round(psnr(ref, im, bg), 2), 'ssimBg': round(float(sm[bg].mean()), 4),
        'psnrMole': round(psnr(ref, im, mole), 2), 'ssimMole': round(float(sm[mole].mean()), 4),
        'ssimEdge': round(float(sm[edge].mean()), 4),
        'shot': f'explore/gpu/results/quality/{name}.png',
        'crops': {},
    }
    # 확대 그림 (같은 자리): 두더지, 호박 밭, 위쪽 구멍 가장자리
    pil = Image.fromarray(im.astype(np.uint8))
    for key, box in {'mole': (m['x0'] - 70, m['y0'] - 40, m['x1'] + 70, m['y1'] + 30), 'crop': (370, 190, 700, 330), 'hole': (680, 64, 860, 170)}.items():
        c = pil.crop(box)
        c = c.resize((c.width * 2, c.height * 2), Image.NEAREST)
        p = os.path.join(CROPS, f'{name}-{key}.png')
        c.save(p)
        res['crops'][key] = f'explore/gpu/results/quality/crops/{name}-{key}.png'
    json.dump(res, open(os.path.join(HERE, name + '.metrics.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{name:22s} PSNR {res['psnr']:6.2f} SSIM {res['ssim']:.4f} | 배경 {res['psnrBg']:6.2f} {res['ssimBg']:.4f} | 두더지 {res['psnrMole']:6.2f} {res['ssimMole']:.4f} | 가장자리 SSIM {res['ssimEdge']:.4f}")
