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

## 파일
| 경로 | 내용 |
|---|---|
| `itting-prototype.html` | 프로토타입 전체 (단일 파일, 약 280KB). **이게 원본** |
| `itting-mole.html` | 두더지 시안 (v3에서 갈라진 별도 시안, 약 300KB). 이 파일이 시안의 원본 |
| `archive/itting-v2.html` | v2 백업 |
| `tools/serve.js` | 로컬 미리보기 서버 (`PORT=… node tools/serve.js <파일>`) |
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

## 남은 아이디어 / 미확인
- 390px 실제 모바일 화면은 스크린샷으로 확인 못 함
- 썸네일 생성이 느린 문제 (필요하면 지연 생성)
