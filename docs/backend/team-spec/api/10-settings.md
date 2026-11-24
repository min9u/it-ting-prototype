# 설정 · 계정 API

비밀번호 변경, Google 연동과 해제, 알림 설정과 브라우저 푸시, 공지사항, 회원 탈퇴를 다룬다. 로그아웃은 [로그인 · 회원가입 API](02-auth.md#delete-apiv1sessionscurrent)에 있다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [10 설정 · 계정](../spec/10-settings.md), [00 공통](../spec/00-common.md) 2 · 9
- DB 설계: [계정 · 프로필 · 관심사 · 질문](../db/account.md), [알림 · 공지](../db/notification.md)

## 목록

이 영역의 API는 온보딩을 마치고 이번 학기의 캠퍼스 · 층을 고른 계정만 부를 수 있다([로그인 · 회원가입 API](02-auth.md#새-학기를-고르지-않은-계정)).

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `GET` | `/api/v1/me/account` | 가입 방법과 Google 연동 상태를 준다 | 필요 | 비밀번호 변경 1, Google 연동하기 · 연동 전 1, 연동됨 1 ~ 2 |
| `PATCH` | `/api/v1/me/password` | 비밀번호를 바꾼다 | 필요 | 비밀번호 변경 2 ~ 5 |
| `GET` | `/api/v1/oauth/google/verify` | 설정에서 Google 계정 확인을 시작한다(브라우저 이동) | 필요 | Google 연동하기 · 연동 전 2, 회원 탈퇴 · Google 계정 1 |
| `PUT` | `/api/v1/me/google-link` | 확인받은 Google 계정을 내 계정에 연결한다 | 필요 | Google 연동하기 · 연동 전 2 |
| `DELETE` | `/api/v1/me/google-link` | Google 연동을 해제한다 | 필요 | Google 연동하기 · 연동됨 2 |
| `GET` | `/api/v1/me/notification-settings` | 알림 설정을 준다 | 필요 | 알림 설정 1 ~ 2 |
| `PATCH` | `/api/v1/me/notification-settings` | 알림을 종류별로 켜고 끈다 | 필요 | 알림 설정 2 |
| `POST` | `/api/v1/me/push-subscriptions` | 이 브라우저를 브라우저 푸시를 받을 곳으로 등록한다 | 필요 | 알림 설정 2, 00 공통 2 |
| `DELETE` | `/api/v1/me/push-subscriptions/{pushSubscriptionId}` | 이 브라우저의 푸시 등록을 지운다 | 필요 | 알림 설정 2 |
| `GET` | `/api/v1/notices` | 공지 목록을 준다 | 필요 | 공지사항 1 ~ 2 |
| `GET` | `/api/v1/notices/{noticeId}` | 공지 한 건을 준다 | 필요 | 공지사항 상세 2 ~ 3 |
| `GET` | `/api/v1/me/withdrawal-check` | 탈퇴할 수 있는지와 Google 본인 확인이 끝났는지를 준다 | 필요 | 회원 탈퇴 1 · 3, 회원 탈퇴 · Google 계정 1 |
| `POST` | `/api/v1/me/withdraw` | 탈퇴한다 | 필요 | 회원 탈퇴 1 ~ 5, 회원 탈퇴 · 탈퇴 확인 1 |

## 화면마다 부르는 API

| 화면 | 부르는 때 | API | API 없이 프론트엔드가 하는 것 |
|---|---|---|---|
| 설정의 모든 화면 | 열 때 | `GET /api/v1/me/account` | 설정 메뉴에 "비밀번호 변경"을 보일지, 설정의 첫 화면, 버전 정보의 숫자 |
| 설정 – 비밀번호 변경 | "변경하기" | `PATCH /api/v1/me/password` | 비밀번호 규칙의 충족 표시, 두 칸이 같은지, 완료 토스트, 칸 비우기 |
| 설정 – Google 연동하기 · 연동 전 | "Google 계정 연동" | 브라우저가 `GET /api/v1/oauth/google/verify?purpose=LINK`로 이동 | |
| 설정 – Google 연동하기 · 연동 전 | Google에서 돌아왔을 때(`verified=true`) | `PUT /api/v1/me/google-link` | 완료 토스트, "연동됨" 화면으로 바꾸기 |
| 설정 – Google 연동하기 · 연동됨 | "연동 해제"의 확인 | `DELETE /api/v1/me/google-link` | 확인 팝업, `canUnlinkGoogle`이 `false`면 버튼을 끄고 이유 보여 주기 |
| 설정 – 알림 설정 | 열 때 | `GET /api/v1/me/notification-settings` | "브라우저 알림 받기" 스위치의 상태(이 브라우저의 알림 권한과 구독) |
| 설정 – 알림 설정 | 종류별 스위치를 누를 때 | `PATCH /api/v1/me/notification-settings` | 종류마다의 한 줄 설명 |
| 설정 – 알림 설정 | "브라우저 알림 받기"를 켤 때 | `POST /api/v1/me/push-subscriptions` | 브라우저의 알림 권한 요청, 브라우저 구독 만들기 |
| 설정 – 알림 설정 | "브라우저 알림 받기"를 끌 때 | `DELETE /api/v1/me/push-subscriptions/{pushSubscriptionId}` | 브라우저 구독 해지 |
| 설정 – 공지사항 | 열 때, 페이지를 넘길 때 | `GET /api/v1/notices` | 빈 상태, 날짜 표기 |
| 설정 – 공지사항 상세 | 열 때 | `GET /api/v1/notices/{noticeId}` | 없는 공지의 안내 화면 |
| 설정 – 회원 탈퇴 | 열 때, Google에서 돌아왔을 때 | `GET /api/v1/me/withdrawal-check` | 탈퇴 안내의 글, 탈퇴 사유 목록의 글, 동의 체크, 버튼 켜기 |
| 설정 – 회원 탈퇴 · Google 계정 | "Google로 다시 인증" | 브라우저가 `GET /api/v1/oauth/google/verify?purpose=WITHDRAW`로 이동 | |
| 설정 – 회원 탈퇴 · 탈퇴 확인 | "탈퇴하기" | `POST /api/v1/me/withdraw` | 랜딩으로 이동하기 |
| 설정 – 로그아웃 확인 | "로그아웃" | [`DELETE /api/v1/sessions/current`](02-auth.md#delete-apiv1sessionscurrent) | 이 브라우저에 푸시 등록이 있으면 먼저 지우기, 랜딩으로 이동하기 |

## 영역 규칙

### 계정의 모양

설정 메뉴와 Google 연동하기 화면이 쓰는 값이다. `GET /api/v1/me/account`, `PUT /api/v1/me/google-link`, `DELETE /api/v1/me/google-link`가 같은 모양으로 준다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `hasPassword` | 참/거짓 | 비밀번호가 있는 계정인지. 이메일로 가입한 계정은 `true`, Google로만 가입한 계정은 `false` | 계산: `user.password_hash`가 있는지 |
| `isGoogleLinked` | 참/거짓 | Google 계정이 연결돼 있는지 | 계산: `user.google_sub`가 있는지 |
| `googleEmail` | 문자열 | 연결된 Google 이메일. 연결돼 있지 않으면 `null` | `user.google_email` |
| `canUnlinkGoogle` | 참/거짓 | 연동을 해제할 수 있는지 | 계산: `isGoogleLinked`이고 `hasPassword`인지 |

명세의 "가입 방법에 따라 달라지는 것"은 이 값으로 가린다.

| 구분 | 이메일로 가입한 계정(`hasPassword`가 `true`) | Google로만 가입한 계정(`hasPassword`가 `false`) |
|---|---|---|
| "비밀번호 변경" 메뉴 | 보여 준다 | 보여 주지 않는다. 불러도 `409`와 `PASSWORD_NOT_SET` |
| 설정의 첫 화면 | 비밀번호 변경 | Google 연동하기 |
| Google 연동하기의 상태 | `isGoogleLinked`에 따라 연동 전 또는 연동됨 | 항상 연동됨 |
| 연동 해제 | 할 수 있다(`canUnlinkGoogle`이 `true`) | 할 수 없다. 불러도 `409`와 `GOOGLE_UNLINK_NOT_ALLOWED` |
| 회원 탈퇴의 본인 확인 | 탈퇴할 때 비밀번호를 함께 보낸다 | 먼저 Google 확인을 받는다 |

비밀번호가 있는 계정이 Google을 연동해도 `hasPassword`는 `true`다. 본인 확인은 비밀번호로 한다.

### Google 확인

설정에서 Google 계정을 확인받는 일은 둘이다. Google 계정을 연동할 때(`LINK`)와, Google로만 가입한 계정이 탈퇴하기 전에 본인임을 확인할 때(`WITHDRAW`)다. 둘 다 브라우저가 Google에 다녀와야 해서 로그인과 같은 길을 쓴다.

1. 브라우저가 `GET /api/v1/oauth/google/verify?purpose=LINK`(또는 `WITHDRAW`)로 이동한다.
2. Google에서 계정을 고르면 Google이 브라우저를 로그인과 같은 주소([`GET /api/v1/oauth/google/callback`](02-auth.md#get-apiv1oauthgooglecallback))로 돌려보낸다.
3. 콜백은 이 시도가 설정에서 시작한 것임을 알아보고, 로그인 처리 대신 받은 Google 계정을 아래 표대로 검사한다.
4. 검사에 맞으면 "Google 확인 기록"을 임시 저장소(Redis)에 만든다. 어긋나면 만들지 않는다.
5. 브라우저를 시작한 화면으로 돌려보낸다(`302`).

| `purpose` | 검사하는 것 | 어긋날 때 주소에 붙는 `error` |
|---|---|---|
| `LINK` | 내 계정에 아직 Google 계정이 연결돼 있지 않은지 | `GOOGLE_ALREADY_LINKED` |
| `LINK` | 그 Google 계정을 다른 계정이 쓰고 있지 않은지(`user.google_sub`) | `GOOGLE_ACCOUNT_DUPLICATED` |
| `WITHDRAW` | 내 계정에 연결된 Google 계정과 같은 계정인지 | `GOOGLE_ACCOUNT_MISMATCH` |
| 둘 다 | Google에서 취소했거나 확인을 마치지 못함 | `GOOGLE_VERIFICATION_FAILED` |

Google 확인 기록:

- 담는 값은 `purpose`, Google 식별자, Google 이메일이다. 로그인 세션에 묶여 있어 확인받은 그 브라우저에서만 쓸 수 있다.
- 만든 뒤 10분 동안 유효하다. 같은 세션에서 다시 확인받으면 앞의 기록을 덮어쓴다.
- `LINK` 기록은 `PUT /api/v1/me/google-link`가, `WITHDRAW` 기록은 `POST /api/v1/me/withdraw`가 본다. 쓰고 나면 지운다.
- 콜백은 DB를 바꾸지 않는다. 연동은 `PUT`이, 탈퇴는 `POST`가 한다.

콜백이 브라우저를 보내는 곳:

| 결과 | 브라우저가 가는 곳 | 그다음 프론트엔드가 하는 일 |
|---|---|---|
| `LINK` 확인됨 | Google 연동하기 화면 주소에 `verified=true`를 붙인 주소 | `PUT /api/v1/me/google-link`를 부른다 |
| `WITHDRAW` 확인됨 | 회원 탈퇴 화면 주소 | `GET /api/v1/me/withdrawal-check`의 `isGoogleVerified`로 "인증 완료"를 보여 준다 |
| 확인하지 못함 | 시작한 화면 주소에 `error=<code>`를 붙인 주소 | 그 화면에 머물고 `code`에 맞는 안내를 보여 준다 |
| 로그인이 풀려 있음 | 로그인 화면 주소 | |

회원 탈퇴 화면은 Google에 다녀오면 새로 열린다. 다녀오기 전에 고른 탈퇴 사유와 동의 체크를 다시 보여 주는 것은 프론트엔드가 한다.

### 알림 설정

- 종류는 알림의 갈래와 같은 다섯 가지다: 모임, 채팅, 커뮤니티, 땅굴, 공지([알림 API](09-notification.md#알림의-모양)의 `category`).
- 기본은 모두 켜짐이다. `notification_setting`에 줄이 없는 계정은 모두 켜진 것으로 본다. 처음 바꿀 때 줄을 만든다.
- 끈 갈래는 새 알림을 만들지 않고, 브라우저 푸시도 보내지 않고, 빨간 점에도 나타나지 않는다([알림 API](09-notification.md#알림을-만들-때의-규칙)). 끄기 전에 받은 알림은 알림 목록에 그대로 있다.
- 다시 켜도 꺼 둔 동안의 알림은 생기지 않는다.
- 알림 팝업의 요청 두 줄과 채팅의 "요청 N"은 알림 설정과 상관없이 그대로다.

### 브라우저 푸시

"브라우저 알림 받기"는 브라우저마다 켜고 끈다. 브라우저의 알림 권한이 브라우저마다 따로이기 때문이다.

켜는 순서:

1. 프론트엔드가 브라우저에 알림 권한을 요청한다. 거절하면 여기서 끝나고 스위치는 꺼진 채로 둔다.
2. 허용하면 프론트엔드가 `GET /api/v1/me/notification-settings`의 `pushPublicKey`로 브라우저의 푸시 구독을 만든다.
3. 구독의 값을 `POST /api/v1/me/push-subscriptions`로 보낸다. 받은 `pushSubscriptionId`는 프론트엔드가 이 브라우저에 보관한다.

끄는 순서:

1. `DELETE /api/v1/me/push-subscriptions/{pushSubscriptionId}`를 부른다.
2. 프론트엔드가 브라우저의 구독을 해지한다.

그 밖의 규칙:

- 스위치의 상태는 서버가 주지 않는다. 프론트엔드가 이 브라우저의 알림 권한과 구독이 있는지로 정한다.
- 한 계정이 여러 브라우저를 등록할 수 있다. 알림이 생기면 서버는 그 계정에 등록된 모든 브라우저로 보낸다. 켜 둔 갈래의 알림만 보낸다.
- 브라우저 하나는 한 계정의 푸시만 받는다. 이미 등록된 브라우저를 다른 계정이 등록하면 그 계정의 것으로 바뀐다.
- 로그아웃할 때는 프론트엔드가 먼저 이 브라우저의 등록을 지운다. 로그아웃한 브라우저에 푸시가 가지 않게 하려는 것이다.
- 푸시를 보냈는데 브라우저 쪽에서 "없는 구독"이라고 답하면 서버가 그 줄을 지운다.
- 탈퇴하면 그 계정의 등록을 모두 지운다.

### 공지

- 공지는 관리자가 올린다. 올리는 API는 이 문서에 없다([API 문서 목록](README.md)의 11 운영 · 관리자).
- 분류(`category`)는 `NOTICE`(공지), `UPDATE`(업데이트), `EVENT`(이벤트) 가운데 하나다.
- 삭제한 공지(`notice.deleted_at`)는 목록에 나오지 않고, 상세는 `NOTICE_NOT_FOUND`로 답한다.
- 본문은 줄바꿈이 있는 글이다. 꾸미는 문법(HTML, 마크다운)은 쓰지 않는다. 프론트엔드는 받은 글을 줄바꿈만 살려 그대로 보여 준다.
- 공지를 읽어도 공지 알림이 읽음으로 바뀌지 않는다. 알림의 읽음은 [알림 API](09-notification.md#post-apiv1notificationsnotificationidread)가 한다.

### 탈퇴할 때 하는 일

`POST /api/v1/me/withdraw` 하나가 아래를 한 번에 처리한다. 하나라도 실패하면 모두 되돌린다.

막는 경우는 하나다. 내가 연 예정 모임이 있으면 탈퇴할 수 없다. 예정 모임은 시작하지 않았고, 취소되지 않았고, 삭제되지 않은 모임이다([모임 API](07-meetup.md#get-apiv1memeetups)의 `tab=HOSTING`과 같다). 먼저 그 모임을 삭제하거나 취소해야 한다.

바꾸는 것:

| 대상 | 하는 일 | 저장하는 곳 |
|---|---|---|
| 예정 모임에 신청해 기다리는 것 | 신청 취소로 바꾼다. 알림은 만들지 않는다 | `meetup_application.status`를 `WITHDRAWN`으로 |
| 예정 모임에 참여가 확정된 것 | 참여 취소로 바꾼다. 시작 24시간 전이 지났어도 바꾼다. 주최자에게 참여 취소 알림을 만들고, 정원이 차 있던 모임이면 빈자리 알림을 켠 사람에게 빈자리 알림을 만든다 | `meetup_application.status`를 `CANCELED`로 |
| 내가 들어 있는 대화방(1:1, 모임) | "탈퇴했습니다" 안내 메시지를 넣고 나간 것으로 한다. 상대의 1:1 대화방은 읽기 전용이 된다([채팅 API](06-chat.md#읽기-전용-대화방)) | `chat_message`(`type`이 `WITHDRAWN`), `chat_room_member.left_at` |
| 계정 | 탈퇴 상태로 바꾸고 로그인에 쓰는 값을 비운다. 탈퇴 사유와 시각을 남긴다 | `user.status`를 `WITHDRAWN`으로, `user.email` · `password_hash` · `google_sub` · `google_email` · `mattermost_id`를 비움, `user_withdrawal` |

지우는 것:

| 대상 | 지우는 줄 |
|---|---|
| 프로필, 관심사, 자기소개 답변 | `user_profile`, `user_interest`, `user_answer` |
| 내 땅굴과 입구, 내 땅굴이 받은 방명록 글 | `burrow`, `burrow_entrance`, `guestbook_entry`(`burrow_id`가 내 땅굴인 것) |
| 단골(내가 담은 것, 나를 담은 것) | `regular_burrow` |
| 대화 요청(보낸 것, 받은 것) | `chat_request` |
| 모임 찜과 빈자리 알림 | `meetup_like` |
| 글 좋아요, 댓글 좋아요, 저장 | `post_like`, `comment_like`, `post_bookmark` |
| 알림 설정, 브라우저 푸시 등록, 내가 받은 알림 | `notification_setting`, `push_subscription`, `notification`(`user_id`가 나인 것) |

남기는 것:

- 내가 쓴 커뮤니티 글과 댓글, 남의 땅굴에 쓴 방명록 글, 채팅 메시지, 지난 모임과 취소된 모임의 기록. 쓴 사람은 [사용자 표시](00-common.md#사용자-표시)의 `isWithdrawn`이 `true`로 나온다.
- 내가 일으킨 남의 알림. 일으킨 사람이 "탈퇴한 사용자"로 보인다.
- 내가 넣은 신고.

끝난 뒤:

- 그 계정의 로그인 세션을 모두 지우고 세션 쿠키를 지운다. 실시간 소식의 연결도 끊는다.
- 같은 Mattermost 계정으로 다시 가입하면 새 계정이 된다. 남은 글과는 이어지지 않는다([DB 설계](../db/account.md)).

## GET /api/v1/me/account

로그인한 계정의 가입 방법과 Google 연동 상태를 준다. 설정의 화면을 열 때 부른다. 설정 메뉴와 Google 연동하기 화면이 이 값을 쓴다.

- 로그인: 필요
- 명세: 설정 – 비밀번호 변경 1, 설정 – Google 연동하기 · 연동 전 1, 설정 – Google 연동하기 · 연동됨 1 ~ 2, 영역 규칙 "가입 방법에 따라 달라지는 것"

### 요청

없다.

```text
GET /api/v1/me/account
```

### 응답 `data`

[계정의 모양](#계정의-모양)이다.

### 주는 방식

- 세션 쿠키로 계정을 찾아 그 계정 하나의 값만 준다.
- 비밀번호나 Google 식별자는 주지 않는다. 있는지만 준다.
- 로그인에 쓰는 이메일은 주지 않는다. 설정에 보여 주는 곳이 없다.
- 버전 정보는 주지 않는다. 프론트엔드가 갖는다.

### 응답 예시

이메일로 가입하고 Google을 연동한 계정:

```json
{
  "success": true,
  "data": {
    "hasPassword": true,
    "isGoogleLinked": true,
    "googleEmail": "dawnwalk@gmail.com",
    "canUnlinkGoogle": true
  },
  "error": null
}
```

Google로만 가입한 계정:

```json
{
  "success": true,
  "data": {
    "hasPassword": false,
    "isGoogleLinked": true,
    "googleEmail": "dawnwalk@gmail.com",
    "canUnlinkGoogle": false
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PATCH /api/v1/me/password

비밀번호를 바꾼다. 설정 – 비밀번호 변경의 "변경하기"가 부른다. 비밀번호가 있는 계정만 쓸 수 있다.

- 로그인: 필요
- 명세: 설정 – 비밀번호 변경 2 ~ 5

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `currentPassword` | 문자열 | ✓ | 지금 쓰는 비밀번호 |
| 본문 | `newPassword` | 문자열 | ✓ | 새 비밀번호. [00 공통](../spec/00-common.md) 9의 비밀번호 규칙을 따른다 |

"새 비밀번호 확인" 칸은 보내지 않는다. 두 칸이 같은지는 프론트엔드가 본다.

```text
PATCH /api/v1/me/password
```

```json
{ "currentPassword": "mole1234!", "newPassword": "newmole5678@" }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 두 값이 있는지와 `newPassword`의 비밀번호 규칙이다. 어긋나면 `400`과 `INVALID_INPUT`.
2. 비밀번호가 없는 계정(Google로만 가입)이면 `409`와 `PASSWORD_NOT_SET`.
3. `currentPassword`가 지금 비밀번호와 맞지 않으면 `400`과 `CURRENT_PASSWORD_MISMATCH`.
4. `newPassword`가 지금 비밀번호와 같으면 `400`과 `PASSWORD_UNCHANGED`.
5. `user.password_hash`를 새 비밀번호의 해시로 바꾼다.
6. 이 계정의 다른 로그인 세션을 모두 지운다. 요청에 실린 세션은 남긴다. 다른 기기는 로그아웃되고 지금 쓰는 기기는 그대로 로그인돼 있다.

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
| `400` | `CURRENT_PASSWORD_MISMATCH` | 지금 비밀번호가 맞지 않음 |
| `400` | `PASSWORD_UNCHANGED` | 새 비밀번호가 지금 비밀번호와 같음 |
| `409` | `PASSWORD_NOT_SET` | 비밀번호가 없는 계정(Google로만 가입) |

## GET /api/v1/oauth/google/verify

설정에서 Google 계정 확인을 시작한다. JSON을 주고받는 API가 아니라 브라우저가 이 주소로 이동한다. 응답 틀을 쓰지 않는다. 돌아온 뒤의 일은 [Google 확인](#google-확인)에 적었다.

- 로그인: 필요
- 명세: 설정 – Google 연동하기 · 연동 전 2, 설정 – 회원 탈퇴 · Google 계정 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `purpose` | enum | ✓ | `LINK`(Google 계정 연동), `WITHDRAW`(탈퇴 전 본인 확인) 가운데 하나 |

"Google 계정 연동"이나 "Google로 다시 인증"을 누르면 프론트엔드가 브라우저의 주소를 이 주소로 바꾼다.

```text
GET /api/v1/oauth/google/verify?purpose=LINK
```

### 서버가 하는 일

1. 로그인 세션이 없으면 브라우저를 로그인 화면으로 보낸다(`302`). `purpose`가 두 값이 아니면 설정의 첫 화면으로 보낸다(`302`).
2. 이 시도를 구분하는 값을 만들어 `purpose`, 세션과 함께 잠깐 기억해 둔다.
3. 브라우저를 Google의 로그인 화면으로 보낸다(`302`). 돌아올 주소는 로그인과 같은 `/api/v1/oauth/google/callback`이다.

### 응답 `data`

본문이 없다. `302`와 `Location` 헤더로 답한다.

### 에러

응답 틀을 쓰지 않으므로 에러 코드가 없다. 확인하지 못한 까닭은 돌아온 주소의 `error`로 알린다([Google 확인](#google-확인)).

## PUT /api/v1/me/google-link

방금 확인받은 Google 계정을 내 계정에 연결한다. Google에서 돌아온 Google 연동하기 화면이 주소의 `verified=true`를 보고 부른다. 연결한 뒤로는 그 Google 계정으로도 로그인할 수 있다.

- 로그인: 필요
- 명세: 설정 – Google 연동하기 · 연동 전 2

### 요청

없다. 연결할 Google 계정은 이 세션의 [Google 확인 기록](#google-확인)에서 가져온다.

```text
PUT /api/v1/me/google-link
```

### 서버가 하는 일

1. 이 세션의 Google 확인 기록(`LINK`)을 찾는다. 없거나 10분이 지났으면, 이미 연동된 계정은 바꾸지 않고 성공으로 답하고 연동되지 않은 계정은 `409`와 `GOOGLE_VERIFICATION_REQUIRED`.
2. 내 계정에 이미 다른 Google 계정이 연결돼 있으면 `409`와 `GOOGLE_ALREADY_LINKED`.
3. `user.google_sub`와 `user.google_email`을 확인 기록의 값으로 채운다. 그 사이 다른 계정이 같은 Google 계정을 써서 값이 겹치면 `409`와 `GOOGLE_ACCOUNT_DUPLICATED`.
4. 확인 기록을 지운다.

### 응답 `data`

연결한 뒤의 [계정의 모양](#계정의-모양)이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "hasPassword": true,
    "isGoogleLinked": true,
    "googleEmail": "dawnwalk@gmail.com",
    "canUnlinkGoogle": true
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `409` | `GOOGLE_VERIFICATION_REQUIRED` | Google 확인을 받지 않았거나 받은 지 10분이 지남 |
| `409` | `GOOGLE_ALREADY_LINKED` | 이미 다른 Google 계정이 연결된 계정 |
| `409` | `GOOGLE_ACCOUNT_DUPLICATED` | 다른 계정이 쓰고 있는 Google 계정 |

## DELETE /api/v1/me/google-link

Google 연동을 해제한다. 설정 – Google 연동하기 · 연동됨의 "연동 해제"가 확인을 거친 뒤 부른다. 해제한 뒤로는 그 Google 계정으로 로그인할 수 없다.

- 로그인: 필요
- 명세: 설정 – Google 연동하기 · 연동됨 2

### 요청

없다.

```text
DELETE /api/v1/me/google-link
```

### 서버가 하는 일

1. 연동돼 있지 않으면 바꾸지 않고 성공으로 답한다.
2. 비밀번호가 없는 계정(Google로만 가입)이면 `409`와 `GOOGLE_UNLINK_NOT_ALLOWED`. 해제하면 로그인할 방법이 없어지기 때문이다.
3. `user.google_sub`와 `user.google_email`을 비운다.

로그인 세션은 지우지 않는다. Google로 로그인해 있던 기기도 그대로 로그인돼 있다.

### 응답 `data`

해제한 뒤의 [계정의 모양](#계정의-모양)이다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "hasPassword": true,
    "isGoogleLinked": false,
    "googleEmail": null,
    "canUnlinkGoogle": false
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `409` | `GOOGLE_UNLINK_NOT_ALLOWED` | 비밀번호가 없는 계정(Google로만 가입) |

## GET /api/v1/me/notification-settings

알림을 종류별로 켰는지와, 브라우저 푸시를 구독할 때 쓰는 공개 키를 준다. 설정 – 알림 설정을 열 때 부른다.

- 로그인: 필요
- 명세: 설정 – 알림 설정 1 ~ 2

### 요청

없다.

```text
GET /api/v1/me/notification-settings
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isMeetupOn` | 참/거짓 | 모임 알림을 켰는지 | `notification_setting.meetup_on` |
| `isChatOn` | 참/거짓 | 채팅 알림을 켰는지 | `notification_setting.chat_on` |
| `isCommunityOn` | 참/거짓 | 커뮤니티 알림을 켰는지 | `notification_setting.community_on` |
| `isBurrowOn` | 참/거짓 | 땅굴 알림을 켰는지 | `notification_setting.burrow_on` |
| `isNoticeOn` | 참/거짓 | 공지 알림을 켰는지 | `notification_setting.notice_on` |
| `pushPublicKey` | 문자열 | 브라우저가 푸시 구독을 만들 때 쓰는 공개 키. 서버 설정의 푸시 키(공개 키, 개인 키, 연락처) 가운데 하나라도 없거나 키가 틀리면 `null`이다. 이때 서버는 푸시를 보내지 않는다 | 서버 설정 `itting.push.public-key` |

### 주는 방식

- 내 설정 한 줄을 준다. `notification_setting`에 줄이 없으면 다섯 값을 모두 `true`로 준다.
- "브라우저 알림 받기" 스위치의 상태는 주지 않는다. 프론트엔드가 이 브라우저의 알림 권한과 구독으로 정한다([브라우저 푸시](#브라우저-푸시)).

### 응답 예시

```json
{
  "success": true,
  "data": {
    "isMeetupOn": true,
    "isChatOn": true,
    "isCommunityOn": false,
    "isBurrowOn": true,
    "isNoticeOn": true,
    "pushPublicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## PATCH /api/v1/me/notification-settings

알림을 종류별로 켜고 끈다. 알림 설정의 스위치를 누를 때마다 부른다. 저장 버튼은 없다.

- 로그인: 필요
- 명세: 설정 – 알림 설정 2

### 요청

다섯 값을 모두 보낸다. 바꾸지 않은 종류도 지금 값을 담는다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `isMeetupOn` | 참/거짓 | ✓ | 모임 알림을 켤지 |
| 본문 | `isChatOn` | 참/거짓 | ✓ | 채팅 알림을 켤지 |
| 본문 | `isCommunityOn` | 참/거짓 | ✓ | 커뮤니티 알림을 켤지 |
| 본문 | `isBurrowOn` | 참/거짓 | ✓ | 땅굴 알림을 켤지 |
| 본문 | `isNoticeOn` | 참/거짓 | ✓ | 공지 알림을 켤지 |

```text
PATCH /api/v1/me/notification-settings
```

```json
{
  "isMeetupOn": true,
  "isChatOn": true,
  "isCommunityOn": false,
  "isBurrowOn": true,
  "isNoticeOn": true
}
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 다섯 값이 모두 있는지다. 어긋나면 `400`과 `INVALID_INPUT`.
2. 내 `notification_setting` 줄의 `meetup_on`, `chat_on`, `community_on`, `burrow_on`, `notice_on`을 보낸 값으로 바꾼다. 줄이 없으면 만든다.
3. 빨간 점을 켤지가 달라졌으면 나에게 실시간 소식 `NOTIFICATION_UNREAD_CHANGED`를 보낸다([알림 API](09-notification.md#실시간-소식)). 안 읽은 채팅 알림이 있는데 채팅 알림을 끄면 빨간 점이 꺼지는 경우다.

이미 받은 알림은 지우지 않는다.

### 응답 `data`

저장한 뒤의 값이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `isMeetupOn` | 참/거짓 | 모임 알림을 켰는지 | `notification_setting.meetup_on` |
| `isChatOn` | 참/거짓 | 채팅 알림을 켰는지 | `notification_setting.chat_on` |
| `isCommunityOn` | 참/거짓 | 커뮤니티 알림을 켰는지 | `notification_setting.community_on` |
| `isBurrowOn` | 참/거짓 | 땅굴 알림을 켰는지 | `notification_setting.burrow_on` |
| `isNoticeOn` | 참/거짓 | 공지 알림을 켰는지 | `notification_setting.notice_on` |

### 응답 예시

```json
{
  "success": true,
  "data": {
    "isMeetupOn": true,
    "isChatOn": true,
    "isCommunityOn": false,
    "isBurrowOn": true,
    "isNoticeOn": true
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/me/push-subscriptions

이 브라우저를 브라우저 푸시를 받을 곳으로 등록한다. "브라우저 알림 받기"를 켜서 브라우저가 알림을 허용하고 구독을 만든 뒤에 부른다([브라우저 푸시](#브라우저-푸시)).

- 로그인: 필요
- 명세: 설정 – 알림 설정 2, [00 공통](../spec/00-common.md) 2

### 요청

브라우저가 만든 구독의 값을 그대로 보낸다.

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `endpoint` | 문자열 | ✓ | 브라우저가 준 푸시 수신 주소. `https://`로 시작하는 ASCII 글이다(공백 없음). 2,000자까지 |
| 본문 | `keys` | 객체 | ✓ | 푸시를 암호화하는 키 |
| 본문 | `keys.p256dh` | 문자열 | ✓ | 브라우저가 준 공개 키. base64url 글이고 255자까지 |
| 본문 | `keys.auth` | 문자열 | ✓ | 브라우저가 준 인증 값. base64url 글이고 255자까지 |

```text
POST /api/v1/me/push-subscriptions
```

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/c1KrmpTuRm8:APA91bHexample",
  "keys": {
    "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    "auth": "tBHItJI5svbpez7KI4CCXg"
  }
}
```

### 서버가 하는 일

1. 입력값의 모양을 본다. 세 값이 있는지, `endpoint`의 모양 · 길이, 두 키의 모양 · 길이다. 어긋나면 `400`과 `INVALID_INPUT`이고 `fields`의 `field`는 `endpoint`, `keys`, `keys.p256dh`, `keys.auth`다.
2. `push_subscription`에서 같은 `endpoint`의 줄을 찾는다. 같은 주소가 동시에 들어와도 오류 없이 줄 하나를 둔다.
3. 없으면 `user_id`를 나로 해서 새 줄을 넣고 `201`로 답한다.
4. 있으면 그 줄의 `user_id`를 나로, 키를 보낸 값으로 바꾸고 `200`으로 답한다. 이 브라우저를 다른 계정이 등록해 두었던 경우에도 내 것으로 바뀐다.

### 응답 `data`

새로 등록했으면 `201`, 이미 등록돼 있던 브라우저면 `200`이다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `pushSubscriptionId` | 숫자 | 등록의 id. 끌 때 쓴다 | `push_subscription.id` |

### 응답 예시

```json
{
  "success": true,
  "data": { "pushSubscriptionId": 37 },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## DELETE /api/v1/me/push-subscriptions/{pushSubscriptionId}

이 브라우저의 푸시 등록을 지운다. "브라우저 알림 받기"를 끌 때와 로그아웃하기 직전에 부른다.

- 로그인: 필요
- 명세: 설정 – 알림 설정 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `pushSubscriptionId` | 숫자 | ✓ | 등록할 때 받은 id |

프론트엔드가 id를 잃어버렸으면 이 브라우저의 구독으로 `POST /api/v1/me/push-subscriptions`를 다시 불러 id를 받는다.

```text
DELETE /api/v1/me/push-subscriptions/37
```

### 서버가 하는 일

1. 내 `push_subscription` 가운데 그 id의 줄을 지운다. 없거나 내 것이 아니면 아무것도 하지 않고 성공으로 답한다.

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

공통 에러 코드만 쓴다.

## GET /api/v1/notices

공지 목록을 준다. 설정 – 공지사항을 열 때와 페이지를 넘길 때 부른다.

- 로그인: 필요
- 명세: 설정 – 공지사항 1 ~ 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 쿼리 | `page` | 숫자 | | 페이지 번호. 1부터 센다. 보내지 않으면 1 |
| 쿼리 | `size` | 숫자 | | 한 페이지의 공지 수. 1 ~ 50. 보내지 않으면 10 |

```text
GET /api/v1/notices?page=1&size=10
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `items` | 목록 | 공지 한 줄의 목록 | |
| `items[].id` | 숫자 | 공지의 id | `notice.id` |
| `items[].category` | enum | 분류. `NOTICE`(공지), `UPDATE`(업데이트), `EVENT`(이벤트) 가운데 하나 | `notice.category` |
| `items[].title` | 문자열 | 제목 | `notice.title` |
| `items[].createdAt` | 시각 | 올린 시각 | `notice.created_at` |
| `page` | 숫자 | 지금 페이지 | 계산: 요청의 `page` |
| `size` | 숫자 | 한 페이지의 공지 수 | 계산: 요청의 `size` |
| `totalItems` | 숫자 | 전체 건수 | 계산: 삭제하지 않은 `notice`의 줄 수 |
| `totalPages` | 숫자 | 전체 페이지 수 | 계산: `totalItems`를 `size`로 나눠 올림 |

### 주는 방식

- 삭제하지 않은 공지를 모두 준다. 분류로 거르지 않는다.
- 올린 시각이 최근인 것부터 준다. 시각이 같으면 `id`가 큰 것부터다.
- [페이지 방식](../api-convention.md#페이지-방식)이다. 한 페이지에 10개다. 공지가 없으면 `items`가 `[]`이고 `totalItems`와 `totalPages`가 0이다.
- 본문은 목록에 담지 않는다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 12, "category": "UPDATE", "title": "모임 캘린더가 새로 생겼어요", "createdAt": "2026-11-18T02:00:00Z" },
      { "id": 11, "category": "EVENT", "title": "첫 모임 열기 이벤트", "createdAt": "2026-11-10T01:30:00Z" },
      { "id": 9, "category": "NOTICE", "title": "서비스 점검 안내(11월 8일 새벽)", "createdAt": "2026-11-05T06:00:00Z" }
    ],
    "page": 1,
    "size": 10,
    "totalItems": 3,
    "totalPages": 1
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/notices/{noticeId}

공지 한 건의 분류, 제목, 올린 시각, 본문을 준다. 공지사항 목록의 한 줄을 누를 때와 공지 알림을 눌러 들어올 때 부른다.

- 로그인: 필요
- 명세: 설정 – 공지사항 상세 2 ~ 3, [09 알림](../spec/09-notification.md)의 공지 알림

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `noticeId` | 숫자 | ✓ | 공지의 id |

```text
GET /api/v1/notices/12
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `id` | 숫자 | 공지의 id | `notice.id` |
| `category` | enum | 분류. `NOTICE`, `UPDATE`, `EVENT` 가운데 하나 | `notice.category` |
| `title` | 문자열 | 제목 | `notice.title` |
| `content` | 문자열 | 본문. 줄바꿈이 있는 글이다 | `notice.content` |
| `createdAt` | 시각 | 올린 시각 | `notice.created_at` |

### 주는 방식

- 그 공지 하나를 준다. 없거나 삭제한 공지면 `404`와 `NOTICE_NOT_FOUND`로 답한다. 프론트엔드는 안내 화면을 보여 준다.
- 이전 글 · 다음 글은 주지 않는다. 명세의 화면에 "목록으로"만 있다.

### 응답 예시

```json
{
  "success": true,
  "data": {
    "id": 12,
    "category": "UPDATE",
    "title": "모임 캘린더가 새로 생겼어요",
    "content": "내 모임에서 캘린더를 열 수 있어요.\n참여하는 모임과 내가 연 모임이 날짜별로 보입니다.",
    "createdAt": "2026-11-18T02:00:00Z"
  },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `404` | `NOTICE_NOT_FOUND` | 없거나 삭제한 공지 |

## GET /api/v1/me/withdrawal-check

지금 탈퇴할 수 있는지를 미리 알려 준다. 설정 – 회원 탈퇴를 열 때와 Google 인증에서 돌아왔을 때 부른다.

- 로그인: 필요
- 명세: 설정 – 회원 탈퇴 1 · 3, 설정 – 회원 탈퇴 · Google 계정 1

### 요청

없다.

```text
GET /api/v1/me/withdrawal-check
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `canWithdraw` | 참/거짓 | 탈퇴를 막는 모임이 없는지 | 계산: `hostingMeetups`가 비어 있는지 |
| `hostingMeetups` | 목록 | 탈퇴를 막는, 내가 연 예정 모임 | |
| `hostingMeetups[].id` | 숫자 | 모임의 id | `meetup.id` |
| `hostingMeetups[].title` | 문자열 | 모임 이름 | `meetup.title` |
| `hostingMeetups[].startsAt` | 시각 | 시작 시각 | `meetup.starts_at` |
| `isGoogleVerified` | 참/거짓 | 탈퇴를 위한 Google 확인이 끝나 아직 유효한지. 비밀번호가 있는 계정은 항상 `false` | 임시 저장소: 이 세션의 Google 확인 기록(`WITHDRAW`)이 있는지 |

### 주는 방식

- `hostingMeetups`는 내가 주최자이고, 시작하지 않았고, 취소 · 삭제되지 않은 모임이다. 시작이 가까운 것부터 모두 준다.
- 프론트엔드는 `canWithdraw`가 `false`면 모임 이름과 함께 "먼저 모임을 삭제하거나 취소해 주세요"를 보여 주고 "회원 탈퇴" 버튼을 끈다. 모임을 누르면 모임 상세로 간다. 삭제할지 취소할지는 모임 상세가 정한다([모임 API](07-meetup.md#get-apiv1meetupsmeetupid)).
- 본인 확인을 비밀번호로 할지 Google로 할지는 [`GET /api/v1/me/account`](#get-apiv1meaccount)의 `hasPassword`로 정한다.
- `isGoogleVerified`가 `true`면 프론트엔드가 "인증 완료"를 보여 준다. 확인받은 지 10분이 지나면 `false`로 돌아간다.
- 탈퇴와 함께 취소되는 내 참여와 신청은 주지 않는다. 탈퇴 안내의 글은 프론트엔드가 갖는다.

### 응답 예시

내가 연 예정 모임이 하나 있는 계정:

```json
{
  "success": true,
  "data": {
    "canWithdraw": false,
    "hostingMeetups": [
      { "id": 19, "title": "토요일 아침 한강 러닝", "startsAt": "2026-11-28T00:00:00Z" }
    ],
    "isGoogleVerified": false
  },
  "error": null
}
```

### 에러

공통 에러 코드만 쓴다.

## POST /api/v1/me/withdraw

탈퇴한다. 회원 탈퇴 확인 팝업의 "탈퇴하기"가 부른다. 되돌릴 수 없다. 성공하면 로그아웃된 상태가 되고 프론트엔드는 랜딩으로 보낸다.

- 로그인: 필요
- 명세: 설정 – 회원 탈퇴 1 ~ 5, 설정 – 회원 탈퇴 · Google 계정 1, 설정 – 회원 탈퇴 · 탈퇴 확인 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `password` | 문자열 | | 지금 쓰는 비밀번호. 비밀번호가 있는 계정은 반드시 보낸다. Google로만 가입한 계정은 보내지 않는다 |
| 본문 | `reason` | enum | | 탈퇴 사유. `NOT_USING`(자주 쓰지 않아요), `COURSE_ENDED`(SSAFY 과정이 끝났어요), `NO_MATCH`(맞는 사람이나 모임을 찾지 못했어요), `INCONVENIENT`(쓰기 불편해요), `UNPLEASANT`(불쾌한 일을 겪었어요), `ETC`(기타) 가운데 하나. 고르지 않았으면 `null`이거나 보내지 않는다 |

"동의" 체크는 보내지 않는다. 프론트엔드가 체크해야 버튼을 켠다.

```text
POST /api/v1/me/withdraw
```

```json
{ "password": "mole1234!", "reason": "COURSE_ENDED" }
```

### 서버가 하는 일

1. 입력값의 모양을 본다. `reason`이 목록의 값인지다. 어긋나면 `400`과 `INVALID_INPUT`.
2. 본인임을 확인한다.
   - 비밀번호가 있는 계정: `password`가 없으면 `400`과 `INVALID_INPUT`, 지금 비밀번호와 맞지 않으면 `400`과 `CURRENT_PASSWORD_MISMATCH`.
   - 비밀번호가 없는 계정: 이 세션의 Google 확인 기록(`WITHDRAW`)이 없거나 10분이 지났으면 `409`와 `GOOGLE_VERIFICATION_REQUIRED`.
3. 내가 연 예정 모임이 있으면 `409`와 `HOSTING_MEETUP_EXISTS`.
4. 예정 모임의 내 신청을 정리한다. 기다리는 신청은 `WITHDRAWN`으로, 확정된 참여는 `CANCELED`로 바꾼다. 확정된 참여마다 주최자에게 참여 취소 알림을 만들고, 정원이 차 있던 모임이면 빈자리 알림을 만든다.
5. 내가 들어 있는 대화방마다 `type`이 `WITHDRAWN`인 안내 메시지를 넣고 `chat_room_member.left_at`을 채운다. 대화방에 남은 사람들에게 채팅의 실시간 소식으로 간다.
6. 내가 보내거나 받은 대화 요청을 지운다. 내가 보낸 요청을 받아 둔 사람에게는 "요청 N"이 줄었다는 실시간 소식이 간다.
7. 찜, 좋아요, 저장, 단골, 내 땅굴과 받은 방명록 글, 프로필, 알림 설정, 푸시 등록, 받은 알림을 지운다.
8. `user_withdrawal`에 `reason`과 탈퇴한 시각을 한 줄 넣는다. `user.status`를 `WITHDRAWN`으로 바꾸고 `email`, `password_hash`, `google_sub`, `google_email`, `mattermost_id`를 비운다.
9. 이 계정의 로그인 세션을 모두 지우고, 세션 쿠키를 지우는 응답 헤더를 준다. 실시간 소식의 연결을 끊는다.

3 ~ 8은 한 번에 처리한다. 지우는 줄과 남기는 줄은 [탈퇴할 때 하는 일](#탈퇴할-때-하는-일)에 모두 적었다.

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
| `400` | `CURRENT_PASSWORD_MISMATCH` | 비밀번호가 맞지 않음 |
| `409` | `GOOGLE_VERIFICATION_REQUIRED` | Google로만 가입한 계정이 Google 확인을 받지 않았거나 받은 지 10분이 지남 |
| `409` | `HOSTING_MEETUP_EXISTS` | 내가 연 예정 모임이 있음. 어떤 모임인지는 `GET /api/v1/me/withdrawal-check`가 준다 |

## 명세에 없어 이 문서에서 정한 것

- **탈퇴 API 하나가 여러 영역을 정리한다**: 명세가 "참여 확정 · 신청 대기 중인 예정 모임은 탈퇴와 함께 참여 취소 · 신청 취소로 처리한다"고 정했다. 그래서 `POST /api/v1/me/withdraw`가 모임 신청, 대화방, 찜 · 좋아요 · 저장까지 한 번에 바꾼다. 다른 API는 자기 영역만 바꾸지만 탈퇴는 계정의 흔적을 모두 정리하는 일이라 나누지 않았다. 나눠 부르다 중간에 끊기면 반쯤 탈퇴한 계정이 남는다.
- **탈퇴 사유 목록**: 명세에 목록의 내용이 없어 여섯 가지 코드를 정했다(`NOT_USING`, `COURSE_ENDED`, `NO_MATCH`, `INCONVENIENT`, `UNPLEASANT`, `ETC`). 글은 프론트엔드가 갖는다.
- **브라우저 알림 받기는 브라우저마다 켠다**: 계정 전체의 스위치로 두지 않았다. 알림 권한이 브라우저마다 따로라, 계정 값으로 두면 권한이 없는 브라우저에서도 스위치가 켜져 보인다. 스위치의 상태는 프론트엔드가 이 브라우저의 권한과 구독으로 정한다.
- **Google 연동은 두 걸음이다**: Google에서 돌아오는 주소(콜백)는 확인 기록만 남기고, 연결은 `PUT /api/v1/me/google-link`가 한다. `GET`으로 DB를 바꾸지 않는다는 공통 규칙과, 로그인 콜백이 DB를 바꾸지 않는 것에 맞췄다.
- **탈퇴 전에 미리 확인하는 API**: 탈퇴를 막는 모임과 Google 확인이 끝났는지를 화면을 열 때 알려 준다(`GET /api/v1/me/withdrawal-check`). 비밀번호와 사유를 다 넣고 "탈퇴하기"를 누른 뒤에야 막히는 일을 줄인다.
- **설정 메뉴가 쓰는 값**: `GET /api/v1/me`에 더하지 않고 `GET /api/v1/me/account`를 따로 두었다. `GET /api/v1/me`는 모든 화면이 서비스를 열 때 부르고, 연동 상태는 설정에서만 쓴다. 버전 정보는 프론트엔드가 갖는다.
- **비밀번호를 바꾼 뒤의 로그인**: 다른 기기는 로그아웃시키고 지금 쓰는 기기는 그대로 둔다. 비밀번호 재설정은 모든 기기를 로그아웃시키지만, 변경은 로그인한 사람이 직접 하는 일이라 지금 기기를 남겼다.
- **알림 설정은 다섯 값을 한 번에 보낸다**: 스위치를 누를 때마다 `PATCH` 하나로 다섯 값을 모두 보낸다. 종류마다 켜는 API와 끄는 API를 따로 두지 않았다. 줄이 없는 계정은 모두 켜진 것으로 본다.
- **알림 설정을 바꾸면 빨간 점도 바뀐다**: 빨간 점은 켜 둔 갈래만 보므로, 설정을 바꿔 빨간 점이 달라지면 실시간 소식을 보낸다.
- **공지 목록과 본문**: 한 페이지에 10개를 준다. 본문은 줄바꿈만 있는 글이다. 삭제한 공지는 `NOTICE_NOT_FOUND`다. 공지를 읽어도 공지 알림은 읽음으로 바뀌지 않는다.
- **탈퇴의 본인 확인**: 비밀번호는 따로 확인하는 API 없이 탈퇴 API가 함께 확인한다. Google 확인은 10분 동안 유효하다.
- **탈퇴할 때 대화방과 알림**: 내가 들어 있는 모든 대화방에 "탈퇴했습니다" 안내 메시지를 넣는다. 예정 모임의 대화방에는 "나갔습니다"를 따로 넣지 않는다. 내가 받은 알림은 지우고, 내가 일으킨 남의 알림은 남긴다.
- **이미 등록된 브라우저를 다시 등록할 때**: 새로 만들지 않고 그 줄의 주인과 키를 바꾼다. 브라우저 하나가 두 계정의 푸시를 받지 않는다.
- **브라우저 푸시를 보내는 일 (KAN-59)**: 알림이 생기면(알림을 만든 트랜잭션이 커밋된 뒤) 그 계정에 등록된 모든 브라우저로 푸시를 보낸다. 요청을 기다리게 하지 않도록 따로 보낸다.
  - **내용**: 알림 목록의 한 줄([알림 한 줄](09-notification.md#알림의-모양))과 같은 모양의 JSON이다(`id`, `type`, `category`, `actor`, `target`, `isRead`, `createdAt`). 문구와 눌렀을 때 갈 주소는 프론트엔드의 서비스 워커가 `type`, `actor.nickname`, `target`으로 만든다. 알림 목록과 푸시의 글이 같은 곳에서 만들어진다.
  - **새 메시지 알림**: 메시지마다 푸시를 하나씩 보낸다. 푸시를 덮어쓰는 `Topic`을 붙이지 않으므로 앞의 푸시 위에 쌓인다. 메시지 내용은 담지 않는다. 같은 대화방의 안 읽은 알림은 한 줄이라 푸시가 여러 번 와도 `id`가 같다. 쌓아 보여 주는 모양은 프론트엔드와 기기가 정한다.
  - **저장하는 값**: `endpoint`는 2,000자까지(ASCII, 대소문자 구분), `keys.p256dh` · `keys.auth`는 각각 255자까지(base64url)다([알림 · 공지 DB](../db/notification.md#push_subscription)).
  - **표준과 시간**: 푸시 암호화는 RFC 8291(`aes128gcm`), 서버 서명은 RFC 8292(VAPID)를 따른다. 푸시 서비스가 받지 못할 때 보관하는 시간(`TTL`)은 하루, `Urgency`는 `normal`이다.
  - **실패**: 푸시 서비스가 `404`나 `410`으로 답하면 "없는 구독"이라 그 줄을 지운다. 그 밖의 실패(연결 오류, `4xx`, `5xx`)는 로그만 남기고 다시 보내지 않는다. 푸시는 알림 목록을 보충하는 것이라 놓쳐도 알림 목록에 남는다.
  - **키 설정**: 서버 설정 `itting.push.public-key`, `itting.push.private-key`, `itting.push.subject`(연락처 `mailto:`)를 `.env`나 환경 변수(`ITTING_PUSH_PUBLIC_KEY`, `ITTING_PUSH_PRIVATE_KEY`, `ITTING_PUSH_SUBJECT`)로 넣는다. 키는 `backend/`에서 `./gradlew vapidKeys`로 만든다. 하나라도 비어 있으면 서버는 정상으로 뜨고 푸시만 보내지 않는다(`pushPublicKey`도 `null`이다).
  - **보내는 주소의 제한**: 푸시 주소는 사용자가 등록한 값이라, 서버가 요청을 보내는 곳을 `https://` 주소로, 서버 안쪽(내 PC, 사설망, 링크 로컬)이 아닌 곳으로 제한한다. 리다이렉트는 따라가지 않는다.

## 구현 단계로 넘기는 것

- 지금 비밀번호를 여러 번 틀렸을 때 막는 횟수와 시간(KAN-58에서는 막지 않았다. 로그인 API와 같은 규칙으로 함께 정한다)
- Google 확인을 시작할 때 계정을 다시 고르게 하는 방법, 확인 기록을 임시 저장소에 두는 모양
- 로그인이 만료된 브라우저에 푸시가 계속 가지 않게 하는 방법(KAN-59에서도 정하지 않았다. 로그아웃할 때 프론트엔드가 먼저 등록을 지우는 것으로 둔다. 로그인은 14일 동안 유지되고, 만료된 브라우저는 푸시 서비스가 `404` · `410`으로 답할 때까지 줄이 남는다)
- 탈퇴한 사람의 프로필 사진 파일을 저장소에서 지우는 때
- 공지를 올리고 고치는 API와 본문의 길이(11 운영 · 관리자). 제목은 100자 이하로 정했다(KAN-58, [알림 · 공지 DB](../db/notification.md#notice))
- 회원 탈퇴의 비밀번호 칸이 가리키는 공통 규칙, 비밀번호 변경의 "취소"가 확인을 거치는지(명세의 "아직 정하지 않은 것". 화면의 일이다)
