# Next.js 전환 (2026-11-23)

- 요청: Vite 앱(`app/`)을 **Next.js App Router** 프로젝트로 옮겨 이 리포의 새 폴더 **`frontend/`** 에 만든다. 나중에 팀 리포(it-ting-team/it-ting)의 `frontend/` 로 그대로 복사할 것. `app/` 은 그대로 두고(공유 빌드용) `frontend/` 는 따로 package.json 을 가진 별도 프로젝트
- 앞선 결정: [팀 리포로 옮기기 계획](team-repo-migration.md) (Next.js · App Router · 실험실은 로컬에서만 · 환경 변수는 `lib/env.ts` 한 곳 · Vite 프록시 → rewrites · 포트 3000 · 공유 빌드는 `app/` 에 남김)
- 결론: **라우트 48개를 같은 주소로 옮기고 단위 테스트 630개 · 화면 스모크 105개가 모두 통과.** 화면 코드는 거의 그대로(`react-router-dom` → `@/lib/nav` 한 줄), 에셋도 import 그대로(Turbopack `type: 'asset'`)
- 실행 방법 · 환경 변수 · 폴더는 [`frontend/README.md`](../frontend/README.md)

## 버전

| | Vite 앱 (`app/`) | Next 앱 (`frontend/`) |
|---|---|---|
| 프레임워크 | Vite 8 + react-router 7 | **Next.js 16.4.6** (Turbopack, App Router) |
| React | 19.3.1 | 19.3.1 |
| TypeScript | 7.0 (tsgo) | **6.0.3** (아래 "문제 1") |
| 린트 | 없음 | ESLint 9 + `eslint-config-next` 16.4.6 |
| 테스트 | vitest 5.1 | vitest 5.1 (같은 설정 + `@/` 별칭) |
| Node | 24 (`.nvmrc`) | 24 (`.nvmrc` 복사) |

## 결정

1. **화면은 모두 브라우저에서만 그린다** (`src/app/providers.tsx` 의 `ClientOnly`). 화면들이 처음 그릴 때부터 localStorage · sessionStorage · window(목 서버 · 저사양 감지 · 3D)를 읽어서, 서버에서 그리면 브라우저 결과와 달라짐(hydration 오류). 서버 HTML 은 빈 `#root` → Vite SPA 와 같은 첫 화면. 서버 렌더링 이득(첫 그림 빨리)은 다음 단계 과제
2. **page.tsx 는 얇게**: `'use client'` + 화면 컴포넌트 하나. 화면 코드는 `src/screens/` 에 그대로
3. **react-router 대신 작은 어댑터** `src/lib/nav.tsx`: 같은 이름 · 모양(`useNavigate` · `useParams` · `useSearchParams` · `useLocation` · `Link` · `NavLink` · `Navigate` · `Outlet` · `useBlocker`)을 `next/navigation` · `next/link` 위에. 화면 파일 변경은 import 한 줄. react-router 는 Next 프로젝트에 없음
4. **에셋은 src/assets 에 두고 import** (Vite 와 같은 코드): `next.config.ts` 의 Turbopack 규칙 `'*.glb' · '*.png' · '*.webp' · '*.jpg' · '*.svg': { type: 'asset' }` + `images.disableStaticImages` → import 하면 해시 붙은 파일 주소 문자열. `import.meta.glob`(벽지 · 액세서리 아이콘 · 방 모델)도 Turbopack 이 지원해서 그대로. `public/` 으로 옮기는 방법은 캐시 무효화(해시)가 없어서 안 씀
5. **Draco 해독기**: `public/draco/` (wasm, 주소 `/draco/`). 공유 빌드 전용 JS 해독기(`dracoMain` · `dracoWorker` · `dracoCore` · `three/draco/`)는 Next 에 공유 빌드가 없어서 옮기지 않음
6. **글꼴**: Pretendard 는 npm `pretendard` CSS 를 루트 레이아웃에서 import(Vite 와 같음, woff2 92개가 `_next/static/media` 로). Do Hyeon 은 Vite `index.html` 과 같은 Google Fonts `<link>`. `next/font` 로 바꾸면 글꼴 이름이 바뀌어 토큰(`--font-display: 'Do Hyeon'`)을 고쳐야 해서 이번엔 안 함
7. **실험실은 `NEXT_PUBLIC_LABS=1` 일 때만** (team-repo-migration.md 결정 그대로)
   - `next.config.ts` 가 phase 로 기본값을 정함: `next dev` 켬, `next build` 끔. 정한 값을 `env.NEXT_PUBLIC_LABS` 로 다시 넣어 클라이언트에 박음
   - 페이지 `/lab/style` · `/lab/rooms` · `/screens` · `/dev/crash` = `page.lab.tsx`, 켤 때만 `pageExtensions` 에 `'lab.tsx'`
   - 화면 안 조각(🧪 `LowLab`, 목 서버 손잡이 배지 `ApiKnobBadge`)은 `src/labs/index.ts` 에서 `process.env.NEXT_PUBLIC_LABS === '1' ? dynamic(() => import(...)) : Off`. 조건이 빌드 때 `'0' === '1'` 로 정해져 Turbopack 이 import 를 아예 안 따라감 (다른 모듈의 상수로 받으면 못 정해서 이 파일만 `process.env` 를 직접 읽는 예외). `ApiKnobBadge` 는 `AsyncState.tsx` 에서 자기 파일로 뺌
   - 확인 스크립트 `npm run check:labs-off`: 끈 빌드 → 라우트 목록에 없음 · 4개 주소 404 · `.next` 전체(1,427 파일)에서 실험실 파일마다 고른 글이 없음(글자 그대로 + `\uXXXX`), 대조군 글은 있음
8. **환경 변수**: `VITE_*` → `NEXT_PUBLIC_*`, 읽는 곳은 `src/lib/env.ts` 한 곳. Next 는 `process.env.NEXT_PUBLIC_X` 를 그대로 적은 곳만 바꿔 넣어서 이름마다 한 번씩 적음. `ENV.hashRouter` · `ENV.share` 는 없앰, `ENV.labs` · `ENV.buildStamp` 추가
9. **백엔드 연결**: Vite 프록시 → `rewrites` `/api/v1/:path*` → `API_PROXY_TARGET`(기본 `http://localhost:8080`, `off` 면 없음). 개발 포트 3000(백엔드 CORS 허용 출처)
10. **스모크**는 `next build && next start -p 3100` 대상으로. 화면 목록은 `src/app` 파일 트리 + ScreenIndex → Vite 판과 **같은 105개**(목록 diff 로 확인)

## 라우트 대응표

`(이름)` 폴더는 주소에 안 나타나는 묶음(route group). 모든 page 는 `'use client'` + 화면 컴포넌트.

| Vite 라우트 (App.tsx) | Next 파일 (`frontend/src/app/`) | 화면 |
|---|---|---|
| `/` · `/start` | `(pc)/page.tsx` · `(pc)/start/page.tsx` | Landing |
| `/look` | `(pc)/look/page.tsx` | LookAround |
| `/login` | `(pc)/login/page.tsx` | Login |
| `/signup` · `/signup/password` · `/signup/ssafy` | `(pc)/signup/…/page.tsx` | SignupEmail · SignupPassword · SignupSsafy |
| `/password-reset` (+ `/sent` `/new` `/expired`) | `(pc)/password-reset/…/page.tsx` | PasswordReset… |
| `/auth/google` · `/oauth/mock-google` | `(pc)/auth/google` · `(pc)/oauth/mock-google` | GoogleReturn · MockGoogle |
| (PcOnly 감싸기) | `(pc)/layout.tsx` | PcOnly |
| `/onboarding` → `/onboarding/name` | `next.config.ts` `redirects` (307) | |
| `/onboarding/:step` | `onboarding/(steps)/[step]/page.tsx`(빈 page) + `onboarding/(steps)/layout.tsx` | RequireLogin onboarding + Onboarding |
| `/screens` 🧪 | `screens/page.lab.tsx` | ScreenIndex |
| `/admin` | `admin/page.tsx` | Admin |
| `/lab/style` 🧪 | `lab/style/page.lab.tsx` | StyleLab |
| (로그인 영역 틀) | `(app)/layout.tsx` → `components/AppShell.tsx` | RequireLogin + AppHeader · ApiToaster · 🧪배지 · MockServerSync · NewTermGate, SSE 시작 |
| `/burrow` · `/burrow/explore` | `(app)/burrow/page.tsx` · `(app)/burrow/explore/page.tsx` | MyBurrow · ExploreDesigns |
| `/burrow/:userId` | `(app)/burrow/(visit)/[userId]/page.tsx`(빈 page) + `(visit)/layout.tsx` | VisitBurrow |
| `/lab/rooms` 🧪 | `(app)/lab/rooms/page.lab.tsx` | RoomsLab |
| `/board` · `/board/write` | `(app)/board/page.tsx` · `write/page.tsx` | BoardList · BoardWrite |
| `/board/saved` · `/mine` · `/commented` | `(app)/board/(activity)/…/page.tsx`(빈 page) + `(activity)/layout.tsx` | BoardActivity kind |
| `/board/:postId` · `/board/:postId/edit` | `(app)/board/[postId]/page.tsx` · `[postId]/edit/page.tsx` | BoardPost · BoardEdit |
| `/meetups/new` | `(app)/meetups/new/page.tsx` | MeetupNew |
| `/meetups` · `/meetups/me` (MeetupsShell 안) | `(app)/meetups/(shell)/layout.tsx` + `page.tsx` · `me/page.tsx` | MeetupsShell(Outlet) · MeetupList · MyMeetups |
| `/meetups/:id` · `/meetups/:id/edit` | `(app)/meetups/[id]/page.tsx` · `[id]/edit/page.tsx` | MeetupDetail · MeetupNew |
| `/chat` · `/chat/requests` · `/chat/:roomId` | `(app)/chat/layout.tsx` + 빈 page 3개 | Chat (`requests` = 주소가 `/chat/requests`) |
| `/settings` (+ password · google · notifications · notices · notices/:id · leave · credits) | `(app)/settings/layout.tsx` + 항목별 `page.tsx` | Settings(Outlet) · SettingsHome · … |
| `/notifications` | `(app)/notifications/page.tsx` | Notifications |
| `/gone/:what` | `(app)/gone/[what]/page.tsx` | GoneRoute |
| `/dev/crash` (Vite: 개발 서버만) 🧪 | `(app)/dev/crash/page.lab.tsx` | 일부러 던짐 |
| `*` | `not-found.tsx` (AppShell 안 NotFound, 응답 404) | NotFound |

에러 경계 (Vite 의 errorElement 세 겹과 같은 자리):

| Vite | Next |
|---|---|
| 맨 바깥 `RouteError` | `app/error.tsx` (+ 루트 레이아웃까지 깨지면 `global-error.tsx`) |
| 로그인 영역 틀(헤더) 깨짐 | `app/error.tsx` (Next 의 error.tsx 는 같은 폴더 layout 바깥을 못 감싸서 한 단계 위) |
| 화면 하나 `RouteError inline` | `(app)/error.tsx` (헤더 남음) |
| 모임 · 설정 안쪽 inline | `(app)/meetups/(shell)/error.tsx` · `(app)/settings/error.tsx` (탭 · 왼쪽 메뉴 남음) |
| 3D `SceneBoundary` | 그대로 (컴포넌트 안 에러 경계) |

## 에셋

- 코드는 Vite 와 같음: `import url from '../assets/models/x.glb?url'`, `import.meta.glob('../assets/wallpapers/*.webp', { eager: true, query: '?url', import: 'default' })`
- `next.config.ts` `turbopack.rules` 의 `type: 'asset'` (Next 16 Turbopack 기능, `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`) + `images.disableStaticImages` → 결과는 `/_next/static/media/<이름>.<해시>.<확장자>` 주소 문자열. 타입은 `src/types/assets.d.ts`
- `?no-inline`(Vite 공유 빌드용 SVG 쿼리 4곳)은 뺌: Turbopack 은 data URL 로 넣지 않음
- Draco wasm `public/draco/*` → `/draco/` (`three/glb.ts` 가 `${ENV.base}draco/`)
- Worker(`new Worker(new URL('./roomWorker.ts', import.meta.url), { type: 'module' })`)는 Turbopack 이 그대로 처리
- 결과 `.next/static` 약 21MB (모델 · 텍스처 약 14MB + JS + 글꼴)
- 단위 테스트(vitest)는 Vite 가 같은 import 를 주소 문자열로 줘서 그대로 통과

## 문제와 해결

1. **TypeScript 7 은 JS API 가 없음** → Next 빌드(타입 검사 · tsconfig 확인)와 typescript-eslint(`<6.1`)가 못 씀. `frontend/` 는 **TypeScript 6.0.3**. tsconfig 설정(strict · noUnused*)은 그대로
2. **화면을 브라우저에서만 그리니 page 의 `notFound()` · `redirect()` 가 응답 코드를 못 바꿈** (서버 렌더가 그 자리까지 안 감 → 200). 처음엔 `(app)/[...rest]` 에서 `notFound()` 를 불렀는데 200 이 나옴 → 잡는 라우트를 없애고 Next 기본 404(`not-found.tsx`, 응답 404)에 로그인 영역 틀(AppShell)을 씌움. `/onboarding` 은 `next.config.ts` `redirects`(307)
3. **Next 는 주소 파라미터가 바뀌면 page 를 새로 만듦** (react-router 는 같은 컴포넌트를 둠). 온보딩 `/onboarding/:step` 은 단계마다 이름 · 관심사가 사라짐 → 화면을 파라미터 바깥 묶음 레이아웃(`onboarding/(steps)/layout.tsx`)이 그리고 page 는 비움. 같은 방법으로 채팅(대화방을 바꿔도 목록 · 3D 찻방 유지), 남의 땅굴(`/burrow/:userId`), 게시판 내 활동 탭(saved · mine · commented)
4. **이동 state**: Next 는 history.state 를 자기 것으로 덮어써서 react-router 의 `location.state` 를 못 실음 → 주소(경로 + 정리한 쿼리)별로 메모리 + sessionStorage 에 기억, state 없이 같은 주소로 가면 지움. 쓰는 곳: 완료 토스트, 로그인 ↔ 회원가입 · 비밀번호 찾기 이메일, 로그인 뒤 돌아갈 주소, 탐색 → 땅굴 `from`
5. **useBlocker**: Next 에 없음. 어댑터의 `Link` · `navigate` 가 블로커를 먼저 물어보고, 브라우저 뒤로/앞으로는 `popstate` 를 Next 보다 먼저(capture) 받아 막고 `history.go` 로 되돌림(몇 칸인지는 Navigation API 기록 번호). `scripts/nav-check.mjs` 로 앱 안 링크 · 뒤로가기 · state · 온보딩 유지를 크롬에서 확인
6. **SSE 가 rewrite 뒤에서 안 옴**: Next 의 gzip(`compress`)이 `text/event-stream` 을 모아 둠. 가짜 SSE 서버로 재 보니 `next start` 에서 gzip 요청이 5초 동안 10바이트(이벤트 0개), 압축 끄면 1초마다 옴 → `compress: false` (배포는 앞단 Nginx 가 압축 · `/api` 전달). rewrite 프록시 기본 대기 30초도 `experimental.proxyTimeout` 1시간으로 (끊겨도 realtime/events.ts 가 다시 연결)
7. **rewrite 대상은 빌드 때 정해짐**: `API_PROXY_TARGET` 을 바꾸고 `next start` 만 다시 하면 안 바뀜(빌드 때 값 8080 으로 감). `next dev` 는 켤 때 읽음. README 에 적음
8. **`import.meta.url`(three/stills.ts 의 빌드 표시)**: Vite 는 청크 파일 이름이었지만 Next 에서는 아님 → `next.config.ts` 가 빌드마다 `NEXT_PUBLIC_BUILD_STAMP` 를 넣음
9. **react-router 를 직접 쓰던 곳**: `LowLab` · `GpuNotice` 의 `router.subscribe` → `usePathname`, `RouteError` 의 `useRouteError` → error.tsx 의 `error` prop, `main.tsx` 의 `registerNavigator(router.navigate)` → `NavBridge`, `installChunkReload`(vite:preloadError) 는 Next 에 없는 이벤트라 뺌(청크 실패는 에러 경계의 `isChunkLoadError` 가 처리)
10. **테스트 2개가 `MemoryRouter` 를 씀** → `src/tests/memoryRouter.ts`: Next 앱 라우터가 넣는 컨텍스트(AppRouter · Pathname · SearchParams · PathParams)를 직접 넣어 jsdom 에서 그림
11. **린트**: Next 기본 설정이 처음 72개 오류. 진짜 고친 것: 훅 이름처럼 보이는 일반 함수(`useA` · `useBackdrop` · `useWorker` → `want*`, rules-of-hooks 오탐), JSX 따옴표, prefer-const, 안 쓰는 disable 주석. 설정으로 조정: React Compiler 용 규칙 3개(`refs` · `set-state-in-effect` · `purity`)는 경고(이 프로젝트는 Compiler 를 안 쓰고 3D 연결에 일부러 씀), `no-img-element` 끔(이미지가 주소 문자열), 생성 파일 `mole.ts` · `furniture.ts` 제외. 결과 오류 0 · 경고 56
12. `next dev` 가 `frontend/AGENTS.md` 를 만들어 넣음 → `agentRules: false` (규칙은 팀 리포 맨 위 AGENTS.md)
13. **CSS 순서가 달라 버튼 높이 등이 바뀜** (화면 비교에서 발견): Vite 앱은 `main.tsx` 가 `App`(화면들의 모듈 CSS)을 먼저 불러오고 `global.css` 를 나중에 불러와서, 명시도가 같으면 전역 클래스가 이겼음(예: 모임 옆 "캘린더로 보기"는 `.btn-sm` 36px 이 모듈 `.calBtn` 46px 을 이김, 방명록 "남기기", 모임 상세 버튼들). Next 는 루트 레이아웃의 전역 CSS 가 먼저라 모듈이 이김 → 모임 화면 전부 · 방명록 모달이 0.9~3% 달랐음. 처음엔 `.btn.btn` 처럼 클래스를 겹쳤더니 반대로 `.actions button`(모듈, 0,1,1)이 지던 곳(확인 창 버튼)이 틀어짐 → 전역 클래스 선택자에 `:not(template)` 을 붙여 **명시도를 요소 하나(0,0,1)만큼** 올림. 정수 명시도에서 "전역+0,0,1 > 모듈" ⇔ "전역 ≥ 모듈" 이라 Vite 의 "같으면 전역" 과 정확히 같은 결과. `styles/global.css` 주석에 적음

## 결과 (2026-11-23, 이 맥 · 크롬 157)

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 |
| `npm run lint` | 오류 0 · 경고 56 (거의 React Compiler 규칙 경고) |
| `npm test` | 45 파일 · 630 통과 (+ todo 2), Vite 앱과 같은 수 |
| `npm run build` | 통과 (라우트 45개, 실험실 끔) |
| 스모크 실험실 끈 빌드 · gpu=on | 105개 OK 105 |
| 스모크 실험실 켠 빌드 · gpu=on | 105개 OK 105 (`/dev/crash` 는 예상한 오류 화면) |
| 스모크 실험실 켠 빌드 · gpu=off | 105개 OK 105 |
| 스모크 실험실 끈 빌드 · gpu=off (CSS 고친 뒤 마지막) | OK 104 · 경고 1: 첫 화면 `/start` 의 "로딩 중"이 기다림(9초) 끝에 남음 → 그 화면만 다시 돌리면 OK(9.1초). 가속 끈 크롬의 첫 3D 준비 시간 경계 |
| `npm run check:labs-off` | 통과 (4개 주소 404, 결과물에 실험실 글 없음). `.next/dev`(next dev 결과, next build 가 안 지움)는 검색에서 뺌 |
| `node scripts/nav-check.mjs --url=…` (next start) | 6/6: 글쓰기 중 헤더 링크 막기 · 나가기 · 브라우저 뒤로가기 막기 · 나가기 · 로그인→회원가입 이메일 state · 온보딩 단계 오가도 입력 유지 |
| SSE rewrite (가짜 SSE 서버) | next dev · next start 모두 1초마다 이벤트 |

## 화면 비교 (Vite ↔ Next)

두 앱의 빌드를 같은 스모크(크롬 157, 1440×960, 화면마다 저장소 비움)로 105개 화면을 찍고 같은 주소끼리 픽셀을 비교 (색 차 합 30 넘는 픽셀 비율 + 다른 영역 상자).

- 처음: 모임 화면 전부(옆 "캘린더로 보기" · "모임 만들기", 상세 신청 버튼) 0.8~1%, 방명록 모달 3.4%, 오늘의 추천 1.3% → 원인은 CSS 순서 (위 "문제 13"). 고친 뒤 이 화면들은 0%
- 고친 뒤 남은 차이는 모두 같은 화면의 "움직이는 것"뿐:
  - `/look` 19.6%: 들판 풀 · 꽃 배치가 Math.random 이라 열 때마다 다름 (three/fieldScene.ts). 표지판 · 두더지 · 글은 같음
  - 땅굴 · 채팅 찻방 · 온보딩 두더지 미리보기 0.1~0.7%: 3D 두더지 동작 프레임, 채팅 "오후 3:12" 같은 상대 시각(찍은 시각이 다름)
  - `/dev/crash` 3.6%: Vite 빌드에는 없는 주소(없는 주소 화면), Next 실험실 켠 빌드에는 있는 화면(에러 경계 화면) — 의도한 차이
- 눈으로 본 화면(랜딩 · 내 땅굴 · 탐색 · 방문 · 채팅 · 모임 목록/상세 · 게시판 · 알림 · 설정 · 온보딩): 글꼴(Pretendard · Do Hyeon) · 색 · 배치 같음. 로그인 · 회원가입 · 게시판 · 설정 · 온보딩 관심사/소개 등 정적인 화면 40여 개는 0.00%

## 남은 차이

- 첫 HTML 이 비어 있음 (Vite 와 같음). 서버 렌더링 · 스트리밍 이득은 아직 안 씀
- 이동 state 는 history 기록이 아니라 주소별 기억: 같은 주소를 서로 다른 state 로 두 번 열고 뒤로 가면 마지막 state 가 보임
- 브라우저 뒤로가기 막기는 Navigation API 가 있는 브라우저만 (크롬 · 엣지 102+, 사파리 26.2+, 파이어폭스 147+). 없으면 앱 안 링크만 막음
- 페이지 이동은 Next 기본대로 새 화면 맨 위로 스크롤 (react-router 는 스크롤을 안 건드렸음). `setSearchParams` 는 그대로 둠
- 주소 파라미터만 바뀌는 이동 중 react-router 처럼 화면을 두는 것은 온보딩 · 채팅 · 남의 땅굴 · 내 활동 탭만. 글 상세(`/board/:postId`) · 모임 상세 · 공지 상세는 다른 글로 가면 새로 만듦 (그 화면들은 원래 id 가 바뀌면 다시 불러옴)
- 없는 주소 · 꺼진 실험실 주소는 응답 404 (Vite 는 200)
- `/dev/crash` 는 실험실 켠 빌드에도 있음 (Vite 는 개발 서버에서만)
- 압축은 Next 가 안 함 (`compress: false`) → 앞단(Nginx)에서
- 공유 빌드(아티팩트, # 라우팅, glb data URL, Draco JS 해독기)는 `app/` 에만
- Node 25+ 에서 빌드하면 `localStorage is not available` 경고가 나옴(Node 의 실험 기능, 서버에서 모듈을 불러올 때). Node 24(.nvmrc)에서는 안 남

## 다음 단계

1. 팀 리포로 옮길 때: `frontend/` 를 통째 복사, `npm ci && npm run build && npm run smoke && npm run check:labs-off` 로 확인 → [team-repo-migration.md](team-repo-migration.md) 커밋 목록대로 쪼개기(4번)
2. CI: GitHub Actions 에 `frontend/` 경로로 typecheck · lint · test · build · check:labs-off (스모크는 크롬 SwiftShader `--gpu=swiftshader`)
3. 실제 백엔드로 확인: `NEXT_PUBLIC_API_REAL_AREAS=common,auth,events npm run dev` 로 로그인 · SSE
4. 고를 것: 배포 형태(`next start` + Nginx 또는 `output: 'standalone'`), 서버 렌더링을 쓸 화면이 있는지(시작 화면 정도), Do Hyeon 을 `next/font` 로
