// 탐색 들판 저사양 후보 (2026-11-16, docs/rendering-experiments-2.md). field-tradeoff.mjs 가 읽음
// mode: hwoff(그래픽 가속 꺼짐 = WARP) | gpu(가속 켬). query: 탐색 주소(#/burrow/explore)에 붙이는 시험용 쿼리
// 측정 뒤 저사양 기본값이 S1_RA 로 바뀌어서, 쿼리는 기본값과 상관없이 같은 뜻이 되게 손잡이를 모두 적음
// (측정할 때 실제로 쓴 주소는 results/scene/ft-<key>.json 의 url. 그때는 fsharp·fsasync 기본 끔, panscale 기본 0, fss 기본 0=1.5배)
export const CANDIDATES = [
  { key: 'gpu', mode: 'gpu', query: '', label: 'GPU 고화질 (기준)', desc: '그래픽 가속 켬. 해상도 1배·안티앨리어싱·해 그림자. 화질 기준' },
  { key: 'base', mode: 'hwoff', query: 'fa=0&compile=0', label: '지금 (main)', desc: '해상도 0.55배, 매 프레임 들판 전체를 다시 그림, 예열 없음' },
  { key: 'A', mode: 'hwoff', query: 'fsharp=0&panscale=0', label: 'A 배경 한 번 + P + 예열', desc: '0.55배. 들판은 렌더 타깃에 한 번, 매 프레임은 두더지 둘레만. 셰이더·첫 그리기 예열' },
  { key: 'A_R', mode: 'hwoff', query: 'fsharp=0&panscale=0_6', label: 'A + 이동 중 저해상도', desc: 'A 에서 점프 카메라 0.4초 동안만 0.33배로 그리고, 점프가 끝나면 0.55배로 다시 찍음' },
  { key: 'A_noenv', mode: 'hwoff', query: 'fsharp=0&panscale=0&fenv=0', label: 'A + 환경맵 끔', desc: 'A 에서 들판 재질의 환경맵(IBL) 대신 반구광 (두더지는 그대로)' },
  { key: 'S', mode: 'hwoff', query: 'fsharp=1&fss=0&panscale=1&fsasync=0', label: 'S 배경 선명 (1.5배 슈퍼샘플)', desc: '배경은 1.5배로 한 번 그려 2D 캔버스에(땅굴 S 방식), 두더지만 0.55배. 점프가 끝나 조용해지면 다시 찍음' },
  { key: 'S1', mode: 'hwoff', query: 'fsharp=1&fss=1&panscale=1&fsasync=0', label: 'S 배경 선명 (1배)', desc: 'S 와 같고 배경을 1배로 (슈퍼샘플 없음)' },
  { key: 'S1_R', mode: 'hwoff', query: 'fsharp=1&fss=1&panscale=0_6&fsasync=0', label: 'S 배경 선명 (1배) + 이동 중 저해상도', desc: 'S1 에서 점프 카메라 0.4초 동안 0.33배' },
  { key: 'S1_RA', mode: 'hwoff', query: 'fsharp=1&fss=1&panscale=0_6&fsasync=1', label: 'S 배경 선명 (1배) + 이동 중 저해상도 + 비동기 읽기 ★기본', desc: '(저사양 기본값) S1_R 에서 고해상도 그림을 GPU 버퍼(PBO)로 비동기로 읽어 옴. 선명한 배경 찍기가 두 번 150ms 넘으면 A_R 로 내려감' },
  { key: 'S_RA', mode: 'hwoff', query: 'fsharp=1&fss=0&panscale=0_6&fsasync=1', label: 'S 배경 선명 (1.5배) + 이동 중 저해상도 + 비동기 읽기', desc: 'S_R 에서 비동기 읽기' },
  { key: 'S_R', mode: 'hwoff', query: 'fsharp=1&fss=0&panscale=0_6&fsasync=0', label: 'S + 이동 중 저해상도', desc: 'S 에서 점프 카메라 0.4초 동안 0.33배' },
  { key: 'P1', mode: 'hwoff', query: 'fsharp=0&pr=1&panscale=0_55', label: '전체 1배 (두더지도 선명)', desc: '캔버스 1배, A·P. 점프 카메라 동안만 0.55배, 끝나면 1배로 다시 찍음' },
  { key: 'P1AA', mode: 'hwoff', query: 'fsharp=0&pr=1&panscale=0_55&bdscale=2', label: '전체 1배 + 배경 2배 슈퍼샘플', desc: 'P1 에서 배경 렌더 타깃을 2배로 (붙일 때 2×2 평균 = 안티앨리어싱)' },
  { key: 'P1_R', mode: 'hwoff', query: 'fsharp=0&pr=1&panscale=0_33', label: '전체 1배 + 이동 중 0.33배', desc: 'P1 에서 점프 카메라 동안 0.33배 (A_R 과 같은 이동 비용)' },
  { key: 'P1_direct', mode: 'hwoff', query: 'fsharp=0&pr=1&panscale=0', label: '전체 1배, 이동 중에도 1배', desc: 'P1 에서 점프 카메라 동안에도 1배로 전체를 그림 (도착하자마자 다시 찍음)' },
  { key: 'def', mode: 'hwoff', query: '', label: '최종 저사양 기본값', desc: 'S1_RA 와 같음 + 선명한 배경 준비가 두 번 0.2초를 넘으면 그 장면에서 S 를 끄고 A_R 로 (2코어에서는 점프 두 번 뒤 A_R)' },
]
