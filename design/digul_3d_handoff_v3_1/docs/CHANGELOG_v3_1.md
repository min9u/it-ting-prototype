# CHANGELOG v3.1 (v3 대비) — 2026-11-11

## (a) 새로 추가

| 항목 | 내용 | 파일 |
|---|---|---|
| 운동·아웃도어 | 가구 2 (`bike_rack_wall` 벽걸이, `camp_chair`) + 소품 5 (`backpack`, `bike_helmet`, `chalk_bag`, `yoga_mat`, `skateboard`) | `models/interest_outdoor_v1*.glb` |
| 자연·식물 | 가구 2 (`plant_stand`, `terrarium_bench`) + 소품 6 (`terrarium_jar`, `watering_can`, `fish_bowl`, `bonsai_pot`, `small_pot`, `mushroom_log`) | `models/interest_nature_v1*.glb` |

## (b) 버그 수정

| 항목 | 이전 (v3) | 지금 (v3.1) |
|---|---|---|
| TV 슬롯 `furniture_slot_20` | (−2.859, −0.25, 1.0)에 있어서 **돔 바깥 (벽 없이 허공에 떠 있음)** | **왼쪽 뒤쪽 벽 (−2.718, 0.528, 1.3)**, 뒷면이 벽에 닿음. 옛 glb 대신 **`interest_movie_v1_1`** 사용 |
| 사진 판 슬롯 `furniture_slot_04` | 벽에서 6.3cm 떠 있음 | **뒤쪽 벽 (1.114, 2.757, 1.3)**, 벽에 닿음. **`interest_photo_v1_1`** 사용 |
| 벽 선반 3개 | 벽에서 5.6 / 14.5 / 14.5cm 떠 있음 | 벽에 닿음. **`room_shelves_v1_1`** 사용. 선반 칸 12개 위치도 같이 바뀜 |
| 이끼 벤치 슬롯 `furniture_slot_07` | (−1.75, 1.0): 침대·협탁에 가려 카메라에서 23%만 보임 | (−1.2, 1.5), 방 중심을 봄 (95% 보임) |
| 원인 | 지난 검사가 돔을 앞쪽까지 이어진 원으로 보고 y 값을 보정해서, 돔이 없는 앞쪽 절반(y < 0)의 슬롯을 "벽 있음"으로 잘못 통과시킴 | 보정 없이 실제 벽 메시로 전수 재검사 (슬롯 45개) |

- `interest_movie_v1_1`, `interest_photo_v1_1`은 **노드·모양이 v1과 같음**(노드가 원점이라 위치는 `slots.json`이 정함). 이름만 새로 바꿔서 카탈로그가 가리키게 함. 옛 파일을 계속 쓰면 위 좌표가 새 슬롯과 안 맞을 일은 없지만, 파일 이름 규칙(교체)을 지키려고 정리함
- 선반 위 시연 소품 순서 변경: `prop_slot_09~12` = `sf_books`, `book_stack`, `popcorn`, `game_console` (깊은 소품은 안쪽 칸)

## (c) `small_pot` 새 모델

- 통통한 둥근 주황 화분 + 크림 테두리 + 둥글고 통통한 다육 잎 15장 + 주황 꽃봉오리 (0.25 × 0.25 × 0.243m, 팔레트 색만)
- **직접 제작**. 이전 Poly Pizza `Potted Plant`(CreativeTrio) 모델은 쓰지 않음 → `credits.md`에서 출처 줄 삭제

## (d) 자전거 벽걸이 규칙

- `bike_rack_wall`: **벽 나무 판 + 팔 2개**에 걸림 (판 뒷면이 돔 벽 곡면을 따라 닿음), 방 쪽으로 **30° 회전**, 0.7배 (0.883 × 0.686 × 0.559m), 타이어 굵기 60% + 더 큰 하늘색 바퀴판
- 원점 = 벽에 닿는 점 (판 가운데, 자전거 맨 아래 높이). 슬롯 `furniture_slot_18` = (−1.123, 2.78, 1.32) Blender / `pos_three` (−1.123, 1.32, −2.78), `ry_deg` 22°
- 벽걸이라 `pop`, 먼지 없음. 카메라 화면에서 선반·액자·리브와 겹치지 않는 자리로 정함

## 바뀌지 않은 것

`room_base_v2`, `room_deco_v1`, `interest_book_v1`, `interest_craft_v1`, `dust_puff_v1`, 두더지·액세서리 glb, 온보딩 구조 (`interest_catalog.json`), 낙하 값 (벽걸이 `pop`, 바닥 `fall`)
