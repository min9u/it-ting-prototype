# ERD 차이 · 질문 목록 (프론트 → 백엔드)

- 날짜: 2026-11-16
- 요청: 지금 화면이 쓰는데 ERD 에 없는 것, enum 값 후보, 길이 제한 비교를 표로 정리하고 항목마다 프론트 제안을 붙인다
- 기준: 백엔드 ERD [erd-2026-11-16.md](erd-2026-11-16.md) (테이블 38개, enum 값 없음) ↔ 프론트 `app/src` (2026-11-16, 02 명세 전 영역 반영본)
- 같이 볼 것: API 초안 [api-draft.md](api-draft.md), 위험 분석 [../dev-deploy-risks.md](../dev-deploy-risks.md)
- 표기: 🔴 API 확정 전에 꼭 정해야 함 · 🟠 화면 하나가 막힘 · 🟢 나중에 정해도 됨

---

## 0. 가장 먼저 답이 필요한 질문 (요약)

| # | 질문 | 프론트 제안 |
|---|---|---|
| Q1 🔴 | **차단** 테이블이 없음 (설정 › 차단 관리, 프로필 팝업 차단, 채팅·요청 숨김) | `member_block(member_id, blocked_member_id, created_at)` PK 두 칼럼 |
| Q2 🔴 | **방명록 길이**: 화면 100자, ERD `content VARCHAR(50)` | VARCHAR(100) 로 (화면 명세가 100) |
| Q3 🔴 | **모임 관심사 태그(최대 3개)** 저장할 곳이 없고, `meetup.category VARCHAR(20)` 이 이름인지 id 인지 모름 | `meetup.interest_id BIGINT FK` (대표 관심사) + `meetup_tag(meetup_id, interest_id)` |
| Q4 🔴 | **알림 제목 스냅숏**: 원본이 지워진 알림("‘북한산 아침 등산’ 모임이 취소됐어요")의 제목을 만들 데이터가 없음 | `notification.payload JSON` (대상 제목·닉네임 등) 또는 `title VARCHAR(100)`·`body VARCHAR(150)` |
| Q5 🔴 | **ID 를 JSON 에서 문자열로**, **날짜는 오프셋 붙은 ISO 8601** 로 줄 수 있는지 | api-draft 1.4 · 1.5 (Long → 문자열 직렬화, `OffsetDateTime`/`Instant`) |
| Q6 🟠 | 대화 요청 카드의 **"땅굴에 다녀갔어요" 맥락**과 땅굴 **방문 기록**이 없음 | `chat_request.context VARCHAR(20)` (BURROW_VISIT · SAME_MEETUP · OTHER). 방문 기록 테이블은 만들지 않고 요청을 보낸 곳만 기록 |
| Q7 🟠 | **1:1 대화방 중복**을 막을 키가 없음 (같은 두 사람 방이 둘 생길 수 있음) | `chat_room.direct_key VARCHAR(41) UQ` = "작은id:큰id" (DIRECT 일 때만) |
| Q8 🟠 | **방 꾸미기 저장**: 가구는 `member_interest.furniture` 로 되지만 벽지·무드·앞으로의 배치는 없음 | 지금은 "무드 = 대표 관심사(sort_order 0)의 대분류" 로 계산 → 칼럼 불필요. 대비로 `burrow.room_layout JSON` + `schema_version` (위험 B10). 2026-11-18: 꾸미기 색 탭이 생겨 `themeId` 하나가 늘어남 (api-draft 2.3 "땅굴 응답의 room", room-diversity-2-2026-11-18.md) |
| Q9 🟠 | **추천 설정**: 화면은 관심사 여러 개 고르기 · 질문 하나 · "같은 질문 먼저" · 같은 캠퍼스/기수/층 **세 개 따로** | `recommend_setting_interest(member_id, interest_id)` + `same_campus`·`same_generation`·`same_floor` BOOLEAN 셋 (`use_affiliation` 하나로는 부족) | **→ 2026-11-21 명세로 해소: 추천 설정은 저장하지 않음(캠퍼스-층 · 기수를 받을 때마다 고름). `recommend_setting*` 테이블 필요 없음. 새 질문은 `daily_recommendation` · `daily_recommendation_member` (팀 repo `docs/api/05-explore-visit.md` 의 POST /me/daily-recommendation)**
| Q10 🟠 | 이메일 인증 코드·비밀번호 재설정 토큰을 어디에 두는지 (테이블 없음) | Redis(TTL 5분·30분) 가정. DB 라면 `auth_token(type, email, token_hash, expires_at, used_at)` |
| Q11 🟢 | **캠퍼스-층 목록**이 화면마다 다름 (회원가입: 서울 2·10·12·13층…, 탐색: 서울 2·3·12층…) | `campus`·`campus_floor` 를 서버가 내려주고 프론트 상수 두 개를 지움 (`GET /campus-floors`) |
| Q12 🟢 | **신고 대상에 모임**이 빠짐 (ERD 주석: 글·댓글·사용자·방명록) — 모임 상세에 신고(M10) 있음 | `report.target_type` 에 MEETUP 추가 + 관리자 처리 칼럼 `memo`·`handled_by`·`handled_at` |

---

## 1. 화면이 쓰는데 ERD 에 없는 것

| 항목 | 화면 (코드) | 지금 프론트 | ERD | 프론트 제안 |
|---|---|---|---|---|
| 접속 중 표시 🟠 | 방문자 뷰 "● 접속 중", 들판의 고개 내민 두더지 (`User.online`) | 목 데이터 고정값 | 없음 | DB 칼럼 말고 실시간 presence (Redis + STOMP `/user/queue/presence`). REST 응답에는 `online: boolean` 만. 마지막 접속 `member.last_seen_at` 은 선택 |
| 지금 와 있는 방문자 수 🟢 | 내 땅굴 "방문자 2" (`User.visitorsNow`) | 목 데이터 | 없음 | 실시간 메모리 값. 못 하면 화면에서 숨김 |
| 채팅 안 읽은 수 🔴 | 대화 목록 숫자, GNB | `Room.unread` 목 값 | `chat_room_member.last_read_message_id` (FK 아님) | 서버 계산: `COUNT(chat_message WHERE room=? AND id > last_read AND sender_id <> me)`. **시스템 메시지(SYSTEM)도 세는지** 결정 필요 (프론트 제안: 안 셈). 인덱스 `(chat_room_id, id)` |
| 메시지 순서 🔴 | 대화 창, 재연결 뒤 빈 곳 채우기 | `at`(ms) 정렬 | `chat_message.id` BIGINT | 방 안에서 id 가 늘어나는 순서(AUTO_INCREMENT)라고 보고 커서·정렬에 씀. 분산 id 를 쓰면 `seq` 칼럼 필요. 보낸 메시지 중복 제거용 `client_message_id` (UQ room·sender·client id) 제안 (위험 B4) |
| 알림 안 읽은 수 🟠 | GNB 빨간 점, 알림 "안 읽음 N" | 목 저장소 계산 | `notification.read_at` | `COUNT(read_at IS NULL)` + 끈 종류 제외. 인덱스 `(member_id, read_at, created_at)` |
| 알림 대상 제목 🔴 | "‘주말의 작은 독서 모임’ 정보가 바뀌었어요" | 문장이 데이터에 들어 있음 | `type`·`target_type`·`target_id`·`actor_id` 뿐 | Q4. 원본이 지워져도 제목이 보여야 함(명세 F9 "원본이 사라진 알림") → 만들 때 스냅숏 |
| 알림 대상이 지워짐 🟠 | 누르면 "삭제된 모임이에요" (`/gone/:what`) | `gone` 표시 | 없음 | 응답 `targetExists` 를 서버가 계산 (대상 조회) 또는 대상 삭제 때 알림에 표시 |
| 알림 큰 분류 🟢 | 알림 탭 5개 = 알림 설정 5개 | 모임·채팅·커뮤니티·땅굴·공지 | type 만 | type → 분류는 고정 표로 계산 가능. 칼럼 `category VARCHAR(10)` 이 있으면 거르기 쿼리가 쉬움 |
| 방명록 7일 🟠 | 7일 지난 글 안 보임 (`liveGuestbook`) | 프론트 필터 | `created_at` | 조회 조건 `created_at > now() - 7일` (Asia/Seoul 아니어도 순간 비교라 무관) + 배치 삭제. **신고된 글은 지우지 않고 남길지** 결정 필요 |
| 방명록 "새 글" (우체통 깃발) 🟠 | 내 땅굴 우체통 깃발·빛 (`gbSeen`) | sessionStorage | 없음 | `burrow.guestbook_read_at DATETIME` — 이보다 늦은 글이 있으면 깃발. 방명록 전체 보기를 열면 갱신 (`POST /me/burrow/guestbook/read`) |
| 대화 요청 5일 만료 🟠 | 요청 탭에서 사라짐 (`REQUEST_TTL_DAYS`) | 프론트 필터 | `status`, `created_at` | 조회 조건 `created_at > now() - 5일` + 배치로 `status = EXPIRED`. 만료된 요청을 다시 보낼 수 있는지 결정 필요 (제안: 가능) |
| 대화 요청 맥락 🟠 | "땅굴에 다녀갔어요" / "같은 모임 참여 예정" | 문장 | 없음 | Q6 |
| 1:1 대화방 하나만 🟠 | 수락하면 방이 생김, 이미 있으면 "대화하기" | `r-<상대id>` | UQ 없음 | Q7 |
| 대화방 나가기 · 상대 탈퇴 → 읽기 전용 🟢 | "상대방이 대화방을 나갔어요" | `closed: left·gone` | `chat_room_member.left_at`, `member.status` | 됨. 응답 `closedReason` 을 서버가 계산 |
| 모임 공지 하나 🟢 | 모임 대화방 공지 (주최자만) | `Room.notice` | `chat_room.notice TEXT` | 됨. 화면 100자 → 서버 검사 |
| 모임 모집 상태 🔴 | 모집 중 / 모집 완료 / 지난 모임 / 취소됨, 목록에서 모집 완료는 맨 뒤 | `recruitOf()` 계산 | 칼럼 없음 | 서버 계산 `recruitStatus` (api-draft 1.9). 목록 정렬·거르기에 쓰므로 쿼리 식이 필요. 인원순 정렬을 위해 `confirmed_count` 비정규화 칼럼도 고려 |
| 확정 인원 (주최자 포함) 🔴 | "6명 중 4명 확정 · 주최자 포함" | `1 + members` | `meetup_application.status` | `1 + COUNT(APPROVED)`. 주최자는 신청 행이 없다고 가정 (M2) — 맞는지 확인 |
| 자동 미승인 🟠 | 마감 지나면 신청 대기 → "승인되지 않음" | `myOf()` 계산 | status | 마감 시각에 배치로 `EXPIRED` + 알림 (M7). 배치 전에도 조회는 계산값으로 |
| 모임 관심사 태그 🔴 | 만들기 "관심사 태그 최대 3개" (M15) | `tags: string[]` | 없음 | Q3 |
| 모임 팻말 글자 · 짧은 지역 🟢 | 카드 위 나무 팻말 "독서 모임", "성수동" | `sign`, `area` | 없음 | 프론트가 계산 (제목 앞 8자, 장소 앞 두 낱말). 디자이너가 따로 정하는 값이면 `sign VARCHAR(8)` |
| 모임 플랫폼 "기타" 🟢 | 온라인: Zoom · Discord · Gather · 직접 입력 | `platform`='기타' + `place`=직접 쓴 이름 | `platform VARCHAR`, `place` | 직접 쓴 이름을 `platform` 에 그대로 넣는 것으로 통일 제안 (기타 표시 불필요) |
| 모임 신청 메시지 받기 🟢 | 상세 "주최자에게 남길 말" 숨김 | `askMsg` | `accepts_message` | 됨 |
| 모임 신고 🟢 | 상세 ⋯ › 모임 신고 | `reported` | report 주석에 모임 없음 | Q12 |
| 단골 수 🟢 | 내 땅굴 "단골 8" (`MY_REGULARS_COUNT`) | 상수 | `regular_burrow` | `COUNT(burrow_id = 내 땅굴)` 서버 계산 |
| 추천 입력 🟠 | 추천 설정 팝업 (`RecommendSettings`) | 관심사 n개 · 질문 1 · 같은 질문 먼저 · 캠퍼스/기수/층 | `use_interest`·`use_same_question`·`use_affiliation` (타입 미정) + `recommend_setting_question` | Q9. 점수 규칙(프론트 목: 고른 관심사 겹침 ×3, 내 관심사 겹침 ×1, 같은 질문 +4, 같은 캠퍼스 +2, 기수 +1.5, 층 +2, 같은 점수는 날마다 섞음 — `data/field.ts drawRecommendations`)을 서버로 옮김 |
| 오늘의 추천 날짜 🟢 | 하루 한 번 | 브라우저 날짜 | `recommended_on (미정)` | `DATE`, **Asia/Seoul 기준 오늘** |
| 차단 🔴 | 설정 › 차단 관리, 프로필 팝업, 채팅 숨김 | localStorage | 없음 | Q1. 차단하면 서로의 대화 요청·1:1·방명록을 막을지(양방향) 결정 필요 |
| 방 꾸미기 · 무드 · 벽지 🟠 | 내 땅굴 꾸미기 › 가구 탭, 무드 | 세부 관심사 → 가구 id (sessionStorage) | `member_interest.furniture VARCHAR(30)` | Q8. 가구 id 는 영구 id (이름 바꾸지 않음), 모르는 id 는 기본 가구로 |
| 두더지 꾸미기 부위 🟢 | 머리 · 얼굴 · 목 · 손 (`MOLE_PARTS`) | 아이템 id 배열 (최대 4) | `mole_head`·`mole_face`·`mole_neck`·`mole_hand VARCHAR(30)` | **부위 4개는 맞음**. 아이템 목록(41개, glb 노드 이름, 가장 긴 것 18자)은 프론트 상수 → 서버 검증용으로 같은 목록 공유 필요. 규칙: 부위마다 하나, 관심사 전용 아이템은 그 대분류 관심사가 있어야, `ribbon_back`(목) + `prop_suitcase`(손) 같이 못 낌 |
| 관심사 인원수 (니치) 🟢 | 온보딩 "통하는 취향", 분야 팝업 | 목 상수 | `member_interest` | `GET /interest-categories` 의 `memberCount` = COUNT (캐시 가능) |
| 질문 답 슬롯 🟢 | 질문 3개 | `qna[3]` | `member_answer.slot (미정)` | `TINYINT 1~3`. UQ (member_id, intro_question_id) 는 같은 질문 두 번 막기 ✓ |
| 들판 자리 재사용 🟢 | 탈퇴로 빈 번호는 30일 비웠다가 가장 작은 번호부터 (explore-field-v3-9 "판단한 것") | 목 | `burrow_entrance` UQ(term, floor, slot) | 탈퇴 때 입구 행을 지우지 않고 `released_at` 을 두면 30일 보류 계산 가능 |
| 조회수 중복 🟢 | 글 조회수 (작성자 본인 제외) | 목 | `post.view_count INT` | 같은 사람 중복은 Redis set(하루) 으로 거르고 숫자만 DB |
| 글 저장 시각 🟢 | 저장한 글 "11월 9일 저장", 저장순 정렬 | `savedAt` | `post_bookmark.created_at` | 됨 |
| 글 신고 3명 가림 🟢 | 3명 신고 → 가려짐, 신고한 사람에게 접힘 | `reports`, `reportedByMe` | `post.status`, `report` | 됨. 3명 기준은 서버 상수 |
| 관리자 처리 메모 🟢 | 관리자 신고 처리 메모 | `memo` | 없음 | Q12 |
| 회원 가입 단계 🟢 | 이메일 → 비밀번호 → SSAFY 인증 → 온보딩 | 목 | `ssafy_verified_at`, `onboarded_at`, `terms_agreed_at` | 됨. 로그인 응답 `next` 로 단계 알려 주기 (api-draft 2.1) |
| 탈퇴 사용자 닉네임 🟢 | "탈퇴한 사용자" | `GONE_ID` | `nickname UQ ?` | 탈퇴하면 닉네임을 비워(NULL) 다른 사람이 쓸 수 있게 할지 결정. 응답은 `nickname: null` |
| 캠퍼스-층 목록 🟢 | 회원가입·내 정보·탐색 | 상수 두 벌 (서로 다름) | `campus`, `campus_floor` | Q11 |

---

## 2. ERD 칼럼 중 타입이 "(미정)" 인 것 — 프론트가 쓰는 값

| 테이블.칼럼 | 프론트 값 | 제안 타입 |
|---|---|---|
| `interest_category.name`, `interest.name` | "책·글", "SF소설" (가장 긴 것 약 10자) → **2026-11-18 확정본으로 바뀜**: "외국어·자기계발", "자전거/바이크/드라이브" (가장 긴 것 12자, [interest-enum.md](interest-enum.md)) | VARCHAR(20) |
| `intro_question.content` | "하루 동안 투명 인간이 된다면 뭐 해볼래요?" (관리자 입력 60자) | VARCHAR(100) |
| `intro_question.type` | 관심사 · TMI | VARCHAR(10) enum `INTEREST`·`TMI` |
| `member_answer.slot` | 1 · 2 · 3 | TINYINT |
| `term.year` · `term.half` | 2026 · 상반기/하반기 | SMALLINT · VARCHAR(6) `FIRST`·`SECOND` (또는 TINYINT 1·2) |
| `campus.name` · `campus.sort_order` | 서울 · 대전 · 구미 · 광주 · 부울경 (모임 화면 순서) | VARCHAR(10) · TINYINT |
| `campus_floor.floor` | 1 · 2 · 3 · 10 · 12 · 13 | TINYINT |
| `recommend_setting.use_*` | 켜고 끔 | BOOLEAN |
| `daily_recommendation.recommended_on` | 오늘 (Asia/Seoul) | DATE |
| `daily_recommendation_member.sort_order` | 0 · 1 · 2 | TINYINT |
| `member_suspension.reason` | "신고 누적" | VARCHAR(100) |

---

## 3. enum 값 후보

프론트가 지금 쓰는 값을 그대로 옮긴 것. 서버가 다른 이름을 정해도 `app/src/api/mappers.ts` 표만 바꾸면 된다.

| 칼럼 | 값 후보 | 프론트 지금 값 (코드) | 메모 |
|---|---|---|---|
| `member.role` | `USER` · `ADMIN` | `admin: boolean` (`data/account.ts`) | VARCHAR(10) ✓ |
| `member.status` | `ACTIVE` · `SUSPENDED` · `WITHDRAWN` | 탈퇴 `GONE_ID` | 정지는 `member_suspension` 으로 계산해도 됨 |
| `member.withdraw_reason` | 자주 쓰지 않아요 / 원하는 사람을 찾기 어려워요 / 대화나 모임이 부담스러워요 / 불편한 일을 겪었어요 / 새 계정으로 다시 가입할래요 / 기타 | `LEAVE_REASONS` | 문장 그대로면 VARCHAR(30) 에 들어감(최장 15자). 코드로 바꾸면 `RARELY_USED`·`HARD_TO_FIND`·`BURDEN`·`BAD_EXPERIENCE`·`NEW_ACCOUNT`·`ETC` |
| `chat_room.type` | `DIRECT` · `MEETUP` | `dm` · `group` | VARCHAR(10) ✓ |
| `chat_message.type` | `TEXT` · `SYSTEM` · `MEETUP_SHARE` | `system`, `meetupId` | 시스템 문장(“OO님이 모임에 참여했어요”)을 content 에 넣을지, `SYSTEM` + 코드로 줄지 결정 |
| `chat_request.status` | `PENDING` · `ACCEPTED` · `DECLINED` · `CANCELED` · `EXPIRED` | 받은/보낸, 5일 | VARCHAR(20) ✓ |
| `meetup.mode` | `OFFLINE` · `ONLINE` | 오프라인 · 온라인 | VARCHAR(10) ✓ |
| `meetup.category` | 대표 관심사 (Q3) | 세부 관심사 이름 | id 로 바꾸기 제안 |
| `interest_category.code` · `interest.code` (새 칼럼 제안) | 대분류 12 · 소분류 90 영어 code (예: `food` · `cafe_coffee`) | `data/interestTags.ts` | **2026-11-18 관심사 확정본**. 표 전체와 길이(code 최장 20자 · 이름 최장 12자)는 [interest-enum.md](interest-enum.md) |
| `meetup.platform` | Zoom · Discord · Gather · (직접 쓴 이름) | `PLATFORMS` | 자유 문자열 VARCHAR(20) |
| `meetup_application.status` | `PENDING` · `CANCELED`(스스로 취소, 다시 신청 가능) · `REJECTED`(주최자 거절) · `EXPIRED`(자동 미승인) · `APPROVED` · `LEFT`(확정 후 참여 취소, 다시 신청 불가) · `KICKED`(내보내짐) | `pending`·`withdrawn`·`rejected`(+auto)·`joined`·`quit`·`kicked` | M7·M8 규칙. VARCHAR(20) ✓ |
| (계산) 모집 상태 | `OPEN` · `CLOSED` · `ENDED` · `CANCELED` | `open`·`closed`·`past`·`cancelled` | 칼럼 아님, 응답 값 |
| `post.category` | `MEETUP_PROMO` · `MEETUP_REVIEW` · `FREE` | 모임 홍보 · 모임 후기 · 자유 | VARCHAR(20) ✓ |
| `post.status` · `comment.status` | `PUBLIC` · `HIDDEN` · `DELETED` | `public`·`hidden`·`deleted` | VARCHAR(10) ✓ |
| `report.target_type` | `POST` · `COMMENT` · `MEMBER` · `GUESTBOOK` · `MEETUP` | 글 · 댓글 · 사용자 · 방명록 글 (+ 모임) | Q12 |
| `report.reason` | `SPAM` · `ABUSE` · `SEXUAL` · `ETC` | 스팸·홍보 / 욕설·비하·괴롭힘 / 음란물 / 기타 (`REPORT_REASONS`) | VARCHAR(20) ✓. 기타는 `detail` 필수 |
| `report.status` | `RECEIVED` · `HIDDEN` · `DISMISSED` · `SANCTIONED` | 대기 · 가림 · 복구/문제 없음 · 삭제 | 관리자 화면 |
| `notification.type` (VARCHAR(40)) | `MEETUP_APPLICATION_RECEIVED` · `MEETUP_APPLICATION_APPROVED` · `MEETUP_APPLICATION_REJECTED` · `MEETUP_MEMBER_LEFT` · `MEETUP_KICKED` · `MEETUP_UPDATED` · `MEETUP_CANCELED` · `MEETUP_STARTING_SOON` · `MEETUP_VACANCY` · `CHAT_MESSAGE` · `CHAT_REQUEST_RECEIVED` · `CHAT_REQUEST_ACCEPTED` · `POST_COMMENTED` · `COMMENT_REPLIED` · `POST_LIKED` · `COMMENT_LIKED` · `REPLY_LIKED` · `POST_HIDDEN` · `GUESTBOOK_WRITTEN` · `SERVICE_NOTICE` | 명세 F9 "알림 종류" 20개 (`data/notifications.ts`, 표는 `api/mock/serialize.ts NOTICE_TYPE`) | 가장 긴 것 27자 → VARCHAR(40) ✓ |
| `notification.target_type` | `MEETUP` · `CHAT_ROOM` · `CHAT_REQUEST` · `POST` · `COMMENT` · `BURROW` · `NOTICE` | 이동 주소 | ERD 주석(모임·대화방·대화 요청·글·공지)에 **방명록(BURROW)·댓글** 추가 필요 |
| (분류) 알림 | `MEETUP` · `CHAT` · `COMMUNITY` · `BURROW` · `NOTICE` | 모임·채팅·커뮤니티·땅굴·공지 | `notification_setting.*_on` 과 같음 ✓ |
| `notice.category` | `NOTICE` · `UPDATE` · `EVENT` | 공지 · 업데이트 · 이벤트 | VARCHAR(10) ✓ |
| `intro_question.type` | `INTEREST` · `TMI` | 관심사 · TMI | |

---

## 4. 길이 제한 비교 (화면 글자 수 ↔ ERD)

| 항목 | 화면 제한 (코드) | ERD | 판단 | 제안 |
|---|---|---|---|---|
| 닉네임 | 12자 (`NICK_MAX`) | `nickname VARCHAR(12)` | ✓ | — |
| 자기소개 | 150자 (`INTRO_MAX`) | `intro VARCHAR(150)` | ✓ | — |
| 질문 답 | 10~50자 (`ANSWER_MIN/MAX`) | `answer VARCHAR(50)` | ✓ | 최소 10자는 서버도 검사 |
| **방명록** | **100자** (`GUESTBOOK_MAX`) | `content VARCHAR(50)` | ✗ | **VARCHAR(100)** (Q2) |
| 대화 요청 첫 인사 | 50자 | `chat_request.message VARCHAR(50)` | ✓ | — |
| 채팅 메시지 | 500자 | `chat_message.content TEXT` | ✓ | 서버 검사 500 |
| 모임 공지 | 100자 | `chat_room.notice TEXT` | ✓ | 서버 검사 100 |
| 모임 이름 | 30자 | `meetup.title VARCHAR` (길이 없음) | ? | VARCHAR(30) |
| 모임 소개 | 300자 | `description TEXT` | ✓ | 서버 검사 300 |
| 준비물 | 40자 | `supplies VARCHAR` | ? | VARCHAR(40) |
| 장소 · 상세 주소 | 60자 · 40자 | `place` · `place_detail VARCHAR` | ? | VARCHAR(60) · VARCHAR(40) |
| 온라인 플랫폼(직접 입력) | 20자 | `platform VARCHAR` | ? | VARCHAR(20) |
| 접속 링크 | 제한 없음 | `join_url VARCHAR` | ? | VARCHAR(500) + URL 형식 검사 |
| 모임 신청 남길 말 | 100자 | `meetup_application.message VARCHAR` | ? | VARCHAR(100) |
| 모임 정원 | 2~50명 (만들기 화면 +/−, 수정 때는 확정 인원보다 적게 못 줄임) | `capacity INT` | ✓ | 서버도 2~50 · 수정 때 하한(확정 인원) 검사 |
| 글 제목 | 50자 (`TITLE_MAX`) | `post.title VARCHAR(50)` | ✓ | — |
| 글 본문 | 1000자 (`BODY_MAX`) | `post.content VARCHAR(1000)` | ✓ | — |
| 글 관심사 | 대분류 최대 5개 (`TAG_MAX`) | `post_interest` | ✓ | 서버 검사 5 |
| 글 사진 | 최대 3장 (`PHOTO_MAX`) | `post_image` | ✓ | 서버 검사 3, `image_url VARCHAR(500)` |
| 댓글 · 답글 | 300자 (`COMMENT_MAX`) | `comment.content VARCHAR(300)` | ✓ | — |
| 신고 기타 사유 | 100자 (`ETC_MAX`) | `report.detail VARCHAR(100)` | ✓ | — |
| 탈퇴 사유 | 선택지 6개 (최장 15자) | `withdraw_reason VARCHAR(30)` | ✓ | — |
| 공지 제목 | 60자 (관리자) | `notice.title VARCHAR` | ? | VARCHAR(60) |
| 관심사 고르기 | 3~10개 (`MIN_PICK`, `MAX_PICK`) | `member_interest` | ✓ | 서버 검사 |
| 두더지 아이템 id | 최장 18자 (`prop_balloon_heart`) | `mole_* VARCHAR(30)` | ✓ | — |
| 가구 id | 카탈로그 id 113개, 최장 16자 (`display_shelf_01`, `furnitureCatalog.json`) | `member_interest.furniture VARCHAR(30)` | ✓ | — |
| 이메일 | 형식 검사 | `email VARCHAR` | ? | VARCHAR(254) |

길이는 **글자 수(코드 포인트) 기준**으로 셀지, 바이트로 셀지 맞춰야 한다. 프론트 `maxLength` 는 UTF-16 길이라 이모지가 2로 세어진다 → 서버는 `utf8mb4` + 글자 수 검사 제안.

---

## 5. 다음 단계
1. 0장 Q1~Q5 를 회의에서 먼저 답받기 (API 모양이 바뀜)
2. 답이 오면 `app/src/api/types.ts` · `mappers.ts` 를 고치고 이 문서의 항목을 "결정됨"으로 표시
3. enum 값이 정해지면 3장 표를 확정본으로 바꾸고 `mock/serialize.ts` 의 표도 맞춤
