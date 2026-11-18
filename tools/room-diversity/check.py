# 두 장이 같은 방인지 (2026-11-18, docs/room-diversity-2-2026-11-18.md 1단계)
# 사용: python -I tools/room-diversity/check.py <a.png> <b.png> [나란히.jpg]
# - 픽셀마다 RGB 세 채널 중 하나라도 16 넘게 다르면 "다른 칸". 다른 칸 비율(전체 그림 대비)과, 다른 칸이 모인 상자를 알려 줌
# - 세 번째 인자를 주면 a · b · 다른 칸(빨강) 나란히 그림 (가로 1200px JPEG)
import sys

import numpy as np
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
if a.size != b.size:
    print(f'크기가 달라요 {a.size} vs {b.size} → 작은 쪽으로 자름')
    w, h = min(a.width, b.width), min(a.height, b.height)
    a, b = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
A, B = np.asarray(a).astype(int), np.asarray(b).astype(int)
diff = (np.abs(A - B) > 16).any(-1)
share = diff.mean()
ys, xs = np.nonzero(diff)
box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None
print(f'다른 칸 {share * 100:.2f}% ({int(diff.sum())}px / {diff.size}px) · 상자 {box}')
if len(sys.argv) > 3:
    red = np.asarray(a).copy()
    red[diff] = (220, 40, 40)
    red[~diff] = (red[~diff] * .35 + 255 * .65).astype(np.uint8)
    w, h = a.size
    out = Image.new('RGB', (w * 3, h), 'white')
    out.paste(a, (0, 0)); out.paste(b, (w, 0)); out.paste(Image.fromarray(red), (w * 2, 0))
    out = out.resize((1200, int(1200 * h / (w * 3))), Image.LANCZOS)
    out.save(sys.argv[3], 'JPEG', quality=82, optimize=True)
    print(f'→ {sys.argv[3]}')
