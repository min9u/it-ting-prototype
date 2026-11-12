# 디굴디굴 3D 전달 v3.2 (패치) — 2026-11-12

zip `digul_3d_handoff_v3_2_20261112.zip` 기준 경로. **v3 + v3.1 위에 얹는 패치**라서 여기 없는 파일은 v3 / v3.1 그대로 유효. 문서 안 `exports/…`는 `models/…`로 읽기. 좌표는 three.js 기준 `(x, y, z)` = Blender `(x, z, −y)`, 회전은 `rotation.y = ry_deg`(라디안 변환).

## 0-1. v3.1에서 바뀐 파일 교체 목록

| 구분 | v3.1까지 있던 파일 | v3.2에서는 | 처리 |
|---|---|---|---|
| 모델 (새로) | (없음) | `models/interest_tea_v1.glb`, `models/interest_tea_v1_draco_webp.glb` | **추가**. 차·커피·베이킹 가구 2 (`cafe_stool`, `kitchen_counter`+자식 `cooking_pot`) + 소품 5 |
| 모델 (새로) | (없음) | `models/interest_music_v1.glb`, `models/interest_music_v1_draco_webp.glb` | **추가**. 음악 가구 4 (`piano`, `speaker`, `piano_stool`, `guitar`) + 소품 8 |
| 모델 (새로) | (없음) | `models/interest_game_v1.glb`, `models/interest_game_v1_draco_webp.glb` | **추가**. 게임·놀이 가구 2 (`arcade`, `bean_bag`+자식 `sit_point_chair_01`) + 소품 10 |
| 모델 (새로) | (없음) | `models/interest_science_v1.glb`, `models/interest_science_v1_draco_webp.glb` | **추가**. 우주·과학 가구 2 (`telescope`, `mineral_bench`) + 소품 9 |
| 문서 (교체) | `docs/slots.json` | 같은 이름 | **교체**. 슬롯 14·15·16·17, 08·09 낙하 메모, `sit` 관련 변경 (아래 2번) |
| 문서 (교체) | `docs/furniture_catalog.json` | 같은 이름 | **교체**. 모델 있는 줄 55 → 98개. 새 필드 `shelf_offset_forward_m`, `sit_point_info`, `scale_baked` |
| 문서 (교체) | `docs/furniture_drop_spec.md` | 같은 이름 | **교체**. 슬롯 08·09·14·15·17 행 갱신 |
| 문서 (교체) | `docs/sit_points.md` | 같은 이름 (v3 zip에 있던 것) | **교체**. 빈백 `sit_point_chair_01` 방향·시작점·자식 노드 |
| 문서 (교체) | `docs/credits.md` | 같은 이름 | **교체**. 4·5묶음 절 추가, **CC-BY 3개가 glb에 들어감** |
| 문서 (새로) | (없음) | `docs/credits_app.md` | **추가**. 앱 크레딧 화면용 요약 (아래 0-2) |
| 문서 (그대로) | `docs/interest_catalog.json` | 같은 이름 | 내용 변경 없음. 한 벌로 맞추려고 같이 넣음 |
| 문서 (새로) | (없음) | `docs/HANDOFF_v3_2.md`, `docs/CHANGELOG_v3_2.md` | 이 문서와 변경 목록 |

바뀌지 않은 것 (v3 / v3.1 그대로): `room_base_v2`, `room_deco_v1`, `interest_book_v1`, `interest_craft_v1`, `dust_puff_v1`, `interest_outdoor_v1`, `interest_nature_v1`, `interest_photo_v1_1`, `interest_movie_v1_1`, `room_shelves_v1_1` (각 `_draco_webp` 포함), 두더지·액세서리 glb. 카탈로그의 `glb` 이름이 v3.1 zip의 `_v1_1` 파일을 가리키는 줄은 그대로 유효.

## 0-2. 앱 크레딧 화면 안내 (**필수**)

이번 패치부터 CC-BY 3.0 모델 3개가 glb 안에 들어감 → **앱 크레딧 화면에 작가 표기를 넣어야 함**. 복사해 쓸 문구는 `docs/credits_app.md`:

```
"Acoustic guitar" by jeremy (https://poly.pizza/m/afr6GCpce_I), CC BY 3.0 — 색을 바꿔 사용
"Arcade Machine" by J-Toastie (https://poly.pizza/m/GLDkMhiynM), CC BY 3.0 — 색을 바꿔 사용
"Bean Bag" by J-Toastie (https://poly.pizza/m/nMZz79A5ru), CC BY 3.0 — 색을 바꿔 사용
라이선스: https://creativecommons.org/licenses/by/3.0/
```

사용자가 해당 가구를 고르지 않아도 glb에는 들어 있으므로 크레딧 화면에는 항상 표시 권장. 나머지 외부 모델은 모두 CC0(표기 의무 없음), 전체 표는 `docs/credits.md`.

## 1. 먼저 할 일

1. 위 표대로 파일 **교체·추가**. 웹에는 `*_draco_webp.glb` 사용
2. 로딩은 **카탈로그의 `glb` / `glb_compressed` 이름을 따라가기**. 이제 **모델 있는 줄이 98개**(`status: built`), 아직 블록인 것은 동물 관련 10줄(`todo`)뿐
3. 배치는 **새 `slots.json`**의 `pos_three` / `ry_deg` / `max_m` / `drop`으로

## 2. 이미 받은 값이 바뀌는 것 (v3.1 → v3.2)

| 슬롯 / 항목 | v3.1 | v3.2 | 이유 |
|---|---|---|---|
| `furniture_slot_17` (카페 스툴) 위치 | three.js (0.286, 0, −2.106), ry −7.7° | **(1.70, 0, 1.30), ry 54.8°** | 이전 자리는 카메라에서 두더지에 90.6% 가려짐 |
| `furniture_slot_14` (망원경) 위치·상자 | (2.393, 0, −1.272), 상자 0.7×0.7×1.55 | **(2.534, 0, −1.346), 상자 0.58×0.66×1.2**, ry −62° 그대로 | 망원경 모델에 맞춤, 뒤쪽 다리가 돔 벽에 1cm로 닿음 |
| `furniture_slot_14` 등장 | pop (모델 없음) | **pop** (모델 기준 확정) | 낙하하면 벽 선반에 스침. 벽에 붙어 있어서 pop의 1.08배 순간 뒤쪽 다리가 벽을 최대 3.2cm 파고듦(0.08초). 이 가구만 pop 최대 배율 1.0으로 낮춰도 됨 |
| `furniture_slot_15` (광물 벤치) 낙하 | fall H 1.6, S 0.25 (상자 기준) | **fall H 2.0, S 0.0** | 모델 높이 0.494m 기준 |
| `furniture_slot_16` (조리대) 높이 한도 | 0.95m | 0.98m | 냄비 포함 0.97m |
| `sit_point_chair_01` (빈백) | 독립 Empty, 방향 0°, 시작점 (−1.50, −1.30) | **`bean_bag`의 자식 노드, 월드 방향 80°, 시작점 (−0.81, −0.72)** (three.js (−0.81, 0, 0.72)) | 0° 방향은 시작점이 침대에 닿음. 자세한 비교는 `sit_points.md`. 두더지는 노드의 월드 위치·회전에 두면 됨 |

## 3. 선반 소품 놓는 법 (**v3.1 문서 바로잡음**)

v3.1 문서에 "선반 끝 칸도 깊이 0.25m 이하면 안전"이라고 되어 있었지만 **틀림**: 깊거나 키 큰 소품은 끝 칸에서 돔에 닿음. 새 소품(4·5묶음 32개 선반 소품)은 카탈로그 **`shelf_offset_forward_m`** 만큼 **선반 칸 위치에서 칸의 앞쪽(방 쪽)으로 옮겨 놓기** (값 = 0.145 − 깊이/2, 앞면을 선반 앞 가장자리에 맞춤). 이렇게 하면 12칸 어디서나 돔과 3cm 이상. 값이 없는 줄(이전 묶음 소품)은 지금처럼 칸 위치 그대로.

## 4. 새 모델 요약

| 파일 | 노드 | 비고 |
|---|---|---|
| `interest_tea_v1*` | cafe_stool, kitchen_counter(자식 cooking_pot), tea_tins, drip_kettle, baking_set, espresso_machine, tea_bowl_set | 조리대 0.89배 굳힘 |
| `interest_music_v1*` | piano, speaker, piano_stool, guitar(**CC-BY**), cassette_walkman, record_player, trumpet, mini_amp, mini_synth, metronome, snare_drum, vintage_radio | 피아노 0.99배 |
| `interest_game_v1*` | arcade(**CC-BY**, pop), bean_bag(**CC-BY**, 자식 sit_point_chair_01), game_console, mech_keyboard, figure_pair, board_game_box, pc_case, arcade_stick, gunpla_robot, chess_set, speed_cube, magic_hat | |
| `interest_science_v1*` | telescope(pop), mineral_bench, globe(CC0), binoculars, star_chart, ammonite_fossil, crystal_cluster, ham_radio, meteorite, specimen_frame, dino_figure | |

- 모든 노드: 이름 = 카탈로그 id, 위치 0·회전 0·크기 1, 원점 바닥 중심 (예외: `sit_point_chair_01`은 빈백의 자식이라 로컬 변환이 있음). 바닥 가구에는 자식 `shadow_<id>` 접촉 그림자 판
- 검사: 슬롯 45개 모두 통과 (바닥 위, 벽 안 뚫음, 낮은 가구는 앞쪽, 두더지 시선 0/9 막힘)
- 카메라 기준 두더지 가림: 조리대(슬롯 16)만 43% (나머지 0~9%) — 이동하지 않음

## 5. 아직 안 된 것
- 동물(고양이·강아지·앵무·도마뱀·개미 + 집) 10줄: 블록 그대로
- 앉는 위치: 피아노 의자·그림 의자는 없음 (`sit_points.md`)
