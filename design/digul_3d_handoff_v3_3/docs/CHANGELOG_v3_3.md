# CHANGELOG v3.3 (v3.2 대비, 빈백 전용 앉기) — 2026-11-12

> v3.3 zip: `handoff/digul_3d_handoff_v3_3_20261112.zip`

## 이미 전달된 것이 바뀜

| 항목 | 이전 | 지금 | 영향 |
|---|---|---|---|
| 빈백 앉기 clip | `mole_sit_beanbag` / `mole_sit_idle_chair` / `mole_stand_up_beanbag` (몸 13.7cm 눌림, 발이 빈백에 박힘) | `mole_sit_beanbag_v2` / `mole_sit_idle_beanbag` / `mole_stand_up_beanbag_v2` (몸 4.6~4.9cm, 발이 표면에 닿고 몸통에 붙음) | 두더지 glb 교체 + 빈백일 때 새 clip 재생 |
| 두더지 glb | `mole_v1_1*.glb` (20개 동작) | `mole_v1_2*.glb` (23개 동작) | 기존 20개 동작·소켓 5·셰이프 키 3·메시·재질은 그대로(전 채널 차이 0) |
| sit point 노드 extras | `seat_type` 등 | + **`sit_clip_set`** (`"cushion"` / `"beanbag"`) | clip을 데이터로 고름 |
| 카탈로그 | `sit_point`만 | + `sit_clip_set`, `sit_clips` (`cushion_yellow`, `cushion_sky`, `bean_bag`), `bean_bag.sit_point_info`에 같은 값 | |

## 바뀌지 않음

sit point 위치·방향·높이, 걸어오는 시작점 (−0.81, −0.72), 방석 동작, 슬롯, 가구 모델·크레딧.

## 파일

- 추가: `models/mole_v1_2.glb`, `models/mole_v1_2_draco_webp.glb`
- 교체 (extras 1~2줄만 추가): `models/room_base_v2*.glb`, `models/interest_game_v1*.glb`
- 문서: `docs/sit_points.md`, `docs/furniture_catalog.json`, `docs/animation_list.md`, `docs/HANDOFF_v3_3.md`, `docs/CHANGELOG_v3_3.md`
