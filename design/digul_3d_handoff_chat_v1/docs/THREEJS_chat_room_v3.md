# 채팅 화면 3D 방 v3 (chat_room_3d_v3) — three.js 적용 메모

**v3에서 바뀐 점 (v2 대비)**: 카메라를 **인원수별 프리셋 3개**(1~2 / 3~4 / 5~6)로 나누고 인원이 바뀌면 0.6초 ease로 lerp (5번). 1~2마리는 더 가깝게 → 아래쪽 빈 바닥이 줄고 두더지가 화면 폭의 약 25%. 빈자리 표시 색을 조금 진하게 (4번). **자리(seat) 위치·회전은 v2와 같음.** 원본 장면 `chat_room_3d_v3.blend` (v2 파일은 그대로 둠).

## 인원이 6명보다 많을 때 (모임 채팅)

- 자리는 **최대 6개** (6마리 배치 + wide 카메라 그대로). 더 앉히면 서로 가리거나 뒷모습이 보임
- **"나"는 항상 1번 자리**. 나머지 5자리 = **최근에 메시지를 보낸 순서로 5명**
- 자리에 없는 사람이 메시지를 보내면 → **가장 오래 메시지가 없던 두더지와 교체**
  - 나가는 두더지: 0.3초 동안 아래로 쏙 + 작아지며 사라짐 / 들어오는 두더지: 같은 자리에서 0.3초 퐁 등장 (scale 0 → 1.1 → 1)
  - 교체 중엔 그 자리의 talk·drink 스케줄을 새로 시작
  - 너무 잦은 교체 방지: 한 자리는 **최소 5초** 유지 (5초 안에 또 바뀌어야 하면 다음 메시지 때 반영)
- 자리를 못 받은 인원은 화면 오른쪽 위에 **"+N" 배지** (웹 UI 오버레이). 누르면 참여자 목록
- 6명 이하일 때는 지금 배치(1/2/3/4/6) 그대로. 5명은 6자리 배치에서 한 자리 비움 (wide 카메라)

```js
// seats: [me, s2..s6], lastSpoke: Map<userId, time>
function onMessage(userId, now) {
  lastSpoke.set(userId, now);
  if (seated.includes(userId)) return playTalk(userId);
  const candidates = seated.slice(1).filter(id => now - seatedAt.get(id) >= 5000);
  if (!candidates.length) return;                 // 다음 메시지 때 다시 시도
  const out = candidates.sort((a, b) => lastSpoke.get(a) - lastSpoke.get(b))[0];
  swapSeat(out, userId);                          // 쏙 → 퐁, seatedAt 갱신
  updateOverflowBadge(totalMembers - 6);
}
```

---

(아래는 v2 문서 내용 + v3 변경 반영)


v1(`THREEJS_chat_room.md`)에서 바뀐 점: **원탁을 방 정중앙으로**, 두더지는 **방석 위에 앉아서** 원탁을 봄, 1·2·3·4·6마리 자리 배치, 앉아서 하는 모션(마시기 10초 간격 + 새 동작 `mole_sit_talk`).
원본 장면 `chat_room_3d_v2.blend` (v1 파일은 그대로 둠).

## 0. 좌표 변환 (v1과 같음)

- Blender(Z-up) `(x, y, z)` → three.js(Y-up) **`(x, z, −y)`**. 1 unit = 1m, 방 중심 바닥 = 원점
- 회전: Blender Z축 회전 `rz` → three.js `rotation.y = rz` (같은 값)
- 크기: Blender `(sx, sy, sz)` → three.js `scale (sx, sz, sy)`
- 두더지 정면: Blender −Y = three.js **+Z** (rotation.y = 0이면 카메라 쪽을 봄)
- 아래 값은 모두 three.js 값

## 1. 불러올 glb

| 파일 | 내용 |
|---|---|
| `room_shell_v2_draco_webp.glb`, `room_deco_v1_draco_webp.glb`, `room_shelves_v1_draco_webp.glb` | v1과 같음 (손대지 않음) |
| `room_base_v2_draco_webp.glb` | glb는 그대로. **아래 2번대로 노드만 옮기기/숨기기/복제** |
| **`mole_v1_2_chat_draco.glb`** (이 폴더) | 두더지. v1.1의 20개 동작 + **`mole_sit_talk`** = 21개. Draco + WebP. 압축 안 한 원본 `mole_v1_2_chat.glb` |
| `accessories_v1.glb` | 액세서리 (v1과 같은 소켓 방식) |

- 노드 이름은 v1.1과 같음 (`mole`, `mole_rig`, `mole_body`, `root`, `lower_body`, `upper_body`, `arm_L`, `arm_R`, `foot_L/R`, `coffee_cup`, `mole_eye_L/R`, `socket_*`)
- `room_ceiling_hole_v1.glb`는 이 화면에서 안 씀 (원탁이 중앙이라 drop 착지점과 겹침)

## 2. 방 노드 바꾸기 (room_base 안)

| 노드 | 바꾼 것 | 새 값 (three.js) |
|---|---|---|
| `round_table` | 위치·크기 | position **(0, 0.03, 0)** (전: (−0.72, 0.03, −1.18)), scale **(1.7, 0.9, 1.7)** → 지름 1.224m, 상판 윗면 높이 **0.354m** (전 0.39m) |
| `round_table_teapot` | 크기 (부모 크기 상쇄) | scale **(0.7353, 1.3889, 0.7353)** (= 실제 크기 1.25배). position은 그대로 (−0.02, 0.36, −0.1) |
| `round_table_cup_01` / `_02` | 크기 (위와 같음) | scale **(0.7353, 1.3889, 0.7353)**. position 그대로 (0.16, 0.36, 0.18) / (−0.14, 0.36, 0.2) |
| `shadow_round_table` | 없음 (`round_table` 자식이라 같이 따라감) | — |
| `nightstand` (자식·`shadow_nightstand` 포함) | **숨김** `visible = false` | 왼쪽 자리(방석)와 겹침 |
| `cushion_yellow`, `cushion_sky` (원래 자리) | **숨김** | 방석은 3번 자리표대로 이 두 노드를 `clone()`해서 씀 |
| `bed`, `ceiling_lamp` 등 나머지 | 그대로 | 천장 램프가 (0, 3.88, −0.455)라 원탁 바로 위에 걸려 참고 화면의 펜던트 램프 역할 |

- 원탁 높이를 낮춘 이유: 앉은 두더지가 `mole_drink`로 컵을 들 때 컵 바닥이 0.381m까지 내려옴 → 상판이 0.354m여야 안 겹침 (좌식 탁자 느낌)
- 원탁을 키운 이유: 참고 화면처럼 원탁이 두더지보다 넓어 보이게 + 6마리가 둘러앉을 둘레 확보

## 3. 자리 (seat) — 뒷모습이 안 보이게

### 원칙
- 원탁 중심 = (0, 0, 0). 각 자리는 원탁을 **중심으로 한 원 위**, 두더지는 **원탁 중심을 봄**
- **자리는 원탁의 뒤쪽 반원 + 양 옆에만** 둠 (카메라 반대편). 카메라 쪽(앞쪽)에 앉아 원탁을 보면 등이 카메라를 향하므로 앞쪽 자리는 만들지 않음
  - (요청서의 "앞쪽 반원"은 원탁 중심을 바라보는 조건과 함께면 등이 보여서, "뒷모습 안 보이게"를 우선해 뒤쪽 반원으로 바꿈)
- 옆자리는 원탁 중심을 바라보면 거의 옆모습이라, **카메라 쪽으로 살짝 돌림(cheat)**: 정면과 카메라 방향 사이 각이 45°를 넘으면 넘은 만큼 카메라 쪽으로 돌림, 최대 30° (표의 `cheat`)
- 앉는 높이: 방석 위 sit point = **y 0.13** (sit_points.md 그대로). 두더지 `mole` 노드를 seat 위치·rotation.y에 그대로 두고 `mole_sit_idle` 재생 (발밑이 방석 윗면에 맞음)
- 방석 = sit point에서 **두더지 정면 쪽으로 0.05m** 앞 (원본 `sit_point_cushion_02`가 방석 중심에서 0.05m 뒤에 있는 것과 같은 관계), y 0, rotation.y는 두더지와 같음
- 방석 색: 1번(나) 노랑 `cushion_yellow`, 그 뒤로 하늘색·노랑 번갈아 (`cushion_sky`)
- **"나" = 항상 seat 1** (화면 왼쪽 자리)

### 자리표 (three.js)

`ang` = 원탁 중심에서 본 방향 (Blender 위에서 본 각도, 0° = 화면 오른쪽, 90° = 방 안쪽(뒤), 180° = 화면 왼쪽)

| 배치 | seat | ang | 두더지 position | rotation.y | 방석 position | 방석 | cheat |
|---|---|---|---|---|---|---|---|
| **1마리** | 1 (나) | 165° | (−1.120, 0.13, −0.300) | **0.9937** (56.9°) | (−1.079, 0, −0.273) | 노랑 | 18.1° |
| 2마리 | 1 (나) | 165° | (−1.120, 0.13, −0.300) | 0.9937 (56.9°) | (−1.079, 0, −0.273) | 노랑 | 18.1° |
| | 2 | 15° | (1.120, 0.13, −0.300) | −0.9937 (−56.9°) | (1.079, 0, −0.273) | 하늘 | 18.1° |
| 3마리 | 1 (나) | 165° | (−1.120, 0.13, −0.300) | 0.9937 | (−1.079, 0, −0.273) | 노랑 | 18.1° |
| | 2 | 90° | (0.000, 0.13, −1.160) | 0 | (0.000, 0, −1.110) | 하늘 | 0 |
| | 3 | 15° | (1.120, 0.13, −0.300) | −0.9937 | (1.079, 0, −0.273) | 노랑 | 18.1° |
| 4마리 | 1 (나) | 170° | (−1.201, 0.13, −0.212) | 1.0120 (58.0°) | (−1.159, 0, −0.185) | 노랑 | 22.0° |
| | 2 | 123° | (−0.664, 0.13, −1.023) | 0.5760 (33.0°) | (−0.637, 0, −0.981) | 하늘 | 0 |
| | 3 | 57° | (0.664, 0.13, −1.023) | −0.5760 (−33.0°) | (0.637, 0, −0.981) | 노랑 | 0 |
| | 4 | 10° | (1.201, 0.13, −0.212) | −1.0120 (−58.0°) | (1.159, 0, −0.185) | 하늘 | 22.0° |
| 6마리 | 1 (나) | 200° | (−1.222, 0.13, 0.445) | 1.3963 (80.0°) | (−1.172, 0, 0.453) | 노랑 | 30.0° |
| | 2 | 156° | (−1.188, 0.13, −0.529) | 0.9970 (57.1°) | (−1.146, 0, −0.502) | 하늘 | 8.9° |
| | 3 | 112° | (−0.487, 0.13, −1.205) | 0.3840 (22.0°) | (−0.468, 0, −1.159) | 노랑 | 0 |
| | 4 | 68° | (0.487, 0.13, −1.205) | −0.3840 (−22.0°) | (0.468, 0, −1.159) | 하늘 | 0 |
| | 5 | 24° | (1.188, 0.13, −0.529) | −0.9970 (−57.1°) | (1.146, 0, −0.502) | 노랑 | 8.9° |
| | 6 | −20° | (1.222, 0.13, 0.445) | −1.3963 (−80.0°) | (1.172, 0, 0.453) | 하늘 | 30.0° |

- 원 반지름: 1~3마리 1.16m, 4마리 1.22m, 6마리 1.30m (두더지 루트 기준)
- 5마리는 (제안) 6마리 자리에서 3번 또는 4번을 빼거나, 4마리 표를 쓰고 1명 추가 시 6마리 표로 전환
- 6마리 1·6번은 원탁보다 살짝 앞(카메라 쪽)이지만 cheat 30°로 옆모습(카메라와 65°)까지만 돌아감. 등은 안 보임
- Blender 장면에는 배치마다 컬렉션 `seats_L1/L2/L3/L4/L6`에 방석 `cushion_L{n}_{k}`와 Empty `seat_L{n}_{k}`가 있음 (Empty 커스텀 속성: `angle_deg`, `yaw_to_center_deg`, `cheat_deg`, `is_me`)

### 겹침 확인 (Blender에서 실제 메시로 계산)
- 모든 자리에서 `mole_sit_idle` / `mole_sit_talk` / `mole_drink` 전 구간: 두더지(몸·팔·발톱·코·나비넥타이·안경·컵)와 원탁·찻주전자·찻잔 **겹침 0**. 최소 거리: drink 3.0cm(3마리 2번)~18cm, talk 11.8cm 이상
- 두더지끼리 (모두 동시에 talk 할 때 포함): 겹침 0, 최소 3.3cm (6마리 3·4번)
- 방석끼리, 두더지-남의 방석: 겹침 0
- 카메라에서 가림: 6마리일 때 앞쪽 1·6번 머리가 2·5번 몸 아래쪽을 조금 가리지만 모든 얼굴이 보임. 뒤쪽 3·4번 얼굴은 찻주전자 위로 보임

## 4. 빈자리 표시 `empty_seat_marker` (1마리일 때만)

- 위치 **(1.12, 0.032, −0.30)** = 2마리 배치의 2번 자리 (러그 윗면 0.030 + 2mm) — **v3에서도 그대로** (2마리 2번 자리와 정확히 같은 곳)
- v3 확인: 1~2마리 카메라(close)에서 표시 전체가 원탁 오른쪽에 보이고 원탁에 가리지 않음 (화면 가로 0.72~0.94, 세로 0.64~0.70). 그래서 2마리 배치는 안 바꿈
- **v3 색 변경**: 러그 위에서 잘 안 보여서 `#C08866`쯤 → **`#9A5C40`** (조금 더 진한 갈색). 반지름 0.36·선 두께 0.028·점선 28칸·58%는 그대로
- 반지름 0.36m, 선 두께 0.028m, 점선 28칸·58% — v1 코드 그대로, `position`만 바꿈
- 상대가 들어오면 표시를 지우고 그 자리에 방석(하늘색) + 두더지(rotation.y −0.9937)
- (v2 메모, v3에선 해결됨) 원탁 뒤쪽이라 앞쪽 절반만 또렷이 보임. 더 잘 보이게 하려면 색을 조금 진하게(`#A86E52`) 하거나 `depthTest: false` + renderOrder로 원탁 위에 그리지 말고, 반지름을 0.32로 줄여 원탁 가장자리에서 떨어뜨리기

## 5. 카메라 — 인원수별 프리셋 (v3)

### 프리셋 (three.js 값)

| 프리셋 | 인원 | position | target | 세로 FOV | (Blender 렌즈, 센서 세로 24mm) |
|---|---|---|---|---|---|
| **close** | 1~2마리 | **(0, 2.5, 4.4)** | **(0, 1.2, −0.1)** | **62°** | 19.97mm |
| **medium** | 3~4마리 | **(0, 2.7, 4.7)** | **(0, 1.3, −0.1)** | **65°** | 18.84mm |
| **wide** | 5~6마리 | **(0, 2.9, 5.0)** | **(0, 1.45, −0.1)** | **67.38°** | 18mm (= v2 카메라) |

- aspect 780 / 1420 = 0.5493 (모든 프리셋 같음)
- 세 프리셋 모두 x = 0 정면, target z = −0.1, 약 16~18° 내려다봄 → 같은 각도 계열이라 바뀌어도 어색하지 않음. 카메라가 원탁 쪽으로 다가가면서 FOV만 조금 좁아지는 형태
- 5마리는 wide (자리표는 3번 제안대로)

### 화면 위치 (왼쪽 위 (0,0), 가로·세로 비율)

| | 원탁 윗면 중심 | 1번(나) 두더지 가로 범위 / 폭 | 기타 |
|---|---|---|---|
| close (1마리) | (0.50, 0.65) | 0.05~0.30 / **약 25%** (v2 20%) | 빈자리 표시 0.72~0.94, 세로 0.64~0.70. "나" 발 (0.17, 0.68) |
| close (2마리) | (0.50, 0.65) | 0.05~0.30 | 2번 두더지 0.68~0.97 (베레모 포함) |
| medium (4마리) | (0.50, 0.64) | 0.07~0.30 | 4번 0.70~0.93 |
| wide (6마리) | (0.50, 0.65) | v2와 같음 | 양 끝 두더지 (0.17 / 0.83) |

- close에서는 위쪽 모서리 돔 바깥(어두운 부분)이 안 보임, 천장 램프·가랜드·액자·선반은 다 보임. 러그 아래 빈 바닥은 화면의 약 14% (v2 약 30%)
- medium·wide는 아래쪽 바닥이 조금 더 남음 (뒷자리까지 다 넣으려고)
- wide는 v2처럼 위쪽 모서리에 돔 바깥이 조금 보임 → `scene.background = #E9B597` 근처 권장 (v2와 같음)

### 코드

```js
const CAM_PRESETS = {
  close:  { pos: new THREE.Vector3(0, 2.5, 4.4), target: new THREE.Vector3(0, 1.2,  -0.1), fov: 62    },
  medium: { pos: new THREE.Vector3(0, 2.7, 4.7), target: new THREE.Vector3(0, 1.3,  -0.1), fov: 65    },
  wide:   { pos: new THREE.Vector3(0, 2.9, 5.0), target: new THREE.Vector3(0, 1.45, -0.1), fov: 67.38 },
};
const presetFor = n => (n <= 2 ? 'close' : n <= 4 ? 'medium' : 'wide');

const camera = new THREE.PerspectiveCamera(62, 780 / 1420, 0.1, 100);
const camTarget = new THREE.Vector3();
function setCamera(p) {
  camera.position.copy(p.pos); camTarget.copy(p.target);
  camera.fov = p.fov; camera.updateProjectionMatrix(); camera.lookAt(camTarget);
}
setCamera(CAM_PRESETS[presetFor(memberCount)]);   // 처음엔 바로 맞춤

// 인원 변화 → 0.6초 ease-in-out lerp (position, target, fov 셋 다)
let camTween = null;
function moveCameraTo(n, dur = 0.6) {
  const to = CAM_PRESETS[presetFor(n)];
  camTween = { t: 0, dur,
    fromPos: camera.position.clone(), fromTgt: camTarget.clone(), fromFov: camera.fov, to };
}
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // easeInOutQuad
function updateCamera(dt) {            // 매 프레임 호출
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / camTween.dur);
  const k = ease(camTween.t);
  camera.position.lerpVectors(camTween.fromPos, camTween.to.pos, k);
  camTarget.lerpVectors(camTween.fromTgt, camTween.to.target, k);
  camera.fov = THREE.MathUtils.lerp(camTween.fromFov, camTween.to.fov, k);
  camera.updateProjectionMatrix(); camera.lookAt(camTarget);
  if (camTween.t >= 1) camTween = null;
}
```

- 언제 부르나: 사람이 들어오거나 나갈 때 `moveCameraTo(newCount)`. 프리셋이 같으면(1→2, 3→4) 카메라는 안 움직임
- 순서 제안: **늘 때**는 카메라를 먼저 빼고(0.6초) 그다음 새 두더지 등장 / **줄 때**는 두더지가 나간 뒤 카메라를 당김 → 화면 가장자리에서 두더지가 잘리는 순간이 없음
- 1→2마리: 카메라 그대로, 빈자리 표시를 지우고 그 자리에 2번 두더지
- 중간 lerp 구간에서도 등은 안 보임 (자리 회전은 안 바뀌고 카메라는 x = 0 정면 축 위에서만 움직임)

### 공통 메모 (v2와 같음)
- **뒷모습이 안 보이는 이유**: 카메라는 방 앞쪽(+Z)에만 있고, 자리는 원탁 뒤쪽 반원·양옆에만 있으며 모두 원탁(=카메라 쪽 성분이 있는 방향)을 봄 + 옆자리는 cheat로 카메라 쪽으로 더 돌림. 모든 자리에서 두더지 정면과 카메라 방향 사이 각 ≤ 65° (cheat 값은 v2 카메라 (0, 2.9, 5.0) 기준으로 계산한 그대로 둠 — close/medium에서도 각이 오히려 1~2° 작아짐: 예) 1번 자리 close 43.5°, 4마리 1번 medium 44.2°)
- OrbitControls는 끄는 걸 권장. 돌리게 하려면 좌우 ±10° 이내
- 패널 비율이 바뀌면 `camera.aspect`만 바꿈. 지금보다 가로가 더 좁아지면 close에서 1·2번 두더지 바깥쪽이 먼저 잘림 → 그때는 프리셋 FOV를 몇 도 키울 것

## 6. 조명·렌더러

v1과 같음 (`room_spec.md` 3번, AgX, exposure 1.0). 확인 렌더는 EEVEE 64샘플.

## 7. "나" 이름표

- 기준점 = 1번 자리 바닥: **(−1.12, 0, −0.30)**. 발 앞에 걸치려면 정면 방향 0.3m 앞 **(−0.869, 0, −0.136)**
- 화면 위치 ≈ (0.17, 0.68) (close 카메라. v2 공통 카메라에선 (0.24, 0.67))

## 8. 애니메이션

### 클립 (mole_v1_2_chat.glb, 24fps)

| 클립 | 길이 | 채널 | 용도 |
|---|---|---|---|
| `mole_sit_idle` | 60f = **2.5초** | 전신 (root·lower_body·발·upper_body·팔·눈·컵·몸 shape key) | 앉아 있는 동안 계속 반복 |
| `mole_drink` | 71f = **2.958초** | **상체만** (upper_body·arm_L/R·눈·`coffee_cup`) | 10초마다 커피 마시기. 컵은 이때만 나타남(크기 0→1→0) |
| **`mole_sit_talk`** (새로 만듦) | 60f = **2.5초** | **상체만** (upper_body·arm_L/R·눈) | 말하는 듯한 손짓 |

`mole_sit_talk` 내용: 오른팔을 가슴 높이로 올려 손을 두세 번 까딱 (0.25~0.8초) → 오른팔 내리며 왼팔 올려 까딱 (1.0~1.6초) → 두 팔 조금 같이 올렸다 내림 (1.8~2.2초) → 처음 자세. 그동안 몸은 손 쪽으로 ±5° 살짝 돌고, ±2~3° 고개 끄덕임, 0.9초쯤 눈 한 번 깜빡임. 시작·끝 자세 = `mole_sit_idle` 0프레임 자세 (팔 기본, upper_body 같은 기울기). 손·발톱이 안경·나비넥타이·코·눈과 겹치지 않음 (60프레임 전부 확인)

### 상체만 덮어 쓰기 (중요)

three.js `AnimationMixer`는 같은 트랙을 가진 두 액션을 둘 다 weight 1로 틀면 **평균**이 됨 (덮어쓰기가 아님). 그래서 `mole_sit_idle`을 **하체/상체 두 클립으로 나눠서** 씀:

```js
const UPPER = /^(upper_body|arm_L|arm_R|mole_eye_L|mole_eye_R|coffee_cup)\./;
const idle  = THREE.AnimationClip.findByName(gltf.animations, 'mole_sit_idle');
const idleLower = new THREE.AnimationClip('sit_idle_lower', idle.duration, idle.tracks.filter(t => !UPPER.test(t.name)));
const idleUpper = new THREE.AnimationClip('sit_idle_upper', idle.duration, idle.tracks.filter(t =>  UPPER.test(t.name)));

const mixer = new THREE.AnimationMixer(mole);
const aLower = mixer.clipAction(idleLower).play();            // 항상 weight 1
const aUpper = mixer.clipAction(idleUpper).play();            // 상체 기본
const aDrink = mixer.clipAction(clip('mole_drink'));
const aTalk  = mixer.clipAction(clip('mole_sit_talk'));
for (const a of [aDrink, aTalk]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; }

const FADE = 0.3; // 초
function playOverlay(a) {
  a.reset().setEffectiveWeight(1).play();
  aUpper.crossFadeTo(a, FADE, false);                   // 상체 idle → 동작
  const back = () => {
    if (a.time >= a.getClip().duration - FADE) {
      aUpper.reset().setEffectiveWeight(1).play();      // idle 상체 시간은 하체와 맞춤
      aUpper.time = aLower.time;
      a.crossFadeTo(aUpper, FADE, false);               // 동작 → 상체 idle
      return true;
    }
  };
  return back;  // 매 프레임 back() 호출 (아래 스케줄러에서)
}
```

### 타임라인 (스케줄러)

| 시각 | 동작 |
|---|---|
| 0초~ | `sit_idle` 계속 반복 |
| 4.5초 | `mole_sit_talk` (2.5초) |
| **10초** | `mole_drink` (2.96초) |
| 14.5초 | `mole_sit_talk` |
| **20초** | `mole_drink` |
| … | 10초마다 drink, 그 사이(drink 시작 후 4~7초 랜덤)에 talk 1번 |

```js
// 제안: drink는 정확히 10초 간격, talk는 drink 사이 랜덤
let t = 0, nextDrink = 10, nextTalk = 4.5, pending = null;
function update(dt) {
  t += dt; mixer.update(dt);
  if (pending && pending()) pending = null;
  if (pending) return;                                  // 동작 중엔 새 동작 안 넣음
  if (t >= nextDrink) {
    pending = playOverlay(aDrink); nextDrink += 10;
    nextTalk = t + 4 + Math.random() * 3;               // drink 시작 후 4~7초
  } else if (t >= nextTalk) {
    pending = playOverlay(aTalk); nextTalk = Infinity;
  }
}
```

- 크로스페이드 0.3초
- 실제 채팅 연동(제안): 그 사용자가 메시지를 보낼 때 talk를 바로 재생하고 랜덤 talk는 건너뜀. drink와 겹치면 drink 끝난 뒤
- 여러 마리일 때(제안): 마리마다 시작 시각을 0~10초 랜덤으로 어긋나게 (`nextDrink = 10 + rand*10`), `sit_idle`도 `aLower.time = rand*2.5`로 시작 위상을 다르게 해서 같이 움직이지 않게
- 컵 `coffee_cup`은 drink 때만 보임 (sit_idle에선 크기 0). 원탁 위 찻잔 2개는 장식(그대로)

### 확인 영상

`chat_room_3d_v3_motion.mp4` (390×710, 24fps, 23.5초, **close 카메라**로 다시 렌더, 타임라인은 v2와 같음): 0초 idle → 4.5초 talk → 10초 drink → 14.5초 talk → 20초 drink. Blender NLA로 위 타임라인 그대로 (블렌드 인/아웃 7프레임 ≈ 0.3초)

## 9. 파일

| 파일 | 설명 |
|---|---|
| `chat_room_3d_v3.blend` | 작업 장면. 텍스트 블록 **`layout_v3.py`** (v2의 `layout_v2.py` + 카메라): `apply_layout(n)` (자리만), **`apply_camera(n)`** (카메라만), **`apply_layout_v3(n)`** (둘 다), `CAM_PRESETS` (Blender 좌표) |
| `chat_room_3d_v3_1mole.png` (+ `_2x.png`) | 1마리 close 780×1420 (2x = 1560×2840) |
| `chat_room_3d_v3_2moles.png` | 2마리 close (오른쪽 두더지 talk 중) |
| `chat_room_3d_v3_4moles.png` | 4마리 medium |
| `chat_room_3d_v3_6moles.png` | 6마리 wide (= v2 카메라) |
| `chat_room_3d_v3_motion.mp4` | 1마리 모션 확인 영상 (close) |
| `mole_v1_2_chat.glb` / `mole_v1_2_chat_draco.glb` | v2와 같음 (안 바뀜). **웹에서는 draco** |

- 다른 두더지 액세서리(확인 렌더용): 2번 베레모+니트 목도리, 3번 동그란 안경+꽃 핀, 4번 헤드폰, 5번 새싹+줄무늬 목도리, 6번 고깔모자+별 안경
