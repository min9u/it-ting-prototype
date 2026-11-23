# 알림 API

알림 팝업과 알림 화면에 보여 줄 알림을 주고, 읽음으로 바꾸는 일을 다룬다. 어떤 일이 생겼을 때 누구에게 어떤 알림을 만드는지도 여기에 모아 적는다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [09 알림](../spec/09-notification.md), [00 공통](../spec/00-common.md) 2
- DB 설계: [알림 · 공지](../db/notification.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/me/notifications/popup` | 알림 팝업의 요청 두 줄과 최근 알림 5개를 준다 | 필요 | 팝업 1 ~ 6, 팝업 · 요청 없음 1 |
| `GET` | `/api/v1/me/notifications` | 알림을 종류별로 이어서 준다 | 필요 | 알림 3 ~ 6 · 8 |
| `GET` | `/api/v1/me/notifications/unread-count` | 안 읽은 알림 수와 빨간 점을 켤지를 준다 | 필요 | 00 공통 2, 알림 1 |
| `POST` | `/api/v1/notifications/{notificationId}/read` | 알림 하나를 읽음으로 바꾼다 | 필요 | 팝업 6, 알림 5 |
| `POST` | `/api/v1/me/notifications/read-all` | 모든 알림을 읽음으로 바꾼다 | 필요 | 팝업 1, 알림 2 |

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 로그인한 뒤의 모든 화면 | 화면을 열 때 | `GET /api/v1/me/notifications/unread-count` | GNB 알림 아이콘의 빨간 점 |
| 로그인한 뒤의 모든 화면 | 실시간 소식 `NOTIFICATION_UNREAD_CHANGED`를 받았을 때 | 없음. 소식에 담긴 값을 쓴다 | 빨간 점 바로 바꾸기 |
| 알림 팝업 | 열 때 | `GET /api/v1/me/notifications/popup` | 요청 수가 0이면 배지와 보조 문구 숨기기, 종류 아이콘과 색, 알림의 문구, 시간 표기 |
| 알림 팝업 · 알림 | 알림 한 줄을 누를 때 | `POST /api/v1/notifications/{notificationId}/read` | 갈 곳으로 이동하기 |
| 알림 팝업 · 알림 | "모두 읽음" | `POST /api/v1/me/notifications/read-all` | 배경색과 빨간 점 지우기 |
| 알림 | 열 때, 탭을 바꿀 때 | `GET /api/v1/me/notifications`, `GET /api/v1/me/notifications/unread-count` | "안 읽음 N", 빈 상태 |
| 알림 | "더 보기" | `GET /api/v1/me/notifications`에 `cursor`를 붙인다 | 이어 붙이기 |

실시간 소식을 받는 연결은 [`GET /api/v1/me/event-stream`](06-chat.md#get-apiv1meevent-stream) 하나를 채팅과 함께 쓴다. 알림을 종류별로 켜고 끄는 것과 브라우저 푸시를 켜는 것은 [설정 · 계정 API](10-settings.md#알림-설정)에서 다룬다.

## 영역 규칙

### 알림의 모양

알림 팝업의 최근 알림과 알림 화면의 목록이 함께 쓰는 모양이다. 아래에서 "알림 한 줄"이라고 하면 이 값들을 가리킨다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 알림의 id | `notification.id` |
| `type` | enum | [알림의 종류](#알림의-종류) 가운데 하나 | `notification.type` |
| `category` | enum | 갈래. `MEETUP`(모임), `CHAT`(채팅), `COMMUNITY`(커뮤니티), `BURROW`(땅굴), `NOTICE`(공지) 가운데 하나 | 계산: `type`마다 정해진 갈래 |
| `actor` | 객체 | 알림을 일으킨 사람의 [사용자 표시](00-common.md#사용자-표시). 일으킨 사람이 없거나 드러내지 않는 알림은 `null` | |
| `target` | 객체 | 눌렀을 때 갈 곳 | |
| `target.type` | enum | `MEETUP`, `CHAT_ROOM`, `CHAT_REQUEST`, `POST`, `GUESTBOOK`, `BURROW`, `NOTICE` 가운데 하나 | `notification.target_type` |
| `target.id` | 숫자 | 갈 곳의 id. `target.type`이 `GUESTBOOK`이면 `null` | `notification.target_id` |
| `target.title` | 문자열 | 갈 곳의 이름. 모임이면 모임 이름, 글이면 글 제목, 공지면 공지 제목, 모임 대화방이면 모임 이름이다. 그 밖이거나 원본이 사라졌으면 `null` | `meetup.title`, `post_version.title`, `notice.title` 가운데 하나 |
| `target.startsAt` | 시각 | 갈 곳이 모임일 때 그 모임의 시작 시각. 그 밖이거나 모임이 삭제됐으면 `null` | `meetup.starts_at` |
| `isRead` | 참/거짓 | 읽은 알림인지 | 계산: `notification.read_at`이 채워졌는지 |
| `createdAt` | 시각 | 알림이 생긴 시각 | `notification.created_at` |

```json
{
  "id": 7201,
  "type": "POST_COMMENTED",
  "category": "COMMUNITY",
  "actor": {
    "id": 12,
    "nickname": "새벽산책",
    "profileImageUrl": null,
    "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
    "campusName": "서울",
    "generation": 14,
    "floor": 3,
    "isWithdrawn": false
  },
  "target": { "type": "POST", "id": 204, "title": "토요일 아침 한강 러닝 같이 하실 분", "startsAt": null },
  "isRead": false,
  "createdAt": "2026-11-19T03:02:00Z"
}
```

- 서버는 알림의 문구를 만들지 않는다. "새벽산책님이 내 글에 댓글을 남겼어요" 같은 제목과 보조 설명은 프론트엔드가 `type`, `actor.nickname`, `target.title`로 만든다. 종류 아이콘과 색도 프론트엔드가 `category`로 정한다.
- 원본이 사라진 알림도 그대로 준다. 삭제된 모임이나 글의 알림은 `target.title`이 `null`이고, 누르면 그 화면의 조회 API가 `404`로 답해 안내 화면이 나온다.
- 알림은 지울 수 없다. 읽음으로만 바꾼다.

### 알림의 종류

`type`은 22가지다. 받는 사람이 그 갈래의 알림을 꺼 두었으면 만들지 않는다([알림을 만들 때의 규칙](#알림을-만들-때의-규칙)).

| `type` | 갈래 | 만드는 때 | 받는 사람 | `actor` | `target.type` |
|---|---|---|---|---|---|
| `MEETUP_APPLICATION_RECEIVED` | 모임 | 누가 내 모임에 참여를 신청함 | 주최자 | 신청한 사람 | `MEETUP` |
| `MEETUP_APPLICATION_ACCEPTED` | 모임 | 내 신청이 수락됨 | 신청자 | 주최자 | `MEETUP` |
| `MEETUP_APPLICATION_REJECTED` | 모임 | 내 신청이 거절되거나 모집 마감 때 자동으로 미승인됨 | 신청자 | `null` | `MEETUP` |
| `MEETUP_PARTICIPATION_CANCELED` | 모임 | 참여 확정자가 참여를 취소함 | 주최자 | 취소한 사람 | `MEETUP` |
| `MEETUP_KICKED` | 모임 | 모임에서 내보내짐 | 내보내진 사람 | `null` | `MEETUP` |
| `MEETUP_UPDATED` | 모임 | 모임 정보가 수정됨 | 신청 대기자와 참여 확정자 | `null` | `MEETUP` |
| `MEETUP_CANCELED` | 모임 | 모임이 취소됨 | 신청 대기자와 참여 확정자 | `null` | `MEETUP` |
| `MEETUP_DELETED` | 모임 | 모임이 삭제됨 | 신청 대기자 | `null` | `MEETUP` |
| `MEETUP_VACANCY_OPENED` | 모임 | 정원이 차 있던 모임에 자리가 남 | 그 모임에 빈자리 알림을 켠 사람 | `null` | `MEETUP` |
| `MEETUP_START_REMINDER` | 모임 | 모임 시작 24시간 전과 1시간 전 | 주최자와 참여 확정자 | `null` | `MEETUP` |
| `CHAT_MESSAGE_RECEIVED` | 채팅 | 대화방에 새 메시지가 옴 | 그 대화방에 있는 다른 사람 | 가장 최근에 보낸 사람 | `CHAT_ROOM` |
| `CHAT_REQUEST_RECEIVED` | 채팅 | 대화 요청을 받음 | 요청을 받은 사람 | 요청한 사람 | `CHAT_REQUEST` |
| `CHAT_REQUEST_ACCEPTED` | 채팅 | 내 대화 요청이 수락됨 | 요청한 사람 | 수락한 사람 | `CHAT_ROOM` |
| `POST_COMMENTED` | 커뮤니티 | 내 글에 댓글이 달림 | 글 작성자 | 댓글을 쓴 사람 | `POST` |
| `POST_LIKED` | 커뮤니티 | 내 글에 좋아요가 눌림 | 글 작성자 | 누른 사람 | `POST` |
| `COMMENT_REPLIED` | 커뮤니티 | 내 댓글이나 답글에 답글이 달림 | 답한 대상의 작성자 | 답글을 쓴 사람 | `POST` |
| `COMMENT_LIKED` | 커뮤니티 | 내 댓글이나 답글에 좋아요가 눌림 | 그 댓글의 작성자 | 누른 사람 | `POST` |
| `POST_HIDDEN` | 커뮤니티 | 내 글이 신고로 가려짐 | 글 작성자 | `null` | `POST` |
| `COMMENT_HIDDEN` | 커뮤니티 | 내 댓글이 신고로 가려짐 | 댓글 작성자 | `null` | `POST` |
| `GUESTBOOK_ENTRY_CREATED` | 땅굴 | 내 땅굴의 방명록에 새 글이 달림 | 땅굴 주인 | 글을 쓴 사람 | `GUESTBOOK` |
| `GUESTBOOK_ENTRY_HIDDEN` | 땅굴 | 내가 쓴 방명록 글이 신고로 가려짐 | 그 글을 쓴 사람 | `null` | `BURROW` |
| `NOTICE_PUBLISHED` | 공지 | 서비스 공지가 올라옴 | 모든 사용자 | `null` | `NOTICE` |

- 신고로 가려진 알림(`POST_HIDDEN`, `COMMENT_HIDDEN`, `GUESTBOOK_ENTRY_HIDDEN`)에는 신고한 사람을 담지 않는다.
- 거절, 내보내기, 모임 수정 · 취소 · 삭제 알림에는 `actor`를 담지 않는다. 주최자가 한 일인지 서버가 자동으로 한 일인지를 가리지 않고 모임의 일로 알린다.
- 명세의 알림 종류에 있는 "방노트"는 보류한 결정이라 종류를 두지 않았다.

### 눌렀을 때 갈 곳

프론트엔드는 `type`과 `target`으로 갈 곳을 정한다.

| `target.type` | `target.id` | 가는 화면 |
|---|---|---|
| `MEETUP` | 모임의 id | 모임 상세. `type`이 `MEETUP_APPLICATION_RECEIVED`면 내 모임 › 내가 연 모임의 그 모임 신청 관리로 간다 |
| `CHAT_ROOM` | 대화방의 id | 채팅의 그 대화방 |
| `CHAT_REQUEST` | 대화 요청의 id | 채팅 › 요청 › 받은 요청 |
| `POST` | 글의 id | 커뮤니티의 글 상세. 댓글 알림도 그 글로 간다 |
| `GUESTBOOK` | `null` | 내 땅굴의 방명록 전체 보기 |
| `BURROW` | 땅굴 주인의 계정 id | 그 사람의 땅굴(방문자 뷰). 가려진 방명록 글을 썼던 땅굴이다 |
| `NOTICE` | 공지의 id | 설정의 공지사항 상세 |

`BURROW`의 `target.id`는 [`GET /api/v1/users/{userId}/burrow`](05-explore-visit.md#get-apiv1usersuseridburrow)의 `userId`에 그대로 쓴다.

### 알림을 만들 때의 규칙

알림은 이 문서의 API가 아니라, 그 일을 처리하는 다른 영역의 API와 서버의 예약 작업이 만든다. 만들 때 아래를 지킨다.

- 받는 사람이 그 갈래의 알림을 꺼 두었으면 만들지 않는다(`notification_setting`).
- 자기 자신이 한 일로는 만들지 않는다. 내 글에 내가 댓글을 달거나 좋아요를 눌러도 알림이 없다.
- 탈퇴한 사람에게는 만들지 않는다.
- 만든 알림은 받는 사람에게 실시간 소식 `NOTIFICATION_UNREAD_CHANGED`로 알린다([실시간 소식](#실시간-소식)).
- 받는 사람이 브라우저 푸시를 켜 두었으면 같은 알림을 푸시로도 보낸다. 푸시를 켜고 끄는 API와 구독은 [설정 · 계정 API](10-settings.md#브라우저-푸시)에서 다룬다.

### 새 메시지 알림

`CHAT_MESSAGE_RECEIVED`는 메시지마다 만들지 않고 대화방마다 한 줄로 묶는다.

- 받는 사람에게 그 대화방의 안 읽은 `CHAT_MESSAGE_RECEIVED` 알림이 없으면 새로 만든다.
- 이미 있으면 새로 만들지 않는다. 그 알림의 `created_at`을 새 메시지의 시각으로, `actor_id`를 새 메시지를 보낸 사람으로 바꾼다.
- 받는 사람이 그 대화방을 읽으면([읽음 API](06-chat.md#post-apiv1chat-roomschatroomidread)) 그 대화방의 안 읽은 새 메시지 알림도 읽음으로 바꾼다.
- 안내 메시지("참여했어요", "나갔습니다")로는 만들지 않는다. 사람이 보낸 메시지에만 만든다.

몇 개가 왔는지는 알림에 담지 않는다. 채팅의 [안 읽은 수](06-chat.md#안-읽은-수)가 보여 준다.

### 모임 일정 임박 알림

`MEETUP_START_REMINDER`는 서버의 예약 작업이 만든다.

- 모임 시작 24시간 전과 1시간 전에 한 번씩, 두 번 보낸다.
- 받는 사람은 그때의 주최자와 참여 확정자다. 신청 대기자에게는 보내지 않는다.
- 취소된 모임, 삭제된 모임, 이미 시작한 모임에는 보내지 않는다.
- 보낼 때가 이미 지난 뒤에 확정된 사람에게는 그 알림을 보내지 않는다. 시작 20시간 전에 수락된 사람은 1시간 전 알림만 받는다.
- 주최자가 시작 시각을 바꾸면 바뀐 시각을 기준으로 다시 보낸다. 같은 사람에게 같은 시작 시각의 같은 알림(24시간 전, 1시간 전)은 한 번만 보낸다(`notification.event_key`).
- 프론트엔드는 `target.startsAt`으로 "내일 14시에 시작해요", "1시간 뒤에 시작해요" 같은 문구를 만든다.

### 알림과 요청 수

알림 팝업 맨 위의 요청 두 줄은 알림이 아니라 "아직 처리하지 않은 요청"의 수다.

- 모임 참여 요청 수는 내가 연 모임에 온, 아직 처리하지 않은 신청의 수다. 취소되거나 삭제된 모임과 모집 마감이 지난 모임의 신청은 세지 않는다.
- 채팅 요청 수는 내가 받은, 아직 답하지 않은 대화 요청의 수다. 채팅의 [요청 수](06-chat.md#get-apiv1mechat-requestscount)의 `receivedCount`와 같다.
- 두 수는 알림을 읽거나 "모두 읽음"을 눌러도 줄지 않는다. 요청을 처리해야 준다.
- 모임이나 채팅 알림을 꺼 두어도 두 수는 그대로 준다.

### 보관

- 30일이 지난 알림은 어느 API도 주지 않는다. 안 읽은 수에도 세지 않는다. 지우는 일은 서버가 따로 한다.
- 알림이 사라져도 참여 신청이나 대화 요청 자체는 남는다.

### 실시간 소식

알림 아이콘의 빨간 점은 화면을 새로 열지 않아도 바로 바뀐다(00 공통 2). 채팅과 같은 연결([`GET /api/v1/me/event-stream`](06-chat.md#get-apiv1meevent-stream))로 아래 소식을 보낸다.

| 이름 | 보내는 때 | 받는 사람 |
|---|---|---|
| `NOTIFICATION_UNREAD_CHANGED` | 새 알림이 생겼다. 또는 알림을 읽어 안 읽은 수가 바뀌었다 | 그 알림을 받는 사람 |

`NOTIFICATION_UNREAD_CHANGED`의 값:

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `unreadCount` | 숫자 | 바뀐 뒤의 안 읽은 알림 수 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `unreadCount`와 같다 |
| `hasUnread` | 참/거짓 | 빨간 점을 켤지 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `hasUnread`와 같다 |

```json
{ "unreadCount": 4, "hasUnread": true }
```

- 프론트엔드는 받은 값으로 빨간 점과 "안 읽음 N"을 바꾼다. 알림 팝업이나 알림 화면이 열려 있으면 목록을 다시 받는다.
- 새 알림의 내용은 소식에 담지 않는다.
- 다른 탭에서 알림을 읽었을 때도 이 소식이 와서 탭끼리 맞는다.

## GET /api/v1/me/notifications/popup

알림 팝업에 보여 줄 값을 한 번에 준다. GNB의 알림 아이콘을 눌러 팝업을 열 때 부른다.

- 로그인: 필요
- 명세: 팝업 1 ~ 6, 팝업 · 요청 없음 1

### 요청

없다.

```text
GET /api/v1/me/notifications/popup
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `meetupRequestCount` | 숫자 | 내가 연 모임에 온, 아직 처리하지 않은 참여 신청의 수 | 계산: [알림과 요청 수](#알림과-요청-수) |
| `chatRequestCount` | 숫자 | 내가 받은, 아직 답하지 않은 대화 요청의 수 | 계산: [알림과 요청 수](#알림과-요청-수) |
| `latestChatRequester` | 객체 | 가장 최근에 대화 요청을 보낸 사람의 [사용자 표시](00-common.md#사용자-표시). 요청이 없으면 `null` | |
| `recentItems` | 목록 | 최근 알림. [알림 한 줄](#알림의-모양)의 목록이고 5개까지다 | |
| `unreadCount` | 숫자 | 안 읽은 알림 수 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `unreadCount`와 같다 |

### 주는 방식

- 요청 두 줄은 수가 0이어도 늘 보여 준다. 프론트엔드는 수가 0이면 배지와 보조 문구를 숨긴다.
- 채팅 요청의 보조 문구("두더지왕 님 외 2명")는 프론트엔드가 `latestChatRequester`와 `chatRequestCount`로 만든다.
- `recentItems`에는 요청 알림(`MEETUP_APPLICATION_RECEIVED`, `CHAT_REQUEST_RECEIVED`)을 담지 않는다. 위의 두 줄이 대신한다.
- `recentItems`는 갈래를 가리지 않고, 안 읽은 알림을 먼저, 그 안에서 새 알림을 먼저 준다. 30일 안의 알림만 준다.
- 최근 알림이 없으면 `recentItems`가 빈 목록이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "meetupRequestCount": 1,
    "chatRequestCount": 3,
    "latestChatRequester": {
      "id": 44,
      "nickname": "모카",
      "profileImageUrl": null,
      "mole": { "head": null, "face": null, "neck": null, "hand": "COFFEE_CUP" },
      "campusName": "대전",
      "generation": 15,
      "floor": 1,
      "isWithdrawn": false
    },
    "recentItems": [
      {
        "id": 7201,
        "type": "POST_COMMENTED",
        "category": "COMMUNITY",
        "actor": {
          "id": 12,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "target": { "type": "POST", "id": 204, "title": "토요일 아침 한강 러닝 같이 하실 분", "startsAt": null },
        "isRead": false,
        "createdAt": "2026-11-19T03:02:00Z"
      },
      {
        "id": 7188,
        "type": "MEETUP_START_REMINDER",
        "category": "MEETUP",
        "actor": null,
        "target": { "type": "MEETUP", "id": 23, "title": "퇴근길 러닝 크루", "startsAt": "2026-11-25T10:00:00Z" },
        "isRead": true,
        "createdAt": "2026-11-24T10:00:00Z"
      }
    ],
    "unreadCount": 4
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/me/notifications

알림을 준다. 알림 화면을 열 때, 탭을 바꿀 때, "더 보기"를 누를 때 부른다.

- 로그인: 필요
- 명세: 알림 3 ~ 6 · 8

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `category` | enum | | `MEETUP`, `CHAT`, `COMMUNITY`, `BURROW`, `NOTICE` 가운데 하나. 보내지 않으면 전체다 |
| 쿼리 | `size` | 숫자 | | 한 번에 받을 개수. 1 ~ 50. 보내지 않으면 20 |
| 쿼리 | `cursor` | 문자열 | | 앞 응답의 `nextCursor`. 처음에는 보내지 않는다 |

```text
GET /api/v1/me/notifications?category=COMMUNITY&size=20
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [알림 한 줄](#알림의-모양)의 목록 | |
| `nextCursor` | 문자열 | 다음 알림을 받을 때 보낼 값. 더 없으면 `null` | 계산: 마지막으로 준 알림의 자리 |
| `hasNext` | 참/거짓 | 더 받을 알림이 있는지 | 계산: 마지막으로 준 알림 뒤에 알림이 더 있는지 |

### 주는 방식

- 내가 받은 알림 가운데 30일 안의 것만 준다.
- 안 읽은 알림을 먼저 주고, 그 아래에 읽은 알림을 준다. 각각 새 알림이 먼저다.
- 팝업과 달리 요청 알림(`MEETUP_APPLICATION_RECEIVED`, `CHAT_REQUEST_RECEIVED`)도 준다.
- `category`를 보내면 그 갈래의 알림만 준다.
- 커서 방식이다. "더 보기"를 누를 때마다 다음 20개를 받는다.
- 이어 받는 사이에 새 알림이 생기거나 읽음이 바뀌어도 이미 받은 알림이 다시 오지 않는다. 새로 생긴 알림은 화면을 다시 열 때 보인다.
- 지금 꺼 둔 갈래의 알림도, 끄기 전에 받은 것은 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 7201,
        "type": "POST_COMMENTED",
        "category": "COMMUNITY",
        "actor": {
          "id": 12,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "target": { "type": "POST", "id": 204, "title": "토요일 아침 한강 러닝 같이 하실 분", "startsAt": null },
        "isRead": false,
        "createdAt": "2026-11-19T03:02:00Z"
      },
      {
        "id": 7150,
        "type": "POST_HIDDEN",
        "category": "COMMUNITY",
        "actor": null,
        "target": { "type": "POST", "id": 190, "title": "중고 키보드 팝니다", "startsAt": null },
        "isRead": true,
        "createdAt": "2026-11-15T08:20:00Z"
      }
    ],
    "nextCursor": null,
    "hasNext": false
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/me/notifications/unread-count

안 읽은 알림 수와, GNB 알림 아이콘의 빨간 점을 켤지를 준다. 로그인한 뒤 화면을 열 때와 알림 화면을 열 때 부른다. 그 뒤의 변화는 [실시간 소식](#실시간-소식)으로 받는다.

- 로그인: 필요
- 명세: 00 공통 2, 알림 1 · 2

### 요청

없다.

```text
GET /api/v1/me/notifications/unread-count
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `unreadCount` | 숫자 | 안 읽은 알림 수. 알림 화면의 "안 읽음 N"이다 | 계산: 내 `notification` 가운데 30일 안이고 `read_at`이 비어 있는 줄 수 |
| `hasUnread` | 참/거짓 | 빨간 점을 켤지 | 계산: 위의 안 읽은 알림 가운데 지금 켜 둔 갈래의 것이 하나라도 있는지 |

### 주는 방식

- `unreadCount`는 갈래를 가리지 않고 센다. 요청 알림도 센다.
- `hasUnread`는 지금 꺼 둔 갈래의 알림을 빼고 본다. 그래서 `unreadCount`가 1 이상인데 `hasUnread`가 `false`일 수 있다. 채팅 알림을 받은 뒤에 채팅 알림을 끈 경우다.
- 요청 두 줄의 수(모임 참여 요청, 채팅 요청)는 이 값에 들지 않는다.

### 응답 예시

```json
{
  "success": true,
  "data": { "unreadCount": 4, "hasUnread": true },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/notifications/{notificationId}/read

알림 하나를 읽음으로 바꾼다. 알림 한 줄을 누를 때 프론트엔드가 이동과 함께 부른다.

- 로그인: 필요
- 명세: 팝업 6, 알림 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `notificationId` | 숫자 | ✓ | 알림의 id |

```text
POST /api/v1/notifications/7201/read
```

### 서버가 하는 일

1. `notification`에서 내가 받은 그 알림을 찾는다. 없거나, 남의 알림이거나, 30일이 지났으면 `404`와 `NOTIFICATION_NOT_FOUND`.
2. `read_at`이 비어 있으면 지금 시각으로 채운다. 이미 읽은 알림이면 바꾸지 않고 성공으로 답한다.
3. 안 읽은 수가 바뀌었으면 나에게 실시간 소식 `NOTIFICATION_UNREAD_CHANGED`를 보낸다.

읽음으로 바꾸는 것은 갈 곳의 원본이 있는지와 상관없다. 삭제된 글의 알림도 읽음으로 바뀐다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `unreadCount` | 숫자 | 바꾼 뒤의 안 읽은 알림 수 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `unreadCount`와 같다 |
| `hasUnread` | 참/거짓 | 빨간 점을 켤지 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `hasUnread`와 같다 |

### 응답 예시

```json
{
  "success": true,
  "data": { "unreadCount": 3, "hasUnread": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `NOTIFICATION_NOT_FOUND` | 없는 알림이거나, 내가 받은 알림이 아니거나, 30일이 지난 알림 |

## POST /api/v1/me/notifications/read-all

내 알림을 모두 읽음으로 바꾼다. 알림 팝업과 알림 화면의 "모두 읽음"이 부른다.

- 로그인: 필요
- 명세: 팝업 1, 알림 2

### 요청

없다. 고른 탭과 상관없이 모든 갈래의 알림을 읽음으로 바꾼다.

```text
POST /api/v1/me/notifications/read-all
```

### 서버가 하는 일

1. 내 `notification` 가운데 `read_at`이 비어 있는 줄을 모두 지금 시각으로 채운다.
2. 바뀐 줄이 있으면 나에게 실시간 소식 `NOTIFICATION_UNREAD_CHANGED`를 보낸다.

요청 두 줄의 수는 줄지 않는다. 참여 신청과 대화 요청은 처리해야 준다([알림과 요청 수](#알림과-요청-수)). 채팅의 안 읽은 수도 바뀌지 않는다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `unreadCount` | 숫자 | 항상 0 | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `unreadCount`와 같다 |
| `hasUnread` | 참/거짓 | 항상 `false` | 계산: [안 읽은 수](#get-apiv1menotificationsunread-count)의 `hasUnread`와 같다 |

### 응답 예시

```json
{
  "success": true,
  "data": { "unreadCount": 0, "hasUnread": false },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## 명세에 없어 이 문서에서 정한 것

- **모임 일정 임박 알림**: 시작 24시간 전과 1시간 전에 두 번, 주최자와 참여 확정자에게 보낸다. 시작 시각이 바뀌면 바뀐 시각을 기준으로 다시 보낸다.
- **방명록 글이 가려졌을 때**: 그 글을 쓴 사람에게 알린다. 누르면 그 글을 썼던 땅굴로 간다.
- **새 메시지 알림**: 대화방마다 한 줄로 묶는다. 그 대화방을 읽으면 알림도 읽음으로 바뀐다.
- **실시간으로 받는 길**: 서버가 브라우저로만 보내는 연결(SSE) 하나를 채팅과 함께 쓴다. 알림은 `NOTIFICATION_UNREAD_CHANGED` 하나를 보낸다.
- **알림의 종류**: 22가지에 코드를 정했다. 방노트 알림은 보류한 결정이라 두지 않았다.
- **알림 한 줄의 값**: 서버는 종류, 일으킨 사람, 갈 곳만 준다. 제목과 보조 설명은 프론트엔드가 만든다. 거절이나 내보내기처럼 누가 했는지 드러내지 않는 알림에는 일으킨 사람을 담지 않는다.
- **팝업**: 요청 두 줄, 가장 최근에 대화 요청을 보낸 사람, 최근 알림 5개를 API 하나로 준다.
- **알림 목록**: 안 읽은 알림을 먼저 주고, 20개씩 커서 방식으로 이어 준다.
- **안 읽은 수와 빨간 점**: API 하나가 둘을 함께 준다. 안 읽은 수는 모든 갈래를 세고, 빨간 점은 지금 켜 둔 갈래만 본다.
- **읽음**: 알림을 누를 때 프론트엔드가 읽음 API를 따로 부른다. "모두 읽음"은 고른 탭과 상관없이 모든 알림에 적용한다.
- **눌렀을 때 갈 곳**: 갈 곳의 종류에 `BURROW`를 더했다. 가려진 방명록 글을 썼던 땅굴로 가는 데 쓴다.
- **원본이 사라진 알림**: 알림은 그대로 주고 갈 곳의 이름만 비운다. 안내 화면은 갈 곳의 조회 API가 `404`로 답할 때 프론트엔드가 보여 준다.

## 구현하며 정한 것

[KAN-54](../work/KAN-54.md)에서 정했다.

- **30일이 지난 알림 지우기**: 매일 04:00(한국 시간)에 서버의 예약 작업이 1,000줄씩 나눠 지운다.
- **좋아요 알림**: 묶지 않는다. 좋아요를 취소했다가 다시 눌러 알림이 또 생기지 않게 하려면, 알림을 만드는 쪽이 같은 사건의 키(`POST_LIKED:<글 id>:<누른 사람 id>`)로 한 번만 만든다.
- **목록의 커서**: 첫 요청 시각을 담는다. 이어 받는 동안 안 읽음 · 읽음은 그 시각의 상태로 보고, 그 뒤에 생긴 알림은 주지 않는다. 읽을 수 없는 `cursor`는 `400 INVALID_INPUT`이다.
- **일으킨 사람을 드러내지 않는 알림**: [알림의 종류](#알림의-종류)에서 `actor`가 `null`인 종류는 서버가 일으킨 사람을 저장하지 않는다.

## 구현 단계로 넘기는 것

- 임박 알림을 보내는 예약 작업의 실행 방법(07 모임)
- 서비스 공지를 모든 사용자에게 알리는 방법(공지를 올리는 API는 11 관리자에서 정한다)
- 브라우저 푸시에 담는 글과 누르면 가는 주소, 새 메시지 푸시를 묶는 방법(푸시를 켜는 API는 [설정 · 계정 API](10-settings.md#브라우저-푸시)에 있다)
- 열려 있는 대화방에 온 메시지로 빨간 점이 잠깐 켜지지 않게 하는 방법
- 방노트 알림(명세의 보류한 결정이다)
- 땅굴 알림의 아이콘 색, 팝업에 최근 알림이 없을 때의 빈 상태(디자인에서 정한다)
