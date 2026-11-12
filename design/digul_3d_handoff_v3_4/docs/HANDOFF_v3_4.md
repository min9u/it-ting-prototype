# 디굴디굴 3D 전달 v3.4 (패치) — 반려동물 묶음 (2026-11-12)

zip `digul_3d_handoff_v3_4_<날짜>.zip` 기준 경로. **v3 + v3.1 + v3.2 + v3.3 위에 얹는 패치**라서 여기 없는 파일은 이전 그대로 유효. 좌표는 three.js 기준 `(x, y, z)` = Blender `(x, z, −y)`.

## 교체·추가 파일 (한눈에)

| 파일 | 처리 | 내용 |
|---|---|---|
| `models/interest_pet_v1.glb`, `models/interest_pet_v1_draco_webp.glb` | **추가 (새 파일)** | 동물 5 + 동물 용품 5 (웹은 draco_webp) |
| `docs/slots.json` | **교체** | `pet_slot_01~05`, `prop_slot_15~19` **10칸의 위치·회전이 바뀜**, `drop`이 `fall` → `pop` |
| `docs/furniture_catalog.json` | **교체** | 10줄 `status: built`, `glb`, 크기, `pos_blender`, 동물 줄에 `pet_offset_from_prop` |
| `docs/interest_catalog.json` | 교체 | `pet` 카테고리에 슬롯·glb 이름 추가 |
| `docs/furniture_drop_spec.md` | 교체 | 반려동물 슬롯 10줄이 pop으로 바뀜 (모드 규칙 표 포함) |
| `docs/credits.md`, `docs/credits_app.md` | 교체 | 6묶음 직접 제작 한 줄 추가 (새 CC-BY 없음) |
| `docs/HANDOFF_v3_4.md`, `docs/CHANGELOG_v3_4.md` | 추가 | 이 문서 |

## 한 줄 요약

반려동물(고양이·강아지·앵무새·도마뱀·개미) **동물 5개 + 동물 용품 5개**를 `interest_pet_v1.glb`로 만들었고, 카탈로그에 `todo`로 남은 줄이 **0개**가 됨(`unused` 제외). 슬롯 10칸을 **전수 재검사**하다가 옛 자리가 가구(카페 의자)와 겹치는 것을 찾아서 **위치를 새로 잡음** → `slots.json`을 반드시 교체.

## 개발팀이 할 일 3가지

### 1. glb 추가, 슬롯·카탈로그 교체
- `models/interest_pet_v1_draco_webp.glb`(웹) 또는 `interest_pet_v1.glb`. 노드 이름 = 카탈로그 id 10개, 위치 0·회전 0·크기 1, 원점 = 바닥 중심 기준점. 애니메이션 없음
- `slots.json`, `furniture_catalog.json`, `interest_catalog.json`, `furniture_drop_spec.md`를 교체

### 2. 반려동물을 고르면: 동물 + 용품을 짝 슬롯에 놓기
세부 관심사 1개(예: 고양이) = **동물 1 + 용품 1**. 같은 번호의 슬롯 쌍에 놓음. 5개를 다 골라도 슬롯이 따로라 안 겹침. 위치는 `slots.json`(`pos_three`, `ry_deg`)이 정답이고, 동물은 **용품 기준 오프셋**으로도 계산할 수 있음 (둘은 같은 값).

| 세부 관심사 | 동물 / 용품 | 용품 슬롯 / 동물 슬롯 | 용품 위치 (x, y, z) | 동물 위치 (x, y, z) | 회전 `ry` |
|---|---|---|---|---|---|
| 고양이 | `cat_bed` / `pet_cat` | `prop_slot_15` / `pet_slot_01` | (-2.1, 0, 1.85) | (-2.003, 0, 1.561) | 131.4° |
| 강아지 | `dog_house` / `pet_dog` | `prop_slot_16` / `pet_slot_02` | (2.2, 0, 1.7) | (1.828, 0, 1.65) | -127.7° |
| 앵무새 | `parrot_perch` / `pet_parrot` | `prop_slot_17` / `pet_slot_03` | (-2.4, 0, 1.45) | (-2.4, 0, 1.45) | 121.1° |
| 도마뱀 | `lizard_tank` / `pet_lizard` | `prop_slot_18` / `pet_slot_04` | (-1.45, 0, 1.75) | (-1.387, 0, 1.375) | 140.4° |
| 개미사육 | `ant_farm_case` / `pet_ant` | `prop_slot_19` / `pet_slot_05` | (1.4, 0, 1.85) | (1.4, 0, 1.85) | -45.0° |

동물 위치 = 용품 위치 + `Ry(ry)` · 오프셋 (`furniture_catalog.json` 동물 줄의 `pet_offset_from_prop.local_three`), 동물 회전 = 용품 회전:

| 동물 | 기준 용품 | 오프셋 `local_three` (x, y, z) | 비고 |
|---|---|---|---|
| `pet_cat` | `cat_bed` | (0.153, 0, 0.264) | 용품 앞(방 중심 쪽) 비스듬히, 틈 약 4cm |
| `pet_dog` | `dog_house` | (0.188, 0, 0.325) | 용품 앞(방 중심 쪽) 비스듬히, 틈 약 4cm |
| `pet_parrot` | `parrot_perch` | (0.0, 0, 0.0) | 용품과 같은 자리 (앉음/붙음) |
| `pet_lizard` | `lizard_tank` | (0.19, 0, 0.329) | 용품 앞(방 중심 쪽) 비스듬히, 틈 약 4cm |
| `pet_ant` | `ant_farm_case` | (0.0, 0, 0.0) | 용품과 같은 자리 (앉음/붙음) |

```js
// 동물 놓기 (용품 노드 prop는 이미 slots.json 위치·회전에 놓은 상태)
const off = new THREE.Vector3(...catalog[petId].pet_offset_from_prop.local_three);
pet.position.copy(prop.position).add(off.applyAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotation.y));
pet.rotation.y = prop.rotation.y;
```
- **앵무새·개미는 오프셋이 `[0,0,0]`**: 동물 모양 자체가 용품 위에 떠 있게 만들어 둠(앵무새 발 높이 0.18m = 횃대 막대 윗면, 개미는 개미집 위·앞면). 용품과 같은 자리에 놓기만 하면 됨

### 3. 등장은 `pop`(제자리), 동물과 용품은 같은 시각
- 10칸 모두 `slots.json`의 `drop`이 `mode: "pop"`, `dust: 0.6`. 동물·짝 용품은 **같은 시각**에 시작(간격 0), 여러 짝을 고르면 짝끼리 0.12초 간격(부피 큰 짝부터)
- pop 최대 배율 1.08배에서도 다른 물체와 **6.9cm 이상**, 동물–용품끼리는 겹치지 않음(틈 1.5cm 이상, 앵무새·개미는 원래 붙어 있음)
- 참고: 앵무새는 1.08배일 때 높이 0.43m(슬롯 상자 0.40m를 약 0.1초 동안 3cm 넘음)지만 카메라 앞 0.5m 이하 규칙은 지킴

## 전수 재검사 결과 (10개 전부, 다른 카테고리 가구·방 전체를 슬롯 위치에 다 놓고 확인)

| 검사 | 기준 | 결과 (크기 1.0 / pop 1.08배) |
|---|---|---|
| 바닥 위 | 가장 낮은 점 ≥ 0 | 전부 통과 (0.000, 앵무새·개미는 발·몸이 떠 있음) |
| 바닥 가장자리 | 반지름 3.25m 안, 여유 3cm 이상 | 최소 여유 27.9cm / 26.6cm |
| 두더지 가림 | 카메라→두더지 9점 시선 중 막힌 것 0 | **0 / 9** (동물·용품만, 방 전체 포함 둘 다 0) |
| 카메라 앞쪽 | y < −0.2에서 높이 ≤ 0.5m | 최대 0.399m / 0.431m |
| 다른 가구와 | 3cm 이상 (모든 카테고리 가구·기본 가구·장식·선반) | 최소 10.0cm / 8.8cm |
| 서로 다른 짝끼리 | 3cm 이상 (5마리를 다 골라도) | 최소 9.2cm / 6.9cm |
| 앞쪽 통로 | x ±0.93m 비워 둠, 화면 아래 가장자리(y < −2.12) 밖 안 씀 | 통과 |

- 다른 카테고리 5개 + 동물 5개를 같이 고른 방 렌더: 프로젝트의 `renders/interest_v2/bundle6_layout_mix.png` (zip에는 이미지가 없음)
- 검사 방법과 판단 내용: `docs/overnight_6_notes.md`(프로젝트 안)

## 바뀐 슬롯 (이유)
- 옛 `prop_slot_15`(1.9, −1.3)·`pet_slot_01`(1.6, −1.0)은 카페 의자(`furniture_slot_17`, 1.7, −1.3)와 같은 자리였음. 옛 `prop_slot_18`(1.0, −1.65)은 짝 동물 슬롯 `pet_slot_04`(−1.4, −2.0)와 **2.4m나 떨어져** 있었음 → 5쌍 모두 짝이 붙도록 새로 잡음 (옛 값은 `slots.json`의 `moved_from_v3_3`)
