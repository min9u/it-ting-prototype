# 관심사 glb v1 — 사진 · 책·글 · 영화·애니 · 공예·만들기 (2026-11-11)

| 파일 | 크기 | 안에 있는 노드 (이름 = `furniture_catalog.json`의 id) |
|---|---|---|
| `exports/interest_photo_v1.glb` | 1.1MB | `photo_board`(벽걸이), `tripod_camera`, `film_camera`(새), `camera_case` |
| `exports/interest_photo_v1_draco_webp.glb` | 0.22MB | 같음. Draco + WebP (**웹에서 이 파일 권장**) |
| `exports/interest_book_v1.glb` | 1.5MB | `bookshelf`, `reading_lamp`, `book_stack`, `sf_books`(새), `writing_notebook`(새), `typewriter`(새) |
| `exports/interest_book_v1_draco_webp.glb` | 0.30MB | 같음. Draco + WebP (2묶음에서 `sf_books`·`writing_notebook` 다시 만들어 갱신, 이전 파일은 `exports/이전/`) |
| `exports/interest_movie_v1.glb` | 1.4MB | `tv`(벽걸이), `projector`, `popcorn`, `clapperboard`(새), `comic_stack`(새), `vhs_tapes`(새) |
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

## 벽 선반 `room_shelves_v1.glb` (+ `_draco_webp`)
| 항목 | 내용 |
|---|---|
| 노드 | `display_shelf_01`, `display_shelf_02`, `display_shelf_03` (루트마다 판 + 받침대 2개) |
| 좌표 | **방 좌표 그대로**: 노드 위치·회전이 이미 들어 있어서 방 원점(0,0,0)에 그대로 얹으면 제자리. 원점 = 선반 윗면 중심, 소품 슬롯 높이 = 윗면 |
| 크기 | 판 1.30 × 0.30 × 0.04m + 받침대 (전체 높이 0.14m) |
| 위치 (three.js x, y, z) | 01: (0, 1.35, −2.82) 뒤 벽 가운데 / 02: (1.90, 1.70, −1.83) 오른쪽 / 03: (−2.02, 1.70, −1.70) 왼쪽 |
| 소품 칸 | 01: `prop_slot_01~04`, 02: `05~08`, 03: `09~12` (`docs/slots.json`, 노드 `extras.prop_slots`) |
| 재질 | 나무 팔레트색 PBR + AO 1장(1024px, 두 번째 UV). 0.45MB / 압축본 0.04MB |
| 돔 안쪽 거리 | 01번 5.8cm, 02·03번 14.9cm |
