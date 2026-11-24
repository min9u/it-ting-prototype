# 백엔드에 물을 것 (2026-11-24 기준)

- 날짜: 2026-11-24
- 요청: "백엔드에 질문할 것을 구체적으로 알려줘"
- 기준: 팀 명세 사본 dev `4d2407c` (`docs/backend/team-spec/`). 팀 리포 `origin/dev` 는 그 뒤 `2862f69`(KAN-46 탐색 ①)까지 나가 있어 05 탐색은 그것까지 봤다. 프론트는 `frontend/src/` 지금 코드
- 옛 목록: [api-v1/questions-for-backend.md](api-v1/questions-for-backend.md) (2026-11-22, 43개)
- 요약: **열림 14** (옛 목록 13 + 새로 찾은 것 1) · **답 나옴 24** · **필요 없어짐 6**
- 다음: 아래 "보낼 질문"을 팀 채팅이나 GitHub 이슈에 그대로 붙인다. 답이 오면 이 문서의 표로 옮기고 프론트를 고친다. "이미 답이 나온 것" 가운데 **프론트가 고칠 것 2개**(05 자기소개, 알림 팝업의 모임 참여 요청)는 따로 한다

## 보낼 질문 (우선순위 순)

1. **[높음] Google 로그인 콜백 뒤 프론트 주소 (02 "구현 단계로 넘기는 것")**
   - 질문: `GET /api/v1/oauth/google/callback` · `/verify` 가 302 로 보내는 프론트 주소를 아래로 맞춰 주실 수 있나요? 로그인됨 `{frontend-url}/auth/google`, 처음 쓰는 계정 `/signup/ssafy?via=google`, 로그인 못 함 `/login?error=<code>`, 연동 확인됨 `/settings/google?verified=true`, 탈퇴 확인됨 `/settings/leave`, 확인 못 함 `<시작한 화면>?error=<code>`, 세션 없음 `/login`
   - 왜: 주소가 하나라도 다르면 실제 모드에서 Google 로그인 · 가입 · 연동이 빈 화면이나 404 로 끝난다
   - 지금 프론트: 위 주소를 기다린다 (`frontend/src/api/auth/google.ts:15` `GOOGLE_RETURN`)
   - 제안: 위 주소 그대로. 앞부분은 KAN-41 의 `itting.frontend-url`

2. **[높음] 채팅 메시지 다시 보내기의 중복 저장 (06 `POST /chat-rooms/{id}/messages`)**
   - 질문: 요청 본문에 `clientMessageId`(UUID 문자열, 선택)를 받아, 같은 보낸 사람이 같은 값을 다시 보내면 새로 저장하지 않고 먼저 저장한 메시지를 돌려줄 수 있나요? 응답과 `CHAT_MESSAGE_CREATED` 의 `message` 에도 그 값을 담아 주세요
   - 왜: 응답이 늦게 오거나 끊겨 "다시 보내기"를 누르면 같은 메시지가 두 번 저장되어 상대에게 두 번 보인다
   - 지금 프론트: 소식으로 온 내 메시지를 "본문 · 사진 수가 같은 가장 오래된 보내는 중"과 짝지어 화면에서만 겹침을 막는다 (`frontend/src/api/chat/outbox.ts:6`). 서버에 두 번 저장되는 것은 못 막는다
   - 제안: 예. `chat_message.client_message_id VARCHAR(36) NULL` + `UNIQUE(sender_id, client_message_id)`

3. **[높음] 들판 자리 번호가 150을 넘을 때 (05 · KAN-44 E · KAN-45 7)**
   - 질문: 자리 번호를 "그 들판의 가장 큰 번호 + 1"로 주고 가운데 빈 번호는 다시 쓰지 않는데, 1 ~ 150 안의 가장 작은 빈 번호를 다시 쓰도록 바꿀 수 있나요?
   - 왜: 3D 들판은 구멍이 150개(구역 6개)뿐이다. 내 정보 수정으로 층을 옮기는 사람이 생기면 빈 번호가 쌓여, 땅굴이 150개보다 적어도 151번 이상을 받는 사람이 나온다. 그 사람의 땅굴은 탐색 화면에 나타나지 않는다
   - 지금 프론트: 구역을 6개까지만 켠다 (`frontend/src/three/holeField.ts:411`). 151번 이상은 구멍이 없어 그리지 않는다
   - 제안: 가장 작은 빈 번호를 다시 쓴다. 떠난 자리를 바로 남이 받는 게 걱정이면 그 들판에서 떠난 지 30일 지난 번호만 다시 쓴다

4. **[중간] 관심사 · 대분류를 잇는 바뀌지 않는 키 (00 `GET /interest-categories`)**
   - 질문: 관심사 · 대분류의 `id` 를 앞으로도 바꾸지 않는다고(처음 값은 마이그레이션으로 넣은 1 ~ 12 · 1 ~ 90 그대로, 새 것은 뒤에 더하고 지울 때는 `deleted_at`) 약속해 주실 수 있나요? 어렵다면 영어 `code` 칼럼을 `items[].code` · `items[].interests[].code` 로 주세요
   - 왜: 프론트는 관심사마다 가구 · 아이콘을 갖고 있는데 지금은 이름으로 잇는다. 서버에서 이름을 한 글자만 다듬어도 실제 모드에서 그 관심사의 가구와 아이콘이 사라진다
   - 지금 프론트: 이름으로 잇는다 (`frontend/src/api/onboarding/interestMap.ts:7`)
   - 제안: id 고정 약속(칼럼을 더하지 않아도 됨). 그러면 프론트가 id 로 잇도록 바꾼다

5. **[중간] 자기소개 질문의 예시 답변 (00 `GET /intro-questions`)**
   - 질문: `intro_question` 에 예시 답변 칼럼을 두고 `items[].example`(없으면 `null`)로 줄 수 있나요?
   - 왜: 온보딩 3 · 내 정보 수정의 답변 칸 안내가 "예) 얼음 넣은 홍차에 꿀 한 스푼이요." 같은 예시인데, 실제 서버의 질문 40개(KAN-43 초안)는 프론트 목 질문과 문구가 달라 모두 같은 안내로 바뀐다
   - 지금 프론트: 문구가 같은 목 질문이 있을 때만 예시, 아니면 "10자 이상 50자 이하로 답해 주세요" (`frontend/src/api/onboarding/mappers.ts:30`)
   - 제안: 예. `example VARCHAR(100) NULL`, 문구는 질문과 함께 KAN-43 부록에 채움

6. **[중간] 정지 계정의 Google 로그인에서 사유 · 기간 (02 "구현 단계로 넘기는 것")**
   - 질문: 정지 계정이 Google 로 로그인하면 `/login?error=ACCOUNT_SUSPENDED&reason=<사유>&endsAt=<UTC Z 시각>` 으로 보내 주실 수 있나요? (값은 이메일 로그인의 `ACCOUNT_SUSPENDED` `detail` 과 같게)
   - 왜: 이메일 로그인은 정지 팝업에 사유와 끝나는 날을 보이는데, Google 로그인만 "정지된 계정"만 보인다
   - 지금 프론트: 쿼리의 `reason` · `endsAt` 을 읽고 없으면 빼고 보인다 (`frontend/src/screens/start/Auth.tsx:180`)
   - 제안: 예. 영구 정지처럼 끝이 없으면 `endsAt` 을 빼고 보냄

7. **[중간] 메시지 본문에서 알아볼 모임 링크 모양 (06 "구현 단계로 넘기는 것")**
   - 질문: `meetupCard` 를 만들 때 알아보는 링크를 `{itting.frontend-url}/meetups/{숫자 id}` (쿼리 · 끝의 `/` 는 있어도 됨, 해시 `#/` 없음)로 정해 주실 수 있나요?
   - 왜: 모임 상세의 "공유하기"와 생성 완료 팝업이 이 모양으로 복사한다. 서버가 다른 모양만 알아보면 채팅에 붙인 링크가 모임 카드로 안 바뀐다
   - 지금 프론트: `location.href.split('?')[0]` 을 복사 (`frontend/src/screens/meetups/MeetupDetail.tsx:166`, `MeetupNew.tsx:303`). 목 서버는 `/meetups/{id}` 를 알아본다 (`frontend/src/api/chat/mock.ts:41`)
   - 제안: 위 모양. `http://localhost:3000` 도 local 에서 알아봄

8. **[중간] 실시간 연결(SSE)을 살려 두는 신호 (새 질문, 06 "구현 단계로 넘기는 것")**
   - 질문: `GET /api/v1/me/event-stream` 에 몇 초마다 keep-alive 주석 줄을 보내나요? 배포의 Nginx `proxy_read_timeout` · `proxy_buffering off` 도 같이 맞춰 주실 수 있나요?
   - 왜: 아무것도 안 오면 프록시가 60초쯤에 연결을 끊는다. 프론트는 다시 연결될 때마다 대화 목록 · 요청 수 · 알림을 다시 받으므로(명세대로), 끊김이 잦으면 1분마다 조회가 몰린다
   - 지금 프론트: 다시 연결되면 등록된 조회를 모두 새로 받는다 (`frontend/src/realtime/eventStream.ts:100`, `frontend/src/realtime/useEventStream.ts:25`)
   - 제안: 25초마다 `: ping` 줄, Nginx `proxy_read_timeout 120s` · `proxy_buffering off`

9. **[낮음] Google 로그인을 취소했을 때의 `error` 코드 (02 콜백)**
   - 질문: Google 에서 취소하거나 실패했을 때 `/login?error=` 에 붙는 코드 이름이 무엇인가요?
   - 왜: 화면 문구를 코드로 고른다
   - 지금 프론트: 목은 `GOOGLE_LOGIN_CANCELED`, 모르는 코드여도 "Google 로그인을 마치지 못했어요"를 보인다 (`frontend/src/screens/start/Auth.tsx:183`)
   - 제안: `GOOGLE_LOGIN_CANCELED` (설정 쪽 `GOOGLE_VERIFICATION_FAILED` 처럼 하나로 묶어도 됨)

10. **[낮음] SSE 연결이 세션을 연장하는지 (api-convention "로그인")**
    - 질문: `GET /me/event-stream` 요청도 "세션이 살아 있는 요청"으로 쳐서 14일을 다시 늘리나요? 열려 있는 동안 세션이 끝나면 서버가 연결을 닫나요?
    - 왜: 탭을 오래 열어 두고 다른 API 를 안 부르는 사람의 로그인이 예고 없이 풀릴 수 있다
    - 지금 프론트: 연결이 이어서 실패하면 `GET /me` 로 확인해 401 이면 연결을 멈추고 로그인으로 보낸다 (`frontend/src/realtime/eventStream.ts:17`)
    - 제안: 연결을 열 때 한 번 늘리고, 세션이 끝나면 서버가 연결을 닫음

11. **[낮음] 5MB 넘는 사진의 응답 모양 (08 `POST /images`, KAN-53)**
    - 질문: Spring multipart 한도와 Nginx `client_max_body_size` 를 5MB 보다 조금 크게(예: 6MB) 둬서, 5MB 넘는 사진도 `413` 이 아니라 명세대로 `400 INVALID_INPUT` + `fields[{field:"file"}]` 로 오게 해 주실 수 있나요?
    - 왜: `413` 이면 칸 밑 문구 대신 공통 토스트가 뜬다. 특히 채팅 첨부는 미리 검사가 없다
    - 지금 프론트: 글쓰기는 형식 · 5MB 를 미리 막고(`frontend/src/screens/board/BoardWrite.tsx:21`), `413` 은 "파일이 너무 커요"(`frontend/src/api/client.ts:49`). 채팅 첨부는 미리 막지 않는다(`frontend/src/screens/chat/Chat.tsx:378`, 프론트가 따로 고칠 것)
    - 제안: 예. 6MB

12. **[낮음] 삭제 · 가려진 글의 저장 해제 (08 `DELETE /posts/{id}/bookmark`)**
    - 질문: API 문서는 저장 해제가 "공통 에러만"인데, KAN-52 테스트 표는 삭제된 글이면 `404 POST_NOT_FOUND` 입니다. 어느 쪽이 맞나요? 가려진 글이면요?
    - 왜: 저장한 글 목록에서 하트를 끌 때 404 가 오면 화면이 되돌아가고 실패 토스트가 뜬다
    - 지금 프론트: 낙관적으로 목록에서 빼고, 실패하면 되돌린다 (`frontend/src/api/community/queries.ts:293`)
    - 제안: 좋아요 해제처럼 항상 성공(멱등). 아니면 API 문서 에러 표에 적어 주세요

13. **[낮음] 댓글 단 글의 `myLatestComment` 가 가려진 내 댓글일 때 (08 `GET /me/posts?tab=COMMENTED`)**
    - 질문: 가장 최근 내 댓글이 신고로 가려졌으면 그 댓글을 주나요, 가려지지 않은 다른 댓글을 주나요? 준다면 `content` 는 본문인가요 `null` 인가요?
    - 왜: 댓글 단 글 목록에 내 댓글 한 줄을 보이는데, 가려진 댓글을 그대로 보일지 "가려진 댓글"로 보일지 정해야 한다
    - 지금 프론트: 받은 `content` 를 그대로 보인다 (`frontend/src/screens/board/parts.tsx:201`)
    - 제안: 가려진 댓글도 주되 `content` 는 `null`(댓글 목록과 같게). 프론트가 "신고로 가려진 댓글이에요"로 보임

14. **[낮음] 방명록 글이 가려졌다는 알림의 땅굴 이름 (09 `GUESTBOOK_ENTRY_HIDDEN`)**
    - 질문: `target.title` 에 땅굴 주인의 닉네임을 담아 줄 수 있나요? (탈퇴했으면 `null`)
    - 왜: `actor` 와 `title` 이 모두 `null` 이라 알림 문구에 어느 땅굴의 글인지 쓸 수 없다
    - 지금 프론트: "내가 쓴 방명록 글이 신고로 가려졌어요 · 글을 남겼던 땅굴에서 확인해 보세요" (`frontend/src/api/notifications/mappers.ts:111`)
    - 제안: 예

## 이미 답이 나온 것

| 옛 번호 | 질문 | 어디서 | 답 | 프론트 |
|---|---|---|---|---|
| 공통 4 | SSE 다시 연결 때 놓친 소식 | api-convention "실시간 소식", 06 `event-stream` 4 | 다시 보내지 않음. 프론트가 조회 API 로 맞춘다 | 맞음 (`realtime/useEventStream.ts:25`) |
| 공통 5 | CORS · `Secure` 쿠키 | KAN-38 D · E, api-convention "CSRF · CORS" | 허용 출처 local `http://localhost:3000`. `localhost` 는 http 여도 `Secure` 쿠키를 받는다 | 맞음 (개발은 `/api/v1` rewrite 라 같은 출처) |
| 02-4 | 재설정 메일 링크 | 02 "구현하며 정한 것"(KAN-41) | `{frontend-url}/password-reset/{token}` | 맞춤 (PR #37) |
| 02-5 | 웹 푸시 내용 | 10 "브라우저 푸시를 보내는 일"(KAN-59) | 알림 한 줄과 같은 JSON. 문구 · 주소는 서비스 워커가 만든다 | 맞춤 (`public/push-sw.js`) |
| 02-6 | 세션 없이 `/oauth/google/verify` | 10 `GET /oauth/google/verify` "서버가 하는 일" 1 | 로그인 화면으로 302. 돌아갈 곳은 주지 않는다 | 맞음 (로그인 뒤 평소대로 `nextStep`) |
| 02-8 | Google 가입인데 가입 진행 기록 없음 | 02 "가입 진행" (`409 SIGNUP_EXPIRED`) | 프론트가 가입을 처음부터 다시 시작하게 한다 | 맞음 (`screens/start/Auth.tsx:536`) |
| 03-1 | 두더지 코드 대소문자 | 03 "두더지 아이템", "명세에 없어 정한 것" | 서버는 모양(대문자 · 숫자 · 밑줄, 30자)만 검사. 목록은 프론트가 갖고, 모르는 코드는 "없음" | 맞음 (`api/common/moleCodes.ts`) |
| 03-3 | 온보딩 중 `GET /me` 의 소속 | 02 `GET /me` "주는 방식" | `campusName` · `generation` · `floor` · `campusFloorId` 를 늘 준다. 온보딩 4 카드가 쓴다 | 맞음 (`api/auth/mappers.ts:16`) |
| 03-4 | 내 정보 수정의 두더지 · 방명록 삭제 확인 | 04 "저장 API 를 화면마다 나누기" | 두더지는 꾸미기 모드(`PATCH /me/mole`)에서만. 방명록 삭제 문구는 기획 쪽(사용자가 정함) | 맞음. 서비스 명세 04 메인 5 의 "두더지" 글자는 기획에 고쳐 달라고 할 것 |
| 05-1 | `NEW_TERM` 계정의 403 | 02 "새 학기를 고르지 않은 계정"(KAN-44), KAN-46 3 | 이사 API 만 열림. 어느 화면에서든 새 학기 안내를 띄우고 다른 화면은 못 쓴다(명세 05 새 학기 안내 1 · 4) | 맞음 (`screens/burrow/NewTermGate.tsx`) |
| 05-2 | 들판 입구에 자기소개 | KAN-46 A (팀 리포 `origin/dev` `2862f69`, 사본 `4d2407c` 뒤) | `items[].intro` 를 준다. 안 썼으면 `null` | **고칠 것**: `api/explore/types.ts:40` `FieldEntranceDto` 에 `intro: string \| null`, `api/explore/mappers.ts:70` `personOf(..., e.intro)`, `api/explore/mock.ts:98` `entranceItem` 에 `intro`, `screens/burrow/ExploreBurrow.tsx:306` 의 `intro={false}` 삭제(`RoomNote.tsx:58` 주석도). 명세 사본도 `2862f69` 로 다시 복사. 이 문서를 쓰는 동안 다른 작업이 이 고침을 작업 트리에 올려 둠(아직 커밋 전) |
| 05-4 | 추천 받기 201 / 200 | 05 `POST /me/daily-recommendation` 응답 | 둘 다 같은 `data` | 구분하지 않아도 됨. 그대로 |
| 06-4 | `leaveType = NOT_ALLOWED` 두 경우 | 06 "대화방에서 나가기" 표 | 주최자 = 버튼 숨김, 24시간 전 지남 = 꺼 둠. `meetup.hostId` 를 준다 | 맞음 (`screens/chat/Chat.tsx:351`) |
| 07-4 · 09-1 | 알림의 "모임 참여 요청"으로 신청 관리 열기 | 09 "눌렀을 때 갈 곳", 서비스 명세 09 팝업 3 | 알림 한 줄은 `target.id`(모임 id)로 그 모임 신청 관리로. 팝업 요청 줄은 모임이 하나면 그 모임, 여럿이면 내가 연 모임 탭 | 한 줄은 맞음(`api/notifications/mappers.ts:127`). **고칠 것**: 팝업 요청 줄(`components/NotificationPopover.tsx:55`)이 늘 탭으로만 감 → `GET /me/meetups?tab=HOSTING` 의 `pendingCount > 0` 인 모임이 하나면 `manage=<id>` 로. 서버 변경은 필요 없음 |
| 07-5 | 취소된 모임의 `chatRoomId` | 07 상세 `chatRoomId`, 06 "대화방에서 나가기" | 내가 대화방에 있으면 준다. 취소된 모임 대화방은 남고 `leaveType` 이 `LEAVE_ROOM` | 맞음 |
| 07-6 | `PATCH /meetups/{id}` 바뀐 값 없음 | 07 `PATCH` "바뀐 값이 하나도 없으면" | 저장 · 알림 없이 성공 | 맞음 (프론트는 버튼을 끔) |
| 08-3 | 조회수 중복 | 08 "조회수" | 거르지 않는다. 열 때마다, 작성자도 센다 | 맞음 (StrictMode 두 번은 한 번으로, `api/community/queries.ts:167`) |
| 08-4 | 모임 카드 지난 모임 이름 | 07 "모임 카드" `recruitStatus` | `OPEN` · `CLOSED` · `PAST` · `CANCELED` | 맞음 |
| 08-5 | 땅굴 놀러 가기 · 모임 보기의 가는 곳 | 08 "화면마다 부르는 API" 아래 | 작성자 id 로 `GET /users/{userId}/burrow`, 모임 보기는 모임 상세 | 맞음. 빈 상태 "글쓰기"는 기획(open-issues 61) |
| 09-1 | 알림 설정을 바꿀 때 실시간 소식 | 10 "알림 설정을 바꾸면 빨간 점도 바뀐다" | 빨간 점이 달라지면 `NOTIFICATION_UNREAD_CHANGED` 를 보낸다 | 맞음 |
| 09-2 | `MEETUP_CANCELED` 의 제목 | 09 "알림의 모양" `target.title` | 삭제된 것만 `null`. 취소된 모임은 제목이 온다 | 맞음 |
| 09-3 | 1:1 새 메시지 알림의 상대 이름 | 09 "알림의 종류" | `actor` = 가장 최근에 보낸 사람. `title` 은 모임 대화방만 | 맞음 (`api/notifications/mappers.ts:101`) |
| 09-5 | 알림 목록 커서 | 09 "구현하며 정한 것"(KAN-54) | 커서에 첫 요청 시각을 담아 그 시각의 상태로 이어 준다 | 맞음 (프론트의 id 거르기는 남겨도 됨) |
| 09-6 | 공지 알림의 `target.id` | 09 "눌렀을 때 갈 곳" | 공지의 id → 설정의 공지사항 상세 | 맞음 (`api/notifications/mappers.ts:131`) |

## 필요 없어진 것

| 옛 번호 | 질문 | 까닭 |
|---|---|---|
| 공통 2 | 모임 카테고리 enum 순서 | 07 "카테고리": 목록 API 가 없고 이름 · 색 · 순서는 프론트가 갖는다. 프론트는 명세 표 순서(`data/meetupCategory.ts`) |
| 02-7 | `/push-sw.js` 를 맨 위에 둬도 되는지 | Next.js 로 옮겨 `frontend/public/push-sw.js` 를 Next 가 `/` 에서 준다. Nginx 는 `/api` 만 백엔드로 넘기면 됨 |
| 06-3 | 대화 목록에 모임 카테고리 · 인원 | 서비스 명세 00 공통 14: 목록 항목은 상대 · 마지막 메시지 · 시간 · 안 읽은 수뿐 |
| 07-1 | 리스트 카드의 `isLiked` | 서비스 명세 07 리스트 5: 카드에 하트가 없다. 찜은 상세에서 |
| 07-2 | 상세의 내 신청 메시지 | 서비스 명세 07 "상태: 신청 대기"에 남긴 말을 다시 보이는 항목이 없다 |
| 07-3 | 상세의 주최자 관심사 | 서비스 명세 07 상세 4: 겹치는 두더지 수만 보인다(`sharedInterestParticipantCount`). 주최자 칩 없음 |
