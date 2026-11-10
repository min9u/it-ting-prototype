# Babylon.js 9.31.3 재현 실험 기록

- 날짜: 2026-11-10
- 파일: `room.html`(땅굴 방), `field.html`(탐색하기 밭), 기준 이미지 `ref.png`, `ref-field.png`, 회차별 스크린샷 `shots/`
- 미리보기: `node explore/serve.js 5191` → `http://127.0.0.1:5191/babylon/field.html#bare`
- 해시: `#3d`, `#ref`, `#bare`, `#bare-mole`, `#bare-ref-mole` (+ 디버그용 `nopost`를 붙이면 후처리 없이)
- 최종본: `shots/final-field.png`, `shots/final-field-mole.png`, `shots/final-room.png`, `shots/final-room-mole.png` (원본 확대는 `shots/ref-mole.png`, `shots/ref-room-mole.png`)
- 코드 크기: field.html 약 34KB, room.html 약 38KB (스크립트 의존성은 babylon.js UMD 하나, 8.7MB)

## 공통 구조
- `scene.useRightHandedSystem = true`로 three.js 좌표·회전을 그대로 옮김 (NullEngine으로 회전 방향이 three.js와 같은지 확인)
- 재질은 전부 `StandardMaterial` 무광 (specular 0.05 이하). 방은 직접 만든 노멀맵 노이즈로 점토 요철
- 그림자: `ShadowGenerator` 2048 + `useContactHardeningShadow`
- 후처리: `SSAO2RenderingPipeline` → `DefaultRenderingPipeline`(MSAA 4, 그레인, 비네트, 색 커브). 톤매핑은 끔 (켜면 하늘·잔디가 탁해짐)
- 두더지 확대 샷은 `camera.freezeProjectionMatrix()`에 축 밖(off-axis) 투영 행렬을 넣어 같은 카메라에서 일부만 크게 렌더. 원본 쪽은 CSS `background-size/position`으로 같은 영역을 자름
- 첫 프레임: `scene.executeWhenReady` 뒤 `setTimeout`으로 8번 그리고 `window.__ready = true` (헤드리스 Edge는 rAF가 거의 안 돎)

## 밭 (field)
| 회차 | 다른 점 | 고친 것 |
|---|---|---|
| r1 | 재질 캐시 키에 텍스처를 JSON으로 넣어 순환 참조 에러 → 원본이 그대로 보임. 고친 뒤: 덤불이 너무 크고 많음, 꽃은 너무 작음, 둔덕이 갈색으로 지글거림(양면 정점 z-fighting), 하늘이 회색, 두더지가 화면 아래로 45px 내려감 | 캐시 키 수정, 둔덕 단면만 + twoSidedLighting, 덤불 축소·꽃 확대, 톤매핑 끔, 두더지를 뒤로 0.5 옮기고 1.05배 |
| r2 | 둔덕 구멍이 안 어두움(땅 평면이 구멍 바닥을 덮음), 가까운 꽃·돌이 화면 밖(z>1.2), 하늘 여전히 회색, 두더지가 원본보다 10% 길쭉 | 구멍 바닥을 땅 위(0.03)로, 화면 좌표→땅 위 점 역산 함수 `scr()`로 원본 위치에 꽃·돌·덤불 배치, 하늘을 Layer 대신 하늘 구 메시로, 두더지 높이 1.55→1.43 |
| r3 | 구멍 안쪽 그라데이션이 얇게만 보임(원본은 더 내려다본 구도), 하늘 그라데이션 위아래 뒤집힘, 가까운 덤불·돌 너무 큼 | 디버그로 구멍 색을 파랑으로 칠해 색은 맞게 들어간 것 확인 → 둔덕을 깊이 방향 1.35배, 그라데이션 뒤집기, 가까운 소품 크기 원본에 맞춤 |
| r4 | 하늘이 너무 진함, 양옆 둔덕 구멍이 안 보임 | 양옆 둔덕을 카메라 쪽으로 기울임(rotation.x) — 처음엔 rotation.y와 섞여 엉뚱한 방향으로 기울어 r5에서 ry=0으로 |
| r5 | 기울기 방향 오류, 하늘 꼭대기가 여전히 진함 | ry=0, 기울기 0.09~0.11, 하늘 색 밝게, 비네트 약하게 |
| r6 | 최종. 남은 차이: 잔디가 조금 진함, 먼 꽃 줄기가 도드라짐, 둔덕 테두리가 단단해 보임 | — |

두더지 확대 비교 (r1→r6): 위치·크기 맞춤 → 눈 높이(H×0.765)·간격(폭의 약 40%) → 코를 위로, 연하게(#f6aca7) → 콧구멍 진분홍 대신 연어색(#ea7f7f) → 볼터치를 눈 아래 안쪽으로, 옅게 → 손 위치 H×0.34 → 털 얼룩을 극 부분(꼭대기 소용돌이)에서 빼고 밝게 → 어깨를 조금 더 둥글게. 남은 차이: 원본은 바닥이 조금 더 넓고 표면에 은은한 먼지 질감과 빛 번짐이 있음.

## 방 (room)
| 회차 | 다른 점 | 고친 것 |
|---|---|---|
| r1 | 돔 앞에 줄무늬 벽이 생겨 가구가 가려짐 | `CreateLathe`의 `arc`가 기본 `closed:true`라 반원을 닫는 면이 생김 → `closed:false` |
| r2 | three.js판과 같은 모습. 원본보다 어둡고 붉음, 화면이 6% 정도 큼, 침대·배낭·빈백·가방 위치 다름, 영사기가 두더지 앞을 가림, 두더지가 높고 작음 | 반구광·벽 텍스처 밝게, 카메라 뒤로, 원본 위치로 가구 재배치(침대 1.15배 왼쪽 앞, TV 아래로 등), 영사기를 오른쪽으로 |
| r3 | 러그가 라임색(조명 과다 + 색 커브 하이라이트 색조), 꼬마전구가 거의 안 보임, 두더지 몸에 세로 줄무늬(늘어난 노멀맵) | 색 커브는 채도만, 전구 줄을 꼭대기에서 양옆으로 길게, 두더지 몸 노멀맵 제거 |
| r4 | 두더지가 여전히 높음, 윗면이 과노출 | 두더지를 앞으로(z 3.4), 조명 세기 낮추고 벽 텍스처로 밝기 보전, 러그 색 #eabb80 |
| r5~r6 | 최종. 두더지 색만 조금 밝게 | — |

남은 차이: 간접광 번짐과 구석의 깊고 부드러운 그림자, 가구 곡면, 원본 두더지의 넓은 어깨(비석형).

## Babylon.js 소감
- 쉬웠던 것: 후처리 파이프라인(MSAA·그레인·비네트·색 커브)이 옵션이라 셰이더를 안 써도 됨. SSAO2·접촉 경화 그림자 내장. thin instance로 꽃·덤불 약 1,800개를 메시 9개로. `CreateLathe`/`CreateTube`/`CreateRibbon`으로 돔·갈비뼈·단면 테두리. 오른손 좌표계 옵션 덕에 three.js 코드를 거의 줄 단위로 옮김. `freezeProjectionMatrix`로 확대 샷.
- 어려웠던 것: UMD 8.7MB로 무거움. 둥근 상자 빌더가 없음(구를 늘려 직접 만듦). lathe `arc`의 기본 closed. HDR 파이프라인에서 `Layer` 배경 색이 달라짐(하늘 구로 우회). DynamicTexture의 v 방향이 헷갈림. Standard 재질 포인트 라이트는 `range` 선형 감쇠라 three.js 세기 값을 그대로 못 씀. 오일러 순서가 YXZ라 rotation.y와 rotation.x를 같이 쓰면 기울기 방향이 바뀜.
- 렌더 시간: 헤드리스 swiftshader에서 장면 한 장 20~30초 (밭 1440×897, 방 1200×900)
