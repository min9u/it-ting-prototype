/*
 * 탐색 들판 울타리 닫기 (시험 브랜치 try/explore-v3-11, 원인·결정: far 에서 울타리가 구역 경계에서 뚝 끊겨 보임)
 * three.js 를 불러오지 않는 순수 계산 (단위 테스트 src/tests/field-fence.test.ts). 3D 장면은 holeField.ts 가 씀
 *
 * 원래 규칙(v3.9~): 땅 둘레 울타리 174개(fence.glb 2m 직선 한 토막을 2m 간격)를 "켜진 구역 안에 있는 것만" 그림.
 * 켜진 구역이 적으면 울타리가 구역 경계에서 끊김 (1개면 남쪽 변 18개만, 3개면 71개만). 핸드오프 규칙은 "안 켠 구역은 울타리도 숨김"이라 의도된 동작이지만
 * far(보이는 폭 ±33m)에서는 끊긴 끝이 화면 한가운데 보임.
 *
 * 닫는 방법:
 *  1. 켜진 구역마다 사방으로 OFFSET 만큼 넓힌 직사각형을 둘레(ring) 안으로 자른 것의 합 E.
 *     E 의 테두리 중 둘레 울타리 선 위가 아닌 부분이 "새 울타리 길". 구역이 이어진 곳은 합쳐져서 안쪽 경계엔 안 생기고, ㄴ자 꺾임도 알아서 맞음.
 *  2. 둘레 울타리 조각은 E 안에 있는 것만 쓰되, 경계에 걸친 조각은 길이를 잘라(fence.glb x 스케일) 새 길과 정확히 만나게 함.
 *  3. 구역 6개가 모두 켜지면 E 가 둘레 전체라 새 길 0개, 둘레 조각은 하나도 안 바뀜 (v3.11 그대로)
 * 새 길은 구역 경계에서 OFFSET 만큼 비활성 쪽에 세움: 작물 모델이 경계 밖으로 최대 1.23m 튀어나와서(9종 모델 반경 기준, 경계에서 0.01~0.07m 까지 붙은 것도 있음)
 * 경계 바로 위에 세우면 식물을 뚫고 지나감. 길·구멍은 경계에서 1.2m 이상 떨어져 있어 상관없음. 비활성 구역 쪽엔 그려지는 물건이 없음
 */

/** fence.glb 한 토막 길이 (m, 가운데가 원점, 길이 방향이 x) */
export const FENCE_LEN = 2
/** 켜진 구역 경계에서 비활성 쪽으로 떨어뜨려 세우는 거리 (m). 작물 모델이 경계 밖으로 튀어나오는 최대 1.23m + 울타리 반 두께 0.08 + 여유 */
export const FENCE_OFFSET = 1.5
/**
 * 작물 9종 모델이 구역 경계선 밖으로 튀어나오는 최대치 (m, 모델 반경 + 경계를 넘은 거리, 보수적 상한).
 * 다시 잰 값: 작물 1.21 · 꽃 0.78(구역 2 꽃 하나가 경계 밖 0.59m) · 풀 0.05, 구멍은 경계에서 2.9m 이상 안쪽. 테스트가 FENCE_OFFSET 이 이보다 넉넉한지 확인
 */
export const CROP_OVERHANG_MAX = 1.23

export interface FenceZone { bounds: { x: [number, number]; z: [number, number] } }
/** 둘레 울타리 중심선 (three 좌표, z: 북쪽이 작은 값) */
export interface FenceRing { x: [number, number]; z: [number, number] }
export interface FenceRun {
  axis: 'x' | 'z'
  /** axis 에 수직인 좌표 (axis x 면 z 값) */
  at: number
  from: number
  to: number
  /** 안쪽(켜진 쪽)이 좌표가 작은 쪽이면 1, 큰 쪽이면 -1. 울타리 앞면은 둘레 울타리처럼 바깥(안쪽의 반대)을 봄 */
  out: 1 | -1
}
export interface FencePiece { x: number; z: number; ry: number; sx: number }

type Rect = [x0: number, x1: number, z0: number, z1: number]
const uniq = (a: number[]) => [...new Set(a.map((v) => +v.toFixed(6)))].sort((p, q) => p - q)

/** 켜진 구역을 off 만큼 넓힌 직사각형들 (clip = 둘레 안으로 자름) */
export function expandedRects(active: FenceZone[], ring: FenceRing, off = FENCE_OFFSET, clip = true): Rect[] {
  return active.map((zn) => {
    const zlo = Math.min(...zn.bounds.z), zhi = Math.max(...zn.bounds.z)
    const r: Rect = [zn.bounds.x[0] - off, zn.bounds.x[1] + off, zlo - off, zhi + off]
    return clip ? [Math.max(ring.x[0], r[0]), Math.min(ring.x[1], r[1]), Math.max(ring.z[0], r[2]), Math.min(ring.z[1], r[3])] : r
  })
}

/** E 의 테두리 중 둘레 울타리 선 위가 아닌 직선 길들 (이어 붙인 것) */
export function fenceRuns(active: FenceZone[], ring: FenceRing, off = FENCE_OFFSET): FenceRun[] {
  const rects = expandedRects(active, ring, off, true)
  if (!rects.length) return []
  const xs = uniq([ring.x[0], ring.x[1], ...rects.flatMap((r) => [r[0], r[1]])])
  const zs = uniq([ring.z[0], ring.z[1], ...rects.flatMap((r) => [r[2], r[3]])])
  const nx = xs.length - 1, nz = zs.length - 1
  const inE = (i: number, j: number) => {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2
    return rects.some((r) => cx > r[0] && cx < r[1] && cz > r[2] && cz < r[3])
  }
  const cell: boolean[][] = Array.from({ length: nx }, (_, i) => Array.from({ length: nz }, (_, j) => inE(i, j)))
  const runs: FenceRun[] = []
  // 가로 길 (z 일정): 칸 (i, j-1) 과 (i, j) 가 서로 다를 때. j = 0 · nz 는 둘레 위라 건너뜀
  for (let j = 1; j < nz; j++) for (let i = 0; i < nx; i++) if (cell[i][j - 1] !== cell[i][j]) runs.push({ axis: 'x', at: zs[j], from: xs[i], to: xs[i + 1], out: cell[i][j - 1] ? 1 : -1 })
  // 세로 길 (x 일정)
  for (let i = 1; i < nx; i++) for (let j = 0; j < nz; j++) if (cell[i - 1][j] !== cell[i][j]) runs.push({ axis: 'z', at: xs[i], from: zs[j], to: zs[j + 1], out: cell[i - 1][j] ? 1 : -1 })
  // 같은 선 위에서 맞닿는 것 합치기
  runs.sort((a, b) => (a.axis === b.axis ? a.at - b.at || a.from - b.from : a.axis < b.axis ? -1 : 1))
  const out: FenceRun[] = []
  for (const r of runs) {
    const p = out[out.length - 1]
    if (p && p.axis === r.axis && p.out === r.out && Math.abs(p.at - r.at) < 1e-6 && Math.abs(p.to - r.from) < 1e-6) p.to = r.to
    else out.push({ ...r })
  }
  return out
}

/** 길 하나를 2m 토막으로 (길이에 맞춰 x 스케일을 조금 늘이고 줄여 끝이 정확히 만나게) */
export function runPieces(r: FenceRun): FencePiece[] {
  const len = r.to - r.from
  const n = Math.max(1, Math.round(len / FENCE_LEN)), step = len / n
  return Array.from({ length: n }, (_, k) => {
    const c = r.from + step * (k + 0.5)
    // 둘레 울타리와 같은 방향: 바깥이 +z 면 ry 0, -z 면 π, +x 면 π/2, -x 면 -π/2 (three 는 local +z 가 (sin ry, cos ry) 로 감)
    return r.axis === 'x' ? { x: c, z: r.at, ry: r.out === 1 ? 0 : Math.PI, sx: step / FENCE_LEN } : { x: r.at, z: c, ry: r.out === 1 ? Math.PI / 2 : -Math.PI / 2, sx: step / FENCE_LEN }
  })
}

/** 새로 놓을 울타리 전부 */
export const closurePieces = (active: FenceZone[], ring: FenceRing, off = FENCE_OFFSET): FencePiece[] => fenceRuns(active, ring, off).flatMap(runPieces)

/** 선 위(axis 방향)의 E 구간들. 둘레 근처 조각 비교용이라 자르지 않은 직사각형으로 (둘레 선 ±0.3m 안의 조각도 잡힘) */
function crossSection(rects: Rect[], axis: 'x' | 'z', at: number): [number, number][] {
  const iv = rects
    .filter((r) => (axis === 'x' ? at >= r[2] - 1e-6 && at <= r[3] + 1e-6 : at >= r[0] - 1e-6 && at <= r[1] + 1e-6))
    .map((r): [number, number] => (axis === 'x' ? [r[0], r[1]] : [r[2], r[3]]))
    .sort((a, b) => a[0] - b[0])
  const m: [number, number][] = []
  for (const v of iv) { const p = m[m.length - 1]; if (p && v[0] <= p[1] + 1e-6) p[1] = Math.max(p[1], v[1]); else m.push([v[0], v[1]]) }
  return m
}

/**
 * 둘레 울타리 한 조각을 E 안으로 자름. 조각 가운데 선(조각 방향)이 지나는 E 구간과 겹치는 부분만 남기고 x 스케일을 그만큼 줄임.
 * 2cm 도 안 남으면 없앰 (새 길과 만나는 곳에 틈이 안 생기게 작은 조각도 살림). 모서리 둥근 부분 조각은 방향이 비스듬해도 가까운 축으로 같게 다룸 (모서리 조각은 E 안이면 그대로 길이 2m)
 */
export function clipRingPiece(p: { x: number; z: number; ry: number; sx: number }, active: FenceZone[], ring: FenceRing, off = FENCE_OFFSET): FencePiece[] {
  const rects = expandedRects(active, ring, off, false)
  const alongX = Math.abs(Math.cos(p.ry)) >= Math.abs(Math.sin(p.ry))
  const half = (FENCE_LEN * p.sx) / 2
  const c = alongX ? p.x : p.z
  const out: FencePiece[] = []
  for (const [a, b] of crossSection(rects, alongX ? 'x' : 'z', alongX ? p.z : p.x)) {
    if (a <= c - half + 1e-9 && b >= c + half - 1e-9) { out.push({ ...p }); continue } // 안 잘림 → 원본 그대로 (구역 6개 모두 켜면 v3.11 과 같음)
    const lo = Math.max(a, c - half), hi = Math.min(b, c + half)
    if (hi - lo < 0.02) continue
    const mid = (lo + hi) / 2, sx = (hi - lo) / FENCE_LEN
    out.push(alongX ? { x: mid, z: p.z, ry: p.ry, sx } : { x: p.x, z: mid, ry: p.ry, sx })
  }
  return out
}

/** 둘레 울타리 중심선 = 둘레 조각 전체의 x · z 범위 (직선 변이 가장 바깥) */
export function ringOf(fence: { x: number; z: number }[]): FenceRing {
  return { x: [Math.min(...fence.map((f) => f.x)), Math.max(...fence.map((f) => f.x))], z: [Math.min(...fence.map((f) => f.z)), Math.max(...fence.map((f) => f.z))] }
}
