# 탐색 들판 인계 (v3.8, 25자리)

zip: `handoff/digul_3d_handoff_v3_8_explore25_20261114.zip` — 폴더 `models/`(glb) `layout/`(배치 JSON) `docs/` `images/`.
배치는 `layout/explore_field_layout_25.json` 을 읽어 그대로 인스턴싱하면 목표 화면(`images/field_A_topview_check.png` 탑뷰)이 나옴. 이번 zip 에서 **새 렌더는 만들지 않음**(images 는 이전 작업의 확인용 그림).

## 모델 glb 위치표
이전 인계 zip(v1~v3.6)에는 두더지(`mole_v1_2*`, v3.3)와 방 가구만 있었고 탐색 들판 모델은 v3.7 zip 에서 처음 전달됐고, v3.8 zip 은 v3.7 내용 전체 + `empty_pad.glb` + 25자리 배치를 담은 완전판.
| 파일 | 이번 zip | 이전 zip |
|---|---|---|
| hole_v2.glb (`hole_rim`, `hole_inner`) | O (v3.7 과 같음) | v3.7 zip |
| hole_mine_halo.glb | O | 없음 |
| path_kit.glb | O | 없음 |
| class_hut.glb | O | 없음 |
| ladder_shaft.glb | O | 없음 |
| fence.glb | O | 없음 |
| grass_patch.glb (+`grass_tuft_small`) | O | 없음 |
| pumpkin.glb / vine_patch.glb / flowers.glb | O | 없음 |
| explore_ground.glb | O (v3.7 과 같음) | v3.7 zip |
| empty_pad.glb (빈 자리, 80 삼각형) | O (신규) | 없음 |
| mole_v1_3.glb, mole_v1_3_draco_webp.glb | O (신규, 25개 동작) | mole_v1_2*.glb 는 v3.3 zip(`digul_3d_handoff_v3_3_20261112.zip`)에 있음 |
`hole.glb`(구버전, 노드 1개)는 안 넣음. 나머지 모델은 v3.7 과 동일한 파일.

## 배치 JSON (`layout/explore_field_layout_25.json`)
- 좌표계: three.js Y-up. Blender (x,y,z) → three **(x, z, -y)**. 원점 = 들판 남쪽 가운데, 1단위 = 1m. `ry` = Y축 회전(라디안), `scale` = [x,y,z] (이미 three 축으로 변환됨).
- 배열: `holes`(자리 25, 번호·위치·ry·scale·링 색 이름/hex·`mine`·`empty_pad_alt`), `path_tiles`(106, 노드 `path_straight/corner/t/end`), `house`(1), `ladder`(1), `grass`(48), `grass_tufts`(105), `pumpkins`(38 무리, `type: crop`), `flowers`(145), `fence`(66). 항목마다 `type`, `node`(glb 안 노드 이름), `glb`, `position`, `ry`, `scale`.
- 구멍 좌표는 `docs/field_A25_stats.json` 과 같음(검증 완료). 이전 20자리 배치는 `layout/explore_field_layout.json`(v3.7) 그대로 들어 있음.
- **작물은 설정값 구조**: `theme` 블록(`crop_glb`, `crop_nodes`, `grass_color`)이 층 테마이고, 작물 항목은 위치·ry·scale 만 가진 슬롯. 다음 층(사과)은 `theme` 와 잔디색만 바꾸면 같은 배치를 재사용. 호박·덩굴 무리는 `vine_patch.glb` 노드.

## 한 화면과 카메라
- 카메라: 거리 12m, 내려다보기 45°, 세로 FOV 32.3°(상세는 `docs/explore_scene.md`). **한 화면 땅 범위: 아래 폭 9.6m ~ 위 폭 17.4m, 깊이 10.7m**(약 145㎡). 목표점 기준 앞 3.8m / 뒤 6.9m.
- 땅 안만 보이게 목표점 제한: x ±9.3, 깊이 y(Blender) 3.8~29.1 (three z = -3.8 ~ -29.1).
- 구멍을 화면 중앙에 둘 수 있게 풀 때(가장자리 구멍 포함) 땅 밖이 보이는 만큼 필요한 여유: **좌우 4.7m, 북쪽 2.9m**(남쪽 0). 슬랩 밖으로 바깥 잔디가 이만큼은 이어져야 함. `explore_ground.glb` 의 바깥 잔디 평면은 100m 라 충분.
- `explore_ground.glb`: `field_slab`(36×36 둥근 모서리 흙, 재질 `dirt`) + `outer_grass`(재질 `grass`, 높이 -0.13). 원점 = 들판 남쪽 가운데.

## 링 색 사용법 (구멍)
- `hole_v2.glb` 노드 2개: `hole_rim`(240 삼각형, 재질 `rim`, COLOR_0 흰색) / `hole_inner`(168, 재질 `hole_inner`, COLOR_0 그라데이션). 둘을 같은 위치·ry·scale 로 겹쳐 놓음.
- **`hole_rim` 만 인스턴스 색(`instanceColor`)이나 재질 복제로 색 변경. `hole_inner` 는 변경 금지.**
- 일반 구멍 10색: yellow `#F6D07B`, mint `#BCD494`, sky `#BCD8E4`, peach `#F0B389`, wood_cream `#E0B891`, wall_cream `#F4CDA1`, green_yellow `#C0C45E`, green_sky `#B6D4B4`, orange_yellow `#EE9C46`, sky_cream `#D7DFD7`. 구멍별 색은 JSON `ring_hex`.

## 내 땅굴 규칙
- 분홍 링 **`#F2A3A1`**(`ring_name: mine`, 팔레트 밖 색) + 후광 `hole_mine_halo.glb`(108 삼각형, 지름 2.92, 같은 위치) + 두더지 1마리.
- **두더지 앵커 = 구멍 중심, 높이 y(three) 0.075, 회전 0**(JSON `mole_anchor`). 구멍 바닥이 0.075 이므로 두더지 루트 0 = 구멍 바닥.
- 점프 클립·가림 방법·전체 순서는 `docs/mole_hop_spec.md`(두더지 `mole_v1_3*.glb`, 클립 `mole_hop_down` 0.417s / `mole_hop_up` 0.5s). 동작 목록 `docs/animation_list_v1_3.md`.

## 수치 (전체 들판, 25자리)
길 106칸, 잔디 48덩어리 290㎡, 호박 89개(무리 38), 꽃 145개(0.5개/㎡), 울타리 66칸(`fence.glb` 인스턴싱), 구멍 25(408 삼각형 ×25, 인스턴싱). 인스턴싱 대상: 구멍, 길 4종, 집, 사다리, 울타리, 잔디 3종, 호박·덩굴, 꽃 8종.

## v3.8 변경점 (20자리 → 25자리)
| 항목 | v3.7 (20자리) | v3.8 (25자리) |
|---|---|---|
| 자리(구멍) 수 | 20 | **25** (21~25번 추가) |
| 길 타일 | 92 (직선 64 / 모서리 14 / T 12 / 끝 2 / 십자 0) | **106** (직선 78 / 모서리 13 / T 13 / 끝 1 / 십자 1) |
| 잔디 | 42덩어리, 289.2㎡ | **48덩어리, 289.8㎡** (22%) |
| 작은 풀 뭉치 | 97 | 105 |
| 호박 | 89개 (무리 38) | 89개 (무리 38) |
| 꽃 | 145 | 145 |
| 울타리 | 66 | 66 |
- 잔디·호박·꽃·울타리는 새 구멍·길에 맞춰 다시 흩뿌렸고(밀도 규칙 그대로, 잔디 밖 호박·꽃 0, 호박~길 최소 0.42m, 잔디~구멍 최소 0.32m), 호박·꽃 개수는 면적 기준이라 그대로.
- **이동한 구멍(번호·링 색·회전 유지)**: 4번 (14,10)→(14,12), 15번 (2,26)→(4,26), 17번 (-10,32)→(-8,32). 나머지 1~20번 위치·링 색·회전은 v3.7 과 같음.
- 번호 규칙: 1~25 = **온보딩을 완료한 순서대로 배정되는 자리 번호**(반 명단 순서 아님). 아직 배정 안 된 뒤쪽 번호는 구멍 대신 `empty_pad.glb`(JSON `empty_pad_alt`: 같은 위치·ry) 를 놓거나 아무것도 놓지 않아도 됨. 25자리의 위치·ry·scale·링 색이 모두 JSON 에 있음.
- 검증: 구멍 최소 간격 6.0m, 집(16,18)과 4.47m, 사다리(0,2)와 4.47m, 구멍마다 길 2갈래 이상, 카메라 제한·집·사다리·땅 크기는 그대로.

## 자리 좌표표 (x, y = Blender 평면, three 는 (x, 0, -y)) 
| 번호 | x | y | 링 | 비고 |
|---|---|---|---|---|
| 1 | -10 | 8 | green_sky |  |
| 2 | -4 | 8 | wall_cream |  |
| 3 | 8 | 8 | mint |  |
| 4 | 14 | 12 | orange_yellow | 이동 |
| 5 | -14 | 14 | green_sky |  |
| 6 | -6 | 14 | green_yellow |  |
| 7 | 2 | 14 | sky_cream |  |
| 8 | 8 | 14 | peach |  |
| 9 | -8 | 20 | wood_cream |  |
| 10 | 0 | 20 | yellow |  |
| 11 | 6 | 20 | sky_cream |  |
| 12 | 12 | 20 | wall_cream |  |
| 13 | -14 | 26 | mine | 내 땅굴(예시) |
| 14 | -8 | 26 | orange_yellow |  |
| 15 | 4 | 26 | peach | 이동 |
| 16 | 10 | 26 | sky |  |
| 17 | -8 | 32 | mint | 이동 |
| 18 | -2 | 32 | sky |  |
| 19 | 4 | 32 | wood_cream |  |
| 20 | 14 | 32 | yellow |  |
| 21 | -14 | 20 | peach | 신규 |
| 22 | -14 | 32 | wall_cream | 신규 |
| 23 | -2 | 26 | green_sky | 신규 |
| 24 | 2 | 6 | sky | 신규 |
| 25 | 14 | 6 | wood_cream | 신규 |
