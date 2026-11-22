# 두더지 mole_v1_4 전달 (2026-11-22)

앱(땅굴 방·지상·탐색)과 채팅방이 **두더지 glb 하나**를 같이 쓰기 위한 통합본. v1.3 + 채팅용 `mole_sit_talk`.

## 파일

| 경로 | 내용 |
|---|---|
| `models/mole_v1_4_draco_webp.glb` (0.68MB) | **웹에서 쓰는 파일** (Draco + WebP, `DRACOLoader` 필요) |
| `models/mole_v1_4.glb` (6.7MB) | 압축 없는 같은 내용 (비교·디버깅용) |
| `docs/animation_list_v1_4.md` | 동작 26개 목록 |
| `images/` | 확인 렌더 (아래 "확인") |

## v1.3에서 바뀐 점

1. **동작 26개 = v1.3의 25개 + `mole_sit_talk`** (2.5초, 상체만: upper_body·arm_L/R·눈 크기). 채팅용 `mole_v1_2_chat`에 있던 것을 그대로 옮김 (값 오차 1e-7 이하). 옮기면서 눈 위치·회전 트랙은 빼고 크기(깜빡임)만 남김
2. **`mole_drink`에서 하체 정지 트랙 제거**: v1.3 glb의 drink에는 root·lower_body·foot_L/R의 "기본 자세 그대로, 2키짜리" 트랙이 들어 있었음 (내보내기 도구가 모든 뼈 트랙을 넣음). 앉아 있을 때 drink·sit_talk를 겹치면 `AnimationMixer`가 평균을 내서 앉은 하체가 서는 쪽으로 끌려가므로 뺐음. `mole_sit_talk`도 같은 규칙. 나머지 24개 동작은 이름·채널·모든 키 값이 v1.3과 같음 (비교 차이 0)
3. 노드·메시·재질·셰이프 키·소켓은 v1.3과 같음

## 채팅방도 `mole.glb` 하나로 쓸 수 있음

- 채팅방은 `mole_v1_2_chat(_draco).glb` 대신 `mole_v1_4_draco_webp.glb`로 바꾸면 됨. 클립 이름은 그대로 (`mole_sit_idle` / `mole_drink` / `mole_sit_talk`)
- `THREEJS_chat_room_v3.md` 8번의 "상체만 덮어쓰기" 코드(`UPPER` 정규식으로 idle을 하체/상체 클립으로 나눠 상체만 크로스페이드)를 그대로 쓰면 됨. drink·sit_talk가 상체 트랙만 갖고 있어서 안전
- **채팅용 `mole_v1_2_chat`에서 눈이 안 보였던 이유**: 그 glb에는 모든 동작에 눈의 위치·회전 트랙이 들어 있었고, 값이 기본 자리보다 0.37m 뒤(머리 속)였음 (눈 월드 위치 y=+0.075 vs 정상 −0.292). v1.4는 눈 위치·회전 트랙이 없고 크기(깜빡임)만 있어서 기본 자리에 그대로 있음. 확인: `images/glb_eye_check_*.png`
- 채팅용 모델은 이제 안 씀. 몸 메시는 v1.3과 같음 (채팅용보다 가볍고 점 개수 6405개, 채팅용 7445개)

## 주의

- **높이 +0.03m**: `mole` 노드에 translation y=+0.03이 들어 있음 (v1.3과 같음, 채팅용 `mole_v1_2_chat`에는 없었음). 앉은 첫 프레임에서 잰 몸 최저점 0.0118 → 0.0418, 발 0.023 → 0.0495 (노드 0.03 + 발 위치 보정 약 0.0035 차이). `mole` 노드 위치를 sit point 좌표로 **덮어쓰면**(`position.set`) 채팅용과 같은 높이, 노드에 **더하면** 3cm 올라감. 채팅 쪽에서 방석 높이를 이미 맞춰 놨다면 덮어쓰는 쪽으로 확인
- **시작 시간**: 모든 동작이 0.0417초(1프레임)에서 시작 (채팅용 glb는 0초). `clip.duration`이 표의 길이보다 0.0417초 긺. 같은 clip을 같이 쓰면 하체·상체 클립 길이는 서로 같아 크로스페이드는 그대로 맞음. 반복 이음매에서 첫 자세가 1프레임 더 머무는 게 신경 쓰이면 트랙 시간을 0.0417초 앞으로 당겨 쓸 것
- 파일 이름이 바뀌었으니 `mole.glb` 로더 경로·캐시(`useGLTF.preload` 등)도 같이 확인

## 확인

- `images/mole_v1_4_sit_talk_sheet.png`: `mole_sit_idle` 위에 `mole_sit_talk` 겹침. 위 줄 전신, 아래 줄 얼굴 (프레임 1·14·21·23·31·45). 23번 = 깜빡임
- `images/mole_v1_4_sit_drink_sheet.png`: `mole_sit_idle` 위에 `mole_drink` (프레임 1·15·30·45·58·70, 컵 나타남·사라짐)
- `images/glb_eye_check_chat_v1_2.png` / `glb_eye_check_v1_4.png`: glb를 다시 불러와 같은 카메라로 찍은 얼굴 (왼쪽 채팅용은 눈이 안 보임, 오른쪽 v1.4는 보임)
- 위 렌더는 블렌더(Eevee) 결과. three.js 재생 확인은 아님
