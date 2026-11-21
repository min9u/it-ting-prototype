# 테스트 · 스모크 · CI · 번들 크기

- 날짜: 2026-11-16
- 요청: 테스트 · CI · 품질 도구 · 명세 확인 목록 맡기 (단위 테스트, 화면 스모크, GitHub Actions CI, 번들 크기 예산, 명세 ↔ 디자인 확인 목록)
- 같이 만든 문서: [spec-design-gaps.md](spec-design-gaps.md) (02 명세 ↔ 03 디자인 확인 목록 81줄)
- 앱 코드(화면 · data 저장소)는 고치지 않았다. 다른 작업자가 REST 계층 · 실시간 채팅 · 에러 경계를 같은 때 작업하고 있어서, 테스트는 바뀌어도 잘 안 깨지는 순수 함수 · JSON 위주로 썼다
- 새 패키지는 설치하지 않았다. 이미 들어 있는 vitest 5.1 · jsdom 31 · @testing-library/react 16 과 시스템 크롬만 쓴다

## 결론
- **단위 테스트 166개(통과 163 · 할 일 3)**, 9초. 명세 번호를 테스트 이름에 적었다 (예: "M7 마감 일시가 지나면 처리 안 된 신청은 자동 미승인")
- **스모크 96개 화면 모두 OK**: 가속 켬 · 가속 끔 · WebGL 없음 세 모드 (2026-11-17, 모든 작업을 합친 최종 main). 가속 끔에서 찾은 실패 1건은 고침 (아래 "결과")
- **첫 화면 JS 380KB(gzip)** 로 크다 (11-16 작업 때 340KB → 11-17 main 을 합친 뒤 API 계층 · react-query · 실시간 계층이 들어와 +40KB, 예산 360KB 를 넘어 CI 에서 경고). 라우트가 모두 정적 import 라 모든 화면 코드 + 가구 카탈로그 JSON + 작은 그림 23장(data URL)이 첫 화면에 실린다. 줄일 후보 6개는 아래 "번들 크기"
- CI(`.github/workflows/ci.yml`)는 로컬에서 같은 명령을 차례로 돌려 확인했다 (GitHub 에서는 아직 안 돌려 봄)

## 한눈에

| 명령 (app/ 에서) | 하는 일 | 이 PC 시간 |
|---|---|---|
| `npm test` | vitest 단위 테스트 한 번 (`npm run test:watch` 는 저장할 때마다) | 약 9초 |
| `npx tsc -b` | 타입 검사 (테스트 파일도 `src/` 안이라 같이 검사) | 2초 |
| `npm run build` | `tsc -b && vite build` | 4초 |
| `npm run bundle-report` | 빌드 결과 청크별 크기(gzip) · 첫 화면 JS 합계 · 예산 초과 경고 | 2초 |
| `npm run smoke` | 빌드한 앱(dist)을 헤드리스 크롬으로 열어 모든 화면 돌기 · 스크린샷 · 표 | 약 4분 |
| `npm run smoke -- --gpu=off` | 그래픽 가속을 끈 크롬(소프트웨어 렌더)으로 같은 검사 | 약 4분 (`--gpu=none` 은 약 3분) |

## 1. 단위 테스트 (vitest)

설정 `app/vitest.config.ts` (vite.config.ts 와 따로: React 플러그인·빌드 설정이 필요 없음). 테스트는 `app/src/tests/*.test.ts`.
- 환경은 jsdom (data 저장소가 localStorage · sessionStorage 를 씀), **시간대는 서울로 고정** (CI 러너는 UTC, 목 데이터 날짜 계산이 로컬 시각 기준)
- 모듈 변수 저장소(모임 · 채팅)는 `vi.resetModules()` 뒤 다시 import 해서 테스트마다 처음 상태로. 불러오는 순간 `Date.now()` 를 쓰는 목 데이터(채팅)는 `vi.setSystemTime` 으로 시계를 고정한 뒤 import
- 화면 컴포넌트는 테스트하지 않음 (다른 작업자가 react-query 로 바꾸는 중). 저장소 훅이 하나뿐인 커뮤니티 글 목록만 `renderHook(usePosts)` 로 읽음

| 파일 | 개수 | 다루는 것 · 근거 |
|---|---|---|
| `format.test.ts` | 10 | `lib/format.ts` 시간 · 날짜 표기, `lib/store.ts noticeTime` (00 공통 8), 방명록 7일 자동 삭제 · 최신순 (F4 방명록 3) | (2026-11-21: 7일 자동 삭제 → "자동 삭제 없음 · 서로 다른 3명 신고하면 가려짐 · 최신순" `visibleGuestbook` 으로 바뀜)
| `room-plan.test.ts` | 29 | 관심사 카탈로그(카테고리 11 · 세부 65 · 최대 10, F3 2-5), `toSubIds`(고른 순서 · 중복 · 최대 10), 땅굴 무드 = 대표 관심사(F3 3a-3 · 00 공통 5), 예전 가중치 Σ(1+1000/인원), `planRoom`(카테고리 가구 슬롯 고정, **무작위 조합 300개에서 슬롯 겹침 없음**, 반려동물 짝 같은 시각 v3.4, 몇 개를 고르든 1.6초 안 "2초 안에"), 가구 고르기 후보 · `pruneChoice` · `applyChoice` (F4 꾸미기 가구 탭 3), 통하는 취향 5명 이하 |
| `field.test.ts` | 21 | 들판 id · 이름 · 주소, `fieldOf`(모든 들판 자리 1~150 · 중복 없음 · 구역 수 = ceil(가장 큰 번호/25), 내 들판 38자리 → 구역 2, 빈 들판), `locateUser`(F5 13 · 00 공통 13), 소속 표기에 "반" 없음(00 공통 4), `drawRecommendations`(3명 · 나 빼고 · 하루 한 번 · 같은 날 같은 결과 · 우선순위, F5 5) |
| `meetup.test.ts` | 31 | NOW = TODAY 정오, `parseHour` · D-day · 마감 표기, **M2** 정원에 주최자 포함, 모집 완료(정원 · 마감), **M14** 시작하면 바로 지난 모임, **M7** 자동 미승인 3가지, **M8** 다시 신청, **M5** 참여 취소 24시간(정각 포함) · 수정 12시간 · 취소는 시작 전까지, 채팅 "모임 나가기"와 같은 규칙, 신청 · 취소 · 수락(정원에서 멈춤) · 거절 · 내보내기 · 만들기(M15 태그 3개) · 취소 · 삭제 · 찜 · 신고 한 번(M10), 내 모임 5탭 분류 |
| `chat.test.ts` | 20 | 요청 5일 만료 · 최신순 · "요청 N" 은 받은 것만, 수락 → 1:1 방 · 거절 · 중복 요청 막기, 나간/탈퇴 방 읽기 전용, 모임 링크 → 카드, 나간 모임 방은 다시 안 생김, 확정 · 주최 모임은 모두 방이 있음, 공지, 모임 나가기(주최자 불가 · 24시간 · 끝난 모임은 방만 M17), 시간 표기 4종 |
| `data-json.test.ts` | 20 | `fieldLayout150.json`(108×72m · 구역 6 · **자리 150개 1~150 하나씩** · 구멍이 구역 번호 범위와 경계 안 · 구멍 간격 2m 이상 · 구역이 들판을 겹침 없이 덮음 · camRect · 노드 · 링 색 번호), 가구 카탈로그 · 슬롯 · 관심사 카탈로그(id 하나씩 · 가구 수 = 슬롯 수 · 같은 카테고리 · 크기가 슬롯 안 · 선반 12칸 · 반려동물 짝 · 슬롯 이름 · built 면 glb), 벽지 mood_map |
| `rules.test.ts` | 35 | 비밀번호 00 공통 9 (11가지 · **auth.ts 와 account.ts 두 구현이 같은지**) · 확인 칸, 이메일, 재설정 링크(30분 · 다시 보내면 이전 무효 · 한 번), 닉네임 12자 · 겹침, 답변 10~50자, 추천 질문 3개, 두더지 액세서리(41개 · 부위마다 하나 · 리본+캐리어 · 관심사 잠금 · 손 소품 숨김), 알림 30일 · 안 읽은 것 먼저 · 종류 끄기 (F9), 커뮤니티 인기 글 · 신고 3명이면 가려짐 (F8) |

할 일(`it.todo`, 지금 구현과 명세가 달라서 통과시킬 수 없는 것):
1. 시간 표기 00 공통 8 을 한 곳으로 — 지금 네 곳(`lib/format timeAgo`, `lib/store noticeTime`, `data/chat ago`, `data/boardStore ago`)이 서로 다름: "방금" / "방금 전", 1시간 안을 "N분 전" / "방금", "어제" 있음 / 없음. 날짜 통일 작업이 합치면 기대값을 그 규칙으로
2. ~~남의 땅굴 벽지도 대표 관심사 규칙으로~~ → 2026-11-18 고침: 방 모습을 `data/roomLook.ts roomLookOf` 한 곳에서 정함, 시험 `room-look.test.ts` ([room-diversity-2-2026-11-18.md](room-diversity-2-2026-11-18.md))
3. 가입 캠퍼스-층 목록(`data/auth.ts` 서울 2·10·12·13층 …)과 들판 목록(`data/field.ts` 서울 2·3·12층 …)을 하나로 — 서울-10층으로 가입하면 들판이 없음 (G-10)

테스트로 찾은 데이터 문제 (테스트는 허용 오차를 두고 통과):
- 가구 2개가 슬롯 최대 크기를 1~2mm 넘음: `reading_lamp` 0.301 > 0.3, `yoga_mat` 0.302 > 0.3 (테스트는 1cm 허용). 디자이너에게 알려 둘 것
- 카탈로그에 앱 타입(`FurnitureRow.type`)에 없는 `prop`(우체통 한 줄)이 있음. 지금은 `three/mailbox.ts` 가 따로 읽어서 문제없음
- mock 사용자 소속에 아직 "N반"이 남아 있음 (`data/mock.ts USERS.*.affiliation`). 화면은 `affOf` 로 반 없이 보이지만 백엔드 응답 형식을 정할 때 주의

## 2. 화면 스모크 (`app/scripts/smoke.mjs`)

설치 없이 Node 24 + 시스템 크롬을 CDP(WebSocket)로 직접 조종한다 (`explore/gpu/cdp-*.mjs` 와 같은 방식).
1. `dist/` 를 작은 정적 서버로 띄움 (포트 5331, 없는 경로는 index.html). `--url=http://127.0.0.1:5331` 이면 떠 있는 개발 서버를 그대로 씀
2. 화면 목록 = `src/screens/ScreenIndex.tsx` 의 82개 + `src/App.tsx` 라우트 중 목록에 없는 14개(`:id` 는 목 데이터 값으로) = **96개** (11-16 에는 94개, 11-17 땅굴 다양성 실험 `/lab/style` · `/dev/crash` 가 늘어남). `--list` 로 목록만 볼 수 있음
3. 화면마다 저장소(localStorage · sessionStorage)를 비우고 새로 엶 → load 뒤 네트워크가 0.9초 조용해지거나 최대 7초(`--wait`)까지 기다림
4. 잡는 것: 처리 안 된 예외(Promise 포함) · `console.error` · 같은 주소 리소스 4xx/5xx · 네트워크 실패 · 빈 화면(#root 가 비었거나 글 · 그림이 없음) · 오류 화면("잠시 문제가 생겼어요") · 뜻밖의 "없는 주소예요"(00 공통 21 을 일부러 보는 주소는 뺌) · canvas 가 있으면 WebGL 컨텍스트를 얻었는지
5. 결과: 터미널 표 + `app/shots/smoke/<gpu>/report.md` · `report.json` · 화면별 PNG (`shots/` 는 `.gitignore` 의 `**/shots/*` 로 커밋 안 됨). **실패(예외 · 빈 화면 · 오류 화면)가 있으면 종료 코드 1** (`--no-fail` 로 끔)

옵션: `--gpu=on|off|none|swiftshader` (off = 크롬 설정 "그래픽 가속 사용" 끔 + `--disable-gpu`, none = WebGL 자체 없음, swiftshader = CI 처럼 GPU 없는 곳), `--only=<주소 일부>`, `--wait=<ms>`, `--hash --dist=dist-share`(공유 빌드), `--width/--height`(기본 1440×960). 크롬 위치는 `CHROME=` 로 바꿀 수 있고 `CI=1` 이면 `--no-sandbox`.

### 결과 (2026-11-17 12시 최종 main, 이 PC: RTX 있음 · 크롬 157)

| 모드 | 화면 | OK | 경고 | 실패 | WebGL 얻음 / canvas 있는 화면 | 시간 |
|---|---|---|---|---|---|---|
| gpu=on | 96 | 96 | 0 | 0 | 29 / 29 | 226초 |
| gpu=off (가속 끔, WARP) | 96 | 96 | 0 | 0 | 29 / 29 | 226초 |
| gpu=none (WebGL 없음) | 96 | 96 | 0 | 0 | 0 / 0 (3D 자리에 정지 그림) | 161초 |

- 11-16 첫 실행(가속 켬, 94개)은 OK 93 · 경고 1. 경고(`/admin`)는 역할이 없으면 "없는 주소"처럼 보이는 F11 명세 그대로라 스모크 쪽 예외 목록에 넣음. `/dev/crash` 도 개발 서버 전용이라 빌드에서는 없는 주소가 맞아 같은 목록에
- 3D 화면(땅굴 · 탐색 · 채팅 찻방 · 시작 화면 · 온보딩 미리보기 · 꾸미기)은 네트워크가 계속 오가서 최대 기다림 7초를 다 쓴다. 다른 화면은 1.3~2.2초
- **가속 끔 실패 1건 (11-17, 고침)**: `/burrow/yerin?modal=request` 등에서 `sharpBake` 의 `putImageData` 가 null 에 불림. 원인은 스모크가 WebGL 을 얻었는지 보려고 **모든 canvas** 에 `getContext('webgl2')` 를 부른 것: 아직 굽지 않은 '선명한 배경' 2D 캔버스에 WebGL 컨텍스트가 생겨 앱이 2D 컨텍스트를 못 얻음. 스모크는 three.js 렌더러 캔버스(`data-engine`)만 보게 고침. 앱도 2D 컨텍스트를 못 얻으면 굽기를 그만두고 선명한 배경 없이 원래대로 그리게 함 (`three/sharpBake.ts` `broken`, 확장 프로그램 등 다른 코드가 같은 일을 해도 멈추지 않게)
- 가속 끔에서 땅굴 화면 4개가 "로딩이 안 끝남" 경고: 네트워크가 조용해진 뒤에도 3D 준비(예열 · 굽기)가 이어져서. 스모크가 로딩 표시("땅굴 파는 중" 등)가 남아 있으면 최대 9초까지 더 기다리게 함 (가속 끔 첫 땅굴 7.1초, 그다음은 3.7~4초)
- WebGL 없음: three.js 가 내는 "컨텍스트를 못 만듦" 콘솔 에러는 예상한 것이라 이 모드에서만 무시. 3D 자리에 GPU 로 미리 찍은 정지 그림이 나오는지는 스크린샷으로 확인 (내 땅굴 · 탐색 들판 · 시작 화면)

## 3. CI (`.github/workflows/ci.yml`)

GitHub Actions, `ubuntu-24.04`, 모든 단계를 **`app/` 에서** (`defaults.run.working-directory: app`). main 에 push · PR · 손으로 실행.

| 단계 | 명령 | 로컬에서 같은 명령 결과 (Windows 11, Node 24.18.0) |
|---|---|---|
| Node 고정 | `actions/setup-node@v4` + `node-version-file: app/.nvmrc` (24.18.0), npm 캐시 | 로컬 Node 24.18.0 · npm 11.16 |
| 설치 | `npm ci` | 안 돌림 (node_modules 를 다른 작업자와 같이 써서). `package-lock.json` 에 리눅스용 rolldown · lightningcss · typescript 바이너리가 들어 있는 것만 확인 |
| 타입 | `npx tsc -b` | 통과 |
| 단위 테스트 | `npm test` | 통과 (CI_TEST_RESULT) |
| 빌드 | `npx vite build` | 통과 1.96초. 경고 2개: 600KB 넘는 청크, `data/field.ts` 동적 import 가 효과 없음(INEFFECTIVE_DYNAMIC_IMPORT) |
| 번들 크기 | `npm run bundle-report -- --json=… --md=…` | 아래 표. 예산 초과면 `::warning` + 작업 요약(Summary)에 표, 실패로는 안 막음 |
| 스모크 | `npm run smoke -- --gpu=swiftshader --wait=9000` | 로컬은 gpu=on · off 로 돌림 (위). 러너의 `google-chrome` 을 씀 |
| 결과 올리기 | `actions/upload-artifact@v4` (스크린샷 · 보고서, 14일) | — |

- 시간대 `TZ=Asia/Seoul` 를 CI 에도 줌 (vitest.config.ts 와 같은 값)
- 확인 못 한 것: 실제 GitHub 러너에서 SwiftShader WebGL 로 3D 화면이 9초 안에 뜨는지, `npm ci` 시간. 첫 실행 뒤 스모크가 너무 느리면 `--only` 로 대표 화면만 돌리거나 스모크 단계를 `continue-on-error` 로

## 4. 번들 크기 (`app/scripts/bundle-report.mjs`)

빌드 결과의 파일마다 원본 · gzip 크기, index.html 이 바로 불러오는 JS(+ 그 JS 가 정적으로 import 하는 청크) = **첫 화면 JS**, 예산 초과 경고. `--dist=dist-share` 로 공유 빌드도. GitHub Actions 에서는 작업 요약에 표를 붙임.

예산(gzip, 더 커지지 않게 막는 선 — 지금 값 + 5~10%): 첫 화면 JS 360KB · 지연 청크 하나 300KB · CSS 70KB · 공유 빌드 glb 내장 청크 하나 2000KB. 줄이면 같이 낮출 것.

### 지금 크기 (`npm run build`. 표는 2026-11-16 기준, 첫 화면 JS 만 2026-11-17 main 합친 뒤 값)

| 구분 | 파일 | 원본 | gzip |
|---|---|---|---|
| **첫 화면 JS** | `index-*.js` (11-16 에는 `interests-*.js` 와 두 파일, 11-17 에는 한 파일) | 1104KB (11-16 985KB) | **380KB** (11-16 340KB) |
| 지연 JS (34개) | 아래 | 2.45MB | 721KB |
| CSS (4개) | `index-*.css` 271KB 가 대부분 (Pretendard @font-face 92개 48KB 포함) | 285KB | 62KB |
| 그 밖 (157개) | glb 15개 약 9MB, Pretendard woff2 92개, 그림 · wasm | 12.2MB | — |

| 큰 지연 청크 | 원본 | gzip | 무엇 |
|---|---|---|---|
| `roomScene-*.js` | 864KB | 270KB | **저사양 실험 D(땅굴 Worker) 전용 사본**. Worker 번들이 따로 묶여 가구 카탈로그 · 아이콘을 다시 품음. 실험을 안 켜면 받지 않음 |
| `moleActor-*.js` | 608KB | 157KB | three.js 본체 + GLTFLoader 등 (땅굴 · 탐색 · 찻방 · 미리보기가 같이 씀) |
| `draco/draco_decoder.js` | 500KB | 105KB | `public/` 의 순수 JS Draco 해독기. 일반 빌드는 wasm 해독기를 써서 **받지 않는 파일** |
| `FieldCanvas-*.js` | 173KB | 89KB | 예전 밭(시작 화면 · 둘러보기) + N8AO · postprocessing |
| `fieldLayout150-*.js` | 129KB | 37KB | 탐색 들판 배치 (탐색에 들어갈 때만) |

공유 빌드(`npm run build:share`, glb 를 JS 에 data URL 로): 첫 화면 JS 는 일반 빌드와 같음. glb 내장 청크가 큼 — `roomScene` 3.6MB(gzip 1.7MB), `moleActor` 2.9MB(1.3MB, three + 두더지 · 액세서리), 관심사 가구 11개 0.4~1.2MB. 아티팩트 한 파일 16MB 제한에는 여유.

### 첫 화면 JS 안에 든 것
- 모든 화면 코드: `App.tsx` 가 화면을 전부 정적 import (dev-deploy-risks F3 에도 있음)
- 4KB 이하 그림 23장이 data URL 로 약 101KB (두더지 액세서리 아이콘 20장 · 벽지 타일 3장, `import.meta.glob(eager)` + Vite 기본 `assetsInlineLimit` 4KB)
- 가구 카탈로그 JSON 약 67KB (`data/roomPlan.ts` → `myBurrow.ts` 를 여러 화면이 정적 import). 화면은 쓰지 않는 필드(`pos_blender`, `source`, `desc`, `note` …)도 그대로
- 이 둘(그림 + 카탈로그)만 빼도 gzip 346KB → 246KB (측정)

### 줄일 후보 (효과 큰 순, 앱 코드라 이번에는 손대지 않음)
1. **라우트 지연 로딩** (react-router `lazy`): 시작 화면 · 로그인에서 땅굴 · 모임 · 커뮤니티 · 설정 · 관리자 코드를 안 받게. 첫 화면 200KB 이하 목표
2. **작은 그림 인라인 끄기**: 액세서리 아이콘 · 벽지 타일은 `import.meta.glob` 을 eager 대신 지연으로, 또는 `build.assetsInlineLimit` 을 그 폴더에서만 0 으로 → 첫 화면 약 −75KB(gzip)
3. **가구 카탈로그 줄이기**: `build-field-layout.mjs` 처럼 앱이 쓰는 필드만 남기는 스크립트 → 84KB → 약 30KB 예상, 또는 땅굴 청크로 옮기기
4. **Worker 실험 D 정리**: 실험을 접으면 `roomScene` 사본 864KB 가 사라짐 (공유 빌드에서는 3.6MB 청크)
5. **`public/draco/draco_decoder.js` 빼기**: 일반 빌드는 wasm 만 씀 (배포 용량만 줄고 사용자 다운로드는 그대로)
6. **CSS**: 화면별 CSS Modules 가 한 파일(271KB)로 합쳐짐 → 1번을 하면 같이 나뉨. Pretendard @font-face 48KB 는 그대로 둠(쓰는 글자만 받음)
- 빌드 경고 `INEFFECTIVE_DYNAMIC_IMPORT`: `ExploreBurrow.tsx` 가 `data/field.ts` 를 동적 import 하지만 다른 곳에서 정적으로도 불러 효과 없음 → 동적 import 를 지우거나 정적 import 를 줄일 것

## 5. 명세 ↔ 디자인 확인 목록
[spec-design-gaps.md](spec-design-gaps.md): 지금까지 문서에 흩어진 "확인받을 것" · 불일치 · 명세 빈 곳에 02 명세 스크린샷을 다시 보고 찾은 것을 더해 **81줄**(F0 11 · F1 5 · F2 5 · F3 6 · F4 9 · F5 10 · F6 6 · F7 10 · F8 5 · F9 7 · F10 3 · F11 4). 맨 위 "먼저 정해야 할 것 5개": G-53 모임 분류(ERD `meetup.category` vs 결정 M15) · G-04 차단 기능 유무 · G-60 신고 대상과 처리 · G-32 들판 입구 규칙 · G-06 시간 기준 자동 처리

## 다음 단계
- GitHub 에서 CI 첫 실행 확인 (러너 SwiftShader 로 스모크 시간 · 3D 화면), 느리면 스모크 범위 줄이기
- 날짜 통일 · REST 전환 작업이 들어오면 `it.todo` 1번과 시간 표기 테스트 기대값을 새 규칙으로, `data/` 저장소 테스트는 API 목(mock) 응답을 넣는 방식으로 옮기기
- 번들 줄일 후보 1~3 (첫 화면 380 → 200KB 목표), 줄인 만큼 예산 낮추기
- 스모크에 상호작용 몇 개 더하기 (온보딩 끝까지 · 모임 신청 · 채팅 보내기): 지금은 "열리는지"만 봄
