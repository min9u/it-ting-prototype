# 두더지 애니메이션 목록 (mole_master)

- 원본: `mole_master.blend` (두더지 모델·애니메이션은 이 파일에서만 수정)
- 내보낸 파일: `exports/mole.glb` (동작 20개 = 확정 19개 + 온보딩 대기 동작 `mole_showcase`, **액세서리 소켓 5개**(v2: `socket_mouth` 추가, `socket_neck`을 lower_body로 이동 / v3: `socket_mouth`를 주둥이 아랫면으로 이동). 이전 파일 `exports/mole_old_v9.glb`(v2 소켓), `mole_old_v8.glb`(소켓 4개), `mole_old_v7.glb`(동작 19개, 소켓 없음, 1차 전달본 `mole_v1.glb`와 같음), `mole_old_v6.glb`)
- 액세서리: **최종 확정 (11/11)** — 개발 전달본 `models/accessories_v1.glb` (원작업 `exports/accessories_v3_final.glb`, 41개, 콧수염 3종 제외, 등 리본 흔들림 애니메이션 `ribbon_back_sway` 포함). 소켓·착용 규칙·목록은 `docs/accessories.md`
- 개발 전달 v1.1 (11/11): `mole_v1_1.glb` = `exports/mole.glb` (동작 20개 = 1차 19개 + `mole_showcase`, 소켓 5개), 웹용 `mole_v1_1_draco_webp.glb`. `socket_mouth`는 들어 있지만 콧수염 제외로 지금은 안 씀
- 지상 소품: `exports/ground_props.glb` (굴 입구·표지판·풀·꽃·돌, 오브젝트별 분리. 사용법은 `renders/ground_anim/ground_move_spec.md` 7번)
- 확인 영상: `renders/mole_master/all_animations.mp4` (11/10 현재 모델로 다시 만듦, 50.8초. 동작 19개를 방 → 지상 순서로 한 번씩, 반복 동작은 2번. 방 동작은 방에서, 지상 동작은 굴 입구 앞에서. 이전 영상은 `all_animations_old.mp4`)
- 24fps. glb 안의 모든 애니메이션은 **0초에서 시작**하고, 길이는 아래 표와 같음
- 뼈대 `mole_rig`: root → lower_body → upper_body → arm_L / arm_R, root → foot_L / foot_R (변형 뼈는 lower_body, upper_body)
- 셰이프 키(morph): `butt_squish_L`, `butt_squish_R`, `butt_bounce` (기본값 0)

## 전체 목록

| 이름 | 프레임 | 길이 | 반복 | 쓰이는 화면 | 기준 위치 (mole 오브젝트를 둘 곳) | 움직이는 부분 |
|---|---|---|---|---|---|---|
| `mole_room_drop` | 47 | 1.958s | X | 방 (처음 들어올 때) | 방 중앙의 두더지 자리. 천장 구멍(약 (1.82, 0.75, 3.53))에서 떨어져 이 자리에 착지 | 전신 + 컵 숨김 |
| `mole_idle` | 48 | 2.000s | O | 방 (서 있기) | 서 있는 자리 | 전신 |
| `mole_walk` | 24 | 1.000s | O | 방 (이동) | 제자리 걷기. 이동은 코드에서 0.32 m/s | 전신 |
| `mole_drink` | 71 | 2.958s | X | 방 (커피 마시기) | 서 있거나 앉은 자리 그대로 | **상체만** (upper_body, arm_L/R, 눈, 컵) |
| `mole_sit_cushion` | 27 | 1.125s | X | 방 (방석에 앉기) | `sit_point_cushion_01` | 전신 |
| `mole_sit_idle` | 60 | 2.500s | O | 방 (방석에 앉아 있기) | `sit_point_cushion_01` | 전신 |
| `mole_stand_up_cushion` | 18 | 0.750s | X | 방 (방석에서 일어나기) | `sit_point_cushion_01` | 전신 |
| `mole_sit_chair` | 30 | 1.250s | X | 방 (빈백·의자에 앉기) | `sit_point_chair_01` | 전신 |
| `mole_sit_idle_chair` | 60 | 2.500s | O | 방 (빈백·의자에 앉아 있기) | `sit_point_chair_01` | 전신 |
| `mole_stand_up_chair` | 18 | 0.750s | X | 방 (빈백·의자에서 일어나기) | `sit_point_chair_01` | 전신 |
| `mole_burrow_exit` | 39 | 1.625s | X | 지상 (굴에서 나오기) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_burrow_enter` | 55 | 2.292s | X | 지상 (굴로 들어가기: 카메라 등지고 앞으로만 숙여 다이브, 씰룩 3번 + 발 파닥 → 쏙. 11/10 확정) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_butt_wiggle` | 36 | 1.500s | O | 지상 (굴 입구에 엉덩이 내밀고 씰룩) | 굴 중심 바닥 (`mole_anchor`) | 전신 + 셰이프 키 |
| `mole_ground_scratch` | 46 | 1.917s | X | 지상 (땅굴 입구가 아닌 잔디 클릭 시 1회) | 클릭한 잔디 위치. 시작·끝 포즈 = `mole_idle` 첫 프레임 (idle → scratch → idle 그대로 이어짐) | 전신 + 눈(깜빡임) + 셰이프 키 |
| `mole_look_around` | 72 | 3.000s | O | 지상 (가만히 있을 때) | 서 있는 자리. 첫 프레임 = `mole_idle` 첫 프레임 | 전신 + 눈(깜빡임) + 셰이프 키 |
| `mole_turn` | 12 | 0.500s | X | 지상 (방향 전환) | 제자리. 뼈대는 회전하지 않음, 회전은 코드에서 90° 기준 (`renders/ground_anim/ground_move_spec.md`) | 전신 |
| `mole_greet` | 36 | 1.500s | X | 지상 (다른 두더지와 인사) | 서 있는 자리. 시작·끝 = `mole_idle` 첫 프레임 | 전신 + 눈 + 셰이프 키 |
| `mole_sit_beanbag` | 30 | 1.250s | X | 방 (빈백에 앉기) | `sit_point_chair_01` (높이 0.24m) | 전신 |
| `mole_stand_up_beanbag` | 18 | 0.750s | X | 방 (빈백에서 일어나기) | `sit_point_chair_01` | 전신 |
| `mole_showcase` | 72 | 3.000s | O | 온보딩 오른쪽 미리보기 (기분 좋게 통통 → 고개 갸웃 + 깜빡 → 엉덩이 씰룩 → 통통). 11/10 추가 | 미리보기 가운데 제자리 | 전신 + 눈(깜빡임) + 셰이프 키 |

- 앉기 동작의 sit point 위치와 걷기 도착 지점은 `renders/room_anim/sit_points.md` 참고
- 앉아서 마실 때는 `mole_sit_idle`(또는 `_chair`) 위에 `mole_drink`를 겹쳐 재생 (drink에는 하체 채널이 없음)

## 지상 애니메이션 (뼈대 기준으로 새로 만듦)

- 예전(`ground_v1.blend`, `mole_burrow_anim.glb`)에는 `mole` 오브젝트 자체를 움직였지만, 이제는 **root 뼈**가 같은 움직임을 함. `mole` 오브젝트는 굴 중심(`mole_anchor`)에 회전 0으로 고정해 두면 됨
- 위치·회전·크기, 발 회전, 엉덩이 셰이프 키는 원래 값과 **모든 프레임에서 똑같음** (발 행렬 오차 0, 셰이프 키 오차 0으로 확인)
- 더한 것: 허리 휨. upper_body가 몸 회전을 2프레임 늦게 35%만 따라가서, 몸을 돌리거나 뛰어들 때 허리가 살짝 휨 (최대 8°, 코 위치 기준 최대 5cm 차이)
- 굴 기준 좌표 (Blender Z-up / three.js Y-up):
  - `mole_burrow_enter` 시작: (0, -1.75, 0.033) / (0, 0.033, 1.75), 굴 쪽(+Y)을 바라봄. 끝나면 구멍 아래(바닥에서 약 0.6m 밑)로 쏙 들어가 안 보임
  - `mole_burrow_exit` 시작: 굴 속 (0, -0.05, -1.44)에서 튀어나와 (0, -1.75, 0.033)에 착지, 카메라 쪽(-Y)을 바라봄
  - `mole_butt_wiggle`: 굴 입구에 머리를 박고 엉덩이만 내민 자세에서 씰룩 (반복, 첫 프레임 = 마지막 프레임)
- `cam_burrow_enter` 카메라 연출은 그대로 사용 가능 (`renders/burrow_anim/cam_burrow_enter.md`, 같은 굴 기준)
- 흙 튀김 `dirt_burst`는 지면 효과라 이 파일·glb에는 넣지 않음 (`ground_v1.blend`, `mole_burrow_anim.glb`에 있음)

## 이전 파일과 달라진 점

| 항목 | 내용 |
|---|---|
| 볼터치 | **blush_b로 확정**. 눈 아래·코 양옆, 코랄레드 #E87A6E, 가운데만 붉고 바깥으로 털 색에 스며드는 가우시안 번짐(최대 58%). 텍스처 `T_mole_body_BaseColor_fur_blush_b.png`(2048px) |
| 털 결 | 정수리에서 아래·뒤로 흐르는 촘촘한 털 결: 노멀맵 `T_mole_body_Normal_fur.png`(2048px) + Base Color에 ±8% 밝고 어두운 결. Sheen 강화(glTF에서도 같게 보이도록 강도를 색에 곱해 둠: 색 (0.143, 0.098, 0.081), 거칠기 0.45). 실루엣 털 뭉치는 더듬이처럼 튀어 보여 전부 삭제(몸 메시는 원래 그대로). 텍스처를 다시 구울 때는 재질 `M_mole_body_fur_bake_src` 사용 |
| 엉덩이 (butt v6, 현재 적용) | v5 기준. 뒤에서 본 실루엣을 둥근 달걀형으로(위 좁고 아래 넓게, 높이 0.14~0.44m의 곧은 옆선과 0.5m 꺾임 제거), 어깨·옆구리의 평평한 면을 부풀려 곡선으로, 아래 테두리는 바닥 쪽으로 둥글게 말림. 힙업 위치(높이 0.34m)·골 없는 형태·전체 볼륨(v5 대비 +0.4%) 유지, 얼굴 영역 변화 2mm 이하. 셰이프 키는 v5와 같은 방식·크기(최대 6.6cm). 텍스처는 v5 그대로. 보관 메시: `mole_body_butt_v2`, `_v3_a`, `_v3_b`, `_v5`, `_v6` |
| 원본 구조·웨이트 (v6 확정) | 컬렉션 이름 `MOLE`(두더지·리그·컵 22개 오브젝트). 메시 토폴로지는 v2~v6 모두 정점 5,186개로 같아 웨이트 이전 불필요, 드라이버 없음. upper_body 웨이트를 높이 0.15~0.79m의 부드러운 곡선(smoothstep)으로 다시 만들어(이전엔 0.45~0.55m 10cm 구간에서 급하게 바뀜) 허리 굽힘이 한 띠에 몰리지 않게 함. 13개 액션 전 프레임 점검: 자기 교차 0건, 피부 접힘 최소 면적비 0.66(이전 0.62) |
| `mole_drink` (v3) | 마실 때 고개가 뒤로 젖혀지는 프레임에 컵도 같이 입 쪽으로 기울어짐(최대 고개 -14°, 컵 35°). 삼킬 때 컵을 세워 입에서 2.5cm 내리고 고개 4° 꿀꺽 끄덕. 내릴 때 고개도 제자리로. 홀짝 2번 같은 규칙. 길이(71프레임)와 컵 등장·퇴장, 마신 뒤 "아~" 구간(45프레임 이후)은 그대로. 컵·몸·코·팔 겹침 0건(서서, 방석·빈백에 앉아서 모두) |
| 털 색 | 확정한 C(#5A4842 계열)는 그대로. 예전에는 텍스처 × fur_tint 곱하기 노드였는데, 이제 그 결과를 텍스처에 구워 넣어 glb에서도 같은 색이 나옴 |
| 지상 애니메이션 | `mole` 오브젝트 → root 뼈로 옮김 (위 설명) |
| `mole_room_drop` | 천장 흙 부스러기(ceiling_dirt_01~05)는 방 소품이라 빠짐 (`mole_room_anim.glb`에는 남아 있음) |
| 시간 | 모든 애니메이션이 0초부터 시작 (예전 glb는 1프레임(0.042초) 늦게 시작해서 반복 재생 때 첫 프레임이 한 번 더 보였음) |
| 기본 상태 | 컵 `coffee_cup`은 크기 0.0001(안 보임)이고, drink 재생 때만 나타남 |

## mole_ground_scratch (땅 긁기 헛발질)

- 원본 액션: `mole_master.blend` (MOLE 리그·눈·셰이프 키·컵에 NLA 트랙 `mole_ground_scratch`, 뮤트 상태로 보관)
- 작업·미리보기 파일: `mole_ground_scratch.blend` (MOLE 컬렉션을 Link + Library Override로 불러옴, 지상 장면·카메라·조명·렌더 세팅은 `ground_v1.blend`와 동일)
- 영상: `renders/mole_master/mole_ground_scratch.mp4`
- 구간 (24fps): 1–6 준비(몸 숙이고 앞발 들기) → 6–31 긁기 4번(왼 9 · 오 15 · 왼 21 · 오 27프레임에 앞발이 가장 낮음, 4번째가 가장 세게) → 31–41 멈추고 고개 들어 갸웃 + 깜빡 → 41–47 idle 자세로 복귀
- 긁을 때마다 몸이 1.4~1.9cm 들썩이고 엉덩이가 ±4.5~6° 흔들림 (wiggle보다 작게)
- 흙 효과: 컬렉션 `FX_scratch` (두더지와 분리). 루트 `fx_scratch_root`(두더지 위치·방향과 같음) 아래 왼쪽/오른쪽 세트 각 12개: 흙덩이 7, 잔디 조각 2, 먼지 퍼프 3. 각 세트는 같은 쪽 긁기 2번에 재사용. Action `fx_ground_scratch`
  - 앞발이 가장 낮은 프레임에 앞발 아래 바닥에서 생겨, 옆·뒤로 포물선을 그리며 튀었다가 바닥에 닿으면 납작해지며 사라짐 (약 0.35~0.5초). 먼지 퍼프는 0.42초 동안 퍼지며 투명해짐(투명도는 오브젝트 색 알파 → 웹에서는 opacity로)
  - 바닥에 구멍이나 자국은 남기지 않음
- 확인: 끝 포즈와 idle 차이 0.0000035, 자기 교차 0건, 피부 최소 면적비 0.75(갸웃 프레임), 흙·먼지가 몸을 뚫는 프레임 0건


## 앉기 발 붙임 수정 (11/10, 확정)
- 앉기·앉아 있기·일어나기 6개 동작(방석/의자)에서 발이 몸에서 떨어지던 문제 수정: 매 프레임 발이 몸 안으로 3.5cm 이상 묻히도록 발 뼈 위치를 보정 (서 있기 idle은 4.5cm)
- 의자: 최대 6.3cm 떠 있던 것 → 3.4cm 묻힘 / 방석: 1.9cm 떠 있던 것 → 3.6cm 묻힘. 동작끼리 이어지는 프레임의 발 위치는 같음
- 비교: `mole_sit_feet_fix_compare.mp4`, `sit_feet_fix_before_after.png`. 수정 전 파일은 `mole_master_backup_v2.blend`
- `exports/mole.glb`에 반영 (11/10 14:48, 이전 파일 `exports/mole_old_v3.glb`)
- 방 미리보기 영상: `renders/room_anim/mole_sit_sequence_v2.mp4` (`room_sit_sequence.blend`, 두더지는 mole_master에서 Link + Override)

## 빈백 전용 앉기 (11/10)
- 빈백에 앉으면 20cm 떠 보이던 문제: 빈백 앉는 면이 실제로 0.26m인데 0.45m 의자 동작을 쓰고 있었음
- `mole_sit_beanbag`(31f), `mole_stand_up_beanbag`(19f) 추가: 의자 동작과 같고 점프 높이만 0.45m → 0.24m로 맞춤. 앉아 있기는 `mole_sit_idle_chair` 그대로
- sit point `sit_point_chair_01` 높이 0.45 → 0.24 (`sit_points.md`)
- glb 동작 16개로 늘어남 (`exports/mole.glb`, 이전 파일 `exports/mole_old_v4.glb`)

## 지상 동작 추가 (11/10)
- `mole_look_around` (3초 반복): 고개(upper_body) 왼쪽 30° → 오른쪽 30° 두리번, 볼 때마다 킁킁 3번(고개 2.8° 들썩 + 살짝 통통), 끝에 코를 7° 들고 킁킁. 0.5초 동안 엉덩이 씰룩 왼-오-왼(허리 4°, 셰이프 키 0.22로 은근히). 숨쉬기(세로 ±1.2%), 눈 깜빡임 1번
- `mole_turn` (0.5초): 발을 왼-오-왼-오 4번 종종(3.5cm 들어올림), 걸음마다 살짝 통통, 허리 좌우 4°. 좌우 대칭이라 어느 방향으로 돌아도 사용 가능. 실제 회전은 코드에서 (90° 기준 0.5초 smoothstep)
- `mole_greet` (1.5초): 살짝 웅크렸다가 오른쪽 앞발을 얼굴 옆으로 번쩍 들고 3번 흔듦, 몸을 왼쪽으로 10° 갸웃 + 고개 살짝 들기, 들 때 통통 + 엉덩이 통, 끝에 눈 깜빡임
- 세 동작 모두 시작·끝 자세 = `mole_idle` 첫 프레임 → idle·walk와 바로 이어짐. 발-몸 겹침 3.4cm 이상 유지(떨어지는 프레임 없음)
- 지상 이동 규칙(걷기 속도·언덕·방향 전환·굴 이어붙이기): `renders/ground_anim/ground_move_spec.md`
- 미리보기: `renders/ground_anim/ground_walk_reference.mp4` (`ground_walk_reference.blend`: ground_v1 지면·굴 + 언덕, 두더지 2마리 모두 mole_master에서 Link + Override)

## mole_burrow_enter 다이브 수정 (11/10)
- 문제: 다이브 중(13~23프레임) 몸을 옆으로 반 바퀴(180°) 비틀며 들어가서, 옆에서 보면 구르듯 넘어지고 배·발바닥이 보임
- 수정: 비틀기를 없애고 **앞뒤로만 숙이게** 함. 숙이는 각도는 95°까지 원래대로, 그 뒤로는 줄여서 엉덩이를 내민 자세에서 약 121°, 빨려 들어갈 때 130°까지. 머리 쪽 위치는 원래 경로를 따라가게 root 위치를 보정해 구멍 위치는 같음
- 엉덩이 씰룩 3번(좌우 약 ±14°)과 셰이프 키는 그대로. 13~17프레임에 발을 몸 안으로 접어 넣음(뒤로 11cm, 위로 12cm)
- 들어가기 전에는 항상 카메라를 등지게 돌기: `renders/ground_anim/ground_move_spec.md` 5-1
- 수정 전 파일: `mole_master_backup_v5.blend`. 11/10 `exports/mole.glb`에 반영

## mole_burrow_enter 씰룩 구간 발 파닥임 (11/10)
- 문제: 씰룩 구간(26~43프레임)에 발이 몸 안에 접혀 있어 카메라에서 거의 안 보임
- 수정: 22~27프레임에 발을 꺼내 **엉덩이 위쪽 가장자리**(발뒤꿈치가 몸에 붙은 채)로 옮기고, 발끝을 하늘 쪽으로 세워 좌우 번갈아 차게 함(6프레임 주기, 각도 110°~170°). 빨려 들어갈 때(44~53)도 같이 차다가 구멍 속으로 사라짐. 뛰는 순간(13~21) 발 접기는 그대로
- 확인: 22~56프레임 동안 발·몸이 흙더미·지면에 겹치는 프레임 0개, 발은 흙더미 위 약 0.8m 높이. 확인 이미지 `renders/ground_anim/enter_feet_check.png`
- 수정 전 파일: `mole_master_backup_v6.blend`. 11/10 확정, `exports/mole.glb`에 반영 (이전 파일 `exports/mole_old_v6.glb`)
- 확인 영상: `renders/ground_anim/ground_walk_reference.mp4` (나오기 → 두리번 → 언덕 걷기 → 인사 → 돌기 → 들어가기 전체, 이전 영상은 `ground_walk_reference_old.mp4`)

## 액세서리 소켓 + mole_showcase (11/10, 온보딩)
- 소켓(빈 노드) 4개를 뼈에 붙임. 기본 자세에서 회전 없음, 액세서리는 소켓 자식으로 붙이기만 하면 맞음
  - `socket_head` (upper_body, 머리 꼭대기) / `socket_face` (upper_body, 눈 높이 얼굴 표면) / `socket_neck` (upper_body, 코 아래 목·몸통 경계 높이의 몸 중심) / `socket_hand_R` (arm_R, 오른 앞발 가운데)
- `mole_showcase`: 3초 반복 대기 동작. 통통 2번(0.1~1.1초) → 고개 갸웃 12° + 깜빡(1.1~1.9초) → 엉덩이 씰룩 2번(1.8~2.5초) → 작게 통통(2.5~3.0초). 마지막 프레임 = 첫 프레임
- 수정 전 파일: `mole_master_backup_v7.blend` (요청한 이름 `mole_master_backup_v5.blend`는 이미 다른 백업이 있어 덮어쓰지 않고 v7로 저장)
- 바꾼 것은 소켓 4개 추가와 `mole_showcase` 추가뿐. 모델·기존 19개 동작·털 텍스처는 그대로

### 액세서리 같은 부위 규칙
| 부위 | 액세서리 | 동시 착용 |
|---|---|---|
| head (모자 + 머리카락, **같은 부위**) | `hat_beret`, `hat_beanie`, `hat_straw`, `hat_party`, `hat_flower_pin`, `hair_tuft`, `hair_curl`, `hair_ponytail` | 하나만 |
| face | `glasses_round`, `glasses_sun`, `glasses_heart` | 하나만 |
| neck | `scarf_stripe`, `scarf_knit`, `bowtie` | 하나만 |
| hand | `prop_flower`, `prop_balloon` | 하나만 |
- 모자와 머리카락은 같은 부위: 모자 5 × 머리카락 3 = 15조합 모두 머리카락이 모자 밖으로 뚫고 나오거나 그대로 겹쳐 보임 (가려지는 조합 없음). 확인 이미지 `renders/accessories/check/hat_hair_check.png`
- 동작 20개 전 프레임 확인: 모자·머리카락·안경·나비넥타이·꽃은 뚫림·뜸 0. 목도리는 몸 뚫림 0이고, `mole_drink`·`mole_greet`·`mole_ground_scratch`에서 팔이 목도리 아랫단을 지나감(최대 약 4cm). 풍선은 웹에서 위로 세워 두면 0 (`docs/accessories.md` 5번)

## 액세서리 v2: 소켓 변경 + 착용 규칙 (11/10)
- `socket_mouth` 추가: upper_body, 코(주둥이) 아래 (0, -0.40, 0.575) (블렌더 좌표). 콧수염용
- `socket_neck` 이동: upper_body (0, -0.01, 0.50) → **lower_body (0, -0.01, 0.37)**. 목도리를 몸 아래쪽 1/3로 내리면서, 그 높이의 몸은 lower_body를 따라 움직여서 옮김. v1 목 부위 액세서리 glb는 새 mole.glb와 안 맞음
- 수정 전 파일: `mole_master_backup_v8.blend`. 모델·동작은 그대로

### 같은 부위 규칙 (v2)
| 부위 | 소켓 | 액세서리 |
|---|---|---|
| head (모자·머리카락 같은 부위) | `socket_head` | `hat_*` 8개, `hair_*` 7개(리본 포함), `headphones`, `headband_sport` |
| face | `socket_face` | `glasses_*` 5개, `bandage` |
| mouth | `socket_mouth` | `mustache_curl`, `mustache_round`, `mustache_thin` |
| neck | `socket_neck` | `scarf_stripe`, `scarf_knit`, `bowtie`, `camera_neck` |
| hand | `socket_hand_R` | `prop_*` 7개 |
- **한 사람당 최대 2개, 같은 부위는 하나만**
- 2개 조합 485개 확인: 서 있을 때 겹침 0. 콧수염 + 목 부위 8조합은 앉기·일어나기·착지 순간 닿음, 손 소품 + 머리·얼굴 48조합은 `mole_greet`에서만 닿음. 전체 목록은 `docs/accessories.md` 4번

## 액세서리 v3: socket_mouth 이동 (11/10)
- `socket_mouth`: (0, -0.40, 0.575) → **(0, -0.4035, 0.5778)**, 주둥이(`mole_nose`) 아랫면의 앞쪽 아래 곡면 가운데(코 끝 바로 밑). 뼈는 그대로 upper_body (주둥이도 upper_body에 고정돼 있어 같이 움직임)
- 콧수염 3종을 주둥이에 붙여 다시 만듦. 동작 20개에서 주둥이와 떨어짐 0, 커피잔 겹침 0
- 수정 전 파일: `mole_master_backup_v9.blend`. 모델·동작은 그대로
