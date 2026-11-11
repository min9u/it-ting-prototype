# 디굴디굴 3D 전달 v1.1 (2026-11-11) — v1에서 바뀐 점

zip `digul_3d_handoff_v1_1_20261111.zip` 기준 경로. v1 문서(`HANDOFF_v1.md`)의 내용(애니메이션 이름, 단위·방향, 굴 규칙 등)은 그대로 유효하고, 아래만 바뀜.

## 바뀐 점

1. **온보딩 액세서리 추가** — `models/accessories_v1.glb` (새 파일, 1.4MB)
   - 41개, 부위 4개(head 18 / face 6 / neck 5 / hand 12). 오브젝트 이름 = 액세서리 ID
   - 붙이는 법·착용 규칙·전체 목록·관심사 연결: `docs/accessories.md`
   - 등 리본(`ribbon_back`)만 뼈 3개 + 흔들림 애니메이션 `ribbon_back_sway` 포함 (`SkeletonUtils.clone`으로 복제)
   - 2MB 미만이라 압축본 없음 (텍스처 없음, 색만 사용)
2. **두더지에 소켓 추가** — `models/mole_v1_1.glb`, `models/mole_v1_1_draco_webp.glb`
   - 빈 노드 5개: `socket_head`, `socket_face`, `socket_neck`, `socket_hand_R`, `socket_mouth`
   - `socket_mouth`는 들어 있지만 지금 쓰는 액세서리 없음 (콧수염은 이번에 제외)
3. **`mole_showcase` 추가** — 온보딩 미리보기용 3초 반복 대기 동작. 애니메이션 19개 → **20개**
   - 미리보기: `mole_showcase` 반복 + 초당 60° 회전(한 바퀴 6초). `docs/accessories.md` 7번
4. **두더지 색 선택 기능 없음** — 두더지는 기본 갈색 하나로 고정
5. 그 밖에는 v1과 같음: 두더지 모양·털 텍스처·기존 19개 동작의 이름과 길이 변경 없음

## 파일

| 경로 | 내용 | 크기 |
|---|---|---|
| `models/mole_v1_1_draco_webp.glb` | 두더지 (**웹에서 이 파일 사용 권장**, Draco + WebP. 읽는 법은 v1과 같음) | 0.66MB |
| `models/mole_v1_1.glb` | 위와 같음, 압축 없는 원본 | 6.8MB |
| `models/accessories_v1.glb` | 액세서리 41개 | 1.4MB |
| `docs/HANDOFF_v1_1.md` | 이 문서 | |
| `docs/accessories.md` | 액세서리 소켓·착용 규칙·목록·관심사·미리보기 | |
| `docs/animation_list.md` | 애니메이션 목록 최신 (`mole_showcase` 포함) | |
| `images/` | 액세서리 시트(41개), 조합 예시, 관심사, 마법소녀 세트, 왕관 | |
| `icons/` | 액세서리 아이콘 41개 (512px, 투명, 파일 이름 = 액세서리 ID) | |
| `videos/turntable_beret.mp4` | 온보딩 미리보기 회전 참고 (베레모·목도리는 초기 모양) | |

- `ground_props_v1.glb`, 지상·방 영상 등 v1에서 받은 파일은 바뀌지 않아 이번 zip에 다시 넣지 않음
- 문서 안의 `exports/mole.glb` = `models/mole_v1_1.glb`. `renders/…` 경로는 원작업 폴더 기준이라 무시해도 됨

## 확인한 것 (glb를 다시 불러와 확인)

- `mole_v1_1*.glb`: 애니메이션 20개, 소켓 5개, 뼈대 1개. 원본과 압축본 내용 같음 (압축본 텍스처만 WebP)
- `accessories_v1.glb`: 루트 노드 41개 = `docs/accessories.md` 목록 41개와 이름 일치, 콧수염(`mustache_*`) 없음, 애니메이션 1개(`ribbon_back_sway`), 뼈대 1개(리본)
- 소켓에 붙이기만 해서 기본 자세·뒤·엉덩이 씰룩·걷기에서 제자리에 붙는 것 확인
