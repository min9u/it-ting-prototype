# 탐색 들판 인계 v3.10 (v3.9 에서 바뀐 점)

`models/` glb, `layout/explore_field_layout_150_v3_10.json` 배치, `docs/`, `images/`. 변경 없는 것(구멍 모델 `hole_v2.glb`·후광·`empty_pad.glb`, 두더지 `mole_v1_3*.glb`, 이동 연출 `docs/mole_hop_spec.md`, Enter 입장 규칙, 구멍 간격 6m, 구역 6칸·150자리·자리 번호 규칙, 길 타일·links, 울타리, 사다리, 카메라 near 값)은 **v3.9 와 같음**.

## 1. 바뀐 것
| 항목 | v3.9 | v3.10 |
|---|---|---|
| 바닥 | 흙 슬랩 + 잔디 덩어리(`grass_patch_1~3`) | **바닥 전체 잔디**(정점 색, 큰 규모 명암). 잔디 덩어리 없음, `grass_patch.glb` **삭제** |
| 흙 | 없음(덩어리 사이 흙) | 길·구멍 주변에만 부드러운 띠(정점 색 흙→잔디 그라데이션). 화면에 보이는 흙 약 14% |
| 호박·꽃·풀 | 덩어리 위 | 잔디 어디든(흙만 피함) 다시 배치. 호박 구역당 86~89, 꽃 구역당 141~150(3~6송이 군락), 풀 구역당 63~97 |
| 열매 | 호박 1종 | **5종**(호박·사과·딸기·고구마·당근), `themes` 로 선택 |
| 카메라 | near 1단계 | near / mid / far 3단계 |

## 2. 바닥 모델 `models/explore_ground_150_v3.glb`
| 노드 | 설명 | 켜는 규칙 |
|---|---|---|
| `field_slab` | 108×72 슬랩, 정점 색 잔디 | 항상 |
| `outer_grass` | 바깥 잔디 180×144m | 항상 |
| `soil_zone1`~`soil_zone6` | 구역 **안쪽** 흙(이웃 연결 흙 미포함) | 구역 N 이 켜질 때 |
| `soil_link_1_2`, `1_3`, `1_5`, `2_4`, `2_6`, `3_4`, `5_6` | N구역↔M구역 연결 흙 띠(경계마다 1노드, 연결 길 2개 포함) | **N·M 두 구역이 모두 켜져 있을 때만** |
- 켜지 않은 구역: 작물·꽃·풀·길·울타리·흙 모두 숨김, 바닥은 잔디만. 구역 하나만 켜도 안쪽 흙은 가장자리에서 끊기지 않음(경계 흙 가중치 0).
- JSON: `common.ground.soil_by_zone`(구역→노드), `common.ground.soil_links`(경계→노드·구역), `soil_rule`(규칙 한 줄). 경계 길 타일은 이전처럼 `zones[k].links` 를 구역 k 를 켤 때 적용(soil_link 와 같은 시점).
- 흙 삼각형: `soil_zone` 8.7~8.9천 ×6(합 5.3만), `soil_link` 0.9~1.5천 ×7(합 0.8만).

## 3. 열매 대지 5종 (`themes`)
- 모델: `vine_patch.glb`(호박 `vine_pumpkin_1~3`), `apple_patch.glb`(`apple_tree_1~3`), `strawberry_patch_v2.glb`(`strawberry_1~3`), `sweetpotato_patch.glb`(`sweetpotato_1~3`), `carrot_patch_v2.glb`(`carrot_1~3`). 원점 바닥 중심, y=0 땅.
- `themes[]`: `id`/`floor_label`(작물 이름), `crop_glb`, `crop_nodes`(변형 1~3), `grass_color`·`soil_color`(지금은 모두 `#8CC56A` / `#F0B47A`), `slot_map`(`vine_pumpkin_K` → 그 작물의 변형 K), `slots`.
- **슬롯**: 기본 슬롯은 `zones[k].pumpkins`(호박, node `vine_pumpkin_1~3`). 호박 theme 의 `slots` 는 `null` = 기본 슬롯 그대로. 다른 작물은 `slots`(zone, node, position/ry/scale, 이동 여부)에 **그 작물 전용 슬롯 목록**이 있으니 이것을 사용(흙·이웃 겹침을 피하려고 일부만 위치·크기 조정, 사과나무는 구멍 가림도 고려).
- **어떤 층에 어떤 작물을 쓸지는 정해지지 않았음. 층→theme 매핑은 개발자가 정함.** 층마다 작물은 1종만 쓰고, 꽃·풀·길·구멍은 공통.

## 4. 카메라 3단계 (상세 `docs/camera_zoom_spec_v1_1.md`)
| | near | mid | far |
|---|---|---|---|
| 거리 / 각도 / FOV | 12m / 45° / 32.3° | 24m | 46m |
| 보이는 땅 | 9.6~17.4m × 10.7m | 19.2~34.8m × 21.5m | 36.7~66.7m × 41.1m |
| 타깃 한계(전체) x / y | ±45.3 / 3.8~65.1 | ±36.6 / 7.6~58.2 | ±20.7 / 14.6~45.5 |
| 구멍 중앙 정렬 | 허용 | 허용 | **막음**(한계 고정, 단일 구역은 (구역 중심 x, 구역 y0+11.1)) |
| 꽃 | 전부 | 50% | 끔 |
| 풀 뭉치 | 전부 | 끔 | 끔 |
| 작물 | 1.0 | 1.0 | **×1.25** |
| 구멍(림·안쪽·후광) | 1.0 | 1.0 | **×1.25** |
| 두더지 | 1.0 | ×1.15 | **×1.5** |
| 구역당 삼각형(호박) | 13.2~13.7만 | 약 9.7만 | 약 6.2만 |
- 타깃 한계 공식: 활성 구역 합집합 U 에서 x ∈ [U.x0+먼변반폭, U.x1−먼변반폭], y ∈ [U.y0+타깃→가까운변, U.y1−타깃→먼변] (계수는 JSON `camera.levels`).
- 줌 조작: 휠 누적 ±80 이면 한 단계, 250ms 디바운스, `+`/`-` 키·버튼 3개. 전환 0.5s `cubic-bezier(0.4,0,0.2,1)`, 거리는 로그 보간, 각도·FOV 고정, 매 프레임 한계 재적용. LOD 전환은 D<17 near, 17~34 mid, >34 far(±10% 히스테리시스).
- 이동 연출: hop 클립 속도 그대로, 카메라 패닝 near·mid 0.4s, far 0.35s, 12m 이상 점프 +0.1s. 구멍 번호 UI: near·mid 전부, far 는 내 번호·마우스 올린 구멍만(권장).
- 삼각형 합계(공통 7.8만 포함, near 기준): 호박 89.1만, 사과 96.1만(130만 이하), 구역당 최대 15.1만(20만 이하, 링크 흙 포함).

## 5. 헷갈릴 수 있는 곳
| 항목 | 설명 |
|---|---|
| `grass_patch.glb` | **삭제**(zip 에 없음). 잔디 덩어리·`grass_patch_1~3` 사용 안 함 |
| 작은 풀 모델 | 이전엔 `grass_patch.glb` 안의 `grass_tuft_small` 노드 → 이제 **`grass_tuft_small.glb`**(노드 이름 같음, JSON `grass_tufts[].glb` 갱신) |
| `explore_ground_150_v2.glb`(`soil_zoneN` 이 링크 흙 포함) | v3.10 에서 **`explore_ground_150_v3.glb`** 로 교체. `soil_zoneN` 은 안쪽 흙만, 링크 흙은 `soil_link_N_M` |
| `strawberry_patch.glb`, `carrot_patch.glb` | **`*_v2.glb`** 로 교체(딸기 열매 크고 많음·키 0.33m, 당근 뿌리 `#FF6A00` 크게·잎 짧고 통통). 노드 이름 `strawberry_1~3`, `carrot_1~3` 은 같음 |
| `zones[k].pumpkins` | 이름은 그대로지만 **작물 기본 슬롯**(호박 노드). 다른 작물은 `themes[].slots` |
| `explore_field_layout_150*.json` 여러 개 | 이 zip 의 `layout/explore_field_layout_150_v3_10.json` 한 개만 사용 |
| 반 단위 25자리 파일·집(`class_hut.glb`) | v3.9 부터 사용 안 함, 없음 |

## 6. 파일 목록
`models/`: explore_ground_150_v3, hole_v2, hole_mine_halo, empty_pad, path_kit, fence, ladder_shaft, grass_tuft_small, flowers, pumpkin, vine_patch, apple_patch, strawberry_patch_v2, sweetpotato_patch, carrot_patch_v2, mole_v1_3, mole_v1_3_draco_webp (.glb)
`layout/`: explore_field_layout_150_v3_10.json · `docs/`: 이 문서, camera_zoom_spec_v1_1.md, mole_hop_spec.md, animation_list_v1_3.md · `images/`: field_150_grassfull_topview.png, crops_compare_camera_v2.png, crops_zone1_topview_5panel_v2.png, camera_levels_compare.png, camera_far_zone1.png(카메라 이미지 2장은 v3.10 변경 전 렌더라 far 작물 ×1.4·경계 흙 토막 포함, 구도 참고용)
