# 우체통(Mailbox) 개발 전달 메모

**파일**: `models/mailbox.glb`(원본) / `models/mailbox_draco_webp.glb`(웹용, DRACOLoader 필요, 텍스처 없음)
**크기**: 높이 0.40m(두더지 0.985m의 약 41%), 폭 0.30m(깃발 포함, 깃발은 -X쪽), 깊이 0.26m / 삼각형 2,236 / 재질 3 / 노드 4
**노드**: `Mailbox`(빈 노드, 원점 = 바닥 중앙, 앞면 = three.js +Z) → 자식 `Mailbox_Body`, `Mailbox_Flag`(피벗 = 경첩), `Mailbox_Letter`
**클립**: `FlagUp` 1개 (0.4167초, 24fps 10프레임, 깃발 Y축 회전만)

## 상태
| | 깃발 | 편지 | 발광 세기 |
|---|---|---|---|
| 새 방명록 있음 | 올림 (`FlagUp` 재생 또는 마지막 프레임 자세) | `Mailbox_Letter.visible = true` | 1 (원하면 0.5↔1.5 천천히 반복) |
| 없음 (기본) | 내려감 (파일 기본 자세) | **로드 직후 `Mailbox_Letter.visible = false`** | 0 |

- 발광 대상: `mailbox_flag_mat`, `mailbox_letter_mat`. 발광 색 `#FFD27A`(emissiveFactor 선형값 1, 0.644, 0.195)가 파일에 들어 있음.
- 파일 기본 자세 = 깃발 내려감. `FlagUp`을 재생하면 올라가고 `clampWhenFinished`로 마지막 자세 유지. 내릴 때는 역재생.
- Mailbox_Letter는 scale 0 방식이 아니라 `visible`로 숨길 것(파일에서는 보이는 상태).

## 발광 0 확장 (KHR_materials_emissive_strength)
- Blender glTF 내보내기는 발광 세기 0이면 emissive 값을 **통째로 버림** → 내보낸 뒤 `scripts/patch_glb_emissive.py`로 두 재질에 `emissiveFactor`와 `KHR_materials_emissive_strength: {emissiveStrength: 0}`을 직접 넣음. 두 glb 모두 적용, 다시 불러와서 확인함.
- three.js GLTFLoader는 이 확장을 읽어 `emissiveIntensity = 0`으로 만들지만, **안전하게 로드 직후 `emissiveIntensity = 0`을 직접 설정**할 것.

## 클릭 / 연출 (개발 처리)
- 클릭: `Mailbox` 전체를 클릭 영역으로 → 방명록 전체보기. 두더지는 움직이지 않음. 뚜껑 동작 없음.
- 마우스 올리면 손가락 커서 + 외곽선 강조. 블룸은 우체통에만(선택적 블룸).

## 배치 (침대 발치 오른쪽, 펫 슬롯 사이)
- `docs/slots.json`에 **`mailbox_slot`**(고정 슬롯, 관심사와 상관없이 항상 있음, `always_present: true`)을 추가함.
- 위치: **Blender (-1.8, -1.2, 0) = three.js (-1.8, 0, 1.2)**, **rz 20° (= ry_deg 20)**: 앞면(투입구)이 방 카메라 쪽(약 19°)으로 거의 정면.
- 확인(11/14): 벽 여유 1.09m(기준 0.22m 이상), 방 카메라 프레임 안(아래쪽 여유 6%), 침대 발끝(y=-1.17)·빈백·고양이·도마뱀 슬롯과 겹치지 않음(최소 간격 0.05m), 돔·앞 가구에 안 가려짐. 높이 0.4m → "카메라 가까운 양옆은 0.5m 이하" 규칙 OK.
- 낙하·pop 연출 없음(`drop.mode: none`): 처음부터 서 있음.
- 깃발은 몸통 왼쪽(-X). 방 카메라에서 보면 우체통 앞면이 거의 정면이라 깃발이 왼쪽 옆으로 잘 보임.
- 몸통 색: 포인트 주황 `#E8743B`(방 팔레트). 깃발 `#F5C452`, 편지 `#F7E6C8`, 발광 색 `#FFD27A`.
- 미리보기 PNG는 우체통을 돌리지 않고 기존 썸네일에 가깝게 앞-왼쪽 28° 시점에서 찍은 것(방 배치 회전과 별개).
