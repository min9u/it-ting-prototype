# three.js 말고 3D 후보 두 개 (엔진 비교 실험)

- 날짜: 2026-11-10
- 요청: three.js 말고 3D 구현에 좋은 기술 두 개를 자세히 찾고, 다른 에이전트에게 맡겨 같은 화면(방 안, 탐색하기)을 구현시키기. three.js까지 총 세 개
- 공통 과제: [`explore/BRIEF.md`](../explore/BRIEF.md)

## 고른 후보
| | three.js (기준) | **Babylon.js** | **PlayCanvas** |
|---|---|---|---|
| 성격 | 가벼운 렌더링 라이브러리. 필요한 걸 붙여 씀 | 완성형 엔진 (Microsoft). 물리·GUI·인스펙터·플레이그라운드·노드 머티리얼 에디터 포함 | 완성형 엔진 + 웹 에디터. 엔진만 오픈소스로 따로 쓸 수 있음 |
| 이번 버전 | 0.165.0 | 9.31.3 | 2.23.3 |
| 후처리 | addons에서 골라 조립 (GTAO, OutputPass, 직접 만든 셰이더) | `DefaultRenderingPipeline`에 그레인·비네트·색보정·톤매핑·블룸·DOF가 다 있음, `SSAO2` 별도 | `CameraFrame` 하나로 SSAO·블룸·비네트·색보정·DOF·TAA |
| 웹GPU | 지원 | 9.0부터 셰이더 전부 WGSL 버전도 있음 | 지원 |
| 툰/점토 느낌 | `MeshToonMaterial` 기본 제공 | 노드 머티리얼로 직접 | 셰이더 청크를 직접 고쳐야 함 |
| 우리한테 좋은 점 | 가볍고 예제가 가장 많음 | 후처리·그림자·인스펙터가 기본이라 그림체 맞추기 빠를 수 있음 | 에디터가 있어 디자이너가 직접 배치·조명을 만질 수 있음 |
| 걱정 | 후처리를 직접 조립해야 함 | 번들이 큼 | 툰 셰이딩 자료가 적음 |

## 뺀 후보
- React Three Fiber: 결국 three.js라 비교 의미가 적음 (React 앱에 붙일 때는 쓸 만함)
- Spline: 디자인은 쉽지만 관심사별로 가구를 코드로 바꿔 끼우기 어렵고 무거움
- Unity WebGL / Godot 웹 내보내기: 무겁고, 첫 로딩이 길어서 웹 커뮤니티 화면에 안 맞음
- Google Filament: 실사 PBR에 강하지만 모델 파일이 있어야 하고 코드 도형으로 짓기 불편

## 진행
- three.js: `explore/3d/` (메인 세션)
- Babylon.js: `explore/babylon/` (에이전트)
- PlayCanvas: `explore/playcanvas/` (에이전트)
- 세 개 모두 같은 비교 UI(밀어서 비교)와 같은 반복 방식(만들기 → 스크린샷 → 원본 대조 → 수정, 최소 3회)

## 출처
- [Announcing Babylon.js 8.0](https://blogs.windows.com/windowsdeveloper/2025/03/27/announcing-babylon-js-8-0/)
- [Babylon.js Default Rendering Pipeline](https://documentation-epx38z8s4-babylonjs.vercel.app/features/featuresDeepDive/postProcesses/defaultRenderingPipeline)
- [PlayCanvas CameraFrame](https://developer.playcanvas.com/user-manual/graphics/posteffects/cameraframe/)
- [Three.js vs Babylon.js vs PlayCanvas (2026)](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- [Web game engines in 2026](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)

## 결과 (2026-11-10)
비교 페이지: https://claude.ai/artifact/7saUop5kLtVnDDXCdU8UDT (`explore/compare.html`)

| | three.js | Babylon.js | PlayCanvas |
|---|---|---|---|
| 탐색하기 | https://claude.ai/artifact/1GfvgcExFAX7zM7a3cSDUw | https://claude.ai/artifact/DpsJvbrGwM9JT4mY2WCuXY | https://claude.ai/artifact/WPX6grY8GRbDNLAZdW3ty2 |
| 방 안 | https://claude.ai/artifact/JehojQcDbUwxys5R6mQo3n | https://claude.ai/artifact/Viz6rAUEqJibEnmPggYKjv | https://claude.ai/artifact/XMFLp58CJ9SjJdYMuevAme |
| 반복 횟수 | 탐색하기 6 | 장면마다 6 | 탐색하기 10, 방 5 |
| 라이브러리 | 약 170KB | 약 8.7MB | 약 2.5MB (gzip 640KB) |
| 두 장면 코드 | 약 67KB | 약 72KB | 약 86KB |
| 잘 나온 것 | 원본 좌표 역산으로 배치가 가장 정확 | 둔덕 구멍이 가장 원본 같음, 후처리 묶음이 편함 | 환경광(EnvLighting)으로 점토 느낌이 가장 부드러움 |
| 아쉬운 것 | 표면이 매끈해서 장난감 같음, GTAO가 확대 시점과 충돌 | 방이 붉고 대비가 강함, 톤매핑 끔 | 지오메트리 헬퍼를 직접 작성, 잔디가 밝음 |

회차별 기록은 각 폴더의 `NOTES.md`, 최종 스크린샷은 `shots/final-*`.

## 결론
- 세 엔진 결과가 비슷한 수준에서 멈춤. 남은 차이(보송한 털, 말랑한 곡면, 빛 번짐)는 엔진이 아니라 "코드 도형 + 실시간 조명" 방식의 한계
- **three.js 추천**: 가장 가볍고, `app/`(React)에 React Three Fiber로 바로 붙일 수 있음. Babylon 후처리 묶음, PlayCanvas 환경광 방식은 three.js에서도 재현 가능
- 다음 단계: 원본 Blender 파일이 있는지 확인 → 있으면 두더지·둔덕·가구를 glb로, 조명은 텍스처에 굽기
