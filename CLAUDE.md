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
  - Pretendard는 CDN 대신 npm `pretendard`로 번들 (아티팩트는 외부 CSS 차단)
  - 아티팩트는 `.glb` 파일을 못 올림 → 공유 빌드에서만 glb를 data URL로 JS에 넣음(`vite.config.ts`의 `assetsInlineLimit`), `three/glb.ts`가 fetch 없이 직접 풀어서 parse. Draco는 안 씀(해독기 wasm을 올려야 해서) → 텍스처 WebP + 메시 양자화
- **3D 핸드오프 v1** (`design/digul_3d_handoff_v1/`, 문서 `docs/HANDOFF_v1.md`): 디자이너가 만든 두더지 glb(동작 19개)·굴 입구 소품. 영상은 gitignore(디자이너 zip에 있음). 방·가구 glb는 아직 작업 중
  - 땅굴 방 두더지는 이 glb로 교체: `app/src/assets/models/mole.glb`(원본에서 텍스처만 1024 WebP, Draco 없음) + `app/src/three/moleActor.ts`(동작 순서). 탐색하기 밭은 아직 예전 코드 두더지(`mole.ts`)
- **3D 핸드오프 v1.1·v2** (`design/digul_3d_handoff_v1_1/`, `design/digul_3d_handoff_v2/`, 2026-11-11): 액세서리 41개(`three/moleDress.ts`, 목록·규칙 `data/moleItems.ts`)와 땅굴 방 glb(`three/roomScene.ts`, 가구는 `data/furnitureCatalog.json`을 읽음). 변환·판단은 [docs/3d-handoff-v2-integration.md](docs/3d-handoff-v2-integration.md). 관심사 가구 31개는 아직 안 옴
  - 가구 클릭: 방석·빈백 앉기, 부엌·찻병 선반 커피. 리액션 버튼 👋👀🐾☕. 남의 땅굴엔 집주인 두더지가 있고 인사하면 마주 보고 인사. 엉덩이 씰룩은 굴 입구 전용 자세라 방에서 뺌
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

- 2026-11-10 [프론트엔드 기술 가이드](docs/frontend-guide.md): 사용자 학습용. 앱 구조, React 상태, 라우팅(브라우저 vs 해시), 토큰·CSS Modules, TS 타입, 3D를 React에 넣는 법(경계·정리·루프·지연 로딩·레이캐스트), 빌드·배포, 공부 순서. README도 현재 상태로 다시 씀
- 2026-11-11 [개발·배포·백엔드 연결 위험 지점](docs/dev-deploy-risks.md): 코드 근거로 정리. 가장 큰 것은 비동기 전환 시 `<Navigate>` "없음" 처리·로딩/에러 경계 없음, 날짜 형식 혼재(ISO vs "2시간 전")·시간대, 채팅방 전환 시 이전 메시지가 남는 버그(`<Room>`에 key 없음), 브라우저 라우터 새로고침 404·재배포 후 청크 404, 인증 가드 없음. 바로 할 예방 작업 Top 8과 백엔드 합의 체크리스트·API 규약 초안 포함
- 2026-11-11 [마케팅 전략: SSAFY에서 시작해 밖으로](docs/marketing-strategy.md): 사례(Facebook·Gas·BeReal·에브리타임·싸이월드·Clubhouse·Gather) 조사. **반 단위 오픈 → 캠퍼스 → 기수**, 첫 5분 안에 내 땅굴 + GPU 대응, 땅굴 공유 카드, 인싸에게는 "홍보" 대신 "먼저 써 보기·방명록", 매터모스트 공지는 소식 있을 때 2~3번. 모방 심리는 압박 대신 "반 지도에 켜지는 땅굴"로. 확장은 새 밭을 여는 방식(부트캠프·대학 → 관심사 커뮤니티). 운영 규정·SSAFY 이름 사용은 확인 필요
- 2026-11-11 [그래픽 가속이 꺼진 PC 대응](docs/gpu-fallback-research.md): 실측 결과 크롬 157은 가속을 끄면 WARP(CPU)로 그림. 그림은 같지만 땅굴 3fps·탐색 1.1fps이고 메인 스레드가 막혀 **페이지 전체가 멈춤**. WebGL이 아예 없으면 636px 자리표시가 흐리게 늘어남(또 다른 "깨짐" 후보). 감지는 `failIfMajorPerformanceCaveat` + 렌더러 문자열로 확실하게 가능. `chrome://` 링크는 막힘(실측) → 안내는 주소 복사 방식. **추천: 감지 → 저사양 모드(해상도 0.5·후처리 끔·그림자 축소·잔털 0, 236→52ms) + 가만히 있으면 그리기 멈춤 + 안내 띠**, 자리표시 그림 고해상도로 교체. 캐릭터 만들기는 이미 2D SVG라 GPU 불필요. 다음: 실제 SSAFY PC에서 `chrome://gpu` 확인. 실험 코드 `explore/gpu/`
- 2026-11-11 [Figma 최신 버전 반영](docs/figma-sync-2026-11-11.md): 메타데이터를 새로 받아 어제 것과 diff → 이름 변경·옛 시안 삭제·5xx~6xx 새 프레임으로 최신 버전 확정. 온보딩 1 "이름·두더지 꾸미기"·온보딩 4 땅굴 미리보기 새로 만듦, 땅굴(꾸미기·내 정보 수정·방명록 빈 상태·팝업·토스트), 게시판(글쓰기·저장한 글·삭제/신고), 모임(만들기 새 배치·대기 팝업), 채팅(1:1·요청), 알림 페이지·설정 추가. Figma 호출 5번. 못 한 것: 얼굴·목·손 아이템 실제 목록, 채팅 요청·모임 탭 대조, Figma 메모로만 있는 기능 요청
- 2026-11-11 [3D 핸드오프 v1.1·v2 반영](docs/3d-handoff-v2-integration.md): 두더지 액세서리 41개(정식 아이콘, 부위마다 1개 최대 4개, 레벨·관심사 잠금, 리본+캐리어 불가)를 3D 두더지 소켓에 입힘(리본 흔들림·풍선 세우기·손 소품 숨김), 온보딩 1 미리 보기는 3D 회전. 땅굴을 코드로 만든 방 → 디자이너 glb 방(구운 조명, AgX, 스펙 카메라·조명, 카탈로그 기반 가구, 하늘색 방석 앉기, 천장 구멍 열림→낙하→닫힘). 후처리·그림자 맵을 없애 가벼워짐. Draco 대신 WebP + 양자화. 관심사 가구는 glb가 아직 없어 새 방에서 빠짐
## 남은 아이디어 / 미확인
- **다음에 할 일은 [docs/next-steps.md](docs/next-steps.md)**
- 390px 실제 모바일 화면은 스크린샷으로 확인 못 함
- 썸네일 생성이 느린 문제 (필요하면 지연 생성)
