# Figma 땅굴 렌더를 three.js로 재현하기 (시험판)

- 날짜: 2026-11-10
- 요청: Figma "03. Screens"의 3D 그림처럼 똑같이 구현할 수 있는지 탐색하고 결과물 보여주기
- 시험판: `explore/3d/room.html` (비교 기준 이미지 `explore/3d/ref.png` = `design/figma/room-cutout.png`)
- 게시: https://claude.ai/artifact/JehojQcDbUwxys5R6mQo3n (비공개로 시작)

## 만든 방법
[3D 기술 조사](3d-tech-research.md)의 1단계(A)를 그대로 적용. 모델 파일 없이 코드 도형만 사용.
- three.js r165 (ES 모듈, import map), `RoundedBoxGeometry`, `LatheGeometry`로 돔, `TubeGeometry`로 갈비뼈 기둥
- 무광 `MeshStandardMaterial` + 노이즈 범프로 점토 느낌, `RoomEnvironment` 환경광, 반구광, 부드러운 그림자, 펜던트 점광원
- 후처리: `GTAOPass`(구석 그림자) → `OutputPass` → 직접 만든 색보정 패스(채도·온도·S커브·비네트·필름 그레인)
- 두더지: 아래가 넓은 달걀형 + 얼룩 텍스처(털 돌기 인스턴스는 고슴도치처럼 보여서 뺐음)
- 페이지에서 "밀어서 비교"로 원본과 경계를 옮겨 가며 볼 수 있음

## 결론
- **비슷하게 맞출 수 있는 것**: 돔 실루엣과 갈비뼈, 바닥 원판, 살구·갈색 색감, 따뜻한 조명, 가구 배치와 비율. 관심사별로 가구를 코드로 바꿔 끼우는 구조도 유지됨
- **반쯤 되는 것**: 점토 질감(노이즈와 그레인으로 흉내), 구석 그림자(실시간 AO라 원본보다 얕음)
- **크게 다른 것**: 두더지 털과 표정, 가구 모서리의 말랑한 곡면, 렌더러가 계산한 간접광 번짐(GI)
- "똑같이"에 가장 빨리 닿는 길은 **두더지와 눈에 띄는 가구만 Blender 모델(glb)로 바꾸고, 방 껍데기의 간접광은 텍스처에 구워 넣기**

## 다음 단계
1. 원본을 렌더한 Blender 파일이 있는지 디자이너에게 확인. 있으면 두더지·가구를 glb로 바로 뽑을 수 있음
2. 방 껍데기(돔·바닥)는 간접광을 텍스처에 구워 한 장으로
3. 가구는 관심사별 glb 조각으로 나눠 코드로 배치
4. 모바일은 Figma 타임라인 메모대로 3D 대신 미리 렌더한 이미지·영상

## 참고
- Figma MCP는 View 시트 호출 한도에 걸려서 화면 3장만 받았음 (`design/figma/`). 나머지 화면은 구조 메타데이터(`design/figma/screens-metadata.xml`)만 있음
- 미리보기: `explore/3d/`를 정적 서버로 띄우고 `room.html`을 html/body로 감싸서 열기 (`#3d`, `#ref`로 시작 모드 지정)
