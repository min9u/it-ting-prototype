# 프론트엔드 가이드 웹 페이지

`docs/frontend-guide.md` + `docs/frontend-guide-concepts.md`를 목차가 있는 웹 페이지 한 장으로 만든다. 그림(SVG)과 사진이 같이 들어간다.

- 게시: https://claude.ai/artifact/FUEdGDVuFQN1CpoG9yqTpR (비공개로 시작, 공유는 페이지 Share 메뉴)
- 외부 패키지 없음 (처음 만든 날 npm 설치가 막혀서 직접 만든 변환기를 씀, 2026-11-17)

## 만들기
```
node tools/guide-page/build.mjs
```
- 결과: `tools/guide-page/out/frontend-guide.html`(게시용) + `out/frontend-guide.preview.html`(로컬 확인용, 뼈대를 씌운 판) + `out/img/*`(사진 복사본) + `out/files.json`(같이 올릴 파일 목록). `out/`은 커밋 안 함
- 경고가 하나라도 있으면 종료 코드 1. 잡는 것: 깨진 페이지 안 앵커, 없는 문서 링크, 없는 그림 파일, 200KB 넘는 사진, SVG 안의 `<script>`·`<style>`·`<foreignObject>`·`<image>`

## 게시 (Artifact publish)
- `file_path`: `tools/guide-page/out/frontend-guide.html`
- `files`: `out/files.json`의 경로마다 `{"img/x.jpg": "tools/guide-page/out/img/x.jpg"}`. 키(페이지 기준 경로)는 페이지의 `<img src>`와 같음
- 같은 세션이면 같은 file_path로, 다른 세션이면 위 url을 `url`로 (먼저 read). 사진을 지웠으면 그 경로를 `null`로
- 페이지에는 `<html>/<head>/<body>`가 없음 (게시할 때 붙음). 로컬에서 볼 때는 `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>…</body></html>`로 감싸서 연다

## 처리하는 마크다운
- 제목 · 문단 · 목록(2칸 들여쓰기) · 표 · 코드 블록 · 줄 · 링크 · 굵게 · 코드 · **이미지**. 새 문법을 쓰면 `build.mjs`도 고칠 것
- 두 문서 사이 링크는 페이지 안 이동, 다른 docs/ 문서는 GitHub 링크(↗). 제목 id 는 ASCII(`g-12`, `c-3`)라 아티팩트 주소의 `#이름`으로도 쓸 수 있음
- 사건 표의 "상태 · 심각도" 칸은 색 칩, "사건" 칸은 그 사건 제목으로 가는 링크
- **이미지**: 한 줄에 `![설명](guide-diagrams/x.svg)` 하나만 쓰면 `<figure>`가 됨. 캡션은 `![설명](경로 "캡션")`의 캡션, 없으면 설명. 그림 번호(그림 1, 2 …)는 페이지에서만 붙음
  - SVG(`docs/guide-diagrams/`)는 본문에 **인라인**으로 넣음 → 다크 모드를 따름. id 에 그림마다 접두사(`s3-`)를 붙여 겹치지 않게, `width`·`height`는 빼고 CSS 로 크기를 정함 (넓은 화면은 본문 폭, 좁은 화면은 viewBox 폭의 0.8배까지만 줄이고 상자 안 가로 스크롤)
  - 사진(`docs/guide-images/`)은 `out/img/`로 복사하고 `width`·`height`·`loading="lazy"`를 넣음
  - 그림을 누르거나 "크게 보기"를 누르면 같은 페이지 안 덮개로 크게 봄 (Esc · 닫기)
- 모양: `template.html` (앱 토큰 색, Do Hyeon · Noto Sans KR · Nanum Gothic Coding, 다크 모드)

## 그림(SVG) 규칙
GitHub(`<img>`로 보임)과 이 페이지(인라인) 두 곳에서 같은 파일이 보이게 쓴다. 본보기: `docs/guide-diagrams/fe-be-boundary.svg`
- 뿌리: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 H" width="760" height="H" role="img" aria-label="그림이 말하는 것 한 문장" font-family="'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="13" style="fill:var(--ink,#3e2a1f)">`
  - 폭은 760이 기본 (본문 46em ≈ 736px에 거의 1:1). 글자 크기 13(본문) · 11.5~12(보조) · 11 미만 금지
  - 첫 도형은 바탕: `<rect width="760" height="H" rx="14" style="fill:var(--fig-bg,#fffaf4)"/>` (GitHub 다크 테마에서도 글자가 보이게)
- 색은 **반드시** `style="fill:var(--토큰,#밝은값)"` / `stroke:var(...)`로. 페이지가 다크 모드에서 토큰 값을 바꿈 (`template.html`)
  | 토큰 | 밝은 값 | 쓰는 곳 |
  |---|---|---|
  | `--fig-bg` | `#fffaf4` | 그림 바탕, 바탕 위 카드 |
  | `--box` / `--box-line` | `#f4e6d8` / `#e3cbb5` | 상자 칸 / 테두리 |
  | `--ink` · `--ink-soft` · `--ink-mute` | `#3e2a1f` · `#5c4334` · `#8a7262` | 글자 · 보조 글자와 화살표 · 흐린 글자 |
  | `--accent` / `--accent-soft` | `#9a4a2c` / `#f6dccb` | 강조 글자 / 강조 칸 |
  | `--cta` | `#c8643a` | 지금 이야기하는 길·번호 동그라미 (하나만 강조) |
  | `--strong` / `--on-strong` | `#6b4a3a` / `#fbf4ec` | 진한 칸 / 그 위 글자 |
  | `--chip-<톤>-bg` / `-fg` | sage `#dde7cc`/`#3f5a24` · sky `#d9e6ec`/`#2f5868` · mint `#d5e8df`/`#2e5e4c` · rose `#f2d9d9`/`#7d3a3f` · butter `#f3e6be`/`#6b5410` · clay `#f1dccb`/`#7e3b22` · sand `#eadfc6`/`#5e4a1e` | 영역 구분 (브라우저=clay, 서버=sky, DB=sage), 성공=mint, 실패=rose, 주의=butter |
- 화살표: `<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-soft,#5c4334)"/></marker>` + `marker-end="url(#ah)"`. 화살표에는 글자를 붙인다(무엇이 오가는지)
- 쓰지 않는 것: `<style>`, `<script>`, `<foreignObject>`, `<image>`, 외부 글꼴·그림, `<title>`(설명은 aria-label과 캡션). 긴 설명 문장은 그림 밖 캡션·본문으로
- 숫자·파일 이름은 문서·코드에 있는 것만. 지어낸 값 금지 (예시 값이면 그림에 "예"라고 적음)
- 확인: `node tools/guide-page/svg-sheet.mjs <out.html> [--dark] docs/guide-diagrams/a.svg …` → `node tools/guide-page/shoot.mjs --url=file:///<out.html> --out=<png> --width=780 --full`로 밝게·어둡게 찍어 글자 겹침·넘침을 본다
- 페이지 전체 확인: `out/frontend-guide.preview.html`을 1366px · 390px · 다크(작업 목록의 `"dark": true`)로 찍는다. 좁은 화면에서 페이지 가로 스크롤은 없어야 하고(그림 상자 안에서만 밀림), 같은 SVG 가 GitHub 에서는 `<img>`로 보인다

## 사진 규칙
- `docs/guide-images/`에 jpg(또는 webp). 폭 1200px 이하, 한 장 200KB 이하, 합계 5MB 이하 (2026-11-17: 10장 약 670KB)
- 앱 화면은 실제 빌드를 헤드리스 크롬으로 찍은 것만. 지어낸 화면 없음
- 다시 만들기
  1. 스모크 화면: `cd app && npm run build && npm run smoke && npm run smoke -- --gpu=none` → `app/shots/smoke/{on,none}/`
  2. 상태 화면(`?api=slow·fail·empty`, 찜 실패, 채팅 끊김): `node tools/guide-page/shoot.mjs tools/guide-page/app-shots.json` (`app/dist`를 띄워 찍음, 다른 폴더면 `--serve=<dist 경로>`) → `out/shots/`
  3. `python -I tools/guide-page/make-images.py [--smoke=<shots/smoke 경로>]` → 자르고 이름표를 붙여 `docs/guide-images/*.jpg` (윈도우 맑은 고딕 사용)
  - 그래픽 비교(`bake-shadow`, `quality-compare`)는 `explore/gpu/results/round3/crops/`를 씀

## 도구
| 파일 | 하는 일 |
|---|---|
| `build.mjs` | 마크다운 두 장 → 페이지 한 장 + `out/img/` + `out/files.json` |
| `template.html` | 페이지 틀 (색 토큰, 목차, 지금 읽는 곳, 목차에서 찾기, 그림 크게 보기) |
| `shoot.mjs` | 헤드리스 크롬 스크린샷 (CDP 직접). 페이지 확인 · 앱 화면 찍기 · 다크 모드 흉내(`dark`) · 누른 뒤 찍기(`eval`) |
| `app-shots.json` | 앱 상태 사진 찍기 목록 (`shoot.mjs` 입력) |
| `make-images.py` | 스크린샷 → `docs/guide-images/*.jpg` (자르기 · 이름표 · 크기 맞추기) |
| `svg-sheet.mjs` | SVG 여러 개를 페이지와 같은 색·서체로 한 장에 늘어놓기 (확인용) |
