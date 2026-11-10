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

## 결론
세 결과물이 나오면 이 문서에 비교 결과를 덧붙인다.
