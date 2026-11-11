# 앉는 위치 (sit points)

- 원본: `room_v5.blend` → 컬렉션 `sit_points` (Empty)
- 각 Empty의 위치 = 두더지가 앉았을 때 **엉덩이(루트 뼈, 발밑 중앙)가 놓이는 자리**, Empty의 -Y = 앉아서 바라보는 방향
- 앉기/일어나기 애니메이션은 이 Empty 기준 좌표로 만들어져 있음 → **재생할 때 두더지 오브젝트(`mole`)를 sit point의 위치·회전에 그대로 두면 됨**
- 좌표: Blender(Z-up). three.js / glTF(Y-up)로는 `(x, y, z)` → `(x, z, -y)`, 회전은 Y축 기준

## 목록

| 이름 | 가구 | 종류 | 앉는 높이 | 위치 Blender (x, y, z) | 위치 three.js (x, y, z) | 바라보는 방향 |
|---|---|---|---|---|---|---|
| `sit_point_cushion_01` | cushion_sky (하늘색 방석) | cushion | 0.13m | (0.06, 1.55, 0.13) | (0.06, 0.13, -1.55) | -Y (카메라 쪽), 회전 0° |
| `sit_point_chair_01` | bean_bag (빈백) | beanbag | 0.24m | (-1.50, -0.60, 0.24) | (-1.50, 0.24, 0.60) | -Y (카메라 쪽), 회전 0° |

- `chair` 종류는 "점프해서 올라앉는" 자리(높이 0.45m 기준으로 제작)
- `beanbag` 종류 (11/10 수정): 빈백은 겉 높이는 0.44m지만 가운데가 꺼져 실제 앉는 면이 약 0.26m. 예전엔 0.45m(의자 동작)로 앉혀서 20cm 떠 보였음 → 앉는 높이 0.24m(몸이 빈백에 살짝 묻힘)로 내리고, 점프 높이를 맞춘 전용 동작 `mole_sit_beanbag` / `mole_stand_up_beanbag` 추가. 앉아 있는 동안은 `mole_sit_idle_chair` 그대로 사용
- 다른 가구를 추가할 때는 높이가 같으면(방석 0.13m / 의자 0.45m) 같은 동작을 그대로 쓸 수 있음

## 이동 지점 (웹에서 걷기로 도착/출발할 위치)

| 이름 | 도착 지점 (걷기 끝, 바닥) | 도착할 때 바라볼 방향 | 일어난 뒤 서 있는 지점 | 일어난 뒤 방향 |
|---|---|---|---|---|
| `sit_point_cushion_01` | (0.06, 0.85, 0) = sit point에서 앞으로 0.70m | 방석 쪽(+Y, 회전 180°) | (0.06, 1.20, 0) = 앞으로 0.35m | -Y |
| `sit_point_chair_01` | (-1.50, -1.30, 0) = 앞으로 0.70m | 빈백 쪽(+Y, 회전 180°) | (-1.50, -1.30, 0) = 앞으로 0.70m | -Y |

(위치는 Blender 좌표. 방 바닥 높이는 0, 러그 위는 0.03)

## 재생 순서

1. `mole_walk`(제자리 걷기 루프, 한 걸음 6프레임, 이동 속도 **0.32 m/s**)로 도착 지점까지 이동. 도착할 때 가구 쪽을 바라보게
2. `mole` 오브젝트를 sit point 위치·회전으로 옮기고 `mole_sit_cushion` / `mole_sit_chair` / `mole_sit_beanbag` 재생 (첫 프레임 자세가 도착 지점에 서 있는 자세와 같음)
3. 앉은 동안: `mole_sit_idle`(방석) / `mole_sit_idle_chair`(빈백·의자) 반복
4. 일어나기: `mole_stand_up_cushion` / `mole_stand_up_chair` / `mole_stand_up_beanbag` → 끝나면 위 표의 "일어난 뒤 서 있는 지점"에 서 있음 → 그 위치로 `mole`을 옮기고 `mole_idle` 또는 `mole_walk`

| Action | 길이 | 반복 |
|---|---|---|
| `mole_sit_cushion` | 28f (1.13s) | X |
| `mole_sit_chair` | 31f (1.25s) | X |
| `mole_sit_beanbag` | 31f (1.25s) | X |
| `mole_sit_idle` | 60f (2.5s) | O |
| `mole_sit_idle_chair` | 60f (2.5s) | O |
| `mole_stand_up_cushion` | 19f (0.75s) | X |
| `mole_stand_up_chair` | 19f (0.75s) | X |
| `mole_stand_up_beanbag` | 19f (0.75s) | X |

## 앉아서 커피 마시기

- `mole_drink`는 **상체만**(upper_body, arm_L, arm_R, 눈, 컵) 움직이도록 정리함. root, lower_body, 발은 건드리지 않음
- 앉아서 마실 때: `mole_sit_idle`(또는 `_chair`)을 계속 재생하면서 그 위에 `mole_drink`를 덮어 재생
  - three.js에서는 두 클립이 상체 트랙을 함께 갖고 있으므로, 마시는 동안 sit_idle 클립에서 upper_body·arm·눈 트랙을 빼거나(subclip/트랙 필터) drink의 weight를 우선 적용
- 서서 마실 때도 같은 `mole_drink` 그대로 사용 가능
- 앉은 상태(방석·빈백 모두)에서 72프레임 전부 컵·몸·코·팔 겹침 0건 확인

## 앉는 위치를 만들지 못한 가구

| 가구 | 이유 |
|---|---|
| cushion_yellow (노란 방석) | 앞에 원탁, 옆에 하늘색 방석·화분·플랜트 스탠드가 붙어 있어 두더지(폭 0.8m)가 서서 다가갈 자리가 없음 |
| piano_stool (피아노 의자) | 앉으면 스피커·피아노 건반과 겹침. 어느 방향·위치로도 겹치지 않는 자리 없음 |
| drawing_stool (그림 의자) | 앉으면 러닝머신 손잡이·이젤과 겹침 |

→ 이 가구들을 쓰려면 주변 가구 위치를 조금 옮겨야 함 (스피커, 원탁 등)
