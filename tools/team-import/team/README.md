# 디굴디굴 프론트엔드 (Next.js)

관심사로 만든 3D 땅굴을 서로 구경하고, 1:1 대화 · 모임으로 이어지는 커뮤니티의 웹 프론트엔드.
프로토타입 리포(`min9u/it-ting-prototype`)의 Vite 앱(`app/`)을 **Next.js App Router** 로 옮긴 프로젝트다. 옮긴 까닭 · 방법 · 남은 차이는 프로토타입 리포의 `docs/nextjs-migration.md`.

- Next.js 16.4 (Turbopack) · React 19.3 · TypeScript 6.0 (strict) · TanStack Query 5 · three.js 0.165 · CSS Modules · vitest 5
- Node 24 (`.nvmrc`), npm

## 실행

```bash
cd frontend
npm ci                 # 처음 한 번
npm run dev            # 개발 서버 http://localhost:3000 (실험실 켜짐, 목 서버)
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (포트 3000 = 백엔드 CORS 허용 출처). 실험실 기본 켬 |
| `npm run build` | 배포 빌드 (`.next/`). 실험실 기본 꺼짐 |
| `npm run start` | 빌드 결과 띄우기 (포트 3000) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next 기본 설정 + `eslint.config.mjs` 의 조정) |
| `npm test` | vitest 단위 테스트 (`src/tests/*.test.ts`) |
| `npm run smoke` | 화면 스모크: 빌드 결과를 `next start -p 3100` 으로 띄우고 헤드리스 크롬으로 화면 105개를 엶 |
| `npm run smoke -- --gpu=off` | 그래픽 가속 끈 크롬으로 (저사양 PC 흉내) |
| `npm run check:labs-off` | 실험실 끈 빌드를 만들고 실험실 주소 404 · 결과물에 실험실 코드 없음을 확인 |
| `node scripts/nav-check.mjs --url=http://127.0.0.1:3000` | 떠 있는 서버에서 화면 이동 어댑터 확인 (나가기 막기 · 뒤로가기 막기 · 이동 state · 온보딩 입력 유지). `next dev` 는 첫 컴파일이 느려서 `next start` 추천 |

스모크 옵션: `--only=meetups`(주소에 meetups 가 든 화면만) · `--url=http://127.0.0.1:3000`(떠 있는 서버 사용, 이때 `--labs=on|off`) · `--list` · `--no-fail`. 결과는 `shots/smoke/<gpu>/report.md` 와 화면별 PNG (커밋 안 함). 크롬 경로는 `CHROME=...` 로 바꿈.

배포 전에 돌릴 것 (모두 통과해야 함):

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run smoke && npm run check:labs-off
```

## 환경 변수

목록과 설명은 [`.env.example`](.env.example). 개인 값은 `.env.local` (커밋 안 함). 코드에서는 `process.env` 대신 **`src/lib/env.ts` 의 `ENV`** 로만 읽는다.

| 이름 | 기본 | 뜻 |
|---|---|---|
| `NEXT_PUBLIC_LABS` | dev 켬 · build 끔 | 실험실 포함 여부 (아래) |
| `NEXT_PUBLIC_API_BASE` | `/api/v1` | REST 기준 주소 |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` · `real` (모든 영역 기본값) |
| `NEXT_PUBLIC_API_REAL_AREAS` | 비움 | 이 영역만 실제 서버 (예 `common,auth,events`) |
| `NEXT_PUBLIC_API_MOCK_AREAS` | 비움 | `real` 이어도 목으로 둘 영역 |
| `API_PROXY_TARGET` | `http://localhost:8080` | `/api/v1/*` 를 넘길 백엔드 (서버 전용, `off` 면 안 넘김) |

- `NEXT_PUBLIC_*` 는 **빌드할 때** JS 에 박힌다. 바꾸면 `npm run build` 를 다시 하거나 개발 서버를 다시 켠다. 비밀값은 넣지 않는다
- `API_PROXY_TARGET` 도 `next build` 때 정해진다 (rewrites 가 빌드 결과에 들어감). `next start` 만 다시 해서는 안 바뀐다

## 목 서버 ↔ 실제 서버

- 기본은 목 서버(`mock`): 브라우저 안 목 저장소가 응답하므로 백엔드 없이 모든 화면이 돈다
- 영역(폴더 `src/api/<영역>/`)마다 `api.ts` 가 `areaMode('<영역>')` 로 `real.ts`(fetch) 와 `mock.ts` 중 하나를 고른다 (`src/api/config.ts`)
- 실제 서버로 부르면 주소는 같은 출처의 `/api/v1/...` → Next 가 `next.config.ts` rewrites 로 백엔드에 넘김 (브라우저엔 같은 출처라 CORS · 쿠키 문제 없음)
- 예: 백엔드가 만든 로그인 · 캠퍼스만 실제로
  ```bash
  NEXT_PUBLIC_API_REAL_AREAS=common,auth npm run dev
  ```
- 실시간 소식(SSE `GET /api/v1/me/event-stream`)은 영역 이름 `events`. rewrite 로 끊김 없이 흐르도록 `compress: false` (Next 의 gzip 이 SSE 를 모아 둠). 배포는 앞단 Nginx 가 압축 · `/api` 전달을 맡는 구성을 전제로 함
- 목 서버 손잡이: 주소에 `?api=slow|fail|empty|fast` 등 (실험실 켠 빌드에서는 왼쪽 아래 배지로 보임)
- 로그인 검사: 기본은 명세대로(비로그인 → 로그인, 온보딩 안 끝남 → 온보딩, 401 → 다시 로그인). 목 서버의 시연 계정은 `src/data/auth.ts` 맨 위. 시연 · 디자인 확인으로 다 열어 보려면 `NEXT_PUBLIC_LOGIN_FREE=1 npm run dev`

## 실험실 스위치

`NEXT_PUBLIC_LABS=1` 일 때만 빌드에 들어간다 (`next dev` 는 기본 켬, `next build` 는 기본 끔).

- 페이지: `/lab/style` · `/lab/rooms` · `/screens` · `/dev/crash` 는 `page.lab.tsx`. `next.config.ts` 가 켤 때만 `pageExtensions` 에 `lab.tsx` 를 넣어서, 끄면 라우트가 아예 없음(404)
- 화면 안 조각: 🧪 저사양 실험실 패널(`LowLab`) · 목 서버 손잡이 배지(`ApiKnobBadge`)는 `src/labs/index.ts` 에서 빌드 상수 + `next/dynamic` 으로 불러옴 → 끄면 코드가 결과물에 없음
- 테스트 서버에서만 켜기: `NEXT_PUBLIC_LABS=1 npm run build && npm run start`
- 확인: `npm run check:labs-off`

## 폴더

```
frontend/
├─ next.config.ts        실험실 스위치 · rewrites · redirects · 에셋 규칙(Turbopack type: 'asset')
├─ public/draco/         Draco 해독기(wasm). /draco/ 로 제공 (three/glb.ts)
├─ public/push-sw.js     브라우저 알림 서비스 워커
├─ scripts/              smoke.mjs · check-labs-off.mjs
└─ src/
   ├─ app/               라우트 (App Router). 화면 코드는 거의 없고 screens/ 를 불러옴
   │  ├─ layout.tsx      <html> · 글꼴 · 전역 CSS · providers
   │  ├─ providers.tsx   브라우저에서만 그림 · 기기 안내 · React Query · 가속 꺼짐 안내 · 🧪
   │  ├─ (pc)/           시작 화면들 (PcOnly). 괄호 폴더는 주소에 안 나타남
   │  ├─ (app)/          로그인 영역 (RequireLogin + 헤더). error.tsx = 헤더는 두고 안쪽만 안내
   │  ├─ onboarding/     온보딩 (단계가 바뀌어도 화면 유지: (steps)/layout.tsx)
   │  ├─ not-found.tsx   없는 주소 (404 + 헤더)
   │  └─ error.tsx · global-error.tsx   에러 경계
   ├─ screens/           화면 (Vite 앱과 같음)
   ├─ components/        공통 컴포넌트 (AppShell = 로그인 영역 틀)
   ├─ api/               API 영역별 real/mock, 공통 클라이언트 · React Query
   ├─ realtime/          SSE
   ├─ data/ · lib/       데이터 · 유틸. lib/env.ts(환경 변수) · lib/nav.tsx(화면 이동 어댑터)
   ├─ three/             three.js 장면
   ├─ labs/              화면 안 실험실 조각 고르기
   ├─ assets/            glb · 이미지 · 벽지 (import 하면 주소 문자열)
   ├─ styles/            토큰 · 전역 CSS
   └─ tests/             vitest
```

## 화면 이동 (react-router 대신)

화면 코드는 `@/lib/nav` 에서 `useNavigate` · `useParams` · `useSearchParams` · `useLocation` · `Link` · `NavLink` · `Navigate` · `Outlet` · `useBlocker` 를 가져온다. react-router 와 같은 모양으로 `next/navigation` · `next/link` 위에 만든 얇은 어댑터. 새 화면도 이것을 쓰면 된다.

## Vite 앱과 다른 점

- 첫 HTML 은 비어 있고 브라우저에서 그림 (Vite SPA 와 같은 동작. 서버 렌더링 이득은 아직 안 씀)
- 이동 state(`navigate(to, { state })`)는 주소별로 sessionStorage 에 기억 (Next 는 history state 를 못 씀)
- 없는 주소 · 꺼진 실험실 주소는 응답 코드 404 (Vite 는 200 + 화면)
- `/onboarding` 은 서버 307 리다이렉트
- 페이지 이동 시 Next 기본대로 맨 위로 스크롤 (쿼리만 바꾸는 `setSearchParams` 는 그대로)
- 공유 빌드(아티팩트, # 라우팅)는 없음 → 프로토타입 리포의 Vite 앱 `app/` 에서 계속 (`npm run build:share`)
- 자세한 목록은 프로토타입 리포의 `docs/nextjs-migration.md` "남은 차이"
