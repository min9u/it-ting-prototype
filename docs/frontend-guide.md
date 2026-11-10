# 디굴디굴 프론트엔드 기술 가이드

- 날짜: 2026-11-10
- 요청: 지금까지 만든 내용을 이해할 수 있게 기술 문서로. 이 프로젝트를 하며 중요한 프론트엔드 지식을 익히고 싶음
- 읽는 법: 1장에서 전체 그림을 잡고, 2~7장은 주제별로 "개념 → 이 프로젝트에서는 → 직접 해 볼 것" 순서. 코드 위치는 `app/src/` 기준

---

## 1. 전체 그림

```
브라우저
 └─ index.html  ─ <div id="root"> 하나뿐
     └─ main.tsx      React를 root에 붙이고, 라우터를 켬
         └─ App.tsx   주소 → 화면 연결표 (라우팅)
             ├─ screens/   화면 (땅굴, 게시판, 모임, 채팅, 시작, 온보딩)
             │    └─ components/  여러 화면이 같이 쓰는 조각 (헤더, 칩, 모달, 페이지 번호 …)
             ├─ data/      예시 데이터와 타입 (서버 대신)
             ├─ styles/    디자인 토큰(색·글자), 전역 스타일
             └─ three/     3D 장면 (필요할 때만 따로 불러옴)
```

이 앱은 **SPA(Single Page Application)** 입니다. 서버에서 HTML을 한 번만 받고, 이후 화면 전환은 브라우저 안의 JavaScript가 DOM을 바꿔서 처리합니다. 그래서 메뉴를 눌러도 페이지가 새로고침되지 않습니다.

| 도구 | 역할 | 한 줄 설명 |
|---|---|---|
| **Vite** | 개발 서버 + 빌드 | 개발 중엔 파일을 바로 브라우저에 보내 빠르고, 빌드할 땐 묶고 줄여서 `dist/`에 내보냄 |
| **React 19** | 화면 그리기 | "상태(state)가 이러면 화면은 이렇게"를 컴포넌트로 선언 |
| **TypeScript** | 타입 검사 | 데이터 모양을 미리 정해 실수를 빌드 전에 잡음 |
| **react-router 7** | 라우팅 | 주소(`/burrow`, `/board`)마다 다른 화면 |
| **CSS Modules** | 스타일 | 파일마다 클래스 이름이 따로라서 충돌이 없음 |
| **three.js** | 3D | WebGL을 쉽게 쓰게 해 주는 라이브러리 |

---

## 2. React 컴포넌트와 상태

### 개념
- **컴포넌트** = 화면 조각을 돌려주는 함수. 입력은 **props**(부모가 주는 값), 내부 기억은 **state**
- state가 바뀌면 React가 그 컴포넌트를 다시 실행해서 화면을 갱신함 (직접 DOM을 고치지 않음)
- **단방향 데이터 흐름**: 데이터는 부모 → 자식(props)으로 내려가고, 자식은 함수(콜백)를 불러 부모에게 알림

### 이 프로젝트에서는
`screens/burrow/MyBurrow.tsx`

```tsx
const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
const [entries, setEntries] = useState(() => liveGuestbook(GUESTBOOK))
const recent = useMemo(() => entries.slice(0, 3), [entries])
const focusX = panelOpen ? 0.403 : 0.5          // 파생 값: state에서 계산
...
<RoomView ownerId={me.id} interests={me.interests} focusX={focusX} />
```

- `panelOpen`(오른쪽 패널이 열렸나)은 **state**. "접기"를 누르면 `setPanelOpen(false)`
- `focusX`는 state로 따로 두지 않고 **계산**함. 같은 정보를 두 군데 두면 어긋나기 쉬움 → "state는 최소로, 나머지는 계산"
- `useMemo`는 계산 결과를 기억했다가 `entries`가 바뀔 때만 다시 계산
- `RoomView`는 `focusX`를 props로 받기만 함. 패널이 열리면 부모가 0.403을 내려보내고, 방이 왼쪽으로 밀림

### 공용 컴포넌트 읽어 보기
| 파일 | 배울 점 |
|---|---|
| `components/Pagination.tsx` | 규칙(5개씩, 6쪽 이상이면 맨 처음/끝 버튼)을 **계산으로** 표현. state 없이 props만 받는 "순수" 컴포넌트 |
| `components/Modal.tsx` | `createPortal`로 `body` 바로 밑에 그림(부모의 `overflow`에 안 잘림). Esc·배경 클릭으로 닫기, `role="dialog"` |
| `components/InterestChip.tsx` | 같은 모양에 색 톤만 바꾸는 **변형(variant)** props |
| `lib/format.ts`의 `liveGuestbook` | "7일 지난 방명록은 숨김" 같은 **기획 규칙을 화면 밖 함수로** 빼서 테스트하기 쉽게 |

### 직접 해 볼 것
- `Pagination`에 `total={12}`를 주고 6페이지로 가 보기 → 번호가 6–10으로 바뀌는 계산을 코드에서 찾기
- 방명록을 하나 더 쓰는 기능을 만든다면 state는 어디에 둬야 할까? (`MyBurrow`의 `entries` — 목록과 모달이 같이 쓰니까 둘의 공통 부모)

---

## 3. 라우팅 (주소 ↔ 화면)

### 개념
- 클라이언트 라우팅: 주소가 바뀌어도 서버에 새 HTML을 요청하지 않고 JavaScript가 화면만 바꿈
- `<Link to="/board">`는 새로고침 없이 이동. 일반 `<a href>`를 쓰면 새로고침되거나 라우터가 모름
- **중첩 라우트 + 레이아웃**: 공통 틀(헤더)을 한 번만 쓰고 안쪽만 바꿈

### 이 프로젝트에서는
`App.tsx`

```tsx
function AppLayout() { return (<><AppHeader /><Outlet /></>) }   // 헤더 + 안쪽 자리
...
{ element: <AppLayout />, children: [
    { path: '/burrow', element: <MyBurrow /> },
    { path: '/burrow/:userId', element: <VisitBurrow /> },        // :userId = 주소 변수
    ...
]}
{ path: '*', element: <Navigate to="/" replace /> }                // 없는 주소
```

- 땅굴·게시판·모임·채팅은 모두 `AppLayout` 안 → 헤더가 공통
- `:userId`는 `useParams()`로 꺼냄 (`/burrow/yerin` → `yerin`)
- 화면 상태를 **주소에 담기**: `?panel=closed`, `?modal=guestbook`을 `useSearchParams()`로 읽음. 주소만 공유하면 같은 상태를 볼 수 있어 시안 검토에 편함

### 브라우저 라우터 vs 해시 라우터 (배포에서 겪은 일)
| | 주소 모양 | 필요한 것 |
|---|---|---|
| `createBrowserRouter` | `/burrow` | 서버가 **어떤 주소로 와도 index.html을 돌려줘야** 함 (안 그러면 새로고침 때 404) |
| `createHashRouter` | `#/burrow` | `#` 뒤는 서버에 안 가서 아무 정적 호스팅에서나 동작 |

아티팩트는 주소 경로를 바꿀 수 없어서 공유 빌드만 해시 라우터를 씁니다. `import.meta.env.VITE_HASH_ROUTER`(→ `.env.share`)로 빌드할 때 고릅니다. 같은 코드로 빌드 설정만 달리하는 방법은 실무에서 자주 씀 (개발/스테이징/운영).

---

## 4. 스타일: 디자인 토큰과 CSS Modules

### 개념
- **디자인 토큰** = 색·글자 크기·간격에 이름을 붙인 값. 디자인 시스템과 코드가 같은 말을 쓰게 함
- **CSS 변수**(`--brown-700`)로 토큰을 두면, 한 곳만 고쳐도 전체가 바뀜
- **CSS Modules**: `Board.module.css`의 `.title`은 빌드 때 `Board_title_x8f2` 같은 고유 이름이 됨 → 다른 파일의 `.title`과 안 겹침

### 이 프로젝트에서는
- `styles/tokens.css`: Figma 스크린샷에서 픽셀로 뽑은 색. 칩 8톤(`--tone-sage-bg` …)은 Figma 컴포넌트 이름(`Tone=Sage`)과 같은 이름
- 컴포넌트 CSS는 색을 직접 쓰지 않고 `var(--ink-700)`처럼 토큰만 씀
- 서체: 제목 Do Hyeon(Google Fonts), 본문 Pretendard(npm에서 받아 번들에 포함)

### 직접 해 볼 것
- `tokens.css`의 `--brown-700`을 바꾸고 헤더의 활성 메뉴 색이 바뀌는지 보기
- 개발자 도구(F12) → Elements에서 클래스 이름이 `_title_xxxx` 식으로 바뀐 것 확인

---

## 5. TypeScript로 데이터 모양 정하기

### 개념
- `interface User { nickname: string; interests: string[] }` → 이 모양이 아닌 데이터를 넣으면 빌드 전에 에러
- 서버가 생기면 API 응답 타입을 여기 맞추면 됨. 화면 코드는 그대로

### 이 프로젝트에서는
- `data/types.ts`: `User`, `Category`, `Tag`(`count`가 적을수록 니치), `GuestbookEntry`, 모임·게시글 타입
- `data/mock.ts`: 그 타입을 따르는 예시 데이터. **서버 대신**이라 나중에 API로 바꿀 자리
- `npm run build`가 먼저 `tsc -b`(타입 검사)를 돌려서, 타입이 틀리면 빌드가 실패함

---

## 6. 3D를 React 앱에 넣기 (이 프로젝트의 핵심)

### 6-1. three.js 기본 구성
```
Renderer(그리는 기계, <canvas>) ← Scene(물체·조명) + Camera(어디서 보나)
매 프레임: 움직임 계산 → renderer.render(scene, camera)
```
| 요소 | 이 프로젝트 |
|---|---|
| Mesh = 모양(Geometry) + 재질(Material) | 가구는 둥근 상자·원기둥·구를 조합 (`three/clay.ts`의 `box`, `cyl`, `sph`) |
| 재질 | 무광 점토 `MeshStandardMaterial`, 두더지는 천 반사가 있는 `MeshPhysicalMaterial`(sheen) |
| 조명 | 그라데이션 이미지를 환경광으로(`lighting.ts`), 해(방향광) + 부드러운 그림자 |
| 후처리 | 다 그린 화면에 한 번 더 효과: 구석 그림자(AO), 색보정·그레인 (`post.ts`) |
| 텍스처 | 이미지 파일 대신 `<canvas>`에 그려서 만듦 (털 결, 마루 무늬, 흙 구멍) |

### 6-2. React와 three.js의 경계 — `three/SceneCanvas.tsx`
React는 "선언형"(상태 → 화면), three.js는 "명령형"(만들고, 바꾸고, 지움)입니다. 둘을 섞는 요령은 **경계를 하나로 정하는 것**입니다.

```tsx
useEffect(() => {
  const h = mount(el, focusX)   // 마운트: 렌더러·장면 만들기
  return () => h.dispose()      // 언마운트: 전부 정리
}, [deps])                       // 방 주인이 바뀌면 새로 만들기

useEffect(() => { handle.current?.setFocusX(focusX) }, [focusX])   // 값만 바뀌면 장면에 전달
```

- 장면 쪽은 `{ dispose, resize, setFocusX }`(`SceneHandle`)만 노출. React는 이 손잡이만 씀
- **정리(cleanup)가 중요한 이유**: WebGL 컨텍스트는 브라우저당 개수가 제한(보통 16개)되어 있어서, 화면을 오갈 때마다 정리하지 않으면 결국 3D가 안 뜸. `engine.ts`의 `disposeObject`(지오메트리·재질·텍스처 해제), `destroyRenderer`(`forceContextLoss`)
- **StrictMode**: 개발 중 React가 effect를 일부러 두 번 실행해서 정리 누락을 드러냄. 그래서 캔버스를 매번 새로 만들도록 했음

### 6-3. 애니메이션 루프 — `engine.ts`의 `startLoop`
- `requestAnimationFrame`: 화면 주사율(보통 60Hz)에 맞춰 다음 프레임 직전에 함수를 불러 줌
- `dt`(지난 프레임 이후 흐른 초)를 곱해서 움직이면, 30fps든 144fps든 같은 속도로 움직임
- 탭이 숨으면(`visibilitychange`) 멈춰서 배터리 절약
- `ResizeObserver`로 컨테이너 크기가 바뀌면 캔버스 크기와 카메라 비율을 다시 맞춤

### 6-4. 지연 로딩 (Code Splitting) — `components/RoomView.tsx`
```tsx
const RoomCanvas = lazy(() => import('../three/RoomCanvas'))
<Suspense fallback={null}><RoomCanvas … /></Suspense>
```
- `import()`를 만나면 Vite가 그 아래를 **별도 파일(청크)** 로 나눔. 땅굴 화면에 들어갈 때만 내려받음
- 결과: 기본 화면 144KB(gzip) + 3D 엔진 139KB는 땅굴에 갈 때만
- 3D가 준비되기 전엔 정적 이미지(`room-cutout.png`)를 같은 자리에 보여 줘서 빈 화면이 없음

### 6-5. 3D 위에 HTML 올리기
- 패널·버튼·이름표는 3D가 아니라 **HTML을 캔버스 위에 겹쳐서** 그림 (글자가 선명하고 접근성 유지)
- 가구 이름표: 3D 좌표를 `vector.project(camera)`로 화면 좌표로 바꿔 CSS `left/top`에 넣음 (`explore/3d/room.html`)
- 패널이 열리면 방을 왼쪽으로: 카메라 `setViewOffset`으로 "더 넓은 가상 화면의 일부"를 보여 줌 (`frameCamera`)

### 6-6. 입력: 클릭으로 땅 고르기, 키보드 조종
- **레이캐스트**: 클릭한 화면 점에서 카메라 방향으로 광선을 쏘아 바닥과 만나는 점을 구함 → 두더지 `walkTo(점)`
- 드래그(카메라 돌리기)와 클릭을 구분: 눌렀다 뗄 때 6px 안쪽만 클릭으로
- 키보드(`bindMoleKeys`): 누른 키를 Set에 모아 방향을 합침. 입력창에 글 쓰는 중이면 무시, 창을 벗어나면(blur) 다 뗀 것으로
- 충돌: 가구마다 바닥 반경(`foot`)을 두고, 두더지가 그 안에 들어가면 밖으로 밀어냄 (원과 원의 거리 비교)

### 6-7. 데이터 → 3D (관심사 → 가구)
- `furniture.ts`의 `FURNITURE`는 **데이터(카탈로그)** 이고 `build()`만 3D 코드. 새 가구 추가 = 배열에 한 줄
- 사용자 관심사 '캠핑' → `TAG_RULES` 정규식 → '운동·아웃도어' 분야 → 그 분야 가구만 놓음
- 놓을 자리는 벽 위 각도(`slot.a`)로 정하고, 높이별 벽까지 거리(`wallAt`)로 벽에 붙임 → 가구 수가 바뀌어도 정돈된 배치

### 6-8. 원본은 한 곳에
두더지·가구 코드는 `explore/3d/lib/`에만 있고, 실험 페이지와 앱은 스크립트로 복사본을 만듭니다(`splice.js`, `build-app.js`). 같은 코드를 두 군데서 고치다 어긋나는 일을 막는 방법입니다. 앱의 `mole.ts`, `furniture.ts`는 직접 고치지 마세요.

---

## 7. 빌드와 배포

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버. 파일을 저장하면 바로 반영(HMR) |
| `npm run build` | `tsc -b`(타입 검사) → `vite build`(묶기·줄이기·파일명에 해시) → `dist/` |
| `npm run build:share` | 팀 공유용: 상대 경로(`--base=./`), 해시 라우터, 첫 화면 내 땅굴 → `dist-share/` + 아티팩트용 페이지 |

- **파일명 해시**(`index-e3pLAQnk.js`): 내용이 바뀌면 이름도 바뀌어서 브라우저가 옛 캐시를 쓰지 않음
- **배포 제약에 맞춘 것**: 아티팩트는 외부 CSS를 막아서 Pretendard를 npm으로 받아 번들에 넣음. 외부 의존을 줄이면 배포 환경을 덜 탐
- 배포 갱신 순서는 `CLAUDE.md`의 "팀 공유용 앱 배포" 참고

---

## 8. 이 프로젝트로 공부하기 좋은 순서

| 단계 | 읽을 코드 | 해 볼 것 |
|---|---|---|
| 1 | `main.tsx` → `App.tsx` → `components/AppHeader.tsx` | 메뉴 하나 추가해서 빈 화면으로 연결 |
| 2 | `components/Pagination.tsx`, `InterestChip.tsx` | props만 받는 컴포넌트 하나 만들기 (예: 별점) |
| 3 | `screens/burrow/MyBurrow.tsx` + `GuestbookModal.tsx` | 방명록 쓰기를 state로 구현 |
| 4 | `screens/meetups/MeetupList.tsx` | 필터·정렬을 `useMemo`로 |
| 5 | `styles/tokens.css` + 아무 `.module.css` | 토큰 하나 추가해서 쓰기 |
| 6 | `three/SceneCanvas.tsx` → `engine.ts` → `roomScene.ts` | 방에 가구 하나 추가 (`explore/3d/lib/furniture.js` → `build-app.js`) |
| 7 | `explore/3d/lib/mole-motion.js` | 두더지가 점프하는 키 추가 |

## 9. 용어 정리
| 용어 | 뜻 |
|---|---|
| SPA | HTML 한 장으로 화면 전환을 JS가 처리하는 앱 |
| 컴포넌트 / props / state | 화면 조각 / 밖에서 받는 값 / 안에서 기억하는 값 |
| effect (`useEffect`) | 그리기 말고 바깥과 주고받는 일(구독, 3D 마운트, 타이머). 정리 함수를 돌려줌 |
| 라우팅 | 주소와 화면 연결 |
| 번들 / 청크 | 여러 파일을 묶은 결과 / 그중 따로 떨어진 조각 |
| 지연 로딩 | 필요할 때만 청크를 내려받기 |
| 디자인 토큰 | 이름 붙은 디자인 값(색·간격) |
| WebGL 컨텍스트 | 캔버스가 GPU와 연결된 통로. 개수 제한 있음 |
| 레이캐스트 | 화면 점 → 3D 광선 → 물체와 만나는 점 |
| 후처리 | 다 그린 이미지에 더하는 효과(AO, 색보정) |

## 다음 단계
- 서버가 생기면 `data/mock.ts` 자리를 API 호출로 바꾸기 (데이터 불러오기 상태: 로딩·에러·빈 화면 처리)
- 상태가 여러 화면에 걸치면(로그인 사용자, 알림) Context나 상태 관리 라이브러리 검토
- 테스트: `lib/format.ts` 같은 순수 함수부터 단위 테스트
