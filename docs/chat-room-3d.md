# 채팅방 3D v1 (2026-11-22)

- 요청: 핸드오프 `design/digul_3d_handoff_chat_v1/` 를 앱의 찻방(채팅 가운데 칸)에 적용. 방은 room_base_v3_1 기준, 두더지는 mole_v1_2_chat, 액세서리는 v1.2, 4명 이상이면 손 소품 숨김
- 브랜치: `feat/chat-room-3d` (feat/accessories-v1-2 위, push 만, PR 없음)
- 캡처: `_shots/chat3d/` (gitignore) — 1:1, 3명(손 소품 보임), 4명(손 소품 숨김), 9명(+N), 땅굴·채팅방 두더지 나란히

## 결론
- 찻방 가운데 칸이 3D 로 바뀜. 준비 전·WebGL 없음·3D 오류 때는 예전 2D 찻방 그림을 그대로 보여 줌(`SceneBoundary` 안)
- 방: 땅굴 방 껍데기(`room_shell_v3`) + 기본 가구(`room_base_v3_1`) + 장식 + 벽 선반을 재사용. **원탁만** (1.7, 0.9, 1.7) 로 키우고 낮춤(핸드오프 2번 표, 찻주전자·찻잔은 크기 상쇄). 수납장·스탠드·큰 화분·러그 둘·원래 방석 둘은 숨기고, 방석은 원래 방석 노드를 **자리마다 복제**(노랑·하늘)
- 벽은 땅굴 방 **01 기본 벽지**(단색 #F0B47A × 구운 음영, `roomScene.applyWallpaper` 를 export 해서 재사용). 껍데기 원본 재질 그대로면 벽이 허옇게 나와 핸드오프 사진과 달랐음. 조명은 땅굴 방과 같은 값(올려 보니 벽이 날아가서 되돌림), AgX, 배경 #E9B597
- 두더지: `assets/models/mole_chat.glb`(동작 21개) + accessories v1.2. 앉은 사람이 4명 이상이면 `handHiddenInChat` 로 손 소품 숨김
- 자리·카메라·규칙은 순수 계산 `three/chatRoomLayout.ts`(테스트 12개): 1/2/3/4/6명 자리표(5명은 6명 자리에서 한 칸 비움), 카메라 프리셋 close/medium/wide + 0.6초 전환, 가로세로비 보정, 6명 초과 시 "나" + 최근 말한 5명(교체는 쏙/퐁, 한 자리 최소 5초), 이름표·빈자리 표시(1명일 때 점선 원)
- 모션: 하체 sit_idle 반복 + 상체만 덮어쓰기(drink 10초마다, 사이에 sit_talk 한 번, 메시지 보내거나 받으면 sit_talk). 마리마다 위상이 달라 같이 안 움직임
- 이름표·누르기: 장면 위 HTML 이름표를 매 프레임 투영해서 옮김. 두더지·이름표를 누르면 프로필 팝업(나·탈퇴한 사용자 제외). 자리를 못 받은 인원은 오른쪽 위 "+N" 배지(누르면 모임 정보)

## 코드 위치
- 장면 `app/src/three/chatRoomScene.ts`, React `ChatRoomCanvas.tsx`, 화면 `screens/chat/TeaRoom.tsx`(+`.module.css`), `Chat.tsx` 는 `spoke`(작성자별 마지막 말한 시각)·`roomKey`·`onMore` 만 넘김
- 공용화: `contactShadow.markShadows`, `MoleDress.setHandsHidden`
- `data/chat.ts` 는 안 건드림(fix/f6-f10-small 과 겹침 없음). #3 파일도 안 건드림
- 시험 손잡이: `?mockguests=N`(참여자를 N명까지 가짜로 채움), `?chatamb · ?chatbulb · ?chatfill`(조명, 정수만)

## 확인할 것 · 남은 것
- 가속 꺼진 PC 측정은 안 함(저사양은 `idleFps` 로만 제한). 첫 진입 멈춤은 `warmScene` 연결 전
- 6명 초과 교체 연출(쏙/퐁)은 화면 캡처로 확인 못 함(움직임) → 실제 브라우저에서 메시지를 보내며 확인 필요
- 목 데이터에는 6명이 넘는 모임이 없어 `?mockguests` 로만 확인
