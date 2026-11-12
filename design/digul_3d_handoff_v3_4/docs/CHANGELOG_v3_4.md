# CHANGELOG v3.4 (2026-11-12) — 6묶음 반려동물

## 추가
- `models/interest_pet_v1.glb` (3.7MB), `interest_pet_v1_draco_webp.glb` (0.89MB): 동물 5 + 동물 용품 5, 직접 제작, 외부 에셋 없음

## 바뀜
- `slots.json`: `pet_slot_01~05`, `prop_slot_15~19` 10칸의 `pos_blender`/`pos_three`/`rz_deg`/`ry_deg`, `drop` = `pop`, `occupant`, `pair_slot`, 동물 칸에 `pet_offset_from_prop`, 옛 값은 `moved_from_v3_3`
- `furniture_catalog.json`: 10줄 `status` todo → built, `glb`/`glb_compressed`, `size_m`, `pos_blender`/`rz_deg`, 동물 줄 `pet_offset_from_prop`·`pose`. **`todo` 줄 0개** (`unused` 4개 제외)
- `interest_catalog.json`: `pet` 카테고리에 `pet_slots`, `prop_slots`, `glb`
- `furniture_drop_spec.md`: 반려동물 슬롯 10줄 fall → pop, 모드 규칙 표
- `credits.md`, `credits_app.md`: 6묶음 직접 제작 한 줄 (CC-BY 변동 없음)

## 그대로
- 두더지·방·다른 관심사 glb, 동작·sit point (이번 zip에 없는 파일은 이전 그대로)

## 수정 (고양이 얼굴)
- `pet_cat`: 눈 위 연노랑 타원 2개(`cat_stripe_*`) 제거, 이마 가운데에 몸통과 같은 주황 가는 줄무늬 3개(`cat_fstripe_0~2`) 추가. id·node 이름·크기·슬롯 변경 없음. glb 2개만 교체.
