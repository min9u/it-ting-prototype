# 개발·배포·백엔드 연결에서 문제가 날 수 있는 곳

- 날짜: 2026-11-11
- 요청: "개발하고 배포할 때 프론트엔드 안에서, 또는 프론트엔드와 백엔드를 연결할 때 이 프로젝트 어디에서 문제가 발생할 수 있는지 미리 알아봐 줘. 기술적으로 설명하는 문서를 만들어 줘."
- 범위: `app/` (Vite 8 + React 19 + react-router 7 + three.js 0.165). 백엔드 코드는 아직 저장소에 없음. 백엔드 쪽 내용 가운데 **SSAFY 팀에서 흔히 쓰는 Spring Boot + MySQL + Nginx + EC2 구성을 가정한 것**은 "(가정)"으로 표시했다.
- 근거: 2026-11-11 작업 트리의 코드. 줄 번호는 이날 기준이다. 같은 날 다른 작업(Figma 반영)이 `app/` 화면 파일을 고치는 중이라 줄이 조금 밀릴 수 있다.
- 함께 읽기: 개념 설명은 [프론트엔드 기술 가이드](frontend-guide.md)에 있다. 이 문서는 "어디가 터질 수 있나"만 다룬다.

각 항목은 **무엇이 터지나 → 왜 (원리) → 이 프로젝트 어디 → 언제 드러나나 → 예방·해결 → 심각도** 순서로 썼다.
심각도: 🔴 높음(서비스가 안 되거나 데이터가 틀림) · 🟠 중간(일부 기능 장애·큰 재작업) · 🟢 낮음(불편·품질).

---

## 0. 요약표

| # | 위험 | 위치 | 심각도 | 언제 드러나나 |
|---|---|---|---|---|
| B1 | 데이터를 비동기로 바꾸면 "없음" 처리 코드가 로딩 중에 다른 화면으로 튕겨 냄 | `MeetupDetail.tsx:34`, `Board.tsx:130`, `VisitBurrow.tsx:28`, `mock.ts:84` | 🔴 | API 붙이는 첫날 |
| B2 | 날짜 필드에 ISO 문자열과 "2시간 전" 같은 표시 문자열이 섞여 있음. 서버 시간대 문제도 있음 | `types.ts`, `mock.ts:125-130`, `format.ts:7,21` | 🔴 | API 붙일 때, 배포 서버에서 9시간 어긋남 |
| B3 | 로딩·에러 상태와 에러 경계(errorElement)가 하나도 없음 | `App.tsx:32-72`, 화면 전부 | 🔴 | 서버가 느리거나 죽었을 때, 재배포 직후 |
| B4 | 채팅방을 바꿔도 이전 방 메시지가 남음 (**지금도 있는 버그**) + 실시간 연결(재연결·순서·중복) 설계 없음 | `Chat.tsx:51,94,103` | 🔴 | 채팅방을 오갈 때(지금), WebSocket 붙일 때 |
| D1 | 브라우저 라우터로 배포하면 새로고침이나 딥링크에서 404 | `App.tsx:4`, 서버 설정 | 🔴 | 실제 서버 첫 배포 |
| D2 | 재배포 뒤 열려 있던 탭에서 3D 청크를 못 받아 앱 전체가 에러 화면 | `RoomView.tsx:6`, `FieldView.tsx:4` + D1·B3 | 🟠 | 배포할 때마다 |
| B5 | 인증 상태·라우트 보호가 없음. 제한을 클라이언트에서만 검사함 | `App.tsx:46-67`, `LookAround.tsx:15` | 🔴 | 로그인 붙일 때 |
| B6 | CORS·쿠키(SameSite/HTTPS) 설정 불일치 | `vite.config.ts:6`(프록시 없음) | 🟠 | 로컬에서 처음 API 호출할 때, HTTPS 배포 |
| B7 | ID가 문자열인데 서버는 숫자(Long)일 가능성이 큼 | `types.ts` 전부, `mock.ts:55` | 🟠 | API 붙일 때 (`===` 비교 실패) |
| B8 | 페이지네이션·정렬·이전/다음 글을 클라이언트가 전체 배열로 계산 | `Board.tsx:33,39,57,120` | 🟠 | 글이 많아질 때, API 설계 |
| B9 | 방명록이 땅굴 주인별로 나뉘어 있지 않음 (`ownerId` 없음) | `types.ts:35-41`, `VisitBurrow.tsx:31` | 🟠 | 방명록 API 설계 |
| B10 | 방 꾸미기·두더지 꾸미기 저장 형식이 정해지지 않음 (3D 배치 직렬화, 버전) | `furniture.ts`(생성 파일), `moleItems.ts`, `MyBurrow.tsx:37` | 🟠 | 꾸미기 저장 기능 |
| F1 | WebGL 컨텍스트·메모리: 지금은 잘 정리하지만 깨지기 쉬운 지점 몇 곳 | `engine.ts:34-38`, `SceneCanvas.tsx:22-39`, `RoomCanvas.tsx:15` | 🟠 | 화면 이동을 반복할 때, R3F로 옮길 때 |
| F2 | 그래픽카드가 꺼진 PC에서 3D가 느리거나 깨짐 | `roomScene.ts:213`, `fieldScene.ts:258` | 🔴 | SSAFY PC → 별도 조사 [gpu-fallback-research.md](gpu-fallback-research.md) (같은 날 별도 작업으로 작성 중) |
| D3 | 환경 변수: `"0"`도 참이 되고, `VITE_` 값은 누구나 볼 수 있음, `.env.local`이 무시 목록에 없음 | `App.tsx:4`, `app/.env.share:1`, `.gitignore` | 🟠 | 설정을 끄려고 할 때, 비밀 키를 넣을 때 |
| D4 | 캐시: `index.html`이 캐시되면 새 배포가 안 보임 | 서버 설정 | 🟠 | 실제 서버 배포 |
| D5 | 아티팩트 배포의 제약 (외부 리소스, 옛 해시 파일 정리, OAuth 불가) | `scripts/share-page.mjs`, `CLAUDE.md` 배포 절차 | 🟢 | 공유본을 갱신할 때 |
| F3 | 번들 크기: 첫 화면에 모든 화면 코드가 들어가고 three 청크가 큼 | `App.tsx:5-19`, `vite.config.ts:8` | 🟢 | 모바일·느린 망 |
| F4 | 생성 파일에는 타입 검사가 꺼져 있음. 의존성은 최신 메이저 버전에 `^` 범위 | `mole.ts:1`, `furniture.ts:1`, `package.json` | 🟢 | 라이브러리 업데이트, 재생성 |
| F5 | 접근성: 모달 포커스 가두기·복귀 없음, 전역 키 단축키 | `Modal.tsx:18-28`, `ExploreBurrow.tsx:31-39`, `mole.ts:276` | 🟢 | 키보드·스크린리더 사용자 |
| F6 | 폰트: 제목 서체만 Google Fonts에 의존 | `index.html:9`, `tokens.css:53` | 🟢 | 외부 망이 막힌 곳 |

전체 흐름에서 각 위험이 걸리는 자리:

```mermaid
flowchart LR
  U[브라우저<br/>SSAFY PC] -->|"GET /burrow (D1, D4)"| N[Nginx (가정)]
  N -->|정적 파일| S[(dist/ index.html + assets)]
  N -->|"/api/* (B6 CORS·쿠키)"| A[Spring Boot (가정)]
  N -->|"/ws (B4 업그레이드·타임아웃)"| A
  A --> DB[(MySQL (가정))]
  U -.->|"three 청크 lazy (D2)"| S
  U -.->|"WebGL (F1, F2)"| G[GPU / 소프트웨어 렌더]
```

---

## 1. 백엔드 연결

### B1. "없음" 처리가 로딩 중에 사용자를 튕겨 냄 🔴
- **무엇이 터지나**: 모임 상세나 게시글 상세 주소로 바로 들어가면, 데이터가 오기도 전에 목록으로 되돌아간다. 땅굴 방문 화면에서는 모르는 사람 ID로 들어가도 에러 없이 **다른 사람(예린)의 땅굴**이 보인다.
- **왜**: 지금은 데이터가 `mock.ts`의 배열이라 렌더 첫 순간부터 값이 있다. 그래서 "못 찾으면 = 없는 데이터"로 판단해도 맞다. API로 바꾸면 첫 렌더에서는 데이터가 아직 `undefined`이다. 이때 "없음"으로 보고 `<Navigate>`를 렌더하면 응답이 오기 전에 이동해 버린다.
- **어디**:
  - `app/src/screens/meetups/MeetupDetail.tsx:34` `if (!m) return <Navigate to="/meetups" replace />`
  - `app/src/screens/board/Board.tsx:130` `if (!p) return <Navigate to="/board" replace />`
  - `app/src/screens/burrow/VisitBurrow.tsx:28` `USERS[userId] ?? USERS.yerin`: 없는 사용자를 예린으로 대체
  - `app/src/data/mock.ts:84` `userOf = (id) => USERS[id] ?? USERS.seobeok`: 탈퇴한 사용자가 쓴 글·방명록이 **다른 사람 이름으로** 보이게 됨
- **언제**: API를 붙이는 첫날. 목 데이터로는 절대 재현되지 않는다.
- **예방·해결**:
  1. 데이터마다 상태를 셋으로 나눈다: `loading` / `error` / `data | null(진짜 없음)`. 서버가 404를 줬을 때만 "없음" 화면을 보여 준다. 다른 사람으로 대체하지 말고 "없는 땅굴이에요" 화면을 띄운다.
  2. 데이터 가져오기는 TanStack Query(`useQuery`)나 react-router의 `loader`를 쓰면 이 세 상태를 기본으로 준다.
  3. `userOf`의 대체값 대신 `{ nickname: '(알 수 없음)' }` 같은 "탈퇴한 사용자" 객체를 둔다.

### B2. 날짜·시간 형식이 섞여 있음 + 시간대 🔴
- **무엇이 터지나**: 게시판 작성 시간이 `2026-11-03T07:12:00Z` 같은 원문으로 보이거나 `NaN일 전`으로 나온다. 배포 서버에서는 "방금 쓴 방명록"이 "9시간 전"으로 보인다. 7일이 지나면 지워지는 방명록 필터(`liveGuestbook`)가 엉뚱한 것을 지운다.
- **왜**:
  - 타입은 모두 `string`인데 **들어 있는 값의 종류가 다르다.** TypeScript는 "문자열인가"만 검사하고 "ISO 날짜인가"는 모른다.
  - (가정) Spring의 `LocalDateTime`은 기본으로 `"2026-11-11T10:00:00"`처럼 **시간대 없이** 직렬화된다. JS의 `new Date()`는 시간대 없는 날짜·시간을 **브라우저 현지 시간**으로 읽는다. 서버(EC2 기본 UTC)가 UTC로 저장했다면 9시간이 어긋난다.
  - `format.ts:21`은 ISO 문자열을 `localeCompare`로 정렬한다. 형식이 하나로 같을 때만 맞는 방법이다. `Z`와 `+09:00`이 섞이거나 소수점 초 자릿수가 다르면 순서가 틀린다.
- **어디**:
  - ISO를 쓰는 곳: `GuestbookEntry.createdAt` (`types.ts:39-40`, 목은 `mock.ts:87`의 `toISOString()`)
  - 표시 문자열을 쓰는 곳: `Post.createdAt`에 `'11월 3일 오후 4:12'`(`mock.ts:125`), `Comment.createdAt`에 `'2시간 전'`(`mock.ts:127-130`), `Message.time`(`types.ts:95`), `ChatRoom.lastAt`(`types.ts:108`), `ChatRequest.ago`(`types.ts:119`)
  - 날짜만 쓰는 곳: `Meetup.date` `YYYY-MM-DD` + `start`/`end` 따로 (`types.ts:76-78`). `dateParts`가 `new Date(y, m-1, d)`로 현지 시간 기준 요일을 계산한다 (`format.ts:30-33`)
  - 계산: `timeAgo`가 `new Date(iso)`를 씀 (`format.ts:7`), 정렬은 `format.ts:21`
- **언제**: API 연결, 그리고 서버 시간대가 KST가 아닌 환경에 배포할 때.
- **예방·해결**:
  1. **규약**: 서버는 순간(instant)을 항상 `Z`나 `+09:00`이 붙은 ISO 8601로 보낸다 (Spring에서는 `Instant`나 `OffsetDateTime`을 쓰거나 Jackson 설정 (가정)). 모임 날짜처럼 "달력의 하루"는 `YYYY-MM-DD` + `HH:mm` + 시간대 `Asia/Seoul`로 정한다.
  2. 프론트는 서버 값을 **가공하지 않고 저장**하고, "2시간 전" 같은 문구는 화면에서만 만든다. 목 데이터의 `'2시간 전'`, `'11월 3일 오후 4:12'`는 ISO로 바꾼다.
  3. 타입을 `string` 대신 `type IsoDateTime = string & { __brand: 'iso' }` 같은 브랜드 타입으로 두면, 표시 문자열을 실수로 넣는 일을 컴파일 단계에서 막을 수 있다.
  4. 정렬은 `Date.parse(a) - Date.parse(b)`로 하거나, 서버가 정렬해서 주게 한다.

### B3. 로딩·에러 상태와 에러 경계가 없음 🔴
- **무엇이 터지나**: 서버가 느리면 빈 화면이 나오고, 실패하면 아무 표시가 없거나 react-router 기본 에러 화면("Unexpected Application Error!")이 뜬다. 컴포넌트 하나가 던진 에러에 앱 전체가 하얘진다.
- **왜**:
  - React에서는 렌더 중에 던진 에러를 **에러 경계(Error Boundary)**가 잡지 않으면 그 위 트리가 통째로 사라진다. react-router 7은 라우트마다 `errorElement`로 경계를 달 수 있는데, 지금은 하나도 없어서 기본 화면이 뜬다.
  - 지금 화면에 `fetch`, loading, error 처리가 하나도 없다. 모든 화면이 `mock.ts`를 직접 import한다 (화면·컴포넌트 15개 파일).
- **어디**: 라우트 정의 `app/src/App.tsx:32-72` (`errorElement` 없음). 목을 직접 import하는 곳은 `Board.tsx`, `Chat.tsx`, `MyBurrow.tsx`, `VisitBurrow.tsx`, `ExploreBurrow.tsx`, `MeetupDetail.tsx`, `MeetupList.tsx`, `MeetupNew.tsx`, `MeetupsShell.tsx`, `Onboarding.tsx`, `GuestbookItem.tsx`, `InterestChip.tsx`, `MeetupCard.tsx`, `NotificationPopover.tsx`, `GuestbookModal.tsx`.
- **언제**: 서버가 느리거나 죽었을 때, 재배포 직후(D2), 데이터 모양이 예상과 다를 때 (`p.body.slice` 같은 곳에서 `undefined` 에러).
- **예방·해결**:
  1. 지금 바로: `AppLayout` 라우트와 최상위 라우트에 `errorElement: <ErrorPage />`를 단다. 반나절이면 된다.
  2. **데이터 접근 계층**을 만든다: `src/api/` 아래에 `getMeetup(id)` 같은 함수를 두고, 화면은 `mock.ts` 대신 훅(`useMeetup(id)`)만 쓴다. 처음에는 훅 안에서 목을 `Promise`로 돌려주게 하면 **백엔드 없이도** 로딩 상태를 미리 만들고 시험할 수 있다. 계획 문서 7단계의 "API 훅 뒤로 숨기기"가 이것이다.
  3. 공용 컴포넌트 `Skeleton`, `ErrorState(다시 시도)`, `EmptyState`를 만든다. 빈 상태는 이미 있는 화면이 있다 (채팅 `Empty`, `Chat.tsx:79-91`, `?guestbook=0`).

### B4. 채팅: 지금 있는 버그 + 실시간 연결 🔴
- **지금 있는 버그**: 채팅방 A에서 B로 넘어가면, **헤더는 B인데 메시지 목록은 A의 것**으로 남는다.
  - 왜: `<Room room={room} />`(`Chat.tsx:51`)은 같은 자리에 같은 타입의 컴포넌트라서 React가 **다시 만들지 않고 재사용**한다. `useState(room.messages)`(`Chat.tsx:94`)의 초기값은 처음 마운트할 때 한 번만 쓰이므로, room이 바뀌어도 `msgs`는 그대로다. `/chat/:roomId` 라우트도 같은 `<Chat />` 엘리먼트라서 이동해도 언마운트되지 않는다.
  - 해결: `<Room key={room.id} room={room} />`. 키가 바뀌면 React가 새 컴포넌트로 만든다. 같은 패턴이 `VisitBurrow`에도 있다. `/burrow/a`에서 `/burrow/b`로 가면 방명록 입력값(`draft`)과 목록(`entries`)이 그대로 남는다 (`VisitBurrow.tsx:31-32`). 3D 쪽은 `deps`로 따로 다시 만들어서 괜찮다.
- **실시간 연결에서 터질 것** (WebSocket/STOMP는 (가정)):
  | 문제 | 원리 | 대비 |
  |---|---|---|
  | 메시지 중복 | 보낸 메시지를 화면에 먼저 그린 뒤(낙관적 업데이트, `Chat.tsx:103`) 서버가 같은 메시지를 다시 방송하면 두 번 보임 | 클라이언트가 `clientMessageId`(UUID)를 만들어 보내고, 서버 응답에 그대로 돌려받아 임시 메시지를 **교체**한다. 지금 임시 ID `m${Date.now()}`는 같은 밀리초에 겹칠 수 있다 |
  | 순서 뒤섞임 | 재연결 중 받은 메시지와 HTTP로 다시 받은 기록이 섞임. 클라이언트 시계는 믿을 수 없음 | 서버가 방마다 증가하는 `seq`(또는 서버 시각 + ID)를 주고, 프론트는 그 값으로 정렬·중복 제거 |
  | 끊김 | 와이파이 전환, 노트북 덮개 닫기, (가정) Nginx `proxy_read_timeout` 기본 60초가 조용한 연결을 끊음 | 하트비트(STOMP heart-beat 10s), 지수 백오프 재연결, 재연결하면 `마지막 seq 이후` 기록을 HTTP로 가져오기 |
  | 인증 만료 | WebSocket은 처음 연결할 때만 인증한다. 토큰이 만료돼도 연결은 살아 있음 | 연결 시 토큰 검사 + 만료되면 서버가 끊고 재연결 때 새 토큰 |
  | 읽음·안 읽음 수 | `unread`(`types.ts:107`)를 클라이언트가 세면 기기마다 다름 | 서버가 `lastReadSeq`를 저장하고 수를 계산 |
  | 대화 요청 상태 | `state: 'pending' \| 'open'`(`types.ts:105`)을 수락하는 순간 두 사람 화면이 동시에 바뀌어야 함 | 상태 변경 이벤트를 소켓으로 보내기 |
- **언제**: 버그는 지금도 있다. 나머지는 WebSocket을 붙일 때 드러난다.

### B5. 인증과 권한 🔴
- **무엇이 터지나**: 로그인하지 않아도 `/burrow`, `/chat` 같은 주소로 바로 들어갈 수 있다. "비로그인은 방 3개까지만" 제한은 새로고침하면 풀린다.
- **왜**:
  - 라우트 보호(가드)가 없다. `AppLayout`(`App.tsx:46-67`)이 로그인 여부를 확인하지 않는다.
  - "내가 누구인가"가 상수 `ME_ID = 'me'`(`mock.ts:55`)로 박혀 있고, 여러 화면이 `USERS[ME_ID]`를 직접 읽는다.
  - 비로그인 열람 제한 `FREE = 3`(`LookAround.tsx:15`)은 컴포넌트 `useState`에만 있다. **프론트 검사는 편의일 뿐 보안이 아니다.** 같은 이유로 "모임 정원", "방명록 7일 삭제"(`format.ts:16-22`)도 서버가 강제해야 한다.
- **예방·해결**:
  1. `AuthProvider`(Context)로 `me`를 앱 위쪽에 두고, `ME_ID`를 쓰는 곳을 `useMe()`로 바꾼다.
  2. 로그인이 필요한 라우트를 `<RequireAuth>`로 감싸고, 로그인 후 원래 가려던 주소로 되돌린다 (`?next=`).
  3. **토큰 저장 방식을 백엔드와 먼저 정한다**:
     - HttpOnly 쿠키 + 리프레시 토큰: XSS로 토큰을 훔치기 어렵다. 대신 CORS·SameSite·CSRF 설정이 필요하다 (B6).
     - `Authorization: Bearer` 헤더 + 메모리 저장: 설정이 단순하다. 대신 새로고침하면 사라지므로 리프레시가 필요하다.
     - localStorage에 액세스 토큰을 두는 방식은 XSS에 약해서 추천하지 않는다.
  4. 401을 받으면 리프레시를 **한 번만** 시도한다. 동시에 여러 요청이 401을 받으면 리프레시도 여러 번 나가는 문제가 흔하다 → 진행 중인 리프레시 Promise 하나를 공유한다.
  5. 소셜 로그인(가정): 리다이렉트 URI는 **경로**(`/oauth/callback`)여야 한다. 해시 라우터를 쓰는 공유 빌드(`#/...`)에서는 OAuth 콜백을 받을 수 없다 (D5).

### B6. CORS · 쿠키 · HTTPS · 개발 프록시 🟠
- **무엇이 터지나**: 로컬에서 처음 API를 부르면 콘솔에 `blocked by CORS policy`가 뜬다. 로그인은 성공했는데 다음 요청에 쿠키가 안 실린다. 배포 뒤 `Mixed Content` 에러가 난다.
- **왜**:
  - 브라우저는 **출처(origin = 프로토콜 + 호스트 + 포트)**가 다른 요청에서, 서버가 `Access-Control-Allow-Origin`으로 허락하지 않으면 응답을 JS에 넘겨주지 않는다. `localhost:5173`(Vite)과 `localhost:8080`(Spring (가정))은 **포트가 달라서 다른 출처**다.
  - 쿠키를 보내려면 프론트는 `credentials: 'include'`, 서버는 `Allow-Credentials: true` + 구체적인 출처를 지정해야 한다. 이때 출처에 `*`를 쓸 수 없다 (Spring Security에서 자주 막히는 지점 (가정)).
  - 쿠키 `SameSite=None`은 반드시 `Secure`(HTTPS)와 함께 써야 한다. 프론트와 API가 다른 사이트(도메인)에 있으면 이 설정이 필요하다.
  - HTTPS 페이지에서 `http://` API를 부르면 브라우저가 막는다 (혼합 콘텐츠).
- **어디**: `app/vite.config.ts:6`에는 `server.port`만 있고 프록시가 없다. API 주소를 넣을 곳(환경 변수)도 아직 없다.
- **예방·해결**:
  1. **같은 출처로 맞추는 것이 가장 쉽다**: 개발할 때는 Vite 프록시 `server.proxy: { '/api': 'http://localhost:8080', '/ws': { target: 'ws://localhost:8080', ws: true } }`를 쓰고, 배포할 때는 Nginx가 `/api`를 Spring으로 넘긴다. 그러면 브라우저가 보기에 출처가 하나라 CORS도 SameSite도 문제가 되지 않는다.
  2. 코드에서는 `fetch('/api/...')`처럼 **상대 경로**만 쓰고, 다른 도메인이 꼭 필요할 때만 `VITE_API_BASE`를 둔다.
  3. 배포는 처음부터 HTTPS로 한다 (Let's Encrypt). WebSocket도 `wss://`로 연결한다.

### B7. ID 타입 🟠
- **무엇이 터지나**: "내 글이면 수정 버튼 보이기" 같은 `authorId === ME_ID` 비교가 항상 false가 된다. 큰 숫자 ID는 끝자리가 바뀐다.
- **왜**: 목 데이터의 ID는 모두 문자열(`'me'`, `'yerin'`, `'p1'`)이다 (`types.ts`의 `id: string`). (가정) Spring + JPA는 보통 `Long` 숫자 ID를 준다. JSON 숫자 `12`와 문자열 `'12'`는 `===`에서 다르다. 또 JS 숫자는 2^53(약 9천조)보다 큰 정수를 정확히 담지 못한다. Snowflake 같은 64비트 ID를 숫자로 보내면 값이 바뀐다.
- **예방·해결**: 규약을 "ID는 JSON에서 **문자열**로 보낸다"로 정한다. 그러면 지금 타입을 그대로 쓸 수 있다. 숫자로 정하면 API 계층에서 한 번만 `String()`으로 바꾼다. 사용자 주소(`/burrow/:userId`)에 숫자 ID를 쓸지 닉네임 같은 핸들을 쓸지도 정한다.

### B8. 페이지네이션·정렬·이전/다음 글 🟠
- **무엇이 터지나**: 글이 수천 개가 되면 목록을 한 번에 받아야 해서 느려진다. 페이지 번호를 새로고침하거나 뒤로 가면 1쪽으로 돌아간다.
- **어디**:
  - 전체 배열을 거르고 자름: `Board.tsx:33`(저장한 글 필터), `:57` `list.slice((page-1)*PAGE, page*PAGE)`
  - 인기글을 조회수로 클라이언트에서 정렬: `Board.tsx:39`
  - 이전/다음 글을 배열 인덱스로 찾음: `Board.tsx:120` `POSTS.findIndex(...)`
  - 페이지가 `useState`(`Board.tsx:30`)에만 있고 주소에는 없다
- **예방·해결**:
  1. 게시판은 `?page=&size=` 오프셋 방식이 디자인(페이지 번호)과 맞는다. 채팅·방명록처럼 계속 쌓이는 목록은 `?cursor=` 커서 방식이 맞다. 응답 모양을 정한다 (아래 규약 초안).
  2. 페이지 번호를 주소(`?page=3`)에 넣는다. 이미 `?panel=`, `?modal=`에서 쓰는 방식이다.
  3. 이전/다음 글은 상세 API 응답에 `prevId`, `nextId`를 넣어 달라고 요청한다.

### B9. 방명록의 주인 🟠
- `GuestbookEntry`(`types.ts:35-41`)에 **누구의 땅굴인지(`ownerId`)가 없다.** 그래서 지금은 모든 땅굴이 같은 `GUESTBOOK`을 보여 준다 (`VisitBurrow.tsx:31`, `MyBurrow.tsx:38`).
- API는 `GET /users/{id}/guestbook`처럼 주인별로 가져와야 한다. 7일 자동 삭제는 서버 배치나 조회 조건으로 처리하고, 프론트의 `liveGuestbook` 필터는 보조로만 남긴다.

### B10. 꾸미기 데이터 저장 형식 (3D 배치 직렬화) 🟠
- **무엇이 터지나**: 가구나 아이템 ID를 바꾸거나 지우면 이미 저장된 방이 깨진다. 좌표를 3D 단위로 저장하면 나중에 방 크기를 바꿀 때 모든 방이 어긋난다.
- **지금 상태**:
  - 방은 관심사에서 **매번 계산**한다 (`furnishRoom(root, { interests })`, `app/src/three/furniture.ts`, 원본 `explore/3d/lib/furniture.js`). 저장할 배치 데이터가 아직 없다.
  - 두더지 꾸미기는 아이템 ID 배열이다: `worn: string[]`(`MyBurrow.tsx:37`), 최대 2개, 부위마다 하나 (`moleItems.ts`의 `MAX_WORN`). 이 규칙은 프론트에만 있다.
- **예방·해결** (지금 정해 두면 나중에 고칠 일이 적다):
  ```json
  {
    "schemaVersion": 1,
    "mole": { "fur": "#b98a6a", "worn": ["hat_beret"] },
    "room": {
      "mode": "auto",
      "items": [{ "itemId": "piano", "slot": "wall-12", "rot": 0 }]
    }
  }
  ```
  - 저장할 때는 3D 좌표 대신 **슬롯(자리) ID**나 정규화한 각도(`slot.a`)를 쓴다. 좌표 계산은 프론트가 한다.
  - `itemId`는 영구 ID로 취급해서 이름을 바꾸지 않는다. 지울 때는 "단종" 표시만 하고, 모르는 ID는 건너뛰어 그린다.
  - `schemaVersion`이 바뀌면 프론트에서 옛 형식을 새 형식으로 바꾸는 함수(마이그레이션)를 둔다.
  - "부위당 하나, 최대 2개" 같은 규칙은 서버도 검증한다.

### B11. 낙관적 업데이트와 동시성 🟠
- 지금은 모든 "쓰기"가 화면 상태만 바꾼다. 방명록 작성(`VisitBurrow.tsx:43`), 방명록 삭제(`MyBurrow.tsx:137`), 대화 요청 수락·거절(`Chat.tsx:212`), 메시지 전송(`Chat.tsx:103`). 서버를 붙이면 다음을 정해야 한다.
  - **실패하면 되돌리기**: 화면에 먼저 반영했다가 실패하면 원래대로 돌리고 알림을 띄운다 (TanStack Query `onMutate`/`onError`).
  - **중복 제출**: 버튼을 두 번 누르거나 엔터를 연타하면 두 번 등록된다 → 요청 중에는 버튼을 끄고, 서버는 멱등 키(`Idempotency-Key`)로 막는다.
  - **경쟁 상태**: 모임 정원 마지막 한 자리(`Meetup.capacity` vs `memberIds`, `types.ts:82-83`)에 두 명이 동시에 신청할 수 있다 → 서버가 트랜잭션·락으로 판정하고, 프론트는 409(정원 초과) 응답을 처리한다.
  - **옛 데이터 덮어쓰기**: 프로필을 두 탭에서 고치면 나중에 저장한 쪽이 이긴다 → 필요하면 `version` 필드(낙관적 락)를 쓴다.

### B12. 이미지 업로드 🟠
- 아직 업로드 화면은 없지만 `Post.hasPhoto`(`types.ts:66`), 프로필 사진(`Avatar`), 모임 사진이 예정돼 있다.
- 터질 곳 (가정):
  - (가정) Spring 기본 업로드 한도 1MB(`spring.servlet.multipart.max-file-size`)와 Nginx `client_max_body_size` 기본 1MB → 휴대폰 사진은 대부분 413 에러
  - HEIC 형식, 사진 회전 정보(EXIF), 원본 크기 그대로 올리기
- 대비:
  - 프론트에서 업로드 전에 캔버스로 줄이고(긴 변 1600px, JPEG/WebP) 형식과 크기를 검사한다.
  - S3 presigned URL로 브라우저가 S3에 직접 올리게 하면 서버 부하와 한도 문제가 같이 줄어든다.
  - 진행률을 표시하고 실패하면 다시 시도할 수 있게 한다.

---

## 2. 프론트엔드 내부

### F1. three.js 수명 주기 (WebGL 컨텍스트·메모리) 🟠
지금 구조는 정리를 꽤 잘 해 둔 편이다. [가이드 6-2](frontend-guide.md#6-2-react와-threejs의-경계--threescenecanvastsx)에서 원리를 설명했다. 아래는 **깨지기 쉬운 지점**이다.

| 지점 | 지금 상태 | 깨지는 경우 |
|---|---|---|
| 컨텍스트 반납 | `destroyRenderer`가 `dispose()` + `forceContextLoss()` + 캔버스 제거 (`engine.ts:34-38`) | 새 장면을 추가하면서 `dispose`에서 이 함수를 빼먹으면, 화면을 16번쯤 오간 뒤 "Too many active WebGL contexts" 경고가 뜨고 **가장 오래된 3D가 검게** 변함 |
| 해제 범위 | `disposeObject`가 지오메트리·재질·재질에 붙은 텍스처·그림자 맵·환경맵을 해제 (`engine.ts:41-63`) | 재질 **바깥**에서 만든 렌더 타깃이나 후처리 패스를 새로 추가하면 직접 `dispose` 해야 함. 지금은 `roomScene.ts:259`, `fieldScene.ts:320-321`에서 손으로 해제함 |
| StrictMode | 개발 모드에서 effect가 두 번 돌아도 캔버스를 매번 새로 만들게 함 (`main.tsx:10`, `engine.ts:15-17`) | `mount`가 비동기가 되면(glb 모델 로드 등) 정리 함수가 먼저 돌고 **나중에 로드가 끝난 장면이 살아남는** 문제가 생김 → `let cancelled = false` 패턴 필요 |
| 다시 만들기 기준 | `deps = ownerId + 관심사 목록` (`RoomCanvas.tsx:15`) | 관심사를 바꿀 때마다 렌더러·PMREM·후처리를 **통째로 다시 만든다**. 서버가 관심사 순서를 다르게 주면 내용이 같아도 다시 만든다 → 정렬해서 키를 만들거나, 가구만 바꾸는 `setInterests()`를 `SceneHandle`에 추가 |
| 실패 처리 | WebGL을 못 만들면 `catch`로 넘어가 자리표시 이미지를 둠 (`SceneCanvas.tsx:28-32`) | 컨텍스트가 **도중에** 사라지는 경우(`webglcontextlost`, 그래픽 드라이버 재시작, 탭이 오래 숨겨짐)는 처리하지 않아서 검은 화면으로 남음 → 이벤트를 듣고 다시 마운트 |
| 전역 키 | `bindMoleKeys`가 `window`에 keydown을 걸고 정리 함수를 돌려줌 (`mole.ts:276`, `roomScene.ts:194,256`) | 두 장면이 동시에 떠 있으면 WASD 한 번에 두더지 둘이 움직임. 지금은 한 화면에 장면이 하나뿐이라 괜찮음 |
| HMR | 개발 중 `roomScene.ts`를 저장하면 모듈이 바뀜 | 정리가 잘 되면 문제없음. 정리가 빠지면 개발 중에만 컨텍스트가 쌓여서 "개발에서만 3D가 꺼지는" 혼란이 생김 |

- R3F로 옮길 때: R3F의 `<Canvas>`는 언마운트하면 렌더러를 정리해 주지만, 직접 만든 텍스처(캔버스 텍스처, PMREM)는 여전히 직접 정리해야 한다.

### F2. 그래픽카드가 꺼진 PC 🔴
SSAFY PC처럼 하드웨어 가속이 꺼진 브라우저에서는 소프트웨어 렌더링(SwiftShader)이 되어 느리거나 깨져 보인다. 이 저장소의 장면은 후처리 AO(`roomScene.ts:213` GTAO 샘플 16, `fieldScene.ts:258` N8AO), 그림자, 두더지 잔털 12겹을 쓴다. 감지·안내·저사양 모드는 별도 조사에서 다룬다: [gpu-fallback-research.md](gpu-fallback-research.md).

### F3. 번들 크기 🟢
- 마지막 공유 빌드(`dist-share/assets`) 기준 압축 전 크기:
  - 첫 화면 JS `index-*.js` 약 451KB: 모든 화면 코드가 들어 있다. `App.tsx:5-19`에서 화면을 전부 정적으로 import하기 때문이다.
  - three 청크 `engine-*.js` 약 538KB와 `FieldCanvas-*.js` 약 151KB: 땅굴에 들어갈 때만 받는다.
  - 가이드에 적힌 gzip 크기는 기본 144KB, 3D 139KB.
- `vite.config.ts:8`에서 청크 경고 기준을 600KB로 올려 두었다. 새로 무거운 라이브러리를 추가해도 경고가 안 뜰 수 있다는 뜻이다.
- 대비: 화면이 늘면 라우트 단위로 지연 로딩한다 (react-router의 `lazy` 라우트 속성). 3D 청크는 로그인 화면에 있을 때 미리 받아 둔다 (`import()`를 미리 호출해 두기). Pretendard는 동적 서브셋이라 woff2 92개로 나뉘어 있다. 쓰는 글자만 받으니 괜찮다.

### F4. 타입 안전성과 의존성 🟢
- `app/src/three/mole.ts:1`, `furniture.ts:1`은 `// @ts-nocheck`(자동 생성)이라 **타입 검사를 받지 않는다**. 원본 JS(`explore/3d/lib/`)에서 함수 이름이나 인자를 바꾸면, 앱 빌드는 통과하고 실행할 때 터진다. → 생성 스크립트가 `.d.ts`도 함께 만들게 하거나, `roomScene.ts`에서 쓰는 함수의 타입을 손으로 선언해 둔다 (`n8ao.d.ts`처럼).
- `package.json`에서 react `^19.3.1`, react-router-dom `^7.18.5`, vite `^8.3.7`, typescript `^7.0.2`는 `^` 범위이고, three·n8ao·postprocessing은 정확한 버전으로 고정되어 있다. `package-lock.json`이 커밋돼 있으니 **CI·서버 빌드에서는 `npm install` 대신 `npm ci`**를 써야 같은 버전이 깔린다.
- TypeScript 7(네이티브 컴파일러)과 Vite 8은 최신 메이저라, 플러그인이나 에디터 도구와 호환이 덜 됐을 수 있다. 팀원 PC의 Node 버전은 `.nvmrc`나 `engines`로 고정한다 (이 PC는 Node 24).

### F5. 접근성 🟢
- 모달(`Modal.tsx:18-28`)은 Esc로 닫히고 열릴 때 상자에 포커스를 준다. 하지만 **Tab 키가 모달 밖으로 나가고**, 닫힌 뒤 원래 버튼으로 포커스가 돌아가지 않는다. 네이티브 `<dialog>`의 `showModal()`을 쓰면 둘 다 기본으로 해결된다.
- 키 단축키를 전역에서 가로챈다: 탐색하기의 ←/→(`ExploreBurrow.tsx:31-39`), 두더지 WASD(`mole.ts:276`). 입력창에서는 무시하도록 되어 있다. 다만 ←/→는 `INPUT`/`TEXTAREA`만 검사해서 `contenteditable`이나 `select`에서는 넘어가고, 스크린리더의 화살표 탐색과도 겹칠 수 있다.
- 3D는 `role="img"` + `aria-label`로 설명한다 (`SceneCanvas.tsx`). 같은 정보(가구, 관심사)를 HTML 패널에도 보여 주는 지금 구조를 유지한다.

### F6. 폰트 🟢
- 본문 Pretendard는 번들에 들어 있다 (`main.tsx:6`). 제목 서체 Do Hyeon만 Google Fonts CSS로 받는다 (`index.html:9`, `share-page.mjs:10`).
- 외부 망이 막혔거나 느린 곳에서는 제목이 Pretendard로 보인다 (`tokens.css:53`의 대체 순서). `display=swap`이라 처음에 대체 서체가 보였다가 바뀌며 글자 폭이 달라져 레이아웃이 살짝 흔들린다. 필요하면 Do Hyeon도 woff2로 받아 번들에 넣는다 (OFL 라이선스).
- 서체 확정은 계획 문서의 열린 질문 1번이다.

---

## 3. 빌드·배포

### D1. 브라우저 라우터와 새로고침 404 🔴
- 원리는 [가이드 3장 표](frontend-guide.md#브라우저-라우터-vs-해시-라우터-배포에서-겪은-일)에 있다. 요약하면, `/burrow`를 새로고침하면 브라우저가 서버에 `/burrow`라는 **파일**을 요청하고, 정적 서버에는 그런 파일이 없어서 404를 준다.
- 이 프로젝트: 일반 빌드는 `createBrowserRouter`, 공유 빌드만 해시 라우터다 (`App.tsx:4`, `.env.share`). 그래서 **실제 서버에 일반 빌드를 올리면 반드시 아래 설정이 필요하다.**
  - (가정) Nginx:
    ```nginx
    location / {
      root /usr/share/nginx/html;
      try_files $uri $uri/ /index.html;          # 모르는 경로는 index.html
    }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location /api/ { proxy_pass http://backend:8080; }
    location /ws {
      proxy_pass http://backend:8080;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 3600s;                   # 기본 60초면 조용한 소켓이 끊김
    }
    ```
  - S3 + CloudFront: 403·404 에러 응답을 `/index.html`(200)로 돌려주는 설정을 한다. 이때 `/api`는 CloudFront 별도 동작으로 분리한다. 안 그러면 API 404도 index.html로 바뀌어 JSON 파싱 에러가 난다.
  - Spring이 정적 파일까지 서빙하는 경우 (가정): API가 아닌 경로를 `forward:/index.html`로 넘기는 컨트롤러가 필요하다.
- 하위 경로 배포(`https://도메인/digul/`): `vite build --base=/digul/`과 라우터의 `basename`을 **둘 다** 바꿔야 한다. 공유 빌드의 `--base=./`(상대 경로)는 해시 라우터라서 동작한다. 브라우저 라우터에서 `./`를 쓰면 `/burrow/yerin`처럼 깊은 경로에서 `assets/...`를 잘못된 위치에서 찾는다.

### D2. 재배포 뒤 옛 탭의 청크 404 🟠
- **무엇이 터지나**: 사용자가 앱을 열어 둔 채로 재배포가 되면, 그 탭에서 처음 땅굴에 들어갈 때 3D 청크(`RoomCanvas-옛해시.js`)를 받지 못한다 (`Failed to fetch dynamically imported module`). 에러 경계가 없어서(B3) 앱 전체가 에러 화면이 된다.
- **왜**: 파일 이름의 해시는 캐시를 깨는 좋은 방법이다 (가이드 7장). 하지만 옛 `index.js`는 옛 해시 이름을 기억하고 있는데, 서버에서는 그 파일이 지워졌다. 공유 아티팩트 절차는 "옛 해시 파일은 null"로 **지운다** (`CLAUDE.md` 배포 절차).
- **어디**: `RoomView.tsx:6`, `FieldView.tsx:4`의 `lazy(() => import(...))`.
- **해결**:
  1. lazy 로드가 실패하면 한 번만 `location.reload()`하는 래퍼를 둔다. 무한 새로고침을 막으려고 sessionStorage에 표시한다. Vite의 `vite:preloadError` 이벤트를 써도 된다.
  2. 실제 서버에서는 옛 assets를 한두 번 배포하는 동안 남겨 둔다.
  3. RoomView는 실패해도 자리표시 이미지(`room-cutout.png`)를 계속 보여 주면 된다. 그래서 RoomView 주변에만 작은 에러 경계를 두는 것이 사용자 경험상 가장 좋다.

### D3. 환경 변수 🟠
- **`"0"`도 참**: `import.meta.env`의 값은 항상 **문자열**이다. `App.tsx:4`의 `import.meta.env.VITE_HASH_ROUTER ? ...`는 `VITE_HASH_ROUTER=0`이나 `=false`로 끄려고 해도 `"0"`이 참이라 계속 해시 라우터가 된다. → `=== '1'`로 비교하거나 변수를 지운다.
- **`VITE_`로 시작하는 값은 공개된다**: 빌드할 때 JS에 **글자 그대로 박힌다.** 누구나 개발자 도구에서 볼 수 있다. API 비밀 키, DB 주소, 관리자 토큰은 절대 넣으면 안 된다. 카카오맵 JS 키처럼 원래 공개용인 키만 넣고, 도메인 제한을 건다.
- **`.env.local`이 무시 목록에 없다**: 루트 `.gitignore`(1~10줄)에 `*.local`이나 `.env.*.local`이 없다. Vite 관례대로 개인 설정을 `app/.env.local`에 두면 **커밋에 섞여 올라간다.** → `.gitignore`에 `app/.env*.local`을 추가한다.
- 모드별 파일: 지금은 `.env.share`(공유 빌드 `--mode share`)만 있다. API 주소처럼 환경마다 다른 값이 생기면 `.env.development`/`.env.production`으로 나누고, 타입은 `vite-env.d.ts`의 `ImportMetaEnv`에 선언한다.

### D4. 캐시 🟠
- 해시가 붙은 파일은 오래 캐시해도 안전하다. 하지만 **`index.html`이 캐시되면** 새 배포의 새 해시 파일을 가리키지 못해서 옛 화면이 계속 보인다.
- 대비: `index.html`은 `no-cache`(재검증), `assets/`는 `immutable`로 둔다 (D1의 Nginx 예시). CDN을 쓰면 배포할 때 `index.html`만 무효화한다.
- `room-cutout.png`(344KB)와 두더지 아이템 PNG도 해시가 붙어 같은 규칙을 따른다.

### D5. 아티팩트 배포(팀 공유본)의 제약 🟢
지금 공유본만의 제약이다. 실제 서비스 배포와 섞지 않도록 정리해 둔다.
- **외부 리소스**: 외부 CSS가 막혀서 Pretendard를 번들에 넣었다 (`main.tsx:5-6`). Google Fonts만 예외로 허용된다 (`share-page.mjs:8-10`). 외부 API, 지도 SDK, 분석 스크립트를 추가하면 공유본에서는 동작하지 않는다.
- **주소**: 경로를 바꿀 수 없어서 해시 라우팅을 쓴다 → OAuth 콜백, 경로 기반 딥링크 공유가 불가능하다. 공유본은 "로그인된 척하는 데모"로 두고, 실제 인증은 실서버에서만 시험한다 (`App.tsx:34`에서 첫 화면을 `/burrow`로 보냄).
- **파일 관리**: `files.json`은 `dist-share/assets`의 **모든** 파일을 나열한다 (`share-page.mjs:16`). 바뀐 파일만 골라 보내고 옛 해시 파일을 `null`로 지우는 일은 손으로 한다 → 빼먹으면 옛 파일이 쌓이거나 새 파일이 빠진다. 용량 한도는 페이지·파일당 16MB로 여유가 있다.
- **소유권**: 만든 계정만 갱신할 수 있다 (`CLAUDE.md`).

---

## 4. 지금 바로 하면 좋은 예방 작업 Top 8

| 순위 | 작업 | 막는 위험 | 난이도 | 예상 시간 |
|---|---|---|---|---|
| 1 | `<Room key={room.id} />`, `VisitBurrow`에도 `key={userId}` (라우트 엘리먼트에 키) | B4 지금 있는 버그 | 쉬움 | 10분 |
| 2 | 라우트에 `errorElement` + 3D 주변 작은 에러 경계 + lazy 실패 시 한 번 새로고침 | B3, D2 | 쉬움 | 반나절 |
| 3 | 목 데이터의 날짜를 전부 ISO로 통일하고, 표시는 `format.ts`에서만 하기 | B2 | 쉬움 | 1~2시간 |
| 4 | `src/api/` 데이터 접근 계층 + 훅(`useMeetup` 등)이 목을 `Promise`로 돌려주게 → 로딩·에러·빈 상태 화면 만들기, `<Navigate>` 기반 "없음" 처리 고치기 | B1, B3 | 중간 | 2~3일 |
| 5 | `useMe()` / `AuthProvider` / `<RequireAuth>` 자리 만들기 (지금은 목 사용자 반환) | B5 | 중간 | 반나절 |
| 6 | `vite.config.ts`에 `/api`, `/ws` 프록시 자리 추가, `fetch`는 상대 경로만 쓰는 규칙 | B6 | 쉬움 | 30분 |
| 7 | `.gitignore`에 `app/.env*.local` 추가, `VITE_HASH_ROUTER === '1'` 비교 | D3 | 쉬움 | 10분 |
| 8 | 백엔드 팀과 아래 API 규약 합의 (특히 날짜·ID·페이지·에러 형식) | B2, B7, B8 | 회의 1번 | 1시간 |

1, 2, 3, 7은 백엔드 없이 오늘 할 수 있다. 4가 끝나면 백엔드가 붙을 때 화면 코드를 거의 고치지 않아도 된다.

---

## 5. 백엔드 팀과 미리 합의할 체크리스트

### 체크리스트
- [ ] 배포 구조: 같은 도메인 + `/api` 프록시(추천) vs 다른 도메인(CORS·쿠키 설정 필요)
- [ ] 인증: 쿠키(HttpOnly, SameSite, CSRF) vs Bearer 헤더. 액세스·리프레시 토큰 수명, 401·403 의미
- [ ] 소셜 로그인 리다이렉트 URI (경로 방식, 개발·운영 각각)
- [ ] 날짜: 순간은 ISO 8601 + 오프셋, 날짜만은 `YYYY-MM-DD`, 기준 시간대 `Asia/Seoul`
- [ ] ID: JSON에서 문자열로
- [ ] 목록: 게시판은 `page/size`, 채팅·방명록·알림은 `cursor`. 응답 모양 통일
- [ ] 에러 응답 형식과 에러 코드 목록 (정원 초과, 중복 신청, 차단된 사용자 등)
- [ ] 필드 이름 표기 (camelCase), null과 필드 없음의 차이, 빈 배열은 `[]`로
- [ ] 채팅: WebSocket/STOMP 경로, 구독 주제, `clientMessageId`, 방별 `seq`, 하트비트, 재연결 뒤 기록 조회 API
- [ ] 업로드: presigned URL 여부, 최대 크기, 허용 형식, Nginx `client_max_body_size`
- [ ] 꾸미기 저장 형식 `schemaVersion`, 아이템 ID 목록 관리 주체 (프론트 상수 vs 서버 테이블)
- [ ] 서버가 강제할 규칙: 비로그인 열람 3개, 방명록 7일, 모임 정원, 꾸미기 아이템 개수
- [ ] API 문서: Swagger/OpenAPI를 열어 주면 프론트에서 타입을 자동 생성할 수 있음 (`openapi-typescript`)

### API 규약 초안
```http
GET /api/meetups?page=1&size=10&interest=캠핑
200
{
  "items": [ { "id": "42", "title": "...", "date": "2026-11-15", "start": "19:00", ... } ],
  "page": 1, "size": 10, "totalItems": 37, "totalPages": 4
}

GET /api/chat/rooms/7/messages?before=seq_1200&size=30
200
{ "items": [ { "id": "9001", "seq": 1199, "clientMessageId": "b3f…", "authorId": "12",
               "text": "안녕하세요", "createdAt": "2026-11-11T05:12:30.120Z" } ],
  "nextCursor": "seq_1169" }

POST /api/meetups/42/applications
409
{ "code": "MEETUP_FULL", "message": "정원이 다 찼어요", "status": 409,
  "traceId": "a1b2…" }
```
- 성공은 리소스 그대로(또는 `items` + 페이지 정보), 실패는 `{ code, message, status, traceId }` 하나로 통일한다. 프론트는 `code`로 분기하고, `message`는 그대로 보여 줘도 되는 한국어로 받는다.
- 이 초안의 필드는 `app/src/data/types.ts`를 기준으로 했다. 합의되면 `types.ts`를 API 응답 타입으로 옮기고 목 데이터를 거기에 맞춘다.

---

## 6. 다음 단계
1. 4장의 1·2·3·7번(쉬움)부터 처리한다. 이건 코드 변경이라 Figma 반영 작업이 끝난 뒤 한다.
2. 백엔드 팀과 5장의 체크리스트로 회의하고, 결과를 `docs/api-contract.md`로 남긴다.
3. 데이터 접근 계층(4번)을 만들 때 TanStack Query를 쓸지 react-router `loader`를 쓸지 정한다. 추천은 TanStack Query다 (채팅·알림의 캐시 갱신과 낙관적 업데이트가 편하다).
