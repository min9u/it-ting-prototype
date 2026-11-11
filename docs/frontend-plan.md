# 디굴디굴 프론트엔드 개발 계획

- 날짜: 2026-11-10
- 요청: Figma "03. Screens" 페이지를 기준으로 새 프론트엔드 개발 계획을 세우고, Vite + React + TypeScript 앱(`app/`)으로 만들기 시작한다. 백엔드 없이 목 데이터만 쓴다.
- 자료: Figma MCP 호출 한도가 차서 직접 조회는 못 했고, 아래 파일만 썼다.
  - `design/figma/screens-metadata.xml`: 03. Screens 페이지 전체 노드 트리 (프레임·텍스트 이름, 좌표, 크기)
  - `design/figma/burrow-my-room.png`: 땅굴 메인 – 내 땅굴 스크린샷 (유일한 앱 화면 스크린샷)
  - `design/figma/landing-03-room.png`: 랜딩 03 (스크롤 60%) 스크린샷
  - `design/figma/room-cutout.png`: 방 렌더 (636×477, 배경 #f5f5f5)
- 예전 시안(`legacy/`)은 참고만 하고 손대지 않는다.

## 결론 요약

1. 화면은 6묶음 약 45장(변형 포함). 데스크톱 1440 기준, 헤더 64px(시작하기·온보딩은 61px 헤더 + 55px 진행 단계 바).
2. 앱 구조: `app/` 아래 Vite + React 19 + TypeScript + react-router 7. 스타일은 `src/styles/tokens.css`(CSS 변수) + 화면별 CSS Modules. UI 라이브러리 없음.
3. 3D 방은 `<RoomView>` 컴포넌트 뒤에 숨긴다. 지금은 `room-cutout.png`(배경을 투명하게 따낸 것)를 보여 주고, 나중에 three.js 씬(`explore/3d/`에서 따로 시험 중)으로 바꾼다.
4. 이번 실행에서 **땅굴 메인 – 내 땅굴**은 스크린샷과 맞춰 완성하고, 나머지 화면은 메타데이터(배치·문구)만 보고 만들었다. 그 화면들은 아래 표에 "메타데이터 기반 — 스크린샷 대조 필요"로 표시했다.

## 디자인 토큰 (스크린샷에서 픽셀 추출)

| 토큰 | 값 | 어디서 |
|---|---|---|
| `--bg-cream` | `#fbf4ec` | 헤더 배경 |
| `--bg-scene` | `#d3b690` | 3D 방 뒤 땅 색 |
| `--line-header` | `#e8d3bf` | 헤더 아래 선 |
| `--surface` | `#fbf8f4` | 오른쪽 "내 정보" 카드 |
| `--surface-sunken` | `#f4e6d8` | 자기소개 박스 |
| `--surface-item` | `#f8ede2` | 방명록 아이템 |
| `--brown-700` | `#6b4a3a` | 활성 Nav Pill, 토글 활성 (`#735343`) |
| `--ink-900` | `#3e2a1f` | 제목·닉네임 |
| `--ink-700` | `#5c4334` | 비활성 메뉴, 아이콘 |
| `--ink-500` | `#6e5444` / `#a39186` | 보조 문구 |
| `--accent` | `#9a4a2c` | "접기 ›", "전체 보기", 방명록 개수 배지 |
| `--alert` | `#d9573a` 근처 | 알림 점 |
| `--green` | `#5e8a3a` | 방문자 접속 점 |
| 버튼 "땅굴 꾸미기" | 배경 `#f7e6c8`, 글자·테두리 `#744a32` | |
| 버튼 "방문자" | 배경 `#e8f0e1`, 숫자 배지 `#fbf8f3` / `#526b3f` | |

관심사 칩 (Interest Chip, 52×26, 반경 6px): 배경 / 글자

| Tone | 배경 | 글자 | 스크린샷 예 |
|---|---|---|---|
| Sage | `#dde7cc` | `#3f5a24` | 캠핑 |
| Sky | `#d9e6ec` | `#2f5868` | 게임, 여행 |
| Butter | `#f3e6be` | `#6b5410` | 독서, 요리 |
| Lilac | `#e6ddeb` | `#5b4370` | 음악 |
| Rose | `#f2d9d9` | `#7d3a3f` | 피아노 |
| Clay | `#f1dccb` | `#7e3b22` | 그림 |
| Mint | `#d5e8df` | `#2e5e4c` | 사진 |
| Sand | `#eadfc6` | `#5e4a1e` | 운동 |

### 서체
- 제목·버튼·메뉴: 메타데이터에 `Label · Do Hyeon`, `Icon + Do Hyeon label` 레이어가 있어 **Do Hyeon**(Google Fonts)으로 정했다. 스크린샷의 굵고 각진 한글과도 맞는다.
- 본문: **Pretendard** (jsDelivr CDN). 스크린샷의 "SSAFY 16기 · 지역 · 0반" 같은 본문과 비슷하다.
- TODO: 디자이너에게 실제 서체 이름 확인 (본문이 Pretendard인지, 숫자 서체가 따로 있는지).

## 화면 목록

상태: ✅ 완성(스크린샷 대조함) · 🟡 메타데이터 기반 — 스크린샷 대조 필요 · ⬜ 아직 안 만듦

### 1. 시작하기 v2 (모델링·모션 기준)
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 랜딩 01 땅 위 (0%) → 02 구멍 속으로 (30%) → 03 방 (60%) → 04 이웃 (85–100%) | 408:19697, 19721, 19384, 19542 | `/` | 🟡 (03은 스크린샷 있음) |
| 스크롤 모션 타임라인 (명세) | 408:19694 | — | 명세로만 반영 |
| 둘러보기 · 땅 (비로그인) | 408:19989 | `/look` | 🟡 |
| 4번째 방 · 로그인 필요 | 408:20104 | `/look` 안 모달 | 🟡 |
| 로그인 | 408:20248 | `/login` | 🟡 |
| 회원가입 1 · 이메일 / 2 · 비밀번호 | 408:20403, 20564 | `/signup`, `/signup/password` | 🟡 |
| 비밀번호 찾기 | 504:5382 | `/password-reset` | 🟡 |

랜딩 모션 명세 (408:19694): 3D 씬은 화면에 고정(sticky), 스크롤 진행도로 카메라만 움직임. 카피는 구간 진입 때 아래→위 16px + 페이드. 가구 라벨은 0.08s 간격. 대기 루프 3초(두더지 숨쉬기·깜빡임). 모션 줄이기 설정이면 4장 정지 이미지 크로스페이드 0.3s. 모바일은 세로 영상(9:16) 1개를 스크롤에 맞춰 재생.

메모(408:22172, 시작하기 수정 사항): 캐치프레이즈 후보 "요즘 싸피 사람들은 뭐에 빠져있을까요? 그들만의 땅굴을 몰래 살펴볼까요?", 4번 페이지를 첫 번째로, "먼저 둘러보기"를 왼쪽에, 비밀번호는 입력 0.5초 뒤 형식 검사·즉시 오류 문구, 약관 전문 보기 여부.

### 2. 설정(계정 설정) / 온보딩
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 온보딩 1 나를 부르는 이름 | 408:18310 | `/onboarding/name` | 🟡 |
| 온보딩 2 (개선) 관심 분야 고르기 | 408:18482, 510:13845, 524:14752 | `/onboarding/interests` | 🟡 |
| 온보딩 2 분야 팝업 · 음악 | 408:18656 | 같은 경로 안 모달 | 🟡 |
| 온보딩 개선 A(좌측 분류 전환) / B(아코디언) | 408:22173, 22310 | — | 시안 비교용. A안 구조를 팝업 안에 일부 반영 |
| 온보딩 3 자기소개 | 408:18828 | `/onboarding/intro` | 🟡 |
| 온보딩 3a 방 만드는 중 | 408:19036 | `/onboarding/building` | 🟡 |
| 온보딩 3b 가구 매칭 완료 | 408:21319 | 같은 경로, 끝나면 전환 | 🟡 |
| 온보딩 3c 땅굴 미리보기 | 408:19306 | `/onboarding/preview` | 🟡 |

진행 단계 바: 나를 부르는 이름 → 내 관심사 선택 → 자기소개 → 방 만들기. 관심사는 최소 3개, 태그 옆 숫자는 같은 취향을 고른 사람 수, 자유 입력 150자.
메모: "온보딩 과정 (계정 설정) — 디자인 수정 필요". 많은 텍스트 노드 이름이 `Subtitle`, `Lead`, `Hint` 같은 자리표시라 문구는 지어 넣었다.

### 3. 땅굴
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 땅굴 메인 – 내 땅굴 (Full-bleed) | 454:6900 (방명록 0개 506:7960) | `/burrow` | ✅ |
| 내 땅굴 – 사이드바 접힘 | 454:7053 | `/burrow` (접기 상태) | ✅ |
| 방명록 전체보기 모달 | 454:7748 | `/burrow` 안 모달 | ✅ |
| 탐색하기 – 돌아다니는 화면 (+ 사이드바 접힘) | 477:12524, 493:12616 | `/burrow/explore` | 🟡 |
| 방문자 뷰 (예린이의 땅굴) 4변형 | 495:13840, 495:13713, 510:13663, 510:13152 | `/burrow/:userId` | 🟡 |
| 방문자 뷰 · 대화 요청 팝업 | 495:13898 | `/burrow/:userId` 안 모달 | 🟡 |

방명록 규칙 (주석 454:7052, 454:7116, 506:12603):
- 사이드 카드는 최근 3개만, "전체 보기"로 모달
- 0개면 "전체 보기" 없이 안내 문구만: "작성된 방명록이 없어요. 돌아다니며 먼저 방명록을 남겨보세요. 다른 두더지가 찾아올지도 몰라요."
- 6개부터 페이징, 한 페이지 최대 5개
- 페이지가 6쪽 이상이면 한 칸씩 이동 버튼 + 맨 끝으로 가는 버튼 (페이지 번호는 5개씩 보임)
- 7일 지나면 자동 삭제 (목 데이터에서는 7일 지난 글을 걸러서 흉내)
- 모달의 각 줄에 "삭제 | 신고"
- 미정: 프로필 사진을 누르면 그 사람 땅굴로 가는지

### 4. 커뮤니티 (게시판)
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 게시판 목록 | 494:12708 | `/board` | 🟡 |
| 글 상세 A안 (예진, 서연) | 494:13028 | `/board/:postId` | 🟡 (A안으로 구현) |
| 글 상세 B안 (민구) | 494:13242 | `/board/:postId?v=b` | 🟡 (이전/다음 글 위치만 다름) |

메모: "게시판 — 필요: 글쓰기 페이지, 저장한 글 모아보는 페이지" → 아직 디자인 없음. "게시글 댓글창 투표 해주세요(왼 오)" → A/B 결정 필요.

### 5. 모임
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 모임 리스트 | 494:13691 | `/meetups` | 🟡 |
| 모임 – 캘린더 팝업 | 544:6128 | `/meetups` 안 모달 | 🟡 |
| 내 모임 (다가오는 모임 / 카드 + 액션형) | 500:15371, 546:7282 | `/meetups/me` | 🟡 |
| 내 모임 · 캘린더 팝업 | 544:7132 | `/meetups/me` 안 모달 | 🟡 |
| 모임 상세 / 채팅 수정안 / 채팅·신청 팝업형 | 408:13129, 494:13857, 408:12564 | `/meetups/:id` | 🟡 (채팅 수정안 구조) |
| 모임 상세 – 참여 신청 팝업 | 544:7521 | `/meetups/:id` 안 모달 | 🟡 |
| 모임 만들기 | 408:13607 | `/meetups/new` | 🟡 |
| 모임 생성 완료 팝업 | 408:14074 | `/meetups/new` 안 모달 | 🟡 |

모션 명세 (408:11786 "모임 ↔ 내 모임"): 헤더·오른쪽 사이드는 고정, 왼쪽 박스만 24px 밀리며 교체. 나감 0–160ms ease-in, 들어옴 80–320ms ease-out, 사이드 크로스페이드 0–200ms. 주소 `/meetups` ↔ `/meetups/me`. 돌아오면 필터·페이지·스크롤 복원. 내 모임 첫 탭은 "다가오는 모임".
메모: "모임 상세 화면 아직 미정", "모임 확정 멘트 수정 필요", "모임 — 디자인 갈아끼우는 중".

### 6. 채팅
| 화면 | Figma 노드 | 경로 | 상태 |
|---|---|---|---|
| 대화 선택 전 | 408:16219 | `/chat` | 🟡 |
| 대화 요청 대기 중 | 408:15921 | `/chat/:roomId` (pending) | 🟡 |
| 1대1 대화 | 408:16412 | `/chat/:roomId` | 🟡 |
| 모임 대화 | 408:16752 | `/chat/:roomId` (group) | 🟡 |
| 받은 요청 · 보낸 요청 | 408:17145 | `/chat/requests` | 🟡 |

메모: "채팅 — 아직 디자인 안 나옴" (화면은 있으나 확정 아님). 3단 구성: 목록 320 / 대화 716 / 상대 정보 300.

## 라우트

```
/                       랜딩 (스크롤 4구간)
/look                   둘러보기 (비로그인, 방 3개까지)
/login  /signup  /signup/password  /password-reset
/onboarding/name | interests | intro | building | preview
/burrow                 내 땅굴            ← 로그인 후 기본
/burrow/explore         탐색하기 (돌아다니기)
/burrow/:userId         남의 땅굴 (방문자 뷰)
/board  /board/:postId
/meetups  /meetups/me  /meetups/new  /meetups/:id
/chat  /chat/requests  /chat/:roomId
```
헤더(GNB)가 붙는 화면: `/burrow*`, `/board*`, `/meetups*`, `/chat*`. 시작하기는 로고 + 로그인/시작하기만, 온보딩은 로고 + 진행 단계 바.

## 컴포넌트

Figma 컴포넌트 이름 → React 컴포넌트

| Figma | React | 비고 |
|---|---|---|
| Review/Navigation, Logo / 디굴디굴 (확정 · 헤더), Nav Pill (Active/Default) | `AppHeader`, `NavPill` | 로고 93×40, 메뉴 땅굴·게시판·모임·채팅, 알림(점)·설정 44×44 |
| Room Mode Toggle (내 땅굴 / 탐색), Scene / C / 통합 이동 버튼 | `RoomModeToggle` | 170×42, 하단 가운데 |
| Scene / C / 방노트, Scene / C / 방문자 | `SceneButton` | "땅굴 꾸미기", "방문자 2명" |
| Interest Chip (Tone ×8) | `InterestChip` | 관심사 → tone 매핑 |
| Guestbook Item | `GuestbookItem` | 사이드(축약) / 모달(삭제·신고) |
| 페이징 넘버 (Page / n, 이전, 다음) | `Pagination` | 5개 창, 6쪽 이상이면 맨 처음/끝 |
| — | `Modal` | 배경 클릭·Esc로 닫힘 |
| — | `RoomView` | 3D 자리. 지금은 이미지 |
| Chat List Item | `ChatListItem` | |
| Post Item, Post Thumb | `PostItem` | |
| Meetup Card | `MeetupCard` | |
| Category Icon ×11 | `CategoryIcon` | 지금은 이모지 |
| Onboarding / Step Pill, Button, Tag Chip, Picked Chip, Category Tile, Match Row | `StepBar`, `Button`, `TagChip`, … | |
| Spec / Badge | `CountBadge` | |

## 데이터 모델 (목 데이터 `src/data/`)

```ts
type Tone = 'sage'|'clay'|'butter'|'sky'|'lilac'|'rose'|'mint'|'sand'
interface Category { id: string; name: string; emoji: string; tags: Tag[] }   // 11개
interface Tag { id: string; name: string; count: number; categoryId: string }   // count 적을수록 니치
interface User { id; nickname; affiliation /* SSAFY 16기 · 지역 · 0반 */; intro; interests: string[]; qna?: {q,a}[]; online?: boolean; visitorsNow?: number }
interface GuestbookEntry { id; authorId; text; createdAt: string }   // 7일 지나면 숨김
interface Post { id; category: '자유'|'정보'|'질문'|'모임 후기'; title; preview; body; authorId; createdAt; views; likes; comments: Comment[]; thumb? }
interface Meetup { id; title; interest; date; startTime; endTime; place; mode: '오프라인'|'온라인'; capacity; members: string[]; hostId; status: '모집 중'|'마감'; intro; myStatus?: '참여 확정'|'신청 대기'|'내가 주최'|'찜' }
interface ChatRoom { id; kind: 'dm'|'group'; partnerId?; meetupId?; state: 'pending'|'open'; messages: Message[]; unread }
interface ChatRequest { id; kind: 'dm'|'meetup'; fromId; toId; message; createdAt; status }
```

현재 사용자(`me`)는 `닉네임 / SSAFY 16기 · 지역 · 0반 / 자기소개 없음 / 관심사 10개 / 방명록 12개`로 스크린샷과 똑같이 둔다.

## 개발 단계

1. **기반** (이번 실행): 스캐폴드, 토큰, 헤더, 라우터, 공통 컴포넌트, 내 땅굴 완성
2. **화면 골격** (이번 실행, 일부): 나머지 화면을 메타데이터 배치·문구로 만들기
3. **스크린샷 대조**: Figma 한도가 풀리면 화면마다 `get_screenshot`으로 받아 간격·색 맞추기
4. **3D 연결**: `explore/3d/` 시험판이 정리되면 `RoomView`를 three.js 씬으로 교체 (내 땅굴·방문자 뷰·탐색·랜딩·온보딩 미리보기에서 공용)
5. **모션**: 랜딩 스크롤 타임라인, 모임 ↔ 내 모임 슬라이드, 모션 줄이기 대응
6. **반응형·접근성**: 모바일 폭, 키보드 포커스, 모달 포커스 가두기
7. **백엔드 연결 준비**: `src/data`를 API 훅 뒤로 숨기기

## 실행 방법

```
cd app
npm install
npm run dev      # http://localhost:5173  (/burrow 가 내 땅굴, /screens 는 화면 목록)
npm run build
```

데모·스크린샷용 쿼리 (클릭 없이 상태를 바로 보기):

| 주소 | 상태 |
|---|---|
| `/burrow?panel=closed` | 사이드바 접힘 |
| `/burrow?guestbook=0` | 방명록 0개 |
| `/burrow?modal=guestbook` | 방명록 전체보기 모달 |
| `/burrow/yerin?modal=request` | 대화 요청 팝업 |
| `/meetups?modal=calendar` | 캘린더 팝업 |
| `/meetups/m4?modal=apply` | 참여 신청 팝업 |
| `/meetups/new?modal=done` | 모임 생성 완료 팝업 |
| `/board/p1?v=b` | 글 상세 B안 |
| `/#s1` ~ `/#s4` | 랜딩 구간 바로 보기 (스크롤하면 원래대로) |

## 구현 결과 (2026-11-10 1차)

- 구조: `app/src/styles/tokens.css`(토큰) · `components/`(공용) · `screens/<묶음>/`(화면) · `data/mock.ts`(목 데이터)
- 내 땅굴은 스크린샷과 겹쳐 보며 맞췄다: 헤더(로고·메뉴·알림·설정 위치), 장면 버튼 2개, 오른쪽 카드 340×811 (자기소개 224 높이, 칩 2줄, 방명록 3개 + 전체 보기), 하단 토글 170×42, 방 그림 위치·크기.
- 로고·두더지 프로필 사진은 스크린샷에서 잘라 쓴 임시 이미지 (`assets/logo.png`, `logo-clear.png`, `mole-avatar.png`). 원본 에셋으로 바꿔야 함.
- `room-cutout.png`는 배경(#f5f5f5)을 흘려 채우기로 투명하게 만들어 `assets/`에 넣었다. 636px 짜리라 크게 띄우면 흐리다.

### 디자인과 다르게 한 점 / 임의로 정한 점
- 방문자 뷰·탐색의 오른쪽 패널 제목은 "○○이의 땅굴", 접힌 버튼은 "방 정보"로 둠 (메타데이터에 이름만 있고 문구 없음)
- 탐색하기는 3D가 없어 ←/→ 버튼·키로 이웃 땅굴을 넘기는 방식으로 대신함
- 땅굴 꾸미기·방문자 버튼은 자리표시 팝업만 띄움 (꾸미기 화면 디자인 없음)
- 온보딩·로그인 화면 배치(왼쪽 방 그림 + 오른쪽 카드 등)와 문구 대부분은 지어 넣음 (텍스트 노드 이름이 자리표시)
- 모임 ↔ 내 모임 모션은 "들어오는 박스"만 구현 (나가는 박스 160ms는 라우트 전환 구조상 생략)
- 랜딩의 01·02·04 장면은 3D 대신 CSS 그림(하늘·풀밭·구멍)으로 대신함
- 헤드리스 Edge에서는 CSS 애니메이션이 거의 안 돌아서 온보딩 3b 결과 목록이 흐리게 찍힘. 실제 브라우저에서 확인 필요

## 열린 질문

1. 본문·숫자 서체 확정 (Do Hyeon + Pretendard로 임시 결정)
2. 방명록 프로필 사진을 누르면 그 사람 땅굴로 이동하는지
3. 게시글 상세 A안/B안 중 어느 것 (투표 중)
4. ~~글쓰기, 저장한 글 페이지 디자인~~ → 2026-11-11 Figma에 생겨서 반영 (559:7299, 560:7370)
5. ~~모임 상세 확정안~~ → 2026-11-11 옛 시안이 지워지고 "채팅 수정안"(494:13857)만 남음
6. 랜딩: 4번 페이지(이웃)를 첫 번째로 당길지, "먼저 둘러보기" 버튼 위치
7. ~~온보딩 2: A안 vs B안~~ → 2026-11-11 A안(551:7406)으로 확정, B안은 지워짐
8. 방 이미지는 636px 짜리라 확대하면 흐림 → 고해상도 렌더 또는 3D 씬 필요
9. ~~알림 센터, 설정 화면은 Figma에 없음~~ → 2026-11-11 생김. 알림 팝업 수정안(596:8808)·알림 페이지(569:7860)·설정(554:21331) 반영. 설정 "다른 버전"(582:7997)과 어느 쪽이 확정인지 확인 필요
10. 두더지 꾸미기 얼굴·목·손 아이템 목록과 원본 아이콘 (Figma에는 머리 탭만 보임)
11. Figma 메모로만 있는 페이지: 모임 수정, 내 모임 신청자 수락·거부, '땅굴 놀러가기' 버튼, 내 땅굴 → 탐색 전환 모션

## 2026-11-11 최신 Figma 반영

화면별 결과는 [figma-sync-2026-11-11.md](figma-sync-2026-11-11.md). 위 화면 표의 노드 id 중 옛 것(온보딩 2 개선안 3개·3c, 모임 상세 옛 시안)은 Figma에서 지워졌다. 새 경로: `/board/write`, `/board/saved`, `/notifications`, `/settings`. 개발용 화면 목록 `/screens`도 갱신.
