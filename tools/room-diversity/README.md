# 땅굴 다양성 비교 (팀 공유용 비교 페이지)

관심사가 서로 다른 사람들의 땅굴이 실제로 얼마나 다르게 보이는지, 같은 구도로 찍어서 숫자와 그림으로 보여 주는 페이지.

- 요청 (그대로): "지금 탐색화면에서 다른 사용자들의 땅굴을 들어가보면 다양성이 적은 것 같아. 방이 다 똑같아 보인다는 단점이 있어. 일단 한눈으로 확인해볼 수 있게, 사용자들이 서로 다른 관심사를 선택하도록 하고, 그 방이 각각 어떻게 보이는지 비교할 수 있게 아티팩트를 만들어줘."
- 결론과 숫자: [docs/room-diversity-2026-11-18.md](../../docs/room-diversity-2026-11-18.md)
- 이번 목표는 **지금 상태를 정확히 보여 주기**. 방을 바꾸는 개선은 하지 않음 (후보만 페이지 끝에)

## 파일
| 파일 | 하는 일 |
|---|---|
| `personas.json` | 찍을 사람. A = 일부러 다르게 고른 16명(관심사 확정본 이름 그대로), B = 내 들판(서울-2층) 자리 1~10번 이웃 + 내 땅굴 |
| `capture.mjs` | 헤드리스 크롬(가속 켬)으로 앱의 실험 경로 `/lab/rooms`를 열어 사람마다 세 번 찍음 → `out/raw/` · `out/raw-nomole/` · `out/raw-wall01/` (+ 관심사 0개 빈 방 `z-empty`). `--check` = 실험 경로와 실제 방문자 뷰가 같은 방인지 볼 사진 |
| `analyze.py` | 평균 방 · 차이 지도 2장 · 방마다 숫자 · 둘씩 비교 · 늘 있는 물건 상자 검사 → `out/data.json`, `out/img/` |
| `room-diversity.html` | 페이지 원본 (`{{이름}}` 자리와 `const DATA = null /*__DATA__*/` 를 build 가 채움) |
| `build.mjs` | `out/room-diversity.html`(게시용) + `out/files.json`(같이 올릴 사진 목록) |
| `preview.py` | 로컬에서 열어 볼 `out/_preview.html` (게시할 때 붙는 html·head·body 를 흉내, 올리지 않음) |

`out/` 은 커밋하지 않음 (.gitignore). 문서용 작은 그림은 `docs/screenshots/room-diversity/` 에.

## 다시 만들기 (저장소 루트에서)
```
cd app && npm run build && cd ..            # 실험 경로가 들어간 앱 (app/dist)
node tools/room-diversity/capture.mjs      # 26명 + 빈 방 × 3번, 약 5분 (한 장 4초)
node tools/room-diversity/capture.mjs --check   # (선택) 실험 경로 = 방문자 뷰 확인용 사진 out/check/
python -I tools/room-diversity/analyze.py  # 10초 안쪽
node tools/room-diversity/build.mjs
python -I tools/room-diversity/preview.py  # (선택) 브라우저로 out/_preview.html
```
- 사람을 바꾸려면 `personas.json` 만 고치면 됨 (관심사 이름은 `app/src/data/interestTags.ts` 그대로, 3~10개)
- 한 사람만 다시: `capture.mjs --only=a13` (세 폴더 모두), 한 번만: `--pass=raw-nomole`

## 게시 (메인 세션이 함)
- Artifact publish: `file_path` = `tools/room-diversity/out/room-diversity.html`, `root` = `tools/room-diversity/out`, `files` = `out/files.json` 의 경로 그대로 (페이지 기준 상대 경로, 사진 112장 약 5.4MB)
- 처음 게시면 `icon` 한 단어 (예: `chart`). 다시 게시할 때는 같은 url 로, 바뀐 사진만 보내도 됨

## 실험 경로 `/lab/rooms` (앱)
- `app/src/screens/lab/RoomsLab.tsx`, 라우트는 `App.tsx` 의 로그인 영역(헤더 아래, 방문자 뷰와 같은 크기). 화면 목록 `/screens` 땅굴 묶음에도 있음
- `?interests=소설,영화` (이름 또는 id) · `?user=yerin` · `?seat=3`(내 들판 자리) · `?name=` · `?worn=` · `?wallpaper=wallpaper_01_default` · `?bare=1`(정보 상자 숨김) · `?still=0`(입장 연출 있음)
- 방문자 뷰와 같은 `RoomView` (집주인 두더지 + 내 두더지, 방 정보 패널을 접은 구도 focusX 0.5). 버튼·말풍선은 없음
- `window.__roomLab` = 사람 · 이 방에 실제로 놓인 것(`data/roomPlan.ts planRoom` · 벽지) · 내 들판 이웃 목록
- 찍기용 손잡이(앱 3D, 평소에는 꺼짐): `?qshot=1` 두더지 자세 고정(전부터 있던 것), `?nomole=1` 두더지 숨김(이번에 추가, `three/roomScene.ts`, 연출 없는 방에서만)
