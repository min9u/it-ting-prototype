# 가구 낙하 연출 "또로로록" + 착지 먼지 `dust_puff` — 최종 (2026-11-11) · **v3: 슬롯 기준 표로 갱신**

> **HANDOFF v3 (관심사 v2 구조)**: 3번 표를 새 **슬롯** 기준으로 다시 계산했고(선반 소품 pop 규칙 포함), 4번 순서 코드를 새 카탈로그에 맞게 바꿈. 1·2·5·7번은 그대로. 6번 영상과 5번 먼지 설명은 이전 배치(음악+게임, 옛 가구 위치) 기준 참고 자료이고 곡선·규칙은 같음. 문서 안 `exports/…`는 `models/…`, `renders/…`는 `images/`·`videos/`. **이 zip에는 `models/dust_puff_v1.glb`(먼지)만 들어 있고 영상(`furniture_drop_final*.mp4`)과 이전 문서는 없음**

- 이전 문서: `renders/furniture_drop/furniture_drop_spec.md` (11/05, room_v6 기준. 1차 전달 `furniture_drop_spec.md`와 같음). **이 문서가 최신**
- 원본: `room_final_v3.blend` (= `room_final_v2.blend` + 이번 시나리오 설정. 작업 전 백업 `room_final_v2_before_drop.blend`)
- 파일: `exports/dust_puff_v1.glb` (먼지). 가구 낙하는 **코드로 계산** (glb 애니메이션 없음, 아래 곡선 사용)
- 영상: `renders/furniture_drop/furniture_drop_final.mp4` (실제 속도), `furniture_drop_final_slow.mp4` (0.5배)
- 시간은 모두 **초**. 좌표: Blender `(x, y, z)` → three.js `(x, z, −y)`. "세로" = three.js `scale.y`, "가로" = `scale.x`·`scale.z`, "회전" = `rotation.y`
- 가구 원점 = 바닥 중앙. 크기 변형·회전은 모두 원점 기준이라 가구 루트의 `position / rotation / scale`에 더하거나 곱하면 됨
- **가구 크기는 `docs/furniture_catalog.json`의 `size_m` (`w` 가로, `d` 깊이, `h` 높이, m)을 씀.** 위치는 `pos_blender`(최종 위치)

---

## 1. 바뀐 점 (11/05 → 11/11)

| | 이전 | 최종 |
|---|---|---|
| 시작 높이 | 모든 가구 +2.0m | **키에 따라 3등급** (2.0 / 1.6 / 1.2m) |
| 벽 쪽 가구 | 천장을 뚫고 내려옴 (그대로 둠) | 돔 밖으로 나가는 가구는 **방 안쪽에서 시작해 비스듬히** 떨어짐 (가로 오프셋) |
| 벽에 거는 가구·아주 큰 벽 쪽 가구 | (없었음) | 떨어지지 않고 **제자리에서 퐁 등장** |
| 그 외 (크기 변화, 튕김, 회전, 시간, 간격, 순서, 먼지) | | **그대로** |

- 확인 방법: 관심사 가구 31개 + 기본 가구를 낙하 중 모든 시점(0~0.30초 10단계)에서 실제 돔 메시와 비교. 가구의 모든 점이 돔 안쪽 5cm 이상이어야 통과. 걸이 소품(전구 줄, 가랜드, 화분, 램프)과 3cm 이내로 스치는 경우도 불합격으로 처리
- 결과: 2.0m 그대로 수직으로 떨어뜨리면 31개 중 14개가 천장·벽을 뚫음 (책장·피아노·조리대·TV·오락기 등 벽 쪽 가구). 아래 규칙으로 모두 해결

## 2. 가구 하나의 낙하 (총 0.60초)

| 항목 | 값 | three.js 이징 이름 |
|---|---|---|
| 시작 높이 `H` | 최종 위치 + **2.0 / 1.6 / 1.2m** (3장) | |
| 가로 시작 오프셋 `S` | 방 중심 쪽으로 `S` m (3장 표, 대부분 0) | 낙하와 같이 `S × (1 − u)` (등속, `linear`) |
| 시작 크기 | **0.8배** → 1.0배 (0.20초) | `easeOutCubic` |
| 낙하 | **0.30초**, `높이 = H × (1 − u²)`, `u = t / 0.30` | `easeInQuad` (중력처럼 가속) |
| 늘어남 | 낙하 중 세로 1.0 → **1.10배** (u²), 가로 `1/√세로` | `easeInQuad` |
| 착지 | **t = 0.30초** ← `dust_puff` 재생 | |
| 찌그러짐 | t = 0.34초 세로 **0.80** / 가로 **1.10** | 키 사이 `easeInOutSine` |
| 반동 | t = 0.40초 세로 1.05 / 가로 0.976 | 〃 |
| 튕김 | t = 0.40 → 0.52초 포물선 1번, 최고 **0.15m** (t = 0.46) | 포물선 `4w(1 − w)` (`easeOutQuad` 올라감 + `easeInQuad` 내려옴과 같음) |
| 두 번째 착지 | t = 0.52초, t = 0.555초 작은 찌그러짐 (세로 0.92 / 가로 1.04). 먼지 없음 | `easeInOutSine` |
| 안착 | **t = 0.60초** 위치 0, 회전 0, 크기 1 | |
| 회전 흔들림 | 시작 **+8°**, `8° × cos(2πt / 0.30) × (1 − t/0.45)²` → t = 0.45초에 0° | 감쇠 코사인 |
| 등장 | 낙하 전 `visible = false`. t = 0에 0.8배로 바로 나타남 (페이드 없음) | |

- 시작 높이가 달라도 **시간은 같음** (0.30초에 착지). 리듬(0.12초 간격)을 맞추기 위해서이고, 낮은 가구가 조금 천천히 떨어지는 것처럼 보이지만 영상에서 어색하지 않음
- 가로 오프셋 방향: 가구 최종 위치에서 방 중심 쪽 수평 방향. three.js: `dir = new Vector3(-pos.x, 0, -pos.z).normalize()` (가구가 방 중심에 있으면 `(0, 0, 1)` = 카메라 쪽)

### 크기 키 (착지 이후)

| t (초) | 세로 | 가로 | |
|---|---|---|---|
| 0.300 | 1.10 | 0.953 | 착지 (늘어난 상태) |
| 0.340 | **0.80** | **1.10** | 납작 최대 |
| 0.400 | 1.05 | 0.976 | 반동, 튀어 오름 |
| 0.520 | 1.00 | 1.00 | 두 번째 착지 |
| 0.555 | 0.92 | 1.04 | 작은 찌그러짐 |
| 0.600 | 1.00 | 1.00 | 안착 |

### 제자리 등장 (`pop`) — 벽걸이 가구, 낙하 공간이 없는 가구

| t (초) | 세로 | 가로 | 이징 |
|---|---|---|---|
| 0.00 | 0 | 0 | |
| 0.22 | 1.08 | 1.08 | `easeOutCubic` |
| 0.30 | 1.00 | 1.00 | `easeInOutSine` ← 바닥 가구면 여기서 `dust_puff` |
| 0.36 | 0.90 | 1.05 | `easeInOutSine` |
| 0.46 | 1.03 | 0.985 | `easeInOutSine` |
| 0.60 | 1.00 | 1.00 | `easeInOutSine` |

- 위치 이동·튕김·회전 없음 (벽에 붙은 채로 커짐). 길이는 낙하와 같은 0.60초라 순서·간격 규칙 그대로

### 코드 (그대로 옮기면 영상과 같음)

```js
const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const easeOutCubic = (u) => 1 - (1 - u) ** 3;
const easeInOutSine = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const SQUASH = [[0.30, 1.10, 0.953], [0.34, 0.80, 1.10], [0.40, 1.05, 0.976], [0.52, 1, 1], [0.555, 0.92, 1.04], [0.60, 1, 1]];
const POP    = [[0.00, 0, 0], [0.22, 1.08, 1.08], [0.30, 1, 1], [0.36, 0.90, 1.05], [0.46, 1.03, 0.985], [0.60, 1, 1]];
function keys(K, t, firstEase = easeInOutSine) {
  for (let i = 0; i < K.length - 1; i++) {
    const [t0, v0, h0] = K[i], [t1, v1, h1] = K[i + 1];
    if (t >= t0 && t <= t1) { const e = (i === 0 ? firstEase : easeInOutSine)((t - t0) / (t1 - t0)); return [lerp(v0, v1, e), lerp(h0, h1, e)]; }
  }
  return [1, 1];
}
// t: 시작 후 경과 초, H: 시작 높이(m), S: 가로 오프셋(m), mode: 'fall' | 'pop'
function furnitureDrop(t, H = 2.0, S = 0, mode = 'fall') {
  t = Math.min(0.60, Math.max(0, t));
  if (mode === 'pop') { const [sv, sh] = keys(POP, t, easeOutCubic); return { y: 0, side: 0, rotDeg: 0, scaleV: sv, scaleH: sh }; }
  const u = Math.min(t / 0.30, 1);
  let y = 0;
  if (t <= 0.30) y = H * (1 - u * u);                                                       // easeInQuad
  else if (t > 0.40 && t <= 0.52) { const w = (t - 0.40) / 0.12; y = 0.15 * 4 * w * (1 - w); } // 튕김
  const side = S * (1 - u);                                                                 // 방 중심 쪽 오프셋
  const rotDeg = t < 0.45 ? 8 * Math.cos(2 * Math.PI * t / 0.30) * (1 - t / 0.45) ** 2 : 0;
  let sv, sh;
  if (t <= 0.30) { const base = lerp(0.8, 1.0, easeOutCubic(clamp01(t / 0.20))); const st = 1 + 0.10 * u * u; sv = base * st; sh = base / Math.sqrt(st); }
  else [sv, sh] = keys(SQUASH, t);
  return { y, side, rotDeg, scaleV: sv, scaleH: sh };
}
// 적용
// const d = furnitureDrop(elapsed, H, S, mode);
// obj.position.set(final.x + dir.x * d.side, final.y + d.y, final.z + dir.z * d.side);
// obj.rotation.y = finalRotY + THREE.MathUtils.degToRad(d.rotDeg);
// obj.scale.set(d.scaleH, d.scaleV, d.scaleH);
```

- 샘플 값(0.025초 간격)은 이전 문서 1장 표와 같음 (`H = 2.0`, `S = 0`일 때). `H`가 다르면 높이 열만 `H / 2.0`배

## 3. 시작 높이 규칙 (**v3: 새 슬롯 기준으로 다시 계산**)

> **v3 변경 (11/11)**: 이전 표는 관심사 가구 31개(`exercise`, `reading`, `cooking`, `travel` 등 옛 관심사 id) 기준이었음. 관심사 v2 구조에서는 가구가 **슬롯에 고정**되므로 표를 **슬롯 기준**으로 바꿈. 값은 `docs/slots.json`의 각 슬롯 `drop` 항목에도 들어 있음 (`mode`, `H`, `S`, `dust`, `basis`). 코드는 가구 이름이 아니라 **슬롯 이름으로 찾기**

### 기본 규칙

| 등급 | 조건 (`size_m.h`) | 시작 높이 `H` | 예 |
|---|---|---|---|
| 작은 가구·소품 | **0.5m 미만** | **2.0m** | 방석, 피아노 의자, 빈백, 동물 |
| 중간 가구 | **0.5 ~ 1.0m 미만** | **1.6m** | 스피커, 기타 |
| 큰 가구 | **1.0m 이상** | **1.2m** | 피아노, 이젤, 삼각대 |

- 이유: 큰 가구를 2m 위에서 떨어뜨리면 윗면이 돔 천장(벽 쪽 2m 안팎)을 뚫음. 키가 클수록 낮게 시작
- 아래 표의 `H`·`S`는 규칙보다 **낮게 줄어든 경우도 있음** (돔 안쪽 5cm 이상 + 걸이 소품·**벽 선반**과 3cm 이상 조건으로 확인한 값). 표 값을 쓰면 규칙 계산은 필요 없음
- 높이·`S`를 더 낮추는 건 언제나 안전 (돔 안쪽으로만 바뀜). 더 높이면 다시 확인 필요

### 모드 규칙

| 대상 | 모드 | 먼지 |
|---|---|---|
| 바닥 가구 (슬롯 표 `fall`) | 낙하 (`H`, `S` 값 사용) | 있음 (크기 `dust`) |
| 바닥 가구인데 표가 `pop` (`furniture_slot_08` 아케이드, `furniture_slot_14` 망원경) | 제자리 등장 | 있음 |
| 벽걸이 가구 (`main_hung`: 슬롯 04, 18, 20) | 제자리 등장 | **없음** |
| **선반 소품 (`prop_slot_01~12`)** | **제자리 등장** (선반이 위에 있어 떨어뜨릴 수 없음) | **없음** |
| 바닥 소품·동물·동물 용품 (`prop_slot_13~19`, `pet_slot_*`) | 낙하 | 있음 |

### 슬롯별 값 (돔 메시 + 벽 선반 + 걸이 소품으로 확인)

- `기준` = **모델**: 지금 방에 놓인 실제 모델로 확인 / **상자**: 아직 모델이 없어서 그 슬롯의 최대 크기(`max_m`) 상자로 확인 (모델이 슬롯보다 작으므로 안전한 쪽). 모델이 생기면 다시 계산해서 이 표를 갱신해 보냄
- `S` = 방 중심 쪽으로 미리 옮겨 시작하는 가로 오프셋(m), `먼지` = `dust_puff` 크기 배율 (5번)

| 슬롯 | 카테고리 | 가구 | 종류 | 높이 h | 모드 | H (m) | S (m) | 먼지 | 기준 | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|
| `furniture_slot_01` | music | piano | main_floor | 1.25 | fall | 1.2 | 0.5 | 1.44 | 모델 | 이전 문서(0.65)보다 줄어듦: 피아노 자리가 바뀜 |
| `furniture_slot_02` | music | speaker | mid | 0.8 | fall | 1.6 | 0.0 | 0.6 | 모델 |  |
| `furniture_slot_03` | music | piano_stool | low | 0.5 | fall | 2.0 | 0.0 | 0.6 | 모델 |  |
| `furniture_slot_04` | photo | photo_board | main_hung | 0.42 | pop | - | - | - | 모델 | **슬롯을 뒤쪽 벽 (1.114, 2.757, 1.3)로 옮김 (v3.1, 원래 자리는 벽에서 6.3cm 떠 있었음).** 벽걸이라 pop. 벽에 닿음, 다른 물체 5cm 이상 |
| `furniture_slot_05` | photo | tripod_camera | slim | 1.354 | fall | 1.2 | 0.0 | 0.6 | 모델 |  |
| `furniture_slot_06` | nature | plant_stand | main_floor | 1.188 | fall | 1.2 | 0.7 | 0.7 | 모델 | 크기를 로컬 기준 0.7로 맞춰 먼지 0.94 → 0.7 |
| `furniture_slot_07` | nature | terrarium_bench | low | 0.489 | fall | 2.0 | 0.0 | 0.6 | 모델 | **슬롯을 (−1.75, 1.0) → (−1.2, 1.5)로 옮김 (가려서).** 돔 안쪽 5cm·벽 선반 3cm 이상 통과 |
| `furniture_slot_08` | game | arcade | main_floor | 1.5 | pop | - | - | 0.91 | 모델 | pop: fall 시 눌림(1.10배) 때문에 선반 03과 1cm. 제자리 등장(1.08배)은 선반 03과 11.3cm, 책장 12.9cm 이상 (11/11 모델 확정 뒤 재확인) |
| `furniture_slot_09` | game | bean_bag | low | 0.441 | fall | 2.0 | 0.0 | 0.63 | 모델 | 돔 96cm, 다른 가구 16.5cm 이상 (11/11 재확인) |
| `furniture_slot_10` | craft | easel | main_floor | 1.34 | fall | 1.2 | 0.2 | 0.64 | 모델 |  |
| `furniture_slot_11` | craft | drawing_stool | low | 0.45 | fall | 2.0 | 0.0 | 0.6 | 모델 |  |
| `furniture_slot_12` | book | bookshelf | main_floor | 1.28 | fall | 0.8 | 0.25 | 0.8 | 모델 | 위 선반 03 아래라 1.2m 수직 낙하는 선반을 뚫음 → 0.8m + 안쪽 0.25m |
| `furniture_slot_13` | book | reading_lamp | slim | 1.064 | fall | 1.2 | 0.0 | 0.6 | 모델 |  |
| `furniture_slot_14` | science | telescope | main_floor | 1.135 | pop | - | - | 0.65 | 모델 | **11/12(5묶음 B)**: 낙하하면 벽 선반·선반 02에 스침 → 제자리 등장. 벽에 1cm로 붙어 있어 가장 큰 1.08배에서 뒤쪽 다리가 벽을 최대 3.2cm 파고듦(약 0.08초). 슬롯 위치·상자도 바뀜 |
| `furniture_slot_15` | science | mineral_bench | low | 0.494 | fall | 2.0 | 0.0 | 0.6 | 모델 | 돔 9.2cm, 다른 가구 16.8cm 이상 (11/12) |
| `furniture_slot_16` | tea_coffee | kitchen_counter | main_floor | 0.95 | fall | 1.3 | 1.0 | 1.41 | 모델 | S가 검사 한도(1.0m)까지 필요. 조리대는 크고 벽에 붙어 있음 |
| `furniture_slot_17` | tea_coffee | cafe_stool | low | 0.465 | fall | 2.0 | 0.0 | 0.6 | 모델 | **11/11(5묶음 A) 자리 이동**: (0.286, 2.106) → (1.70, -1.30), 회전 54.8°. 앞쪽이라 돔 벽 없음, 다른 가구 39.9cm 이상 |
| `furniture_slot_18` | outdoor | bike_rack_wall | main_hung | 0.559 | pop | - | - | - | 모델 | **슬롯을 뒤쪽 벽 (−1.123, 2.78, 1.32)로 옮김 (원래 자리는 벽이 없고, 그다음 자리는 화면에서 선반과 겹침).** 벽걸이라 pop. 판 뒷면이 돔 벽에 닿음, 돔 4.6cm, 선반 01 9.6cm, 액자 02 5.9cm, 책장 4.3cm 이상 |
| `furniture_slot_19` | outdoor | camp_chair | low | 0.488 | fall | 2.0 | 0.0 | 0.6 | 모델 | 돔 안쪽 5cm·벽 선반 3cm 이상 통과. 가까운 가구(`tripod_camera`) 39cm |
| `furniture_slot_20` | movie | tv | main_hung | 0.731 | pop | - | - | - | 모델 | **슬롯을 왼쪽 뒤쪽 벽 (−2.718, 0.528, 1.3)로 옮김 (v3.1, 원래 자리는 돔 바깥이라 벽이 없었음).** 벽걸이라 pop. 벽에 닿음(0.2cm), 돔 안쪽 3.2cm, 다른 물체 8.4cm 이상 |
| `furniture_slot_21` | movie | projector | low | 0.385 | fall | 2.0 | 0.0 | 0.6 | 모델 |  |
| `prop_slot_13` | - | guitar | floor | 1.0 | fall | 1.6 | 0.35 | 0.6 | 모델 |  |
| `prop_slot_14` | - | (비어 있음) | floor | 0.5 | fall | 1.6 | 0.2 | 0.6 | 상자(max_m) |  |
| `pet_slot_01` | pet | (비어 있음) | pet_floor | 0.4 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `prop_slot_15` | pet | (비어 있음) | pet_floor | 0.35 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `pet_slot_02` | pet | (비어 있음) | pet_floor | 0.4 | fall | 2.0 | 0.3 | 0.6 | 상자(max_m) |  |
| `prop_slot_16` | pet | (비어 있음) | pet_floor | 0.35 | fall | 2.0 | 0.4 | 0.6 | 상자(max_m) |  |
| `pet_slot_03` | pet | (비어 있음) | pet_floor | 0.4 | fall | 2.0 | 0.4 | 0.6 | 상자(max_m) |  |
| `prop_slot_17` | pet | (비어 있음) | pet_floor | 0.35 | fall | 2.0 | 0.25 | 0.6 | 상자(max_m) |  |
| `pet_slot_04` | pet | (비어 있음) | pet_floor | 0.4 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `prop_slot_18` | pet | (비어 있음) | pet_floor | 0.35 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `pet_slot_05` | pet | (비어 있음) | pet_floor | 0.4 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `prop_slot_19` | pet | (비어 있음) | pet_floor | 0.35 | fall | 2.0 | 0.0 | 0.6 | 상자(max_m) |  |
| `prop_slot_01~12` (선반) | - | 선반 소품 | shelf | ≤ 0.35 | pop | - | - | 없음 | 규칙 | 선반 3개 위 12칸. **v3.1: 선반이 벽에 닿도록 선반·칸 위치가 바뀜** (`slots.json`) |

- 확인한 것: 가구의 모든 점이 낙하 0~0.30초 10단계에서 돔 안쪽 5cm 이상, 걸이 소품(전구 줄·가랜드·화분·램프)과 **벽 선반(`room_shelves_v1`)** 에서 3cm 이상. 검사 파일 `room_final_v5.blend`
- 두 가지 새로 알게 된 점 (표에 반영됨):
  1. `furniture_slot_12` 책장은 위에 선반 03이 있어서 1.2m에서 수직으로 떨어지면 선반을 뚫음 → 0.8m에서 안쪽 0.25m 옮겨 시작
  2. `furniture_slot_08` 아케이드(1.5m)는 착지 때 세로로 1.10배 눌려 1.65m까지 커지면서 선반 03(바닥 1.66m)과 1cm 거리가 됨 → 낙하 대신 `pop`(최대 1.08배, 4cm 이상)
- **`furniture_slot_14`(우주·과학 대표 가구, 11/12 갱신)**: 망원경(높이 1.135m, 슬롯 상자 0.58×0.66×1.2)으로 확정. 낙하는 벽 선반·선반 02에 스쳐서 `pop`. 벽에 1cm로 붙어 있어 pop의 가장 큰 1.08배 순간에 뒤쪽 다리가 벽을 최대 3.2cm 파고듦(약 0.08초) — 신경 쓰이면 pop의 최대 배율을 이 가구만 1.0으로 낮춰도 됨
- 기본 가구(지금은 떨어지지 않음, 나중에 쓸 경우): `bed` fall 1.6 / S 0.35 / 먼지 1.5, `nightstand`·`round_table` fall 1.6 / S 0, 방석 2종 fall 2.0 / S 0
- `S`가 있는 가구는 방 안쪽에서 시작해 벽 쪽 최종 자리로 비스듬히 떨어짐

## 4. 또로로록 순서 (**v3: 새 카탈로그 기준**)

| 항목 | 값 |
|---|---|
| 세트 | 온보딩에서 고른 **카테고리 순서**대로 하나씩. 세트 = 그 카테고리의 가구(슬롯 고정) + 고른 세부 관심사의 소품 |
| 같은 세트 안 간격 | **0.12초** (i번째 시작 = 세트 시작 + 0.12 × i) |
| 같은 세트 안 순서 | **부피(`w × d × h`)가 큰 것부터** |
| 세트 사이 | **앞 세트가 끝나고 1.0초 쉬고** 다음 세트 |
| 세트 길이 | 0.12 × (개수 − 1) + 0.60초 |
| 자식 소품 | 루트 가구 하나로 같이 떨어짐 (조리대 위의 냄비 `cooking_pot` 등) |
| 낙하 값 | **슬롯의 `drop`** (`mode`, `H`, `S`, `dust`). 선반 소품은 `pop` |

```js
// catalog: furniture_catalog.json, slots: slots.json, interestCatalog: interest_catalog.json, picks: 고른 세부 관심사 id (고른 순서)
const vol = r => r.size_m.w * r.size_m.d * r.size_m.h;
const subs = interestCatalog.filter(r => r.type === 'sub');
const cats = [...new Set(picks.map(id => subs.find(s => s.id === id).category))];   // 고른 순서
let start = 0; const schedule = [];
for (const c of cats) {
  const items = [];
  // 1) 카테고리 가구: 슬롯 고정, glb가 있는 것만
  catalog.filter(r => r.type === 'category_furniture' && r.category === c && r.glb)
    .forEach(r => items.push({ row: r, slot: slots.find(s => s.name === r.slot.name) }));
  // 2) 고른 소품: 선반은 비어 있는 칸(주 가구에서 가까운 순), 기타·동물·용품은 고정 슬롯 (HANDOFF_v3.md 2번)
  //    picks 중 category가 c인 것의 소품 row와 배정된 slot을 items에 추가
  items.sort((a, b) => vol(b.row) - vol(a.row));
  items.forEach((it, i) => schedule.push({ id: it.row.id, slot: it.slot.name, drop: it.slot.drop, start: start + 0.12 * i }));
  start += 0.12 * (items.length - 1) + 0.60 + 1.0;
}
```

## 5. 착지 먼지 `dust_puff` (`exports/dust_puff_v1.glb`)

- 노드 `dust_puff` + 자식 `dust_puff_blob_01~05` (둥근 덩어리 5개: 크림 #F7E6C8 3개, 연갈색 #C98A5A 2개, 무광), 애니메이션 `dust_puff`
- **기본 상태 = 안 보임** (덩어리 크기 0). 애니메이션을 재생할 때만 나타나고, 끝나면 다시 크기 0
- 애니메이션 길이 0.417초 (첫 키가 0.042초, 실제 움직임은 0.04~0.42초). `LoopOnce` + `clampWhenFinished`
- 루트 extras: `duration_s`, `base_footprint_m`, `scale_rule`, `opacity_rule`

### 재생 규칙

| 항목 | 값 |
|---|---|
| 재생 시점 | 가구 시작 후 **t = 0.30초** (첫 착지). `pop`은 t = 0.30초 (커지기 끝). 두 번째 착지(0.52초)는 먼지 없음 |
| 위치 | 가구 최종 위치의 원점 높이 (바닥 가구는 바닥, 냄비는 조리대 위) |
| 회전 | 가구의 Y 회전과 같게 |
| **크기** | `clamp(max(size_m.w, size_m.d) / 1.0, 0.6, 1.5)` 배. **기준: 가구 바닥 폭 1m일 때 1배** (덩어리가 중심에서 약 0.6m까지 퍼짐) |
| 먼지 없음 | 벽걸이 가구 (슬롯 04, 18, 20: `photo_board`, 자전거 걸이, `tv`)와 **선반 소품** |
| 동시 재생 | 가구마다 따로 (풀 5개면 충분: 0.42초 / 0.12초 간격) |

### 사라지는 방식: 투명도는 코드로

- **glb에는 위치·크기 애니메이션만 들어 있음.** glTF 기본 규격은 재질 투명도 애니메이션을 지원하지 않음 (`KHR_animation_pointer` 확장이 있지만 three.js 기본 GLTFLoader가 읽지 않음)
- 그래서 glb만 재생해도 **크기가 0으로 줄어들며 사라짐** (대체 방식). 재질은 `alphaMode: BLEND`로 들어 있어서, 아래처럼 투명도를 같이 줄이면 영상과 같은 "흐려지며 사라짐"이 됨

```js
const dust = SkeletonUtils.clone(dustGltf.scene);           // 또는 scene.clone(true)
dust.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.depthWrite = false; } });
const easeOutQuad = (u) => 1 - (1 - u) * (1 - u);
// 매 프레임, tt = 먼지 재생 후 경과 초
const opacity = 1 - easeOutQuad(Math.min(1, Math.max(0, (tt - 0.10) / 0.30)));
dust.traverse(o => { if (o.isMesh) o.material.opacity = opacity; });
```

| 덩어리 움직임 (크기 1배 기준) | 값 | 이징 |
|---|---|---|
| 중심에서 거리 | 0.22m → 0.56~0.64m | `easeOutCubic` |
| 높이 | 0.03m → 0.16m | `easeOutQuad` |
| 크기 | 0.3 → 1.0 (0.14초) → 0.5 (0.36초) → 0 (0.40초) | `easeOutCubic` → `easeInOutSine` → `linear` |
| 투명도 (코드) | 1.0 (0~0.10초) → 0 (0.40초) | `easeOutQuad` |

## 6. 시나리오 영상 (`furniture_drop_final.mp4`)

기본 가구만 있는 방에서 관심사 **음악 + 게임**을 고른 상황. 기본 카메라, 24fps, 150프레임 (6.25초). 슬로우는 같은 장면 0.5배 (12.5초)

| 시간 (초) | 일어나는 일 |
|---|---|
| 0.00 | 기본 가구만 있는 방, 두더지 방 가운데 `mole_idle` |
| 0.90 | 두더지 `mole_look_around` 앞부분(1~28프레임, 1.4배 느리게): 오른쪽(음악 가구 쪽)으로 33° 돌아보며 살짝 갸웃 |
| 1.00 / 1.12 / 1.24 / 1.36 | `piano`(1.2m, 안쪽 0.65m에서 비스듬히) / `speaker` / `guitar` / `piano_stool` 낙하 |
| 1.30 ~ 1.66 | 착지마다 `dust_puff` (피아노 1.44배, 나머지 0.6배) |
| 1.96 | 음악 세트 끝 → 1.0초 쉼 |
| 2.86 | `mole_look_around` 뒷부분(28~55프레임): 왼쪽(게임 가구 쪽)으로 돌아봄 |
| 2.96 / 3.08 / 3.20 | `arcade`(1.2m, 안쪽 0.45m) / `bean_bag` / `game_console` |
| 3.26 ~ 3.50 | 착지마다 `dust_puff` |
| 4.54 | 정면으로 돌아와 `mole_showcase`의 고개 갸웃 부분(28~48프레임) |
| 6.25 | 끝 |

- 두더지 동작은 모두 기존 Action 재사용 (`mole_idle`, `mole_look_around`, `mole_showcase`). 웹에서는 `mole_look_around`를 그대로 재생해도 됨 (오른쪽 → 왼쪽 순서로 둘러봄, 2.4초). 영상처럼 나눠 쓰려면 `subclip` 1~28 / 28~55프레임
- 천장 구멍은 닫힌 상태, 가구 그림자는 실시간 조명으로 렌더

## 7. Blender 안의 데이터 (`room_final_v3.blend`)

| 이름 | 종류 | 설명 |
|---|---|---|
| `furniture_drop` | Action | 11/05 표준 낙하 곡선 (H 2.0, S 0). delta transform 키 |
| `preview_drop_final_<가구>` | Action | 이번 영상용 (가구 7개, 1/4프레임 간격 키, delta transform) |
| `dust_puff` | Action + 오브젝트 (컬렉션 `fx`) | glb 원본 |
| `fx_drop_final` | 컬렉션 | 영상용 먼지 7개 (`dustfx_<가구>`, NLA 스트립) |
| `fd_idle`, `fd_lookA`, `fd_lookB`, `fd_tilt` | 두더지 NLA 트랙 | 영상용 (기존 트랙은 음소거 그대로) |
| 씬 속성 `fd_plan` | | 영상의 가구별 시작 시간·H·S |

- 관심사 컬렉션 중 music·game만 켜 둠 (영상 설정). 가구 원래 위치·크기는 그대로 (delta transform만 씀)
