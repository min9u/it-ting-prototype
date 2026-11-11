# 3D 핸드오프 v1.1·v2 앱 반영 (2026-11-11)

## 요청
디자이너가 보낸 두 zip을 앱에 반영한다.
1. `digul_3d_handoff_v1_1_20261111.zip`: 두더지 액세서리 41개 + 소켓 있는 두더지 + `mole_showcase` 동작
2. `digul_3d_handoff_v2_20261111.zip`: 땅굴 방(껍데기·기본 가구·소품·천장 구멍), 가구 카탈로그, 착용 규칙 v2(부위마다 1개, 최대 4개)

원본은 `design/digul_3d_handoff_v1_1/`, `design/digul_3d_handoff_v2/`에 풀었다 (문서·모델만 커밋, 이미지·영상·아이콘 원본·zip은 gitignore. v1과 같은 방식).

## 1. 두더지 꾸미기
| 반영한 것 | 파일 |
|---|---|
| 액세서리 41개 목록 (머리 18·얼굴 6·목 5·손 12), 구분(기본 11·레벨 잠금 20·관심사 전용 10) | `app/src/data/moleItems.ts` |
| 아이콘: 디자이너 512px 41장 → 160px WebP (Figma 스크린샷에서 잘라 쓴 임시본을 교체) | `app/src/assets/mole-items/*.webp` |
| 착용 규칙 v2: 부위마다 1개, 최대 4개. 등 리본 + 작은 캐리어는 같이 못 낌(자물쇠·안내) | `moleItems.ts` `blockedBy`, `components/MoleDresser.tsx` |
| 잠금 UI: Lv 배지 + 자물쇠, 관심사 배지. 누르면 이유 안내 | `MoleDresser.tsx` |
| 3D 두더지에 액세서리 입히기: 소켓에 붙이기, 리본은 `SkeletonUtils.clone` + `ribbon_back_sway`(서 있을 때 약하게, 걸을 때 세게), 풍선 3종 매 프레임 위로 세우기, 인사·커피 중 손 소품 숨김(`handVisible`) | `app/src/three/moleDress.ts`, `moleActor.ts` |
| 온보딩 1 미리 보기: `mole_showcase` 반복 + 초당 60° 회전. 3D가 준비되기 전·WebGL 없음이면 2D(아이콘 겹치기) | `three/MolePreviewCanvas.tsx`, `MoleDresser.tsx` `MolePreview` |
| 땅굴 꾸미기: 고르는 중인 모습이 방 두더지에 바로 보임 (장면을 다시 만들지 않고 `setWorn`) | `screens/burrow/MyBurrow.tsx`, `components/RoomView.tsx`, `three/engine.ts` |
| 남의 땅굴: 집주인 두더지도 액세서리를 낌 (목 데이터 `User.worn`) | `data/mock.ts`, `screens/burrow/VisitBurrow.tsx` |
| 두더지 색 선택: 원래 없었음 (2D 아바타도 갈색 하나). 정리할 것 없음 | |

판단한 것
- **레벨**: 레벨 시스템이 없어서 `MY_LEVEL = 3`(목)으로 둠. Lv.2·3은 열리고 Lv.5·7은 잠김 (두 상태를 다 보이려고)
- **관심사 전용**: 땅굴 꾸미기에서는 그 관심사를 골라야 열림. 온보딩 1단계는 관심사를 고르기 전이라 Figma 범례("관심사 아이템 · 바로 고를 수 있어요")대로 열어 둠
- 관심사 이름 → 앱 관심사 태그 연결은 `INTEREST_UNLOCK` (예: 운동 = 운동·러닝·클라이밍·등산 태그, 여행 = 여행·캠핑, 음악 = 음악 분류 전체)
- 기본 착용은 Figma 예시 그대로 베레모 + 물감 팔레트

## 2. 땅굴 방
| 반영한 것 | 파일 |
|---|---|
| 껍데기(`room_shell_v2`)·소품(`room_deco_v1`): 구운 텍스처 + emissive strength(8·16) 그대로 → 실시간 조명 안 받음 | `three/roomScene.ts` |
| 기본 가구(`room_base_v1`): PBR + AO. 접촉 그림자 `shadow_*`는 depthWrite 끔·renderOrder 뒤로 | 〃 |
| 렌더러: AgX 톤매핑, 노출 1. 조명 4종 스펙 값 그대로(점광원 48.4, 보조광은 RectArea 대신 Directional 1.8, 환경광 0.785). ×683 변환 안 함 | 〃 |
| 카메라: (0, 1.56, 6.37) → (0, 2.04, 0), 세로 FOV 48.5°, 줌 3.2~6.37m, 좌우 ±15°, 위아래 75°~94.3°, 패닝 끔 (OrbitControls, 끌면 돎·휠 줌. 짧게 누르면 지금처럼 걸어감) | 〃 |
| 가구는 `furniture_catalog.json`(복사본 `app/src/data/furnitureCatalog.json`)을 읽어 처리. `glb: null` 건너뜀, 매달린 것(천장 램프)은 누를 수 없음, 나머지는 바운딩 박스로 두더지 발자리 | 〃 |
| 앉기: `sit_point_cushion_01`(extras `seat_type`·`seat_height_m`)으로 하늘색 방석에 걸어가 앉기 → 다시 조작하면 일어남 | `roomScene.ts`, `moleActor.ts` (`FurnitureData.sitAt`) |
| 원탁(찻주전자·컵)을 누르면 커피 마시기 (카탈로그에 없는 동작이라 `ACTS` 표 하나만 둠) | `roomScene.ts` |
| 입장 연출: `ceiling_hole_open` → 0.417초에 두더지 보이며 `mole_room_drop` → 1.5초에 `ceiling_hole_close` → 2.2초에 구멍 숨김. `prefers-reduced-motion`이면 생략 | `roomScene.ts`, `moleActor.ts` (`dropDelay`) |
| 두더지: 크기 1(키 1m), 러그 높이 0.03, 걷는 범위 방 반지름 3.25 − 0.5, 이동 속도는 사용자 요청 1.5배 유지 | `roomScene.ts`, `moleActor.ts` |
| 두더지 발밑 둥근 그림자 판 (바닥이 구운 텍스처라 실시간 그림자를 못 받음) | `three/roomLook.ts` |
| 3D 준비 전·WebGL 없음 자리표시: 디자이너 확인 렌더(1600×1200)에서 배경을 투명하게 따 1200px WebP로. 636px 흐린 그림 문제도 같이 해결 | `assets/room-v2.webp`, `RoomView.tsx`·`.module.css` |
| 구도: 4:3 가상 화면 높이 = 장면 높이의 114.5%, 위로 5.4% (Figma 내 땅굴 화면의 돔 크기·위치에 맞춤). 세로 화면은 가로를 꽉 채움 | `roomScene.ts` |

판단한 것
- **관심사 가구**: 31개 모두 `glb: null`이라 새 방에는 관심사 가구가 없음. 예전 코드 가구(`three/furniture.ts`, 방 크기·그림체가 다름)는 새 방에 섞지 않음. 온보딩 4 배지에 "3D 모델 준비 중" 표시. `furniture.ts`·`clay.ts`·`lighting.ts`·`post.ts`는 방에서 더 안 쓰지만 탐색하기·explore와 생성 스크립트 관계 때문에 남겨 둠
- **배경**: 스펙은 `0x805B38`이지만 Figma 화면은 페이지 흙색이 보이므로 투명 유지
- **후처리 없앰**: 예전 방은 GTAO + 색보정이었는데, 새 방은 그림자·AO가 구워져 있어 겹치면 두 번 어두워짐. 그림자 맵도 끔 → GPU가 꺼진 PC에서도 가벼워짐 (docs/gpu-fallback-research.md 방향과 같음). Bloom도 안 씀
- **Draco 안 씀**: 해독기(wasm)를 아티팩트에 따로 올려야 해서. 대신 압축 없는 원본을 텍스처 WebP + 메시 양자화(`KHR_mesh_quantization`)로 줄임 → three.js 기본 로더로 읽힘

## glb 변환
`gltf-transform` CLI의 sharp가 이 PC에서 동작하지 않아(libvips colourspace 오류) 같은 일을 스크립트로 함:
`@gltf-transform/core` + `functions.quantize()`로 읽고 쓰고, 텍스처만 Pillow로 WebP 변환.

| 파일 (`app/src/assets/models/`) | 원본 | 결과 | 처리 |
|---|---|---|---|
| `mole.glb` | `mole_v1_1.glb` 6.8MB | 0.95MB | 텍스처 1024px WebP (메시는 그대로, 뼈가 있어서) |
| `accessories.glb` | `accessories_v1.glb` 1.4MB | 1.05MB | 양자화 |
| `room_shell.glb` | `room_shell_v2.glb` 4.0MB | 0.63MB | 2048 WebP(품질 90) + 양자화 |
| `room_base.glb` | 1.5MB | 0.57MB | WebP + 양자화 |
| `room_deco.glb` | 1.4MB | 0.35MB | WebP + 양자화 |
| `room_ceiling_hole.glb` | 40KB | 32KB | 양자화 |

## 번들 크기 (vite build, 이전 커밋 58d8c7a와 비교)
| | 전 | 후 |
|---|---|---|
| 첫 화면 `index.js` | 549KB (gzip 191KB) | 605KB (gzip 230KB) — 4KB 미만 아이콘 WebP가 data URL로 들어감 |
| 3D 공통 `engine.js` (three.js) | 580KB | 553KB |
| 땅굴 `RoomCanvas.js` | 100KB | 34KB (+ `roomLook.js` 56KB: 두더지·액세서리 공용) |
| glb 합계 | 0.91MB | 3.59MB (땅굴·온보딩 미리 보기에서만 받음) |
| `dist` 전체 | 5.76MB | 8.66MB |
| 공유 빌드 큰 파일 | | `roomLook.js` 2.7MB(두더지·액세서리 data URL), `RoomCanvas.js` 2.1MB(방 data URL). 아티팩트 한도 16MB 안 |

## 확인
- `tsc -b`, `npm run build`, `npm run build:share` 통과
- 헤드리스 Edge(모션 줄이기로 낙하 연출 없이): 내 땅굴, 접힌 사이드바, 꾸미기 모드, 예린이 땅굴(요리사 모자·동그란 안경·니트 목도리·커피잔), 온보딩 1(3D 미리 보기 베레모 + 팔레트), 온보딩 4. 방 모습은 `images/room_glb_check.png`와 같은 구성·색
- 헤드리스는 rAF가 거의 안 돌아서 천장 구멍 → 낙하 → 닫힘 흐름, 걷기·앉기, 리본 흔들림, 풍선 세우기는 실제 브라우저로 확인해야 함 (못 함)

## 못 한 것 / 다음 단계
- **관심사 가구 31개가 오면**: glb를 같은 방식으로 변환해 `assets/models/`에 넣고, `furnitureCatalog.json`을 새 것으로 바꾸고, `roomScene.ts`의 `glbOf`에 파일 이름 한 줄 추가 → 관심사(`interest`: music·exercise…)를 앱 관심사 태그와 연결해 고른 것만 보이게. 빈백 `sit_point_chair_01`도 그때 앉기 가능 (`seat_type` extras만 있으면 코드 그대로)
- **CC-BY 표기**: 관심사 가구에 CC-BY 3개(기타 jeremy, 오락기·빈백 J-Toastie)가 들어 있음 → 그 가구가 들어올 때 앱 크레딧 화면(설정 등)에 `credits.md` 맨 아래 "필수 작가 표기" 문구를 넣을 것. 이번 파일은 모두 CC0
- 디자이너 작업 중: 가구 낙하 효과·먼지, 벽지 꽃무늬, 전구 줄 오른쪽 끝(`room_deco_v2`)
- 탐색하기 밭의 두더지는 아직 예전 코드 두더지 (`mole.ts`)
- 레벨 시스템(지금 `MY_LEVEL` 목값), 착용 상태 저장(지금 화면 상태)
