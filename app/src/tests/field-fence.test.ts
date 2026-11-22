/*
 * 탐색 들판 울타리 닫기 (three/fieldFence.ts, 시험 브랜치 try/explore-v3-11)
 * 켠 구역이 1~6개일 때 울타리가 끊기지 않고 켠 구역 둘레를 닫는지, 6개면 v3.11 그대로인지, 안쪽 물건과 안 겹치는지
 */
import { describe, expect, it } from 'vitest'
import layout from '../data/fieldLayout150.json'
import {
  CROP_OVERHANG_MAX, FENCE_LEN, FENCE_OFFSET, clipRingPiece, closurePieces, fenceRuns, ringOf, runPieces,
  type FencePiece, type FenceZone,
} from '../three/fieldFence'

type Item = number[]
const fence = layout.fence as Item[]
const zonesAll = layout.zones as unknown as (FenceZone & { zone: number; holes: number[][]; paths: { t: number[] }[]; tufts: Item[]; crops: Item[]; flowers: Item[] })[]
const ring = ringOf(fence.map((it) => ({ x: it[1], z: it[3] })))
const zonesOn = (n: number) => zonesAll.filter((z) => z.zone <= n)

/** 울타리 한 조각의 두 끝점 (fence.glb 는 x 방향 길이 2m, ry 로 회전: local +x → (cos ry, -sin ry)) */
const ends = (p: FencePiece): [number, number][] => {
  const h = (FENCE_LEN * p.sx) / 2, dx = Math.cos(p.ry) * h, dz = -Math.sin(p.ry) * h
  return [[p.x - dx, p.z - dz], [p.x + dx, p.z + dz]]
}
/** 점에서 조각(선분)까지 거리 */
const distTo = (px: number, pz: number, p: FencePiece) => {
  const [a, b] = ends(p), dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz))
}
/** 끝점이 다른 어느 조각 위(0.2m 안)에도 없는 곳 = 울타리가 끊긴 곳. 원래 둘레의 모서리 부분은 조각끼리 겹쳐 있어서 끝점끼리가 아니라 조각 위로 봄 */
const gaps = (pieces: FencePiece[]) =>
  pieces.flatMap((p, i) => ends(p).filter((e) => !pieces.some((q, j) => j !== i && distTo(e[0], e[1], q) < 0.2)).map((e) => `${e[0].toFixed(2)},${e[1].toFixed(2)}`))
const allPieces = (zs: typeof zonesAll): FencePiece[] => [
  ...fence.flatMap((it) => clipRingPiece({ x: it[1], z: it[3], ry: it[4], sx: it[5] }, zs, ring)),
  ...closurePieces(zs, ring),
]

describe('울타리 닫기 (fieldFence)', () => {
  it('둘레 울타리는 직선 변 x ±53.4 · z −0.6~−71.4 이고 174조각', () => {
    expect(fence).toHaveLength(174)
    expect(ring.x[0]).toBeCloseTo(-53.4, 0); expect(ring.x[1]).toBeCloseTo(53.4, 0)
    expect(ring.z[0]).toBeCloseTo(-71.4, 0); expect(ring.z[1]).toBeCloseTo(-0.6, 0)
  })

  it('구역 6개를 모두 켜면 새 길 0개, 둘레 174조각이 하나도 안 바뀜 (v3.11 그대로)', () => {
    const on = zonesOn(6)
    expect(closurePieces(on, ring)).toHaveLength(0)
    fence.forEach((it) => {
      const c = clipRingPiece({ x: it[1], z: it[3], ry: it[4], sx: it[5] }, on, ring)
      expect(c).toEqual([{ x: it[1], z: it[3], ry: it[4], sx: it[5] }])
    })
  })

  it.each([1, 2, 3, 4, 5, 6])('구역 1~%i 를 켜면 울타리가 끊기지 않음 (모든 끝이 다른 조각 위에 있음)', (n) => {
    const pieces = allPieces(zonesOn(n))
    expect(pieces.length).toBeGreaterThan(0)
    expect(gaps(pieces)).toEqual([])
  })

  it('구역 번호가 어떻게 켜져도 (63가지) 끊기지 않음', () => {
    for (let mask = 1; mask < 64; mask++) {
      const zs = zonesAll.filter((z) => mask & (1 << (z.zone - 1)))
      const pieces = allPieces(zs)
      expect(gaps(pieces), `켠 구역 ${zs.map((z) => z.zone).join(',')}`).toEqual([])
    }
  })

  it('구역 1개(구역 1): 새 길은 동·서·북쪽 3개(둘레와 안 닿는 변은 길이 36+3), 켠 구역 밖 1.5m', () => {
    const runs = fenceRuns(zonesOn(1), ring)
    expect(runs.length).toBe(3) // 서 · 동 · 북 (남쪽은 둘레 울타리가 이미 있음)
    const east = runs.find((r) => r.axis === 'z' && r.at > 0)!
    const west = runs.find((r) => r.axis === 'z' && r.at < 0)!
    const north = runs.find((r) => r.axis === 'x')!
    expect(east.at).toBeCloseTo(18 + FENCE_OFFSET); expect(west.at).toBeCloseTo(-18 - FENCE_OFFSET)
    expect(north.at).toBeCloseTo(-36 - FENCE_OFFSET)
    // 동·서쪽 길은 둘레 남쪽 선(−0.6)에서 시작해 북쪽 길(−37.5)까지 이어짐
    ;[east, west].forEach((r) => { expect(r.from).toBeCloseTo(-37.5); expect(r.to).toBeCloseTo(ring.z[1]) })
  })

  it('앞면 방향은 둘레 울타리와 같게 바깥 (동 π/2 · 서 −π/2 · 북 π)', () => {
    const runs = fenceRuns(zonesOn(1), ring)
    const east = runPieces(runs.find((r) => r.axis === 'z' && r.at > 0)!)[0]
    const west = runPieces(runs.find((r) => r.axis === 'z' && r.at < 0)!)[0]
    const north = runPieces(runs.find((r) => r.axis === 'x')!)[0]
    expect(east.ry).toBeCloseTo(Math.PI / 2); expect(west.ry).toBeCloseTo(-Math.PI / 2); expect(north.ry).toBeCloseTo(Math.PI)
  })

  it('이어진 두 구역(1+2)은 사이 경계에 울타리를 안 세움, ㄴ자(1+2+3)는 꺾임을 따라감', () => {
    const r12 = fenceRuns(zonesOn(2), ring)
    expect(r12.some((r) => r.axis === 'x' && Math.abs(r.at + 36) < 2)).toBe(false) // 구역 1·2 사이(z −36)에 가로 길 없음
    const r3 = fenceRuns(zonesOn(3), ring)
    // 구역 3 이 x −54..−18, z 0..−36: 구역 2 의 서쪽(−19.5)에는 z −36 아래(구역 2 만 있는 곳)에만 세로 길이 있음
    const mid = r3.filter((r) => r.axis === 'z' && Math.abs(r.at + 19.5) < 1e-6)
    expect(mid.length).toBe(1)
    expect(mid[0].from).toBeCloseTo(ring.z[0], 5)
    expect(mid[0].to).toBeCloseTo(-37.5, 5)
  })

  it('켠 구역의 모든 물건(구멍·작물·꽃·풀)이 새 울타리와 안 겹침 (중심 거리 > 물건 반경 + 울타리 반 두께 0.08)', () => {
    // 반경은 모델 메시를 xz 에서 가장 먼 모서리로 잰 값의 보수적 상한 (작물 1.31 · 구멍 1.26 · 꽃 0.19 · 풀 0.06)
    const R = { 구멍: 1.3, 작물: 1.31, 꽃: 0.2, 풀: 0.1 }
    for (let n = 1; n <= 6; n++) {
      const on = zonesOn(n)
      const pieces = closurePieces(on, ring)
      for (const z of on) {
        const pts: [string, number, number][] = [
          ...z.holes.map((h): [string, number, number] => ['구멍', h[1], h[2]]),
          ...z.tufts.map((it): [string, number, number] => ['풀', it[1], it[3]]),
          ...z.crops.map((it): [string, number, number] => ['작물', it[1], it[3]]),
          ...(layout.themes as { crops: Item[][] | null }[]).flatMap((t) => (t.crops?.[z.zone - 1] ?? []).map((it): [string, number, number] => ['작물', it[1], it[3]])),
          ...z.flowers.map((it): [string, number, number] => ['꽃', it[1], it[3]]),
        ]
        for (const [kind, x, zz] of pts) for (const p of pieces) {
          expect(distTo(x, zz, p), `구역 ${z.zone} ${kind} (${x.toFixed(2)}, ${zz.toFixed(2)}), 켠 구역 1~${n}`).toBeGreaterThan(R[kind as keyof typeof R] + 0.08)
        }
      }
    }
  }, 30_000) // 물건이 많아 기계가 바쁘면(병렬 작업 중) 5초 기본 시간을 넘김

  it('FENCE_OFFSET 이 작물 모델이 경계 밖으로 튀어나오는 최대치 + 울타리 반 두께보다 넉넉함', () => {
    expect(FENCE_OFFSET).toBeGreaterThan(CROP_OVERHANG_MAX + 0.08)
  })

  it('새 길 조각은 길이를 맞춰 2m 안팎, 끝이 길 끝과 정확히 만남', () => {
    for (const r of fenceRuns(zonesOn(1), ring)) {
      const ps = runPieces(r)
      ps.forEach((p) => { expect(p.sx).toBeGreaterThan(0.75); expect(p.sx).toBeLessThan(1.25) })
      const e = ps.flatMap(ends)
      const along = (v: [number, number]) => (r.axis === 'x' ? v[0] : v[1])
      expect(Math.min(...e.map(along))).toBeCloseTo(r.from, 5); expect(Math.max(...e.map(along))).toBeCloseTo(r.to, 5)
    }
  })
})
