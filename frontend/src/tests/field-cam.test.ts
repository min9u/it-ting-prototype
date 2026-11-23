/**
 * 탐색 들판 카메라 3단계 · 층별 작물 (3D 핸드오프 v3.11, 시험 브랜치 try/explore-v3-11. v3.10 은 docs/explore-field-v3-10.md)
 * 근거: design/digul_3d_handoff_v3_11/docs/camera_zoom_spec_v1_2.md (거리 12/24/46, 보이는 땅, 구멍 따라가기 + 바깥 잔디 안전 한계, far 구역 1개 ±9m, LOD, 히스테리시스, 전환 곡선, 크기 연속)
 *      explore_field_handoff_v3_11.md 2·3 (작물 9종, 층마다 작물 1종, 층→작물은 개발 쪽이 정함)
 * three/fieldCam.ts 는 3D(holeField)와 미니맵(fieldGeo)이 같이 쓰는 계산이라 여기서 핸드오프 숫자와 맞는지 확인
 */
import { describe, expect, it } from 'vitest'
import layout from '../data/fieldLayout150.json'
import {
  FAR_FOLLOW, K_HALF_FAR, K_TO_FAR, K_TO_NEAR, OUTER_GRASS, SAFE_MARGIN, ZOOM_DIST, ZOOM_LEVELS, ZOOM_LOD, camFootprint, camTargetAt, distAt, dragLimits, dragTarget, easeStd, holeScaleAt, lodAt, moleScaleAt, safeLimits,
} from '../three/fieldCam'
import { CAMPUS_FLOORS, CROPS, MY_FLOOR, cropOf } from '../data/field'

const zones = layout.zones as unknown as Parameters<typeof camTargetAt>[1]
const near = (a: number, b: number, eps = 0.06) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThan(eps)

describe('카메라 단계 수치 = 배치 JSON camera.levels', () => {
  it('거리·LOD 표가 같음', () => {
    for (const lv of ZOOM_LEVELS) {
      const j = layout.camera.levels[lv]
      expect(ZOOM_DIST[lv]).toBe(j.distance)
      expect(ZOOM_LOD[lv].flowers).toBe(j.lod.flowers)
      expect(ZOOM_LOD[lv].tufts).toBe(j.lod.tufts > 0)
      expect(ZOOM_LOD[lv].crop).toBe(j.lod.crop)
      expect(ZOOM_LOD[lv].hole).toBe(j.lod.hole)
      expect(ZOOM_LOD[lv].mole).toBe(j.lod.mole)
    }
  })
  it('보이는 땅 계수 × 거리 = 단계별 타깃→가까운 변 / 먼 변 / 먼 변 반폭', () => {
    for (const lv of ZOOM_LEVELS) {
      const j = layout.camera.levels[lv], D = ZOOM_DIST[lv]
      near(K_TO_NEAR * D, j.toNear); near(K_TO_FAR * D, j.toFar); near(K_HALF_FAR * D, j.halfFar)
    }
  })
  it('보이는 땅 사다리꼴: near 가까운 변 9.6 · 먼 변 17.4 · 깊이 10.7, far 36.7 · 66.7 · 41.1 (16:9 가운데)', () => {
    const w = (p: [number, number][]) => [Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[2][0] - p[3][0], p[2][1] - p[3][1]), Math.abs(p[0][1] - p[3][1])]
    const [a, b, c] = w(camFootprint(0, 0, 16 / 9, 0.5, 1, 12))
    near(a, 9.6, .1); near(b, 17.4, .1); near(c, 10.7, .1)
    const [d, e, f] = w(camFootprint(0, 0, 16 / 9, 0.5, 1, 46))
    near(d, 36.7, .2); near(e, 66.7, .3); near(f, 41.1, .2)
  })
})

describe('타깃: 구멍 따라가기 + 안전 한계 (camera_zoom_spec_v1_2)', () => {
  const holes = layout.zones.flatMap((z) => z.holes.map((h) => ({ seat: h[0], x: h[1], z: h[2] })))
  /** 화면 사다리꼴 ∩ 구역 1(x ±18, z −36~0) 넓이 ÷ 화면 넓이 (0.25m 격자) */
  const activeShare = (tx: number, tz: number) => {
    const poly = camFootprint(tx, tz, 16 / 9, 0.5, 1, 46)
    const inside = ([x, z]: [number, number]) => {
      let c = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j]
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
      }
      return c
    }
    let area = 0
    for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; area += x1 * z2 - x2 * z1 }
    area = Math.abs(area) / 2
    let hit = 0
    for (let x = -17.875; x < 18; x += 0.25) for (let z = -35.875; z < 0; z += 0.25) if (inside([x, z])) hit++
    return (hit * 0.0625) / area
  }

  it('안전 한계 = 바깥 잔디 안쪽 2m: near x ±79.3 · y −30.2~99.1, mid ±70.6 · −26.4~92.2, far ±54.7 · −19.4~79.5 (three z = −y, JSON 과 같음)', () => {
    for (const lv of ZOOM_LEVELS) {
      const L = safeLimits(ZOOM_DIST[lv]), j = layout.camera.levels[lv].safe
      near(L.x[0], j.x[0]); near(L.x[1], j.x[1])
      near(-L.z[1], j.y[0]); near(-L.z[0], j.y[1])
    }
  })
  it('구멍 150개는 어느 단계에서도 한계에 안 걸림: 켠 구역 여러 개면 타깃 = 구멍 그대로 (far 포함)', () => {
    expect(holes).toHaveLength(150)
    for (const lv of ZOOM_LEVELS) for (const h of holes) {
      const [tx, tz] = camTargetAt(lv, zones, h.x, h.z)
      expect(tx, `${lv} ${h.seat}`).toBeCloseTo(h.x, 9); expect(tz, `${lv} ${h.seat}`).toBeCloseTo(h.z, 9)
    }
    for (const lv of ZOOM_LEVELS) { // 구역 2개(1·2)
      const [tx, tz] = camTargetAt(lv, zones.slice(0, 2), -14, -60)
      expect([tx, tz]).toEqual([-14, -60])
    }
  })
  it('near·mid 는 구역이 1개여도 구멍 그대로 (v3.10 의 구역 안 가운데로 끌어오기·남쪽 끝 3.8m 멈춤은 없어짐)', () => {
    const one = zones.slice(0, 1)
    for (const lv of ['near', 'mid'] as const) {
      expect(camTargetAt(lv, one, -14, -20)).toEqual([-14, -20])
      expect(camTargetAt(lv, one, 0, -2)).toEqual([0, -2])
    }
  })
  it('far · 구역 1개: 맞춤 타깃(구역 가운데 x, 구역 남쪽 + 11.1)에서 구멍 쪽으로 ±9m 까지만 따라감', () => {
    const one = zones.slice(0, 1)
    const [cx, cz] = camTargetAt('far', one, 0, -18) // 구역 가운데 구멍 → 맞춤 타깃 그대로
    near(cx, 0, 1e-9); near(-cz, 11.1, 1e-9)
    const [ax, az] = camTargetAt('far', one, -14, -3) // 서쪽 −14 → −9, 남쪽 Blender y 3 (가운데 −15) → −9
    near(ax, -9, 1e-9); near(-az, 11.1 - 9, 1e-9)
    const [bx, bz] = camTargetAt('far', one, 14, -33) // 동쪽 +14 → +9, 북쪽 y 33 (가운데 +15) → +9
    near(bx, 9, 1e-9); near(-bz, 11.1 + 9, 1e-9)
    const [dx] = camTargetAt('far', one, 5, -18) // ±9 안쪽은 구멍 따라 그대로 (구역 가운데에서 5)
    near(dx, 5, 1e-9)
    expect(FAR_FOLLOW).toBe(9)
  })
  it('far · 구역 1개의 활성 구역 점유율(화면 중 켠 구역): ±9m 규칙이면 최소 46% · 평균 51% (핸드오프 값), 완전히 따라가면 최소 22% 까지 내려감', () => {
    const one = zones.slice(0, 1)
    const z1 = holes.filter((h) => h.seat <= 25)
    expect(z1).toHaveLength(25)
    const share = z1.map((h) => { const [tx, tz] = camTargetAt('far', one, h.x, h.z); return activeShare(tx, tz) })
    const free = z1.map((h) => activeShare(h.x, h.z))
    expect(Math.min(...share)).toBeGreaterThan(0.45)
    near(share.reduce((a, b) => a + b, 0) / share.length, 0.513, 0.02)
    expect(Math.min(...free)).toBeLessThan(0.3)
  })
  it('far 구역 1 맞춤 타깃이면 16:9 화면 사다리꼴이 구역 네 모서리를 다 덮음 (한 구역이 한 화면에)', () => {
    const [tx, tz] = camTargetAt('far', zones.slice(0, 1), 0, -18)
    const poly = camFootprint(tx, tz, 16 / 9, 0.5, 1, 46)
    const inside = ([x, z]: [number, number]) => {
      let c = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j]
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
      }
      return c
    }
    for (const p of [[-18, 0], [18, 0], [-18, -36], [18, -36]] as [number, number][]) expect(inside(p), `${p}`).toBe(true)
  })
  it('구멍이 아닌 곳(자유 패닝)을 가리키면 안전 한계에서 멈춤', () => {
    const [x, z] = camTargetAt('far', zones, 200, -300)
    near(x, 54.67, 0.01); near(z, -(108 - 0.5766 * 46 - 2), 0.01)
    const [x2, z2] = camTargetAt('near', zones, -200, 100)
    near(x2, -(90 - 0.7246 * 12 - 2), 0.01); near(z2, -(-36 + 0.3176 * 12 + 2), 0.01)
  })
  it('화면이 바깥 잔디(x ±90, y −36~108)를 넘지 않음: 가장자리 구멍(서 54번 · 동 104번 · 남 24번 · 북 49번)을 가운데 두고 세 단계 모두', () => {
    for (const lv of ZOOM_LEVELS) for (const seat of [54, 104, 24, 49]) {
      const h = holes.find((q) => q.seat === seat)!
      const [tx, tz] = camTargetAt(lv, zones, h.x, h.z)
      const poly = camFootprint(tx, tz, 16 / 9, 0.5, 1, ZOOM_DIST[lv])
      for (const [px, pz] of poly) { expect(Math.abs(px), `${lv} ${seat}`).toBeLessThanOrEqual(90.05); expect(-pz, `${lv} ${seat}`).toBeGreaterThanOrEqual(-36.05); expect(-pz, `${lv} ${seat}`).toBeLessThanOrEqual(108.05) }
    }
  })
})

describe('전환 · LOD', () => {
  it('곡선 cubic-bezier(0.4,0,0.2,1): 0 → 0, 1 → 1, 늘 커짐, 가운데쯤 빠름', () => {
    expect(easeStd(0)).toBe(0); expect(easeStd(1)).toBe(1)
    let prev = 0
    for (let i = 1; i <= 50; i++) { const v = easeStd(i / 50); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v }
    expect(easeStd(0.5)).toBeGreaterThan(0.6)
  })
  it('거리는 로그 보간 (12 → 46 의 가운데 = √(12·46))', () => {
    near(distAt(12, 46, 0.5), Math.sqrt(12 * 46), 1e-9)
  })
  it('LOD 히스테리시스: 올라갈 때 18.7 / 37.4, 내려갈 때 30.6 / 15.3', () => {
    expect(lodAt(18.6, 'near')).toBe('near'); expect(lodAt(18.8, 'near')).toBe('mid')
    expect(lodAt(37.3, 'mid')).toBe('mid'); expect(lodAt(37.5, 'mid')).toBe('far')
    expect(lodAt(30.7, 'far')).toBe('far'); expect(lodAt(30.5, 'far')).toBe('mid')
    expect(lodAt(15.4, 'mid')).toBe('mid'); expect(lodAt(15.2, 'mid')).toBe('near')
  })
  it('두더지 배율: 단계에서는 표 값 (1 / 1.15 / 1.5), 사이는 그 사이', () => {
    near(moleScaleAt(12), 1, 1e-9); near(moleScaleAt(24), 1.15, 1e-9); near(moleScaleAt(46), 1.5, 1e-9)
    const m = moleScaleAt(34)
    expect(m > 1.15 && m < 1.5).toBe(true)
  })
  it('구멍·후광·작물 배율 (v3.11 연속): 24m 까지 1, 46m 에서 1.25 (표 값), 사이는 log D 선형, 12m 아래도 1', () => {
    near(holeScaleAt(8), 1, 1e-9); near(holeScaleAt(12), 1, 1e-9); near(holeScaleAt(24), 1, 1e-9)
    near(holeScaleAt(46), ZOOM_LOD.far.hole, 1e-9)
    expect(ZOOM_LOD.far.crop).toBe(ZOOM_LOD.far.hole) // 한 함수로 두 가지에 씀
    near(holeScaleAt(Math.sqrt(24 * 46)), 1.125, 1e-9) // 로그 가운데 = 절반
    let prev = 1
    for (let d = 24; d <= 46; d += 1) { const k = holeScaleAt(d); expect(k).toBeGreaterThanOrEqual(prev - 1e-12); prev = k }
  })
})

describe('층 → 작물 (사용자 결정 2026-11-20: 빵은 대전 층만, 나머지 8종은 대전 아닌 층을 목록 순서대로 돌려 씀)', () => {
  const nonBread = CAMPUS_FLOORS.filter((c) => c.campus !== '대전')
  const EIGHT = ['pumpkin', 'apple', 'strawberry', 'sweetpotato', 'carrot', 'corn', 'tomato', 'sunflower']
  it('내 들판(서울-2층)은 호박 (디자이너 예시 화면과 같음)', () => {
    expect(cropOf(MY_FLOOR).id).toBe('pumpkin')
  })
  it('대전 층은 몇 번 층이든 전부 빵 (목록에 없는 대전 층도)', () => {
    const daejeon = CAMPUS_FLOORS.find((c) => c.campus === '대전')!
    expect(daejeon.floors.length).toBeGreaterThan(1) // 대전 층이 여러 개여도 전부 빵인지 보려면 층이 둘 이상이어야 함
    for (const fl of [...daejeon.floors, 3, 9, 99]) expect(cropOf({ campus: '대전', floor: fl }).id, `대전-${fl}층`).toBe('bread')
  })
  it('대전이 아닌 층은 빵이 아님 (목록에 없는 층도)', () => {
    for (const c of nonBread) for (const fl of c.floors) expect(cropOf({ campus: c.campus, floor: fl }).id, `${c.campus}-${fl}층`).not.toBe('bread')
    for (const campus of ['서울', '광주', '구미', '부울경', '제주']) expect(cropOf({ campus, floor: 99 }).id).not.toBe('bread')
  })
  it('대전 아닌 층은 목록 순서대로 호박 → 사과 → 딸기 → 고구마 → 당근 → 옥수수 → 토마토 → 해바라기 (대전은 세지 않고 건너뜀)', () => {
    const got = nonBread.flatMap((c) => c.floors.map((fl) => cropOf({ campus: c.campus, floor: fl }).id))
    expect(got).toEqual(EIGHT.slice(0, got.length)) // 지금 층 7개면 해바라기만 남음
    expect(cropOf({ campus: '서울', floor: 2 }).id).toBe('pumpkin')
    expect(cropOf({ campus: '서울', floor: 3 }).id).toBe('apple')
    expect(cropOf({ campus: '서울', floor: 12 }).id).toBe('strawberry')
  })
  it('대전 아닌 층끼리는 작물이 다름 (8개 층까지)', () => {
    const ids = nonBread.flatMap((c) => c.floors.map((fl) => cropOf({ campus: c.campus, floor: fl }).id))
    expect(ids.length).toBeLessThanOrEqual(EIGHT.length)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('빵 아닌 8종 id 는 배치 JSON 테마에 있고, 지금 목록에서 안 나오는 작물은 해바라기뿐', () => {
    const used = new Set(CAMPUS_FLOORS.flatMap((c) => c.floors.map((fl) => cropOf({ campus: c.campus, floor: fl }).id)))
    for (const id of used) expect(layout.themes.map((t) => t.id)).toContain(id)
    expect(CROPS.map((c) => c.id).filter((id) => !used.has(id))).toEqual(['sunflower'])
  })
  it('CROPS 표와 배치 JSON themes 가 같은 9종, 같은 순서', () => {
    expect(CROPS).toHaveLength(9)
    expect(CROPS.map((c) => c.id)).toEqual(layout.themes.map((t) => t.id))
  })
  it('목록에 없는 층도 정해진 작물 하나 (같은 입력 → 같은 결과)', () => {
    expect(cropOf({ campus: '서울', floor: 99 })).toEqual(cropOf({ campus: '서울', floor: 99 }))
  })
})

describe('끌어 옮기기 (마우스로 땅 잡고 끌기, 모든 줌 단계)', () => {
  it('dragLimits: 16:9 · 가운데면 안전 한계(safeLimits)와 같음', () => {
    for (const lv of ZOOM_LEVELS) {
      const a = dragLimits(ZOOM_DIST[lv]), b = safeLimits(ZOOM_DIST[lv])
      near(a.x[0], b.x[0]); near(a.x[1], b.x[1]); near(a.z[0], b.z[0]); near(a.z[1], b.z[1])
    }
  })
  it('한계 위치에서 화면에 보이는 땅이 바깥 잔디 경계 + 2m 여유에 정확히 닿음 (비율·카드 위치가 달라도)', () => {
    const cases: [number, number][] = [[16 / 9, 0.5], [16 / 9, 0.403], [21 / 9, 0.5], [4 / 3, 0.403]]
    for (const lv of ZOOM_LEVELS) for (const [aspect, fx] of cases) {
      const L = dragLimits(ZOOM_DIST[lv], aspect, fx)
      const at = (tx: number, tz: number) => camFootprint(tx, tz, aspect, fx, 1, ZOOM_DIST[lv])
      const lo = at(L.x[0], L.z[0]), hi = at(L.x[1], L.z[1])
      near(Math.min(...lo.map((p) => p[0])), -OUTER_GRASS.x + SAFE_MARGIN, 1e-6)
      near(Math.max(...hi.map((p) => p[0])), OUTER_GRASS.x - SAFE_MARGIN, 1e-6)
      near(Math.min(...lo.map((p) => p[1])), -(OUTER_GRASS.y1 - SAFE_MARGIN), 1e-6) // 먼 변 (three z, 북쪽)
      near(Math.max(...hi.map((p) => p[1])), -(OUTER_GRASS.y0 + SAFE_MARGIN), 1e-6) // 가까운 변 (남쪽)
    }
  })
  it('화면이 넓을수록 · 오른쪽 카드가 열려 왼쪽으로 치우칠수록 좌우 한계가 좁아짐', () => {
    const base = dragLimits(ZOOM_DIST.far)
    const wide = dragLimits(ZOOM_DIST.far, 21 / 9)
    expect(wide.x[1] - wide.x[0]).toBeLessThan(base.x[1] - base.x[0])
    const shifted = dragLimits(ZOOM_DIST.far, 16 / 9, 0.403) // 타깃이 왼쪽에 있어 오른쪽으로 더 보임
    expect(shifted.x[1]).toBeLessThan(base.x[1])
    expect(shifted.x[0]).toBeLessThan(base.x[0])
    expect(shifted.x[1] - shifted.x[0]).toBeCloseTo(base.x[1] - base.x[0], 9) // 폭은 같고 옮겨질 뿐
  })
  it('구멍 150개를 따라가는 자리는 모든 단계에서 끄는 한계 안 (따라가기와 끌기가 서로 부딪히지 않음)', () => {
    for (const lv of ZOOM_LEVELS) {
      const L = dragLimits(ZOOM_DIST[lv])
      for (const z of layout.zones) for (const h of z.holes) {
        const [tx, tz] = camTargetAt(lv, zones, h[1], h[2])
        expect(tx).toBeGreaterThanOrEqual(L.x[0] - 0.06); expect(tx).toBeLessThanOrEqual(L.x[1] + 0.06)
        expect(tz).toBeGreaterThanOrEqual(L.z[0] - 0.06); expect(tz).toBeLessThanOrEqual(L.z[1] + 0.06)
      }
    }
  })
  it('dragTarget: 포인터를 오른쪽 · 아래로 끌면 땅이 같이 움직임 = 카메라 타깃은 왼쪽 · 위로', () => {
    const L = dragLimits(ZOOM_DIST.mid)
    // 포인터가 가리키는 땅 점이 g0 (0, 0) → g1 (+3, +2) 로 바뀜 = 포인터가 오른쪽·아래(남쪽)로 움직임
    const [x, z] = dragTarget([10, -20], [0, 0], [3, 2], L)
    expect(x).toBeCloseTo(7, 9)
    expect(z).toBeCloseTo(-22, 9)
  })
  it('dragTarget: 한계에서 멈춤 (바깥 잔디 경계 안쪽까지만)', () => {
    for (const lv of ZOOM_LEVELS) {
      const L = dragLimits(ZOOM_DIST[lv])
      // 포인터가 땅 점 (-500, -500) 쪽을 가리킴 → 타깃은 (+500, +470): 오른쪽 · 남쪽 한계에서 멈춤
      const [x, z] = dragTarget([0, -30], [0, 0], [-500, -500], L)
      expect(x).toBe(L.x[1]); expect(z).toBe(L.z[1])
      // 반대: 타깃은 (-500, -530): 왼쪽 · 북쪽 한계에서 멈춤
      const [x2, z2] = dragTarget([0, -30], [0, 0], [500, 500], L)
      expect(x2).toBe(L.x[0]); expect(z2).toBe(L.z[0])
    }
  })
  it('dragTarget: 움직이지 않으면 그대로', () => {
    expect(dragTarget([4, -9], [1, 1], [1, 1], dragLimits(ZOOM_DIST.near))).toEqual([4, -9])
  })
})
