/**
 * 들판(마을) 2D 지오메트리 — 미니맵 · 전체 마을 지도 · 디자인 B(마을 지도)가 같이 씀. 2026-11-16
 *
 * - 배치는 3D 와 같은 data/fieldLayout150.json (three/holeField.ts 와 같은 파일을 같은 방식으로 읽음, 청크도 같음)
 * - 좌표: three 좌표 그대로 x = 오른쪽, z = 아래(남쪽). -z 가 위(북쪽)라서 SVG (x, y) = (x, z) 로 바로 그림
 * - 길 타일은 2m 칸. 타일마다 이어지는 방향(팔)을 돌려서 길 그래프를 만들고, 구멍은 그 칸으로 들어오는 팔과 이어짐
 *   (150자리 전부 이어지는 것 확인: 한쪽만 이어진 팔 0, 끊긴 팔 0)
 * - 카메라 값(세로 FOV 32.3°, 45°, 12m, 목표점 = 켜진 구역 camRect 합집합 안)은 holeField.ts 와 같은 숫자를 여기 따로 둠
 *   (holeField.ts 는 다른 작업과 겹쳐서 손대지 않음. 값이 바뀌면 같이 바꿀 것)
 */

export type Item = [node: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number]
type Tile = { cell: string; t: Item }
export interface LayoutZone {
  zone: number; name: string; seats: [number, number]
  bounds: { x: [number, number]; z: [number, number] }
  camRect: { x: [number, number]; z: [number, number] }
  holes: [seat: number, x: number, z: number, ry: number, s: number, ring: number][]
  paths: Tile[]; linkAdd: Tile[]; linkReplace: Tile[]
  grass: Item[]; tufts: Item[]; crops: Item[]; flowers: Item[]
}
export interface Layout {
  theme: { grass_color: string }
  mineRing: string
  rings: string[]
  nodes: string[]
  ladder: Item
  zones: LayoutZone[]
}

let layoutP: Promise<Layout> | null = null
let layoutV: Layout | null = null
/** 배치 JSON (탐색에 들어올 때만 받는 별도 청크) */
export const loadLayout = () =>
  (layoutP ??= import('../../../data/fieldLayout150.json').then((m) => (layoutV = m.default as unknown as Layout)))
export const layoutNow = () => layoutV

/* ---------- 색 (3D 재질 색을 화면 톤으로) ---------- */
export const MAP_COLORS = {
  grass: '#8CC56A', // 바깥 잔디 = 안 켠 구역 (3D 와 같은 색)
  grassDim: '#97CB76',
  soil: '#EFB27A', // 흙 슬랩 (dirt 재질)
  soilEdge: '#D9925A',
  patch: '#9FD077', // 잔디 덩어리
  patchEdge: '#7DB457',
  path: '#F8E6C4',
  pad: '#F6D6AA', // 빈 자리 (empty_pad)
  holeIn: '#4A2E1E',
  mine: '#F2A3A1',
  ladder: '#6B3A1E',
  pumpkin: '#EE8A3A',
  flower: '#FFF6E8',
}

export const FIELD_BOUNDS = { x0: -54, x1: 54, z0: -72, z1: 0 }
export const LADDER = { x: 0, z: -2 }

/* ---------- 마을 (켜진 구역 기준으로 계산한 것) ---------- */
export interface Hole { seat: number; x: number; z: number; ring: string; occupied: boolean; zone: number }
export interface Village {
  zonesOn: LayoutZone[]
  zonesOff: LayoutZone[]
  /** 켜진 구역의 모든 자리 (구멍 + 빈 자리) */
  seats: Map<number, Hole>
  /** 구멍이 있는 자리 (배정됨 또는 내 자리) */
  holes: Hole[]
  /** 길: SVG path d (미터 단위, 칸 가운데에서 팔 방향으로 1m 씩) */
  pathD: string
  grass: { x: number; z: number; w: number; h: number; ry: number }[]
  crops: { x: number; z: number; s: number }[]
  flowers: { x: number; z: number }[]
  /** 켜진 구역을 감싸는 상자 */
  litBox: { x0: number; x1: number; z0: number; z1: number }
  camRects: LayoutZone['camRect'][]
  /** 길 그래프 */
  adj: Map<string, string[]>
  holeCell: Map<number, string>
}

const ARMS: Record<string, [number, number][]> = {
  path_straight: [[0, -1], [0, 1]], path_corner: [[1, 0], [0, 1]], path_t: [[-1, 0], [1, 0], [0, 1]],
  path_cross: [[1, 0], [-1, 0], [0, 1], [0, -1]], path_end: [[0, 1]],
}
// three 의 Y축 회전 (x, z) → (x cos + z sin, -x sin + z cos)
const rot = ([x, z]: [number, number], ry: number): [number, number] => {
  const c = Math.cos(ry), s = Math.sin(ry)
  return [Math.round(x * c + z * s), Math.round(-x * s + z * c)]
}
export const cellKey = (cx: number, cz: number) => `${cx},${cz}`
export const cellOf = (x: number, z: number) => cellKey(Math.round(x / 2), Math.round(z / 2))
export const cellPos = (k: string): [number, number] => { const [a, b] = k.split(','); return [+a * 2, +b * 2] }
/** 잔디 덩어리 노드 크기 (grass_patch.glb 의 x·z 폭) */
const PATCH: Record<string, [number, number]> = { grass_patch_1: [3, 2.4], grass_patch_2: [4, 2], grass_patch_3: [2.4, 3.4] }

const villageCache = new Map<string, Village>()

export function buildVillage(L: Layout, zones: number, occupied: number[], mySeat: number | null): Village {
  const key = `${zones}|${mySeat}|${occupied.join(',')}`
  const hit = villageCache.get(key)
  if (hit) return hit
  const n = Math.max(1, Math.min(6, zones))
  const zonesOn = L.zones.filter((z) => z.zone <= n)
  const zonesOff = L.zones.filter((z) => z.zone > n)
  const occ = new Set(occupied)

  // 길 타일: 구역 번호 순서로 켜면서 경계 길 replace·add (holeField.ts 와 같은 순서)
  const tiles = new Map<string, Item>()
  for (const z of zonesOn) {
    z.paths.forEach((p) => tiles.set(p.cell, p.t))
    z.linkReplace.forEach((p) => tiles.set(p.cell, p.t))
    z.linkAdd.forEach((p) => tiles.set(p.cell, p.t))
  }
  const arms = new Map<string, [number, number][]>()
  let d = ''
  tiles.forEach((t) => {
    const name = L.nodes[t[0]].split(':')[1]
    const a = (ARMS[name] ?? []).map((v) => rot(v, t[4]))
    arms.set(cellOf(t[1], t[3]), a)
    for (const [dx, dz] of a) d += `M${t[1]} ${t[3]}l${dx} ${dz}`
  })

  const seats = new Map<number, Hole>()
  const holes: Hole[] = []
  const holeCell = new Map<number, string>()
  const cellHole = new Set<string>()
  for (const z of zonesOn) for (const [seat, x, zz, , , ring] of z.holes) {
    const isHole = occ.has(seat) || seat === mySeat
    const h: Hole = { seat, x, z: zz, ring: seat === mySeat ? L.mineRing : L.rings[ring], occupied: isHole, zone: z.zone }
    seats.set(seat, h)
    if (isHole) holes.push(h)
    holeCell.set(seat, cellOf(x, zz))
    cellHole.add(cellOf(x, zz))
  }
  // 그래프: 타일은 팔 방향으로, 구멍 칸은 그 칸을 가리키는 팔이 있는 이웃 타일과 이어짐 (빈 자리도 지나갈 수 있음)
  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b) }
  arms.forEach((a, k) => {
    const [cx, cz] = k.split(',').map(Number)
    for (const [dx, dz] of a) {
      const nk = cellKey(cx + dx, cz + dz)
      if (arms.has(nk) || cellHole.has(nk)) {
        link(k, nk)
        if (cellHole.has(nk)) link(nk, k)
      }
    }
  })

  const grass: Village['grass'] = [], crops: Village['crops'] = [], flowers: Village['flowers'] = []
  for (const z of zonesOn) {
    for (const it of z.grass) {
      const size = PATCH[L.nodes[it[0]].split(':')[1]] ?? [3, 2.4]
      grass.push({ x: it[1], z: it[3], w: size[0] * it[5], h: size[1] * it[7], ry: it[4] })
    }
    for (const it of z.crops) crops.push({ x: it[1], z: it[3], s: it[5] })
    for (let i = 0; i < z.flowers.length; i += 3) flowers.push({ x: z.flowers[i][1], z: z.flowers[i][3] })
  }
  const litBox = {
    x0: Math.min(...zonesOn.map((z) => z.bounds.x[0])), x1: Math.max(...zonesOn.map((z) => z.bounds.x[1])),
    z0: Math.min(...zonesOn.map((z) => z.bounds.z[1])), z1: Math.max(...zonesOn.map((z) => z.bounds.z[0])),
  }
  const v: Village = { zonesOn, zonesOff, seats, holes, pathD: d, grass, crops, flowers, litBox, camRects: zonesOn.map((z) => z.camRect), adj, holeCell }
  villageCache.set(key, v)
  return v
}

/* ---------- 길 찾기 (B 마을 지도: 두더지가 길을 따라 걸어감) ---------- */
/** from 칸 → 자리 to 의 구멍 칸까지 칸 가운데 점들 (BFS 최단). 못 가면 직선 */
export function route(v: Village, fromCell: string, toSeat: number): [number, number][] {
  const goal = v.holeCell.get(toSeat)
  if (!goal) return []
  if (fromCell === goal) return [cellPos(goal)]
  const prev = new Map<string, string>([[fromCell, '']])
  const q = [fromCell]
  while (q.length) {
    const k = q.shift()!
    if (k === goal) break
    for (const nk of v.adj.get(k) ?? []) if (!prev.has(nk)) { prev.set(nk, k); q.push(nk) }
  }
  if (!prev.has(goal)) return [cellPos(fromCell), cellPos(goal)]
  const out: [number, number][] = []
  for (let k = goal; k; k = prev.get(k)!) out.push(cellPos(k))
  out.reverse()
  // 곧은 구간의 중간 점은 빼서 꺾이는 곳만 남김
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true
    const a = out[i - 1], b = out[i + 1]
    return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0])
  })
}

/** 방향키: 화면 기준 그 방향 ±45° 안에서 가장 가까운 구멍 (holeField.ts move 와 같은 점수) */
export type Dir = 'up' | 'down' | 'left' | 'right'
export function nearestInDir(holes: { seat: number; x: number; z: number }[], from: { x: number; z: number; seat?: number }, dir: Dir): number | null {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
  let best: number | null = null, bd = Infinity
  for (const h of holes) {
    if (h.seat === from.seat) continue
    const vx = h.x - from.x, vz = h.z - from.z, len = Math.hypot(vx, vz)
    if (len < 1e-6) continue
    const cos = (vx * d[0] + vz * d[1]) / len
    if (cos < Math.SQRT1_2 - 1e-6) continue
    const score = len + (1 - cos) * 6
    if (score < bd) { bd = score; best = h.seat }
  }
  return best
}

/* ---------- 카메라 (디자인 A 3D 들판이 지금 보여 주는 범위) ---------- */
const CAM_DIST = 12, CAM_PITCH = Math.PI / 4, FOV = 32.3

/** 카메라 목표점: 켜진 구역 camRect 합집합 안으로 (가장 가까운 사각형 안의 점) */
export function camTarget(v: Village, x: number, z: number): [number, number] {
  let best: [number, number] = [x, z], bd = Infinity
  for (const r of v.camRects) {
    const zlo = Math.min(r.z[0], r.z[1]), zhi = Math.max(r.z[0], r.z[1])
    const c: [number, number] = [Math.min(Math.max(x, r.x[0]), r.x[1]), Math.min(Math.max(z, zlo), zhi)]
    const dd = (c[0] - x) ** 2 + (c[1] - z) ** 2
    if (dd < bd) { bd = dd; best = c }
  }
  return best
}

/**
 * 화면에 보이는 땅 (사다리꼴 네 점: 왼쪽 아래 → 오른쪽 아래 → 오른쪽 위 → 왼쪽 위).
 * aspect = 장면 가로/세로, focusX = 목표점이 놓이는 가로 위치(오른쪽 카드가 열리면 0.403), u1 = 가려지지 않은 오른쪽 끝(0~1).
 * 16:9 · 가운데 · 안 가림이면 핸드오프 v3.9 값(아래 폭 9.6, 위 폭 17.4, 앞 3.8 / 뒤 6.9)과 같음
 */
export function camFootprint(tx: number, tz: number, aspect = 16 / 9, focusX = 0.5, u1 = 1): [number, number][] {
  const t = Math.tan((FOV * Math.PI) / 360)
  const cy = Math.sin(CAM_PITCH) * CAM_DIST, cz = tz + Math.cos(CAM_PITCH) * CAM_DIST
  const f = [0, -Math.SQRT1_2, -Math.SQRT1_2], up = [0, Math.SQRT1_2, -Math.SQRT1_2]
  const at = (u: number, ny: number): [number, number] => {
    const nx = 2 * (u + 0.5 - focusX) - 1
    const dx = nx * aspect * t, dy = f[1] + up[1] * ny * t, dz = f[2] + up[2] * ny * t
    const s = -cy / dy
    return [tx + dx * s, cz + dz * s]
  }
  return [at(0, -1), at(u1, -1), at(u1, 1), at(0, 1)]
}
