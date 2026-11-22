# 탐색 · 방문 API

들판을 돌아다니며 남의 땅굴을 찾고, 놀러 가서 방노트와 방명록을 보고, 단골로 담고, 대화 요청을 보내는 일을 다룬다. 새 학기의 캠퍼스-층 고르기와 오늘의 추천 친구도 여기에 있다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [05 탐색 · 방문](../spec/05-explore-visit.md)
- DB 설계: [들판 · 땅굴](../db/burrow.md), [계정 · 프로필 · 관심사 · 질문](../db/account.md), [채팅](../db/chat.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다. "새 학기를 고르기 전에도"라고 적힌 것만 예외다([새 학기를 고르지 않은 계정](#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/terms/{termId}/fields` | 그 학기의 들판마다 비어 있는지를 준다 | 필요 | 캠퍼스-층 고르기 4 |
| `GET` | `/api/v1/terms/{termId}/fields/{campusFloorId}` | 들판 하나에 놓인 땅굴 입구를 준다 | 필요 | 탐색 1 ~ 3, 6 |
| `POST` | `/api/v1/me/burrow/move` | 내 땅굴을 이번 학기의 고른 층으로 이사한다 | 필요(새 학기를 고르기 전에도) | 새 학기 안내 3 |
| `GET` | `/api/v1/me/regular-burrows` | 내 단골 땅굴 목록을 준다 | 필요 | 단골 땅굴 목록 1 |
| `PUT` | `/api/v1/burrows/{burrowId}/regular` | 땅굴을 단골로 담는다 | 필요 | 방문자 뷰 2 |
| `DELETE` | `/api/v1/burrows/{burrowId}/regular` | 단골에서 뺀다 | 필요 | 방문자 뷰 2, 단골 땅굴 목록 3 |
| `GET` | `/api/v1/me/daily-recommendation` | 오늘의 추천을 받았는지와 받은 결과를 준다 | 필요 | 탐색 5, 추천 결과 1 · 4, 답변 보기 1 |
| `POST` | `/api/v1/me/daily-recommendation` | 오늘의 추천을 받는다 | 필요 | 추천 받기 전 2 · 4 |
| `GET` | `/api/v1/users/{userId}/burrow` | 남의 땅굴과 방노트의 값을 준다 | 필요 | 방문자 뷰 1 ~ 6, 방노트 1 ~ 4 |
| `POST` | `/api/v1/burrows/{burrowId}/guestbook-entries` | 방명록 글을 쓴다 | 필요 | 방문자 뷰 · 방명록 1 |
| `POST` | `/api/v1/chat-requests` | 대화 요청을 보낸다 | 필요 | 대화 요청 팝업 1 ~ 3, 방문자 뷰 4 |

방명록 글의 목록과 삭제는 [내 땅굴 API](04-my-burrow.md#get-apiv1burrowsburrowidguestbook-entries)의 것을 방문자도 함께 쓴다. 보낸 대화 요청을 수락, 거절, 취소하는 API는 [채팅 API](06-chat.md)에서 다룬다.

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 새 학기 안내 | 뜰 때 | [`GET /api/v1/terms`](00-common.md#get-apiv1terms), [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses) | 새 학기 이름의 표기, 지난 학기에 고른 캠퍼스를 처음에 골라 두기(내 계정 조회의 `campusFloorId`로 찾는다) |
| 새 학기 안내 | "이 층으로 정하기" | `POST /api/v1/me/burrow/move` | 완료 토스트 |
| 탐색 | 들어올 때, 들판을 옮길 때 | `GET /api/v1/terms/{termId}/fields/{campusFloorId}` | 들판 지도와 자리 번호마다의 화면 위치, 두더지 움직임, 안내판과 가까운 주인 카드를 띄우는 때, 나와 같은 관심사 수, 빈 상태 |
| 탐색 | 들어올 때 | `GET /api/v1/me/daily-recommendation` | 추천 친구 버튼의 빨간 점 |
| 캠퍼스-층 고르기 | 열 때 | [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses), [`GET /api/v1/terms`](00-common.md#get-apiv1terms) | 층 번호 검색, "현재 위치" 배지, 학기가 하나면 학기 줄 숨기기 |
| 캠퍼스-층 고르기 | 열 때, 학기를 바꿀 때 | `GET /api/v1/terms/{termId}/fields` | "비어 있음" 표시 |
| 단골 땅굴 목록 | 열 때 | `GET /api/v1/me/regular-burrows` | 빈 상태 |
| 단골 땅굴 목록 | "단골 해제" | `DELETE /api/v1/burrows/{burrowId}/regular` | 목록에서 빼기 |
| 추천 받기 전 | 열 때 | [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses), [`GET /api/v1/generations`](00-common.md#get-apiv1generations) | 안내 문구 |
| 추천 받기 전 | "추천 받기" | `POST /api/v1/me/daily-recommendation` | 추천 결과로 바꾸기 |
| 추천 결과 · 답변 보기 | 열 때 | 없음. 탐색에 들어올 때 받은 값이나 "추천 받기"의 응답을 쓴다 | 카드 뒤집기 |
| 방문자 뷰 · 방노트 | 열 때 | `GET /api/v1/users/{userId}/burrow` | 가구와 땅굴 무드, 겹치는 관심사 수, 가구의 체크 표시, 우체통의 깃발, 대화 버튼의 문구, 방노트 펼치기 |
| 방문자 뷰 | "단골 추가" | `PUT /api/v1/burrows/{burrowId}/regular`. 다시 누르면 `DELETE` | 버튼의 모습 |
| 대화 요청 팝업 | "요청 보내기" | `POST /api/v1/chat-requests` | 빠른 멘트, 완료 토스트. 대화방이 바로 열렸으면 그 대화방으로 가기 |
| 방문자 뷰 · 방명록 | 열 때, 페이지 번호를 누를 때 | [`GET /api/v1/burrows/{burrowId}/guestbook-entries`](04-my-burrow.md#get-apiv1burrowsburrowidguestbook-entries) | 시간 표기, 글이 없을 때의 문구 |
| 방문자 뷰 · 방명록 | "남기기" | `POST /api/v1/burrows/{burrowId}/guestbook-entries` | 목록 맨 위에 올리기 |
| 방문자 뷰 · 방명록 | "삭제" | [`DELETE /api/v1/guestbook-entries/{guestbookEntryId}`](04-my-burrow.md#delete-apiv1guestbook-entriesguestbookentryid) | 확인 문구 |

신고는 [`POST /api/v1/reports`](08-community.md#post-apiv1reports)를 부른다. 방노트의 신고 아이콘은 `targetType`을 `MEMBER`로, 방명록 글의 "신고"는 `GUESTBOOK`으로 보낸다.

## 영역 규칙

### 들판

- 들판 하나는 학기 하나와 캠퍼스-층 하나의 짝이다. DB에 들판 테이블은 없고([DB 설계](../db/burrow.md)), API는 `termId`와 `campusFloorId` 두 값으로 들판을 가리킨다.
- 땅굴은 한 들판에만 놓인다. 새 학기에 캠퍼스 · 층을 고르면 땅굴이 그 들판으로 이사하고 지난 학기 들판의 자리는 빈다. 지난 학기 들판에는 새 학기에 아직 접속하지 않은 사람의 땅굴만 남는다.
- 자리 번호(`slot`)가 화면의 어디인지는 주지 않는다. 프론트엔드가 번호마다의 위치를 갖는다.
- 땅굴 화면이 아닌 곳(채팅의 "땅굴 둘러보기")에서 탐색으로 갈 때는 내 땅굴의 들판으로 간다. 프론트엔드는 [`GET /api/v1/me/burrow`](04-my-burrow.md#get-apiv1meburrow)의 `entrance`로 들판을 정한다.
- 내 땅굴에서 "탐색"을 누르면 내 땅굴의 `entrance`가 가리키는 들판으로, 방문자 뷰에서 누르면 그 땅굴의 `entrance`가 가리키는 들판으로 간다.

### 새 학기를 고르지 않은 계정

새 학기 들판이 열리면 이번 학기의 캠퍼스 · 층을 반드시 골라야 한다([명세](../spec/05-explore-visit.md#땅굴-메인--새-학기-안내)). 서버는 고르지 않은 계정을 온보딩을 마치지 않은 계정과 같은 방식으로 막는다. 규칙은 [로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)에 있다.

- 온보딩을 마쳤고 내 땅굴의 입구가 이번 학기 들판에 있지 않은 계정은 [`GET /api/v1/me`](02-auth.md#get-apiv1me)의 `nextStep`이 `NEW_TERM`이다. 프론트엔드는 이 값을 보고 새 학기 안내를 띄운다.
- 이 계정이 이 문서에서 부를 수 있는 API는 `POST /api/v1/me/burrow/move` 하나다. 나머지는 `403`과 `NEW_TERM_INCOMPLETE`로 답한다.
- 안내에 필요한 값은 고르기 전에도 받을 수 있다. 새 학기의 이름은 [`GET /api/v1/terms`](00-common.md#get-apiv1terms), 캠퍼스와 층은 [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses), 지난 학기에 고른 캠퍼스-층은 내 계정 조회의 `campusFloorId`다.
- 안내 뒤의 화면은 값을 받지 못하므로 비어 있다. 고르면 프론트엔드가 그 화면을 다시 불러온다.

### 질문과 답변

들판의 입구, 추천 카드, 남의 땅굴이 주는 `answers`의 항목은 모두 이 모양이다. [내 땅굴 조회](04-my-burrow.md#get-apiv1meburrow)의 `answers`와 같다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `slot` | 숫자 | 보이는 자리. 1 ~ 3 | `user_answer.slot` |
| `introQuestionId` | 숫자 | 질문의 id | `user_answer.intro_question_id` |
| `question` | 문자열 | 질문 문구 | `intro_question.content` |
| `answer` | 문자열 | 답변. 10 ~ 50자 | `user_answer.answer` |

항상 3개이고 `slot`이 작은 것부터 준다.

### 대화 버튼의 상태

방문자 뷰의 주인 두더지 위 버튼은 [남의 땅굴 조회](#get-apiv1usersuseridburrow)의 `chat.status`로 정한다. enum이고 값은 넷이다.

| `chat.status` | 버튼 | 때 |
|---|---|---|
| `CHATTING` | "대화하기". 누르면 `chat.chatRoomId`의 대화방으로 간다 | 두 사람이 모두 나가지 않은 1:1 대화방이 있다 |
| `REQUEST_SENT` | "요청 보냄". 누를 수 없다 | 내가 보낸 살아 있는 요청이 있다 |
| `REQUEST_RECEIVED` | "대화 요청하기". 누르면 팝업 대신 "이미 나에게 요청한 사람입니다" 토스트를 띄운다 | 상대가 나에게 보낸 요청에 내가 아직 답하지 않았다(`PENDING`이고 5일이 지나지 않음) |
| `NONE` | "대화 요청하기". 누르면 대화 요청 팝업을 연다 | 위의 어느 것도 아니다 |

- 살아 있는 요청은 보낸 지 5일이 지나지 않았고 `chat_request.status`가 `PENDING`이거나 `REJECTED`인 요청이다([DB 설계](../db/chat.md)). 받은 사람이 거절해도 보낸 사람에게는 만료될 때까지 `REQUEST_SENT`다. 거절을 드러내지 않기 위해서다.
- 위에서부터 차례로 본다. 대화방이 있으면 요청이 남아 있어도 `CHATTING`이다.
- 내가 거절한 요청이 남아 있는 사람은 `NONE`으로 온다. 버튼을 누르면 대화 요청 팝업이 그대로 열린다. 그 사람에게 요청을 보내면 거절했던 요청을 수락한 것으로 처리해 바로 대화방이 열린다([대화 요청 보내기](#post-apiv1chat-requests)).
- 수락, 거절, 취소, 만료는 [채팅 API](06-chat.md#대화-요청의-상태)에서 다룬다.

### 내 땅굴에는 할 수 없는 일

내 땅굴을 단골로 담거나 내 땅굴의 방명록에 글을 쓰려 하면 `403`과 `OWN_BURROW_NOT_ALLOWED`로 답한다. 화면에는 그런 버튼이 없으므로 주소를 직접 부른 경우다.

## GET /api/v1/terms/{termId}/fields

한 학기의 들판마다 땅굴이 있는지를 준다. 캠퍼스-층 고르기가 열릴 때와 그 안에서 학기를 바꿀 때 부른다. 층 목록의 "비어 있음"을 이 값으로 그린다.

- 로그인: 필요
- 명세: 캠퍼스-층 고르기 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `termId` | 숫자 | ✓ | 학기의 id. [`GET /api/v1/terms`](00-common.md#get-apiv1terms)의 `items[].id` |

```text
GET /api/v1/terms/4/fields
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 그 학기의 들판. 캠퍼스-층마다 하나 | |
| `items[].campusFloorId` | 숫자 | 캠퍼스-층의 id | `campus_floor.id` |
| `items[].isEmpty` | 참/거짓 | 땅굴이 하나도 없는지 | 계산: `burrow_entrance`에서 그 학기 · 그 층인 줄이 하나도 없는지 |

### 주는 방식

- 지우지 않은 캠퍼스-층을 모두 준다. 입구가 하나도 없는 층도 `isEmpty`를 `true`로 해서 준다.
- 캠퍼스 이름과 층 번호는 담지 않는다. 프론트엔드가 [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses)의 목록과 `campusFloorId`로 맞춘다.
- 순서는 캠퍼스 목록과 같다. 캠퍼스는 `campus.sort_order`가 작은 것부터, 층은 층 번호가 작은 것부터다.
- 내 땅굴도 센다. 내 땅굴만 놓인 층은 `isEmpty`가 `false`다. 누가 부르든 같은 값이 온다.
- 땅굴이 몇 개인지는 주지 않는다. 명세가 개수를 보여 주지 않는다.
- 나누지 않고 한 번에 모두 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      { "campusFloorId": 11, "isEmpty": false },
      { "campusFloorId": 12, "isEmpty": false },
      { "campusFloorId": 21, "isEmpty": true }
    ]
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `TERM_NOT_FOUND` | 없는 학기이거나 아직 열리지 않은 학기 |

## GET /api/v1/terms/{termId}/fields/{campusFloorId}

들판 하나에 놓인 땅굴 입구를 모두 준다. 탐색에 들어올 때와 캠퍼스-층 고르기의 "들어가기"로 들판을 옮길 때 부른다. 입구마다 안내판과 가까운 주인 카드에 보여 줄 값이 함께 들어 있다.

- 로그인: 필요
- 명세: 탐색 1 ~ 3, 6

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `termId` | 숫자 | ✓ | 학기의 id |
| 경로 | `campusFloorId` | 숫자 | ✓ | 캠퍼스-층의 id |

```text
GET /api/v1/terms/4/fields/12
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `term` | 객체 | 이 들판의 학기. 지난 학기 들판이면 캠퍼스-층 버튼에 학기도 함께 보여 준다 | |
| `term.id` | 숫자 | 학기의 id | `term.id` |
| `term.year` | 숫자 | 연도 | `term.year` |
| `term.half` | 숫자 | `1`은 상반기, `2`는 하반기 | `term.half` |
| `term.isCurrent` | 참/거짓 | 이번 학기인지 | 계산: 열린 학기 가운데 `term.opened_at`이 가장 최근인 학기인지 |
| `campusFloorId` | 숫자 | 캠퍼스-층의 id | `campus_floor.id` |
| `campusName` | 문자열 | 캠퍼스 이름 | `campus.name` |
| `floor` | 숫자 | 층 | `campus_floor.floor` |
| `items` | 목록 | 이 들판에 놓인 땅굴 입구 | |
| `items[].slot` | 숫자 | 자리 번호 | `burrow_entrance.slot` |
| `items[].burrowId` | 숫자 | 땅굴의 id | `burrow_entrance.burrow_id` |
| `items[].isMine` | 참/거짓 | 내 땅굴인지 | 계산: `burrow.user_id`가 요청한 사람인지 |
| `items[].owner` | 객체 | 땅굴 주인의 [사용자 표시](00-common.md#사용자-표시) | |
| `items[].interests` | 목록 | 주인의 [관심사 태그](00-common.md#관심사-태그). 고른 순서이고, 나와 겹치는 것은 `isShared`가 `true`다 | |
| `items[].answers` | 목록 | 주인의 [질문과 답변](#질문과-답변) 3개 | |

### 주는 방식

- 그 학기 · 그 층의 `burrow_entrance`를 모두 준다. `slot`이 작은 것부터다.
- 나누지 않고 한 번에 모두 준다. 지도에 입구를 한꺼번에 그려야 하고, 두더지가 움직일 때마다 가까운 주인의 카드가 바뀌므로 카드의 값도 미리 준다.
- 내 땅굴의 입구도 준다. `isMine`이 `true`다. 프론트엔드는 내 두더지를 이 자리에서 솟아나오게 한다.
- `isMine`이 `false`인 항목이 없으면 다른 땅굴이 없는 들판이다. 프론트엔드가 빈 상태와 "다른 캠퍼스-층 가보기"를 보여 준다.
- 안내판의 "나와 같은 관심사 수"는 주지 않는다. 프론트엔드가 `interests`에서 `isShared`가 `true`인 것을 센다.
- 탈퇴한 사람의 땅굴은 탈퇴할 때 입구까지 지워지므로 나오지 않는다. 정지된 사람의 땅굴은 그대로 준다.
- 지난 학기 들판에는 새 학기에 아직 접속하지 않은 사람의 땅굴만 있다. 이사한 사람의 자리는 비어 있다.
- 입구가 하나도 없으면 `items`는 `[]`다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "term": { "id": 4, "year": 2026, "half": 2, "isCurrent": true },
    "campusFloorId": 12,
    "campusName": "서울",
    "floor": 2,
    "items": [
      {
        "slot": 7,
        "burrowId": 27,
        "isMine": false,
        "owner": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "interests": [
          { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true },
          { "id": 61, "name": "캠핑", "interestCategoryId": 5, "isShared": false },
          { "id": 33, "name": "그림", "interestCategoryId": 2, "isShared": false }
        ],
        "answers": [
          { "slot": 1, "introQuestionId": 8, "question": "가장 좋아하는 운동 코스는?", "answer": "새벽에 한강을 따라 달리는 코스가 좋아요" },
          { "slot": 2, "introQuestionId": 14, "question": "주말에 주로 하는 일은?", "answer": "날씨가 좋으면 근교로 캠핑을 떠나요" },
          { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "가볍게 접히는 캠핑 의자를 잘 샀어요" }
        ]
      },
      {
        "slot": 31,
        "burrowId": 18,
        "isMine": true,
        "owner": {
          "id": 31,
          "nickname": "두더지왕",
          "profileImageUrl": null,
          "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "interests": [
          { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": false },
          { "id": 47, "name": "인디 음악", "interestCategoryId": 1, "isShared": false },
          { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": false }
        ],
        "answers": [
          { "slot": 1, "introQuestionId": 5, "question": "운동하고 나서 꼭 먹는 것은?", "answer": "운동하고 나면 무조건 제로 콜라를 마셔요" },
          { "slot": 2, "introQuestionId": 2, "question": "요즘 가장 많이 듣는 노래는?", "answer": "요즘은 인디 밴드 노래만 돌려 듣고 있어요" },
          { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "출퇴근용으로 산 접이식 자전거가 최고예요" }
        ]
      }
    ]
  },
  "error": null
}
```

"새벽산책"의 안내판에는 나와 같은 관심사가 1개(러닝)라고 보인다. 내 땅굴의 관심사는 `isShared`가 모두 `false`다.

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `TERM_NOT_FOUND` | 없는 학기이거나 아직 열리지 않은 학기 |
| `404` | `CAMPUS_FLOOR_NOT_FOUND` | 없거나 지운 캠퍼스-층 |

## POST /api/v1/me/burrow/move

이번 학기의 캠퍼스 · 층을 정해 내 땅굴을 그 들판으로 이사한다. 새 학기 안내의 "이 층으로 정하기"가 부른다. 방명록, 단골, 방의 모습은 그대로이고 위치만 바뀐다.

- 로그인: 필요(새 학기를 고르기 전에도)
- 명세: 새 학기 안내 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `campusFloorId` | 숫자 | ✓ | 이번 학기의 캠퍼스-층 id. [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses)의 `floors[].id` |

```text
POST /api/v1/me/burrow/move
```

```json
{ "campusFloorId": 15 }
```

### 서버가 하는 일

1. 내 땅굴의 입구가 이미 이번 학기 들판에 있으면 아무것도 바꾸지 않고, 요청 본문도 보지 않고, 지금의 값으로 답한다. 같은 요청이 두 번 와도 한 번만 옮긴다.
2. `campusFloorId`가 지우지 않은 캠퍼스-층인지 본다. 아니면 `404`와 `CAMPUS_FLOOR_NOT_FOUND`.
3. 아래 표의 값을 한 트랜잭션으로 저장한다.
4. 자리 번호가 같은 순간에 들어온 다른 사람과 겹치면 서버가 번호를 다시 골라 저장한다. 그래도 저장하지 못하면 모두 되돌리고 `500`과 `INTERNAL_ERROR`로 답한다.

| 요청의 값 | 저장하는 곳 |
|---|---|
| `campusFloorId` | `user_profile.campus_floor_id` |
| `campusFloorId` | `burrow_entrance`의 내 땅굴 줄. `term_id`를 이번 학기로, `campus_floor_id`를 고른 층으로, `slot`을 그 들판의 다음 자리 번호로 바꾼다 |

줄을 새로 만들지 않는다. 땅굴 하나에 입구는 하나라서 지난 학기 들판의 자리는 빈다. 이번 학기의 캠퍼스 · 층을 나중에 바꾸는 것은 [내 정보 저장](04-my-burrow.md#patch-apiv1meprofile)이 한다.

### 응답 `data`

`200`으로 답한다. 이미 이사한 계정이 다시 불러도 같은 `data`가 온다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `userId` | 숫자 | 계정의 id | `user.id` |
| `nextStep` | enum | 항상 `HOME` | 계산: [다음에 갈 화면](02-auth.md#다음에-갈-화면) |
| `entrance` | 객체 | 이번 학기 들판에 놓인 내 땅굴 입구 | |
| `entrance.termId` | 숫자 | 이번 학기의 id | `burrow_entrance.term_id` |
| `entrance.campusFloorId` | 숫자 | 정한 캠퍼스-층의 id | `burrow_entrance.campus_floor_id` |
| `entrance.slot` | 숫자 | 그 들판에서의 자리 번호 | `burrow_entrance.slot` |

프론트엔드는 안내를 닫고 있던 화면을 다시 불러온다. 캠퍼스 이름과 층은 [`GET /api/v1/me`](02-auth.md#get-apiv1me)를 다시 불러 받는다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "userId": 31,
    "nextStep": "HOME",
    "entrance": { "termId": 5, "campusFloorId": 15, "slot": 9 }
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CAMPUS_FLOOR_NOT_FOUND` | 없거나 지운 캠퍼스-층 |

## GET /api/v1/me/regular-burrows

내가 단골로 담은 땅굴을 준다. 단골 땅굴 목록이 열릴 때 부른다.

- 로그인: 필요
- 명세: 단골 땅굴 목록 1

### 요청

없다.

```text
GET /api/v1/me/regular-burrows
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 단골 땅굴 | |
| `items[].burrowId` | 숫자 | 땅굴의 id. 단골에서 뺄 때 쓴다 | `regular_burrow.burrow_id` |
| `items[].owner` | 객체 | 땅굴 주인의 [사용자 표시](00-common.md#사용자-표시). "놀러가기"는 `owner.id`로 남의 땅굴을 부른다 | |
| `items[].createdAt` | 시각 | 단골로 담은 시각 | `regular_burrow.created_at` |

### 주는 방식

- 요청한 사람이 담은 줄만 준다. 최근에 담은 것부터다.
- 나누지 않고 한 번에 모두 준다. 명세의 목록에 페이지나 "더 보기"가 없다.
- 주인이 탈퇴한 땅굴은 탈퇴할 때 단골 관계도 지워지므로 나오지 않는다.
- 새 소식 표시에 쓸 값은 주지 않는다. 명세에 새 소식 표시가 없다.
- 담은 땅굴이 없으면 `items`는 `[]`다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "burrowId": 27,
        "owner": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "createdAt": "2026-11-18T09:12:40Z"
      }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PUT /api/v1/burrows/{burrowId}/regular

땅굴을 내 단골로 담는다. 방문자 뷰의 "단골 추가"가 부른다. 상대의 수락이 필요 없고 상대에게 알리지 않는다.

- 로그인: 필요
- 명세: 방문자 뷰 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `burrowId` | 숫자 | ✓ | 담을 땅굴의 id |

```text
PUT /api/v1/burrows/27/regular
```

### 서버가 하는 일

1. `burrow`에서 그 땅굴을 찾는다. 없으면 `404`와 `BURROW_NOT_FOUND`.
2. 내 땅굴이면 `403`과 `OWN_BURROW_NOT_ALLOWED`.
3. `regular_burrow`에 한 줄을 만든다. `user_id`는 요청한 사람, `burrow_id`는 그 땅굴이다. 이미 담은 땅굴이면 바꾸지 않고 성공으로 답한다.

알림은 만들지 않는다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isRegular` | 참/거짓 | 항상 `true` | 계산: `regular_burrow`에 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isRegular": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `403` | `OWN_BURROW_NOT_ALLOWED` | 내 땅굴을 담으려 함 |
| `404` | `BURROW_NOT_FOUND` | 없는 땅굴. 주인이 탈퇴해 지워진 땅굴도 여기에 든다 |

## DELETE /api/v1/burrows/{burrowId}/regular

땅굴을 내 단골에서 뺀다. 방문자 뷰에서 "단골 추가"를 다시 누를 때와 단골 땅굴 목록의 "단골 해제"가 부른다. 상대에게 알리지 않는다.

- 로그인: 필요
- 명세: 방문자 뷰 2, 단골 땅굴 목록 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `burrowId` | 숫자 | ✓ | 뺄 땅굴의 id |

```text
DELETE /api/v1/burrows/27/regular
```

### 서버가 하는 일

1. `burrow`에서 그 땅굴을 찾는다. 없으면 `404`와 `BURROW_NOT_FOUND`.
2. `regular_burrow`에서 요청한 사람과 그 땅굴의 줄을 지운다. 담지 않은 땅굴이면 바꾸지 않고 성공으로 답한다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isRegular` | 참/거짓 | 항상 `false` | 계산: `regular_burrow`에 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isRegular": false },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `BURROW_NOT_FOUND` | 없는 땅굴. 주인이 탈퇴해 지워진 땅굴도 여기에 든다 |

## GET /api/v1/me/daily-recommendation

오늘의 추천을 받았는지와, 받았으면 그 결과를 준다. 탐색에 들어올 때 부른다. 추천 친구 버튼의 빨간 점과, 버튼을 눌렀을 때 추천 받기 화면과 추천 결과 가운데 무엇을 보여 줄지를 이 값으로 정한다.

- 로그인: 필요
- 명세: 탐색 5, 추천 결과 1 · 4, 답변 보기 1

### 요청

없다.

```text
GET /api/v1/me/daily-recommendation
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `hasReceived` | 참/거짓 | 오늘 추천을 받았는지 | 계산: `daily_recommendation`에 요청한 사람의 오늘 날짜 줄이 있는지 |
| `recommendedOn` | 날짜 | 서버가 오늘로 보는 추천 기준 날짜 | 계산: 지금 시각의 추천 기준 날짜 |
| `items` | 목록 | 오늘 추천된 사람. 0 ~ 3명 | |
| `items[].burrowId` | 숫자 | 그 사람의 땅굴 id | `burrow.id` |
| `items[].owner` | 객체 | 추천된 사람의 [사용자 표시](00-common.md#사용자-표시). "땅굴 방문하기"는 `owner.id`로 남의 땅굴을 부른다 | `daily_recommendation_member.target_user_id`의 계정 |
| `items[].interests` | 목록 | 그 사람의 [관심사 태그](00-common.md#관심사-태그) 3개. 나와 겹치는 것을 앞에 둔다 | |
| `items[].answers` | 목록 | 그 사람의 [질문과 답변](#질문과-답변) 3개. 카드를 뒤집었을 때 보여 준다 | |

### 주는 방식

- 오늘 받지 않았으면 `hasReceived`가 `false`이고 `items`는 `[]`다.
- 오늘 받았으면 저장된 사람들을 `daily_recommendation_member.sort_order`가 작은 것부터 준다. 추천할 사람이 없어 0명을 받은 날도 `hasReceived`는 `true`이고 `items`는 `[]`다.
- 카드의 값은 추천할 때의 값이 아니라 그 사람의 지금 프로필에서 읽는다.
- 추천받은 뒤에 탈퇴한 사람은 뺀다. 프로필과 땅굴이 지워졌기 때문이다.
- 관심사는 서버가 골라 3개만 준다. 나와 겹치는 것(`isShared`가 `true`)을 앞에 두고, 겹치는 것끼리와 겹치지 않는 것끼리는 그 사람이 고른 순서로 놓은 뒤 앞에서부터 3개다. 프론트엔드는 받은 순서대로 보여 준다. 관심사를 고른 순서로 모두 주는 다른 API와 다른 점이다.
- 답변을 함께 주므로 카드를 뒤집을 때 다시 부르지 않는다.

### 응답 예시

오늘 받았을 때:

```json
{
  "success": true,
  "data": {
    "hasReceived": true,
    "recommendedOn": "2026-11-20",
    "items": [
      {
        "burrowId": 27,
        "owner": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 2,
          "isWithdrawn": false
        },
        "interests": [
          { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true },
          { "id": 61, "name": "캠핑", "interestCategoryId": 5, "isShared": false },
          { "id": 33, "name": "그림", "interestCategoryId": 2, "isShared": false }
        ],
        "answers": [
          { "slot": 1, "introQuestionId": 8, "question": "가장 좋아하는 운동 코스는?", "answer": "새벽에 한강을 따라 달리는 코스가 좋아요" },
          { "slot": 2, "introQuestionId": 14, "question": "주말에 주로 하는 일은?", "answer": "날씨가 좋으면 근교로 캠핑을 떠나요" },
          { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "가볍게 접히는 캠핑 의자를 잘 샀어요" }
        ]
      }
    ]
  },
  "error": null
}
```

오늘 아직 받지 않았을 때:

```json
{
  "success": true,
  "data": { "hasReceived": false, "recommendedOn": "2026-11-20", "items": [] },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/me/daily-recommendation

고른 캠퍼스 · 층과 기수에 맞는 사람 가운데 최대 3명을 추천받는다. 나에게 덜 추천된 사람이 먼저 뽑힌다. 추천 받기 전 화면의 "추천 받기"가 부른다. 하루에 한 번만 새로 뽑는다.

- 로그인: 필요
- 명세: 추천 받기 전 2 · 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `campusFloorId` | 숫자 | ✓ | 고른 캠퍼스-층의 id. [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses)의 `floors[].id` |
| 본문 | `generation` | 숫자 | ✓ | 고른 기수. [`GET /api/v1/generations`](00-common.md#get-apiv1generations)의 `items[].generation` |

```text
POST /api/v1/me/daily-recommendation
```

```json
{ "campusFloorId": 12, "generation": 14 }
```

### 서버가 하는 일

1. 오늘 이미 받았으면 새로 뽑지 않고, 요청 본문도 보지 않고, 저장된 결과로 `200`으로 답한다. 조건을 바꿔 다시 보내도 처음 결과가 그대로 온다.
2. 입력값의 모양을 본다. `generation`이 기수 목록에 없으면 `400`과 `INVALID_INPUT`.
3. `campusFloorId`가 지우지 않은 캠퍼스-층인지 본다. 아니면 `404`와 `CAMPUS_FLOOR_NOT_FOUND`.
4. 후보를 고른다. 고른 캠퍼스-층의 이번 학기 들판에 땅굴 입구가 있고, `user.status`가 `ACTIVE`이고, 온보딩을 마쳤고, 프로필의 기수가 고른 기수와 같은 사람이다. 요청한 사람과, 요청한 사람이 단골로 담은 땅굴의 주인은 뺀다.
5. 후보마다 요청한 사람에게 추천된 횟수를 센다. `daily_recommendation`에서 `user_id`가 요청한 사람인 줄에 딸린 `daily_recommendation_member` 가운데 `target_user_id`가 그 후보인 줄 수다.
6. 횟수가 가장 적은 후보부터 최대 3명을 뽑는다. 횟수가 같은 후보끼리는 무작위다. 아래 표대로 한 트랜잭션으로 저장한다. 후보가 3명보다 적으면 있는 만큼, 한 명도 없으면 0명을 저장한다.
7. 같은 순간에 두 번 부르면 한 번만 저장된다. 늦은 쪽은 저장된 결과를 읽어 `200`으로 답한다.

| 저장하는 곳 | 값 |
|---|---|
| `daily_recommendation`에 한 줄 | `user_id`는 요청한 사람, `recommended_on`은 오늘의 추천 기준 날짜. 0명이어도 만든다 |
| `daily_recommendation_member`에 사람마다 한 줄 | `sort_order`는 뽑힌 순서(1부터), `target_user_id`는 뽑힌 사람 |

고른 캠퍼스-층과 기수는 저장하지 않는다. 지금 보고 있는 들판과 관계없이 고른 캠퍼스-층의 이번 학기 들판에서 뽑는다.

아직 추천되지 않은 사람이 먼저 뽑히고, 모두 한 번씩 추천된 뒤에는 횟수가 같아져 다시 모두 같은 순위가 된다. 따로 초기화하지 않는다. 횟수를 세어야 하므로 지난 날의 추천 결과는 지우지 않는다.

### 응답 `data`

새로 뽑았으면 `201`, 오늘 이미 받았으면 `200`으로 답한다. `data`는 [`GET /api/v1/me/daily-recommendation`](#get-apiv1medaily-recommendation)과 이름, 타입, 값이 오는 곳이 모두 같다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `hasReceived` | 참/거짓 | 항상 `true` | 계산: 오늘의 추천 조회와 같다 |
| `recommendedOn` | 날짜 | 추천 기준 날짜 | `daily_recommendation.recommended_on` |
| `items` | 목록 | 추천된 사람. 0 ~ 3명. 안의 값은 오늘의 추천 조회와 같다 | |

### 응답 예시

조건에 맞는 사람이 한 명도 없을 때:

```json
{
  "success": true,
  "data": { "hasReceived": true, "recommendedOn": "2026-11-20", "items": [] },
  "error": null
}
```

프론트엔드는 빈 상태를 보여 준다. 이날은 다시 받을 수 없다.

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CAMPUS_FLOOR_NOT_FOUND` | 없거나 지운 캠퍼스-층 |

## GET /api/v1/users/{userId}/burrow

다른 사람의 땅굴에 놀러 갔을 때 보여 줄 값을 한 번에 준다. 방문자 뷰를 열 때 부른다. 방노트도 이 응답의 값을 쓴다.

- 로그인: 필요
- 명세: 방문자 뷰 1 ~ 6, 방노트 1 ~ 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `userId` | 숫자 | ✓ | 땅굴 주인의 계정 id. 사용자 표시의 `id`다 |

```text
GET /api/v1/users/52/burrow
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `burrowId` | 숫자 | 땅굴의 id. 단골, 방명록 API를 부를 때 쓴다 | `burrow.id` |
| `isMine` | 참/거짓 | 내 땅굴인지. `true`면 프론트엔드가 내 땅굴 화면으로 보낸다 | 계산: `userId`가 요청한 사람인지 |
| `owner` | 객체 | 땅굴 주인의 [사용자 표시](00-common.md#사용자-표시) | |
| `intro` | 문자열 | 주인의 자기소개. 쓰지 않았으면 `null` | `user_profile.intro` |
| `interests` | 목록 | 주인의 [관심사 태그](00-common.md#관심사-태그). 고른 순서이고 첫 번째가 대표 관심사다 | |
| `answers` | 목록 | 주인의 [질문과 답변](#질문과-답변) 3개 | |
| `guestbookCount` | 숫자 | 방명록 글 수. 우체통의 깃발에 쓴다 | 계산: `guestbook_entry`에서 이 땅굴에 달리고 가려지지 않은 줄 수 |
| `isRegular` | 참/거짓 | 내가 단골로 담은 땅굴인지 | 계산: `regular_burrow`에 요청한 사람과 이 땅굴의 줄이 있는지 |
| `chat` | 객체 | 주인과 나 사이의 대화 상태 | |
| `chat.status` | enum | `CHATTING`, `REQUEST_SENT`, `REQUEST_RECEIVED`, `NONE` 가운데 하나 | 계산: [대화 버튼의 상태](#대화-버튼의-상태) |
| `chat.chatRoomId` | 숫자 | 대화 중인 1:1 대화방의 id. `status`가 `CHATTING`이 아니면 `null` | `chat_room.id` |
| `entrance` | 객체 | 이 땅굴이 놓인 들판의 입구. "탐색"을 누르면 이 들판으로 간다 | |
| `entrance.termId` | 숫자 | 그 들판의 학기 id | `burrow_entrance.term_id` |
| `entrance.campusFloorId` | 숫자 | 그 들판의 캠퍼스-층 id | `burrow_entrance.campus_floor_id` |
| `entrance.slot` | 숫자 | 그 들판에서의 자리 번호 | `burrow_entrance.slot` |

### 주는 방식

- 계정 id로 `burrow`를 찾아 그 땅굴 하나의 값을 준다. 땅굴은 한 사람에 하나다.
- 겹치는 값(`owner`, `intro`, `interests`, `answers`, `guestbookCount`, `entrance`)은 [내 땅굴 조회](04-my-burrow.md#get-apiv1meburrow)와 이름과 모양이 같다.
- "겹치는 관심사" 수는 주지 않는다. 프론트엔드가 `interests`에서 `isShared`가 `true`인 것을 센다. 가구의 체크 표시도 `isShared`로 그린다.
- 단골 수는 주지 않는다. 단골이 몇 명인지는 주인만 본다.
- 땅굴 하나에 입구는 하나다. 주인이 이번 학기에 아직 접속하지 않았으면 `entrance`는 지난 학기 들판을 가리킨다.
- 가구, 무드, 우체통의 모습은 담지 않는다. 방명록 글의 내용도 담지 않고 글 수만 준다.
- 내 계정 id로 부르면 `isMine`이 `true`, `isRegular`가 `false`, `chat.status`가 `NONE`이다.
- 정지된 사람의 땅굴도 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "burrowId": 27,
    "isMine": false,
    "owner": {
      "id": 52,
      "nickname": "새벽산책",
      "profileImageUrl": null,
      "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "intro": "주말마다 달리고 캠핑 가는 14기입니다.",
    "interests": [
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true },
      { "id": 61, "name": "캠핑", "interestCategoryId": 5, "isShared": false },
      { "id": 33, "name": "그림", "interestCategoryId": 2, "isShared": false }
    ],
    "answers": [
      { "slot": 1, "introQuestionId": 8, "question": "가장 좋아하는 운동 코스는?", "answer": "새벽에 한강을 따라 달리는 코스가 좋아요" },
      { "slot": 2, "introQuestionId": 14, "question": "주말에 주로 하는 일은?", "answer": "날씨가 좋으면 근교로 캠핑을 떠나요" },
      { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "가볍게 접히는 캠핑 의자를 잘 샀어요" }
    ],
    "guestbookCount": 4,
    "isRegular": true,
    "chat": { "status": "REQUEST_SENT", "chatRoomId": null },
    "entrance": { "termId": 4, "campusFloorId": 12, "slot": 7 }
  },
  "error": null
}
```

겹치는 관심사는 1개(러닝)이고, 단골로 담았으며, 내가 보낸 대화 요청이 살아 있어 버튼은 "요청 보냄"이다.

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `BURROW_NOT_FOUND` | 없는 사람이거나, 탈퇴했거나, 온보딩을 마치지 않아 땅굴이 없는 사람 |

## POST /api/v1/burrows/{burrowId}/guestbook-entries

남의 땅굴 방명록에 글을 쓴다. 방문자 뷰 · 방명록의 "남기기"가 부른다. 쓴 글은 고칠 수 없다.

- 로그인: 필요
- 명세: 방문자 뷰 · 방명록 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `burrowId` | 숫자 | ✓ | 글을 남길 땅굴의 id |
| 본문 | `content` | 문자열 | ✓ | 본문. 1 ~ 50자. 공백만으로는 쓸 수 없다 |

```text
POST /api/v1/burrows/27/guestbook-entries
```

```json
{ "content": "가구 구경 잘 하고 가요. 다음에 같이 달려요!" }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 본문의 길이다. 어긋나면 `400`과 `INVALID_INPUT`.
2. `burrow`에서 그 땅굴을 찾는다. 없으면 `404`와 `BURROW_NOT_FOUND`.
3. 내 땅굴이면 `403`과 `OWN_BURROW_NOT_ALLOWED`.
4. `guestbook_entry`에 한 줄을 만든다. `burrow_id`는 그 땅굴, `author_id`는 요청한 사람, `content`는 본문, `status`는 `PUBLIC`이다.
5. 땅굴 주인에게 방명록 새 글 알림(`GUESTBOOK_ENTRY_CREATED`)을 만든다([알림 API](09-notification.md#알림의-종류)).

### 응답 `data`

`201`로 답하고, 만든 글을 준다. [방명록 글 목록](04-my-burrow.md#get-apiv1burrowsburrowidguestbook-entries)의 항목과 모양이 같다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 방명록 글의 id | `guestbook_entry.id` |
| `author` | 객체 | 쓴 사람인 나의 [사용자 표시](00-common.md#사용자-표시) | |
| `content` | 문자열 | 본문 | `guestbook_entry.content` |
| `createdAt` | 시각 | 쓴 시각 | `guestbook_entry.created_at` |
| `canDelete` | 참/거짓 | 항상 `true`. 내가 쓴 글이다 | 계산: 방명록 글 목록과 같다 |
| `canReport` | 참/거짓 | 항상 `false`. 내가 쓴 글이다 | 계산: 방명록 글 목록과 같다 |

프론트엔드는 이 글을 목록 맨 위에 올리거나 목록의 첫 페이지를 다시 불러 글 수를 맞춘다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "id": 231,
    "author": {
      "id": 31,
      "nickname": "두더지왕",
      "profileImageUrl": null,
      "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 2,
      "isWithdrawn": false
    },
    "content": "가구 구경 잘 하고 가요. 다음에 같이 달려요!",
    "createdAt": "2026-11-20T06:41:03Z",
    "canDelete": true,
    "canReport": false
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `403` | `OWN_BURROW_NOT_ALLOWED` | 내 땅굴의 방명록에 쓰려 함 |
| `404` | `BURROW_NOT_FOUND` | 없는 땅굴. 주인이 탈퇴해 지워진 땅굴도 여기에 든다 |

## POST /api/v1/chat-requests

다른 사람에게 1:1 대화 요청을 보낸다. 대화 요청 팝업의 "요청 보내기"가 부른다. 상대가 수락해야 대화방이 생긴다. 내가 거절한 요청이 남아 있는 사람에게 보내면 요청을 만들지 않고 바로 대화방이 열린다.

- 로그인: 필요
- 명세: 대화 요청 팝업 1 ~ 3, 방문자 뷰 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `receiverId` | 숫자 | ✓ | 요청을 받을 사람의 계정 id. 남의 땅굴 조회의 `owner.id` |
| 본문 | `message` | 문자열 | | 짧은 인사. 50자 이하. 보내지 않거나 `null`이나 빈 문자열이면 인사 없이 보낸다 |

```text
POST /api/v1/chat-requests
```

```json
{
  "receiverId": 52,
  "message": "저도 러닝 좋아해요. 같이 달려요!"
}
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 인사의 길이와, `receiverId`가 나 자신이 아닌지다. 어긋나면 `400`과 `INVALID_INPUT`.
2. 받을 사람이 가입을 모두 마친 사람인지 본다(`user.status`가 `ACTIVE`이고 `user.onboarded_at`이 있음). 아니면 `404`와 `USER_NOT_FOUND`.
3. 두 사람의 `user` 줄을 id가 작은 것부터 잠근 뒤 아래를 차례로 본다([DB 설계](../db/chat.md)).
4. 두 사람이 모두 나가지 않은 1:1 대화방이 있으면 `409`와 `CHAT_ROOM_ALREADY_EXISTS`.
5. 내가 그 사람에게 보낸 살아 있는 요청이 있으면 `409`와 `CHAT_REQUEST_ALREADY_SENT`.
6. 그 사람이 나에게 보낸 살아 있는 요청이 `PENDING`이면 `409`와 `CHAT_REQUEST_ALREADY_RECEIVED`. 요청을 새로 만들지 않는다.
7. 그 사람이 나에게 보낸 살아 있는 요청이 `REJECTED`면 내가 거절한 요청이다. 요청을 새로 만들지 않고 그 요청을 내가 수락한 것으로 처리한 뒤 끝낸다. 대화방과 참여자를 만들고, 요청을 `ACCEPTED`로 바꾸고, 수락 안내 메시지를 넣고, 그 사람에게 수락 알림을 만든다([대화 요청 수락](06-chat.md#post-apiv1chat-requestschatrequestidaccept)의 5 ~ 7, 9와 같다). 인사를 보냈으면 만든 대화방에 내가 보낸 첫 메시지로 넣는다.
8. `chat_request`에 한 줄을 만든다. `sender_id`는 요청한 사람, `receiver_id`는 받을 사람, `message`는 인사(없으면 `NULL`), `status`는 `PENDING`이다.
9. 받을 사람에게 대화 요청 알림(`CHAT_REQUEST_RECEIVED`)을 만든다([알림 API](09-notification.md#알림의-종류)).

살아 있는 요청의 뜻은 [대화 버튼의 상태](#대화-버튼의-상태)에 있다. 두 사람이 같은 순간에 서로에게 보내도 하나만 만들어진다. 7에서는 그 사람에게 거절됐던 것이 드러나지 않는다. 그 사람이 보기에는 기다리던 요청이 수락된 것이다.

### 응답 `data`

`201`로 답한다. 요청을 새로 만들었을 때와 대화방이 바로 열렸을 때 모두 같다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `chatRequestId` | 숫자 | 만든 대화 요청의 id. 대화방이 바로 열렸으면 `null` | `chat_request.id` |
| `createdAt` | 시각 | 보낸 시각. 대화방이 바로 열렸으면 `null` | `chat_request.created_at` |
| `expiresAt` | 시각 | 요청이 만료되는 시각. 대화방이 바로 열렸으면 `null` | 계산: `chat_request.created_at`에 5일을 더한 시각 |
| `chatRoomId` | 숫자 | 바로 열린 1:1 대화방의 id. 요청을 새로 만들었으면 `null` | `chat_room.id`. 서버가 하는 일 7에서 만든 대화방 |

프론트엔드는 `chatRoomId`가 `null`이면 방문자 뷰의 버튼을 "요청 보냄"으로 바꾸고 완료 토스트를 띄운다. 값이 있으면 팝업을 닫고 그 대화방으로 간다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "chatRequestId": 88,
    "createdAt": "2026-11-20T06:45:10Z",
    "expiresAt": "2026-11-25T06:45:10Z",
    "chatRoomId": null
  },
  "error": null
}
```

내가 거절한 요청이 남아 있는 사람에게 보내 대화방이 바로 열렸을 때:

```json
{
  "success": true,
  "data": {
    "chatRequestId": null,
    "createdAt": null,
    "expiresAt": null,
    "chatRoomId": 16
  },
  "error": null
}
```

상대가 먼저 나에게 요청을 보냈고 내가 아직 답하지 않았을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CHAT_REQUEST_ALREADY_RECEIVED",
    "message": "상대가 이미 대화 요청을 보냈습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `USER_NOT_FOUND` | 없는 사람이거나, 탈퇴했거나, 가입을 마치지 않은 사람 |
| `409` | `CHAT_ROOM_ALREADY_EXISTS` | 이미 대화 중인 사람 |
| `409` | `CHAT_REQUEST_ALREADY_SENT` | 내가 보낸 살아 있는 요청이 있음 |
| `409` | `CHAT_REQUEST_ALREADY_RECEIVED` | 상대가 보낸 요청에 내가 아직 답하지 않음 |

## 명세에 없어 이 문서에서 정한 것

- **들판을 가리키는 법**: 들판을 학기 아래의 자원으로 두고 `termId`와 `campusFloorId`로 가리킨다. DB에 들판 테이블이 없어 들판만의 id가 없다.
- **들판의 입구를 한 번에 모두 주기**: 나누지 않는다. 안내판과 가까운 주인 카드의 값(관심사, 질문과 답변)까지 입구마다 담는다. 두더지가 움직일 때마다 서버를 부르지 않는다.
- **새 학기를 서버가 지키기**: 고르지 않은 계정은 `nextStep`이 `NEW_TERM`이고 다른 API를 부르면 `NEW_TERM_INCOMPLETE`다. 온보딩을 마치지 않은 계정과 같은 방식이다. 새 학기 안내가 쓰도록 내 계정 조회가 `campusFloorId`도 준다.
- **이사의 주소**: 새 자원을 만들지 않고 땅굴의 위치를 옮기는 행동이라 `POST /api/v1/me/burrow/move`로 둔다.
- **이사를 두 번 불러도 한 번만 옮기기**: 이미 이사한 계정이 다시 부르면 바꾸지 않고 지금 값을 준다. 온보딩 확정과 같은 방식이다.
- **단골 목록**: 최근에 담은 것부터 한 번에 모두 준다. 명세의 목록에 순서와 페이지가 없다.
- **오늘의 추천을 받았는지와 결과를 한 API로 주기**: 탐색에 들어올 때 한 번 불러 빨간 점과 추천 결과에 함께 쓴다. 카드 뒷면의 답변도 함께 준다.
- **추천 카드의 관심사**: 서버가 나와 겹치는 것을 앞에 두고 3개만 골라 준다. 명세의 카드 규칙을 서버가 맡는다. 겹치는 것끼리와 겹치지 않는 것끼리의 순서는 그 사람이 고른 순서다.
- **추천받은 뒤 탈퇴한 사람**: 결과에서 뺀다.
- **남의 땅굴을 사람 id로 부르기**: `GET /api/v1/users/{userId}/burrow`다. "땅굴 놀러가기"가 있는 곳(안내판, 단골 목록, 추천 카드, 프로필 팝업, 채팅 요청, 모임 상세, 글 상세)이 모두 사용자 표시를 갖고 있어, 사람 id만으로 바로 부를 수 있다.
- **방문자에게 주지 않는 값**: 단골 수, 겹치는 관심사 수다. 단골 수는 주인만 보고, 겹치는 수는 프론트엔드가 `isShared`를 센다.
- **대화 버튼의 상태**: `chat.status` 네 가지 값으로 준다.
- **내가 거절한 요청이 남아 있는 사람에게 보내는 요청**: 새 요청을 만들지 않고 거절했던 요청을 수락한 것으로 처리해 바로 대화방을 연다. 응답의 `chatRoomId`로 알린다. 쓴 인사는 그 대화방의 첫 메시지가 된다.
- **대화 요청의 인사**: 비워도 보낼 수 있다. DB 설계에서 `chat_request.message`가 비울 수 있는 칼럼이다.
- **방명록을 쓴 뒤의 응답**: 만든 글을 목록의 항목과 같은 모양으로 준다.
- **내 땅굴에 할 수 없는 일의 에러**: 단골 담기와 방명록 쓰기 모두 `OWN_BURROW_NOT_ALLOWED`로 답한다.
- **땅굴 화면 밖에서 탐색으로 갈 때**: 새 API를 두지 않는다. 프론트엔드가 내 땅굴 조회의 `entrance`로 들판을 정한다.

## 구현 단계로 넘기는 것

- 들판에 땅굴이 아주 많아졌을 때 입구를 나눠 주는 방법
- 오늘의 추천 기준 날짜가 바뀌는 시각(DB 설계에서도 구현 단계로 넘겼다)
- 캠퍼스 · 층이나 기수를 고르지 않고 전체에서 추천받을 수 있는지(명세의 보류한 결정이다)
- 방명록과 대화 요청을 짧은 시간에 너무 많이 보내는 것을 막는 기준
