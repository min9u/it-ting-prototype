# 관심사 소품 v3.8 적용 계획 (2026-11-21)

- 요청: 핸드오프 `design/digul_3d_handoff_interest_v3_8/`를 앱에 넣는 단계별 계획. 브랜치 `feat/room-interest-v3-8`(`design/3d-handoffs-2026-11`(PR #6)에서 땀, 아직 push 안 함)
- 이 문서는 **계획만**이다. 앱 코드 · 캡처 · 스모크 · 빌드는 아직 안 했다
- 먼저 볼 것: [interest-words-v3-8-compare.md](interest-words-v3-8-compare.md)(이름 대조: 이름은 다 같고 대분류 id 5개만 다름), 핸드오프 `docs/HANDOFF_v3_8.md` · `PLACEMENT_v3_8.md`
- 적용 순서(세 핸드오프): **관심사 v3.8(이 문서) → 액세서리 v1.2 → 채팅방 v1**. 이 문서가 끝나야 나머지 둘이 `room_base_v3` 기준으로 맞출 수 있다
- 표시: **"#3 머지 후"** = PR #3(`try/explore-v3-11`)이 같은 파일을 고쳐서 #3이 main 에 들어간 뒤에 건드릴 것. #3 이 건드리는 관련 파일: `components/RoomView.tsx`, `screens/burrow/{MyBurrow,VisitBurrow,ExploreBurrow}.tsx`, `tests/data-json.test.ts`, `data/{field,mock,types}.ts`. 나머지 파일은 #3 · F2 · F4 와 안 겹침

## 달라지는 것 한눈에
| | 지금(main) | v3.8 |
|---|---|---|
| 가구 구조 | 대분류마다 가구 세트(11종, 대분류 가구 + 선반 소품 하나) | **소분류를 "/"로 쪼갠 단어마다 모델 1개(164개)**, 대분류 전용 자리 없음 |
| 자리 | 대분류 전용 슬롯 + 선반 + 동물 | **공용 자리**: 바닥 20 + 벽 4(`shared_big`), 선반 12, 동물 5 + 용품 5, 우체통(`fixed`) → `slots_v3_8.json` 49개 |
| 모델 파일 | `assets/models/room/interest_*_v1*.glb` 11개(5.3MB) | `interest_<id>_v3_8_draco_webp.glb` 12개(7.9MB, 반려동물·식물이 1.4MB로 가장 큼) |
| 기본 가구 | `room_base_v2`(침대 · 협탁 있음) | `room_base_v3`(침대 · 협탁 뺌, 원탁 정중앙, 방석 양옆) |
| 두더지 기본 자리 | (0, 0) | 원탁 앞 three.js (0, 0, 0.85), 앉는 자리 = 방석 `sit_point_cushion_01/02`(빈백 앉기 없음) |
| 낙하 | 슬롯별 H · S | 공용 자리는 모델 키로 `drop_by_height` 줄을 고름 |

## 1단계. 모델 · 데이터 교체
**바꿀 파일**
- 추가: `app/src/assets/models/room/interest_<jsonId>_v3_8_draco_webp.glb` 12개 + `room_base_v3_draco_webp.glb`(핸드오프에서 복사)
- 삭제: `interest_*_v1*_draco_webp.glb` 11개, `room_base_v2_draco_webp.glb`(2·3단계가 끝난 뒤 지워도 됨. 이 단계에서는 둘 다 두고 새 데이터로 넘어갈 때 지움)
- 교체: `app/src/data/slots.json`(← `slots_v3_8.json` 49개), `app/src/data/furnitureCatalog.json` 관심사 부분(← `interest_words_v3_8.json`. 기본 가구 · 장식 · 선반 · 우체통 행은 유지)
- 새로: `app/src/data/interestWords.ts`(JSON 을 읽어 앱 id 로 바꾸는 얇은 층: `jsonId → appId` 5줄 = `music→music_dance` `self_dev→language_selfdev` `photo→photo_video` `craft→art_craft` `fandom→fandom_collect`, 소분류 이름으로 `TAG_TREE` 와 연결, 단어 `{ word, node, pet, size, name }`)
- 고칠 것: `app/src/data/interest3d.ts`(대분류 → 세트 표 대신 "대분류 → glb 파일 이름"만 남김. `accessories` 필드는 액세서리 v1.2 에서 사라짐 → 여기서는 건드리지 않고 그대로 둠), `app/src/data/roomPlan.ts` 의 타입(`FurnitureRow`, `Slot` 에 `slot_type`, `max_m`, `drop_by_height`, `pet`), `app/src/tests/room-plan.test.ts` · `interest-tags.test.ts` 의 기대값, `app/src/three/roomScene.ts` 의 `MODEL_LAZY` 키(파일 이름만; 로딩 로직은 2·3단계)
- 문서: `docs/3d-handoff-v3-integration.md` 맨 위에 "v3.8 로 대체됨" 한 줄, 이 문서 갱신

**확인 방법**
- `cd app && npx tsc -b --noEmit`, `npm test`(위 두 테스트가 새 데이터로 통과)
- 단위 테스트 추가: ① 단어 164개 `node` 가 12개 glb 의 루트 노드 이름과 빠짐 · 남음 없이 일치(핸드오프 `HANDOFF_v3_8.md` 3번 방식을 vitest 로: glb JSON 청크의 `nodes[].name` 읽기) ② 소분류 90개가 `TAG_TREE` 와 일치 ③ "/" 소분류 57개의 `words.length > 1`, 한 단어 33개, 예외 2건(`액세서리/기타` 1개, `곤충/파충류/기타` 2개)
- 이 단계 끝에서는 땅굴이 **안 그려져도 됨**(배치 규칙이 2단계). `?lab` 에서 glb 읽히는지만 확인하거나, 안 그려지면 1단계 커밋에서는 방 화면을 예전 규칙으로 두기 위해 새 데이터 쪽 호출을 가드로 막는다

**커밋 단위**
1. `3D 관심사 v3.8: glb 12개 · room_base_v3 · slots · interest_words 추가` (자산 + JSON, 코드 없음)
2. `관심사 단어 데이터 층 interestWords.ts + 대분류 id 표 + 데이터 테스트` (코드 + 테스트)

**주의**: 공유 빌드(`npm run build:share`)는 glb 를 data URL 로 JS 에 넣어 청크가 커진다 → 땅굴 청크가 지금(공유 빌드 약 12MB) + 약 2.6MB. `docs/rendering-overview.md` 의 개선 항목(관심사 glb 분할)이 이 단계에서 더 급해지므로 **대분류 파일을 파일마다 따로 읽도록**(지금도 `import.meta.glob` 라 그대로) 유지.

## 2단계. 배치 규칙 (PLACEMENT_v3_8 2 · 3번)
**바꿀 파일**: `app/src/data/roomPlan.ts`(`planRoom` 새로), `app/src/three/roomScene.ts`(계획 → 노드 복제), `app/src/tests/room-plan.test.ts`

**규칙 그대로**
- 소분류를 고른 순서대로 처리. **첫 단어의 모델**을 놓고, 자리가 없으면 **같은 소분류의 다음 단어**로 넘어감 (단어 선택이 있으면 5단계의 고른 값이 첫 단어)
- `작은` 134 → 선반 `prop_slot_01~12`(빈 칸, 고른 순서)
- `큰`(동물 아님 20) → 바닥 공용 20칸(`furniture_slot_01~03, 05~17, 19, 21, 22, 23`) 중 **회전 없이** `max_m`(w, d, h)에 드는 빈칸 가운데 **바닥 면적 w×d 가 가장 작은 칸**. 크기는 `big_model_sizes.json`(23개)
- `벽` 3 → 벽 공용 `04, 18, 20, 24` 에서 같은 방식
- 동물 짝(`pet` 있는 7단어) → 동물 `pet_slot_01~05` + 용품 `prop_slot_15~19` 의 빈 쌍(반려동물 소분류는 최대 5개라 항상 들어감). 동물 · 용품 위치 관계는 v3.4 와 같음
- 모델은 슬롯 `ry_deg` 그대로(90° 돌려 넣지 않음)
- 같은 단어(노드)는 방에 한 번만. 대분류가 같은 가구를 빌려 쓰던 옛 규칙(`substitute`)은 없어짐

**확인 방법**
- 테스트: ① 소분류 10개를 고르는 모든 조합 → 놓지 못하는 경우 0(핸드오프 4번의 확인을 난수 시드 조합으로 재현. `room-plan.test.ts` 의 `rng` 로 수천 번) ② 같은 칸에 두 모델 없음 ③ `큰` 은 `max_m` 안, ④ `작은` 이 13개째면 선반이 모자라 놓지 않음(최대 12 = 고른 10개로는 안 생김) ⑤ 동물 소분류 5개 + 용품 쌍
- 눈으로: `/lab/rooms`(`RoomsLab`)에서 서로 다른 조합 몇 개를 캡처해 겹침 · 벽 묻힘 점검(핸드오프의 "바닥 20칸 + 벽 3칸 동시 배치 겹침 없음"과 비교)

**커밋 단위**: `planRoom 새 규칙 (작은/큰/벽/동물 짝)` → `roomScene: 새 계획으로 가구 놓기` → `배치 테스트`

**#3 머지 후**: `components/RoomView.tsx` 가 방 화면에 넘기는 값(관심사 목록, 모습)이 바뀌면 그 부분만. 넘기는 값이 안 바뀌면 건드릴 필요 없음 → **가능하면 `RoomView` 인터페이스를 바꾸지 않는다**

## 3단계. 두더지 기본 자리 · 앉는 자리 · 길 찾기
**바꿀 파일**: `app/src/three/roomScene.ts`(기본 위치, 앉는 자리, 우체통 · 발자리), `app/src/three/moleActor.ts`(`Seat` 에서 빈백 · 의자 종류 정리, 걸어오는 시작점), `app/src/three/roomPath.ts`(발자리 모서리 12cm 바깥 점 계산에 새 가구 · 공용 자리 반영, 원탁은 정중앙 큰 장애물), `app/src/three/roomStyle.ts` · `app/src/data/roomStyle.ts`(**침대 · 협탁 칠하기 · 모양 바꾸기**: 두 노드가 `room_base_v3` 에 없으므로 `node(t, 'bed_frame')` 같은 조회에 가드, `PARTS` 에서 bed · nightstand 를 빼거나 빈 상태로 처리, `roomLook` · `CATEGORY_THEMES` 의 이불 · 협탁 색은 무시), `app/src/data/roomLook.ts`(필요 시), `app/src/three/stills.ts`(방 정지 그림은 6단계)

**값(핸드오프 `HANDOFF_v3_8.md` 2번 4항)**
- 두더지 기본 자리 Blender (0, −0.85) = three.js (0, 0, 0.85)
- 앉는 곳: `sit_point_cushion_01`(하늘) · `_02`(노랑) 는 방석 자식 그대로, **둘 다 카메라 쪽(−Y, 회전 0°)**을 봄
- 걸어오는 시작점 = 방석 앞 0.7m: 노랑 (−0.68, −0.65), 하늘 (+0.68, −0.65)(Blender)
- 빈백 앉기 `sit_point_chair_01` 없음 → `seatKind` 의 `beanbag` · `chair` 분기는 코드에서 안 쓰이게(삭제는 3D 채팅방에서 안 쓰는 걸 확인한 뒤)
- 두더지 몸으로 걷기 · 앉기 · 일어나기 전 프레임 거리 검사는 핸드오프가 **안 함**이라고 했음 → 우리가 실제 앱에서 측정(아래)

**확인 방법**
- 길 찾기 재기: `tools/room-path/nav-check.mjs`(11-18 방식. 가구 변에 붙은 시간 가운데 값 · 도착 비율을 내 땅굴 · 남의 땅굴 10쌍씩. 새 공용 자리 가구 기준으로 다시)
- 앉기 · 일어나기: 앱에서 방석을 눌러 앉고 일어나는 장면을 캡처, 원탁 · 방석과의 간격이 핸드오프 확인값(원탁↔방석 4cm, 두더지 기본 자리는 모든 바닥 자리와 10cm 이상)을 지키는지
- 스타일 코드: `/lab/style` 에서 색 테마 9개 · 자동 꾸미기가 침대 없이도 에러 없이 도는지
- 테스트: `tests/` 에 침대 · 협탁을 가정한 기대값이 있으면 고침. `npx tsc -b --noEmit`, `npm test`

**커밋 단위**: `room_base_v3: 두더지 기본 · 앉는 자리 · 걸어오는 시작점` → `roomPath: 공용 자리 발자리 반영` → `roomStyle: 침대·협탁 없는 방 대응`

**#3 머지 후**: 해당 없음(이 단계 파일은 #3 과 안 겹침). 다만 `RoomView.tsx` 가 `roomScene` 옵션을 넘기는 곳이 바뀌면 2단계와 같은 처리

## 4단계. 낙하 연출 (`drop_by_height`)
**바꿀 파일**: `app/src/three/furnitureDrop.ts`, `app/src/three/roomScene.ts`(공용 자리 모델이 들어올 때 줄을 고름), `app/src/data/roomPlan.ts`(`DropSpec` 를 슬롯 키 단계별로), `app/src/tests/room-plan.test.ts`

**규칙(`PLACEMENT_v3_8.md` 5번)**
- 곡선 · 시간 · 먼지는 그대로(`furniture_drop_spec_v3_7.md`). 시작 높이 `H` 와 가로 오프셋 `S` 를 고르는 방법만 바뀜
- 공용 자리는 놓을 **모델 키**(`big_model_sizes.json` 의 `h`, 작은 모델은 그 모델 키) **이상인 첫 `max_h` 줄**의 `mode` · `H` · `S` · `dust` 를 씀. 벽 자리 04 · 18 · 20 · 24 와 선반 · 동물 자리는 `pop`(제자리 등장)이라 v3.7 과 같음
- 낙하 총 시간은 기존 "2초 안에"(`DROP_LEN` · `DROP_SPAN`) 유지

**확인 방법**
- 테스트: `drop_by_height` 줄 선택 함수(키 → 줄) 경계값, 하나도 통과 못 하면 `pop`
- 눈으로: 공용 자리마다 큰 모델 1개씩 떨어뜨려 캡처 몇 장(돔 벽 · 걸이 소품 · 선반과 안 닿는지는 핸드오프가 상자로 확인했으니 우리는 "뚫고 들어가는 프레임이 눈에 띄는지"만)
- 가속 끈 크롬에서 첫 방 진입 긴 작업이 늘지 않았는지(`explore/gpu/cdp-load.mjs`, 11-18 숫자와 비교)

**커밋 단위**: `낙하: drop_by_height 줄 선택` → `낙하 테스트`

**#3 머지 후**: 해당 없음

## 5단계. 꾸미기 소품 탭 (Figma 711:7994 모양)
**전제**: F4 에서 "소품 탭은 보류"로 남겨 둔 것([burrow-f4-figma-2026-11-21.md](burrow-f4-figma-2026-11-21.md)). 지금 `DecorPanel` 의 `furniture` 탭(선반 소품)은 건드리지 않았다. 여기서 **소품 탭**으로 바꾼다(`DecorTab` 에 `'prop'` 를 더하거나 `'furniture'` 를 대체; 사용자 결정은 "소품 · 두더지" 두 탭 + 개발 실험 "색" 탭 유지)

**바꿀 파일**: `app/src/screens/burrow/DecorPanel.tsx`, `app/src/data/myBurrow.ts`(저장값: 소분류마다 고른 단어 `propChoice`, 관심사를 바꾸면 뺀 것은 사라지고 둔 것은 유지하는 기존 규칙(`pruneChoice` 계열) 재사용), `app/src/data/interestWords.ts`(1단계)의 조회 함수, `app/src/screens/burrow/MyBurrow.tsx`(저장 · 방에 반영 연결), `app/src/screens/burrow/Burrow.module.css`·`MyBurrow.module.css`(탭 모양), 테스트 `tests/` 의 `myBurrow` 관련

**규칙(기획)**
- Figma 711:7994: 카테고리 칩 → "○○ 소품 고르기 n개 중 1개" 카드. 고르면 카드에 선택 표시, 다시 누르면 해제, 저장하면 내 땅굴에 유지
- 소분류 칩이 "/"를 가지면 **단어 중 하나 고르기**, 한 단어면 **고정**(고르기 표시 없음). 판별은 JSON `words.length`(비교 문서의 예외 2건이 자동 처리됨)
- **처음 값은 첫 단어**(2단계 규칙과 같음). 고른 단어는 2단계의 "첫 단어" 자리에 들어가 그 모델이 먼저 놓임
- 고른 단어의 모델이 자리가 없으면 같은 소분류의 다른 단어로 넘어감(미리 보기에서 "놓이지 않아요" 안내가 필요한지는 기획 확인)
- 내 관심사가 아닌 카테고리는 흐리게(기존 가구 탭과 같음)

**확인 방법**: 단위 테스트(고른 단어 저장 · 소분류를 빼면 선택이 사라짐 · 첫 단어 기본), 내 정보 수정의 "/" 표(F4 문서 58개)와 칩 개수 비교, 꾸미기 모드 캡처 Figma 와 나란히(`design/figma/`의 시안과 비교), `/lab` 에서 단어를 바꿔 저장 → 방에 그 모델이 놓이는지

**커밋 단위**: `소품 데이터: 소분류별 고른 단어 저장` → `DecorPanel: 소품 탭 (Figma 711:7994)` → `소품 탭 테스트`

**#3 머지 후**: `screens/burrow/MyBurrow.tsx`(저장 · 반영 연결). `DecorPanel.tsx` · `myBurrow.ts` · CSS 는 #3 과 안 겹쳐 먼저 해도 됨(그러면 `MyBurrow.tsx` 연결 커밋만 뒤로)

**기획에 확인받을 것**: 고른 단어가 자리 때문에 안 놓일 때 안내, "그 밖의 것(기타)"을 뺀 2건 표기(비교 문서 "기획에 확인받을 것"), 백엔드에 단어 선택 저장 칸이 없음(`docs/backend/erd-gaps.md` 에 질문으로 추가할 것: 소분류마다 고른 단어를 어디에 저장하는지)

## 6단계. 테스트 · 스틸 다시 찍기
**바꿀 파일**: `app/src/tests/data-json.test.ts`(**#3 머지 후**, #3 이 같은 파일을 고침), `tests/room-plan.test.ts` · `interest-tags.test.ts`(1~2단계에서 이미 고침), `app/src/assets/stills/*`(GPU 로 찍은 정지 그림 6장: 3D 경계 · WebGL 없음 · 랜딩 로딩 — `three/stills.ts` 가 만드는 방식, 새 방 기준으로 다시), `explore/gpu/results/` 의 측정 JSON, 문서(`docs/3d-handoff-v3-integration.md` 의 v3.8 절 · CLAUDE.md "조사·결정 기록" 한 줄 · `docs/next-steps.md`)

**확인 방법**
- `cd app && npx tsc -b --noEmit && npm test && npm run build`
- `npm run smoke`(96 화면 × 가속 켬 · 끔 · 없음, 예외 · 콘솔 에러 · 빈 화면)
- 번들: `npm run bundle-report`(관심사 glb 12개가 첫 화면 JS 예산 360KB 안에 안 들어오는지. lazy 청크로 두므로 첫 화면은 영향 없어야 함)
- 공유 빌드 `npm run build:share` → 시험판 게시(필요할 때만, 사용자 요청 시)
- 가속 끔 측정: 첫 진입 가장 긴 멈춤(`explore/gpu/cdp-load.mjs`) 11-18 숫자(16스레드 약 270ms)와 비교

**커밋 단위**: `스틸 다시 찍기` → `data-json 테스트 갱신 (#3 머지 후)` → `문서 · 결정 기록`

## 순서 · 병합 요약
| 단계 | 파일이 #3 과 겹침? | 시작 조건 |
|---|---|---|
| 1 모델 · 데이터 | 없음 | 바로 |
| 2 배치 규칙 | `RoomView.tsx` 는 인터페이스를 안 바꾸면 없음 | 1단계 뒤 |
| 3 자리 · 길 찾기 | 없음 | 2단계 뒤 |
| 4 낙하 | 없음 | 2단계 뒤(3단계와 병렬 가능) |
| 5 소품 탭 | `MyBurrow.tsx` 연결만 **#3 머지 후** | 2단계 뒤 |
| 6 테스트 · 스틸 | `data-json.test.ts` **#3 머지 후** | 마지막 |

- 브랜치는 `feat/room-interest-v3-8` 하나에서 단계마다 커밋. #3 이 main 에 들어가면 `git merge origin/main` 으로 받고 "#3 머지 후" 항목을 이어서 한다
- 이 브랜치가 아직 push 되지 않았고, `design/3d-handoffs-2026-11`(PR #6, 핸드오프 원본) 위에 있다 → PR #6 이 먼저 머지되면 이 브랜치를 `origin/main` 으로 rebase 해도 됨(핸드오프 폴더 파일은 #6 과 같아 충돌 없음)
