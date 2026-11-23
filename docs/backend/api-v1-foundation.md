# API v1 공통 계층과 영역 작업 규칙 (2026-11-22)

- 요청: 백엔드 확정 API 명세(v1, [team-spec/](team-spec/README.md))에 프론트를 맞추기 전에, 공통 계층을 먼저 만들고 영역 작업자 7명이 서로의 파일을 건드리지 않고 병렬로 작업할 수 있게 구조를 잡는다 ([계획](api-v1-alignment.md))
- 결론: `app/src/api/` 를 **영역 폴더 11개**로 나눴다. 공통 계층(HTTP 클라이언트 · 응답 틀 · 에러 · 목록 모양 · id · UTC 시각 · 목 서버 바탕 · SSE · 완성도 검사)은 다 만들었고, 옛 영역 코드는 **동작을 바꾸지 않고** 각 폴더로 옮겼다 (DTO 는 아직 옛 초안 모양, `LegacyId` 문자열 id). 백엔드가 구현한 6개(캠퍼스 · 기수 · 로그인 · 로그아웃 · 내 계정 · 실시간 연결)는 명세 모양으로 만들었다
- 다음: 영역 작업자가 자기 폴더의 DTO · 주소를 명세로 바꾸고 `PENDING` 을 비운다. 다 끝나면 `common/legacy.ts` 와 옛 사람 직렬화를 지운다 → **2026-11-22 영역 작업 · 공통 정리 끝** (아래 7장)
- 이어서 할 일(정해짐): API 작업이 끝나면 프론트를 **Vite → Next.js(App Router)** 로 옮기고 팀 리포로 옮긴다 → 아래 "Next.js 로 옮길 때를 위한 규칙"

---

## 1. 구조

```
app/src/api/
  client.ts        HTTP 클라이언트 (모든 영역 공용)
  config.ts        목/실제 전환(영역별) · 목 손잡이(?api=)
  queryClient.ts   TanStack QueryClient · 오류 토스트
  optimistic.ts    useOptimistic · patch · toastApiError (낙관적 업데이트)
  storeSync.ts     useMockStoreSync (목 모드에서 저장소가 바뀌면 캐시 새로 받기)
  mockSync.tsx     MockServerSync (영역 훅 10개를 부름, App.tsx AppLayout)
  endpoints.ts     ENDPOINTS_BY_AREA (완성도 검사용)
  index.ts         api = { common, auth, settings, onboarding, burrow, explore, chat, meetups, community, notifications, admin }
  mock/server.ts   목 서버 바탕: mockRead · mockWrite · notFound · conflict · invalidInput · paginate · cursorPage …
  common/          공통 DTO · id · 에러 문구 · 사람 매퍼 · 00 공통(캠퍼스 · 기수)
    types.ts  ids.ts  errors.ts  mappers.ts  mockPeople.ts  moleCodes.ts  real.ts  mock.ts  api.ts  queries.ts  index.ts  PENDING
  <영역>/          auth settings onboarding burrow explore chat meetups community notifications admin
    types.ts       DTO (명세 모양)
    real.ts        ENDPOINTS + 실제 서버 호출 (real 객체, 타입 <영역>Api = typeof real)
    mock.ts        목 서버 (같은 타입) + 저장소 → DTO 직렬화
    api.ts         <영역>Api = selectArea('<영역>', real, mock)
    mappers.ts     DTO → 앱 모양
    queries.ts     TanStack Query 훅 + <영역>Keys + use<영역>MockSync
    errors.ts      code → 화면 문구 표
    index.ts       영역 입구 (화면은 여기서 가져옴)
    PENDING        아직 안 만든 명세 API 목록
app/src/realtime/
  eventStream.ts   SSE 연결 (createEventStream) + 목 서버(mockEvents)
  events.ts        앱 전체가 쓰는 연결 하나 (eventStream · startEventStream · stopEventStream)
  useEventStream.ts  useEventStream · useRefetchOnReconnect · useEventStreamStatus
  backoff.ts · index.ts  다시 연결 간격 · 입구 (옛 STOMP 허브는 채팅 작업 때 지움)
```

### 영역 ↔ 명세 ↔ 작업자

| 폴더 | 명세 문서 | 작업자 | 지금 ENDPOINTS | PENDING |
|---|---|---|---|---|
| `common` | 00 (캠퍼스 · 기수) + 06 의 `GET /me/event-stream` 연결 | 공통 (끝) | 3 | 0 |
| `auth` | 02 | 인증 · 설정 | 3 (sessions · sessions/current · me) | 9 |
| `settings` | 10 | 인증 · 설정 | 0 | 13 |
| `onboarding` | 03 + 00 의 관심사 · 질문 · 프로필 팝업 | 온보딩 · 내 땅굴 | 0 | 5 |
| `burrow` | 04 | 온보딩 · 내 땅굴 | 0 | 5 |
| `explore` | 05 + 00 의 학기(`GET /terms`) | 탐색 · 방문 | 0 | 12 |
| `chat` | 06 (event-stream 제외) | 채팅 | 0 | 13 |
| `meetups` | 07 | 모임 | 0 | 20 |
| `community` | 08 (신고 `POST /reports` · 사진 `POST /images` 포함) | 커뮤니티 | 0 | 23 |
| `notifications` | 09 | 알림 | 0 | 5 |
| `admin` | 11 (명세 보류) | 없음 (그대로 둠) | 0 | — |

옛 파일이 간 곳: `meetups.ts → meetups/`, `board.ts → community/`, `burrows.ts → explore/`(남의 땅굴 · 방명록 · 단골 · 들판), `chat.ts → chat/`, `notifications.ts → notifications/`(목록 · 읽음) + `settings/`(알림 설정 · 공지), `members.ts → onboarding/`(프로필 · 닉네임 · 관심사 · 질문) + `burrow/`(프로필 수정 · 두더지) + `explore/`(추천) + `settings/`(차단 · 탈퇴), `reports.ts → community/`(신고) + `admin/`, `auth.ts → auth/`, `types.ts · mappers.ts · mock/serialize.ts → 각 영역의 types · mappers · mock`, `queries.tsx → 각 영역 queries.ts + optimistic.ts + mockSync.tsx`.

---

## 2. 영역 작업자 규칙 (브리프에 그대로 붙임)

### 고치는 범위
1. **자기 영역 폴더 `app/src/api/<영역>/` 안만 고친다.** 공통 파일(`client.ts` · `config.ts` · `optimistic.ts` · `queryClient.ts` · `storeSync.ts` · `mockSync.tsx` · `endpoints.ts` · `index.ts` · `mock/server.ts` · `common/*` · `realtime/eventStream.ts · events.ts · useEventStream.ts`)은 고치지 않는다. 공통에 필요한 게 있으면 보고만 하고, 급하면 자기 폴더에 두고 보고한다
2. 다른 영역 것은 그 영역의 `index.ts`(또는 이미 쓰던 `mock.ts`의 직렬화)로 **가져다 쓰기만** 한다. 그 영역이 DTO 를 바꾸면 깨질 수 있으므로, 명세가 내 영역 문서에 정의한 모양(예: 커뮤니티 글의 모임 카드)은 내 폴더에 따로 만든다
3. 화면(`screens/<내 영역>/…`), 그 영역 저장소(`data/<내 영역 Store>.ts`), 그 영역 시험은 고쳐도 된다. 라우트(`App.tsx`)·공용 컴포넌트를 고쳐야 하면 최소한으로, 보고에 적는다
4. `app/src/three/mole.ts`, `furniture.ts` 는 생성 파일이라 고치지 않는다

### API 하나를 명세대로 만드는 순서
1. `types.ts` 에 명세의 요청 · 응답 DTO 를 **명세 그대로** 적는다: id 는 `Id`(숫자), 시각은 `UtcInstant`("…Z"), 날짜만은 `DateString`, enum 은 대문자 유니언, 값이 없으면 `null`(필드를 빼지 않음). 사람은 `UserDisplayDto`, 관심사는 `InterestTagDto`, 두더지는 `MoleDto`, 목록은 `ItemsDto<T>` · `PageDto<T>` · `CursorPageDto<T>` (모두 `'../common'`)
2. `real.ts` 에 함수를 만들고 **`ENDPOINTS` 에 `'메서드 /api/v1/주소'` 를 명세 제목 그대로** 적는다 (id 자리는 `{meetupId}` 처럼 명세 이름). 호출 경로는 `/api/v1` 뒤만 쓴다: `http.get<MeetupDetailDto>(\`/meetups/${id}\`, undefined, signal)`. 경로 조각은 `seg(id)` 로 감싸도 된다
3. 같은 API 줄을 **`PENDING` 에서 지운다** (ENDPOINTS 와 PENDING 에 둘 다 있으면 시험 실패)
4. `mock.ts` 에 같은 시그니처로 목 구현 (`mock: <영역>Api`). 아래 "목 서버" 규칙
5. `mappers.ts` 에 DTO → 앱 모양. 화면은 매퍼 결과만 쓴다
6. `queries.ts` 에 훅. 캐시 키는 `<영역>Keys` (첫 칸이 영역 이름: `['meetups', …]`). 다른 영역 캐시를 무효화해야 하면 그 영역 `index.ts` 의 키를 가져다 쓴다
7. `errors.ts` 에 명세 "에러" 표의 `code` 마다 화면 문구. 화면은 `errorText(e, MEETUP_ERRORS)` 또는 `useOptimistic` 의 `errors: MEETUP_ERRORS`
8. 화면이 `data/*Store` 를 바로 부르던 쓰기(글쓰기 · 모임 만들기 · 보내기 등)도 API 로 옮긴다
9. 옛 초안 함수 · 타입(`LegacyId`, `MemberSummaryDto` …)은 다 옮기면 지운다 (2026-11-22 지움, 명세 보류인 관리자 영역만 자기 types 에 둠). 명세에 없는 기능은 화면에서도 뺀다 ([계획](api-v1-alignment.md) 결정 2)
10. `cd app && npx tsc -b --noEmit && npm test && npm run build` 가 통과해야 한다

### 응답 · 에러 (client.ts 가 이미 함)
- 성공 틀 `{ success, data, error }` 는 클라이언트가 풀어서 **`data` 만** 돌려준다. 목록은 `data` 그대로(`{ items, … }`). 돌려줄 값이 없는 API 의 반환 타입은 `null`
- 실패는 모두 `ApiError{ status, code, message, fields, detail }`. 분기는 **`code` 로만** (명세: message 글자로 분기 금지). `isNotFound(e)`(404) · `isUnauthorized(e)`(401) · `isApiError(e) && e.code === 'MEETUP_FULL'`
- 입력 오류: 400 `INVALID_INPUT` + `fields[{field, message}]`. 칸 밑 문구는 `fieldError(e, 'nickname')`(lib/validation) 또는 `fieldErrorText`
- 네트워크 끊김 `status 0 / NETWORK`, 타임아웃 `status 0 / TIMEOUT`. GET 만 자동 재시도(네트워크 · 408 · 429 · 502~504, 2번)
- **401 은 갱신 API 가 없으므로 바로 `onUnauthorized` → 로그인 화면**(`lib/authFlow`, 지금은 `LOGIN_FREE` 라 기록만). 401 이 "로그인 안 함"이라는 정상 답인 호출(GET /me 등)은 `{ quiet401: true }`, TanStack 훅이면 `meta: { quiet401: true }` (공용 `queryClient` 가 봄, 로그인 · 가입 훅 `useLogin` 등)
- `403 ONBOARDING_INCOMPLETE` · `NEW_TERM_INCOMPLETE` 는 어느 API 에서나 올 수 있다 (공통 문구는 `common/errors.ts`). `ONBOARDING_INCOMPLETE` 는 공용 `queryClient` 가 `handleOnboardingIncomplete()`(온보딩 1 로), `NEW_TERM_INCOMPLETE` 는 탐색의 새 학기 안내(`NewTermGate`)
- 파일 올리기(`POST /images`)는 `http.post('/images', formData)` — FormData 면 클라이언트가 multipart 로 보낸다

### 목 서버
- `mockRead(fn, { signal, empty, detail })`(GET, 재시도 규칙 같음) · `mockWrite(fn)`(쓰기, 재시도 없음). 반환값은 JSON 복사돼서 나간다
- 실패는 명세 code 로 던진다: `notFound('MEETUP')` → 404 `MEETUP_NOT_FOUND` · `conflict('MEETUP_FULL', '…')` · `badRequest(code, msg)` · `invalidInput({ nickname: '12자를 넘을 수 없습니다.' })` → 400 `INVALID_INPUT` + fields · `forbidden(msg, code?)` · `unauthenticated()`
- 목록: `items(all)` · `paginate(all, page, size)`(page 1부터) · `cursorPage(all, cursor, size)`(hasNext) · `emptyPage()` · `emptyCursor()`
- 상세 조회는 `detail: 'MEETUP'` 을 주면 `?api=notfound` 손잡이에서 `MEETUP_NOT_FOUND` 로 실패한다. 목록은 `empty: () => emptyPage()` 를 주면 `?api=empty` 에서 빈 목록
- 손잡이: `?api=slow|fast|fail|flaky|writefail|empty|notfound|unauth` (fail · writefail = 500 `INTERNAL_ERROR`, unauth = 401 `UNAUTHENTICATED`, flaky = 가끔 `NETWORK`)
- 사람은 `common/mockPeople.ts`: 명세 모양 `userDisplay(id)` · `interestTags(id)` · `moleDto(worn)`. 두더지 코드는 늘 `common/moleCodes.ts` 를 거친다(보낼 때 대문자 `CAP_RED`, 받을 때 앱 아이템 id)
- 알림: 받는 사람이 나인 일만 `pushMockNotification(type, { actorId, targetId })` 또는 `notifyMockUser(받는 사람, type, …)` (`api/notifications/mock`). 목 계정은 나 하나라 "다른 사람이 한 일" 흉내(`mock*Actors`, 개발 콘솔 `__digulMock`)와 채팅 상대 메시지 · 받은 요청에서 생긴다
- 목 저장소가 바뀌면 캐시를 새로 받게 하려면 자기 `queries.ts` 의 `use<영역>MockSync()` 안에 `useMockStoreSync('<영역>', useXxxStore(), <영역>Keys.all)` (훅은 이미 `mockSync.tsx` 가 부름)

### id
- **DTO 는 숫자, 앱(화면 · 주소 · data/*Store)은 문자열.** 바꾸기는 `toAppId(n)`(DTO → 앱) · `toDtoId(s)`(앱 → 요청 경로 · 본문 · 목 응답), 선택 칸은 `toAppIdOrNull` · `toDtoIdOrNull`
- 실제 서버: `31 ↔ '31'`
- 목 서버: 저장소 id 가 `'m1'` · `'yerin'` · `'서울|2'` 같은 글자라서, 목 `mock.ts` 가 DTO 를 만들 때 `toDtoId('m1')` → 큰 번호(9×10¹¹ 위)를 표에 적고, 매퍼의 `toAppId(그 번호)` → `'m1'` 로 되돌아온다. 그래서 주소(`/meetups/m1`)와 저장소는 그대로 두고 DTO 만 명세처럼 숫자가 된다. 목 번호는 실제 id 와 겹치지 않아 영역마다 real/mock 을 섞어도 안전하다. 목 번호를 주소 · 저장소에 넣지 말 것(탭이 바뀌면 다른 번호)
- 목 요청을 받을 때(목 `mock.ts` 의 인자)는 숫자 id 를 `toAppId(id)` 로 저장소 id 로 바꿔 찾는다
- 관심사 · 질문처럼 앱이 **뜻 있는 코드**(`cafe_coffee`)를 쓰는 값은 숫자 id 와 따로 이어야 한다 (이름으로 잇거나 표). 온보딩 작업자가 정한다

### 시각
- 서버는 UTC `"2026-11-18T08:01:05Z"`, 날짜만은 `"2026-11-18"`. 읽기 `parseIso(s)`(ms), 보내기 · 목 응답 `toIso(ms)`(→ "…Z", 초 아래 버림), 모양 검사 `isUtcInstant` · `isDateString` — 모두 `lib/time.ts`
- 화면 표시는 늘 서울 시각 (`clock` · `monthDay` · `agoBoard` …). "3분 전" 같은 문구는 서버가 주지 않고 프론트가 만든다
- `parseIso('2026-11-18')` 은 서울 그날 0시. 달력 값은 가능하면 문자열 그대로 쓴다

### 실시간 소식 (SSE)
- 연결은 계정마다 하나: `GET /api/v1/me/event-stream` (공통이 만듦, `App.tsx` AppLayout 에서 `startEventStream()`). **영역마다 연결을 열지 않는다**
- 받기: `useEventStream<T>('NOTIFICATION_UNREAD_CHANGED', (d) => …)` 또는 `eventStream().subscribe(name, handler)`. 값의 타입은 자기 `types.ts` 에, 받는 코드는 자기 `queries.ts` 에
- **끊긴 동안의 소식은 오지 않는다** → `useRefetchOnReconnect([notificationKeys.all])` 로 다시 붙으면 조회 API 로 맞춘다
- 목: 자기 `mock.ts` 에서 서버가 보낸 것처럼 `mockEvents.emit('CHAT_MESSAGE_CREATED', { chatRoomId, message, unreadCount })`. 끊김 흉내 `mockEvents.drop(3000)`, 개발 서버 콘솔에서는 `__digulEvents.mock`
- 보내기(메시지 등)는 일반 API(`POST /chat-rooms/{id}/messages`). 옛 STOMP 허브(`realtime/hub.ts` …)는 채팅 작업자가 SSE + REST 로 옮긴 뒤 지운다
- 로그아웃 · 탈퇴 뒤 `afterSignOut()`(`lib/signOut.ts`)이 `stopEventStream()` · 캐시 비우기

### 실제 서버로 바꾸기
- 백엔드가 그 영역을 구현하면 `app/.env.development.local` 에 `VITE_API_REAL_AREAS=common,auth,meetups` 처럼 영역을 더한다 (실시간 연결은 `events`). 전부 실제로는 `VITE_API_MODE=real`, 그중 일부만 목은 `VITE_API_MOCK_AREAS=chat`
- 개발 서버가 `/api` 를 `http://localhost:8080` 으로 넘긴다 (`vite.config.ts`, 바꾸려면 `DEV_PROXY_TARGET`, 끄려면 `off`). 같은 출처라 CORS · 쿠키 문제가 없다. 세션 쿠키 `ITTING_SESSION` 은 `Secure` 지만 브라우저가 `http://localhost` 는 예외로 받아 준다
- 영역 폴더의 `api.ts` 가 `selectArea('<영역>', real, mock)` 으로 고르므로 화면 코드는 그대로다

### Next.js 로 옮길 때를 위한 규칙 (2026-11-22 결정)
API 작업 뒤 프론트를 Vite → **Next.js(App Router)** 로 옮겨 팀 리포에 넣는다. 그때 손이 덜 가도록:
- **환경 변수는 `app/src/lib/env.ts` 의 `ENV` 로만 읽는다.** 새 코드에 `import.meta.env` 를 쓰지 않는다 (옮길 때 이 파일 하나만 `process.env.NEXT_PUBLIC_…` 로 바꾸면 되게). `api/config.ts` · `lib/time.ts` · `realtime/events.ts` 는 이미 `ENV` 를 쓴다
- **개발 프록시는 `vite.config.ts` 에만** 둔다 (Next 에서는 `next.config` 의 rewrites 로 옮김). 코드에 백엔드 주소를 박지 않는다 (`/api/v1` 상대 경로)
- **API · 실시간 계층에서 모듈 맨 위(불러올 때 바로 도는 코드)에서 `window` · `document` · `location` · `sessionStorage` · `EventSource` 를 만지지 않는다.** Next 는 모듈을 서버에서도 불러온다. 꼭 필요하면 함수 안에서 `typeof window !== 'undefined'` 로 막는다 (`config.ts` 의 손잡이 읽기, `realtime/events.ts` 의 `startEventStream` 처럼)
- 참고: `data/*` 의 목 저장소 일부(`data/auth.ts` 등)는 불러올 때 `sessionStorage` 를 읽는다(try/catch 로 막혀 있음). 목 서버는 브라우저에서만 돈다고 보고, Next 로 옮길 때 목은 클라이언트 컴포넌트 쪽에만 둔다

---

## 3. 완성도 검사

`app/src/tests/api-v1-endpoints.test.ts`
- 명세 `docs/backend/team-spec/api/*.md` 의 `## GET /api/v1/…` 제목 111개를 읽어, 모든 영역의 `ENDPOINTS` 와 `PENDING` 에 나눠 맡겨졌는지 본다
- **실패하는 때**: 명세에 있는데 아무 영역도 맡지 않음 / ENDPOINTS · PENDING 에 명세에 없는 주소(오타 · 옛 주소) / 두 영역이 같은 API / 한 영역의 ENDPOINTS 와 PENDING 에 둘 다
- `PENDING` 에 남은 것은 영역별 `it.todo` 로 보인다 (CI 를 막지 않음). 모든 `PENDING` 이 비면 명세를 다 맞춘 것 → 그때 PENDING 기능을 없애고 "모두 ENDPOINTS 에" 로 바꿔도 된다
- 명세가 바뀌어 사본(`team-spec/`)을 새로 받으면 이 시험이 새 API · 없어진 API 를 바로 알려 준다

---

## 4. 정한 것 · 바뀐 것

- **영역 이름**: 계획의 "커뮤니티"는 `community`(옛 `board`), "탐색 · 방문"은 `explore`(옛 `burrows`), "내 땅굴"은 `burrow`. `api.board` · `api.burrows` 는 없어지고 `api.community` · `api.explore`. 화면 import 를 그에 맞게 바꿨다 (동작은 같음)
- **캐시 키**: 공용 `qk` 를 없애고 영역마다 `<영역>Keys`. 첫 칸이 바뀐 곳: `posts → community`, `burrows → explore`
- **ENDPOINTS 에 이미 넣은 6개**: `GET /campuses` · `GET /generations` · `GET /me/event-stream`(common), `POST /sessions` · `DELETE /sessions/current` · `GET /me`(auth). 화면은 아직 이것들을 안 부른다 (로그인 화면 연결은 인증 작업자)
- **목 세션**: `data/auth.ts` 의 `authState()` 가 곧 세션. `LOGIN_FREE = true` 인 지금은 로그인이 늘 성공하고 `GET /me` 도 늘 로그인 상태. `false` 면 guest 일 때 `GET /me` 가 401, 시연 계정(wrong@ → `LOGIN_FAILED`, banned@ → `ACCOUNT_SUSPENDED` + detail{reason, endsAt}, new@ → `nextStep: ONBOARDING`)
- **refresh 없앰**: `POST /auth/refresh` 시도 코드를 지웠다. `setAuthHeaderProvider` · `newIdempotencyKey`(쓰는 곳 없음)도 지웠다
- **목 서버 손잡이 코드**: fail · writefail 은 503/커스텀 코드 → 500 `INTERNAL_ERROR`, unauth 는 `UNAUTHORIZED` → `UNAUTHENTICATED`, flaky 는 503 → 네트워크 끊김(status 0, GET 재시도는 그대로 확인됨)
- **`toIso` 가 "+09:00" 대신 UTC "…Z"** 를 만든다 (명세). 읽기는 둘 다 되므로 화면은 같다
- **오류 토스트 문구**: `errorText(e, 표)` — 영역 표 → 공통 표 → (입력 오류면 첫 칸) → 서버 message → 상태 코드 기본 문구. 영역 표를 안 넘기면 지금처럼 서버(목) message 가 나온다. 공통 코드(`INTERNAL_ERROR` 등)는 공통 문구
- **손잡이 배지 · 목 동기화**는 영역이 하나라도 목이면 켜진다 (`ANY_MOCK`)
- **Vite 프록시 기본값** `http://localhost:8080` (전에는 변수가 없으면 프록시 없음)
- 11 운영 · 관리자(`admin/`)는 명세가 보류라 옛 초안 그대로, ENDPOINTS · PENDING 없음

## 5. 명세에서 애매하거나 확인할 것

- **`GET /me/event-stream` 이 06 채팅 문서에 있다.** 연결은 공통이 맡았으므로 `common` ENDPOINTS 에 넣었다. 채팅 작업자는 소식(`CHAT_MESSAGE_CREATED` · `CHAT_REQUEST_COUNT_CHANGED`)만 다룬다
- **SSE 와 401**: 브라우저 `EventSource` 는 상태 코드를 못 본다. 연결이 연속 2번 실패하면 `GET /me` 로 로그인을 확인해 401 이면 멈추고 로그인 화면으로 보낸다. 세션이 살아 있는 동안 연결 하나가 계속 열려 있으면 서버의 "쓸 때마다 14일 연장"이 SSE 연결에도 적용되는지는 백엔드 확인 필요
- **`Secure` 세션 쿠키와 개발 환경**: 로컬은 `http://localhost` 라 브라우저가 받아 주지만, 다른 이름(예: `127.0.0.1` · 사내 IP)으로 열면 쿠키가 안 실릴 수 있다. 개발은 `localhost` 로 열 것
- **CORS 허용 출처** 명세 기본값이 `http://localhost:3000` 이다. Vite 개발 서버(5173)는 프록시라 상관없지만, Next 로 옮기면 3000 이 되어 맞는다
- **관심사 · 질문 id**: 명세는 숫자 id, 앱은 뜻 있는 코드(`cafe_coffee`). 프론트가 가진 가구 · 아이콘 표와 잇는 방법(이름으로? 코드 칸 추가?)을 백엔드와 정해야 한다 (온보딩 작업자)
- **신고 대상**: `POST /reports` 는 08 문서지만 모임 · 방명록 · 프로필 신고도 같은 API 다. 커뮤니티 작업자가 만들고 다른 영역은 `api/community` 의 것을 쓴다
- 명세 제목 수는 111개로 계획 문서와 같다 (00 6 · 02 12 · 03 2 · 04 5 · 05 11 · 06 14 · 07 20 · 08 23 · 09 5 · 10 13)

## 6. 확인한 것
- `npx tsc -b --noEmit` · `npm test`(33 파일, 434 통과 · 107 todo: PENDING 105 + 원래 2) · `npm run build` 통과
- 개발 서버(5401)에서 스모크로 `/meetups`(20화면) · `/board`(16) · `/notifications`(3) · `/chat`(9) · `/burrow/`(10) 모두 OK (콘솔 에러 · 실패 요청 없음, 목 데이터 그대로)
- 새 시험: `api-common.test.ts`(틀 풀기 · 에러 · 401 · 재시도 · id · 목록 · 문구), `event-stream.test.ts`(구독 · 재연결 · onReconnect · 끊긴 동안 소식 없음 · 로그인 확인), `time-utc.test.ts`(UTC → 서울 표시, 날짜만)

## 7. 영역 작업을 합친 뒤 공통 정리 (2026-11-22)

영역 작업자 7명이 자기 폴더 밖이라 못 한 것을 한 번에 정리했다. 바뀐 기능 목록은 [api-v1/feature-changes.md](api-v1/feature-changes.md), 백엔드 질문 모음은 [api-v1/questions-for-backend.md](api-v1/questions-for-backend.md)

| 무엇 | 지금 |
|---|---|
| 방명록 목 저장소 | `data/guestbookStore.ts` 하나 (04 목록 · 지우기 · 신고 대상, 05 쓰기 · 글 수). 탐색의 다리 함수(`guestbookPage` · `deleteGuestbookEntry` · `useVisitGuestbook`)를 지우고 방문자 뷰도 `api/burrow` 의 `useGuestbookEntries` · `useDeleteGuestbookEntry` (5개씩 서버 페이지). 내 정보 수정으로 캠퍼스-층이 바뀌면 목이 `moveMyBurrow` |
| 두더지 코드 | `api/onboarding/moleCodes.ts` → `api/common/moleCodes.ts`. 목 사용자 표시(`mockPeople.moleDto`)와 사람 매퍼(`wornOf`)도 이것을 거쳐 실제 서버의 대문자 코드로도 모든 화면에 아이템이 보임 |
| 다른 영역 API 대신 부르기 | 채팅의 모임 나가기 = `meetupCalls.cancelParticipation`, 사진 = 커뮤니티 `uploadImage`(목 사진 저장소도 하나), 옛 `api.chat.sendRequest` 삭제. 모임 상세의 대화 미리보기 = `useChatPreview`(06 메시지 `size=3`), 링크는 응답의 `chatRoomId` |
| 차단 | 남은 것 모두 삭제 (`data/account` 의 차단 목록, 채팅 목의 거르기) |
| 알림 | 위 2장 "목 서버"의 알림 줄. 대화방 읽음이 그 방 메시지 알림도 읽음(`markChatNoticesRead`) |
| 공용 QueryClient | `meta.quiet401` · 403 `ONBOARDING_INCOMPLETE` (`setOnboardingIncompleteHandler`, `main.tsx` 가 끼움). 목: 온보딩 확정 → `setMockNextStep('HOME')`, 새 학기를 안 고른 동안 `GET /me` 의 `nextStep` 이 `NEW_TERM` |
| 글자 수 | `lib/validation.ts` `RULES` 하나가 원본이고 명세 값 (모임 소개 1,000 · 준비물 · 장소 · 상세 주소 100 · 접속 링크 500, 채팅 1,000 · 공지 200, 검색어 50). `MEETUP_LIMITS` · `CHAT_MESSAGE_MAX` · `CHAT_NOTICE_MAX` · `KEYWORD_MAX` 는 RULES 에서 읽음 |
| 신고 본문 | `reportBody(targetType, id, 사유)` → 명세 `ReportRequest` 그대로 (옛 `MEETUP` 대상 없음) |
| 지운 옛 코드 | `common/legacy.ts` · `memberSummary` · `memberProfile` · `toPerson` · `toId`, `ENV.realtime` · `ENV.wsPath` · `WS_URL` · `VITE_REALTIME` · `VITE_WS_URL` · `/ws` 개발 프록시, `stopChatRealtime`, 화면이 안 쓰는 저장소 함수 몇 개(`data/chat useChat` 등) |

