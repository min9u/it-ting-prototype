# 디굴디굴 (it-ting)

관심사로 꾸며진 "땅굴"을 서로 구경하고, 1:1 대화와 모임으로 이어지는 커뮤니티의 프론트엔드 프로토타입입니다.

- **써 보기 (팀 공유용):** https://claude.ai/artifact/Fd1hfXP3T6nzY2Zg4QXYAS — 로그인된 상태의 내 땅굴부터 열립니다. `#/screens`를 붙이면 전체 화면 목록
- **디자인 기준:** Figma "it-ting 스켈레톤" 파일의 **03. Screens** 페이지
- **기술 문서 (공부용):** [docs/frontend-guide.md](docs/frontend-guide.md)

![내 땅굴](docs/screenshots/app-burrow.png)

## 지금 들어 있는 것

| 영역 | 화면 | 주소 (공유 빌드는 앞에 `#`) |
|---|---|---|
| 땅굴 | 내 땅굴(3D), 탐색하기(3D 밭), 남의 땅굴, 방명록 전체보기, 대화 요청 | `/burrow`, `/burrow/explore`, `/burrow/:userId` |
| 게시판 | 글 목록, 글 상세(A·B안), 인기 글, 관심사별 보기 | `/board`, `/board/:postId` |
| 모임 | 목록, 내 모임, 상세, 캘린더, 참여 신청, 모임 만들기 | `/meetups`, `/meetups/me`, `/meetups/:id`, `/meetups/new` |
| 채팅 | 1:1·모임 대화, 받은·보낸 요청 | `/chat`, `/chat/requests` |
| 시작 | 랜딩(스크롤 연출), 둘러보기, 로그인, 회원가입, 비밀번호 찾기 | `/` (공유 빌드는 `/start`), `/look`, `/login` … |
| 온보딩 | 이름 → 관심 분야 → 자기소개 → 방 만드는 중 → 미리보기 | `/onboarding/:step` |

데이터는 모두 예시(`app/src/data/mock.ts`)이고 서버는 없습니다. 글쓰기·신청 같은 동작은 저장되지 않습니다.

### 3D 땅굴
- **두더지 캐릭터:** 펠트 질감(섬유 결 + 천 반사 + 잔털 막 12겹), 바닥에서 머리로 좁아지는 원본형 몸. 숨쉬기·깜빡임, 뒤뚱 걷기
- **조종:** 내 땅굴은 방향키·WASD·바닥 클릭, 탐색하기는 WASD·땅 클릭 (←/→는 이웃 땅굴 넘기기). 가만히 두면 혼자 돌아다님
- **가구 17개:** 관심 분야 11개와 연결되고, 뒤쪽 벽을 따라 놓임. 주인의 관심사(예: 캠핑, 피아노)에 맞는 가구만 나옴
- **조명:** 그라데이션 환경광 + 부드러운 그림자 + 구석 그림자(AO) + 색보정. PlayCanvas 실험에서 가져온 방식

## 실행

```bash
cd app
npm install
npm run dev          # http://localhost:5173  (시작 화면부터)
npm run build        # 일반 빌드 → app/dist
npm run build:share  # 팀 공유용 빌드(# 주소, 첫 화면 = 내 땅굴) → app/dist-share
```

클릭 없이 특정 상태를 여는 주소: `/burrow?panel=closed`, `/burrow?guestbook=0`, `/burrow?modal=guestbook`, `/burrow/yerin?modal=request`, `/meetups?modal=calendar`, `/meetups/new?modal=done`

## 폴더

| 경로 | 내용 |
|---|---|
| `app/` | **앱 본체.** Vite + React 19 + TypeScript + react-router 7, CSS Modules |
| `app/src/three/` | 3D 장면 (three.js 0.165). 땅굴 화면에 들어갈 때만 따로 불러옴 |
| `explore/3d/lib/` | **두더지·가구의 원본 코드.** `node explore/3d/lib/build-app.js`로 `app/src/three/mole.ts`, `furniture.ts`를 만듦 |
| `explore/` | 3D 실험 페이지 (three.js · Babylon.js · PlayCanvas 비교), 미리보기 `node explore/serve.js 5190` |
| `design/figma/` | Figma에서 받아 둔 화면 PNG와 페이지 구조(`screens-metadata.xml`) |
| `docs/` | 계획·조사·결정 기록 |
| `legacy/` | 방향 전환 전의 단일 HTML 시안들 (v1~v3, 두더지, 밤티 두더지) |

## 지금까지 한 일 (2026-11-10)

1. **방향 전환:** 이전 시안을 `legacy/`로 옮기고 Figma 03. Screens 기준으로 새로 시작
2. **프론트엔드 개발:** 화면 약 45장을 계획([frontend-plan.md](docs/frontend-plan.md))하고 React 앱으로 구현. 내 땅굴은 시안과 픽셀 단위로 대조
3. **3D 그림체 탐색:** Figma 렌더를 코드만으로 재현 → 엔진 3개 비교 → three.js로 결정하고 PlayCanvas식 조명을 옮김 ([3d-figma-reproduction](docs/3d-figma-reproduction.md), [3d-engine-candidates](docs/3d-engine-candidates.md), [playcanvas-vs-threejs](docs/playcanvas-vs-threejs.md))
4. **두더지 캐릭터:** 원본과 확대 비교하며 펠트 질감 9회, 눈 사시 수정, 머리 모양 조정 후 임시 고정
5. **가구·움직임:** 관심 분야별 가구 카탈로그, 벽 따라 정리, 두더지 걷기·조종
6. **합치기·배포:** 3D를 앱에 넣고(지연 로딩) 팀 공유용으로 배포

## 남은 일
- Figma 화면 PNG가 3장뿐이라 나머지 화면은 구조 정보로만 만든 상태 → 화면별 PNG를 받아 대조 필요
- 서체 확정(지금 Do Hyeon + Pretendard), 글 상세 A/B안, 온보딩 2 안 결정
- 두더지·가구를 원본처럼 만들려면 Blender 모델(glb)과 미리 구운 조명이 필요
- 모바일 화면, 3D 성능(저사양 기기)
