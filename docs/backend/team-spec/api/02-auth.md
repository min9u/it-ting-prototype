# 로그인 · 회원가입 API

이메일 가입, SSAFY 인증, 로그인과 로그아웃, Google 로그인, 비밀번호 재설정을 다룬다. 규칙은 [API 공통 규칙](../api-convention.md)을 따른다.

- 명세: [02 로그인 · 회원가입](../spec/02-auth.md), 로그아웃은 [10 설정 · 계정](../spec/10-settings.md#설정--로그아웃-확인)
- DB 설계: [계정 · 프로필 · 관심사 · 질문](../db/account.md)

## 목록

"가입 진행 중"은 로그인은 필요 없지만 [가입 진행 기록](#가입-진행)이 있어야 부를 수 있다는 뜻이다.

| 메서드 | 주소 | 하는 일 | 로그인 | 명세의 화면 · 항목 |
|---|---|---|---|---|
| `POST` | `/api/v1/email-verifications` | 가입할 이메일로 인증 코드를 보낸다 | 불필요 | 회원가입 1 · 3, 4 |
| `POST` | `/api/v1/email-verifications/check` | 이메일 인증 코드를 확인하고 가입 진행을 시작한다 | 불필요 | 회원가입 1 · 5, 7 |
| `POST` | `/api/v1/ssafy-verifications` | Mattermost로 SSAFY 인증 코드를 보낸다 | 불필요(가입 진행 중) | 회원가입 3 · 4 |
| `POST` | `/api/v1/users` | SSAFY 인증 코드를 확인하고 계정을 만들어 로그인한다 | 불필요(가입 진행 중) | 회원가입 2 · 3, 회원가입 3 · 3, 5, 7, 8 |
| `POST` | `/api/v1/sessions` | 이메일과 비밀번호로 로그인한다 | 불필요 | 로그인 2 ~ 4 |
| `DELETE` | `/api/v1/sessions/current` | 로그아웃한다 | 필요 | 10 설정 – 로그아웃 확인 2 |
| `GET` | `/api/v1/me` | 로그인 상태와 다음에 갈 화면, 소속을 알려 준다 | 필요 | 영역 규칙 "로그인한 뒤 가는 곳" |
| `GET` | `/api/v1/oauth/google` | Google 로그인을 시작한다(브라우저 이동) | 불필요 | 로그인 5 |
| `GET` | `/api/v1/oauth/google/callback` | Google이 돌려보내는 주소. 로그인시키거나 가입 진행을 시작하고 프론트엔드로 보낸다 | 불필요 | 로그인 5 |
| `POST` | `/api/v1/password-resets` | 비밀번호 재설정 메일을 보낸다 | 불필요 | 재설정 메일 요청 2, 메일 보냄 2 |
| `GET` | `/api/v1/password-resets/{token}` | 재설정 링크가 유효한지 확인한다 | 불필요 | 링크 만료 1 |
| `POST` | `/api/v1/password-resets/{token}/complete` | 새 비밀번호를 저장한다 | 불필요 | 새 비밀번호 설정 3 |

## 화면마다 부르는 API

| 화면 | 부르는 때 | API |
|---|---|---|
| 회원가입 1 · 이메일 | 인증 코드를 처음 보낼 때와 "재전송" | `POST /api/v1/email-verifications` |
| 회원가입 1 · 이메일 | "다음" | `POST /api/v1/email-verifications/check` |
| 회원가입 2 · 비밀번호 | "다음" | 부르지 않는다. 비밀번호는 프론트엔드가 갖고 있다가 회원가입 3의 "땅굴 파기"에서 보낸다 |
| 회원가입 3 · SSAFY 인증 | 화면을 열 때 | [`GET /api/v1/generations`](00-common.md#get-apiv1generations), [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses) |
| 회원가입 3 · SSAFY 인증 | "코드 받기" | `POST /api/v1/ssafy-verifications` |
| 회원가입 3 · SSAFY 인증 | "땅굴 파기" | `POST /api/v1/users` |
| 로그인 | "로그인" | `POST /api/v1/sessions` |
| 로그인 | "Google로 계속하기" | 브라우저가 `GET /api/v1/oauth/google`로 이동 |
| 모든 화면 | 서비스를 처음 열 때 | `GET /api/v1/me` |
| 비밀번호 찾기 · 재설정 메일 요청, 메일 보냄 | "링크 보내기", "다시 보내기" | `POST /api/v1/password-resets` |
| 비밀번호 찾기 · 새 비밀번호 설정 | 메일의 링크로 들어올 때 | `GET /api/v1/password-resets/{token}` |
| 비밀번호 찾기 · 새 비밀번호 설정 | "비밀번호 바꾸기" | `POST /api/v1/password-resets/{token}/complete` |
| 설정 – 로그아웃 확인 | "로그아웃" | `DELETE /api/v1/sessions/current` |

## 영역 규칙

### 가입 진행

계정은 회원가입 3의 "땅굴 파기"로 SSAFY 인증을 마칠 때 만든다. 그 전에는 DB에 아무것도 저장하지 않는다. 가입 도중에 나가면 남는 것이 없고, 다시 가입하려면 처음부터 다시 한다.

가입하는 동안 서버가 기억해야 하는 값은 가입 진행 기록에 둔다. 가입 진행 기록은 DB가 아니라 임시 저장소(Redis)에 두고, 시간이 지나면 저절로 사라진다.

| 가입 진행 기록에 담는 값 | 담는 때 |
|---|---|
| 가입 방법(이메일 / Google) | 기록을 만들 때 |
| 인증한 이메일 | 이메일 가입. `POST /api/v1/email-verifications/check`가 성공할 때 |
| Google 식별자와 Google 이메일 | Google 가입. Google 콜백에서 처음 쓰는 Google 계정일 때 |
| 기수, Mattermost ID, SSAFY 인증 코드 | `POST /api/v1/ssafy-verifications`를 부를 때 |

- 서버는 가입 진행 기록을 만들 때 그 기록을 가리키는 가입 쿠키를 준다. 브라우저가 이후 요청에 쿠키를 함께 보내고, 서버는 쿠키로 기록을 찾는다. 프론트엔드 코드는 이 쿠키를 읽거나 다루지 않는다.
- 가입 진행 기록은 만든 뒤 1시간 동안 둔다. 가입 쿠키는 `ITTING_SIGNUP`이고 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1`, `Max-Age` 1시간이다. 값은 추측할 수 없는 무작위 값이다.
- 비밀번호는 가입 진행 기록에 두지 않는다. 프론트엔드가 회원가입 2에서 받은 값을 화면 상태로 갖고 있다가 `POST /api/v1/users`에 담아 보낸다.
- 가입 진행 기록이 없거나 시간이 지난 채로 `POST /api/v1/ssafy-verifications`나 `POST /api/v1/users`를 부르면 `409`와 `SIGNUP_EXPIRED`로 답한다. 프론트엔드는 가입을 처음부터 다시 시작하게 한다.
- 계정을 만들면 가입 진행 기록을 지운다. 같은 브라우저에서 가입을 새로 시작하면 이전 기록을 덮어쓴다.
- 이메일 가입 도중에 새로 고침하거나 나갔다 오면 프론트엔드에 비밀번호가 남아 있지 않으므로 회원가입 1부터 다시 한다. Google 가입은 "Google로 계속하기"를 다시 누르면 회원가입 3으로 온다.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SIGNUP_EXPIRED",
    "message": "가입 시간이 지났습니다. 처음부터 다시 진행해 주세요.",
    "fields": null,
    "detail": null
  }
}
```

### 다음에 갈 화면

로그인하거나 계정을 만들면 응답의 `nextStep`으로 다음에 갈 화면을 알려 준다. 프론트엔드는 이 값만 보고 이동한다. `nextStep`은 enum이고 값은 아래 셋이다.

| `nextStep` | 계정 상태 | 가는 곳 |
|---|---|---|
| `ONBOARDING` | 온보딩을 마치지 않음 | 온보딩 1 |
| `NEW_TERM` | 온보딩을 마쳤고, 새 학기가 열렸는데 이번 학기의 캠퍼스 · 층을 고르지 않음 | 내 땅굴. 그 위에 새 학기 안내를 띄운다 |
| `HOME` | 온보딩을 마치고 이번 학기의 캠퍼스 · 층도 고름 | 내 땅굴 |

`nextStep`은 저장하지 않는다. `user.onboarded_at`이 비어 있으면 `ONBOARDING`이다. 있으면 내 땅굴의 입구가 이번 학기 들판에 있는지(`burrow_entrance.term_id`)를 본다. 아니면 `NEW_TERM`, 맞으면 `HOME`이다. SSAFY 인증을 마치지 않은 계정은 없다. 계정을 SSAFY 인증을 마칠 때 만들기 때문이다.

### 온보딩을 마치지 않은 계정

`nextStep`이 `ONBOARDING`인 계정은 이 문서의 API, 로그인 없이 부르는 API, "온보딩 중에도"라고 적힌 API([온보딩 API](03-onboarding.md), [공통 API](00-common.md)의 학기 · 관심사 · 질문 목록)만 부를 수 있다. 다른 API를 부르면 `403`과 `ONBOARDING_INCOMPLETE`로 답한다.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ONBOARDING_INCOMPLETE",
    "message": "온보딩을 마친 뒤에 이용할 수 있습니다.",
    "fields": null,
    "detail": null
  }
}
```

### 새 학기를 고르지 않은 계정

새 학기 들판이 열리면 이번 학기의 캠퍼스 · 층을 반드시 골라야 한다([명세](../spec/05-explore-visit.md#땅굴-메인--새-학기-안내)). `nextStep`이 `NEW_TERM`인 계정은 이 문서의 API, 로그인 없이 부르는 API, "새 학기를 고르기 전에도"라고 적힌 API([공통 API](00-common.md)의 학기 · 관심사 · 질문 목록, 이사 API)만 부를 수 있다. 온보딩 API도 부를 수 없다. 다른 API를 부르면 `403`과 `NEW_TERM_INCOMPLETE`로 답한다.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NEW_TERM_INCOMPLETE",
    "message": "이번 학기의 캠퍼스와 층을 고른 뒤에 이용할 수 있습니다.",
    "fields": null,
    "detail": null
  }
}
```

- 고르는 API는 [`POST /api/v1/me/burrow/move`](05-explore-visit.md#post-apiv1meburrowmove)다. 고르면 땅굴이 이번 학기 들판으로 이사하고 `nextStep`이 `HOME`이 된다.
- 새 학기가 열릴 때 이미 서비스를 쓰고 있던 사람은 다음 요청에서 이 에러를 받는다. 프론트엔드는 이 에러를 받으면 어느 화면에서든 새 학기 안내를 띄운다.

### 인증 코드

- 이메일 인증과 SSAFY 인증 모두 숫자 6자리다.
- 유효 시간은 보낸 뒤 5분이다. 재전송 간격은 60초다.
- 5번 틀리면 코드를 지운다. 그 뒤로는 맞는 코드를 넣어도 `VERIFICATION_CODE_EXPIRED`이고, 코드를 다시 받아야 한다. 코드를 지워도 재전송 간격은 그대로 센다.
- 메일 서버나 Mattermost에 보내지 못하면 `503`과 `VERIFICATION_SEND_FAILED`로 답한다. 만든 코드는 지우고 재전송 간격도 세지 않으므로 바로 다시 부를 수 있다.
- 코드는 DB가 아니라 임시 저장소(Redis)에 두고, 유효 시간이 지나면 저절로 사라진다([DB 설계](../db/account.md)).
- 코드를 보내는 API는 코드가 만료되는 시각 `expiresAt`을 준다. 프론트엔드는 이 값으로 남은 시간을 표시한다.
- 코드를 다시 보내는 API는 따로 없다. 같은 API를 다시 부르면 새 코드를 보내고 이전 코드는 쓸 수 없게 된다.
- 재전송 간격 안에 다시 부르면 `429`와 `TOO_MANY_REQUESTS`로 답한다.

### 세션 쿠키

로그인시키는 API(`POST /api/v1/users`, `POST /api/v1/sessions`, 이미 가입한 계정의 Google 콜백)는 세션을 Redis에 만들고 응답 헤더로 세션 쿠키를 준다. 응답 본문에는 세션 값을 담지 않는다([API 공통 규칙](../api-convention.md)의 로그인).

## POST /api/v1/email-verifications

가입할 이메일로 인증 코드를 보낸다. 회원가입 1에서 코드를 처음 보낼 때와 "재전송"을 누를 때 모두 이 API를 부른다.

- 로그인: 불필요
- 명세: 회원가입 1 · 3, 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `email` | 문자열 | ✓ | 가입할 이메일. 이메일 형식이어야 한다 |

```text
POST /api/v1/email-verifications
```

```json
{ "email": "mole@example.com" }
```

### 서버가 하는 일

1. `email`이 이메일 형식인지 본다. 아니면 `400`과 `INVALID_INPUT`.
2. `user.email`에 같은 이메일이 있으면 `409`와 `EMAIL_DUPLICATED`. 탈퇴한 계정은 이메일을 비워 두므로 걸리지 않는다.
3. 이 이메일로 마지막으로 보낸 뒤 재전송 간격이 지나지 않았으면 `429`와 `TOO_MANY_REQUESTS`.
4. 숫자 6자리 코드를 만들어 Redis에 이메일, 코드, 보낸 시각을 저장한다. 이 이메일의 이전 코드는 덮어쓴다. 이메일은 대소문자를 가리지 않는다.
5. 그 이메일로 코드를 담은 메일을 보낸다. 제목은 "[디굴디굴] 이메일 인증 코드"다. 보내지 못하면 4에서 저장한 것을 지우고 `503`과 `VERIFICATION_SEND_FAILED`.

DB에는 아무것도 저장하지 않는다.

### 응답 `data`

`201`로 답한다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `expiresAt` | 시각 | 인증 코드가 만료되는 시각 | 임시 저장소: 보낸 시각에 유효 시간을 더한 값 |

### 응답 예시

```json
{
  "success": true,
  "data": { "expiresAt": "2026-11-18T08:06:05Z" },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `409` | `EMAIL_DUPLICATED` | 이미 가입한 이메일 |
| `503` | `VERIFICATION_SEND_FAILED` | 메일 서버에 보내지 못함. 바로 다시 부를 수 있다 |

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "EMAIL_DUPLICATED",
    "message": "이미 가입한 이메일입니다.",
    "fields": null,
    "detail": null
  }
}
```

## POST /api/v1/email-verifications/check

입력한 인증 코드가 맞는지 확인하고, 맞으면 가입 진행을 시작한다. 회원가입 1의 "다음"을 누를 때 부르고, 성공하면 회원가입 2로 넘어간다.

- 로그인: 불필요
- 명세: 회원가입 1 · 5, 7

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `email` | 문자열 | ✓ | 코드를 받은 이메일 |
| 본문 | `code` | 문자열 | ✓ | 숫자 6자리. 앞자리 0을 지키려고 문자열로 보낸다 |

```text
POST /api/v1/email-verifications/check
```

```json
{ "email": "mole@example.com", "code": "048213" }
```

### 서버가 하는 일

1. `code`가 숫자 6자리인지 본다. 아니면 `400`과 `INVALID_INPUT`.
2. Redis에서 그 이메일의 코드를 찾는다. 없으면(만료됐거나 보낸 적이 없음) `400`과 `VERIFICATION_CODE_EXPIRED`.
3. 코드가 다르면 `400`과 `VERIFICATION_CODE_MISMATCH`. 틀린 횟수가 5번이 되면 코드를 지운다.
4. Redis의 코드를 지운다. 같은 코드는 다시 쓸 수 없다.
5. [가입 진행 기록](#가입-진행)을 만들고 가입 쿠키를 준다. 이 브라우저에 이전 가입 진행 기록이 있으면 덮어쓴다.

| 값 | 저장하는 곳 |
|---|---|
| 가입 방법(이메일), 인증한 이메일 | 임시 저장소의 가입 진행 기록 |

DB에는 아무것도 저장하지 않는다. 계정은 `POST /api/v1/users`에서 만든다.

### 응답 `data`

`null`이다. 가입 쿠키는 응답 헤더로 준다.

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
| `400` | `VERIFICATION_CODE_MISMATCH` | 코드가 맞지 않음 |
| `400` | `VERIFICATION_CODE_EXPIRED` | 코드가 만료됐거나 보낸 적이 없음 |

## POST /api/v1/ssafy-verifications

고른 기수의 Mattermost로 인증 코드를 보낸다. 회원가입 3에서 "코드 받기"를 누를 때와 다시 누를 때 모두 이 API를 부른다. 아직 계정이 없으므로 로그인 없이 부르고, 서버는 가입 쿠키로 누구의 가입인지 안다.

- 로그인: 불필요(가입 진행 중)
- 명세: 회원가입 3 · 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `generation` | 숫자 | ✓ | 기수. [`GET /api/v1/generations`](00-common.md#get-apiv1generations)가 준 값 가운데 하나 |
| 본문 | `mattermostId` | 문자열 | ✓ | SSAFY Mattermost ID. 앞뒤 공백과 앞의 `@`를 떼고 소문자로 바꾼다. 바꾼 값이 영문 소문자 · 숫자 · `.` · `-` · `_` 3 ~ 22자여야 한다(Mattermost 아이디 규칙) |

```text
POST /api/v1/ssafy-verifications
```

```json
{ "generation": 14, "mattermostId": "mole.kim" }
```

### 서버가 하는 일

1. 입력값의 모양을 본다(`generation`이 있는지, `mattermostId`의 모양). 어긋나면 `400`과 `INVALID_INPUT`.
2. 가입 쿠키로 [가입 진행 기록](#가입-진행)을 찾는다. 없거나 시간이 지났으면 `409`와 `SIGNUP_EXPIRED`.
3. `generation`이 기수 목록에 있는지 본다. 없으면 `400`과 `INVALID_INPUT`(`fields`에 `generation`).
4. `user.mattermost_id`에 같은 값이 있으면 `409`와 `MATTERMOST_ID_DUPLICATED`.
5. 재전송 간격이 지나지 않았으면 `429`와 `TOO_MANY_REQUESTS`.
6. 숫자 6자리 코드를 만들어 가입 진행 기록에 기수, Mattermost ID, 코드, 보낸 시각을 담는다. 이전 코드는 덮어쓴다.
7. 그 기수의 Mattermost에서 그 ID로 코드를 담은 DM을 보낸다. 아래 "Mattermost로 보내는 방법"을 따른다. 보내지 못하면 6에서 담은 것을 지우고 `503`과 `VERIFICATION_SEND_FAILED`.

| 값 | 저장하는 곳 |
|---|---|
| `generation`, `mattermostId`, 만든 코드, 보낸 시각 | 임시 저장소의 가입 진행 기록 |

Mattermost ID가 틀려 메시지가 가지 않아도 같은 응답을 준다. 명세는 화면 문구로 ID를 다시 확인하라고 안내한다(회원가입 3 · 6). DB에는 아무것도 저장하지 않는다.

#### Mattermost로 보내는 방법

- 기수마다 그 기수 Mattermost 서버의 팀원 계정에서 만든 Incoming Webhook을 여러 개 둔다(서버 설정 `itting.mattermost.webhooks.<기수>`). 웹후크에 `channel: "@<mattermostId>"`를 보내면 그 사람에게 웹후크를 만든 팀원 이름으로 DM이 간다.
- 메시지는 "[디굴디굴] SSAFY 인증 코드는 123456입니다. 5분 안에 입력해 주세요."다.
- 한 계정에 메시지가 몰리지 않게 웹후크를 돌아가며 쓴다.
- 한 웹후크가 실패하면 같은 기수의 다음 웹후크로 다시 보낸다.
- 없는 아이디와 지워진 웹후크는 Mattermost가 같은 `400`으로 답해 구별할 수 없다. 모든 웹후크가 `400`이면 아이디가 틀린 것으로 보고 성공으로 답한다. 연결 오류나 `5xx`가 섞여 모두 실패하면 `503`과 `VERIFICATION_SEND_FAILED`다.
- 그 기수에 웹후크가 하나도 없으면 `503`과 `VERIFICATION_SEND_FAILED`다.

### 응답 `data`

`201`로 답한다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `expiresAt` | 시각 | 인증 코드가 만료되는 시각 | 임시 저장소: 보낸 시각에 유효 시간을 더한 값 |

### 응답 예시

```json
{
  "success": true,
  "data": { "expiresAt": "2026-11-18T08:11:40Z" },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `409` | `SIGNUP_EXPIRED` | 가입 진행 기록이 없거나 시간이 지남 |
| `409` | `MATTERMOST_ID_DUPLICATED` | 다른 계정이 가입에 쓴 Mattermost ID |
| `503` | `VERIFICATION_SEND_FAILED` | Mattermost에 보내지 못함. 바로 다시 부를 수 있다 |

## POST /api/v1/users

SSAFY 인증 코드를 확인하고 계정을 만든다. 회원가입 3의 "땅굴 파기"를 누를 때 부른다. 이 API가 성공해야 계정이 생기고, 성공하면 세션 쿠키를 주어 로그인 상태가 된다. 이메일이나 Google 식별자, 기수와 Mattermost ID는 다시 받지 않고 가입 진행 기록에 둔 값을 쓴다.

- 로그인: 불필요(가입 진행 중)
- 명세: 회원가입 2 · 3, 회원가입 3 · 3, 5, 7, 8

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `password` | 문자열 | | 이메일 가입이면 필수다. 회원가입 2에서 받은 비밀번호이고 [00 공통](../spec/00-common.md) 9의 규칙을 따른다(8자 이상 20자 이하, 영문 · 숫자 · 특수기호 `!@#$%`만, 각각 1개 이상). Google 가입이면 보내지 않는다 |
| 본문 | `code` | 문자열 | ✓ | Mattermost로 받은 숫자 6자리 |
| 본문 | `campusFloorId` | 숫자 | ✓ | 고른 캠퍼스-층의 id. [`GET /api/v1/campuses`](00-common.md#get-apiv1campuses)의 `floors[].id` |
| 본문 | `hasAgreedTerms` | 참/거짓 | ✓ | 이용약관 동의. `true`여야 한다 |
| 본문 | `hasAgreedPrivacy` | 참/거짓 | ✓ | 개인정보 수집 · 이용 동의. `true`여야 한다 |

"비밀번호 확인" 칸은 프론트엔드가 비교하고 서버로 보내지 않는다.

```text
POST /api/v1/users
```

이메일 가입:

```json
{
  "password": "mole1234!",
  "code": "730915",
  "campusFloorId": 12,
  "hasAgreedTerms": true,
  "hasAgreedPrivacy": true
}
```

Google 가입:

```json
{
  "code": "730915",
  "campusFloorId": 12,
  "hasAgreedTerms": true,
  "hasAgreedPrivacy": true
}
```

### 서버가 하는 일

1. 입력값의 모양을 본다. `code`가 숫자 6자리인지, 두 동의가 모두 `true`인지, `password`를 보냈으면 규칙에 맞는지다. 어긋나면 `400`과 `INVALID_INPUT`이고 `fields`에 어긋난 규칙마다 한 줄씩 담는다.
2. 가입 쿠키로 [가입 진행 기록](#가입-진행)을 찾는다. 없거나 시간이 지났으면 `409`와 `SIGNUP_EXPIRED`. 이메일 가입인데 `password`가 없으면 `400`과 `INVALID_INPUT`.
3. 가입 진행 기록의 SSAFY 인증 코드와 비교한다. 코드를 보낸 적이 없거나 만료됐으면 `VERIFICATION_CODE_EXPIRED`, 다르면 `VERIFICATION_CODE_MISMATCH`(5번 틀리면 코드를 지운다).
4. `campusFloorId`가 지우지 않은 캠퍼스-층인지 본다. 아니면 `404`와 `CAMPUS_FLOOR_NOT_FOUND`.
5. 아래 표의 값을 한 트랜잭션으로 저장한다.
6. 저장하다 값이 겹치면 모두 되돌린다. 이메일이 겹치면 `409`와 `EMAIL_DUPLICATED`, Mattermost ID가 겹치면 `409`와 `MATTERMOST_ID_DUPLICATED`, Google 식별자가 겹치면 `409`와 `GOOGLE_ACCOUNT_DUPLICATED`.
7. 가입 진행 기록과 가입 쿠키를 지운다.
8. 세션을 만들고 세션 쿠키를 준다.

| 값 | 저장하는 곳 |
|---|---|
| 가입 진행 기록의 이메일, 요청의 `password` | 이메일 가입일 때 `user.email`, `user.password_hash`(비밀번호를 해시한 값) |
| 가입 진행 기록의 Google 식별자와 Google 이메일 | Google 가입일 때 `user.google_sub`, `user.google_email`. `email`과 `password_hash`는 비워 둔다 |
| 가입 진행 기록의 Mattermost ID | `user.mattermost_id` |
| 없음. 서버가 넣는다 | `user.ssafy_verified_at`과 `user.terms_agreed_at`에 지금 시각. `user.role`은 `USER`, `user.status`는 `ACTIVE`. `user.onboarded_at`은 비워 둔다 |
| 가입 진행 기록의 기수, 요청의 `campusFloorId` | `user_profile`에 새 줄. `generation`, `campus_floor_id`. 닉네임과 두더지 아이템은 비워 둔다 |

땅굴과 땅굴 입구는 아직 만들지 않는다. 온보딩을 확정할 때 만든다([온보딩 API](03-onboarding.md)).

### 응답 `data`

`201`로 답한다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `userId` | 숫자 | 만든 계정의 id | `user.id` |
| `nextStep` | enum | 항상 `ONBOARDING` | 계산: [다음에 갈 화면](#다음에-갈-화면) |

### 응답 예시

```json
{
  "success": true,
  "data": { "userId": 31, "nextStep": "ONBOARDING" },
  "error": null
}
```

비밀번호가 규칙에 맞지 않을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "입력값이 올바르지 않습니다.",
    "fields": [
      { "field": "password", "message": "특수기호를 1개 이상 넣어야 합니다." }
    ],
    "detail": null
  }
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `400` | `VERIFICATION_CODE_MISMATCH` | 코드가 맞지 않음 |
| `400` | `VERIFICATION_CODE_EXPIRED` | 코드가 만료됐거나 보낸 적이 없음 |
| `404` | `CAMPUS_FLOOR_NOT_FOUND` | 없는 캠퍼스-층 |
| `409` | `SIGNUP_EXPIRED` | 가입 진행 기록이 없거나 시간이 지남 |
| `409` | `EMAIL_DUPLICATED` | 그 사이 다른 사람이 같은 이메일로 가입함 |
| `409` | `MATTERMOST_ID_DUPLICATED` | 그 사이 다른 계정이 같은 Mattermost ID로 가입함 |
| `409` | `GOOGLE_ACCOUNT_DUPLICATED` | 그 사이 같은 Google 계정으로 가입을 마침 |

## POST /api/v1/sessions

이메일과 비밀번호로 로그인한다. 성공하면 세션 쿠키를 준다.

- 로그인: 불필요
- 명세: 로그인 2 ~ 4

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `email` | 문자열 | ✓ | 로그인 이메일 |
| 본문 | `password` | 문자열 | ✓ | 비밀번호 |

```text
POST /api/v1/sessions
```

```json
{ "email": "mole@example.com", "password": "mole1234!" }
```

### 서버가 하는 일

1. `user.email`로 계정을 찾고 `user.password_hash`와 비밀번호를 비교한다. 계정이 없거나, 비밀번호가 다르거나, 비밀번호가 없는 계정(Google로만 가입)이면 `401`과 `LOGIN_FAILED`. 탈퇴한 계정은 이메일이 비어 있어 찾지 못한다.
2. 지금 정지 중인지 본다. `user_suspension`에 시작 시각과 끝 시각 사이이고 해제(`lifted_at`)되지 않은 줄이 있으면 `403`과 `ACCOUNT_SUSPENDED`. 비밀번호가 맞은 뒤에만 정지 사실을 알린다.
3. 세션을 만들고 세션 쿠키를 준다.

온보딩을 마치지 않은 계정도 로그인된다. 어디로 갈지는 `nextStep`으로 알린다. 가입 도중에 나간 사람은 계정이 없으므로 `LOGIN_FAILED`를 받는다. DB에는 아무것도 저장하지 않는다.

### 응답 `data`

`201`로 답한다.

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `userId` | 숫자 | 계정의 id | `user.id` |
| `nextStep` | enum | `ONBOARDING`, `NEW_TERM`, `HOME` 가운데 하나 | 계산: [다음에 갈 화면](#다음에-갈-화면) |

### 응답 예시

```json
{
  "success": true,
  "data": { "userId": 31, "nextStep": "ONBOARDING" },
  "error": null
}
```

### 에러

| 상태 | `code` | 때 |
|---|---|---|
| `401` | `LOGIN_FAILED` | 이메일이나 비밀번호가 맞지 않음. 어느 쪽이 틀렸는지는 알리지 않는다 |
| `403` | `ACCOUNT_SUSPENDED` | 정지된 계정. `error.detail`에 사유와 끝나는 시각을 담는다 |

`ACCOUNT_SUSPENDED`의 `detail`:

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `reason` | 문자열 | 정지 사유. 팝업에 보여 준다 | `user_suspension.reason` |
| `endsAt` | 시각 | 정지가 끝나는 시각. 남은 기간은 프론트엔드가 계산한다 | `user_suspension.ends_at` |

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "정지된 계정입니다.",
    "fields": null,
    "detail": { "reason": "신고 누적", "endsAt": "2026-11-25T08:00:00Z" }
  }
}
```

## DELETE /api/v1/sessions/current

로그아웃한다. 설정의 로그아웃 확인에서 "로그아웃"을 누를 때 부른다.

- 로그인: 필요
- 명세: 10 설정 – 로그아웃 확인 2

### 요청

없다.

```text
DELETE /api/v1/sessions/current
```

### 서버가 하는 일

1. 요청에 실린 세션을 Redis에서 지운다. 다른 기기의 세션은 그대로 둔다.
2. 세션 쿠키를 지우는 응답 헤더를 준다.

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

## GET /api/v1/me

로그인한 계정과 다음에 갈 화면, 소속(캠퍼스 · 기수 · 층)을 알려 준다. 프론트엔드는 서비스를 처음 열 때(새로 고침, Google 로그인에서 돌아온 직후 포함) 이 API로 로그인 여부를 확인한다.

- 로그인: 필요
- 명세: 영역 규칙 "로그인한 뒤 가는 곳"

### 요청

없다.

```text
GET /api/v1/me
```

### 응답 `data`

| 이름 | 타입 | 설명 | 값이 오는 곳 |
|---|---|---|---|
| `userId` | 숫자 | 로그인한 계정의 id | `user.id`. 세션에 든 계정 |
| `nextStep` | enum | `ONBOARDING`, `NEW_TERM`, `HOME` 가운데 하나 | 계산: [다음에 갈 화면](#다음에-갈-화면) |
| `campusName` | 문자열 | 캠퍼스 이름 | `campus.name`. `user_profile.campus_floor_id`가 가리키는 층의 캠퍼스 |
| `generation` | 숫자 | 기수 | `user_profile.generation` |
| `floor` | 숫자 | 층 | `campus_floor.floor`. `user_profile.campus_floor_id`가 가리키는 층 |
| `campusFloorId` | 숫자 | 프로필의 캠퍼스-층 id. 새 학기 안내가 지난 학기에 고른 캠퍼스를 처음에 골라 두는 데 쓴다 | `user_profile.campus_floor_id` |

### 주는 방식

- 세션 쿠키로 계정을 찾아 그 계정 하나의 값만 준다.
- 로그인하지 않았거나 세션이 만료됐으면 `401`과 `UNAUTHENTICATED`로 답한다. 프론트엔드는 이 응답을 "로그인하지 않음"으로 다룬다.
- 캠퍼스 · 기수 · 층은 프로필의 지금 값이다. 가입할 때 SSAFY 인증에서 정하고, 캠퍼스와 층은 내 정보 수정과 새 학기 안내에서 바뀐다. 계정을 만들 때 프로필도 함께 만들므로 로그인한 계정에는 항상 값이 있다. 온보딩 4의 땅굴 정보 카드가 이 값을 쓴다([온보딩 API](03-onboarding.md#화면마다-부르는-api)).
- 닉네임, 두더지 같은 나머지 프로필 값은 담지 않는다. 프로필은 [내 땅굴 API](README.md)가 준다.

### 응답 예시

온보딩까지 마친 계정:

```json
{
  "success": true,
  "data": {
    "userId": 31,
    "nextStep": "HOME",
    "campusName": "서울",
    "generation": 14,
    "floor": 2,
    "campusFloorId": 12
  },
  "error": null
}
```

온보딩을 마치지 않은 계정:

```json
{
  "success": true,
  "data": {
    "userId": 31,
    "nextStep": "ONBOARDING",
    "campusName": "서울",
    "generation": 14,
    "floor": 2,
    "campusFloorId": 12
  },
  "error": null
}
```

새 학기의 캠퍼스 · 층을 아직 고르지 않은 계정:

```json
{
  "success": true,
  "data": {
    "userId": 31,
    "nextStep": "NEW_TERM",
    "campusName": "서울",
    "generation": 14,
    "floor": 2,
    "campusFloorId": 12
  },
  "error": null
}
```

`campusName`, `floor`, `campusFloorId`는 지난 학기에 고른 값이다. 새 학기 안내가 이 캠퍼스를 처음에 골라 둔다.

로그인하지 않았을 때:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "로그인이 필요합니다.",
    "fields": null,
    "detail": null
  }
}
```

### 에러

공통 에러 코드만 쓴다.

## GET /api/v1/oauth/google

Google 로그인을 시작한다. JSON을 주고받는 API가 아니라 브라우저가 이 주소로 이동한다. 응답 틀을 쓰지 않는다.

- 로그인: 불필요
- 명세: 로그인 5

### 요청

없다. "Google로 계속하기"를 누르면 프론트엔드가 브라우저의 주소를 이 주소로 바꾼다.

```text
GET /api/v1/oauth/google
```

### 서버가 하는 일

1. 이 로그인 시도를 구분하는 값을 만들어 잠깐 기억해 둔다.
2. 브라우저를 Google의 로그인 화면으로 보낸다(`302`). 돌아올 주소는 `/api/v1/oauth/google/callback`이다.

### 응답 `data`

본문이 없다. `302`와 `Location` 헤더로 답한다.

### 에러

응답 틀을 쓰지 않으므로 에러 코드가 없다.

## GET /api/v1/oauth/google/callback

Google이 로그인을 마친 브라우저를 돌려보내는 주소다. 프론트엔드가 직접 부르지 않는다. 응답 틀을 쓰지 않는다.

- 로그인: 불필요
- 명세: 로그인 5

### 요청

Google이 붙여 보내는 쿼리(`code`, `state`)를 받는다. 프론트엔드는 이 값을 다루지 않는다.

### 서버가 하는 일

1. 시작할 때 기억해 둔 값과 `state`가 같은지 보고, `code`로 Google에서 그 사람의 Google 식별자와 이메일을 받아 온다.
2. `user.google_sub`에 같은 식별자가 있는 계정을 찾는다.
3. 계정이 있으면 이미 가입한 사람이다. 지금 정지 중이면 세션을 만들지 않는다. 아니면 세션을 만들고 세션 쿠키를 준다.
4. 계정이 없으면 처음 쓰는 Google 계정이다. 계정을 만들지 않고 [가입 진행 기록](#가입-진행)을 만든 뒤 가입 쿠키를 준다. 이 브라우저에 이전 가입 진행 기록이 있으면 덮어쓴다.
5. 브라우저를 프론트엔드의 정해진 주소로 보낸다(`302`).

설정에서 시작한 Google 확인([`GET /api/v1/oauth/google/verify`](10-settings.md#get-apiv1oauthgoogleverify))이 돌아온 것이면 2 ~ 5를 하지 않는다. 받은 Google 계정을 검사해 확인 기록만 임시 저장소에 남기고 설정 화면으로 보낸다([설정 · 계정 API](10-settings.md#google-확인)). 이때도 DB에는 아무것도 저장하지 않는다.

| 값 | 저장하는 곳 |
|---|---|
| 가입 방법(Google), Google 식별자, Google 이메일 | 처음 쓰는 Google 계정일 때 임시 저장소의 가입 진행 기록 |

DB에는 아무것도 저장하지 않는다. 처음 쓰는 Google 계정의 `user`는 회원가입 3을 마칠 때 `POST /api/v1/users`가 만든다.

### 응답 `data`

본문이 없다. `302`와 `Location` 헤더로 답한다.

| 결과 | 브라우저가 가는 곳 | 그다음 프론트엔드가 하는 일 |
|---|---|---|
| 로그인됨(이미 가입한 계정) | 프론트엔드의 정해진 주소 | `GET /api/v1/me`를 불러 `nextStep`으로 이동한다 |
| 가입 진행을 시작함(처음 쓰는 Google 계정) | 프론트엔드의 회원가입 3 주소 | 회원가입 3을 진행 표시 없이 보여 준다. "땅굴 파기"에서 `POST /api/v1/users`를 부른다 |
| 로그인하지 못함(정지된 계정, Google에서 취소) | 로그인 화면 주소에 `error=<code>`를 붙인 주소 | 로그인 화면에 머물고, `ACCOUNT_SUSPENDED`면 정지 팝업을 띄운다 |

### 에러

응답 틀을 쓰지 않는다. 실패는 위 표처럼 주소의 `error`로 알린다.

## POST /api/v1/password-resets

비밀번호 재설정 메일을 보낸다. 재설정 메일 요청의 "링크 보내기"와 메일 보냄의 "다시 보내기"가 이 API를 부른다. 가입 여부가 드러나지 않도록 어떤 이메일을 넣어도 똑같이 성공으로 답한다.

- 로그인: 불필요
- 명세: 재설정 메일 요청 2, 메일 보냄 2

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 본문 | `email` | 문자열 | ✓ | 가입한 이메일. 이메일 형식이어야 한다 |

```text
POST /api/v1/password-resets
```

```json
{ "email": "mole@example.com" }
```

### 서버가 하는 일

1. `email`이 이메일 형식인지 본다. 아니면 `400`과 `INVALID_INPUT`.
2. 같은 이메일로 60초 안에 다시 요청했으면 아무것도 하지 않고 성공으로 답한다. `429`로 답하지 않는다. 가입한 이메일만 걸려 가입 여부가 드러나기 때문이다.
3. `user.email`로 계정을 찾는다. 계정이 없거나, 탈퇴했거나, 비밀번호가 없는 계정(Google로만 가입)이면 아무것도 하지 않고 성공으로 답한다. 정지된 계정은 재설정할 수 있다(로그인은 여전히 막힌다).
4. 그 계정으로 60초 안에 메일을 보냈으면 아무것도 하지 않고 성공으로 답한다. DB는 이메일의 대소문자와 악센트를 가리지 않아 다른 입력이 같은 계정이 되므로, 입력한 이메일과 계정 둘 다로 간격을 센다.
5. 계정이 있으면 링크에 넣을 값(`token`, 추측할 수 없는 무작위 값)을 만들어 Redis에 계정과 함께 30분 동안 저장한다. 그 계정의 이전 링크는 지운다.
6. 응답을 먼저 주고, 계정의 이메일로 재설정 링크를 담은 메일을 따로 보낸다. 링크는 `{프론트엔드 주소}/password-reset/{token}`, 제목은 "[디굴디굴] 비밀번호 재설정"이다. 가입한 이메일일 때만 응답이 늦어져 응답 시간으로 가입 여부가 드러나지 않게 한다. 보내지 못하면 서버 로그에만 남긴다.

DB에는 아무것도 저장하지 않는다.

### 응답 `data`

`201`로 답한다. `data`는 `null`이다. 메일을 보냈는지는 알리지 않는다.

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

## GET /api/v1/password-resets/{token}

메일의 링크로 들어왔을 때 링크가 아직 유효한지 확인한다. 유효하면 새 비밀번호 설정 화면을, 아니면 링크 만료 화면을 보여준다.

- 로그인: 불필요
- 명세: 링크 만료 1

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `token` | 문자열 | ✓ | 메일의 링크에 든 값 |

```text
GET /api/v1/password-resets/3fa9c1d27b4e4f0a9c51
```

### 응답 `data`

`null`이다. 누구의 링크인지(이메일, 계정 id)는 알리지 않는다.

### 주는 방식

- Redis에 그 `token`이 남아 있으면 성공으로 답한다. 확인만 하고 링크를 지우지 않는다.
- 30분이 지났거나, 이미 썼거나, 다시 보내서 지워진 링크는 Redis에 없으므로 `PASSWORD_RESET_LINK_INVALID`로 답한다.

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
| `404` | `PASSWORD_RESET_LINK_INVALID` | 30분이 지났거나, 이미 썼거나, 없는 링크 |

## POST /api/v1/password-resets/{token}/complete

새 비밀번호를 저장하고 링크를 만료시킨다. 새 비밀번호 설정의 "비밀번호 바꾸기"를 누를 때 부른다. 로그인시키지 않는다. 프론트엔드는 로그인 화면으로 보낸다.

- 로그인: 불필요
- 명세: 새 비밀번호 설정 3

### 요청

| 위치 | 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|---|
| 경로 | `token` | 문자열 | ✓ | 메일의 링크에 든 값 |
| 본문 | `password` | 문자열 | ✓ | 새 비밀번호. [00 공통](../spec/00-common.md) 9의 비밀번호 규칙을 따른다 |

```text
POST /api/v1/password-resets/3fa9c1d27b4e4f0a9c51/complete
```

```json
{ "password": "newmole5678@" }
```

### 서버가 하는 일

1. `password`의 규칙을 본다. 어긋나면 `400`과 `INVALID_INPUT`. 이때는 링크를 지우지 않으므로 다시 시도할 수 있다.
2. Redis에서 `token`으로 계정을 찾고 그 자리에서 링크를 지운다. 없거나 30분이 지났으면 `404`와 `PASSWORD_RESET_LINK_INVALID`. 찾기와 지우기를 한 번에 해서 같은 링크로 동시에 두 번 바꿀 수 없다.
3. 그 계정의 `user.password_hash`를 새 비밀번호의 해시로 바꾼다. 그 사이 계정이 탈퇴했으면 `404`와 `PASSWORD_RESET_LINK_INVALID`.
4. 같은 링크는 다시 쓸 수 없다.
5. 그 계정의 로그인 세션을 모두 지운다. 로그인돼 있던 기기는 모두 로그아웃된다.

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
| `404` | `PASSWORD_RESET_LINK_INVALID` | 30분이 지났거나, 이미 썼거나, 없는 링크 |

## 명세에 없어 이 문서에서 정한 것

- **이미 가입한 이메일**: 인증 코드를 요청할 때 `EMAIL_DUPLICATED`로 알린다. 비밀번호 찾기와 달리 가입 여부가 드러난다.
- **계정이 만들어지는 때**: 회원가입 3의 "땅굴 파기"로 SSAFY 인증을 마칠 때 만들고 바로 로그인 상태가 된다. 그 전에는 DB에 아무것도 저장하지 않는다. 가입 도중에 나가면 처음부터 다시 가입한다.
- **가입 진행 기록**: 가입하는 동안 필요한 값(인증한 이메일, Google 식별자, SSAFY 인증 코드)은 임시 저장소에 두고 가입 쿠키로 가리킨다. 비밀번호는 프론트엔드가 갖고 있다가 계정을 만들 때 보낸다.
- **가입 방법을 알려 주는 값**: 두지 않는다. 가입 도중에 나가면 처음부터 다시 하므로, 회원가입 3의 진행 표시를 보여 줄지는 프론트엔드가 지금 진행 중인 경로로 안다.
- **비밀번호를 재설정한 뒤**: 그 계정의 로그인 세션을 모두 지운다.
- **정지를 알리는 때**: 이메일 로그인은 비밀번호가 맞은 뒤에만 정지 사실을 알린다. 비밀번호를 모르는 사람이 남의 정지 여부를 알 수 없게 한다.
- **로그아웃의 범위**: 지금 쓰는 기기의 세션만 지운다.
- **새 학기를 고르지 않은 계정**: `nextStep`을 `NEW_TERM`으로 알리고, 고르기 전에는 다른 API를 `NEW_TERM_INCOMPLETE`로 막는다. 온보딩을 마치지 않은 계정과 같은 방식이다. 새 학기 안내가 쓰도록 내 계정 조회가 `campusFloorId`도 준다.
- **내 계정 조회가 주는 소속**: `GET /api/v1/me`가 캠퍼스 · 기수 · 층을 함께 준다. 온보딩 4의 땅굴 정보 카드가 이 값을 보여 주는데, 온보딩 도중에 나갔다 돌아온 사람은 프론트엔드에 이 값이 없기 때문이다.

## 구현하며 정한 것

- **세션 쿠키**(KAN-38): 이름은 `ITTING_SESSION`이다. 마지막으로 쓴 뒤 14일 동안 유지하고, 세션이 살아 있는 요청마다 다시 14일로 늘린다([API 공통 규칙](../api-convention.md#로그인)).
- **로그인한 뒤 세션**(KAN-38): 로그인에 성공하면 세션 id를 새로 만들고, 그 브라우저의 이전 세션은 버린다. 세션에는 계정 id만 둔다.
- **로그인 실패의 응답 시간**(KAN-38): 없는 이메일이어도 비밀번호 비교를 한 번 해서, 응답 시간으로 가입 여부를 알 수 없게 한다. 72바이트보다 긴 비밀번호는 비교하지 않고 `LOGIN_FAILED`다.
- **정지 기록이 겹칠 때**(KAN-38): `ACCOUNT_SUSPENDED`의 `detail`은 지금 정지 중인 기록 가운데 가장 늦게 끝나는 것의 사유와 끝 시각이다.
- **세션만 남은 계정**(KAN-38): `GET /api/v1/me`를 불렀는데 세션의 계정이 없거나 탈퇴했으면 세션을 지우고 `401`과 `UNAUTHENTICATED`로 답한다.
- **`nextStep`의 `NEW_TERM`**(KAN-44): 온보딩을 마쳤고 내 땅굴 입구의 학기가 이번 학기(열린 학기 가운데 가장 최근에 열린 것)가 아니면 `NEW_TERM`이다. 열린 학기가 하나도 없으면 고를 학기가 없으므로 `HOME`이다.
- **막는 장치**(KAN-44): 로그인한 요청마다 계정의 `nextStep`을 계산해, `ONBOARDING`이면 "온보딩 중에도", `NEW_TERM`이면 "새 학기를 고르기 전에도"인 API만 통과시킨다. 표시가 없는 새 API는 막힌다. 로그인하지 않은 요청은 로그인 검사가 먼저 `401`로 답한다.

- **인증 코드**(KAN-39): 유효 5분, 재전송 간격 60초, 5번 틀리면 코드를 지운다([인증 코드](#인증-코드)).
- **보내기 실패**(KAN-39): 메일 서버나 Mattermost에 보내지 못하면 `503`과 `VERIFICATION_SEND_FAILED`. 바로 다시 부를 수 있다.
- **가입 진행 기록**(KAN-39): 1시간, 가입 쿠키 `ITTING_SIGNUP`([가입 진행](#가입-진행)).
- **Mattermost**(KAN-39): 기수마다 웹후크를 여러 개 두고 돌아가며 쓰고, 실패하면 다음 웹후크로 보낸다([Mattermost로 보내는 방법](#mattermost로-보내는-방법)).
- **비밀번호 길이**(KAN-39): 8자 이상 20자 이하([00 공통](../spec/00-common.md) 9).
- **재설정 메일 요청 간격**(KAN-41): 같은 이메일로 60초 안에 다시 요청하면 메일만 보내지 않고 같은 `201`으로 답한다.
- **재설정 메일을 보내는 때**(KAN-41): 응답을 먼저 주고 메일은 따로 보낸다. 응답 시간으로 가입 여부가 드러나지 않게 한다.
- **재설정 링크**(KAN-41): `{프론트엔드 주소}/password-reset/{token}`. 프론트엔드 주소는 서버 설정 `itting.frontend-url`이다. 정지된 계정도 재설정할 수 있다.
- **입력 모양을 먼저 본다**(KAN-39): `POST /api/v1/ssafy-verifications`와 `POST /api/v1/users`는 가입 진행 기록을 찾기 전에 입력값의 모양부터 본다.

## 구현 단계로 넘기는 것

- Google 로그인을 마친 뒤 돌아갈 프론트엔드 주소(이미 가입한 계정, 처음 쓰는 Google 계정, 실패한 경우)
- 정지된 계정이 Google로 로그인했을 때 사유와 기간을 프론트엔드에 전하는 방법
