# 채팅 API

받은 대화 요청을 수락하거나 거절하고, 보낸 요청을 취소하고, 1:1 대화와 모임 대화에서 메시지를 주고받는 일을 다룬다. 새 메시지와 요청 수를 화면을 새로 열지 않고 받는 실시간 소식도 여기에 있다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [06 채팅](../spec/06-chat.md)
- DB 설계: [채팅](../db/chat.md), [모임](../db/meetup.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/me/chat-rooms` | 내 대화 목록을 준다 | 필요 | 00 공통 14, 대화 선택 전 1 |
| `GET` | `/api/v1/chat-rooms/{chatRoomId}` | 대화방 하나의 상대, 모임, 공지, 참여자를 준다 | 필요 | 1:1 대화 1 · 2 · 4, 모임 대화 1 ~ 3, 모임 정보 팝업 1 · 2 · 4 |
| `GET` | `/api/v1/chat-rooms/{chatRoomId}/messages` | 대화방의 메시지를 준다 | 필요 | 1:1 대화 4 ~ 6, 모임 대화 4 · 5 |
| `POST` | `/api/v1/chat-rooms/{chatRoomId}/messages` | 메시지를 보낸다 | 필요 | 1:1 대화 7, 모임 대화 6 |
| `POST` | `/api/v1/chat-rooms/{chatRoomId}/read` | 어디까지 읽었는지 기록한다 | 필요 | 00 공통 14 |
| `POST` | `/api/v1/chat-rooms/{chatRoomId}/leave` | 대화방에서만 나간다. 모임의 참여는 바꾸지 않는다 | 필요 | 1:1 대화 3, 모임 정보 팝업 4, 모임 나가기 확인 팝업 3 |
| `PUT` | `/api/v1/chat-rooms/{chatRoomId}/notice` | 모임 대화방의 공지를 쓰거나 고친다 | 필요 | 모임 대화 3 |
| `DELETE` | `/api/v1/chat-rooms/{chatRoomId}/notice` | 모임 대화방의 공지를 지운다 | 필요 | 모임 대화 3 |
| `GET` | `/api/v1/me/chat-requests` | 받은 요청이나 보낸 요청의 목록을 준다 | 필요 | 받은 요청 3 · 4, 보낸 요청 1 |
| `GET` | `/api/v1/me/chat-requests/count` | 받은 요청 수와 보낸 요청 수를 준다 | 필요 | 받은 요청 1 · 3, 대화 선택 전 3 |
| `POST` | `/api/v1/chat-requests/{chatRequestId}/accept` | 받은 요청을 수락해 1:1 대화방을 만든다 | 필요 | 받은 요청 5 |
| `POST` | `/api/v1/chat-requests/{chatRequestId}/reject` | 받은 요청을 거절한다 | 필요 | 받은 요청 5, 거절 확인 팝업 3 |
| `POST` | `/api/v1/chat-requests/{chatRequestId}/cancel` | 보낸 요청을 취소한다 | 필요 | 보낸 요청 2 |
| `GET` | `/api/v1/me/event-stream` | 새 메시지, 요청 수, 안 읽은 알림 수의 변화를 실시간으로 준다 | 필요 | 00 공통 2 |

대화 요청을 보내는 API는 [탐색 · 방문 API](05-explore-visit.md#post-apiv1chat-requests)에 있다. 모임 상세의 모임 대화 미리보기는 프론트엔드가 [메시지 조회](#get-apiv1chat-roomschatroomidmessages)를 `size=3`으로 불러 그린다([모임 API](07-meetup.md#모임-대화방)).

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 로그인한 뒤의 모든 화면 | 한 번 연결해 둔다 | `GET /api/v1/me/event-stream` | 끊기면 다시 연결하기 |
| 채팅의 모든 화면 | 들어올 때 | `GET /api/v1/me/chat-rooms`, `GET /api/v1/me/chat-requests/count` | 필터 탭(전체 / 1:1 / 모임)으로 거르기, 대화 검색, 시간 표기, 안내 메시지의 문구 |
| 대화 선택 전 | 열 때 | 없음. 위에서 받은 값을 쓴다 | 찻방 그림, 빈 상태 안내. 내 두더지는 [`GET /api/v1/users/{userId}/profile`](00-common.md#get-apiv1usersuseridprofile)을 내 id로 불러 얻는다 |
| 1:1 대화 · 모임 대화 | 대화를 고를 때 | `GET /api/v1/chat-rooms/{chatRoomId}`, `GET /api/v1/chat-rooms/{chatRoomId}/messages`. 이어서 `POST /api/v1/chat-rooms/{chatRoomId}/read` | 찻방의 두더지 자리, 메시지의 좌우 배치, 겹치는 관심사 수 세기, "주최" 표시, 안내 메시지의 문구 |
| 1:1 대화 · 모임 대화 | 위로 스크롤할 때 | `GET /api/v1/chat-rooms/{chatRoomId}/messages`에 `cursor`를 붙인다 | 이어 붙이기 |
| 1:1 대화 · 모임 대화 | 첨부에서 사진을 고를 때 | [`POST /api/v1/images`](08-community.md#post-apiv1images) | 썸네일, 3장까지만 받기 |
| 1:1 대화 · 모임 대화 | "보내기" | `POST /api/v1/chat-rooms/{chatRoomId}/messages` | 빈 메시지 막기, 이모지 고르기 |
| 1:1 대화 · 모임 대화 | 열려 있는 대화에 새 메시지가 왔을 때 | `POST /api/v1/chat-rooms/{chatRoomId}/read` | 맨 아래로 내리기 |
| 1:1 대화 | "대화 나가기" | `POST /api/v1/chat-rooms/{chatRoomId}/leave` | 확인 팝업 |
| 모임 대화 | 공지를 쓰거나 고칠 때 | `PUT /api/v1/chat-rooms/{chatRoomId}/notice` | 주최자에게만 쓰기 · 고치기 · 지우기 보여 주기 |
| 모임 대화 | 공지를 지울 때 | `DELETE /api/v1/chat-rooms/{chatRoomId}/notice` | 공지 줄 숨기기 |
| 모임 정보 팝업 | 열 때 | 없음. 대화방을 고를 때 받은 값을 쓴다 | "주최"와 "나" 표시, `leaveType`으로 나가기 버튼의 모습과 부를 API 정하기 |
| 모임 나가기 확인 팝업 | "예", 끝나지 않은 모임일 때 | [`POST /api/v1/meetups/{meetupId}/cancel-participation`](07-meetup.md#post-apiv1meetupsmeetupidcancel-participation) | 토스트, 대화 선택 전으로 가기 |
| 모임 나가기 확인 팝업 | "예", 끝났거나 취소된 모임일 때 | `POST /api/v1/chat-rooms/{chatRoomId}/leave` | 토스트, 대화 선택 전으로 가기 |
| 받은 요청 | 열 때 | `GET /api/v1/me/chat-requests`에 `direction=RECEIVED`, `GET /api/v1/me/chat-requests/count` | 빈 상태, 첫 요청 골라 두기 |
| 보낸 요청 | 열 때 | `GET /api/v1/me/chat-requests`에 `direction=SENT` | "답변 기다리는 중" 문구 |
| 받은 요청 · 보낸 요청 | 카드를 고를 때 | [`GET /api/v1/users/{userId}/burrow`](05-explore-visit.md#get-apiv1usersuseridburrow) | 프로필 패널, 겹치는 관심사의 체크 |
| 받은 요청 | "수락하고 대화하기" | `POST /api/v1/chat-requests/{chatRequestId}/accept` | 받은 대화방으로 가기 |
| 거절 확인 팝업 | "예" | `POST /api/v1/chat-requests/{chatRequestId}/reject` | 토스트, 다음 요청 골라 두기 |
| 보낸 요청 | "요청 취소" | `POST /api/v1/chat-requests/{chatRequestId}/cancel` | 카드 빼기 |

사용자 표시를 눌렀을 때의 프로필 팝업은 [`GET /api/v1/users/{userId}/profile`](00-common.md#get-apiv1usersuseridprofile)을 부른다. 프로필 팝업의 신고는 [`POST /api/v1/reports`](08-community.md#post-apiv1reports)에 `targetType`을 `MEMBER`로 보낸다.

## 영역 규칙

### 대화방에 들어갈 수 있는 사람

- `chat_room_member`에 내 줄이 있고 `left_at`이 비어 있어야 한다. 모임 대화방은 모임이 삭제되지 않았어야 한다(`meetup.deleted_at`이 비어 있음).
- 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`로 답한다. 없는 대화방과 내가 들어갈 수 없는 대화방을 구분하지 않는다.
- 대화 목록, 대화방 조회, 메시지 조회와 보내기, 읽음, 공지, 나가기, 실시간 소식이 모두 이 검사를 쓴다.
- 모임에서 참여를 취소했거나 내보내진 사람은 그때 `left_at`이 채워진다. 그 뒤로는 들어갈 수 없고 그 방의 실시간 소식도 받지 않는다.
- 나중에 들어온 사람도 들어오기 전의 메시지를 본다.

### 대화 요청의 상태

대화 요청은 `chat_request.status`와 보낸 시각으로 다룬다. 만료는 저장하지 않고 보낸 시각(`chat_request.created_at`)에서 5일이 지났는지로 계산한다([DB 설계](../db/chat.md)).

| 저장된 상태 | 받은 사람에게 | 보낸 사람에게 |
|---|---|---|
| `PENDING`이고 5일이 지나지 않음 | 받은 요청에 보인다. 수락하거나 거절할 수 있다 | 보낸 요청에 보인다. 취소할 수 있다 |
| `REJECTED`이고 5일이 지나지 않음 | 보이지 않는다. 이 사람이 보낸 사람에게 대화 요청을 보내면 이 요청을 수락한 것으로 처리한다 | `PENDING`일 때와 똑같이 보인다. 취소할 수 있다 |
| `ACCEPTED` | 요청 목록에서 빠지고 대화 목록에 대화방이 생긴다 | 받은 사람과 같다 |
| `CANCELED`이거나 5일이 지남 | 보이지 않는다 | 보이지 않는다 |

- 살아 있는 요청은 위 표의 첫 두 줄이다. 살아 있는 요청이 있는 두 사람 사이에는 방향과 관계없이 새 요청을 만들 수 없다.
- 보낸 사람에게는 거절을 알리지 않는다. 그래서 보낸 요청의 목록은 상태 값을 주지 않고, 취소는 거절된 요청에도 똑같이 성공으로 답한다.
- 요청 수는 이 표대로 센다. 받은 요청 수는 첫 줄만, 보낸 요청 수는 첫 두 줄을 센다.

### 내가 거절한 요청이 남아 있는 사람

A가 B에게 요청을 보냈고 B가 거절했다. 그 요청이 만료되기 전에 B가 A에게 대화 요청을 보내는 경우다. A의 요청은 A에게 여전히 "답변 기다리는 중"으로 보이는 살아 있는 요청이라, 두 사람 사이에 요청을 하나 더 만들 수 없다.

- 이때는 새 요청을 만들지 않고, A의 요청을 B가 수락한 것으로 처리한다. 바로 1:1 대화방이 만들어지고 A에게 수락 알림이 간다. A에게는 거절됐던 것이 드러나지 않는다.
- 이 일은 [대화 요청 보내기](05-explore-visit.md#post-apiv1chat-requests)가 한다. 응답의 `chatRoomId`에 만들어진 대화방의 id가 오고, 프론트엔드는 그 대화방으로 간다.
- B가 요청에 붙인 인사는 그 대화방에 B가 보낸 첫 메시지로 들어간다.
- B가 [남의 땅굴 조회](05-explore-visit.md#get-apiv1usersuseridburrow)로 A의 땅굴을 볼 때 `chat.status`는 `NONE`이다. 버튼은 "대화 요청하기"이고 누르면 대화 요청 팝업이 열린다([대화 버튼의 상태](05-explore-visit.md#대화-버튼의-상태)).
- [대화 요청 수락](#post-apiv1chat-requestschatrequestidaccept)으로는 거절한 요청을 되살릴 수 없다. 거절한 요청은 받은 요청 목록에 없다.
- 상대가 보낸 요청에 내가 아직 답하지 않았을 때는 `REQUEST_RECEIVED`이고, 요청을 보내면 `409`와 `CHAT_REQUEST_ALREADY_RECEIVED`다.

### 메시지

메시지 목록, 대화 목록의 마지막 메시지, 메시지를 보낸 뒤의 응답, 실시간 소식이 모두 이 모양을 쓴다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 메시지의 id. 같은 방 안에서 클수록 나중 메시지다 | `chat_message.id` |
| `type` | enum | `TEXT`, `ACCEPTED`, `JOINED`, `LEFT`, `WITHDRAWN` 가운데 하나 | `chat_message.type` |
| `sender` | 객체 | 보낸 사람, 또는 안내를 일으킨 사람의 [사용자 표시](00-common.md#사용자-표시) | |
| `content` | 문자열 | 본문. 안내 메시지와, 글 없이 사진만 보낸 메시지는 `null` | `chat_message.content` |
| `meetupCard` | 객체 | 본문에 모임 링크가 있을 때의 모임 카드. 없으면 `null` | |
| `meetupCard.meetupId` | 숫자 | 모임의 id. "모임 보기"가 이 모임의 상세로 간다 | `meetup.id` |
| `meetupCard.title` | 문자열 | 모임 이름 | `meetup.title` |
| `meetupCard.startsAt` | 시각 | 모임 시작 시각 | `meetup.starts_at` |
| `meetupCard.capacity` | 숫자 | 정원. 주최자 포함 | `meetup.capacity` |
| `meetupCard.confirmedCount` | 숫자 | 확정 인원. 주최자 포함 | 계산: 주최자 1명에 `meetup_application.status`가 `CONFIRMED`인 줄 수를 더한 값 |
| `images` | 목록 | 메시지에 붙인 사진. 보낸 순서대로이고 없으면 `[]` | |
| `images[].id` | 숫자 | 사진의 id | `chat_message_image.image_id` |
| `images[].url` | 문자열 | 사진의 주소 | `uploaded_image.image_url` |
| `createdAt` | 시각 | 보낸 시각, 또는 안내할 일이 일어난 시각 | `chat_message.created_at` |

`type`의 값:

| `type` | 뜻 | `sender` |
|---|---|---|
| `TEXT` | 사람이 보낸 메시지. 글만, 사진만, 또는 둘 다다 | 보낸 사람 |
| `ACCEPTED` | 대화 요청을 수락해 1:1 대화방이 열림 | 수락한 사람 |
| `JOINED` | 모임 대화방에 들어옴 | 들어온 사람 |
| `LEFT` | 대화방에서 나감. 1:1의 대화 나가기, 모임의 참여 취소 · 내보내기 · 대화방에서만 나가기가 모두 이 값이다 | 나간 사람 |
| `WITHDRAWN` | 서비스에서 탈퇴함 | 탈퇴한 사람 |

- `TEXT`가 아닌 것은 안내 메시지다. 일이 일어날 때 서버가 메시지로 넣는다. "새벽산책님이 대화 요청을 수락했어요" 같은 문구는 프론트엔드가 `type`과 `sender`의 닉네임으로 만든다.
- 사진은 메시지 하나에 3장까지 붙는다. 먼저 [`POST /api/v1/images`](08-community.md#post-apiv1images)로 올려 id를 받고, 메시지를 보낼 때 그 id를 담는다. 받는 형식과 크기는 [커뮤니티 API](08-community.md#사진)와 같다.
- 글 없이 사진만 보낸 메시지는 `content`가 `null`이다. 대화 목록의 마지막 메시지에서는 프론트엔드가 "사진" 같은 글로 보여 준다.
- 메시지는 고치거나 지울 수 없다. 읽음 표시도 없다.
- 내 메시지인지는 주지 않는다. 프론트엔드가 `sender.id`를 내 계정 id와 비교해 오른쪽이나 왼쪽에 둔다.
- 모임 대화의 "주최" 표시는 `sender.id`가 [대화방 조회](#get-apiv1chat-roomschatroomid)의 `meetup.hostId`와 같은지로 정한다.
- 보낸 사람이 탈퇴했으면 `sender.isWithdrawn`이 `true`다. 메시지는 그대로 남는다.
- `meetupCard`는 저장하지 않는다. 메시지를 줄 때 본문에서 모임 링크를 찾아 그 모임의 지금 값을 담는다. 링크가 여러 개면 첫 번째 것만 쓴다. 삭제된 모임이나 없는 모임이면 `null`이고 본문은 글자 그대로 보인다.

```json
{
  "id": 4102,
  "type": "TEXT",
  "sender": {
    "id": 52,
    "nickname": "새벽산책",
    "profileImageUrl": null,
    "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
    "campusName": "서울",
    "generation": 14,
    "floor": 2,
    "isWithdrawn": false
  },
  "content": "이번 주 토요일 아침에 한강 어때요?",
  "meetupCard": null,
  "images": [],
  "createdAt": "2026-11-20T07:02:41Z"
}
```

글 없이 사진 한 장만 보낸 메시지:

```json
{
  "id": 4110,
  "type": "TEXT",
  "sender": {
    "id": 52,
    "nickname": "새벽산책",
    "profileImageUrl": null,
    "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
    "campusName": "서울",
    "generation": 14,
    "floor": 2,
    "isWithdrawn": false
  },
  "content": null,
  "meetupCard": null,
  "images": [
    { "id": 530, "url": "https://cdn.digguldiggul.example/images/2026/11/c41d07.webp" }
  ],
  "createdAt": "2026-11-20T07:05:12Z"
}
```

### 읽기 전용 대화방

1:1 대화방에서 상대가 나갔거나 탈퇴하면 그 방은 내 목록에 남고 읽기 전용이 된다(1:1 대화 3).

- 대화 목록과 대화방 조회의 `isReadOnly`가 `true`다. 메시지를 보내면 `409`와 `CHAT_ROOM_READ_ONLY`로 답한다.
- 대화의 맨 끝에는 상대가 일으킨 `LEFT`나 `WITHDRAWN` 안내 메시지가 있다. 프론트엔드가 이 메시지로 "상대방이 대화방을 나갔습니다"나 "상대방이 탈퇴했습니다"를 보여 준다.
- 다시 이야기하려면 대화 요청부터 한다. 수락되면 새 대화방이 생기고, 읽기 전용이 된 예전 대화방은 내가 나갈 때까지 따로 남는다.
- 모임 대화방은 읽기 전용이 되지 않는다. 끝난 모임과 취소된 모임의 대화방에서도 메시지를 보낼 수 있다.

### 안 읽은 수

- 대화방마다 내가 마지막으로 읽은 메시지(`chat_room_member.last_read_message_id`)보다 id가 큰 메시지 가운데, `type`이 `TEXT`이고 남이 보낸 것의 수다. 안내 메시지와 내가 보낸 메시지는 세지 않는다.
- 읽은 자리는 [읽음 API](#post-apiv1chat-roomschatroomidread)가 옮긴다. 메시지를 조회하는 것만으로는 옮겨지지 않는다.
- 메시지를 보내면 보낸 사람의 읽은 자리도 그 메시지로 옮겨진다.
- 상대가 읽었는지는 주지 않는다.

### 대화방에서 나가기

[`POST /api/v1/chat-rooms/{chatRoomId}/leave`](#post-apiv1chat-roomschatroomidleave)는 대화방에서만 나간다. 모임의 참여는 바꾸지 않는다. 끝나지 않은 모임에서 나가는 일은 모임의 [참여 취소](07-meetup.md#post-apiv1meetupsmeetupidcancel-participation)가 하고, 참여가 취소되면 서버가 그 사람을 대화방에서도 뺀다.

나가기 버튼이 지금 하는 일은 대화방 조회의 `leaveType`으로 미리 알려 준다. 프론트엔드는 이 값으로 버튼의 모습과 부를 API를 정한다.

| 대화방 | 때 | `leaveType` | 버튼 | 부르는 API | 일어나는 일 |
|---|---|---|---|---|---|
| 1:1 | 언제나 | `LEAVE_ROOM` | 보인다 | 나가기 | 내 목록에서 사라진다. 상대의 목록에는 읽기 전용으로 남는다 |
| 모임 | 모임이 취소됐거나 끝남 | `LEAVE_ROOM` | 보인다 | 나가기 | 대화방에서만 나간다. 주최자도 나갈 수 있다. 참여 기록은 그대로다 |
| 모임 | 취소되지도 끝나지도 않았고, 내가 주최자 | `NOT_ALLOWED` | 보여 주지 않는다 | 없음 | 나갈 수 없다 |
| 모임 | 취소되지도 끝나지도 않았고, 시작 24시간 전이 지나지 않음 | `CANCEL_PARTICIPATION` | 보인다 | 모임의 참여 취소 | 참여가 취소되고 대화방에서도 빠진다. 같은 모임에 다시 신청할 수 없다 |
| 모임 | 취소되지도 끝나지도 않았고, 시작 24시간 전이 지남 | `NOT_ALLOWED` | 꺼 둔다 | 없음 | 나갈 수 없다 |

- 모임이 끝났는지는 지금 시각이 `meetup.ends_at`을 지났는지로 본다. `ends_at`이 비어 있으면 `meetup.starts_at`으로 본다([DB 설계](../db/chat.md)).
- 취소되지도 끝나지도 않은 모임의 대화방에서 나가기를 부르면 `409`와 `CHAT_ROOM_LEAVE_NOT_ALLOWED`로 답한다.
- 참여 취소와 내보내기 때 `chat_room_member.left_at`을 채우고 `LEFT` 안내 메시지를 넣는 일은 모임 API가 한다([모임 API](07-meetup.md#모임-대화방)).
- 화면을 열어 둔 사이에 모임이 취소되거나 끝나면 `leaveType`이 `LEAVE_ROOM`으로 바뀐다. 그때 모임의 참여 취소를 부르면 에러가 온다. 프론트엔드는 대화방을 다시 조회해 버튼을 맞춘다.
- 한 번 나간 대화방에는 다시 들어갈 수 없다.

### 실시간 소식

화면을 새로 열지 않아도 바로 바뀌는 것은 넷이다(00 공통 2). 열려 있는 대화의 메시지, 대화 목록의 안 읽은 수, 알림 아이콘의 빨간 점, 채팅의 "요청 N"이다.

- 받는 길은 [`GET /api/v1/me/event-stream`](#get-apiv1meevent-stream) 하나다. 로그인한 뒤 한 번 연결해 두면 서버가 그 계정에 알릴 일이 생길 때마다 소식을 보낸다. 대화방마다 따로 연결하지 않는다.
- 보내는 길은 일반 API다. 메시지를 보낼 때는 [`POST /api/v1/chat-rooms/{chatRoomId}/messages`](#post-apiv1chat-roomschatroomidmessages)를 부른다.
- 채팅의 소식은 `CHAT_MESSAGE_CREATED`와 `CHAT_REQUEST_COUNT_CHANGED` 둘이다. 알림 아이콘의 빨간 점에 쓰는 소식 `NOTIFICATION_UNREAD_CHANGED`는 [알림 API](09-notification.md#실시간-소식)에 있고 같은 연결로 온다.
- 그 밖의 것(공지, 보낸 요청의 목록, 모임 정보)은 화면을 열거나 새로 고칠 때 바뀐다.

## GET /api/v1/me/chat-rooms

내가 들어가 있는 대화방을 모두 준다. 채팅에 들어올 때 부른다. 왼쪽 대화 목록이 이 값을 쓴다.

- 로그인: 필요
- 명세: 00 공통 14, 대화 선택 전 1

### 요청

없다.

```text
GET /api/v1/me/chat-rooms
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 대화방 | |
| `items[].id` | 숫자 | 대화방의 id | `chat_room.id` |
| `items[].type` | enum | `DIRECT`(1:1), `MEETUP`(모임) 가운데 하나 | `chat_room.type` |
| `items[].counterpart` | 객체 | 1:1 대화 상대의 [사용자 표시](00-common.md#사용자-표시). 모임 대화방이면 `null` | |
| `items[].meetup` | 객체 | 모임 대화방의 모임. 1:1 대화방이면 `null` | |
| `items[].meetup.id` | 숫자 | 모임의 id | `meetup.id` |
| `items[].meetup.title` | 문자열 | 모임 이름. 대화 목록에 대화방의 이름으로 보여 준다 | `meetup.title` |
| `items[].lastMessage` | 객체 | 마지막 [메시지](#메시지). 메시지가 하나도 없으면 `null` | |
| `items[].unreadCount` | 숫자 | [안 읽은 수](#안-읽은-수) | 계산: 안 읽은 수의 규칙 |
| `items[].isReadOnly` | 참/거짓 | [읽기 전용 대화방](#읽기-전용-대화방)인지. 모임 대화방은 항상 `false` | 계산: 1:1 대화방에서 상대의 `chat_room_member.left_at`이 채워졌거나 상대의 `user.status`가 `WITHDRAWN`인지 |

### 주는 방식

- [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)을 모두 준다. 내가 나간 대화방과 삭제된 모임의 대화방은 주지 않는다.
- 수락되지 않은 대화 요청은 대화방이 아니므로 여기에 없다.
- 마지막 메시지가 새로운 것부터 준다. 메시지가 없는 대화방은 만든 시각(`chat_room.created_at`)으로 줄을 세운다.
- 한 번에 모두 준다. 나누지 않는다.
- 필터 탭(전체 / 1:1 / 모임)과 대화 검색은 프론트엔드가 받은 목록에서 거른다. 검색은 1:1 대화의 상대 닉네임과 모임 대화의 모임 이름에서 찾는다. 메시지 내용은 찾지 않는다.
- 마지막 메시지가 안내 메시지면 `lastMessage.content`는 `null`이다. 프론트엔드가 `type`으로 문구를 만든다.
- 1:1 대화의 상대가 탈퇴했으면 `counterpart.isWithdrawn`이 `true`다.
- 새 메시지가 오면 프론트엔드가 [실시간 소식](#실시간-소식)으로 그 대화방의 마지막 메시지와 안 읽은 수를 바꾸고 맨 위로 올린다. 목록에 없는 대화방의 소식이 오면 이 API를 다시 부른다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 21,
        "type": "MEETUP",
        "counterpart": null,
        "meetup": { "id": 12, "title": "알고리즘 스터디" },
        "lastMessage": {
          "id": 4130,
          "type": "TEXT",
          "sender": {
            "id": 77,
            "nickname": "밤코딩",
            "profileImageUrl": null,
            "mole": { "head": "CAP_RED", "face": null, "neck": null, "hand": null },
            "campusName": "서울",
            "generation": 13,
            "floor": 4,
            "isWithdrawn": false
          },
          "content": "이번 주는 그래프 문제 세 개 풀어 와요.",
          "meetupCard": null,
          "images": [],
          "createdAt": "2026-11-20T07:40:12Z"
        },
        "unreadCount": 3,
        "isReadOnly": false
      },
      {
        "id": 15,
        "type": "DIRECT",
        "counterpart": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "meetup": null,
        "lastMessage": {
          "id": 4102,
          "type": "TEXT",
          "sender": {
            "id": 52,
            "nickname": "새벽산책",
            "profileImageUrl": null,
            "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
            "campusName": "서울",
            "generation": 14,
            "floor": 2,
            "isWithdrawn": false
          },
          "content": "이번 주 토요일 아침에 한강 어때요?",
          "meetupCard": null,
          "images": [],
          "createdAt": "2026-11-20T07:02:41Z"
        },
        "unreadCount": 1,
        "isReadOnly": false
      }
    ]
  },
  "error": null
}
```

대화가 하나도 없을 때:

```json
{
  "success": true,
  "data": { "items": [] },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/chat-rooms/{chatRoomId}

대화방 하나를 열 때 필요한 값을 한 번에 준다. 대화 목록에서 대화를 고를 때 부른다. 찻방, 대화 창의 헤더, 공지, 모임 정보 팝업이 모두 이 응답의 값을 쓴다.

- 로그인: 필요
- 명세: 1:1 대화 1 · 2 · 4, 모임 대화 1 ~ 3, 모임 정보 팝업 1 · 2 · 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 대화방의 id |

```text
GET /api/v1/chat-rooms/21
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 대화방의 id | `chat_room.id` |
| `type` | enum | `DIRECT`(1:1), `MEETUP`(모임) 가운데 하나 | `chat_room.type` |
| `isReadOnly` | 참/거짓 | [읽기 전용 대화방](#읽기-전용-대화방)인지 | 계산: 대화 목록과 같다 |
| `leaveType` | enum | 나가기 버튼이 지금 하는 일. `LEAVE_ROOM`(나가기를 부른다), `CANCEL_PARTICIPATION`(모임의 참여 취소를 부른다), `NOT_ALLOWED`(나갈 수 없다) 가운데 하나 | 계산: [대화방에서 나가기](#대화방에서-나가기) |
| `counterpart` | 객체 | 1:1 대화 상대의 [사용자 표시](00-common.md#사용자-표시). 모임 대화방이면 `null` | |
| `sharedInterests` | 목록 | 상대와 내가 함께 고른 [관심사 태그](00-common.md#관심사-태그). 모임 대화방이면 `[]` | |
| `meetup` | 객체 | 모임 대화방의 모임. 1:1 대화방이면 `null` | |
| `meetup.id` | 숫자 | 모임의 id. "모임 상세 보기"가 이 모임의 상세로 간다 | `meetup.id` |
| `meetup.hostId` | 숫자 | 주최자의 계정 id | `meetup.host_id` |
| `meetup.title` | 문자열 | 모임 이름 | `meetup.title` |
| `meetup.category` | enum | 모임의 [카테고리](07-meetup.md#카테고리) 가운데 하나 | `meetup.category` |
| `meetup.startsAt` | 시각 | 시작 시각 | `meetup.starts_at` |
| `meetup.endsAt` | 시각 | 끝나는 시각. 정하지 않은 모임은 `null` | `meetup.ends_at` |
| `meetup.mode` | enum | `OFFLINE`, `ONLINE` 가운데 하나 | `meetup.mode` |
| `meetup.place` | 문자열 | 오프라인 모임의 장소. 온라인 모임은 `null` | `meetup.place` |
| `meetup.placeDetail` | 문자열 | 상세 주소. 없으면 `null` | `meetup.place_detail` |
| `meetup.joinUrl` | 문자열 | 온라인 모임의 접속 링크. 없으면 `null` | `meetup.join_url` |
| `meetup.capacity` | 숫자 | 정원. 주최자 포함 | `meetup.capacity` |
| `meetup.confirmedCount` | 숫자 | 확정 인원. 주최자 포함 | 계산: 주최자 1명에 `meetup_application.status`가 `CONFIRMED`인 줄 수를 더한 값 |
| `meetup.isCanceled` | 참/거짓 | 취소된 모임인지 | 계산: `meetup.canceled_at`이 채워졌는지 |
| `notice` | 문자열 | 모임 대화방의 공지. 없으면 `null`. 1:1 대화방은 항상 `null` | `chat_room.notice` |
| `canEditNotice` | 참/거짓 | 내가 공지를 쓰고 고치고 지울 수 있는지 | 계산: 모임 대화방이고 `meetup.host_id`가 요청한 사람인지 |
| `members` | 목록 | 지금 대화방에 있는 사람. 1:1 대화방이면 `[]` | |
| `members[].user` | 객체 | 그 사람의 [사용자 표시](00-common.md#사용자-표시) | |
| `members[].isHost` | 참/거짓 | 주최자인지 | 계산: `meetup.host_id`와 같은지 |
| `members[].isMe` | 참/거짓 | 나인지 | 계산: 요청한 사람과 같은지 |

### 주는 방식

- [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)만 준다.
- 1:1 대화방은 `counterpart`와 `sharedInterests`를, 모임 대화방은 `meetup`, `notice`, `members`를 채운다.
- 1:1 대화 창 헤더의 "겹치는 관심사 수"는 `sharedInterests`의 개수다. 대화 시작 안내의 관심사 태그도 이 값이다. 고른 순서는 상대가 고른 순서다.
- 상대가 탈퇴했으면 `counterpart.isWithdrawn`이 `true`이고 `sharedInterests`는 `[]`다.
- `members`는 `chat_room_member.left_at`이 비어 있는 사람이다. 주최자를 맨 앞에, 그다음은 들어온 순서(`chat_room_member.joined_at`)로 준다. 찻방에 둘러앉는 두더지와 모임 정보 팝업의 참여자 목록이 이 값을 쓴다.
- 모임 대화 헤더의 "참여 인원"은 `members`의 수다. 모임 정보 팝업의 "확정 인원"은 `meetup.confirmedCount`와 `meetup.capacity`다. 모임이 끝난 뒤 대화방에서만 나간 사람이 있으면 두 수가 다르다.
- `meetup.joinUrl`은 대화방에 있는 사람에게만 가는 값이라 그대로 준다.
- 메시지는 담지 않는다. [메시지 목록](#get-apiv1chat-roomschatroomidmessages)을 함께 부른다.
- 안 읽은 수는 담지 않는다. 대화방을 열면 프론트엔드가 [읽음 API](#post-apiv1chat-roomschatroomidread)를 부른다.

### 응답 예시

1:1 대화방:

```json
{
  "success": true,
  "data": {
    "id": 15,
    "type": "DIRECT",
    "isReadOnly": false,
    "leaveType": "LEAVE_ROOM",
    "counterpart": {
      "id": 52,
      "nickname": "새벽산책",
      "profileImageUrl": null,
      "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "sharedInterests": [
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true }
    ],
    "meetup": null,
    "notice": null,
    "canEditNotice": false,
    "members": []
  },
  "error": null
}
```

모임 대화방. 나는 참여자이고 모임 시작까지 24시간 넘게 남았다:

```json
{
  "success": true,
  "data": {
    "id": 21,
    "type": "MEETUP",
    "isReadOnly": false,
    "leaveType": "CANCEL_PARTICIPATION",
    "counterpart": null,
    "sharedInterests": [],
    "meetup": {
      "id": 12,
      "hostId": 77,
      "title": "알고리즘 스터디",
      "category": "STUDY",
      "startsAt": "2026-11-28T05:00:00Z",
      "endsAt": "2026-11-28T07:00:00Z",
      "mode": "OFFLINE",
      "place": "서울 캠퍼스 4층 라운지",
      "placeDetail": null,
      "joinUrl": null,
      "capacity": 6,
      "confirmedCount": 3,
      "isCanceled": false
    },
    "notice": "매주 토요일 오후 2시에 모여요. 노트북을 가져오세요.",
    "canEditNotice": false,
    "members": [
      {
        "user": {
          "id": 77,
          "nickname": "밤코딩",
          "profileImageUrl": null,
          "mole": { "head": "CAP_RED", "face": null, "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 13,
          "floor": 4,
          "isWithdrawn": false
        },
        "isHost": true,
        "isMe": false
      },
      {
        "user": {
          "id": 31,
          "nickname": "두더지왕",
          "profileImageUrl": null,
          "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "isHost": false,
        "isMe": true
      },
      {
        "user": {
          "id": 64,
          "nickname": "모카",
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": "SCARF_GREEN", "hand": null },
          "campusName": "서울",
          "generation": 13,
          "floor": 4,
          "isWithdrawn": false
        },
        "isHost": false,
        "isMe": false
      }
    ]
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나, 내가 들어가 있지 않거나 나간 대화방이거나, 삭제된 모임의 대화방 |

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_ROOM_NOT_FOUND",
    "message": "대화방을 찾을 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

## GET /api/v1/chat-rooms/{chatRoomId}/messages

대화방의 메시지를 새 것부터 나눠 준다. 대화를 고를 때 부르고, 위로 스크롤하면 이어서 부른다.

- 로그인: 필요
- 명세: 1:1 대화 4 ~ 6, 모임 대화 4 · 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 대화방의 id |
| 쿼리 | `size` | 숫자 | | 한 번에 받을 개수. 1 ~ 100. 보내지 않으면 30 |
| 쿼리 | `cursor` | 문자열 | | 앞 응답의 `nextCursor`. 처음에는 보내지 않는다 |

```text
GET /api/v1/chat-rooms/15/messages?size=30
GET /api/v1/chat-rooms/15/messages?size=30&cursor=eyJpZCI6NDA3MX0
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [메시지](#메시지) | |
| `nextCursor` | 문자열 | 더 오래된 메시지를 받을 때 보낼 값. 더 없으면 `null` | 계산: 이번에 준 가장 오래된 메시지의 자리 |
| `hasNext` | 참/거짓 | 더 오래된 메시지가 있는지 | 계산: 더 오래된 줄이 있는지 |

### 주는 방식

- [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)의 메시지만 준다.
- 커서 방식이다. 처음에는 가장 새 메시지부터 `size`개를 준다. `cursor`를 보내면 그보다 오래된 메시지를 준다.
- `items` 안에서도 새 것부터다(`chat_message.id`가 큰 것부터). 프론트엔드가 뒤집어 아래가 최신이 되게 그린다.
- 사람이 보낸 메시지와 안내 메시지를 함께 준다. 대화 시작 안내("수락했어요")와 참여 알림("참여했어요")이 안내 메시지다.
- 내가 대화방에 들어오기 전의 메시지도 준다.
- 조회만으로는 읽은 자리가 바뀌지 않는다.
- 대화방이 열려 있는 동안의 새 메시지는 [실시간 소식](#실시간-소식)으로 받는다. 이 API를 되풀이해 부르지 않는다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 4102,
        "type": "TEXT",
        "sender": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "content": "이번 주 토요일 아침에 한강 어때요?",
        "meetupCard": null,
        "images": [],
        "createdAt": "2026-11-20T07:02:41Z"
      },
      {
        "id": 4098,
        "type": "TEXT",
        "sender": {
          "id": 31,
          "nickname": "두더지왕",
          "profileImageUrl": null,
          "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "content": "같이 뛸 사람 모으는 중이에요. https://it-ting.example/meetups/19",
        "meetupCard": {
          "meetupId": 19,
          "title": "토요일 한강 러닝",
          "startsAt": "2026-11-27T22:00:00Z",
          "capacity": 6,
          "confirmedCount": 3
        },
        "images": [],
        "createdAt": "2026-11-20T06:58:03Z"
      },
      {
        "id": 4090,
        "type": "ACCEPTED",
        "sender": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "content": null,
        "meetupCard": null,
        "images": [],
        "createdAt": "2026-11-20T06:51:30Z"
      }
    ],
    "nextCursor": null,
    "hasNext": false
  },
  "error": null
}
```

맨 아래 메시지가 대화 시작 안내다. 프론트엔드가 "새벽산책님이 대화 요청을 수락했어요"로 보여 준다. 가운데 메시지는 모임 링크가 들어 있어 모임 카드로 보인다.

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방 |

## POST /api/v1/chat-rooms/{chatRoomId}/messages

대화방에 메시지를 보낸다. 메시지 입력창의 "보내기"가 부른다.

- 로그인: 필요
- 명세: 1:1 대화 7, 모임 대화 6

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 대화방의 id |
| 본문 | `content` | 문자열 | | 본문. 1,000자 이하. 이모지는 글자로 넣는다. 사진이 없으면 꼭 보내고 공백만으로는 안 된다. 사진만 보낼 때는 `null` |
| 본문 | `imageIds` | 목록 | | 붙일 사진의 id. 0 ~ 3개. 보낸 순서로 보여 준다. 사진이 없으면 `[]`이거나 보내지 않는다 |

```text
POST /api/v1/chat-rooms/15/messages
```

```json
{ "content": "좋아요. 7시에 여의나루역에서 봐요!", "imageIds": [] }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 본문의 길이, 사진의 수, 본문과 사진이 모두 비었는지, [쓸 수 없는 사진](08-community.md#사진)의 id인지다. 어긋나면 `400`과 `INVALID_INPUT`.
2. [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)인지 본다. 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`.
3. [읽기 전용 대화방](#읽기-전용-대화방)이면 `409`와 `CHAT_ROOM_READ_ONLY`.
4. `chat_message`에 한 줄을 만든다. `chat_room_id`는 그 대화방, `type`은 `TEXT`, `sender_id`는 요청한 사람, `content`는 본문이다. 사진이 있으면 `chat_message_image`에 사진마다 한 줄을 만든다. `sort_order`는 `imageIds`의 순서대로 1부터다.
5. 보낸 사람의 `chat_room_member.last_read_message_id`를 이 메시지로 옮긴다.
6. 대화방에 있는 모든 사람에게 실시간 소식 `CHAT_MESSAGE_CREATED`를 보낸다([실시간 소식](#get-apiv1meevent-stream)).
7. 대화방의 다른 사람에게 새 메시지 알림(`CHAT_MESSAGE_RECEIVED`)을 만든다. 대화방마다 한 줄로 묶는다([알림 API](09-notification.md#새-메시지-알림)).

### 응답 `data`

`201`로 답하고, 만든 [메시지](#메시지)를 준다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 메시지의 id | `chat_message.id` |
| `type` | enum | 항상 `TEXT` | `chat_message.type` |
| `sender` | 객체 | 보낸 사람인 나의 [사용자 표시](00-common.md#사용자-표시) | |
| `content` | 문자열 | 본문 | `chat_message.content` |
| `meetupCard` | 객체 | 본문에 모임 링크가 있을 때의 모임 카드. 없으면 `null` | |
| `createdAt` | 시각 | 보낸 시각 | `chat_message.created_at` |

프론트엔드는 이 메시지를 대화의 맨 아래에 붙인다. 같은 메시지가 실시간 소식으로도 오므로 `id`가 같은 것은 한 번만 그린다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "id": 4103,
    "type": "TEXT",
    "sender": {
      "id": 31,
      "nickname": "두더지왕",
      "profileImageUrl": null,
      "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "content": "좋아요. 7시에 여의나루역에서 봐요!",
    "meetupCard": null,
    "images": [],
    "createdAt": "2026-11-20T07:05:12Z"
  },
  "error": null
}
```

상대가 나간 대화방에 보냈을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_ROOM_READ_ONLY",
    "message": "상대가 나가 메시지를 보낼 수 없는 대화방입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방 |
| `409` | `CHAT_ROOM_READ_ONLY` | 상대가 나갔거나 탈퇴한 1:1 대화방 |

## POST /api/v1/chat-rooms/{chatRoomId}/read

이 대화방을 어디까지 읽었는지 기록한다. 대화방을 열어 메시지를 받은 뒤와, 열려 있는 대화에 새 메시지가 왔을 때 부른다.

- 로그인: 필요
- 명세: 00 공통 14

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 대화방의 id |
| 본문 | `messageId` | 숫자 | ✓ | 화면에 보인 마지막 메시지의 id |

```text
POST /api/v1/chat-rooms/15/read
```

```json
{ "messageId": 4102 }
```

### 서버가 하는 일

1. [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)인지 본다. 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`.
2. `messageId`가 이 대화방의 메시지인지 본다. 아니면 `400`과 `INVALID_INPUT`.
3. 내 `chat_room_member.last_read_message_id`가 비어 있거나 `messageId`보다 작으면 `messageId`로 바꾼다. 이미 더 뒤까지 읽었으면 바꾸지 않는다.
4. 이 대화방의 안 읽은 새 메시지 알림이 있으면 읽음으로 바꾼다([알림 API](09-notification.md#새-메시지-알림)).

상대에게는 아무것도 알리지 않는다. 읽음 표시가 없기 때문이다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `unreadCount` | 숫자 | 기록한 뒤 이 대화방의 [안 읽은 수](#안-읽은-수) | 계산: 안 읽은 수의 규칙 |

프론트엔드는 대화 목록에서 이 대화방의 안 읽은 수를 이 값으로 바꾼다.

### 응답 예시

```json
{
  "success": true,
  "data": { "unreadCount": 0 },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방 |

## POST /api/v1/chat-rooms/{chatRoomId}/leave

대화방에서만 나간다. 1:1 대화의 "대화 나가기"와, 끝났거나 취소된 모임에서 모임 나가기 확인 팝업의 "예"가 부른다. 모임의 참여는 바꾸지 않는다. 끝나지 않은 모임에서 나가는 일은 모임의 참여 취소가 한다([대화방에서 나가기](#대화방에서-나가기)).

- 로그인: 필요
- 명세: 1:1 대화 3, 모임 정보 팝업 4, 모임 나가기 확인 팝업 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 대화방의 id |

```text
POST /api/v1/chat-rooms/21/leave
```

### 서버가 하는 일

1. [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)인지 본다. 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`.
2. 모임 대화방이면 모임이 취소됐거나 끝났는지 본다([대화방에서 나가기](#대화방에서-나가기)). 아니면 `409`와 `CHAT_ROOM_LEAVE_NOT_ALLOWED`.
3. 1:1 대화방이면 두 사람의 `user` 줄을 id가 작은 것부터 잠근 뒤 진행한다([DB 설계](../db/chat.md)).
4. 내 `chat_room_member.left_at`을 지금 시각으로 채운다. `meetup_application`은 바꾸지 않는다.
5. `chat_message`에 `type`이 `LEFT`이고 `sender_id`가 나인 안내 메시지를 넣는다. 남은 사람들에게 실시간 소식 `CHAT_MESSAGE_CREATED`로 간다.

1:1 대화방에서 나가면 상대의 대화방은 [읽기 전용](#읽기-전용-대화방)이 된다. 그 뒤로는 두 사람 모두 상대에게 대화 요청을 보낼 수 있다.

### 응답 `data`

`null`이다.

프론트엔드는 대화 목록에서 이 대화방을 빼고 대화 선택 전 화면으로 간다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

끝나지 않은 모임의 대화방에서 불렀을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_ROOM_LEAVE_NOT_ALLOWED",
    "message": "끝나지 않은 모임의 대화방에서는 나갈 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방. 이미 나간 대화방도 여기에 든다 |
| `409` | `CHAT_ROOM_LEAVE_NOT_ALLOWED` | 취소되지도 끝나지도 않은 모임의 대화방. 참여자는 시작 24시간 전까지 모임의 참여 취소로 나간다 |

## PUT /api/v1/chat-rooms/{chatRoomId}/notice

모임 대화방의 공지를 쓰거나 고친다. 공지는 대화방에 하나뿐이라, 있으면 바꾸고 없으면 새로 건다. 주최자만 부를 수 있다.

- 로그인: 필요
- 명세: 모임 대화 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 모임 대화방의 id |
| 본문 | `content` | 문자열 | ✓ | 공지의 본문. 1 ~ 200자. 공백만으로는 쓸 수 없다 |

```text
PUT /api/v1/chat-rooms/21/notice
```

```json
{ "content": "매주 토요일 오후 2시에 모여요. 노트북을 가져오세요." }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 본문의 길이다. 어긋나면 `400`과 `INVALID_INPUT`.
2. [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)인지 본다. 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`.
3. 모임 대화방이고 내가 주최자인지 본다(`meetup.host_id`). 아니면 `403`과 `FORBIDDEN`.
4. `chat_room.notice`를 본문으로 바꾼다.

다른 참여자에게는 실시간으로 알리지 않는다. 대화방을 다시 열 때 새 공지가 보인다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `notice` | 문자열 | 저장한 공지 | `chat_room.notice` |

### 응답 예시

```json
{
  "success": true,
  "data": { "notice": "매주 토요일 오후 2시에 모여요. 노트북을 가져오세요." },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방 |

주최자가 아닌 사람이 부르거나 1:1 대화방에 부르면 공통 에러 코드 `FORBIDDEN`으로 답한다.

## DELETE /api/v1/chat-rooms/{chatRoomId}/notice

모임 대화방의 공지를 지운다. 주최자만 부를 수 있다.

- 로그인: 필요
- 명세: 모임 대화 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRoomId` | 숫자 | ✓ | 모임 대화방의 id |

```text
DELETE /api/v1/chat-rooms/21/notice
```

### 서버가 하는 일

1. [들어갈 수 있는 대화방](#대화방에-들어갈-수-있는-사람)인지 본다. 아니면 `404`와 `CHAT_ROOM_NOT_FOUND`.
2. 모임 대화방이고 내가 주최자인지 본다. 아니면 `403`과 `FORBIDDEN`.
3. `chat_room.notice`를 비운다. 공지가 없었어도 성공으로 답한다.

### 응답 `data`

`null`이다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_ROOM_NOT_FOUND` | 없는 대화방이거나 내가 들어갈 수 없는 대화방 |

## GET /api/v1/me/chat-requests

내가 받은 대화 요청이나 내가 보낸 대화 요청의 목록을 준다. 요청 탭의 "받은 요청"과 "보낸 요청"을 열 때 부른다.

- 로그인: 필요
- 명세: 받은 요청 3 · 4, 보낸 요청 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `direction` | enum | ✓ | `RECEIVED`(받은 요청), `SENT`(보낸 요청) 가운데 하나 |

```text
GET /api/v1/me/chat-requests?direction=RECEIVED
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 대화 요청 | |
| `items[].id` | 숫자 | 대화 요청의 id. 수락, 거절, 취소를 부를 때 쓴다 | `chat_request.id` |
| `items[].counterpart` | 객체 | 상대의 [사용자 표시](00-common.md#사용자-표시). 받은 요청이면 보낸 사람, 보낸 요청이면 받는 사람이다 | |
| `items[].message` | 문자열 | 요청에 붙인 인사. 없으면 `null` | `chat_request.message` |
| `items[].sharedInterests` | 목록 | 상대와 내가 함께 고른 [관심사 태그](00-common.md#관심사-태그). 없으면 `[]` | |
| `items[].createdAt` | 시각 | 보낸 시각 | `chat_request.created_at` |
| `items[].expiresAt` | 시각 | 만료되는 시각 | 계산: `chat_request.created_at`에 5일을 더한 시각 |

### 주는 방식

- `RECEIVED`는 내가 받은 사람이고 `status`가 `PENDING`이며 5일이 지나지 않은 요청을 준다. 내가 거절한 요청은 주지 않는다.
- `SENT`는 내가 보낸 사람이고 `status`가 `PENDING`이거나 `REJECTED`이며 5일이 지나지 않은 요청을 준다. 둘을 구분하는 값은 주지 않는다. 프론트엔드는 모두 "답변 기다리는 중"으로 보여 준다.
- 새로 보낸 것부터 준다(`chat_request.created_at`이 큰 것부터).
- 한 번에 모두 준다. 나누지 않는다. 요청은 5일이면 사라져 쌓이지 않는다.
- 카드의 "겹치는 관심사 태그"는 `sharedInterests`다. 겹치는 것만 담고, 순서는 상대가 고른 순서다.
- 카드를 골랐을 때의 프로필(자기소개, 관심사, 질문과 답변)은 담지 않는다. 프론트엔드가 `counterpart.id`로 [남의 땅굴 조회](05-explore-visit.md#get-apiv1usersuseridburrow)를 부른다. 방노트와 같은 값이다.
- 탈퇴한 사람이 보내거나 받은 요청은 지워져 나오지 않는다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 91,
        "counterpart": {
          "id": 64,
          "nickname": "모카",
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": "SCARF_GREEN", "hand": null },
          "campusName": "서울",
          "generation": 13,
          "floor": 4,
          "isWithdrawn": false
        },
        "message": "보드게임 좋아하신다고 해서요. 같이 해요!",
        "sharedInterests": [
          { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": true },
          { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true }
        ],
        "createdAt": "2026-11-20T05:12:44Z",
        "expiresAt": "2026-11-25T05:12:44Z"
      },
      {
        "id": 86,
        "counterpart": {
          "id": 77,
          "nickname": "밤코딩",
          "profileImageUrl": null,
          "mole": { "head": "CAP_RED", "face": null, "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 13,
          "floor": 4,
          "isWithdrawn": false
        },
        "message": null,
        "sharedInterests": [],
        "createdAt": "2026-11-18T11:30:02Z",
        "expiresAt": "2026-11-23T11:30:02Z"
      }
    ]
  },
  "error": null
}
```

요청이 없을 때:

```json
{
  "success": true,
  "data": { "items": [] },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다. `direction`을 보내지 않았거나 목록에 없는 값이면 `400`과 `INVALID_INPUT`이다.

## GET /api/v1/me/chat-requests/count

받은 요청 수와 보낸 요청 수를 준다. 채팅에 들어올 때 부른다. 필터 탭의 "요청 N", 대화 선택 전의 "받은 요청 보기", 요청 탭의 "받은 요청"과 "보낸 요청" 옆의 숫자가 이 값을 쓴다.

- 로그인: 필요
- 명세: 받은 요청 1 · 3, 대화 선택 전 3

### 요청

없다.

```text
GET /api/v1/me/chat-requests/count
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `receivedCount` | 숫자 | 내가 받은, 아직 답하지 않은 요청 수. "요청 N"의 N이다 | 계산: 내가 받은 사람이고 `PENDING`이며 5일이 지나지 않은 `chat_request` 줄 수 |
| `sentCount` | 숫자 | 내가 보낸 살아 있는 요청 수 | 계산: 내가 보낸 사람이고 `PENDING`이거나 `REJECTED`이며 5일이 지나지 않은 `chat_request` 줄 수 |

### 주는 방식

- 세는 기준은 [대화 요청의 상태](#대화-요청의-상태)와 같다. [요청 목록](#get-apiv1mechat-requests)의 개수와 늘 같다.
- "요청 N"은 `receivedCount`만 쓴다. 보낸 요청은 세지 않는다.
- 받은 요청 수가 바뀌면 [실시간 소식](#실시간-소식) `CHAT_REQUEST_COUNT_CHANGED`가 온다. 프론트엔드는 그 값으로 N을 바꾼다.

### 응답 예시

```json
{
  "success": true,
  "data": { "receivedCount": 2, "sentCount": 1 },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/chat-requests/{chatRequestId}/accept

받은 대화 요청을 수락한다. 받은 요청의 "수락하고 대화하기"가 부른다. 이때 1:1 대화방이 만들어진다.

- 로그인: 필요
- 명세: 받은 요청 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRequestId` | 숫자 | ✓ | 대화 요청의 id |

```text
POST /api/v1/chat-requests/91/accept
```

### 서버가 하는 일

1. `chat_request`에서 그 요청을 찾는다. 없거나 내가 받은 사람이 아니면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
2. 두 사람의 `user` 줄을 id가 작은 것부터 잠근 뒤 요청을 다시 읽는다([DB 설계](../db/chat.md)).
3. `status`가 `ACCEPTED`면 아무것도 바꾸지 않고 그때 만든 대화방의 id를 준다.
4. `status`가 `PENDING`이 아니거나 보낸 지 5일이 지났으면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
5. `chat_room`에 `type`이 `DIRECT`인 한 줄을 만들고, `chat_room_member`에 두 사람의 줄을 만든다.
6. `chat_request.status`를 `ACCEPTED`로, `chat_room_id`를 만든 대화방으로 바꾸고 `responded_at`을 채운다.
7. `chat_message`에 `type`이 `ACCEPTED`이고 `sender_id`가 나인 안내 메시지를 넣는다. 두 사람에게 실시간 소식 `CHAT_MESSAGE_CREATED`로 간다.
8. 나에게 실시간 소식 `CHAT_REQUEST_COUNT_CHANGED`를 보낸다.
9. 보낸 사람에게 수락 알림(`CHAT_REQUEST_ACCEPTED`)을 만든다([알림 API](09-notification.md#알림의-종류)).

5 ~ 7은 한 번에 처리한다. 요청에 붙인 인사는 대화방의 메시지로 옮기지 않는다. 대화방은 대화 시작 안내만 있는 채로 열린다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `chatRoomId` | 숫자 | 만들어진 1:1 대화방의 id | `chat_request.chat_room_id` |

프론트엔드는 이 대화방으로 간다.

### 응답 예시

```json
{
  "success": true,
  "data": { "chatRoomId": 16 },
  "error": null
}
```

보낸 사람이 그사이에 취소했거나 요청이 만료됐을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_REQUEST_NOT_FOUND",
    "message": "대화 요청을 찾을 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_REQUEST_NOT_FOUND` | 없는 요청, 내가 받지 않은 요청, 보낸 사람이 취소한 요청, 만료된 요청, 내가 이미 거절한 요청 |

프론트엔드는 이 에러를 받으면 카드를 빼고 요청 목록을 다시 부른다.

## POST /api/v1/chat-requests/{chatRequestId}/reject

받은 대화 요청을 거절한다. 거절 확인 팝업의 "예"가 부른다. 보낸 사람에게는 알리지 않는다.

- 로그인: 필요
- 명세: 받은 요청 5, 거절 확인 팝업 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRequestId` | 숫자 | ✓ | 대화 요청의 id |

```text
POST /api/v1/chat-requests/86/reject
```

### 서버가 하는 일

1. `chat_request`에서 그 요청을 찾는다. 없거나 내가 받은 사람이 아니면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
2. 두 사람의 `user` 줄을 id가 작은 것부터 잠근 뒤 요청을 다시 읽는다.
3. `status`가 `REJECTED`이고 5일이 지나지 않았으면 아무것도 바꾸지 않고 성공으로 답한다.
4. `status`가 `PENDING`이 아니거나 보낸 지 5일이 지났으면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
5. `chat_request.status`를 `REJECTED`로 바꾸고 `responded_at`을 채운다.
6. 나에게 실시간 소식 `CHAT_REQUEST_COUNT_CHANGED`를 보낸다.

알림을 만들지 않고, 보낸 사람에게는 어떤 소식도 보내지 않는다. 보낸 사람에게는 요청이 만료될 때까지 그대로 "답변 기다리는 중"으로 보인다.

### 응답 `data`

`null`이다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_REQUEST_NOT_FOUND` | 없는 요청, 내가 받지 않은 요청, 보낸 사람이 취소한 요청, 만료된 요청, 이미 수락한 요청 |

## POST /api/v1/chat-requests/{chatRequestId}/cancel

내가 보낸 대화 요청을 취소한다. 보낸 요청의 "요청 취소"가 부른다. 상대가 이미 거절한 요청도 똑같이 취소된다.

- 로그인: 필요
- 명세: 보낸 요청 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `chatRequestId` | 숫자 | ✓ | 대화 요청의 id |

```text
POST /api/v1/chat-requests/88/cancel
```

### 서버가 하는 일

1. `chat_request`에서 그 요청을 찾는다. 없거나 내가 보낸 사람이 아니면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
2. 두 사람의 `user` 줄을 id가 작은 것부터 잠근 뒤 요청을 다시 읽는다.
3. `status`가 `ACCEPTED`면 `409`와 `CHAT_REQUEST_ALREADY_ACCEPTED`. `detail.chatRoomId`에 만들어진 대화방의 id를 담는다.
4. `status`가 `CANCELED`이거나 보낸 지 5일이 지났으면 `404`와 `CHAT_REQUEST_NOT_FOUND`.
5. `status`가 `PENDING`이든 `REJECTED`든 `CANCELED`로 바꾸고 `responded_at`을 채운다.
6. 바꾸기 전이 `PENDING`이었으면 받은 사람에게 실시간 소식 `CHAT_REQUEST_COUNT_CHANGED`를 보낸다. 받은 요청에서 카드가 사라지기 때문이다.

알림은 만들지 않는다. 응답은 `PENDING`이었을 때와 `REJECTED`였을 때가 똑같다. 거절된 것이 드러나지 않게 하기 위해서다. 취소한 뒤에는 그 사람에게 바로 다시 요청할 수 있다.

### 응답 `data`

`null`이다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

상대가 그사이에 수락했을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_REQUEST_ALREADY_ACCEPTED",
    "message": "상대가 이미 수락한 요청입니다.",
    "fields": null,
    "detail": { "chatRoomId": 16 }
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CHAT_REQUEST_NOT_FOUND` | 없는 요청, 내가 보내지 않은 요청, 이미 취소한 요청, 만료된 요청 |
| `409` | `CHAT_REQUEST_ALREADY_ACCEPTED` | 상대가 이미 수락한 요청. `detail.chatRoomId`가 만들어진 대화방의 id다 |

프론트엔드는 `CHAT_REQUEST_ALREADY_ACCEPTED`를 받으면 카드를 빼고 대화 목록을 다시 부른다.

## GET /api/v1/me/event-stream

이 계정에 생긴 일을 실시간으로 받는 연결이다. 로그인한 뒤 한 번 연결해 두고 계속 열어 둔다. 브라우저의 `EventSource`로 연결한다.

- 로그인: 필요
- 명세: 00 공통 2

### 요청

없다. 세션 쿠키를 함께 보낸다(`withCredentials`).

```text
GET /api/v1/me/event-stream
Accept: text/event-stream
```

### 서버가 하는 일

1. 로그인과 계정 상태를 다른 API와 똑같이 본다. 걸리면 연결을 열지 않고 공통 에러로 답한다.
2. `Content-Type: text/event-stream`으로 연결을 열어 둔다.
3. 이 계정에 알릴 일이 생길 때마다 소식 한 건을 보낸다. 한 건은 이름(`event`)과 값(`data`의 JSON)으로 이뤄진다.
4. 연결이 끊긴 동안 생긴 소식은 다시 보내지 않는다. 브라우저가 다시 연결하면 프론트엔드가 대화 목록, 요청 수, 열려 있는 대화의 메시지를 다시 불러 맞춘다.
5. 계정이 로그아웃하거나 정지되거나 탈퇴하면 연결을 끊는다.

### 응답 `data`

응답 틀(`success`, `data`, `error`)을 쓰지 않는다. 연결 위로 아래 모양의 소식이 한 건씩 흘러온다.

```text
event: CHAT_REQUEST_COUNT_CHANGED
data: {"receivedCount":3}
```

소식의 이름은 enum이다. 채팅의 것은 아래 둘이다. 알림의 `NOTIFICATION_UNREAD_CHANGED`도 이 연결로 오고, 값은 [알림 API](09-notification.md#실시간-소식)에 적었다.

| 이름 | 보내는 때 | 받는 사람 |
|---|---|---|
| `CHAT_MESSAGE_CREATED` | 대화방에 메시지가 생겼다. 사람이 보낸 메시지와 안내 메시지 모두다 | 그 대화방에 있는 모든 사람. 보낸 사람도 받는다 |
| `CHAT_REQUEST_COUNT_CHANGED` | 받은 요청 수가 바뀌었다. 새 요청을 받았거나, 보낸 사람이 취소했거나, 내가 수락하거나 거절했다 | 요청을 받은 사람 |

`CHAT_MESSAGE_CREATED`의 값:

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `chatRoomId` | 숫자 | 메시지가 생긴 대화방의 id | `chat_message.chat_room_id` |
| `message` | 객체 | 생긴 [메시지](#메시지) | |
| `unreadCount` | 숫자 | 이 소식을 받는 사람의, 그 대화방의 [안 읽은 수](#안-읽은-수) | 계산: 안 읽은 수의 규칙 |

```json
{
  "chatRoomId": 15,
  "message": {
    "id": 4104,
    "type": "TEXT",
    "sender": {
      "id": 52,
      "nickname": "새벽산책",
      "profileImageUrl": null,
      "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "content": "네, 그때 봬요.",
    "meetupCard": null,
    "images": [],
    "createdAt": "2026-11-20T07:06:40Z"
  },
  "unreadCount": 1
}
```

`CHAT_REQUEST_COUNT_CHANGED`의 값:

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `receivedCount` | 숫자 | 바뀐 뒤의 받은 요청 수. "요청 N"의 N이다 | 계산: [요청 수](#get-apiv1mechat-requestscount)의 `receivedCount`와 같다 |

```json
{ "receivedCount": 3 }
```

프론트엔드가 소식을 받았을 때 하는 일:

- `CHAT_MESSAGE_CREATED`이고 그 대화방이 열려 있으면 메시지를 맨 아래에 붙이고 [읽음 API](#post-apiv1chat-roomschatroomidread)를 부른다. 내가 보낸 메시지가 이미 그려져 있으면 다시 그리지 않는다.
- 그 대화방이 열려 있지 않으면 대화 목록에서 마지막 메시지와 안 읽은 수를 바꾸고 맨 위로 올린다.
- 대화 목록에 없는 대화방이면 [대화 목록](#get-apiv1mechat-rooms)을 다시 부른다. 내 요청이 수락됐거나 모임 참여가 확정돼 새 대화방이 생긴 경우다.
- 1:1 대화방에서 `type`이 `LEFT`나 `WITHDRAWN`인 메시지를 받으면 그 대화방을 읽기 전용으로 바꾼다.
- 모임 대화방에서 `type`이 `JOINED`, `LEFT`, `WITHDRAWN`인 메시지를 받으면 [대화방 조회](#get-apiv1chat-roomschatroomid)를 다시 불러 참여자를 맞춘다.
- 요청이 만료돼 수가 줄 때는 소식이 오지 않는다. 채팅에 들어올 때 받은 [요청 수](#get-apiv1mechat-requestscount)로 맞춘다.

### 에러

공통 에러 코드만 쓴다. 연결을 열기 전의 실패(`401`, `403`)는 다른 API와 같은 응답 틀로 답한다. 연결이 열린 뒤에는 에러를 보내지 않고 연결을 끊는다.

## 명세에 없어 이 문서에서 정한 것

- **실시간으로 받는 길**: 계정마다 연결 하나(`GET /api/v1/me/event-stream`)로 받는다. 서버가 브라우저로만 보내는 방식(SSE)이다. 메시지를 보내는 일은 일반 API로 한다. 알림의 소식도 이 연결로 온다.
- **내가 거절한 요청이 남아 있는 사람**: 그 사람에게 대화 요청을 보내면 새 요청을 만들지 않고 거절했던 요청을 수락한 것으로 처리해 바로 대화방을 연다. 05 탐색 · 방문에서 넘어온 결정이고, 대화 요청 보내기 API가 처리한다.
- **대화 목록**: 한 번에 모두 준다. 필터 탭과 대화 검색은 프론트엔드가 받은 목록에서 거른다. 대화 검색은 메시지 내용을 찾지 않는다.
- **대화방을 열 때의 값**: 헤더, 공지, 참여자, 모임 정보 팝업의 값을 대화방 조회 하나로 준다. 내 두더지는 프로필 조회를 내 id로 불러 얻는다.
- **메시지 목록**: 커서 방식으로 새 것부터 30개씩 준다. 안내 메시지도 메시지 목록에 함께 담는다.
- **안 읽은 수와 읽음**: 읽은 자리는 읽음 API로 옮긴다. 내가 보낸 메시지와 안내 메시지는 안 읽은 수에 세지 않는다.
- **나가기**: 나가기 API는 대화방에서만 나간다. 모임의 참여 취소는 모임 API가 하고, 그때 서버가 대화방에서도 뺀다. 나가기 버튼이 하는 일은 `leaveType`으로 미리 준다. 끝나지 않은 모임의 주최자와, 시작 24시간 전이 지난 참여자는 나갈 수 없다.
- **공지**: `PUT`으로 쓰거나 고치고 `DELETE`로 지운다. 200자까지다. 바뀐 공지는 실시간으로 알리지 않는다.
- **요청 목록과 요청 수**: 받은 요청과 보낸 요청을 `direction`으로 나눠 한 번에 모두 준다. 보낸 요청에는 상태 값을 주지 않는다. 요청 수는 따로 준다. 고른 요청의 프로필은 남의 땅굴 조회를 쓴다.
- **이미 처리된 요청**: 사라진 요청에 수락, 거절, 취소를 부르면 `CHAT_REQUEST_NOT_FOUND` 하나로 답한다. 수락을 두 번 부르면 같은 대화방을 준다. 취소했는데 이미 수락됐으면 `CHAT_REQUEST_ALREADY_ACCEPTED`와 대화방 id를 준다.
- **요청에 붙인 인사**: 수락해도 대화방의 메시지로 옮기지 않는다.
- **모임 카드**: 서버가 메시지 본문에서 모임 링크를 찾아 `meetupCard`로 준다. 저장하지 않고 줄 때마다 모임의 지금 값을 담는다.
- **글자 수와 첨부**: 메시지는 1,000자, 공지는 200자까지다. 첨부는 사진만 받고 메시지 하나에 3장까지다. 사진은 커뮤니티의 사진 올리기로 먼저 올린다. 글 없이 사진만 보낼 수 있다.
- **온라인 모임의 접속 링크**: 대화방 조회의 `meetup.joinUrl`로 준다. 화면의 어디에 보여 줄지는 명세에 없다.

## 구현 단계로 넘기는 것

- 메시지 본문에서 알아보는 모임 링크의 정확한 모양
- 찻방에 그릴 두더지의 수(명세가 구현 단계로 넘겼다)
- 실시간 연결을 유지하려고 보내는 신호의 간격과, 서버가 여러 대일 때 소식을 전하는 방법
- 대화가 아주 많아졌을 때 대화 목록을 나눠 주는 방법
- 메시지와 대화 요청을 짧은 시간에 너무 많이 보내는 것을 막는 기준
- 두 사람이 모두 나간 1:1 대화방과 삭제된 모임의 대화방을 언제 지우는지(DB 설계에서도 넘겼다)
- 대화 나가기의 확인 팝업 화면과 문구(명세의 보류한 결정이다)
