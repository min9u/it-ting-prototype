# 첫 화면 JS 줄이기 (2026-11-22)

- **요청**: 첫 화면 JS 822KB(gzip, 예산 360), roomScene 청크 313KB(예산 300). 먼저 첫 화면에 뭐가 들어 있는지 표로 보고, 라우트·3D 지연 로딩으로 줄이기(동작 변화 없이)
- 브랜치 `perf/first-load` · 측정: `npm run build && npm run bundle-report`, 구성은 `vite build --sourcemap` 의 소스맵을 패키지·폴더별로 합산

## 1. 첫 화면에 들어 있던 것 (줄이기 전, 소스 원본 크기)
| 덩어리 | KB | 비율 | 왜 첫 화면에 있었나 |
|---|---|---|---|
| three.js 본체 | 1254 | 31.9% | `TeaRoom.tsx` 가 `testParam`(주소 손잡이 읽기)을 `three/engine` 에서 가져왔고, engine 은 `import * as THREE`. 3D 화면은 lazy 인데 이 한 줄이 본체를 끌고 옴 |
| react-dom | 620 | 15.8% | 꼭 필요 |
| react-router | 401 | 10.2% | 꼭 필요 |
| **소품 썸네일 131장** (`assets/prop-thumbs`) | 374 | 9.5% | 4KB 미만이라 Vite 가 data URL 로 JS 에 품음. `DecorPanel`(꾸미기 패널)이 MyBurrow 안에 정적으로 있고 MyBurrow 는 App.tsx 가 정적 import |
| data (목 데이터 · 저장소) | 201 | 5.1% | 저장소가 화면들에서 공유됨 |
| @tanstack/query-core | 152 | 3.9% | 꼭 필요 |
| screens/* 전부 (burrow 133 · meetups 79 · board 56 · start 46 · chat 36 · settings 28 · onboarding 27 …) | 약 420 | 약 10% | **모든 화면이 App.tsx 에서 정적 import** |
| 두더지 아이콘 41장 (`assets/mole-items`) | 94 | 2.4% | 같은 이유(data URL) |
| components · api · lib · realtime … | 약 280 | 약 7% | 공통 |

→ 첫 화면에 화면 코드 전부 + 3D 본체 + 이미지 data URL 이 같이 실리고 있었음.

## 2. 한 일 (동작 변화 없음)
| 단계 | 첫 화면 JS (gzip) |
|---|---|
| 처음 | **822.7KB** |
| ① `testParam` 을 `lib/testParam.ts` 로 (three 가 첫 화면에서 빠짐) | 683.1KB |
| ② 화면 코드를 route lazy 로 (`App.tsx` 의 `lz()`: 화면마다 청크, 소품 썸네일 · 가구 코드도 땅굴 청크로) | **295.4KB** (예산 360 → 320 으로 낮춤) |

- 이동은 청크가 도착한 뒤(그동안 이전 화면 그대로), 처음 열 때만 바탕(`Booting`)이 잠깐. 청크가 없으면(재배포) 기존 오류 경계가 한 번 새로고침(`lib/chunkReload`)
- **CSS**: 첫 화면 CSS 66.8 → **24.6KB**(화면 CSS 도 화면 청크와 같이). 번들 보고서의 CSS 예산은 "첫 화면 CSS"로 재도록 바꿈(전체는 77.7KB 로 늘어 보이지만 작은 파일 여럿이라 압축이 덜 된 것이고 첫 화면엔 안 실림). 예산 70 → 35
- **roomScene 313KB**: 청크 이름 `roomScene` 은 메인이 아니라 **땅굴 Worker 실험(D)이 품은 three.js 한 벌 + 땅굴 코드**였음. 본체를 `three-worker`(146KB)로 떼어 `roomScene`(167KB)과 갈라서 청크 예산 초과는 사라짐(**합계 313KB 는 그대로**, D 를 켤 때만 받음). 메인 three.js 본체도 `three` 청크(157KB) 하나로

## 3. 지금 첫 화면 (소스 1740KB)
react-dom 620 · react-router 401 · data 164 · query-core 152 · 두더지 아이콘 94 · api 85 · components 46 · lib 39 · realtime 36 …

## 4. 화면별 청크 (gzip)
Landing 2.4 · 로그인/가입(Auth) 5.0 · 온보딩 7.2 · **땅굴(MyBurrow) 285.5**(소품 썸네일 131장 data URL) · 탐색 17.5 · 방문자 뷰 3.1 · 채팅 10.8 · 모임 목록 4.4 · 모임 상세 6.1 · 게시판 12.6 · 설정 7.8 · 3D 본체 `three` 157.1(3D 화면이 나눠 씀)

## 5. 더 줄일 후보 (안 함)
1. **두더지 아이콘 94KB(gzip 약 70KB)를 첫 화면에서 빼기**: 일반 빌드는 `assetsInlineLimit` 으로 `mole-items` · `prop-thumbs` 를 파일로 내보내면 됨(썸네일은 땅굴 청크 285 → 약 10KB). 단 공유(아티팩트) 빌드는 파일 수 한도(버전당 511개)가 빠듯해(지금 307개) data URL 을 유지해야 하고, 꾸미기 패널을 열 때 작은 요청이 130여 번 생김 → 일반·공유 빌드가 갈라지는 대가가 있어 보류
2. 목 데이터(`data/mock` 등 164KB)는 실서버 연결 때 API 로 바뀌면서 자연히 줄어듦
3. react-router 401KB(소스)는 v7 전체. 필요한 부분만 쓰는 `react-router/dom` 분리는 효과 대비 위험이 커서 안 함

## 6. 확인
- tsc · 단위 테스트 · 일반 빌드 · 공유 빌드(`build:share`, 첫 화면 295.5KB) · 스모크(가속 켬 swiftshader) 통과. 사진 `_shots/perf-first-load/smoke/`
