# 3D 핸드오프 v3 앱 반영 (2026-11-11)

## 요청
디자이너가 보낸 `digul_3d_handoff_v3_20261111.zip`(관심사 v2 구조 첫 전달, M1)을 앱에 반영한다.
원본은 `design/digul_3d_handoff_v3/`에 풀었다 (docs·models는 커밋, images는 gitignore. v1·v2와 같은 방식).
기준 문서: `docs/HANDOFF_v3.md`, `docs/CHANGELOG_v3.md` (그 폴더 안)

## 결론
- 땅굴 방이 **고른 관심사로 슬롯에 가구·소품을 놓는 방식**으로 바뀜. 모델이 있는 4개 카테고리(사진·책·영화·공예)는 진짜 모델, 나머지 7개는 카테고리 색 둥근 블록
- 온보딩 관심사가 **카테고리 11 · 세부 관심사 65 · 최대 10개**로 바뀜 (화면 배치는 그대로)
- Draco 압축 glb를 씀. 일반 빌드는 wasm 해독기, 공유 빌드(아티팩트)는 JS 해독기를 번들에 넣어 메인 스레드에서 풂
- 디자이너가 다음 전달(M2~M4)에서 `furnitureCatalog.json`의 `glb`를 채워 보내면, 그 glb를 `app/src/assets/models/room/`에 넣고 JSON만 바꾸면 블록이 모델로 바뀜 (코드 변경 없음)

## 1. 땅굴 방
| 반영한 것 | 파일 |
|---|---|
| 카탈로그 3개를 데이터로 복사 (이름·순서·슬롯을 코드에 적지 않음) | `app/src/data/interestCatalog.json`, `furnitureCatalog.json`(새 112줄로 교체), `slots.json` |
| 배치 계산 (three.js 없이): 카테고리 가구는 슬롯 고정, 선반 소품은 주 가구 슬롯에서 가까운 빈 칸, 기타·동물 용품은 고정 슬롯, 동물 용품을 고르면 짝 동물도. 낙하 시간표(카테고리 순, 부피 큰 것부터 0.12초, 세트 사이 1초) | `app/src/data/roomPlan.ts` |
| 기본 가구 `room_base_v2`, 장식 `room_deco_v1`, 벽 선반 `room_shelves_v1` (모두 Draco+WebP, 방 원점 그대로). 옛 `room_base.glb`·`room_deco.glb` 삭제 | `app/src/assets/models/room/*.glb`, `three/roomScene.ts` |
| 관심사 glb 4개(`interest_photo/book/movie/craft_v1_draco_webp.glb`): 필요한 것만 받아 노드 복제, 슬롯 위치·방향, 크기 1. 접촉 그림자 `shadow_*`는 depthWrite 끔 | 〃 |
| 모델 파일 찾기: `assets/models/room/` 안에서 카탈로그 `glb_compressed` 이름으로 (import.meta.glob) | 〃 |
| `glb: null` → 둥근 블록 (`RoundedBoxGeometry`, 동물은 알 모양), 카테고리 색(HANDOFF 3번 팔레트), roughness 0.8, 바닥 가운데 원점 | `roomScene.ts` `makeBlock`, `roomPlan.ts` `BLOCK_COLORS` |
| 가구 낙하 "또로로록" + `pop`(선반 소품·벽걸이) + 착지 먼지 `dust_puff_v1.glb`(투명도는 코드). 값은 `slots.json`의 `drop`. 모델과 블록 똑같이 | `three/furnitureDrop.ts`(spec 코드 그대로), `roomScene.ts` |
| 노란 방석 `sit_point_cushion_02`: 기존 앉기 코드 그대로 동작 (방석 자식 노드의 방향 +90°를 읽어 (−0.25, −0.35)에서 −X로 걸어와 앉음). 관심사 가구 행의 `sit_point`도 같은 방식으로 읽음 (M3 빈백 대비) | `roomScene.ts` |
| 관심사 가구에 마우스를 올리면 이름표 (블록은 "· 3D 모델 준비 중"). 바닥 가구는 누르면 앞까지 걸어감, 벽걸이·선반 소품은 안 걸어감 | `roomScene.ts`, `moleActor.ts` (`FurnitureData.hint`, `noWalk`) |
| 바닥 가구는 두더지가 못 지나가게 발자리(회전한 크기) 등록 | `roomScene.ts` |
| 남의 땅굴 집주인 두더지 자리 (0.95, 0.55) → (0.75, 0.7): 영화 카테고리 프로젝터 슬롯(1.3, 0.2)과 겹쳐서 | `roomScene.ts` |

### Draco 해독기
| | 일반 빌드 (`npm run build`, dev) | 공유 빌드 (`npm run build:share`) |
|---|---|---|
| 방식 | three.js `DRACOLoader` + wasm (워커) | JS 해독기(wasm2js)를 번들에 넣고 메인 스레드에서 해독 (`DRACOLoader`를 상속해 `decodeGeometry`만 바꿈) |
| 파일 | `app/public/draco/` (three 0.165 `examples/jsm/libs/draco/gltf/`에서 복사) | `app/src/three/draco/draco_decoder.js` (같은 파일을 ES 모듈로 복사), `three/dracoMain.ts` |
| 이유 | 표준 방식, 빠름 | 아티팩트가 `.wasm`·별도 파일 fetch·blob 워커를 막을 수 있어서. 공유 빌드에서는 `public/`을 복사하지 않음 |
- glb 안 `extensionsUsed`에 Draco가 있을 때만 해독기를 준비 (`three/glb.ts`). 두더지·껍데기·구멍·먼지는 Draco 아님
- 확인: 공유 빌드를 로컬에서 **wasm·워커를 막는 CSP**(`worker-src 'none'`, `wasm-unsafe-eval` 없음)로 띄워 땅굴이 그대로 나오는 것을 봄 (`shots/handoff-v3/share-burrow.png`)
- three를 올리면 `public/draco/`와 `three/draco/draco_decoder.js`도 같은 버전으로 다시 복사할 것

## 2. 온보딩·목 데이터
| 반영한 것 | 파일 |
|---|---|
| 관심사 목록 = `interest_catalog.json` (카테고리 11, 세부 65, `max_pick` 10). A안(왼쪽 분류 목록) 화면은 그대로 | `data/interests.ts`, `data/mock.ts` `CATEGORIES`, `screens/onboarding/Onboarding.tsx` |
| 화면에 보이는 관심사는 세부 관심사 이름(`name_ko`). 방 만들기·잠금은 id로 바꿔서 씀 (`toSubIds`) | `data/interests.ts` |
| 숫자(같은 관심사를 고른 두더지 수)는 카탈로그에 없어 목 값 65개를 둠 → 무드 가중치 Σ(1 + 1000/인원)도 그대로 | `mock.ts` `TAG_COUNTS` |
| "땅굴 만들기" 목록: 카테고리 가구 묶음 한 줄 + 고른 관심사 소품 한 줄씩. 이름은 카탈로그에서, 모델이 없으면 "모델 준비 중". 답변에 관심사·물건 이름 조각이 있으면 "내 답변" | `Onboarding.tsx` `buildPlan` |
| 무드 표의 옛 키 `space`·`cafe` → `science`·`tea_coffee` | 〃 `MOODS` |
| 미리보기 배지: "관심사 가구 N개 · M개는 3D 모델 준비 중(블록)" | 〃 |
| 내 관심사를 화면끼리 나눔: 온보딩 "관심사 확정"·내 정보 수정 저장 → `/burrow` 방이 그 관심사로 (탭 안 sessionStorage, 없으면 목 데이터) | `interests.ts` `getMyInterests`/`setMyInterests`, `MyBurrow.tsx` |
| 목 사용자 관심사를 새 이름으로 (예: 나 = 캠핑·레트로게임·SF소설·시티팝·피아노·수채화·필름카메라·고전영화·핸드드립·자전거) | `mock.ts` |
| 게시판·모임 주제(독서·그림·요리·러닝·지브리 등 예전 말)는 그대로 두고 카테고리로 연결 → 색·이모지 유지. 모임 "내 관심사" 필터는 카테고리가 같으면 보임 | `mock.ts` `categoryOf`, `MeetupList.tsx`, `MeetupCard.tsx`, `Board.tsx` |
| 관심사 전용 액세서리: 카탈로그 카테고리의 `accessories` 목록으로 (glb 안 옛 `userData.interest`는 안 씀). 배지는 카테고리 이름 | `data/moleItems.ts` |
| 랜딩·둘러보기 방 관심사도 새 이름으로 | `screens/start/Landing.tsx`, `LookAround.tsx` |

## 판단한 것 (확인 필요)
1. **관심사 전용 액세서리 13개**: 카탈로그 `accessories`에는 `accessories.md` 표에 없는 `hat_beret`(공예), `hat_straw`(운동·아웃도어)가 있고 `prop_cup`(차·커피)도 들어 있음. 지시대로 카탈로그를 따랐더니 베레모·밀짚모자·커피잔이 기본 → 관심사 전용이 됨 (기본 11 → 8개). 온보딩 1단계는 관심사를 고르기 전이라 지금처럼 다 열려 있음
2. **가구 낙하는 들어올 때마다**: 두더지가 천장에서 떨어지는 연출을 할 때(모션 줄이기가 아닐 때) 2.4초부터 시작. 내 땅굴·남의 땅굴·온보딩 미리보기 모두. 10개를 고르면 카테고리 세트가 많아 끝까지 15초 넘게 걸림 (spec 간격 그대로)
3. **블록 크기**: 몇몇 선반 소품 행(`backpack`, `globe`, `small_pot`, `yoga_mat`)은 `size_m`이 선반 칸 `max_m`(0.3×0.28×0.35)보다 커서 슬롯 최대 크기로 잘라서 만듦
4. **선반 칸이 모자랄 때**: 기타를 안 고르고 선반 관심사 10개면 12칸으로 충분 (spec). 혹시 모자라면 그 소품은 빼고 놓음
5. **우주·과학, 반려동물 전용 액세서리**: 카탈로그대로 없음
6. **온보딩 미리보기에서 첫 줄 근거**: 카테고리 가구 줄은 그 카테고리에서 처음 고른 관심사가 아니라 카테고리 이름(#공예·만들기)을 보여 줌

## 번들 크기 (vite build)
| | 전 (f42e771) | 후 |
|---|---|---|
| 첫 화면 `index.js` | 605KB (gzip 230KB) | 680KB (gzip 246KB) — 카탈로그 JSON 3개가 온보딩·목 데이터와 같이 들어감 |
| 방 glb 합계 (기본·장식·선반·관심사 4) | 0.92MB (base+deco) | 1.75MB (Draco). 관심사 glb는 고른 카테고리 것만 받음 |
| 공유 빌드 큰 파일 | | `RoomCanvas.js` 3.3MB(방 glb data URL), `engine.js` 3.3MB(두더지·액세서리), `dracoMain.js` 0.46MB(JS 해독기, gzip 109KB). 모두 16MB 안 |

## 확인
- `npx --no-install tsc -b`, `npm run build`, `npm run build:share` 통과
- 헤드리스 Chrome (Mac, `vite preview`, 모션 줄이기), 스크린샷은 `shots/handoff-v3/` (gitignore):
  - `picks3.png`(재즈·레트로게임·SF소설) ↔ 디자이너 `layout_3.png`: 같은 슬롯·선반 칸 (아케이드·책장·피아노 자리, 선반 3에 두 개, 선반 2에 하나)
  - `picks6.png`(사진·책·영화·공예, 전부 진짜 모델) ↔ `bundle1/2_layout.png`
  - `picks10.png`(10개 카테고리, 기타·고양이 포함) ↔ `layout_10.png`
  - `burrow-default.png`(목 데이터 10개), `burrow-drop-a/b.png`(낙하 중), `sit-cushion2.png`(노란 방석에 앉음), `visit-yerin.png`, `burrow-decor.png`(관심사 잠금)
  - `ob-interests.png`, `ob-building.png`, `ob-preview.png`, `ob-name.png`
  - `share-burrow.png`: 공유 빌드 + wasm·워커를 막는 CSP
- 콘솔 오류 없음
- 실제 브라우저로 볼 것: 낙하 리듬·먼지 느낌, 노란 방석 걸어와 앉기 동작 전체

## 다음 단계
- **M2** 운동·아웃도어, 자연·식물 / **M3** 차·커피·베이킹, 음악, 게임·놀이, 우주·과학 / **M4** 반려동물 (날짜 미정): glb를 `app/src/assets/models/room/`에 넣고 `furnitureCatalog.json`(+ 바뀌면 `slots.json`의 `drop`)을 새 것으로 교체. 코드 변경 없음
  - M3 빈백 `sit_point_chair_01`: 관심사 가구 행의 `sit_point`도 읽게 해 둠 → 빈백 노드 안에 그 이름의 노드(extras `seat_type: beanbag`)가 오면 코드 변경 없이 앉기 (실제 파일로는 아직 확인 못 함)
  - M3 조리대의 냄비(`deco_attached`)는 조리대 노드의 자식이라 같이 복제됨 (따로 할 일 없음)
- **CC-BY 표기 (M3)**: 기타(jeremy), 오락기·빈백(J-Toastie)이 들어오면 앱 크레딧 화면(설정 등)에 `design/digul_3d_handoff_v3/docs/credits.md` "필수 작가 표기" 문구를 넣을 것. 이번 전달은 모두 CC0
- 첫 화면 번들: 카탈로그 JSON에서 화면에 필요한 필드만 남기거나 온보딩을 지연 로딩하면 줄일 수 있음

## v3.1 패치 반영 (2026-11-12)
- 원본: `design/digul_3d_handoff_v3_1/` (`digul_3d_handoff_v3_1_20261111.zip`, v3 위에 얹는 패치. 기준 문서 `docs/HANDOFF_v3_1.md`)
- 모델: `interest_movie_v1_1`, `interest_photo_v1_1`, `room_shelves_v1_1`로 교체(v1 삭제), 새로 `interest_outdoor_v1`(운동·아웃도어), `interest_nature_v1`(자연·식물). 모두 `_draco_webp` → `app/src/assets/models/room/`
- 데이터: `slots.json`, `furnitureCatalog.json` 새 것으로 교체 (TV·사진 판·선반·선반 칸 12개가 벽에 닿게, 이끼 벤치·자전거 슬롯 이동, 모델 있는 줄 40 → 55). `interestCatalog.json`은 내용 같음
- **코드 변경 없음**: 로딩이 카탈로그 `glb_compressed` 이름과 `slots.json` 좌표를 따라가서 파일·JSON만 바꿈. 자전거 벽걸이(원점 = 벽에 닿는 점)도 슬롯에 그대로 놓으면 맞음
- 확인: `tsc -b`, `build`, `build:share` 통과. 헤드리스 Edge로 목 데이터 내 땅굴(캠핑·자전거 포함) 확인 → 자전거가 뒤쪽 벽에 걸리고 선반이 벽에 붙음 (스크린샷은 남기지 않음). 자연·식물 카테고리는 화면으로 따로 확인 못 함
- 배포: 팀 아티팩트 version 12
- 남은 것: M3(차·커피·베이킹, 음악, 게임·놀이, 우주·과학), M4(반려동물)는 블록 그대로
