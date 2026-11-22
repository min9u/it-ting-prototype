# API v1 맞추기 — 05 탐색 · 방문 (+ 00 학기) (2026-11-22)

- 요청: 백엔드 확정 명세 v1 에 프론트를 맞추는 영역 작업 7개 중 "탐색 · 방문" ([계획](../api-v1-alignment.md), [공통 계층 · 작업 규칙](../api-v1-foundation.md))
- 기준: [api/05-explore-visit.md](../team-spec/api/05-explore-visit.md), [api/00-common.md](../team-spec/api/00-common.md) `GET /api/v1/terms`, 서비스 명세 [spec/05-explore-visit.md](../team-spec/spec/05-explore-visit.md) · [spec/README.md](../team-spec/spec/README.md) "이번 범위에 없는 것"
- 결론: 12개 API 를 모두 명세 모양으로 만들었고(`PENDING` 비움), 탐색 · 방문 화면은 이 영역의 API 함수와 훅으로만 읽고 쓴다. 새 학기 안내를 새로 만들었고, 명세에서 뺀 "접속 중" · 땅굴 개수 · 저장한 방 값을 화면에서 뺐다
- 다음: 04 작업자가 방명록 목록 · 지우기를 `api/burrow` 에 만들면 이 영역의 "다리" 두 함수를 지우고 그쪽 훅으로 바꾼다. 인증 작업자의 `GET /me` 목 서버가 새 학기 시연 상태(`data/field isNewTermPending`)를 보고 `NEW_TERM` 을 주게 한다 (아래 "부탁")

## 1. 만든 API (`app/src/api/explore/`)

| API | real.ts 함수 | 훅 · 쓰는 곳 |
|---|---|---|
| `GET /api/v1/terms` | `terms` | `useTerms` · `useCurrentTerm` — 캠퍼스-층 고르기의 학기 줄, 새 학기 안내 제목, 내 들판 |
| `GET /api/v1/terms/{termId}/fields` | `fieldStatuses` | `useFieldStatuses` — 캠퍼스-층 고르기의 "비어 있음" |
| `GET /api/v1/terms/{termId}/fields/{campusFloorId}` | `field` | `useField` — 탐색 들판(3D · 미니맵 · 방노트 · 이름표 · 빈 상태) |
| `POST /api/v1/me/burrow/move` | `moveBurrow` | `useMoveBurrow` — 새 학기 안내 "이 층으로 정하기" |
| `GET /api/v1/me/regular-burrows` | `regularBurrows` | `useRegularBurrows` · `useRegularOwnerIds` — 단골 목록, 미니맵 별 |
| `PUT /api/v1/burrows/{burrowId}/regular` | `addRegular` | `useVisitActions().setRegular(true)` — 방문자 뷰 "단골 추가" |
| `DELETE /api/v1/burrows/{burrowId}/regular` | `removeRegular` | `useVisitActions().setRegular(false)` · `useRemoveRegular` — 다시 누르기, 단골 목록 "해제" |
| `GET /api/v1/me/daily-recommendation` | `dailyRecommendation` | `useDailyRecommendation` — 추천 친구 빨간 점, 추천 팝업(받기 전/결과) |
| `POST /api/v1/me/daily-recommendation` | `drawRecommendation` | `useDrawRecommendation` — "추천 받기" (결과를 캐시에 바로) |
| `GET /api/v1/users/{userId}/burrow` | `userBurrow` | `useVisitBurrow` — 방문자 뷰 · 방노트 (실험실 `/lab/rooms` 도) |
| `POST /api/v1/burrows/{burrowId}/guestbook-entries` | `writeGuestbook` | `useVisitActions().writeGuestbook` — 우체통 창 "남기기" |
| `POST /api/v1/chat-requests` | `sendChatRequest` | `useSendChatRequest` — 대화 요청 팝업 "요청 보내기" |

- DTO(`types.ts`)는 명세 그대로: 숫자 id, UTC 시각, `recommendedOn` 은 날짜, `chat.status` 는 대문자 enum, 없으면 `null`. 사람은 `UserDisplayDto`, 관심사는 `InterestTagDto`
- 에러 문구(`errors.ts` `EXPLORE_ERRORS`): `TERM_NOT_FOUND` · `CAMPUS_FLOOR_NOT_FOUND` · `BURROW_NOT_FOUND` · `OWN_BURROW_NOT_ALLOWED` · `USER_NOT_FOUND` · `CHAT_ROOM_ALREADY_EXISTS` · `CHAT_REQUEST_ALREADY_SENT` · `CHAT_REQUEST_ALREADY_RECEIVED`(명세 방문자 뷰 4 문구 그대로) + 다리용 `GUESTBOOK_ENTRY_NOT_FOUND` · `FORBIDDEN`. 화면은 `code` 로만 나눈다
- **다리 (ENDPOINTS 에 안 적음)**: 방문자 뷰의 방명록 목록 · 지우기는 명세상 04 API(`GET /burrows/{burrowId}/guestbook-entries`, `DELETE /guestbook-entries/{id}`)다. 04 작업자의 것이 아직 없어 `real.guestbookPage` · `real.deleteGuestbookEntry` 를 명세 주소 · 모양으로 이 폴더에 두었다. 04 가 만들면 지운다
- 시험: `src/tests/api-explore.test.ts` (20개: 목 서버 규칙 · 에러 코드 · 매퍼 · 실제 서버 모양 예시), `room-look.test.ts` 고침

### 앱 모양 (mappers.ts)
- **들판 위치** `FieldPlace{termId, campusFloorId}`, 주소는 `?floor=<학기 id>|<캠퍼스-층 id>` (`placeId` · `parsePlace`). 실제 서버면 `?floor=4|12`, 목 서버면 학기 id 가 `'2026 하반기'`, 캠퍼스-층 id 가 `'서울|2'`(00 공통 목 서버와 같은 글자)라 **예전 들판 주소 `2026 하반기|서울|2` 와 같은 글자**다. 그래서 화면 목록 링크 · 3D 들판 key 가 그대로 맞는다
- **들판** `toField` → `data/field` 의 `FieldData` 모양(자리 · 주인 · 구역 수 · 내 자리) + `place` · `term`. 3D 들판(`three/holeField.ts`) · 미니맵은 고치지 않고 받는 값만 바뀜. 구역 수 = ceil(가장 큰 자리 번호 / 25)
- 주인의 겹치는 관심사는 서버의 `isShared` 그대로 (`Resident.shared`, `BurrowVM.shared`). Q&A 는 `Q1. 질문` 모양으로
- "N분 전" 같은 문구는 프론트가 시각으로 만든다

## 2. 화면

| 화면 | 바뀐 것 |
|---|---|
| 탐색 `screens/burrow/ExploreBurrow.tsx` (시안 A, 기본) | 들판 = `useField`. 주소에 들판이 없으면 내 들판(이번 학기 + `GET /me` 의 `campusFloorId`). 들판을 옮기는 동안 보던 들판 유지(3D 를 다시 만들지 않음), 못 받으면 오류 + "내 들판으로". 빨간 점 = `hasReceived`. 방노트는 자기소개 없이 닉네임 · 소속 · 관심사 · Q&A (탐색 3). 이름표의 "접속 중" 점 뺌 |
| 미니맵 `Minimap.tsx` | 단골 별 = `GET /me/regular-burrows`. "접속 중" 점 · 범례 · 필터 · 문구 뺌. 같은 관심사 수 = `isShared` |
| 팝업 `ExploreModals.tsx` | 단골 목록(목록 · 해제 · 빈 상태 · 오류), 추천(받기 전: 캠퍼스 · 층 · 기수 = 00 공통 API, 처음 값 = 내 계정 / 결과: 서버가 고른 관심사 3개 그대로 · 뒷면 질문 3개 · 접힌 모서리 앞뒤 · 0명 빈 상태), 캠퍼스-층 고르기(학기 줄은 학기가 둘 이상일 때만, 학기를 바꾸면 층 선택 비움, 캠퍼스를 바꾸면 검색어 · 층 선택 비움, "비어 있음"만 표시, 결과 없으면 "검색 결과가 없어요") |
| 새 학기 안내 `NewTermGate.tsx` (새로) | `App.tsx` AppLayout 에 하나. `GET /me` 의 `nextStep === NEW_TERM` 이거나 어느 API 든 403 `NEW_TERM_INCOMPLETE` 면 뜸. 새 학기 이름 · 캠퍼스 · 층(지난 학기 캠퍼스를 골라 둠) → "이 층으로 정하기" = `POST /me/burrow/move` → 모든 캐시 다시 받기 + 완료 토스트. × · 바깥 · Esc 로 닫히지 않음 |
| 방문자 뷰 `VisitBurrow.tsx` | `useVisitBurrow` 하나로. 대화 버튼 = `chat.status` 4가지 (REQUEST_RECEIVED 는 팝업 대신 "이미 나에게 요청한 사람입니다. 알림창에 가서 확인하세요." 토스트). 보낸 뒤 `chatRoomId` 가 오면(내가 거절했던 요청) 그 대화방으로. 우체통 깃발 = `guestbookCount > 0`. 단골 = PUT/DELETE. "탐색" = 이 땅굴의 `entrance` 들판 · 자리. 방 모습 = 관심사로 계산. 방노트 신고 아이콘 · 방명록 신고 = `api.community.createReport`(`MEMBER` · `GUESTBOOK`). `isMine` 이면 `/burrow` 로 |
| 방노트 `RoomNote.tsx` | "접속 중" 뺌, `intro={false}` 로 자기소개 칸을 뺄 수 있게 |
| 시안 B · C · D `explore-designs/` | **들판은 목 데이터(`data/field fieldOf`) 그대로** (팀 비교용 시안이라 API 로 옮기지 않음, 목 모드 전용). 팝업 3개 · 빨간 점 · 단골 별은 A 와 같은 API 훅. 들판 값에서 "접속 중"을 지움 (필터 칩 "접속 중"은 0명으로 남음) |
| 실험실 `/lab/rooms` | `useVisitBurrow`, 저장한 방 값 없음 |
| 화면 목록 `ScreenIndex.tsx` | 탐색 팝업 3개 · 새 학기 안내 시연 링크 4줄 더함 |

시연 손잡이 (목 서버만): `?newterm=demo`(새 학기 안 고른 계정이 됨, 새로고침하면 원래대로) · `?recommend=reset`(오늘 받은 추천 지움) · `?modal=regulars|recommend|floor`

## 3. 기능: 더한 것 · 뺀 것

더한 것 (명세에 있고 화면에 없던 것)
- 새 학기 안내와 이사 (`POST /me/burrow/move`), 403 `NEW_TERM_INCOMPLETE` 처리
- 캠퍼스-층 고르기의 학기 줄을 "열린 학기 전부"로 (예전: 이번 학기 + 내 지난 학기), "비어 있음" 표시
- 방문자 뷰 대화 버튼 4가지 상태 · 바로 대화방이 열리는 경우 · 방노트 사용자 신고 API
- 추천 카드 뒷면에 질문 3개 모두 (예전 2개), 뒷면 접힌 모서리, "오늘은 다시 받을 수 없어요" 안내

뺀 것 (명세 README "이번 범위에 없는 것" · 05 본문)
- "접속 중" 표시 전부 (탐색 이름표 · 방노트 · 미니맵 점 · 범례 · 필터 · "접속 중 N명")
- 캠퍼스-층 목록의 "땅굴 N개" (명세: 개수는 보여 주지 않음), "내 땅굴" 배지 (명세의 배지는 "현재 위치"만)
- 방문자 뷰의 단골 수 · 방문 중 수 · 저장한 방(벽지 · 가구 · 색 테마) 값 (서버가 주지 않음 → 관심사로 계산)
- 추천 결과의 "관심사가 비슷한 SSAFY 친구" 문구 (추천은 관심사 조건이 없음) → "오늘 만나 볼 SSAFY 친구 N명이에요"

## 4. 애매해서 정한 것

- **내 들판 정하기**: 명세는 `GET /me/burrow` 의 `entrance` 를 쓰라고 하지만 04 영역이라 아직 없다. 새 학기를 고른 계정의 입구는 늘 "이번 학기 + 프로필 캠퍼스-층"이므로 `GET /terms` 의 이번 학기 + `GET /me` 의 `campusFloorId` 로 정했다 (`useHomePlace`). 04 가 생기면 바꿔도 된다
- **대화 요청 인사**: API 는 선택(`null` 가능)이라 빈 채로도 "요청 보내기"를 누를 수 있게 했다 (예전엔 글이 있어야 눌림)
- **409 세 가지**(이미 대화 중 · 이미 보냄 · 상대가 먼저 보냄): 오류 토스트가 아니라 안내 토스트로 보여 주고 땅굴을 다시 받아 버튼을 맞춘다
- **방문자 뷰 방명록 목록**: 방명록 창(`GuestbookModal`, 04 와 같이 쓰는 부품)이 받은 글을 5개씩 나눠 보여 주는 구조라 `size=100` 으로 한 번에 받는다. 명세는 페이지마다 부르는 방식 → 04 작업자가 창을 서버 페이지로 바꾸면 따라간다
- **새 학기 안내 문구 · 토스트**: 명세에 정확한 문구가 없어 "2026 하반기 들판이 열렸어요" · "이번 학기 땅굴 자리를 정했어요"로 했다. Figma 시안의 "나중에 하기" · 닫기는 명세(닫기 없음)를 따라 넣지 않았다
- **캠퍼스-층 고르기**: 캠퍼스를 바꾸면 검색어 · 층 선택을 비우고, 학기를 바꾸면 층 선택만 비운다 (명세 2 · 6 그대로. "서로 맞지 않아 보인 곳"에 적힌 차이)
- **방노트(탐색)의 자기소개**: 탐색 3 에 자기소개가 없고 들판 API 도 주지 않아 뺐다. 방문자 뷰의 방노트에는 있다
- **목 서버의 바로 대화방 열기(서버가 하는 일 7)**: 목 채팅 저장소에 "내가 거절한 요청"이 남지 않아 흉내 내지 않았다. 화면은 `chatRoomId` 가 오면 그 방으로 간다
- **목 서버의 오늘 날짜**: `recommendedOn` 은 서울 날짜. 기준 날짜가 바뀌는 시각은 명세가 구현 단계로 넘김

## 5. 다른 영역 · 공통에 부탁 (고치지 않고 보고만)

- **04 (burrow)**: 방명록 목 저장소를 `data/guestbooks.ts` 로 꺼냈다 (방문자가 쓴 글이 주인 목록에 나오게). `GET /burrows/{burrowId}/guestbook-entries` · `DELETE /guestbook-entries/{id}` 목 서버도 이 저장소를 써 주면 좋겠다. 목 땅굴 id 는 `toDtoId('b-<주인 id>')`. 만들면 이 영역의 다리 두 함수와 `useVisitGuestbook` 을 지운다
- **04 (burrow)**: 내 정보 수정에서 캠퍼스-층을 바꾸면 땅굴도 옮겨진다(명세 04 내 정보 수정 2). 목 서버에서는 `data/field.ts` 의 `moveMyBurrow(campus, floor)` 를 부르면 들판 · `ME_HOME`(=`GET /me`) 이 같이 바뀐다
- **02 (auth)**: 목 `GET /me` 가 `data/field.ts` 의 `isNewTermPending()` 이 참이면 `nextStep: 'NEW_TERM'` 을 주게 해 주면 명세 흐름 그대로 시연된다 (지금은 탐색 API 의 403 으로 안내가 뜸)
- **06 (chat)**: `POST /chat-requests` 는 이 영역(05 문서)이 만들었다. 채팅의 옛 `api.chat.sendRequest`(초안 `/chat/requests`)는 쓰는 화면이 없으면 지워도 된다. 보낸 요청 수락 · 거절 · 취소는 06 그대로
- **08 (community)**: 방노트 · 방명록 신고는 `api.community.createReport(reportBody('MEMBER' | 'GUESTBOOK', id, 사유))` 를 부른다. 이름이 바뀌면 여기도 맞춰야 한다. 목 신고가 `data/guestbooks.ts` 의 `reportGuestbookEntry` 를 부르면 3명 신고 가림도 흉내 낼 수 있다
- 공통: 없음 (공통 파일은 고치지 않음). `App.tsx` 에 `<NewTermGate />` 한 줄, `ScreenIndex.tsx` 에 시연 링크 4줄을 더했다

## 6. 백엔드 · 팀에 물어볼 것

- `GET /me` 의 `nextStep` 이 `NEW_TERM` 인 계정이 `GET /me/daily-recommendation` 등 이 영역 API 를 부르면 403 이다. 프론트는 안내가 뜨는 동안 뒤 화면이 비어 있게 두었다 — 괜찮은지
- `GET /terms/{termId}/fields/{campusFloorId}` 의 `items` 에는 자기소개가 없다. 탐색 방노트에 자기소개를 다시 넣을 계획이면 필드가 필요하다 (지금은 명세대로 뺌)
- 들판 자리 번호의 최대값: 3D 들판은 150자리(구역 6개)까지 그린다. 서버가 151번 이상을 주면 어떻게 할지 (명세는 구현 단계로 넘김)
- 방명록 목록 `size` 의 최대값 (방문자 뷰가 한 번에 100개를 받음)
- 추천 받기 응답이 201/200 으로 나뉘는데 프론트는 구분하지 않는다 (같은 `data`) — 그대로 두면 되는지

## 7. 확인

- `npx tsc -b --noEmit` 통과, `npm run build` 통과
- `npm test`: 34 파일 · 453 통과 · 95 todo (새 `api-explore.test.ts` 20개 포함). `field-fence.test.ts` 의 "켠 구역의 모든 물건…"이 한 번 5초 제한에 걸렸다가 다시 돌리니 통과 (울타리 계산만 하는 시험, 이 작업과 관계없는 느린 시험)
- 완성도 검사(`api-v1-endpoints.test.ts`): explore 의 todo 없음
- 스모크 (개발 서버 5413, `--only=burrow`, 21화면): 탐색 · 시안 B~D · 빈 들판 · 팝업 3개 · 새 학기 시연 · 방문자 뷰 3개 모두 OK. `/burrow`(내 땅굴, 04 화면) 첫 화면만 "로딩 표시가 남아 있음" 경고 (개발 서버 첫 컴파일)
