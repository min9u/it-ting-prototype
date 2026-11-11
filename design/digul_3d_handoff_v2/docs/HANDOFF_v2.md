# 디굴디굴 3D 2차 전달 v2 (2026-11-11)

zip `digul_3d_handoff_v2_20261111.zip` 기준 경로. 1차(v1, v1.1)에서 받은 파일과 문서는 그대로 유효하고, 이번에는 아래만 새로 보냄.

## 0. 이번 전달 요약

1. **방 첫 전달**: 방 껍데기 + 기본 가구 + 소품, 그리고 두더지가 들어올 때 열렸다 닫히는 천장 구멍
2. **액세서리 착용 규칙 변경**: 최대 2개 → 부위별 1개씩 최대 4개 (7번)
3. **두더지·액세서리 glb는 바뀌지 않음** → 이번 zip에 없음. v1.1의 `mole_v1_1*.glb`, `accessories_v1.glb`를 그대로 사용 (파일 내용이 v1.1과 바이트 단위로 같음을 확인)

## 1. 방 파일 (`models/`)

| 파일 | 내용 | 크기 | 재질·굽기 |
|---|---|---|---|
| `room_shell_v2_draco_webp.glb` | 방 껍데기 11개: 바닥, 돔(천장 막힘), 벽판 + 난간, 갈빗대 5 + 가운데 고리, 둥근 러그. **웹에서 이 파일 권장** (Draco + WebP) | 0.20MB | 조명·그림자를 구운 텍스처 1장 (2048px) |
| `room_shell_v2.glb` | 위와 같음, 압축 없는 원본 | 4.0MB | 〃 |
| `room_base_v1.glb` | 기본 가구 6개: `bed`, `nightstand`, `round_table`, `cushion_yellow`, `cushion_sky`, `ceiling_lamp` + 앉는 위치 `sit_point_cushion_01` + 가구 밑 접촉 그림자 `shadow_*` | 1.5MB | 원래 색(PBR) + AO 텍스처 1장 (1024px) |
| `room_deco_v1.glb` | 소품 7개: `string_lights`, `bunting`, `hanging_plant`, `frame_01~03`, `shelf` | 1.4MB | 구운 텍스처 1장 (1024px) + 전구만 Emission |
| `room_ceiling_hole_v1.glb` | 천장 구멍 `ceiling_hole` + 흙 부스러기 `ceiling_hole_crumb_01~06` + **애니메이션 `ceiling_hole_open`, `ceiling_hole_close`** | 40KB | 정점 색 (텍스처 없음) |

- **천장 구멍 애니메이션은 `room_ceiling_hole_v1.glb`에만 있음.** 껍데기 `room_shell_v2*`에는 구멍이 없음 (돔이 막힌 상태로 다시 구움)
- 작업 폴더의 `room_shell_v1*.glb`는 구멍이 항상 뚫려 있는 이전 버전이라 이번 전달에서 뺌
- base·deco는 2MB 미만이라 압축본 없음
- 확인: 네 파일을 새로 불러와 합친 뷰 `images/room_glb_check.png` (천장 닫힌 기본 상태)

### 굽기(bake) 처리 방식

| 파일 | three.js에서 |
|---|---|
| shell, deco | 바탕색 검정 + `emissiveMap` = 구운 텍스처 + `KHR_materials_emissive_strength` (shell 8, deco 16). GLTFLoader가 그대로 읽음. **실시간 조명을 받지 않음** (조명을 바꿔도 밝기 그대로). 텍스처는 "밝기 ÷ 8(16)"으로 저장돼 있고 강도로 되돌림 |
| deco 전구 5색 | 원래 색 + emissive (강도 2.2~3.7). Bloom을 쓰면 전구만 은은하게 빛남 |
| base | 원래 색 PBR + `occlusionTexture`(AO, 두 번째 UV) → `aoMap`. **실시간 조명을 받음** |
| base `shadow_*` | 검정 + 텍스처 알파 (BLEND). 가구의 자식이라 같이 움직임. `depthWrite=false`, `renderOrder`를 바닥보다 뒤로 |

- shell·deco 그림자는 가구를 숨기고 구움 → 가구를 바꿔도 바닥에 엉뚱한 그림자가 남지 않음 (천장 램프만 고정이라 같이 구움)
- base AO는 가구마다 따로 구움 → 위치를 옮겨도 맞음

### 렌더러·조명 색상값

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
scene.background = new THREE.Color(0x805B38);   // 돔 바깥 흙색
```

| 조명 | 색 | three.js |
|---|---|---|
| 메인 점광원 (천장 램프 아래) | `#FFDDB3` | `PointLight(0xFFDDB3, 48.4, 0, 2)` 위치 (0, 2.436, −0.455), 그림자 켜기 |
| 앞쪽 위 보조광 | `#FFE7CB` | `RectAreaLight(0xFFE7CB, 5.1, 3, 3)` 위치 (0, 2.86, 4.55), (0, 1.0, 0)을 바라봄. 또는 `DirectionalLight(0xFFE7CB, 1.8)` |
| 환경광 | `#F0B47A` | `AmbientLight(0xF0B47A, 0.785)` |
| 전구 5색 (glb 안) | `#F5C452` `#A8D4EE` `#F7E6C8` `#8CC56A` `#E8743B` | Emission만 (빛을 내지 않음) |

- 실시간 조명은 base 가구·관심사 가구·두더지만 비춤. glTF 표준 와트 변환(×683)은 쓰지 말 것 (구운 텍스처보다 683배 밝아짐)

### 카메라

| 항목 | 값 |
|---|---|
| 기본 위치 / target | (0, 1.56, 6.37) / (0, 2.04, 0) |
| 화각 | `PerspectiveCamera(48.5, aspect, 0.1, 100)` (4:3 기준 세로 FOV). 세로 화면은 `fov = 2·atan(tan(30.96°) / aspect)` |
| 줌 | 3.2m ~ 6.37m (기본 = 최대) |
| 좌우 | ±15° |
| 위아래 | 기본(4.3° 올려다봄) ~ 15° 내려다봄 (`minPolarAngle` 75°, `maxPolarAngle` 94.3°) |
| 패닝 | 끄기 |

### 좌표·단위

- 1 unit = 1m. 방 중심 바닥 = 원점. 방 지름 6.5m, 돔 높이 4.55m. 돔은 **뒤쪽 절반만** 있음 (앞은 열린 단면, 카메라는 앞에서만 봄)
- glb는 three.js 좌표(Y-up)로 이미 변환됨. 문서의 Blender 좌표 `(x, y, z)` → three.js `(x, z, −y)`
- 두더지 자리: 방 중앙 (0, 0.03, 0) (러그 위)

자세한 값과 코드: `docs/room_spec.md` 1~4번

## 2. 천장 구멍 재생 순서 (`ceiling_hole_open` → `mole_room_drop` → `ceiling_hole_close`)

평소에는 돔이 막혀 있음. 구멍은 기본 상태가 **닫힘**(크기 0.001로 돔 뒤에 숨어 있음).

| 시각 (open 시작 = 0) | 일어나는 일 |
|---|---|
| 0.000초 | `ceiling_hole_open` 재생 (0.417초). 두더지는 **숨김** |
| 0.417초 | 두더지 보이기 + `mole_room_drop` 재생 (1.958초) |
| 1.417초 | 두더지 착지 (drop + 1.0초) |
| 1.500초 | `ceiling_hole_close` 재생 (0.583초). drop 액션 `time >= 1.083`으로 맞춰도 됨 |
| 2.083초 | 구멍 닫힘 끝 |
| 2.375초 | drop 끝 → `mole_idle` 등 |

- 셋 다 `LoopOnce` + `clampWhenFinished`. close를 시작할 때 open 액션은 `stop()`
- 두더지는 방 중앙 (0, 0.03, 0)에 두고 재생 (drop 첫 프레임이 구멍 위치). `ceiling_hole`은 옮기지 말 것
- 천장 램프와 겹치지 않음 (구멍 가장자리 ~ 램프 0.89m, 떨어지는 두더지 ~ 램프 최소 13cm)
- 코드: `docs/room_spec.md` 5번. 영상: `videos/ceiling_drop_check.mp4` (왼쪽 기본 카메라, 오른쪽 가까운 뷰. 실제 속도 → 0.5배)

## 3. 가구 카탈로그 `docs/furniture_catalog.json`

- **가구는 카탈로그 기준으로 불러오기.** 가구는 앞으로 계속 추가됨 (관심사 가구 31개가 다음 단계). 코드에 가구 이름을 직접 적지 말고 이 파일을 읽어서 처리
- 가구 1개 = JSON 1줄. 새 가구는 맨 아래에 한 줄씩 추가됨

| 키 | 값 |
|---|---|
| `id` / `node` | 가구 이름 = glb 안 노드 이름 (`getObjectByName(node)`) |
| `name_ko` | 한글 이름 |
| `category` | `base` / `deco` / `interest` |
| `interest` | 관심사 (`music`, `exercise`, `game`, `reading`, `cooking`, `drawing`, `photo`, `plants`, `movie`, `travel`). base·deco는 `null` |
| `glb` | 들어 있는 glb. **`null`이면 아직 안 보낸 가구** (건너뛰기) |
| `size_m` | `w`·`d`·`h` (m) |
| `sit_point` | 앉는 위치 이름 또는 `null` |
| `source` | 출처 (직접 제작 / Poly Pizza 모델·작가·라이선스·링크) |
| `pos_blender` | 지금 방에 놓인 위치 (Blender 좌표, 참고용) |

- 지금 44줄: base 6 + deco 7 (`glb` 있음), 관심사 31 (`glb: null`)
- 확인: base 6개·deco 7개의 `node` 이름이 `room_base_v1.glb`·`room_deco_v1.glb`의 최상위 노드와 하나도 빠짐없이 일치 (`shadow_*` 제외). `sit_point_cushion_01`도 base glb 안에 있음

## 4. 앉기 (`docs/sit_points.md`)

| sit point | 가구 | 들어 있는 glb | 위치 three.js | 앉는 높이 | 앉기 → 앉아 있기 → 일어나기 |
|---|---|---|---|---|---|
| `sit_point_cushion_01` | `cushion_sky` 하늘색 방석 | `room_base_v1.glb` | (0.06, 0.13, −1.55) | 0.13m | `mole_sit_cushion` → `mole_sit_idle` → `mole_stand_up_cushion` |
| `sit_point_chair_01` | `bean_bag` 빈백 (게임 관심사) | 아직 없음 (관심사 가구와 같이) | (−1.50, 0.24, 0.60) | 0.24m | `mole_sit_beanbag` → `mole_sit_idle_chair` → `mole_stand_up_beanbag` |
| (의자) | 아직 의자 가구에 붙은 sit point 없음 | | | 0.45m 기준 | `mole_sit_chair` → `mole_sit_idle_chair` → `mole_stand_up_chair` |

- sit point는 가구의 자식이라 가구를 옮기면 같이 움직임. 두더지(`mole`)를 sit point의 위치·회전에 두고 앉기 동작 재생
- 앉기 전 걸어서 도착할 지점(sit point 앞 0.70m)과 일어난 뒤 서 있는 지점은 `sit_points.md`
- 노란 방석·피아노 의자·그림 의자는 주변 가구 때문에 앉는 자리 없음 (`sit_points.md` 마지막 표)

## 5. 액세서리 착용 규칙 변경 (`docs/accessories.md` 2번)

| | 이전 (v1.1) | 지금 (v2) |
|---|---|---|
| 착용 개수 | 최대 2개 | **부위(머리 head·얼굴 face·목 neck·손 hand)마다 1개씩, 최대 4개** |
| 같은 부위 | 하나만 | 하나만 (같음) |

**불가 조합 (UI에서 막기)**: `ribbon_back` 등 리본 + `prop_suitcase` 작은 캐리어 → 하나를 끼면 다른 하나는 잠금. 불가 조합은 이것 하나뿐

**숨김 규칙 (동작 중 손 소품 숨기기)**

| 동작 | 조건 |
|---|---|
| `mole_greet` 인사 | 항상 (기존) |
| `mole_drink` 커피 | 항상 (**새 규칙**) |
| `mole_butt_wiggle`, `mole_burrow_enter` | 손 = `prop_candy_star`·`prop_candy_heart` 이고 목 = `scarf_knit`일 때만 (**새 규칙**) |

- 코드 `handVisible()`와 막지 않는 작은 겹침 목록: `docs/accessories.md` 2-2·2-3번
- 확인: 서로 다른 부위 2개 쌍 576개 × 동작 20개 전 프레임. 3개·4개 조합의 겹침은 그 안 2개 쌍 겹침의 합이라 이것으로 모든 조합(4개 6,480개)을 확인한 것과 같음
- 예시 `images/combo4_sheet.png`, 미리보기 회전 `videos/turntable_combo4.mp4`

## 6. 아직 작업 중 (이번에 없음)

| 항목 | 상태 |
|---|---|
| 관심사 가구 31개 | 모델은 있음, glb 미전달. 카탈로그에 `glb: null`로 들어 있음. 빈백 앉는 위치도 이때 같이 |
| 가구 낙하 효과 · 착지 먼지 `dust_puff` | 작업 중. v1에 참고로 보낸 `dust_puff.glb`·`furniture_drop_spec.md`는 확정 아님 |
| 벽지 꽃무늬 | 작업 중. 지금 shell의 벽은 무늬 없음 (나중에 shell 텍스처가 바뀔 수 있음) |
| 전구 줄 오른쪽 끝 | 구멍을 분리하면서 오른쪽 끝이 벽 중간에서 끝남. 두더지가 떨어질 때 줄을 지나감. 나중에 `room_deco_v2`로 고칠 예정 |

## 7. 외부 에셋 (`docs/credits.md`)

- 이번 방 파일 5개에 들어간 외부 에셋은 모두 **Poly Pizza CC0** (작가 표기 의무 없음): `bed`(Kenney), `nightstand` 본체(Kenney), `round_table`(Kay Lousberg), 찻주전자(Isa Lousberg), 컵 2개(Kenney). 나머지는 직접 제작
- **이번 파일에는 CC-BY 에셋이 없음.** CC-BY 3개(기타 jeremy, 오락기·빈백 J-Toastie)는 관심사 가구라 다음 전달에 들어감 → 그때 앱의 크레딧 화면 등에 작가 표기 필요. 표기 문구는 `credits.md` 맨 아래 "필수 작가 표기 (CC-BY)"
- 가구별 출처는 `furniture_catalog.json`의 `source`에도 있음

## 8. 파일 목록

| 경로 | 내용 |
|---|---|
| `models/room_shell_v2_draco_webp.glb`, `models/room_shell_v2.glb` | 방 껍데기 |
| `models/room_base_v1.glb` | 기본 가구 |
| `models/room_deco_v1.glb` | 소품 |
| `models/room_ceiling_hole_v1.glb` | 천장 구멍 + 열림·닫힘 애니메이션 |
| `docs/HANDOFF_v2.md` | 이 문서 |
| `docs/room_spec.md` | 방 상세 스펙 (파일·굽기·렌더러·조명·카메라·천장 구멍·앉는 위치·카탈로그 형식) |
| `docs/furniture_catalog.json` | 가구 카탈로그 44줄 |
| `docs/sit_points.md` | 앉는 위치와 앉기 동작 순서 |
| `docs/accessories.md` | 액세서리 (착용 규칙 v2) |
| `docs/credits.md` | 외부 에셋 출처 |
| `images/room_glb_check.png` | 최신 방 glb 4개를 불러와 합친 기본 카메라 뷰 |
| `images/combo4_sheet.png` | 액세서리 4개 착용 예시 6개 |
| `videos/ceiling_drop_check.mp4` | 천장 구멍 열림 → 두더지 착지 → 닫힘 |
| `videos/turntable_combo4.mp4` | 액세서리 4개 착용 미리보기 회전 |

- 문서 안의 `exports/…` 경로 = `models/…`, `renders/…` = `images/`·`videos/` (원작업 폴더 기준 경로라 무시해도 됨)
- 두더지 애니메이션 이름(`mole_room_drop`, `mole_sit_*` 등)은 v1.1 `mole_v1_1*.glb`에 들어 있는 그대로
