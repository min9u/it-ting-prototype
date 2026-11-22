# 프론트엔드 실서비스 대비: 실시간 · 안정성 · 접근성 · 입력 검증

- 날짜: 2026-11-16
- 요청: 실제 서비스·백엔드 연결에 대비해 "실시간 · 안정성 · 접근성 · 입력 검증"을 맡음. 채팅 실시간 연결 계층, 재배포·에러·오프라인 대비, `.env` 정리, 인증 흐름 뼈대, ERD·명세 기준 글자 수, 모달 포커스·키보드 흐름
- 범위: `app/` 만. 같은 시간에 다른 작업자가 `app/src/api/`(REST 계층·목 서버)와 목록·상세 화면 비동기 전환·날짜 통일을 하고 있어서 그쪽은 건드리지 않았다 (8장)
- 함께 읽기: 위험 목록 [dev-deploy-risks.md](dev-deploy-risks.md), 서버 설정 예시 [deploy-config.md](deploy-config.md), ERD [backend/erd-2026-11-16.md](backend/erd-2026-11-16.md), 채팅 명세 [chat-f6.md](chat-f6.md)

## 0. 한눈에

| 영역 | 한 일 | 막는 위험 | 파일 |
|---|---|---|---|
| 실시간 | 연결 계층(인터페이스 · 목 서버 · STOMP 직접 구현), 재연결 · 다시 받기 · 중복 제거 · 보내는 중/실패/다시 보내기 · 탭 숨김 정책 · 알림 구독 | B4 | `src/realtime/*` |
| 채팅 | 위 계층을 쓰게 바꿈 (화면·디자인 그대로), 연결 띠 "다시 연결하는 중…", 입력 중은 서버 이벤트 | B4 | `data/chat.ts`, `screens/chat/Chat.tsx`, `components/ConnectionStrip.tsx` |
| 재배포 | 청크 404 → 한 번만 새로고침 (`vite:preloadError` + 에러 경계) | D2 | `lib/chunkReload.ts`, `main.tsx` |
| 에러 경계 | 라우트 세 겹(헤더는 남김), 3D 경계(WebGL 실패·청크 404 → 2D 그림), WebGL 컨텍스트 잃음 → 다시 만들기 | B3, D2, F1 | `App.tsx`, `components/NotFound.tsx`, `components/SceneBoundary.tsx`, `three/SceneCanvas.tsx` |
| 연결 끊김 | 오프라인·서버에 닿지 못함 띠 (API 계층이 알리는 자리) | B3 | `components/NetworkBanner.tsx`, `lib/network.ts` |
| 환경 변수 | 읽는 곳 하나, `"0"` 은 거짓, `.env.example`, `.env.local` gitignore, 개발 프록시 | D3, B6 | `lib/env.ts`, `vite-env.d.ts`, `.env.example`, `.gitignore`, `vite.config.ts` |
| 인증 | 401 → 로그인 + 돌아올 주소, 갱신 한 번만 (지금은 `LOGIN_FREE` 라 동작 그대로) | B5 | `lib/authFlow.ts`, `screens/start/Auth.tsx` |
| 입력 검증 | ERD·명세 글자 수 한 곳, 방명록 100 → 50자, 서버 에러 자리 | — | `lib/validation.ts`, `components/FieldError.tsx` |
| 접근성 | 모달 포커스 가두기·복귀·Esc·뒤 화면 inert, **팝업 입력칸 초점 뺏김 버그 수정**, 단축키 공통 검사, 아이콘 버튼 라벨, 움직임 줄이기, 키보드만으로 주요 흐름 확인, 색 대비 목록 | F5 | `components/Modal.tsx`, `lib/a11y.ts` 외 |
| 서버 설정 | Nginx·Spring 예시 문서 | D1, D4, B6 | [deploy-config.md](deploy-config.md) |

---

## 1. 채팅 실시간 연결 (`app/src/realtime/`)

> **2026-11-22 바뀜**: 백엔드 확정 명세(v1)는 WebSocket + STOMP 대신 **SSE 하나(`GET /api/v1/me/event-stream`) + 보내기는 일반 API** 다. 아래 1-1 ~ 1-4 의 STOMP 허브(`hub` · `stompTransport` · `mockTransport` · `order` · `protocol`)는 지웠고, 지금 구조 · 손잡이는 [api-v1/06-chat.md](backend/api-v1/06-chat.md). 1-5 표는 새 손잡이로 바꿨다. 아래 1-1 ~ 1-4 는 기록으로 둔다

### 1-1. 구조
```
화면 (Chat.tsx)                  ← 지금과 같은 함수: send · markRead · useChat …
  └ 저장소 (data/chat.ts)         ← 보내는 중/실패 상태, 받은 메시지 합치기, 안 읽은 수, 입력 중
      └ RealtimeClient (hub.ts)  ← 재연결 · 다시 받기 · 보내기 확인 짝짓기 · 탭 숨김 · 오프라인 · 인증 실패
          └ Transport             ← mock (mockTransport.ts) 또는 stomp (stompTransport.ts)
```
| 파일 | 하는 일 |
|---|---|
| `types.ts` | 약속: `WireMessage`(서버 메시지), `OutgoingMessage`, 입력 중·읽음·방 이벤트·알림, 연결 상태, `RealtimeClient`, `Transport` |
| `protocol.ts` | 구독 주제·보내는 곳 이름, 시간 값 (연결 10초 · 보내기 확인 10초 · 끊겼을 때 쥐고 있기 60초 · 하트비트 10초 · 입력 중 3초/2.5초/6초 · 숨김 10분 · 오프라인 확인 30초) |
| `backoff.ts` | 지수 백오프 + 지터 (0 ~ min(30초, 0.5초 × 2^n), 최소 0.3초) |
| `order.ts` | 합치기: clientId 로 교체 → 같은 id 버림 → seq 순서 (보내는 중은 맨 아래). `newClientId()` (UUID) |
| `hub.ts` | 공통 두뇌 (mock·stomp 가 같은 코드) |
| `mockTransport.ts` | 가짜 서버: 지연·끊김·상대 답장·멱등·거절 |
| `stompTransport.ts` | 브라우저 WebSocket + STOMP 1.2 프레임 직접 구현 (CONNECT·SUBSCRIBE·SEND·하트비트·ERROR), 패키지 없음 |
| `index.ts` | 하나만 만들기(`realtime()`), `useRealtimeStatus()`, `subscribeNotifications()`, `configureRealtime()`, `wsUrl()` |

### 1-2. 동작 규칙
| 상황 | 동작 |
|---|---|
| 끊김 | `reconnecting` → 백오프 + 지터로 다시 시도. 시도 하나는 10초 제한 |
| 다시 연결됨 | 구독을 모두 다시 하고(먼저), 방마다 "내가 가진 마지막 seq 이후"를 기록으로 받음(나중). 겹치는 것은 `order.ts` 가 버림 |
| 보내기 | `clientId`(UUID)를 만들어 **보내는 중**(흐린 말풍선)으로 먼저 그림 → 서버가 같은 `clientMessageId` 로 돌려주면 서버 메시지로 교체 |
| 끊긴 동안 보내기 | 보내는 중으로 **60초까지** 쥐고 있다가 붙는 순간 보냄 (그때부터 확인 10초). 60초 안에 못 붙거나, 보낸 뒤 10초 안에 확인이 없으면 **실패**(점선 말풍선 + "다시 보내기 · 지우기") |
| 다시 보내기 | 같은 `clientId` 로 다시 보냄 → 서버가 멱등이면 두 번 저장되지 않음. 실패로 표시했는데 사실은 서버에 갔던 경우, 다시 받기에서 같은 clientId 가 오면 저절로 정상으로 바뀜 |
| 서버가 거절 | `/user/queue/errors` 의 `SEND_FAILED` → 그 메시지만 실패 + 서버 문구 |
| 받기 | 실시간·다시 받기·내 확인이 섞여 와도 결과가 같음 (중복 0, seq 순서). 보고 있지 않은 방이면 안 읽은 수 +1 |
| 입력 중 | 내 입력은 3초에 한 번만 보내고 2.5초 멈추면 끝. 받은 "입력 중"은 6초 뒤 저절로 꺼짐, 그 사람 메시지가 오면 바로 꺼짐 |
| 읽음 | 방을 보고 있고 탭이 보일 때 마지막 서버 메시지 id 를 보냄 (바뀔 때만, 끊겨 있으면 붙은 뒤). 화면에 읽음 표시는 없음 (명세) |
| 탭이 숨겨짐 | 연결 유지 (알림·안 읽은 수). **10분 넘게 숨겨지면 일부러 끊고(paused, 띠 없음)**, 다시 보이면 바로 연결 + 놓친 것 받기. 다시 보일 때 기다리는 중이면 바로 시도 |
| 오프라인 | 시도를 멈추고 30초마다 한 번만 확인, `online` 이벤트면 바로 |
| bfcache 로 돌아옴 | 소켓이 닫혀 있으므로 바로 다시 연결 |
| 인증 실패 | STOMP `ERROR`(401·expired 등) 또는 닫힘 코드 4401 → 다시 시도하지 않고 `lib/authFlow.ts handleUnauthorized()` |
| 로그아웃·탈퇴 | `stopChatRealtime()` (설정 화면) |
| 연결 시작 | 로그인 영역(`App.tsx` AppLayout)에 들어올 때 `startChatRealtime()`. 시작 화면·로그인 화면에서는 연결하지 않음 |

### 1-3. 화면에서 보이는 것
- 대화 창 위 **연결 띠** (`ConnectionStrip`): "연결이 끊겼어요. 다시 연결하는 중…" + 남은 초 + "지금 다시 연결". 첫 연결부터 실패하면 "채팅 서버에 연결하지 못했어요", 오프라인이면 "인터넷 연결이 끊겼어요 … 보낸 메시지도 그때 보내요". 다시 붙으면 "다시 연결됐어요. 놓친 메시지를 받아 왔어요" 2초. 0.8초 안에 다시 붙으면 띄우지 않음 (깜빡임 방지). 읽는 영역(role=status)은 늘 있고 글만 바뀜, 남은 초는 읽지 않음
- 내 말풍선: 보내는 중 = 흐림 + "보내는 중", 실패 = 흰 바탕 점선 + 까닭 + "다시 보내기 · 지우기"
- 그 밖은 그대로: 1:1 에서 처음 보내면 상대가 "입력 중…" 뒤 답장하고 두더지가 손 인사 (예전 `fakeReply` 연출을 목 서버로 옮김. 그 뒤엔 30%, 모임은 25% 확률로 누군가 답장)
- 채팅 밖 화면에는 실시간 띠를 띄우지 않음 (알림이 조금 늦을 뿐이라). 오프라인·서버 끊김은 화면 맨 위 `NetworkBanner` 가 모든 화면에서

### 1-4. 백엔드와 정할 것 (제안)
| 항목 | 제안 | ERD 와 비교 |
|---|---|---|
| 연결 | `wss://<도메인>/ws` 순수 WebSocket + STOMP 1.2, 하트비트 10초/10초. SockJS 를 쓰면 `/ws/websocket` | — |
| 구독 | 방: `/topic/chat/rooms/{roomId}` (MESSAGE · TYPING · READ · ROOM), 내 알림: `/user/queue/notifications`, 내 오류: `/user/queue/errors`. **SUBSCRIBE 때 방 참여자인지 서버가 검사** | — |
| 보내기 | `/app/chat/rooms/{roomId}/messages` `{ clientMessageId, type, content, meetupId? }` → 방에 `{ event: 'MESSAGE', message }` 방송 | — |
| 입력 중 · 읽음 | `/app/chat/rooms/{id}/typing` `{ typing }`, `/app/chat/rooms/{id}/read` `{ lastMessageId }` | `chat_room_member.last_read_message_id` 있음 ✔ |
| 메시지 JSON | `{ id, roomId, seq, clientMessageId, senderId, type: TEXT·SYSTEM·MEETUP, content, meetupId?, createdAt(ISO+오프셋) }` | **`client_message_id` 없음** → 추가 + UQ(chat_room_id, sender_id, client_message_id) 로 멱등. **`seq` 없음** → 아래. 모임 카드는 `meetup_id` 칼럼이 없어서 `type=MEETUP` + content 에 모임 id 로 할지 칼럼을 더할지 |
| 순서 · 다시 받기 | `GET /api/chat/rooms/{id}/messages?afterSeq={n}` → `WireMessage[]` 또는 `{ items }` | AUTO_INCREMENT `id` 를 순서로 쓰면, 동시에 커밋된 두 메시지가 id 순서와 다르게 보일 수 있어 "id 이후"로 받으면 하나를 놓칠 수 있음 → **방별 `seq`(chat_room.last_seq 를 잠그고 +1)** 추천. id 를 쓴다면 몇 개 겹쳐 받기(프론트가 중복을 버림) |
| 오류 | `SEND_FAILED { clientMessageId, code, message }` (차단된 상대·나간 방·글자 수 초과 등, `message` 는 그대로 보여 줄 한국어) | — |
| 인증 만료 | `ERROR` 프레임 `message: 401 …` 또는 닫힘 코드 4401 | — |
| 방 상태 | `ROOM { kind: MEMBER_LEFT·MEMBER_GONE·NOTICE, payload }` (상대 나감·탈퇴·공지) | `chat_room_member.left_at`, `member.withdrawn_at`, `chat_room.notice` |
| 알림 | `NOTIFICATION { notification: { id, type, targetType, targetId, actorId, createdAt, text? } }` | `notification` 표와 같음. 화면 문구를 서버가 줄지(`text`) 정할 것 |

### 1-5. 손잡이 (2026-11-22, SSE + REST)
| 손잡이 | 뜻 |
|---|---|
| `VITE_API_REAL_AREAS=chat,events` | 채팅 API · 실시간 소식을 실제 서버로 (`events` 는 SSE 연결, 공통) |
| 주소 `?rt=flaky` | 목 실시간 연결이 20~40초마다 2~8초 끊김. 끊긴 동안 상대 메시지가 와서, 다시 붙으면 조회 API 로 받아 오는 것을 볼 수 있음 |
| 주소 `?rt=down` | 목 실시간 서버가 꺼진 것처럼 (띠 "채팅 서버에 연결하지 못했어요"). 보내기는 REST 라 그대로 됨 |
| 주소 `?rt=quiet` | 목 상대 답장 끔 |
| 주소 `?api=writefail` | 보내기 실패 → 말풍선 "다시 보내기 · 지우기" |
| 콘솔 `__digulChat.incoming('r-yerin', '안녕')` · `.request('kim', '인사')` · `.partnerLeaves('r-mingu')` · `.drop(5000)` | 상대 메시지 · 새 대화 요청(요청 N) · 상대가 나감(읽기 전용) · 연결 끊기 (개발 서버 또는 `?rt=` 가 있을 때) |
| 콘솔 `__digulEvents.mock.emit(이름, 값)` | 아무 소식이나 서버가 보낸 것처럼 (공통) |

---

## 2. 배포 · 안정성

### 2-1. 재배포 뒤 옛 탭의 청크 404 (D2)
- `main.tsx` 에서 `installChunkReload()`: `vite:preloadError` 가 오면 **한 번만** 새로고침. 30초 안에 또 실패하면 새로고침하지 않고 에러 화면을 보여 준다 (sessionStorage `digul.chunkReloadAt`, 저장소를 못 쓰면 자동 새로고침 안 함 = 무한 새로고침 방지)
- **시험으로 확인한 것**: Vite 8 은 의존 파일뿐 아니라 동적 import 자체의 실패도 `vite:preloadError` 로 알린다. 그래서 3D 청크가 없을 때도 먼저 한 번 새로고침된다. 화면에 들어가는 순간이라 잃는 입력은 보통 없음 (온보딩 중간 단계는 확인 필요, 7장)
- 에러 경계에서도 `isChunkLoadError` 로 가려서 한 번 새로고침 (`RouteError`)
- 서버 쪽: 옛 assets 를 한두 번 배포하는 동안 남기고, 없는 `/assets/*` 는 index.html 이 아니라 404 로 ([deploy-config.md](deploy-config.md) 1장·4장)

### 2-2. 에러 경계
| 겹 | 위치 | 깨지면 |
|---|---|---|
| 1 | 모든 라우트를 감싼 경로 없는 라우트 | 시작 화면·온보딩·관리자까지 "잠시 문제가 생겼어요 · 다시 시도" (예전엔 로그인 영역에만 있었음) |
| 2 | 로그인 영역 틀(AppLayout) | 헤더 자체가 깨질 때 |
| 3 | 화면 하나 (`RouteError inline`) | **헤더(GNB)는 남고** 안쪽만 안내. 모임 탭·설정 왼쪽 메뉴도 남김 |
- `RouteError`: 라우터 404 응답이면 "없는 주소예요", 청크 404 면 한 번 새로고침, 개발 서버에서는 에러 내용을 아래에 보여 줌
- 개발 서버 전용 `/dev/crash` 로 확인할 수 있음 (빌드에는 없음)

### 2-3. 3D 에러 경계 (`SceneBoundary`)
- 땅굴(`RoomView`) · 탐색 들판(`ExploreBurrow`) · 옛 밭(`FieldView`) · 찻방(`TeaRoom`) · 두더지 미리 보기(`MoleDresser`) 의 3D 를 감쌈. 3D 만 비우고 **각 화면이 깔아 둔 2D 그림**(땅굴 자리표시 · 찻방 2D 두더지 · 들판 배경 · 2D 두더지)이 그대로 보임
- `SceneCanvas` 는 WebGL 을 못 만들면 경계에 알림 → 땅굴은 "땅굴 파는 중"을 8초 기다리지 않고 바로 자리표시 그림
- 청크를 새로고침 뒤에도 못 받으면 "새 버전이 나왔어요 · 새로고침하면 3D 가 보여요" 버튼
- **WebGL 컨텍스트를 도중에 잃으면** (드라이버 재시작·GPU 메모리 부족·탭이 오래 숨겨짐) 1.5초 기다렸다 장면을 새로 만듦 (최대 2번, 그 뒤엔 2D). 우리가 정리할 때 부르는 `forceContextLoss` 도 같은 이벤트라 정리 전에 듣기를 끔 (F1)

### 2-4. 오프라인 · 서버 연결 끊김
- 모든 화면 맨 위 `NetworkBanner`: 오프라인이면 "인터넷 연결이 끊겼어요 … 쓰던 글은 지우지 말고 기다려 주세요", 서버에 닿지 못하면 "서버와 연결이 고르지 않아요 · 다시 시도", 돌아오면 "다시 연결됐어요" 2초
- **API 계층(다른 작업자)이 할 일**: 네트워크 오류(fetch 의 TypeError)·502·503·504 면 `reportServerDown()`, 그 뒤 아무 응답이나 성공하면 `reportServerUp()` (`lib/network.ts`, `isServerUnreachable(err, status)` 도우미). "다시 시도" 버튼은 `window` 에 `digul:retry` 이벤트를 보냄 → react-query 를 쓰면 이 이벤트에서 `refetchQueries` 하면 됨

### 2-5. 환경 변수 (D3)
- 읽는 곳: `src/lib/env.ts` 의 `ENV` 하나. `flag()` 는 `1·true·yes·on` 만 참 → **`VITE_HASH_ROUTER=0` 이 이제 거짓** (예전엔 문자열 "0" 이 참이라 끌 수 없었음)
- 타입: `src/vite-env.d.ts` `ImportMetaEnv`. 목록·설명: `app/.env.example` (Vite 는 이 파일을 읽지 않음)
- `.gitignore`: `.env.local`, `.env.*.local` (루트·app 둘 다)
- 예외로 그대로 둔 것: `three/glb.ts` 의 `import.meta.env.MODE === 'share'` · `BASE_URL`, `three/fieldScene.ts` 의 `DEV`. 빌드 때 글자로 바뀌어 **공유 빌드 전용 Draco JS 해독기를 일반 빌드에서 빼는**(트리 셰이킹) 데 쓰여서. 원칙: 내장 값(MODE·DEV·PROD·BASE_URL)은 써도 되고, 우리가 만든 `VITE_*` 는 `env.ts` 로만
- 개발 프록시: `app/.env.local` 에 `DEV_PROXY_TARGET=http://localhost:8080` 을 두면 Vite 가 `/api`·`/ws`(WebSocket 포함)를 넘김 (`vite.config.ts`). 비우면 지금과 같음 (B6)

### 2-6. 인증 흐름 뼈대 (B5)
- `lib/authFlow.ts`
  - `handleUnauthorized(reason)`: 비로그인으로 바꾸고 지금 주소를 기억(`sessionStorage digul.returnTo`)하고 `/login` 으로 (주소 기록을 덮어씀). **`LOGIN_FREE = true` 인 지금은 콘솔에 남기기만 하고 아무것도 바꾸지 않음**
  - `refreshSessionOnce(doRefresh)`: 동시에 여러 요청이 401 이어도 갱신은 하나만 기다림. 실패하면 `handleUnauthorized`
  - `takeReturnTo(state.from)`: 돌아갈 주소. 앱 안 경로만 허용(`//evil.com`·`https://` 막음), 시작 화면은 뺌
- 로그인 화면: 로그인이 필요해서 왔으면(`RequireLogin` 의 `state.from` 또는 401 로 기억한 주소) 성공 뒤 그 주소로. 가입·온보딩을 마저 해야 하는 계정은 그쪽이 먼저 (예전엔 `state.from` 을 넘겨도 쓰지 않았음)
- 실시간 연결도 인증 실패면 같은 함수로
- 라우터 이동은 `main.tsx` 가 `registerNavigator(router.navigate)` 로 넣어 줌 (순환 참조 피하기)

---

## 3. 입력 검증 (`lib/validation.ts`)

- 규칙 한 곳: `RULES` (칸 이름 · 최대 · 최소 · 필수 · ERD 근거 · 명세 근거), 예전 상수 이름(`NICK_MAX`, `TITLE_MAX`, `COMMENT_MAX`, `INTRO_MAX`, `ANSWER_MAX` …)은 그 파일에서 다시 내보내서 화면 코드는 그대로
- 검사 `checkText(rule, value)` · 안내 문구 `MSG` · 글자 수 `counter()` · 넘친 값 자르기 `clampText()`
- 글자 수 세는 법: 자바스크립트 길이(UTF-16) = `maxLength` = Java `String.length()`(Spring `@Size`). 한글 1자 = 1, 이모지는 보통 2. MySQL utf8mb4 `VARCHAR(n)` 은 이모지를 1로 세서 **프론트가 더 엄격** → DB 에서 넘칠 일 없음. 서버도 `@Size` 를 쓰면 같은 기준
- 서버 에러 자리: 형식 `{ code, message, status, traceId, fieldErrors: [{ field, message }] }`(dev-deploy-risks.md 5장 초안 + 칸별 오류). `fieldError(err, '칸')` · `formError(err)` · `<FieldError id error field />`(role=alert). 글쓰기(`BoardWrite`)에 제목·본문·폼 자리를 달아 둠 — 다른 폼은 API 를 붙일 때 같은 식으로
- 입력칸에는 그대로 `maxLength`(초과 막기, 한글 조합에도 안전) + "n / 최대" 표시. 방명록·대화 요청 인사는 글자 수를 `aria-describedby` 로 연결

### 3-1. 명세 · ERD 대조표
| 칸 | 앱(전) | 지금 | ERD | 02 명세 | 비고 |
|---|---|---|---|---|---|
| 닉네임 | 12 | 12 | `member_profile.nickname VARCHAR(12)` | 필수, 최대 12, "n / 12" | ✔ |
| 자기소개 | 150 | 150 | `intro VARCHAR(150)` | 최대 150, 선택 | ✔ |
| 질문 답변 | 10~50 | 10~50 | `member_answer.answer VARCHAR(50)` | 3개 필수, 10~50 | 최소 10자는 ERD 로 못 나타냄 → 서버 검사 필요 |
| **방명록** | **100** | **50** | `guestbook_entry.content VARCHAR(50)` | 최신 "50자 안에서", 옛 프레임 "100자 이내" | **바꿈.** Figma 옛 프레임 정리 필요 |
| 대화 요청 인사 | 50 | 50 | `chat_request.message VARCHAR(50) NULL` | "짧은 인사를 50자 안에서" | 앱은 빈 인사로 못 보냄(필수), ERD 는 NULL 허용 → 필수인지 확인 |
| 채팅 메시지 | 500 | 500 | `chat_message.content TEXT NULL` | 길이 없음, 빈 메시지 불가 | **500 은 프론트가 정한 값** → 서버와 같은 값으로 |
| 모임 공지 | 100 | 100 | `chat_room.notice TEXT NULL` | 길이 없음 | 프론트가 정한 값 |
| 모임 이름 | 30 | 30 | `meetup.title VARCHAR` (길이 미정) | 필수, 길이 없음 | ERD 길이 정해야 함 |
| 모임 소개 | 300 | 300 | `meetup.description TEXT NULL` | 선택 | 프론트가 정한 값 |
| 준비물 | 40 | 40 | `meetup.supplies VARCHAR NULL` (미정) | 선택 | ERD 길이 |
| 장소 · 상세 주소 | 60 · 40 | 60 · 40 | `place` · `place_detail VARCHAR NULL` (미정) | 오프라인이면 장소 필수 | ERD 길이 |
| 온라인 플랫폼(기타) | 20 | 20 | `meetup.platform VARCHAR NULL` (미정) | 온라인 필수, 링크 선택 | `join_url` 길이·형식도 미정 |
| 주최자에게 남길 말 | 100 | 100 | `meetup_application.message VARCHAR NULL` (미정) | 선택, 100자, "0/100" | ERD 를 `VARCHAR(100)` 으로 |
| 글 제목 · 본문 | 50 · 1000 | 50 · 1000 | `post.title VARCHAR(50)` · `content VARCHAR(1000)` | 필수 50 · 필수 1000 | ✔ |
| 댓글 · 답글 | 300 | 300 | `comment.content VARCHAR(300)` | 최대 300, 빈 입력 불가 | ✔ |
| 신고 "기타" 사유 | 100 | 100 | `report.detail VARCHAR(100) NULL` | 기타면 필수, 최대 100 | ✔ (기타가 아니면 NULL) |
| 공지 제목 (관리자) | 60 | 60 | `notice.title VARCHAR` (미정) | 길이 없음 | ERD 길이 |
| 정지 사유 · 질문 문구 (관리자) | 없음 | 없음 | `member_suspension.reason VARCHAR` · `intro_question.content` (미정) | 없음 | 길이 정하면 `RULES` 에 추가 |
- 프론트가 정한 값(채팅 500 · 공지 100 · 모임 이름 30 · 소개 300 · 준비물 40 · 장소 60/40 · 플랫폼 20 · 공지 제목 60)은 `RULES` 의 `spec` 에 "(확인받을 것)" 으로 적어 둠

---

## 4. 접근성

### 4-1. 팝업 (`components/Modal.tsx`)
- 열면 상자에 초점(안에 autoFocus 칸이 있으면 그 칸) → 제목을 읽어 줌. **Tab·Shift+Tab 은 팝업 안에서만** 돎, 초점이 어떻게든 밖으로 나가면 다시 안으로
- 팝업이 열려 있는 동안 앱 바탕(`#root`)에 `inert` → 뒤 화면은 Tab·클릭·화면 읽기에서 빠짐
- **닫으면 연 버튼으로 초점이 돌아감** (그 버튼이 아직 있을 때)
- 팝업 위 팝업: 맨 위 것만 Esc·Tab 을 받음. 한글 조합을 끝내는 Esc 는 넘김
- **고친 버그**: 예전 Modal 은 `onClose` 가 바뀔 때마다(부모가 다시 그려질 때마다) 상자에 초점을 다시 줬다. 팝업 안 입력칸에 한 글자 치면 부모 상태가 바뀌어 **초점이 입력칸에서 상자로 빠짐** (대화 요청 인사·신고 기타 사유·모임 신청 등). 예전 코드로 같은 시험을 돌려 초점이 `DIV` 로 빠지는 것을 확인했고, 지금은 `onClose` 를 ref 로 둬서 입력칸에 남음

### 4-2. 키 단축키 (`lib/a11y.ts`)
- `shortcutAllowed(e)`: 글 입력 중(input·textarea·select·contenteditable·role=textbox 등) · 화살표를 쓰는 위젯(role=tab·radio·option·menu… 또는 그 묶음 안) · 한글 조합 중 · Alt/Ctrl/Meta · 팝업(aria-modal) 열림 · 이미 처리됨이면 쉼. Enter 단축키는 `isActivatable`(버튼·링크·탭)이면 쉼
- 바꾼 곳: 탐색 방향키·Enter(`ExploreBurrow`, 시안 공통 `explore-designs/common.tsx`), 두더지 WASD(`three/keys.ts`, Worker 안에서도 그대로 동작), 옛 밭 확대 키(`fieldScene.ts`), 땅굴 Worker 키(`roomWorkerHost.ts`). 마을 지도 팝업의 window 캡처 차단은 지움 (팝업 안 키 처리까지 막고 있었음, 이제는 단축키 쪽이 팝업을 확인)
- `lib/a11y.ts` 는 React 를 들이지 않음 (Worker 가 씀). React 훅은 `lib/useReducedMotion.ts`

### 4-3. 이름 없는 버튼
- 숫자만 보이던 버튼: 글 좋아요 "좋아요 N개", 댓글 이동 "댓글 N개 보기", 댓글 좋아요 "댓글 좋아요 N개" (`BoardPost`)
- 채팅 이모지 "😊 넣기", 실패 메시지 "지우기"(보내지 못한 메시지 지우기), 요청 카드(마우스로만 고르던 article)를 Tab·Enter·Space 로 고를 수 있게
- 장식 기호(↻·🔔)는 `aria-hidden`, 빨간 점은 `aria-label`(일반 요소엔 금지) 대신 `.sr-only` "(오늘 아직 안 받음)". 전역 `.sr-only` 추가
- 스크립트로 후보 99개를 뽑아 눈으로 확인 (나머지는 글자가 식으로 들어가 있어 괜찮음)

### 4-4. 움직임 줄이기
- 전역 CSS: 애니메이션·전환 거의 0, 반복 1번, 부드러운 스크롤 끔 (원래 있던 규칙 보강)
- 땅굴: 설정이 켜져 있으면 입장 연출(천장 구멍·낙하·가구 떨어짐) 없이 다 차려진 방(`still`)으로
- 연결 띠·위 띠·말풍선 상태도 움직임을 끔. 탐색 시안 B·C·미니맵은 원래 존중함. 3D 두더지 숨쉬기·탐색 점프는 그대로 (7장)

### 4-5. 키보드만으로 주요 흐름 (헤드리스 크롬, 1440×960, 개발 서버)
| 단계 | 방법 | 결과 |
|---|---|---|
| 로그인 | Tab 2번 → 이메일 → Tab → 비밀번호 → Enter | `/burrow` ✔ |
| 내 땅굴 → 탐색 | Tab 10번에 "탐색" 링크 → Enter | `/burrow/explore` ✔ |
| 탐색 → 채팅 | Tab 22번에 헤더 "채팅" → Enter, Tab 8번에 예린 대화 → Enter | ✔ |
| 메시지 보내기 | Tab 21번에 입력창 → 글 → Enter | 보내짐 ✔ |
| 모임 신청 | `/meetups/m6` Tab 13번에 "주최자에게 남길 말" → 글 → Tab → "참여 신청하기" Enter | "참여 신청이 완료되었습니다" 토스트 ✔ |
| 모임 정보 팝업 | 버튼 Enter → Tab 14·Shift+Tab 5 → Esc | 19/19 팝업 안, Esc 뒤 "모임 정보" 버튼으로 초점 복귀, inert 풀림 ✔ |
- 아쉬운 점: 채팅까지 Tab 이 많음 (목록 전체를 지나감). "본문으로 건너뛰기" 링크와 대화 목록의 로빙 탭인덱스(화살표로 고르기)를 다음에 (7장)

### 4-6. 색 대비 낮은 곳 (WCAG 2.1, 글자 4.5:1 · 큰 글자·UI 3:1, 색은 바꾸지 않음 — 디자인 결정 필요)
| 조합 | 대비 | 쓰이는 곳 | 제안 |
|---|---|---|---|
| `--ink-400` #a39186 글자 / `--surface` #fbf8f4 | 2.85 | 보조 글자 전반 약 112곳(시각·메타·빈 상태·글자 수: `.hint`, 채팅 시각·헤더 소속·입력 중, 게시판 시각, 모임 정보, 프로필 소속, 알림 시각 등) | `--ink-400` 을 #776a62 로 (surface·bg-cream·surface-item 모두 4.5 이상) 또는 메타 글자를 `--ink-500`(6.58) |
| `--ink-400` / `--bg-cream` · `--surface-item` · 채팅 검색 #f3e4d6 · 흰 칸 placeholder | 2.43~3.02 | 위와 같음 | 위와 같음 |
| `--ink-300` #b3a193 / `--surface` | 2.35 | 방명록 메타, 게시판 "수정됨", 지난 모임 | #7c7066, 또는 흐림 대신 아이콘·취소선 |
| 온보딩 placeholder #b9a596 · 답변 미리보기 #b19a88 · 작은 태그 #9f8a7a | 2.17~2.68 | 온보딩 입력·미리보기·`.srcTag`(10px) | #7e7066 · #7f6f62 · #75655a |
| 흰 글자 / `--cta` #c8643a | 3.93 | **채팅 내 말풍선 본문(14px)** | 바탕 #b85c35 이하 (지금 hover 색 #b4552e 면 4.7) |
| #fff8f0 / `--cta` | 3.73 | `.btn-cta`(17px), 질문 필터 | `--cta` 를 #b4552e 로, hover 는 #a04a28 정도 |
| `--cta` 글자 / `--surface` | 3.71 | 탐색 "질문 추가", 질문 목록 상태 | 글자는 #b35934 |
| 흰 글자 / `--danger` #e5392f | 4.24 | 삭제 확인 버튼 | #dd372d (4.51) |
| `--danger` · `--alert` #d9573a 글자 / `--surface` | 4.00 · 3.69 | 신고 메뉴, **오류 문구 `.error`**(12px), 설정 규칙 | #d6352c · #c14d34 (오류 문구는 꼭) |
| `--line-strong` #e3cbb5 입력칸 테두리 / 흰 칸 | 1.56 | `.input`·`.textarea`·`.btn-line` (흰 칸이 크림 바탕 위라 테두리가 유일한 경계, WCAG 1.4.11) | 입력칸 테두리 전용 토큰 #a39282 (3.0) |
| 초점 외곽선 `--accent` / 어두운 바탕 `--bg-dark` | 약 2.1 | 랜딩·시작 화면의 키보드 초점 표시 | 어두운 바탕에서만 밝은 외곽선 (`--on-brown`) |
| (참고, 비활성) 비활성 버튼 | 1.68~1.69 | `.btn-cta:disabled` 등 | WCAG 예외. 왜 안 눌리는지 옆 문구 |
- 통과: 칩 톤 8쌍(5.8~6.4), `--accent` 링크(5.85), 헤더 활성(7.22), 토스트(12.15), 장면 버튼(6.2~6.5), `--ink-500` 이상
- 새로 만든 띠는 대비를 맞춤: 연결 띠 `--ink-800`/#fbe7d6, 실패 문구 #b4432b, 위 띠 `--on-brown`/`--toast-bg`

---

## 5. 확인한 것
- `cd app && npx tsc -b` 통과, 18:05 이후 `npm run build` · `npm run build:share` 통과 (`share-page.html` 생성). 청크 크기 경고(`index` 약 1MB · `moleActor` 약 620kB)는 전부터 있던 것
- 헤드리스 크롬 (개발 서버 5321, 캐시 폴더는 따로 둬서 같이 쓰는 `node_modules/.vite` 를 건드리지 않음)
  - 채팅: 보내기 직후 `<sending>` → 1.4초 뒤 확인 → "예린님이 입력 중…" → 답장. `mock.drop(6000)` → 1.5초 뒤 띠 "연결이 끊겼어요. 다시 연결하는 중… N초 뒤 다시 시도 · 지금 다시 연결" → 끊긴 동안 보낸 메시지 `<sending>` → 다시 붙으면 띠 "다시 연결됐어요. 놓친 메시지를 받아 왔어요", **끊긴 동안 상대가 보낸 메시지가 들어오고 내 메시지도 보내짐, 중복 0**. `?rt=down`: 띠 "채팅 서버에 연결하지 못했어요", 60초 뒤 `<failed>` "연결이 끊겨 보내지 못했어요 · 다시 보내기 · 지우기", 다시 보내기 → `<sending>`. `mock.rejectNext()`: 서버 거절 문구로 바로 실패
  - 팝업 포커스·키보드 흐름: 4-1·4-5 표
  - 에러 경계: `/dev/crash` → 헤더 그대로 + "잠시 문제가 생겼어요"
  - WebGL 끔(`--disable-webgl --disable-3d-apis`): 땅굴 2.5초 만에 2D 자리표시 그림(예전엔 8초 로딩 뒤), 찻방 2D 두더지
  - 청크 404 (빌드 결과에서 `RoomCanvas-*.js`·`ExploreMap-*.js` 를 잠깐 숨기고 `vite preview`): 땅굴 → 한 번 새로고침 → 다시 실패 → 2D 그림 + "새 버전이 나왔어요" 버튼, 헤더 그대로. 탐색 시안 B → 한 번 새로고침(표시 남음) → "잠시 문제가 생겼어요" + 헤더
- 스크린샷은 커밋하지 않음

## 6. 결정한 것 · 확인받을 것
1. **실시간 띠는 채팅 안에만** (채팅 밖은 알림이 조금 늦을 뿐). 오프라인·서버 끊김은 모든 화면 위 띠
2. **목 서버는 기본으로 끊기지 않음** (팀 시연이 매끄럽게). 끊김은 `?rt=flaky`·`?rt=down`·콘솔로
3. **목 답장**: 1:1 처음 보내면 꼭 한 번(예전 그대로) + 그 뒤 30%, 모임 25% — "가끔 답장"
4. **보낸 뒤 10초 안에 확인이 없으면 실패** (실패한 것은 자동으로 다시 보내지 않음, 사용자가 "다시 보내기"). 끊긴 동안 보낸 것은 **60초까지** 쥐고 있다가 붙으면 저절로 보냄 (처음에는 10초로 했다가, 백오프가 길어지면 다시 붙기 전에 실패가 떠서 늘림)
5. **탭이 10분 넘게 숨겨지면 끊음** (보이면 바로 다시 연결 + 놓친 것 받기)
6. **방명록 100 → 50자** (02 최신 프레임 + ERD). 팀원 확인 필요
7. 채팅 500자·모임 공지 100자 등 명세에 없는 길이는 프론트가 정함 (3-1 표) → 백엔드와 같은 값으로
8. 재배포 청크 404 는 화면이든 3D 든 **먼저 한 번 새로고침** (Vite 8 동작 때문, 2-1). 온보딩 중간 단계에서 일어나면 입력이 날아갈 수 있음
9. 3D 를 못 쓰면 땅굴은 로딩 8초를 기다리지 않고 바로 2D
10. 백엔드에 요청: `chat_message.client_message_id`(+UQ) · 방별 `seq` · 모임 카드 표현 · SUBSCRIBE 권한 검사 · 인증 만료 신호(4401/ERROR) · ERD 길이 미정 칼럼 (1-4, 3-1)

## 7. 남은 일
- 알림: `subscribeNotifications` 를 `data/notifications.ts` 에 잇기 (지금은 함수만). 새 대화 요청·수락도 `ROOM`/알림 이벤트로 받아 요청 탭을 갱신
- 모르는 방의 메시지(새로 생긴 대화방)는 지금 버림 → 대화방 목록 다시 받기(REST)와 잇기
- 위로 스크롤해서 예전 메시지 더 받기(`before` 커서), 메시지 많을 때 목록 가상화
- 실제 서버로 STOMP 구현 시험 (지금은 목으로만 확인. 프레임 만들기·풀기는 코드로만 확인)
- API 계층(다른 작업자)과 잇기: `reportServerDown/Up`, `refreshSessionOnce` + `handleUnauthorized`, `configureRealtime({ history })`, `FieldError` 를 다른 폼(방명록·대화 요청·내 정보 수정·모임 만들기·신청)에
- 접근성: "본문으로 건너뛰기", 대화 목록 화살표 고르기, 3D 두더지 숨쉬기·탐색 점프도 움직임 줄이기, 색 대비 표 반영(디자인 결정 뒤), 스크린 리더(NVDA)로 실제 확인
- 온보딩 도중 청크 404 새로고침 시 입력 보존 (온보딩 상태를 sessionStorage 에)

## 8. 다른 작업자와 겹칠 수 있는 파일
| 파일 | 내가 바꾼 것 | 겹칠 수 있는 이유 |
|---|---|---|
| `app/src/App.tsx` | `ENV.hashRouter`, AppLayout 에서 `startChatRealtime()`, 라우트 에러 경계 세 겹(라우트 배열을 경로 없는 라우트로 감쌈), `/dev/crash` | QueryClientProvider·라우트 추가 |
| `app/src/main.tsx` | `installChunkReload()`, `registerNavigator`, `<NetworkBanner />` | Provider 추가 |
| `app/src/components/NotFound.tsx` | `RouteError` 보강(inline·청크·404·개발 표시) | 로딩/에러 공용 화면 |
| `app/src/data/chat.ts` | 메시지 부분(보내기·받기·입력 중·구독), `ChatMsg` 칸 추가, `fakeReply` 지움 | 채팅 목록 비동기 전환 |
| `app/src/data/boardStore.ts`, `questions.ts`, `myBurrow.ts` | 글자 수 상수를 `lib/validation.ts` 에서 다시 내보냄 | 데이터 계층 전환 |
| `app/src/screens/board/BoardWrite.tsx` | 서버 에러 자리, submit 에 try/catch | 글쓰기 mutation 비동기 |
| `app/src/screens/burrow/VisitBurrow.tsx` | 방명록 50자, 대화 요청 글자 수 상수·aria | 상세 화면 데이터 가져오기 |
| `app/src/screens/meetups/MeetupDetail.tsx`, `MeetupNew.tsx`, `MeetupList.tsx` | 글자 수 상수, 🔔 aria-hidden | 상세·목록 비동기 |
| `app/src/screens/board/BoardPost.tsx` | 버튼 aria-label 셋 | 상세 비동기 |
| `app/src/screens/start/Auth.tsx` | 로그인 뒤 돌아갈 주소 | 인증 API |
| `app/vite.config.ts` | `DEV_PROXY_TARGET` 프록시 | 목 서버 플러그인 |
| `app/src/lib/env.ts` (새) | `ENV.apiBase` 등 | API 계층이 `import.meta.env` 를 직접 읽지 말고 여기를 쓰면 좋음 |
