# 땅굴 다양성 2: 벽지 문제 고치기 + 방이 사람마다 달라 보이게 (2026-11-18)

- 날짜: 2026-11-18
- 요청 (그대로): "벽지 문제를 고친다음, 땅굴 다양성을 늘리는 작업을 진행해. 백그라운드에서"
- 앞 작업: [room-diversity-2026-11-18.md](room-diversity-2026-11-18.md) (지금 상태 재기: 벽지를 같게 놓으면 방 넓이의 83%가 26개 방 모두 같음), [burrow-diversity.md](burrow-diversity.md) (11-16 꾸미기 실험)

## 1단계: 벽지 문제 (고침)

### 원인
- 같은 사람의 땅굴이 **내가 볼 때와 남이 볼 때 벽지가 달랐음**. 규칙이 둘이었고, 집주인이 저장한 방도 남에게 전해지지 않았음
  - 내 땅굴(`MyBurrow`): 맨 앞 관심사의 대분류 (`myBurrow.ts moodWallpaper`) + 온보딩 때 계산해서 sessionStorage 에 저장해 둔 벽지
  - 남의 땅굴(`VisitBurrow`): 벽지를 안 넘겨서 `roomScene` 이 **가장 무거운 대분류**(드문 취미 가중치 Σ 1 + 1000/인원, `wallpapers.ts topCategoryOf`)로 다시 계산
  - `BurrowDto.room`(저장한 벽지·가구)은 타입에만 있고 목 서버 · `toBurrow` · `VisitBurrow` 가 안 씀 → 꾸미기에서 고른 가구도 남에게는 기본 가구로 보였음
- 예: "나"(관심사 10개, 맨 앞 캠핑/글램핑)는 내 화면에서 01 기본, 남이 보면 08 줄무늬
- 명세는 대표 관심사 쪽: 00 공통 5 · F3 3a "땅굴 무드 = 대표 관심사(맨 앞)의 대분류", 온보딩 문구 "맨 앞 관심사가 땅굴 분위기를 정해요", spec-design-gaps G-31 "예전 규칙(드문 취미 가중치)은 없어짐". 다르게 정할 근거는 못 찾음

### 고친 것
- **방 모습을 정하는 함수 하나** `app/src/data/roomLook.ts roomLookOf(집주인 id, 관심사, 저장한 방)` → `{ 벽지, 가구 선택, 대표 대분류 }`
  - 저장한 방(서버 `room`, 내 것은 sessionStorage)에 값이 있으면 그 값, 없으면 대표 관심사(맨 앞)의 대분류로 계산
  - 가구 선택은 지금 관심사에 맞는 후보만 남김 (뺀 관심사의 가구, 모르는 id 는 버림 → 기본 가구)
- 이 함수를 쓰는 곳: 내 땅굴 · 남의 땅굴 · 온보딩 3a(땅굴 무드 벽지)·4(미리 보기) · 탐색 시안의 방 미리보기(`explore-designs/parts.tsx`) · 비교 실험실 `/lab/rooms`. 벽지를 안 넘기는 화면(시작 화면 등)은 `roomScene` 이 같은 규칙(`moodWallpaper`)으로
- 저장한 방 전달: 목 서버 `GET /burrows/{id}` 가 `room` 을 채움(나는 꾸민 값, 다른 목 주민은 꾸민 적 없어 `null`) → `api/mappers.ts toBurrow` 가 `BurrowVM.room` 으로(`member_interest.furniture` 도 읽음) → `VisitBurrow` 가 `roomLookOf` → `RoomView` → `roomScene`
- 계산 값은 저장하지 않음: 예전엔 온보딩·관심사 수정 때 계산한 벽지를 `digul.myWallpaper` 에 저장했는데, 이제 **직접 고른 것만** `digul.myRoom.v1`(`myBurrow.ts getMyRoomPick`)에. 관심사를 바꾸면 계산 값이 따라감
- 예전 가중치 규칙(`topCategoryOf` · `wallpaperForPicks`)과 계산 벽지 저장(`getMyWallpaper` · `setMyWallpaper`)은 지움
- `/lab/rooms?user=…` 는 방문자 뷰와 같은 길(땅굴 API → `toBurrow` → `roomLookOf`)로 바꿈 → `?user=me` = 남이 보는 내 땅굴
- 백엔드에 넘길 것: `docs/backend/api-draft.md` 2.3 "땅굴 응답의 `room`" (모양 · 규칙 · 없을 때)

### 확인
- 시험 `app/src/tests/room-look.test.ts` (새로 12개. 전체 247 통과 + 할 일 2): 맨 앞 관심사 규칙 · 내 땅굴과 방문자 뷰(목 서버 → `toBurrow` → `roomLookOf`)가 같은 값(꾸민 게 없을 때 · 가구와 벽지를 고른 뒤 · 관심사를 바꾼 뒤) · 다른 사람이 저장한 방이 방문자 뷰에 그대로 · 모르는 벽지 id · 후보가 아닌 가구 버림 · `member_interest.furniture`. `room-plan.test.ts` 의 할 일(`it.todo`) 하나를 실제 시험으로
- 찍어서 확인 (`node tools/room-diversity/capture.mjs --me`, `--me=decor`): "나"를 내 땅굴 `/burrow` 와 남이 보는 내 땅굴 `/lab/rooms?user=me` 로 같은 크기에 찍고(두더지 숨김, 캔버스만, 내 땅굴 입장 연출은 "움직임 줄이기"로 끔, 우체통은 읽음으로 맞춤) `check.py` 로 비교 → **다른 픽셀 0.00%** (꾸민 게 없을 때 · 가구 하나와 벽지 07 을 고른 뒤 둘 다). 둘 다 `window.__roomLook` 이 같음
- (처음엔 우체통 깃발만 0.74% 달랐음: 내 땅굴은 "새 방명록"이면 깃발이 올라감. 방 모습과 상관없는 상태라 읽음으로 맞춤)

![](screenshots/room-diversity-2/me-same.jpg)

## 2단계: 땅굴 다양성 늘리기
(진행 중)
