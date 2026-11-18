/*
 * 탐색 들판 카메라 3단계 (3D 핸드오프 v3.10 docs/camera_zoom_spec_v1_1.md, 앱 쪽 정리 docs/explore-field-v3-10.md).
 * 3D 장면(holeField.ts)과 미니맵(screens/burrow/explore-designs/fieldGeo.ts)이 같은 계산을 쓰도록 여기 한 곳에 둠. three.js 를 불러오지 않음
 *
 * - 각도 45°·세로 FOV 32.3° 고정, 거리만 near 12 / mid 24 / far 46m
 * - 보이는 땅은 거리에 비례: 타깃 → 가까운 변 0.3176·D, 먼 변 0.5766·D, 먼 변 반폭 0.7246·D (JSON camera.levels 값을 D 로 나눈 것)
 * - 타깃(화면 가운데 땅 위 점)
 *   near·mid: 구멍 중앙 정렬 허용 = v3.9 그대로 켜진 구역 camRect 합집합 안 (들판 바깥 둘레에서만 멈춤)
 *   far: 구멍 중앙 정렬 막음 = 켜진 구역을 감싸는 상자 U 에서 x ∈ [U.x0 + 반폭, U.x1 − 반폭], y ∈ [U.y0 + 가까운 변, U.y1 − 먼 변].
 *        구간이 비면 x 는 가운데, y 는 단일 구역 맞춤(구역 y0 + 11.1, 깊이 36m 기준 비율)
 * - 전환 0.5초 cubic-bezier(0.4, 0, 0.2, 1), 거리는 로그 보간, 타깃은 시작 → 끝 타깃 사이를 같은 비율로
 * - 단계별 표시(LOD): 꽃 전부 / 짝수 번째만 / 끔, 풀 뭉치 near 만, 작물·구멍 far ×1.25, 두더지 1 / 1.15 / 1.5
 *   LOD 를 바꾸는 거리: D < 17 near, 17~34 mid, > 34 far, ±10% 히스테리시스 (올라갈 때 18.7 / 37.4, 내려갈 때 15.3 / 30.6)
 */
export type ZoomLevel = 'near' | 'mid' | 'far'
export const ZOOM_LEVELS: readonly ZoomLevel[] = ['near', 'mid', 'far']
export const ZOOM_DIST: Record<ZoomLevel, number> = { near: 12, mid: 24, far: 46 }
export const ZOOM_NAME: Record<ZoomLevel, string> = { near: '가까이', mid: '중간', far: '멀리' }
export const CAM_PITCH = Math.PI / 4
export const CAM_FOV = 32.3
/** 보이는 땅 계수 (× 거리 D) */
export const K_TO_NEAR = 0.3176, K_TO_FAR = 0.5766, K_HALF_FAR = 0.7246
/** far 단일 구역 맞춤: 구역 남쪽 끝에서 11.1m (깊이 36m) */
export const FAR_FIT = 11.1 / 36
/** 줌 전환 시간 (초) */
export const ZOOM_SEC = 0.5

export interface ZoomLod {
  /** 꽃: 1 전부, 0.5 짝수 번째만, 0 끔 */
  flowers: number
  /** 작은 풀 뭉치 (grass_tuft_small) */
  tufts: boolean
  crop: number
  hole: number
  mole: number
}
export const ZOOM_LOD: Record<ZoomLevel, ZoomLod> = {
  near: { flowers: 1, tufts: true, crop: 1, hole: 1, mole: 1 },
  mid: { flowers: 0.5, tufts: false, crop: 1, hole: 1, mole: 1.15 },
  far: { flowers: 0, tufts: false, crop: 1.25, hole: 1.25, mole: 1.5 },
}

/** LOD 단계 (거리 D, 지금 단계에서 ±10% 히스테리시스) */
export function lodAt(D: number, prev: ZoomLevel): ZoomLevel {
  const i = ZOOM_LEVELS.indexOf(prev)
  // 위로: near→mid 18.7, mid→far 37.4 · 아래로: far→mid 30.6, mid→near 15.3
  if (i === 0) return D > 37.4 ? 'far' : D > 18.7 ? 'mid' : 'near'
  if (i === 1) return D > 37.4 ? 'far' : D < 15.3 ? 'near' : 'mid'
  return D < 15.3 ? 'near' : D < 30.6 ? 'mid' : 'far'
}

/** 두더지 배율: 거리에 따라 부드럽게 (log D 로 near 1 → mid 1.15 → far 1.5). 단계에 멈춰 있으면 표 값과 같음 */
export function moleScaleAt(D: number): number {
  const a = Math.log(ZOOM_DIST.near), b = Math.log(ZOOM_DIST.mid), c = Math.log(ZOOM_DIST.far), x = Math.log(Math.max(ZOOM_DIST.near, Math.min(ZOOM_DIST.far, D)))
  return x <= b ? 1 + (ZOOM_LOD.mid.mole - 1) * (x - a) / (b - a) : ZOOM_LOD.mid.mole + (ZOOM_LOD.far.mole - ZOOM_LOD.mid.mole) * (x - b) / (c - b)
}

/** cubic-bezier(0.4, 0, 0.2, 1) (CSS 와 같은 곡선) */
export function easeStd(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const x1 = 0.4, y1 = 0, x2 = 0.2, y2 = 1
  const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s
  const by = (s: number) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s
  let lo = 0, hi = 1, s = t
  for (let i = 0; i < 30; i++) { s = (lo + hi) / 2; if (bx(s) < t) lo = s; else hi = s }
  return by(s)
}
/** 전환 중 거리 (로그 보간) */
export const distAt = (d0: number, d1: number, e: number) => d0 * Math.pow(d1 / d0, e)

export interface CamZone {
  bounds: { x: [number, number]; z: [number, number] }
  camRect: { x: [number, number]; z: [number, number] }
}

/** near·mid: 켜진 구역 camRect 합집합 안 (가장 가까운 사각형 안의 점, v3.9 그대로) */
function inRects(zones: CamZone[], x: number, z: number): [number, number] {
  let best: [number, number] = [x, z], bd = Infinity
  for (const { camRect: r } of zones) {
    const zlo = Math.min(r.z[0], r.z[1]), zhi = Math.max(r.z[0], r.z[1])
    const c: [number, number] = [Math.min(Math.max(x, r.x[0]), r.x[1]), Math.min(Math.max(z, zlo), zhi)]
    const dd = (c[0] - x) ** 2 + (c[1] - z) ** 2
    if (dd < bd) { bd = dd; best = c }
  }
  return best
}

/** far 한계 (three 좌표: z = −Blender y). 켜진 구역을 감싸는 상자 기준 */
export function farLimits(zones: CamZone[], D = ZOOM_DIST.far) {
  const x0 = Math.min(...zones.map((z) => Math.min(...z.bounds.x))), x1 = Math.max(...zones.map((z) => Math.max(...z.bounds.x)))
  // Blender y (남쪽 0 → 북쪽 72) = −z
  const y0 = Math.min(...zones.map((z) => -Math.max(...z.bounds.z))), y1 = Math.max(...zones.map((z) => -Math.min(...z.bounds.z)))
  let xa = x0 + K_HALF_FAR * D, xb = x1 - K_HALF_FAR * D
  if (xa > xb) xa = xb = (x0 + x1) / 2
  let ya = y0 + K_TO_NEAR * D, yb = y1 - K_TO_FAR * D
  if (ya > yb) ya = yb = y0 + FAR_FIT * (y1 - y0)
  return { x: [xa, xb] as [number, number], z: [-yb, -ya] as [number, number] }
}

/** 그 단계에서 (x, z) 를 보려고 할 때의 카메라 타깃 (three x, z) */
export function camTargetAt(level: ZoomLevel, zones: CamZone[], x: number, z: number): [number, number] {
  if (!zones.length) return [x, z]
  if (level !== 'far') return inRects(zones, x, z)
  const L = farLimits(zones)
  return [Math.min(Math.max(x, L.x[0]), L.x[1]), Math.min(Math.max(z, L.z[0]), L.z[1])]
}

/**
 * 화면에 보이는 땅 (사다리꼴 네 점: 왼쪽 아래 → 오른쪽 아래 → 오른쪽 위 → 왼쪽 위, three x·z).
 * aspect = 장면 가로/세로, focusX = 타깃이 놓이는 가로 위치(오른쪽 카드가 열리면 0.403), u1 = 가려지지 않은 오른쪽 끝(0~1).
 * 16:9 · 가운데 · 안 가림 · near 면 핸드오프 값(아래 폭 9.6, 위 폭 17.4, 앞 3.8 / 뒤 6.9)과 같음
 */
export function camFootprint(tx: number, tz: number, aspect = 16 / 9, focusX = 0.5, u1 = 1, D = ZOOM_DIST.near): [number, number][] {
  const t = Math.tan((CAM_FOV * Math.PI) / 360)
  const cy = Math.sin(CAM_PITCH) * D, cz = tz + Math.cos(CAM_PITCH) * D
  const f = [0, -Math.SQRT1_2, -Math.SQRT1_2], up = [0, Math.SQRT1_2, -Math.SQRT1_2]
  const at = (u: number, ny: number): [number, number] => {
    const nx = 2 * (u + 0.5 - focusX) - 1
    const dx = nx * aspect * t, dy = f[1] + up[1] * ny * t, dz = f[2] + up[2] * ny * t
    const s = -cy / dy
    return [tx + dx * s, cz + dz * s]
  }
  return [at(0, -1), at(u1, -1), at(u1, 1), at(0, 1)]
}
