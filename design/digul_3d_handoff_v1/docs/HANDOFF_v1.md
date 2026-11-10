# 디굴디굴 3D 1차 전달 (v1, 2026-11-10)

두더지 캐릭터와 지상(굴 입구) 소품을 먼저 전달합니다. 방·가구·가구 낙하는 아직 작업 중입니다.
zip `digul_3d_handoff_v1_20261110.zip` 기준 경로입니다.

```
models/  mole_v1_draco_webp.glb (웹용), mole_v1.glb (원본 백업), ground_props_v1.glb
docs/    HANDOFF_v1.md (이 문서), animation_list.md, ground_move_spec.md, cam_burrow_enter.md, sit_points.md, credits.md
videos/  all_animations.mp4 (동작 19개 전부) + 화면별 확인 영상
```

## 1. 전달 파일과 상태

| 파일 | 내용 | 크기 | 상태 |
|---|---|---|---|
| `models/mole_v1_draco_webp.glb` | 두더지 + 전체 애니메이션 19개 (**웹에서 이 파일 사용 권장**) | 0.65MB | 확정 |
| `mole_v1_draco.glb` | 위와 같음, 메시만 Draco 압축 (텍스처는 PNG 그대로). 용량이 거의 안 줄어 zip에는 넣지 않음, 필요하면 요청 | 6.4MB | 확정 |
| `models/mole_v1.glb` | 위와 같음, 압축 없는 원본 | 6.8MB | 확정 |
| `models/ground_props_v1.glb` | 굴 입구, 표지판, 풀 3종, 꽃 2종, 돌 2종 (오브젝트별 분리) | 0.22MB | 확정 |
| 가구 낙하 (`dust_puff.glb`, `furniture_drop_spec.md`) | 가구 착지 먼지, 가구 낙하 규칙 | | **작업 중** (zip에 없음. 영상 `videos/furniture_drop_*.mp4`만 참고용) |
| 방, 가구 배치 | | | **작업 중** (아직 전달 안 함) |

### 압축본 안내
- `mole_v1.glb` 6.8MB 중 5.9MB가 털 텍스처 PNG 2장(노멀 3.9MB, 색 2.0MB). Draco는 메시만 줄여서 6.4MB로 거의 그대로
- 그래서 **Draco + 텍스처 WebP** 버전(`mole_v1_draco_webp.glb`, 0.65MB)을 같이 만듦. 다시 불러와 원본과 비교한 결과 털 결·볼터치·엉덩이 모양 차이 거의 없음 (확정본 폴더 `이미지/전달확인/glb_compress_compare.png`)
- three.js에서 압축본을 읽으려면:
  ```js
  const draco = new DRACOLoader(); draco.setDecoderPath('/draco/');   // three/examples/jsm/libs/draco/
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  ```
  WebP 텍스처(`EXT_texture_webp`)는 GLTFLoader가 기본 지원 (iOS Safari 14 이상)
- `ground_props_v1.glb`는 0.22MB라 압축본 없음

### 세 두더지 파일 공통 확인 결과 (glb를 다시 불러와 확인)
- 애니메이션 19개, 이름·길이 아래 2번 표와 같음
- 셰이프 키(morph) 3개: `butt_squish_L`, `butt_squish_R`, `butt_bounce` (`mole_body` 메시, 기본값 0)
- 뼈대(skin) 1개, 뼈 7개: `root`, `lower_body`, `upper_body`, `arm_L`, `arm_R`, `foot_L`, `foot_R`
- 텍스처 2장: `T_mole_body_BaseColor_fur_blush_b_v5`, `T_mole_body_Normal_fur_v5`
- `ground_props_v1.glb`는 움직이지 않는 소품이라 애니메이션·셰이프 키·뼈대 없음 (정상). 노드 19개, 루트 9개(`burrow`, `signpost`, `grass_tuft_01~03`, `flower_daisy`, `flower_small`, `pebble_01~02`)

## 2. 애니메이션 목록 (이름 고정)

아래 이름은 앞으로 바꾸지 않습니다. 동작을 고쳐도 같은 이름으로 내보냅니다.
24fps, 모든 애니메이션은 0초에서 시작. three.js: `THREE.AnimationClip.findByName(gltf.animations, '이름')`

| 이름 | 길이 | 반복 | 쓰이는 화면 |
|---|---|---|---|
| `mole_room_drop` | 1.958s | X | 방: 처음 들어올 때 천장 구멍에서 떨어져 착지 |
| `mole_idle` | 2.000s | O | 방·지상: 서 있기 |
| `mole_walk` | 1.000s | O | 방·지상: 걷기 (제자리 동작, 이동은 코드에서 0.32m/s) |
| `mole_drink` | 2.958s | X | 방: 커피 마시기 (상체만. 서 있거나 앉은 동작 위에 겹쳐 재생) |
| `mole_sit_cushion` | 1.125s | X | 방: 방석에 앉기 |
| `mole_sit_idle` | 2.500s | O | 방: 방석에 앉아 있기 |
| `mole_stand_up_cushion` | 0.750s | X | 방: 방석에서 일어나기 |
| `mole_sit_chair` | 1.250s | X | 방: 의자(높이 0.45m)에 앉기 |
| `mole_sit_idle_chair` | 2.500s | O | 방: 의자·빈백에 앉아 있기 |
| `mole_stand_up_chair` | 0.750s | X | 방: 의자에서 일어나기 |
| `mole_sit_beanbag` | 1.250s | X | 방: 빈백(높이 0.24m)에 앉기 |
| `mole_stand_up_beanbag` | 0.750s | X | 방: 빈백에서 일어나기 |
| `mole_burrow_exit` | 1.625s | X | 지상: 굴에서 나오기 |
| `mole_burrow_enter` | 2.292s | X | 지상: 굴로 들어가기 (앞으로 숙여 다이브 → 엉덩이 씰룩 3번 + 발 파닥 → 쏙) |
| `mole_butt_wiggle` | 1.500s | O | 지상: 굴 입구에 엉덩이 내밀고 씰룩 |
| `mole_ground_scratch` | 1.917s | X | 지상: 굴 입구가 아닌 잔디를 눌렀을 때 헛발질 1회 |
| `mole_look_around` | 3.000s | O | 지상: 가만히 있을 때 두리번 |
| `mole_turn` | 0.500s | X | 지상: 방향 전환 (발 동작만, 몸 회전은 코드에서) |
| `mole_greet` | 1.500s | X | 지상: 다른 두더지와 인사 |

- 기준 위치(두더지를 둘 곳), 이어 붙이는 방법, 움직이는 부분은 `docs/animation_list.md`
- 눈 깜빡임은 눈 노드(`mole_eye_L/R`) 크기 애니메이션, 커피잔(`coffee_cup`)은 평소 크기 0.0001로 숨어 있다가 `mole_drink`에서 나타남

## 3. 단위·원점·방향

| 항목 | 값 |
|---|---|
| 단위 | **1 unit = 1m**. 두더지 키 약 1m |
| 좌표 변환 | Blender는 Z-up, glTF·three.js는 Y-up. 위치 `(x, y, z)` → `(x, z, -y)` (glb에는 이미 변환되어 들어 있음) |
| 두더지 원점 | 두 발 사이 바닥 중앙 (`mole` 노드). 바닥 높이에 그대로 두면 발이 땅에 닿음 (지상에서는 지면보다 0~2cm 아래 권장) |
| 두더지 정면 | Blender **-Y** = three.js **+Z** (rotation.y = 0이면 카메라(+Z 쪽)를 바라봄) |
| 소품 원점 | 각 소품 바닥 중앙. 정면 Blender -Y = three.js +Z |
| 굴 입구 `burrow` 원점 | 굴 중심. **지면 높이 − 0.033m**에 둠. 다이브 방향은 Blender +Y = three.js **−Z** (카메라 반대쪽) |

## 4. 엉덩이로 들어가기 규칙 (굴 들어갈 때)

- 굴에 들어갈 때는 **어느 방향에서 왔든 항상 카메라를 등지고(굴을 바라보고) 들어감**. 다이브 중 카메라에 배·발바닥이 보이면 안 됨
- 순서: **굴 앞 도착 → `mole_turn`으로 카메라를 등지게 돌기 → `mole_burrow_enter`**
  1. 도착점 = 굴 중심에서 **카메라 쪽으로 1.75m** (탐색 화면: three.js `굴 중심 + (0, 0, +1.75)`)
  2. 목표 방향 `targetYaw = atan2(굴.x − 도착.x, 굴.z − 도착.z)` (three.js, 정면 +Z)
  3. `Δ = targetYaw − 현재 yaw`를 −180°~180°로 정리, `mole_turn`(0.5초)과 함께 smoothstep으로 돌림. |Δ| > 120°면 두 번에 나눠서
  4. 다 돌면 두더지를 **굴 중심**으로 옮기고 회전 = targetYaw(탐색 화면 0°)로 맞춘 뒤 `mole_burrow_enter` 재생 (시작 자세가 도착점에 선 자세라 끊김 없음)
- 다이브는 옆으로 비틀지 않고 앞으로만 숙여 머리부터 들어감. 엉덩이는 카메라 쪽으로 들린 채 씰룩 3번, 이때 두 발이 엉덩이 위로 나와 파닥거림 → 쏙
- 나올 때는 `mole_burrow_exit`를 굴 중심에 회전 0으로 두고 재생 → 굴 앞 1.75m(카메라 쪽)에 착지
- 자세한 수치: `docs/ground_move_spec.md` 5번·5-1번

## 5. 굴 입구 지면 처리

- `burrow` 안에 흙더미 + **깊이 1.2m 깔때기 굴**(`burrow_mound`)이 들어 있음. 굴 안쪽은 버텍스 컬러(`COLOR_0`)로 아래로 갈수록 어두워짐 → GLTFLoader가 `vertexColors`를 자동으로 켬 (끄면 굴이 밝게 보임)
- 지면은 굴 중심에서 **반지름 0.8m 원**만큼 안 보이게 해야 함 (가장자리는 흙더미가 덮음). 두 가지 방법 중 하나
  - A. 지면 메시에 같은 크기 구멍을 미리 내기 (CSG 등)
  - B. 스텐실: `burrow_ground_mask`(반지름 0.8m 원판)를 화면에 그리지 않고 스텐실에만 씀
    - 마스크: `colorWrite=false`, `depthWrite=false`, `stencilWrite=true`, `stencilRef=1`, `stencilZPass=THREE.ReplaceStencilOp`, 지면보다 먼저 그리기(`renderOrder`)
    - 지면: `stencilWrite=true`, `stencilRef=1`, `stencilFunc=THREE.NotEqualStencilFunc` → 원 안쪽 지면만 빠짐
    - 주의: 마스크에 `depthWrite`를 켜면 굴 속 두더지까지 가려짐
- 두더지는 땅을 뚫지 않고 굴 안 어둠 속으로 사라짐
- 흙 튀김 효과(`dirt_burst`)는 이번 전달에 없음

## 6. 참고 문서와 영상

| 문서 (`docs/`) | 내용 |
|---|---|
| `animation_list.md` | 애니메이션 전체 목록, 기준 위치, 변경 이력 |
| `ground_move_spec.md` | 지상 걷기 속도(재생 속도 공식), 언덕, 방향 전환, 굴 나오기·들어가기, 굴 구조, 소품 사용법 |
| `cam_burrow_enter.md` | 굴 들어가기 카메라 연출 수치 (굴 기준 좌표, 페이드) |
| `sit_points.md` | 방의 앉는 위치(방석·빈백), 이동 지점 |
| `credits.md` | 출처 표기. 모델 파일은 모두 직접 제작, 방 영상 배경에 Poly Pizza 가구(CC-BY 3개 포함) |

- 문서 안의 `exports/mole.glb` = `models/mole_v1.glb`, `exports/ground_props.glb` = `models/ground_props_v1.glb`. `renders/…` 경로는 원작업 폴더 기준이라 무시해도 됨

| 영상 (`videos/`) | 내용 |
|---|---|
| `all_animations.mp4` | 동작 19개를 위 2번 표 순서로 하나씩 (반복 동작은 2번). 방 동작은 방에서, 지상 동작은 굴 입구 앞에서. 화면 아래에 이름·화면·반복·길이 표시 |
| `ground_walk_reference.mp4` | 지상 전체 흐름: 나오기 → 두리번 → 언덕 걷기 → 인사 → 카메라 등지게 돌기 → 들어가기 |
| `mole_burrow_enter_v5.mp4`, `mole_burrow_enter_v5_cam.mp4`, `mole_burrow_exit_v5.mp4` | 굴 들어가기(고정 카메라 / 카메라 연출), 나오기 |
| `butt_v6_wiggle.mp4`, `mole_ground_scratch.mp4` | 굴 입구 엉덩이 씰룩, 잔디 헛발질 |
| `mole_room_drop_v3.mp4`, `mole_idle_v3.mp4`, `mole_walk_v3.mp4`, `mole_drink_v4.mp4`, `mole_sit_sequence_v3.mp4` | 방: 떨어지기, 서 있기, 걷기, 마시기, 앉기(방석·빈백) |
| `furniture_drop_reference.mp4`, `furniture_drop_single_slow.mp4` | 가구 낙하 (**작업 중**, 참고용) |

- 영상 속 방 배치는 작업 중이라 최종과 다를 수 있음. `all_animations.mp4`의 의자 앉기 장면은 의자 옆 러닝머신을 숨기고 찍음
