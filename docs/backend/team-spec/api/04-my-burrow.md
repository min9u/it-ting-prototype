# 내 땅굴 API

내 땅굴과 내 정보를 보고, 두더지와 내 정보를 바꾸고, 방명록을 읽고 지우는 일을 다룬다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [04 내 땅굴](../spec/04-my-burrow.md)
- DB 설계: [계정 · 프로필 · 관심사 · 질문](../db/account.md), [들판 · 땅굴](../db/burrow.md)

## 목록

이 영역의 API는 모두 온보딩을 마친 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#온보딩을-마치지-않은-계정)). 새 학기가 열린 뒤 이번 학기의 캠퍼스 · 층을 아직 고르지 않은 계정도 부를 수 없다. 고르기 전에는 `403`과 `NEW_TERM_INCOMPLETE`로 답한다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/me/burrow` | 내 땅굴과 내 정보를 준다 | 필요 | 내 땅굴 2 ~ 4, 6 ~ 8 |
| `PATCH` | `/api/v1/me/mole` | 두더지 아이템을 바꾼다 | 필요 | 꾸미기 모드 · 두더지 탭 4 |
| `PATCH` | `/api/v1/me/profile` | 내 정보를 바꾼다 | 필요 | 내 정보 수정 1 ~ 6 |
| `GET` | `/api/v1/burrows/{burrowId}/guestbook-entries` | 땅굴의 방명록 글 목록을 준다 | 필요 | 방명록 전체 보기 1, 2, 4, 05 방문자 뷰 · 방명록 2 |
| `DELETE` | `/api/v1/guestbook-entries/{guestbookEntryId}` | 방명록 글을 지운다 | 필요 | 방명록 삭제 확인 2, 05 방문자 뷰 · 방명록 3 |

방명록 API 둘은 땅굴 주인과 방문자가 함께 쓴다. 방명록을 쓰는 API는 [05 탐색 · 방문](README.md)에서 다룬다.

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 땅굴 메인 – 내 땅굴 | 화면을 열 때 | `GET /api/v1/me/burrow` | 가구와 땅굴 무드, 가구의 말풍선, 우체통의 깃발과 편지, 내 정보 카드 접기와 "방노트" 버튼, 꾸미기 안내 말풍선 |
| 방명록 전체 보기 | 열 때, 페이지 번호를 누를 때 | `GET /api/v1/burrows/{burrowId}/guestbook-entries` | 시간 표기, 글이 없을 때의 문구 |
| 방명록 삭제 확인 | "삭제" | `DELETE /api/v1/guestbook-entries/{guestbookEntryId}` | 확인 문구, 완료 토스트 |
| 꾸미기 모드 · 두더지 탭 | "저장하기" | `PATCH /api/v1/me/mole` | 아이템 목록과 그림, 저장하기 전에 땅굴 안 두더지에 바로 보여 주기, 저장 전 취소 확인 |
| 내 정보 수정 | 열 때 | [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses) | 지금 값은 내 땅굴을 열 때 받은 것을 쓴다 |
| 내 정보 수정 | 닉네임을 바꿨을 때 | [`POST /api/v1/nicknames/check`](03-onboarding.md#post-apiv1nicknamescheck) | 글자 수 표시 |
| 내 정보 수정 · 질문 다시 고르기 | 질문 목록을 열 때 | [`GET /api/v1/intro-questions`](00-common.md#get-apiv1intro-questions) | 추천 · 관심사 · TMI 필터, 고른 자리의 질문을 바꾸고 답변 칸 비우기 |
| 내 정보 수정 · 관심사 고르기 | 화면을 열 때 | [`GET /api/v1/interest-categories`](00-common.md#get-apiv1interest-categories) | 고른 관심사와 순서, 3 ~ 10개 제한, "고르기 완료"로 칩에 반영, 저장 전 취소 확인 |
| 내 정보 수정 | "저장하기" | `PATCH /api/v1/me/profile` | 저장한 뒤 내 정보 카드로 돌아가기 |

방명록 글의 "신고"는 [`POST /api/v1/reports`](08-community.md#post-apiv1reports)에 `targetType`을 `GUESTBOOK`으로 보낸다.

## 영역 규칙

### 내 땅굴을 그리는 값

- 가구와 땅굴 무드는 저장하지도 주지도 않는다. 프론트엔드가 `interests`로 그린다. 가구는 관심사마다 하나이고, 무드는 첫 번째 관심사(대표 관심사)의 `interestCategoryId`로 정한다([온보딩 API](03-onboarding.md#가구와-땅굴-무드)).
- 우체통의 깃발은 `guestbookCount`가 1 이상이면 올린다.
- 단골은 숫자(`regularCount`)만 준다. 누가 단골로 담았는지는 주지 않는다.

### 저장하는 단위

저장은 화면마다 API를 따로 둔다. 한 API는 한 화면의 값만 받는다.

| 화면 | API | 받는 값 |
|---|---|---|
| 꾸미기 모드 · 두더지 탭의 "저장하기" | `PATCH /api/v1/me/mole` | 두더지 아이템 네 부위 |
| 내 정보 수정의 "저장하기" | `PATCH /api/v1/me/profile` | `nickname`, `campusFloorId`, `interestIds`, `answers`, `intro` |

- 방을 꾸미는 값을 저장하는 API는 없다. 가구와 무드는 관심사로 정해져 있어 사용자가 고르지 않는다([내 땅굴을 그리는 값](#내-땅굴을-그리는-값)).
- 두 API 모두 받는 값을 전부 필수로 받는다. 바꾸지 않은 값도 지금 값을 담아 보내고, 하나라도 빠지면 `400`과 `INVALID_INPUT`이다. 보낸 것만 바꾸는 방식은 쓰지 않는다.
- 화면이 값을 모두 갖고 있으므로 다 받는다. 빠뜨린 값이 조용히 지나가지 않고 바로 드러난다.
- 관심사 고르기의 "고르기 완료"와 질문 다시 고르기는 저장이 아니다. 프론트엔드의 화면 상태만 바뀌고, 내 정보 수정의 "저장하기"에서 한 번에 저장한다.
- 내 정보를 저장하면 응답으로 바뀐 내 땅굴 전체를, 두더지를 저장하면 저장한 두더지 아이템을 준다. 프론트엔드는 다시 조회하지 않고 이 값으로 화면을 바꾼다.

### 캠퍼스-층을 저장할 때

내 정보를 저장할 때마다 `campusFloorId`로 프로필의 캠퍼스-층과 땅굴 입구가 놓인 들판을 함께 맞춘다.

| 보낸 `campusFloorId` | 서버가 하는 일 |
|---|---|
| 프로필과 같음 | 바꾸지 않는다 |
| 프로필과 다름 | `user_profile.campus_floor_id`를 바꾼다. 땅굴 입구의 `campus_floor_id`를 새 층으로, `slot`을 새 들판의 다음 자리 번호로 바꾼다 |

- 이 API를 부르는 계정의 입구는 늘 이번 학기 들판에 있다. 온보딩을 마칠 때 생기고, 새 학기가 열리면 새 학기 안내에서 반드시 이사하기 때문이다([05 탐색 · 방문](../spec/05-explore-visit.md#땅굴-메인--새-학기-안내)).
- 땅굴 하나에 입구는 하나다. 옮기면 있던 자리는 빈다. 땅굴은 같은 땅굴이라 단골, 방명록, 대화는 그대로다.
- 기수는 가입할 때 SSAFY 인증에 쓴 값이라 바꿀 수 없다. 받지 않는다.

### 방명록 글이 보이는 동안

- 방명록 글은 시간이 지나도 지워지지 않는다. 오래된 글도 목록의 뒤쪽 페이지에서 볼 수 있다. 주인이나 쓴 사람이 지울 때, 주인이 탈퇴할 때, 관리자가 지울 때만 없어진다.
- 신고로 가려진 글(`guestbook_entry.status`가 `HIDDEN`)은 목록과 글 수에서 뺀다. 주인, 방문자, 쓴 사람 누구에게도 주지 않고, 지울 수도 없다. 관리자가 복구해 `PUBLIC`으로 돌아오면 다시 준다([명세의 영역 규칙](../spec/04-my-burrow.md#방명록-글이-만들어지고-없어지는-때)).
- 쓴 글은 주인도 쓴 사람도 고칠 수 없다. 수정하는 API가 없다.
- 주인은 자기 땅굴의 방명록에 글을 쓸 수 없다. 쓰는 API가 막는다.

## GET /api/v1/me/burrow

내 땅굴과 내 정보 카드에 보여 줄 값을 한 번에 준다. 내 땅굴 화면을 열 때 부른다. 꾸미기 모드와 내 정보 수정도 이 응답의 값을 지금 값으로 쓴다.

- 로그인: 필요
- 명세: 내 땅굴 2 ~ 4, 6 ~ 8

### 요청

없다.

```text
GET /api/v1/me/burrow
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `burrowId` | 숫자 | 내 땅굴의 id. 방명록 목록을 부를 때 쓴다 | `burrow.id` |
| `owner` | 객체 | 땅굴 주인인 나의 [사용자 표시](00-common.md#사용자-표시). 닉네임, 두더지 아이템, 캠퍼스 · 기수 · 층이 들어 있다 | |
| `campusFloorId` | 숫자 | 프로필의 캠퍼스-층 id. 내 정보 수정에서 지금 값을 고른 채로 열 때 쓴다 | `user_profile.campus_floor_id` |
| `intro` | 문자열 | 자기소개. 쓰지 않았으면 `null` | `user_profile.intro` |
| `interests` | 목록 | 내 [관심사 태그](00-common.md#관심사-태그). 고른 순서이고 첫 번째가 대표 관심사다. 내 관심사라 `isShared`는 모두 `false`다 | |
| `answers` | 목록 | 자기소개 질문과 답변 3개. 자리 순서다 | |
| `answers[].slot` | 숫자 | 보이는 자리. 1 ~ 3 | `user_answer.slot` |
| `answers[].introQuestionId` | 숫자 | 질문의 id | `user_answer.intro_question_id` |
| `answers[].question` | 문자열 | 질문 문구 | `intro_question.content` |
| `answers[].answer` | 문자열 | 답변. 10 ~ 50자 | `user_answer.answer` |
| `regularCount` | 숫자 | 내 땅굴을 단골로 담은 사람 수 | 계산: `regular_burrow`에서 `burrow_id`가 내 땅굴인 줄 수 |
| `guestbookCount` | 숫자 | 방명록 글 수 | 계산: `guestbook_entry`에서 내 땅굴에 달리고 가려지지 않은 줄 수 |
| `entrance` | 객체 | 이번 학기 들판에 놓인 내 땅굴 입구. "탐색"을 누르면 이 들판으로 간다 | |
| `entrance.termId` | 숫자 | 그 들판의 학기 id | `burrow_entrance.term_id` |
| `entrance.campusFloorId` | 숫자 | 그 들판의 캠퍼스-층 id | `burrow_entrance.campus_floor_id` |
| `entrance.slot` | 숫자 | 그 들판에서의 자리 번호 | `burrow_entrance.slot` |

### 주는 방식

- 세션의 계정으로 `burrow`를 찾아 그 땅굴 하나의 값만 준다. 주소에 id를 받지 않는다.
- `interests`는 `user_interest.sort_order`가 작은 것부터, `answers`는 `user_answer.slot`이 작은 것부터 준다.
- `entrance`는 내 땅굴의 입구다. 땅굴 하나에 하나이고, 이 API를 부르는 계정의 입구는 늘 이번 학기 들판에 있다. `null`이 오지 않는다([캠퍼스-층을 저장할 때](#캠퍼스-층을-저장할-때)).
- 가구, 무드, 우체통의 모습은 담지 않는다. 방명록 글의 내용도 담지 않고 글 수만 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "burrowId": 18,
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
    "campusFloorId": 12,
    "intro": null,
    "interests": [
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": false },
      { "id": 47, "name": "인디 음악", "interestCategoryId": 1, "isShared": false },
      { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": false }
    ],
    "answers": [
      { "slot": 1, "introQuestionId": 5, "question": "운동하고 나서 꼭 먹는 것은?", "answer": "운동하고 나면 무조건 제로 콜라를 마셔요" },
      { "slot": 2, "introQuestionId": 2, "question": "요즘 가장 많이 듣는 노래는?", "answer": "요즘은 인디 밴드 노래만 돌려 듣고 있어요" },
      { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "출퇴근용으로 산 접이식 자전거가 최고예요" }
    ],
    "regularCount": 7,
    "guestbookCount": 3,
    "entrance": { "termId": 4, "campusFloorId": 12, "slot": 31 }
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PATCH /api/v1/me/mole

두더지가 걸친 아이템을 바꾼다. 꾸미기 모드 · 두더지 탭의 "저장하기"가 부른다.

- 로그인: 필요
- 명세: 꾸미기 모드 · 두더지 탭 4

### 요청

네 부위를 모두 보낸다. 바꾸지 않은 부위도 지금 값을 담는다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `head` | 문자열 | ✓ | 머리 아이템 코드. "없음"이면 `null` |
| 본문 | `face` | 문자열 | ✓ | 얼굴 아이템 코드. "없음"이면 `null` |
| 본문 | `neck` | 문자열 | ✓ | 목 아이템 코드. "없음"이면 `null` |
| 본문 | `hand` | 문자열 | ✓ | 손 아이템 코드. "없음"이면 `null` |

아이템 코드의 모양은 온보딩과 같다([온보딩 API](03-onboarding.md#두더지-아이템)).

```text
PATCH /api/v1/me/mole
```

```json
{ "head": "CAP_RED", "face": "GLASSES_ROUND", "neck": null, "hand": null }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 네 부위가 모두 있는지와 아이템 코드의 모양이다. 어긋나면 `400`과 `INVALID_INPUT`이고 `fields`에 어긋난 것을 모두 담는다.
2. `user_profile.mole_head`, `mole_face`, `mole_neck`, `mole_hand`를 보낸 값으로 바꾼다. `null`을 보낸 부위는 비운다.

### 응답 `data`

저장한 뒤의 두더지 아이템이다. [사용자 표시](00-common.md#사용자-표시)의 `mole`과 모양이 같다. 프론트엔드는 내 땅굴을 열 때 받은 `owner.mole`을 이 값으로 바꾼다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `head` | 문자열 | 머리 아이템 코드. 없으면 `null` | `user_profile.mole_head` |
| `face` | 문자열 | 얼굴 아이템 코드. 없으면 `null` | `user_profile.mole_face` |
| `neck` | 문자열 | 목 아이템 코드. 없으면 `null` | `user_profile.mole_neck` |
| `hand` | 문자열 | 손 아이템 코드. 없으면 `null` | `user_profile.mole_hand` |

### 응답 예시

```json
{
  "success": true,
  "data": { "head": "CAP_RED", "face": "GLASSES_ROUND", "neck": null, "hand": null },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PATCH /api/v1/me/profile

내 정보를 바꾼다. 내 정보 수정의 "저장하기"가 부른다. 두더지 아이템은 받지 않는다([저장하는 단위](#저장하는-단위)).

- 로그인: 필요
- 명세: 내 정보 수정 1 ~ 6

### 요청

다섯 값을 모두 보낸다. 바꾸지 않은 값도 지금 값을 담는다. 하나라도 빠지면 `400`과 `INVALID_INPUT`이다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `nickname` | 문자열 | ✓ | 닉네임. 1 ~ 12자 |
| 본문 | `campusFloorId` | 숫자 | ✓ | 캠퍼스-층의 id. [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses)의 `floors[].id` |
| 본문 | `interestIds` | 목록 | ✓ | 세부 관심사의 id. 3 ~ 10개이고 같은 id를 두 번 넣지 않는다. 보낸 순서로 저장하고 첫 번째가 대표 관심사다 |
| 본문 | `answers` | 목록 | ✓ | 질문과 답변. 정확히 3개이고 보낸 순서가 자리 순서다 |
| 본문 | `answers[].introQuestionId` | 숫자 | ✓ | 질문의 id. 세 질문이 서로 달라야 한다 |
| 본문 | `answers[].answer` | 문자열 | ✓ | 답변. 10 ~ 50자 |
| 본문 | `intro` | 문자열 | ✓ | 자기소개. 150자 이하. 쓰지 않았으면 `null`을 보낸다. `null`이나 빈 문자열이면 자기소개를 비운다 |

```text
PATCH /api/v1/me/profile
```

```json
{
  "nickname": "두더지왕",
  "campusFloorId": 15,
  "interestIds": [47, 12, 5, 30],
  "answers": [
    { "introQuestionId": 5, "answer": "운동하고 나면 무조건 제로 콜라를 마셔요" },
    { "introQuestionId": 8, "answer": "주말마다 한강에서 십 킬로미터씩 달려요" },
    { "introQuestionId": 21, "answer": "출퇴근용으로 산 접이식 자전거가 최고예요" }
  ],
  "intro": "달리기와 음악을 좋아하는 14기입니다."
}
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 다섯 값이 모두 있는지, 닉네임 길이, 관심사 개수와 겹침, 답변 개수와 질문 겹침, 답변 길이, 자기소개 길이다. 어긋나면 `400`과 `INVALID_INPUT`이고 `fields`에 어긋난 것을 모두 담는다.
2. `campusFloorId`가 지우지 않은 캠퍼스-층인지 본다. 아니면 `404`와 `CAMPUS_FLOOR_NOT_FOUND`.
3. `interestIds`가 모두 지우지 않은 세부 관심사인지 본다. 아니면 `404`와 `INTEREST_NOT_FOUND`.
4. `answers[].introQuestionId`가 모두 있는 질문인지 본다. 아니면 `404`와 `INTRO_QUESTION_NOT_FOUND`.
5. `nickname`이 지금 닉네임과 다르면, 다른 계정이 그 닉네임을 맡아 두었는지 본다([닉네임 맡아 두기](03-onboarding.md#닉네임-맡아-두기)). 맡아 둔 시간이 남아 있으면 `409`와 `NICKNAME_DUPLICATED`.
6. 아래 표의 값을 한 트랜잭션으로 저장한다.
7. 저장하다 닉네임이 겹치면 모두 되돌리고 `409`와 `NICKNAME_DUPLICATED`.
8. 땅굴 입구의 자리 번호가 같은 순간에 옮겨 온 다른 사람과 겹치면 서버가 번호를 다시 골라 저장한다. 그래도 저장하지 못하면 모두 되돌리고 `500`과 `INTERNAL_ERROR`로 답한다.
9. 닉네임을 저장했으면 이 계정이 맡아 둔 닉네임을 임시 저장소에서 지운다.

| 요청의 값 | 저장하는 곳 |
|---|---|
| `nickname` | `user_profile.nickname` |
| `campusFloorId` | `user_profile.campus_floor_id`와 이번 학기의 `burrow_entrance`. [캠퍼스-층을 저장할 때](#캠퍼스-층을-저장할-때)의 표를 따른다 |
| `interestIds` | `user_interest`. 빠진 관심사의 줄은 지우고, 새 관심사는 줄을 만들고, 모든 줄의 `sort_order`를 보낸 순서(1부터)로 맞춘다 |
| `answers`의 n번째 | `user_answer`에서 `slot`이 n인 줄의 `intro_question_id`와 `answer` |
| `intro` | `user_profile.intro`. `null`이나 빈 문자열이면 비운다 |

관심사를 빼도 그 관심사의 분야에 딸린 질문과 답변은 그대로 둔다. 서버는 질문의 분야가 내 관심사의 분야인지 검사하지 않는다([온보딩 API](03-onboarding.md#명세에-없어-이-문서에서-정한-것)).

### 응답 `data`

바뀐 뒤의 내 땅굴이다. [`GET /api/v1/me/burrow`](#get-apiv1meburrow)의 응답과 이름, 타입, 값이 오는 곳이 모두 같다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `burrowId` | 숫자 | 내 땅굴의 id | `burrow.id` |
| `owner` | 객체 | 저장한 뒤의 내 [사용자 표시](00-common.md#사용자-표시) | |
| `campusFloorId` | 숫자 | 저장한 뒤의 캠퍼스-층 id | `user_profile.campus_floor_id` |
| `intro` | 문자열 | 저장한 뒤의 자기소개. 없으면 `null` | `user_profile.intro` |
| `interests` | 목록 | 저장한 뒤의 내 [관심사 태그](00-common.md#관심사-태그) | |
| `answers` | 목록 | 저장한 뒤의 질문과 답변 3개. 안의 값은 내 땅굴 조회와 같다 | |
| `regularCount` | 숫자 | 단골 수 | 계산: 내 땅굴 조회와 같다 |
| `guestbookCount` | 숫자 | 방명록 글 수 | 계산: 내 땅굴 조회와 같다 |
| `entrance` | 객체 | 저장한 뒤의 내 땅굴 입구. 캠퍼스-층을 옮겼으면 새 들판과 새 자리 번호다. 안의 값은 내 땅굴 조회와 같다 | |

### 응답 예시

위의 내 정보 수정 요청을 저장한 뒤:

```json
{
  "success": true,
  "data": {
    "burrowId": 18,
    "owner": {
      "id": 31,
      "nickname": "두더지왕",
      "profileImageUrl": null,
      "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 5,
      "isWithdrawn": false
    },
    "campusFloorId": 15,
    "intro": "달리기와 음악을 좋아하는 14기입니다.",
    "interests": [
      { "id": 47, "name": "인디 음악", "interestCategoryId": 1, "isShared": false },
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": false },
      { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": false },
      { "id": 30, "name": "등산", "interestCategoryId": 3, "isShared": false }
    ],
    "answers": [
      { "slot": 1, "introQuestionId": 5, "question": "운동하고 나서 꼭 먹는 것은?", "answer": "운동하고 나면 무조건 제로 콜라를 마셔요" },
      { "slot": 2, "introQuestionId": 8, "question": "가장 좋아하는 운동 코스는?", "answer": "주말마다 한강에서 십 킬로미터씩 달려요" },
      { "slot": 3, "introQuestionId": 21, "question": "최근에 산 것 중 가장 잘 산 것은?", "answer": "출퇴근용으로 산 접이식 자전거가 최고예요" }
    ],
    "regularCount": 7,
    "guestbookCount": 3,
    "entrance": { "termId": 4, "campusFloorId": 15, "slot": 9 }
  },
  "error": null
}
```

대표 관심사가 "러닝"에서 "인디 음악"으로 바뀌었으므로 프론트엔드는 땅굴 무드를 음악 분야의 것으로 바꾸고, "등산"의 가구를 새로 놓는다. 캠퍼스-층을 2층에서 5층으로 옮겨서 입구의 들판과 자리 번호도 바뀌었다.

닉네임이 겹칠 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NICKNAME_DUPLICATED",
    "message": "이미 사용 중인 닉네임입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `CAMPUS_FLOOR_NOT_FOUND` | 없거나 지운 캠퍼스-층 |
| `404` | `INTEREST_NOT_FOUND` | 없거나 지운 세부 관심사가 `interestIds`에 있음 |
| `404` | `INTRO_QUESTION_NOT_FOUND` | 없는 질문이 `answers`에 있음 |
| `409` | `NICKNAME_DUPLICATED` | 다른 사람이 쓰고 있거나 맡아 둔 닉네임 |

## GET /api/v1/burrows/{burrowId}/guestbook-entries

땅굴에 달린 방명록 글을 최신순으로 준다. 내 땅굴의 방명록 전체 보기가 열릴 때와 페이지 번호를 누를 때 부른다. 방문자 뷰의 방명록도 같은 API를 쓴다.

- 로그인: 필요
- 명세: 방명록 전체 보기 1, 2, 4, 05 방문자 뷰 · 방명록 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `burrowId` | 숫자 | ✓ | 땅굴의 id. 내 땅굴이면 [`GET /api/v1/me/burrow`](#get-apiv1meburrow)의 `burrowId` |
| 쿼리 | `page` | 숫자 | | 페이지 번호. 1부터 세고 보내지 않으면 1 |
| 쿼리 | `size` | 숫자 | | 한 페이지의 글 수. 보내지 않으면 5 |

```text
GET /api/v1/burrows/18/guestbook-entries
GET /api/v1/burrows/18/guestbook-entries?page=2&size=5
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 방명록 글 | |
| `items[].id` | 숫자 | 방명록 글의 id | `guestbook_entry.id` |
| `items[].author` | 객체 | 쓴 사람의 [사용자 표시](00-common.md#사용자-표시). 탈퇴한 사람이면 `isWithdrawn`이 `true`다 | |
| `items[].content` | 문자열 | 본문. 50자 이하 | `guestbook_entry.content` |
| `items[].createdAt` | 시각 | 쓴 시각 | `guestbook_entry.created_at` |
| `items[].canDelete` | 참/거짓 | 요청한 사람이 이 글을 지울 수 있는지 | 계산: 요청한 사람이 땅굴 주인이거나 이 글을 쓴 사람인지 |
| `items[].canReport` | 참/거짓 | 요청한 사람이 이 글을 신고할 수 있는지 | 계산: 요청한 사람이 이 글을 쓴 사람이 아닌지 |
| `page` | 숫자 | 지금 페이지 번호 | 요청의 `page` |
| `size` | 숫자 | 한 페이지의 글 수 | 요청의 `size` |
| `totalItems` | 숫자 | 글 수. 화면의 "방명록" 제목 옆에 보여 준다 | 계산: 아래 조건에 맞는 `guestbook_entry` 줄 수 |
| `totalPages` | 숫자 | 전체 페이지 수 | 계산: `totalItems`를 `size`로 나눠 올림 |

### 주는 방식

- 그 땅굴에 달린 글 가운데 가려지지 않은 글을 모두 준다. 오래된 글도 페이지를 넘기면 나온다([방명록 글이 보이는 동안](#방명록-글이-보이는-동안)).
- 최신순이다. `guestbook_entry.created_at`이 늦은 것부터, 같으면 id가 큰 것부터 준다. 정렬은 바꿀 수 없다.
- 페이지 방식으로 나눈다. 한 페이지에 5개가 기본이다.
- 글이 없으면 `items`는 `[]`, `totalItems`는 0, `totalPages`는 0이다.
- 주인이 볼 때는 모든 글의 `canDelete`와 `canReport`가 `true`다. 주인은 자기 땅굴에 글을 쓸 수 없기 때문이다. 방문자가 볼 때는 자기가 쓴 글만 `canDelete`가 `true`이고 `canReport`가 `false`다.

### 응답 예시

주인이 볼 때:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 204,
        "author": {
          "id": 52,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "content": "가구 구경 잘 하고 가요. 다음에 같이 달려요!",
        "createdAt": "2026-11-19T12:40:11Z",
        "canDelete": true,
        "canReport": true
      },
      {
        "id": 198,
        "author": {
          "id": 40,
          "nickname": null,
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": null, "hand": null },
          "campusName": null,
          "generation": null,
          "floor": null,
          "isWithdrawn": true
        },
        "content": "인디 음악 좋아하시는군요. 반가워요.",
        "createdAt": "2026-11-17T03:05:48Z",
        "canDelete": true,
        "canReport": true
      }
    ],
    "page": 1,
    "size": 5,
    "totalItems": 2,
    "totalPages": 1
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `BURROW_NOT_FOUND` | 없는 땅굴. 주인이 탈퇴해 지워진 땅굴도 여기에 든다 |

## DELETE /api/v1/guestbook-entries/{guestbookEntryId}

방명록 글을 지운다. 방명록 삭제 확인의 "삭제"를 누를 때 부른다. 땅굴 주인은 자기 땅굴에 달린 모든 글을, 방문자는 자기가 쓴 글을 지울 수 있다.

- 로그인: 필요
- 명세: 방명록 삭제 확인 2, 05 방문자 뷰 · 방명록 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `guestbookEntryId` | 숫자 | ✓ | 지울 방명록 글의 id |

```text
DELETE /api/v1/guestbook-entries/204
```

### 서버가 하는 일

1. `guestbook_entry`에서 그 글을 찾는다. 없거나 신고로 가려진 글이면 `404`와 `GUESTBOOK_ENTRY_NOT_FOUND`.
2. 요청한 사람이 그 글이 달린 땅굴의 주인도, 그 글을 쓴 사람도 아니면 `403`과 `FORBIDDEN`.
3. `guestbook_entry`에서 그 줄을 지운다. 되돌릴 수 없다.

쓴 사람에게 알림을 보내지 않는다. 이 글에 접수된 신고의 처리는 [커뮤니티 · 신고의 DB 설계](../db/community.md)를 따른다.

### 응답 `data`

`null`이다. 프론트엔드는 방명록 목록을 다시 불러 글 수와 페이지를 맞춘다.

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
| `404` | `GUESTBOOK_ENTRY_NOT_FOUND` | 없는 글이거나 이미 지워진 글, 신고로 가려진 글 |

## 명세에 없어 이 문서에서 정한 것

- **내 땅굴을 한 번에 주기**: 방, 내 정보 카드, 단골 수, 방명록 글 수를 `GET /api/v1/me/burrow` 하나로 준다. 내 땅굴은 계정마다 하나라 주소에 id를 받지 않는다.
- **저장 API를 화면마다 나누기**: 두더지는 `PATCH /api/v1/me/mole`, 내 정보는 `PATCH /api/v1/me/profile`로 따로 저장한다. 한 API는 한 화면의 값만 받는다. 내 정보 수정은 두더지를 받지 않는다. 명세의 내 정보 수정 화면에 두더지 항목이 없기 때문이다.
- **받는 값을 모두 필수로 받기**: 두더지는 네 부위를, 내 정보는 다섯 값을 모두 받고 하나라도 빠지면 `400`으로 답한다. 바꾸지 않은 값도 함께 보낸다. 화면이 값을 모두 갖고 있고, 빠뜨린 값이 바로 드러나게 하려는 것이다.
- **저장한 뒤의 응답**: 내 정보를 저장하면 바뀐 내 땅굴 전체를, 두더지를 저장하면 저장한 두더지 아이템을 준다. 프론트엔드가 다시 조회하지 않는다.
- **관심사의 순서**: 서버는 프론트엔드가 보낸 순서를 그대로 저장한다. 관심사를 넣고 뺄 때 순서를 어떻게 정할지는 화면이 정한다.
- **관심사를 뺐을 때의 질문**: 뺀 관심사의 분야에 딸린 질문과 답변은 그대로 둔다. 온보딩에서 질문을 내 관심사의 분야로 제한하지 않기로 한 것과 같다.
- **방명록 API를 주인과 방문자가 함께 쓰기**: 목록과 삭제를 한 API로 두고, 글마다 `canDelete`와 `canReport`로 지금 보는 사람이 할 수 있는 일을 알린다.
- **이번 학기의 입구**: 내 땅굴 조회가 `entrance`로 준다. "탐색"을 누르면 갈 들판을 프론트엔드가 이 값으로 안다.

## 구현 단계로 넘기는 것

- `size`의 최댓값
- 캠퍼스-층을 옮겨 비게 된 자리 번호를 다시 쓰는지(DB 설계에서도 구현 단계로 넘겼다)
- 프로필 사진을 올리는 API(올리는 곳이 명세의 보류한 결정이다)
