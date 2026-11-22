# 두더지 애니메이션 목록 (mole_v1_3, 25개)

- 파일: `models/mole_v1_3.glb` (웹용 `models/mole_v1_3_draco_webp.glb`). v1.2 의 23개(내용 그대로) + `mole_hop_down` / `mole_hop_up`. 사용법 `docs/mole_hop_spec.md`.
- 24fps. glb 안의 모든 애니메이션은 0초에서 시작, 길이는 아래 표와 같음
- 뼈대 `mole_rig`: root → lower_body → upper_body → arm_L / arm_R, root → foot_L / foot_R
- 셰이프 키(morph): `butt_squish_L`, `butt_squish_R`, `butt_bounce` (기본값 0)
- 탐색 들판에서는 `mole_idle` 과 `mole_hop_down` / `mole_hop_up` 만 사용. 나머지는 방·지상 장면용.

## 전체 목록 (25개)

| 이름 | 프레임 | 길이 | 반복 | 쓰이는 화면 | 기준 위치 (mole 오브젝트를 둘 곳) | 움직이는 부분 |
|---|---|---|---|---|---|---|
| `mole_room_drop` | 47 | 1.958s | X | 방 (처음 들어올 때) | 방 중앙의 두더지 자리. 천장 구멍(약 (1.82, 0.75, 3.53))에서 떨어져 이 자리에 착지 | 전신 + 컵 숨김 |
| `mole_idle` | 48 | 2.000s | O | 방 (서 있기) | 서 있는 자리 | 전신 |
| `mole_walk` | 24 | 1.000s | O | 방 (이동) | 제자리 걷기. 이동은 코드에서 0.32 m/s | 전신 |
| `mole_drink` | 71 | 2.958s | X | 방 (커피 마시기) | 서 있거나 앉은 자리 그대로 | **상체만** (upper_body, arm_L/R, 눈, 컵) |
| `mole_sit_cushion` | 27 | 1.125s | X | 방 (방석에 앉기) | `sit_point_cushion_01` | 전신 |
| `mole_sit_idle` | 60 | 2.500s | O | 방 (방석에 앉아 있기) | `sit_point_cushion_01` | 전신 |
| `mole_stand_up_cushion` | 18 | 0.750s | X | 방 (방석에서 일어나기) | `sit_point_cushion_01` | 전신 |
| `mole_sit_chair` | 30 | 1.250s | X | 방 (빈백·의자에 앉기) | `sit_point_chair_01` | 전신 |
| `mole_sit_idle_chair` | 60 | 2.500s | O | 방 (빈백·의자에 앉아 있기) | `sit_point_chair_01` | 전신 |
| `mole_stand_up_chair` | 18 | 0.750s | X | 방 (빈백·의자에서 일어나기) | `sit_point_chair_01` | 전신 |
| `mole_burrow_exit` | 39 | 1.625s | X | 지상 (굴에서 나오기) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_burrow_enter` | 55 | 2.292s | X | 지상 (굴로 들어가기: 카메라 등지고 앞으로만 숙여 다이브, 씰룩 3번 + 발 파닥 → 쏙. 11/10 확정) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_butt_wiggle` | 36 | 1.500s | O | 지상 (굴 입구에 엉덩이 내밀고 씰룩) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_ground_scratch` | 46 | 1.917s | X | 지상 (땅굴 입구가 아닌 잔디 클릭 시 1회) | 클릭한 잔디 위치. 시작·끝 포즈 = `mole_idle` 첫 프레임 (idle → scratch → idle 그대로 이어짐) | 전신 + 눈(깜빡임) + 셰이프 키 |
| `mole_look_around` | 72 | 3.000s | O | 지상 (가만히 있을 때) | 서 있는 자리. 첫 프레임 = `mole_idle` 첫 프레임 | 전신 + 눈(깜빡임) + 셰이프 키 |
| `mole_turn` | 12 | 0.500s | X | 지상 (방향 전환) | 제자리. 뼈대는 회전하지 않음, 회전은 코드에서 90° 기준 (지상 이동 스펙(이 zip 에 없음)) | 전신 |
| `mole_greet` | 36 | 1.500s | X | 지상 (다른 두더지와 인사) | 서 있는 자리. 시작·끝 = `mole_idle` 첫 프레임 | 전신 + 눈 + 셰이프 키 |
| `mole_sit_beanbag` | 30 | 1.250s | X | 방 (빈백에 앉기) | `sit_point_chair_01` (높이 0.24m) | 전신 |
| `mole_stand_up_beanbag` | 18 | 0.750s | X | 방 (빈백에서 일어나기) | `sit_point_chair_01` | 전신 |
| `mole_sit_beanbag_v2` | 30 | 1.250s | X | 방 (**빈백에 앉기, 빈백 전용 v2**) | `sit_point_chair_01` (높이 0.24m 그대로) | 전신 |
| `mole_sit_idle_beanbag` | 60 | 2.500s | O | 방 (**빈백에 앉아 있기, 빈백 전용**) | `sit_point_chair_01` | 전신 |
| `mole_stand_up_beanbag_v2` | 18 | 0.750s | X | 방 (**빈백에서 일어나기, 빈백 전용 v2**) | `sit_point_chair_01` | 전신 |
| `mole_showcase` | 72 | 3.000s | O | 온보딩 오른쪽 미리보기 (기분 좋게 통통 → 고개 갸웃 + 깜빡 → 엉덩이 씰룩 → 통통). 11/10 추가 | 미리보기 가운데 제자리 | 전신 + 눈(깜빡임) + 셰이프 키 |
| `mole_hop_down` | 10 | 0.417s | X | 탐색 (구멍 점프: 정면 유지, 웅크림 → 구멍 안으로 쏙 내려가 사라짐. 추가) | 구멍 바닥 (구멍 중심, 높이 0.075). 시작 = `mole_idle` 첫 프레임, 끝 = 루트 y -1.30 (머리까지 바닥 아래, 화면에서 숨김) | root 위아래·스쿼시 (나머지 뼈·눈·셰이프 키는 idle 첫 프레임 고정) |
| `mole_hop_up` | 12 | 0.500s | X | 탐색 (구멍에서 쏙 올라와 착지, 오버슈트). 끝 = `mole_idle` 첫 프레임과 같음 → 바로 `mole_idle` | 구멍 바닥. 시작 = 루트 y -1.30 | root 위아래·스트레치·스쿼시 (나머지는 idle 첫 프레임 고정) |
