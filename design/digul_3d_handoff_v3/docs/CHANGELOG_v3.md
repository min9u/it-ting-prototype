# CHANGELOG v3 (v2 대비) — 2026-11-11

## 추가

| 항목 | 내용 | 파일 |
|---|---|---|
| 온보딩 구조 | 카테고리 11 · 세부 관심사 65 | `docs/interest_catalog.json` |
| 슬롯 | 45슬롯 (가구 21, 선반 12, 바닥 소품 2, 동물 5, 동물 용품 5) + 낙하 값 `drop` | `docs/slots.json` |
| 사진 glb | `photo_board`, `tripod_camera`, `camera_case`, `film_camera`(새) | `models/interest_photo_v1*.glb` |
| 책·글 glb | `bookshelf`, `reading_lamp`, `book_stack`, `sf_books`·`writing_notebook`·`typewriter`(새) | `models/interest_book_v1*.glb` |
| 영화·애니 glb | `tv`, `projector`, `popcorn`, `clapperboard`·`comic_stack`·`vhs_tapes`(새) | `models/interest_movie_v1*.glb` |
| 공예·만들기 glb | `easel`, `drawing_stool`, `paint_box`, `yarn_basket`·`pottery_vase`·`embroidery_hoop`·`sewing_kit`·`model_train`(새) | `models/interest_craft_v1*.glb` |
| 벽 선반 | `display_shelf_01~03` (방 좌표 그대로, 소품 칸 12개) | `models/room_shelves_v1*.glb` |
| 앉는 위치 | `sit_point_cushion_02` (노란 방석) | `models/room_base_v2*.glb` |
| 장식 압축본 | `room_deco_v1`의 Draco + WebP 버전 (v2에는 없었음, 내용은 같음) | `models/room_deco_v1_draco_webp.glb` |
| 착지 먼지 최종판 | `dust_puff` | `models/dust_puff_v1.glb` |
| 슬롯별 낙하 값 | 모든 슬롯의 `drop` (`mode`, `H`, `S`, `dust`, `basis`) | `docs/slots.json`, `docs/furniture_drop_spec.md` 3번 |
| 참고 렌더 | 선택 3·6·10개 배치, 1·2묶음 배치 | `images/interest_v2/` 5장 |
| 카탈로그 키 | `type`, `category`, `sub_interest`, `slot`, `status`, `glb_compressed`, `built_in_blender`, `rz_deg`, `prop_slots` | `docs/furniture_catalog.json` |

## 수정

| 항목 | 이전 (v2) | 지금 (v3) |
|---|---|---|
| 기본 가구 glb | `room_base_v1.glb` | **`room_base_v2.glb`** (+ 압축본). 노란 방석만 이동·회전, `sit_point_cushion_02` 추가. 나머지 노드는 같음 |
| `cushion_yellow` | (−0.70, 0, −1.85), 회전 0 | (−0.90, 0, −0.35), `rotation.y` +90° |
| 카탈로그 | 44줄, `interest` 키, 관심사 가구 31개 `glb: null` | **112줄** 새 형식, `category` 키, 모델 있는 40줄은 `built` + `glb` |
| 관심사 | 10개 (음악·운동·게임·독서·요리·그림·사진·식물·영화·여행) | 11개 카테고리 (운동·여행 → `outdoor`, 독서 → `book`, 요리 → `tea_coffee`, 그림 → `craft`, 식물 → `nature`, 새로: `science`, `pet`) |
| 가구 배치 | 가구마다 고정 좌표 | **슬롯 고정** (`slots.json`). 소품은 선반 빈 칸에 가까운 순 |
| 낙하 표 | 옛 가구 31개 이름 기준 | **슬롯 기준**. 선반 소품·벽걸이는 `pop`, 아케이드 `pop`으로 변경, 책장 0.8m + 0.25m 오프셋 |
| 낙하 순서 코드 | `interest` 필드 기준 | 카테고리·`slot.drop` 기준 (`furniture_drop_spec.md` 4번) |
| 앉는 위치 문서 | 노란 방석 절만 (cushion_02는 glb에 없음) | cushion_01·02 모두 base glb에 포함, 빈백은 M3 |
| 액세서리 문서 | 착용 규칙 v2 | 관심사 연결을 새 카테고리 11개 기준으로 정리 (모델·규칙은 그대로) |
| 출처 | 방 glb 5개 기준 | 관심사 glb·벽 선반 추가, 이번 전달에 CC-BY 없음 확인 |
| `cooking_pot` | 독립 가구 | 조리대의 자식 (`deco_attached`) |
| `string_lights` 등 `deco` | 그대로 | 그대로 (`room_deco_v1.glb`, v2와 같은 파일) |

## 삭제 · 쓰지 않음

| 항목 | 내용 |
|---|---|
| `room_base_v1.glb` | `room_base_v2.glb`로 교체 (쓰지 않기) |
| 옛 관심사 id | `exercise`, `reading`, `cooking`, `drawing`, `plants`, `travel` → 새 카테고리 id (위 표) |
| 카탈로그 `interest` 키 | `category`로 대체 |
| 옛 가구 4개 | `treadmill`, `dumbbell_rack`, `suitcase_stack`, `spice_rack`: `type: unused`, 로드하지 않음 (작업 파일에는 보관) |
| 옛 낙하 표 | 가구 이름 기준 표 → 슬롯 기준 표 |
| `dust_puff.glb` (v1·v2 참고용) | `dust_puff_v1.glb`로 교체 |

## 바뀌지 않은 것

`room_shell_v2*`, `room_ceiling_hole_v1`, `room_deco_v1`(이번 zip에 같은 파일 포함), 두더지·액세서리 glb, 렌더러·조명·카메라 값(`room_spec.md`), 액세서리 착용 규칙(부위별 1개, 최대 4개).
