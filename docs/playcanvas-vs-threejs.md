# PlayCanvas vs three.js: 실제 프론트엔드에 넣는다면

- 날짜: 2026-11-10
- 요청: PlayCanvas 버전이 가장 괜찮아 보임. three.js와의 차이를 자세히, 실제 프론트엔드 업무로 들어갈 때 장점과 한계를 분석
- 근거: 이번 실험 코드(`explore/playcanvas/`, `explore/3d/`), npm 수치(2026-11-10 기준), 공식 요금제 페이지

## 1. PlayCanvas 버전이 더 좋아 보인 이유
엔진 자체보다 **조명을 다르게 잡은 영향이 큽니다.** 같은 도형인데 빛 처리 세 가지가 달랐습니다.

| | PlayCanvas 버전 | three.js 버전 | three.js로 같게 하려면 |
|---|---|---|---|
| 주변광 | 하늘색→풀색 그라데이션을 그려 **환경광(이미지 기반 조명)**으로 구움 (`EnvLighting`). 면마다 방향에 따라 은은하게 다른 색을 받음 | 반구광(`HemisphereLight`) 하나. 위·아래 두 색만 섞음 | 같은 그라데이션 캔버스를 `PMREMGenerator`로 구워 `scene.environment`에 넣으면 됨 |
| 그림자 | **PCSS**(멀수록 번지는 부드러운 그림자) | PCF Soft (가장자리 폭이 일정) | 기본 제공은 아님. 공식 예제의 PCSS 셰이더 패치를 쓰거나 `ContactShadows`(drei)로 대체 |
| 구석 그림자 | CameraFrame SSAO (조명에 합성) | 확대 시점과 충돌해서 탐색하기에서는 끔 | `postprocessing` 라이브러리의 N8AO/SSAO |

즉 **지금 보이는 차이 대부분은 three.js로도 옮길 수 있습니다.** 다만 PlayCanvas는 이 세 가지가 엔진에 들어 있어 몇 줄로 켜지고, three.js는 라이브러리를 골라 붙여야 합니다.

## 2. 수치 비교

| 항목 | three.js | PlayCanvas |
|---|---|---|
| 엔진 크기 (이번에 쓴 빌드) | 678KB / **gzip 167KB** | 2.55MB / **gzip 655KB** (약 4배) |
| 최신 버전 | 0.187.0 | 2.24.0 |
| npm 주간 다운로드 | **약 3,480만** | 약 18만 (약 1/190) |
| React 연동 | `@react-three/fiber` 9.8 (주 930만), `@react-three/drei` (주 630만) | `@playcanvas/react` 0.11 (주 1.4만, 2024-10 공개, 아직 0.x) |
| 후처리 | 별도 라이브러리 (`postprocessing`, 주 190만) | `CameraFrame` 내장 (SSAO·블룸·DoF·TAA·색보정·비네트, 그레인은 없음) |
| 기본 도형 | 회전체·튜브·둥근 상자·압출 다 있음 | 없어서 직접 작성 (이번에 약 10KB) |
| 에디터 | 없음 (코드로만) | 웹 에디터 있음. 무료는 공개 프로젝트만, 비공개는 개인 월 $15부터 |
| 라이선스 | MIT | 엔진 MIT (에디터는 유료 서비스) |
| 이번 실험 코드량 (두 장면) | 약 67KB | 약 86KB |

## 3. 실제 프론트엔드 업무에서

### PlayCanvas의 장점
- **그림체 맞추기가 빠름**: 환경광, PCSS 그림자, SSAO, 톤매핑, 색보정이 엔진 기본이라 "점토 장난감" 느낌을 적은 코드로 냄. 라이브러리 조합을 고민할 일이 적음
- **엔진이 한 덩어리라 버전 충돌이 없음**: three.js는 three, R3F, drei, postprocessing 버전을 함께 맞춰야 하고 three는 자주 바뀜(0.165 → 0.187)
- **웹 에디터**: 디자이너가 직접 가구 배치, 조명, 재질을 만지고 결과를 개발자가 코드로 불러올 수 있음. 3D 협업이 잦아지면 큰 장점
- **모바일 최적화 기능 내장**: 텍스처 압축(Basis), 배칭, 클러스터 조명 등 게임 엔진 출신이라 성능 도구가 기본으로 있음
- **타입 정의 내장**: TypeScript 타입이 엔진에 포함

### PlayCanvas의 한계
- **첫 로딩이 무거움**: gzip 655KB로 three.js의 약 4배. 우리 앱은 첫 화면이 땅굴이라 체감됨 → 3D 화면만 지연 로딩(code splitting) 필수
- **React 연동이 아직 어림**: `@playcanvas/react`는 0.x, 사용자가 R3F의 1/650 수준. 막히면 직접 해결해야 하고, 예제·질문 답이 적음
- **사람 구하기·인수인계**: three.js 경험자가 훨씬 많음. 팀원이 바뀌거나 외부 도움을 받을 때 불리
- **도형 헬퍼가 없음**: 지금처럼 코드로 도형을 만들면 손이 많이 감. 다만 glb 모델로 넘어가면 문제가 거의 사라짐
- **에디터는 유료**: 비공개 프로젝트는 개인 월 $15부터. 엔진만 쓰면 무료지만 에디터 장점은 못 누림
- **DOM과 섞기가 불편**: 가구 위 라벨(랜딩 03), 말풍선 같은 HTML 오버레이를 three.js는 drei `Html`로 바로 붙이지만, PlayCanvas는 위치 계산을 직접 해야 함

### three.js의 장점
- 가볍고(gzip 167KB), React 앱에 R3F로 자연스럽게 붙음. 컴포넌트·상태·라우팅과 같은 방식으로 3D를 다룸
- drei에 필요한 게 거의 다 있음: 카메라 조작, HTML 라벨, 환경광, 접지 그림자, 가구 끌어 놓기(꾸미기)용 조작 도구
- 자료와 사람이 압도적으로 많음

### three.js의 한계
- 좋은 그림체를 내려면 조명·그림자·후처리 라이브러리를 직접 골라 조합해야 함 (이번 three.js 버전이 PlayCanvas보다 밋밋했던 이유)
- three가 자주 바뀌어 생태계 버전 맞추기가 번거로움
- 에디터가 없어 디자이너가 배치를 직접 만질 수 없음

## 4. 우리 화면 기준 체크

| 화면·기능 | three.js (R3F) | PlayCanvas |
|---|---|---|
| 내 땅굴 / 남의 땅굴 (방 하나 띄우기) | 쉬움 | 쉬움 |
| 탐색하기 (밭, 많은 꽃·덤불) | 인스턴싱 쉬움 | 인스턴싱 쉬움, 성능 도구 더 많음 |
| 랜딩 스크롤 연출 (땅 위 → 구멍 → 방) | 스크롤 상태를 React에서 바로 연결 | 가능하지만 React 상태 연결은 직접 |
| 가구 라벨·말풍선 (HTML 겹치기) | drei `Html`로 바로 | 직접 계산 |
| 땅굴 꾸미기 (가구 끌어 놓기) | drei 조작 도구 | 엔진 기즈모 있음 |
| 방 썸네일 여러 개 | 렌더 타깃 또는 이미지 미리 굽기 | 같음 |
| 모바일 | 대안 필요 (Figma 메모: 세로 영상) | 같음, 다만 엔진이 더 무거움 |

## 5. 결론과 제안
- 보기 좋은 차이는 대부분 **조명 기법**이라 엔진을 바꾸지 않아도 따라갈 수 있음
- 실제 서비스 앱(React, 여러 화면, 팀 개발)에는 **여전히 three.js(R3F)가 유리**. 가볍고, React와 잘 맞고, 사람과 자료가 많음
- PlayCanvas가 더 나은 경우: 3D가 앱의 대부분이고, 디자이너가 에디터로 직접 씬을 만들 계획이며, 첫 로딩 600KB 이상을 감수할 수 있을 때
- **다음 단계 제안**: three.js 탐색하기에 PlayCanvas의 조명 세 가지(그라데이션 환경광, 부드러운 그림자, SSAO)를 옮겨 보고, PlayCanvas 버전과 나란히 비교한 뒤 엔진 확정

## 출처
- npm 레지스트리·다운로드 API (2026-11-10 조회): three, playcanvas, @react-three/fiber, @react-three/drei, @playcanvas/react, postprocessing
- 번들 크기: jsDelivr에서 받은 three@0.165.0 `three.module.min.js`, playcanvas@2.23.3 `playcanvas.min.mjs`를 gzip -9로 측정
- [PlayCanvas Editor Plans](https://playcanvas.com/plans)
- [PlayCanvas CameraFrame](https://developer.playcanvas.com/user-manual/graphics/posteffects/cameraframe/)

## 6. 후속: three.js에 PlayCanvas 조명 옮기기 (2026-11-10)
- 요청: "조명을 바꿔줘봐"
- 한 것: 반구광 대신 그라데이션 환경광(PMREM), 해 방향을 옮기고 반경 블러 그림자, 구석 그림자는 **N8AO**(three.js 내장 GTAO는 두더지 뒤 사각 얼룩 버그) 사용. 방은 벽·바닥 색을 PlayCanvas 값으로, 주황 점광원·색보정 틴트를 줄이고 Neutral 톤매핑
- 결과: **PlayCanvas 버전과 거의 같은 느낌**. 탐색하기 페이지의 "PlayCanvas식 조명" 체크박스로 전후 비교 가능 (https://claude.ai/artifact/1GfvgcExFAX7zM7a3cSDUw)
- 비용: 조명 코드 약 40줄 + 라이브러리 2개(n8ao, postprocessing). 엔진 교체 없이 해결됨 → 3장의 결론(앱은 three.js) 유지
- 다음 단계: 엔진을 three.js로 확정하면, 이 조명 설정을 `app/`의 `<RoomView>`에 React Three Fiber로 옮기기
