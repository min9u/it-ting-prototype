# 디굴디굴 API 계약 초안 (프론트 제안)

- 날짜: 2026-11-16
- 요청: 백엔드가 API 명세를 쓰기 전에, 프론트가 화면·기능마다 필요한 요청을 정리해서 넘긴다
- 근거: 백엔드 ERD [erd-2026-11-16.md](erd-2026-11-16.md) (테이블 38개), 위험 분석 [../dev-deploy-risks.md](../dev-deploy-risks.md) (B1~B12), 화면 명세 [../spec-all-2026-11-16.md](../spec-all-2026-11-16.md)
- 상태: **초안**. 경로·필드 이름은 백엔드가 바꿔도 된다. 바뀌면 프론트는 `app/src/api/` 한 곳만 고친다 (화면은 그대로)
- 코드: 이 문서의 요청은 모두 `app/src/api/*.ts` 에 함수로 있다 (실제 서버용 `real` + 지금 메모리 저장소를 쓰는 `mock`). DTO 타입은 [`app/src/api/types.ts`](../../app/src/api/types.ts)
- ERD 와 맞지 않는 곳·물어볼 것은 [erd-gaps.md](erd-gaps.md), 프론트 구조는 [frontend-data-layer.md](frontend-data-layer.md)

---

## 0. 한눈에 (먼저 합의할 결정 8개)

| # | 결정 | 프론트 제안 | 까닭 |
|---|---|---|---|
| 1 | 주소 | 같은 출처 + `/api` (개발은 Vite 프록시, 배포는 Nginx) | CORS · SameSite 쿠키 문제가 사라짐 (위험 B6) |
| 2 | 인증 | HttpOnly 쿠키 세션 + 리프레시 (`POST /api/auth/refresh`) | 토큰을 JS 가 못 읽음(XSS), 새로고침에도 유지 (B5) |
| 3 | 응답 봉투 | **없음**. 성공은 리소스 그대로, 목록은 `PageDto`/`CursorPageDto` | 화면 코드가 짧아지고 HTTP 상태 코드로 성공·실패가 이미 갈림 |
| 4 | 에러 | `{ code, message, status, traceId, fieldErrors? }` 하나로 | 프론트는 `code` 로 분기, `message` 는 그대로 보여 줌 (한국어) |
| 5 | ID | DB 는 BIGINT, **JSON 에서는 문자열** `"42"` | `===` 비교·큰 수 정밀도 문제 없음 (B7). 숫자로 와도 프론트 매퍼가 문자열로 바꿈 |
| 6 | 날짜 | 순간은 **ISO 8601 + 오프셋** (`2026-11-16T17:40:05+09:00` 또는 `…Z`), 달력 날짜는 `YYYY-MM-DD` (Asia/Seoul) | 서버 시간대와 관계없이 같은 순간 (B2). 오프셋 없는 `LocalDateTime` 직렬화는 피함 |
| 7 | 목록 | 번호 페이지 = 게시판·모임·관리자 / 커서 = 채팅 기록·알림·방명록·댓글 / 페이지 없음 = 대화방·요청·단골·내 모임 | 아래 1.7 |
| 8 | 서버가 계산할 값 | 모집 상태, 확정 인원, 안 읽은 수, 내가 찜·좋아요·저장·신고했는지, 만료(요청 5일·방명록 7일·알림 30일) | 기기마다 다르게 계산하지 않게. 프론트 계산은 보조 (B5) |

---

## 1. 공통 규약

### 1.1 주소
- 기본 경로 `/api` (버전은 아직 안 붙임. 붙이면 `/api/v1`). 프론트는 `VITE_API_BASE` 로 바꿀 수 있음 (기본 `/api`)
- 실시간은 `/ws` (STOMP, 4장)
- 리소스 이름은 복수형 (`/meetups`, `/posts`), 내 것은 `/me/...`

### 1.2 인증 (가정: Spring Security)
- 로그인 성공 → `Set-Cookie: SESSION=…; HttpOnly; Secure; SameSite=Lax; Path=/` (+ 리프레시 쿠키). 프론트는 모든 요청에 `credentials: 'include'`
- 401 `UNAUTHORIZED`: 로그인 안 됨·만료 → 프론트가 `POST /api/auth/refresh` 를 **한 번만** 시도하고(동시에 여러 요청이 401 이어도 하나) 실패하면 로그인 화면으로 (`app/src/api/client.ts`)
- 403 `FORBIDDEN`: 로그인은 했지만 권한 없음 (남의 모임 신청 관리, 관리자 화면 등). 다시 로그인시키지 않음
- 로그인은 했지만 단계가 남은 경우: 403 `SSAFY_NOT_VERIFIED` / `ONBOARDING_REQUIRED` → 프론트가 그 단계 화면으로
- CSRF: SameSite=Lax + 같은 출처면 대부분 막힘. 쓰기 요청에 `X-XSRF-TOKEN` 을 요구하면 쿠키 이름만 알려 주면 됨
- Bearer 방식으로 정하면 `client.ts` 의 `setAuthHeaderProvider` 만 채우면 된다

### 1.3 JSON 모양
- 필드는 camelCase (`createdAt`, `recruitDeadlineAt`). ERD 칼럼 `snake_case` → camelCase 로 그대로 옮김
- 성공 응답은 봉투 없이 리소스 그대로 (`{ "id": "42", ... }`). 목록은 1.7 모양
- 값이 없으면 **`null`** (필드를 빼지 않음). 빈 목록은 `[]`
- 본문 없는 성공은 `204 No Content`
- enum 은 대문자 스네이크 (`PENDING`, `MEETUP_PROMO`). 후보 값은 [erd-gaps.md 3장](erd-gaps.md#3-enum-값-후보)

### 1.4 ID
- 모든 ID 는 JSON 문자열: `"id": "42"`, `"hostId": "7"`. (Jackson: `Long` 에 `ToStringSerializer` 를 전역으로, 가정)
- 사용자 주소는 회원 id: `/burrow/42` (땅굴 주인). 닉네임은 바뀔 수 있어 주소에 쓰지 않음
- 탈퇴한 사람은 `member.status = WITHDRAWN`, 응답의 `nickname: null` → 프론트가 "탈퇴한 사용자"로 표시

### 1.5 날짜·시간
| 종류 | 예 | 쓰는 곳 |
|---|---|---|
| 순간 (instant) | `"2026-11-16T17:40:05+09:00"` 또는 `"2026-11-16T08:40:05Z"` | `createdAt`, `startsAt`, `readAt` 등 DATETIME 전부 |
| 달력 날짜 | `"2026-11-16"` | `recommendedOn`, 모임 목록 거르기 `from`·`to` |
- 오프셋 없는 값(`2026-11-16T17:40:05`)은 받지 않는 것이 규약. 프론트는 받으면 Asia/Seoul 로 읽고 개발 콘솔에 경고 (`lib/time.ts parseIso`)
- "오늘", "이번 주", 7일·5일·30일 같은 기준은 **Asia/Seoul 달력** 기준 (서버 시간대가 UTC 여도)
- "3분 전", "어제" 같은 문구는 서버가 만들지 않음 (프론트 `lib/time.ts` 한 곳에서)

### 1.6 에러
```json
HTTP/1.1 409 Conflict
{ "code": "MEETUP_FULL", "message": "정원이 다 찼어요.", "status": 409, "traceId": "a1b2c3" }
```
- 400 입력 검사는 `fieldErrors: [{ "field": "title", "message": "50자까지 쓸 수 있어요" }]`
- 상태 코드: 400 입력 · 401 로그인 · 403 권한 · 404 없음 · 409 상태 충돌(정원·중복·시간 지남) · 410 만료된 링크 · 413 파일 큼 · 429 너무 잦음 · 5xx 서버
- **404 와 다른 실패를 꼭 나눠 주세요.** 프론트는 404 일 때만 "없는 모임이에요" 화면을 보여 주고, 그 밖은 "다시 시도" 를 보여 줌 (위험 B1)
- 에러 코드 전체 목록은 5장

### 1.7 목록과 페이지

| 방식 | 요청 | 응답 | 쓰는 곳 | 까닭 |
|---|---|---|---|---|
| 번호 | `?page=1&size=20` (page 는 1부터) | `{ items, page, size, totalItems, totalPages }` | 커뮤니티 글 목록(20개), 모임 목록(6/12/24개), 저장한 글·내가 쓴 글·댓글 단 글, 관리자 목록 | 디자인이 페이지 번호를 보여 줌, 주소 `?page=3` 으로 공유·새로고침·뒤로 가기가 됨. 글이 자주 생기지 않아 다음 쪽에 한두 개 겹치는 건 괜찮음 |
| 커서 | `?cursor=<불투명 문자열>&size=20` (첫 요청은 cursor 없음) | `{ items, nextCursor }` (마지막이면 `null`) | 채팅 기록, 알림, 방명록, 댓글 | 새 항목이 계속 생겨서 번호 방식은 밀리거나 겹침. 화면도 "더 보기"·위로 스크롤이라 번호가 필요 없음. 커서 = (정렬 키, id) 를 서버가 인코딩 |
| 없음 | — | 배열 `[...]` | 대화방 목록, 대화 요청, 단골 땅굴, 내 모임 탭, 캠퍼스-층, 관심사 | 한 사람당 수십 개를 넘기 어렵다. 늘면 커서로 |

- 정렬·거르기는 **서버가 함** (위험 B8). 프론트가 전체를 받아 자르지 않음
- 알림은 "안 읽은 것 먼저, 그다음 최신순" 이라 커서에 (읽음 여부, created_at, id) 가 들어가야 함
- 이전/다음 글은 상세 응답의 `prevId`·`nextId` (목록 기준 최신순)

### 1.8 쓰기
- 켜고 끄는 것(찜·좋아요·저장·단골·차단)은 **PUT(켜기)/DELETE(끄기)** 로 멱등하게. 두 번 눌러도 같은 결과
- 만들기는 POST. 중복 제출이 문제가 되는 곳(모임 신청·대화 요청·글쓰기)은 `Idempotency-Key` 헤더를 받아 주면 좋음 (선택)
- 상태 충돌은 409 + code (`MEETUP_FULL`, `ALREADY_APPLIED` …). 프론트는 화면을 먼저 바꿨다가(낙관적 업데이트) 실패하면 되돌리고 `message` 를 토스트로 보여 줌
- 쓰기 응답은 바뀐 리소스를 돌려주면 좋음 (예: 신청 → 모임 상세). 안 되면 204 로도 됨 (프론트가 다시 불러옴)

### 1.9 서버가 계산해서 주는 값 (프론트는 계산하지 않음)
| 값 | 어디서 | 계산 |
|---|---|---|
| `recruitStatus` OPEN·CLOSED·ENDED·CANCELED | 모임 카드·상세 | canceled_at → CANCELED, starts_at ≤ 지금 → ENDED, 확정 인원 ≥ 정원 또는 recruit_deadline_at ≤ 지금 → CLOSED, 그 밖 OPEN |
| `confirmedCount` | 모임 | 1(주최자) + APPROVED 신청 수 (정원에 주최자 포함, 결정 M2) |
| `myApplication.status` | 모임 상세 | PENDING 인데 마감이 지났으면 EXPIRED (자동 미승인, M7) |
| `liked`·`likeCount`, `bookmarkedAt`, `reportedByMe` | 모임·글·댓글 | 나 기준 |
| `unreadCount` | 대화방·알림 | `last_read_message_id` 이후 메시지 수 / `read_at IS NULL` 수 |
| 만료 | 대화 요청 5일, 방명록 7일, 알림 30일 | 조회 조건으로 거름 (+ 배치 정리) |

### 1.10 이미지 (글 사진 최대 3장, 위험 B12)
- 제안: `POST /api/uploads/presign { contentType, size }` → `{ uploadUrl, url }` → 브라우저가 S3 에 PUT → 글쓰기 본문에 `imageUrls` 로 넘김
- 프론트가 올리기 전에 긴 변 1600px · JPEG/WebP 로 줄임. 서버는 크기·형식 검사

---

## 2. 엔드포인트

표기: 🔓 로그인 없이 · 🔒 로그인 · 🛡 관리자. 응답 타입 이름은 `app/src/api/types.ts`. "코드" 칸은 프론트 함수 (`api.<영역>.<함수>`)

### 2.1 인증 (F1 · F2) — `api.auth`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 인증 | 코드 |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `LoginResponseDto { member: MeDto, next: SSAFY_VERIFY·ONBOARDING·HOME }` | 401 INVALID_CREDENTIALS, 403 ACCOUNT_SUSPENDED (`detail: { reason, endsAt }`) | 🔓 | `login` |
| GET | `/oauth2/authorization/google` | (이동) | 콜백 → `/oauth/callback?next=` | — | 🔓 | `googleUrl` |
| POST | `/auth/logout` | — | 204 | — | 🔒 | `logout` |
| POST | `/auth/refresh` | (쿠키) | 204 | 401 | 🔓 | `refresh` |
| GET | `/me` | — | `MeDto` | 401 | 🔒 | `me` |
| POST | `/auth/email-codes` | `{ email }` | `{ expiresAt }` (5분) | 409 EMAIL_TAKEN, 429 TOO_MANY_REQUESTS (재전송 30초) | 🔓 | `sendEmailCode` |
| POST | `/auth/email-codes/verify` | `{ email, code }` | `{ verificationToken }` | 400 CODE_MISMATCH, 410 CODE_EXPIRED | 🔓 | `verifyEmailCode` |
| POST | `/auth/signup` | `{ verificationToken, password, termsAgreed }` | `LoginResponseDto` | 400 VALIDATION_FAILED (비밀번호 규칙) | 🔓 | `signup` |
| POST | `/auth/ssafy/codes` | `{ mattermostId }` | 204 | 409 MATTERMOST_TAKEN | 🔒 | `sendSsafyCode` |
| POST | `/auth/ssafy/verify` | `{ code }` | `MeDto` | 400 CODE_MISMATCH | 🔒 | `verifySsafyCode` |
| POST | `/auth/password-reset` | `{ email }` | 204 (가입 여부와 관계없이) | 429 | 🔓 | `requestPasswordReset` |
| POST | `/auth/password-reset/confirm` | `{ token, password }` | 204 | 410 RESET_LINK_EXPIRED | 🔓 | `confirmPasswordReset` |

### 2.2 회원 · 프로필 · 관심사 · 차단 (F3 · F4 · F10) — `api.members`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 인증 | 코드 |
|---|---|---|---|---|---|---|
| GET | `/members/{id}` | — | `MemberProfileDto` (프로필 팝업) | 404 MEMBER_NOT_FOUND | 🔒 | `profile` |
| PATCH | `/me/profile` | `{ nickname?, intro?, answers?[{slot, questionId, answer}], campusFloorId? }` | `MemberProfileDto` | 409 NICKNAME_TAKEN, 400 | 🔒 | `updateProfile` |
| GET | `/nicknames/{nickname}/availability` | — | `{ available }` | — | 🔒 | `nicknameAvailable` |
| PUT | `/me/mole` | `MoleLookDto { head, face, neck, hand }` | `MoleLookDto` | 400 INVALID_ITEM (잠긴 아이템·금지 조합) | 🔒 | `updateMole` |
| PUT | `/me/interests` | `{ items: [{ interestId, furniture }] }` (순서 = sort_order, 맨 앞 대표) | 204 | 400 INTEREST_COUNT (3~10) | 🔒 | `updateInterests` |
| GET | `/interest-categories` | — | `InterestCategoryDto[]` (대분류 11 · 세부 65, `memberCount` 포함) | — | 🔓 | `interestCategories` |
| GET | `/intro-questions` | — | `IntroQuestionDto[]` | — | 🔒 | `introQuestions` |
| GET | `/me/blocks` | — | `(MemberSummaryDto & { blockedAt })[]` | — | 🔒 | `blocked` |
| PUT · DELETE | `/me/blocks/{memberId}` | — | 204 | — | 🔒 | `block` · `unblock` |
| DELETE | `/me` | `{ reason }` | 204 | — | 🔒 | `withdraw` |

### 2.3 땅굴 · 방명록 · 들판 · 단골 (F4 · F5) — `api.burrows`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 인증 | 코드 | 화면 |
|---|---|---|---|---|---|---|---|
| GET | `/burrows/{memberId}` | — | `BurrowDto` (주인 프로필, 입구, 단골 여부, 1:1 대화방·보낸 요청 id) | 404 BURROW_NOT_FOUND (탈퇴·없음) | 🔒 | `get` | 방문자 뷰 ✅ |
| GET | `/burrows/{memberId}/guestbook` | `?cursor&size=20` | `CursorPageDto<GuestbookEntryDto>` (7일 안, 최신순) | 404 | 🔒 | `guestbook` | 방문자 뷰 ✅ |
| POST | `/burrows/{memberId}/guestbook` | `{ content }` | `GuestbookEntryDto` | 400 TOO_LONG·EMPTY_CONTENT, 403 BLOCKED_USER | 🔒 | `writeGuestbook` | 방문자 뷰 ✅ |
| DELETE | `/guestbook/{entryId}` | — | 204 (주인·글쓴이) | 403, 404 | 🔒 | `deleteGuestbook` | 내 땅굴 |
| PUT · DELETE | `/burrows/{memberId}/regular` | — | 204 (상대에게 알리지 않음) | 404 | 🔒 | `setRegular` | 방문자 뷰 ✅ |
| GET | `/me/regulars` | — | `MemberProfileDto[]` | — | 🔒 | `regulars` | 탐색 단골 목록 |
| GET | `/campus-floors` | — | `CampusFloorDto[]` | — | 🔒 | `campusFloors` | 캠퍼스-층 고르기 |
| GET | `/fields/{campusFloorId}` | `?termId` (없으면 이번 학기) | `FieldDto` (자리 150개 중 배정된 것, `maxSlot`, `mySlot`) | 404 | 🔒 | `field` | 탐색 들판 |
| PUT | `/me/burrow/room` | `RoomLayoutDto` | 204 | 400 | 🔒 | (아직) | 내 땅굴 꾸미기 저장 (erd-gaps) |

✅ = 이번에 화면이 이 API 를 거치도록 바꾼 곳

### 2.4 오늘의 추천 친구 (F5) — `api.members`
| 메서드 | 경로 | 본문 | 응답 | 에러 | 코드 |
|---|---|---|---|---|---|
| GET · PUT | `/me/recommend-setting` | `RecommendSettingDto` | `RecommendSettingDto` | — | `recommendSetting` · `updateRecommendSetting` |
| GET | `/me/recommendations/today` | — | `DailyRecommendationDto { recommendedOn, members[3] }` | 404 NOT_DRAWN (오늘 아직 안 받음) | `todayRecommendation` |
| POST | `/me/recommendations/today` | — | `DailyRecommendationDto` | 409 ALREADY_DRAWN (하루 한 번, Asia/Seoul 날짜) | `drawRecommendation` |

### 2.5 채팅 REST (F6) — `api.chat`
메시지 기록·보내기는 실시간 작업(4장)에서 정한다. 여기서는 목록과 요청만.

| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 코드 | 화면 |
|---|---|---|---|---|---|---|
| GET | `/chat/rooms` | `?type=DIRECT·MEETUP&q=` | `ChatRoomSummaryDto[]` (최근 메시지 순, 차단한 상대 1:1 제외) | — | `rooms` | 대화 목록 ✅ |
| GET | `/chat/rooms/{roomId}/messages` | `?before=<cursor>&size=30` | `CursorPageDto<ChatMessageDto>` (오래된 쪽으로) | 404, 403 | (실시간 작업) | 대화 창 |
| POST | `/chat/rooms/{roomId}/read` | `{ lastReadMessageId }` | 204 | — | (실시간 작업) | |
| DELETE | `/chat/rooms/{roomId}/members/me` | — | 204 (대화 나가기) | 409 LEAVE_TOO_LATE (모임 방 = 참여 취소 규칙) | (실시간 작업) | |
| PUT · DELETE | `/chat/rooms/{roomId}/notice` | `{ notice }` | 204 (주최자만) | 403 | (실시간 작업) | 모임 공지 |
| GET | `/chat/requests` | `?status=PENDING` | `ChatRequestDto[]` (받은·보낸, 5일 안) | — | `requests` | 요청 탭 ✅ |
| POST | `/chat/requests` | `{ receiverId, message(≤50), context }` | `ChatRequestDto` | 409 REQUEST_EXISTS·ROOM_EXISTS, 403 BLOCKED_USER | `sendRequest` | 방문자 뷰 ✅ |
| POST | `/chat/requests/{id}/accept` | — | `{ chatRoomId }` | 404, 410 REQUEST_EXPIRED | `acceptRequest` | 요청 탭 ✅ |
| POST | `/chat/requests/{id}/decline` | — | 204 (상대에게 알리지 않음) | 404 | `declineRequest` | 요청 탭 ✅ |
| DELETE | `/chat/requests/{id}` | — | 204 (보낸 요청 취소) | 404 | `cancelRequest` | 요청 탭 ✅ |

### 2.6 모임 (F7) — `api.meetups`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 코드 | 화면 |
|---|---|---|---|---|---|---|
| GET | `/meetups` | `?q&categoryIds=1&categoryIds=4&campus&from&to&mode&sort=STARTS_AT·NEWEST·POPULAR·MEMBERS&page&size` | `PageDto<MeetupCardDto>` (지난·취소 제외, 모집 완료는 맨 뒤) | — | `list` | 모임 목록 ✅ |
| GET | `/meetups/{id}` | — | `MeetupDetailDto` (확정자, 내 신청, 찜, 빈자리 알림, 신고 여부. `joinUrl` 은 확정자·주최자에게만) | 404 MEETUP_NOT_FOUND (삭제) | `get` | 모임 상세 ✅ |
| POST | `/meetups` | `MeetupWriteRequest` | `MeetupDetailDto` | 400 | `create` | 만들기 |
| PUT | `/meetups/{id}` | `MeetupWriteRequest` | `MeetupDetailDto` | 409 EDIT_TOO_LATE (시작 12시간 전부터), 403 | `update` | 수정 |
| POST | `/meetups/{id}/cancel` | — | 204 (확정자가 있으면 취소, 기록 남음) | 409 MEETUP_STARTED | `cancel` | 수정 |
| DELETE | `/meetups/{id}` | — | 204 (확정자 0명이면 삭제) | 409 HAS_MEMBERS | `remove` | 수정 |
| POST | `/meetups/{id}/applications` | `{ message(≤100)? }` | `MeetupDetailDto` | 409 MEETUP_FULL·RECRUIT_CLOSED·ALREADY_APPLIED·REAPPLY_BLOCKED | `apply` | 상세 ✅ |
| DELETE | `/meetups/{id}/applications/me` | — | `MeetupDetailDto` (신청 취소 → 다시 신청 가능) | 409 NOT_PENDING | `withdraw` | 상세 ✅ |
| POST | `/meetups/{id}/leave` | — | `MeetupDetailDto` (참여 취소 → 다시 신청 불가) | 409 LEAVE_TOO_LATE (24시간 전부터), HOST_CANNOT_LEAVE | `quit` | 상세 ✅ |
| PUT · DELETE | `/meetups/{id}/like` | — | 204 | — | `setLike` | 목록·상세 ✅ |
| PUT | `/meetups/{id}/like/vacancy-alert` | `{ on }` | 204 | 409 NOT_LIKED | `setVacancyAlert` | 찜한 모임 |
| GET | `/me/meetups` | `?tab=UPCOMING·PENDING·HOSTING·LIKED·PAST` | `MeetupCardDto[]` | — | `mine` | 내 모임 |
| GET | `/meetups/{id}/applications` | `?status=PENDING` | `ApplicantDto[]` | 403 | `applicants` | 신청 관리 |
| POST | `/meetups/{id}/applications/{appId}/approve` · `/reject` | — | 204 | 409 MEETUP_FULL | `approve` · `reject` | 신청 관리 |
| DELETE | `/meetups/{id}/members/{memberId}` | — | 204 (내보내기) | 403 | `kick` | 신청 관리 |

`MeetupWriteRequest`: `{ title, category, tags[≤3], description, capacity, supplies, acceptsMessage, startsAt, endsAt, recruitDeadlineAt, mode, campus, place, placeDetail, platform, joinUrl }`

### 2.7 커뮤니티 (F8) — `api.board`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 에러 | 코드 | 화면 |
|---|---|---|---|---|---|---|
| GET | `/posts` | `?category=MEETUP_PROMO·MEETUP_REVIEW·FREE&mine=true&interest=<대분류>&q&sort=LATEST·POPULAR·COMMENTS&page&size=20` | `PageDto<PostListItemDto>` (가려짐·삭제 제외) | — | `list` | 글 목록 ✅, 다음 읽을 글 ✅ |
| GET | `/posts/{id}` | — | `PostDetailDto` (사진, 글에 나온 모임 카드, prevId·nextId) | 404 POST_DELETED·NOT_FOUND, 403 POST_HIDDEN (가려진 남의 글) | `get` | 글 상세 ✅ |
| POST | `/posts/{id}/views` | — | 204 (같은 사람 중복은 서버가 거름) | — | `view` | 글 상세 ✅ |
| GET | `/posts/{id}/comments` | `?cursor&size=20` | `CursorPageDto<CommentDto>` (등록순, 답글은 `replies` 안에) | 404 | `comments` | 글 상세 ✅ |
| POST | `/posts` · PUT `/posts/{id}` | `PostWriteRequest` | `PostDetailDto` | 400, 403 | `create` · `update` | 글쓰기 |
| DELETE | `/posts/{id}` | — | 204 (댓글도 같이) | 403 | `remove` | 상세 ✅ |
| PUT · DELETE | `/posts/{id}/like` · `/posts/{id}/bookmark` | — | 204 | 404 | `setLike` · `setBookmark` | 목록·상세 ✅ |
| POST | `/posts/{id}/comments` | `{ content(≤300), parentId?, mentionMemberId? }` | `CommentDto` | 400, 404 | `addComment` | 상세 ✅ |
| PATCH · DELETE | `/posts/{id}/comments/{cid}` | `{ content }` | `CommentDto` / 204 | 403 | `editComment` · `deleteComment` | 상세 ✅ |
| PUT · DELETE | `/posts/{id}/comments/{cid}/like` | — | 204 | — | `setCommentLike` | 상세 ✅ |
| GET | `/posts/hot` · `/posts/hot-interests` | — | `PostListItemDto[5]` · `string[8]` | — | `hot` · `hotInterests` | 오른쪽 위젯 |
| GET | `/me/board-activity` | — | `{ postCount, commentedPostCount, bookmarkCount }` | — | `activity` | 내 활동 |
| GET | `/me/posts` · `/me/bookmarks` · `/me/commented-posts` | `?category&page&size=20` | `PageDto<PostListItemDto>` (+ 댓글 단 글은 내 최근 댓글 한 줄) | — | (아직) | 저장한 글 등 |

### 2.8 알림 · 알림 설정 · 공지 (F9 · F10) — `api.notifications`
| 메서드 | 경로 | 본문/쿼리 | 응답 | 코드 | 화면 |
|---|---|---|---|---|---|
| GET | `/notifications` | `?category=MEETUP·CHAT·COMMUNITY·BURROW·NOTICE&cursor&size=20` | `NotificationPageDto { items, nextCursor, unreadCount }` (30일, 끈 종류 제외, 안 읽은 것 먼저) | `list` | 알림 ✅ |
| GET | `/notifications/unread-count` | — | `{ count }` | `unreadCount` | GNB 빨간 점 |
| PATCH | `/notifications/{id}/read` | — | 204 | `markRead` | 알림 ✅ |
| PATCH | `/notifications/read-all` | `{ category? }` | 204 | `markAllRead` | 알림 ✅ |
| GET · PATCH | `/me/notification-settings` | `NotificationSettingDto` 일부 | `NotificationSettingDto` | `getSettings` · `updateSettings` | 설정 |
| GET | `/notices` · `/notices/{id}` | — | `NoticeDto[]` · `NoticeDto` | `notices` · `notice` | 공지사항 |

알림을 누르면 갈 곳은 서버가 주소를 주지 않고 `(type, targetType, targetId)` 로 프론트가 정한다 (`api/mappers.ts noticeLink`). 주소 구조가 바뀌어도 서버는 그대로.

| type | targetType | 프론트 이동 |
|---|---|---|
| MEETUP_APPLICATION_RECEIVED | MEETUP | `/meetups/me?tab=hosting&manage={id}` (신청 관리) |
| 그 밖 MEETUP_* | MEETUP | `/meetups/{id}` |
| CHAT_MESSAGE · CHAT_REQUEST_ACCEPTED | CHAT_ROOM | `/chat/{id}` |
| CHAT_REQUEST_RECEIVED | CHAT_REQUEST | `/chat/requests` |
| POST_* · COMMENT_* | POST | `/board/{id}` (`#댓글id` 는 추가 예정) |
| GUESTBOOK_WRITTEN | BURROW | `/burrow?modal=guestbook` |
| SERVICE_NOTICE | NOTICE | `/settings/notices/{id}` |
| `targetExists: false` | — | `/gone/{meetup·post·burrow·chat·notice}` 안내 화면 |

### 2.9 신고 — `api.reports`
| 메서드 | 경로 | 본문 | 응답 | 에러 |
|---|---|---|---|---|
| POST | `/reports` | `{ targetType: POST·COMMENT·MEMBER·GUESTBOOK·MEETUP, targetId, reason: SPAM·ABUSE·SEXUAL·ETC, detail(≤100, ETC 일 때 필수) }` | 204 | 409 ALREADY_REPORTED (UQ reporter·target), 400 |
- 같은 대상 신고가 3명이 되면 서버가 `status = HIDDEN` (글·댓글). 신고한 사람에게는 접힌 채로 보이도록 응답에 `reportedByMe: true`

### 2.10 관리자 (F11) 🛡 — `api.reports`
| 메서드 | 경로 | 본문/쿼리 | 응답 |
|---|---|---|---|
| GET | `/admin/reports` | `?status&page&size` | `PageDto<AdminReportDto>` |
| PATCH | `/admin/reports/{id}` | `{ status: HIDDEN·DISMISSED·SANCTIONED, memo }` | 204 |
| GET | `/admin/members` | `?q&page&size` | `PageDto<AdminMemberDto>` |
| POST · DELETE | `/admin/members/{id}/suspensions` (`/current`) | `{ reason, days }` | 204 |
| GET | `/admin/withdraw-reasons` | — | `WithdrawReasonStatDto[]` |
| POST | `/admin/notices` | `{ category, title, content }` | `{ id }` (+ 모두에게 SERVICE_NOTICE 알림) |
| GET · POST · PUT | `/admin/intro-questions` | `{ type, interestCategoryId, content }` | `IntroQuestionDto` |

---

## 3. 응답 예시

### 3.1 모임 상세 `GET /api/meetups/42`
```json
{
  "id": "42", "title": "주말의 작은 독서 모임", "category": "독서", "tags": ["SF소설"],
  "startsAt": "2026-11-08T14:00:00+09:00", "endsAt": "2026-11-08T16:00:00+09:00",
  "recruitDeadlineAt": "2026-11-08T10:00:00+09:00",
  "mode": "OFFLINE", "campus": "서울", "place": "성수동 어반플레이스 3층", "platform": null,
  "capacity": 6, "confirmedCount": 5, "likeCount": 12, "liked": false, "recruitStatus": "OPEN",
  "host": { "id": "7", "nickname": "김OO", "status": "ACTIVE", "generation": 13, "campus": "서울", "floor": 3,
            "mole": { "head": null, "face": null, "neck": null, "hand": null } },
  "createdAt": "2026-10-01T09:00:00+09:00", "sign": "독서 모임", "area": "성수동",
  "description": "한 주에 한 권씩 …", "supplies": "읽고 있는 책 한 권", "acceptsMessage": true, "placeDetail": null,
  "joinUrl": null,
  "members": [ { "id": "12", "nickname": "이OO", "status": "ACTIVE", "generation": 16, "campus": "서울", "floor": 3, "mole": { "head": null, "face": null, "neck": null, "hand": null } } ],
  "myApplication": { "id": "301", "status": "APPROVED", "message": null, "createdAt": "2026-11-01T12:00:00+09:00", "statusChangedAt": "2026-11-01T13:00:00+09:00" },
  "isHost": false, "vacancyAlert": false, "reportedByMe": false
}
```

### 3.2 글 목록 `GET /api/posts?page=1&size=20&sort=LATEST`
```json
{
  "items": [ {
    "id": "88", "category": "FREE", "title": "성수동 근처에 조용히 책 읽기 좋은 카페 있을까요?",
    "excerpt": "독서 모임 끝나고 바로 …", "author": { "id": "5", "nickname": "서연", "status": "ACTIVE", "generation": 16, "campus": "서울", "floor": 2, "mole": { "head": "hat_straw", "face": "glasses_sun", "neck": "camera_neck", "hand": "prop_book" } },
    "interests": ["책·글"], "thumbnailUrl": null, "imageCount": 0,
    "viewCount": 171, "likeCount": 14, "commentCount": 8, "bookmarkCount": 7,
    "liked": false, "bookmarkedAt": "2026-11-16T17:30:00+09:00", "status": "PUBLIC", "reportedByMe": false,
    "createdAt": "2026-11-16T17:28:00+09:00", "editedAt": null
  } ],
  "page": 1, "size": 20, "totalItems": 26, "totalPages": 2
}
```

### 3.3 알림 `GET /api/notifications?size=20`
```json
{
  "items": [ {
    "id": "9001", "type": "MEETUP_APPLICATION_RECEIVED", "category": "MEETUP",
    "targetType": "MEETUP", "targetId": "3", "targetExists": true,
    "actor": { "id": "21", "nickname": "하린", "status": "ACTIVE", "generation": 16, "campus": "서울", "floor": 2, "mole": { "head": null, "face": null, "neck": null, "hand": null } },
    "title": "‘일요일 아침 드로잉’에 새 참여 신청이 왔어요", "body": "하린님이 참여를 신청했어요",
    "readAt": null, "createdAt": "2026-11-16T17:39:00+09:00"
  } ],
  "nextCursor": "eyJyIjowLCJ0IjoiMjAyNi0xMS0xNlQwODozOTowMFoiLCJpZCI6OTAwMX0",
  "unreadCount": 3
}
```

### 3.4 에러
```json
HTTP/1.1 404 Not Found
{ "code": "POST_DELETED", "message": "삭제된 글이에요.", "status": 404, "traceId": "7f3a…" }
```

---

## 4. 실시간 (WebSocket + STOMP, 가정) — 이름만

연결·재연결·순서·중복 처리 구현은 다른 작업(채팅 실시간)에서 한다. 여기서는 채널과 이벤트 이름만 맞춰 둔다.

- 연결: `wss://<도메인>/ws` (STOMP over WebSocket, SockJS 없이). 인증은 같은 쿠키. heart-beat `10000,10000`
- 이벤트 봉투: `{ "type": "MESSAGE_CREATED", "data": { … }, "sentAt": "ISO" }`

| 구독 주소 | 이벤트 type | data | 프론트가 하는 일 |
|---|---|---|---|
| `/user/queue/notifications` | `NOTIFICATION_CREATED` | `{ notification: NotificationDto, unreadCount }` | 알림 캐시 맨 위에 넣고 빨간 점 |
| | `NOTIFICATION_READ` | `{ ids?: Id[], all?: boolean, unreadCount }` | 다른 탭에서 읽은 것 반영 |
| `/user/queue/chat` | `CHAT_ROOM_UPDATED` | `{ room: ChatRoomSummaryDto }` | 대화 목록 한 줄 바꾸고 위로 |
| | `CHAT_REQUEST_RECEIVED` · `CHAT_REQUEST_CANCELED` · `CHAT_REQUEST_EXPIRED` | `{ request: ChatRequestDto }` · `{ requestId }` | 요청 탭·요청 수 |
| | `CHAT_REQUEST_ACCEPTED` | `{ requestId, chatRoomId }` | 보낸 사람 화면: 요청 → 대화방 |
| `/topic/chat/rooms/{roomId}` | `MESSAGE_CREATED` | `{ message: ChatMessageDto, clientMessageId? }` | 임시 메시지를 `clientMessageId` 로 교체 (B4) |
| | `NOTICE_UPDATED` · `MEMBER_JOINED` · `MEMBER_LEFT` · `ROOM_CLOSED` | … | 공지 줄·참여자·읽기 전용 |
| | `READ_UPDATED` | `{ memberId, lastReadMessageId }` | (읽음 표시는 명세에 없음, 안 읽은 수만) |
| `/user/queue/presence` (선택) | `PRESENCE` | `{ memberId, online }` | 접속 중 점 (erd-gaps "접속 중") |

| 보내는 주소 (SEND) | 본문 |
|---|---|
| `/app/chat/rooms/{roomId}/messages` | `{ clientMessageId(UUID), type: TEXT·MEETUP_SHARE, content, meetupId? }` |
| `/app/chat/rooms/{roomId}/read` | `{ lastReadMessageId }` |

- 끊겼다가 다시 붙으면 `GET /chat/rooms/{id}/messages?after=<마지막 id>` 로 빈 곳을 채움 (메시지 id 가 방 안에서 늘어나는 순서라고 가정 → erd-gaps)
- 프론트 캐시 키: 대화 목록 `['chat','rooms',…]`, 요청 `['chat','requests']`, 알림 `['notifications',…]` (`app/src/api/queryClient.ts qk`). 이벤트를 받으면 이 키를 `setQueryData` 하거나 `invalidateQueries` 하면 화면이 따라옴

---

## 5. 에러 코드

| code | HTTP | 언제 | 프론트 화면 |
|---|---|---|---|
| UNAUTHORIZED | 401 | 로그인 안 됨·만료 | 리프레시 한 번 → 로그인 화면 |
| FORBIDDEN | 403 | 권한 없음 | 토스트 / 안내 |
| SSAFY_NOT_VERIFIED · ONBOARDING_REQUIRED | 403 | 가입 단계가 남음 | 그 단계 화면으로 |
| NOT_FOUND · MEETUP_NOT_FOUND · POST_DELETED · BURROW_NOT_FOUND · MEMBER_NOT_FOUND | 404 | 없음·삭제·탈퇴 | "삭제된 …이에요" (00 공통 21) |
| POST_HIDDEN | 403 | 신고로 가려진 남의 글 | "신고로 가려진 글이에요" |
| VALIDATION_FAILED · TOO_LONG · EMPTY_CONTENT · INTEREST_COUNT · INVALID_ITEM · INVALID_NICKNAME | 400 | 입력 검사 | 칸 아래 문구 (`fieldErrors`) |
| INVALID_CREDENTIALS | 401 | 로그인 실패 | "이메일 또는 비밀번호가 맞지 않아요" |
| ACCOUNT_SUSPENDED | 403 | 정지 | 정지 팝업 (`detail.reason`, `detail.endsAt`) |
| EMAIL_TAKEN · NICKNAME_TAKEN · MATTERMOST_TAKEN | 409 | 중복 | 칸 아래 문구 |
| CODE_MISMATCH | 400 | 인증 코드 틀림 | 칸 아래 문구 |
| CODE_EXPIRED · RESET_LINK_EXPIRED · REQUEST_EXPIRED | 410 | 만료 | 다시 받기 안내 |
| TOO_MANY_REQUESTS | 429 | 재전송 30초 등 | 남은 시간 표시 |
| MEETUP_FULL · RECRUIT_CLOSED | 409 | 정원·마감 | 토스트 + 상세 다시 불러옴 |
| ALREADY_APPLIED · REAPPLY_BLOCKED · NOT_PENDING | 409 | 신청 상태 충돌 | 토스트 + 다시 불러옴 |
| LEAVE_TOO_LATE · EDIT_TOO_LATE · MEETUP_STARTED · HOST_CANNOT_LEAVE · HAS_MEMBERS | 409 | 시간·역할 규칙 | 토스트 |
| ALREADY_REPORTED | 409 | 같은 대상 두 번 신고 | "이미 신고했어요" |
| REQUEST_EXISTS · ROOM_EXISTS | 409 | 대화 요청 중복 | "답변 기다리는 중" 으로 바꿈 |
| BLOCKED_USER | 403 | 차단 관계 | 토스트 |
| ALREADY_DRAWN · NOT_DRAWN | 409 · 404 | 오늘의 추천 | 결과 화면 / 설정 화면 |

---

## 6. 프론트 쪽에서 이 문서를 쓰는 곳
- 함수: `app/src/api/{auth,members,burrows,chat,meetups,board,notifications,reports}.ts` — 각 파일 위쪽 `real` 객체가 이 문서의 경로 그대로
- 모양: `app/src/api/types.ts` (DTO), 앱 모양으로 바꾸기 `app/src/api/mappers.ts`
- 목 서버(지금 동작): 같은 파일의 `mock` 객체 → `app/src/api/mock/server.ts` (지연·실패 손잡이) → `app/src/api/mock/serialize.ts` (저장소 → DTO)
- 자세한 구조·전환법: [frontend-data-layer.md](frontend-data-layer.md)

## 7. 다음 단계
1. 백엔드와 0장 8개 결정을 회의에서 확정 → 이 문서의 "초안" 을 지우고 확정본으로
2. Swagger(OpenAPI) 를 열어 주면 `types.ts` 를 `openapi-typescript` 로 생성하는 것으로 바꿀 수 있음 (새 패키지라 그때 설치)
3. [erd-gaps.md](erd-gaps.md) 의 질문 답을 받아 DTO 필드 확정 (특히 차단·방문 기록·알림 제목·모임 태그·방명록 길이)
4. 확정된 영역부터 `VITE_API_MODE=real` 로 붙여 보기 (붙이는 순서는 frontend-data-layer.md 4장)
