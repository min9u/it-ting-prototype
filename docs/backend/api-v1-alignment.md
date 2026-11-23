# 프론트를 백엔드 확정 API 명세(v1)에 맞추기 (2026-11-22)

- 요청: "백엔드 리포는 https://github.com/it-ting-team/it-ting 이야. api 명세가 다 확정된 상태인데, 지금 프론트엔드를 모두 이 api 명세에 맞출 수 있어?"
- 결정 (사용자 선택):
  1. 작업 위치: **이 프로토타입 리포(`app/`)에서 맞추고, 팀 리포로 옮기는 건 나중에**
  2. 범위: **API + 기능 차이까지**. 백엔드 리포의 서비스 명세(`spec/`)가 팀의 단 하나의 기준이므로, 명세에 있는데 화면에 없는 기능은 만들고 명세에서 뺀 기능은 화면에서도 뺀다
  3. 진행: **공통 계층을 먼저 만들고, 영역별 작업자가 병렬로** 맞춘 뒤 합친다
- 명세 사본: [team-spec/](team-spec/README.md) (원본 `dev` 브랜치 커밋 `04ea897`, 2026-11-22)

## 백엔드 상태 (2026-11-22)
- 명세: 영역 문서 10개, API 111개 (00 공통 6 · 02 인증 12 · 03 온보딩 2 · 04 내 땅굴 5 · 05 탐색·방문 11 · 06 채팅 14 · 07 모임 20 · 08 커뮤니티 23 · 09 알림 5 · 10 설정 13)
- 구현됨: 공통 응답 틀·전역 예외, 캠퍼스·층(`GET /campuses`)·기수(`GET /generations`), 로그인·로그아웃·내 계정(`POST /sessions`, `DELETE /sessions/current`, `GET /me`). 나머지는 명세만
- 그래서 구현된 것은 실제 서버로 확인하고, 나머지는 **명세 모양 그대로 흉내 내는 목 서버**로 돌린다. 백엔드가 구현하는 대로 영역마다 실제 서버로 바꾼다

## 우리 초안(api-draft.md)과 달라진 것

| 항목 | 우리 초안 (11-16) | 백엔드 확정 |
|---|---|---|
| 주소 | `/api/...` | `/api/v1/...`, 자원은 복수형·하이픈, 내 것은 `/me/...`, 상태 바꾸기는 `POST /<자원>/{id}/<행동>`, 켜기·끄기는 `PUT`/`DELETE` |
| 응답 | 봉투 없음 | `{ success, data, error }`. 목록은 `data.items`. 204 없음 |
| 목록 | `PageDto` / `CursorPageDto{items,nextCursor}` | 페이지 `{items,page,size,totalItems,totalPages}`(page 1부터) / 커서 `{items,nextCursor,hasNext}` |
| 에러 | `{code,message,status,traceId,fieldErrors}` | `error: {code,message,fields,detail}`. 입력 오류는 400 `INVALID_INPUT` + `fields[{field,message}]`. 화면 문구는 **프론트가 code로 정함** |
| ID | JSON 문자열 | **숫자** |
| 시각 | ISO + 오프셋(서울) | **UTC `…Z`**, 날짜만은 `YYYY-MM-DD` |
| 인증 | HttpOnly 쿠키 + `POST /auth/refresh` | 세션 쿠키 `ITTING_SESSION`(14일, 쓸 때마다 연장), **갱신 API 없음** → 401이면 로그인 화면 |
| 실시간 | WebSocket + STOMP | **SSE 하나** `GET /api/v1/me/event-stream`. 보내기는 일반 API. 끊긴 동안 소식은 다시 안 줌 → 다시 붙으면 조회 API로 맞춤 |
| 파일 | (미정) | `POST /api/v1/images`(multipart, 하나씩) → id를 받아 본문에 `imageIds` |

## 프론트 구조 (작업자 공통 규칙)
- **DTO는 명세 그대로** (숫자 id, UTC 문자열, enum 대문자). **앱 모델은 지금처럼 문자열 id** 를 유지하고 `mappers`에서 바꾼다 → 화면 코드가 덜 흔들림
- 영역마다 폴더 하나: `app/src/api/<영역>/` 에 `types.ts`(DTO) · `real.ts`(실제 서버 호출, `ENDPOINTS` 목록) · `mock.ts`(목 서버, 지금의 `data/*Store`를 "서버"로) · `mappers.ts` · `queries.ts`(TanStack Query 훅) · `index.ts`. 작업자는 **자기 영역 폴더만** 고친다
- 화면은 영역의 훅·API 함수만 부른다. 화면이 `data/*Store`를 직접 부르던 쓰기(글쓰기·모임 만들기·보내기 등)도 API로 옮긴다
- 에러 문구는 영역마다 `code → 문구` 표 하나 (`api/<영역>/errors.ts`)
- 완성도 검사: `src/tests/api-v1-endpoints.test.ts`가 `docs/backend/team-spec/api/*.md`의 API 제목과 각 영역 `ENDPOINTS`를 비교 → 빠진 API가 있으면 실패

## 영역 나누기

| 작업자 | 명세 | 비고 |
|---|---|---|
| 공통 (먼저) | api-convention, api/00 | 클라이언트·봉투·에러·목록 모양·시간·세션·SSE 연결·목 서버 바탕·영역 폴더 뼈대·완성도 검사 |
| 인증·설정 | 02, 10 | 이메일 가입·SSAFY 인증·로그인·Google·비밀번호 재설정, 계정·비밀번호·Google 연동·알림 설정·푸시·공지사항·탈퇴 |
| 온보딩·내 땅굴 | 00(관심사·질문·프로필), 01, 03, 04 | 닉네임 확인·온보딩 확정, 내 땅굴·두더지·내 정보·방명록 |
| 탐색·방문 | 05 | 들판·학기·땅굴 옮기기·단골·오늘의 추천·남의 땅굴·방명록 쓰기·대화 요청 보내기 |
| 채팅 | 06 | 대화 목록·메시지·읽음·나가기·공지·요청 수락/거절/취소, SSE 채팅 소식 |
| 모임 | 07 | 찾기·상세·신청·만들기/수정/취소/삭제·찜·빈자리 알림·신청 관리·내 모임·캘린더 |
| 커뮤니티 | 08 | 글·댓글·좋아요·저장·내 활동·사진 올리기·신고 |
| 알림 | 09 | 팝업·목록·안 읽은 수·읽음, SSE 알림 소식 |

11 운영·관리자는 명세에서 보류라 그대로 둔다.

## 진행 기록
- 2026-11-22: 명세 사본·계획. 공통 계층 시작
- 2026-11-22: [공통 계층 완료](api-v1-foundation.md) — `api/` 를 영역 폴더 11개로 나눔(옛 코드는 동작 그대로 옮김), 클라이언트(/api/v1 · 응답 틀 · ApiError{code, fields, detail} · 401 바로 로그인), id(숫자 ↔ 문자열, 목은 되돌릴 수 있는 표) · UTC 시각, 목 서버 명세 코드, 영역별 실제/목 전환(VITE_API_REAL_AREAS), SSE 연결 하나(realtime/events.ts), 완성도 검사(ENDPOINTS 6 + PENDING 105). 영역 작업자 규칙과 Next.js 이전 대비 규칙은 그 문서 2장
- 2026-11-22: [영역 작업 7개를 합친 뒤 공통 정리](api-v1-foundation.md#7-영역-작업을-합친-뒤-공통-정리-2026-11-22) — 방명록 저장소 하나 · 두더지 코드 공통 · 채팅이 대신 부르던 API 정리 · 차단 삭제 · 다른 영역 목의 알림 · 403 ONBOARDING_INCOMPLETE · 글자 수 RULES 하나(명세 값) · 옛 코드 삭제. [백엔드 질문 모음](api-v1/questions-for-backend.md) · [바뀐 기능 목록](api-v1/feature-changes.md)
