# 디굴디굴 3D 전달 v3 (M1) — 관심사 v2 구조 첫 전달 (2026-11-11)

zip `digul_3d_handoff_v3_20261111.zip` 기준 경로. 1차(v1, v1.1)·2차(v2)에서 받은 파일은 **여기서 바꾼 것만 교체**하고 나머지는 그대로 유효. 문서 안 `exports/…`는 `models/…`, `renders/…`는 `images/…`로 읽기 (원작업 폴더 기준 경로라서).

## 먼저 할 일

1. zip을 풀고 `models/`의 **`*_draco_webp.glb`를 웹에 사용** (Draco + WebP. `DRACOLoader` 디코더 경로 설정 필요, WebP는 three.js `GLTFLoader`가 읽음). 압축 없는 파일은 비교·디버깅용
2. 기본 가구를 **`models/room_base_v2_draco_webp.glb`로 교체** (노란 방석 위치·회전이 바뀌었고 `sit_point_cushion_02`가 추가됨). v2의 `room_base_v1.glb`는 쓰지 않기. 껍데기·구멍은 v2 그대로 (6번)
3. 온보딩은 **카테고리 11개 · 세부 관심사 65개 · 최대 10개 선택** (1번). 목록은 `docs/interest_catalog.json`을 읽어서 만들기 (이름·순서를 코드에 적지 않기)
4. 가구는 **`docs/furniture_catalog.json` + `docs/slots.json`으로 배치**: 카테고리 가구는 슬롯 고정, 소품은 비어 있는 선반 칸에 가까운 순, 동물은 별도 슬롯 (2번). 벽 선반 `models/room_shelves_v1_draco_webp.glb`는 **방 원점에 그대로** 얹기
5. 카탈로그에서 **`status: built`이고 `glb`가 있는 것만 진짜 모델**, `todo`(`glb: null`)는 **둥근 블록으로 대체** (3번). 낙하 연출 값은 `slots.json`의 `drop` (8번)

## 0. 이번 전달 요약

| | 내용 |
|---|---|
| 온보딩 구조 | 카테고리 11 · 세부 관심사 65 (이전: 관심사 10개, 가구 31개 고정) |
| 새 모델 (glb 14개) | **사진 · 책·글 · 영화·애니 · 공예·만들기** 4개 카테고리 가구 8 + 소품 16 = **24개** + 벽 선반 3개 + 기본 가구 v2 |
| 카탈로그 | 44줄 → **112줄** 새 형식. `slots.json` 45슬롯 (낙하 값 `drop` 포함) |
| 기본 가구 | 노란 방석 이동 + 앉는 위치 `sit_point_cushion_02` 추가 → `room_base_v2` |
| 문서 | 낙하 연출(슬롯 기준 표), 앉는 위치, 액세서리 관심사 연결 갱신 |
| 외부 에셋 | 이번 glb 전부 **CC0** (CC-BY 없음) |
| 이번에 없는 것 | 나머지 7개 카테고리 (7번). 두더지·액세서리 glb는 바뀐 것 없음 |

## 1. 온보딩 구조 (카테고리 11 · 세부 관심사 65)

`docs/interest_catalog.json` (76줄: `type: category` 11 + `type: sub` 65). 1줄 = 1행.

| 행 | 키 | 값 |
|---|---|---|
| category | `id`, `name_ko`, `order` | 카테고리 id·이름·표시 순서 |
| | `furniture`, `furniture_slots` | 이 카테고리의 가구 id 목록과 슬롯 이름 (**첫 번째가 주 가구**) |
| | `accessories` | 이 카테고리를 고르면 열리는 전용 액세서리 (비어 있을 수 있음) |
| | `max_pick` | 10 |
| sub | `id`, `name_ko`, `category` | 세부 관심사 |
| | `prop` | 이 관심사를 고르면 놓이는 소품 id (`furniture_catalog.json`의 `id`) |
| | `slot_kind` | `shelf`(선반) / `floor`(바닥, 기타) / `pet_floor`(동물 자리) |
| | `pet` | 반려동물이면 동물 id (`pet_cat` 등), 아니면 `null` |

| 카테고리 (id) | 세부 | 가구 | 이번 전달 |
| 음악 (`music`) | 9 | piano, speaker, piano_stool | 없음 (블록): 가구 0/3, 소품 0/9 |
| 사진 (`photo`) | 2 | photo_board, tripod_camera | **포함 (전부)**: 가구 2/2, 소품 2/2 |
| 자연·식물 (`nature`) | 6 | plant_stand, terrarium_bench | 없음 (블록): 가구 0/2, 소품 0/6 |
| 게임·놀이 (`game`) | 10 | arcade, bean_bag | 없음 (블록): 가구 0/2, 소품 0/10 |
| 공예·만들기 (`craft`) | 6 | easel, drawing_stool | **포함 (전부)**: 가구 2/2, 소품 6/6 |
| 책·글 (`book`) | 4 | bookshelf, reading_lamp | **포함 (전부)**: 가구 2/2, 소품 4/4 |
| 우주·과학 (`science`) | 9 | telescope, mineral_bench | 없음 (블록): 가구 0/2, 소품 0/9 |
| 차·커피·베이킹 (`tea_coffee`) | 5 | kitchen_counter, cafe_stool | 없음 (블록): 가구 0/2, 소품 0/5 |
| 운동·아웃도어 (`outdoor`) | 5 | bike_rack_wall, camp_chair | 없음 (블록): 가구 0/2, 소품 0/5 |
| 영화·애니 (`movie`) | 4 | tv, projector | **포함 (전부)**: 가구 2/2, 소품 4/4 |
| 반려동물 (`pet`) | 5 | - | 없음 (블록): 가구 0/0, 소품 0/5 |

- 선택 규칙: **세부 관심사를 최대 10개** 고름. 카테고리는 고른 세부 관심사에서 정해짐 (그 카테고리를 **하나라도** 고르면 카테고리 가구가 놓임)
- 아직 모델이 없는 관심사도 온보딩 목록에는 **전부 나옴** (3번 블록으로 대체)

## 2. 카탈로그 구조와 로딩 규칙

### 2-1. 파일 3개

| 파일 | 내용 |
|---|---|
| `docs/interest_catalog.json` | 온보딩 목록 (1번) |
| `docs/furniture_catalog.json` | **112줄**: 모델 1개 = 1줄. 키: `id`/`node`(glb 안 노드 이름), `name_ko`, `type`, `category`, `sub_interest`, `glb`, `glb_compressed`, `size_m`(w·d·h, m), `slot`, `sit_point`, `source`(출처), `pos_blender`, `status`, `desc` |
| `docs/slots.json` | **45슬롯**: 가구 21 + 선반 소품 12 + 바닥 소품 2 + 동물 5 + 동물 용품 5. 키: `name`, `kind`, `category`, `pos_three`(x,y,z), `ry_deg`, `max_m`, `mount`, `drop`(낙하 값, 8번) |

`furniture_catalog.json`의 `type`:

| type | 개수 | 뜻 | 코드가 할 일 |
|---|---|---|---|
| `base` | 6 | 기본 가구 (침대, 협탁, 원탁, 방석 2, 천장 램프) | 항상 놓음 (`room_base_v2`) |
| `deco` | 10 | 장식 7 (`room_deco_v1`) + 벽 선반 3 (`room_shelves_v1`) | 항상 놓음 |
| `category_furniture` | 21 | 카테고리 가구 (`slot.name` 고정) | 카테고리를 고르면 놓음 |
| `sub_prop` | 65 | 세부 관심사 소품 | 그 관심사를 고르면 놓음 |
| `pet` | 5 | 반려동물 (`slot.name` = `pet_slot_NN`) | 그 동물을 고르면 놓음 |
| `deco_attached` | 1 | `cooking_pot` (조리대의 자식, 6번) | 조리대가 놓일 때만 |
| `unused` | 4 | 새 구조에서 안 쓰는 옛 가구 (`treadmill`, `dumbbell_rack`, `suitcase_stack`, `spice_rack`) | **무시** |

`status`: **`built`** = `glb`가 이 zip에 있음 / **`todo`** = `glb: null`, 아직 안 보냄 (블록으로 대체) / `unused`. 규칙: **`glb`가 null이면 `todo`** (`unused` 제외). `todo` 중 `built_in_blender: true`는 모델은 있지만 슬롯에 맞추는 작업·내보내기가 아직인 것 (해당 카테고리 전달 때 들어옴).

### 2-2. 로딩 규칙

1. **기본**: `type`이 `base`·`deco`인 행의 glb를 방 원점에 그대로 얹기 (`room_shell_v2`, `room_base_v2`, `room_deco_v1`, `room_shelves_v1`, `room_ceiling_hole_v1`). 이 glb 안 노드는 방 좌표 그대로라 위치를 따로 주지 않음
2. **카테고리 가구**: 고른 카테고리의 `furniture_slots` **전부** 채움. 슬롯은 서로 겹치지 않게 만들어 둠 (카테고리 10개를 다 골라도 안 겹침). **슬롯 고정이라 순서·조합에 따라 위치가 바뀌지 않음**
3. **선반 소품**: 선반 12칸(`prop_slot_01~12`) 중 **비어 있는 칸**에 놓음. 기준 = 그 카테고리 **주 가구 슬롯에서 가까운 칸부터** (가까운 순). 카테고리는 고른 순서, 같은 카테고리 안에서는 고른 순서
4. **바닥 소품**: 기타(`slot.kind: floor`)는 `prop_slot_13` 고정. 선반을 쓰지 않으니 기타를 고르면 선반은 최대 9개 (선택 10개여도 12칸으로 충분)
5. **동물**: 동물 행의 `slot.name`(`pet_slot_01~05`) 고정. 동물 용품 행은 `slot.name`(`prop_slot_15~19`)과 `slot.paired_pet`이 있음 → 동물을 고르면 용품도 같이. 동물 5마리를 다 골라도 자리가 따로 있음
6. **크기**: 모델은 이미 슬롯에 맞게 구워 둠 → 노드 `scale`은 **1 그대로**, `scale_to_fit`을 곱하지 말기 (카탈로그의 `scale_to_fit`은 모두 1.0)

```js
// slots: slots.json, cat: furniture_catalog.json, ic: interest_catalog.json, picks: 고른 세부 관심사 id (순서대로)
const bySlot = n => slots.find(s => s.name === n);
const subs = ic.filter(r => r.type === 'sub'), cats = ic.filter(r => r.type === 'category');
const shelf = slots.filter(s => s.kind === 'shelf');            // prop_slot_01~12
const used = new Set();
const planned = [];                                             // { row, slot }

// 카테고리 가구
const chosenCats = [...new Set(picks.map(id => subs.find(s => s.id === id).category))];
for (const c of chosenCats) {
  const cd = cats.find(x => x.id === c);
  cd.furniture.forEach((fid, i) => planned.push({ row: cat.find(r => r.id === fid), slot: bySlot(cd.furniture_slots[i]) }));
}
// 소품
for (const id of picks) {
  const sub = subs.find(s => s.id === id), prop = cat.find(r => r.id === sub.prop);
  if (sub.slot_kind === 'shelf') {
    const main = bySlot(cats.find(x => x.id === sub.category).furniture_slots[0]);
    const free = shelf.filter(s => !used.has(s.name))
      .sort((a, b) => dist(a, main) - dist(b, main) || a.name.localeCompare(b.name));   // 가까운 순
    used.add(free[0].name); planned.push({ row: prop, slot: free[0] });
  } else {                                                      // floor(기타) / pet_floor(동물 용품)
    planned.push({ row: prop, slot: bySlot(prop.slot.name) });
    if (sub.pet) planned.push({ row: cat.find(r => r.id === sub.pet), slot: bySlot(cat.find(r => r.id === sub.pet).slot.name) });
  }
}
const dist = (a, b) => Math.hypot(a.pos_three[0] - b.pos_three[0], a.pos_three[2] - b.pos_three[2]);

// 놓기: glb 노드를 복제 (node 이름 = row.node), 슬롯 위치·방향
function place(root, row, slot) {
  const obj = root.getObjectByName(row.node).clone(true);
  obj.position.set(...slot.pos_three);                          // 선반·벽걸이는 y가 높이
  obj.rotation.y = THREE.MathUtils.degToRad(slot.ry_deg);
  scene.add(obj);
}
```

- 슬롯 좌표 `pos_three` = Blender `(x, y, z)` → three.js `(x, z, −y)`, `ry_deg` = `rotation.y` (도)
- 가구 glb(`interest_*_v1`)는 노드마다 **원점 = 바닥 중심, 위치 (0,0,0), 회전 0**. 벽걸이는 아래쪽 면 중심. 한 glb에서 필요한 노드만 복제해서 쓰면 됨
- 접촉 그림자 `shadow_<id>` 자식이 있는 6개(`tripod_camera`, `bookshelf`, `reading_lamp`, `projector`, `easel`, `drawing_stool`)는 가구와 같이 움직임. `depthWrite=false`
- 선반 소품 노드 `extras.slot_name`(예: `camera_case`의 `prop_slot_08`)은 **작업용 임시 칸**이니 무시하고 위 3번 규칙으로 배정

## 3. `glb`가 null인 항목은 둥근 블록으로 대체

대상: `status: todo`인 `category_furniture`·`sub_prop`·`pet` 행. (`unused`는 건너뛰기, `deco_attached` `cooking_pot`은 조리대가 블록이면 건너뛰기)

- 크기: 행의 `size_m` (w 가로, d 깊이, h 높이). 슬롯의 `max_m`보다 작거나 같게 만들어 둔 값이라 슬롯 안에 들어감
- 위치·방향: 진짜 모델과 같이 슬롯의 `pos_three`, `ry_deg`. **블록의 바닥 면이 `pos_three.y`** (원점 = 바닥 중심)
- 모양: 모서리가 둥근 상자. 동물은 알 모양(타원체)
- 색: 팔레트 색만, 무광 (`roughness 0.8`). 카테고리마다 다른 색을 추천: 음악 `#E8743B` · 사진 `#A8D4EE` · 자연 `#8CC56A` · 게임 `#F5C452` · 공예 `#C98A5A` · 책 `#A86B45` · 우주·과학 `#A8D4EE` · 차·커피 `#F7E6C8` · 아웃도어 `#8CC56A` · 영화 `#E8743B` · 동물 `#F7E6C8`
- 블록에도 낙하(`drop`)·먼지가 똑같이 적용됨 (모델 대신 블록이 떨어짐). 이름표는 선택 (`name_ko`)

```js
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
function makeBlock(row, slot, color) {
  const { w, d, h } = row.size_m, r = Math.min(w, d, h) * 0.12;
  const geo = row.type === 'pet' ? new THREE.SphereGeometry(0.5, 24, 16) : new RoundedBoxGeometry(w, h, d, 4, r);
  if (row.type === 'pet') geo.scale(w, h, d);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  const g = new THREE.Group(); m.position.y = h / 2; g.add(m);   // 바닥 중심 원점
  g.position.set(...slot.pos_three); g.rotation.y = THREE.MathUtils.degToRad(slot.ry_deg);
  return g;
}
```

- 모델이 들어오면 카탈로그의 `glb`가 채워지고 `status`가 `built`로 바뀜 → **코드 변경 없이** 블록이 모델로 바뀜

## 4. glb 안 `userData.interest`는 옛 값 — 카탈로그를 기준으로

- **액세서리 glb(`accessories_v1.glb`, v1.1에서 받은 것 그대로)** 안 관심사 전용 10개의 `userData.interest`에는 **옛 관심사 이름(한글)**이 들어 있음: 음악, 운동, 요리, 식물, 영화, 사진, 독서, 게임, 그림, 여행. 모델은 바뀌지 않았으니 **이 값으로 열어 주지 말고** `interest_catalog.json`의 카테고리 `accessories` 목록을 기준으로 할 것 (`docs/accessories.md` 4번 표)
- 이번에 받는 관심사 glb(`interest_*_v1`)의 노드 `extras`에는 옛 `interest` 키가 **없음**. 새 키: `catalog_id`, `category`, `type`, `sub_interest`(소품만), `slot_kind`, `name_ko`, `group`
- 옛 id(`exercise`, `reading`, `cooking`, `drawing`, `plants`, `travel`)는 카탈로그에서 없어졌음: 운동·여행 → `outdoor`, 독서 → `book`, 요리 → `tea_coffee`, 그림 → `craft`, 식물 → `nature`. 새로 생긴 카테고리는 `science`, `pet`

## 5. 액세서리 규칙 (v1.2에서 정한 그대로, 모델 변경 없음)

- **부위(head, face, neck, hand)마다 1개씩, 최대 4개** 동시 착용 (이전: 최대 2개). 같은 부위는 하나만
- **`socket_mouth`는 쓰지 않음**: 콧수염 3종이 최종에서 빠졌고, `mole_v1_1.glb`에 소켓만 남아 있음
- 불가 조합 1개: `ribbon_back` 등 리본 + `prop_suitcase` 작은 캐리어 (하나를 끼면 다른 하나는 잠금)
- 손 소품 숨김 규칙: `mole_greet`·`mole_drink`는 항상, `mole_butt_wiggle`·`mole_burrow_enter`는 손 = `prop_candy_star`/`prop_candy_heart` + 목 = `scarf_knit`일 때만 (`handVisible()` 코드는 `docs/accessories.md` 2-2번)
- 관심사 전용 액세서리 연결이 **새 카테고리 11개 기준으로 다시 정리됨** (`docs/accessories.md` 4번). 우주·과학, 반려동물은 전용 액세서리 없음
- 액세서리·두더지 glb는 이번 zip에 없음 → v1.1의 `accessories_v1.glb`, `mole_v1_1*.glb`를 그대로 사용

## 6. 노란 방석 위치 변경, `sit_point_cushion_02`, 냄비는 조리대 자식

| 항목 | 이전 (v2 `room_base_v1`) | 지금 (v3 `room_base_v2`) |
|---|---|---|
| `cushion_yellow` 위치 (three.js) | (−0.70, 0, −1.85) 원탁 뒤 | **(−0.90, 0, −0.35)**, `rotation.y` **+90°** (방 가운데를 봄) |
| 앉는 위치 | 없음 (앞이 원탁이라 막힘) | **`sit_point_cushion_02`**: 방석의 자식, 월드 (−0.95, 0.13, −0.35). 걸어오는 시작점 (−0.25, 0, −0.35)에서 −X로 걸어옴 |
| 나머지 노드 | | 이전 파일과 **위치·회전이 똑같음** (노드 44개 중 방석 1개만 다름, 새 노드 1개) |

- 앉기 동작 `mole_sit_cushion` → `mole_sit_idle` → `mole_stand_up_cushion`은 `sit_point_cushion_01`과 같음. 전체 프레임에서 두더지와 다른 가구 거리 2.7cm 이상 확인. 자세한 내용은 `docs/sit_points.md`
- `cooking_pot`(냄비)은 **`kitchen_counter`(조리대)의 자식**: 카탈로그 `type: deco_attached`, 조리대 가스레인지 오른쪽 앞 화구 위. 조리대가 슬롯으로 옮겨져 줄어들어도 같이 움직임. 조리대(차·커피 카테고리)는 M3에 들어오므로 **지금은 `todo`**
- 카탈로그 `cushion_yellow` 행: `pos_blender` (−0.9, 0.35, 0), `rz_deg` 90, `sit_point: sit_point_cushion_02`. 기본 가구 6개의 `pos_blender`를 방 파일과 비교해 모두 맞음을 확인

## 7. 아직 안 만든 카테고리와 다음 전달

이번에 들어온 카테고리는 **사진, 책·글, 영화·애니, 공예·만들기** (4개). 아래 7개는 카테고리 가구·소품이 아직 `glb: null` → 블록으로 대체.

| 전달 | 카테고리 | 새로 만들 것 | 상태 |
|---|---|---|---|
| **M2** | 운동·아웃도어 (`outdoor`) | 자전거 벽걸이, 캠핑 의자 + 소품 5 | 소품 2개(배낭, 요가매트)는 방 파일에 옛 모델이 있음 |
| | 자연·식물 (`nature`) | 테라리움 벤치 + 소품 6 (화분, 물뿌리개 등) | 가구 1·소품 2개는 옛 모델이 방 파일에 있음 |
| **M3** | 차·커피·베이킹 (`tea_coffee`) | 카페 의자 + 소품 5 | 조리대는 옛 모델이 있음 (냄비는 조리대 자식) |
| | 음악 (`music`) | 피아노·스피커·의자 + 소품 9 | 가구 3 + 기타는 옛 모델이 있음 |
| | 게임·놀이 (`game`) | 아케이드·빈백 + 소품 10 | 가구 2 + 게임기는 옛 모델이 있음. **빈백 앉는 위치(`sit_point_chair_01`)도 이때** |
| | 우주·과학 (`science`) | 망원경, 광물 벤치 + 소품 9 | 지구본만 옛 모델이 있음 |
| **M4** | 반려동물 (`pet`) | 동물 5 (고양이·강아지·앵무새·도마뱀·개미) + 용품 5 | 전부 새로 만듦 |

- 일정: 순서는 M2 → M3 → M4. **날짜는 아직 안 정해짐**. 정해지면 따로 알림
- "옛 모델이 방 파일에 있음" = 아직 슬롯에 맞추는 작업·내보내기를 안 한 것이라 이번 zip에는 없음 (`built_in_blender: true`)
- CC-BY 3개(기타 jeremy, 오락기·빈백 J-Toastie)는 M3에 들어옴 → 그때 앱에 작가 표기 필요 (`docs/credits.md` "필수 작가 표기")
- M2 이후 전달에서 이번 파일(`interest_*_v1`, `room_shelves_v1`, `room_base_v2`)은 **바뀌지 않는 한 그대로**. 바뀌면 `_v2`로 이름을 올림

## 8. 낙하 연출 변경 (`docs/furniture_drop_spec.md` v3)

- 시작 높이·가로 오프셋 표를 **슬롯 기준**으로 다시 계산 (옛 표는 이전 가구 31개 이름 기준). 값은 `slots.json`의 `drop`에도 있음: `{ mode, H, S, dust, basis }`
- **선반 소품은 떨어지지 않고 제자리에서 퐁 등장(`pop`)**, 먼지 없음 (선반이 위에 있고 바로 아래가 벽이라서). 벽걸이 가구(사진 판, 자전거 걸이, TV)도 `pop`, 먼지 없음
- 아케이드(`furniture_slot_08`)는 착지 때 세로로 1.10배 커지면 위의 선반 03과 1cm가 되어서 `pop`으로 바꿈. 책장(`furniture_slot_12`)도 위에 선반 03이 있어 1.2m 대신 0.8m + 안쪽 0.25m에서 시작
- `basis: box`인 슬롯은 모델이 아직 없어서 슬롯 최대 크기 상자로 확인한 값. 모델이 들어오면 다시 계산해서 보냄
- 순서 규칙(세트 사이 1.0초, 세트 안 0.12초 간격, 부피가 큰 것부터)은 그대로. 코드를 새 카탈로그에 맞게 바꿨음 (4번)
- 먼지 `models/dust_puff_v1.glb`(최종판, 14KB)를 이번에 같이 보냄 (v1·v2에서 받은 `dust_puff.glb`는 확정 아님 → 이걸로 교체). 시나리오 영상은 이번 zip에 없음

## 9. 알고 있는 한계

- 벽 선반 판 두께는 4cm라 멀리서는 가늘게 보임 (돔 안쪽과의 거리 때문에 더 두껍게 못 함)
- `clapperboard`(영화) 줄무늬 막대가 판에서 약간 떠 보임
- `furniture_slot_14`(우주·과학 대표 가구)는 높이 1.45m 이하로 만들 예정 (선반 02와 간격). 그때까지 낙하 표는 임시 `pop`
- 조리대는 낙하 오프셋이 한도(1.0m)까지 필요해서 방 안쪽 1m에서 비스듬히 떨어짐
- 빈백·피아노 의자·그림 의자는 앉는 위치 없음 (`docs/sit_points.md`)
- `room_deco_v1`의 `shelf`(병이 놓인 장식 선반)와 새 `display_shelf_01~03`(소품용 선반)은 **서로 다른 것**

## 10. 파일 목록

| 경로 | 내용 | 크기 |
|---|---|---|
| `models/room_base_v2_draco_webp.glb` | **웹 권장** (Draco + WebP). 기본 가구 6개 + 앉는 위치 `sit_point_cushion_01`·`02` + 접촉 그림자 (노란 방석 이동) | 0.29MB |
| `models/room_base_v2.glb` | 압축 없는 원본. 같은 내용 | 1.46MB |
| `models/room_shelves_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 벽 선반 3개 `display_shelf_01~03` (방 좌표 그대로) | 41KB |
| `models/room_shelves_v1.glb` | 압축 없는 원본. 같은 내용 | 0.45MB |
| `models/interest_photo_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 사진: `photo_board`, `tripod_camera`, `film_camera`, `camera_case` | 0.22MB |
| `models/interest_photo_v1.glb` | 압축 없는 원본. 같은 내용 | 1.10MB |
| `models/interest_book_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 책·글: `bookshelf`, `reading_lamp`, `book_stack`, `sf_books`, `writing_notebook`, `typewriter` | 0.30MB |
| `models/interest_book_v1.glb` | 압축 없는 원본. 같은 내용 | 1.60MB |
| `models/interest_movie_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 영화·애니: `tv`, `projector`, `popcorn`, `clapperboard`, `comic_stack`, `vhs_tapes` | 0.30MB |
| `models/interest_movie_v1.glb` | 압축 없는 원본. 같은 내용 | 1.40MB |
| `models/interest_craft_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 공예·만들기: `easel`, `drawing_stool`, `paint_box`, `yarn_basket`, `pottery_vase`, `embroidery_hoop`, `sewing_kit`, `model_train` | 0.41MB |
| `models/interest_craft_v1.glb` | 압축 없는 원본. 같은 내용 | 1.85MB |
| `models/room_deco_v1_draco_webp.glb` | **웹 권장** (Draco + WebP). 장식 7개 `string_lights`, `bunting`, `hanging_plant`, `frame_01~03`, `shelf` (원본은 v2와 같은 파일) | 0.18MB |
| `models/room_deco_v1.glb` | 압축 없는 원본. 같은 내용 | 1.45MB |
| `models/dust_puff_v1.glb` | 착지 먼지 최종판 (`furniture_drop_spec.md` 5번) | 14KB |
| `docs/HANDOFF_v3.md` | 이 문서 | |
| `docs/CHANGELOG_v3.md` | v2 대비 추가·수정·삭제 표 | |
| `docs/interest_catalog.json` | 온보딩 카테고리 11 + 세부 관심사 65 | |
| `docs/furniture_catalog.json` | 모델 카탈로그 112줄 | |
| `docs/slots.json` | 슬롯 45개 + 낙하 값 | |
| `docs/interest_glb_v1.md` | 관심사 glb·벽 선반 상세 (노드·크기·규칙) | |
| `docs/accessories.md` | 액세서리 규칙·관심사 연결 | |
| `docs/sit_points.md` | 앉는 위치 (cushion_02 추가) | |
| `docs/furniture_drop_spec.md` | 낙하 연출 (슬롯 기준 표) | |
| `docs/credits.md` | 외부 에셋 출처 | |
| `images/interest_v2/layout_3.png` | 선택 3개 배치 (개발팀 참고용. 없는 모델은 둥근 블록) | 2.09MB |
| `images/interest_v2/layout_6.png` | 선택 6개 (개발팀 참고용. 없는 모델은 둥근 블록) | 2.11MB |
| `images/interest_v2/layout_10.png` | 선택 10개 (가구 슬롯 21개 전부) (개발팀 참고용. 없는 모델은 둥근 블록) | 2.15MB |
| `images/interest_v2/bundle1_layout.png` | 사진·책 실제 모델 배치 (개발팀 참고용. 없는 모델은 둥근 블록) | 2.08MB |
| `images/interest_v2/bundle2_layout.png` | 영화·공예 실제 모델 배치 (개발팀 참고용. 없는 모델은 둥근 블록) | 2.08MB |

- v2에서 받은 것 중 **바뀌지 않아 이번 zip에 없는 것**: `room_shell_v2*.glb`, `room_ceiling_hole_v1.glb`, `docs/room_spec.md`(렌더러·조명·카메라·천장 구멍 코드), 두더지·액세서리 glb. `room_spec.md` 7번의 카탈로그 형식 설명은 이 문서 2번으로 대체
- `models/room_deco_v1.glb`는 v2와 **같은 파일**이고, v2에는 없던 **압축본 `room_deco_v1_draco_webp.glb`(웹 권장)를 이번에 새로 만들어 넣음** (노드 55개·위치·회전이 원본과 같음을 확인). 카탈로그의 `deco` 행이 가리키는 파일이라 zip 하나만으로 모든 `built` 행이 열림
