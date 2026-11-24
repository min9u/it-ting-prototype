# KAN-64 프론트엔드 프로토타입 이전 (Next.js)

- Jira: [KAN-64](https://it-ting.atlassian.net/browse/KAN-64)
- 브랜치: `chore/fe/KAN-64-frontend-import`

## 계획

### 목표

프로토타입 리포(`min9u/it-ting-prototype`)에서 만든 웹 프론트엔드를 이 리포 `frontend/`에 넣는다. 서비스 명세(`docs/spec/`)와 API 명세(`docs/api/`, 111개)에 맞춘 화면 48개(같은 주소)와 3D 땅굴 · 탐색 들판, 목 서버, 실시간 소식(SSE) 연결이다.

- Next.js 16.4 (App Router) · React 19.3 · TypeScript 6.0 (strict) · TanStack Query 5 · three.js 0.165 · CSS Modules · vitest
- 처음에는 모든 영역이 목 서버로 돈다. 백엔드가 만든 영역은 `NEXT_PUBLIC_API_REAL_AREAS`로 하나씩 실제 서버에 붙인다

범위 밖:
- 실제 백엔드로 로그인 · 온보딩 · 땅굴 · 게시판 · 알림 확인 (다음 티켓, 영역별. 이번에는 목 서버로 모든 화면을 확인)
- 배포(서버 · 도메인 · Nginx). 설정 예시만 프로토타입 리포에 있음
- 프론트 코드 규칙 확정(KAN-4)
- 프로토타입 리포의 예전 이력(커밋 300여 개). 서명할 수 없는 다른 사람 커밋이 섞여 있고 메시지 형식이 달라 옮기지 않는다. PR 본문에 원래 리포 링크를 남긴다

### 정한 것

| # | 질문 | 정한 답 | 정한 사람 |
|---|---|---|---|
| 1 | 프레임워크 | Next.js App Router. 화면은 거의 클라이언트 컴포넌트, three.js 는 브라우저에서만 불러옴 | 사용자 (2026-11-22) |
| 2 | 커밋 나누기 | 화면 · 기능 하나에 커밋 하나(62개), PR 하나. 커밋마다 tsc · 린트(오류 0) · 테스트 · 빌드 통과 | 사용자 (2026-11-22) |
| 3 | 기준 문서 | 서비스 명세가 기준. API 명세에 맞추고, 명세에 없는 기능(차단 · 모임 신고 · 접속 중 표시 · 꾸미기 소품 · 색 탭 등)은 뺐다 | 사용자 (2026-11-22) |
| 4 | 실험실(저사양 패널 · 목 서버 손잡이 · `/lab/*` · `/screens` · `/dev/crash`) | `next dev`에서만 켜지고 배포 빌드에는 코드까지 빠짐(`page.lab.tsx`, `NEXT_PUBLIC_LABS`). CI 가 빠졌는지 검사 | 사용자 (2026-11-22) |
| 5 | 꾸미기 가구 탭 | 뺌 (명세 dev 9ea6698: 가구는 고르지 않음) | 사용자 (2026-11-23) |
| 6 | 안 쓰는 파일(소품 썸네일 131개 등) | 옮기기 전에 지움 | 사용자 (2026-11-23) |
| 7 | Jira | 새 티켓 KAN-64. KAN-25(Next.js 프로젝트 초기 설정)의 작업 내용이 이 이전에 모두 들어가 "관련" 링크로 걸어 둠. KAN-25 를 닫을지는 담당자와 정함 | 사용자 (2026-11-23 · 11-24) |
| 8 | 로그인 검사 | 환경 변수 `NEXT_PUBLIC_LOGIN_FREE`. 기본은 명세대로 검사(비로그인 → 로그인, 온보딩 안 끝남 → 온보딩, 401 → 다시 로그인), `1`이면 시연용으로 모두 열림 | 사용자 (2026-11-23) |
| 9 | PR 수 | 하나. 본문에 커밋 묶음 표로 리뷰 순서를 안내 | 사용자 (2026-11-23) |
| 10 | 실제 백엔드 연결 확인 | 다음 티켓(영역별). 이번에는 목 서버로 전 화면 확인 | 사용자 (2026-11-23) |
| 11 | 한 파일에 여러 화면이 든 곳(로그인 · 회원가입 · 비밀번호 찾기, 게시판 · 글쓰기 · 내 활동) | 파일을 나누지 않고, 뒤 화면 커밋은 주소(`page.tsx`)만 넣고 본문에 까닭을 적음 | 사용자 (2026-11-23) |
| 12 | 기준 명세 버전 | `dev` `61e6c10`(KAN-54 병합)까지 반영. 이후 바뀌면 PR 전에 다시 맞춤 → PR 전에 `fa73cd7`(KAN-58 병합)까지 확인해 맞춤 | 사용자 (2026-11-23) |
| 13 | 버전 · 패키지 매니저 | Next.js 16.4.6 · npm · Node 24.18(`frontend/.nvmrc`). 이 조합으로 테스트 · 스모크 · CI(우분투, Node 24)까지 통과. KAN-25에서 다르게 정했다면 그쪽을 따른다 | 사용자 (2026-11-24, 제안대로) |
| 14 | 린트 | Next 기본 규칙 + React Compiler 규칙은 경고로(지금 경고 55, 오류 0). CI 는 오류만 막음. React Compiler 규칙을 오류로 하면 three.js · 애니메이션 코드 대부분을 다시 써야 해서, 코드 규칙(KAN-4)에서 정할 때 맞춘다 | 사용자 (2026-11-24, 제안대로) |
| 15 | 큰 파일 | 3D 모델 · 텍스처 약 13MB 를 Git LFS 없이 그대로. LFS 는 CI · 클론 설정이 늘고, 모델이 자주 바뀌지 않는다 | 사용자 (2026-11-24, 제안대로) |
| 16 | 프론트 테스트가 팀 명세를 읽음 | `docs/api` · `docs/spec`을 직접 읽어 API 111개 · 관심사 · 알림 종류를 대조(유지). 명세가 바뀌면 프론트 CI 가 알려 준다. 백엔드 PR 에서는 이 CI 가 돌지 않아(경로 `frontend/**`) 다음 프론트 PR 에서 드러난다 | 사용자 (2026-11-24, 제안대로) |
| 17 | 리포 바깥 파일 | `.github/workflows/frontend-ci.yml` 새 파일(타입 → 린트 → 테스트 → 배포 빌드 → 실험실 빠짐 검사, 백엔드 CI 와 같은 꼴), `AGENTS.md` 저장소 지도의 `frontend/` 한 줄 | 사용자 (2026-11-24, 제안대로) |
| 18 | 명세와 다르게 둔 것 · 백엔드에 물을 것 | PR 본문에 목록 링크만 두고, 정하는 것은 다음 티켓(관심사 `code` 칼럼, 채팅 메시지 멱등 키, SSE 와 세션 연장 등). 화면 동작은 지금 명세대로 돌아간다 | 사용자 (2026-11-24, 제안대로) |
| 19 | KAN-25(Next.js 프로젝트 초기 설정) | 이 작업에 KAN-25 의 일(App Router · strict TS · ESLint · TanStack Query)이 모두 들어간다. Jira 에 "관련" 링크를 걸었고, 이 PR 이 병합되면 KAN-25 도 닫자고 담당자에게 제안한다 | 사용자 (2026-11-24, 제안대로) |

### 만들 것

| 묶음 | 커밋 | 내용 |
|---|---|---|
| 설정 · 바탕 | 1 ~ 5 | Next 설정(첫 커밋만 빈 루트 레이아웃), 디자인 토큰 · 전역 CSS · Pretendard, 공통 유틸 · 관심사 태그(대분류 12 · 소분류 90) · 목 데이터 |
| 3D | 6 ~ 15 | 그래픽 성능 단계 · 3D 엔진 · 저사양 그리기(가속 꺼진 PC 대응), 두더지(glb · 동작 · 액세서리 41개), 땅굴 방 · 가구 배치 · 우체통, 탐색 들판(구멍 점프 · 줌 3단계 · 울타리), 찻방 |
| API | 16 ~ 33 | 클라이언트(`/api/v1`, 응답 틀 · `ApiError` · 401), 목 서버, 화면 이동 어댑터, 기본 UI 컴포넌트, SSE, 영역 11개(types · real · mock · mappers · queries) + 명세 대조 테스트, 실험실 스위치 |
| 앱 틀 | 34 ~ 35 | 에러 경계 · 없는 주소 · 오프라인 띠, 로그인 영역 틀 · 상단 메뉴 |
| 화면 | 36 ~ 57 | 랜딩 · 로그인 · 회원가입 · 비밀번호 찾기, 온보딩, 내 땅굴 · 방문, 탐색, 채팅, 모임, 게시판, 알림, 설정, 관리자, 실험실 |
| 테스트 · CI · 문서 | 58 ~ 62 | 여러 영역에 걸친 테스트, 화면 스모크 · 실험실 빠짐 검사 스크립트, CI, `frontend/README.md`, `AGENTS.md` 한 줄 |

커밋 62개의 제목 · 담는 것은 프로토타입 리포 `docs/team-import-rehearsal.md`에 표로 있다. 같은 결과를 `tools/team-import/import.mjs`로 다시 만들 수 있다.

### 테스트

| 확인 | 방법 | 기준 |
|---|---|---|
| 커밋마다 | `tsc --noEmit` · `eslint` · `vitest` · `next build` | 62개 모두 통과, 린트 오류 0 |
| 마지막 트리 | 단위 테스트 | 641개 통과 (2 todo) |
| 화면 | `npm run smoke` (헤드리스 크롬, 가속 켬 · 끔) | 화면 105개에서 예외 · 콘솔 에러 · 빈 화면 없음 |
| 실험실 | `npm run check:labs-off` | 배포 빌드에서 실험실 주소 404, 결과물에 실험실 코드 없음 |
| CI | PR 의 `frontend-ci` | 우분투 · Node 24 에서 통과 |
| 충돌 | `git merge-tree --write-tree HEAD origin/dev` | 충돌 없음 (`frontend/` 밖은 CI 파일 · `AGENTS.md` 한 줄뿐) |

## 결과

### 한눈에 보기

화면이 서버 값을 읽고 쓰는 길이다. 응답이 갈리는 곳은 마름모다.

```mermaid
flowchart TD
    A["화면<br/>src/screens/*"] --> B["영역 훅<br/>api/영역/queries.ts (TanStack Query)"]
    B --> C{"이 영역이 실제 서버인가<br/>NEXT_PUBLIC_API_MODE · NEXT_PUBLIC_API_REAL_AREAS"}
    C -- "아니오 (기본)" --> D["목 서버<br/>api/영역/mock.ts<br/>명세와 같은 모양 · code"]
    C -- "예" --> E["api/client.ts<br/>/api/v1 + 세션 쿠키"]
    E --> F{"응답"}
    F -- "2xx" --> G["응답 틀 success · data 를 풀어 data 만"]
    F -- "401" --> H["로그인 화면으로<br/>(NEXT_PUBLIC_LOGIN_FREE=1 이면 무시)"]
    F -- "그 밖의 실패" --> I["ApiError code · fields · detail<br/>문구는 code 로 정함"]
    G --> J["mappers.ts<br/>숫자 id → 문자열, UTC Z → 서울 시각"]
    D --> J
    J --> A
    K["SSE GET /me/event-stream<br/>realtime/events.ts"] -- "새 메시지 · 요청 수 · 알림 수" --> B
```

로그인 영역에 들어갈 때(`screens/start/Guards.tsx` `RequireLogin`)다.

```mermaid
flowchart TD
    A["로그인 영역 주소"] --> B{"NEXT_PUBLIC_LOGIN_FREE=1"}
    B -- "예 (시연)" --> Z["화면"]
    B -- "아니오 (기본)" --> C["GET /api/v1/me"]
    C --> D{"응답"}
    D -- "401" --> E["/login (돌아올 주소 기억)"]
    D -- "nextStep = ONBOARDING" --> F["/onboarding/name"]
    D -- "HOME · NEW_TERM" --> Z
    Z --> G{"NEW_TERM"}
    G -- "예" --> H["새 학기 안내 (닫을 수 없음)"]
```

### 바꾼 것

| 묶음 | 커밋 | 내용 |
|---|---|---|
| 설정 · 바탕 | 1 ~ 5 | `frontend/` Next 설정, 디자인 토큰 · 전역 CSS · Pretendard, 공통 유틸 · 관심사 태그(대분류 12 · 소분류 90) · 목 데이터 |
| 3D | 6 ~ 15 | `src/three/`: 그래픽 성능 단계 · 저사양 그리기, 두더지(glb · 동작 · 액세서리 41개), 땅굴 방 · 가구 배치 · 우체통, 탐색 들판, 찻방 |
| API | 16 ~ 33 | `src/api/`: 클라이언트 · 목 서버 · 영역 11개(types · real · mock · mappers · queries) + 명세 대조 테스트, `src/realtime/` SSE, `src/lib/nav.tsx` 화면 이동 어댑터, 기본 UI 컴포넌트, 실험실 스위치 |
| 앱 틀 | 34 ~ 35 | 에러 경계 · 없는 주소 · 오프라인 띠, 로그인 영역 틀 · 상단 메뉴 |
| 화면 | 36 ~ 57 | `src/app/` 주소와 `src/screens/` 화면: 랜딩 · 인증 · 온보딩 · 내 땅굴 · 방문 · 탐색 · 채팅 · 모임 · 게시판 · 알림 · 설정 · 관리자 · 실험실 |
| 테스트 · CI · 문서 | 58 ~ 62 | 영역을 걸친 테스트, `scripts/smoke.mjs` · `scripts/check-labs-off.mjs`, `.github/workflows/frontend-ci.yml`, `frontend/README.md`, `AGENTS.md` 한 줄 |
| 로컬 리뷰 고침 | 64 ~ 68 | 아래 "확인한 것"의 P1 |
| 최신 명세 | 70 | KAN-58: 푸시 공개 키가 없을 때(`null`) 알림 켜기 안내 |

### 확인한 것

- 커밋 62개 모두 커밋 전에 `tsc --noEmit` · `eslint`(오류 0, 마지막 경고 55) · `vitest` · `next build` 통과, 59번부터 실험실 빠짐 검사 통과. 서명 62개 모두 확인됨(`G`)
- 리뷰 고친 뒤: 타입 · 린트(오류 0, 경고 55) · 단위 테스트 641개(2 todo) · 배포 빌드 · 실험실 빠짐 검사 통과
- 화면 스모크(헤드리스 크롬, 실험실 켠 빌드): 가속 켬 106개 · 가속 끔 106개 모두 OK, 경고 · 실패 0
- PR 전 `dev` 가 `fa73cd7`(KAN-58 병합)로 나아감: 바뀐 명세는 `docs/api/10-settings.md`(`pushPublicKey` 가 `null` 일 수 있음, 공지 제목 100자) · `docs/db/notification.md`. `pushPublicKey` `null` 을 처리하는 커밋을 더했고, 새 명세 문서를 놓고 빌드 · 타입 · 린트 · 테스트 641개 통과
- `git merge-tree --write-tree HEAD origin/dev`(`fa73cd7`): 충돌 없음. `frontend/` 밖은 `.github/workflows/frontend-ci.yml` · `AGENTS.md` 한 줄 · 이 문서
- 로컬 코드 리뷰(영역 넷으로 나눠 `AGENTS.md` Code Review Rules 기준): P0 0건, P1 10건 고침
  1. 방문자 뷰 방명록이 서버의 `canDelete` · `canReport`를 무시하고 목 계정 id 와 비교 → 실제 모드에서 내 글에 "삭제"가 없고 "신고"만 보임 (`GuestbookModal.tsx`)
  2. 프로필 팝업의 "나" 판별이 목 계정 id → 실제 모드에서 내 프로필에 신고 아이콘 (`ProfilePopup.tsx`, `GET /me` 의 `userId` 로)
  3. 모임 화면의 "오늘"이 목 데이터의 고정 날짜(11-03) → 실제 모드에서 날짜 필터 · D-day · 달력이 틀림 (`data/meetupStore.ts` `TODAY`: 실제 모드는 서울 오늘)
  4. 모임 수정에서 정원을 1명까지 줄일 수 있음 → 400 (`MeetupNew.tsx`, 2 ~ 50)
  5. 참여 취소 · 내보내진 사람이 모집 완료 모임을 열면 "다시 신청할 수 없어요" 대신 모집 완료 카드 (`MeetupDetail.tsx` `viewOf`)
  6. 실제 모드에서 보내는 중 · 실패한 내 메시지가 왼쪽(남의 메시지)에 그려짐 (`Chat.tsx`, 내 id · 내 프로필로)
  7. 찻방 · 탐색 · 방문의 내 두더지가 목 값으로 그려짐 (`MyWornSync`: 실제 모드는 `GET /me/burrow` 의 두더지로)
  8. 모임 공지 "지우기"가 확인 없이 바로 지움, 완료 토스트 없음 (00 공통 16 · 17)
  9. 온보딩 중간 단계에 새로 고침 · 주소로 들어오면 빈 값으로 진행되어 확정이 400 (`Onboarding.tsx`, 온보딩 1로)
  10. 재설정 메일 링크 `/password-reset/{token}`(KAN-41)에 맞는 주소가 없어 없는 주소로 감 (`app/(pc)/password-reset/[token]` 추가)
- 리뷰의 "확인 필요"에서 같이 고친 것: 모임 상세 주최자 카드의 "내가 열었어요"가 실제 모드에서 안 나옴(`data.my === 'HOST'` 로)

### 계획과 달라진 점

- 로컬 리뷰 고침을 62개 뒤 커밋으로 더했다(위 10건)
- 재설정 링크 주소를 KAN-41 명세(`/password-reset/{token}`)에 맞췄다. 프로토타입 때 질문(백엔드 질문 02-4)으로 올렸던 것인데 명세에서 이미 정해졌다
- 화면 스모크 화면이 105 → 106개(재설정 링크 주소 하나 늘어남)
- PR 전에 `dev` 에 들어온 KAN-58 명세(`pushPublicKey` 가 `null`)에 맞추는 커밋을 더했다

### 남은 일

- 실제 백엔드 연결 확인(다음 티켓, 영역별): `NEXT_PUBLIC_API_REAL_AREAS` 에 백엔드가 만든 영역부터. 채팅을 켤 때는 실시간 소식 `events` 도 같이 켜야 새 메시지가 온다
- 리뷰의 "확인 필요"(고치지 않음, 실제 서버로 볼 때 확인):
  - 온보딩 확정 직후 옛 `GET /me` 캐시 때문에 온보딩 1로 다시 튈 수 있음(`api/onboarding/queries.ts` `invalidateQueries` 를 기다리지 않음)
  - 내 땅굴 · 온보딩 미리보기의 방 색 씨앗이 목 id `'me'` → 실제 모드에서 내가 보는 내 방과 남이 보는 내 방의 색 · 무늬가 다름
  - 재설정 메일 보냄 화면에 state 없이 들어오면 예시 이메일이 채워짐(`Auth.tsx` `PasswordResetSent`)
  - 방문자가 자기 방명록 글을 지울 때 결과를 기다리지 않고 완료 토스트, 입력칸 글자 수가 UTF-16 단위(서버는 코드 포인트, 더 엄격한 쪽)
  - 공지 고치기 "취소"에 "아직 저장되지 않았습니다" 모달이 없음(00 공통 18 범위 확인)
  - 모임 수정에서 다음 날 끝나는 모임(다른 경로로 만든 것)은 끝나는 시간을 비워야 저장됨
  - 글꼴 `Do Hyeon` 은 `src/app/layout.tsx` 가 Google Fonts 에서 받음(인터넷이 끊기면 기본 글꼴)
- 명세와 다르게 둔 것 · 백엔드 질문: 프로토타입 리포 `docs/backend/api-v1/feature-changes.md` · `questions-for-backend.md`
- KAN-25(Next.js 프로젝트 초기 설정): 이 작업에 다 들어갔으니 닫을지 담당자와 정하기

### 검토 순서

1. 이 문서, `frontend/README.md`(실행 · 환경 변수), `.github/workflows/frontend-ci.yml`
2. `src/api/client.ts` · `src/api/config.ts`(응답 틀 · 에러 · 실제/목 전환) → 영역 하나(`src/api/auth/`)의 types · real · mappers · mock · queries
3. `src/screens/start/Guards.tsx`(로그인 검사) · `src/components/AppShell.tsx`
4. 관심 있는 화면 하나씩(`src/app/` 주소 → `src/screens/`)
5. `src/tests/`(명세 대조 테스트 `api-v1-endpoints.test.ts` 부터)
6. 3D(`src/three/`)는 마지막. 화면 동작과 서버 값에는 영향이 없다

