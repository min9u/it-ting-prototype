"""가이드 사진 만들기: docs/guide-images/*.jpg

사진은 모두 실제 앱 빌드를 헤드리스 크롬으로 찍은 것과 측정 문서의 그림에서 잘라 붙였다. 지어낸 화면 없음.
재료 세 가지
  1. 스모크 스크린샷: app/shots/smoke/{on,none}/*.png  (cd app && npm run build && npm run smoke [-- --gpu=none])
  2. 앱 상태 스크린샷: tools/guide-page/app-shots.json 을 shoot.mjs 로 찍은 것
       node tools/guide-page/shoot.mjs tools/guide-page/app-shots.json   (app/dist 를 띄워 찍음 → tools/guide-page/out/shots/)
  3. 그래픽 측정 그림: explore/gpu/results/round3/crops/*.webp (docs/rendering-experiments-3.md)
실행: python -I tools/guide-page/make-images.py [--smoke=<app/shots/smoke 경로>] [--shots=<out/shots 경로>]
글자: 윈도우 맑은 고딕(malgunbd.ttf). 다른 OS 면 FONT 를 바꿀 것
규칙: 폭 1200px 이하, 한 장 200KB 이하 (넘으면 품질을 낮춰 다시 저장)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'guide-images')
args = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
SMOKE = args.get('smoke', os.path.join(ROOT, 'app', 'shots', 'smoke'))
SHOTS = args.get('shots', os.path.join(HERE, 'out', 'shots'))
CROPS = os.path.join(ROOT, 'explore', 'gpu', 'results', 'round3', 'crops')
FONT = 'C:/Windows/Fonts/malgunbd.ttf'
BG = (244, 230, 216)        # --rail (그림 사이 틈)
PILL = (64, 43, 32)         # --toast-bg
PILL_TEXT = (251, 244, 236)  # --bg-cream
MAX_BYTES = 200 * 1024


def font(size):
    return ImageFont.truetype(FONT, size)


def label(im, text, size=17, at=(10, 10)):
    """사진 왼쪽 위에 진한 알약 이름표"""
    d = ImageDraw.Draw(im)
    f = font(size)
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=f)
    pad_x, pad_y = 10, 6
    w, h = x1 - x0 + pad_x * 2, y1 - y0 + pad_y * 2
    d.rounded_rectangle((at[0], at[1], at[0] + w, at[1] + h), radius=h // 2, fill=PILL)
    d.text((at[0] + pad_x - x0, at[1] + pad_y - y0), text, font=f, fill=PILL_TEXT)
    return im


def titled(im, text, size=16):
    """사진 위에 이름표 띠를 따로 붙임 (사진 내용을 가리지 않게)"""
    c = Image.new('RGB', (im.width, im.height + 40), BG)
    c.paste(im, (0, 40))
    return label(c, text, size=size, at=(6, 5))


def fit(im, w):
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)


def grid(tiles, cols, gap=8):
    w = tiles[0].width
    rows = (len(tiles) + cols - 1) // cols
    hs = [max(t.height for t in tiles[r * cols:(r + 1) * cols]) for r in range(rows)]
    c = Image.new('RGB', (cols * w + (cols - 1) * gap, sum(hs) + (rows - 1) * gap), BG)
    y = 0
    for r in range(rows):
        for k, t in enumerate(tiles[r * cols:(r + 1) * cols]):
            c.paste(t, (k * (w + gap), y))
        y += hs[r] + gap
    return c


def save(im, name):
    assert im.width <= 1200, (name, im.size)
    path = os.path.join(OUT, name)
    for q in (84, 80, 76, 72, 68, 64, 60):
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= MAX_BYTES:
            break
    print(f'{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(path) // 1024}KB (q{q})')


def load(*parts):
    return Image.open(os.path.join(*parts)).convert('RGB')


os.makedirs(OUT, exist_ok=True)

# 1. 앱 한 바퀴: 스모크(가속 켬) 화면 네 장
tour = [('12-burrow.png', '내 땅굴'), ('16-burrow_explore.png', '탐색 (들판)'), ('58-chat_r-yerin.png', '채팅 (1:1)'), ('92-meetups_m1.png', '모임 상세')]
save(grid([titled(fit(load(SMOKE, 'on', f), 592), t) for f, t in tour], 2), 'app-tour.jpg')

# 2. 한 화면의 상태 네 개: 커뮤니티 글 목록 (?api=slow · fail · empty · off), 목록 칸만 잘라 냄
states = [('board-slow.png', '① 불러오는 중 (스켈레톤)'), ('board-fail.png', '② 오류 → 다시 시도'), ('board-empty.png', '③ 비어 있음'), ('board-normal.png', '④ 정상')]
save(grid([titled(fit(load(SHOTS, f).crop((80, 62, 1040, 740)), 592), t) for f, t in states], 2), 'states-four.jpg')

# 3. 찜 한 번: 누르기 전 → 누른 직후(화면 먼저) → 서버 실패(되돌림 + 토스트), /meetups/m6?api=writefail
steps = [('m6-0-before.png', '① 누르기 전'), ('m6-1-optimistic.png', '② 누른 직후: 하트가 먼저 바뀜'), ('m6-2-reverted.png', '③ 서버 실패: 되돌리고 토스트')]
save(grid([label(load(SHOTS, f).crop((530, 60, 1330, 240)), t, size=16, at=(10, 138)) for f, t in steps], 1), 'optimistic-steps.jpg')

# 4. 채팅 끊김 띠: /chat/r-yerin?rt=down
save(label(load(SHOTS, 'chat-down.png').crop((830, 150, 1420, 560)), '?rt=down (서버 없음)', size=15, at=(10, 370)), 'chat-reconnect.jpg')

# 5. 패널을 열고 닫으면 방 위치가 바뀜 (개념 2장 focusX)
pf = [('12-burrow.png', '/burrow (패널 열림, focusX 0.403)'), ('13-burrow_panel_closed.png', '/burrow?panel=closed (0.5)')]
save(grid([titled(fit(load(SMOKE, 'on', f), 592), t, size=15) for f, t in pf], 2), 'panel-focus.jpg')

# 6. 관심사가 다르면 가구가 다름: 내 땅굴 ↔ 예린의 땅굴 (개념 8-7)
mv = [('12-burrow.png', '내 땅굴'), ('23-burrow_yerin.png', '예린의 땅굴 (/burrow/yerin)')]
save(grid([titled(fit(load(SMOKE, 'on', f), 592), t, size=15) for f, t in mv], 2), 'my-vs-yerin.jpg')

# 7. WebGL 이 없을 때: 3D 대신 정지 그림 (사건 8)
nw = [(('on', '12-burrow.png'), '가속 켬: 3D 땅굴'), (('none', '12-burrow.png'), 'WebGL 없음: 정지 그림 + 안내 띠')]
save(grid([titled(fit(load(SMOKE, *p), 592), t, size=15) for p, t in nw], 2), 'nowebgl-still.jpg')

# 8. 사건 5: 굽는 색 공간에 따라 가구 밑 그림자가 사라짐/돌아옴 (내 땅굴 배경 확대)
bs = [('room-gpu-bg.webp', 'GPU 그림 (기준)'), ('room-new-bg.webp', '선형에서 구움: 그림자 사라짐'), ('room-fin-bg.webp', 'sRGB로 구움: 그림자 돌아옴')]
save(grid([titled(fit(load(CROPS, f).crop((40, 90, 440, 360)), 392), t, size=14) for f, t in bs], 3), 'bake-shadow.jpg')

# 9. 화질 비교: 가속 끔 2차 빌드 ↔ 최종 ↔ GPU, 내 땅굴 배경 (개념 9-7). 두더지 확대는 찍을 때마다 자리가 달라 빼고 배경만
sb = [('room-gpu-bg.webp', 'GPU (기준)'), ('room-base-bg.webp', '가속 끔 · 2차 빌드'), ('room-fin-bg.webp', '가속 끔 · 최종')]
save(grid([titled(fit(load(CROPS, f), 392), t, size=14) for f, t in sb], 3), 'quality-compare.jpg')

# 10. 스모크가 찍은 화면 일부 (96개 중 24개)
pick = ['01-start', '07-onboarding_name_demo', '08-onboarding_interests_demo', '11-onboarding_preview_demo', '12-burrow', '15-burrow_modal_guestbook',
        '16-burrow_explore', '19-burrow_explore_design_b', '23-burrow_yerin', '26-burrow_mode_decor', '29-board', '30-board_p1',
        '31-board_write', '38-meetups', '44-meetups_m1_as_open', '48-meetups_m3_as_host', '54-meetups_new', '57-chat',
        '59-chat_g-m1', '64-chat_requests', '67-notifications', '73-settings_notifications', '79-admin_as_admin', '82-no-such-page']
save(grid([fit(load(SMOKE, 'on', p + '.png'), 194) for p in pick], 6, gap=6), 'smoke-sheet.jpg')
