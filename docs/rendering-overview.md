# 3D 렌더링 방식 정리와 개선 방향 (2026-11-13)

- 요청: 지금 프론트엔드가 3D를 어떻게 보여 주는지, 그래픽 가속이 꺼진 PC에서는 어떻게 보이는지, 더 개선할 방법
- 근거: `app/src/three/`, `lib/graphicsTier.ts`, `lib/lowLab.ts`, `components/RoomView.tsx` 코드와 [gpu-fallback-research.md](gpu-fallback-research.md), [gpu-lowspec-ideas.md](gpu-lowspec-ideas.md)의 측정값

## 1. 평소(GPU)에 3D가 그려지는 흐름

```
화면(MyBurrow 등)
 └─ RoomView ── 로딩 애니메이션 "땅굴 파는 중..." ─┐ 다 차려지면 한 번에 페이드 인
     └─ React.lazy(RoomCanvas)  ← three.js는 이때 처음 내려받음 (별도 청크)
         └─ SceneCanvas (div 하나)
              useEffect → mountRoomScene(div) → SceneHandle { dispose, resize, react, setWorn, loaded … }
                           ├─ createRenderer: <canvas> 새로 만들어 붙임 (WebGLRenderer)
                           ├─ glb 불러오기 (Draco 압축 해제 → 장면 구성)
                           └─ startLoop: requestAnimationFrame 루프 (두더지 동작·카메라·그리기)
              언마운트 → dispose: 지오메트리·텍스처·렌더러 해제 + 컨텍스트 반납
```

- **React와 3D의 경계**: React는 div 하나만 관리하고, 그 안은 three.js가 직접 그린다. 3D 상태(두더지 위치 등)는 React state가 아니라 장면 안에 있어서 매 프레임 리렌더가 없다. React → 3D는 `SceneHandle` 메서드(리액션, 액세서리)로만 말한다
- **화면마다 렌더러 하나씩**: 땅굴(`roomScene.ts`), 탐색하기(`fieldScene.ts`), 온보딩 두더지 미리 보기(`MolePreviewCanvas.tsx`)가 각자 WebGLRenderer를 만들고, 화면을 떠나면 버린다
- **땅굴 방** (`roomScene.ts`): 디자이너가 Blender에서 조명을 **미리 구운** glb 방. 실시간 그림자·후처리 없음. 톤매핑은 Blender와 같은 AgX, 조명은 환경광 + 전구 + 보조광 3개뿐. 벽지는 타일 텍스처 × 구운 음영(lightMap). 두더지 그림자는 발밑 그림자 판. 그래서 GPU에서는 가볍다
- **탐색하기 밭** (`fieldScene.ts`): 꽃·덤불·둔덕을 코드로 만들고(인스턴싱), 해 그림자 맵 + 후처리(N8AO 구석 그림자 + 색보정)를 쓴다. 땅굴보다 무겁다
- **두더지** (`moleActor.ts`): 디자이너 glb(뼈대 애니메이션 19개) + 액세서리 41개를 소켓 뼈에 붙임(`moleDress.ts`). 같은 glb를 여러 마리로 복제(SkeletonUtils)
- **에셋**: glb는 Draco(메시) + WebP(텍스처)로 줄임. 일반 빌드는 Draco를 wasm으로 풀고, 공유 빌드(아티팩트)는 wasm을 못 올려 JS 해독기로 메인 스레드에서 푼다. 아티팩트는 `.glb` 파일을 못 올려서 공유 빌드에서는 glb를 JS 안에 data URL로 넣는다
- **해상도**: 기기 배율 최대 2, 안티앨리어싱 켬. 루프는 계속 돈다(fps 제한 없음)
- **WebGL이 아예 없으면**: 장면 생성이 실패하고, 8초 뒤 디자이너 확인 렌더 사진(`room-v2.webp`)을 자리표시로 보여 준다

## 2. 그래픽 가속이 꺼진 PC에서는

### 감지 (`lib/graphicsTier.ts`)
1. `failIfMajorPerformanceCaveat: true`로 WebGL을 달라고 해서 거절되면 소프트웨어 렌더러
2. 보조로 렌더러 이름(`Microsoft Basic Render Driver`, SwiftShader, llvmpipe) 확인
3. 감지가 GPU라도 처음 2초 평균 프레임이 50ms를 넘으면 그 탭에서는 저사양으로 내림 (`engine.ts startLoop`)
4. 시험용 주소: `?gpu=software`, 저사양 실험실 패널 `?lowlab`

### 이때 보이는 것
- 그림 자체는 같다 (크롬은 가속을 끄면 CPU로 WebGL을 그리는 WARP로 전환). 문제는 속도: 아무 대응 없이 땅굴 3fps, 탐색하기 1fps, **메인 스레드가 막혀 버튼·스크롤까지 멈춤**
- 화면 위에 안내 띠 "땅굴이 느리게 움직이나요?" (켜는 방법 = 설정 주소 복사, 이대로 볼게요)

### 저사양 모드 (품질 묶음 `engine.ts LOW` + 실험실 기본값 `lowLab.ts`)
| 기법 | 하는 일 | 효과 (CPU 2코어 WARP 측정) |
|---|---|---|
| 해상도 0.55배 | 적게 그리고 CSS로 늘림. 안티앨리어싱·그림자·후처리 끔 | 기본 |
| B 스톱모션 10fps | 그 사이 시간에 메인 스레드가 입력·UI 처리 | 땅굴 들어올 때 15 → 36fps(페이지) |
| 쉬면 멈춤 + I 가끔 숨쉬기 | 1초간 움직임·입력이 없으면 그리기 멈춤, 4초마다 1.2초만 깨워 숨쉬기 | 쉬는 중 페이지 60fps |
| A 배경 한 번 | 움직이지 않는 것을 렌더 타깃(색+깊이)에 한 번 그리고, 매 프레임은 붙인 뒤 두더지만 그림 (`staticBackdrop.ts`) | 탐색하기 걷기 8.7 → 60fps, 땅굴 15 → 52fps |
| S 방은 선명하게 | 멈춰 있을 때 방만 고해상도로 한 번 그려 뒤 2D 캔버스에 깔고, WebGL 캔버스는 투명하게 두더지만 저해상도 | 방은 GPU 때처럼 선명 (한 번에 0.5초) |
| 부분 그리기 | 두더지가 있는 사각형만 지우고 다시 그림 (scissor) | |
| C 카메라 고정 | 돌리기·휠 확대 끔 → A·부분 그리기가 거의 항상 적용 | |
| N 가구 제자리 | 가구 낙하 연출 끔 (떨어지는 동안은 A가 안 먹힘) | |

결과적으로 **방은 선명하고, 두더지만 약간 거칠게 10fps로 움직이며, 페이지는 멈추지 않는다.** 시험판(기본 끔): D 땅굴을 Worker(OffscreenCanvas)에서 그리기, E 탐색하기 두더지를 미리 찍은 2D 그림으로, F 단순한 두더지 재질, G 3D 창 작게, H "가볍게 보기" 버튼.

## 3. 더 개선할 방법 (추천 순)

### 저사양 PC
1. **실제 SSAFY PC에서 측정** (아직 안 함). 지금 숫자는 이 PC를 CPU 2코어로 묶어 흉내 낸 것. `chrome://gpu` 결과와 실험실 패널 fps로 기본값을 확정
2. **들어오는 순간의 멈춤 줄이기**: 저사양에서 남은 큰 멈춤은 처음 로딩이다. 공유 빌드의 Draco JS 해독, 셰이더 컴파일, 첫 고해상도 방 그리기(S)가 모두 메인 스레드에서 돈다. → `renderer.compileAsync`로 셰이더 미리 컴파일, Draco 해독을 Worker로(일반 빌드는 이미 wasm), 로딩 애니메이션이 CSS만 쓰게 해서 멈춰도 돌게
3. **D(Worker 그리기)를 지원되는 브라우저에서 기본으로**: 3D가 아무리 느려도 페이지는 안 멈춘다. 아티팩트에서 module Worker가 막히는지 먼저 확인
4. **선명한 방 그림 캐시**: S가 만든 방 그림을 (방 주인 + 관심사 + 벽지 + 창 크기) 키로 기억해 두면 다시 들어올 때 고해상도 그리기 0.5초가 사라짐
5. **탐색하기 2D 두더지(E) 완성**: 꽃 뒤 가림 처리, 그림 찍는 1~2초를 Worker나 미리 만든 이미지로

### 공통 (GPU PC 포함)
6. **필요한 가구만 내려받기**: 공유 빌드는 관심사 가구 glb 11개를 전부 JS에 data URL로 넣어서(`import.meta.glob ... eager`) 땅굴 청크가 약 12MB다(base64라 원본보다 33% 큼). 실제 서버에 올리면 glb를 파일로 두고 고른 관심사 것만 받게 됨. 아티팩트에서도 관심사별 청크로 나누면 첫 로딩이 크게 줄어듦
7. **Draco 청크 중복**: 공유 빌드에 `dracoMain-*.js`가 두 벌(각 455KB) 들어감. 하나로 합치기
8. **렌더러 하나를 화면끼리 같이 쓰기**: 지금은 땅굴 ↔ 탐색하기를 오갈 때마다 렌더러·셰이더·텍스처를 새로 만든다. 렌더러 하나를 옮겨 끼우면(legacy 시안이 이 방식) 전환이 빨라지고 저사양에서 특히 이득
9. **텍스처 KTX2(Basis)**: WebP는 GPU에 올릴 때 다시 풀어서 메모리가 크다. KTX2는 압축된 채 올라가 메모리·업로드 시간이 줄어듦 (해독기 wasm이 필요해서 아티팩트에서는 어려움)
10. **WebGL이 없는 환경**: 지금은 자리표시 사진 한 장. 2D 아바타(`MoleAvatar`)와 방 사진으로 기능은 쓸 수 있게 하는 2D 모드 (맥 등 대상 밖이라 우선순위 낮음)

## 다음 단계
- 실제 SSAFY PC 측정 (1번) 후 2·3번 중 효과 큰 것부터
- 실제 서버 배포가 정해지면 6·7번은 빌드 설정만으로 해결됨
