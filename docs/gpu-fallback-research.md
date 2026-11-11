# 그래픽 가속이 꺼진 PC 대응 조사

- 날짜: 2026-11-11
- 요청: SSAFY 교육장 PC는 크롬 "그래픽 가속"이 꺼져 있어서 화면이 깨져 보이고, 켜는 법을 몰라 사람들이 많이 떠날 것 같다. 해결 아이디어를 찾고, 방법마다 가능성과 난이도를 정리한다. 사용자가 낸 방법은 (1) 켜는 법 안내 알림 (2) 그래픽카드 없이 캐릭터 만들기 (3) 그래픽을 낮춰서 만들기. 한 번에 끝내지 않고 결과를 다시 검증한다.
- 실험 코드: `explore/gpu/` (아래 "재현 방법" 참고). 측정 결과 JSON은 `explore/gpu/results/`에 있다.

## 결론 요약

1. **"깨져 보임"의 원인은 두 가지일 수 있다** (어느 쪽인지는 실제 SSAFY PC에서 확인해야 함)
   - **A. 소프트웨어 렌더링**: 가속을 끄면 크롬 157은 CPU로 그리는 WARP("Microsoft Basic Render Driver")를 쓴다. **그림은 GPU와 똑같이 나온다.** 대신 땅굴은 **3fps**, 탐색하기는 **1.1fps**로 떨어지고, 메인 스레드가 16초 중 15초 넘게 막혀서 **3D만이 아니라 버튼·패널·스크롤까지 같이 멈춘다.** 키 입력이 화면에 나오기까지 0.4~0.6초가 걸린다.
   - **B. WebGL을 아예 못 쓰는 경우** (예전 크롬, 블랙리스트 GPU, 관리 정책 등): 앱은 자리표시 그림 `room-cutout.png`(636px)를 약 1300px로 늘려 보여 준다. **흐리게 뭉개져 보이고, 실제 내 방과 가구도 다르다.**
2. 가속이 꺼졌는지는 페이지에서 **확실하게 알 수 있다.** 서로 다른 신호 세 가지가 모두 일치했다: 렌더러 문자열, `failIfMajorPerformanceCaveat`, WebGPU 어댑터.
3. 웹페이지는 `chrome://settings`를 **어떤 방법으로도 열 수 없다** (네 가지 모두 막힘). 안내 알림은 "주소 복사 → 주소창에 붙여넣기"로 만들어야 한다.
4. 화질을 낮추면 한 프레임에 걸리는 시간이 **236ms에서 52ms로(약 4.5배)**, 더 낮추면 **19ms로(12배)** 줄어든다. 그래도 계속 그리면 화면이 버벅이므로 **가만히 있을 때는 그리지 않기(render on demand)**를 같이 해야 한다.
5. 캐릭터 만들기는 이미 GPU가 필요 없다. 온보딩의 2D SVG 아바타(`MoleAvatar.tsx`)는 가속이 꺼져도 60fps로 돈다. 남은 문제는 방 안의 3D 두더지뿐이다.

**추천 조합 (가능성이 높은 순서)**
1. **감지 + 저사양 모드 자동 전환** (3번 방법): 가장 효과가 크다. 사람이 아무것도 하지 않아도 된다
2. **감지했을 때만 띄우는 안내 띠** (1번 방법): 가속을 켤 수 있는 사람은 원래 품질로 돌아오게
3. **WebGL이 없을 때 쓸 고해상도 정지 그림 + 2D 두더지** (B 대응, 2번 방법의 연장)

## 방법별 비교

| 방법 | 가능성 | 난이도 | 예상 작업량 | 효과 | 한계 |
|---|---|---|---|---|---|
| 감지 (렌더러 문자열 + caveat) | 높음 (실측) | 쉬움 | 반나절 | 다른 대응의 전제 | 크롬이 문자열을 숨기면 caveat 신호만 남음 (둘 중 하나만 써도 충분) |
| (1) 켜는 법 안내 알림 | 높음 | 쉬움 | 반나절 ~ 1일 | 가속을 켜면 원래 품질 + 60fps | 링크로 설정을 못 엶(실측). 관리 정책으로 잠긴 PC, 블랙리스트 GPU면 켜도 소용없음. 다시 시작할 때 입력하던 내용이 사라질 수 있음 |
| (3) 저사양 모드 (자동) | 높음 (실측) | 보통 | 1 ~ 2일 | 3fps에서 약 9~30fps, 가만히 있을 때 UI가 막히지 않음 | 그림자·AO·질감이 줄어 덜 예쁨. 탐색하기도 따로 손봐야 함 |
| 그리기 멈추기 (render on demand) | 높음 | 보통 | 1일 | 가만히 있을 때 메인 스레드가 놀아서 버튼·스크롤이 정상 | 두더지가 움직이는 동안은 여전히 느림 |
| (2-a) 2D SVG 캐릭터 만들기 | 이미 됨 | — | 0 | GPU 없이 60fps | 3D 두더지와 모양이 다름 (2D는 액세서리가 있고 glb에는 아직 없음) |
| (2-b) 미리 렌더한 두더지 이미지 층 쌓기 | 보통 | 보통 ~ 어려움 | 3 ~ 5일 (액세서리 3D 모델이 있어야 함) | 3D와 같은 모양의 두더지를 GPU 없이 보여 줌 | 움직임까지 하려면 용량이 커짐 (아래 계산) |
| 고해상도 정지 그림 폴백 (B 대응) | 높음 | 쉬움 | 반나절 | 흐린 636px 그림 대신 선명한 그림 | 내 방 가구와는 다름 (기본 방 그림) |
| 서버에서 내 방 그림 미리 렌더 | 보통 | 어려움 | 백엔드 + 헤드리스 렌더 서버 | 내 방과 똑같은 정지 그림 | 백엔드가 아직 없음. 방이 바뀔 때마다 다시 렌더해야 함 |
| 크롬 플래그·정책으로 강제 켜기 | 낮음 | — | — | — | 웹페이지가 할 수 없음. 학원 관리자에게 정책(`HardwareAccelerationModeEnabled`) 변경을 요청하는 건 가능 |

## 측정 환경
- 이 PC: NVIDIA RTX 5060 Ti, Chrome 157.0.8103.50, Edge 157.0.4341.42, 창 1920×1080, devicePixelRatio 1, 헤드리스(`--headless=new`)
- "가속 꺼짐"은 새 프로필의 `Local State`에 `hardware_acceleration_mode.enabled=false`를 넣어 재현했다. 설정 화면의 토글이 바꾸는 값과 같다. `--disable-gpu` 플래그로도 결과가 같았다
- 소프트웨어 렌더러는 CPU를 쓰므로 실행할 때마다 ±30% 정도 차이가 났다 (같은 설정이 236ms, 370ms로 나옴). 비율만 믿을 것

## 1. 감지

| 신호 | 가속 켜짐 | 가속 꺼짐 (설정) | `--disable-gpu` | Edge 꺼짐 |
|---|---|---|---|---|
| `WEBGL_debug_renderer_info` 렌더러 | `ANGLE (NVIDIA, … RTX 5060 Ti … D3D11)` | `ANGLE (Microsoft, Microsoft Basic Render Driver … D3D11)` | 같음 | 같음 |
| `getContext(…, {failIfMajorPerformanceCaveat:true})` | 컨텍스트 받음 | **null** | null | null |
| WebGPU `requestAdapter()` | nvidia / blackwell | **null** | null | null |
| 속도 시험 (1024² 셰이더 10회) | 0.5 ~ 1.8ms | 107 ~ 129ms | 126ms | 107ms |

- 크롬 157에서는 렌더러 문자열이 가려지지 않고 그대로 나온다
- 감지 코드 초안 (3D 코드를 불러오기 **전에** 실행. 몇 ms면 끝남):
  ```ts
  function graphicsTier(): 'gpu' | 'software' | 'none' {
    const c = document.createElement('canvas')
    const fast = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ?? c.getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (fast) { fast.getExtension('WEBGL_lose_context')?.loseContext(); return 'gpu' }
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return 'none'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    // r 예: "Microsoft Basic Render Driver"(WARP), "SwiftShader", "llvmpipe" → 기록용
    return 'software'
  }
  ```
- 보조 수단: GPU는 있지만 약한 PC(오래된 내장 그래픽)는 위 신호가 'gpu'로 나온다. 그래서 처음 2초 동안 프레임 시간을 재서 평균 50ms가 넘으면 저사양으로 내리는 감시도 같이 두면 좋다

## 2. "깨져 보임"의 정체 (실제 앱 측정)

현재 커밋(a496fa0)을 빌드해서 CDP로 rAF 프레임 간격과 긴 작업(long task)을 쟀다 (`cdp-measure.mjs`). 앱 코드는 고치지 않았다.

| 화면 | 모드 | fps | 프레임 간격 중앙값 | 두 프레임 걸리는 시간 | 긴 작업 (측정 약 16초 중) |
|---|---|---|---|---|---|
| 내 땅굴 `/burrow` | 가속 켜짐 | 59.9 | 17ms | 26ms | 2.0초 (첫 로딩) |
| 내 땅굴 | **가속 꺼짐** | **3.0** | 317ms | 363ms | **15.4초** |
| 탐색하기 `/burrow/explore` | 가속 켜짐 | 59.9 | 17ms | 29ms | 2.2초 |
| 탐색하기 | **가속 꺼짐** | **1.1** | 867ms | 630ms | **15.5초** |
| 게시판 `/board` (3D 없음) | 가속 꺼짐 | 59.9 | 17ms | 31ms | 0.08초 |
| 내 땅굴 | WebGL 없음 (`--disable-webgl`) | 59.9 | 17ms | 25ms | 0.1초, 자리표시 그림만 보임 |

- 가속을 꺼도 그림 자체는 GPU와 거의 픽셀 단위로 같았다 (`results/full-chrome-gpu.png`와 `full-chrome-hwoff.png` 비교). 즉 A의 "깨짐"은 **화면이 망가지는 게 아니라 끊기고 멈추는 것**
- WebGL이 없으면 `results/app-room-nowebgl.png`처럼 흐린 자리표시 그림이 보인다 (B)

## 3. 저사양 모드: 무엇이 무거운가

벤치 페이지(`explore/gpu/`)에서 땅굴 장면을 설정만 바꿔 가며 그렸다. 숫자는 가속을 끈 상태에서 **한 프레임을 다 그릴 때까지 기다린 시간**이다. 가속을 켜면 4.7ms. 벤치는 펠트 두더지 버전이고, 앱의 방은 지금 glb 두더지로 바뀌었다. 탐색하기는 아직 펠트 두더지(잔털 셸 12겹)를 쓴다.

| 설정 | 프레임 시간 | 기준 대비 |
|---|---|---|
| 현재 그대로 (GTAO 16샘플 + 색보정 + 2048 PCFSoft 그림자 + 잔털 12겹, 해상도 1배) | 236 ~ 370ms | 1 |
| GTAO 끔 | 209ms | 약 0.7 |
| GTAO + 색보정 끔 | 184ms | 0.6 |
| 후처리 전부 끔 | 246ms | (편차 범위) |
| 후처리 끔 + 그림자 끔 | 199ms | 0.65 |
| 후처리 끔 + 그림자 1024 Basic | 171ms | 0.55 |
| 후처리 끔 + 잔털 0겹 (삼각형 32만 → 16만) | 145ms | 0.45 |
| 해상도 0.5배만 (후처리 유지) | 206ms | 0.65 |
| 후처리 끔 + 해상도 0.5배 | 95ms | 0.3 |
| **lite**: 후처리 끔 + 그림자 1024 Basic + 잔털 0 + 해상도 0.5배 | **52ms** (실제 rAF 8.7fps) | **0.17** |
| lite, 해상도 0.75배 | 88ms (4.2fps) | 0.28 |
| **ultra**: lite + 그림자 끔 + 환경광·점광원 끔 + 안티앨리어싱 끔 | **19ms** (31fps) | **0.06** |

- 하나씩 끄면 효과가 15~40%에 그친다. **해상도 × 후처리 × 삼각형 수**는 서로 곱해지므로 묶어서 꺼야 크게 줄어든다
- 그림 비교: `results/off-lite.png`는 원본에 꽤 가깝다 (그림자·색감 유지, 조금 흐림). `results/off-ultra.png`는 그림자가 없어 평평하지만 알아볼 만하다
- 저사양 모드 제안 (`engine.ts`에 `tier`를 넘기는 방식):
  - 해상도 0.5~0.6배 (`setPixelRatio`, CSS로 늘림)
  - EffectComposer를 빼고 `renderer.render` 직접 호출 (GTAO·N8AO·색보정 끔). 색감은 톤매핑·노출로만 맞춤
  - 그림자: 1024 Basic으로 줄이거나, 끄고 두더지·가구 밑에 동그란 그림자 판을 깔기
  - 탐색하기 펠트 두더지는 잔털 셸 0겹 (`MOLE_FELT.shells = 0`)
  - **가만히 있을 때는 그리지 않기**: 두더지가 쉬는 중이고 입력이 없으면 루프를 세움. 움직일 때만 15fps 정도로 그림 → 이때 버튼·스크롤이 정상으로 돌아옴
  - 첫 프레임(셰이더 컴파일 포함)도 2~6초 걸리므로 그동안은 정지 그림을 보여 주고, 다 되면 바꿔 끼우기

## 4. (1) 켜는 법 안내 알림

### 웹페이지에서 설정 화면을 열 수 있나 → 없음 (실측)
| 시도 | 결과 |
|---|---|
| `<a href="chrome://settings/system">` 클릭 | 막힘. 콘솔: `Not allowed to load local resource: chrome://settings/system` |
| `target="_blank"` 링크 | 막힘 (같은 오류) |
| `location.href = 'chrome://settings/system'` | 막힘 |
| `window.open('chrome://settings/system')` | `null`, 막힘 |

→ **"주소 복사" 버튼 + "새 탭 주소창에 붙여넣고 Enter"** 안내로 대신한다. Edge는 주소와 메뉴 이름이 다르다.

| 브라우저 | 붙여넣을 주소 | 메뉴 경로 | 토글 이름 |
|---|---|---|---|
| Chrome | `chrome://settings/system` | 설정 → 시스템 | 가능한 경우 그래픽 가속 사용 |
| Edge | `edge://settings/system` | 설정 → 시스템 및 성능 | 사용 가능한 경우 그래픽 가속 사용 |

브라우저 구분은 `navigator.userAgentData?.brands`에서 "Microsoft Edge"가 있는지 보면 된다.

### 한계
- **관리 정책**: 학원 관리자가 정책 `HardwareAccelerationModeEnabled=false`로 막아 두면 토글이 회색이고 "조직에서 관리"라고 나와서 바꿀 수 없다. 이때는 안내가 소용없으므로 저사양 모드가 꼭 필요하다
- **GPU 블랙리스트**: 드라이버가 오래되어 크롬이 GPU를 막아 둔 PC는 토글을 켜도 여전히 소프트웨어로 그린다. 그래서 안내 뒤에도 감지를 다시 해서 그래도 'software'면 안내를 다시 띄우지 않는다
- **다시 시작**: 토글 옆 "다시 시작" 버튼은 열린 탭을 복원한다 (문서 근거. 헤드리스로는 이 버튼을 누를 수 없어 직접 확인은 못 함). 입력하던 글은 사라질 수 있으므로, 글쓰기 중에는 띄우지 않는다
- 바꾼 뒤 확인은 `chrome://gpu`에서 "WebGL: Hardware accelerated"로 나오는지 보면 된다

### 띄우는 조건
- `graphicsTier() === 'software'`일 때만. 'gpu'면 띄우지 않고, 'none'이면 "이 브라우저에서는 3D를 볼 수 없어요" 쪽 문구로
- 첫 방문에 한 번, 화면 아래 띠 형태로 (3D를 가리는 모달은 쓰지 않음. 어차피 저사양 모드가 돌고 있으므로)
- "다시 보지 않기"를 누르면 `localStorage`에 기억. 다음 방문에 감지 결과가 'gpu'로 바뀌어 있으면 "선명해졌어요!" 토스트를 한 번 띄움

### 문구 초안
> **그래픽이 잘 보이지 않나요?** 지금은 그래픽카드를 쓰지 않는 모드라 땅굴이 느리게 움직여요. 설정 하나만 바꾸면 선명하고 부드러워져요. 간단해요!
>
> 1. [주소 복사] 버튼을 누르고 새 탭 주소창에 붙여넣기 (`chrome://settings/system`)
> 2. **가능한 경우 그래픽 가속 사용**을 켜기
> 3. 옆에 나오는 **다시 시작** 누르기 (열린 탭은 그대로 돌아와요)
>
> [주소 복사] [이대로 볼게요]

토글 위치를 보여 주는 작은 스크린샷(또는 GIF) 한 장을 같이 넣으면 좋다.

## 5. (2) 그래픽카드 없이 캐릭터 만들기

- **이미 되어 있다**: 온보딩의 두더지 꾸미기는 2D SVG(`app/src/components/MoleAvatar.tsx`)라 WebGL을 쓰지 않는다. 털 색 8개 × 부위 4곳(모자·안경·목도리·소품) 액세서리 18개. 가속을 꺼도 60fps (게시판과 같은 DOM 화면)
- 남은 차이: 방 안의 3D 두더지(glb)에는 털 색·액세서리가 아직 반영되지 않는다. 그래서 "2D로 만들었는데 3D는 다르다"는 문제는 GPU와 상관없이 따로 남아 있다
- **미리 렌더한 이미지로 3D 같은 두더지 보여 주기** (저사양·WebGL 없음 화면용):
  - 털 색: 회색조로 한 장 렌더하고 CSS `mix-blend-mode: multiply`나 캔버스 2D 틴트로 8색을 만들면 색마다 따로 렌더할 필요가 없다
  - 액세서리: 같은 카메라로 액세서리만 투명 PNG로 렌더해서 겹친다. 정면 1방향 512px WebP 기준 장당 30~60KB → 몸통 1 + 액세서리 18 = 19장, **약 0.6~1MB**
  - 조합 수: 8색 × 부위별(없음 포함) 조합이 수천 가지라 조합마다 렌더하는 건 안 됨 → 층 쌓기만 현실적
  - 움직임: 숨쉬기·깜빡임 정도는 CSS(살짝 늘였다 줄이기 + 눈 층 교체)로 충분하다. 걷기 같은 동작을 스프라이트로 하면 19층 × 프레임 수만큼 늘어나서(24프레임이면 약 450장) 비현실적
  - 전제: 액세서리 3D 모델이 있어야 렌더할 수 있다 (핸드오프 v1에는 아직 없음) → 지금 당장은 2D SVG를 쓰는 게 맞다

## 6. 그 밖의 아이디어
- **자리표시 그림 교체** (B 대응, 가장 싸다): 지금 `room-cutout.png`는 636px라 크게 늘리면 뭉개진다. GPU PC에서 기본 방을 1920px로 한 장 렌더해 WebP로 넣으면 끝. 3D가 뜨기 전 로딩 화면도 같이 좋아진다
- **WebGL 없음 화면**: 정지 그림 + 2D 두더지를 겹쳐 놓고 가구 이름표만 HTML로 띄우면 "방 구경"은 할 수 있다
- **자동 품질 조절**: 'gpu'로 감지돼도 처음 2초 평균 프레임 시간이 50ms를 넘으면 lite로, 20ms를 넘으면 해상도만 낮추기
- **탭이 안 보일 때 멈춤**은 이미 되어 있다 (`startLoop`의 visibilitychange)
- 학원 측에 요청: 관리 정책으로 꺼 둔 거라면 관리자에게 `HardwareAccelerationModeEnabled`를 켜 달라고 요청하는 게 근본 해결이다 (학생 PC 전체가 한 번에 바뀜)

## 검증에서 바뀐 점
처음 조사 뒤, 핵심 주장마다 다른 방법으로 다시 확인했다.

| 처음 생각 | 다시 확인한 방법 | 결과 |
|---|---|---|
| 가속을 끄면 크롬이 SwiftShader로 그린다 (예전 노트·헤드리스 옵션 기준) | 크롬·엣지 실측 + Chromium 공지 | **바뀜**: 크롬 157은 WARP("Microsoft Basic Render Driver")를 쓴다. SwiftShader 자동 폴백은 크롬 130부터 없어지는 중. 감지할 때 "SwiftShader"만 찾으면 놓친다 → caveat 플래그를 주 신호로 |
| "깨져 보인다" = 그림이 깨짐 | GPU와 꺼짐 상태 스크린샷 비교 | **바뀜**: WARP는 그림이 같다. 실제 문제는 1~3fps |
| 3D가 느리면 3D 영역만 느리다 | 실제 앱에서 CDP로 긴 작업 측정 (벤치와 다른 방법) | **바뀜**: 메인 스레드가 막혀서 페이지 전체(패널·버튼·스크롤)가 멈춘다. 그래서 화질 낮추기만으로는 부족하고 그리기 멈추기가 필요 |
| (새로 찾음) | `--disable-webgl`로 앱 확인 | WebGL이 아예 없으면 636px 자리표시가 늘어나 흐리게 보임 → 이것도 "깨짐"의 후보 |
| 벤치 숫자 (펠트 두더지 방) | 실제 앱 (glb 두더지 방) | 벤치 "현재 그대로" 236ms(약 4fps)와 실제 앱 3.0fps가 비슷 → 벤치 결론을 앱에 써도 된다. 다만 같은 설정에서도 236/370ms로 흔들림 |
| 웹페이지에서 설정 링크는 아마 막힐 것 | 링크·새 탭·location·window.open 네 가지 실측 + 검색 | **그대로**: 모두 막힘 |
| 감지 신호가 하나면 불안하다 | 렌더러 문자열·caveat·WebGPU·속도 시험, 크롬·엣지 | **그대로**: 네 신호가 모두 일치 |

## 다음 단계
1. **실제 SSAFY PC에서 원인 확인 (가장 먼저)**: 교육장 PC 한 대에서 `chrome://gpu`를 열어 "WebGL" 줄과 크롬 버전을 보거나, 감지 페이지(`explore/gpu` 벤치의 `?detectOnly=1`)를 아티팩트로 올려서 연다. A(소프트웨어)인지 B(WebGL 없음)인지, 정책으로 잠겨 있는지에 따라 우선순위가 달라진다
2. 자리표시 그림을 고해상도로 교체 (반나절, B에 바로 효과)
3. `graphicsTier()` 감지 + 저사양 모드(`engine.ts`에 tier, 방·탐색하기 둘 다) + 그리기 멈추기 (1~2일)
4. 안내 띠 + 주소 복사 버튼 (반나절)
5. 액세서리 3D 모델이 나오면 2D 층 쌓기 두더지 검토

## 재현 방법
```
# 벤치 페이지 빌드 (app 폴더에서)
./node_modules/.bin/vite build --config ../explore/gpu/vite.config.mjs
node explore/gpu/serve.mjs                       # http://127.0.0.1:5191, 결과는 results/
node explore/gpu/run.mjs off-lite chrome hwoff headless "composer=0&shadow=1024&st=basic&shells=0&pr=0.5"
node explore/gpu/run.mjs det chrome hwoff headless detectOnly=1

# 실제 앱 측정: 앱 빌드를 아무 정적 서버로 띄운 뒤
node explore/gpu/cdp-measure.mjs app-room-hwoff hwoff http://127.0.0.1:5193/burrow 8 8
```
- `run.mjs` 모드: `gpu`(새 프로필), `hwoff`(설정 토글 끔과 같은 Local State), `nogpu`(`--disable-gpu`). `cdp-measure.mjs`는 `gpu|hwoff|nowebgl`
- 벤치 쿼리: `ao, grade, composer, shadow(0|크기), st(soft|pcf|basic), pr, aa, env, points, shells, msaa, secs`
- `roomBench.ts`는 `app/src/three/roomScene.ts`를 복사해서 품질 손잡이만 붙인 것 (glb 두더지로 바뀌기 전 버전)

## 출처
- [Intent to Remove: SwiftShader Fallback (blink-dev)](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM): 크롬 130부터 경고, WebGL 컨텍스트 생성이 실패하도록 바뀜, 윈도우는 WARP로 대체
- [Using Chromium with SwiftShader (Chromium docs)](https://chromium.googlesource.com/chromium/src/+/da170c2267b2201954efe1c8fa5d2d89ab09f7bf/docs/gpu/swiftshader.md)
- [Concerns over removal of SwiftShader fallback (blink-dev)](https://groups.google.com/a/chromium.org/g/blink-dev/c/TvNk-PJO2Sk)
- [link to chrome url from a webpage (Stack Overflow 보관본)](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/40362775/link-to-chrome-url-from-a-webpage)
- [Edge 정책 HardwareAccelerationModeEnabled (Microsoft Learn)](https://learn.microsoft.com/th-th/deployedge/microsoft-edge-policies/hardwareaccelerationmodeenabled), [크롬 정책 레지스트리 예시](https://kb.naturalnetworks.com/article.php?id=674)
- [How to turn hardware acceleration on and off in Chrome (How-To Geek)](https://www.howtogeek.com/412738/how-to-turn-hardware-acceleration-on-and-off-in-chrome), [Chrome Blog 2015: 탭 복원 동작](https://chrome.googleblog.com/2015/09/chrome-improvements-for-faster-and-more.html)
