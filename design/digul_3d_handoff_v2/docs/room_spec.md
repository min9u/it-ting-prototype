# 방 (room_final_v2) 웹 스펙

> **11/11 v2**: 천장 구멍을 껍데기에서 분리. shell은 `room_shell_v2*.glb`, 구멍은 `room_ceiling_hole_v1.glb` (5번). 구멍이 항상 뚫려 있는 `room_shell_v1*.glb`는 쓰지 않음
> 전달 패키지(zip) 안에서는 `exports/…` = `models/…`, `renders/…` 이미지·영상 = `images/`·`videos/`

- 원본: `room_final_v2.blend` (room_v6 + 11/10 빈백 앉는 높이 수정 + 11/11 천장 구멍 분리. 두더지는 `mole_master.blend`에서 링크, 수정 안 함)
- 방: 지름 6.5m (반지름 3.25m), 돔 높이 4.55m, **돔은 뒤쪽 절반만** 있음 (앞쪽이 열린 단면 구조라 카메라는 앞에서만 봄)
- 좌표: Blender(Z-up) `(x, y, z)` → three.js(Y-up) `(x, z, -y)`. glb에는 이미 변환되어 들어 있음. 1 unit = 1m, 방 중심 바닥 = 원점

## 1. 내보낸 파일

| 파일 | 내용 | 크기 | 재질 방식 |
|---|---|---|---|
| `exports/room_shell_v2_draco_webp.glb` | 방 껍데기: 바닥 `room_floor`, 돔 `room_dome`(막힌 상태), 벽판 `room_wainscot` + `room_wainscot_rail`, 갈빗대 `room_rib_01~05` + `room_rib_hub`, 러그 `round_rug` (11개). Draco + WebP 압축 (**웹에서 이 파일 권장**) | 0.20MB | 조명·그림자 구운 텍스처 1장 (2048px) |
| `exports/room_shell_v2.glb` | 위와 같음, 압축 없는 원본 | 4.0MB | 〃 |
| `exports/room_ceiling_hole_v1.glb` | 천장 구멍 `ceiling_hole` + 흙 부스러기 6개 + 애니메이션 `ceiling_hole_open`·`ceiling_hole_close` (5번) | 40KB | 정점 색 (텍스처 없음) |
| `exports/room_base_v1.glb` | 기본 가구 6개: `bed`, `nightstand`, `round_table`(찻주전자·컵 포함), `cushion_yellow`, `cushion_sky`, `ceiling_lamp` + 앉는 위치 `sit_point_cushion_01` + 가구 밑 접촉 그림자 판 `shadow_*` | 1.5MB | 원래 색(PBR) + AO 텍스처 1장 (1024px) |
| `exports/room_deco_v1.glb` | 분위기 소품: `string_lights`(전구 줄), `bunting`(가랜드), `hanging_plant`(걸이 화분), `frame_01~03`(액자), `shelf`(벽 선반 + 병) | 1.4MB | 조명·그림자 구운 텍스처 1장 (1024px) + 전구만 Emission |

- 2MB 넘는 건 shell뿐이라 shell만 압축본을 만듦 (base·deco는 압축 안 함)
- 이전 버전 `room_shell_v1*.glb`(구멍이 항상 뚫린 껍데기)는 쓰지 않음
- 확인 렌더 `renders/room_final/`:
  - `room_glb_check_v2.png` (패키지에서는 `images/room_glb_check.png`): 최신 glb 4개(shell v2 압축본 + base + deco + 구멍 기본 상태)를 새로 불러와 합친 기본 카메라 뷰. 천장 닫힘
  - 아래는 v1 때 확인 렌더 (천장 구멍이 뚫려 보임)
  - `room_glb_check.png`: 세 glb를 새로 불러와 합친 기본 카메라 뷰
  - `room_glb_vs_blend.png`: 왼쪽 blend 원본, 오른쪽 glb
  - `room_glb_check_shell_draco_webp.png`: shell 압축본으로 바꾼 뷰
  - `camera_limit_test.png`: 카메라 한계값 확인. 왼쪽 위부터 좌우 회전 −20°, +20°, 내려다보기 15°, 거리 4.2m, 3.2m, 기본
- 두더지·관심사 가구는 이 세 파일에 없음 (두더지 `mole_v1_1*.glb`, 관심사 가구는 다음 단계)

### 구운 텍스처 쓰는 법 (중요)

| 파일 | glb 안 재질 | three.js에서 |
|---|---|---|
| shell, deco | 바탕색 검정 + **emissiveMap = 구운 텍스처**, `KHR_materials_emissive_strength` (shell 8, deco 16), specular 0 | GLTFLoader가 그대로 읽음 → 조명이 바뀌어도 밝기 그대로. 텍스처는 "조명 밝기 ÷ 8(16)"으로 저장돼 있고 강도로 되돌림 (밝은 곳이 잘리지 않게) |
| deco 전구 5색 | 원래 색 + emissive (강도 2.2~3.7) | Bloom을 쓰면 전구만 은은하게 빛남 |
| base | 원래 색 PBR + **occlusionTexture(AO, 두 번째 UV)** | 실시간 조명을 받음. AO는 `aoMap`으로 들어가 환경광·AmbientLight에만 적용 |
| base `shadow_*` | 검정 + 텍스처 알파 (alphaMode BLEND) | 가구 밑 부드러운 접촉 그림자. 가구의 자식이라 가구를 옮기면 같이 움직임. `renderOrder`를 바닥보다 뒤로, `depthWrite=false` 권장 |

- shell·deco는 그림자를 구울 때 기본 가구·관심사 가구를 숨기고 구움 (가구가 바뀌어도 바닥에 엉뚱한 그림자가 남지 않게). 천장 램프만 고정이라 같이 넣고 구움
- base AO는 가구마다 따로, 그 가구 + 밑판만 두고 구움 → 위치를 옮겨도 맞음

## 2. 렌더러·색

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;   // Blender 기본 View Transform(AgX)과 맞춤
renderer.toneMappingExposure = 1.0;
scene.background = new THREE.Color(0x805B38);    // 돔 바깥(흙). 확인 렌더 배경과 같은 색
```

## 3. 조명 (base 가구·관심사 가구·두더지용)

shell·deco는 조명이 구워져 있어서 아래 조명의 영향을 받지 않음. 실시간 조명은 기본 가구·관심사 가구·두더지만 비춤.
three.js 값은 Blender와 같은 밝기 단위로 맞춘 값 (glTF 표준 변환값 ×683을 쓰면 구운 텍스처보다 683배 밝아지므로 쓰지 말 것).

| 이름 | 종류 | 색 (선형 RGB / hex) | Blender 값 | 위치 Blender → three.js | three.js 권장 |
|---|---|---|---|---|---|
| `warm_point_light` | 점광원 (메인, 천장 램프 아래) | (1.00, 0.72, 0.45) / `#FFDDB3` | 608W, 반지름 0.6m | (0, 0.455, 2.436) → (0, 2.436, −0.455) | `PointLight(0xFFDDB3, 48.4, 0, 2)` (= 608W ÷ 4π), 그림자 켜기 |
| `warm_fill_light` | 면광원 3×3m (앞쪽 위 보조광) | (1.00, 0.80, 0.60) / `#FFE7CB` | 144W, X축 74.4° 기울임 | (0, −4.55, 2.86) → (0, 2.86, 4.55) | `RectAreaLight(0xFFE7CB, 5.1, 3, 3)`, 방 중심 (0, 1.0, 0)을 바라보게 (= 144W ÷ (π·9m²)). 대신 `DirectionalLight(0xFFE7CB, 1.8)`로 써도 비슷 |
| 환경광 (World) | 배경 | (0.871, 0.456, 0.195) / `#F0B47A` (벽 팔레트색) | 세기 0.25 | | `AmbientLight(0xF0B47A, 0.785)` (= 0.25 × π) |
| 전구 5색 (deco) | Emission | 노랑 `#F5C452`, 하늘 `#A8D4EE`, 크림 `#F7E6C8`, 초록 `#8CC56A`, 주황 `#E8743B` | Emission 세기 4 | | glb에 들어 있음 (빛을 내지는 않음) |

- `room_glb_check.png`는 위 값과 같은 조명(Blender EEVEE)으로 렌더한 결과

## 4. 카메라

| 항목 | 값 |
|---|---|
| 기본 위치 | Blender (0, −6.37, 1.56) → three.js **(0, 1.56, 6.37)** |
| 바라보는 점 (orbit target) | three.js **(0, 2.04, 0)** (방 중심 위 2.04m. 기본 카메라가 4.3° 올려다봄) |
| 화각 | 렌즈 30mm / 센서 36mm. 4:3 화면에서 **세로 FOV 48.5°** (가로 61.9°) → `PerspectiveCamera(48.5, aspect, 0.1, 100)` |
| 세로 화면(모바일) | 가로 화각 61.9°를 유지하도록 `fov = 2·atan(tan(30.96°) / aspect)` (돔 양옆이 잘리지 않게) |
| 줌 (target까지 거리) | **최소 3.2m ~ 최대 6.37m** (기본 = 최대). 6.37m보다 멀어지면 바닥 앞 가장자리·돔 바깥이 보임. 3.2m는 두더지·원탁이 크게 보이는 정도 |
| 좌우 회전 (yaw) | **±15° 권장** (±20°까지 확인: 돔의 잘린 옆면이 보이기 시작) |
| 위아래 (pitch) | **기본(4.3° 올려다봄) ~ 15° 내려다봄**. 그 이상 내려다보면 바닥 앞쪽 단면이 보임 |
| 패닝 | 끄기 (target 고정) |

```js
controls.target.set(0, 2.04, 0);
controls.minDistance = 3.2;  controls.maxDistance = 6.37;
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-15);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(15);
controls.minPolarAngle = THREE.MathUtils.degToRad(75);    // 15° 내려다봄
controls.maxPolarAngle = THREE.MathUtils.degToRad(94.3);  // 기본(4.3° 올려다봄)
controls.enablePan = false;
```

- 배치 규칙: 카메라 → 방 중앙(두더지 자리) 앞쪽은 비워 둠, 앞쪽 양옆은 0.5m 이하 가구만, 키 큰 가구는 뒤쪽 양옆. 지금 base·deco는 모두 이 규칙 안에 있음 (기본 뷰에서 두더지 가림 없음)

## 5. 천장 구멍과 착지 (`ceiling_hole_open` → `mole_room_drop` → `ceiling_hole_close`)

> 11/11 v2: 구멍이 항상 뚫려 있지 않게 바뀜. 평소에는 돔 천장이 막혀 있고, 두더지가 들어올 때만 열렸다 닫힘.
> 원본 `room_final_v2.blend` (v1 + 구멍 분리). v1 스펙은 `docs/room_spec_v1.md`에 보관.

### 파일

| 파일 | 내용 |
|---|---|
| `exports/room_shell_v2.glb` (+ `room_shell_v2_draco_webp.glb`) | 구멍을 뺀 방 껍데기. 돔이 막힌 상태로 **다시 구움** (`textures/room_final/T_room_shell_baked_v2.png`). v1 대신 이걸 씀 |
| `exports/room_ceiling_hole_v1.glb` | 구멍 `ceiling_hole` + 흙 부스러기 `ceiling_hole_crumb_01~06` + 애니메이션 2개 |

- `ceiling_hole` 중심 Blender (1.784, 0.739, 3.523), 다 열렸을 때 지름 약 1.4m (흙 테두리 포함). 원점은 구멍 중심의 돔 면 바로 뒤 (돔 바깥쪽 1.7cm)
- **기본 상태(애니메이션 재생 전) = 닫힘**: 구멍·부스러기 모두 크기 0.001로 돔 뒤에 숨어 있음. 안 보이게 하려고 `visible = false`로 둬도 됨
- 천장 램프와 안 겹침: 다 열렸을 때(1.08배) 구멍 가장자리 ~ 램프 갓 사이 수평 거리 **0.89m**. 두더지가 떨어지면서 램프에 가장 가까워지는 순간(drop 15프레임)에도 램프 메시와 **13cm** 떨어져 있음 (겹치지 않음)

### 애니메이션 (24fps)

| 이름 | 길이 | 움직임 | 들어 있는 노드 |
|---|---|---|---|
| `ceiling_hole_open` | 0.417초 (11프레임) | 크기 0 → 1.08 → 1로 동그랗게 열리며 살짝 돌아감. 부스러기 6개가 테두리에서 떨어지다(약 0.5~0.8m) 작아져 사라짐 | `ceiling_hole`, `ceiling_hole_crumb_01~06` |
| `mole_room_drop` | 1.958초 (48프레임) | 두더지가 구멍에서 떨어져 방 중앙 (0, 0, 0.03)에 착지. **착지 = 시작 후 1.0초 (25프레임)** | `mole_v1_1*.glb` 안 |
| `ceiling_hole_close` | 0.583초 (15프레임) | 1 → 1.06(흙이 밀려 나옴) → 0으로 오므라들며 돌아감. 끝나면 돔과 구분 안 됨 | `ceiling_hole` |

### 재생 순서와 타이밍 (open 시작 = 0초)

| 시각 | 일어나는 일 |
|---|---|
| 0.000초 | `ceiling_hole_open` 재생. 두더지는 **숨김** (drop 첫 프레임 두더지는 구멍 속에 머리가 걸쳐 있으므로 열리기 전엔 보이면 안 됨) |
| 0.417초 | open 끝 (구멍은 열린 채 멈춤). 두더지 보이기 + `mole_room_drop` 재생 |
| 1.417초 | 두더지 착지 (drop 시작 + 1.0초) |
| **1.500초** | `ceiling_hole_close` 재생 (drop 시작 + 1.083초 = drop 27프레임. 착지 직후 0.08초 쉬고 닫힘) |
| 2.083초 | 구멍 닫힘 끝 (이후 `ceiling_hole` 숨겨도 됨) |
| 2.375초 | `mole_room_drop` 끝 → `mole_idle` 등으로 이어감 |

```js
// holeGltf = room_ceiling_hole_v1.glb, moleGltf = mole glb
const holeMixer = new THREE.AnimationMixer(holeGltf.scene);
const clip = (g, n) => THREE.AnimationClip.findByName(g.animations, n);
const play = (mixer, c) => { const a = mixer.clipAction(c); a.reset(); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play(); return a; };

const open = play(holeMixer, clip(holeGltf, 'ceiling_hole_open'));
mole.visible = false;
setTimeout(() => { mole.visible = true; play(moleMixer, clip(moleGltf, 'mole_room_drop')); }, 417);
setTimeout(() => { open.stop(); play(holeMixer, clip(holeGltf, 'ceiling_hole_close')); }, 1500);
```

- 세 애니메이션 모두 **한 번만 재생(LoopOnce) + clampWhenFinished** (반복하면 구멍이 계속 열렸다 닫힘)
- close를 시작할 때 open 액션은 `stop()` (둘 다 `ceiling_hole` 크기를 움직이므로 겹치면 섞임)
- 타이머 대신 mixer 시간으로 맞춰도 됨: drop 액션 `time >= 1.083`이 되면 close 시작
- `mole`은 방 중앙 (0, 0.03, 0)(three.js)에 두고 재생하면 구멍에서 떨어짐 (`mole_room_drop` 첫 프레임 두더지 위치 (1.820, 0.754, 3.559)는 구멍 중심과 3.9cm 차이). 구멍 위치를 바꾸면 안 맞으니 `ceiling_hole`은 고정
- 확인 영상: `renders/room_final/ceiling_drop_check.mp4` (왼쪽 기본 카메라, 오른쪽 가까운 뷰. 앞은 실제 속도, 뒤는 0.5배 느리게)

## 6. 앉는 위치

| 이름 | 붙은 가구 | 들어 있는 glb | 위치 (Blender, 월드) | 앉는 높이 |
|---|---|---|---|---|
| `sit_point_cushion_01` | `cushion_sky`의 자식 | `room_base_v1.glb` | (0.06, 1.55, 0.13) | 0.13m |
| `sit_point_chair_01` | 빈백 `bean_bag` (game 관심사) | 아직 없음 (관심사 가구 내보낼 때 같이) | (−1.50, −0.60, **0.24**) | 0.24m (11/10 빈백 수정값) |

- 가구의 자식이라 가구를 옮기면 앉는 위치도 같이 움직임. extras: `furniture`, `seat_type`, `seat_height_m`, `approach_distance_m`, `sit_point`
- 사용법(걸어오기 → 앉기 → 일어나기)은 `renders/room_anim/sit_points.md` (패키지에서는 `docs/sit_points.md`)

## 7. 가구 카탈로그 `docs/furniture_catalog.json`

가구 1개 = JSON 1줄. 배열 `[ ... ]` 안에 한 줄씩, 줄 끝에 쉼표 (마지막 줄만 쉼표 없음). 새 가구는 맨 아래에 한 줄 추가.

```json
{"id": "bed", "name_ko": "침대", "category": "base", "interest": null, "glb": "room_base_v1.glb", "node": "bed", "size_m": {"w": 0.97, "d": 1.8, "h": 0.7}, "sit_point": null, "source": [{"type": "poly_pizza", "model": "Bed Single", "author": "Kenney", "license": "CC0 1.0", "url": "https://poly.pizza/m/sn8az3odMR", "part": "침대 전체"}], "pos_blender": [-2.45, -0.3, 0.0]}
```

| 키 | 값 |
|---|---|
| `id` | 가구 이름 (영어 소문자_언더바). glb 안 노드 이름과 같음 |
| `name_ko` | 한글 이름 |
| `category` | `base` / `deco` / `interest` |
| `interest` | 관심사 (`music`, `exercise`, `game`, `reading`, `cooking`, `drawing`, `photo`, `plants`, `movie`, `travel`). base·deco는 `null` |
| `glb` | 들어 있는 glb 파일 이름. 아직 안 내보냈으면 `null` |
| `node` | glb 안에서 찾을 노드 이름 (`getObjectByName`) |
| `size_m` | 가로 `w`(x) · 세로 `d`(깊이, Blender y) · 높이 `h` (m, 자식 전부 포함한 바운딩 박스) |
| `sit_point` | 붙어 있는 앉는 위치 이름, 없으면 `null` |
| `source` | 출처 목록. 직접 만든 건 `{"type": "self"}`, Poly Pizza는 `{"type": "poly_pizza", "model", "author", "license", "url"}`. 여러 부품이 섞이면 `part`로 구분 |
| `pos_blender` | 지금 방에 놓인 위치 (Blender 좌표, 참고용) |

- 지금 44줄: base 6, deco 7, 관심사 31 (관심사는 `glb: null`, 다음 단계에서 채움)
- 가구를 추가할 때는 이 파일과 `credits.md`를 같이 고침 (CLAUDE.md 규칙)
