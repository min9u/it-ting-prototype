# 프론트 데이터 계층 (API · 목 서버 · 화면 상태)

> **이 문서는 옛 기록이다 (2026-11-22 대체됨)**: 백엔드 확정 명세(v1)에 맞춰 `api/` 구조를 영역 폴더로 나눴고(`api/queries.tsx` · `types.ts` · `mappers.ts` · `api/<영역>.ts` · `api/mock/serialize.ts` 는 없어짐), 실시간은 WebSocket 대신 SSE 하나, 401 리프레시는 없어졌다. **지금 구조와 규칙은 [api-v1-foundation.md](api-v1-foundation.md)**(합친 뒤 정리는 7장), 영역별 결과는 [api-v1/](api-v1/), 바뀐 기능은 [api-v1/feature-changes.md](api-v1/feature-changes.md). 아래는 2026-11-16 기록으로만 둔다

- 날짜: 2026-11-16
- 요청: 백엔드 API 명세가 나오기 전에 프론트를 연결에 대비시키기 — API 계층, 목 서버, 로딩·에러·없음 상태, 날짜 통일
- 결론: 화면은 이제 `api/queries.tsx` 훅으로 데이터를 받는다. 지금은 **목 서버**(메모리 저장소를 "가짜 서버"로)가 실제 서버와 같은 모양·같은 실패를 낸다. `VITE_API_MODE=real` 로 바꾸면 같은 화면이 실제 서버를 부른다
- 같이 볼 것: 계약 초안 [api-draft.md](api-draft.md), ERD 질문 [erd-gaps.md](erd-gaps.md), 위험 분석 [../dev-deploy-risks.md](../dev-deploy-risks.md) (B1 · B2 · B3 · B7 · B8 · B9 · B11)

---

## 1. 구조

```
 화면 (screens/*)                          components/AsyncState.tsx
   │  const q = useMeetupDetail(id)        ├ QueryGate: 불러오는 중 → 스켈레톤 / 404 → NotFound / 오류 → 다시 시도
   │  run.mutate({ call, patches })        ├ Skeleton · SkeletonCards · SkeletonRows · DetailSkeleton
   ▼                                       ├ ErrorState · EmptyState
 api/queries.tsx  (TanStack Query 훅)       └ ApiToaster (쓰기 실패 토스트) · ApiKnobBadge (목 손잡이 배지)
   │  캐시 키 api/queryClient.ts qk
   │  응답 DTO → api/mappers.ts → 앱 모양 (data/types.ts, MeetupX, BoardPost …)
   ▼
 api/index.ts   api.meetups.get(id) …
   │
   ├─ VITE_API_MODE=real ─▶ api/<영역>.ts 의 real ─▶ api/client.ts (fetch: /api, 쿠키, 타임아웃, 401 리프레시, GET 재시도) ─▶ 서버
   │
   └─ VITE_API_MODE=mock ─▶ api/<영역>.ts 의 mock ─▶ api/mock/server.ts (지연 · 실패 · 빈 목록 · 404 손잡이)
         (기본, 공유 빌드도)                         └▶ api/mock/serialize.ts (저장소 값 → DTO, 날짜는 ISO+09:00)
                                                       └▶ data/*Store.ts, data/mock.ts … (가짜 DB)
```

| 파일 | 하는 일 |
|---|---|
| `api/config.ts` | `API_MODE`, `API_BASE`(기본 `/api`), `WS_URL`, 목 손잡이(`?api=`) 읽기 |
| `api/client.ts` | fetch 래퍼. `ApiError{status, code, message}` 로 맞춤, 타임아웃 10초 + AbortSignal, `credentials: 'include'`, 401 → 리프레시 한 번 → `onUnauthorized`, GET 만 재시도(네트워크·타임아웃·502/503/504, 2번) |
| `api/types.ts` | 서버 응답 모양(DTO). ERD 칼럼을 camelCase 로. enum 후보 |
| `api/mappers.ts` | DTO → 앱 모양. ID 문자열화(`toId`), ISO → ms·달력 값, 탈퇴 → `gone`, 응답에 온 사람을 `USERS` 에 채움 |
| `api/<영역>.ts` | `auth` · `members` · `burrows` · `chat` · `meetups` · `board` · `notifications` · `reports`(+관리자). 파일마다 `real`(경로) + `mock`(같은 시그니처) |
| `api/mock/server.ts` | `mockRead`·`mockWrite`: 지연, 실패 주입, JSON 복사(서버처럼), 번호·커서 페이지 도우미 |
| `api/mock/serialize.ts` | 저장소 → DTO (실제 서버가 DB 행을 DTO 로 바꾸는 자리) |
| `api/queryClient.ts` | QueryClient 설정, 캐시 키 `qk`, 오류 토스트 저장소 |
| `api/queries.tsx` | 화면용 훅 + `useOptimistic`(낙관적 업데이트) + `MockServerSync`(목 모드에서 저장소가 바뀌면 캐시 새로 받기) |
| `lib/time.ts` | 날짜 한 곳: ISO ↔ ms, Asia/Seoul 달력, 화면 문구("방금", "3분 전", "어제", "11월 3일") |

### 이번에 API 를 거치도록 바꾼 화면

| 화면 | 읽기 | 쓰기 (낙관적 → 실패하면 되돌림 + 토스트) | 없음(404) |
|---|---|---|---|
| 모임 상세 `/meetups/:id` | `useMeetupDetail` | 신청 · 신청 취소 · 참여 취소 · 찜 · 신고 | "삭제된 모임이에요" |
| 모임 목록 `/meetups` | `useMeetupList` (거르기 · 정렬 · 페이지 = 서버) | 찜 | — |
| 커뮤니티 목록 `/board` | `usePostList` (거르기 · 정렬 · 페이지 = 서버, `?page` 주소 유지) | 저장 | — |
| 글 상세 `/board/:id` | `usePostDetail` (+ 다음 읽을 글 `usePostList`) | 좋아요 · 저장 · 삭제 · 신고 · 댓글/답글 쓰기 · 고치기 · 지우기 · 좋아요 · 신고, 조회수 | "삭제된 글이에요" / 403 → "신고로 가려진 글이에요" |
| 땅굴 방문 `/burrow/:userId` | `useBurrow` + `useGuestbook` (주인별 방명록, B9) | 방명록 · 단골 · 대화 요청 | "없는 땅굴이에요" (예전: 모르는 id 면 예린 땅굴이 보였음) |
| 알림 `/notifications` | `useNotificationList` (커서 "더 보기") | 읽음 · 모두 읽음 | — |
| 채팅 목록·요청 `/chat`, `/chat/requests` | `useChatRooms` · `useChatRequests` | 수락 · 거절 · 취소 | — |

아직 저장소를 바로 쓰는 화면: 내 땅굴, 탐색, 내 모임, 모임 만들기·수정, 글쓰기, 저장한 글 등 활동 목록, 커뮤니티 오른쪽 위젯, 알림 팝업(GNB), 설정·관리자, 채팅 대화 창(메시지 — 실시간 작업). 목 모드에서는 `MockServerSync` 가 저장소 변화를 캐시에 알려 주므로 서로 어긋나지 않는다.

---

## 2. 목 ↔ 실제 전환

| 변수 | 값 | 기본 | 설명 |
|---|---|---|---|
| `VITE_API_MODE` | `mock` · `real` | `mock` | `real` 이면 `api/client.ts` 로 서버를 부름. 공유 빌드(`.env.share`)는 mock 그대로 |
| `VITE_API_BASE` | 예 `/api`, `https://api.example.com/api` | `/api` | 다른 도메인이면 서버 CORS + `SameSite=None; Secure` 쿠키가 필요 (B6). 같은 출처 추천 |
| `VITE_WS_URL` | 예 `/ws` | `/ws` | 실시간 작업용 자리 |
| `API_PROXY_TARGET` | 예 `http://localhost:8080` | 없음 | **개발 서버 전용**. 있으면 Vite 가 `/api` · `/ws` 를 이 주소로 넘김 (`vite.config.ts devProxy`) |

실제 서버에 붙여 보기 (로컬 Spring 이 8080 이라고 가정):
```
# app/.env.development.local  (.gitignore 에 app/.env*.local 추가함 — 커밋되지 않음)
VITE_API_MODE=real
API_PROXY_TARGET=http://localhost:8080
```
```
cd app && npm run dev     # 브라우저는 localhost:5173/api/... 로 부르고 Vite 가 8080 으로 넘김
```
- 배포: Nginx 가 `/api` · `/ws` 를 Spring 으로 넘기고, 프론트는 `VITE_API_MODE=real` 로 빌드 (`VITE_*` 값은 빌드 때 박힘. 비밀 값을 넣지 말 것, D3)
- 401 처리: `main.tsx` 의 `setUnauthorizedHandler` — 비로그인으로 바꾸고 `/login` 으로 (`state.from` 에 돌아올 주소)
- Bearer 토큰으로 정하면 `setAuthHeaderProvider(() => 'Bearer …')` 만 채우면 됨

---

## 3. 목 서버 손잡이 `?api=…`

주소 끝에 붙이면 목 서버가 그렇게 행동한다. **이 탭(sessionStorage)에 기억**해서 화면을 옮겨 다녀도 유지되고, 왼쪽 아래 배지 "목 서버 · slow ✕" 의 ✕ 나 `?api=off` 로 끈다. 여러 개는 쉼표 (`?api=slow,writefail`). 해시 라우터(공유 빌드)는 `#/meetups/m1?api=slow` 처럼 해시 뒤에.

| 손잡이 | 동작 | 보이는 것 |
|---|---|---|
| (없음) | 요청마다 0.15~0.4초 지연 | 아주 잠깐 스켈레톤 |
| `slow` | 1.2~2.6초 지연 | 스켈레톤 (상세 두 칸, 카드 격자, 줄 목록, 땅굴 패널) |
| `fast` | 지연 없음 | — |
| `fail` | 모든 요청 503 (GET 은 재시도 2번 뒤 실패) | "불러오지 못했어요 + 다시 시도" |
| `flaky` | 요청 셋 중 하나꼴로 503 | 대부분 자동 재시도로 살아남음 |
| `writefail` | 쓰기만 500 | 화면이 먼저 바뀌었다가 되돌아오고 위쪽에 빨간 토스트 |
| `empty` | 목록이 모두 빔 | 빈 상태 그림·문구 |
| `notfound` | 상세가 모두 404 | "삭제된 모임이에요" 등 00 공통 21 안내 |
| `unauth` | 모든 요청 401 | 로그인 화면으로 보냄 (`LOGIN_FREE` 라 로그인은 그냥 통과) |

예: `http://localhost:5173/meetups/m1?api=slow`, `…/board?api=empty`, `…/burrow/yerin?api=fail`, `…/meetups/m6?api=writefail` (찜을 눌러 보기)

---

## 4. 새 API 를 붙이는 순서

1. **계약**: [api-draft.md](api-draft.md) 에 경로·모양을 적고 백엔드와 맞춘다
2. **DTO**: `api/types.ts` 에 응답·요청 타입 (ERD 칼럼 camelCase, ID 는 `Id`(문자열), 날짜는 `IsoDateTime`)
3. **real**: `api/<영역>.ts` 의 `real` 객체에 `http.get/post/...` 한 줄
4. **mock**: 같은 파일 `mock` 객체에 같은 시그니처로. 읽기는 `mockRead(() => …, { signal, empty, detail })`, 쓰기는 `mockWrite(() => …)`. 저장소 → DTO 는 `mock/serialize.ts`. 409 같은 규칙 위반은 `conflict(code, message)` 로 던짐
5. **매퍼**: 앱 모양과 다르면 `api/mappers.ts` 에 `toXxx(dto)`. ID 는 `toId`, 날짜는 `parseIso`
6. **훅**: `api/queries.tsx` 에 `useXxx` (캐시 키는 `qk` 에 계층으로: `['meetups','detail',id]`)
7. **화면**: 상세는 `<QueryGate q skeleton notFound>{(d) => <View d={d} />}</QueryGate>`, 목록은 `isPending → Skeleton*`, `isError && !data → ErrorState`, 빈 배열 → `EmptyState`. 쓰기는 `useOptimistic().mutate({ call, patches, invalidate, errorTitle }, { onSuccess })`
8. **확인**: `?api=slow` · `fail` · `empty` · `notfound` · `writefail` 로 다섯 상태를 눈으로 본다
9. **실서버**: 영역별로 `VITE_API_MODE=real` 로 붙여 보고, 모양이 다르면 매퍼만 고친다

영역을 하나씩 실서버로 옮기려면 `api/<영역>.ts` 맨 아래 `export const meetups = API_MODE === 'real' ? real : mock` 을 그 영역만 `real` 로 바꾸면 된다.

---

## 5. 화면 상태 규칙 (위험 B1 · B3 · B11)

- **없음은 404 일 때만**. 불러오는 중이나 다른 오류를 "없음" 으로 보지 않는다. 다른 사람으로 대체하지 않는다 (예전 `USERS[id] ?? USERS.yerin`)
- 처음 불러올 때만 스켈레톤. 다시 불러오다(거르기 바꿈 · 쓰기 뒤) 실패하면 **이전 값을 계속 보여 준다** (`QueryGate`, `keepPreviousData`)
- 쓰기는 낙관적: 캐시를 먼저 바꾸고(`patches`), 실패하면 원래대로 + 위쪽 빨간 토스트(서버 `message`), 끝나면 관련 키를 새로 받음(`invalidate`). 성공 토스트를 먼저 띄운 경우(찜·저장) 실패하면 그 토스트는 닫음
- 진행 중에는 같은 버튼을 다시 못 누름 (`run.isPending` → 신청하기 · 요청 보내기 · 수락)
- 라우트 오류 경계는 원래 있던 `RouteError` (00 공통 21 "다시 시도")

## 6. 날짜 규칙 (위험 B2)

- 데이터에는 표시 문자열을 넣지 않는다. 지운 것: `mock.ts` 의 예전 `POSTS`(“11월 3일 오후 4:12”, “2시간 전”) · `NOTICES`(“10분 전”), 모임 `closesAt`(“11월 7일 (토)”) · `myNoteAgo`(“2시간 전 신청”). 방명록 `createdAt` 은 `+09:00` ISO 로
- 서버와는 ISO 8601 + 오프셋, 앱 안 계산은 ms 숫자, 달력은 `YYYY-MM-DD`, 입력 칸은 `YYYY-MM-DDTHH:mm`(서울)
- 표시 문구는 `lib/time.ts` 한 곳: `agoShort`(방명록) · `agoNotice`(알림) · `agoBoard`(커뮤니티) · `agoChat`·`chatListTime`·`dayDivider`(채팅) · `clock` · `monthDay` · `ymdLabel`. 기존 함수(`lib/format timeAgo·dateLabel·dateParts`, `lib/store noticeTime`, `boardStore ago·dateLabel`, `meetupStore` 시간 함수)는 이 파일을 부르도록 바꿈 → 화면 문구는 그대로
- 브라우저 시간대와 관계없이 Asia/Seoul (UTC + 9시간 계산, 서머타임 없음)
- 남은 곳: `data/chat.ts` 의 `clock`·`listTime`·`ago`·`dayLabel`(메시지 쪽, 실시간 작업에서 `lib/time` 으로), 모임 시각 `start`·`end` 는 만들기 양식 값('오후 2:00')을 그대로 들고 있고 서버와는 `startsAt`·`endsAt` ISO 로 주고받음 (`mappers.toMeetup`), 설정·관리자 화면의 `YYYY.MM.DD` 문자열(차단일·신고일·공지일)

## 7. ID 규칙 (위험 B7)

- 앱 안 ID 는 모두 문자열. 서버가 숫자로 줘도 `mappers.toId` 가 문자열로. 비교는 문자열끼리
- 탈퇴한 사람은 `'gone'` (게시판·채팅이 이미 쓰던 값)
- 아직 남은 다리: 화면 여러 곳이 `USERS[id]` 로 닉네임을 찾음 → 매퍼가 응답에 온 사람을 `USERS` 에 채움(`rememberPerson`). 화면을 `usePerson(id)` 같은 훅으로 바꾸면 없앨 것

---

## 8. 확인한 것 (2026-11-16)
- `npx tsc -b` 통과, `npm run build`·`npm run build:share` 통과
- 헤드리스 크롬(1440×900)으로 바꾼 화면 7개를 정상 · `slow`(스켈레톤) · `fail`(다시 시도) · `empty`(빈 상태) · `notfound`(안내) 에서 찍어 확인, 콘솔 예외 없음
- 쓰기 흐름: `writefail` 에서 모임 찜 false→true→false + 오류 토스트, 글 좋아요 14→15→14, 알림 모두 읽음 "안 읽음 3"→없음→"안 읽음 3". 정상에서는 찜 유지, 댓글 7→8→8 (임시 댓글이 서버 댓글로 바뀜)

## 9. 남은 일
1. **나머지 화면을 API 로**: 내 땅굴(프로필·방명록·꾸미기 저장), 탐색 들판(`api.burrows.field`), 내 모임·신청 관리, 모임 만들기·수정(`api.meetups.create/update`), 글쓰기·수정, 저장한 글 등 활동 목록(`/me/posts` …), 커뮤니티 위젯(`hot`·`hotInterests`·`activity`), 알림 팝업·GNB 빨간 점(`unreadCount`), 설정·관리자. 함수와 목 구현은 이미 있음
2. **채팅 실시간**(다른 작업): 메시지 기록 커서, STOMP 채널(api-draft 4장), 이벤트를 받으면 `qk.chat` 캐시 갱신. 그러면 `MockServerSync` 의 채팅 부분은 실서버에서 필요 없어짐
3. **사람 캐시**: `USERS[id]` 직접 읽기를 훅으로 바꾸고 `rememberPerson` 다리 없애기
4. **인증**: `useMe()`/`AuthProvider` 로 `ME_ID` 상수 바꾸기, `GET /me` 로 시작 상태 정하기 (B5). 지금은 `LOGIN_FREE = true`
5. **댓글 커서**: 지금은 댓글을 한 번에 100개 받고 "N개 더 보기" 는 앱 안에서. 댓글이 많아지면 `useInfiniteQuery` 로
6. **ERD 답 반영**: [erd-gaps.md](erd-gaps.md) Q1~Q12 답이 오면 `types.ts`·`mappers.ts`·목 직렬화 고치기
7. **OpenAPI**: 백엔드가 Swagger 를 열면 DTO 를 생성으로 바꾸기 (`openapi-typescript`, 새 패키지)
