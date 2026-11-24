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
| J | KAN-25(Next.js 초기 설정, 담당 JunHwan Choi)를 KAN-64 와 함께 닫을지 | KAN-64 에 다 들어가므로 닫자고 제안 (2026-11-24 "관련" 링크만 걸어 둠) |

## Jira 전에 한 일

| 일 | 결과 |
|---|---|
| 팀 명세 최신본 반영 (`35d107a` → `61e6c10`, KAN-45 · KAN-51 · KAN-54 "구현하며 정한 것") | 사본 `docs/backend/team-spec/` 갱신. `frontend/`: 글자 수를 코드 포인트로(이모지 한 자), 자기소개 앞뒤 공백 · `null`, 방명록 `page` · `size` 범위, 검색어 앞뒤 공백. 시험 `spec-61e6c10.test.ts` → [feature-changes.md](backend/api-v1/feature-changes.md) |
| 로그인 검사 환경 변수 | `lib/env.ts` `loginFree`, `data/auth.ts` `LOGIN_FREE = ENV.loginFree`, `.env.example` · `README.md` |
| 팀 리뷰 기준으로 미리 본 것 | 비밀값 · `.env` 파일 없음(`.env.example`만), 로그에 개인 정보 없음(`console.info` 6곳은 3D 성능 · 인증 상태), 단언 없는 테스트 · `skip` · `only` 없음. 로그인 검사가 꺼져 있던 것(명세와 다른 동작, P1 후보)은 위 1번으로 고침 |
| 커밋 계획 | `plan.json` 에 새 테스트 배정, `--dry-run` 통과 (파일 586개 · 커밋 62개) |
| 계획서 초안 | [`tools/team-import/team/work-plan-draft.md`](../tools/team-import/team/work-plan-draft.md). 번호(KAN-64)를 넣음. 팀 리포 `docs/work/KAN-64.md` 로 복사할 것 |
| 최신 `dev` 위 재연습 | 아래 "재연습" |

## 재연습 (최신 `origin/dev` `61e6c10` 위)

- 임시 클론(팀 리포 `dev` `61e6c10`)의 `chore/fe/KAN-0-frontend-import` 에서 **커밋 62개 모두** 커밋 전에 tsc · 린트(오류 0, 경고 0 → 55) · 단위 테스트(마지막 47파일 641개) · 배포 빌드 통과, 59번부터 실험실 빠짐 검사도 통과. 서명 62개 모두 `G`, 제목 62개 모두 팀 정규식 통과
- `git merge-tree --write-tree HEAD origin/dev` 충돌 0. `frontend/` 밖 변경은 `.github/workflows/frontend-ci.yml`(새 파일) · `AGENTS.md` 1줄뿐
- 마지막 `frontend/` 는 이 리포와 같음 (README 의 프로토타입 리포 링크 3곳만 다르고, `big_model_sizes_v3_8.json` 은 팀 `.gitattributes` 로 LF)
- **처음 두 번은 45번에서 멈춤**: 테스트가 아니라 vitest 작업자가 제때 안 뜬 시간 초과(`Timeout waiting for worker to respond`). 맥이 배터리로 돌며 절전 ↔ 잠깐 깨기를 되풀이해 43 · 44번이 커밋당 15 ~ 17분(평소 25 ~ 40초)이 걸렸음. 같은 45번 트리에서 직접 돌리면 530개 통과. 다시 이어서(`--from 45`) 끝까지 통과. **실제로 옮길 때는 전원을 연결하고 덮개를 열어 둘 것** (`caffeinate` 로는 덮개 닫힘 절전을 못 막음)
- 이 과정에서 팀용 README 사본(`tools/team-import/team/README.md`)이 옛 내용이던 것을 발견해 지금 README 로 다시 만듦 (로그인 검사 줄 · 생성 파일 설명 정리)

## Jira 카드 (2026-11-24 만듦): [KAN-64](https://it-ting.atlassian.net/browse/KAN-64)

- 요청: "atlassian mcp 연결했어. 카드를 어떻게 만들건지 설명해줘" → 설명 뒤 "A 안으로 해줘"
- 팀 카드 형식을 따름(최근 카드 30개 · KAN-58 · KAN-25 확인): 유형 Task · 우선순위 Medium · 제목 머리말 `[FE]` · 라벨 `fe` · 담당자 본인 · 상위 항목 · 스프린트 없음
- 제목: `[FE] 프론트엔드 프로토타입 이전 (Next.js)`
- 설명(팀 순서): 목적 / 작업 내용(화면 48개 주소 · 3D · 목 서버 · SSE · 커밋 62개 PR 하나 · `frontend/` 밖은 CI 파일 · `AGENTS.md` 한 줄) / KAN-25 와의 관계 / 시작 조건(없음, 명세가 `61e6c10` 뒤 바뀌면 PR 전에 다시 맞춤) / 작업 방법(`work-plan` 계획서 → 승인, 브랜치 `chore/fe/KAN-64-frontend-import`) / 완료 기준(커밋마다 tsc · 린트 오류 0 · 테스트 · 빌드, 스모크 105 · 실험실 빠짐 검사, `frontend-ci`, 리뷰 P0 · P1) / 범위 제외(실제 백엔드 연결 · 배포 · KAN-4)
- **KAN-25 와 겹침**: KAN-25 "Next.js 프로젝트 초기 설정"(담당 JunHwan Choi, 해야 할 일)의 일(App Router · strict TS · ESLint · TanStack Query)이 이 이전에 모두 들어감. 팀 `AGENTS.md` 도 "`frontend/`는 KAN-25에서 추가"라고 적혀 있음. 사용자 결정 **A**: KAN-64 ↔ KAN-25 "관련(Relates)" 링크만 걸고, KAN-25 는 건드리지 않음. 닫을지는 담당자와 이야기해서 정함 (팀과 정할 것에 추가)

## 다음

1. ~~Atlassian 로그인 → Jira 새 티켓 → 번호~~ 끝남: KAN-64
2. ~~계획서 → 팀 리포 `docs/work/KAN-64.md` 복사 · 승인~~ 끝남(2026-11-24): 사용자 "계획서 복사해줘, 제안대로 가자" → "이번에 정할 것" A ~ F 와 KAN-25(J)를 제안대로 "정한 것" 13 ~ 19 로 옮김. 팀 리포 `dev` 작업 폴더에 커밋 안 한 파일로 있음. **`import.mjs` 는 팀 리포가 깨끗해야 돌므로 실행 전에 이 파일을 잠시 빼 두고, 62개 커밋 뒤 다시 넣어 `docs: 프론트엔드 이전 작업 계획서 추가`로 커밋**
3. `node tools/team-import/import.mjs --target ~/Workspace/it-ting --branch chore/fe/KAN-64-frontend-import` → 계획서 커밋(`docs: 프론트엔드 이전 작업 계획서 추가`) → `merge-tree` → `code-review` → `pr-create`

## 실제 옮기기 (2026-11-24)
- 사용자 "진행해줘". 팀 리포 `dev` `61e6c10` 에서 `chore/fe/KAN-64-frontend-import` 브랜치, `import.mjs` 로 **커밋 62개 · 20분**, 모두 서명 `G` · 커밋마다 tsc · 린트 오류 0(마지막 경고 55) · 테스트(마지막 47파일 641개) · 빌드 통과, 59번부터 실험실 빠짐 검사 통과. 처음엔 배터리라 `caffeinate -i`, 10번쯤부터 전원 연결 → 연습 때 멈췄던 45번도 그대로 지나감
- 마지막 `frontend/` 는 이 리포와 같음(README 상대 링크만 의도한 차이). 이어서 계획서 커밋 `fac94d7`(`docs: 프론트엔드 이전 작업 계획서 추가`), `merge-tree` 충돌 0, `frontend/` 밖은 `frontend-ci.yml` · `AGENTS.md` 한 줄 · `docs/work/KAN-64.md`
- 푸시 안 함. 다음: 팀 스킬 `code-review` → P0 · P1 → 계획서 "결과" → 푸시 · `pr-create` (사용자 확인)

## 리뷰 · PR (2026-11-24)
- 사용자 "1·2번 진행해줘"(로컬 리뷰 · 결과 채우기) → "1,2번 모두 이어서 해줘"(커밋 · 푸시 · PR)
- 로컬 리뷰: 팀 `AGENTS.md` Code Review Rules 기준, 영역 넷(인증·설정 / 땅굴·탐색 / 채팅·알림 / 모임·게시판)으로 나눠 봄. 도중에 네트워크가 끊겨 둘은 이어서 다시 돌림. **P0 0 · P1 10 고침** (목록은 팀 리포 `docs/work/KAN-64.md` "확인한 것"). 1·2·6·7 은 원인이 같음: 목 계정 id `'me'`(`ME_ID`)나 목 데이터 날짜(`TODAY`)로 "나"·"오늘"을 정해서 목 모드에서는 맞고 실제 모드에서만 틀림 → 목 서버 테스트로는 안 잡힘. 다음 영역 연결 때도 `ME_ID` · `TODAY` · `getMyWorn` 을 먼저 볼 것
- 재설정 메일 링크는 KAN-41 명세(`/password-reset/{token}`)로 이미 정해져 있어(백엔드 질문 02-4 답) `app/(pc)/password-reset/[token]` 을 더함
- PR 직전 `dev` 가 `fa73cd7`(KAN-58 설정 ①)로 나아감 → `pushPublicKey` 가 `null` 일 수 있게 맞춤, 명세 사본 `docs/backend/team-spec/` 갱신
- 고친 것은 이 리포 `frontend/` 와 팀 브랜치에 똑같이(`frontend/src` 같음). 팀 브랜치 커밋 71개(이전 62 + 계획서 + 리뷰 고침 5 + 결과 + 최신 명세 1 + 결과 보탬), 모두 서명 `G` · 커밋마다 빌드 · 타입 · 린트 오류 0 · 테스트 641. 스모크 가속 켬 · 끔 106/106
- **PR [#37](https://github.com/it-ting-team/it-ting/pull/37)** `chore: KAN-64 프론트엔드 프로토타입 이전 (Next.js)` → `dev`. 병합은 사람이. 다음: CI · Codex 리뷰 확인, Jira KAN-64 상태
- 스모크에서 드러난 것: 글꼴 `Do Hyeon` 은 `src/app/layout.tsx` 가 Google Fonts 에서 받음(인터넷이 끊기면 기본 글꼴. 계획서 "남은 일")
- **Codex 리뷰**: PR 을 연 뒤 33분 넘게 오지 않아(앞 PR 들은 2 ~ 7분, 이번은 파일 590개) 사용자 요청으로 `@codex review` 직접 요청 → 10분 만에 P0 1 · P1 1. ① P0 같은 탭에서 세션이 끝난 뒤 다른 계정으로 로그인하면 이전 계정 캐시(내 땅굴 · 계정 · 대화 목록)가 보임 → 401 · 로그인 성공 때 계정마다 다른 캐시를 모두 버림(`lib/authFlow.ts` `dropUserData`, `useSessionReset`, 테스트 `auth-cache.test.ts`) ② P1 온보딩 확정 뒤 `GET /me` 를 기다리지 않음(우리 리뷰의 "확인 필요"였음) → 기다린 뒤 이동. 팀 브랜치 커밋 74개, 다시 `@codex review` 요청
- **Codex 재리뷰(`8ffdfb2`)**: 새 P0 1 · P1 1. ① P0 보내지 못한 채팅 메시지(`api/chat/outbox`, 탭 메모리)가 로그아웃 뒤에도 남음 → 로그아웃 · 401 · 로그인 성공 때 비우고 세대 번호로 늦은 전송 결과를 버림 ② P1 댓글을 다 받기 전에 쓰면 등록순이 깨짐(우리 리뷰 "확인 필요"였음) → 남은 페이지를 받은 뒤 맨 끝에(`appendTopComment`). 테스트 647. `lib/authFlow` 가 `api/chat/outbox` 를 쓰게 돼 커밋 계획에서 `outbox.ts` 를 화면 이동 어댑터 커밋으로 앞당김(커밋마다 빌드 유지). 팀 브랜치 커밋 77개, 다시 `@codex review`
- 교훈: Codex 지적 4건 중 2건은 우리 로컬 리뷰의 "확인 필요"였음 → "확인 필요"도 재현 경로가 분명하면 PR 전에 고칠 것. 계정 전환은 서버 캐시만이 아니라 탭 메모리 저장소(outbox 등)까지 볼 것
- **Codex 세 번째 리뷰(`92aa648`)**: 새 P1 1 — 받아 둔 글을 다시 불러와 404(지워짐 · 가려짐)를 받아도 이전 본문이 보임 → `QueryGate` 가 404 · 410 을 이전 값보다 먼저(일시적 실패만 이전 값 유지), 테스트 `query-gate.test.ts`(vitest 는 `.test.ts` 만 읽어 JSX 대신 createElement). 테스트 650 · 스모크(게시판 · 모임 · 땅굴) 통과. 팀 브랜치 커밋 79개, 다시 `@codex review`
- **Codex 네 번째 리뷰(`54a4e5d`)**: 새 P0 1 — 쓰기를 보낸 뒤 응답 전에 계정이 바뀌면 늦게 끝난 요청의 되돌리기 · 성공 처리가 이전 계정 데이터를 새 계정 캐시에 넣음 → 세션 번호(`api/queryClient` `sessionGeneration`, 계정이 바뀔 때 `newSession`) + 쓰기 훅을 모두 `useSessionMutation`(`api/sessionMutation.ts`, 번호가 바뀌었으면 끝난 뒤 처리를 건너뜀, `api/auth` 만 예외). 테스트 `session-mutation.test.ts`(쓰기 훅이 모두 이걸 쓰는지도). 테스트 653. 팀 브랜치 커밋 81개
- 그 사이 `dev` 가 `74f54b2`(KAN-52 커뮤니티 ②)로: `docs/api/08-community.md` 만 바뀜(가려진 글의 댓글: 수정 409 · 좋아요 404, 알림 제목). 프론트는 두 code 를 이미 처리, 새 명세로 테스트 653 통과. `COMMENT_EDIT_NOT_ALLOWED` 문구만 "가려진 글의 댓글"까지 넓히기로(다음 커밋에)
- **Codex 다섯 번째 리뷰(`bd9e758`)**: 새 P1 2 — ① 글을 지운 뒤 뒤로 가기로 돌아오면 지운 글이 보임 → 상세 · 댓글을 만료만(`refetchType: 'none'`) ② 이미 내 땅굴에 있을 때 방명록 알림을 눌러도 안 열림 → 주소 `modal` 이 바뀌면 열고 닫을 때 지움(effect 대신 렌더 중 비교, 린트 경고 55 유지). KAN-52 문구 맞춤 커밋과 함께 팀 브랜치 커밋 85개, 테스트 654. 명세 사본 `74f54b2` 로 갱신
- **Codex 여섯 번째 리뷰(`5f79cae`)**: 새 P1 1 — 알림 설정 저장 중 다른 스위치를 누르면 앞 요청의 되돌리기가 뒤 변경을 덮어씀 → 저장하는 동안 스위치 잠금 + 끝나면 설정 다시 받기. 테스트 656. 팀 브랜치 커밋 87개
- **Codex 일곱 번째 리뷰(`7ccddf0`)**: 새 P1 1 — 댓글 좋아요 실패 시 요청 전 목록으로 되돌려 그 사이 지운 댓글이 다시 보임. 여섯 번째(알림 설정)와 같은 종류라 공통 부품 `useOptimistic` 에서 고침: 실패해 되돌린 뒤 바꿨던 캐시를 항상 다시 받음. 테스트 657. 팀 브랜치 커밋 89개
- 흐름: 일곱 번 동안 P0 4 · P1 7. 리뷰마다 다른 곳을 1 ~ 2건씩 짚음(큰 PR 을 나눠 읽는 듯). 같은 종류는 공통 부품에서 한 번에 고치는 쪽으로

