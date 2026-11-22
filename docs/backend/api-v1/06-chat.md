# 06 채팅을 API v1 에 맞춤 (2026-11-22)

- 요청: 백엔드 확정 명세 v1 의 06 채팅([API](../team-spec/api/06-chat.md) · [서비스 명세](../team-spec/spec/06-chat.md))에 프론트 채팅을 맞춘다. 실시간은 WebSocket + STOMP 대신 **공통 SSE 연결 + REST 보내기**로 옮긴다 ([계획](../api-v1-alignment.md), [영역 작업 규칙](../api-v1-foundation.md) 2장)
- 결론: 06 의 API 13개를 모두 `app/src/api/chat/` 에 명세 모양으로 만들었고(`PENDING` 비움), 채팅 화면의 읽기 · 쓰기는 모두 이 영역의 훅 · 함수를 거친다. 새 메시지 · 요청 수는 SSE 소식(`CHAT_MESSAGE_CREATED` · `CHAT_REQUEST_COUNT_CHANGED`)으로 받고, 다시 붙으면 조회 API 로 맞춘다. 예전 STOMP 허브는 지웠다
- 다음: 다른 영역이 아직 `data/chat.ts` 를 직접 읽는 곳을 각자 API 로 옮기고(아래 6장), 백엔드에 7장 질문을 묻는다

---

## 1. 만든 API (`api/chat/real.ts` ENDPOINTS 13개)

| API | 함수 (`chatApi`) | 앱에서 부르는 곳 (`api/chat/queries.ts`) |
|---|---|---|
| `GET /me/chat-rooms` | `rooms` | `useChatRooms()` — 채팅에 들어올 때마다 새로 받음. 필터(전체 / 1:1 / 모임) · 검색(상대 닉네임 · 모임 이름)은 화면이 받은 목록에서 |
| `GET /chat-rooms/{chatRoomId}` | `room` | `useChatRoom(id)` — 찻방 · 헤더 · 공지 · 모임 정보 팝업 · `leaveType` |
| `GET /chat-rooms/{chatRoomId}/messages` | `messages` | `useChatMessages(id)` — 커서, 30개씩. 위로 올리면 이어 받기(+ "이전 메시지 더 보기") |
| `POST /chat-rooms/{chatRoomId}/messages` | `sendMessage` | `useSendMessage(id)` — 보내는 중 · 실패 · 다시 보내기 (`api/chat/outbox.ts`) |
| `POST /chat-rooms/{chatRoomId}/read` | `read` | `useReadReceipt(id, 마지막 메시지 id)` — 열린 방에서 마지막 메시지가 바뀔 때 · 탭이 다시 보일 때. 응답의 안 읽은 수로 목록을 맞춤 |
| `POST /chat-rooms/{chatRoomId}/leave` | `leave` | `chatCalls.leave` — 1:1 "대화 나가기", 끝났거나 취소된 모임의 "모임 나가기" |
| `PUT /chat-rooms/{chatRoomId}/notice` | `setNotice` | `chatCalls.setNotice` — 공지 쓰기 · 고치기 (`canEditNotice` 일 때만 보임) |
| `DELETE /chat-rooms/{chatRoomId}/notice` | `deleteNotice` | `chatCalls.deleteNotice` |
| `GET /me/chat-requests?direction=` | `requests` | `useChatRequests('RECEIVED' \| 'SENT')` |
| `GET /me/chat-requests/count` | `requestCount` | `useChatRequestCount()` — "요청 N"(받은 것만) · 받은/보낸 요청 옆 숫자 · "받은 요청 보기" |
| `POST /chat-requests/{chatRequestId}/accept` | `acceptRequest` | `chatCalls.accept` → 만들어진 대화방으로 이동 |
| `POST /chat-requests/{chatRequestId}/reject` | `rejectRequest` | `chatCalls.reject` → 토스트 "요청을 거절했어요", 다음 요청을 고름 |
| `POST /chat-requests/{chatRequestId}/cancel` | `cancelRequest` | `chatCalls.cancel` |

`GET /me/event-stream` 은 공통(`api/common`, `realtime/events.ts`)이 맡는다.

채팅 화면이 **다른 영역의 API 를 잠깐 대신 부르는 것** (ENDPOINTS 에 넣지 않음, 그 영역이 만들면 바꿀 것):
- `cancelMeetupParticipation` → `POST /meetups/{meetupId}/cancel-participation` (07 모임). 모임 나가기 확인 팝업 "예" (`leaveType` = `CANCEL_PARTICIPATION`)
- `uploadImage` → `POST /images` (08 커뮤니티). 사진 첨부
- `sendRequest` (@deprecated) → `POST /chat-requests` (05 탐색 · 방문). 방문자 뷰가 아직 `api.chat.sendRequest` 를 부름. 응답은 05 명세 모양(`chatRequestId` · `chatRoomId` …), 목 오류 code 는 예전 것(`REQUEST_FROM_PEER` 등)을 그대로 둠 — 방문자 뷰가 이 code 로 안내 토스트를 띄워서

DTO 는 `api/chat/types.ts` 에 명세 그대로 (숫자 id, UTC, `UserDisplayDto`, `InterestTagDto`, 값이 없으면 `null`). 글자 수는 명세대로 메시지 1,000자 · 공지 200자 · 사진 3장 (`CHAT_MESSAGE_MAX` · `CHAT_NOTICE_MAX` · `CHAT_IMAGES_MAX`).

오류 문구는 `api/chat/errors.ts` (`CHAT_ROOM_NOT_FOUND` · `CHAT_ROOM_READ_ONLY` · `CHAT_ROOM_LEAVE_NOT_ALLOWED` · `CHAT_REQUEST_NOT_FOUND` · `CHAT_REQUEST_ALREADY_ACCEPTED` · `FORBIDDEN` + 모임 참여 취소의 `MEETUP_*`). 화면은 `useOptimistic` 의 `errors: CHAT_ERRORS` 와 `errorText(e, CHAT_ERRORS)` 만 쓰고 message 글자로 가르지 않는다.

## 2. 실시간 (SSE + REST)

- 받기: `useChatEvents()` 를 로그인 영역(`App.tsx` AppLayout)에 한 번 둔다 (예전 `startChatRealtime()` 자리)
  - `CHAT_MESSAGE_CREATED` (`applyChatMessageEvent`): 열린 메시지 캐시에 붙임(같은 id 는 한 번) → 대화 목록에서 그 방의 마지막 메시지 · 안 읽은 수를 바꾸고 맨 위로(지금 보고 있는 방이면 0) → 목록에 없는 방이면 목록을 다시 받음(수락 · 모임 확정으로 새로 생긴 방) → 1:1 상대의 `LEFT` · `WITHDRAWN` 이면 목록 · 대화방을 읽기 전용으로 → 모임의 `JOINED` · `LEFT` · `WITHDRAWN` 이면 대화방 조회를 다시 받아 참여자를 맞춤 → 내가 나간 `LEFT`(다른 탭)면 목록에서 뺌. 열린 방에 새 메시지가 붙으면 `useReadReceipt` 가 읽음 API 를 부름
  - `CHAT_REQUEST_COUNT_CHANGED`: "요청 N" 을 그 값으로, 받은 요청 목록은 새로 받음
  - 다시 붙으면 `useRefetchOnReconnect([chatKeys.all])` (명세: 끊긴 동안의 소식은 다시 오지 않음)
- 보내기: `POST /chat-rooms/{id}/messages`. 누르면 바로 "보내는 중"으로 그리고(`outbox`), 성공하면 응답 메시지로 바꿈, 실패하면 까닭 + "다시 보내기 · 지우기". 실패 메시지는 이 탭 안에서 방을 오가도 남는다
- **중복 없이 한 번만 그리기**: 명세에 보낸 쪽 id(clientMessageId)가 없어서, 내 메시지가 응답보다 먼저 소식으로 오면 본문 · 사진 수가 같은 가장 오래된 "보내는 중"을 그 소식으로 대신한다. 그 뒤 온 응답은 id 가 같아 버린다
- 연결 띠(`components/ConnectionStrip.tsx`)는 SSE 상태(`useEventStreamStatus`) + 오프라인을 본다. "지금 다시 연결"은 연결을 새로 열고 채팅 캐시를 새로 받는다. 보내기는 REST 라 연결이 끊겨도 된다
- 지운 것: `realtime/hub.ts` · `stompTransport.ts` · `mockTransport.ts` · `protocol.ts` · `order.ts` · `types.ts`. `realtime/index.ts` 는 SSE 입구만 다시 내보낸다

### 목 서버 · 손잡이
- 목 DB 는 `data/chat.ts` (요청 상태 `PENDING` · `REJECTED` · `ACCEPTED` · `CANCELED`, 메시지 종류 5개, 읽은 자리 `lastReadId`). 목 서버는 `api/chat/mock.ts`: 메시지가 생기면 `mockEvents.emit('CHAT_MESSAGE_CREATED', …)`(보낸 사람도 받음), 요청 수가 바뀌면 `CHAT_REQUEST_COUNT_CHANGED`. 내가 보내면 1.5 ~ 3.5초 뒤 상대(모임은 가끔 누군가)가 답한다
- 손잡이 (예전 `?rt=` 를 SSE 에 맞춰 다시 만듦):

| 손잡이 | 뜻 |
|---|---|
| `?rt=flaky` | 20 ~ 40초마다 실시간 연결이 2 ~ 8초 끊기고, 그 사이 상대 메시지가 옴 → 다시 붙으면 조회로 받아 옴 |
| `?rt=down` | 실시간 서버가 꺼진 것처럼 (띠 "채팅 서버에 연결하지 못했어요"). 보내기는 됨, 답장은 화면에 안 옴 |
| `?rt=quiet` | 상대 답장 흉내 끔 |
| `?api=writefail` | 보내기 실패 → "다시 보내기" |
| 콘솔 `__digulChat.incoming(방, 글)` · `.request(사람, 인사)` · `.partnerLeaves(방, 탈퇴?)` · `.drop(ms)` | 상대 메시지 · 새 요청(요청 N 이 바로 바뀜) · 상대가 나감/탈퇴(읽기 전용) · 연결 끊기. 개발 서버 또는 `?rt=` 가 있을 때 |

`window` 는 모듈을 불러올 때가 아니라 `startChatMockDriver()`(목 모드에서 `useChatEvents` 가 한 번 부름) 안에서만 만진다 (Next.js 이전 규칙).

## 3. 화면 (`screens/chat/Chat.tsx`)

- 대화 목록 · 대화방 · 메시지 · 요청 · 요청 수 · 공지 · 나가기 · 수락 · 거절 · 취소 · 읽음 · 보내기가 모두 `api/chat` 을 거친다. 화면이 `data/chat.ts` 를 부르던 곳은 없다
- 대화방은 조회 결과로 그린다: 1:1 헤더 = 상대 사용자 표시 + 겹치는 관심사 수(`sharedInterests` 개수), 모임 헤더 = 모임 이름 · 참여 인원(`members` 수) · 일시 · 장소, 모임 정보 팝업 = 카테고리 · 일시 · 장소 · 확정 인원(`confirmedCount / capacity`) · 참여자("주최" · "나")
- 메시지 좌우는 `sender.id` 를 내 계정 id(`GET /me` 의 `userId`, 없으면 목의 나)와 비교, "주최"는 `meetup.hostId` 와 비교
- 찻방 3D(`TeaRoom` → `ChatRoomCanvas`)는 그대로, 넘기는 손님 목록만 조회 결과에서 만든다 (1:1 = 나 + 상대, 모임 = `members`)
- "없는 대화예요"는 `GET /chat-rooms/{id}` 의 404 로

## 4. 명세에 맞춰 더하고 뺀 것

| | 무엇 | 근거 |
|---|---|---|
| 더함 | 사진 첨부 (메시지 하나에 3장, 고를 때 바로 `POST /images`, 썸네일 · 빼기, 사진만 보내기) · 보낸 사진 보기 | 1:1 대화 7, API "첨부에서 사진을 고를 때" |
| 더함 | 위로 스크롤하면 이전 메시지 이어 받기 | API "위로 스크롤할 때" |
| 더함 | 모임 나가기를 `leaveType` 대로: `CANCEL_PARTICIPATION` = 모임 참여 취소, `LEAVE_ROOM` = 대화방에서만(끝났거나 취소된 모임), `NOT_ALLOWED` = 주최자면 숨김 · 아니면 꺼진 버튼 + "시작 24시간 전부터는 나갈 수 없어요". 확인 팝업 [아니오] → 모임 정보 팝업으로, 토스트 "모임을 나갔어요" | 모임 정보 팝업 4, 모임 나가기 확인 팝업 |
| 더함 | 보낸 요청에 상대가 거절한 요청도 "답변 기다리는 중"으로 보이고 취소됨 (목 데이터에 예시 `q4`) | 보낸 요청 1 · 2 |
| 더함 | 거절한 뒤 다음 요청을 자동으로 고름, 남은 요청이 없으면 빈 상태 | 거절 완료 토스트 2 (제안 채택) |
| 더함 | 모임 정보 팝업의 온라인 접속 링크 (`joinUrl`) | API "명세에 없어 정한 것" (어디 보일지 없음 → 장소 줄) |
| 뺌 | "+" 의 모임 공유 메뉴 | 입력창은 사진 첨부 · 입력 · 이모지 · 보내기. 모임 카드는 모임 상세에서 복사한 링크를 보내면 됨 |
| 뺌 | 상대 "입력 중…" | 실시간 소식에 없음 (명세 README "이번 범위에 없는 것"과 같은 결) |
| 뺌 | 요청 카드의 맥락("땅굴에 다녀갔어요" 등) | DTO 에 없음 |
| 뺌 | 대화 목록의 모임 "N명" · 관심사 색 | 목록 DTO 에 없음 → 타일 색은 이름 글자로 |
| 뺌 | 화면에서 차단한 사람 거르기 | 서버(목 서버)가 함 |
| 그대로 없음 | 메시지 지우기 · 읽음 표시 · 접속 중 | 명세 |

## 5. 애매해서 정한 것

1. **안내 메시지 문구** (명세: 프론트가 `type` + 닉네임으로): `ACCEPTED` 남 = "{닉네임}님이 대화 요청을 수락했어요", 나 = "{상대}님의 대화 요청을 수락했어요" (+ 1:1 이면 함께 이야기할 관심사 칩) · `JOINED` = "{닉네임}님이 / 내가 모임에 참여했어요" · `LEFT` 1:1 = "상대방이 대화방을 나갔습니다", 모임 = "{닉네임}님이 모임 대화방을 나갔어요" · `WITHDRAWN` 1:1 = "상대방이 탈퇴했습니다", 모임 = "참여자 한 명이 탈퇴했어요"(탈퇴하면 닉네임이 null)
2. **모임 카드가 붙은 메시지**는 본문에서 링크 글자를 빼고 나머지 글 + 카드로 보인다 ("모임 카드로 바뀌어 보인다"). 카드에는 카테고리가 없어 표지판 색은 이름 글자로
3. **대화 나가기 확인 팝업**: 명세 보류 → 예전 문구("대화방을 나갈까요?") 그대로
4. **읽음을 보내는 메시지**: 화면의 마지막 서버 메시지(안내 메시지여도). 탭이 숨겨져 있으면 돌아올 때. 보내자마자 목록의 안 읽은 수를 0 으로 두고 응답 값으로 맞춤
5. **목록 · 요청 수는 채팅에 들어올 때마다 새로 받음** (`refetchOnMount: 'always'`) — 만료로 줄어든 수는 소식이 안 와서
6. **내 두더지 · 닉네임(찻방 · 나 표시)**: 명세는 `GET /users/{내 id}/profile` 이지만 그 API 는 다른 영역이라 아직 목 데이터(`USERS[ME_ID]` · `getMyWorn()`)를 씀
7. **요청 카드를 고를 때의 프로필 패널**: 명세대로 남의 땅굴 조회를 쓰되 탐색 영역의 `useBurrow(id).data.owner` 를 가져다 씀 (자기소개 · 관심사 · 질문). 오기 전에는 요청의 사용자 표시
8. **목 데이터**: 끝난 모임 대화 예시를 `g-m9`(내가 참여하지 않은 모임) → `g-p1`(참여한 지난 모임 "10월 독서 모임")로 바꿈. 모임 저장소에서 참여 확정 · 주최인 모임은 대화방이 자동으로 생겨 지난 모임(가을 사진 산책 등)도 목록에 보인다. 모임 대화방 id 는 목에서 `g-<모임 id>` 그대로 (주소 `/chat/g-m1` 이 계속 됨)
9. **다시 보내기**는 같은 본문 · 사진으로 새로 `POST` (명세에 멱등 키가 없음 → 7장 질문 1)

## 6. 다른 영역 · 공통에 남긴 것 (이 작업에서 고치지 않음)

- **공통**: `lib/validation.ts` 의 `RULES.chatMessage.max`(500) · `meetupNotice.max`(100)가 명세(1,000 · 200)와 다름 → 채팅 화면은 `api/chat/types.ts` 상수를 씀. `lib/env.ts` 의 `realtime`(`VITE_REALTIME`) · `wsPath`(`VITE_WS_URL`), `api/config.ts` 의 `WS_URL`, `vite-env.d.ts` 두 줄은 이제 쓰는 곳이 없음 → 지워도 됨. `lib/network.ts` 주석의 `useRealtimeStatus` 는 `useEventStreamStatus` 로
- **탐색 · 방문**: `POST /chat-requests` 를 explore 로 옮기고 방문자 뷰가 그것을 부르게 → 그 뒤 `api.chat.sendRequest` 를 지움. 목은 `data/chat.ts` 의 `sendRequest(userId, message)`(거절한 요청이 살아 있으면 수락 처리 → `chatRoomId`, 못 만들면 까닭)를 쓰면 됨. 남의 땅굴 조회의 `chat.status` 계산도 `dmRoomWith` · `sentRequestTo` · `receivedFrom` 으로
- **모임**: `MeetupList` · `MeetupDetail` 이 `data/chat.ts` 를 직접 읽음(`roomOf(…).unread`, 대화 미리보기 `messages`, `leaveRoom`). 명세는 모임 상세의 대화방 id(07) + 메시지 조회 `size=3` → `chatApi.messages(toDtoId(방), { size: 3 })` 나 `useChatMessages` 를 쓰면 됨. 실제 서버에서는 `/chat/g-<모임 id>` 주소가 안 되므로 07 응답의 대화방 id 로 링크해야 함. 참여 취소 API 가 생기면 채팅의 `cancelMeetupParticipation` 을 그것으로 바꿈
- **커뮤니티**: `POST /images` 가 생기면 채팅의 `uploadImage` 를 그것으로
- **알림**: `components/NotificationPopover.tsx` 가 `data/chat.ts` 의 `liveRequests` 로 "채팅 요청"을 셈 → `useChatRequestCount()` / `useChatRequests('RECEIVED')` 로
- **인증 · 설정**: 설정의 로그아웃 · 탈퇴가 부르는 `stopChatRealtime()` 은 이제 `stopEventStream()` 만 부름 → 그것을 바로 불러도 됨
- 화면 목록(`screens/ScreenIndex.tsx`)에 끝난 모임 대화 `/chat/g-p1` 을 더하면 스모크에서 `LEAVE_ROOM` 모습도 봄
- `docs/frontend-guide.md` 의 채팅 손잡이(`?rt=` · `VITE_REALTIME=stomp`) 설명은 옛것 → 이 문서 2장으로

## 7. 백엔드 · 팀에 물을 것

1. **메시지 멱등 키**: 보내기 응답이 늦어(타임아웃 · 끊김) "다시 보내기"를 누르면 두 번 저장될 수 있다. 요청에 `clientMessageId` 를 받아 같은 값이면 한 번만 저장하고, 메시지(응답 · 소식)에 그대로 돌려줄 수 있는지. 그러면 프론트의 "본문이 같은 보내는 중을 대신하기"도 필요 없어짐
2. **모임 링크 모양**: 서버가 본문에서 알아보는 링크 (`https://<도메인>/meetups/{id}` 만? 해시 라우팅 `/#/meetups/{id}` 도?). 모임 상세의 "링크 복사"는 지금 `location.href` 를 복사한다
3. **대화 목록 항목에 모임 카테고리 · 인원**이 없다. 목록 타일 색과 "N명"을 보여 주려면 `meetup.category` · 참여 인원이 필요 (없어도 됨, 지금은 뺌)
4. **차단**: 06 에는 차단한 사람과의 1:1 대화방 · 요청을 어떻게 하는지 없다 (목은 목록 · 요청에서 뺌). 10 설정 명세와 맞춰 주면 좋겠다
5. **사진 확인**: 형식(JPEG · PNG · WebP) · 5MB 를 프론트가 미리 막을지, 서버 400 만 볼지
6. **`leaveType` = `NOT_ALLOWED`** 의 두 경우(주최자 = 버튼 숨김, 24시간 전 지남 = 꺼짐)를 프론트가 `meetup.hostId` 와 내 id 로 가른다. 괜찮은지
7. **SSE 재연결**: `Last-Event-ID` 로 놓친 소식을 주는 계획이 없는지 (없으면 지금처럼 다시 조회)

## 8. 확인한 것

- `npx tsc -b --noEmit` · `npm test`(33 파일, 439 통과 · 94 todo — 채팅 todo 0) · `npm run build` 통과
- 시험 `src/tests/chat.test.ts` 새로 씀 (26개): 목 저장소 규칙(만료 · 거절 숨김 · 거절한 사람에게 요청 = 수락 · 안 읽은 수 · 메시지 id 순서), 목 서버 DTO · 에러 code(`INVALID_INPUT` · `CHAT_ROOM_READ_ONLY` · `CHAT_ROOM_LEAVE_NOT_ALLOWED` · `FORBIDDEN` · `CHAT_REQUEST_ALREADY_ACCEPTED` + `detail.chatRoomId` …) · 소식 보냄, 소식 → 캐시(맨 위 · 안 읽은 수 · 목록에 없는 방 · 읽기 전용 · 내 메시지 한 번만), 매퍼(안내 문구 · 모임 카드 · 미리보기). 예전 STOMP 허브 시험은 없었고 `chat.test.ts` 의 저장소 시험을 이것으로 바꿈
- 개발 서버(5414) 스모크 `--only=chat` 9화면 OK (콘솔 오류 · 실패 요청 없음)
- 헤드리스 크롬으로 흐름 확인: 보내기 → "보내는 중" → 확인 → 3초쯤 뒤 상대 답장(SSE 목) · 목록 맨 위 / 다른 방을 보는 동안 온 메시지 → 목록 안 읽은 수 1 / `writefail` → "다시 보내기" → 방을 오가도 남음 → 다시 보내면 성공 / 새 요청 소식 → "요청 2 → 3" / `drop(3000)` → 띠 "연결이 끊겼어요" → 2초 뒤 "다시 연결됐어요" / 상대가 나감 → 읽기 전용 안내 · 입력창 사라짐 / 수락 → 새 대화방 + "서벅이님의 대화 요청을 수락했어요" / 주최자 공지 쓰기
