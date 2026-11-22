# 디굴디굴 3D 전달 — 채팅 화면 3D 방 (2026-11-16)

채팅 화면 가운데 패널의 2D 배경을 3D 방으로 바꾸기 위한 전달물. 자세한 적용 방법은 **`docs/THREEJS_chat_room_v3.md`** 하나만 보면 됨.

## 먼저 할 일

1. 웹에서는 `models/*_draco_webp.glb`, `models/mole_v1_2_chat_draco.glb` 사용 (Draco + WebP, `DRACOLoader` 디코더 경로 설정 필요). 압축 없는 glb는 비교·디버깅용
2. 방 glb는 원점에 그대로 얹고, `room_base_v2`는 문서 2번대로 **노드만 옮기기·숨기기·복제** (원탁 정중앙, 협탁·원래 방석 숨김, 자리마다 방석 복제)
3. 두더지는 **`mole_v1_2_chat`** 사용 (v1.1의 20개 동작 + 새 동작 `mole_sit_talk` = 21개). 기존 `mole_v1_1`은 이 화면에서 안 씀
4. 인원수별 자리(1/2/3/4/6)와 카메라 프리셋(1~2 / 3~4 / 5~6), 0.6초 카메라 전환은 문서 3·5번
5. **6명 초과 모임**: 자리 최대 6개, "나" 고정 + 최근에 말한 5명, 넘치면 "+N" 배지 (문서 맨 위 섹션)

## 모션

- 기본: `mole_sit_idle` 반복
- **10초마다** `mole_drink` (상체만)
- 사이사이 `mole_sit_talk` (2.5초, 상체·팔·고개·눈, 새로 만든 동작). 실제 메시지를 보낼 때 재생하는 것도 권장
- 상체만 크로스페이드해야 함 (그냥 겹치면 평균이 돼서 동작이 약해짐). 코드는 문서 8번
- 확인용 영상: `videos/chat_room_3d_v3_motion.mp4` (0초 idle → 4.5초 talk → 10초 drink → 14.5초 talk → 20초 drink)

## 파일 목록

| 경로 | 내용 |
|---|---|
| `models/room_shell_v2(_draco_webp).glb` | 방 껍데기 (v2와 같음) |
| `models/room_base_v2(_draco_webp).glb` | 기본 가구 (v3와 같음). 원탁·찻주전자·찻잔·방석 포함 |
| `models/room_deco_v1(_draco_webp).glb` | 장식 (v3와 같음) |
| `models/room_shelves_v1(_draco_webp).glb` | 벽 선반 (v3와 같음) |
| `models/accessories_v1.glb` | 액세서리 (v1.1과 같음) |
| `models/mole_v1_2_chat(_draco).glb` | **새 두더지** (동작 21개, `mole_sit_talk` 추가) |
| `docs/THREEJS_chat_room_v3.md` | **적용 문서** (좌표 변환, 노드 변경, 자리표, 카메라, 빈자리 표시, 이름표, 모션 스케줄러, 6명 초과 규칙) |
| `docs/accessories_v1_1.md`, `docs/animation_list_v1_1.md` | 액세서리 소켓·동작 목록 (v1.1 문서 그대로) |
| `docs/credits_v3.md` | 외부 에셋 출처 (v3 문서 그대로) |
| `images/chat_room_3d_v3_*.png` | 1·2·4·6마리 렌더 (780×1420, 1마리는 2x도) |
| `videos/chat_room_3d_v3_motion.mp4` | 모션 확인 영상 (390×710) |
| `blender/chat_room_3d_v3.blend` | 작업 장면. 텍스트 블록 `layout_v3.py`의 `apply_layout_v3(n)`으로 배치·카메라 전환 |

- 천장 구멍(`room_ceiling_hole_v1`)과 두더지 착지 동작(`mole_room_drop`)은 이 화면에서 안 씀 (원탁이 방 중앙이라 착지점과 겹침)
- "나" 이름표, "+N" 배지, 빈자리 표시는 문서대로 웹에서 그림
