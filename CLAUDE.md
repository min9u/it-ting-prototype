# 잇팅 (it-ting) — 관심사 기반 커뮤니티 프로토타입

새 환경에서 이 작업을 이어받는 사람(또는 Claude)을 위한 인수인계 문서.

## 컨셉
- 가입할 때 고른 관심사로 **3D 방이 자동 생성**되고, 이후 직접 꾸밀 수 있음
- 서로의 방을 구경 → 1:1 대화 → 모임(그룹 채팅)으로 이어짐
- 강화하려는 차별점 3가지
  1. 처음 말 거는 부담을 낮춤 (방의 소품·사연을 대화 계기로)
  2. 내향적인 사람도 편하게
  3. 니치한 취미를 가진 사람끼리 잘 찾도록 (드문 태그에 가중치)
- 목적: 팀원에게 보여줄 UI/UX 프로토타입 (색·타이포 시스템 포함)

## 작업 방식 메모
- 사용자와는 **한국어**로 대화
- 기획상 애매한 점은 **객관식 + 자유 입력 선택지**로 질문 (사용자가 선호)
- 변경 후에는 같은 아티팩트 링크를 업데이트
- **대화 내용은 자동으로 저장되지 않음** (대화 기록은 로컬 `~/.claude/projects/`에만 남고 깃헙에 안 올라감). 그래서 기술 조사, 기획 검토, 방향 결정처럼 다시 볼 답변은 답할 때 바로:
  1. `docs/<주제>.md`로 정리 (날짜, 요청, 결론, 다음 단계 포함)
  2. 이 파일의 "조사·결정 기록"에 한 줄 요약과 링크 추가
  3. 커밋하고 푸시

## ⚠️ 방향 전환 (2026-11-10)
- 새 디자인 기준은 **Figma 파일의 "03. Screens" 페이지**. 방향과 디자인이 완전히 바뀌었음
- 그 전에 만든 단일 HTML 프로토타입(v1~v3, 두더지, 밤티 두더지)은 전부 **`legacy/`** 폴더로 옮김. 아래 "파일" 표부터 끝까지의 설명은 legacy 기준이고, 경로는 `legacy/` 아래에 있음 (예: `legacy/itting-mole.html`, `legacy/tools/serve.js`)
- legacy 실행: `cd legacy && node tools/serve.js <파일>`
- Figma: https://www.figma.com/design/HMFoyhSV5kc70UkFYUxspg (03. Screens = node 408:7577). **Figma MCP는 View 시트라 호출 한도가 매우 적음** → 받아 둔 자료는 `design/figma/` (스크린샷 3장 + 페이지 구조 `screens-metadata.xml`). 화면 PNG는 Figma에서 직접 내보내 이 폴더에 넣는 게 현실적
- 새 앱: `app/` (Vite + React + TS), 계획은 `docs/frontend-plan.md`. 3D는 `app/src/three/` (three.js 0.165, 지연 로딩). **두더지·가구 원본은 `explore/3d/lib/`** → `node explore/3d/lib/build-app.js`로 `app/src/three/mole.ts`, `furniture.ts` 생성 (앱 쪽 두 파일은 직접 고치지 말 것)
- **팀 공유용 앱 배포 (아티팩트)**: https://claude.ai/artifact/Fd1hfXP3T6nzY2Zg4QXYAS (비공개로 시작, 공유는 페이지 Share 메뉴)
  - 저장소가 비공개이고 gh 로그인이 없어 GitHub Pages 대신 아티팩트로 올림
  - 갱신: `cd app && npm run build:share` (# 라우팅·상대 경로, `.env.share`, 끝에 `scripts/share-page.mjs`가 `dist-share/share-page.html`과 `files.json`을 만듦) → Artifact publish(같은 url, root=dist-share, 바뀐 assets만 보내고 옛 해시 파일은 null)
  - 공유 빌드는 첫 화면이 시작 화면(`#/start`, 2026-11-11부터. 팀원이 랜딩 → 가입 → 온보딩을 체험). 로그인·회원가입은 프로토타입이라 입력 없이 통과
  - **시험판 링크 (2026-11-17, 팀 링크와 별도)**: https://claude.ai/artifact/NH6JiBu6qKJmr1SNRR1fJ9 — 사용자가 "예전 프로토타입에 반영하지 말고 새 링크로" 요청. 같은 공유 빌드를 `dist-share/share-page-next.html`(제목 "디굴디굴 시험판", share-page.html 을 복사해 제목만 바꿈)로 게시. 갱신은 같은 방식 + 이 url. **2026-11-18 version 4 = main 03ae89b**(관심사 이펙트 처음엔 꺼짐 · 관심사 확정본 12·90 · 탐색 v3.10 줌). 사용자 요청 "시험판에 올려줘. 이펙트 실험도 시험판에 다 올려줘. 디폴트로는 이펙트가 다 꺼져있게". 이펙트 실험 링크(9gE4UfgV4LntWwNJiWtkxu)는 추천 묶음이 켜진 2차 그대로 둠. **같은 날 팀 링크도 같은 빌드로 version 34** (사용자 요청 "시험판 배포를 팀 공유용에 링크에 적용해줘 똑같이"). 이제 팀 링크 = 시험판 (제목만 "디굴디굴"). **같은 날 저녁 시험판 version 5 · 팀 version 36 = main 9bd0e09**(벽지 고침 · 땅굴 색 묶음 12개, 사용자 요청 "둘다 올려줘". 팀 35 는 roomLook 청크를 빠뜨려 36 에서 바로 고침 → 게시 뒤 Artifact list scope files 로 빌드 files.json 과 같은지 확인할 것). **같은 날 밤 시험판 version 6 · 팀 version 37 = main 4700b6d**(두더지가 가구를 돌아서 걷기, 사용자 "응 다 올려줘")
  - Pretendard는 CDN 대신 npm `pretendard`로 번들 (아티팩트는 외부 CSS 차단)
  - **공개 공유(링크가 있는 모든 사용자) 검토**: svg·avif data URL이 있으면 거절됨 (2026-11-11 시험으로 확인). CSS에 svg data URL 쓰지 말 것, avif 확인 코드는 vite.config.ts `stripAvifProbe`가 뺌. glb(data:model/gltf-binary)와 woff2는 통과
  - 아티팩트는 `.glb` 파일을 못 올림 → 공유 빌드에서만 glb를 data URL로 JS에 넣음(`vite.config.ts`의 `assetsInlineLimit`), `three/glb.ts`가 fetch 없이 직접 풀어서 parse. Draco는 안 씀(해독기 wasm을 올려야 해서) → 텍스처 WebP + 메시 양자화
- **3D 핸드오프 v1** (`design/digul_3d_handoff_v1/`, 문서 `docs/HANDOFF_v1.md`): 디자이너가 만든 두더지 glb(동작 19개)·굴 입구 소품. 영상은 gitignore(디자이너 zip에 있음). 방·가구 glb는 아직 작업 중
  - 땅굴 방 두더지는 이 glb로 교체: `app/src/assets/models/mole.glb`(원본에서 텍스처만 1024 WebP, Draco 없음) + `app/src/three/moleActor.ts`(동작 순서). 탐색하기 밭은 아직 예전 코드 두더지(`mole.ts`)
- **3D 핸드오프 v1.1·v2** (`design/digul_3d_handoff_v1_1/`, `design/digul_3d_handoff_v2/`, 2026-11-11): 액세서리 41개(`three/moleDress.ts`, 목록·규칙 `data/moleItems.ts`)와 땅굴 방 glb(`three/roomScene.ts`, 가구는 `data/furnitureCatalog.json`을 읽음). 변환·판단은 [docs/3d-handoff-v2-integration.md](docs/3d-handoff-v2-integration.md). 관심사 가구 31개는 아직 안 옴
  - 가구 클릭: 방석·빈백 앉기, 부엌·찻병 선반 커피. 리액션 버튼 👋👀🐾☕. 남의 땅굴엔 집주인 두더지가 있고 인사하면 마주 보고 인사. 엉덩이 씰룩은 굴 입구 전용 자세라 방에서 뺌
- **탐색 화면 (2026-11-16 새로 만듦)**: 02 F5 명세 + 3D 핸드오프 v3.9 들판(층 단위 150자리, 구역 6칸) + v3.8 두더지 잡기 이동(구멍에서 구멍으로 점프). 장면 `three/holeField.ts`, 화면 `screens/burrow/ExploreBurrow.tsx`·`ExploreModals.tsx`(단골·추천 친구·캠퍼스-층), 목 데이터 `data/field.ts`, 배치는 `node app/scripts/build-field-layout.mjs`로 만든 `data/fieldLayout150.json`. 두더지 `mole.glb`는 v1_3(동작 25개). 시작 화면 둘러보기·랜딩은 아직 예전 밭(`fieldScene.ts`). 자세한 것은 [docs/explore-field-v3-9.md](docs/explore-field-v3-9.md). **2026-11-18 v3.10**: 바닥 전체 잔디 + 흙 노드(`soil_zoneN`·`soil_link_N_M` 규칙), 층마다 작물 1종(`data/field.ts` `cropOf`, 캠퍼스-층 목록 순서로 호박→사과→딸기→고구마→당근), 줌 near 12 / mid 24 / far 46m(휠·+/−·오른쪽 아래 버튼, 수치·한계·LOD 는 `three/fieldCam.ts` 하나, `?zoom=` 주소 기억, `?zoomfreeze=0_5` 측정용) → [docs/explore-field-v3-10.md](docs/explore-field-v3-10.md)
- **방명록 우체통 (v3.6, 2026-11-16)**: 땅굴 방에 항상 있음(`three/mailbox.ts`), 새 방명록이면 깃발·편지·발광, 누르면 방명록 전체 보기. 블룸 대신 빛무리 스프라이트 → [docs/mailbox-integration.md](docs/mailbox-integration.md)
- **채팅 (2026-11-16 새로 만듦)**: 02 F6 명세(목록 · 찻방 · 대화 창 세 칸, 요청 탭은 대화 요청만) + 03 디자인. 상태 `data/chat.ts`, 화면 `screens/chat/Chat.tsx`, 찻방 `screens/chat/TeaRoom.tsx`(2D 방) + `three/TeaRoomCanvas.tsx`(3D 두더지), 프로필 팝업 `components/ProfilePopup.tsx`. 방문자 뷰 대화 요청·모임 채팅 링크가 여기에 연결됨 → [docs/chat-f6.md](docs/chat-f6.md)
- **02 명세 전 영역 반영 (2026-11-16)**: 화면별 문서 [F1·F2](docs/spec-f1-f2.md) · [F3·F4](docs/spec-f3-f4.md) · [F5 탐색](docs/explore-field-v3-9.md) · [F6 채팅](docs/chat-f6.md) · [F7 모임](docs/spec-f7.md) · [F8 커뮤니티](docs/spec-f8.md) · [F9~F11·공통](docs/spec-f9-f11.md). 명세 스크린샷은 `design/figma/spec/f1`~`f11/`. 상태 저장소: `data/auth.ts`(**지금은 `LOGIN_FREE = true`라 로그인 검사 없음**: 빈 칸으로도 로그인 → 내 땅굴, 비로그인도 모든 화면 열림. false 로 바꾸면 명세대로 막힘), `data/chat.ts`, `data/meetupStore.ts`, `data/boardStore.ts`, `data/notifications.ts`, `data/account.ts`(차단·Google·관리자), `data/myBurrow.ts`. 관리자는 `/admin?as=admin`. 휴대폰·좁은 창은 "PC에서 이용해 주세요"(`?device=any`로 건너뜀)
- **온보딩 새 디자인**: 시안 PNG는 `design/figma/onboarding/`, 2D 아바타는 `app/src/components/MoleAvatar.tsx`, `#/onboarding?demo`로 열면 예시 값이 채워짐
- 3D 재현 시험판: `explore/3d/room.html` (게시: https://claude.ai/artifact/JehojQcDbUwxys5R6mQo3n), 탐색하기 `explore/3d/field.html`
- 3D 엔진 비교: `explore/{3d,babylon,playcanvas}/` 같은 과제(`explore/BRIEF.md`), 미리보기 `node explore/serve.js <포트>`. 비교 페이지 https://claude.ai/artifact/7saUop5kLtVnDDXCdU8UDT
- 회차별 스크린샷은 gitignore (`shots/final-*`, `shots/ref-*`만 커밋)

## 파일 (legacy/ 기준)
| 경로 | 내용 |
|---|---|
| `itting-prototype.html` | 프로토타입 전체 (단일 파일, 약 280KB). **이게 원본** |
| `itting-mole.html` | 두더지 시안 (v3에서 갈라진 별도 시안, 약 300KB). 이 파일이 시안의 원본 |
| `itting-mole-v2.html` | 밤티 두더지 (두더지 시안에서 갈라진 별도 시안) |
| `archive/itting-v2.html` | v2 백업 |
| `tools/serve.js` | 로컬 미리보기 서버 (`PORT=… node tools/serve.js <파일>`) |
| `docs/3d-tech-research.md` | Figma 땅굴 그림체를 재현하는 3D 기술 조사 |
| `README.md`, `docs/screenshots/` | 버전별 특징 정리와 스크린샷 (화면이 바뀌면 같이 갱신) |

게시된 아티팩트 (v3): https://claude.ai/artifact/QMnEBTJiKyvwEkmevz1c63 — "링크가 있는 누구나" 공유.
아티팩트를 갱신할 수 있는 건 만든 계정(소유자)뿐. 새 세션에서는 Artifact `read`로 먼저 읽고 같은 `url`로 publish 해야 함.

## 단일 HTML 구조
- `<html>/<head>/<body>` 태그가 **없음** (아티팩트 게시 시 자동으로 붙음). 로컬에서는 `tools/serve.js`가 감싸서 띄움
- 외부 의존성: Google Fonts(Hahmlet, IBM Plex Sans KR, IBM Plex Mono), three.js r128 + OrbitControls (cdnjs / jsdelivr)
- CSS: `:root` 토큰 + 다크 테마(`prefers-color-scheme` 와 `[data-theme]` 둘 다). 섹션 주석: 기본 → 앱 셸 → 버튼 → 온보딩 → 방 화면 → 페이지형 → 대화·모임 → 디자인 시스템 → 2차(관계 단계·넛지·알림) → 반응형 → 3차(방 무드·벽 꾸미기)
- JS 섹션(`/* ===== */` 주석으로 구분): 유틸 → 데이터 → 방 자동 생성 → 3D 에셋 라이브러리 → 공통 조각 → 화면들(온보딩, 내 방, 둘러보기, 남의 방, 대화, 모임, 디자인 시스템, 기획 노트, 취미 상세, 알림 센터) → 라우터·셸
- 해시 라우팅 (`#explore`, `#my-room`, `#visit/<id>` …)

### 핵심 데이터 (JS "데이터" 섹션)
- `CATS` 관심 분류 11개 + basic, `TAGS` 약 60개 (각 태그에 인원수 `count`. 적을수록 니치)
- `CATALOG` 소품 67종 (`cat`, 3D 빌더), `WIDE` 벽에 붙는 넓은 소품
- `MOODS` 방 무드 10종: 벽지·바닥 무늬·색, 조명, 창문, 커튼, 나무색, 침대·스탠드·러그 모양을 한꺼번에 정함
- `WALL_PATS`, `FLOOR_PATS`, `WALL_COLORS`, `FLOOR_COLORS`, `LIGHTS`, `DECO`(벽 장식 16종), `BANDS`(천장 띠), `SLOTS`(벽 장식 7자리)
- `CAT_MOOD`, `CAT_DECO`: 분류 → 자동 무드·장식
- `lookOf(room)`: 무드 프리셋 + 방별 덮어쓰기 = 최종 외관
- `ROOMS` 샘플 방 14개

### 방 자동 생성 (`generateRoom`)
- `tasteWeights`: 분류별로 Σ(1 + 1000/태그 인원수)를 더함 → 드문 취미가 무겁게 반영됨 → 가장 무거운 분류로 무드 결정
- 벽 장식: 가장 드문 태그 2개는 포스터, 분류별 장식은 최대 5개, 장식이 4개 미만이면 시계 추가
- 자유 입력 문장은 `KEYWORDS` 정규식으로 소품을 뽑음

### 3D
- 공유 WebGL 렌더러 하나를 화면마다 옮겨 끼움 (`Engine`), 아이소메트릭 직교 카메라, 8×8 방에 뒷벽·왼벽
- 프리미티브 헬퍼: `box`(y=바닥 기준), `bx`(중심 기준), `cyl`, `sph`, `rod`, `discX`, `flat`. 머티리얼은 `mat`/`bmat`에 캐시
- 패턴·포스터·네온 등은 CanvasTexture로 그림 (`canvasTex`, `texPlane`)
- `Engine.relook()`: 아바타는 두고 씬만 다시 만듦 (무드·벽 변경 시 호출)
- 썸네일·아이콘은 시작할 때 한 번 렌더해 dataURL로 보관 (`makeThumbs`). 첫 로드에 1~2초 걸림

## 확인 방법
```
node tools/serve.js            # http://127.0.0.1:5178
```
헤드리스 스크린샷 (Chrome 확장을 못 쓸 때, Edge 예시):
```
msedge --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader ^
  --virtual-time-budget=9000 --window-size=1280,860 ^
  --screenshot=shot.png "http://127.0.0.1:5178/#explore"
```
- 인라인 스크립트 문법 검사: `<script>` 본문만 뽑아서 `node --check`
- 헤드리스 Edge는 창 폭이 약 490px보다 좁아지지 않음 → 모바일 폭은 `scrollWidth`를 재서 확인

## 주의할 점 (전에 겪은 문제)
- 큰 블록을 문자열 마커로 잘라 붙일 때 마커가 없으면 `lastIndexOf`가 -1을 돌려 파일이 잘림 → 마커가 있는지 먼저 확인할 것
- `[hidden]{display:none!important}`를 지우지 말 것. 컴포넌트의 `display` 값이 hidden 속성을 덮어서 모달 배경이 떠 있던 버그가 있었음
- Bash에서 `node -e` 안에 백틱을 쓰면 명령 치환이 일어남 → 스크립트를 파일로 저장해서 실행

## 버전 기록
- v1: 화면 전체 + 색·타이포 시스템 + 디자인 시스템 페이지
- v2: 첫 대화(관계 단계·넛지), 니치 매칭, 방 주인 경험(방 기록), 알림 센터
- v3: 방 무드 10종, 벽 장식 16종 + 천장 띠, 소품 24 → 66종, 분류 3개 추가(운동·아웃도어, 영화·애니, 반려동물), 샘플 방 14개, 꾸미기 패널 3탭

## 두더지 시안 (`itting-mole.html`)
게시: https://claude.ai/artifact/PxPeWqeQ3vPrLqc926Xx77 (비공개로 시작. 공유는 페이지의 Share 메뉴에서)
- 세계관: 캐릭터는 두더지(털 색 + 목도리 색). 땅 위 "관심사 밭"을 걷다가 굴 입구(흙무더기)를 파고 들어가면 남의 굴(방)이 나옴. 다른 두더지는 굴 안에서만 만남
- 스타일: 참고 페이지(외부 아티팩트 "두더지 관심사 밭") 기반. Jua(제목·버튼·숫자) + Gowun Dodum(본문), Leaf/Bell/Berry + Sand/Bark 팔레트, 아래 그림자 알약 버튼, 툰 셰이딩(`MeshToonMaterial`, `grad()`)
- 굴 = 기존 방 생성 그대로 + 흙 단면 셸(`buildShell`: 흙덩이 3개, 위에 풀밭, 버팀목). 흙 텍스처는 `soilCanvas` 한 장을 면마다 잘라 씀
- 밭(`Field` 모듈, 별도 WebGL 렌더러): 배치 3종 `fieldLayout('cat'|'me'|'tag')` = 분류별 밭+반짝 작물 / 나 중심 / 태그 텃밭. 접속 중인 주인은 굴 밖으로 고개를 내밂
- 전환: `Iris.close/open` (밭→굴 파고들기, 굴→밭 뿅). 굴 도착은 `Engine.mount(..., {drop:true})`로 천장에서 떨어짐, 주인이 있으면 점프
- UI 문구의 "방"은 "굴"로 바꿈. 둘러보기는 "밭에서 찾기"(기본) / "목록으로 찾기"(기존 검색)
- 이 PC 크롬은 소프트웨어 렌더러라 2fps 정도로 느림. 헤드리스 Edge는 rAF가 거의 안 돌아서 애니메이션 흐름은 실제 브라우저로 확인해야 함

## 밤티 두더지 (`itting-mole-v2.html`)
게시: https://claude.ai/artifact/4jnfvDHX9RvixmprcwjZRG (비공개로 시작)
- 두더지 시안에서 갈라진 별도 파일. 사용자 요청: "밤티 나게(귀엽고 어이없게)", 굴은 땅굴처럼, 캐릭터는 멍청하고 모성애 느껴지게
- `makeMole`: 아기 비율 몸, 짝짝이 눈(크기·높이·눈동자 방향 다름), 뻐드렁니, 머리에 새싹·흙덩이·돌멩이(털+목도리 색 해시로 고름), 삐뚤어진 목도리. `blinkMole`은 느리고 가끔 한쪽만 감음
- 넘어짐: 밭은 `Field`의 `state='trip'`(`updateTrip`), 굴 안은 `Engine` 아바타 `u.trip`. 걷는 중 확률(초당 약 0.1)로 발생, `reduceMotion`이면 안 넘어짐
- `buildShell`: 흙 동굴(`caveWall` 정점 변형 + 위쪽 처마 `caveLip`), 바닥은 다진 흙 + 무드 무늬 장판, 무드 벽지는 테이프 조각(`tapedPatch`), 뿌리·돌멩이·옆 굴 구멍. 창문·벽 장식은 벽에서 0.5 띄움, 천장 띠는 0.84배로 줄여 안쪽으로
- 리뷰: "귀엽지 않고 너무 덜떨어지게 나왔다" (사용자 평가. 다음에 손볼 때 짝짝이 눈·뻐드렁니·넘어짐 같은 '모자람' 장치를 줄이고 귀여움 쪽으로 조정)
- UI: 제목·버튼 서체 Gaegu Bold(자간 -0.04em), 1~2도 기울기, 바느질 점선 테두리(`outline: dashed`), 테이프 장식, 호버 시 흔들기. 문구는 어이없게 바꿈

## 조사·결정 기록
- 2026-11-10 [3D 땅굴 그래픽 기술 조사](docs/3d-tech-research.md): Figma 시안(점토 재질, 간접광, AO)은 한 장짜리 PNG라 그대로 쓸 수 없음. **three.js 조명·재질·후처리 강화(A)로 시작하고, 두더지와 땅굴 껍데기만 glb 모델(B)로 교체** 추천. 다음 단계는 땅굴 하나에 1단계를 적용한 시험판
- 2026-11-10 [Figma 땅굴 three.js 재현 시험판](docs/3d-figma-reproduction.md): 코드만으로 구도·돔·색감·배치는 꽤 가깝게 됨. 두더지 털·곡면·간접광은 한계 → **두더지와 주요 가구만 glb, 껍데기는 간접광 굽기** 추천. 원본 Blender 파일 유무 확인이 다음 단계
- 2026-11-10 [3D 엔진 비교: three.js · Babylon.js · PlayCanvas](docs/3d-engine-candidates.md): 같은 두 장면을 세 엔진으로 만들어 비교. 결과가 비슷한 수준에서 멈춤(한계는 방식 탓) → **three.js 추천**(가볍고 React 앱에 붙이기 쉬움). 두더지 캐릭터는 세 엔진 모두 원본 비율·얼굴까지 맞춤
- 2026-11-10 [PlayCanvas vs three.js 실무 분석](docs/playcanvas-vs-threejs.md): 사용자는 PlayCanvas 결과가 가장 좋다고 봄. 차이 대부분은 조명 기법(그라데이션 환경광·PCSS·SSAO)이라 three.js로 옮길 수 있음. 앱에는 three.js(R3F)가 유리(gzip 167KB vs 655KB, React 생태계). → 조명을 옮겨 보니 three.js로도 거의 같은 느낌(N8AO 사용). 두더지는 펠트 질감(섬유 노멀맵 + sheen + 잔털 셸 12겹)으로 9회 다듬음 (explore/3d/NOTES.md). 2026-11-10 이 three.js 두더지로 임시 고정, 가구 17개를 벽 따라 정리, 방향키·WASD·클릭으로 조종, 앱에 합침. 다음: 엔진 확정 후 `app/` RoomView에 R3F로 이식

- 2026-11-10 [프론트엔드 기술 가이드](docs/frontend-guide.md): 사용자 학습용. → **2026-11-17 다시 씀**: 기술마다 고른 이유·다른 후보·대가·코드 위치(React·Vite·해시 라우터·토큰·three.js·glb/Draco·TanStack Query·목 서버·STOMP·vitest·스모크·CI·아티팩트), **사건 기록 21건**(가속 꺼진 PC 멈춤 1~3차 숫자, 첫 진입 멈춤·예열 역효과, sRGB 굽기 그림자, 기기 단계 판정, 아티팩트 제약, 새로고침·청크 404, 채팅 key, 팝업 초점, 날짜, 스모크 getContext, 병합·절전 등), 구조·에러 잡는 곳·백엔드 연결·용어집. 개념 학습은 [frontend-guide-concepts.md](docs/frontend-guide-concepts.md)(React·라우팅·에러 경계·토큰·타입·데이터·실시간·3D·그래픽 성능 개념·빌드·테스트) 웹 페이지: https://claude.ai/artifact/FUEdGDVuFQN1CpoG9yqTpR (두 문서를 목차 한 장으로, 만들기 `node tools/guide-page/build.mjs`, tools/guide-page/README.md). 같은 날 오후: 맨 앞 "요청" 줄을 빼고 **2장 "그림으로 보는 프론트엔드"(기획자·백엔드 개발자용 그림 9개)** 추가(장 번호가 한 칸씩 밀려 사건 기록 = 4장), 전체에 SVG 그림(`docs/guide-diagrams/`, 페이지에 인라인이라 다크 모드를 따름)과 실제 빌드 사진(`docs/guide-images/`, `tools/guide-page/make-images.py`)을 넣음. 생성기는 이미지·그림 크게 보기·`out/files.json`(같이 올릴 사진 목록) 지원
- 2026-11-13 [모임 요구사항 명세 검토](docs/meetup-spec-review.md): F7 모임을 CRUD 중심으로 검토, 사용자 결정 M1~M14(완료 팝업 없이 상세로, 정원에 주최자 포함, 자동 미승인, 재신청은 스스로 취소한 경우만, 거절 확인 팝업 통일 등)와 커뮤니티 후속 C1~C3(글쓰기 임시 저장, 검색 즉시, 페이지 번호). M15~M17(대표 관심사 1개 + 태그 3개, 온라인 플랫폼 필수·링크 선택, 대화방 계속 유지)까지 결정. F7 일부 프레임이 동시 수정으로 새 형식으로 바뀌어 새 node에 다시 반영
- 2026-11-11 [개발·배포·백엔드 연결 위험 지점](docs/dev-deploy-risks.md): 코드 근거로 정리. 가장 큰 것은 비동기 전환 시 `<Navigate>` "없음" 처리·로딩/에러 경계 없음, 날짜 형식 혼재(ISO vs "2시간 전")·시간대, 채팅방 전환 시 이전 메시지가 남는 버그(`<Room>`에 key 없음), 브라우저 라우터 새로고침 404·재배포 후 청크 404, 인증 가드 없음. 바로 할 예방 작업 Top 8과 백엔드 합의 체크리스트·API 규약 초안 포함
- 2026-11-11 [마케팅 전략: SSAFY에서 시작해 밖으로](docs/marketing-strategy.md): 사례(Facebook·Gas·BeReal·에브리타임·싸이월드·Clubhouse·Gather) 조사. **반 단위 오픈 → 캠퍼스 → 기수**, 첫 5분 안에 내 땅굴 + GPU 대응, 땅굴 공유 카드, 인싸에게는 "홍보" 대신 "먼저 써 보기·방명록", 매터모스트 공지는 소식 있을 때 2~3번. 모방 심리는 압박 대신 "반 지도에 켜지는 땅굴"로. 확장은 새 밭을 여는 방식(부트캠프·대학 → 관심사 커뮤니티). 운영 규정·SSAFY 이름 사용은 확인 필요
- 2026-11-11 [그래픽 가속이 꺼진 PC 대응](docs/gpu-fallback-research.md): 실측 결과 크롬 157은 가속을 끄면 WARP(CPU)로 그림. 그림은 같지만 땅굴 3fps·탐색 1.1fps이고 메인 스레드가 막혀 **페이지 전체가 멈춤**. WebGL이 아예 없으면 636px 자리표시가 흐리게 늘어남(또 다른 "깨짐" 후보). 감지는 `failIfMajorPerformanceCaveat` + 렌더러 문자열로 확실하게 가능. `chrome://` 링크는 막힘(실측) → 안내는 주소 복사 방식. **추천: 감지 → 저사양 모드(해상도 0.5·후처리 끔·그림자 축소·잔털 0, 236→52ms) + 가만히 있으면 그리기 멈춤 + 안내 띠**, 자리표시 그림 고해상도로 교체. 캐릭터 만들기는 이미 2D SVG라 GPU 불필요. 다음: 실제 SSAFY PC에서 `chrome://gpu` 확인. 실험 코드 `explore/gpu/`
- 2026-11-11 [Figma 최신 버전 반영](docs/figma-sync-2026-11-11.md): 메타데이터를 새로 받아 어제 것과 diff → 이름 변경·옛 시안 삭제·5xx~6xx 새 프레임으로 최신 버전 확정. 온보딩 1 "이름·두더지 꾸미기"·온보딩 4 땅굴 미리보기 새로 만듦, 땅굴(꾸미기·내 정보 수정·방명록 빈 상태·팝업·토스트), 게시판(글쓰기·저장한 글·삭제/신고), 모임(만들기 새 배치·대기 팝업), 채팅(1:1·요청), 알림 페이지·설정 추가. Figma 호출 5번. 못 한 것: 얼굴·목·손 아이템 실제 목록, 채팅 요청·모임 탭 대조, Figma 메모로만 있는 기능 요청
- 2026-11-11 [3D 핸드오프 v1.1·v2 반영](docs/3d-handoff-v2-integration.md): 두더지 액세서리 41개(정식 아이콘, 부위마다 1개 최대 4개, 레벨·관심사 잠금, 리본+캐리어 불가)를 3D 두더지 소켓에 입힘(리본 흔들림·풍선 세우기·손 소품 숨김), 온보딩 1 미리 보기는 3D 회전. 땅굴을 코드로 만든 방 → 디자이너 glb 방(구운 조명, AgX, 스펙 카메라·조명, 카탈로그 기반 가구, 하늘색 방석 앉기, 천장 구멍 열림→낙하→닫힘). 후처리·그림자 맵을 없애 가벼워짐. Draco 대신 WebP + 양자화. 관심사 가구는 glb가 아직 없어 새 방에서 빠짐
- 2026-11-11 [3D 핸드오프 v3 앱 반영](docs/3d-handoff-v3-integration.md): 관심사 v2(카테고리 11 · 세부 65 · 최대 10개, **2026-11-18 확정본(12·90)으로 바뀜** → [interest-tags-2026-11-18.md](docs/interest-tags-2026-11-18.md))를 카탈로그 JSON으로 읽고, 방 가구는 `slots.json` 슬롯 배치(모델 없는 건 둥근 블록) + 낙하·먼지, 노란 방석 앉기. Draco는 일반 빌드 wasm, 공유 빌드 JS 해독기(메인 스레드). 다음: M2~M4 모델이 오면 glb·JSON만 교체, M3에 CC-BY 표기. 2026-11-12 v3.1~v3.4 패치 반영 (블록 없이 전부 모델, 선반 소품 앞으로, 빈백 전용 앉기 mole_v1_2, 설정에 CC-BY 크레딧, 반려동물). 반려동물이 화면 아래에 잘리던 구도는 2026-11-12 줌 아웃(three/roomFrame.ts ROOM_FRAME h 1.145→1.0, top -0.054→-0.06)으로 해결. v3.5.1 벽지(무드 → wallpaper_id, wall_inner에 타일 × 음영 lightMap, three r165는 세기 4π) + shell v3
- 2026-11-12 [Figma 최신 버전 반영 (2)](docs/figma-sync-2026-11-12.md): 메타데이터 diff + 스크린샷 10장. 모임 상세 상태 6종·신청 관리 팝업·모임 수정·취소·정렬/개수 드롭다운·삭제 확인, 땅굴 꾸미기 가구 탭(카테고리마다 가구 하나 → 방에 바로 반영)·안내 말풍선·연필·방명록 프로필 카드, 탐색 "오늘의 이웃" 추천 모달(카드 뒤집기), 시작 화면 2구간(방 → 이웃, 밭 확대 없앰), 답글 인라인 입력, 토스트 6종 문구. 가구 탭은 **표시만** 하고 방 배치는 그대로(사용자 확인). 확인 필요: 상태 박스 문구
- 2026-11-12 [시작 화면 로딩 정리](docs/landing-loading.md): 그림 → 사라짐 → 가구가 하나씩 → 이름표가 먼저 뜨던 번잡함을 없앰. 3D가 다 차려질 때까지 문장 + 로딩 애니메이션(흙더미 두더지), 그 뒤 연출 없이 다 차려진 방을 한 번에 페이드 인하고 이름표. `RoomView loader·still`, `SceneHandle.loaded`
- 2026-11-13 [3D 렌더링 방식 정리와 개선 방향](docs/rendering-overview.md): React는 div 하나, 화면마다 three.js 렌더러를 lazy 로 만들고 버림. 땅굴은 구운 조명 glb(그림자·후처리 없음), 탐색하기는 그림자 맵 + N8AO. 가속 꺼짐은 failIfMajorPerformanceCaveat로 감지 → 저사양 묶음(0.55배·10fps·쉬면 멈춤·A 배경 한 번·S 선명한 방). 개선 추천: 실제 PC 측정 → 첫 로딩 멈춤(셰이더·Draco) → Worker 기본 → 선명한 방 캐시, 공통으로 관심사 glb 분할(공유 빌드 땅굴 청크 약 12MB)·Draco 중복·렌더러 공유
- 2026-11-13 [렌더링 개선 실험 (실제 SSAFY PC)](docs/rendering-experiments.md): 이 PC는 RTX가 있지만 크롬 가속이 꺼져 WARP(16스레드). 걷기는 이미 매끄럽고(10fps 제한을 풀면 60fps 가능) 문제는 첫 진입 멈춤 → base64 내장 해독·Draco Worker·셰이더/그리기 예열(예열 중 루프 쉼)로 가장 긴 멈춤 0.72→0.15초. 선명한 방 그림 탭 안 기억(다시 들어올 때 긴 작업 0), 공유 빌드 방 모델을 파일마다 따로(7.1→5.5MB). D Worker는 공유 빌드에서 빈 화면이라 끔. 측정 도구 explore/gpu/cdp-load.mjs. 같은 날 오후 **저사양 fps 제한 해제**(B 기본 끔, 실험실 저장 키 digul.lowlab.v2, 걷기 장면 60fps·긴 작업 0) 후 팀 아티팩트 version 28 배포
- 2026-11-16 [탐색 화면 새로 만들기: 02 F5 + 3D v3.8·v3.9](docs/explore-field-v3-9.md): 걸어 다니는 밭 → 구멍에서 구멍으로 점프하는 층 단위 들판(구역 6칸·150자리, 켜진 구역만, 안 켠 구역은 잔디 평면). 방향키 ±45° 가장 가까운 구멍·클릭은 바로, Enter는 어두워진 뒤 땅굴로. 명세의 안내판·주인 카드·단골 목록·오늘의 추천 친구(설정 → 결과 → 뒤집기, 하루 한 번)·캠퍼스-층 고르기(사다리도)·내 땅굴로 돌아가기·방문자 뷰 단골 추가. 12m 칸 인스턴싱으로 컬링. 탈퇴 빈 번호는 "가장 작은 번호 재사용 + 30일 보류" 제안. 11-13 다른 PC의 걷기 탐색 작업과 합칠 때 탐색은 이번 구현으로 둠. 팀 아티팩트 version 29
- 2026-11-16 [방명록 우체통 반영 (v3.6)](docs/mailbox-integration.md): 땅굴 방 고정 슬롯, FlagUp·편지·발광, 호버 외곽선(뒷면 껍데기)·클릭 상자, 블룸 대신 가산 빛무리, 저사양은 움직이는 층(layer 1)에 두고 부분 다시 그리기. 남의 땅굴에서는 내가 방명록을 남겼을 때만 깃발(확인받을 것)
- 2026-11-16 [채팅 새로 만들기: 02 F6 + 03 디자인](docs/chat-f6.md): 세 칸(목록 · 찻방 · 대화). 찻방은 2D 방 그림 + 3D 두더지(모임 5마리 + "+N"). 1:1(대화 시작 안내·관심사·모임 카드·대화 나가기·상대 나감/탈퇴 읽기 전용), 모임(공지 주최자만·참여 알림·모임 정보 팝업·모임 나가기 24시간 규칙), 요청 탭(받은/보낸, 거절 확인·수락 → 대화방·5일 만료·취소), 프로필 팝업(신고). 방문자 뷰 대화 요청 → 보낸 요청, 모임 채팅 링크 → 그 모임 대화방. 첨부는 모임 공유만. 팀 아티팩트 version 30
- 2026-11-16 [02 명세 나머지 전 영역 구현](docs/spec-all-2026-11-16.md): F1·F2 / F3·F4 / F7 / F8 / F9~F11·공통을 작업자 5개가 worktree 로 나눠 구현하고 합침. 영역 잇기(채팅 모임 대화방 ↔ 모임 저장소, 알림 모임 신청 수, 로그아웃 → 비로그인, 프로필 팝업 차단, 없는 모임·땅굴 안내). 확인받을 것 목록은 문서에
- 2026-11-16 [탐색 디자인 시안 A·B·C·D + 미니맵](docs/explore-designs.md): `/burrow/explore?design=a|b|c|d`(위쪽 시안 칩). A 3D 들판 점프 / B 2D 마을 지도(길 따라 걷기·필터) / C 땅속 굴길 단면(방 엿보기) / D 이웃 카드(잘 맞는 순·말 거는 계기). 미니맵(`screens/burrow/Minimap.tsx`)은 네 시안 모두: 땅굴·내 두더지·보이는 범위·접속 중·단골, 크게 보기 팝업. 추천 A+미니맵, 가속 꺼진 PC는 B. 팀 아티팩트 version 33, 비교 페이지 https://claude.ai/artifact/DtERmkRudGQotA7yoMx7xC
- 2026-11-16 [렌더링 실험 2: 가속 끈 크롬](docs/rendering-experiments-2.md): 병목은 픽셀 처리(화면 가득한 땅 + PBR·환경맵). 탐색 들판 저사양 기본 = **배경 한 번 + 두더지 둘레만 + 예열 + 이동 중 0.33배 + 배경 선명(1배 2D 캔버스, PBO 비동기 읽기), 두더지만 0.55배** → 점프 28 → 57.7fps(2코어 8.4 → 39.8), 배경 가장자리 SSIM 0.830 → 0.952, 첫 진입 멈춤 0.60 → 0.17초. 찻방 숨쉬기 15fps, 랜딩 숨긴 층 멈춤. 둘 다 1배는 2코어에서 절반이라 손잡이로만. 화질↔성능 지도 페이지 https://claude.ai/artifact/4MAuK28rTDpcsBoEsk65hY. 후보 숫자 `explore/gpu/results/field-tradeoff.json`
- 2026-11-16 [백엔드 ERD](docs/backend/erd-2026-11-16.md): 백엔드 ERD 아티팩트(테이블 38개, enum 미정)를 표로 옮김. 이걸 기준으로 API 초안·ERD 질문·데이터 계층·실시간·테스트·그래픽 3차를 작업자 넷이 진행 중
- 2026-11-16 [프론트엔드 실서비스 대비: 실시간 · 안정성 · 접근성 · 입력 검증](docs/frontend-hardening.md): 채팅 실시간 계층 `app/src/realtime/`(목 서버 · WebSocket+STOMP 직접 구현, 재연결 백오프+지터 · 다시 받기 · clientId 중복 제거 · 보내는 중/실패/다시 보내기 · 탭 숨김 10분 · 연결 띠). 시험 손잡이 `?rt=flaky` · `?rt=down` · 콘솔 `__digulRealtime.mock.drop(5000)`. 청크 404 한 번 새로고침, 라우트 에러 경계 세 겹 + 3D 경계(WebGL 실패 → 2D), 오프라인 띠, 환경 변수 `lib/env.ts` 하나("0"은 거짓), 인증 뼈대 `lib/authFlow.ts`, 글자 수 `lib/validation.ts`(방명록 100 → 50자, 명세·ERD 대조표), 모달 포커스 가두기·복귀(팝업 입력칸 초점 뺏김 버그 수정), 색 대비 표. 서버 설정 예시 [docs/deploy-config.md](docs/deploy-config.md) (Spring Boot + Nginx + EC2 가정)
- 2026-11-16 [백엔드 연결 대비: API 초안 · ERD 질문 · 프론트 데이터 계층](docs/backend/frontend-data-layer.md): API 계약 초안 [api-draft.md](docs/backend/api-draft.md)(봉투 없음, 에러 `{code,message}`, ID 문자열, ISO+오프셋, 게시판·모임 번호 / 채팅·알림·방명록·댓글 커서, STOMP 채널 이름), ERD 차이·질문 [erd-gaps.md](docs/backend/erd-gaps.md)(차단·방명록 100자·모임 태그·알림 제목 스냅숏 등 Q1~Q12, enum 후보, 길이 비교). `app/src/api/`(client·types·mappers·영역별 real/mock·TanStack Query 훅), 목 서버 손잡이 `?api=slow|fail|flaky|writefail|empty|notfound|unauth`, `VITE_API_MODE=mock|real`. 모임 상세·목록, 글 목록·상세, 땅굴 방문, 알림, 채팅 목록·요청이 로딩·오류·없음(404) 구분 + 낙관적 쓰기. 날짜는 `lib/time.ts` 한 곳(Asia/Seoul)
- 2026-11-16 [땅굴 다양성 실험: 같은 가구, 다른 땅굴](docs/burrow-diversity.md): 가구 glb가 모두 팔레트 재질 8개 단색 + 구운 AO라 **재질 색만 바꿔도 음영 유지**. 실험실 `/lab/style`(데이터 `data/roomStyle.ts`, 3D `three/roomStyle.ts`, roomScene `style`·`setStyle`·`setPickMode`)에서 색 테마 9개, 가구 칠하기(색 자리별 색·무늬 6종·마감 5종), 기본 가구 모양(머리판·버섯 갓·테이블보·방석 술 등), 러그 다시 칠하기, **자동 꾸미기(씨앗)**. 러그·테마·이불 무늬가 가장 효과 큼. 저장 JSON 40~500바이트. `style` 없으면 기존 화면 그대로. 앱 반영 범위·디자이너 요청(변형 모델·재질 나누기·러그 분리)은 확인 대기, 저사양 측정 안 함
- 2026-11-16 [테스트 · 스모크 · CI · 번들 크기](docs/testing-ci.md): `app/`에서 `npm test`(vitest 단위 테스트 `src/tests/`, 명세 번호를 이름에, 순수 함수·JSON 위주), `npm run smoke`(dist를 헤드리스 크롬 CDP로 열어 화면 96개(가속 켬·끔·WebGL 없음 모두 OK)의 예외·콘솔 에러·빈 화면 + 스크린샷 `shots/smoke/`, `--gpu=off|none|swiftshader`), `npm run bundle-report`(청크별 gzip · 첫 화면 JS 380KB · 예산 360KB 초과 경고), CI `.github/workflows/ci.yml`(Node 24.18 고정 `app/.nvmrc`). 명세 ↔ 디자인 확인 목록 81줄은 [docs/spec-design-gaps.md](docs/spec-design-gaps.md)
- 2026-11-17 [관심사 이펙트: 땅굴 안 · 탐색 들판](docs/interest-effects.md): 아이디어 땅굴 12 · 들판 12 중 **땅굴 5(관심사 숨결 입자·관심사 카드·나와 같은 관심사·가장 드문 관심사·대표 관심사 빛줄기) · 들판 7(대표 관심사 말풍선·가까이 가면 펼쳐짐·옆 땅굴 이정표·겹치는 고리·드문 반짝·접속 중 활발·연기)** 구현. 3D 안이 아니라 WebGL 위 2D 겹 캔버스(`three/interestFx/`)라 저사양 배경 굽기·부분 그리기와 따로 돎(GPU rAF · 가속 꺼짐 20fps 가까운 것만 · weak·움직임 줄이기는 아이콘만). 켜고 끄기는 화면의 **"✨ 이펙트" 패널**(`components/FxPanel.tsx`, `lib/fxLab.ts`, 처음엔 추천 묶음, localStorage). 목 데이터: 들판 사람 관심사를 인원수 비례로, 예린에 다도 실험 아티팩트 https://claude.ai/artifact/9gE4UfgV4LntWwNJiWtkxu (브랜치 interest-effects, main 미병합). **2차 (같은 날 저녁, "더 다듬고 아이디어 더")**: 1차는 "예쁜데 무슨 관심사인지 안 읽힘" → 글자로 한눈에: 땅굴 위 **관심사 한 줄 요약**(♥ 겹침·✦ 드문 것 먼저, 올리면 가구에 불)·**입장 이름표**·배지/알약에 관심사 이름, 새로 **누르면 톡·인사하면 겹치는 관심사·말 걸어도 돼요 반딧불(목 데이터)·두더지가 알아챔**, 탐색 **🏮 관심사 등불**(`components/LanternPicker.tsx`)·**잘 맞는 이웃 신호·동네 이름표·미니맵 ♥**. 스티커 입자, 두더지 뒤 가림, 고리·♥는 들판 위쪽 1/4만(`closeSeatsOf`), 드문 기준 **`data/rarity.ts` 한 곳**. 3D fps 그대로, 1차의 첫 진입 긴 작업 의심은 반복 3번으로 잡음 확인, 가속 꺼짐 쉬기 늦어지던 것(`overlay.refresh`) 고침. **2026-11-18 main 에 합침: 처음 들어오면 이펙트 모두 꺼짐**(사용자 요청, "✨ 이펙트" 버튼으로 켬)
- 2026-11-17 [렌더링 실험 3: 가속 끈 PC 에서도 불편 없이, 화질 좋게](docs/rendering-experiments-3.md): 기기 단계 gpu/strong/weak(실제 그리기 시간, `lib/deviceTier.ts`, 실험실·`?tier=`), 예열 다시 짜기(`three/warm.ts`, 컴파일 기다리기 루프 하나), 선명한 배경 띠 굽기(`three/sharpBake.ts`, **캔버스와 같은 sRGB 렌더 타깃 + MSAA** → 땅굴 배경 GPU 대비 PSNR 36.9 → 51.6dB), 구운 배경 IndexedDB(다시 오면 0.5~1초에 선명한 그림), GPU 로 찍은 정지 그림 6장(`three/stills.ts`, 3D 경계·WebGL 없음·랜딩 로딩). 랜딩 첫 화면 멈춤 0.55 → 0.22초(2코어 0.99 → 0.44). 2코어 탐색 점프 끊김·카메라 이동 20fps 는 조금만 나아져 남음. 숫자 `explore/gpu/results/round3.json`

- 2026-11-17 [백엔드·디자인 전에 미리 한 일 정리](docs/prep-work-2026-11-17.md): 11-16 17:32 요청("미리 할 수 있는 일 목록 + 다 하기 + 가속 꺼진 PC 화질 + 새 링크")의 최종 정리. API·데이터 계층 / 실시간·안정성 / 테스트·CI·명세 확인 목록 / 그래픽 2·3차, 백엔드에 넘길 Q1~Q5 · 기획에 넘길 G-53·G-04·G-60·G-32·G-06. 11-16 18:30 PC 절전 → 밤 Windows 업데이트 재시작으로 작업이 끊겼다가 11-17 이어서 끝냄(작업 중에는 절전 막기 · 단계마다 커밋). 11-16 21:12 다른 PC에서 올린 땅굴 다양성 실험도 합침. 새 시험판 https://claude.ai/artifact/NH6JiBu6qKJmr1SNRR1fJ9
- 2026-11-17 [탐색 들판: 이동 중에도 배경 선명하게](docs/explore-move-quality.md): 가속 끈 PC 에서 "멈추면 선명 ↔ 움직이면 흐림"(이동 중 0.33배 + 도착 뒤 다시 굽기, 점프마다 1.2~1.6초 흐림)을 없앰. **점프를 시작할 때 도착 자리를 미리 굽고(두더지가 들어가는 0.42초 동안), 카메라 이동 0.4초는 떠날·도착 자리 구운 1배 그림을 바닥 평면 호모그래피로 옮겨 그림(그동안만 WebGL 캔버스 1배, `three/moveSlide.ts` gl), 도착하면 바로 바꿔 끼움** (실험실 M, `?fslide=0` 예전, `?slidemode=css` CSS 띠 밀기 시험판, `?movefreeze=0_5` 이동 멈춤). 이동 도중 선명도(GPU = 1) 0.86 → 0.95, 카메라 이동 16스레드 57.5fps(기준 57.6)·2코어 26(24.4), 점프 중 가장 긴 멈춤 줄어듦. 소프트웨어 합성기는 CSS 투영·기울임이 느리고 CSS 띠 밀기는 앱 안에서 gl 보다 못했음. 남은 것: 높은 물체(호박·울타리) 이동 한가운데 시차(깊이 재투영), 2코어에서 빈 곳을 메우는 먼 클릭 점프 17.5~20fps(기준 약 30). 숫자 `explore/gpu/results/move.json`, 그림 `explore/gpu/results/move/`
- 2026-11-18 [이펙트 도감 (팀 공유용 안내 페이지)](tools/effects-guide/README.md): https://claude.ai/artifact/KveYCfeoSQ27jcMzMeD5D9 — 디자이너·팀원이 관심사 이펙트 23개(사진 · 느린 PC에서 · 디자인 필요한 것 · 정할 것)를 보고 **쓰자 · 고민 · 빼자**, 아직 안 만든 아이디어 16개에 "만들어 보자", 같이 정할 질문 6개(처음 켜짐·입장 이름표 주기·대화 의향 설정·끄기 설정·멀리 보기 말풍선·드문 기준), 새 아이디어를 적고 **"내 의견 복사"로 팀 채팅에 붙임**(바깥 팀원은 아티팩트 db 에 못 써서 각자 브라우저에만 저장). 원본 `tools/effects-guide/effects-guide.html`, 사진 자르기 `crop.py`
- 2026-11-18 [관심사 태그 확정본 반영 (대분류 12 · 소분류 90)](docs/interest-tags-2026-11-18.md): 사용자 확정 목록을 **`app/src/data/interestTags.ts` 한 곳**(영어 id, 이름·이모지 그대로)에서 앱 전체가 읽음, 백엔드 code 표 [backend/interest-enum.md](docs/backend/interest-enum.md). 3D 는 예전 가구 세트 11개를 이어 붙임(**`data/interest3d.ts`**): 9개는 그대로, 스포츠 → 아웃도어 세트 · 외국어·자기계발 → 책 세트 · 덕질·수집 → 진열 벤치를 빌려 씀(같은 가구는 한 번만), 소품은 90개 중 51개. 목 인원수 31개 이어짐 · 59개 목(임시), 예린 데모(3개 겹침 · 차/다도 190명) 유지, 예전 이름 저장값은 새 이름으로 옮김. 이펙트 12개(공 · 말풍선 · 별 새로). 디자이너 요청(새 세트 3 · 소품 39)과 표기 질문은 문서에. `interestCatalog.json` 복사본 지움
- 2026-11-18 [탐색 들판 v3.10: 잔디 바닥 · 작물 5종 · 줌 3단계](docs/explore-field-v3-10.md): 디자이너 v3.10 반영. 흙 노드 규칙 그대로(안 켠 구역은 잔디만), **층→작물은 캠퍼스-층 목록 순서로 돌려 씀**(서울 2·3·12층 = 호박·사과·딸기, 실서비스는 서버 층 설정에 작물 값 제안), 줌 near·mid·far(휠·+/−·버튼, near·mid 타깃은 v3.9 camRect, far 만 한계 공식·구멍 중앙 정렬 막음, 두더지 배율 연속, 말풍선 far 8개). 가속 끔: 줌 아웃은 도착 그림을 기다렸다 움직임(2코어 4~5 → 16~22fps, 대신 시작 0.6~0.76초), 깊이 굽기는 멈춘 뒤, 흙을 12m 칸으로 나눠 2코어 near 점프 20 → 26fps(기준 23.8). 바닥 glb 흙만 양자화(1.5 → 0.94MB, 공유 탐색 청크 471KB → 1.58MB). 바깥 잔디 색 단차는 앱에서 맞춤. 디자이너에게 보낼 답(자리 재사용 30일 보류·안 켠 구역·내 땅굴로 돌아가기)과 알릴 것(바깥 잔디 색·사다리 아래 흙 네모·far 맞춤 남쪽 3.5m·glb 크기)은 문서 끝. 측정 `bash explore/gpu/zoom/run-zoom.sh`, 결과 `explore/gpu/results/zoom/`
- 2026-11-18 [땅굴 다양성 비교: 관심사가 달라도 방이 비슷해 보이나](docs/room-diversity-2026-11-18.md): 일부러 다르게 고른 16명 + 들판 이웃 10명, 26개 땅굴을 방문자 뷰 구도로 찍어 비교(가속 켬, 실험 경로 `/lab/rooms` · 찍기용 `?nomole=1` 추가). **벽지를 같게 놓으면 방 넓이의 83%는 26개 방 모두 빈 방과 같음**, 관심사 물건 넓이는 방 하나에 가운데 값 2.9%(0.7~13.7%), 325쌍 중 46%가 10%도 안 다름, 운동형 = 여행형(0.3%). 숫자가 큰 방은 거의 벽지(01 기본 · 02 별자리) 때문. 남의 땅굴 화면은 집주인이 고른 벽지를 안 받고 관심사로 다시 계산함(내 화면과 벽지가 다를 수 있음). 비교 페이지 https://claude.ai/artifact/7WKmPmpkapceCdXreAszCn (`tools/room-diversity/`, capture → analyze → build, 게시용 `out/`, 비공개로 시작). 다음 후보(자동 꾸미기 · 칠하기 · 벽지 · 디자이너 요청)는 판단 대기
- 2026-11-18 [땅굴 다양성 2: 벽지 문제 고치기 + 방이 사람마다 달라 보이게](docs/room-diversity-2-2026-11-18.md): **1단계** 내 땅굴(맨 앞 관심사)과 남의 땅굴(가장 무거운 대분류, 저장한 방 안 받음)의 벽지가 달랐던 것 → 방 모습을 **`data/roomLook.ts roomLookOf` 한 곳**에서(저장한 방 `BurrowDto.room` 먼저, 없으면 대표 관심사), 목 서버 → `toBurrow` → `VisitBurrow` 까지 전달, "나"를 두 화면으로 찍어 다른 픽셀 0%. **2단계** 대분류 12개 색 묶음(`data/roomStyle.ts CATEGORY_THEMES`: 벽 · 바닥 · 나무 뼈대 · 러그 · 가구 팔레트) + 회원 id 씨앗 자동 꾸미기(다른 벽 · 바닥 빛깔 · 무늬 · 모양). 껍데기는 구운 빛에 색 배율(three.js AgX 를 거꾸로 풀어 화면 색 그대로, 셰이더 그대로), 동물은 안 칠함. 26개 방: 벽지를 같게 놓고 빈 방과 같은 넓이 **82.9% → 2.6%**, 10% 안 다른 쌍 46% → 0.3%, 대분류가 다른 쌍 가운데 값 11% → 95%, 운동형 · 여행형 0.3% → 95%. 🎨 땅굴 색 다양하게 스위치(✨ 이펙트 패널 맨 위, `?look=designer`), 꾸미기 "색" 탭(`room.themeId`, 확인받을 것), 아주 느린 PC(weak)는 무늬 없이. 가속 끔에서 걷기 · 쉬는 중은 그대로, 첫 진입 가장 긴 멈춤 16스레드 176 → 270ms 쯤(원인 못 찾음), 구운 방 그림 캐시 키에 꾸미기 값. 비교 페이지를 전 · 후로 다시 만듦(같은 주소에 version 2, version 3 에서 1차 옛 사진 경로 지움). main 합침 뒤 테스트 258 · 스모크 98/98(켬 · 끔 · 없음). 같은 날 저녁 시험판 v5 · 팀 v36 에 올림. 사용자 답: 색감 괜찮음 · 랜딩 견본 방 그대로 · 꾸미기 색 탭은 팀원에게 물어보고 결정. 디자이너 요청(재질 나누기 · 러그 떼기 · 장식 · 액자 그림 · 묶음 색 검토) · 백엔드(`themeId`, 씨앗 = 회원 id)는 문서에
- 2026-11-18 [땅굴 방: 두더지가 가구를 돌아서 걷게](docs/room-pathfinding-2026-11-18.md): 바닥을 누르면 곧장 걷다 가구 발자리에서 clampRoom 에 밀려 변을 따라 미끄러지던 것(남의 땅굴은 집주인 두더지 둘레에서 10번 중 3번 멈춤) → **`three/roomPath.ts`** 가 걷기 시작할 때 발자리 모서리 12cm 바깥 점들로 가장 짧은 길(A*, 곧장 갈 수 있으면 예전 그대로), `moleActor walkStep` 은 다음 점이 보이면 앞당겨 넘어가 모서리를 살짝 둥글게 돎(`nav` 옵션, 땅굴 방만). 실제 앱 10쌍씩: 가구 변에 붙은 시간 가운데 값 내 땅굴 19 → 2% · 남의 땅굴 49 → 2%, 도착 7/10 → 10/10, 가속 꺼도 같음. `?nav=0` 예전, `?navdbg=1` 시험 손잡이, 다시 재기 `tools/room-path/nav-check.mjs`. 방향키 조종은 그대로
- 2026-11-21 [F2 시작하기 화면 Figma 맞춤](docs/f2-figma-2026-11-21.md): 로그인·회원가입·비밀번호 찾기 8화면을 Figma 03 시작 v2 수치·문구·구조로(패널 높이 Figma 와 일치). 두더지는 로고 두더지 `LogoMole`(`StartHeader.tsx`)로 통일 + 눈꺼풀 깜빡임. "비밀번호가 달라요"·캡스락 문구는 Figma 따름, 2/3 막대는 구현 유지. **#1 머지 후 안 쓰는 CSS 정리 목록은 문서에**
- 2026-11-20 [탐색 들판: far 에서 울타리 끊김 → 켠 구역 둘레로 닫기](docs/explore-fence-closing-2026-11-20.md): 원인은 카메라·안개·타깃 한계가 아니라 "안 켠 구역은 울타리 숨김" 규칙(켠 구역 안 조각만 그려 구역 1개면 18/174조각). 사용자 선택 B: 켠 구역을 1.5m 넓힌 경계를 따라 `fence.glb` 로 새 길을 세우고 걸친 둘레 조각은 잘라 맞춤(`three/fieldFence.ts`, 6구역 모두 켜면 v3.11 그대로). 새 길 모서리는 직각(모서리 조각 없음), 핸드오프 규칙과 달라 디자이너 확인 필요. `?fence=0` 예전. 시험 브랜치 `try/explore-v3-11`(v3.11 적용 + 마우스로 끌어 옮기기 커밋 2개, push 안 함)
- 2026-11-20 [탐색 방노트 사이드바 · 빵은 대전만 · GNB "게시판"](docs/explore-note-sidebar-2026-11-20.md): 사용자 결정. ① `cropOf` 빵은 대전 층 전부, 나머지 8종은 대전 아닌 층을 목록 순서로(서울 2·3·12 = 호박·사과·딸기, 광주 1 고구마, 구미 2·3 당근·옥수수, 부울경 1 토마토, 해바라기는 아직 안 나옴). ② 탐색(시안 A) 오른쪽 사이드바는 접힌 채 시작, 오른쪽 위 "방노트" 버튼으로 펼침(`?panel=open` 이면 펼친 채), 두더지 옆 안내판 카드는 없애고 "땅굴 놀러가기"를 사이드바 맨 아래로(Enter 입장은 그대로) — **02 F5 명세 2번(안내판)과 달라서 기획에 명세 갱신 요청 필요**. ③ GNB "커뮤니티" → "게시판"(메뉴 이름만, 화면 안 다른 "커뮤니티" 글자는 그대로). 시험 브랜치 `try/explore-v3-11`, push 안 함 **같은 날 밤 Figma(477:12524)와 맞춤**: 프로필 64px 베이지 원(`Avatar circle`, 두더지 `mole-face.png`=기존 그림에서 배경만 걷음) · 관심사 제목 줄(관심사 N + 범례) + 전부 색 칩(겹침은 테두리 + ✓, `InterestChip check`) · 땅굴 놀러가기는 칩 아래·Q&A 위 · Q&A 답변 들여쓰기. **2026-11-21 방문자 뷰도 같은 방노트**(`screens/burrow/RoomNote.tsx` 공용: 접힌 채 시작, 제목 칩 삭제, 방명록은 우체통 창 안에서 쓰기·읽기). **같은 날 방문자 뷰 팝업 7가지**(토글 "○○님 땅굴", 말풍선 아이콘, 대화 요청 팝업·토스트, 방명록 한 줄 입력·내 글 삭제·0개 안내, 깃발 → ReportDialog, Toast tone info) + 낙관적 패치가 방명록 캐시를 덮어쓰던 버그 수정(`patch exact`) **2026-11-21 대화 요청 팝업 정렬**(흙더미 벡터 두더지 `components/MoundMole.tsx`, 왼쪽 정렬) + **탐색 "추천 친구"**(안내판 라벨 통일 · 설정 · 질문 고르기 새로 · 결과·뒤집기를 Figma 에 맞춤, 추천 조건 질문이 문장 1개 → 질문 id 여러 개로 바뀜 `RecommendSettings.questions`) → 같은 docs 4장. 말풍선 3상태 규칙도 같은 docs **2026-11-21 추천 조건 "같은 층" · 질문 최대 3개 + ⓘ 토스트 · 단골 땅굴 카드형(1127:13203) · 캠퍼스-층 고르기 검색·스크롤(1265:35323, 고르고 [들어가기])** → 같은 docs 5장
- 2026-11-21 [탐색 · 방문 · 방명록을 바뀐 팀 명세에 맞춤](docs/explore-spec-sync-2026-11-21.md): 팀 명세(`~/Desktop/diguldigul/it-ting` origin/dev 05·04, api 05)에 맞춰 ① **오늘의 추천 친구 설정은 캠퍼스 · 층 + 기수만**(관심사·답이 궁금한 질문·질문 고르기·같은 질문 토글 삭제, 고른 값 저장 안 함, 남는 줄은 Figma 863:133 칩 · 안내 상자 · 추천 받기), 뽑기 = 그 캠퍼스·층 이번 학기 들판 + 같은 기수 + 단골 제외 + 추천 횟수 적은 순(같으면 무작위, 하루 한 번) ② **방명록 7일 자동 삭제 · 문구 삭제**, 서로 다른 3명이 신고하면 가려져 목록·글 수에서 빠짐(`visibleGuestbook`) ③ 방문자 뷰 대화 요청 뒤 말풍선 **"요청 보냄"**(누를 수 없음) ④ 새 학기 안내는 구현 안 하고 명세 요약만. 이전 결정(질문 최대 3개 `MAX_REC_QUESTIONS`, 질문 고르기)은 뒤집힘 — 옛 문서에 표시. 확인받을 것: 결과 안내문 "관심사가 비슷한", 설정 시안 없음(863:133 은 옛 설정)
- 2026-11-21 [관심사 v3.8 3단계: 앉은 두더지 · 길 찾기 · 구도](docs/room-interest-v3-8-step3.md): 브랜치 feat/room-interest-v3-8(push 안 함). 두더지가 노랑 방석에 앉아 시작(방문자 뷰는 집주인 노랑 · 손님 하늘), 동작 버튼은 일어나 방석 앞에서 하고 다시 앉기, 걷다 멈추면 5초 뒤 복귀(`MoleActor.setHome/sitHome/sitHomeNow/isSeated`, roomScene 안에서만 → #3 파일 안 건드림). 원탁 네모 발자리가 방석 앞 시작점을 막아 두더지가 원탁을 도는 버그 → 십자 모양. 걷기 시험 23경로 박힘 0·복귀 O(`tools/room-path/walk-check-v38.mjs`). 구도 `ROOM_FRAME` h 1.0 → 0.89(돔 꼭대기는 그대로, 앞쪽 반려동물 자리가 버튼 줄·패널에 안 가리게. `tests/room-frame.test.ts`). roomStyle 침대·협탁 코드 삭제(자동 꾸미기 값 한 번 달라짐). 3D 담당 메모(빈자리 · 공용 자리 제안) [3d-memo-v3-8-empty-floor.md](docs/3d-memo-v3-8-empty-floor.md)
- 2026-11-21 [관심사 v3.8 4~5단계: 낙하 확인 · 꾸미기 소품 탭](docs/room-interest-v3-8-step4-5.md): 낙하는 2단계에서 이미 새 규칙(drop_by_height · pop)으로 연결돼 있어 곡선·계획 테스트만 추가(새 관심사를 고르면 장면이 다시 만들어져 방 전체가 다시 떨어짐, 새 관심사 것만 떨어뜨릴지는 기획 확인). 소품 탭(`DecorPanel.tsx PropTab`): 칩 = 단어를 고를 수 있는 내 관심사(57개 중), 후보 = 단어마다 모델 1개, 고르면 `roomScene.applyFurniture` 가 방 배치를 다시 계산해 달라진 것만 pop 으로 바꿔 놓음. 썸네일은 임시 카드(진짜 131개는 `assets/prop-thumbs/<노드>.webp` 로 넣으면 자동). `MyBurrow.tsx` 안 고침
- 2026-11-21 [3D 패치 v3.8.1 적용](docs/room-interest-v3-8-1.md): 방 `room_base_v3_1`(고정 장식 5개: 수납장·스탠드·큰 화분·러그 2, 러그는 발자리 없음), `slots.json` 54칸, 작은 소품 배정 순서(선반·선반·바닥·선반·바닥·선반·바닥·바닥·선반·바닥, 바닥 1.4배, 원탁 위 칸 23·24 는 json 에만 두고 앱에서 안 씀), 썸네일 131개(`assets/prop-thumbs/`, 전부 있음 테스트). 걷기 시험 박힘 0. 원본 `design/digul_3d_handoff_interest_v3_8_1/`
- 2026-11-22 [모임 카테고리 6개 · 플랫폼 이름 삭제](docs/meetup-category-2026-11-22.md): 모임 분류를 관심사에서 **모임 전용 카테고리 6개**(취미/문화·식사/카페·스터디/프로젝트·기타·게임·운동, 명세 07)로, 만들기의 온라인 플랫폼 칸 삭제(D4). M15·M16 은 "명세로 뒤집힘". `data/meetupCategory.ts` 한 곳, `Meetup.interest` → `category`, 목록 필터 `categories`(코드). 관심사 태그(최대 3개)도 명세대로 삭제, 명세 06 채팅 "대표 관심사" 문구는 명세 수정 요청. 캠퍼스 표기 삭제는 앞서 같은 방향(명세 07 "모임에는 캠퍼스와 플랫폼 이름을 두지 않는다")
- 2026-11-22 [두더지 mole_v1_4 적용](docs/mole-v1-4-2026-11-22.md): 앱 `mole.glb`(v1_3)와 채팅 `mole_chat.glb`를 **`mole_v1_4_draco_webp.glb` 하나**로(`three/moleModel.ts`), 눈 트랙 빼는 임시 처리 삭제. 채팅방은 `mole` 노드 +0.03 때문에 그룹 높이를 `SIT_Y − MOLE_NODE_Y`로(땅굴 방·탐색은 v1_3 때부터 같아 그대로). 반복 동작 8개는 시작 시간 0.0417초 이음매 1프레임 멈칫을 `trimLoopSeams`로 없앰. 원본 `design/digul_3d_handoff_mole_v1_4/`
## 남은 아이디어 / 미확인
- **다음에 할 일은 [docs/next-steps.md](docs/next-steps.md)**
- 390px 실제 모바일 화면은 스크린샷으로 확인 못 함
- 썸네일 생성이 느린 문제 (필요하면 지연 생성)
- 2026-11-11 [저사양 모드 아이디어 모음](docs/gpu-lowspec-ideas.md): 한 것(감지·안내 띠·품질 묶음·쉬면 멈춤·땅굴 부분 다시 그리기)과 남은 아이디어 9개. **해 볼 순서: 탐색하기 배경 한 번 + 두더지만 → 스톱모션 8~10fps + 카메라 고정 → 가끔 숨쉬기 → 그래도 부족하면 Worker**. 맥처럼 WebGL이 아예 없는 경우는 대응 안 함
- 2026-11-12 [저사양 실험실: 아이디어 9개 구현·측정](docs/gpu-lowspec-ideas.md) ("구현 결과"): 🧪 패널(app/src/components/LowLab.tsx, 상태 lib/lowLab.ts)로 하나씩 켜고 끔. 이 PC에서 크롬을 CPU 2코어로 묶어 실제 WARP로 측정. **A(움직이지 않는 것은 렌더 타깃에 한 번, 두더지만 매 프레임, three/staticBackdrop.ts)가 가장 효과 큼**: 탐색하기 걷기 페이지 8.7 → 60fps, 땅굴 들어올 때 15 → 52fps. B·C·I·G·H·F 완성, D(땅굴 Worker, three/worker/)·E(2D 두더지, three/moleSprites.ts) 시험판. 추천 기본 A+B10+C+I. 테스트 안내는 같은 문서 끝. 2026-11-12 **S 방은 선명하게**(멈춰 있을 때 방만 고해상도로 한 번 그려 2D 캔버스에 깔고 두더지만 저해상도, 2코어에서 한 번 0.5초) 기본 켬. **N 가구는 처음부터 제자리**(가구 낙하 끔, 방은 첫 프레임부터 선명) 기본 켬
- 2026-11-12 [커뮤니티 요구사항 명세 검증](docs/community-spec-review.md): **02 페이지만 기준**(03은 디자인 참고용)으로 F8을 CRUD 검토. 글 삭제·댓글 수정·댓글 삭제·저장한 글 명세가 없음. 02 안에서 카테고리 목록이 4곳 모두 다르고, 정렬(댓글순/게시순)·인기 글(1일/7일)·더 보기(비활성/숨김)·안내 문구가 주석과 명세 표에서 다름. 다른 섹션과도 어긋남: F9 댓글 좋아요 알림·F11 댓글 숨김이 있는데 F8엔 댓글 좋아요 토글·댓글 신고가 없음, 글쓴이 카드 "반" 표기는 F0와 충돌. 뽑은 텍스트는 `design/figma/spec/`
