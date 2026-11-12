# 관심사 glb v1 — 사진 · 책·글 · 영화·애니 · 공예·만들기 (2026-11-11)

| 파일 | 크기 | 안에 있는 노드 (이름 = `furniture_catalog.json`의 id) |
|---|---|---|
| `exports/interest_photo_v1.glb` (**v3.1: `interest_photo_v1_1.glb`를 쓰기**) | 1.1MB | `photo_board`(벽걸이), `tripod_camera`, `film_camera`(새), `camera_case` |
| `exports/interest_photo_v1_draco_webp.glb` | 0.22MB | 같음. Draco + WebP (**웹에서 이 파일 권장**) |
| `exports/interest_book_v1.glb` | 1.5MB | `bookshelf`, `reading_lamp`, `book_stack`, `sf_books`(새), `writing_notebook`(새), `typewriter`(새) |
| `exports/interest_book_v1_draco_webp.glb` | 0.30MB | 같음. Draco + WebP (2묶음에서 `sf_books`·`writing_notebook` 다시 만들어 갱신, 이전 파일은 `exports/이전/`) |
| `exports/interest_movie_v1.glb` (**v3.1: `interest_movie_v1_1.glb`를 쓰기**) | 1.4MB | `tv`(벽걸이), `projector`, `popcorn`, `clapperboard`(새), `comic_stack`(새), `vhs_tapes`(새) |
| `exports/interest_movie_v1_draco_webp.glb` | 0.30MB | 같음. Draco + WebP |
| `exports/interest_craft_v1.glb` | 1.8MB | `easel`, `drawing_stool`, `paint_box`, `yarn_basket`, `pottery_vase`, `embroidery_hoop`, `sewing_kit`, `model_train` (뒤 5개 새) |
| `exports/interest_craft_v1_draco_webp.glb` | 0.41MB | 같음. Draco + WebP |

## 규칙
- 모든 노드: **위치 (0,0,0), 회전 0, 크기 1**. 원점 = 가구 **바닥 중심** (벽걸이는 아래쪽 면 중심). 슬롯에 맞춘 크기는 이미 모양에 구워 넣음 → 코드에서 `scale_to_fit`을 곱하지 말 것 (카탈로그 값 1.0)
- 놓는 법: 노드를 복제해서 `docs/slots.json`의 슬롯 `pos_three`에 놓고 `rotation.y = ry_deg`(라디안 변환). 카테고리 가구는 카탈로그 `slot.name`, 소품은 비어 있는 선반 칸 (`docs/HANDOFF_v3.md` 2번)
- 노드 `extras`: `catalog_id`, `category`, `type`, `sub_interest`(소품만), `slot_kind`, `name_ko`, `group`
- 재질: 팔레트 색 PBR + **AO 텍스처 1장(1024px, `occlusionTexture`, 두 번째 UV)**. 기본 가구(`room_base_v2.glb`)와 같은 방식이라 `aoMap`으로 환경광에만 적용. 구운 조명은 없음 (실시간 조명)
- 바닥에 서는 가구 6개(`tripod_camera`, `bookshelf`, `reading_lamp`, `projector`, `easel`, `drawing_stool`)는 자식 `shadow_<id>` 접촉 그림자 판이 있음 (검정 + 알파, `depthWrite=false`). 그림자 판 때문에 glb 전체 폭은 가구보다 0.28m 큼 (가구 실제 크기는 카탈로그 `size_m`)
- 선반 소품은 그림자 판 없음. 소품이 올라가는 선반은 `room_shelves_v1.glb` (아래 "벽 선반" 절). 소품의 노드 `extras.slot_name`(예: `camera_case`의 `prop_slot_08`)은 작업용 임시 칸이니 무시하고 **비어 있는 선반 칸에 가까운 순으로 배정**
- 이 문서의 `exports/…` 경로는 zip 안에서 `models/…`

## 새 소품 4개 (직접 제작, 슬롯 0.30×0.28×0.35m 이하)
| id | 모양 | 크기 w×d×h (m) |
|---|---|---|
| `film_camera` | 크림 본체 + 주황 윗판, 주황 렌즈 + 하늘색 유리, 필름통 | 0.264 × 0.161 × 0.19 |
| `sf_books` | 하늘색·주황 책 두 권(띠), 로켓 책갈피 | 0.132 × 0.194 × 0.325 |
| `writing_notebook` | 펼친 노트, 주황 펜, 하늘색 잉크병 | 0.292 × 0.18 × 0.08 |
| `typewriter` | 하늘색 통통한 타자기, 크림 롤러·키 10개, 주황 손잡이, 종이 | 0.288 × 0.22 × 0.305 |

## 기존 가구 크기 (굽기 전 → 후)
`bookshelf` 0.8배, `reading_lamp` 0.99배를 모양에 구움 (`scale_baked`). 나머지는 1배.
실제 크기 (그림자 판 제외): `photo_board` 0.6×0.024×0.42, `tripod_camera` 0.412×0.403×1.354, `camera_case` 0.29×0.19×0.205, `bookshelf` 0.8×0.288×1.28, `reading_lamp` 0.301×0.301×1.064, `book_stack` 0.299×0.22×0.298.

## 2묶음에서 바뀐 것
- `sf_books`: 두 권을 비슷한 비율(0.075 두께, 높이 0.24/0.22)로 넓히고, 로켓 책갈피에 날개 2개·동그란 창문. 크기 0.189×0.194×0.33
- `writing_notebook`: 두꺼운 받침 위에 20° 비스듬히 세우고 페이지를 살짝 곡선으로. 크기 0.30×0.22×0.111
- `tv`: 0.87배를 모양에 굽고, 벽걸이 슬롯 `furniture_slot_20`을 (−2.74, 0.14, 1.0) → **(−2.86, −0.25, 1.0)**로 옮김 (아케이드와 화면에서 안 겹침, 돔 안쪽 3.9cm)
- `paint_box` 0.83배를 모양에 굽기

## 새 소품 8개 (직접 제작, 0.30×0.28×0.35m 이하)
| id | 모양 | 크기 w×d×h (m) |
|---|---|---|
| `clapperboard` | 크림 판 + 더 큰 주황·크림 줄무늬 막대(열려 있음), 필름 릴 | 0.295 × 0.086 × 0.257 |
| `comic_stack` | 하늘·주황·노랑 만화책 3권 비스듬히 쌓음, 말풍선 | 0.208 × 0.25 × 0.237 |
| `vhs_tapes` | 서로 떨어뜨려 세운 VHS 3개 (주황·하늘·노랑, 라벨 창 + 릴 구멍 2개씩) | 0.292 × 0.059 × 0.2 |
| `yarn_basket` | 둥근 바구니, 털실 공 3개, 뜨개바늘 2개 | 0.244 × 0.244 × 0.338 |
| `pottery_vase` | 물레 받침 위 주황 화병 + 크림 띠 | 0.25 × 0.25 × 0.289 |
| `embroidery_hoop` | 받침에 세운 수틀, 꽃 자수 | 0.232 × 0.08 × 0.33 |
| `sewing_kit` | 나무 상자 위 딸기 바늘꽂이(1.3배), 실패 2개 | 0.248 × 0.166 × 0.249 |
| `model_train` | 선로 위 초록 증기 기차 | 0.30 × 0.12 × 0.233 |

## 벽 선반 `room_shelves_v1.glb` (+ `_draco_webp`) — **v3.1: `room_shelves_v1_1`로 교체 (아래 맨 끝 "v3.1 패치"). 이 절의 위치·돔 거리 값은 v1 기준**
| 항목 | 내용 |
|---|---|
| 노드 | `display_shelf_01`, `display_shelf_02`, `display_shelf_03` (루트마다 판 + 받침대 2개) |
| 좌표 | **방 좌표 그대로**: 노드 위치·회전이 이미 들어 있어서 방 원점(0,0,0)에 그대로 얹으면 제자리. 원점 = 선반 윗면 중심, 소품 슬롯 높이 = 윗면 |
| 크기 | 판 1.30 × 0.30 × 0.04m + 받침대 (전체 높이 0.14m) |
| 위치 (three.js x, y, z) | 01: (0, 1.35, −2.82) 뒤 벽 가운데 / 02: (1.90, 1.70, −1.83) 오른쪽 / 03: (−2.02, 1.70, −1.70) 왼쪽 |
| 소품 칸 | 01: `prop_slot_01~04`, 02: `05~08`, 03: `09~12` (`docs/slots.json`, 노드 `extras.prop_slots`) |
| 재질 | 나무 팔레트색 PBR + AO 1장(1024px, 두 번째 UV). 0.45MB / 압축본 0.04MB |
| 돔 안쪽 거리 | 01번 5.8cm, 02·03번 14.9cm |

---

# 관심사 glb 3묶음 — 운동·아웃도어 · 자연·식물 (2026-11-11)

| 파일 | 크기 | 안에 있는 노드 (이름 = 카탈로그 id) |
|---|---|---|
| `exports/interest_outdoor_v1.glb` | 2.3MB | `bike_rack_wall`(벽걸이), `camp_chair`, `backpack`, `yoga_mat`, `bike_helmet`, `chalk_bag`, `skateboard` |
| `exports/interest_outdoor_v1_draco_webp.glb` | 0.49MB | 같음. Draco + WebP (**웹에서 이 파일 권장**) |
| `exports/interest_nature_v1.glb` | 2.2MB | `plant_stand`, `terrarium_bench`, `watering_can`, `small_pot`, `terrarium_jar`, `fish_bowl`, `bonsai_pot`, `mushroom_log` |
| `exports/interest_nature_v1_draco_webp.glb` | 0.48MB | 같음. Draco + WebP |

- 모든 노드 위치 (0,0,0), 회전 0, 크기 1, 원점 = 바닥 중심 (`bike_rack_wall`만 예외: **원점 = 벽에 닿는 점(판 가운데, 자전거 바퀴 바닥 높이)**, 벽이 +Y쪽, 자전거는 -Y(방 안쪽)로 최대 0.57m 나옴). 스케일은 모두 모양에 구움. 카탈로그 `scale_to_fit` 전부 1.0
- 접촉 그림자 판 `shadow_<id>`: `camp_chair`, `terrarium_bench`, `plant_stand`
- 재질: 팔레트 색 무광 PBR + AO 1장씩 (`T_interest_outdoor_ao.png`, `T_interest_nature_ao.png`, 1024px)
- 하늘색 유리 표현(`terrarium_jar`, `fish_bowl`, `terrarium_bench` 상자)은 **불투명 무광 하늘색**. 안이 보이도록 입구를 열어 이끼·물고기를 밖으로 내놓음

## 새 모델 10개 (직접 제작)
| id | 모양 | 크기 w×d×h (m) |
|---|---|---|
| `bike_rack_wall` | **벽 나무 판 + 팔 2개에 걸린** 통통한 주황 자전거 (0.7배, 타이어 굵기 60%, 더 큰 하늘색 바퀴판, 노랑 안장·그립). 방 쪽으로 30° 돌려 걸음. 3묶음 수정으로 판·팔 추가, v3.1에서 다듬음 | 0.883 × 0.686 × 0.559 |
| `camp_chair` | 접이식 낮은 캠핑 의자, 초록 천, 크림 띠, 나무 X자 다리 (0.93배 구움) | 0.451 × 0.407 × 0.488 |
| `terrarium_bench` | 낮은 나무 벤치 위 하늘색 상자 + 이끼 언덕, 버섯, 작은 나무, 돌 (0.93배 구움) | 0.502 × 0.298 × 0.489 |
| `bike_helmet` | 노랑 헬멧 받침 위, 주황 테두리·챙, 하늘색 라이트 (0.85배 구움) | 0.226 × 0.263 × 0.138 |
| `chalk_bag` | 주황 원뿔 가방, 크림 초크 윗면, 노랑 끈·구슬, 하늘색 카라비너 | 0.213 × 0.212 × 0.26 |
| `skateboard` | 받침에 비스듬히 세운 주황 보드, 하늘색 바퀴 4개 | 0.2 × 0.13 × 0.331 |
| `terrarium_jar` | 하늘색 둥근 병 입구 위로 이끼 언덕과 버섯 3개 | 0.265 × 0.265 × 0.285 |
| `fish_bowl` | 하늘색 어항, 주황 물고기 한 마리, 초록 수초 3개, 거품 | 0.27 × 0.27 × 0.327 |
| `bonsai_pot` | 납작한 갈색 화분, 초록 구름 모양 나무 | 0.28 × 0.19 × 0.315 |
| `mushroom_log` | 통나무 토막, 주황·크림 버섯 4개, 이끼 | 0.27 × 0.16 × 0.254 |

## 기존 모델 굳히기
| id | 한 일 |
|---|---|
| `backpack` | 0.62배를 모양에 구움 (0.299 × 0.156 × 0.279) |
| `yoga_mat` | 0.49배를 모양에 구움 (0.302 × 0.093 × 0.093) |
| `plant_stand` | 슬롯 크기에 맞춰 굳힘 (0.7 × 0.7 × 1.188) |
| `watering_can` | 굳힘 (0.299 × 0.156 × 0.168) |
| `small_pot` | **직접 새로 만듦 (3묶음 수정)**: 통통한 둥근 주황 화분, 크림 테두리, 둥글고 통통한 다육 잎 15장 + 주황 꽃봉오리 (0.25 × 0.25 × 0.243) |

## 낙하 (`docs/slots.json`의 `drop`)
| 슬롯 | 가구 | 모드 | H | S | 이유 |
|---|---|---|---|---|---|
| `furniture_slot_07` | `terrarium_bench` | fall | 2.0 | 0 | 새 자리 (−1.2, 1.5)에서 돔 안쪽 5cm, 벽 선반 3cm 이상 통과 |
| `furniture_slot_18` | `bike_rack_wall` | **pop** | - | - | 벽걸이라 떨어뜨리지 않음 (곁에 선반 01·액자 01). 판 뒷면이 돔 벽에 닿고, 자전거는 돔 4.6cm, 선반 10.3cm, 액자 6.0cm, 피아노 5.4cm 이상 떨어짐 |
| `furniture_slot_19` | `camp_chair` | fall | 2.0 | 0 | 돔 안쪽 5cm, 벽 선반 3cm 이상 통과. 가까운 가구 39cm |

## 3묶음 수정 (11/11)
1. **`bike_rack_wall`**
   - 벽 나무 판(0.29 × 0.16m, 두께 8cm, **뒷면이 돔 벽 모양을 따라 1mm로 닿음**) + 둥근 팔 2개(길이 0.32, 0.40m) + 팔 끝 받침으로 윗 프레임을 받침. 자전거 0.8배(1.054 × 0.828 × 0.662m), 방 쪽으로 **30° 회전**
   - 1.0배 크기로는 30°가 들어갈 벽 자리가 없었음 (뒤쪽 벽은 선반·리브·액자·가구로 가득 참). **0.8배로 줄이면 30°도 들어감**
   - **슬롯 18 이동**: (2.615, −1.056, 0.8) → **(0.836, 2.916, 1.15)**, `ry_deg` −16°. 이전 자리는 **돔 바깥이었음**: `room_dome`·벽판이 방 중심에서 **뒤쪽 절반(y ≥ 0)에만** 있어서 y < 0 자리에는 뒤에 벽이 없음 (이전 "돔 안쪽 29cm" 값은 위쪽 천장까지 거리였음)
2. **`terrarium_bench`**: 슬롯 07 (−1.75, 1.0) → **(−1.2, 1.5)**, `ry_deg` 38.7°. 이전 자리는 침대·협탁에 가려 카메라에서 23%만 보였고, 새 자리는 95% 보임 (식물 받침 `plant_stand`에서 1.21m)
3. **`small_pot`**: 새로 만듦 (위 표). 출처는 `credits.md`에서 직접 제작으로 바꿈

## 3묶음 수정 2 — 자전거 다듬기 (11/11)
- 타이어 굵기를 **60%**로 (미세 반지름 0.07 → 0.042), 바퀴 안쪽 하늘색 원판을 그만큼 키움 (반지름 0.215 → 0.235, 타이어 안쪽까지 덮음). 통통한 느낌·팔레트 그대로
- 위치를 **화면 기준**으로 다시 찾음: 카메라(`room_camera`)에서 본 화면에서 선반·액자·리브·소품 자리와 **5px 이상 안 겹침**. 이전 자리는 왼쪽 바퀴가 가운데 벽 선반 끝과 화면에서 겹쳤음
- 새 자리: 슬롯 18 **(−1.123, 2.78, 1.32)**, `ry_deg` 22°. 판 + 팔 2개 + **30° 회전** 구조 그대로. 이 자리에 들어가도록 **0.7배**로 줄임 (0.883 × 0.686 × 0.559m). 판 뒷면은 돔 벽에 닿음
- 간격(3D): 돔 4.6cm(판 제외), 선반 01 9.6cm, 선반 01 소품 자리 상자 8.8cm, 액자 02 5.9cm, 책장 4.3cm, 식물 받침 15cm
- `T_interest_outdoor_ao.png`와 `interest_outdoor_v1*.glb`를 다시 구움·내보냄 (이전 파일은 `exports/이전/*_before_bikefix2.glb`)

## v3.1 패치 — 슬롯 전수 재검사 (11/11)
돔·벽판·리브는 방 중심에서 **뒤쪽 절반(y ≥ 0)에만** 있음. 지난 검사가 앞쪽까지 이어진 원으로 보고 y를 보정해서 "벽이 없는 슬롯"을 놓쳤고, 이번 검사는 그 보정 없이 실제 벽 메시로 다시 함 (벽에 걸리는 슬롯 3개 + 선반 15개 + 바닥 슬롯 전부).

| 바뀐 것 | 이전 (v3) | 지금 (v3.1) | 이유 |
|---|---|---|---|
| `furniture_slot_20` `tv` | (−2.859, −0.25, 1.0), ry 95° | **(−2.718, 0.528, 1.3), ry 79°** | 이전 자리는 돔 바깥이라 뒤에 벽이 없었음 (벽에서 3.8cm가 아니라 벽 자체가 없음) |
| `furniture_slot_04` `photo_board` | (2.833, 0.198, 1.5), ry −86° | **(1.114, 2.757, 1.3), ry −22°** | 벽에서 6.3cm 떠 있었음 |
| `display_shelf_01~03` | 벽에서 5.6 / 14.5 / 14.5cm 떠 있었음 | 벽에 닿음 (≤ 1cm) | `room_shelves_v1_1.glb`로 교체 |
| `prop_slot_01~12` | 선반 위 x ±0.16/±0.48 | 선반 위 x **±0.15/±0.45**, 벽 쪽으로 같이 이동 + 일부 앞뒤 1~3cm 조정 | 선반이 벽에 닿으면서 소품이 돔에 닿지 않게 (소품 실물 3.1cm 이상) |
| `prop_slot_09~12` 시연 순서 | popcorn, game_console, sf_books, book_stack | **sf_books, book_stack, popcorn, game_console** | 깊은 소품이 선반 끝에서 돔에 닿아서 안쪽 자리로 |
| `furniture_slot_07` `terrarium_bench` | (−1.75, 1.0) | **(−1.2, 1.5), ry 38.7°** | 침대·협탁에 가려 23%만 보였음 (새 자리 95%) |
| `furniture_slot_18` `bike_rack_wall` | (2.615, −1.056, 0.8) (벽 없음) | **(−1.123, 2.78, 1.32), ry 22°** | 벽에 걸리게 + 화면에서 안 겹치게 |

- 새 파일: `interest_movie_v1_1`, `interest_photo_v1_1` (+`_draco_webp`): **노드와 모양은 v1과 같음** (노드가 원점이라 위치는 `slots.json`이 정함). 카탈로그가 가리키는 이름만 바뀜. `room_shelves_v1_1` (+`_draco_webp`)은 **선반 위치가 바뀜** (방 좌표 그대로 노드에 들어 있음)
- `room_shelves_v1_1` 위치 (three.js x, y, z): 01 (0, 1.35, −2.869) / 02 (2.001, 1.70, −1.933), `rotation.y` −46° / 03 (−2.132, 1.70, −1.789), `rotation.y` 50°
- 나머지 슬롯(바닥 슬롯 전부)은 통과: 바닥 위에 있고 바닥 가장자리(반지름 3.25m) 밖으로 안 나감, 벽(뒤쪽 절반)을 뚫지 않음
