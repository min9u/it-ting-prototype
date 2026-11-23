# 팀 리포로 프론트엔드 옮기기: 커밋 재구성 연습 (2026-11-23)

- 요청: 이 리포의 `frontend/`(Next.js)를 팀 리포(it-ting-team/it-ting)에 **작은 커밋 여러 개**로 넣는 연습. 푸시 · 원격 변경 · PR 없이, 커밋 계획 + 재현 스크립트를 이 리포에 남기고, 연습용 클론에서 커밋마다 빌드 · 테스트를 확인
- 앞선 결정: [team-repo-migration.md](team-repo-migration.md) (커밋 초안 약 30개, 팀 커밋 규칙). 사용자 추가 요청: "커밋을 더 작게, 책임 하나씩" (로그인 · 회원가입 · 비밀번호 찾기 · 온보딩 · 내 땅굴 · 탐색 · 방문 · 채팅 · 모임 목록/상세 · 모임 만들기 · 게시판 목록/상세 · 글쓰기 · 알림 · 설정을 따로)
- 결론: **커밋 62개**로 나눴고, 연습 클론(`origin/dev` `35d107a` 위 `chore/fe/KAN-0-frontend-import`)에서 **모든 커밋이 커밋 전에 tsc · 린트(오류 0) · 단위 테스트 · 배포 빌드를 통과**, 모두 서명됨(`G`). 마지막 `frontend/` 는 이 리포 `frontend/` 와 같음(README 1개만 의도적으로 다름, 줄바꿈 1개는 팀 `.gitattributes` 가 LF 로 바꿈). 스크립트로 새 브랜치에 처음부터 다시 만들어 같은 결과를 확인

## 커밋 표 (스크립트 두 번째 실행, 새 브랜치 `chore/fe/KAN-0-frontend-import-rerun`)

검사는 커밋하기 전에 팀 리포 `frontend/` 에서: `npm ci`(lock 이 바뀔 때만, 1번) → `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build` → (59번부터) `npm run check:labs-off -- --no-build`. 마지막 결과는 이 리포와 같은 **테스트 46파일 637개 (+ todo 2) · 린트 오류 0 · 경고 56**.

| # | 제목 | 담는 것 | 파일 | 검사 (커밋 전) | 시간 | 서명 |
|---|---|---|---|---|---|---|
| 1 | `chore: 프론트엔드 Next.js 프로젝트 설정 추가` | package.json · lock · .nvmrc · tsconfig · next.config(실험실 스위치 · rewrites · 에셋 규칙) · eslint · vitest · .env.example · lib/env.ts · 에셋 타입, 임시 루트 레이아웃 | 11 (임시 src/app/layout.tsx) | tsc 통과 · lint 오류 0 경고 0 · test 없음 · build 통과 | 27s | G |
| 2 | `feat: 디자인 토큰과 전역 스타일 추가` | styles/tokens.css(색 · 글꼴 · 간격) · global.css | 2 | tsc 통과 · lint 오류 0 경고 0 · test 없음 · build 통과 | 6s | G |
| 3 | `feat: 공통 타입과 유틸 함수 추가` | data/types.ts · lib(time · format · validation · a11y · store · network · authRules 등) + 테스트 2 | 13 | tsc 통과 · lint 오류 0 경고 0 · test 2파일 17개 · build 통과 | 7s | G |
| 4 | `feat: 관심사 태그 데이터 추가` | 관심사 대분류 12 · 소분류 90(interestTags · interests · interest3d · interestWords) · 자기소개 질문 · 희귀도 | 8 | tsc 통과 · lint 오류 0 경고 0 · test 2파일 17개 · build 통과 | 7s | G |
| 5 | `feat: 목 사용자와 캠퍼스 데이터 추가` | 목 사용자(data/mock) · 로그인 상태(data/auth) · 캠퍼스 층 · 들판 이웃(data/field) + 테스트 | 5 | tsc 통과 · lint 오류 0 경고 0 · test 3파일 21개 · build 통과 | 7s | G |
| 6 | `feat: 그래픽 성능 단계 감지 추가` | 그래픽 가속 감지 · 기기 단계 · 저사양 설정 저장(lib/graphicsTier · deviceTier · lowLab) | 3 | tsc 통과 · lint 오류 0 경고 0 · test 3파일 21개 · build 통과 | 7s | G |
| 7 | `feat: 3D 공통 엔진 추가` | three 엔진 · glb 로더 · Draco 해독기(public/draco) · 조명 · 후처리 · SceneCanvas · 정지 그림 + 테스트 | 23 | tsc 통과 · lint 오류 0 경고 5 · test 4파일 23개 · build 통과 | 10s | G |
| 8 | `feat: 저사양 PC 그리기 모드 추가` | 움직이지 않는 배경 한 번 그리기 · 선명한 방 · 예열 · 가속 꺼짐 안내 띠(GpuNotice) | 5 | tsc 통과 · lint 오류 0 경고 6 · test 4파일 23개 · build 통과 | 8s | G |
| 9 | `feat: 두더지 3D 모델과 액세서리 추가` | 두더지 glb · 동작 · 액세서리 41개(아이콘 포함) · 2D 아바타 · 미리 보기 캔버스 | 55 | tsc 통과 · lint 오류 0 경고 7 · test 4파일 23개 · build 통과 | 7s | G |
| 10 | `feat: 땅굴 가구 배치와 벽지 데이터 추가` | 가구 배치(roomPlan · slots) · 내 땅굴 데이터(myBurrow) · 벽지 7종 · 방 모양(roomLook) + 테스트 6 | 27 | tsc 통과 · lint 오류 0 경고 7 · test 9파일 80개 · build 통과 | 8s | G |
| 11 | `feat: 관심사 이펙트 추가` | 관심사 이펙트 색 · 글리프 · 오버레이 · 땅굴 이펙트 | 5 | tsc 통과 · lint 오류 0 경고 7 · test 9파일 80개 · build 통과 | 9s | G |
| 12 | `feat: 땅굴 3D 장면 추가` | 땅굴 장면 · 방 glb · 가구 낙하 · 우체통 · 경로 · Worker · RoomView · 흙더미 두더지 + 테스트 4 | 37 | tsc 통과 · lint 오류 0 경고 15 · test 13파일 116개 · build 통과 | 12s | G |
| 13 | `feat: 관심사 소품 썸네일 추가` | 소품 썸네일 131개 + 테스트 (앱 코드는 아직 안 씀) | 132 | tsc 통과 · lint 오류 0 경고 15 · test 14파일 126개 · build 통과 | 11s | G |
| 14 | `feat: 탐색 들판 3D 장면 추가` | 들판 장면 · 구멍 들판 · 카메라 · 울타리 · 들판 glb · FieldView + 테스트 4 | 33 | tsc 통과 · lint 오류 0 경고 17 · test 18파일 222개 · build 통과 | 16s | G |
| 15 | `feat: 채팅 찻방 3D 장면 추가` | 채팅 찻방 장면 · 배치 + 테스트 2 | 6 | tsc 통과 · lint 오류 0 경고 19 · test 20파일 243개 · build 통과 | 19s | G |
| 16 | `feat: API 클라이언트와 공통 응답 처리 추가` | fetch 클라이언트 · 응답 틀 · 에러 · id 변환 · React Query · 낙관적 갱신 · 영역별 목/실제 전환 | 8 | tsc 통과 · lint 오류 0 경고 19 · test 20파일 243개 · build 통과 | 14s | G |
| 17 | `feat: 목 서버 추가` | 브라우저 안 목 서버 바탕 · 시드 id · 목 사람 · 두더지 코드 | 4 | tsc 통과 · lint 오류 0 경고 19 · test 20파일 243개 · build 통과 | 13s | G |
| 18 | `feat: 화면 이동 어댑터 추가` | react-router 모양 어댑터(lib/nav) · 로그인 흐름(authFlow) · 테스트용 라우터 | 3 | tsc 통과 · lint 오류 0 경고 19 · test 20파일 243개 · build 통과 | 17s | G |
| 19 | `feat: 기본 UI 컴포넌트 추가` | Icons · Modal · Feedback(토스트 · 확인) · AsyncState · Avatar · InterestChip · Pagination · SceneButton · Footer · MonthCalendar · RoomModeToggle | 23 | tsc 통과 · lint 오류 0 경고 21 · test 20파일 243개 · build 통과 | 16s | G |
| 20 | `feat: 공통 API 연결 추가` | 00 공통 API(캠퍼스 · 기수 등) + 테스트 | 8 | tsc 통과 · lint 오류 0 경고 21 · test 21파일 257개 · build 통과 | 15s | G |
| 21 | `feat: 실시간 소식 연결 추가` | SSE 연결 · 다시 연결(backoff) · 이벤트 훅 + 테스트 | 6 | tsc 통과 · lint 오류 0 경고 21 · test 22파일 262개 · build 통과 | 13s | G |
| 22 | `feat: 목 서버 저장소 추가` | 목 서버가 쓰는 저장소(계정 · 관리자 · 게시판 · 채팅 · 모임 · 모임 카테고리 · 방명록) + 테스트 3 | 10 | tsc 통과 · lint 오류 0 경고 21 · test 25파일 300개 · build 통과 | 15s | G |
| 23 | `feat: 알림 API 연결 추가` | 09 알림 API · 알림 · 공지 저장소 + 명세 대조 테스트, 팀 명세 폴더 찾기(teamDocs) | 13 | tsc 통과 · lint 오류 0 경고 21 · test 26파일 314개 · build 통과 | 16s | G |
| 24 | `feat: 인증과 계정 설정 API 연결 추가` | 02 로그인 · 회원가입 · 비밀번호 찾기 · Google, 10 설정 API, 브라우저 알림 · 로그아웃 + 테스트 | 23 | tsc 통과 · lint 오류 0 경고 21 · test 27파일 337개 · build 통과 | 19s | G |
| 25 | `feat: 온보딩 API 연결 추가` | 03 온보딩 API · 관심사 id 잇기 + 테스트 2 | 13 | tsc 통과 · lint 오류 0 경고 21 · test 29파일 353개 · build 통과 | 21s | G |
| 26 | `feat: 게시판 API 연결 추가` | 08 게시판 API + 테스트 | 10 | tsc 통과 · lint 오류 0 경고 21 · test 30파일 374개 · build 통과 | 19s | G |
| 27 | `feat: 모임 API 연결 추가` | 07 모임 API + 테스트 2 | 11 | tsc 통과 · lint 오류 0 경고 22 · test 32파일 388개 · build 통과 | 17s | G |
| 28 | `feat: 채팅 API 연결 추가` | 06 채팅 API · 보내기 대기열 + 테스트 2 | 12 | tsc 통과 · lint 오류 0 경고 22 · test 34파일 416개 · build 통과 | 18s | G |
| 29 | `feat: 땅굴과 탐색 API 연결 추가` | 04 땅굴 · 05 탐색 API (서로 import 해서 한 커밋) + 테스트 4 | 23 | tsc 통과 · lint 오류 0 경고 22 · test 38파일 472개 · build 통과 | 23s | G |
| 30 | `feat: 관리자 API 연결 추가` | 관리자 API | 5 | tsc 통과 · lint 오류 0 경고 22 · test 38파일 472개 · build 통과 | 22s | G |
| 31 | `feat: API 영역 묶음과 명세 대조 테스트 추가` | api/index(영역 묶음) · endpoints · 목 저장소 동기화 + 명세 111개 대조 테스트 | 4 | tsc 통과 · lint 오류 0 경고 22 · test 39파일 487개 · build 통과 | 28s | G |
| 32 | `feat: 프로필 팝업 추가` | 프로필 팝업 | 2 | tsc 통과 · lint 오류 0 경고 22 · test 39파일 487개 · build 통과 | 21s | G |
| 33 | `feat: 로컬 실험실 스위치와 패널 추가` | src/labs(빌드 상수로 고르기) · 목 서버 손잡이 배지 · 🧪 저사양 패널 | 3 | tsc 통과 · lint 오류 0 경고 22 · test 39파일 487개 · build 통과 | 24s | G |
| 34 | `feat: 앱 바깥 틀과 에러 화면 추가` | 진짜 루트 레이아웃(글꼴 · 전역 CSS · providers) · error · global-error · 기기 안내 · 연결 끊김 띠 · 없는 주소 | 11 | tsc 통과 · lint 오류 0 경고 23 · test 39파일 487개 · build 통과 | 23s | G |
| 35 | `feat: 로그인 영역 틀과 상단 메뉴 추가` | AppShell(로그인 확인 · SSE) · 상단 메뉴 · 알림 팝업 · (app) 레이아웃 · not-found · 새 학기 고르기 · 시작 화면 머리 | 17 | tsc 통과 · lint 오류 0 경고 26 · test 39파일 487개 · build 통과 | 28s | G |
| 36 | `feat: 처음 방문 화면 추가` | 랜딩 · 둘러보기 · 견본 방 · (pc) 레이아웃 + 테스트 | 8 | tsc 통과 · lint 오류 0 경고 27 · test 40파일 489개 · build 통과 | 26s | G |
| 37 | `feat: 로그인 화면 추가` | Auth.tsx(로그인 · 회원가입 · 비밀번호 찾기 화면 코드) · 로그인 · Google 돌아오기 주소 | 9 | tsc 통과 · lint 오류 0 경고 28 · test 40파일 489개 · build 통과 | 26s | G |
| 38 | `feat: 회원가입과 SSAFY 인증 화면 추가` | 회원가입 · 비밀번호 · SSAFY 인증 주소 3개 (코드는 37번) | 3 | tsc 통과 · lint 오류 0 경고 28 · test 40파일 489개 · build 통과 | 27s | G |
| 39 | `feat: 비밀번호 찾기 화면 추가` | 비밀번호 찾기 주소 4개 (코드는 37번) | 4 | tsc 통과 · lint 오류 0 경고 28 · test 40파일 489개 · build 통과 | 28s | G |
| 40 | `feat: 온보딩 화면 추가` | 온보딩 4단계 · 두더지 꾸미기 · 질문 목록 · 단계 유지 레이아웃 | 8 | tsc 통과 · lint 오류 0 경고 29 · test 40파일 489개 · build 통과 | 27s | G |
| 41 | `feat: 방명록 모달 추가` | 방명록 모달 · 땅굴 화면 공통 CSS | 5 | tsc 통과 · lint 오류 0 경고 31 · test 40파일 489개 · build 통과 | 21s | G |
| 42 | `feat: 내 정보 수정 화면 추가` | 내 정보 수정 · 관심사 고르기 · 나가기 확인 + 테스트 | 4 | tsc 통과 · lint 오류 0 경고 32 · test 41파일 491개 · build 통과 | 23s | G |
| 43 | `feat: 땅굴 꾸미기 패널 추가` | 꾸미기 패널 | 1 | tsc 통과 · lint 오류 0 경고 32 · test 41파일 491개 · build 통과 | 21s | G |
| 44 | `feat: 내 땅굴 화면 추가` | 내 땅굴 화면 · 이펙트 패널 · /burrow + 테스트 | 5 | tsc 통과 · lint 오류 0 경고 34 · test 42파일 501개 · build 통과 | 28s | G |
| 45 | `feat: 탐색 화면 추가` | 탐색 시안 묶음 · 들판 탐색 · 미니맵 · 방노트 · 등불 고르기 · /burrow/explore + 테스트 | 21 | tsc 통과 · lint 오류 0 경고 43 · test 43파일 526개 · build 통과 | 31s | G |
| 46 | `feat: 남의 땅굴 방문 화면 추가` | 남의 땅굴 · /burrow/:userId | 3 | tsc 통과 · lint 오류 0 경고 45 · test 43파일 526개 · build 통과 | 30s | G |
| 47 | `feat: 채팅 화면 추가` | 채팅 목록 · 대화 · 요청 · 찻방 · 연결 상태 띠 | 10 | tsc 통과 · lint 오류 0 경고 47 · test 43파일 526개 · build 통과 | 34s | G |
| 48 | `feat: 모임 목록 화면 추가` | 모임 틀 · 목록 · 내 모임 · 모임 카드 | 10 | tsc 통과 · lint 오류 0 경고 50 · test 43파일 526개 · build 통과 | 32s | G |
| 49 | `feat: 모임 상세와 신청 관리 화면 추가` | 모임 상세 · 신청 관리 | 2 | tsc 통과 · lint 오류 0 경고 50 · test 43파일 526개 · build 통과 | 32s | G |
| 50 | `feat: 모임 만들기와 수정 화면 추가` | 모임 만들기 · 수정 + 모임 API 테스트(화면 폴더 검사) | 4 | tsc 통과 · lint 오류 0 경고 50 · test 44파일 559개 · build 통과 | 34s | G |
| 51 | `feat: 게시판 목록과 글 상세 화면 추가` | 게시판 목록 · 글 상세 · 댓글 · 글쓰기 코드 | 7 | tsc 통과 · lint 오류 0 경고 51 · test 44파일 559개 · build 통과 | 37s | G |
| 52 | `feat: 글쓰기와 글 수정 화면 추가` | 글쓰기 · 글 수정 주소 (코드는 51번) | 2 | tsc 통과 · lint 오류 0 경고 51 · test 44파일 559개 · build 통과 | 36s | G |
| 53 | `feat: 게시판 내 활동 화면 추가` | 저장한 글 · 내 글 · 댓글 단 글 주소 | 4 | tsc 통과 · lint 오류 0 경고 51 · test 44파일 559개 · build 통과 | 36s | G |
| 54 | `feat: 알림 화면 추가` | 알림 화면 | 3 | tsc 통과 · lint 오류 0 경고 51 · test 44파일 559개 · build 통과 | 36s | G |
| 55 | `feat: 설정 화면 추가` | 설정 홈 · 비밀번호 · Google · 알림 설정 · 공지사항 · 탈퇴 · 크레딧 | 16 | tsc 통과 · lint 오류 0 경고 53 · test 44파일 559개 · build 통과 | 37s | G |
| 56 | `feat: 관리자 화면 추가` | 관리자 화면 | 3 | tsc 통과 · lint 오류 0 경고 53 · test 44파일 559개 · build 통과 | 37s | G |
| 57 | `feat: 로컬 실험실 화면 추가` | /lab/style · /lab/rooms · /screens · /dev/crash (page.lab.tsx, 배포 빌드에 없음) | 9 | tsc 통과 · lint 오류 0 경고 55 · test 44파일 559개 · build 통과 | 30s | G |
| 58 | `test: 데이터 규칙과 관심사 태그 테스트 추가` | rules.test(여러 저장소 규칙) · interest-tags.test(관심사 확정본) + 관심사 v2 사본 | 3 | tsc 통과 · lint 오류 0 경고 55 · test 46파일 637개 · build 통과 | 32s | G |
| 59 | `test: 화면 스모크와 실험실 빠짐 검사 추가` | scripts/smoke.mjs · nav-check.mjs · check-labs-off.mjs | 3 | tsc 통과 · lint 오류 0 경고 56 · test 46파일 637개 · build 통과 · labs-off 통과 | 31s | G |
| 60 | `chore: 프론트엔드 CI 추가` | 팀 .github/workflows/frontend-ci.yml | 0 (팀 .github/workflows/frontend-ci.yml) | tsc 통과 · lint 오류 0 경고 56 · test 46파일 637개 · build 통과 · labs-off 통과 | 29s | G |
| 61 | `docs: 프론트엔드 실행 문서 추가` | frontend/README.md (팀 리포용 링크) | 1 | tsc 통과 · lint 오류 0 경고 56 · test 46파일 637개 · build 통과 · labs-off 통과 | 28s | G |
| 62 | `docs: 저장소 지도의 프론트엔드 설명 수정` | 팀 AGENTS.md 저장소 지도 한 줄 | 0 (팀 AGENTS.md) | tsc 통과 · lint 오류 0 경고 56 · test 46파일 637개 · build 통과 · labs-off 통과 | 29s | G |

- 첫 실행 브랜치 `chore/fe/KAN-0-frontend-import` 와 두 번째 실행 브랜치의 **커밋 62개 트리 해시가 모두 같음** (커밋 해시는 시각 · 서명이 달라 다름)
- 제목 62개 모두 팀 정규식 통과, 서명 62개 모두 `G`, `git merge-tree --write-tree HEAD origin/dev` 충돌 0, `frontend/` 밖 변경은 `.github/workflows/frontend-ci.yml`(새 파일) · `AGENTS.md`(1줄)뿐

## 어떻게 나눴나

- 순서는 **의존 관계가 정함**: 설정 → 스타일 → 유틸 · 데이터 → 3D(엔진 → 두더지 → 땅굴 → 들판 → 찻방) → API(클라이언트 → 목 서버 → 화면 이동 → 기본 컴포넌트 → 영역별) → 앱 틀 → 화면 → 실험실 → 교차 테스트 → 스모크 → CI → 문서
  - 초안과 다른 점: 3D 를 API 앞으로 (3D 는 API 를 안 씀), API 를 영역마다 커밋으로 (화면이 여러 영역을 쓰고, 로그인 영역 틀(AppShell)이 모든 영역을 묶은 `api/index.ts` 를 쓰므로 화면 커밋에 넣으면 틀이 맨 뒤로 밀림), 상단 메뉴 · 레이아웃을 API 뒤로
- 파일은 `plan.json` 의 `files` 패턴에 **처음 맞는 커밋**으로 감. 722개 모두 정확히 한 커밋 (안 잡힌 파일 · 아무것도 안 잡는 패턴이 있으면 스크립트가 멈춤)
- 각 영역의 단위 테스트는 그 영역 커밋에 (테스트가 쓰는 파일이 다 들어온 첫 커밋). 여러 영역에 걸친 것 2개(`rules.test.ts`, `interest-tags.test.ts`)만 뒤의 `test:` 커밋
- **import 닫힘 검사** (`deps.mjs`): 커밋 i 까지 쌓인 파일만으로 모든 import · `import()` · `import.meta.glob` · `new URL(…, import.meta.url)` · CSS `@import` 가 풀리는지, 테스트가 `fs` 로 직접 읽는 `src/...` 파일 · 폴더까지. 실제 검사(tsc · 빌드 · 테스트)를 돌리기 전에 몇 초 만에 순서 문제를 찾음
- 한 파일에 여러 화면이 든 곳은 파일을 쪼갤 수 없어 **첫 커밋에 코드, 다음 커밋에 주소(라우트)만** 넣고 본문에 까닭을 적음:
  - `screens/start/Auth.tsx` = 로그인 · 회원가입 · 비밀번호 찾기 → 회원가입 · 비밀번호 찾기 커밋은 `page.tsx` 만
  - `screens/board/Board.tsx` 가 `BoardPost` · `BoardWrite` 를 불러옴 → 글쓰기 · 글 수정 커밋, 내 활동 커밋은 `page.tsx` 만
  - `screens/settings/Settings.tsx` 가 계정 · 알림 설정 · 공지사항 · 탈퇴를 다 불러와서 설정은 커밋 하나

## 임시 파일 (stub)

| 커밋 | 파일 | 까닭 | 바뀌는 커밋 |
|---|---|---|---|
| 1 | `frontend/src/app/layout.tsx` (`stubs/layout.tsx`, `<html><body>` 만) | 앱 폴더가 없으면 `next build` 가 실패 → 설정 커밋부터 빌드되게 가장 작은 루트 레이아웃 | "앱 바깥 틀과 에러 화면 추가" 에서 진짜 파일(글꼴 · 전역 CSS · providers)로 |

- 그 밖의 임시 파일은 없음 (순서만으로 해결)
- 테스트가 하나도 없는 커밋(1 · 2)은 `vitest run --passWithNoTests` 로 돌림 (`npm test` 는 테스트 파일이 없으면 실패). 3번부터는 `npm test` 그대로

## 팀 리포 파일 변경

| 파일 | 커밋 | 내용 |
|---|---|---|
| `.github/workflows/frontend-ci.yml` (새 파일) | `chore: 프론트엔드 CI 추가` | `pull_request` + 경로 `frontend/**` · 워크플로 파일. Node 는 `frontend/.nvmrc`, npm 캐시. 타입 검사 → 린트 → 단위 테스트 → 배포 빌드 → `check:labs-off --no-build`. 팀 워크플로처럼 `actions/checkout@v7`, `permissions: contents: read`, 한국어 주석 |
| `AGENTS.md` 저장소 지도 한 줄 | `docs: 저장소 지도의 프론트엔드 설명 수정` | `` | `frontend/` | Next.js (KAN-25에서 추가) | `` → `` | `frontend/` | Next.js 16.4 (App Router), React 19.3, TypeScript 6.0, Node 24, npm. 실행 방법은 `frontend/README.md` | `` (백엔드 줄과 같은 꼴) |

`frontend/` 안에서 이 리포와 다른 파일:

| 파일 | 다른 점 |
|---|---|
| `frontend/README.md` | 이 리포를 가리키던 상대 링크 `../app/` · `../docs/nextjs-migration.md` 를 "프로토타입 리포(`min9u/it-ting-prototype`)의 …" 글로 바꿈 (`team/README.md`, 3줄) |
| `frontend/src/data/big_model_sizes_v3_8.json` | 이 파일만 CRLF. 팀 `.gitattributes`(`* text=auto eol=lf`)가 커밋할 때 LF 로 바꿈 (내용 같음, JSON 이라 영향 없음) |

## 이 리포에서 고친 것 (연습 중 발견)

- `dc1937e` **테스트가 `frontend/` 밖을 읽던 문제**: 팀 리포에는 그 경로가 없어 tsc · 테스트가 깨짐
  - `interest-tags.test.ts` 가 `../../../design/digul_3d_handoff_v3/docs/interest_catalog.json` 을 import → `src/tests/fixtures/interest_catalog_v2.json` 사본으로
  - `api-v1-endpoints` · `interest-map` · `notice-types` 테스트가 `../docs/backend/team-spec/…` 을 읽음 → `src/tests/teamDocs.ts` 가 `../docs`(팀 리포 원본) 또는 `../docs/backend/team-spec`(이 리포 사본) 중 있는 곳을 고름. 팀 리포에서는 원본 명세 `docs/api` · `docs/spec` 과 바로 대조됨 (지금은 둘이 같음)

## 실제로 옮길 때 (스크립트)

```bash
# 이 리포 맨 위에서. 계획만 검사 (몇 초)
node tools/team-import/import.mjs --dry-run            # --verbose 면 커밋마다 파일 목록

# 팀 리포 최신 클론에서 (작업 트리 깨끗, 푸시는 사람이 확인 뒤)
git -C <팀 리포> fetch origin
node tools/team-import/import.mjs --target <팀 리포> --branch chore/fe/KAN-<번호>-frontend-import --log /tmp/import.json
node tools/team-import/report.mjs /tmp/import.json     # 결과 표
```

- 옵션: `--base origin/dev`(기본) · `--no-checks`(검사 없이 커밋만, 약 1분) · `--from N`(N-1 번까지 만든 브랜치에 이어서) · `--allow-dirty`
- 이 리포 `frontend/` · `tools/team-import/` 에 커밋 안 한 변경이 있으면 시작하지 않음 (재현되도록)
- 검사 실패 시: 그 커밋은 만들지 않고 스테이징된 채로 멈춤 → 고친 뒤 `git reset --hard` 하고 `--from N` 으로 이어서
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, 서명은 사용자 git 설정 그대로
- `frontend/` 가 바뀌면: `--dry-run` 이 새 파일을 어느 커밋에도 못 넣었다거나 import 순서가 틀렸다고 알려 줌 → `plan.json` 패턴만 고침
- 끝나면 팀 규칙대로: `git merge-tree --write-tree HEAD origin/dev` 충돌 확인 → 계획서 `docs/work/KAN-<번호>.md` → `code-review` → `pr-create`

## 걸린 시간

| 단계 | 시간 |
|---|---|
| 의존 관계 조사 · 계획 짜기 · 스크립트 | 약 1시간 반 |
| `--dry-run` (배정 · import 닫힘 · 제목 검사) | 1초 안쪽 |
| 첫 실행 (검사 포함): 1~9번 → 10번에서 테스트 실패로 멈춤 → 계획 고치고 `--from 10` 으로 이어서 53개 | 약 1분 + 17분 |
| 두 번째 실행 (새 브랜치, 처음부터 검사 포함 62개) | **23분** (커밋당 6~40초, 화면이 늘수록 빌드가 길어짐) |
| `--no-checks` (커밋만 62개) | **10초** |

이 맥(8코어, Node 26.5.1) 기준. npm 캐시가 있어 `npm ci` 는 몇 초

## 발견한 문제 · 위험

연습 중 고친 것 (위 "이 리포에서 고친 것"과 스크립트):
1. 테스트가 `frontend/` 밖 파일을 읽음 → 고침 (`dc1937e`)
2. 테스트가 `fs` 로 직접 읽는 파일(`interest-words.test.ts` → 방 glb, `meetup-api.test.ts` → `screens/meetups/` 폴더 전체)은 import 가 아니라 처음 계획에서 놓침 → 첫 실행이 10번 커밋에서 테스트 실패로 멈춤. `deps.mjs` 가 테스트 안의 `'src/…'` 경로 글도 의존으로 보게 고치고 두 테스트 자리를 옮김. `meetup-api.test.ts` 는 화면 폴더를 검사해서 모임 화면이 다 들어온 "모임 만들기와 수정 화면" 커밋으로 (본문에 적음)

실제로 옮길 때 위험:
- **Node 버전**: 이 맥은 Node 26.5.1 (nvm 에 24 없음, 설정은 바꾸지 않음) 으로 돌렸음. 팀 CI 는 `.nvmrc` 24.18. 리눅스 · Node 24 에서는 아직 안 돌려 봄 → 첫 PR 의 CI 결과로 확인. lock 에 리눅스용 `@next/swc-linux-x64-gnu` · `lightningcss-linux-x64-gnu` 는 들어 있음
- **CI 는 실행해 보지 못함** (푸시 안 함). 워크플로 YAML 문법만 확인, `actions/checkout@v7` · `actions/setup-node@v7` 은 지금 최신 태그(v7.0.1 · v7.1.0)
- **팀 명세가 바뀌면 프론트 테스트가 깨짐**: `api-v1-endpoints` · `interest-map` · `notice-types` 테스트가 팀 리포 `docs/api` · `docs/spec` 을 직접 읽음 (예: 명세 API 111개). 옮기기 직전에 팀 `origin/dev` 명세를 이 리포 사본(`docs/backend/team-spec/`)에 다시 맞추고 `frontend/` 를 고친 뒤 스크립트를 돌릴 것. 반대로 나중에 백엔드가 명세를 바꾸면 프론트 CI 가 실패해서 알려 줌 (좋은 점이지만 백엔드 PR 은 `frontend/**` 경로 필터에 안 걸려서 다음 프론트 PR 에서 드러남)
- **주소만 여는 커밋 4개** (회원가입 · 비밀번호 찾기 · 글쓰기 · 내 활동): 리뷰어가 "화면 추가인데 코드가 없다"고 볼 수 있음. 본문에 까닭을 적었음. 더 깔끔하게 하려면 옮기기 전에 이 리포에서 `Auth.tsx` → `Login` · `Signup` · `PasswordReset` 파일로, `Board.tsx` 의 묶음을 페이지별로 나누는 리팩터를 먼저 하면 됨 (이번엔 `frontend/` 를 안 고친다는 규칙이라 안 함)
- **안 쓰는 파일도 같이 감** (지우면 커밋이 더 깔끔): `src/assets/prop-thumbs/` 131개(676KB, 테스트만 봄, 꾸미기 가구 탭을 뺀 뒤 남음), `src/assets/room-v2.webp`, `components/GuestbookItem.tsx`, `three/TeaRoomCanvas.tsx`, `three/mole.ts` · `three/furniture.ts`(옛 생성 파일). 지울지 사용자 결정 필요
- **큰 바이너리**: 모델 · 텍스처 약 14MB + Draco 0.75MB 가 팀 리포 이력에 들어감 (Git LFS 없음). 팀이 괜찮은지 확인
- **커밋 62개 한 PR**: 리뷰 부담. PR 본문에 커밋 순서 묶음(설정 · 3D · API · 화면 · 테스트 · CI)을 표로 보여 주면 좋음. 팀 규칙상 계획서(`docs/work/KAN-<번호>.md`)도 같은 PR 에 들어가야 하는데, 이 스크립트는 계획서를 만들지 않음 → 계획서 커밋(`docs:`)을 맨 끝에 손으로 더하거나 `plan.json` 에 `team` 항목으로 추가
- `AGENTS.md` 의 "(KAN-25에서 추가)" 를 지웠음. KAN-25 를 쓰기로 하면 그 표기를 남길지 정할 것
- 린트 경고는 커밋이 쌓이며 0 → 56 (이 리포와 같은 수, 거의 React Compiler 규칙 경고). 오류는 모든 커밋에서 0
- 커밋 1 · 2 는 테스트 파일이 없어 `--passWithNoTests`. 화면 스모크(`npm run smoke`, 헤드리스 크롬 105화면)는 커밋마다 돌리지 않았음 (마지막 트리는 이 리포 `frontend/` 와 같아서 이 리포의 스모크 결과가 그대로 해당)
- 연습 브랜치 이름 `chore/fe/KAN-0-frontend-import` 의 `KAN-0` 은 자리표시. 실제 번호를 받으면 `--branch` 만 바꿈
