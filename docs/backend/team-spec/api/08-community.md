# 커뮤니티 API

커뮤니티의 글을 읽고 쓰고, 댓글 · 좋아요 · 저장을 하고, 내가 쓴 글 · 댓글 단 글 · 저장한 글을 모아 보는 일을 다룬다. 글에 붙이는 사진을 올리는 API와, 글 · 댓글 · 사용자 · 방명록 글을 신고하는 API도 여기에 있다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [08 커뮤니티](../spec/08-community.md)
- DB 설계: [커뮤니티 · 신고](../db/community.md), [모임](../db/meetup.md), [들판 · 땅굴](../db/burrow.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/posts` | 글을 카테고리 · 관심사 · 검색어로 추리고 정렬해 페이지로 준다 | 필요 | 커뮤니티 4 ~ 9 · 11 |
| `GET` | `/api/v1/posts/highlights` | 이번 주 인기 글 TOP5와 많이 이야기하는 관심사를 준다 | 필요 | 커뮤니티 10 · 11 |
| `POST` | `/api/v1/posts` | 글을 쓴다 | 필요 | 글쓰기 1 ~ 7 |
| `GET` | `/api/v1/posts/{postId}` | 글 하나의 본문과 내 상태를 준다 | 필요 | 글 상세 2 ~ 9 · 17, 글 수정 2 |
| `PATCH` | `/api/v1/posts/{postId}` | 글을 고친다 | 필요 | 글 수정 2 · 3 |
| `DELETE` | `/api/v1/posts/{postId}` | 글을 지운다 | 필요 | 글 삭제 확인 1 · 2, 내가 쓴 글 4 |
| `POST` | `/api/v1/posts/{postId}/views` | 글의 조회수를 1 올린다 | 필요 | 글 상세 6 |
| `GET` | `/api/v1/posts/{postId}/related-posts` | 다음 읽을 글 3개를 준다 | 필요 | 글 상세 14 |
| `PUT` | `/api/v1/posts/{postId}/like` | 글에 좋아요를 누른다 | 필요 | 글 상세 3 |
| `DELETE` | `/api/v1/posts/{postId}/like` | 글의 좋아요를 취소한다 | 필요 | 글 상세 3 |
| `PUT` | `/api/v1/posts/{postId}/bookmark` | 글을 저장한다 | 필요 | 커뮤니티 7, 글 상세 3 |
| `DELETE` | `/api/v1/posts/{postId}/bookmark` | 글의 저장을 취소한다 | 필요 | 커뮤니티 7, 글 상세 3, 저장한 글 4 |
| `GET` | `/api/v1/posts/{postId}/comments` | 글의 댓글과 답글을 준다 | 필요 | 글 상세 10 · 13 |
| `POST` | `/api/v1/posts/{postId}/comments` | 댓글이나 답글을 쓴다 | 필요 | 글 상세 10 · 13 |
| `PATCH` | `/api/v1/comments/{commentId}` | 댓글을 고친다 | 필요 | 글 상세 11 |
| `DELETE` | `/api/v1/comments/{commentId}` | 댓글을 지운다 | 필요 | 글 상세 11, 글 삭제 확인 3 |
| `PUT` | `/api/v1/comments/{commentId}/like` | 댓글에 좋아요를 누른다 | 필요 | 글 상세 10 |
| `DELETE` | `/api/v1/comments/{commentId}/like` | 댓글의 좋아요를 취소한다 | 필요 | 글 상세 10 |
| `GET` | `/api/v1/me/posts` | 내가 쓴 글, 댓글 단 글, 저장한 글 가운데 하나를 준다 | 필요 | 저장한 글 2 · 3 · 7, 내가 쓴 글 2 · 3 · 7, 댓글 단 글 2 ~ 4 · 7 |
| `GET` | `/api/v1/me/posts/summary` | 내 활동의 개수를 준다 | 필요 | 커뮤니티 14, 저장한 글 1 |
| `GET` | `/api/v1/me/linkable-meetups` | 글에 연결할 수 있는 내 모임을 준다 | 필요 | 글쓰기 6 |
| `POST` | `/api/v1/images` | 사진 한 장을 올린다 | 필요 | 글쓰기 5, 06 채팅의 1:1 대화 7 |
| `POST` | `/api/v1/reports` | 글, 댓글, 사용자, 방명록 글을 신고한다 | 필요 | 신고 팝업 1 ~ 4 |

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 커뮤니티 | 들어올 때 | `GET /api/v1/posts`, `GET /api/v1/posts/highlights`, `GET /api/v1/me/posts/summary` | 안내 문구와 배너, 시간 표기, 사진이 없는 글의 일러스트, 내가 신고한 글 접기 |
| 커뮤니티 | 탭, "내 관심사만", 관심사 칩, 정렬, 검색어, 페이지를 바꿀 때 | `GET /api/v1/posts` | 입력이 멈춘 뒤에 부르기, 결과가 없을 때의 "필터 초기화" |
| 커뮤니티, 글 상세, 댓글 단 글 | 북마크 아이콘 | `PUT /api/v1/posts/{postId}/bookmark`, `DELETE /api/v1/posts/{postId}/bookmark` | 아이콘 바로 바꾸기 |
| 글 상세 | 열 때 | `GET /api/v1/posts/{postId}`, `POST /api/v1/posts/{postId}/views`, `GET /api/v1/posts/{postId}/comments`, `GET /api/v1/posts/{postId}/related-posts` | 대표 사진과 일러스트, 작성일을 날짜로 쓰기, 삭제되거나 가려진 글의 안내 화면 |
| 글 상세 | "댓글 10개 더 보기" | `GET /api/v1/posts/{postId}/comments`에 `cursor`를 붙인다 | 이어 붙이기 |
| 글 상세 | 좋아요 | `PUT /api/v1/posts/{postId}/like`, `DELETE /api/v1/posts/{postId}/like` | 수 바로 바꾸기 |
| 글 상세 | 댓글이나 답글 "등록" | `POST /api/v1/posts/{postId}/comments` | 빈 입력 막기, "@닉네임" 그리기 |
| 글 상세 | 댓글 수정의 "저장" | `PATCH /api/v1/comments/{commentId}` | 그 자리에서 입력창으로 바꾸기 |
| 글 상세 | 댓글의 ♡ | `PUT /api/v1/comments/{commentId}/like`, `DELETE /api/v1/comments/{commentId}/like` | 수 바로 바꾸기 |
| 글 삭제 확인 | 글 "삭제" | `DELETE /api/v1/posts/{postId}` | 완료 토스트, 목록으로 가기 |
| 글 삭제 확인 | 댓글 "삭제" | `DELETE /api/v1/comments/{commentId}` | 완료 토스트 |
| 글쓰기 · 글 수정 | "사진 추가"로 사진을 고를 때 | `POST /api/v1/images` | 썸네일, 3장까지만 받기, 순서 바꾸기 |
| 글쓰기 · 글 수정 | 모임 연결을 열 때, 카테고리를 바꿀 때 | `GET /api/v1/me/linkable-meetups` | 고른 모임의 카드 |
| 글쓰기 | "등록하기" | `POST /api/v1/posts` | 필수 항목이 찰 때까지 버튼 끄기, 저장 전 취소의 확인 |
| 글 수정 | 열 때 | `GET /api/v1/posts/{postId}` | 지금 값으로 채우기 |
| 글 수정 | "수정 완료" | `PATCH /api/v1/posts/{postId}` | 글 상세로 가기 |
| 내가 쓴 글 · 댓글 단 글 · 저장한 글 | 들어올 때, 탭이나 페이지를 바꿀 때 | `GET /api/v1/me/posts`, `GET /api/v1/me/posts/summary` | "가려진 글" 표시, "11월 9일 저장", "외 N개", 빈 상태 |
| 신고 팝업 | "신고하기" | `POST /api/v1/reports` | 대상에 맞는 제목, "기타"의 입력칸, 완료 토스트, "이미 신고했어요" |

글의 작성자나 댓글의 작성자를 눌렀을 때의 프로필 팝업은 [`GET /api/v1/users/{userId}/profile`](00-common.md#get-apiv1usersuseridprofile)을, "땅굴 놀러 가기"는 작성자의 id로 [`GET /api/v1/users/{userId}/burrow`](05-explore-visit.md#get-apiv1usersuseridburrow)를 부른다. 관심사 태그의 목록은 [`GET /api/v1/interest-categories`](00-common.md#get-apiv1interest-categories)가 준다. "모임 보기"는 [모임 상세](07-meetup.md#get-apiv1meetupsmeetupid)로 간다.

## 영역 규칙

### 글 카드

글을 목록으로 보여 주는 곳(커뮤니티, 내가 쓴 글, 댓글 단 글, 저장한 글, 다음 읽을 글)이 함께 쓰는 모양이다. 아래에서 "글 카드"라고 하면 이 값들을 가리킨다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 글의 id | `post.id` |
| `category` | enum | `PROMOTION`(모임 홍보), `REVIEW`(모임 후기), `FREE`(자유) 가운데 하나 | `post.category` |
| `title` | 문자열 | 제목 | `post_version.title`. 번호가 가장 큰 버전 |
| `contentPreview` | 문자열 | 본문의 앞 100자 | 계산: `post_version.content`의 앞 100자 |
| `thumbnailUrl` | 문자열 | 첫 사진의 주소. 사진이 없으면 `null` | `uploaded_image.image_url`. `post_image.sort_order`가 1인 사진 |
| `author` | 객체 | 작성자의 [사용자 표시](00-common.md#사용자-표시) | |
| `interestCategories` | 목록 | 글에 붙인 관심사 대분류. 없으면 `[]` | |
| `interestCategories[].id` | 숫자 | 대분류의 id | `interest_category.id` |
| `interestCategories[].name` | 문자열 | 대분류 이름 | `interest_category.name` |
| `createdAt` | 시각 | 쓴 시각 | `post.created_at` |
| `viewCount` | 숫자 | 조회수 | `post.view_count` |
| `likeCount` | 숫자 | 좋아요 수 | 계산: 그 글의 `post_like` 줄 수 |
| `commentCount` | 숫자 | 댓글 수. 댓글과 답글을 더한다 | 계산: [수를 세는 법](#수를-세는-법) |
| `isBookmarked` | 참/거짓 | 내가 저장했는지 | 계산: `post_bookmark`에 내 줄이 있는지 |
| `isHidden` | 참/거짓 | 신고로 가려진 글인지. 내가 쓴 글 목록에서만 `true`가 온다 | 계산: `post.status`가 `HIDDEN`인지 |
| `isReportedByMe` | 참/거짓 | 내가 신고한 글인지. `true`면 프론트엔드가 접어서 보여 준다 | 계산: `report`에 내가 이 글을 신고한 줄이 있는지 |

```json
{
  "id": 204,
  "category": "PROMOTION",
  "title": "토요일 아침 한강 러닝 같이 하실 분",
  "contentPreview": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
  "thumbnailUrl": "https://cdn.digguldiggul.example/images/2026/11/8f3a1c.webp",
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
  "interestCategories": [{ "id": 3, "name": "운동" }],
  "createdAt": "2026-11-19T02:30:00Z",
  "viewCount": 87,
  "likeCount": 12,
  "commentCount": 5,
  "isBookmarked": false,
  "isHidden": false,
  "isReportedByMe": false
}
```

사진이 없는 글의 일러스트, "3분 전" 같은 시간 표기, 본문 미리보기를 몇 줄 보여 줄지는 프론트엔드가 정한다.

### 댓글의 모양

댓글과 답글이 함께 쓰는 모양이다. 댓글 목록과 댓글을 쓴 뒤의 응답이 이 모양을 쓴다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 댓글의 id | `comment.id` |
| `author` | 객체 | 쓴 사람의 [사용자 표시](00-common.md#사용자-표시) | |
| `content` | 문자열 | 본문. 가려진 댓글은 `null` | `comment_version.content`. 번호가 가장 큰 버전 |
| `mentionUser` | 객체 | 답글에 다시 답했을 때 "@닉네임"으로 보여 줄 사람. 없으면 `null` | |
| `mentionUser.id` | 숫자 | 그 사람의 계정 id | `comment.mention_user_id` |
| `mentionUser.nickname` | 문자열 | 그 사람의 닉네임. 탈퇴했으면 `null` | `user_profile.nickname` |
| `createdAt` | 시각 | 쓴 시각 | `comment.created_at` |
| `isEdited` | 참/거짓 | 고친 적이 있는지. `true`면 "수정됨"을 붙인다 | 계산: `comment_version`의 줄이 둘 이상인지 |
| `likeCount` | 숫자 | 좋아요 수 | 계산: 그 댓글의 `comment_like` 줄 수 |
| `isLiked` | 참/거짓 | 내가 좋아요를 눌렀는지 | 계산: `comment_like`에 내 줄이 있는지 |
| `isMine` | 참/거짓 | 내가 쓴 댓글인지 | 계산: `comment.author_id`가 요청한 사람인지 |
| `isHidden` | 참/거짓 | 신고로 가려진 댓글인지. `true`면 "신고로 가려진 댓글이에요"를 보여 준다 | 계산: `comment.status`가 `HIDDEN`인지 |
| `isReportedByMe` | 참/거짓 | 내가 신고한 댓글인지. `true`면 접어서 보여 준다 | 계산: `report`에 내가 이 댓글을 신고한 줄이 있는지 |

더보기(⋯)의 메뉴는 `isMine`으로 정한다. 내 댓글이면 수정과 삭제, 남의 댓글이면 신고다. 가려진 댓글은 내 것이어도 수정을 보여 주지 않는다.

### 글과 댓글의 상태

글(`post.status`)과 댓글(`comment.status`)은 `PUBLIC`(공개), `HIDDEN`(가려짐), `DELETED`(삭제) 가운데 하나다.

| 상태 | 글 | 댓글 |
|---|---|---|
| `PUBLIC` | 모든 목록과 상세에 나온다 | 댓글 목록에 나온다 |
| `HIDDEN` | 작성자의 내가 쓴 글 목록과, 작성자가 여는 글 상세에만 나온다. 그 밖의 사람이 열면 `404`와 `POST_HIDDEN` | 댓글 목록의 그 자리에 본문 없이 나온다. 달린 답글은 그대로 나온다 |
| `DELETED` | 어디에도 나오지 않는다. 열면 `404`와 `POST_NOT_FOUND` | 어디에도 나오지 않는다 |

- 서로 다른 3명이 신고하면 가려진다([`POST /api/v1/reports`](#post-apiv1reports)). 관리자가 복구하면 `PUBLIC`으로 돌아온다.
- 가려진 글의 작성자는 그 글을 열어 보거나 지울 수 있고 고칠 수는 없다. 가려진 댓글도 같다.
- 없는 글과 삭제된 글은 구분하지 않고 `POST_NOT_FOUND`로 답한다. 프론트엔드는 `POST_NOT_FOUND`에 "삭제된 글이에요", `POST_HIDDEN`에 "신고로 가려진 글이에요"를 보여 준다.
- 가려지거나 삭제된 글에는 좋아요, 저장, 댓글, 조회수 올리기를 할 수 없다. 작성자가 불러도 같다.
- 글을 지우면 그 글의 댓글과 답글이 모두 `DELETED`가 된다. 댓글을 지우면 달린 답글이 모두 `DELETED`가 된다.

### 고치고 지울 때

- 글의 제목과 본문, 댓글의 본문은 고칠 때마다 `post_version`, `comment_version`에 새 줄을 더한다. 응답에는 번호가 가장 큰 버전만 담는다. 고치기 전의 내용은 관리자만 본다([DB 설계](../db/community.md)).
- 버전이 둘 이상이면 `isEdited`가 `true`다. 글의 카테고리, 태그, 사진, 연결한 모임만 바꾸면 버전이 늘지 않아 `isEdited`가 바뀌지 않는다.
- 지우면 바로 `DELETED`가 되어 응답에서 빠진다. 보관하던 내용은 2주 뒤에 서버가 지운다([서버가 스스로 하는 일](#서버가-스스로-하는-일)).

### 수를 세는 법

| 값 | 세는 법 |
|---|---|
| 댓글 수 | 그 글의 댓글과 답글 가운데 `DELETED`가 아닌 것. 가려진 댓글은 센다 |
| 좋아요 수 | 그 글이나 댓글에 눌린 좋아요 |
| 인기 점수 | 최근 7일 동안 그 글이 받은 좋아요의 수. 인기순 정렬, 이번 주 인기 글 TOP5, 다음 읽을 글이 쓴다 |

- 인기 점수에는 좋아요만 센다. 댓글과 저장은 세지 않는다.
- "최근 7일"은 요청한 때부터 거꾸로 168시간이다. `post_like.created_at`이 그 안에 드는 줄을 센다. 취소한 좋아요는 줄이 없으므로 세지 않는다.
- 일주일 넘게 좋아요를 받지 않은 글은 0점이다. 점수가 같은 글끼리는 새로 쓴 글이 먼저다.

### 내가 신고한 글과 댓글

내가 신고한 글과 댓글은 가려지기 전까지 나에게만 접힌 채로 보인다. 서버는 `isReportedByMe`로 알려 주기만 하고 내용은 그대로 준다. 접어서 보여 주고 펼치는 것은 프론트엔드가 한다.

### 사진

- 글의 사진은 먼저 [`POST /api/v1/images`](#post-apiv1images)로 한 장씩 올려 `imageId`를 받고, 글을 쓰거나 고칠 때 `imageIds`로 붙인다.
- 글 하나에 3장까지다. `imageIds`의 순서가 보여 주는 순서이고 첫 장이 대표 사진이다.
- 올릴 수 있는 것은 JPEG, PNG, WebP이고 한 장에 5MB까지다.
- 다른 사람이 올린 사진이나, 이미 글이나 채팅 메시지에 붙은 사진의 `imageId`는 쓸 수 없다.
- 채팅 메시지의 사진도 같은 API로 올린다([채팅 API](06-chat.md#메시지)).

### 글에 연결하는 모임

| 글의 카테고리 | 모임 연결 | 고를 수 있는 모임 |
|---|---|---|
| `PROMOTION` | 꼭 있어야 한다 | 내가 연 모임 가운데 모집 중인 것([모집 상태](07-meetup.md#모집-상태)가 `OPEN`) |
| `REVIEW` | 꼭 있어야 한다 | 내가 열었거나 참여가 확정된 모임 가운데 지난 모임([모집 상태](07-meetup.md#모집-상태)가 `PAST`). 예정 모임과 취소된 모임은 안 된다 |
| `FREE` | 없어도 된다 | 내가 열었거나 참여가 확정된 모임. 지난 모임도 된다. 취소된 모임은 안 된다 |

- 참여가 확정된 모임은 [내 상태](07-meetup.md#내-상태)가 `CONFIRMED`인 모임이다. 신청해 기다리는 모임, 참여를 취소했거나 내보내진 모임은 아니다.
- 모임 후기는 내가 열었거나 참여가 확정된 지난 모임에만 쓴다. 지난 모임은 시작 시각이 지난 모임이다. 그런 모임이 하나도 없으면 모임 후기 글을 쓸 수 없다.
- 고를 수 있는 모임은 [`GET /api/v1/me/linkable-meetups`](#get-apiv1melinkable-meetups)가 준다.
- 글 상세에는 연결한 모임을 [모임 카드](07-meetup.md#모임-카드)로 준다. 글을 쓴 뒤에 모임이 모집 완료가 되거나 취소돼도 연결은 그대로이고, 카드의 `recruitStatus`가 바뀐다. 모임이 삭제되면 카드가 `null`이 된다.

### 알림

이 영역에서 알림을 만드는 때는 아래와 같다. 알림의 종류와 모양, 받는 사람의 알림 설정을 따르는 것은 [알림 API](09-notification.md#알림의-종류)에 있다. 자기 글이나 자기 댓글에 한 일에는 알림을 만들지 않는다.

| 때 | 받는 사람 |
|---|---|
| 글에 댓글이 달림 | 글 작성자 |
| 댓글에 답글이 달림 | 답한 대상인 댓글이나 답글의 작성자 |
| 글에 좋아요가 눌림 | 글 작성자 |
| 댓글이나 답글에 좋아요가 눌림 | 그 댓글의 작성자 |
| 글이 신고로 가려짐 | 글 작성자 |
| 댓글이 신고로 가려짐 | 댓글 작성자 |
| 방명록 글이 신고로 가려짐 | 그 글을 쓴 사람 |

### 서버가 스스로 하는 일

- 삭제한 글과 댓글은 `deleted_at`에서 2주가 지나면 모든 버전을 지운다. 글이면 사진도 지운다.
- 올려 두고 어느 글이나 메시지에도 붙이지 않은 사진을 지운다. 언제 지우는지는 구현 단계에서 정한다.

이 일들을 부르는 API는 없다.

## GET /api/v1/posts

글 목록을 준다. 커뮤니티에 들어올 때와, 카테고리 탭 · "내 관심사만" · 관심사 칩 · 정렬 · 검색어 · 페이지를 바꿀 때마다 부른다.

- 로그인: 필요
- 명세: 커뮤니티 4 ~ 9 · 11, 글 상세 9

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `category` | enum | | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나. 보내지 않으면 전체다 |
| 쿼리 | `isMyInterestsOnly` | 참/거짓 | | `true`면 내 관심사가 속한 대분류의 태그가 달린 글만 준다. 보내지 않으면 `false` |
| 쿼리 | `interestCategoryId` | 숫자 | | 이 관심사 대분류의 태그가 달린 글만 준다 |
| 쿼리 | `keyword` | 문자열 | | 검색어. 제목, 본문, 작성자 닉네임에서 찾는다. 50자 이하. 보내지 않거나 빈 문자열이면 검색하지 않는다 |
| 쿼리 | `sort` | enum | | `LATEST`(최신순), `POPULAR`(인기순), `MOST_COMMENTED`(댓글순) 가운데 하나. 보내지 않으면 `LATEST` |
| 쿼리 | `page` | 숫자 | | 페이지 번호. 1부터 세고 보내지 않으면 1 |
| 쿼리 | `size` | 숫자 | | 한 페이지의 글 수. 1 ~ 50. 보내지 않으면 20 |

```text
GET /api/v1/posts?category=PROMOTION&isMyInterestsOnly=true&interestCategoryId=3&keyword=러닝&sort=LATEST&page=1&size=20
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [글 카드](#글-카드)의 목록 | |
| `page` | 숫자 | 지금 페이지 | 계산: 요청의 `page` |
| `size` | 숫자 | 한 페이지의 글 수 | 계산: 요청의 `size` |
| `totalItems` | 숫자 | 조건에 맞는 글의 수 | 계산: 조건에 맞는 `post` 줄 수 |
| `totalPages` | 숫자 | 전체 페이지 수 | 계산: `totalItems`를 `size`로 나눠 올린 값 |

### 주는 방식

- `post.status`가 `PUBLIC`인 글만 준다. 그래서 `isHidden`은 늘 `false`다.
- 조건은 모두 함께 적용한다.
- `isMyInterestsOnly`는 내 세부 관심사(`user_interest`)가 속한 대분류 가운데 하나라도 글의 태그(`post_interest`)에 있으면 맞는 글로 본다.
- `interestCategoryId`는 "많이 이야기하는 관심사" 칩과, 글 상세에서 관심사 태그를 눌렀을 때 쓴다. 대분류 12개 가운데 어느 것이든 보낼 수 있다.
- `keyword`는 앞뒤 공백을 지운 뒤 번호가 가장 큰 버전의 제목과 본문, 작성자의 닉네임에 그 글자가 들어 있는 글을 찾는다. 띄어쓰기를 포함한 문자열 전체를 한 덩어리로 찾고, `%`와 `_`도 글자 그대로 찾는다. 영어 대소문자는 구분하지 않는다. 지운 뒤 비어 있으면 검색하지 않는다.
- 순서는 아래와 같다. 같으면 새로 쓴 글을 먼저 준다.

| `sort` | 순서 |
|---|---|
| `LATEST` | `post.created_at`이 늦은 것부터 |
| `POPULAR` | [인기 점수](#수를-세는-법)가 높은 것부터 |
| `MOST_COMMENTED` | 댓글 수가 많은 것부터 |

- 페이지 방식이다. 없는 페이지를 부르면 `items`가 빈 목록이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 204,
        "category": "PROMOTION",
        "title": "토요일 아침 한강 러닝 같이 하실 분",
        "contentPreview": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
        "thumbnailUrl": "https://cdn.digguldiggul.example/images/2026/11/8f3a1c.webp",
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
        "interestCategories": [{ "id": 3, "name": "운동" }],
        "createdAt": "2026-11-19T02:30:00Z",
        "viewCount": 87,
        "likeCount": 12,
        "commentCount": 5,
        "isBookmarked": false,
        "isHidden": false,
        "isReportedByMe": false
      }
    ],
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/posts/highlights

커뮤니티 목록 옆에 보여 주는 이번 주 인기 글 TOP5와 많이 이야기하는 관심사를 준다. 커뮤니티에 들어올 때 부른다.

- 로그인: 필요
- 명세: 커뮤니티 10 · 11

### 요청

없다.

```text
GET /api/v1/posts/highlights
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `weeklyTopPosts` | 목록 | 이번 주 인기 글. 5개까지 | |
| `weeklyTopPosts[].rank` | 숫자 | 순위. 1부터 | 계산: 인기 점수의 순서 |
| `weeklyTopPosts[].id` | 숫자 | 글의 id | `post.id` |
| `weeklyTopPosts[].category` | enum | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나 | `post.category` |
| `weeklyTopPosts[].title` | 문자열 | 제목 | `post_version.title`. 번호가 가장 큰 버전 |
| `trendingInterestCategories` | 목록 | 많이 이야기하는 관심사 대분류. 8개까지 | |
| `trendingInterestCategories[].id` | 숫자 | 대분류의 id. 글 목록의 `interestCategoryId`에 보낸다 | `interest_category.id` |
| `trendingInterestCategories[].name` | 문자열 | 대분류 이름 | `interest_category.name` |

### 주는 방식

- 인기 글은 공개 글 가운데 [인기 점수](#수를-세는-법)가 높은 5개다. 점수가 같으면 새로 쓴 글이 먼저다. 점수가 0인 글은 주지 않으므로 5개보다 적을 수 있다.
- 많이 이야기하는 관심사는 최근 7일에 쓴 공개 글의 태그를 대분류별로 세어 글이 많은 8개를 준다. 글 수가 같으면 `interest_category.id`가 작은 것이 먼저다. 글이 없는 대분류는 주지 않는다.
- 많이 이야기하는 관심사의 "최근 7일"도 요청한 때부터 거꾸로 168시간이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "weeklyTopPosts": [
      { "rank": 1, "id": 204, "category": "PROMOTION", "title": "토요일 아침 한강 러닝 같이 하실 분" },
      { "rank": 2, "id": 198, "category": "REVIEW", "title": "알고리즘 스터디 4주 후기" },
      { "rank": 3, "id": 201, "category": "FREE", "title": "5층 라운지 커피머신 쓰는 법" }
    ],
    "trendingInterestCategories": [
      { "id": 3, "name": "운동" },
      { "id": 1, "name": "음악" }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/posts

글을 쓴다. 글쓰기의 "등록하기"가 부른다.

- 로그인: 필요
- 명세: 글쓰기 1 ~ 7

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `category` | enum | ✓ | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나 |
| 본문 | `title` | 문자열 | ✓ | 제목. 1 ~ 50자. 공백만으로는 안 된다 |
| 본문 | `content` | 문자열 | ✓ | 본문. 1 ~ 1,000자. 공백만으로는 안 된다 |
| 본문 | `interestCategoryIds` | 목록 | ✓ | 관심사 대분류의 id. 0 ~ 5개이고 같은 id를 두 번 넣지 않는다. 붙이지 않으면 `[]` |
| 본문 | `imageIds` | 목록 | ✓ | 붙일 사진의 id. 0 ~ 3개. 보낸 순서로 보여 주고 첫 장이 대표 사진이다. 없으면 `[]` |
| 본문 | `meetupId` | 숫자 | | 연결할 모임의 id. `PROMOTION`과 `REVIEW`면 꼭 보낸다. 연결하지 않으면 `null` |

```text
POST /api/v1/posts
```

```json
{
  "category": "PROMOTION",
  "title": "토요일 아침 한강 러닝 같이 하실 분",
  "content": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
  "interestCategoryIds": [3],
  "imageIds": [512, 513],
  "meetupId": 19
}
```

### 서버가 하는 일

1. 입력값의 모양과 범위를 본다. 없는 대분류의 id, [쓸 수 없는 사진](#사진)의 id도 여기서 본다. 어긋나면 `400`과 `INVALID_INPUT`.
2. `meetupId`가 있으면 그 모임을 찾는다. 없거나 삭제됐으면 `404`와 `MEETUP_NOT_FOUND`.
3. 그 모임이 [고를 수 있는 모임](#글에-연결하는-모임)이 아니면 `409`와 `MEETUP_NOT_LINKABLE`.
4. `post`에 한 줄을 만든다. `author_id`는 요청한 사람, `status`는 `PUBLIC`, `view_count`는 0이다.
5. `post_version`에 `version`이 1인 줄을 만들어 제목과 본문을 넣는다.
6. `post_interest`에 태그마다 한 줄, `post_image`에 사진마다 한 줄을 만든다. `image_id`는 그 사진의 id, `sort_order`는 `imageIds`의 순서대로 1부터다.

4 ~ 6은 한 번에 처리한다. 알림은 만들지 않는다.

### 응답 `data`

성공하면 `201`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `postId` | 숫자 | 만든 글의 id | `post.id` |

프론트엔드는 이 글의 상세로 간다.

### 응답 예시

```json
{
  "success": true,
  "data": { "postId": 204 },
  "error": null
}
```

모임 홍보 글에 모집이 끝난 모임을 연결했을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEETUP_NOT_LINKABLE",
    "message": "이 글에 연결할 수 없는 모임입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `MEETUP_NOT_FOUND` | 연결하려는 모임이 없거나 삭제됨 |
| `409` | `MEETUP_NOT_LINKABLE` | 그 카테고리의 글에 연결할 수 없는 모임. 모임 홍보인데 내가 연 모임이 아니거나 모집 중이 아닐 때, 모임 후기인데 내가 열지도 참여하지도 않았거나 지난 모임이 아니거나 취소된 모임일 때, 자유인데 내가 열지도 참여하지도 않았거나 취소된 모임일 때 |

`PROMOTION`이나 `REVIEW`인데 `meetupId`가 없으면 `400`과 `INVALID_INPUT`이다.

## GET /api/v1/posts/{postId}

글 하나의 본문과 그 글에서의 내 상태를 준다. 글 상세를 열 때와 글 수정 화면을 열 때 부른다. 댓글은 [`GET /api/v1/posts/{postId}/comments`](#get-apiv1postspostidcomments)가 따로 준다.

- 로그인: 필요
- 명세: 글 상세 2 ~ 9 · 16 · 17, 글 수정 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
GET /api/v1/posts/204
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 글의 id | `post.id` |
| `category` | enum | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나 | `post.category` |
| `title` | 문자열 | 제목 | `post_version.title`. 번호가 가장 큰 버전 |
| `content` | 문자열 | 본문 | `post_version.content`. 번호가 가장 큰 버전 |
| `images` | 목록 | 사진. 보여 주는 순서대로이고 첫 장이 대표 사진이다. 없으면 `[]` | |
| `images[].id` | 숫자 | 사진의 id. 글을 고칠 때 `imageIds`에 보낸다 | `post_image.image_id` |
| `images[].url` | 문자열 | 사진의 주소 | `uploaded_image.image_url` |
| `author` | 객체 | 작성자의 [사용자 표시](00-common.md#사용자-표시) | |
| `authorSharedInterests` | 목록 | 작성자의 관심사 가운데 나와 겹치는 것. [관심사 태그](00-common.md#관심사-태그)의 목록이다. 내 글이면 `[]` | |
| `interestCategories` | 목록 | 글에 붙인 관심사 대분류. 없으면 `[]` | |
| `interestCategories[].id` | 숫자 | 대분류의 id | `interest_category.id` |
| `interestCategories[].name` | 문자열 | 대분류 이름 | `interest_category.name` |
| `meetup` | 객체 | 글에 연결한 모임의 [모임 카드](07-meetup.md#모임-카드). 연결하지 않았거나 모임이 삭제됐으면 `null` | |
| `createdAt` | 시각 | 쓴 시각 | `post.created_at` |
| `isEdited` | 참/거짓 | 제목이나 본문을 고친 적이 있는지. `true`면 "수정됨"을 붙인다 | 계산: `post_version`의 줄이 둘 이상인지 |
| `viewCount` | 숫자 | 조회수 | `post.view_count` |
| `likeCount` | 숫자 | 좋아요 수 | 계산: 그 글의 `post_like` 줄 수 |
| `commentCount` | 숫자 | 댓글 수. 댓글과 답글을 더한다 | 계산: [수를 세는 법](#수를-세는-법) |
| `isLiked` | 참/거짓 | 내가 좋아요를 눌렀는지 | 계산: `post_like`에 내 줄이 있는지 |
| `isBookmarked` | 참/거짓 | 내가 저장했는지 | 계산: `post_bookmark`에 내 줄이 있는지 |
| `isMine` | 참/거짓 | 내가 쓴 글인지 | 계산: `post.author_id`가 요청한 사람인지 |
| `isHidden` | 참/거짓 | 신고로 가려진 글인지. 작성자에게만 `true`가 온다 | 계산: `post.status`가 `HIDDEN`인지 |
| `isReportedByMe` | 참/거짓 | 내가 신고한 글인지 | 계산: `report`에 내가 이 글을 신고한 줄이 있는지 |
| `canEdit` | 참/거짓 | 지금 이 글을 고칠 수 있는지 | 계산: 내 글이고 가려지지 않았는지 |

### 주는 방식

- 공개 글은 누구에게나 준다. 가려진 글은 작성자에게만 주고, 삭제된 글은 누구에게도 주지 않는다([글과 댓글의 상태](#글과-댓글의-상태)).
- 더보기(⋯)의 메뉴는 `isMine`으로 정한다. 내 글이면 수정과 삭제, 남의 글이면 신고다. 수정은 `canEdit`이 `false`면 보여 주지 않는다.
- 이 API는 조회수를 올리지 않는다. 글 상세를 열 때 프론트엔드가 [`POST /api/v1/posts/{postId}/views`](#post-apiv1postspostidviews)를 함께 부른다. 글 수정 화면을 열 때는 부르지 않는다.
- 관심사 태그를 누르면 프론트엔드가 커뮤니티 목록으로 가서 [`GET /api/v1/posts`](#get-apiv1posts)에 그 대분류의 `interestCategoryId`를 보낸다. 카테고리 태그를 누르면 `category`를 보낸다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "id": 204,
    "category": "PROMOTION",
    "title": "토요일 아침 한강 러닝 같이 하실 분",
    "content": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
    "images": [
      { "id": 512, "url": "https://cdn.digguldiggul.example/images/2026/11/8f3a1c.webp" },
      { "id": 513, "url": "https://cdn.digguldiggul.example/images/2026/11/27b0de.webp" }
    ],
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
    "authorSharedInterests": [
      { "id": 12, "name": "러닝", "interestCategoryId": 3, "isShared": true }
    ],
    "interestCategories": [{ "id": 3, "name": "운동" }],
    "meetup": {
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
    "createdAt": "2026-11-19T02:30:00Z",
    "isEdited": false,
    "viewCount": 87,
    "likeCount": 12,
    "commentCount": 5,
    "isLiked": true,
    "isBookmarked": false,
    "isMine": false,
    "isHidden": false,
    "isReportedByMe": false,
    "canEdit": false
  },
  "error": null
}
```

신고로 가려진 글을 작성자가 아닌 사람이 열었을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "POST_HIDDEN",
    "message": "신고로 가려진 글입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글을 작성자가 아닌 사람이 엶 |

## PATCH /api/v1/posts/{postId}

글을 고친다. 글 수정의 "수정 완료"가 부른다. 작성자만 할 수 있고, 가려진 글은 고칠 수 없다.

- 로그인: 필요
- 명세: 글 수정 2 · 3, 신고 팝업 4

### 요청

아래 값을 모두 보낸다. 바꾸지 않은 값도 지금 값을 담는다. 하나라도 빠지면 `400`과 `INVALID_INPUT`이다. 값마다의 범위는 [글쓰기](#post-apiv1posts)와 같다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |
| 본문 | `category` | enum | ✓ | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나 |
| 본문 | `title` | 문자열 | ✓ | 제목. 1 ~ 50자 |
| 본문 | `content` | 문자열 | ✓ | 본문. 1 ~ 1,000자 |
| 본문 | `interestCategoryIds` | 목록 | ✓ | 관심사 대분류의 id. 0 ~ 5개 |
| 본문 | `imageIds` | 목록 | ✓ | 붙일 사진의 id. 0 ~ 3개. 그대로 둘 사진은 글 상세의 `images[].id`를, 새 사진은 새로 올려 받은 id를 보낸다 |
| 본문 | `meetupId` | 숫자 | ✓ | 연결할 모임의 id. 연결하지 않으면 `null`. `PROMOTION`과 `REVIEW`는 `null`일 수 없다 |

```text
PATCH /api/v1/posts/204
```

```json
{
  "category": "PROMOTION",
  "title": "토요일 아침 한강 러닝 같이 하실 분 (2자리 남음)",
  "content": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
  "interestCategoryIds": [3],
  "imageIds": [512],
  "meetupId": 19
}
```

### 서버가 하는 일

1. `post`에서 그 글을 찾는다. 없거나 삭제됐으면 `404`와 `POST_NOT_FOUND`.
2. 내가 작성자가 아니면 `403`과 `FORBIDDEN`.
3. 가려진 글이면 `409`와 `POST_EDIT_NOT_ALLOWED`.
4. 입력값의 모양과 범위를 본다. 어긋나면 `400`과 `INVALID_INPUT`.
5. `meetupId`나 `category`가 지금 값과 다르면, 보낸 모임이 보낸 카테고리에서 [고를 수 있는 모임](#글에-연결하는-모임)인지 본다. 없는 모임이면 `404`와 `MEETUP_NOT_FOUND`, 고를 수 없는 모임이면 `409`와 `MEETUP_NOT_LINKABLE`. 예정 모임을 연결한 자유 글을 모임 후기로 바꾸면 여기에 걸린다. 모임도 카테고리도 바꾸지 않았으면 그 모임이 그사이 모집 완료가 됐더라도 검사하지 않는다.
6. 제목이나 본문이 달라졌으면 `post_version`에 다음 번호의 줄을 더한다. 달라지지 않았으면 더하지 않는다.
7. `post.category`와 `post.meetup_id`를 보낸 값으로 바꾼다. `post_interest`와 `post_image`를 보낸 목록에 맞춘다. 목록에서 빠진 사진은 글에서 뗀다.

6과 7은 한 번에 처리한다. 알림은 만들지 않는다.

### 응답 `data`

`null`이다. 프론트엔드는 글 상세로 돌아가 다시 조회한다.

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
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `MEETUP_NOT_FOUND` | 새로 연결하려는 모임이 없거나 삭제됨 |
| `409` | `POST_EDIT_NOT_ALLOWED` | 신고로 가려진 글 |
| `409` | `MEETUP_NOT_LINKABLE` | 모임이나 카테고리를 바꿨는데, 보낸 모임이 보낸 카테고리의 글에 연결할 수 없는 모임 |

작성자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## DELETE /api/v1/posts/{postId}

글을 지운다. 글 삭제 확인의 "삭제"가 부른다. 달린 댓글과 답글도 함께 지워진다.

- 로그인: 필요
- 명세: 글 삭제 확인 1 · 2, 내가 쓴 글 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
DELETE /api/v1/posts/204
```

### 서버가 하는 일

1. `post`에서 그 글을 찾는다. 없거나 이미 삭제됐으면 `404`와 `POST_NOT_FOUND`.
2. 내가 작성자가 아니면 `403`과 `FORBIDDEN`.
3. `post.status`를 `DELETED`로 바꾸고 `deleted_at`을 지금 시각으로 채운다.
4. 그 글의 댓글과 답글 가운데 `DELETED`가 아닌 것을 모두 `DELETED`로 바꾸고 `deleted_at`을 채운다.

3과 4는 한 번에 처리한다. 가려진 글도 지울 수 있다. 좋아요와 저장의 줄은 지우지 않는다. 삭제된 글은 어느 목록에도 나오지 않으므로 수에 들지 않는다.

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
| `404` | `POST_NOT_FOUND` | 없는 글이거나 이미 삭제된 글 |

작성자가 아니면 공통 에러 `403 FORBIDDEN`이다.

## POST /api/v1/posts/{postId}/views

글의 조회수를 1 올린다. 글 상세를 열 때 프론트엔드가 글 조회와 함께 부른다. 조회하는 API가 데이터를 바꾸지 않게 하려고 따로 두었다.

- 로그인: 필요
- 명세: 글 상세 6

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
POST /api/v1/posts/204/views
```

### 서버가 하는 일

1. `post`에서 그 글을 찾는다. 없거나 삭제됐으면 `404`와 `POST_NOT_FOUND`, 가려졌으면 `404`와 `POST_HIDDEN`.
2. `post.view_count`에 1을 더한다.

열 때마다 센다. 같은 사람이 여러 번 열어도, 작성자가 자기 글을 열어도 센다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `viewCount` | 숫자 | 올린 뒤의 조회수 | `post.view_count` |

### 응답 예시

```json
{
  "success": true,
  "data": { "viewCount": 88 },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글 |

## GET /api/v1/posts/{postId}/related-posts

글 상세 아래의 "다음 읽을 글" 3개를 준다. 글 상세를 열 때 부른다.

- 로그인: 필요
- 명세: 글 상세 14

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 지금 보고 있는 글의 id |

```text
GET /api/v1/posts/204/related-posts
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [글 카드](#글-카드)의 목록. 3개까지 | |

### 주는 방식

- 지금 보고 있는 글의 태그와 대분류가 하나라도 같은 공개 글 가운데 [인기 점수](#수를-세는-법)가 높은 3개를 준다. 점수가 같으면 새로 쓴 글이 먼저다.
- 지금 보고 있는 글은 뺀다.
- 지금 보고 있는 글에 태그가 없으면 모든 공개 글에서 고른다.
- 맞는 글이 3개보다 적으면 있는 만큼만 준다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 187,
        "category": "REVIEW",
        "title": "지난주 클라이밍 모임 다녀왔어요",
        "contentPreview": "처음 가 봤는데 생각보다 훨씬 재밌었습니다. 초보자 코스부터 차근차근 알려 주셔서 겁먹지 않고 올라갔어요.",
        "thumbnailUrl": null,
        "author": {
          "id": 44,
          "nickname": "모카",
          "profileImageUrl": null,
          "mole": { "head": null, "face": null, "neck": null, "hand": "COFFEE_CUP" },
          "campusName": "대전",
          "generation": 15,
          "floor": 1,
          "isWithdrawn": false
        },
        "interestCategories": [{ "id": 3, "name": "운동" }],
        "createdAt": "2026-11-12T09:10:00Z",
        "viewCount": 143,
        "likeCount": 21,
        "commentCount": 8,
        "isBookmarked": true,
        "isHidden": false,
        "isReportedByMe": false
      }
    ]
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글을 작성자가 아닌 사람이 부름 |

## PUT /api/v1/posts/{postId}/like

글에 좋아요를 누른다. 글 상세 액션 레일의 좋아요가 부른다.

- 로그인: 필요
- 명세: 글 상세 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
PUT /api/v1/posts/204/like
```

### 서버가 하는 일

1. `post`에서 그 글을 찾는다. 없거나 삭제됐으면 `404`와 `POST_NOT_FOUND`, 가려졌으면 `404`와 `POST_HIDDEN`.
2. `post_like`에 한 줄을 만든다. 이미 누른 글이면 바꾸지 않고 성공으로 답한다.
3. 새로 줄을 만들었고 내 글이 아니면, 글 작성자에게 좋아요 알림을 만든다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `true` | 계산: `post_like`에 내 줄이 있는지 |
| `likeCount` | 숫자 | 누른 뒤의 좋아요 수 | 계산: 그 글의 `post_like` 줄 수 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": true, "likeCount": 13 },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글 |

## DELETE /api/v1/posts/{postId}/like

글의 좋아요를 취소한다. 좋아요를 다시 누를 때 부른다.

- 로그인: 필요
- 명세: 글 상세 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
DELETE /api/v1/posts/204/like
```

### 서버가 하는 일

1. `post_like`에서 내 줄을 지운다. 누르지 않은 글이면 바꾸지 않고 성공으로 답한다.

이미 만든 좋아요 알림은 지우지 않는다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `false` | 계산: `post_like`에 내 줄이 있는지 |
| `likeCount` | 숫자 | 취소한 뒤의 좋아요 수 | 계산: 그 글의 `post_like` 줄 수 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": false, "likeCount": 12 },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PUT /api/v1/posts/{postId}/bookmark

글을 저장한다. 글 카드와 글 상세의 북마크 아이콘이 부른다.

- 로그인: 필요
- 명세: 커뮤니티 7, 글 상세 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
PUT /api/v1/posts/204/bookmark
```

### 서버가 하는 일

1. `post`에서 그 글을 찾는다. 없거나 삭제됐으면 `404`와 `POST_NOT_FOUND`, 가려졌으면 `404`와 `POST_HIDDEN`.
2. `post_bookmark`에 한 줄을 만든다. 이미 저장한 글이면 바꾸지 않고 성공으로 답한다.

알림은 만들지 않는다. 내 글도 저장할 수 있다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isBookmarked` | 참/거짓 | 항상 `true` | 계산: `post_bookmark`에 내 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isBookmarked": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글 |

## DELETE /api/v1/posts/{postId}/bookmark

글의 저장을 취소한다. 북마크 아이콘을 다시 누를 때와 저장한 글 목록의 저장 아이콘이 부른다.

- 로그인: 필요
- 명세: 커뮤니티 7, 글 상세 3, 저장한 글 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |

```text
DELETE /api/v1/posts/204/bookmark
```

### 서버가 하는 일

1. `post_bookmark`에서 내 줄을 지운다. 저장하지 않은 글이면 바꾸지 않고 성공으로 답한다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isBookmarked` | 참/거짓 | 항상 `false` | 계산: `post_bookmark`에 내 줄이 있는지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isBookmarked": false },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/posts/{postId}/comments

글의 댓글과 답글을 준다. 글 상세를 열 때와 "댓글 10개 더 보기"를 누를 때 부른다.

- 로그인: 필요
- 명세: 글 상세 10 · 11 · 13

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |
| 쿼리 | `size` | 숫자 | | 한 번에 받을 댓글 수. 답글은 세지 않는다. 1 ~ 100. 보내지 않으면 10 |
| 쿼리 | `cursor` | 문자열 | | 앞 응답의 `nextCursor`. 처음에는 보내지 않는다 |

```text
GET /api/v1/posts/204/comments?size=10
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 댓글의 목록. 줄마다 [댓글의 모양](#댓글의-모양)에 `replies`를 더한 것이다 | |
| `items[].replies` | 목록 | 그 댓글에 달린 답글. [댓글의 모양](#댓글의-모양)의 목록이다. 없으면 `[]` | |
| `nextCursor` | 문자열 | 다음 댓글을 받을 때 보낼 값. 더 없으면 `null` | 계산: 마지막으로 준 댓글의 자리 |
| `hasNext` | 참/거짓 | 더 받을 댓글이 있는지 | 계산: 마지막으로 준 댓글 뒤에 댓글이 더 있는지 |

### 주는 방식

- 댓글(답글이 아닌 것)을 등록한 순서(`comment.created_at`이 이른 것부터)로 `size`개씩 준다. 정렬은 바꿀 수 없다.
- 댓글마다 그 댓글의 답글을 모두 붙여 준다. 답글도 등록한 순서다. 답글은 `size`에 세지 않는다.
- `DELETED`인 댓글과 답글은 주지 않는다. `HIDDEN`인 댓글은 그 자리에 `isHidden`이 `true`, `content`가 `null`인 채로 주고, 달린 답글은 그대로 준다.
- 커서 방식이다.
- 답글에는 `mentionUser`가 올 수 있다. 댓글에는 늘 `null`이다.
- 댓글 단 글에서 "내 댓글 한 줄"을 눌러 왔을 때는, 프론트엔드가 그 댓글이 나올 때까지 이어 받아 그 자리로 간다.
- 전체 댓글 수는 글 상세의 `commentCount`를 쓴다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 901,
        "author": {
          "id": 12,
          "nickname": "새벽산책",
          "profileImageUrl": null,
          "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
          "campusName": "서울",
          "generation": 14,
          "floor": 3,
          "isWithdrawn": false
        },
        "content": "몇 시에 끝나나요?",
        "mentionUser": null,
        "createdAt": "2026-11-19T03:02:00Z",
        "isEdited": false,
        "likeCount": 2,
        "isLiked": false,
        "isMine": false,
        "isHidden": false,
        "isReportedByMe": false,
        "replies": [
          {
            "id": 903,
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
            "content": "9시쯤 끝나요!",
            "mentionUser": null,
            "createdAt": "2026-11-19T03:10:00Z",
            "isEdited": false,
            "likeCount": 1,
            "isLiked": true,
            "isMine": false,
            "isHidden": false,
            "isReportedByMe": false
          },
          {
            "id": 907,
            "author": {
              "id": 12,
              "nickname": "새벽산책",
              "profileImageUrl": null,
              "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
              "campusName": "서울",
              "generation": 14,
              "floor": 3,
              "isWithdrawn": false
            },
            "content": "감사합니다. 신청할게요.",
            "mentionUser": { "id": 31, "nickname": "두더지왕" },
            "createdAt": "2026-11-19T03:15:00Z",
            "isEdited": true,
            "likeCount": 0,
            "isLiked": false,
            "isMine": false,
            "isHidden": false,
            "isReportedByMe": false
          }
        ]
      }
    ],
    "nextCursor": null,
    "hasNext": false
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글을 작성자가 아닌 사람이 부름 |

## POST /api/v1/posts/{postId}/comments

댓글이나 답글을 쓴다. 글 상세의 댓글 입력과, 댓글의 "답글"을 눌러 연 입력창이 부른다.

- 로그인: 필요
- 명세: 글 상세 10 · 13

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `postId` | 숫자 | ✓ | 글의 id |
| 본문 | `content` | 문자열 | ✓ | 본문. 1 ~ 300자. 공백만으로는 안 된다 |
| 본문 | `replyToCommentId` | 숫자 | | 답글이면 답하는 대상의 id. 댓글에 답하면 그 댓글의 id, 답글에 다시 답하면 그 답글의 id다. 댓글을 쓸 때는 `null` |

```text
POST /api/v1/posts/204/comments
```

```json
{ "content": "감사합니다. 신청할게요.", "replyToCommentId": 903 }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 어긋나면 `400`과 `INVALID_INPUT`.
2. `post`에서 그 글을 찾는다. 없거나 삭제됐으면 `404`와 `POST_NOT_FOUND`, 가려졌으면 `404`와 `POST_HIDDEN`.
3. `replyToCommentId`가 있으면 그 댓글을 찾는다. 이 글의 댓글이 아니거나, 삭제됐거나, 가려졌으면 `404`와 `COMMENT_NOT_FOUND`.
4. `comment`에 한 줄을 만든다. `status`는 `PUBLIC`이다. `parent_id`와 `mention_user_id`는 아래처럼 정한다.

| 쓰는 것 | `parent_id` | `mention_user_id` |
|---|---|---|
| 댓글 | `NULL` | `NULL` |
| 댓글에 답글 | 그 댓글 | `NULL` |
| 답글에 다시 답글 | 그 답글이 달린 댓글 | 그 답글의 작성자 |

5. `comment_version`에 `version`이 1인 줄을 만들어 본문을 넣는다.
6. 알림을 만든다. 댓글이면 글 작성자에게, 답글이면 답한 대상의 작성자에게 간다. 받는 사람이 나 자신이면 만들지 않는다.

4와 5는 한 번에 처리한다. 답글은 한 단계만 둔다. 답글에 다시 답해도 같은 댓글 아래에 달리고, 누구에게 답했는지는 `mentionUser`로 남는다.

### 응답 `data`

성공하면 `201`이다. 만든 댓글을 [댓글의 모양](#댓글의-모양)으로 주고 아래 값을 더한다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `parentCommentId` | 숫자 | 답글이면 그 답글이 달린 댓글의 id. 댓글이면 `null` | `comment.parent_id` |
| `commentCount` | 숫자 | 쓴 뒤의 그 글의 댓글 수 | 계산: [수를 세는 법](#수를-세는-법) |

프론트엔드는 댓글이면 목록의 끝에, 답글이면 `parentCommentId`의 답글 끝에 붙인다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "id": 907,
    "author": {
      "id": 12,
      "nickname": "새벽산책",
      "profileImageUrl": null,
      "mole": { "head": null, "face": "GLASSES_ROUND", "neck": null, "hand": null },
      "campusName": "서울",
      "generation": 14,
      "floor": 3,
      "isWithdrawn": false
    },
    "content": "감사합니다. 신청할게요.",
    "mentionUser": { "id": 31, "nickname": "두더지왕" },
    "createdAt": "2026-11-19T03:15:00Z",
    "isEdited": false,
    "likeCount": 0,
    "isLiked": false,
    "isMine": true,
    "isHidden": false,
    "isReportedByMe": false,
    "parentCommentId": 901,
    "commentCount": 6
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `POST_NOT_FOUND` | 없는 글이거나 삭제된 글 |
| `404` | `POST_HIDDEN` | 신고로 가려진 글 |
| `404` | `COMMENT_NOT_FOUND` | 답하려는 댓글이 이 글에 없거나, 삭제됐거나, 가려짐 |

## PATCH /api/v1/comments/{commentId}

댓글이나 답글을 고친다. 댓글 수정의 "저장"이 부른다. 쓴 사람만 할 수 있다.

- 로그인: 필요
- 명세: 글 상세 11

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `commentId` | 숫자 | ✓ | 댓글이나 답글의 id |
| 본문 | `content` | 문자열 | ✓ | 고친 본문. 1 ~ 300자 |

```text
PATCH /api/v1/comments/907
```

```json
{ "content": "감사합니다. 방금 신청했어요." }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 어긋나면 `400`과 `INVALID_INPUT`.
2. `comment`에서 그 댓글을 찾는다. 없거나 삭제됐으면 `404`와 `COMMENT_NOT_FOUND`.
3. 내가 쓴 댓글이 아니면 `403`과 `FORBIDDEN`.
4. 가려진 댓글이면 `409`와 `COMMENT_EDIT_NOT_ALLOWED`.
5. 본문이 달라졌으면 `comment_version`에 다음 번호의 줄을 더한다. 달라지지 않았으면 더하지 않는다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `content` | 문자열 | 고친 뒤의 본문 | `comment_version.content`. 번호가 가장 큰 버전 |
| `isEdited` | 참/거짓 | 고친 적이 있는지 | 계산: `comment_version`의 줄이 둘 이상인지 |

### 응답 예시

```json
{
  "success": true,
  "data": { "content": "감사합니다. 방금 신청했어요.", "isEdited": true },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `COMMENT_NOT_FOUND` | 없는 댓글이거나 삭제된 댓글 |
| `409` | `COMMENT_EDIT_NOT_ALLOWED` | 신고로 가려진 댓글 |

쓴 사람이 아니면 공통 에러 `403 FORBIDDEN`이다.

## DELETE /api/v1/comments/{commentId}

댓글이나 답글을 지운다. 댓글 삭제 확인의 "삭제"가 부른다. 답글이 달린 댓글을 지우면 답글도 함께 지워진다.

- 로그인: 필요
- 명세: 글 상세 11, 글 삭제 확인 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `commentId` | 숫자 | ✓ | 댓글이나 답글의 id |

```text
DELETE /api/v1/comments/907
```

### 서버가 하는 일

1. `comment`에서 그 댓글을 찾는다. 없거나 이미 삭제됐으면 `404`와 `COMMENT_NOT_FOUND`.
2. 내가 쓴 댓글이 아니면 `403`과 `FORBIDDEN`.
3. `comment.status`를 `DELETED`로 바꾸고 `deleted_at`을 지금 시각으로 채운다.
4. 답글이 아닌 댓글이면, 그 댓글에 달린 답글 가운데 `DELETED`가 아닌 것을 모두 `DELETED`로 바꾸고 `deleted_at`을 채운다.

3과 4는 한 번에 처리한다. 가려진 댓글도 지울 수 있다. 글 작성자가 남의 댓글을 지울 수는 없다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `commentCount` | 숫자 | 지운 뒤의 그 글의 댓글 수 | 계산: [수를 세는 법](#수를-세는-법) |

### 응답 예시

```json
{
  "success": true,
  "data": { "commentCount": 5 },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `COMMENT_NOT_FOUND` | 없는 댓글이거나 이미 삭제된 댓글 |

쓴 사람이 아니면 공통 에러 `403 FORBIDDEN`이다.

## PUT /api/v1/comments/{commentId}/like

댓글이나 답글에 좋아요를 누른다. 댓글의 ♡가 부른다.

- 로그인: 필요
- 명세: 글 상세 10

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `commentId` | 숫자 | ✓ | 댓글이나 답글의 id |

```text
PUT /api/v1/comments/901/like
```

### 서버가 하는 일

1. `comment`에서 그 댓글을 찾는다. 없거나, 삭제됐거나, 가려졌으면 `404`와 `COMMENT_NOT_FOUND`.
2. `comment_like`에 한 줄을 만든다. 이미 누른 댓글이면 바꾸지 않고 성공으로 답한다.
3. 새로 줄을 만들었고 내 댓글이 아니면, 그 댓글의 작성자에게 좋아요 알림을 만든다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `true` | 계산: `comment_like`에 내 줄이 있는지 |
| `likeCount` | 숫자 | 누른 뒤의 좋아요 수 | 계산: 그 댓글의 `comment_like` 줄 수 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": true, "likeCount": 3 },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `COMMENT_NOT_FOUND` | 없는 댓글이거나, 삭제됐거나, 가려진 댓글 |

## DELETE /api/v1/comments/{commentId}/like

댓글이나 답글의 좋아요를 취소한다. ♡를 다시 누를 때 부른다.

- 로그인: 필요
- 명세: 글 상세 10

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `commentId` | 숫자 | ✓ | 댓글이나 답글의 id |

```text
DELETE /api/v1/comments/901/like
```

### 서버가 하는 일

1. `comment_like`에서 내 줄을 지운다. 누르지 않은 댓글이면 바꾸지 않고 성공으로 답한다.

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isLiked` | 참/거짓 | 항상 `false` | 계산: `comment_like`에 내 줄이 있는지 |
| `likeCount` | 숫자 | 취소한 뒤의 좋아요 수 | 계산: 그 댓글의 `comment_like` 줄 수 |

### 응답 예시

```json
{
  "success": true,
  "data": { "isLiked": false, "likeCount": 2 },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/me/posts

내 활동의 글 목록을 준다. 내가 쓴 글, 댓글 단 글, 저장한 글 화면에 들어올 때와 카테고리 탭이나 페이지를 바꿀 때 부른다.

- 로그인: 필요
- 명세: 저장한 글 2 · 3 · 7, 내가 쓴 글 2 · 3 · 7, 댓글 단 글 2 ~ 4 · 7

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `tab` | enum | ✓ | `WRITTEN`(내가 쓴 글), `COMMENTED`(댓글 단 글), `BOOKMARKED`(저장한 글) 가운데 하나 |
| 쿼리 | `category` | enum | | `PROMOTION`, `REVIEW`, `FREE` 가운데 하나. 보내지 않으면 전체다 |
| 쿼리 | `page` | 숫자 | | 페이지 번호. 1부터 세고 보내지 않으면 1 |
| 쿼리 | `size` | 숫자 | | 한 페이지의 글 수. 1 ~ 50. 보내지 않으면 20 |

```text
GET /api/v1/me/posts?tab=COMMENTED&category=PROMOTION&page=1&size=20
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 그 탭의 글. [글 카드](#글-카드)의 값에 아래 값을 더한 것이다 | |
| `items[].canEdit` | 참/거짓 | 지금 이 글을 고칠 수 있는지. 내가 쓴 글의 더보기(⋯)가 쓴다 | 계산: 내 글이고 가려지지 않았는지 |
| `items[].bookmarkedAt` | 시각 | 내가 저장한 시각. `tab`이 `BOOKMARKED`일 때만 주고 그 밖에는 `null` | `post_bookmark.created_at` |
| `items[].myLatestComment` | 객체 | 그 글에 내가 단 가장 최근의 댓글이나 답글. `tab`이 `COMMENTED`일 때만 주고 그 밖에는 `null` | |
| `items[].myLatestComment.id` | 숫자 | 그 댓글의 id. 글 상세에서 이 댓글의 자리로 간다 | `comment.id` |
| `items[].myLatestComment.content` | 문자열 | 그 댓글의 본문 | `comment_version.content`. 번호가 가장 큰 버전 |
| `items[].myCommentCount` | 숫자 | 그 글에 내가 단 댓글과 답글의 수. `tab`이 `COMMENTED`가 아니면 0 | 계산: 그 글의 내 `comment` 가운데 `DELETED`가 아닌 줄 수 |
| `page` | 숫자 | 지금 페이지 | 계산: 요청의 `page` |
| `size` | 숫자 | 한 페이지의 글 수 | 계산: 요청의 `size` |
| `totalItems` | 숫자 | 조건에 맞는 글의 수 | 계산: 조건에 맞는 글 수 |
| `totalPages` | 숫자 | 전체 페이지 수 | 계산: `totalItems`를 `size`로 나눠 올린 값 |

### 주는 방식

탭마다 들어가는 글과 순서는 아래와 같다. 삭제된 글은 어느 탭에도 없다.

| `tab` | 들어가는 글 | 순서 |
|---|---|---|
| `WRITTEN` | 내가 쓴 글. 가려진 글도 `isHidden`이 `true`인 채로 준다 | 새로 쓴 글부터 |
| `COMMENTED` | 내가 댓글이나 답글을 단 공개 글. 글 하나에 한 줄이다. 내 댓글이 모두 지워진 글은 없다 | 내가 가장 최근에 댓글을 단 글부터 |
| `BOOKMARKED` | 내가 저장한 공개 글 | 최근에 저장한 글부터 |

- 페이지 방식이다.
- "외 N개"의 N은 `myCommentCount`에서 1을 뺀 값이다. 프론트엔드가 뺀다.
- 가려진 내 글은 `canEdit`이 `false`다. 열어 보거나 지울 수는 있다.
- 가려지거나 삭제된 글은 저장한 글과 댓글 단 글에서 빠진다. 저장한 줄은 지우지 않으므로 관리자가 글을 복구하면 다시 나온다.
- 이 목록에는 검색이 없다.

### 응답 예시

`tab=COMMENTED`일 때:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 204,
        "category": "PROMOTION",
        "title": "토요일 아침 한강 러닝 같이 하실 분",
        "contentPreview": "여의나루역에서 만나 5km를 천천히 뜁니다. 처음 뛰는 분도 환영해요. 끝나고 근처에서 아침도 같이 먹어요.",
        "thumbnailUrl": "https://cdn.digguldiggul.example/images/2026/11/8f3a1c.webp",
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
        "interestCategories": [{ "id": 3, "name": "운동" }],
        "createdAt": "2026-11-19T02:30:00Z",
        "viewCount": 88,
        "likeCount": 13,
        "commentCount": 6,
        "isBookmarked": false,
        "isHidden": false,
        "isReportedByMe": false,
        "canEdit": false,
        "bookmarkedAt": null,
        "myLatestComment": { "id": 907, "content": "감사합니다. 방금 신청했어요." },
        "myCommentCount": 2
      }
    ],
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다. `tab`이 없거나 정해진 값이 아니면 `400`과 `INVALID_INPUT`이다.

## GET /api/v1/me/posts/summary

내 활동의 개수를 준다. 커뮤니티와 내가 쓴 글 · 댓글 단 글 · 저장한 글 화면의 "내 활동"이 쓴다.

- 로그인: 필요
- 명세: 커뮤니티 14, 저장한 글 1, 내가 쓴 글 1, 댓글 단 글 1

### 요청

없다.

```text
GET /api/v1/me/posts/summary
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `writtenCount` | 숫자 | 내가 쓴 글의 수. 가려진 글도 센다 | 계산: [`GET /api/v1/me/posts`](#get-apiv1meposts)의 `tab=WRITTEN`에 드는 글 수 |
| `commentedCount` | 숫자 | 댓글 단 글의 수 | 계산: `tab=COMMENTED`에 드는 글 수 |
| `bookmarkedCount` | 숫자 | 저장한 글의 수 | 계산: `tab=BOOKMARKED`에 드는 글 수 |

### 주는 방식

- 카테고리로 거르지 않은 전체의 수다.
- 글을 쓰거나, 댓글을 달거나, 저장을 바꾼 뒤에는 프론트엔드가 다시 부른다.

### 응답 예시

```json
{
  "success": true,
  "data": { "writtenCount": 4, "commentedCount": 11, "bookmarkedCount": 7 },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/me/linkable-meetups

글에 연결할 수 있는 내 모임을 준다. 글쓰기와 글 수정에서 모임 연결을 열 때 부른다. 글의 카테고리에 따라 고를 수 있는 모임이 다르다.

- 로그인: 필요
- 명세: 글쓰기 6

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `postCategory` | enum | ✓ | 쓰려는 글의 카테고리. `PROMOTION`, `REVIEW`, `FREE` 가운데 하나 |

```text
GET /api/v1/me/linkable-meetups?postCategory=PROMOTION
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | [모임 카드](07-meetup.md#모임-카드)의 목록 | |

### 주는 방식

- `PROMOTION`이면 내가 연 모임 가운데 모집 중인 것(`recruitStatus`가 `OPEN`)을 준다. 시작이 가까운 것부터다.
- `REVIEW`면 내가 열었거나 참여가 확정된 모임 가운데 지난 모임(`recruitStatus`가 `PAST`)만 준다. 예정 모임과 취소된 모임은 주지 않는다. 시작이 최근인 것부터다. 비어 있으면 프론트엔드가 모임 후기를 쓸 수 있는 모임이 없다고 알린다.
- `FREE`면 내가 열었거나 참여가 확정된 모임을 준다. 지난 모임도 주고, 취소된 모임은 주지 않는다. 시작이 최근인 것부터다.
- 삭제된 모임은 주지 않는다.
- 나누지 않고 한 번에 모두 준다.
- 글 수정에서 이미 연결된 모임이 이 목록에 없을 수 있다. 모임 홍보 글을 쓴 뒤에 그 모임이 모집 완료가 된 경우다. 프론트엔드는 글 상세의 `meetup`으로 지금 연결된 모임을 보여 주고, 연결을 바꾸지 않으면 그대로 보낸다.

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
      }
    ]
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/images

사진 한 장을 올린다. 글쓰기와 글 수정의 "사진 추가", 채팅 입력창의 첨부에서 사진을 고를 때마다 부른다. 받은 `imageId`를 글을 쓰거나 고칠 때, 또는 메시지를 보낼 때 `imageIds`에 담는다.

- 로그인: 필요
- 명세: 글쓰기 5, [06 채팅](../spec/06-chat.md) 1:1 대화 7

### 요청

본문을 JSON이 아니라 `multipart/form-data`로 보낸다. 파일은 한 번에 하나다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 폼 | `file` | 파일 | ✓ | 올릴 사진. JPEG, PNG, WebP 가운데 하나이고 5MB 이하 |

```text
POST /api/v1/images
Content-Type: multipart/form-data
```

### 서버가 하는 일

1. 파일이 없거나, 형식이 JPEG · PNG · WebP가 아니거나, 5MB를 넘으면 `400`과 `INVALID_INPUT`. 형식은 파일 이름이 아니라 파일의 내용으로 본다.
2. 파일을 저장소에 올린다.
3. `uploaded_image`에 한 줄을 만든다. `uploader_id`는 요청한 사람, `image_url`은 올린 파일의 주소다.

올리기만 한 사진은 어디에도 속하지 않는다. 글을 쓰거나 고칠 때, 또는 메시지를 보낼 때 `imageIds`에 담아야 그 글이나 메시지의 사진이 된다.

### 응답 `data`

성공하면 `201`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `imageId` | 숫자 | 올린 사진의 id | `uploaded_image.id` |
| `url` | 문자열 | 사진의 주소. 프론트엔드가 썸네일을 그리는 데 쓴다 | `uploaded_image.image_url` |

### 응답 예시

```json
{
  "success": true,
  "data": { "imageId": 512, "url": "https://cdn.digguldiggul.example/images/2026/11/8f3a1c.webp" },
  "error": null
}
```

5MB를 넘는 사진을 올렸을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "입력값을 확인해 주세요.",
    "fields": [
      { "field": "file", "message": "5MB 이하의 사진만 올릴 수 있습니다." }
    ],
    "detail": null
  }
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/reports

글, 댓글, 사용자, 방명록 글을 신고한다. 신고 팝업의 "신고하기"가 부른다. 네 가지 대상이 모두 이 API를 쓴다.

- 로그인: 필요
- 명세: 신고 팝업 1 ~ 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `targetType` | enum | ✓ | `POST`(글), `COMMENT`(댓글이나 답글), `MEMBER`(사용자), `GUESTBOOK`(방명록 글) 가운데 하나 |
| 본문 | `targetId` | 숫자 | ✓ | 대상의 id. 글이면 글의 id, 댓글이면 댓글의 id, 사용자면 계정의 id, 방명록 글이면 방명록 글의 id |
| 본문 | `reason` | enum | ✓ | `SPAM`(스팸 · 홍보), `ABUSE`(욕설 · 비하 · 괴롭힘), `OBSCENE`(음란물), `ETC`(기타) 가운데 하나 |
| 본문 | `detail` | 문자열 | | 기타 사유. `reason`이 `ETC`면 꼭 보내고 1 ~ 100자다. 그 밖에는 `null` |

```text
POST /api/v1/reports
```

```json
{ "targetType": "COMMENT", "targetId": 903, "reason": "ABUSE", "detail": null }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 어긋나면 `400`과 `INVALID_INPUT`.
2. 대상을 찾고 그 줄을 잠근다. 아래에 맞지 않으면 `404`와 `REPORT_TARGET_NOT_FOUND`.

| `targetType` | 신고할 수 있는 대상 |
|---|---|
| `POST` | `post.status`가 `PUBLIC`인 글 |
| `COMMENT` | `comment.status`가 `PUBLIC`인 댓글이나 답글 |
| `MEMBER` | 탈퇴하지 않은 사용자 |
| `GUESTBOOK` | 가려지지 않은 방명록 글 |

3. 내 글, 내 댓글, 나 자신, 내가 쓴 방명록 글이면 `403`과 `OWN_TARGET_NOT_ALLOWED`.
4. 내가 이미 신고한 대상이면 `409`와 `ALREADY_REPORTED`.
5. `report`에 한 줄을 만든다. `status`는 `RECEIVED`다. 글과 댓글이면 지금 보이는 버전의 번호를 `target_version`에 적는다.
6. 글, 댓글, 방명록 글이면 마지막 복구 뒤에 접수된 신고를 서로 다른 신고자 수로 센다. 이번 신고로 3명이 되면 그 대상의 `status`를 `HIDDEN`으로 바꾼다.
7. 6에서 글, 댓글, 방명록 글이 가려졌으면 그 작성자에게 알림을 만든다. 알림에 신고한 사람은 담지 않는다.

5 ~ 7은 한 번에 처리한다. 사용자 신고는 쌓여도 자동으로 조치하지 않고 관리자가 본다. 신고는 내용을 고쳐도 같은 글이나 댓글에 계속 쌓인다([DB 설계](../db/community.md)).

### 응답 `data`

성공하면 `201`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `reportId` | 숫자 | 신고의 id | `report.id` |

프론트엔드는 완료 토스트를 띄우고, 신고한 글이나 댓글을 접어서 보여 준다.

### 응답 예시

```json
{
  "success": true,
  "data": { "reportId": 61 },
  "error": null
}
```

같은 대상을 다시 신고했을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ALREADY_REPORTED",
    "message": "이미 신고한 대상입니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `403` | `OWN_TARGET_NOT_ALLOWED` | 내 글, 내 댓글, 나 자신, 내가 쓴 방명록 글을 신고함 |
| `404` | `REPORT_TARGET_NOT_FOUND` | 대상이 없거나, 삭제됐거나, 이미 가려짐. 탈퇴한 사용자도 여기에 든다 |
| `409` | `ALREADY_REPORTED` | 내가 이미 신고한 대상 |

## 명세에 없어 이 문서에서 정한 것

- **사진을 올리는 방식**: 사진은 한 장씩 서버로 올려 `imageId`를 받고, 글을 쓰거나 고칠 때 그 id를 붙인다. JPEG, PNG, WebP를 받고 한 장에 5MB까지다. 이 방식을 [API 공통 규칙](../api-convention.md#파일-올리기)에 더했다.
- **인기 점수**: 최근 7일 동안 받은 좋아요의 수다. 인기순 정렬, 이번 주 인기 글 TOP5, 다음 읽을 글이 모두 이 점수를 쓴다. 명세가 "좋아요 + 댓글 + 저장"이라고 적었던 것을 이렇게 바꿨다.
- **조회수**: 조회하는 API가 데이터를 바꾸지 않도록, 조회수를 올리는 API를 따로 두었다. 열 때마다 세고 작성자가 열어도 센다.
- **삭제되거나 가려진 글을 열 때**: 없는 글과 삭제된 글은 `POST_NOT_FOUND`, 가려진 글은 `POST_HIDDEN`으로 답한다. 가려진 글의 작성자는 어디서 열든 그 글을 본다.
- **댓글을 나눠 주는 단위**: 댓글 10개씩 커서 방식으로 주고, 답글은 그 댓글에 모두 붙여 준다. 내 댓글의 자리로 갈 때는 프론트엔드가 그 댓글이 나올 때까지 이어 받는다.
- **답글 쓰기**: 답하는 대상의 id 하나만 받는다. 어느 댓글 아래에 달지와 "@닉네임"은 서버가 정한다. 가려진 댓글에는 답글을 달 수 없다.
- **글에 연결하는 모임**: 모임 홍보는 내가 연 모집 중인 모임만, 모임 후기는 내가 열었거나 참여가 확정된 지난 모임만, 자유는 내가 열었거나 참여가 확정된 모임만 연결한다(취소된 모임 제외). 모임 홍보와 모임 후기는 모임 연결이 필수다. 글을 고칠 때 카테고리만 바꿔도 다시 검사한다. 고를 수 있는 모임을 주는 API를 두었다. 글을 쓴 뒤에 모임의 상태가 바뀌어도 연결은 그대로 둔다.
- **내 활동**: 내가 쓴 글, 댓글 단 글, 저장한 글을 API 하나(`tab`)로 주고, 개수는 따로 준다.
- **글 카드**: 조회수를 모든 목록의 카드에 담았다. 본문 미리보기는 앞 100자를 준다.
- **인기 글과 관심사**: 이번 주 인기 글 TOP5와 많이 이야기하는 관심사를 API 하나로 준다. 점수가 0인 글과 글이 없는 대분류는 주지 않는다.
- **다음 읽을 글**: 태그의 대분류가 하나라도 같은 공개 글에서 고른다. 태그가 없는 글이면 모든 공개 글에서 고른다.
- **신고**: 대상 네 가지를 API 하나로 받는다. 대상이 없거나 이미 가려졌으면 `REPORT_TARGET_NOT_FOUND`, 자기 것이면 `OWN_TARGET_NOT_ALLOWED`, 이미 신고했으면 `ALREADY_REPORTED`로 답한다.
- **내가 신고한 글과 댓글**: 서버는 `isReportedByMe`만 주고 내용은 그대로 준다. 접어서 보여 주는 것은 프론트엔드가 한다.
- **태그를 눌렀을 때**: 프론트엔드가 커뮤니티 목록으로 가서 그 대분류나 카테고리로 거른다. 글 목록이 대분류 12개를 모두 받는다.
- **수정됨**: 제목이나 본문을 고쳤을 때만 붙는다. 카테고리, 태그, 사진, 모임 연결만 바꾸면 붙지 않는다.
- **좋아요와 저장**: `PUT`으로 켜고 `DELETE`로 끈다. 가려지거나 삭제된 글과 댓글에는 할 수 없다.
- **검색어**: 앞뒤 공백을 지운 문자열 전체를 제목 · 본문 · 닉네임에서 찾는다. 여러 낱말을 따로 찾지 않는다(KAN-51).
- **인기 점수 계산**: 인기 점수와 많이 이야기하는 관심사는 미리 계산해 두지 않고 요청마다 센다(KAN-51).

## 구현 단계로 넘기는 것

- 사진을 두는 저장소와 주소의 모양
- 올려 두고 글에 붙이지 않은 사진, 글에서 뗀 사진을 지우는 때
- 2주 뒤 버전과 사진을 지우는 예약 작업의 실행 방법(DB 설계에서도 넘겼다)
- 글, 댓글, 신고를 짧은 시간에 너무 많이 하는 것을 막는 기준. 글은 KAN-51에서 제한하지 않기로 했다
- 신고를 살피고 가려진 글을 복구하는 관리자 API(11 관리자에서 정한다)
