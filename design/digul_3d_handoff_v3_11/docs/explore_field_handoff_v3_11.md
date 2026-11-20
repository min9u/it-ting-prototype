# 탐색 들판 인계 v3.11 (v3.10 에서 바뀐 점)

`models/` glb, `layout/explore_field_layout_150_v3_11.json` 배치, `docs/`, `images/`. 바뀌지 않은 것(바닥 모델 `explore_ground_150_v3.glb`와 흙 노드 규칙, 구멍·후광·`empty_pad`, 두더지 `mole_v1_3*.glb`와 이동 연출 `docs/mole_hop_spec.md`, 슬롯 구조, 구멍 간격 6m, 구역·자리 번호, 길 타일·links, 울타리, 사다리)은 **v3.10 과 같음**.

## 1. 바뀐 것
| 항목 | v3.10 | v3.11 |
|---|---|---|
| 열매 대지 | 5종 | **9종**(옥수수·토마토·해바라기·빵 추가, 딸기 재작업) |
| 딸기 | v2 딸기 모델 | **`strawberry_patch_v3.glb`**(물방울 모양 열매 덤불당 3~5개, 초록 꼭지, 흰 꽃). 노드 이름 `strawberry_1~3` 그대로 |
| 카메라 | 이전 카메라 스펙 | **`docs/camera_zoom_spec_v1_2.md`** (아래 3번) |

## 2. 열매 대지 9종 (`themes` 9개)
원점 바닥 중심, y=0 땅. 변형 1/2/3 = 호박 무리 1/2/3개와 같은 규칙. `themes[]` 구조(`id`, `floor_label`, `crop_glb`, `crop_nodes`, `slot_map`, `slots`)는 v3.10 과 같음. 모든 작물은 호박 슬롯 발자국 안에 들어가고 삼각형은 호박의 1.5배 이내.

| theme `id` | 모델 파일 | 노드 이름 | 키(m) | 삼각형 변형 1/2/3 | 슬롯 |
|---|---|---|---|---|---|
| `pumpkin` | `vine_patch.glb` | `vine_pumpkin_1~3` | (v3.10 과 같음) | 474 / 792 / 1048 | `null` = `zones[k].pumpkins` 그대로 |
| `apple` | `apple_patch.glb` | `apple_tree_1~3` | 1.05 | 504 / 1008 / 1512 | `themes[].slots` |
| `strawberry` | `strawberry_patch_v3.glb` | `strawberry_1~3` | 0.33 | 460 / 920 / 1326 | `themes[].slots` |
| `sweetpotato` | `sweetpotato_patch.glb` | `sweetpotato_1~3` | 0.16 | 376 / 752 / 1128 | `themes[].slots` |
| `carrot` | `carrot_patch_v2.glb` | `carrot_1~3` | 0.55 | 368 / 736 / 1104 | `themes[].slots` |
| `corn` | `corn_patch.glb` | `corn_1~3` | 1.17 | 278 / 494 / 772 | `themes[].slots` |
| `tomato` | `tomato_patch.glb` | `tomato_1~3` | 0.88 | 432 / 798 / 1164 | `themes[].slots` |
| `sunflower` | `sunflower_patch.glb` | `sunflower_1~3` | 1.14 | 240 / 494 / 734 | `themes[].slots` |
| `bread` | `bread_patch_v2.glb` | `bread_1~3` | 0.59 | 636 / 1012 / 1376 | `themes[].slots` |

- 슬롯 227개(구역 1~6 합). 사과·옥수수·해바라기는 구멍 가림(시선 약 29° 최악, 5% 이하)도 검사했고 슬롯–구멍 중심 거리는 최소 사과 2.41m, 옥수수 2.32m, 해바라기 2.40m.
- 해바라기 꽃은 어느 방향으로 돌려도 카메라에 보이도록 약 28° 위로 기울어 있음(슬롯 `ry` 는 무작위).
- **어떤 층에 어떤 작물을 쓸지(층→theme 매핑)는 JSON 에 없음. 개발자가 정함.** 층마다 작물 1종, 꽃·풀·길·구멍은 공통.
- 삼각형 합계(공통 7.8만 포함, near 기준, 작물별 최대 구역 / 전체): 호박 13.9만 / 89.1만, 사과 15.1만 / 96.1만, 딸기 14.6만 / 93.1만, 고구마 13.9만 / 89.3만, 당근 13.9만 / 88.9만, 옥수수 12.9만 / 83.0만, 토마토 14.1만 / 90.3만, 해바라기 12.8만 / 82.4만, 빵 14.9만 / 95.1만. 모두 구역 20만, 전체 130만 이하.

## 3. 카메라 (상세 `docs/camera_zoom_spec_v1_2.md`)
거리 12 / 24 / 46m, 각도 45°, FOV 32.3°, LOD·크기 값은 v3.10 과 같음. 바뀐 규칙:
- **far 에서도 타깃은 두더지(현재 구멍)를 계속 따라가고 구멍 중앙 정렬을 허용.** far 의 좁은 한계(x ±20.7, y 14.6~45.5)와 "구멍 중앙 정렬 막음"은 삭제.
- 타깃 한계는 **outer_grass 경계에서 2m 안쪽 안전 한계**: near x ±79.3 / y −30.2~99.1, mid ±70.6 / −26.4~92.2, far ±54.7 / −19.4~79.5(Blender x, y). 구멍 150개는 어느 단계에서도 걸리지 않음. 모든 단계에서 화면이 outer_grass 를 넘지 않음(최소 여유 far 6.7m).
- JSON `camera` 블록: 타깃 한계는 `camera.levels.*.target_limit_safe_outer_grass` 만, 두더지 따라가기는 `camera.follow`. 옛 한계 키는 JSON 에 없음. `one_screen`·`overflow_when_centering_hole` 은 "참고용"(규칙 아님). `zones[k].camera_target_rect_blender` 는 어디에도 쓰이지 않는 참고 값.
- 줌 전환 0.5s 동안 **거리만** 로그 보간(타깃은 구멍 유지). 보정이 필요할 때만 보정량을 임계감쇠 스프링(ω=10 rad/s, 95% 수렴 0.47s)으로 평활.
- 우선순위: ① hop 패닝(0.4s, 줌과 독립) > ② 줌 > ③ 한계 보정. hop 중 구멍 이동 입력은 잠그고 줌 입력은 허용.
- 구역 1개만 켰을 때 far: 구역 맞춤 타깃에서 ±9m 까지만 두더지를 따라감(활성 구역 비율 최소 46%). near·mid 는 그대로 따라감.
- 두더지·구멍·작물 크기는 단계 경계에서 튀지 않게 거리에 연속 적용(`camera.follow.scale_by_distance`).

## 4. 교체/삭제된 이름 (v3.11 zip 에는 없음)
| 이름 | 상태 |
|---|---|
| `strawberry_patch_v2.glb` | **교체** → `strawberry_patch_v3.glb` |
| `camera_zoom_spec_v1_1.md` | **교체** → `camera_zoom_spec_v1_2.md` |
| `explore_field_layout_150_v3_10.json` | **교체** → `explore_field_layout_150_v3_11.json` |
| `explore_field_handoff_v3_10.md` | **교체** → 이 문서 |
| `bread_patch.glb`(빵 첫 버전) | **삭제** → `bread_patch_v2.glb` |
| 5종 시절 이미지 `crops_compare_camera_v2.png`, `crops_zone1_topview_5panel_v2.png`, `camera_far_zone1.png`, `camera_levels_compare.png` | **삭제** → `crops9_*.png`, `camera_far_edge_check.png` |

## 5. 파일 목록
- `models/`: explore_ground_150_v3, hole_v2, hole_mine_halo, empty_pad, path_kit, fence, ladder_shaft, grass_tuft_small, flowers, pumpkin, mole_v1_3, mole_v1_3_draco_webp, vine_patch, apple_patch, strawberry_patch_v3, sweetpotato_patch, carrot_patch_v2, corn_patch, tomato_patch, sunflower_patch, bread_patch_v2 (.glb)
- `layout/`: explore_field_layout_150_v3_11.json
- `docs/`: explore_field_handoff_v3_11.md(이 문서), camera_zoom_spec_v1_2.md, mole_hop_spec.md, animation_list_v1_3.md
- `images/`: field_150_grassfull_topview.png, crops9_compare_camera.png, crops9_zone1_topview.png, camera_far_edge_check.png, bread_v2_check.png
