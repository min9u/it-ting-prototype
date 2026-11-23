# 팀 리포 옮기기: 팀과 정할 것 · 내가 정할 것 · Jira 전에 한 일 (2026-11-23)

- 요청: "팀과 합의를 논의를 해봐야할 것과, 내가 확정할 수 있는 것들을 나눠서 알려줘. 그리고 지금 지라 MCP 권한이 승인되지 않았는데, 이게 되기 전에 너가 작업할 수 있는 것들을 알려주고 지금 다 진행해줘"
- 앞선 결정(같은 날): Jira 는 **새 티켓**, 팀 리포 쓰기 권한 있음, 안 쓰는 파일 지움(`8c795d3`)
- 순서 확인: Jira 카드는 계획서 승인과 상관없이 먼저 만든다(번호가 계획서 파일 이름 · 브랜치 이름에 들어감). 승인은 **팀 리포에 코드를 올리기 전**에 받는다(팀 `AGENTS.md`, 스킬 `work-plan`)

## 사용자가 정한 것 (2026-11-23)

| # | 무엇 | 정한 답 |
|---|---|---|
| 1 | 로그인 검사 | 환경 변수 `NEXT_PUBLIC_LOGIN_FREE`. **기본은 명세대로 검사**, `1`이면 시연용으로 모두 열림. 프로토타입 공유 빌드(`app/`)는 그대로 열림 |
| 2 | PR 수 | 하나 (본문에 커밋 묶음 표) |
| 3 | 실제 백엔드 연결 확인 | 다음 티켓(영역별) |
| 4 | 한 파일에 여러 화면이 든 곳 | 나누지 않음 (주소만 여는 커밋 4개는 본문에 까닭) |

## 팀과 정할 것 (계획서 "이번에 정할 것"에 제안과 함께)

| # | 무엇 | 제안 |
|---|---|---|
| A | Next.js 16.4.6 · npm · Node 24.18 (KAN-25 와 맞는지) | 그대로 |
| B | 프론트 린트 (코드 규칙 KAN-4 전) | Next 기본 + React Compiler 규칙은 경고(55개), CI 는 오류만 막음 |
| C | 3D 모델 · 텍스처 약 13MB 를 Git LFS 없이 | 그대로 |
| D | 프론트 테스트가 팀 `docs/api` · `docs/spec`을 직접 읽음 (명세가 바뀌면 프론트 CI 실패) | 유지 |
| E | 리포 바깥 파일: `.github/workflows/frontend-ci.yml`, `AGENTS.md` 한 줄 | 넣음 |
| F | 명세에 맞추며 바뀐 기능 목록 확인 (기획) | [feature-changes.md](backend/api-v1/feature-changes.md) 링크를 PR 에 |
| G | 백엔드 질문 답 (관심사 `code` 칼럼, 채팅 멱등 키, SSE 와 세션 연장 등) | [questions-for-backend.md](backend/api-v1/questions-for-backend.md) 를 팀에 보냄 |
| H | 명세 문구 수정 요청 (06 채팅 "대표 관심사", 05 탐색 안내판 → 방노트 사이드바 등) | 기획에 요청 |
| I | 62개 커밋 PR 리뷰어 | 팀이 정함 |

## Jira 전에 한 일

| 일 | 결과 |
|---|---|
| 팀 명세 최신본 반영 (`35d107a` → `61e6c10`, KAN-45 · KAN-51 · KAN-54 "구현하며 정한 것") | 사본 `docs/backend/team-spec/` 갱신. `frontend/`: 글자 수를 코드 포인트로(이모지 한 자), 자기소개 앞뒤 공백 · `null`, 방명록 `page` · `size` 범위, 검색어 앞뒤 공백. 시험 `spec-61e6c10.test.ts` → [feature-changes.md](backend/api-v1/feature-changes.md) |
| 로그인 검사 환경 변수 | `lib/env.ts` `loginFree`, `data/auth.ts` `LOGIN_FREE = ENV.loginFree`, `.env.example` · `README.md` |
| 팀 리뷰 기준으로 미리 본 것 | 비밀값 · `.env` 파일 없음(`.env.example`만), 로그에 개인 정보 없음(`console.info` 6곳은 3D 성능 · 인증 상태), 단언 없는 테스트 · `skip` · `only` 없음. 로그인 검사가 꺼져 있던 것(명세와 다른 동작, P1 후보)은 위 1번으로 고침 |
| 커밋 계획 | `plan.json` 에 새 테스트 배정, `--dry-run` 통과 (파일 586개 · 커밋 62개) |
| 계획서 초안 | [`tools/team-import/team/work-plan-draft.md`](../tools/team-import/team/work-plan-draft.md). 번호만 넣으면 팀 리포 `docs/work/KAN-<번호>.md` |
| 최신 `dev` 위 재연습 | 아래 "재연습" |

## 재연습 (최신 `origin/dev` `61e6c10` 위)

<채우는 중>

## Jira 카드 초안 (로그인되면 그대로 만듦)

- 프로젝트 KAN, 유형 작업(Task)
- 제목: `프론트엔드 프로토타입 이전 (Next.js)`
- 설명: 프로토타입 리포(min9u/it-ting-prototype)의 웹 프론트엔드(Next.js 16.4 App Router)를 팀 리포 `frontend/`에 커밋 62개 · PR 하나로 넣는다. 서비스 · API 명세(dev `61e6c10`, API 111개)에 맞춘 화면 48개 주소, 3D 땅굴 · 탐색 들판, 목 서버, SSE. 처음엔 모든 영역 목 서버, 실제 백엔드 연결은 다음 티켓(영역별). 완료 기준: 커밋마다 tsc · 린트 오류 0 · 테스트 · 빌드 통과, 화면 스모크 105개, 실험실 빠짐 검사, `frontend-ci` 통과, 계획서 `docs/work/KAN-<번호>.md` 승인
- 브랜치: `chore/fe/KAN-<번호>-frontend-import`

## 다음

1. Atlassian 로그인 → Jira 새 티켓("프론트엔드 프로토타입 이전 (Next.js)") → 번호
2. 계획서 초안에 번호 → 팀 리포 `docs/work/KAN-<번호>.md` 로 복사(커밋하지 않음) → 사용자 승인 ("이번에 정할 것" A ~ I 를 팀과 정했거나 제안대로 가도 되는지)
3. `node tools/team-import/import.mjs --target ~/Workspace/it-ting --branch chore/fe/KAN-<번호>-frontend-import` → 계획서 커밋(`docs: 프론트엔드 이전 작업 계획서 추가`) → `merge-tree` → `code-review` → `pr-create`
