# 프론트엔드 가이드 웹 페이지

`docs/frontend-guide.md` + `docs/frontend-guide-concepts.md`를 목차가 있는 웹 페이지 한 장으로 만든다.

- 게시: https://claude.ai/artifact/FUEdGDVuFQN1CpoG9yqTpR (비공개로 시작, 공유는 페이지 Share 메뉴)
- 만들기: `node tools/guide-page/build.mjs` → `tools/guide-page/out/frontend-guide.html` (out/ 은 커밋 안 함)
- 갱신: 다시 만든 뒤 Artifact publish. 같은 세션이면 같은 file_path, 다른 세션이면 위 url 을 `url`로 (먼저 read)
- 외부 패키지 없음. 이 두 문서가 쓰는 마크다운만 처리함 (제목 · 문단 · 목록 2칸 들여쓰기 · 표 · 코드 블록 · 줄 · 링크 · 굵게 · 코드). 새 문법을 쓰면 `build.mjs`도 고칠 것
- 두 문서 사이 링크는 페이지 안 이동, 다른 docs/ 문서는 GitHub 링크(↗). 제목 id 는 ASCII(`g-12`, `c-3`)라 아티팩트 주소의 `#이름`으로도 쓸 수 있음
- 사건 표의 "상태 · 심각도" 칸은 색 칩, "사건" 칸은 그 사건 제목으로 가는 링크
- 모양: `template.html` (앱 토큰 색, Do Hyeon · Noto Sans KR · Nanum Gothic Coding, 다크 모드)
- 처음 만든 날 npm 설치(marked)가 막혀서 직접 만든 변환기를 씀 (2026-11-17)
