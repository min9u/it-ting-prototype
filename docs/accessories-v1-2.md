# 두더지 액세서리 v1.2 반영 (2026-11-22)

요청: 액세서리 v1.2(`design/digul_3d_handoff_accessories_v1_2/`, 문서 `docs/accessories_v1_2.md`)를 feat/room-interest-v3-8 위 `feat/accessories-v1-2` 에 적용.

## 한 일
- `assets/models/accessories.glb` 를 `accessories_v1_2.glb`(43개)로 교체: 1.05MB → 1.22MB, 양자화만(이전과 같은 방식, `tools/glb-quantize/`). 소켓·두더지 모델 그대로
- 학사모(`hat_mortarboard`, 머리) · 응원봉(`prop_lightstick`, 손) 추가, 아이콘 160px WebP → `assets/mole-items/`. 머리 19 · 얼굴 6 · 목 5 · 손 13
- **관심사 연결 삭제**: `MoleItem.interest/interestCat`·`lockOf`·`ACCESSORY_CATEGORY`·`InterestCategory.accessories`·`CATEGORY_3D.accessories`, 꾸미기 격자의 보라 배지와 "관심사 아이템" 범례 문구. 43개 모두 처음부터 선택 가능. glb extras 의 `interest`, `interest_catalog.json` 의 accessories 는 안 씀
- 규칙: 인사·커피 중 손 소품 숨김(기존), 등 리본 + 작은 캐리어 같이 못 고름(기존), **채팅방 4명 이상이면 손 소품 숨김**: `three/moleDress.ts handHiddenInChat(seated)` / `HAND_HIDE_FROM_SEATED = 4` 함수만 둠. 채팅방 3D 연결은 그때
- 테스트: 41 → 43(부위별 19·6·5·13), glb 루트 노드 이름·socket 이 아이템 id·부위와 같은지 대조, 관심사 연결 없음, 채팅방 4명 규칙, 아이콘 43개

## 확인 필요 (손대지 않음)
- 핸드오프 문서는 "한 사람당 최대 2개"라고 하지만 앱은 부위당 1개 · 최대 4개(`MAX_WORN`)로 이미 구현돼 있고 Figma 기준이라 그대로 둠. 기획 확인 필요
- 인사 중 손 소품 숨김은 앱에 `mole_greet`·`mole_drink`(커피)까지 숨기는 기존 규칙이 있음(핸드오프 문서는 인사만) — 그대로
- 학사모·응원봉은 온보딩 3D 미리 보기 · 땅굴 꾸미기에서 확인(캡처 `_shots/acc12/`, gitignore). 탐색 들판의 예전 코드 두더지(`mole.ts`)는 액세서리를 안 입음(원래 그랬음)
- 저장된 착용 값(`digul.myWorn`)에 예전 id 가 있어도 id 는 하나도 안 사라져서 호환
