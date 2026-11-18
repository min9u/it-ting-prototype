/**
 * 탐색 들판 카메라 3단계 · 층별 작물 (3D 핸드오프 v3.10, docs/explore-field-v3-10.md)
 * 근거: design/digul_3d_handoff_v3_10/docs/camera_zoom_spec_v1_1.md (거리 12/24/46, 보이는 땅, 타깃 한계, far 맞춤 타깃, LOD, 히스테리시스, 전환 곡선)
 *      explore_field_handoff_v3_10.md 3 (층마다 작물 1종, 층→작물은 개발 쪽이 정함)
 * three/fieldCam.ts 는 3D(holeField)와 미니맵(fieldGeo)이 같이 쓰는 계산이라 여기서 핸드오프 숫자와 맞는지 확인
 */
import { describe, expect, it } from 'vitest'
import layout from '../data/fieldLayout150.json'
import {
  K_HALF_FAR, K_TO_FAR, K_TO_NEAR, ZOOM_DIST, ZOOM_LEVELS, ZOOM_LOD, camFootprint, camTargetAt, distAt, easeStd, farLimits, lodAt, moleScaleAt,
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

describe('타깃 한계 (camera_zoom_spec 2)', () => {
  it('far 6구역 전체: x ±20.7, y 14.6~45.5 (three z = −y)', () => {
    const L = farLimits(zones)
    near(L.x[0], -20.7, .1); near(L.x[1], 20.7, .1)
    near(-L.z[1], 14.6, .1); near(-L.z[0], 45.5, .1)
  })
  it('far 구역 1만: 맞춤 타깃 (구역 가운데 x, 구역 y0 + 11.1) 고정 = 구멍 중앙 정렬 막음', () => {
    const one = zones.slice(0, 1)
    for (const [x, z] of [[-14, -6], [14, -32], [0, -20]]) {
      const [tx, tz] = camTargetAt('far', one, x, z)
      near(tx, 0, 1e-6); near(-tz, 11.1, 1e-6)
    }
  })
  it('near·mid: 구멍 중앙 정렬 허용 (켜진 구역 camRect 합집합 안, v3.9 그대로) — 구역 1 의 구멍은 들판 남쪽 끝 가까이만 빼고 그대로 가운데', () => {
    const one = zones.slice(0, 1)
    for (const lv of ['near', 'mid'] as const) {
      expect(camTargetAt(lv, one, -14, -20)).toEqual([-14, -20])
      expect(camTargetAt(lv, one, 0, -2)).toEqual([0, -3.8]) // 남쪽 끝은 3.8m 에서 멈춤
    }
  })
  it('far 구역 2개(1·2, 세로): x 는 가운데 고정, y 는 움직임', () => {
    const two = zones.slice(0, 2)
    const L = farLimits(two)
    expect(L.x[0]).toBe(L.x[1])
    expect(L.z[1] - L.z[0]).toBeGreaterThan(20)
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
})

describe('층 → 작물 (우리가 정한 규칙: 캠퍼스-층 목록 순서대로 돌려 씀)', () => {
  it('내 들판(서울-2층)은 호박 (디자이너 예시 화면과 같음)', () => {
    expect(cropOf(MY_FLOOR).id).toBe('pumpkin')
  })
  it('같은 캠퍼스 층끼리는 작물이 다름', () => {
    for (const c of CAMPUS_FLOORS) {
      const ids = c.floors.map((fl) => cropOf({ campus: c.campus, floor: fl }).id)
      expect(new Set(ids).size, c.campus).toBe(ids.length)
    }
  })
  it('지금 목록이면 5종이 다 나옴, 테마 id 는 배치 JSON 에 있음', () => {
    const all = new Set(CAMPUS_FLOORS.flatMap((c) => c.floors.map((fl) => cropOf({ campus: c.campus, floor: fl }).id)))
    expect(all.size).toBe(CROPS.length)
    for (const id of all) expect(layout.themes.map((t) => t.id)).toContain(id)
  })
  it('목록에 없는 층도 정해진 작물 하나 (같은 입력 → 같은 결과)', () => {
    expect(cropOf({ campus: '서울', floor: 99 })).toEqual(cropOf({ campus: '서울', floor: 99 }))
  })
})
