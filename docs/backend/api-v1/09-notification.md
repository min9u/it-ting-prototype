# 09 알림 — API v1 맞추기 (2026-11-22)

- 요청: 프론트(`app/`)의 알림 영역을 백엔드 확정 API 명세 v1과 서비스 명세에 맞춘다 ([계획](../api-v1-alignment.md), [영역 작업 규칙](../api-v1-foundation.md) 2장)
- 기준: [api/09-notification.md](../team-spec/api/09-notification.md), [spec/09-notification.md](../team-spec/spec/09-notification.md), [db/notification.md](../team-spec/db/notification.md), [api-convention.md](../team-spec/api-convention.md) "실시간 소식"
- 결론: 명세의 API 5개를 모두 만들었고(`PENDING` 비움, 완성도 검사에 todo 없음), 알림 팝업 · 알림 화면 · GNB 빨간 점이 **API 훅만** 쓴다. 빨간 점은 SSE 소식 `NOTIFICATION_UNREAD_CHANGED`로 바로 바뀌고, 연결이 다시 붙으면 다시 받는다. 알림 종류는 명세의 22가지로 맞췄다
- 다음: 다른 영역의 목 서버가 자기 일에 맞춰 `pushMockNotification`을 부르게 하기(아래 "다른 영역에 넘기는 것"), 백엔드가 09를 구현하면 `VITE_API_REAL_AREAS`에 `notifications`를 더해 실제 서버로 확인

## 만든 API (`app/src/api/notifications/`)

| 명세 | 함수 (`notificationsApi.`) | 훅 | 쓰는 곳 |
|---|---|---|---|
| `GET /api/v1/me/notifications/popup` | `popup()` | `useNotificationPopup()` | 알림 팝업 |
| `GET /api/v1/me/notifications` | `list({ category, cursor, size })` | `useNotificationList(category)` (커서, 20개씩) | 알림 화면 |
| `GET /api/v1/me/notifications/unread-count` | `unreadCount()` | `useUnreadNotifications()` | GNB 빨간 점, 알림 화면 "안 읽음 N" |
| `POST /api/v1/notifications/{notificationId}/read` | `read(id)` | `useReadNotification()` (낙관적) | 팝업 · 알림 화면의 한 줄 누르기 |
| `POST /api/v1/me/notifications/read-all` | `readAll()` | `useReadAllNotifications()` (낙관적) | 팝업 · 알림 화면의 "모두 읽음" |

- `types.ts`: 명세 DTO 그대로 (`NotificationDto` · `NotificationTargetDto` · `NotificationPopupDto` · `NotificationUnreadDto`, 목록은 `CursorPageDto<NotificationDto>`). 종류 22가지와 갈래 · 갈 곳 종류 · actor 유무를 `NOTIFICATION_TYPE_SPEC` 한 표에 둠
- `mappers.ts`: 서버는 문구를 주지 않으므로 제목 · 보조 설명을 `type` · `actor.nickname` · `target.title` · `target.startsAt`로 만든다(`noticeText`). 일정 임박은 "1시간 뒤에 시작해요" · "내일 오후 2시에 시작해요". 원본이 사라져 `title`이 `null`이어도 문장이 되게 대신할 말을 둠("삭제된 글", "신청한 모임" …). 탈퇴한 사람은 "탈퇴한 사용자"
- `errors.ts`: `NOTIFICATION_NOT_FOUND` → "이미 사라진 알림이에요. 알림은 30일 동안만 보관돼요." (한 줄 누를 때는 이동이 먼저라 토스트 없이 조용히 넘기고 목록을 새로 받음)
- 시험: `src/tests/notice-types.test.ts` — 명세 문서의 "알림의 종류" 표를 읽어 22가지 · 갈래 · 갈 곳 · actor 가 프론트와 같은지, 갈 곳 주소, 명세 예시 DTO → 앱 모양, 목 서버의 주는 방식 · 만들 때의 규칙 · 404 · 실시간 소식. `rules.test.ts` 의 알림 부분도 새 규칙으로

## 실시간 소식 (SSE)

- 받는 곳: `useNotificationRealtime()` — `AppHeader`(로그인 영역의 모든 화면에 하나)에서 한 번 부른다. 연결을 따로 열지 않고 공통의 `useEventStream`을 쓴다
- `NOTIFICATION_UNREAD_CHANGED { unreadCount, hasUnread }` → 안 읽은 수 캐시(`['notifications','unread-count']`)를 그 값으로 바로 바꿈(빨간 점 · "안 읽음 N"), 열려 있는 팝업 · 알림 화면은 목록을 다시 받음(명세 "알림 팝업이나 알림 화면이 열려 있으면 목록을 다시 받는다")
- 다시 연결되면 `useRefetchOnReconnect([notificationKeys.all])` 로 알림 캐시를 모두 다시 받음 (끊긴 동안 소식은 오지 않음)
- 목 모드: `installMockNotificationServer()`가 알림 저장소 · 알림 설정을 지켜보다가 `{ unreadCount, hasUnread }`가 바뀌면 `mockEvents.emit('NOTIFICATION_UNREAD_CHANGED', …)`. 누가 알림을 만들든(다른 영역 목 · 관리자 공지) 같은 길로 나간다. 새 알림이고 "브라우저 알림 받기"를 켰으면 브라우저 알림도 흉내 냄. 개발 서버 콘솔에서 `__digulEvents.mock.emit('NOTIFICATION_UNREAD_CHANGED', { unreadCount: 3, hasUnread: true })`로 확인 가능
- 확인: 헤드리스 크롬에서 소식 0 → 점 꺼짐, 소식 7 → 점 켜짐 · "안 읽음 7", 모두 읽음 → 점 · 안 읽은 줄 0, `mockEvents.drop` 뒤 다시 `open`

## 화면

- **GNB 알림 아이콘** (`components/AppHeader.tsx`): 빨간 점 = `unread-count`의 `hasUnread` (숫자 아님). 끈 갈래의 알림은 점에 들지 않는다(서버가 계산)
- **알림 팝업** (`components/NotificationPopover.tsx`): 요청 두 줄은 늘 보이고 수가 0이면 배지 · 보조 문구를 숨김. 채팅 요청 보조 문구 "모카님 외 2명"은 `latestChatRequester` + `chatRequestCount`. 최근 알림 5개는 서버가 준 그대로(요청 알림 제외, 안 읽은 것 먼저). 불러오는 중 스켈레톤, 실패 시 다시 시도
- **알림 화면** (`screens/notifications/Notifications.tsx`): "안 읽음 N"은 `unread-count`의 `unreadCount`(열 때 · 탭을 바꿀 때 다시 받음). 탭은 `category`를 붙여 서버에서 거름. "더 보기"는 커서. 이어 받는 사이 순서가 바뀌어 같은 알림이 또 오면 한 번만 보임
- **한 줄 누르기**: 읽음(화면에 먼저 반영) + 갈 곳으로 이동. 저장이 실패해도 이동은 함

### 눌렀을 때 갈 곳 (`noticeLink`)

| `target.type` | 주소 |
|---|---|
| `MEETUP` | `/meetups/{id}`. `MEETUP_APPLICATION_RECEIVED`면 `/meetups/me?tab=hosting&manage={id}` (그 모임 신청 관리) |
| `CHAT_ROOM` | `/chat/{id}` |
| `CHAT_REQUEST` | `/chat/requests` (받은 요청) |
| `POST` | `/board/{id}` (댓글 알림도 글로) |
| `GUESTBOOK` | `/burrow?modal=guestbook` (내 땅굴 방명록 전체 보기) |
| `BURROW` | `/burrow/{id}` (가려진 방명록 글을 썼던 땅굴, 방문자 뷰) |
| `NOTICE` | `/settings/notices/{id}` |

**원본이 사라진 알림**: 명세대로 줄은 그대로 두고, 누르면 그 화면으로 간다 → 그 화면의 조회 API가 404 → 안내 화면(00 공통 21, 예: "삭제된 모임이에요"). 전에는 알림 쪽에서 `gone` 표시를 보고 `/gone/:what`으로 보냈지만, 명세는 알림이 원본이 있는지 알려 주지 않으므로 없앴다(`/gone/:what` 라우트 자체는 남겨 둠). `/meetups/x-deleted`로 안내 화면이 나오는 것을 확인함

## 기능 맞추기 (명세가 기준)

| | 내용 |
|---|---|
| 더함 | `MEETUP_DELETED`(모임 삭제, 신청 대기자에게) 종류. 팝업이 API 하나로 요청 수 · 최근 요청자 · 최근 5개 · 안 읽은 수를 받음. 일정 임박 문구를 `startsAt`으로 만듦 |
| 바꿈 | 종류 이름을 명세 코드로: `APPROVED→ACCEPTED`, `MEMBER_LEFT→PARTICIPATION_CANCELED`, `STARTING_SOON→START_REMINDER`, `VACANCY→VACANCY_OPENED`, `CHAT_MESSAGE→CHAT_MESSAGE_RECEIVED`, `GUESTBOOK_WRITTEN→GUESTBOOK_ENTRY_CREATED`, `GUESTBOOK_HIDDEN→GUESTBOOK_ENTRY_HIDDEN`, `SERVICE_NOTICE→NOTICE_PUBLISHED`. 갈 곳 종류에서 `COMMENT`를 빼고 `GUESTBOOK`을 더함 |
| 바꿈 | **꺼 둔 갈래의 알림**: 전에는 목록과 빨간 점에서 모두 숨김 → 명세대로 새로 만들지만 않고, 끄기 전에 받은 것은 목록 · 안 읽은 수에 남고 빨간 점에만 빠짐 |
| 바꿈 | 신청 수락 알림이 모임 대화방으로 가던 것 → 명세대로 모임 상세로 |
| 뺌 | "찜한 모임이 곧 마감돼요"(마감 임박) 알림 — 명세에 없음(빈자리 생김과 일정 임박만) |
| 뺌 | "답글 좋아요"를 따로 두던 것 → 명세는 `COMMENT_LIKED` 하나(댓글 · 답글) |
| 뺌 | 서버가 만든 문장(`title` · `body`)과 `targetExists` · `readAt` 칸 — 명세는 문구 없이 `type` · `actor` · `target`, 읽음은 `isRead` |
| 뺌 | 탭에 따라 "모두 읽음"을 그 갈래만 하던 옛 초안 — 명세는 늘 모든 갈래 |
| 뺌 | 화면이 저장소(`data/notifications`, `data/chat`, `data/meetupStore`)를 직접 읽던 것 |
| 안 함 | 방노트 알림 — 명세가 보류 |

목 데이터(`data/notifications.ts`)는 이제 `notification` 테이블처럼 문구 없이 (종류, 일으킨 사람, 갈 곳 id, 생긴 시각, 읽은 시각)만 갖고, 목 서버가 DTO를 만들 때 모임 · 글 · 공지 · 대화방 저장소에서 제목과 시작 시각을 그때그때 읽는다(없으면 `null`). 시드에 삭제된 모임(`x-deleted`), 삭제된 글(`p28`)의 알림을 넣어 "원본이 사라진 알림"을 볼 수 있게 했다.

## 애매한 점에서 정한 것

1. **팝업의 "모임 참여 요청" 줄의 갈 곳**: 서비스 명세는 "신청이 온 모임이 하나면 그 모임의 신청 관리, 여러 개면 내가 연 모임 탭"인데, 팝업 API는 수만 주고 모임 id를 주지 않는다 → **늘 내 모임 › 내가 연 모임 탭**(`/meetups/me?tab=hosting`)으로 보냄 (질문 1)
2. **"안 읽음 N"**: 목록 API가 수를 주지 않으므로 `unread-count`의 `unreadCount`(모든 갈래, 요청 알림 포함)를 씀. 탭과 상관없이 같은 수
3. **팝업에 최근 알림이 없을 때**: 명세 "정하지 않은 것" → 지금처럼 "새 알림이 없어요" 한 줄
4. **땅굴 갈래 아이콘 색**: 명세 "디자인에서 정한다" → 지금처럼 이끼색 `#7A8448`
5. **문구**: 서버가 문구를 주지 않아 프론트가 정했다(위 `noticeText`). 새 메시지 알림은 메시지 내용이 오지 않으므로 "민구님이 메시지를 보냈어요" / 모임 대화방이면 "‘모임 이름’ 대화방 · 민구님"
6. **한 줄 누를 때 404**(30일이 지나 사라짐): 이동은 이미 했으므로 토스트 없이 목록을 새로 받아 줄을 뺌
7. **이어 받기 중복**: 목 서버 커서는 위치 기준이라 읽음이 바뀌면 같은 알림이 또 올 수 있어, 화면에서 id로 한 번만 보이게 함 (실제 서버는 명세상 다시 주지 않음)
8. **모든 알림 갈래 이름**: 탭 · 아이콘용 한국어 이름(모임 · 채팅 · 커뮤니티 · 땅굴 · 공지)과 설정 스위치 상수(`KIND_META` · `NOTICE_KINDS`)는 설정 화면도 쓰므로 `data/notifications.ts`에 그대로 둠

## 다른 영역에 넘기는 것

- **알림 만들기 (목)**: 각 영역의 목 서버가 명세 "알림의 종류"의 만드는 때에 맞춰 부른다. 받는 사람은 늘 목 계정(나)이라, 내가 받는 알림만 만들면 된다
  ```ts
  import { pushMockNotification, markMockChatNotificationsRead } from '../notifications'
  pushMockNotification('MEETUP_APPLICATION_ACCEPTED', { actorId: hostId, targetId: meetupId })
  pushMockNotification('GUESTBOOK_ENTRY_CREATED', { actorId: writerId })        // 갈 곳 id 없음
  pushMockNotification('CHAT_MESSAGE_RECEIVED', { actorId, targetId: roomId })  // 대화방마다 한 줄로 묶임
  markMockChatNotificationsRead(roomId)  // 06 대화방 읽음 API 의 목에서 (명세: 그 방의 새 메시지 알림도 읽음)
  ```
  자기 자신이 한 일 · 꺼 둔 갈래는 알아서 건너뛰고(`null`), 실시간 소식도 알아서 나간다. 지금 이걸 부르는 곳은 관리자 공지 작성(`data/serviceNotices.ts`의 옛 `pushNotice` → `NOTICE_PUBLISHED`)뿐이다. 모임 · 채팅 · 커뮤니티 · 땅굴 작업자가 자기 목에 넣으면 된다
- **설정 작업자(10)**: 알림 설정을 바꾸면 빨간 점(`hasUnread`)이 바뀔 수 있다. 목에서는 알림 영역이 설정 저장소를 지켜보다가 소식을 보내지만, 실제 서버가 이때도 소식을 보내는지는 명세에 없다 → `PATCH /me/notification-settings` 성공 뒤 `queryClient.invalidateQueries({ queryKey: notificationKeys.unread() })`를 권함. 알림 설정 스위치 저장소(`noticePrefs`)는 그대로 `data/notifications.ts`에 있다
- **채팅 작업자(06)**: 대화방을 읽으면 그 방의 새 메시지 알림도 읽음이 되므로, 읽음 API 성공 뒤 `notificationKeys.all`을 무효화하거나(실제 서버는 `NOTIFICATION_UNREAD_CHANGED`를 보내므로 그것으로도 충분) 목에서 `markMockChatNotificationsRead(roomId)`를 부른다
- 공통에 바란 변경은 없다

## 백엔드 · 팀에 물을 것

1. 팝업 API가 수만 줘서 "신청이 온 모임이 하나면 그 모임의 신청 관리로" (spec 09 팝업 3)를 할 수 없다. `meetupRequestCount`와 함께 신청이 온 모임 id 하나(모임이 하나일 때만)를 줄 수 있는지, 아니면 늘 내가 연 모임 탭으로 가도 되는지
2. 알림 설정을 바꿔 `hasUnread`가 달라질 때도 `NOTIFICATION_UNREAD_CHANGED`를 보내는지 (다른 탭의 빨간 점을 맞추려면 필요)
3. `MEETUP_CANCELED`의 `target.title`: 취소된 모임은 남아 있으니 제목이 오는 것으로 보았다. 맞는지 (삭제만 `null`)
4. `CHAT_MESSAGE_RECEIVED`가 1:1 대화방이면 `target.title`이 `null`이다. 상대 이름은 `actor`로 충분한지 (지금은 "민구님이 메시지를 보냈어요")
5. `GUESTBOOK_ENTRY_HIDDEN`은 `actor` · `title`이 모두 `null`이라 어느 땅굴인지 문구로 말할 수 없다. 땅굴 주인 닉네임을 `target.title`에 담아 줄 수 있는지
6. 목록 커서의 "이어 받는 사이 새로 생기거나 읽음이 바뀐 알림은 다시 오지 않는다"를 어떻게 보장하는지(스냅숏 시각?). 프론트는 혹시 몰라 id로 거른다

## 확인

- `npx tsc -b --noEmit`, `npm test`(33 파일, 447 통과 · todo 102 — 알림 todo 없음), `npm run build` 통과
- 개발 서버(5417) 스모크 `--only=notifications`: `/notifications` · `/notifications?empty=1` · `/settings/notifications`, 그리고 `/burrow?notice=open`(팝업). 실패 0. 경고는 모두 글꼴(`pretendard` woff2) 403인데, 작업 트리의 `node_modules`를 원래 체크아웃에 심볼릭 링크로 걸어 Vite `fs.allow` 밖이 된 탓이라 코드와 무관
- 스크린샷으로 확인: 알림 화면(안 읽은 것 먼저, 문구), 모임 탭, 팝업(요청 두 줄 + 최근 5개), 삭제된 모임 알림의 갈 곳(`/meetups/x-deleted` → "삭제된 모임이에요")
