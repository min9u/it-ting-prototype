# 디굴디굴 3D 전달 v3.3 (패치) — 빈백 전용 앉기 (2026-11-12)

zip `digul_3d_handoff_v3_3_20261112.zip` 기준 경로. **v3 + v3.1 + v3.2 위에 얹는 패치**라서 여기 없는 파일은 이전 그대로 유효. 좌표는 three.js 기준 `(x, y, z)` = Blender `(x, z, −y)`.

## 한 줄 요약

빈백에 앉으면 몸이 13.7cm나 파묻히고 발이 빈백 속에 박혀 있었음 → **빈백 전용 동작 3개를 새로 만들어 두더지 glb에 넣음** (`mole_v1_2.glb`). sit point 위치·방향·높이는 그대로고, 어떤 clip을 쓸지는 sit point의 **`sit_clip_set`** 값으로 고름.

## 개발팀이 할 일 3가지

### 1. 두더지 glb 교체

- `models/mole_v1_1.glb` / `mole_v1_1_draco_webp.glb` → **`models/mole_v1_2.glb` / `mole_v1_2_draco_webp.glb`** (웹은 draco_webp)
- 동작 20개 → **23개**. 기존 20개는 이름·길이·프레임 값이 v1.1과 똑같음(전 채널 차이 0으로 확인), 소켓 5개·셰이프 키 3개·메시·재질도 그대로. 크기는 6.79→6.81MB, 압축본 0.66→0.68MB
- 새 clip 3개: `mole_sit_beanbag_v2`(1.25s, 한 번), `mole_sit_idle_beanbag`(2.5s, 반복), `mole_stand_up_beanbag_v2`(0.75s, 한 번)

### 2. sit point의 `sit_clip_set` 값으로 clip 고르기

- glb 노드 `extras.sit_clip_set` (three.js `node.userData.sit_clip_set`) — 값은 문자열
  - `sit_point_cushion_01`, `sit_point_cushion_02` → `"cushion"`
  - `sit_point_chair_01` (`bean_bag`의 자식) → `"beanbag"`
- 카탈로그에도 같은 값: `docs/furniture_catalog.json`의 `cushion_yellow`, `cushion_sky`, `bean_bag` 줄 → `sit_clip_set`, `sit_clips`(`sit` / `idle` / `stand_up` clip 이름)
- 이 값을 쓰는 glb 4개를 같은 이름으로 교체 (extras 한 줄만 추가됨, 모델·텍스처는 바이트 그대로): `room_base_v2*.glb`(방석 2개), `interest_game_v1*.glb`(빈백). 같은 값을 카탈로그에서 읽어도 되므로 glb를 바꾸지 않아도 동작은 같음

| `sit_clip_set` | 앉기 | 앉아 있기 (반복) | 일어나기 |
|---|---|---|---|
| `cushion` | `mole_sit_cushion` | `mole_sit_idle` | `mole_stand_up_cushion` |
| `beanbag` | `mole_sit_beanbag_v2` | `mole_sit_idle_beanbag` | `mole_stand_up_beanbag_v2` |

```js
const set = sitNode.userData.sit_clip_set ?? 'cushion';        // 모르는 값이면 cushion
const clips = CLIPS[set];                                       // 위 표, 또는 카탈로그 sit_clips
```

### 3. 빈백일 때 새 clip 3개 재생

- 걷기 → 도착 → `mole`을 sit point의 월드 위치·회전에 두고 `clips.sit` 한 번 → `clips.idle` 반복 → 일어날 때 `clips.stand_up` 한 번 → 끝나면 서 있는 지점(앞 0.7m)에서 `mole_idle` / `mole_walk`
- **바뀌지 않는 것**: sit point 위치 (−1.50, −0.60, 0.24), 월드 방향 80°, 걸어오는 시작점 (−0.81, −0.72), 앉는 높이. 새 clip의 첫 프레임(걸어오는 자세)과 일어나기 마지막 프레임은 옛 동작과 똑같음 (발이 바닥에 닿음)
- `mole_drink` 겹쳐 재생 그대로 가능. 두더지 오브젝트를 따로 올리거나 앞으로 옮길 필요 **없음** (높이 보정은 clip 안에 들어 있음)

## 결과 (방 안 전 프레임 검사)

| 항목 | 옛 동작 | 새 동작 |
|---|---|---|
| 몸이 빈백에 눌림 | 13.7cm | 4.6~4.9cm |
| 두 발 | 빈백 속에 6.5~6.8cm 묻힘 | 표면에 닿음 (뜸 0.9cm 이하, 묻힘 최대 2.0cm) |
| 발–몸통 거리 | 겹침 | 0.7cm 이하 |
| 다른 가구와 최소 거리 | 8.5cm | 16.4cm 이상 |

자세한 표는 `docs/sit_points.md` 마지막 절, 동작 목록은 `docs/animation_list.md`.

## 교체·추가 파일

| 파일 | 처리 |
|---|---|
| `models/mole_v1_2.glb`, `models/mole_v1_2_draco_webp.glb` | **추가** (v1.1 대체) |
| `models/room_base_v2.glb`, `_draco_webp.glb` | 교체 (노드 extras에 `sit_clip_set`만 추가) |
| `models/interest_game_v1.glb`, `_draco_webp.glb` | 교체 (같음) |
| `docs/sit_points.md`, `docs/furniture_catalog.json`, `docs/animation_list.md` | 교체 / 추가 |
| `docs/HANDOFF_v3_3.md`, `docs/CHANGELOG_v3_3.md` | 추가 |

크레딧·슬롯·가구 모델은 바뀐 것이 없음.
