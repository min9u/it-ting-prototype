# 땅굴 다양성 비교 (팀 공유용 비교 페이지)

관심사가 서로 다른 사람들의 땅굴이 실제로 얼마나 다르게 보이는지, 같은 구도로 찍어서 숫자와 그림으로 보여 주는 페이지.

- 게시: https://claude.ai/artifact/7WKmPmpkapceCdXreAszCn (2026-11-18 version 1 = 1차 "지금 상태", 같은 날 2차 = 다양성 작업 전 · 후. 비공개로 시작, 공유는 페이지 Share 메뉴). 다시 올릴 때는 `file_path` = `out/room-diversity.html`, `root` = `out`, `files` = `out/files.json` 의 경로마다 `{"경로": "경로"}`, 다른 세션이면 위 주소를 `url` 로 (먼저 read). 2차는 사진 경로가 `img/before/…` · `img/after/…` 로 바뀌어서 옛 `img/rooms/…` 같은 경로는 `null` 로 지워도 됨
- 1차 (2026-11-18): "지금 탐색화면에서 다른 사용자들의 땅굴을 들어가보면 다양성이 적은 것 같아 … 비교할 수 있게 아티팩트를 만들어줘" → [docs/room-diversity-2026-11-18.md](../../docs/room-diversity-2026-11-18.md)
- 2차 (2026-11-18): "벽지 문제를 고친다음, 땅굴 다양성을 늘리는 작업을 진행해" → [docs/room-diversity-2-2026-11-18.md](../../docs/room-diversity-2-2026-11-18.md). 같은 26명을 다시 찍어 **전 · 후**를 한 페이지에

## 파일
| 파일 | 하는 일 |
|---|---|
| `personas.json` | 찍을 사람. A = 일부러 다르게 고른 16명(관심사 확정본 이름 그대로), B = 내 들판(서울-2층) 자리 1~10번 이웃 + 내 땅굴 |
| `capture.mjs` | 헤드리스 크롬(가속 켬)으로 앱의 실험 경로 `/lab/rooms`를 열어 사람마다 세 번 찍음 → `out/<묶음>/raw/` · `raw-nomole/` · `raw-wall01/` (+ 관심사 0개 빈 방 `z-empty`). 묶음은 `--set=after`(기본) · `before`. `--check` = 실험 경로와 실제 방문자 뷰가 같은 방인지, `--me` · `--me=decor` = "나"를 내 땅굴과 남이 보는 내 땅굴로 찍어 같은 방인지 (`out/check-me/`) |
| `analyze.py` | 묶음(before · after)마다 평균 방 · 차이 지도 3장 · 방마다 숫자 · 둘씩 비교 · 늘 있는 물건 상자 검사 + 방마다 전후 차이 → `out/data.json`, `out/img/<묶음>/` |
| `room-diversity.html` | 페이지 원본 (`{{이름}}` 자리와 `const DATA = null /*__DATA__*/` 를 build 가 채움) |
| `build.mjs` | `out/room-diversity.html`(게시용) + `out/files.json`(같이 올릴 사진 목록). `perf.json` 이 있으면 저사양 표도 |
| `perf-summary.mjs` | `explore/gpu/results/room-diversity-2/*.json`(cdp-scene 측정) → `perf.json` |
| `check.py` | 두 장이 같은 방인지 (다른 픽셀 비율 + 나란히 그림) |
| `sheet.py` · `montage.py` | 문서용 격자 그림 · 나란히 그림 (200KB 안쪽) |
| `preview.py` | 로컬에서 열어 볼 `out/_preview.html` (게시할 때 붙는 html·head·body 를 흉내, 올리지 않음) |

`out/` 은 커밋하지 않음 (.gitignore). 문서용 작은 그림은 `docs/screenshots/room-diversity/`(1차) · `docs/screenshots/room-diversity-2/`(2차) 에.

## 다시 만들기 (저장소 루트에서)
```
cd app && npm run build && cd ..                      # 실험 경로가 들어간 앱 (app/dist)
node tools/room-diversity/capture.mjs                 # 후: 26명 + 빈 방 × 3번, 약 5분 → out/after/
# 전 묶음 out/before/ 은 다양성 작업 전 앱으로 찍은 것 (2026-11-18 1차 그림을 그대로 옮김). 다시 찍으려면 전 커밋으로 빌드한 뒤
#   node tools/room-diversity/capture.mjs --set=before        (또는 지금 앱에서 --set=before --look=designer: 색 묶음만 끈 모습, 1단계 벽지 고침은 들어감)
node tools/room-diversity/capture.mjs --me            # (선택) 내 땅굴 = 남이 보는 내 땅굴 확인 → python -I tools/room-diversity/check.py out/check-me/my.png out/check-me/visit.png
python -I tools/room-diversity/analyze.py             # 1분 안쪽
node tools/room-diversity/perf-summary.mjs            # (선택) 저사양 측정 표
node tools/room-diversity/build.mjs
python -I tools/room-diversity/preview.py             # (선택) 브라우저로 out/_preview.html
```
- 사람을 바꾸려면 `personas.json` 만 고치면 됨 (관심사 이름은 `app/src/data/interestTags.ts` 그대로, 3~10개). 전 · 후 둘 다 다시 찍어야 함
- 한 사람만 다시: `capture.mjs --only=a13` (세 폴더 모두), 한 번만: `--pass=raw-nomole`
- 🎨 땅굴 색 다양하게를 끄고(디자이너 원래 색) 찍기: `--look=designer`

## 게시 (메인 세션이 함)
- Artifact publish: `file_path` = `tools/room-diversity/out/room-diversity.html`, `root` = `tools/room-diversity/out`, `files` = `out/files.json` 의 경로 그대로 (페이지 기준 상대 경로, 2차 사진 약 230장)
- 다시 게시할 때는 같은 url 로, 바뀐 사진만 보내도 됨

## 실험 경로 `/lab/rooms` (앱)
- `app/src/screens/lab/RoomsLab.tsx`, 라우트는 `App.tsx` 의 로그인 영역(헤더 아래, 방문자 뷰와 같은 크기). 화면 목록 `/screens` 땅굴 묶음에도 있음
- `?interests=소설,영화` (이름 또는 id, 저장한 방 없음) · `?user=yerin` · `?seat=3`(내 들판 자리) · `?name=` · `?worn=` · `?wallpaper=wallpaper_01_default` · `?bare=1`(정보 상자 숨김) · `?still=0`(입장 연출 있음)
- `?user=` · `?seat=` 는 방문자 뷰와 같은 땅굴 API 길(목 서버 `GET /burrows/{id}` → `toBurrow` → `roomLookOf`)로 집주인 관심사 · 저장한 방을 받음 (2026-11-18 2차). `?user=me` = 남이 보는 내 땅굴
- 방문자 뷰와 같은 `RoomView` (집주인 두더지 + 내 두더지, 방 정보 패널을 접은 구도 focusX 0.5). 버튼·말풍선은 없음
- `window.__roomLab` = 사람 · 방 모습(`look`: 벽지 · 가구 선택 · 꾸미기 값) · 색 묶음(`theme`) · 이 방에 실제로 놓인 것 · 내 들판 이웃 목록. `window.__roomLook` = 3D 장면이 실제로 받은 값
- 찍기용 손잡이(앱 3D, 평소에는 꺼짐): `?qshot=1` 두더지 자세 고정, `?nomole=1` 두더지 숨김(연출 없는 방에서만), `?look=designer` 디자이너 원래 색, `?stylepat=0` 무늬 · 마감 없이(가벼운 꾸미기)
