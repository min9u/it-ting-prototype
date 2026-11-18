/**
 * 땅굴 방 길 찾기 (three/roomPath.ts)
 * 근거: 사용자 요청 2026-11-18 "어떤 부분을 클릭해서 그곳으로 갈때 중간에 가구가 있다면 돌아서 가지 못하고 일직선 경로로 가다가 미끄러지는 느낌. 슬쩍 돌아가게"
 */
import { describe, expect, it } from 'vitest'
import { CORNER, clearPath, planPath, type Pt, type Rect } from '../three/roomPath'

const R = 2.75 // roomScene ROOM_R - .5
const box: Rect = { x0: -.5, x1: .5, z0: -.4, z1: .4 }

/** 길의 모든 구간이 장애물을 지나지 않는지 */
const walkable = (start: Pt, way: Pt[], rects: Rect[]) => [start, ...way].every((p, i, a) => i === 0 || clearPath(a[i - 1], p, rects))
const len = (start: Pt, way: Pt[]) => [start, ...way].reduce((s, p, i, a) => (i ? s + Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) : 0), 0)

describe('땅굴 방 길 찾기', () => {
  it('막힌 게 없으면 곧장 (예전과 같은 한 점)', () => {
    expect(planPath({ x: -1, z: 1 }, { x: 1, z: 1 }, [box], R)).toEqual([{ x: 1, z: 1 }])
  })

  it('가운데 가구가 있으면 모서리를 돌아서 감', () => {
    const s = { x: -1.5, z: 0 }, g = { x: 1.5, z: 0 }
    expect(clearPath(s, g, [box])).toBe(false)
    const way = planPath(s, g, [box], R)!
    expect(way.length).toBe(3) // 모서리 두 개 + 도착
    expect(way.at(-1)).toEqual(g)
    expect(walkable(s, way, [box])).toBe(true)
    // 모서리 점은 가구에서 CORNER 만큼 떨어져 있음
    for (const p of way.slice(0, -1)) expect(Math.abs(Math.abs(p.z) - (.4 + CORNER))).toBeLessThan(1e-9)
    // 크게 돌아가지 않음: 곧장 거리(3m)보다 조금만 김
    expect(len(s, way)).toBeLessThan(3.4)
  })

  it('짧은 쪽으로 돎 (가구가 아래로 치우쳐 있으면 위로)', () => {
    const r: Rect = { x0: -.5, x1: .5, z0: -.2, z1: 1.2 }
    const way = planPath({ x: -1.5, z: .3 }, { x: 1.5, z: .3 }, [r], R)!
    expect(way.slice(0, -1).every((p) => p.z < 0)).toBe(true)
  })

  it('가구 두 개 사이 틈으로 지나감', () => {
    const a: Rect = { x0: -.5, x1: .5, z0: -2, z1: -.4 }, b: Rect = { x0: -.5, x1: .5, z0: .4, z1: 2 }
    const s = { x: -1.5, z: 0 }, g = { x: 1.5, z: 0 }
    const way = planPath(s, g, [a, b], R)!
    expect(way).toEqual([g]) // 틈(0.8m)이 곧게 열려 있으면 그대로
    const c: Rect = { x0: -.1, x1: .1, z0: -.5, z1: .5 } // 틈을 막으면 바깥으로 돎
    const way2 = planPath(s, g, [a, b, c], R)
    expect(way2 === null || walkable(s, way2, [a, b, c])).toBe(true)
  })

  it('방 밖 모서리 점은 안 씀 (벽에 붙은 가구는 안쪽으로 돎)', () => {
    const wall: Rect = { x0: -.6, x1: .6, z0: -2.9, z1: -1.6 } // 뒤쪽 벽에 붙은 침대 같은 것
    const s = { x: -1.4, z: -1.9 }, g = { x: 1.4, z: -1.9 }
    const way = planPath(s, g, [wall], R)!
    expect(way).not.toBeNull()
    for (const p of way) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(R)
    expect(walkable(s, way, [wall])).toBe(true)
  })

  it('갈 수 없는 곳이면 null (부르는 쪽이 예전처럼 곧장)', () => {
    // 도착점을 사방으로 막음
    const g = { x: 0, z: 0 }
    const ring: Rect[] = [
      { x0: -1, x1: 1, z0: -1, z1: -.3 }, { x0: -1, x1: 1, z0: .3, z1: 1 },
      { x0: -1, x1: -.3, z0: -1, z1: 1 }, { x0: .3, x1: 1, z0: -1, z1: 1 },
    ]
    expect(planPath({ x: 2, z: 0 }, g, ring, R)).toBeNull()
  })

  it('경계 위 점(clampRoom 이 변으로 민 도착점)은 막힌 것으로 안 봄', () => {
    const g = { x: .5, z: 0 } // box 오른쪽 변 위
    expect(planPath({ x: 1.5, z: 0 }, g, [box], R)).toEqual([g])
  })

  it('가구 안에서 출발해도 빠져나오는 길은 막지 않음 (일어난 자리가 방석 발자리 안일 때)', () => {
    const s = { x: 0, z: 0 }
    const way = planPath(s, { x: 1.5, z: 0 }, [box], R)
    expect(way).toEqual([{ x: 1.5, z: 0 }])
  })

  it('가구 20개여도 빠름 (클릭 한 번)', () => {
    const rects: Rect[] = []
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, r = 1.2 + (i % 3) * .5
      rects.push({ x0: Math.cos(a) * r - .2, x1: Math.cos(a) * r + .2, z0: Math.sin(a) * r - .2, z1: Math.sin(a) * r + .2 })
    }
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) planPath({ x: -2.4, z: .3 }, { x: 2.4, z: -.3 }, rects, R)
    expect((performance.now() - t0) / 20).toBeLessThan(10)
  })
})
