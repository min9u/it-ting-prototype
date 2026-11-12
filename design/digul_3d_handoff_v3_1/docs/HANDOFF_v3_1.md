# 디굴디굴 3D 전달 v3.1 (패치) — 2026-11-11

zip `digul_3d_handoff_v3_1_20261111.zip` 기준 경로. **v3(`digul_3d_handoff_v3_20261111.zip`) 위에 얹는 패치**라서, 여기 없는 파일은 v3 그대로 유효. 문서 안 `exports/…`는 `models/…`로 읽기 (원작업 폴더 기준 경로라서). 좌표는 three.js 기준 `(x, y, z)` = Blender `(x, z, −y)`, 회전은 `rotation.y = ry_deg`(라디안 변환).

## v3에서 바뀐 파일 교체 목록

| 구분 | v3에 있던 파일 | v3.1에서는 | 처리 |
|---|---|---|---|
| 모델 (새로 추가) | (없음) | `models/interest_outdoor_v1.glb`, `models/interest_outdoor_v1_draco_webp.glb` | **추가**. 운동·아웃도어 가구 2 + 소품 5 |
| 모델 (새로 추가) | (없음) | `models/interest_nature_v1.glb`, `models/interest_nature_v1_draco_webp.glb` | **추가**. 자연·식물 가구 2 + 소품 6 |
| 모델 (교체) | `models/interest_movie_v1.glb`, `models/interest_movie_v1_draco_webp.glb` | `models/interest_movie_v1_1.glb`, `models/interest_movie_v1_1_draco_webp.glb` | **교체** (v1 삭제). 노드·모양은 v1과 같고, 카탈로그가 가리키는 이름만 바뀜. TV 위치는 `slots.json`에서 바뀜 |
| 모델 (교체) | `models/interest_photo_v1.glb`, `models/interest_photo_v1_draco_webp.glb` | `models/interest_photo_v1_1.glb`, `models/interest_photo_v1_1_draco_webp.glb` | **교체** (v1 삭제). 노드·모양은 v1과 같음. 사진 판 위치는 `slots.json`에서 바뀜 |
| 모델 (교체) | `models/room_shelves_v1.glb`, `models/room_shelves_v1_draco_webp.glb` | `models/room_shelves_v1_1.glb`, `models/room_shelves_v1_1_draco_webp.glb` | **교체** (v1 삭제). **선반 위치가 바뀜** (벽에 닿도록). 노드에 방 좌표가 들어 있어서 방 원점에 그대로 얹기 |
| 문서 (교체) | `docs/slots.json` | 같은 이름 | **교체**. 슬롯 04, 07, 18, 20과 선반 칸 `prop_slot_01~12`의 위치가 바뀜 (아래 2번) |
| 문서 (교체) | `docs/furniture_catalog.json` | 같은 이름 | **교체**. 모델 있는 줄이 40 → 55개, `glb` 이름이 `_v1_1`로 바뀐 줄 13개 |
| 문서 (교체) | `docs/furniture_drop_spec.md` | 같은 이름 | **교체**. 슬롯 04·18·20·선반 소품 행 갱신 |
| 문서 (교체) | `docs/credits.md` | 같은 이름 | **교체**. `small_pot`은 직접 제작 (Poly Pizza 출처 줄 삭제) |
| 문서 (교체) | `docs/interest_glb_v1.md` | 같은 이름 | **교체**. 3묶음과 v3.1 절 추가 |
| 문서 (그대로) | `docs/interest_catalog.json` | 같은 이름 | 내용 변경 없음. 한 벌로 맞추려고 같이 넣음 |
| 문서 (새로) | (없음) | `docs/HANDOFF_v3_1.md`, `docs/CHANGELOG_v3_1.md` | 이 문서와 변경 목록 |

바뀌지 않은 것 (v3 그대로): `room_base_v2`, `room_deco_v1`, `interest_book_v1`, `interest_craft_v1`, `dust_puff_v1` (각 `_draco_webp` 포함), 두더지·액세서리 glb, `docs/HANDOFF_v3.md`, `sit_points.md`, `accessories.md`.

## 1. 먼저 할 일

1. 위 표대로 파일을 **교체·추가**. 웹에는 `*_draco_webp.glb` 사용
2. 로딩 코드는 **카탈로그의 `glb` / `glb_compressed` 이름을 따라가기** (파일 이름을 코드에 적지 않기). 이름이 바뀐 줄은 `interest_movie_v1_1`, `interest_photo_v1_1`, `room_shelves_v1_1`
3. 배치는 **반드시 새 `slots.json`**의 `pos_three` / `ry_deg`로 (v3 좌표로 그대로 두면 TV·사진 판이 벽 밖/벽에서 떠 있음)
4. 운동·아웃도어, 자연·식물이 새로 **블록이 아니라 진짜 모델**로 나옴 (3번). 나머지 카테고리는 v3처럼 블록

## 2. 슬롯 위치가 바뀐 것 (v3 → v3.1)

돔·벽은 방 중심에서 **뒤쪽 절반(y ≥ 0, three.js에서는 z ≤ 0)에만** 있고 앞쪽 절반은 열려 있음. v3의 슬롯 몇 개가 **벽이 없는 쪽**에 있어서 가구가 허공에 떠 있었음 → 아래처럼 고침.

| 슬롯 | 가구 | v3 (three.js x, y, z / ry) | v3.1 (three.js x, y, z / ry) | 이유 |
|---|---|---|---|---|
| `furniture_slot_20` | `tv` | (−2.859, 1.0, 0.25) / 95° | **(−2.718, 1.3, −0.528) / 79°** | 돔 바깥이라 뒤에 벽이 없었음 |
| `furniture_slot_04` | `photo_board` | (2.833, 1.5, −0.198) / −86° | **(1.114, 1.3, −2.757) / −22°** | 벽에서 6.3cm 떠 있었음 |
| `furniture_slot_07` | `terrarium_bench` | (−1.75, 0, −1.0) | **(−1.2, 0, −1.5) / 38.7°** | 침대·협탁에 가려 카메라에서 23%만 보임 (지금 95%) |
| `furniture_slot_18` | `bike_rack_wall` | (2.615, 0.8, 1.056) (벽 없음) | **(−1.123, 1.32, −2.78) / 22°** | 새 슬롯. 벽에 걸리고 화면에서 선반·액자와 안 겹침 |
| 선반 3개 | `display_shelf_01~03` | 벽에서 5.6 / 14.5 / 14.5cm 떠 있었음 | 벽에 닿음 (≤ 1cm) | `room_shelves_v1_1.glb`에 위치가 들어 있음 |
| 선반 칸 12개 | `prop_slot_01~12` | 선반 위 x ±0.16 / ±0.48 | 선반 위 x ±0.15 / ±0.45 (아래 표) | 선반이 벽 쪽으로 옮겨가서 같이 이동. 소품이 돔에 닿지 않게(3.2cm 이상) 일부 앞뒤 1~3cm 조정 |

- TV·사진 판·자전거는 모두 벽걸이라 **`pop`, 먼지 없음**. 낙하 값 `drop`은 그대로 `slots.json`에서 읽기
- 바뀌지 않은 슬롯: 가구 슬롯 03, 05, 06, 08~17, 19, 21과 바닥 소품·동물 슬롯 전부 (검사 통과)

선반 칸 위치 (three.js x, y, z / `ry_deg`는 선반과 같음: 01번 선반 0°, 02번 −46°, 03번 50°):

| 칸 | 선반 | 위치 | ry | 시연용 소품 |
|---|---|---|---|---|
| `prop_slot_01` | `display_shelf_01` | (-0.450, 1.35, -2.869) | 0° | watering_can |
| `prop_slot_02` | `display_shelf_01` | (-0.150, 1.35, -2.869) | 0° | small_pot |
| `prop_slot_03` | `display_shelf_01` | (0.150, 1.35, -2.869) | 0° | film_camera |
| `prop_slot_04` | `display_shelf_01` | (0.450, 1.35, -2.869) | 0° | yoga_mat |
| `prop_slot_05` | `display_shelf_02` | (1.681, 1.70, -2.249) | -46.0° | backpack |
| `prop_slot_06` | `display_shelf_02` | (1.897, 1.70, -2.041) | -46.0° | globe |
| `prop_slot_07` | `display_shelf_02` | (2.105, 1.70, -1.825) | -46.0° | paint_box |
| `prop_slot_08` | `display_shelf_02` | (2.310, 1.70, -1.606) | -46.0° | camera_case |
| `prop_slot_09` | `display_shelf_03` | (-2.406, 1.70, -1.432) | 50.0° | sf_books |
| `prop_slot_10` | `display_shelf_03` | (-2.205, 1.70, -1.655) | 50.0° | book_stack |
| `prop_slot_11` | `display_shelf_03` | (-2.024, 1.70, -1.895) | 50.0° | popcorn |
| `prop_slot_12` | `display_shelf_03` | (-1.827, 1.70, -2.121) | 50.0° | game_console |

- 시연용 소품은 v3의 "소품은 비어 있는 선반 칸에 가까운 순" 규칙의 **예시**일 뿐. 규칙은 그대로. 깊은 소품(팝콘, 책 더미)은 안쪽 칸이 더 안전함 (선반 끝은 벽이 더 가까워서)

## 3. 새 카테고리 2개

| 카테고리 | 가구 (슬롯) | 소품 (선반 칸) | glb |
|---|---|---|---|
| 운동·아웃도어 `outdoor` | `bike_rack_wall` (`furniture_slot_18`, 벽걸이 `pop`), `camp_chair` (`furniture_slot_19`, `fall`) | `backpack`(camping), `bike_helmet`(cycling), `chalk_bag`(climbing), `yoga_mat`(yoga), `skateboard` | `interest_outdoor_v1_draco_webp.glb` |
| 자연·식물 `nature` | `plant_stand` (`furniture_slot_06`), `terrarium_bench` (`furniture_slot_07`) | `terrarium_jar`, `watering_can`(houseplants), `fish_bowl`, `bonsai_pot`, `small_pot`(succulents), `mushroom_log` | `interest_nature_v1_draco_webp.glb` |

- 모든 노드 위치 (0,0,0), 회전 0, 크기 1. 스케일은 이미 모양에 구움 (카탈로그 `scale_to_fit` 1.0)
- **`bike_rack_wall`만 원점이 다름**: 원점 = **벽에 닿는 점**(나무 판 뒷면 가운데, 자전거 맨 아래 높이). 벽이 +Y쪽, 자전거는 −Y(방 안쪽)로 최대 0.57m 나옴. 슬롯 `pos_three`가 이 점이라 노드를 슬롯에 그대로 놓으면 판이 벽에 닿음
- 자전거: 벽 나무 판 + 팔 2개, 방 쪽으로 **30° 회전**, 0.7배(0.883 × 0.686 × 0.559m). 접촉 그림자 판이 없음
- 바닥 가구 `camp_chair`, `terrarium_bench`, `plant_stand`는 자식 `shadow_<id>` 접촉 그림자 판이 있음 (v3 설명 그대로)
- 외부 에셋은 전부 **CC0**(`backpack`, `plant_stand`의 식물, `watering_can`), 나머지 직접 제작. **CC-BY 없음**

## 4. 확인한 것

| 항목 | 결과 |
|---|---|
| 벽걸이 슬롯 3개 (04, 18, 20) | 모두 뒤에 벽이 있고 뒷면이 벽에 닿음 (0.2cm 이내) |
| 선반 3개 | 모두 벽에 닿음 (1cm 이내), 선반 칸 12개는 선반 윗면 높이와 일치 |
| 바닥 슬롯 (가구 18 + 소품 2 + 동물 5 + 동물 용품 5) | 전부 바닥 위, 가장자리 밖으로 안 나감, 벽을 뚫지 않음 |
| TV · 사진 판 · 자전거 | 다른 물체(선반·액자·피아노·침대·리브·소품 칸 상자)와 3D로 3cm 이상, 카메라 화면에서 겹침 없음 (5px 여유. TV 오른쪽 가장자리만 리브 05와 5px 안쪽으로 가까움), 카메라에서 100% 보임 |
| 두더지 | 선택 10개 상태에서 9개 점 모두 보임 (가려지지 않음) |
| glb | 모든 노드 변환 0/0/1 (선반 제외), 카탈로그 id와 노드 이름 일치, 압축본과 같은 노드 |

## 5. 남은 것

- 나머지 카테고리 (M2~M4)는 날짜 미정, 계속 블록으로 대체. 아케이드·빈백·기타(CC-BY)는 아직 glb에 없음
- 선반 칸 상자 (`max_m` 0.30 × 0.28 × 0.35)를 **꽉 채우는** 소품은 선반 **끝 칸**(01·04·05·08·09·12번)에서 돔과 1cm 안팎밖에 안 떨어짐 (선반이 벽에 닿으면서 생긴 한계: 돔이 위로 갈수록 안쪽으로 기울어서). 지금 있는 소품(깊이 0.19~0.25m)은 시연 배치에서 전부 3cm 이상 떨어짐. 새 소품은 깊이 0.25m 안쪽으로 만들면 안전
