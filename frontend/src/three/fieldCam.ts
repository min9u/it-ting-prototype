/*
 * 탐색 들판 카메라 3단계 (3D 핸드오프 v3.11 docs/camera_zoom_spec_v1_2.md. v3.10 은 camera_zoom_spec_v1_1.md, docs/explore-field-v3-10.md).
 * 3D 장면(holeField.ts)과 미니맵(screens/burrow/explore-designs/fieldGeo.ts)이 같은 계산을 쓰도록 여기 한 곳에 둠. three.js 를 불러오지 않음
 *
 * - 각도 45°·세로 FOV 32.3° 고정, 거리만 near 12 / mid 24 / far 46m
 * - 보이는 땅은 거리에 비례: 타깃 → 가까운 변 0.3176·D, 먼 변 0.5766·D, 먼 변 반폭 0.7246·D (JSON camera.levels 값을 D 로 나눈 것)
 * - 타깃(화면 가운데 땅 위 점) — v3.11: 어느 단계에서도 두더지가 있는 구멍 F 를 따라감 (far 포함, 구멍 중앙 정렬 허용)
 *   한계는 바깥 잔디(outer_grass 180×144m)에서 2m 안쪽의 안전 한계 하나뿐: x ∈ [−90 + 반폭 + 2, 90 − 반폭 − 2], y ∈ [−36 + 가까운 변 + 2, 108 − 먼 변 − 2].
 *   구멍 150개는 어느 단계에서도 걸리지 않아서 구멍 따라가기에서는 보정이 안 일어남 (자유 패닝용)
 *   예외: far 에서 켠 구역이 1개면 x = Zx + clamp(Hx − Zx, ±9), y = Zy0 + 11.1 + clamp(Hy − (Zy0 + 18), ±9) (Z = 그 구역, H = 구멍).
 *         완전히 따라가면 구역 가장자리 구멍에서 화면의 78% 가 빈 잔디라서 (채택 규칙은 활성 구역이 화면의 46% 이상). 구역 2개 이상이면 안전 한계만
 * - 전환 0.5초 cubic-bezier(0.4, 0, 0.2, 1), 거리는 로그 보간, 타깃은 시작 → 끝 타깃 사이를 같은 비율로
 *   (스펙은 한계 보정량만 임계감쇠 스프링 ω=10 으로 평활하라고 함. 앱은 저사양이 미리 굽는 도착 구도와 끝 구도가 정확히 같아야 해서 같은 곡선으로 보간 — 구멍 따라가기에서는 두 끝 타깃이 같아 차이 없음)
 * - 끌어 옮기기 (시험 브랜치, 모든 줌 단계): 마우스로 땅을 잡고 끌면 타깃이 구멍에서 떨어져 dragLimits(바깥 잔디 2m 안쪽) 안에서 자유롭게 움직임.
 *   두더지가 점프하거나 줌이 바뀌면 위 보간이 지금 타깃에서 구멍 타깃으로 알아서 되돌림 (별도 복귀 코드 없음)
 * - 단계별 표시(LOD): 꽃 전부 / 짝수 번째만 / 끔, 풀 뭉치 near 만, 작물·구멍 far ×1.25, 두더지 1 / 1.15 / 1.5
 *   LOD 를 바꾸는 거리: D < 17 near, 17~34 mid, > 34 far, ±10% 히스테리시스 (올라갈 때 18.7 / 37.4, 내려갈 때 15.3 / 30.6)
 * - 크기(두더지·구멍·후광·작물)는 단계 경계에서 튀지 않게 거리에 연속으로 (v3.11 camera.follow.scale_by_distance)
 */
export type ZoomLevel = 'near' | 'mid' | 'far'
export const ZOOM_LEVELS: readonly ZoomLevel[] = ['near', 'mid', 'far']
export const ZOOM_DIST: Record<ZoomLevel, number> = { near: 12, mid: 24, far: 46 }
export const ZOOM_NAME: Record<ZoomLevel, string> = { near: '가까이', mid: '중간', far: '멀리' }
export const CAM_PITCH = Math.PI / 4
export const CAM_FOV = 32.3
/** 보이는 땅 계수 (× 거리 D) */
export const K_TO_NEAR = 0.3176, K_TO_FAR = 0.5766, K_HALF_FAR = 0.7246
/** far 에서 켠 구역이 1개일 때의 맞춤 타깃: 구역 남쪽 끝에서 11.1m (깊이 36m 기준 비율), 구멍을 따라가는 폭은 구역 가운데에서 ±9m */
export const FAR_FIT = 11.1 / 36
export const FAR_FOLLOW = 9
/** 바깥 잔디(outer_grass) 범위 (Blender x, y)와 안전 여유 — camera_zoom_spec_v1_2 1 */
export const OUTER_GRASS = { x: 90, y0: -36, y1: 108 }
export const SAFE_MARGIN = 2
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

/**
 * 구멍·후광·작물 배율 (v3.11): mid(24m)까지 1, far(46m)에서 1.25, 사이는 log D 선형. 단계에 멈춰 있으면 ZOOM_LOD 표 값과 같음
 * (표에서 작물 배율과 구멍 배율이 같아서 한 함수. 두더지는 moleScaleAt)
 */
export function holeScaleAt(D: number): number {
  const a = Math.log(ZOOM_DIST.mid), b = Math.log(ZOOM_DIST.far), x = Math.log(Math.max(ZOOM_DIST.mid, Math.min(ZOOM_DIST.far, D)))
  return 1 + (ZOOM_LOD.far.hole - 1) * (x - a) / (b - a)
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
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * 카메라 타깃 안전 한계 (three 좌표: z = −Blender y). 바깥 잔디에서 2m 안쪽이라 화면이 바깥 잔디를 넘지 않음.
 * D 에 비례해서 near ±79.3 · y −30.2~99.1, mid ±70.6 · −26.4~92.2, far ±54.7 · −19.4~79.5 (Blender y)
 */
export function safeLimits(D: number) {
  const hx = K_HALF_FAR * D, ny = K_TO_NEAR * D, fy = K_TO_FAR * D
  return {
    x: [-OUTER_GRASS.x + hx + SAFE_MARGIN, OUTER_GRASS.x - hx - SAFE_MARGIN] as [number, number],
    z: [-(OUTER_GRASS.y1 - fy - SAFE_MARGIN), -(OUTER_GRASS.y0 + ny + SAFE_MARGIN)] as [number, number],
  }
}

/**
 * 마우스로 끌어 옮길 때의 타깃 한계 (three 좌표). safeLimits 와 같은 규칙(화면 전체가 바깥 잔디에서 2m 안쪽)을
 * 화면 비율과 가로 위치(오른쪽 카드가 열리면 0.403)까지 반영해서 계산함. 16:9 · 0.5 면 safeLimits 와 같음(계수 반올림 차이 0.05m 안쪽).
 * 구역 1개 far 의 ±9m 맞춤은 "따라가기" 전용이라 여기엔 안 걸림 (끄는 동안은 바깥 잔디 안이면 어디든)
 */
export function dragLimits(D: number, aspect = 16 / 9, focusX = 0.5) {
  const f = camFootprint(0, 0, aspect, focusX, 1, D) // 타깃 기준 화면에 보이는 땅 네 점
  const xs = f.map((p) => p[0]), zs = f.map((p) => p[1])
  return {
    x: [-OUTER_GRASS.x + SAFE_MARGIN - Math.min(...xs), OUTER_GRASS.x - SAFE_MARGIN - Math.max(...xs)] as [number, number],
    z: [-(OUTER_GRASS.y1 - SAFE_MARGIN) - Math.min(...zs), -(OUTER_GRASS.y0 + SAFE_MARGIN) - Math.max(...zs)] as [number, number],
  }
}

/**
 * 땅을 잡고 끌기: 처음 잡은 땅 위 점 g0 가 포인터 밑에 그대로 있도록, 포인터가 지금 가리키는 땅 점 g1 (시작 때 카메라로 계산)만큼 반대로 타깃을 옮김.
 * 포인터를 오른쪽으로 끌면 g1 이 g0 보다 오른쪽이라 카메라는 왼쪽으로 가고 지도는 포인터를 따라 오른쪽으로 움직임. 결과는 한계 안으로 자름
 */
export function dragTarget(t0: [number, number], g0: [number, number], g1: [number, number], lim: ReturnType<typeof dragLimits>): [number, number] {
  return [clamp(t0[0] + g0[0] - g1[0], lim.x[0], lim.x[1]), clamp(t0[1] + g0[1] - g1[1], lim.z[0], lim.z[1])]
}

/** far · 켠 구역 1개: 구역 맞춤 타깃에서 구멍 쪽으로 ±9m 까지만 따라감 (three 좌표) */
function singleZoneFar(zone: CamZone, hx: number, hz: number): [number, number] {
  const zx = (Math.min(...zone.bounds.x) + Math.max(...zone.bounds.x)) / 2
  // Blender y (남쪽 0 → 북쪽 36) = −z
  const y0 = -Math.max(...zone.bounds.z), depth = Math.max(...zone.bounds.z) - Math.min(...zone.bounds.z)
  const ty = y0 + FAR_FIT * depth + clamp(-hz - (y0 + depth / 2), -FAR_FOLLOW, FAR_FOLLOW)
  return [zx + clamp(hx - zx, -FAR_FOLLOW, FAR_FOLLOW), -ty]
}

/**
 * 그 단계에서 (x, z) 구멍을 보려고 할 때의 카메라 타깃 (three x, z). 구멍을 그대로 따라가고(구멍 중앙 정렬),
 * far 에서 켠 구역이 1개일 때만 맞춤 ±9m, 마지막에 안전 한계 (구멍 150개는 안 걸림)
 */
export function camTargetAt(level: ZoomLevel, zones: CamZone[], x: number, z: number): [number, number] {
  const [tx, tz] = level === 'far' && zones.length === 1 ? singleZoneFar(zones[0], x, z) : [x, z]
  const L = safeLimits(ZOOM_DIST[level])
  return [clamp(tx, L.x[0], L.x[1]), clamp(tz, L.z[0], L.z[1])]
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
