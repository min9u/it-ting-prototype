# 공통 API

여러 영역이 함께 쓰는 목록(캠퍼스 · 층, 기수, 학기, 관심사, 자기소개 질문)과 프로필 팝업을 다룬다. 다른 문서가 함께 쓰는 값의 모양도 여기에 한 번만 적는다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [00 공통](../spec/00-common.md)
- DB 설계: [계정 · 프로필 · 관심사 · 질문](../db/account.md), [들판 · 땅굴](../db/burrow.md)

## 목록

"온보딩 중에도"는 온보딩을 마치지 않은 계정도 부를 수 있다는 뜻이다([로그인 · 회원가입 API](02-auth.md#온보딩을-마치지-않은-계정)). "새 학기를 고르기 전에도"는 새 학기의 캠퍼스 · 층을 아직 고르지 않은 계정도 부를 수 있다는 뜻이다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)). 캠퍼스 목록과 기수 목록은 계정을 만들기 전인 회원가입 3에서 쓰므로 로그인 없이 부를 수 있다.

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/campuses` | 캠퍼스와 층 목록을 준다 | 불필요 | 00 공통 19 |
| `GET` | `/api/v1/generations` | 고를 수 있는 기수 목록을 준다 | 불필요 | 02 회원가입 3 · 3, 05 추천 친구 설정 2 |
| `GET` | `/api/v1/terms` | 학기 목록을 준다 | 필요(새 학기를 고르기 전에도) | 00 공통 19 |
| `GET` | `/api/v1/interest-categories` | 관심사 대분류와 세부 관심사를 준다 | 필요(온보딩 중에도) | 00 공통 5, 03 온보딩 2 |
| `GET` | `/api/v1/intro-questions` | 자기소개 질문 목록을 준다 | 필요(온보딩 중에도) | 03 온보딩 3 · 2, 04 내 정보 수정 4 |
| `GET` | `/api/v1/users/{userId}/profile` | 프로필 팝업에 보여 줄 사람 정보를 준다 | 필요 | 00 공통 15 |

여섯 API 모두 조회만 한다. 목록 다섯 개는 운영자가 DB에서 직접 고치는 값이라 자주 바뀌지 않고, 양이 적어 페이지로 나누지 않고 한 번에 모두 준다.

## 함께 쓰는 값

다른 문서는 "사용자 표시", "관심사 태그"라는 이름으로 이 모양을 가리킨다. 표의 "값이 오는 곳"을 읽는 법은 [API 명세](README.md#값이-오는-곳)에 있다.

### 사용자 표시

사람을 보여 주는 모든 곳에 쓴다([00 공통](../spec/00-common.md) 4). 글의 작성자, 대화 상대, 모임 주최자, 방명록을 쓴 사람이 모두 이 모양이다. 실명, 반, 이메일은 담지 않는다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 계정의 id | `user.id` |
| `nickname` | 문자열 | 닉네임. 탈퇴한 사용자는 `null` | `user_profile.nickname` |
| `profileImageUrl` | 문자열 | 프로필 사진의 주소. 사진을 올리지 않은 사람과 탈퇴한 사용자는 `null` | `user_profile.profile_image_url` |
| `mole` | 객체 | 두더지 아이템. 항상 네 부위를 모두 담는다 | |
| `mole.head` | 문자열 | 머리 아이템 코드. 고르지 않았으면 `null` | `user_profile.mole_head` |
| `mole.face` | 문자열 | 얼굴 아이템 코드. 고르지 않았으면 `null` | `user_profile.mole_face` |
| `mole.neck` | 문자열 | 목 아이템 코드. 고르지 않았으면 `null` | `user_profile.mole_neck` |
| `mole.hand` | 문자열 | 손 아이템 코드. 고르지 않았으면 `null` | `user_profile.mole_hand` |
| `campusName` | 문자열 | 캠퍼스 이름. 탈퇴한 사용자는 `null` | `campus.name`. `user_profile.campus_floor_id`가 가리키는 층의 캠퍼스 |
| `generation` | 숫자 | 기수. 탈퇴한 사용자는 `null` | `user_profile.generation` |
| `floor` | 숫자 | 층. 탈퇴한 사용자는 `null` | `campus_floor.floor`. `user_profile.campus_floor_id`가 가리키는 층 |
| `isWithdrawn` | 참/거짓 | 탈퇴한 사용자인지 | 계산: `user.status`가 `WITHDRAWN`인지 |

만드는 법:

- 계정 id로 `user`, `user_profile`, `campus_floor`, `campus`를 이어 읽는다.
- 캠퍼스와 층은 프로필에 저장된 지금의 값이다. 지난 학기의 글에도 지금의 캠퍼스와 층이 보인다.
- 탈퇴하면 프로필을 지우므로([DB 설계](../db/account.md) G5), 탈퇴한 사용자는 `id`와 `isWithdrawn`만 값이 있다. 나머지는 `null`이고 `mole`은 네 부위가 모두 `null`이다.
- 두더지 아이템은 코드만 준다. 코드마다의 그림은 프론트엔드가 갖는다. 서버는 코드가 실제로 있는 아이템인지 검사하지 않으므로([온보딩 API](03-onboarding.md#두더지-아이템)), 프론트엔드는 모르는 코드를 "없음"으로 그린다.

가입한 사용자:

```json
{
  "id": 31,
  "nickname": "두더지왕",
  "profileImageUrl": null,
  "mole": { "head": "CAP_RED", "face": null, "neck": "SCARF_GREEN", "hand": null },
  "campusName": "서울",
  "generation": 14,
  "floor": 2,
  "isWithdrawn": false
}
```

탈퇴한 사용자:

```json
{
  "id": 8,
  "nickname": null,
  "profileImageUrl": null,
  "mole": { "head": null, "face": null, "neck": null, "hand": null },
  "campusName": null,
  "generation": null,
  "floor": null,
  "isWithdrawn": true
}
```

탈퇴한 사용자의 이름("탈퇴한 사용자")과 기본 두더지 그림은 프론트엔드가 `isWithdrawn`을 보고 정한다.

프로필 사진은 선택이다. 사진이 없는 사람은 두더지로만 보여 준다. 사진을 어디서 올리고 어느 화면에 보여 주는지는 명세의 [보류한 결정](../spec/open-issues.md)이라, 올리는 API는 아직 없다.

### 관심사 태그

사람의 관심사를 보여 주는 곳에 쓴다([00 공통](../spec/00-common.md) 5).

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 세부 관심사의 id | `interest.id` |
| `name` | 문자열 | 세부 관심사 이름 | `interest.name` |
| `interestCategoryId` | 숫자 | 속한 대분류의 id | `interest.interest_category_id` |
| `isShared` | 참/거짓 | 나와 겹치는 관심사인지. 내 관심사를 볼 때는 `false` | 계산: 요청한 사람의 `user_interest`에 같은 `interest_id`가 있는지 |

만드는 법:

- 한 사람의 관심사 목록은 그 사람이 고른 순서(`user_interest.sort_order`가 작은 것부터)로 준다. 첫 번째가 대표 관심사다.
- `isShared`는 보는 사람에 따라 달라지므로 저장하지 않는다. 요청한 사람의 `user_interest`와 보이는 사람의 `user_interest`를 비교해 계산한다.
- 대분류의 이름은 담지 않는다. 필요하면 [`GET /api/v1/interest-categories`](#get-apiv1interest-categories)의 목록에서 `interestCategoryId`로 찾는다.

```json
[
  { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true },
  { "id": 47, "name": "인디 음악", "interestCategoryId": 1, "isShared": false },
  { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": false }
]
```

위 예에서 대표 관심사는 "러닝"이고, 나와 겹치는 것도 "러닝" 하나다.

## GET /api/v1/campuses

캠퍼스와 캠퍼스마다의 층 목록을 준다. 캠퍼스를 고르면 그 캠퍼스의 층이 나오는 화면(회원가입 3, 내 정보 수정, 캠퍼스-층 고르기, 새 학기 안내)과 추천 친구 설정이 함께 쓴다.

- 로그인: 불필요
- 명세: 00 공통 19

### 요청

없다.

```text
GET /api/v1/campuses
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 캠퍼스 목록 | |
| `items[].id` | 숫자 | 캠퍼스의 id | `campus.id` |
| `items[].name` | 문자열 | 캠퍼스 이름 | `campus.name` |
| `items[].floors` | 목록 | 그 캠퍼스의 층 목록 | |
| `items[].floors[].id` | 숫자 | 캠퍼스-층의 id. 다른 API의 `campusFloorId`에는 이 값을 보낸다 | `campus_floor.id` |
| `items[].floors[].floor` | 숫자 | 층 번호 | `campus_floor.floor` |

### 주는 방식

- 지우지 않은 캠퍼스와 층만 준다(`deleted_at`이 비어 있는 줄).
- 캠퍼스는 `campus.sort_order`가 작은 것부터(같으면 id가 작은 것부터), 층은 층 번호가 작은 것부터 준다.
- 층이 없는 캠퍼스도 주고 `floors`는 `[]`다.
- 나누지 않고 한 번에 모두 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 1, "name": "서울", "floors": [ { "id": 11, "floor": 1 }, { "id": 12, "floor": 2 } ] },
      { "id": 2, "name": "대전", "floors": [ { "id": 21, "floor": 1 } ] }
    ]
  },
  "error": null
}
```

"서울 2층"을 고른 사람은 다른 API에 `"campusFloorId": 12`를 보낸다.

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/generations

SSAFY 인증을 할 수 있는 기수 목록을 준다. 회원가입 3의 기수 고르기와 추천 친구 설정의 기수 고르기가 함께 쓴다.

- 로그인: 불필요
- 명세: 02 회원가입 3 · 3, 05 추천 친구 설정 2

### 요청

없다.

```text
GET /api/v1/generations
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 기수 목록 | |
| `items[].generation` | 숫자 | 기수 | 서버 설정 |

### 주는 방식

- 기수는 DB에 테이블이 없다. 인증 코드를 보낼 Mattermost가 연결된 기수를 서버 설정(`itting.generations`)에 두고, 그 목록을 준다. 같은 기수가 두 번 적혀 있어도 한 번만 준다.
- 큰 기수부터 준다.
- 나누지 않고 한 번에 모두 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [ { "generation": 15 }, { "generation": 14 }, { "generation": 13 } ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/terms

들판이 열린 학기 목록을 준다. 탐색의 학기 고르기와 새 학기 안내가 쓴다.

- 로그인: 필요(새 학기를 고르기 전에도)
- 명세: 00 공통 19

### 요청

없다.

```text
GET /api/v1/terms
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 학기 목록 | |
| `items[].id` | 숫자 | 학기의 id | `term.id` |
| `items[].year` | 숫자 | 연도 | `term.year` |
| `items[].half` | 숫자 | `1`은 상반기, `2`는 하반기 | `term.half` |
| `items[].isCurrent` | 참/거짓 | 이번 학기인지. 하나만 `true`다 | 계산: 열린 학기 가운데 `term.opened_at`이 가장 최근인 학기 |

### 주는 방식

- 이미 열린 학기만 준다(`term.opened_at`이 지금이거나 지금보다 앞선 줄). 열 날짜가 아직 오지 않은 학기는 주지 않는다.
- 최근에 열린 학기부터 준다. 그래서 첫 번째 항목이 이번 학기다.
- 열린 학기가 하나도 없으면 `items`는 `[]`다.
- 나누지 않고 한 번에 모두 준다.

"2026 하반기" 같은 표기는 프론트엔드가 `year`와 `half`로 만든다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 4, "year": 2026, "half": 2, "isCurrent": true },
      { "id": 3, "year": 2026, "half": 1, "isCurrent": false }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/interest-categories

관심사 대분류 12개와 그 아래 세부 관심사 90개를 한 번에 준다. 온보딩 2, 내 정보 수정의 관심사 고르기, 커뮤니티 글의 관심사 태그가 함께 쓴다.

- 로그인: 필요(온보딩 중에도)
- 명세: 00 공통 5, 03 온보딩 2 · 2 ~ 3

### 요청

없다.

```text
GET /api/v1/interest-categories
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 대분류 목록 | |
| `items[].id` | 숫자 | 대분류의 id | `interest_category.id` |
| `items[].name` | 문자열 | 대분류 이름 | `interest_category.name` |
| `items[].interests` | 목록 | 그 대분류의 세부 관심사 목록 | |
| `items[].interests[].id` | 숫자 | 세부 관심사의 id. 관심사를 저장하는 API의 `interestIds`에는 이 값을 보낸다 | `interest.id` |
| `items[].interests[].name` | 문자열 | 세부 관심사 이름 | `interest.name` |
| `items[].interests[].userCount` | 숫자 | 그 관심사를 고른 사람 수. 온보딩 2의 칩에 함께 적는다 | 계산: 그 관심사의 `user_interest` 줄 수 |

### 주는 방식

- 지우지 않은 대분류와 세부 관심사만 준다(`deleted_at`이 비어 있는 줄).
- 대분류와 세부 관심사 모두 id가 작은 것부터 준다. 순서 칼럼이 없어서 임시로 정한 순서다.
- 세부 관심사마다 고른 사람 수(`userCount`)를 준다. 저장된 관심사만 센다. 화면에서 고르는 중인 것은 세지 않고, 탈퇴한 사람은 관심사가 지워져 빠진다. 아무도 고르지 않았으면 0이다.
- 내가 고른 관심사인지는 담지 않는다. 고른 관심사는 프로필을 주는 API가 따로 준다.
- 대분류의 아이콘, 관심사마다의 가구 그림은 프론트엔드가 갖는다.
- 나누지 않고 한 번에 모두 준다.

### 응답 예시

대분류 12개 가운데 2개, 세부 관심사는 앞의 몇 개만 적었다.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "음식·음료",
        "interests": [
          { "id": 1, "name": "맛집탐방", "userCount": 128 },
          { "id": 2, "name": "카페/커피", "userCount": 31 },
          { "id": 3, "name": "주류/와인/위스키", "userCount": 4 }
        ]
      },
      {
        "id": 2,
        "name": "스포츠",
        "interests": [
          { "id": 8, "name": "헬스/필라테스/요가", "userCount": 57 },
          { "id": 9, "name": "러닝/마라톤", "userCount": 22 }
        ]
      }
    ]
  },
  "error": null
}
```

온보딩 2는 왼쪽에 대분류를 놓고, 오른쪽에 지금 보는 대분류의 `interests`를 칩으로 보여 준다. 칩마다 `userCount`를 함께 적는다.

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/intro-questions

자기소개 질문 목록을 준다. 온보딩 3과 내 정보 수정의 질문 다시 고르기가 같은 목록을 쓴다.

- 로그인: 필요(온보딩 중에도)
- 명세: 03 온보딩 3 · 2, 04 내 정보 수정 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `type` | enum | | `INTEREST`(관심사 질문), `TMI` 가운데 하나. 보내지 않으면 두 종류를 모두 준다 |

```text
GET /api/v1/intro-questions
GET /api/v1/intro-questions?type=TMI
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 질문 목록 | |
| `items[].id` | 숫자 | 질문의 id. 답변을 저장하는 API의 `introQuestionId`에는 이 값을 보낸다 | `intro_question.id` |
| `items[].type` | enum | `INTEREST`(관심사 질문), `TMI` 가운데 하나 | `intro_question.type` |
| `items[].interestCategoryId` | 숫자 | 관심사 질문이 딸린 대분류의 id. TMI 질문은 `null` | `intro_question.interest_category_id` |
| `items[].content` | 문자열 | 질문 문구 | `intro_question.content` |

### 주는 방식

- 질문은 숨기거나 지우지 않으므로 저장된 질문을 모두 준다. `type`을 보내면 그 종류만 준다.
- id가 작은 것부터 준다. 순서 칼럼이 없어서 임시로 정한 순서다.
- 내가 이미 고른 질문인지, 추천 질문인지는 담지 않는다. 화면의 "추천" 필터는 프론트엔드가 이 목록에서 고른다([온보딩 API](03-onboarding.md#추천-질문)).
- 나누지 않고 한 번에 모두 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 1, "type": "INTEREST", "interestCategoryId": 1, "content": "요즘 가장 자주 가는 맛집이나 카페는?" },
      { "id": 3, "type": "INTEREST", "interestCategoryId": 2, "content": "운동을 시작하게 된 계기는?" },
      { "id": 25, "type": "TMI", "interestCategoryId": null, "content": "최근에 산 것 가운데 가장 잘 산 것은?" }
    ]
  },
  "error": null
}
```

### 에러

`type`에 목록에 없는 값을 보내면 공통 에러 `INVALID_INPUT`으로 답한다. 그 밖에는 공통 에러 코드만 쓴다.

## GET /api/v1/users/{userId}/profile

사용자 표시를 눌렀을 때 뜨는 프로필 팝업의 내용을 준다.

- 로그인: 필요
- 명세: 00 공통 15

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `userId` | 숫자 | ✓ | 볼 사람의 계정 id. 사용자 표시의 `id`다 |

```text
GET /api/v1/users/31/profile
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `user` | 객체 | 그 사람의 [사용자 표시](#사용자-표시) | 사용자 표시와 같다 |
| `interests` | 목록 | 그 사람이 고른 관심사. 항목은 [관심사 태그](#관심사-태그) | 그 사람의 `user_interest`와 `interest` |

### 주는 방식

- 가입을 모두 마친 사람만 준다(`user.status`가 `ACTIVE`이고 `user.onboarded_at`이 있는 계정). 탈퇴했거나 가입 중인 사람은 `USER_NOT_FOUND`로 답한다.
- `interests`는 그 사람이 고른 순서로 모두 준다(3 ~ 10개). 첫 번째가 대표 관심사다.
- `isShared`는 요청한 사람을 기준으로 계산한다. 자기 자신의 프로필을 부르면 모두 `false`다.
- 정지된 사람의 프로필도 준다. 명세에서 정지는 로그인을 막는 것뿐이다.
- 자기소개, 질문과 답변은 담지 않는다. 그 값은 땅굴의 방노트에서 보여 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
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
    "interests": [
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true },
      { "id": 47, "name": "인디 음악", "interestCategoryId": 1, "isShared": false },
      { "id": 5, "name": "보드게임", "interestCategoryId": 4, "isShared": false }
    ]
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `USER_NOT_FOUND` | 없는 사람이거나, 탈퇴했거나, 가입을 마치지 않은 사람 |

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다.",
    "fields": null,
    "detail": null
  }
}
```

## 명세에 없어 이 문서에서 정한 것

- **기수 목록**: 명세는 기수를 "목록에서 고른다"고만 적었다. 인증 코드를 보낼 수 있는 기수를 서버가 알아야 하므로 서버가 목록을 준다. 큰 기수부터 준다.
- **관심사를 고른 사람 수**: 저장된 관심사만 센다. 목록을 받을 때의 값이고, 화면을 보는 동안 다른 사람이 고르거나 빼도 바뀌지 않는다.
- **탈퇴한 사람의 프로필 팝업**: 명세는 눌러도 팝업이 열리지 않는다고 했다. 주소로 직접 불러도 `USER_NOT_FOUND`로 답한다.
- **탈퇴한 사용자의 두더지**: `mole`을 `null`로 주지 않고 네 부위가 모두 `null`인 객체로 준다. 프론트엔드가 `mole`이 있는지를 따로 검사하지 않아도 된다.
- **아직 열리지 않은 학기**: 학기 목록에서 뺀다.
- **정지된 사람의 프로필**: 명세는 정지된 계정이 로그인하지 못한다고만 적었다. 프로필 팝업은 정지 중에도 그대로 보여 준다.

## 구현 단계로 넘기는 것

- 캠퍼스 · 층 · 기수 목록의 실제 값. 지금은 캠퍼스 · 층에 명세의 임시 값(서울 · 대전 · 부울경 · 구미 · 광주, 1 ~ 20층)을 마이그레이션으로 넣었고, 기수는 서버 설정 `itting.generations`에 15 · 16을 두었다(2026-11-22)
- 프로필 사진을 올리는 API와 사진 주소의 모양(올리는 곳이 명세의 보류한 결정이고, 파일 업로드 방식을 정하지 않았다)

## 구현하며 정한 것

- **관심사 · 질문의 순서**(KAN-43): 순서 칼럼은 두지 않고 id 순 그대로 준다. 관심사는 명세 [00 공통](../spec/00-common.md) 5의 표 순서대로 넣어 id 순이 표 순서와 같다.
- **학기 처음 값**(KAN-43): 2026 하반기 하나(2026-07-01 00:00 한국 시간에 열림). 다음 학기는 여는 방법이 정해지기 전까지 마이그레이션으로 더한다.
- **자기소개 질문 처음 값**(KAN-43): 명세에 문구가 없어 초안 40개를 넣었다(관심사 질문은 대분류마다 2개 = 24개, TMI 16개). 문구는 [작업 기록](../work/KAN-43.md#부록-자기소개-질문-초안)에 있다.
- **"온보딩 중에도", "새 학기를 고르기 전에도"**(KAN-43): 온보딩 · 새 학기를 마치지 않은 계정을 막는 장치는 03 · 05에서 만든다. 그때 `GET /api/v1/terms`, `/interest-categories`, `/intro-questions`는 막지 않는다. 지금은 로그인만 확인한다.
