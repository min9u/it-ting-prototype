# CHANGELOG v3.8 (2026-11-18)

## v3.7 (중간 작업, 따로 전달하지 않음)
- 새 관심사 태그(대분류 12 · 소분류 90) 기준으로 소품 정리: 우주·과학 대분류 삭제, 자연·식물 → 반려동물·식물로 합침
- 새 대분류 가구 6개(덤벨 타워, 짐볼, 화이트보드, 좌식 책상, 포스터 액자, 아크릴 진열장), 소품 43개, 햄스터와 햄스터 집 제작

## v3.8
- **구조 변경**: 대분류 가구 자동 배치 없앰. 소분류를 `/`로 나눈 단어마다 모델 1개 (164개, "그 밖의 것" 뜻의 `기타` 2개 제외)
- 새 모델 56개(토끼와 토끼집 포함) 제작, 옛 모델 7개 되살림(에스프레소 머신, 홍차 틴, 타자기, 자수 수틀, 재봉 상자, 개미와 개미집), 캔들 세트에서 디퓨저 분리
- 최대 선택 10개 그대로
- 대분류 전용 슬롯 → **공용 자리** (바닥 20, 벽 4). 슬롯 22·23(앞 구석), 24(오른쪽 벽 포스터) 추가
- 기본 가구 `room_base_v3`: 침대·협탁 뺌, 원탁을 카펫 중앙(0,0)으로, 방석을 원탁 양옆으로. 두더지 기본 자리 (0,0) → (0,−0.85)
- 슬롯 01 회전 −37.5° → −40.5° (피아노가 돔 갈빗대에 묻히던 문제)
- 바닥 공용 자리 낙하 값을 모델 키 단계별로 다시 계산 (`drop_by_height`)
- 관심사 glb를 대분류별 `interest_<id>_v3_8.glb` 12개로 다시 묶음 (`_draco_webp` 포함)
- 쓰지 않게 된 기존 모델 13개: cutting_board, popcorn, arcade_stick, bean_bag, piano_stool, cafe_stool, reading_lamp, drawing_stool, terrarium_bench, photo_board, camera_case, whiteboard, study_desk
- 삭제한 모델: 우주·과학 10개(지구본 제외), magic_hat, model_train, skateboard, watering_can, bonsai_pot, small_pot, mushroom_log, pc_case, spice_rack
