# 모임 API

모임을 찾아 참여를 신청하고, 모임을 만들어 신청을 관리하는 일을 다룬다. 내 모임과 캘린더, 찜과 빈자리 알림도 여기에 있다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [07 모임](../spec/07-meetup.md)
- DB 설계: [모임](../db/meetup.md), [채팅](../db/chat.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/meetups` | 모임을 검색 · 필터 · 정렬해 페이지로 준다 | 필요 | 리스트 2 ~ 6, 정렬 열림, 개수 보기 열림, 날짜 필터, 날짜 직접 설정 |
| `POST` | `/api/v1/meetups` | 모임을 만든다 | 필요 | 만들기 1 ~ 4 · 6 |
| `GET` | `/api/v1/meetups/{meetupId}` | 모임 하나의 정보와 내 상태를 준다 | 필요 | 상세 1 ~ 9, 상태 화면 모두, 모임 수정 · 취소 1 |
| `PATCH` | `/api/v1/meetups/{meetupId}` | 모임 정보를 고친다 | 필요 | 모임 수정 · 취소 1 ~ 3 |
| `POST` | `/api/v1/meetups/{meetupId}/cancel` | 모임을 취소한다 | 필요 | 모임 수정 · 취소 3 |
| `DELETE` | `/api/v1/meetups/{meetupId}` | 참여 확정자가 없는 모임을 삭제한다 | 필요 | 삭제 확인 팝업 2 |
| `PUT` | `/api/v1/meetups/{meetupId}/like` | 모임을 찜한다 | 필요 | 상세 2, 찜한 모임 3 |
| `DELETE` | `/api/v1/meetups/{meetupId}/like` | 찜을 푼다 | 필요 | 상세 2, 찜한 모임 3 |
| `PUT` | `/api/v1/meetups/{meetupId}/vacancy-alert` | 빈자리 알림을 켠다 | 필요 | 찜한 모임 5 |
| `DELETE` | `/api/v1/meetups/{meetupId}/vacancy-alert` | 빈자리 알림을 끈다 | 필요 | 찜한 모임 5 |
| `POST` | `/api/v1/meetups/{meetupId}/applications` | 참여를 신청한다 | 필요 | 상세 5 · 6 |
| `GET` | `/api/v1/meetups/{meetupId}/applications` | 주최자에게 신청자와 참여 확정자를 준다 | 필요 | 신청 관리 1 ~ 4 |
| `POST` | `/api/v1/meetups/{meetupId}/withdraw-application` | 내 신청을 취소한다 | 필요 | 상태: 신청 대기 3, 내 모임 4 |
| `POST` | `/api/v1/meetups/{meetupId}/cancel-participation` | 내 참여를 취소한다 | 필요 | 상태: 참여 확정 3, 06 채팅의 모임 정보 팝업 4 |
| `POST` | `/api/v1/meetup-applications/{meetupApplicationId}/accept` | 신청을 수락한다 | 필요 | 신청 관리 3 |
| `POST` | `/api/v1/meetup-applications/{meetupApplicationId}/reject` | 신청을 거절한다 | 필요 | 거절 확인 팝업 2 |
| `POST` | `/api/v1/meetup-applications/{meetupApplicationId}/kick` | 참여 확정자를 내보낸다 | 필요 | 내보내기 확인 팝업 2 |
| `GET` | `/api/v1/me/meetups` | 내 모임을 탭 하나만큼 준다 | 필요 | 내 모임 2 ~ 5, 찜한 모임 1 · 2 |
| `GET` | `/api/v1/me/meetups/summary` | 내 모임의 탭별 개수와 가까운 모임을 준다 | 필요 | 리스트 7 · 8, 내 모임 2 · 6 |
| `GET` | `/api/v1/meetup-calendar` | 한 달의 모임을 준다 | 필요 | 캘린더 팝업 1 ~ 5, 내 모임 7 |

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 모임 리스트 | 들어올 때 | `GET /api/v1/meetups`, `GET /api/v1/me/meetups/summary` | 표지판 그림, 카테고리의 이름과 색, D-day, 모집 완료 카드를 흐리게 하기 |
| 모임 리스트 | 검색어, 카테고리, 날짜, 방식, 정렬, 개수, 페이지를 바꿀 때 | `GET /api/v1/meetups` | "오늘", "이번 주", "이번 주말"을 날짜 둘로 바꾸기, 입력이 멈춘 뒤에 부르기, 개수를 바꾸면 1페이지로 가기 |
| 날짜 직접 설정 | "적용" | `GET /api/v1/meetups`에 `dateFrom`, `dateTo` | 달력, 오늘보다 앞선 날 막기, 고른 기간의 글 |
| 모임 상세 | 열 때 | `GET /api/v1/meetups/{meetupId}`. 받은 `chatRoomId`가 있으면 이어서 [`GET /api/v1/chat-rooms/{chatRoomId}/messages`](06-chat.md#get-apiv1chat-roomschatroomidmessages)에 `size=3` | 내 상태와 모집 상태에 맞는 행동 카드, 좌석 그림, 가려진 미리보기, 공유 링크 복사 |
| 모임 상세 | 하트 | `PUT /api/v1/meetups/{meetupId}/like`, `DELETE /api/v1/meetups/{meetupId}/like` | 하트 모양 바로 바꾸기 |
| 모임 상세(미신청) | "참여 신청하기" | `POST /api/v1/meetups/{meetupId}/applications` | 완료 토스트, 신청 대기 카드로 바꾸기 |
| 모임 상세(신청 대기), 내 모임 | "신청 취소" | `POST /api/v1/meetups/{meetupId}/withdraw-application` | 확인 |
| 모임 상세(참여 확정), 채팅의 모임 정보 팝업 | "참여 취소", "모임 나가기" | `POST /api/v1/meetups/{meetupId}/cancel-participation` | 확인, 시작 24시간 전이 지나면 버튼을 끄고 안내하기 |
| 모임 만들기 | "모임 만들기" | `POST /api/v1/meetups` | 미리보기 카드, 필수값이 찰 때까지 버튼 끄기, 주소 찾기 |
| 모임 생성 완료 팝업 | 열 때 | 없음. 만들 때 보낸 값과 받은 `meetupId`를 쓴다 | 표지판 그림, 공유 링크 복사 |
| 모임 수정 · 취소 | 열 때 | `GET /api/v1/meetups/{meetupId}` | 지금 값으로 채우기, 시작 12시간 전이 지나면 입력 칸 잠그기 |
| 모임 수정 · 취소 | "수정 완료" | `PATCH /api/v1/meetups/{meetupId}` | 완료 토스트 |
| 모임 수정 · 취소 | "모임 취소하기"의 확인 | `POST /api/v1/meetups/{meetupId}/cancel` | 확인 팝업 |
| 삭제 확인 팝업 | "삭제" | `DELETE /api/v1/meetups/{meetupId}` | 내 모임으로 가기 |
| 내 모임 | 들어올 때 | `GET /api/v1/me/meetups/summary`, `GET /api/v1/me/meetups`에 `tab=UPCOMING`, `GET /api/v1/meetup-calendar`에 `scope=MINE` | 탭 옆 숫자, 다음 모임 카드, 미니 캘린더, "확인 필요" 한 줄의 문구 |
| 내 모임 | 탭을 바꿀 때 | `GET /api/v1/me/meetups`에 그 탭 | 빈 상태 |
| 찜한 모임 | 하트, "되돌리기" | `DELETE /api/v1/meetups/{meetupId}/like`, `PUT /api/v1/meetups/{meetupId}/like`. 풀기 전에 빈자리 알림이 켜져 있었으면 되돌릴 때 `PUT /api/v1/meetups/{meetupId}/vacancy-alert`도 부른다 | 토스트, 풀기 전의 빈자리 알림 설정 기억하기 |
| 찜한 모임 | "빈자리 알림 받기" | `PUT /api/v1/meetups/{meetupId}/vacancy-alert`, `DELETE /api/v1/meetups/{meetupId}/vacancy-alert` | 모집 완료인 모임에만 보여 주기 |
| 캘린더 팝업 | 열 때, 달을 넘길 때, 보기를 바꿀 때 | `GET /api/v1/meetup-calendar` | 달력 그리기, 날짜를 고르면 그날의 모임만 보여 주기 |
| 신청 관리 | 열 때 | `GET /api/v1/meetups/{meetupId}/applications` | 정원이 차면 수락 끄기 |
| 신청 관리 | "수락" | `POST /api/v1/meetup-applications/{meetupApplicationId}/accept` | 목록 다시 받기 |
| 거절 확인 팝업 | "거절" | `POST /api/v1/meetup-applications/{meetupApplicationId}/reject` | 목록 다시 받기 |
| 내보내기 확인 팝업 | "내보내기" | `POST /api/v1/meetup-applications/{meetupApplicationId}/kick` | 목록 다시 받기 |

사용자 표시를 눌렀을 때의 프로필 팝업은 [`GET /api/v1/users/{userId}/profile`](00-common.md#get-apiv1usersuseridprofile)을 부른다. 모임 대화는 [채팅 API](06-chat.md)에서 다룬다.

## 영역 규칙

### 모임 카드

모임을 목록으로 보여 주는 곳(리스트, 내 모임, 캘린더)이 함께 쓰는 모양이다. 아래에서 "모임 카드"라고 하면 이 값들을 가리킨다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 모임의 id | `meetup.id` |
| `title` | 문자열 | 모임 이름 | `meetup.title` |
| `category` | enum | [카테고리](#카테고리) 가운데 하나 | `meetup.category` |
| `startsAt` | 시각 | 시작 시각 | `meetup.starts_at` |
| `endsAt` | 시각 | 끝나는 시각. 정하지 않은 모임은 `null` | `meetup.ends_at` |
| `mode` | enum | `OFFLINE`(오프라인), `ONLINE`(온라인) 가운데 하나 | `meetup.mode` |
| `place` | 문자열 | 오프라인 모임의 장소. 온라인 모임은 `null` | `meetup.place` |
| `capacity` | 숫자 | 정원. 주최자 포함 | `meetup.capacity` |
| `confirmedCount` | 숫자 | 확정 인원. 주최자 포함 | 계산: [정원과 확정 인원](#정원과-확정-인원) |
| `recruitStatus` | enum | `OPEN`, `CLOSED`, `PAST`, `CANCELED` 가운데 하나 | 계산: [모집 상태](#모집-상태) |

```json
{
  "id": 19,
  "title": "토요일 한강 러닝",
  "category": "EXERCISE",
  "startsAt": "2026-11-27T22:00:00Z",
  "endsAt": "2026-11-28T00:00:00Z",
  "mode": "OFFLINE",
  "place": "여의나루역 2번 출구",
  "capacity": 6,
  "confirmedCount": 3,
  "recruitStatus": "OPEN"
}
```

표지판 그림, 카드 색, D-day, "N자리 남았어요"는 프론트엔드가 이 값으로 만든다.

### 카테고리

`category`의 값은 여섯 가지다.

| 값 | 명세의 이름 |
|---|---|
| `HOBBY` | 취미/문화 |
| `FOOD` | 식사/카페 |
| `STUDY` | 스터디/프로젝트 |
| `ETC` | 기타 |
| `GAME` | 게임 |
| `EXERCISE` | 운동 |

- 카테고리 목록을 주는 API는 없다. 이름, 카드 색, 표지판, 캘린더 라벨 색은 프론트엔드가 코드마다 갖는다.
- 관심사와 관계없다. 모임 하나는 카테고리 하나를 가진다.

### 정원과 확정 인원

- 정원(`capacity`)에는 주최자가 포함된다. 2 ~ 50명이다.
- 확정 인원(`confirmedCount`)은 주최자 1명에 `meetup_application.status`가 `CONFIRMED`인 줄 수를 더한 값이다. 모임을 만들자마자 1이다.
- 남은 자리는 `capacity`에서 `confirmedCount`를 뺀 값이다. 프론트엔드가 뺀다.
- 주최자는 `meetup_application`에 줄이 없다.

### 모집 상태

`recruitStatus`는 저장하지 않고 응답을 만들 때 계산한다. 아래 표의 위에서부터 먼저 맞는 값이다.

| 값 | 명세의 이름 | 때 |
|---|---|---|
| `CANCELED` | 취소됨 | `meetup.canceled_at`이 채워졌다 |
| `PAST` | 지난 모임 | 지금이 `meetup.starts_at`과 같거나 그 뒤다 |
| `CLOSED` | 모집 완료 | 확정 인원이 정원과 같다. 또는 지금이 모집 마감 시각과 같거나 그 뒤다 |
| `OPEN` | 모집 중 | 그 밖 |

- 모집 마감 시각은 `meetup.recruit_deadline_at`이고, 비어 있으면 `meetup.starts_at`이다.
- 정원이 차서 `CLOSED`가 된 모임은 모집 마감 전에 자리가 나면 다시 `OPEN`이 된다.
- 삭제된 모임(`meetup.deleted_at`이 채워짐)은 없는 모임으로 다룬다. 어느 API에서든 `404`와 `MEETUP_NOT_FOUND`로 답하고 목록에 담지 않는다.

### 내 상태

`myStatus`는 요청한 사람이 그 모임에서 어떤 사람인지다. 모임 상세의 행동 카드가 이 값과 `recruitStatus`로 정해진다.

| 값 | 명세의 이름 | 때 |
|---|---|---|
| `HOST` | 주최자 | `meetup.host_id`가 나다 |
| `NONE` | 미신청 | 내 신청 줄이 없거나 `WITHDRAWN`(신청 취소)이다 |
| `PENDING` | 신청 대기 | 내 신청이 `PENDING`이다 |
| `REJECTED` | 미승인 | 내 신청이 `REJECTED`다 |
| `CONFIRMED` | 참여 확정 | 내 신청이 `CONFIRMED`다 |
| `CANCELED` | 참여 취소 | 내 신청이 `CANCELED`다. 다시 신청할 수 없다 |
| `KICKED` | 내보내짐 | 내 신청이 `KICKED`다. 다시 신청할 수 없다 |
| `MEETUP_CANCELED` | 모임 취소로 마감 | 신청 대기 중에 모임이 취소됐다 |

- `CANCELED`와 `KICKED`에는 프론트엔드가 미신청 화면을 그리고 버튼 자리에 "이 모임에는 다시 신청할 수 없어요"를 보여 준다.
- `recruitStatus`가 `CLOSED`, `PAST`, `CANCELED`이고 `myStatus`가 `NONE`이면 프론트엔드가 모집 상태의 카드(모집 완료, 지난 모임, 취소된 모임)를 보여 준다.
- 버튼을 켤지는 모임 상세의 `canApply`, `canCancelParticipation`, `canEdit`, `canCancel`, `canDelete`로 정한다. 프론트엔드가 시각을 다시 계산하지 않는다.

### 신청 기록이 바뀌는 때

신청 기록(`meetup_application`)은 한 사람과 한 모임에 한 줄이다. 상태가 바뀌는 길은 아래가 전부다.

| 바뀜 | 하는 사람 | API | 함께 일어나는 일 |
|---|---|---|---|
| 줄 없음 · `WITHDRAWN` → `PENDING` | 신청자 | [참여 신청](#post-apiv1meetupsmeetupidapplications) | 주최자에게 알림 |
| `PENDING` → `WITHDRAWN` | 신청자 | [신청 취소](#post-apiv1meetupsmeetupidwithdraw-application) | 없음 |
| `PENDING` → `CONFIRMED` | 주최자 | [수락](#post-apiv1meetup-applicationsmeetupapplicationidaccept) | 모임 대화방에 넣는다. 신청자에게 알림 |
| `PENDING` → `REJECTED` | 주최자 | [거절](#post-apiv1meetup-applicationsmeetupapplicationidreject) | 신청자에게 알림 |
| `PENDING` → `REJECTED` | 서버 | 없음. [서버가 스스로 하는 일](#서버가-스스로-하는-일) | 신청자에게 알림 |
| `PENDING` → `MEETUP_CANCELED` | 서버 | [모임 취소](#post-apiv1meetupsmeetupidcancel)에 딸려 일어난다 | 모임 취소 알림만 간다 |
| `CONFIRMED` → `CANCELED` | 참여자 | [참여 취소](#post-apiv1meetupsmeetupidcancel-participation) | 모임 대화방에서 뺀다. 주최자에게 알림 |
| `CONFIRMED` → `KICKED` | 주최자 | [내보내기](#post-apiv1meetup-applicationsmeetupapplicationidkick) | 모임 대화방에서 뺀다. 그 사람에게 알림 |
| `PENDING` → `WITHDRAWN` | 서버 | [회원 탈퇴](10-settings.md#post-apiv1mewithdraw)에 딸려 일어난다. 예정 모임만이다 | 없음 |
| `CONFIRMED` → `CANCELED` | 서버 | [회원 탈퇴](10-settings.md#post-apiv1mewithdraw)에 딸려 일어난다. 예정 모임만이고, 시작 24시간 전이 지났어도 바꾼다 | 모임 대화방에서 뺀다. 주최자에게 알림 |

- 다시 신청할 수 있는 것은 줄이 없거나 `WITHDRAWN`일 때뿐이다. `REJECTED`, `CANCELED`, `KICKED`, `MEETUP_CANCELED`에서는 다시 신청할 수 없다.
- 모집 마감 시각이 지난 `PENDING`은 예약 작업이 아직 바꾸지 않았더라도 `REJECTED`로 본다. 응답에 `REJECTED`로 담고, 수락과 신청 취소는 받지 않는다.
- 신청자가 하는 일(신청, 신청 취소, 참여 취소)은 모임의 id로 부른다. 한 모임에 내 신청은 하나뿐이기 때문이다. 주최자가 하는 일(수락, 거절, 내보내기)은 신청의 id로 부른다.

### 시각으로 막는 것

| 하는 일 | 할 수 없게 되는 때 |
|---|---|
| 참여 신청 | 모집 마감 시각부터. 정원이 차 있는 동안에도 할 수 없다 |
| 참여 취소 | 시작 24시간 전부터 |
| 모임 수정 | 시작 12시간 전부터 |
| 모임 취소, 모임 삭제, 내보내기 | 시작 시각부터 |

서버는 요청을 받은 순간의 시각으로 다시 검사한다. 화면을 열어 둔 사이에 때가 지나면 `409`로 답한다.

### 모임 대화방

모임 API가 채팅 쪽에 하는 일은 아래 세 가지다. 대화방과 메시지의 모양은 [채팅 API](06-chat.md)를 따른다.

| 때 | 하는 일 |
|---|---|
| 모임을 만든다 | `chat_room`에 `type`이 `MEETUP`인 줄을 만들고, `chat_room_member`에 주최자를 넣는다 |
| 신청을 수락한다 | `chat_room_member`에 그 사람을 넣고, `chat_message`에 `type`이 `JOINED`인 안내 메시지를 넣는다 |
| 참여를 취소하거나 내보낸다 | 그 사람의 `chat_room_member.left_at`을 채우고, `chat_message`에 `type`이 `LEFT`인 안내 메시지를 넣는다 |

- 안내 메시지는 대화방에 있는 사람들에게 채팅의 [실시간 소식](06-chat.md#실시간-소식)으로 간다.
- 모임을 취소하거나 모임이 끝나도 대화방은 그대로 둔다. 그 뒤에 대화방에서만 나가는 일은 채팅의 [나가기](06-chat.md#post-apiv1chat-roomschatroomidleave)가 한다.
- 응답의 `chatRoomId`는 내가 그 대화방에 들어가 있을 때만 준다([대화방에 들어갈 수 있는 사람](06-chat.md#대화방에-들어갈-수-있는-사람)). 아니면 `null`이다.
- 모임 상세의 모임 대화 미리보기는 모임 API가 주지 않는다. `chatRoomId`가 있으면 프론트엔드가 채팅의 메시지 조회를 `size=3`으로 부른다. `chatRoomId`가 `null`인 사람은 미리보기를 가린다.
- 온라인 모임의 접속 링크(`joinUrl`)는 주최자와 참여 확정자에게만 준다.

### 날짜와 시간대

- 시각은 모두 UTC로 주고받는다.
- 날짜로 거르는 값(`dateFrom`, `dateTo`)과 캘린더의 달(`year`, `month`)은 한국 시간의 날짜로 센다. 한국 시간 11월 28일 07시에 시작하는 모임은 `startsAt`이 `2026-11-27T22:00:00Z`이지만 11월 28일의 모임이다.
- "오늘", "이번 주", "이번 주말", D-day는 프론트엔드가 계산한다.

### 알림

이 영역에서 알림을 만드는 때는 아래와 같다. 알림의 종류와 모양, 받는 사람의 알림 설정을 따르는 것은 [알림 API](09-notification.md#알림의-종류)에 있다.

| 때 | 받는 사람 |
|---|---|
| 참여를 신청함 | 주최자 |
| 신청이 수락됨 | 신청자 |
| 신청이 거절되거나 자동으로 미승인됨 | 신청자 |
| 참여를 취소함 | 주최자 |
| 내보내짐 | 그 사람 |
| 모임 정보가 수정됨, 모임이 취소됨 | 신청 대기자와 참여 확정자 |
| 모임이 삭제됨 | 신청 대기자 |
| 빈자리가 생김 | 그 모임에 빈자리 알림을 켠 사람 |
| 모임 시작 24시간 전과 1시간 전 | 주최자와 참여 확정자. 서버의 예약 작업이 만든다([알림 API](09-notification.md#모임-일정-임박-알림)) |

빈자리가 생겼다는 것은 정원이 차 있던 모임에서 모집 마감 전에 자리가 난 것이다. 참여 취소, 내보내기, 정원 늘리기로 생긴다.

### 서버가 스스로 하는 일

모집 마감 시각이 되면 서버가 그 모임에 남은 `PENDING` 신청을 `REJECTED`로 바꾸고 신청자에게 미승인 알림을 만든다. 취소되거나 삭제된 모임은 건너뛴다. 이 일을 부르는 API는 없고, 예약 작업의 실행 방법은 구현 단계에서 정한다.

## GET /api/v1/meetups

모임을 찾는다. 모임 리스트에 들어올 때와, 검색어 · 카테고리 · 날짜 · 방식 · 정렬 · 개수 · 페이지를 바꿀 때마다 부른다.

- 로그인: 필요
- 명세: 리스트 2 ~ 6, 정렬 열림 1 · 2, 개수 보기 열림 1 · 2, 날짜 필터 1 ~ 3, 날짜 직접 설정 2 · 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `keyword` | 문자열 | | 검색어. 모임 이름과 소개 글에서 찾는다. 50자 이하. 보내지 않거나 빈 문자열이면 검색하지 않는다 |
| 쿼리 | `categories` | 목록 | | [카테고리](#카테고리)의 값을 쉼표로 이어 보낸다. 보내지 않으면 전체다 |
| 쿼리 | `dateFrom` | 날짜 | | 이 날부터 시작하는 모임만 준다. 한국 시간의 날짜다 |
| 쿼리 | `dateTo` | 날짜 | | 이 날까지 시작하는 모임만 준다. 한국 시간의 날짜다. `dateFrom`보다 앞설 수 없다 |
| 쿼리 | `mode` | enum | | `OFFLINE`, `ONLINE` 가운데 하나. 보내지 않으면 전체다 |
| 쿼리 | `sort` | enum | | `STARTS_SOON`(가까운 날짜순), `NEWEST`(최신등록순), `POPULAR`(인기순), `MOST_JOINED`(인원순) 가운데 하나. 보내지 않으면 `STARTS_SOON` |
| 쿼리 | `page` | 숫자 | | 페이지 번호. 1부터 세고 보내지 않으면 1 |
| 쿼리 | `size` | 숫자 | | 한 페이지의 모임 수. 6, 12, 24 가운데 하나. 보내지 않으면 6 |

```text
GET /api/v1/meetups?keyword=러닝&categories=EXERCISE,HOBBY&dateFrom=2026-11-21&dateTo=2026-11-29&mode=OFFLINE&sort=STARTS_SOON&page=1&size=6
```

날짜 필터의 "오늘", "이번 주", "이번 주말"은 프론트엔드가 `dateFrom`과 `dateTo`로 바꿔 보낸다. 하루만 볼 때는 두 값을 같게 보낸다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [모임 카드](#모임-카드)의 목록 | |
| `page` | 숫자 | 지금 페이지 | 계산: 요청의 `page` |
| `size` | 숫자 | 한 페이지의 모임 수 | 계산: 요청의 `size` |
| `totalItems` | 숫자 | 조건에 맞는 모임의 수 | 계산: 조건에 맞는 `meetup` 줄 수 |
| `totalPages` | 숫자 | 전체 페이지 수 | 계산: `totalItems`를 `size`로 나눠 올린 값 |

### 주는 방식

- 삭제된 모임, 취소된 모임, 시작한 모임은 주지 않는다. 그래서 `recruitStatus`는 `OPEN`이나 `CLOSED`다.
- 조건은 모두 함께 적용한다. 캠퍼스로는 거르지 않는다.
- `keyword`는 `meetup.title`이나 `meetup.description`에 그 글자가 들어 있는 모임을 찾는다. 카테고리 이름은 찾지 않는다.
- 어떤 정렬이든 `CLOSED`인 모임을 `OPEN`인 모임 뒤에 둔다. 그 안에서 아래 순서를 따른다.

| `sort` | 순서 |
|---|---|
| `STARTS_SOON` | `meetup.starts_at`이 이른 것부터 |
| `NEWEST` | `meetup.created_at`이 늦은 것부터 |
| `POPULAR` | 찜한 사람(`meetup_like`의 줄 수)이 많은 것부터 |
| `MOST_JOINED` | 확정 인원이 많은 것부터 |

- 순서가 같으면 `meetup.starts_at`이 이른 것, 그다음 `meetup.id`가 큰 것을 먼저 준다.
- 페이지 방식이다. 없는 페이지를 부르면 `items`가 빈 목록이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 19,
        "title": "토요일 한강 러닝",
        "category": "EXERCISE",
        "startsAt": "2026-11-27T22:00:00Z",
        "endsAt": "2026-11-28T00:00:00Z",
        "mode": "OFFLINE",
        "place": "여의나루역 2번 출구",
        "capacity": 6,
        "confirmedCount": 3,
        "recruitStatus": "OPEN"
      },
      {
        "id": 23,
        "title": "퇴근길 러닝 크루",
        "category": "EXERCISE",
        "startsAt": "2026-11-25T10:00:00Z",
        "endsAt": null,
        "mode": "OFFLINE",
        "place": "역삼역 3번 출구",
        "capacity": 4,
        "confirmedCount": 4,
        "recruitStatus": "CLOSED"
      }
    ],
    "page": 1,
    "size": 6,
    "totalItems": 2,
    "totalPages": 1
  },
  "error": null
}
```

두 번째 모임이 더 일찍 시작하지만 모집 완료라서 뒤에 온다.

### 에러

공통 에러 코드만 쓴다. 값이 정해진 것 밖이면(`size=10`, `dateTo`가 `dateFrom`보다 앞섬) `400`과 `INVALID_INPUT`이다.

## POST /api/v1/meetups

모임을 만든다. 모임 만들기의 "모임 만들기"가 부른다. 모임 대화방이 함께 만들어진다.

- 로그인: 필요
- 명세: 만들기 1 ~ 4 · 6

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `title` | 문자열 | ✓ | 모임 이름. 1 ~ 30자. 공백만으로는 안 된다 |
| 본문 | `category` | enum | ✓ | [카테고리](#카테고리) 가운데 하나 |
| 본문 | `description` | 문자열 | | 소개 글. 1,000자 이하. 쓰지 않았으면 `null` |
| 본문 | `capacity` | 숫자 | ✓ | 정원. 주최자 포함 2 ~ 50 |
| 본문 | `supplies` | 문자열 | | 준비물. 100자 이하. 쓰지 않았으면 `null` |
| 본문 | `isMessageEnabled` | 참/거짓 | ✓ | 신청할 때 주최자에게 남길 말을 받을지. "받을게요"가 `true` |
| 본문 | `startsAt` | 시각 | ✓ | 시작 시각. 지금보다 뒤여야 한다 |
| 본문 | `endsAt` | 시각 | | 끝나는 시각. `startsAt`보다 뒤여야 한다. 정하지 않았으면 `null` |
| 본문 | `recruitDeadlineAt` | 시각 | | 모집 마감 시각. 지금보다 뒤이고 `startsAt`보다 늦을 수 없다. 정하지 않았으면 `null`이고 시작할 때까지 신청을 받는다 |
| 본문 | `mode` | enum | ✓ | `OFFLINE`, `ONLINE` 가운데 하나 |
| 본문 | `place` | 문자열 | | 장소. `OFFLINE`이면 꼭 보내고 1 ~ 100자다. `ONLINE`이면 `null` |
| 본문 | `placeDetail` | 문자열 | | 상세 주소. 100자 이하. `ONLINE`이거나 쓰지 않았으면 `null` |
| 본문 | `joinUrl` | 문자열 | | 온라인 접속 링크. `http://`나 `https://`로 시작하고 500자 이하. `OFFLINE`이거나 쓰지 않았으면 `null` |

```text
POST /api/v1/meetups
```

```json
{
  "title": "토요일 한강 러닝",
  "category": "EXERCISE",
  "description": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요.",
  "capacity": 6,
  "supplies": "운동화, 물",
  "isMessageEnabled": true,
  "startsAt": "2026-11-27T22:00:00Z",
  "endsAt": "2026-11-28T00:00:00Z",
  "recruitDeadlineAt": "2026-11-26T15:00:00Z",
  "mode": "OFFLINE",
  "place": "여의나루역 2번 출구",
  "placeDetail": "편의점 앞",
  "joinUrl": null
}
```

### 서버가 하는 일

1. 입력값의 모양과 범위를 본다. 어긋나면 `400`과 `INVALID_INPUT`이고, `fields`에 어긋난 값마다 까닭을 담는다.
2. `meetup`에 한 줄을 만든다. `host_id`는 요청한 사람이다. `isMessageEnabled`는 `accepts_message`에 넣고, 나머지는 이름이 같은 칼럼에 넣는다.
3. `chat_room`에 `type`이 `MEETUP`이고 `meetup_id`가 이 모임인 줄을 만든다.
4. `chat_room_member`에 주최자를 넣는다.

2 ~ 4는 한 번에 처리한다. 알림은 만들지 않는다. 만든 모임의 확정 인원은 1이고 모집 상태는 `OPEN`이다.

### 응답 `data`

성공하면 `201`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `meetupId` | 숫자 | 만든 모임의 id | `meetup.id` |
| `chatRoomId` | 숫자 | 함께 만든 모임 대화방의 id | `chat_room.id` |

프론트엔드는 모임 생성 완료 팝업을 띄운다. 팝업의 모임 요약은 보낸 값으로 그리고, "모임 보러 가기"는 `meetupId`의 상세로 간다.

### 응답 예시

```json
{
  "success": true,
  "data": { "meetupId": 19, "chatRoomId": 21 },
  "error": null
}
```

끝나는 시각이 시작 시각보다 앞설 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "입력값을 확인해 주세요.",
    "fields": [
      { "field": "endsAt", "message": "끝나는 시각은 시작 시각보다 뒤여야 합니다." }
    ],
    "detail": null
  }
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/meetups/{meetupId}

모임 하나의 정보와, 그 모임에서의 내 상태를 준다. 모임 상세를 열 때와 모임 수정 · 취소 화면을 열 때 부른다. 참여 신청, 신청 취소 같은 일을 한 뒤에도 다시 불러 화면을 맞춘다.

- 로그인: 필요
- 명세: 상세 1 ~ 9, 상태 표, 상태 화면 9개, 모임 수정 · 취소 1 · 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
GET /api/v1/meetups/19
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 모임의 id | `meetup.id` |
| `title` | 문자열 | 모임 이름 | `meetup.title` |
| `category` | enum | [카테고리](#카테고리) 가운데 하나 | `meetup.category` |
| `description` | 문자열 | 소개 글. 없으면 `null` | `meetup.description` |
| `supplies` | 문자열 | 준비물. 없으면 `null` | `meetup.supplies` |
| `isMessageEnabled` | 참/거짓 | 신청할 때 주최자에게 남길 말을 받는지. `false`면 프론트엔드가 입력 칸을 숨긴다 | `meetup.accepts_message` |
| `startsAt` | 시각 | 시작 시각 | `meetup.starts_at` |
| `endsAt` | 시각 | 끝나는 시각. 정하지 않은 모임은 `null` | `meetup.ends_at` |
| `recruitDeadlineAt` | 시각 | 모집 마감 시각. 정하지 않은 모임은 `null`이고, 그때는 프론트엔드가 마감 안내를 보여 주지 않는다 | `meetup.recruit_deadline_at` |
| `mode` | enum | `OFFLINE`, `ONLINE` 가운데 하나 | `meetup.mode` |
| `place` | 문자열 | 오프라인 모임의 장소. 온라인 모임은 `null` | `meetup.place` |
| `placeDetail` | 문자열 | 상세 주소. 없으면 `null` | `meetup.place_detail` |
| `joinUrl` | 문자열 | 온라인 모임의 접속 링크. 주최자와 참여 확정자에게만 준다. 그 밖의 사람에게는 링크가 있어도 `null` | `meetup.join_url` |
| `capacity` | 숫자 | 정원. 주최자 포함 | `meetup.capacity` |
| `confirmedCount` | 숫자 | 확정 인원. 주최자 포함 | 계산: [정원과 확정 인원](#정원과-확정-인원) |
| `recruitStatus` | enum | `OPEN`, `CLOSED`, `PAST`, `CANCELED` 가운데 하나 | 계산: [모집 상태](#모집-상태) |
| `host` | 객체 | 주최자의 [사용자 표시](00-common.md#사용자-표시) | |
| `participants` | 목록 | 모집 현황의 좌석에 앉는 사람. 주최자와 참여 확정자다 | |
| `participants[].user` | 객체 | 그 사람의 [사용자 표시](00-common.md#사용자-표시) | |
| `participants[].isHost` | 참/거짓 | 주최자인지 | 계산: `meetup.host_id`와 같은지 |
| `participants[].isMe` | 참/거짓 | 나인지 | 계산: 요청한 사람과 같은지 |
| `participants[].hasSharedInterest` | 참/거짓 | 나와 겹치는 관심사가 하나라도 있는지. 나 자신은 `false` | 계산: 그 사람과 요청한 사람의 `user_interest`에 같은 `interest_id`가 있는지 |
| `sharedInterestParticipantCount` | 숫자 | 나와 관심사가 겹치는 참여자의 수. 나는 세지 않는다 | 계산: `participants` 가운데 `hasSharedInterest`가 `true`인 사람 수 |
| `isLiked` | 참/거짓 | 내가 찜했는지 | 계산: `meetup_like`에 내 줄이 있는지 |
| `hasVacancyAlert` | 참/거짓 | 내가 빈자리 알림을 켰는지. 찜하지 않았으면 `false` | 계산: 내 `meetup_like.vacancy_alert`. 줄이 없으면 `false` |
| `myStatus` | enum | `HOST`, `NONE`, `PENDING`, `REJECTED`, `CONFIRMED`, `CANCELED`, `KICKED`, `MEETUP_CANCELED` 가운데 하나 | 계산: [내 상태](#내-상태) |
| `canApply` | 참/거짓 | 지금 참여를 신청할 수 있는지 | 계산: `myStatus`가 `NONE`이고 `recruitStatus`가 `OPEN`인지 |
| `canCancelParticipation` | 참/거짓 | 지금 참여를 취소할 수 있는지 | 계산: `myStatus`가 `CONFIRMED`이고, 취소된 모임이 아니고, 시작 24시간 전이 지나지 않았는지 |
| `canEdit` | 참/거짓 | 지금 모임 정보를 고칠 수 있는지 | 계산: `myStatus`가 `HOST`이고, 취소된 모임이 아니고, 시작 12시간 전이 지나지 않았는지 |
| `canCancel` | 참/거짓 | 지금 모임을 취소할 수 있는지 | 계산: `myStatus`가 `HOST`이고, 취소된 모임이 아니고, 시작 전이고, 주최자를 뺀 참여 확정자가 1명 이상인지 |
| `canDelete` | 참/거짓 | 지금 모임을 삭제할 수 있는지 | 계산: `myStatus`가 `HOST`이고, 시작 전이고, 주최자를 뺀 참여 확정자가 없는지 |
| `chatRoomId` | 숫자 | 모임 대화방의 id. 내가 그 대화방에 들어가 있을 때만 준다. 아니면 `null` | `chat_room.id`. 내 `chat_room_member.left_at`이 비어 있을 때 |

### 주는 방식

- 삭제된 모임이 아니면 누구에게나 준다. 지난 모임과 취소된 모임도 준다.
- `participants`는 주최자를 맨 앞에, 그다음은 참여가 확정된 순서(`meetup_application.status_changed_at`이 이른 것부터)로 준다. 빈자리는 `capacity`에서 `participants`의 수를 뺀 만큼 프론트엔드가 그린다.
- 주최자의 행동 카드는 `canCancel`과 `canDelete`로 갈린다. `canDelete`가 `true`면 "모임 수정 · 삭제", 아니면 "모임 수정 · 취소"다.
- 모임 대화 미리보기는 담지 않는다. `chatRoomId`가 있으면 프론트엔드가 채팅의 [메시지 조회](06-chat.md#get-apiv1chat-roomschatroomidmessages)를 `size=3`으로 불러 그리고, `null`이면 가린다([모임 대화방](#모임-대화방)).
- 신청 대기 수와 신청자는 담지 않는다. 신청 관리는 [`GET /api/v1/meetups/{meetupId}/applications`](#get-apiv1meetupsmeetupidapplications)가 준다.

### 응답 예시

아직 신청하지 않은 사람이 볼 때:

```json
{
  "success": true,
  "data": {
    "id": 19,
    "title": "토요일 한강 러닝",
    "category": "EXERCISE",
    "description": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요.",
    "supplies": "운동화, 물",
    "isMessageEnabled": true,
    "startsAt": "2026-11-27T22:00:00Z",
    "endsAt": "2026-11-28T00:00:00Z",
    "recruitDeadlineAt": "2026-11-26T15:00:00Z",
    "mode": "OFFLINE",
    "place": "여의나루역 2번 출구",
    "placeDetail": "편의점 앞",
    "joinUrl": null,
    "capacity": 6,
    "confirmedCount": 3,
    "recruitStatus": "OPEN",
    "host": {
      "id": 31,
      "nickname": "두더지왕",
      "profileImageUrl": null,
      "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "participants": [
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
        "isHost": true,
        "isMe": false,
        "hasSharedInterest": true
      },
      {
        "user": {
          "id": 12,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "isHost": false,
        "isMe": false,
        "hasSharedInterest": false
      },
      {
        "user": {
          "id": 44,
          "nickname": "모카",
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": null, "hand": "COFFEE_CUP" },
          "campusName": "대전",
          "generation": 15,
          "floor": 1,
          "isWithdrawn": false
        },
        "isHost": false,
        "isMe": false,
        "hasSharedInterest": true
      }
    ],
    "sharedInterestParticipantCount": 2,
    "isLiked": false,
    "hasVacancyAlert": false,
    "myStatus": "NONE",
    "canApply": true,
    "canCancelParticipation": false,
    "canEdit": false,
    "canCancel": false,
    "canDelete": false,
    "chatRoomId": null
  },
  "error": null
}
```

같은 모임을 참여 확정자가 보면 아래 값이 달라진다. 온라인 모임이면 `joinUrl`도 온다.

```json
{
  "myStatus": "CONFIRMED",
  "canApply": false,
  "canCancelParticipation": true,
  "chatRoomId": 21
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |

## PATCH /api/v1/meetups/{meetupId}

모임 정보를 고친다. 모임 수정 · 취소의 "수정 완료"가 부른다. 주최자만 할 수 있고 시작 12시간 전까지다.

- 로그인: 필요
- 명세: 모임 수정 · 취소 1 ~ 3

### 요청

아래 값을 모두 보낸다. 바꾸지 않은 값도 지금 값을 담는다. 하나라도 빠지면 `400`과 `INVALID_INPUT`이다. 모집 마감 시각은 만들 때만 정하므로 받지 않는다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |
| 본문 | `title` | 문자열 | ✓ | 모임 이름. 1 ~ 30자 |
| 본문 | `category` | enum | ✓ | [카테고리](#카테고리) 가운데 하나 |
| 본문 | `description` | 문자열 | ✓ | 소개 글. 1,000자 이하. 비우려면 `null` |
| 본문 | `capacity` | 숫자 | ✓ | 정원. 2 ~ 50이고, 지금의 확정 인원보다 적을 수 없다 |
| 본문 | `supplies` | 문자열 | ✓ | 준비물. 100자 이하. 비우려면 `null` |
| 본문 | `isMessageEnabled` | 참/거짓 | ✓ | 신청할 때 주최자에게 남길 말을 받을지 |
| 본문 | `startsAt` | 시각 | ✓ | 시작 시각. 지금보다 뒤이고, 모집 마감 시각이 있으면 그보다 앞설 수 없다 |
| 본문 | `endsAt` | 시각 | ✓ | 끝나는 시각. `startsAt`보다 뒤. 정하지 않으려면 `null` |
| 본문 | `mode` | enum | ✓ | `OFFLINE`, `ONLINE` 가운데 하나 |
| 본문 | `place` | 문자열 | ✓ | 장소. `OFFLINE`이면 1 ~ 100자, `ONLINE`이면 `null` |
| 본문 | `placeDetail` | 문자열 | ✓ | 상세 주소. 100자 이하. 없으면 `null` |
| 본문 | `joinUrl` | 문자열 | ✓ | 온라인 접속 링크. 500자 이하. 없으면 `null` |

```text
PATCH /api/v1/meetups/19
```

```json
{
  "title": "토요일 한강 러닝",
  "category": "EXERCISE",
  "description": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요.",
  "capacity": 8,
  "supplies": "운동화, 물, 여벌 옷",
  "isMessageEnabled": true,
  "startsAt": "2026-11-27T23:00:00Z",
  "endsAt": "2026-11-28T01:00:00Z",
  "mode": "OFFLINE",
  "place": "여의나루역 2번 출구",
  "placeDetail": "편의점 앞",
  "joinUrl": null
}
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾는다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. 내가 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 취소된 모임이거나 시작 12시간 전이 지났으면 `409`와 `MEETUP_EDIT_NOT_ALLOWED`.
4. 입력값의 모양과 범위를 본다. `capacity`가 지금의 확정 인원보다 적은 것도 여기서 본다. 어긋나면 `400`과 `INVALID_INPUT`.
5. `meetup`의 그 줄을 보낸 값으로 바꾼다. `recruit_deadline_at`은 바꾸지 않는다.
6. 신청 대기자(`PENDING`)와 참여 확정자(`CONFIRMED`)에게 모임 수정 알림을 만든다.
7. 정원이 차 있던 모임의 정원을 늘려 자리가 났으면, 빈자리 알림을 켠 사람에게 빈자리 알림을 만든다.

바뀐 값이 하나도 없으면 5 ~ 7을 하지 않고 성공으로 답한다.

### 응답 `data`

`null`이다. 프론트엔드는 모임 상세로 가서 다시 조회한다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

시작까지 12시간이 남지 않았을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_EDIT_NOT_ALLOWED",
    "message": "시작 12시간 전부터는 모임을 수정할 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `409` | `MEETUP_EDIT_NOT_ALLOWED` | 취소된 모임이거나 시작 12시간 전이 지남 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## POST /api/v1/meetups/{meetupId}/cancel

모임을 취소한다. 모임 수정 · 취소의 "모임 취소하기"에서 확인을 거친 뒤 부른다. 주최자를 뺀 참여 확정자가 1명 이상인 모임에 쓴다. 확정자가 없는 모임은 취소하지 않고 [삭제](#delete-apiv1meetupsmeetupid)한다.

- 로그인: 필요
- 명세: 모임 수정 · 취소 3, 상태: 취소된 모임 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
POST /api/v1/meetups/19/cancel
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾고 그 줄을 잠근다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. 내가 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 이미 취소된 모임이면 아무것도 바꾸지 않고 성공으로 답한다.
4. 시작한 모임이거나, 주최자를 뺀 참여 확정자가 없으면 `409`와 `MEETUP_CANCEL_NOT_ALLOWED`.
5. `meetup.canceled_at`을 지금 시각으로 채운다.
6. 그 모임의 `PENDING` 신청을 모두 `MEETUP_CANCELED`로 바꾸고 `status_changed_at`을 채운다. `CONFIRMED` 신청은 그대로 둔다.
7. 바꾸기 직전의 신청 대기자와 참여 확정자에게 모임 취소 알림을 만든다. 미승인 알림은 만들지 않는다.

5 ~ 7은 한 번에 처리한다([DB 설계](../db/meetup.md)). 모임 대화방은 그대로 둔다.

### 응답 `data`

`null`이다. 프론트엔드는 내 모임으로 간다. 취소한 모임은 내 모임의 지난 모임 탭에 남는다.

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
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `409` | `MEETUP_CANCEL_NOT_ALLOWED` | 시작한 모임이거나, 참여 확정자가 없어 삭제해야 하는 모임 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## DELETE /api/v1/meetups/{meetupId}

모임을 삭제한다. 삭제 확인 팝업의 "삭제"가 부른다. 주최자를 뺀 참여 확정자가 없는 모임만 삭제할 수 있고, 삭제하면 기록이 남지 않는다.

- 로그인: 필요
- 명세: 삭제 확인 팝업 1 ~ 3, 상태: 주최자 · 참여 확정 0명 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
DELETE /api/v1/meetups/19
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾고 그 줄을 잠근다. 없거나 이미 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. 내가 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 시작한 모임이거나, 주최자를 뺀 참여 확정자가 1명 이상이면 `409`와 `MEETUP_DELETE_NOT_ALLOWED`.
4. `meetup.deleted_at`을 지금 시각으로 채운다.
5. 그때의 신청 대기자(`PENDING`)에게 모임 삭제 알림을 만든다.

4와 5는 한 번에 처리한다. 삭제된 모임은 어느 목록에도 나오지 않고, 그 모임의 대화방도 채팅에서 보이지 않는다. 신청 대기자가 있어도 삭제할 수 있다.

### 응답 `data`

`null`이다. 프론트엔드는 내 모임으로 간다.

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
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 이미 삭제된 모임 |
| `409` | `MEETUP_DELETE_NOT_ALLOWED` | 시작한 모임이거나, 참여 확정자가 있어 취소해야 하는 모임 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## PUT /api/v1/meetups/{meetupId}/like

모임을 찜한다. 모임 상세의 하트와, 찜한 모임에서 찜을 푼 뒤의 "되돌리기"가 부른다.

- 로그인: 필요
- 명세: 상세 2, 찜한 모임 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
PUT /api/v1/meetups/19/like
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾는다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. `meetup_like`에 한 줄을 만든다. `vacancy_alert`는 `false`다. 이미 찜한 모임이면 바꾸지 않고 성공으로 답한다.

알림은 만들지 않는다. 내가 주최한 모임, 지난 모임, 취소된 모임도 찜할 수 있다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `true` | 계산: `meetup_like`에 내 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |

## DELETE /api/v1/meetups/{meetupId}/like

찜을 푼다. 모임 상세의 하트와 찜한 모임의 하트가 부른다.

- 로그인: 필요
- 명세: 상세 2, 찜한 모임 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
DELETE /api/v1/meetups/19/like
```

### 서버가 하는 일

1. `meetup_like`에서 내 줄을 지운다. 찜하지 않은 모임이면 바꾸지 않고 성공으로 답한다.

줄을 지우므로 빈자리 알림 설정도 함께 사라진다. "되돌리기"로 다시 찜하면 빈자리 알림은 꺼진 채다. 풀기 전에 빈자리 알림이 켜져 있었으면, 프론트엔드가 되돌릴 때 찜에 이어 [빈자리 알림 켜기](#put-apiv1meetupsmeetupidvacancy-alert)를 부른다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `false` | 계산: `meetup_like`에 내 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": false },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PUT /api/v1/meetups/{meetupId}/vacancy-alert

빈자리 알림을 켠다. 찜한 모임의 "빈자리 알림 받기"가 부른다. 찜한 모임에만 켤 수 있다.

- 로그인: 필요
- 명세: 찜한 모임 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
PUT /api/v1/meetups/23/vacancy-alert
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾는다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. `meetup_like`에 내 줄이 없으면 `409`와 `MEETUP_NOT_LIKED`.
3. 내 `meetup_like.vacancy_alert`를 `true`로 바꾼다.

모집 완료인 모임에만 버튼을 보여 주는 것은 프론트엔드가 한다. 서버는 모집 상태를 보지 않는다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `hasVacancyAlert` | 참/거짓 | 항상 `true` | `meetup_like.vacancy_alert` |

### 응답 예시

```json
{
  "success": true,
  "data": { "hasVacancyAlert": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `409` | `MEETUP_NOT_LIKED` | 찜하지 않은 모임 |

## DELETE /api/v1/meetups/{meetupId}/vacancy-alert

빈자리 알림을 끈다. 찜한 모임의 "빈자리 알림 받기"를 다시 누를 때 부른다.

- 로그인: 필요
- 명세: 찜한 모임 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
DELETE /api/v1/meetups/23/vacancy-alert
```

### 서버가 하는 일

1. 내 `meetup_like.vacancy_alert`를 `false`로 바꾼다. 찜하지 않은 모임이면 바꾸지 않고 성공으로 답한다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `hasVacancyAlert` | 참/거짓 | 항상 `false` | `meetup_like.vacancy_alert` |

### 응답 예시

```json
{
  "success": true,
  "data": { "hasVacancyAlert": false },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/meetups/{meetupId}/applications

모임에 참여를 신청한다. 모임 상세의 "참여 신청하기"가 부른다. 신청은 주최자가 수락해야 참여 확정이 된다.

- 로그인: 필요
- 명세: 상세 5 · 6, 상태: 미신청 3 · 4, 참여 신청 완료 토스트 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |
| 본문 | `message` | 문자열 | | 주최자에게 남길 말. 100자 이하. 보내지 않거나 `null`이나 빈 문자열이면 남기지 않는다 |

```text
POST /api/v1/meetups/19/applications
```

```json
{ "message": "러닝은 처음인데 같이 뛰어도 될까요?" }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 어긋나면 `400`과 `INVALID_INPUT`.
2. `meetup`에서 그 모임을 찾고 그 줄을 잠근다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
3. 내가 주최자면 `403`과 `OWN_MEETUP_NOT_ALLOWED`.
4. 내 신청 줄을 본다. `PENDING`이나 `CONFIRMED`면 `409`와 `MEETUP_ALREADY_APPLIED`. `REJECTED`, `CANCELED`, `KICKED`, `MEETUP_CANCELED`면 `409`와 `MEETUP_REAPPLY_NOT_ALLOWED`.
5. [모집 상태](#모집-상태)가 `OPEN`이 아니면 `409`와 `MEETUP_NOT_RECRUITING`.
6. 내 신청 줄이 없으면 `meetup_application`에 `status`가 `PENDING`인 줄을 만든다. `WITHDRAWN`인 줄이 있으면 그 줄을 `PENDING`으로 되돌린다. 두 경우 모두 `message`를 새로 넣고 `status_changed_at`을 지금 시각으로 채운다.
7. 주최자에게 참여 신청 알림을 만든다.

- 남길 말을 받지 않는 모임(`meetup.accepts_message`가 `false`)에 `message`를 보내면 버리고 `NULL`로 저장한다.
- 정원이 차 있는 동안에는 새 신청을 받지 않는다. 이미 기다리던 신청은 정원이 차도 그대로 남는다.

### 응답 `data`

성공하면 `201`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `meetupApplicationId` | 숫자 | 신청의 id | `meetup_application.id` |

프론트엔드는 완료 토스트를 띄우고 행동 카드를 신청 대기로 바꾼다.

### 응답 예시

```json
{
  "success": true,
  "data": { "meetupApplicationId": 88 },
  "error": null
}
```

화면을 열어 둔 사이에 정원이 찼을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_NOT_RECRUITING",
    "message": "지금은 신청을 받지 않는 모임입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `403` | `OWN_MEETUP_NOT_ALLOWED` | 내가 주최한 모임에 신청함 |
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `409` | `MEETUP_ALREADY_APPLIED` | 이미 신청해 기다리는 중이거나 참여가 확정됨 |
| `409` | `MEETUP_REAPPLY_NOT_ALLOWED` | 미승인됐거나, 참여를 취소했거나, 내보내졌거나, 신청 대기 중에 모임이 취소됨 |
| `409` | `MEETUP_NOT_RECRUITING` | 정원이 찼거나, 모집 마감이 지났거나, 시작했거나, 취소된 모임 |

## GET /api/v1/meetups/{meetupId}/applications

주최자에게 신청 관리 화면의 값을 준다. 신청자와 참여 확정자가 한 목록에 온다. 신청 관리를 열 때와 수락 · 거절 · 내보내기를 한 뒤에 부른다.

- 로그인: 필요
- 명세: 신청 관리 1 ~ 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
GET /api/v1/meetups/19/applications
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `meetupId` | 숫자 | 모임의 id | `meetup.id` |
| `title` | 문자열 | 모임 이름 | `meetup.title` |
| `capacity` | 숫자 | 정원. 주최자 포함 | `meetup.capacity` |
| `confirmedCount` | 숫자 | 확정 인원. 주최자 포함 | 계산: [정원과 확정 인원](#정원과-확정-인원) |
| `pendingCount` | 숫자 | 대기 인원 | 계산: `items` 가운데 `status`가 `PENDING`인 수 |
| `canManage` | 참/거짓 | 지금 수락, 거절, 내보내기를 할 수 있는 모임인지 | 계산: 취소된 모임이 아니고 시작 전인지 |
| `items` | 목록 | 신청자와 참여 확정자 | |
| `items[].id` | 숫자 | 신청의 id. 수락, 거절, 내보내기에 쓴다 | `meetup_application.id` |
| `items[].status` | enum | `PENDING`(신청 대기), `CONFIRMED`(참여 확정) 가운데 하나 | `meetup_application.status` |
| `items[].user` | 객체 | 그 사람의 [사용자 표시](00-common.md#사용자-표시) | |
| `items[].sharedInterestCount` | 숫자 | 그 사람과 내가 함께 고른 관심사의 수 | 계산: 두 사람의 `user_interest`에서 같은 `interest_id`의 수 |
| `items[].message` | 문자열 | 신청하며 남긴 말. 없으면 `null` | `meetup_application.message` |

### 주는 방식

- 그 모임의 주최자에게만 준다.
- `status`가 `PENDING`이나 `CONFIRMED`인 신청만 준다. 주최자 자신은 담지 않는다.
- `PENDING`을 앞에, `CONFIRMED`를 뒤에 준다. 각각 그 상태가 된 순서(`meetup_application.status_changed_at`이 이른 것부터)다.
- 나누지 않고 한 번에 모두 준다.
- 확정 인원이 정원과 같으면 프론트엔드가 수락을 끈다. `canManage`가 `false`면 수락, 거절, 내보내기를 모두 끈다.
- 취소된 모임과 지난 모임도 준다. 그때는 참여 확정자만 남는다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "meetupId": 19,
    "title": "토요일 한강 러닝",
    "capacity": 6,
    "confirmedCount": 3,
    "pendingCount": 1,
    "canManage": true,
    "items": [
      {
        "id": 88,
        "status": "PENDING",
        "user": {
          "id": 57,
          "nickname": "밤고구마",
          "profileImageUrl": null,
          "mole": { "head": "BEANIE_BLUE", "face": null, "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 15,
          "floor": 2,
          "isWithdrawn": false
        },
        "sharedInterestCount": 2,
        "message": "러닝은 처음인데 같이 뛰어도 될까요?"
      },
      {
        "id": 71,
        "status": "CONFIRMED",
        "user": {
          "id": 12,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "sharedInterestCount": 1,
        "message": null
      },
      {
        "id": 76,
        "status": "CONFIRMED",
        "user": {
          "id": 44,
          "nickname": "모카",
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": null, "hand": "COFFEE_CUP" },
          "campusName": "대전",
          "generation": 15,
          "floor": 1,
          "isWithdrawn": false
        },
        "sharedInterestCount": 0,
        "message": "주말 아침 러닝 좋아요!"
      }
    ]
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## POST /api/v1/meetups/{meetupId}/withdraw-application

내 신청을 취소한다. 모임 상세(신청 대기)와 내 모임의 "신청 취소"가 확인을 거친 뒤 부른다. 취소한 뒤에는 미신청으로 돌아가고 다시 신청할 수 있다.

- 로그인: 필요
- 명세: 상태: 신청 대기 3, 내 모임 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
POST /api/v1/meetups/19/withdraw-application
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾는다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. 내 신청 줄을 잠그고 본다. `WITHDRAWN`이면 바꾸지 않고 성공으로 답한다. `CONFIRMED`면 `409`와 `MEETUP_APPLICATION_ALREADY_CONFIRMED`. 줄이 없거나 그 밖의 상태면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
3. `status`를 `WITHDRAWN`으로 바꾸고 `status_changed_at`을 채운다.

알림은 만들지 않는다. 주최자의 신청 관리에서 이 신청이 사라진다.

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

신청 취소를 누르기 직전에 주최자가 수락했을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_APPLICATION_ALREADY_CONFIRMED",
    "message": "이미 참여가 확정된 신청입니다.",
    "fields": null,
    "detail": null
  }
}
```

프론트엔드는 모임 상세를 다시 조회해 참여 확정 카드를 보여 준다. 그래도 빠지려면 참여 취소를 쓴다.

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `404` | `MEETUP_APPLICATION_NOT_FOUND` | 신청한 적이 없거나, 이미 미승인됐거나, 모임이 취소돼 마감된 신청 |
| `409` | `MEETUP_APPLICATION_ALREADY_CONFIRMED` | 이미 수락돼 참여가 확정됨 |

## POST /api/v1/meetups/{meetupId}/cancel-participation

확정된 내 참여를 취소한다. 모임 상세(참여 확정)의 "참여 취소"와 채팅 모임 정보 팝업의 "모임 나가기"가 확인을 거친 뒤 부른다. 시작 24시간 전까지만 할 수 있고, 취소하면 모임 대화방에서도 빠진다.

- 로그인: 필요
- 명세: 상태: 참여 확정 3, [06 채팅](../spec/06-chat.md) 모임 정보 팝업 4 · 모임 나가기 확인 팝업 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupId` | 숫자 | ✓ | 모임의 id |

```text
POST /api/v1/meetups/19/cancel-participation
```

### 서버가 하는 일

1. `meetup`에서 그 모임을 찾고 그 줄을 잠근다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
2. 내 신청 줄을 본다. `CANCELED`면 바꾸지 않고 성공으로 답한다. `CONFIRMED`가 아니면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`. 주최자는 신청 줄이 없으므로 여기에 든다.
3. 취소된 모임이거나 시작 24시간 전이 지났으면 `409`와 `MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED`.
4. `status`를 `CANCELED`로 바꾸고 `status_changed_at`을 채운다.
5. 모임 대화방에서 내 `chat_room_member.left_at`을 지금 시각으로 채운다.
6. `chat_message`에 `type`이 `LEFT`이고 `sender_id`가 나인 안내 메시지를 넣는다. 대화방에 남은 사람들에게 채팅의 실시간 소식으로 간다.
7. 주최자에게 참여 취소 알림을 만든다.
8. 정원이 차 있던 모임이고 모집 마감 전이면, 빈자리 알림을 켠 사람에게 빈자리 알림을 만든다.

4 ~ 6은 한 번에 처리한다([DB 설계](../db/chat.md)). 취소한 뒤에는 같은 모임에 다시 신청할 수 없다.

### 응답 `data`

`null`이다. 채팅에서 불렀으면 프론트엔드가 대화 목록에서 그 대화방을 빼고 대화 선택 전 화면으로 간다. 모임 상세에서 불렀으면 상세를 다시 조회한다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

시작까지 24시간이 남지 않았을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED",
    "message": "시작 24시간 전부터는 참여를 취소할 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 없는 모임이거나 삭제된 모임 |
| `404` | `MEETUP_APPLICATION_NOT_FOUND` | 참여가 확정된 신청이 없음. 주최자가 불러도 여기에 든다 |
| `409` | `MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED` | 취소된 모임이거나 시작 24시간 전이 지남 |

취소됐거나 끝난 모임의 대화방에서만 나가는 일은 채팅의 [나가기](06-chat.md#post-apiv1chat-roomschatroomidleave)가 한다. 채팅 화면은 대화방 조회의 `leaveType`으로 어느 쪽을 부를지 정한다. 화면을 열어 둔 사이에 모임이 취소돼 이 API가 `409`로 답하면, 대화방을 다시 조회해 버튼을 맞춘다.

## POST /api/v1/meetup-applications/{meetupApplicationId}/accept

신청을 수락한다. 신청 관리의 "수락"이 부른다. 수락하면 그 사람의 참여가 확정되고 모임 대화방에 들어온다.

- 로그인: 필요
- 명세: 신청 관리 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupApplicationId` | 숫자 | ✓ | 신청의 id. 신청 관리 목록의 `items[].id` |

```text
POST /api/v1/meetup-applications/88/accept
```

### 서버가 하는 일

1. `meetup_application`에서 그 신청을 찾는다. 없거나 그 모임이 삭제됐으면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
2. 내가 그 모임의 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 모임 줄을 잠그고 신청을 다시 읽는다. `CONFIRMED`면 바꾸지 않고 성공으로 답한다. `PENDING`이 아니면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
4. 확정 인원이 정원과 같으면 `409`와 `MEETUP_FULL`.
5. `status`를 `CONFIRMED`로 바꾸고 `status_changed_at`을 채운다.
6. 모임 대화방의 `chat_room_member`에 그 사람을 넣는다.
7. `chat_message`에 `type`이 `JOINED`이고 `sender_id`가 그 사람인 안내 메시지를 넣는다. 대화방에 있는 사람들에게 채팅의 실시간 소식으로 간다.
8. 신청자에게 수락 알림을 만든다.

5 ~ 7은 한 번에 처리한다. 이 수락으로 정원이 차면 모집 상태가 `CLOSED`가 되고, 남은 신청은 그대로 기다린다.

### 응답 `data`

`null`이다. 프론트엔드는 신청 관리 목록을 다시 받는다.

### 응답 예시

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

정원이 찼을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_FULL",
    "message": "정원이 차서 수락할 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_APPLICATION_NOT_FOUND` | 없는 신청이거나, 신청자가 취소했거나, 이미 미승인됐거나, 모집 마감이 지났거나, 모임이 취소됨 |
| `409` | `MEETUP_FULL` | 확정 인원이 정원과 같음 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## POST /api/v1/meetup-applications/{meetupApplicationId}/reject

신청을 거절한다. 거절 확인 팝업의 "거절"이 부른다. 거절된 사람은 같은 모임에 다시 신청할 수 없다.

- 로그인: 필요
- 명세: 신청 관리 3, 거절 확인 팝업 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupApplicationId` | 숫자 | ✓ | 신청의 id |

```text
POST /api/v1/meetup-applications/88/reject
```

### 서버가 하는 일

1. `meetup_application`에서 그 신청을 찾는다. 없거나 그 모임이 삭제됐으면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
2. 내가 그 모임의 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 신청 줄을 잠그고 다시 읽는다. `REJECTED`면 바꾸지 않고 성공으로 답한다. `PENDING`이 아니면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
4. `status`를 `REJECTED`로 바꾸고 `status_changed_at`을 채운다.
5. 신청자에게 미승인 알림을 만든다.

### 응답 `data`

`null`이다. 프론트엔드는 신청 관리 목록을 다시 받는다.

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
| `404` | `MEETUP_APPLICATION_NOT_FOUND` | 없는 신청이거나, 신청자가 취소했거나, 이미 수락했거나, 모임이 취소됨 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## POST /api/v1/meetup-applications/{meetupApplicationId}/kick

참여 확정자를 내보낸다. 내보내기 확인 팝업의 "내보내기"가 부른다. 내보낸 사람은 모임 대화방에서도 빠지고 같은 모임에 다시 신청할 수 없다.

- 로그인: 필요
- 명세: 신청 관리 4, 내보내기 확인 팝업 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `meetupApplicationId` | 숫자 | ✓ | 신청의 id |

```text
POST /api/v1/meetup-applications/76/kick
```

### 서버가 하는 일

1. `meetup_application`에서 그 신청을 찾는다. 없거나 그 모임이 삭제됐으면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
2. 내가 그 모임의 주최자가 아니면 `403`과 `FORBIDDEN`.
3. 모임 줄을 잠그고 신청을 다시 읽는다. `KICKED`면 바꾸지 않고 성공으로 답한다. `CONFIRMED`가 아니면 `404`와 `MEETUP_APPLICATION_NOT_FOUND`.
4. 취소된 모임이거나 시작한 모임이면 `409`와 `MEETUP_KICK_NOT_ALLOWED`.
5. `status`를 `KICKED`로 바꾸고 `status_changed_at`을 채운다.
6. 모임 대화방에서 그 사람의 `chat_room_member.left_at`을 지금 시각으로 채운다.
7. `chat_message`에 `type`이 `LEFT`이고 `sender_id`가 그 사람인 안내 메시지를 넣는다. 대화방에 남은 사람들에게 채팅의 실시간 소식으로 간다.
8. 그 사람에게 내보내짐 알림을 만든다.
9. 정원이 차 있던 모임이고 모집 마감 전이면, 빈자리 알림을 켠 사람에게 빈자리 알림을 만든다.

5 ~ 7은 한 번에 처리한다.

### 응답 `data`

`null`이다. 프론트엔드는 신청 관리 목록을 다시 받는다.

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
| `404` | `MEETUP_APPLICATION_NOT_FOUND` | 없는 신청이거나 참여가 확정된 신청이 아님. 스스로 참여를 취소한 사람도 여기에 든다 |
| `409` | `MEETUP_KICK_NOT_ALLOWED` | 취소된 모임이거나 시작한 모임 |

주최자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## GET /api/v1/me/meetups

내 모임을 탭 하나만큼 준다. 내 모임에 들어올 때와 탭을 바꿀 때 부른다.

- 로그인: 필요
- 명세: 내 모임 2 ~ 5, 찜한 모임 1 · 2 · 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `tab` | enum | ✓ | `UPCOMING`(다가오는 모임), `PENDING`(신청 대기), `HOSTING`(내가 연 모임), `LIKED`(찜한 모임), `PAST`(지난 모임) 가운데 하나 |

```text
GET /api/v1/me/meetups?tab=UPCOMING
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 그 탭의 모임. [모임 카드](#모임-카드)의 값에 아래 값을 더한 것이다 | |
| `items[].myStatus` | enum | `HOST`, `NONE`, `PENDING`, `REJECTED`, `CONFIRMED`, `CANCELED`, `KICKED`, `MEETUP_CANCELED` 가운데 하나 | 계산: [내 상태](#내-상태) |
| `items[].isLiked` | 참/거짓 | 내가 찜했는지 | 계산: `meetup_like`에 내 줄이 있는지 |
| `items[].hasVacancyAlert` | 참/거짓 | 빈자리 알림을 켰는지. 찜하지 않았으면 `false` | 계산: 내 `meetup_like.vacancy_alert`. 줄이 없으면 `false` |
| `items[].pendingCount` | 숫자 | 내가 처리할 신청 수. 내가 주최자가 아니면 0 | 계산: 그 모임의 `PENDING` 신청 수 |
| `items[].canEdit` | 참/거짓 | 지금 모임 정보를 고칠 수 있는지 | 계산: 모임 상세의 `canEdit`과 같다 |
| `items[].chatRoomId` | 숫자 | 모임 대화방의 id. 내가 그 대화방에 들어가 있을 때만 준다. 아니면 `null` | `chat_room.id`. 내 `chat_room_member.left_at`이 비어 있을 때 |
| `items[].unreadCount` | 숫자 | 그 대화방에서 내가 안 읽은 메시지 수. `chatRoomId`가 `null`이면 0 | 계산: 채팅의 [안 읽은 수](06-chat.md#안-읽은-수)와 같다 |

### 주는 방식

탭마다 들어가는 모임과 순서는 아래와 같다. 삭제된 모임은 어느 탭에도 없다.

| `tab` | 들어가는 모임 | 순서 |
|---|---|---|
| `UPCOMING` | 시작하지 않았고 취소되지 않은 모임 가운데 `myStatus`가 `HOST`나 `CONFIRMED`인 것 | 시작이 가까운 것부터 |
| `PENDING` | 시작하지 않았고 취소되지 않은 모임 가운데 `myStatus`가 `PENDING`이나 `REJECTED`인 것 | 시작이 가까운 것부터 |
| `HOSTING` | 시작하지 않았고 취소되지 않은 모임 가운데 `myStatus`가 `HOST`인 것 | 시작이 가까운 것부터 |
| `LIKED` | 시작하지 않았고 취소되지 않은 모임 가운데 내가 찜한 것 | `CLOSED`를 뒤에 두고, 시작이 가까운 것부터 |
| `PAST` | 시작했거나 취소된 모임 가운데 `myStatus`가 `HOST`나 `CONFIRMED`인 것 | 시작이 최근인 것부터 |

- 나누지 않고 한 번에 모두 준다.
- `REJECTED`(미승인)인 모임은 신청 대기 탭에 남아 프론트엔드가 "승인되지 않음"으로 보여 준다. 모임이 시작하면 빠진다.
- 취소된 모임은 지난 모임 탭에 `recruitStatus`가 `CANCELED`인 채로 남는다. 신청 대기 중에 취소된 모임(`MEETUP_CANCELED`)은 어느 탭에도 없다.
- 지난 모임과 취소된 모임은 찜했더라도 찜한 모임 탭에 없다. 찜은 지우지 않는다.
- 버튼은 `myStatus`로 정한다. `PENDING`이면 신청 취소, `CONFIRMED`면 모임 채팅, `HOST`면 신청 관리(`pendingCount`를 함께 보여 준다)와 모임 수정(`canEdit`이 `false`면 끈다)이다.
- "확인 필요" 한 줄은 프론트엔드가 `pendingCount`(새 참여 신청), `unreadCount`(새 메시지), `myStatus`의 `PENDING`(주최자 확인 대기)으로 만든다.
- 다음 모임 카드는 `tab=UPCOMING`의 첫 모임이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 23,
        "title": "퇴근길 러닝 크루",
        "category": "EXERCISE",
        "startsAt": "2026-11-25T10:00:00Z",
        "endsAt": null,
        "mode": "OFFLINE",
        "place": "역삼역 3번 출구",
        "capacity": 4,
        "confirmedCount": 4,
        "recruitStatus": "CLOSED",
        "myStatus": "CONFIRMED",
        "isLiked": true,
        "hasVacancyAlert": false,
        "pendingCount": 0,
        "canEdit": false,
        "chatRoomId": 25,
        "unreadCount": 3
      },
      {
        "id": 19,
        "title": "토요일 한강 러닝",
        "category": "EXERCISE",
        "startsAt": "2026-11-27T22:00:00Z",
        "endsAt": "2026-11-28T00:00:00Z",
        "mode": "OFFLINE",
        "place": "여의나루역 2번 출구",
        "capacity": 6,
        "confirmedCount": 3,
        "recruitStatus": "OPEN",
        "myStatus": "HOST",
        "isLiked": false,
        "hasVacancyAlert": false,
        "pendingCount": 1,
        "canEdit": true,
        "chatRoomId": 21,
        "unreadCount": 0
      }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다. `tab`이 없거나 정해진 값이 아니면 `400`과 `INVALID_INPUT`이다.

## GET /api/v1/me/meetups/summary

내 모임의 탭별 개수와, 가장 가까운 내 모임 몇 개를 준다. 모임 리스트에 들어올 때(내 모임 위젯, 다가오는 일정)와 내 모임에 들어올 때(탭 옆 숫자) 부른다.

- 로그인: 필요
- 명세: 리스트 7 · 8, 내 모임 2, 찜한 모임 1

### 요청

없다.

```text
GET /api/v1/me/meetups/summary
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `counts` | 객체 | 내 모임의 탭마다의 모임 수 | |
| `counts.upcoming` | 숫자 | 다가오는 모임의 수 | 계산: [`GET /api/v1/me/meetups`](#get-apiv1memeetups)의 `tab=UPCOMING`에 드는 모임 수 |
| `counts.pending` | 숫자 | 신청 대기의 수. 미승인된 것도 센다 | 계산: `tab=PENDING`에 드는 모임 수 |
| `counts.hosting` | 숫자 | 내가 연 모임의 수 | 계산: `tab=HOSTING`에 드는 모임 수 |
| `counts.liked` | 숫자 | 찜한 모임의 수 | 계산: `tab=LIKED`에 드는 모임 수 |
| `counts.past` | 숫자 | 지난 모임의 수 | 계산: `tab=PAST`에 드는 모임 수 |
| `upcomingItems` | 목록 | 가까운 내 모임. [모임 카드](#모임-카드)의 값에 아래 값을 더한 것이다 | |
| `upcomingItems[].myStatus` | enum | `HOST`(내가 주최), `CONFIRMED`(참여 확정), `PENDING`(신청 대기) 가운데 하나 | 계산: [내 상태](#내-상태) |

### 주는 방식

- `upcomingItems`는 시작하지 않았고 취소되지 않은 모임 가운데 `myStatus`가 `HOST`, `CONFIRMED`, `PENDING`인 것이다. 시작이 가까운 것부터 5개까지 준다.
- 모임 리스트의 내 모임 위젯과 다가오는 일정이 `upcomingItems`를 함께 쓴다. 위젯의 상태 배지는 `myStatus`로 그린다.
- 한 모임이 여러 탭에 들 수 있다. 내가 연 예정 모임은 `upcoming`과 `hosting`에 모두 세어진다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "counts": { "upcoming": 2, "pending": 1, "hosting": 1, "liked": 3, "past": 4 },
    "upcomingItems": [
      {
        "id": 23,
        "title": "퇴근길 러닝 크루",
        "category": "EXERCISE",
        "startsAt": "2026-11-25T10:00:00Z",
        "endsAt": null,
        "mode": "OFFLINE",
        "place": "역삼역 3번 출구",
        "capacity": 4,
        "confirmedCount": 4,
        "recruitStatus": "CLOSED",
        "myStatus": "CONFIRMED"
      },
      {
        "id": 19,
        "title": "토요일 한강 러닝",
        "category": "EXERCISE",
        "startsAt": "2026-11-27T22:00:00Z",
        "endsAt": "2026-11-28T00:00:00Z",
        "mode": "OFFLINE",
        "place": "여의나루역 2번 출구",
        "capacity": 6,
        "confirmedCount": 3,
        "recruitStatus": "OPEN",
        "myStatus": "HOST"
      },
      {
        "id": 31,
        "title": "알고리즘 스터디 모집",
        "category": "STUDY",
        "startsAt": "2026-12-01T10:00:00Z",
        "endsAt": "2026-12-01T12:00:00Z",
        "mode": "ONLINE",
        "place": null,
        "capacity": 8,
        "confirmedCount": 5,
        "recruitStatus": "OPEN",
        "myStatus": "PENDING"
      }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/meetup-calendar

한 달 동안의 모임을 준다. 캘린더 팝업을 열 때, 달을 넘길 때, 보기를 바꿀 때 부른다. 내 모임의 미니 캘린더도 이 API를 쓴다.

- 로그인: 필요
- 명세: 캘린더 팝업 1 ~ 5, 내 모임 · 캘린더 팝업 1, 내 모임 7

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `year` | 숫자 | ✓ | 연도 |
| 쿼리 | `month` | 숫자 | ✓ | 달. 1 ~ 12 |
| 쿼리 | `scope` | enum | | `MINE`(내 모임), `ALL`(전체 모임) 가운데 하나. 보내지 않으면 `MINE` |

```text
GET /api/v1/meetup-calendar?year=2026&month=11&scope=MINE
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `year` | 숫자 | 연도 | 계산: 요청의 `year` |
| `month` | 숫자 | 달 | 계산: 요청의 `month` |
| `summary` | 객체 | 이번 달 요약. `scope`와 상관없이 내 모임을 센다 | |
| `summary.confirmed` | 숫자 | 그 달의 모임 가운데 내 참여가 확정된 것의 수 | 계산: 그 달의 모임 가운데 `myStatus`가 `CONFIRMED`인 수 |
| `summary.pending` | 숫자 | 그 달의 모임 가운데 내가 신청해 기다리는 것의 수 | 계산: 그 달의 모임 가운데 `myStatus`가 `PENDING`인 수 |
| `summary.hosting` | 숫자 | 그 달의 모임 가운데 내가 연 것의 수 | 계산: 그 달의 모임 가운데 `myStatus`가 `HOST`인 수 |
| `items` | 목록 | 그 달의 모임. [모임 카드](#모임-카드)의 값에 아래 값을 더한 것이다 | |
| `items[].myStatus` | enum | `HOST`, `NONE`, `PENDING`, `REJECTED`, `CONFIRMED`, `CANCELED`, `KICKED`, `MEETUP_CANCELED` 가운데 하나 | 계산: [내 상태](#내-상태) |
| `items[].chatRoomId` | 숫자 | 모임 대화방의 id. 내가 그 대화방에 들어가 있을 때만 준다. 아니면 `null` | `chat_room.id`. 내 `chat_room_member.left_at`이 비어 있을 때 |

### 주는 방식

- 한국 시간으로 그 달에 시작하는 모임을 준다([날짜와 시간대](#날짜와-시간대)).
- 삭제된 모임과 취소된 모임은 주지 않는다. 지난 모임은 준다. 그 달의 지나간 날을 눌러도 모임이 보인다.
- `scope`가 `MINE`이면 `myStatus`가 `HOST`, `CONFIRMED`, `PENDING`인 모임만 준다. `ALL`이면 모두 준다.
- 시작이 이른 것부터 준다. 나누지 않고 한 번에 모두 준다.
- 날짜별로 묶는 것, 고른 날의 모임만 보여 주는 것은 프론트엔드가 한다.
- "모임 채팅" 바로가기는 `chatRoomId`가 있을 때만 보여 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 11,
    "summary": { "confirmed": 1, "pending": 0, "hosting": 1 },
    "items": [
      {
        "id": 23,
        "title": "퇴근길 러닝 크루",
        "category": "EXERCISE",
        "startsAt": "2026-11-25T10:00:00Z",
        "endsAt": null,
        "mode": "OFFLINE",
        "place": "역삼역 3번 출구",
        "capacity": 4,
        "confirmedCount": 4,
        "recruitStatus": "CLOSED",
        "myStatus": "CONFIRMED",
        "chatRoomId": 25
      },
      {
        "id": 19,
        "title": "토요일 한강 러닝",
        "category": "EXERCISE",
        "startsAt": "2026-11-27T22:00:00Z",
        "endsAt": "2026-11-28T00:00:00Z",
        "mode": "OFFLINE",
        "place": "여의나루역 2번 출구",
        "capacity": 6,
        "confirmedCount": 3,
        "recruitStatus": "OPEN",
        "myStatus": "HOST",
        "chatRoomId": 21
      }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## 명세에 없어 이 문서에서 정한 것

- **신청자가 하는 일의 주소**: 신청 취소와 참여 취소는 모임의 id로 부른다(`withdraw-application`, `cancel-participation`). 주최자의 수락, 거절, 내보내기는 신청의 id로 부른다.
- **참여 취소가 하는 일**: 모임 API가 신청 상태를 바꾸면서 모임 대화방에서 빼고 안내 메시지를 넣는다. 채팅의 "모임 나가기"도 이 API를 부른다(06 채팅에서 넘어온 결정이다).
- **모임 대화 미리보기**: 모임 상세는 `chatRoomId`만 준다. 최근 메시지 3개는 프론트엔드가 채팅의 메시지 조회로 받는다.
- **내 상태와 버튼**: `myStatus` 여덟 값과 `recruitStatus` 네 값을 주고, 버튼을 켤지는 `canApply`, `canCancelParticipation`, `canEdit`, `canCancel`, `canDelete`로 준다.
- **카테고리**: 명세의 여섯 가지에 코드를 정했다. 목록을 주는 API는 두지 않았다.
- **모임 찾기**: 날짜 필터는 프론트엔드가 날짜 둘(`dateFrom`, `dateTo`)로 바꿔 보내고, 한국 시간의 날짜로 센다. 카테고리는 쉼표로 이어 보낸다. 순서가 같을 때는 시작이 이른 것을 먼저 준다.
- **내 모임**: 탭마다 한 번에 모두 준다. 취소된 모임은 지난 모임 탭에 둔다. 내가 연 모임 탭과 찜한 모임 탭에는 시작하지 않은 모임만 둔다. 탭 옆 숫자와 리스트 화면의 위젯은 `summary` 하나로 준다.
- **확인 필요 한 줄**: 서버는 처리할 신청 수, 안 읽은 메시지 수, 내 상태만 준다. 무엇을 한 줄로 보여 줄지는 프론트엔드가 정한다.
- **캘린더**: 한 달의 모임을 한 번에 준다. 지난 모임은 주고 취소된 모임은 주지 않는다. 이번 달 요약은 보기와 상관없이 내 모임을 센다.
- **모임 취소와 삭제**: API를 둘로 나눴다. 참여 확정자가 있으면 취소만, 없으면 삭제만 된다.
- **모임 수정**: 값을 모두 보낸다. 모집 마감 시각은 받지 않는다. 정원을 늘려 자리가 나면 빈자리 알림을 만든다.
- **글자 수**: 모임 이름 30자, 소개 1,000자, 준비물 100자, 장소 100자, 상세 주소 100자, 접속 링크 500자, 주최자에게 남길 말 100자다.
- **이미 처리된 신청**: 같은 버튼을 두 번 눌러도 성공으로 답한다. 사라진 신청은 `MEETUP_APPLICATION_NOT_FOUND` 하나로 답한다. 신청 취소를 눌렀는데 이미 수락됐으면 `MEETUP_APPLICATION_ALREADY_CONFIRMED`로 답한다.
- **모집 마감이 지난 신청**: 예약 작업이 아직 바꾸지 않았더라도 미승인으로 본다.
- **찜과 빈자리 알림**: `PUT`으로 켜고 `DELETE`로 끈다. 빈자리 알림은 찜한 모임에만 켤 수 있고, 찜을 풀면 함께 꺼진다. "되돌리기" 때 빈자리 알림을 다시 켜는 것은 프론트엔드가 한다.
- **신청 관리 목록**: 신청자와 참여 확정자를 한 목록에 `status`로 나눠 준다. 주최자는 목록에 담지 않는다.
- **남길 말을 받지 않는 모임**: 신청에 `message`가 와도 버린다.

## 구현 단계로 넘기는 것

- 모집 마감 때 대기 신청을 미승인으로 바꾸는 예약 작업의 실행 방법(DB 설계에서도 넘겼다)
- 검색어를 찾는 방법의 세부(띄어쓰기, 여러 낱말)
- 장소의 주소 찾기에 쓸 서비스
- 모임 만들기와 참여 신청을 짧은 시간에 너무 많이 하는 것을 막는 기준
