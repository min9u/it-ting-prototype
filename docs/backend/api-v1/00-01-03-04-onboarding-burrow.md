# API v1 맞추기: 00 공통 값 · 01 처음 방문 · 03 온보딩 · 04 내 땅굴 (2026-11-22)

- 요청: 백엔드 확정 API 명세 v1 · 서비스 명세에 프론트를 맞추는 7개 영역 가운데 **00(관심사 · 질문 · 프로필 팝업) · 01 · 03 · 04** ([계획](../api-v1-alignment.md), [공통 계층과 작업 규칙](../api-v1-foundation.md))
- 결론: 이 영역 API 10개를 명세 모양으로 만들었고(`api/onboarding` 5 · `api/burrow` 5, 두 `PENDING` 비움), 온보딩 · 내 땅굴 · 내 정보 수정 · 방명록 · 프로필 팝업이 **이 API 로만** 읽고 쓴다. 명세에 없는 기능(꾸미기 소품 · 색 탭, 차단 메뉴, "접속 중")은 화면에서 뺐다. 관심사 숫자 id ↔ 앱 코드는 **이름으로 잇는 표 하나**(`api/onboarding/interestMap.ts`)로 해결했고, 명세 표 102개 이름이 모두 이어지는 것을 시험으로 확인했다
- 다음: 백엔드가 이 영역을 구현하면 `VITE_API_REAL_AREAS=onboarding,burrow` 로 실제 서버에 붙여 본다. 아래 "백엔드 · 팀에 물을 것"의 1(관심사 `code`)과 2(두더지 코드 대소문자)를 먼저 정하면 좋다

## 만든 API (ENDPOINTS)

| 영역 폴더 | API | 부르는 화면 · 훅 |
|---|---|---|
| `api/onboarding` | `GET /api/v1/interest-categories` | 온보딩 2 · 내 정보 수정 관심사 고르기 — `useInterestCatalog()` |
| | `GET /api/v1/intro-questions` | 온보딩 3 · 내 정보 수정 질문 다시 고르기 — `useIntroQuestions()` |
| | `GET /api/v1/users/{userId}/profile` | 프로필 팝업(`components/ProfilePopup.tsx`) — `useUserProfile(id)` |
| | `POST /api/v1/nicknames/check` | 온보딩 1 "다음" · 내 정보 수정 닉네임 칸 — `useCheckNickname()` |
| | `POST /api/v1/me/onboarding/complete` | 온보딩 4 "관심사 확정" — `useCompleteOnboarding()` |
| `api/burrow` | `GET /api/v1/me/burrow` | 내 땅굴 — `useMyBurrow()` |
| | `PATCH /api/v1/me/mole` | 꾸미기 모드 "저장하기" — `useUpdateMole()` |
| | `PATCH /api/v1/me/profile` | 내 정보 수정 "저장하기" — `useUpdateProfile()` + `toProfileUpdate()` |
| | `GET /api/v1/burrows/{burrowId}/guestbook-entries` | 방명록 전체 보기 (5개씩 페이지) — `useGuestbookEntries(burrowId, page)` |
| | `DELETE /api/v1/guestbook-entries/{guestbookEntryId}` | 방명록 삭제 확인 — `useDeleteGuestbookEntry(burrowId)` |

- DTO 는 명세 그대로(`types.ts`): 숫자 id, UTC 시각, `null`(필드를 빼지 않음), 목록은 `ItemsDto` · `PageDto`. 화면은 매퍼 결과(`MyBurrowVM` · `ProfileVM` · `InterestCatalog` · `GuestbookPageVM`)만 쓴다
- 목 서버는 명세의 "서버가 하는 일" 순서를 따른다: 모양 오류는 400 `INVALID_INPUT` + 어긋난 칸 **모두** `fields` → 404(`INTEREST_NOT_FOUND` · `INTRO_QUESTION_NOT_FOUND` · `CAMPUS_FLOOR_NOT_FOUND`) → 409 `NICKNAME_DUPLICATED`. 방명록 삭제는 주인 · 쓴 사람이 아니면 403 `FORBIDDEN`, 없거나 가려진 글은 404 `GUESTBOOK_ENTRY_NOT_FOUND`. 검사 묶음은 `api/onboarding/mockRules.ts` (온보딩 확정과 내 정보 저장이 같이 씀)
- 에러 문구: `api/onboarding/errors.ts`(`USER_NOT_FOUND` · `NICKNAME_DUPLICATED` · `INTEREST_NOT_FOUND` · `INTRO_QUESTION_NOT_FOUND`), `api/burrow/errors.ts`(위 + `CAMPUS_FLOOR_NOT_FOUND` · `BURROW_NOT_FOUND` · `GUESTBOOK_ENTRY_NOT_FOUND` · `FORBIDDEN`). 화면은 `code` 로만 가른다 (닉네임 겹침 · 입력 오류는 칸 밑 문구, 나머지는 토스트)
- 저장 응답으로 화면을 바로 바꾼다 (명세: 다시 조회하지 않음). 내 모습이 바뀌면 프로필 팝업 · 탐색(`exploreKeys.all`) · 내 계정(`authKeys.me`) 캐시를 새로 받게 한다
- 방명록 신고는 커뮤니티 영역의 `POST /reports`(`api/community` `createReport`)를 `api/burrow/report.ts` 한 곳에서 부른다 (커뮤니티 작업자가 본문 모양을 바꾸면 여기만 맞춤)

## 화면 연결

| 화면 | 읽기 | 쓰기 |
|---|---|---|
| 온보딩 1 이름 · 두더지 | — | "다음" → 닉네임 확인 (겹치면 칸 밑 문구, 성공하면 5분 맡아 둠) |
| 온보딩 2 관심사 | 관심사 목록 (칩 숫자 = `userCount`) | — |
| 온보딩 3 자기소개 | 질문 목록 (추천은 프론트가 이 목록에서 고름) | — |
| 온보딩 3a · 4 | API 없음: 가구 · 무드는 고른 관심사로 (명세 03 "가구와 땅굴 무드"). 땅굴 정보 카드의 소속은 `GET /me`(auth `useMe`) | "관심사 확정" → 온보딩 확정 한 번 |
| 내 땅굴 | `GET /me/burrow` (단골 수 · 방명록 글 수 · 질문 · 관심사 · 두더지 · 소속) | — |
| 꾸미기 모드 | — | 두더지 저장 |
| 내 정보 수정 | 캠퍼스 목록(common `useCampuses`) · 관심사 목록 · 질문 목록 | 닉네임 확인(바꾸면 0.45초 뒤) · 내 정보 저장(다섯 값 모두) |
| 방명록 전체 보기 | 방명록 페이지 (서버 페이지, 글 수 = `totalItems`) | 삭제 · 신고 |
| 프로필 팝업 | `GET /users/{userId}/profile` (겹치는 관심사 = 서버 `isShared`) | 신고 |
| 랜딩 · 둘러보기(01) | API 없음 (견본 방은 앱 데이터 `data/guestRooms.ts`) | — |

## 명세에 맞춰 바꾼 기능

**뺀 것** (명세 "이번 범위에 없는 것" · 영역 규칙)
- 꾸미기 모드의 **소품 탭 · 색 탭**: 명세 04 "꾸미기 모드에는 두더지 탭만 있다", 00 공통 5 "땅굴 가구는 세부 관심사마다 하나로 정해져 있고 사용자가 고르지 않는다", API 에도 방 꾸미기 값을 저장하는 곳이 없다. 내 땅굴은 이제 관심사로만 방을 그린다(`roomLookOf(…, NO_SAVED_ROOM)`). 데이터 쪽 함수(`data/myBurrow` `wordChoices` · `data/roomStyle`)는 실험실과 시험이 쓰므로 남겼다
- 프로필 팝업의 **차단 메뉴** (차단 기능 없음). 신고 아이콘만 남김
- 방노트(`RoomNote.tsx`, 탐색 · 방문자 뷰가 같이 씀)의 **"● 접속 중"** ("접속 중" · "방문 중" 표시 없음)
- 온보딩 미리보기에서 **미리 저장하던 것**: 예전에는 미리보기에 들어오면 관심사 · 두더지를 저장소에 바로 적었다. 명세 03 "도중에 나가면 저장되지 않는다"에 맞춰 "관심사 확정" 한 번에만 저장
- 우체통의 **"읽음" 기억**: 명세는 "글이 하나라도 있으면 깃발", 읽음 개념이 없다 → `guestbookCount > 0`

**바꾼 것**
- 온보딩 1 안내 "실명이나 사진은 받지 않아요" → "실명은 받지 않아요" (프로필 사진은 선택, open-issues)
- 랜딩 03 · 04 제목 · 부제를 명세 01 문구로 ("고른 관심사가 가구가 돼요" → 뒤에 명세가 바뀌어 PR #28 에서 "나의 관심사가 내 땅굴의 가구가 돼요", "같은 걸 좋아하는 이웃이 생각보다 가까이 살아요" …)
- 꾸미기 안내 말풍선 문구: "다양한 가구들을 사용해 보세요!" → "내 두더지를 꾸밀 수 있어요. 가구는 고른 관심사로 정해져요!" (가구를 고르지 않으므로)
- 방명록 전체 보기는 서버가 나눈 페이지를 쓰고(`GuestbookModal` 의 `server`), 글마다 `canDelete` · `canReport` 로 버튼을 정한다. 탈퇴한 작성자는 눌러도 프로필 팝업이 열리지 않는다 (00 공통 4)

**이미 맞아 있던 것** (확인만): 온보딩 단계 · 10개 초과 안내 · 추천 질문 규칙, 내 땅굴의 단골 배지 · 접기 / "방노트" · 자기소개 빈 상태 · Q&A, 내 정보 수정의 캠퍼스-층 · 관심사 고르기 · 질문 ↻ · 저장 전 취소, 01 둘러보기(견본 방 3개 · 점 3개 · 자물쇠 기능 · 4번째 방 로그인 안내 · 상단 "로그인 · 시작하기")

## 관심사 · 질문 잇기

**문제**: 서버는 관심사를 숫자 id(DB 가 정함)로 주고 받는다. 앱은 가구 · 아이콘 · 3D · 무드 · 이펙트를 뜻 있는 코드(`cafe_coffee`, `data/interestTags.ts` `TAG_TREE`)로 고른다.

**방법: 이름으로 잇기** (`app/src/api/onboarding/interestMap.ts`)
- 서버의 대분류 · 세부 관심사 이름은 명세 00 공통 5 표와 같고, 앱 `TAG_TREE` 도 같은 표(2026-11-18 확정본)에서 왔다 → 이름 → 코드 표 하나면 된다. 공백만 무시하고 비교
- `GET /interest-categories` 를 받으면 `toInterestCatalog` 가 앱 모양(예전 `CATEGORIES` 자리, 이모지 · 칩 색은 앱 표에서)과 **이름 → 서버 id**, **서버 대분류 id → 코드** 표를 만든다
- 화면 값은 지금처럼 관심사 **이름**(`'카페/커피'`). 저장할 때 `interestIdsOf(이름들, catalog)` 로 서버 id 를 만든다 (목록에 없으면 던짐 — 조용히 빼면 대표 관심사가 바뀔 수 있어서)
- 응답의 관심사 태그(`InterestTagDto`)는 이름이 같이 오므로 바로 앱 이름으로
- 질문은 앱이 코드로 쓰는 곳이 없어 표가 필요 없다. 질문의 `interestCategoryId` 만 위 표로 대분류 코드로 바꾼다 ("추천" · "관심사" 필터와 꼬리표). 예시 답변(`ex`)은 서버가 주지 않아, 목 데이터에 같은 질문이 있으면 그 예시, 없으면 공통 안내
- 표에 없는 이름(서버에만 새로 생긴 관심사)은 칩으로 보이고 고를 수도 있지만 가구 · 무드가 없다. `catalog.unmapped` 에 남는다
- 시험 `src/tests/interest-map.test.ts`: 명세 00 공통 5 표를 직접 읽어 **대분류 12 · 세부 90 이 모두 같은 대분류의 앱 코드로 이어짐**, 앱에만 있는 관심사도 없음 (지금 못 이은 것 0개)
- 목 서버는 ~~앱 코드를 `toDtoId` 로 목 번호로~~ → 2026-11-23 부터 **백엔드 처음 값과 같은 번호**(대분류 1 ~ 12 · 세부 1 ~ 90, 00 공통 5 표 순서, `api/mock/seedIds.ts`)를 준다. 앱은 여전히 이름으로 잇는다. 질문은 앱이 질문 id(`food-1`)를 저장해 쓰므로 목 번호 그대로이고, 순서만 처음 값처럼 관심사 질문(대분류 순) → TMI

**두더지 아이템 코드** (`app/src/api/onboarding/moleCodes.ts`): 명세 코드는 영어 대문자 · 숫자 · 밑줄 30자 이하(`CAP_RED`), 앱 아이템 id 는 소문자(`hat_beret`, glb 노드 이름) → **보낼 때 대문자, 받을 때 소문자로 바꿔 앱 아이템을 찾고**, 모르는 코드 · 부위가 틀린 코드는 "없음"으로 그린다 (명세).

## 애매해서 정한 것

| 곳 | 정한 것 |
|---|---|
| 온보딩 확정에서 `NICKNAME_DUPLICATED` (명세 03: 어디서 다시 받을지 화면이 정함) | 온보딩 1 로 돌아가 칸 밑에 문구, 다른 값은 그대로. 고친 뒤 "다음"(다시 확인)은 바로 미리보기로 |
| 확정에서 `INTEREST_NOT_FOUND` · `INTRO_QUESTION_NOT_FOUND` | 토스트 + 온보딩 2 · 3 으로 |
| 관심사 재선택 뒤 경로 (명세 03 "서로 맞지 않아 보이는 곳", open-issues 44) | 예전대로: 다시 고른 뒤 "다음"은 3a → 4 (자기소개는 그대로 둠). 뺀 관심사의 질문 · 답변도 그대로 (서버도 검사하지 않음) |
| 진행 단계 표시에서 3a (명세 03) | 예전대로 4번째 "땅굴 만들기" |
| 내 정보 수정의 닉네임 확인 때 | 바꾼 뒤 0.45초 멈추면 확인. 확인 중 · 겹침이면 저장 버튼을 막음. 저장 응답의 409 도 같은 칸 밑 문구 |
| 내 정보 저장 응답 뒤 | 응답(바뀐 내 땅굴)을 캐시에 넣고, 캠퍼스-층이 바뀌었으면 "입구가 옮겨졌어요" 토스트 |
| 방명록 지운 뒤 | 명세대로 목록 · 글 수를 다시 받음. 마지막 페이지가 비면 한 페이지 앞으로 |
| 방명록 신고 뒤 | 한 사람의 신고로는 그대로 보임 (3명이면 서버가 가림). 신고 완료 토스트 |
| 목에서 땅굴 id | 땅굴 id(앱) = 주인의 사용자 id (`toDtoId('me')`). 예전 초안의 `'b-<주인>'` 도 받아 줌 (`data/guestbookStore.ts` `ownerOfBurrow`) |
| 목에서 닉네임 "맡아 두기" | 흉내 내지 않음: 목 사용자 닉네임과 겹치면 409. 확정의 "이미 마친 계정이면 200" 도 흉내 내지 않음(시연에서 온보딩을 여러 번 하므로) |
| 꾸미기 모드에 탭이 하나뿐 | 명세 문구 그대로 "두더지" 탭 하나를 둠 |
| 자기소개 글자 수(내 정보 카드) | 예전대로 "n / 150" 을 보여 줌 |

## 백엔드 · 팀에 물을 것

1. **관심사 · 대분류에 바뀌지 않는 `code` 칼럼**(예: `cafe_coffee`)을 두고 `GET /interest-categories` · 관심사 태그에 실어 줄 수 있는지. 지금은 이름으로 잇고 있어 이름을 다듬으면(띄어쓰기 · 오타) 가구가 사라진다. 코드 표는 [interest-enum.md](../interest-enum.md) 에 이미 있다. 주면 `interestMap.ts` 의 이름 표 대신 code 로 바로 찾는다
2. **두더지 코드 대소문자**: 명세 코드는 대문자(`CAP_RED`), 앱 아이템 id 는 소문자(`hat_beret`). 프론트는 대문자로 보내고 받을 때 소문자로 찾는다. 이대로 괜찮은지 (서버는 모양만 검사하니 문제는 없음)
3. ~~**관심사 · 질문의 순서**~~: 닫음 (명세 dev 9ea6698, KAN-43: 순서 칼럼 없이 id 순, 처음 값을 00 공통 5 표 순서대로 넣어 id 순 = 표 순서)
4. **질문의 예시 답변**: 온보딩 3 입력칸에 예시 답변("예) 얼음 넣은 홍차에 꿀 한 스푼이요.")을 보여 주는데 `intro_question` 에 그런 칼럼이 없다. 필요하면 `example` 칼럼, 아니면 공통 안내로 둠
5. **`GET /me/burrow` 의 `owner` 와 `GET /me`**: 온보딩 4 의 소속은 `GET /me` 로 그린다. 온보딩 중 계정도 `GET /me` 가 `campusName` · `generation` · `floor` 를 주는지 (SSAFY 인증 때 저장한 값)
6. 서로 맞지 않아 보이는 곳 (명세 04): 내 땅굴 5 는 내 정보 수정에서 두더지도 바꾼다고 하지만 화면 · API 모두 두더지는 꾸미기 모드에서 → **꾸미기 모드에서만** 바꾸게 함. 방문자가 자기 방명록 글을 지울 때의 확인 문구가 없음 (05 방문자 뷰 쪽)

## 이 영역 밖에 부탁할 것 (공통 · 다른 영역)

- **공통(`common/mockPeople.ts` `moleDto`, `common/mappers.ts` `wornOf`)**: 두더지 코드를 소문자 그대로 다룬다. 명세 모양(대문자)으로 바꾸려면 `api/onboarding/moleCodes.ts` 의 `moleDto` · `wornOfMole` 을 쓰면 된다 (이 영역은 이미 씀. 실제 서버에서 대문자 코드가 오면 공통 `wornOf` 를 거치는 다른 영역 화면은 두더지 아이템을 못 그림)
- **탐색 · 방문(`api/explore`, `VisitBurrow.tsx`)**: 방문자 뷰의 방명록 목록 · 삭제는 명세상 이 영역 API 다 → `useGuestbookEntries(burrowId, page)` · `useDeleteGuestbookEntry(burrowId)`(`api/burrow`)를 쓰고, 목의 방명록 쓰기(`POST /burrows/{burrowId}/guestbook-entries`)는 `data/guestbookStore.ts` 의 `guestbookOf(주인).unshift(…)` 로 넣으면 주인 쪽에도 보인다. 쓰기 뒤 `burrowKeys.guestbook(burrowId)` 를 새로 받을 것. `GuestbookModal` 은 `server` 를 주면 서버 페이지로 동작한다(안 주면 예전처럼). 목의 땅굴 id 는 주인 사용자 id 로 맞추면 된다. 탐색의 미니맵(`Minimap.tsx`)에도 "접속 중" 표시 · 필터가 남아 있다
- **화면 목록(`screens/ScreenIndex.tsx`)**: `/burrow?guestbook=0` 데모 쿼리는 없어졌다 → `/burrow?modal=guestbook&api=empty` 로 바꾸면 빈 방명록이 보인다
- **커뮤니티(`api/community`)**: 신고 본문(`reportBody`)을 명세 모양(`targetId` 숫자, `reason` `OBSCENE`)으로 바꾸면 `api/burrow/report.ts` 두 줄만 맞추면 된다
- **vitest 설정**: `include` 가 `*.test.ts` 뿐이라 화면 시험(`my-info-edit.test.ts`)을 JSX 없이 `createElement` 로 썼다. `*.test.tsx` 도 읽게 하면 편하다
- **인증(`api/auth` 목)**: 온보딩 확정 뒤 목 세션의 `nextStep` 을 `HOME` 으로 바꾸는 손잡이가 없다 (지금은 `LOGIN_FREE` 라 문제없음)

## 고친 파일

- 영역: `app/src/api/onboarding/*` (새 파일 `interestMap.ts` · `moleCodes.ts` · `mockRules.ts`), `app/src/api/burrow/*` (새 파일 `report.ts`)
- 화면 · 부품: `screens/onboarding/Onboarding.tsx` · `QuestionList.tsx`, `screens/burrow/MyBurrow.tsx` · `MyInfoEdit.tsx` · `DecorPanel.tsx` · `GuestbookModal.tsx` · `InterestPickPage.tsx` · `RoomNote.tsx`, `components/ProfilePopup.tsx`, `screens/start/Landing.tsx`(문구만)
- 데이터: `data/questions.ts`(질문 목록을 인자로 받게), 새 `data/guestbookStore.ts`(방명록 목 저장소)
- 시험: `src/tests/interest-map.test.ts`, `onboarding-burrow-api.test.ts`, `my-info-edit.test.ts`
- 공통 파일 · `App.tsx` 는 고치지 않음

## 명세 dev 9ea6698 반영 (2026-11-23)

| 명세 | 프론트 |
|---|---|
| db · api 00: 대분류 12 · 세부 90 의 처음 값 id = 00 공통 5 표 순서(1 ~ 12, 1 ~ 90), 자기소개 질문 초안 40개(관심사 질문 대분류마다 2개 = 24 + TMI 16) | 목 `GET /interest-categories` · 관심사 태그(`mockPeople.interestTags`) · 커뮤니티 대분류 id 가 같은 번호(`api/mock/seedIds.ts`). 질문은 순서만 맞춤(목 질문은 37개 그대로, 초안 40개의 문구는 사본에 없음 — 팀 리포 `work/KAN-43.md`) |
| 00 공통 5 · 04: 가구는 세부 관심사마다 하나로 정해져 있고 사용자가 고르지 않음, "/"로 묶인 관심사도 하나 | **꾸미기 가구 탭을 다시 뺐다**(2026-11-22 PR #29/#30 으로 들어왔던 것, 사용자 결정 2026-11-23). 꾸미기 = 두더지 탭만, 방은 늘 맨 앞 단어. 목 전용 가구 단어 저장 삭제 → [feature-changes](feature-changes.md#명세-dev-9ea6698-반영-2026-11-23) |
| 03 · 04: 두더지 아이템은 부위마다 하나, 최대 4개, 관심사 전용 아이템 없음 | 이미 그대로 (`data/moleItems` `MAX_WORN = 4`, 관심사 연결 없음) |
| 01 랜딩: 방 → 이웃 두 구간, 로딩 애니메이션 뒤 한 번에 페이드 인, 라벨 0.08초 간격, 가구 라벨 6개 · 제목 · 부제 | 이미 그대로 (`screens/start/Landing.tsx`, 로딩 문구 "땅굴 파는 중..."). 주석만 고침 |
| 04 꾸미기 안내 말풍선 | 가구 탭을 빼며 문구를 "내 두더지를 꾸밀 수 있어요. 가구는 고른 관심사로 정해져요!"로 되돌림 (명세에 문구 없음) |

## 확인한 것

- `npx tsc -b --noEmit` · `npm test`(36 파일, 461 통과 · todo 97: 이 영역 PENDING 10개가 빠짐) · `npm run build` 통과
- 새 시험 25개: 관심사 표 잇기 7, 목 서버 규칙 · 매퍼 · 두더지 코드 16, 화면(내 정보 수정 닉네임 겹침 → 저장 → 응답, 프로필 팝업 겹침 표시 · 차단 없음) 2
- 개발 서버(5412) 스모크: `/onboarding`(7화면) · `/burrow`(17화면, 탐색 · 방문 포함) · `/start` — 예외 · 콘솔 에러 0. 경고는 모두 Pretendard 글꼴 403 (이 작업 트리의 `node_modules` 를 본 저장소에 링크해서 Vite `fs.allow` 밖이라 생긴 것, 코드 문제 아님). 스크린샷으로 내 땅굴 3D 방 · 꾸미기(두더지 탭) · 내 정보 수정 · 방명록 모달(14개, 3페이지) · 온보딩 2 · 3 · 4 미리보기(3D 방) 확인
- 시험 하나(`field-fence.test.ts`)가 전체 실행 때 한 번 실패하고 다시 돌리면 통과 (탐색 영역, 시간 때문으로 보임)
