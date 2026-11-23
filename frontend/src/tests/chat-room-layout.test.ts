/** 채팅방 3D (design/digul_3d_handoff_chat_v1 THREEJS_chat_room_v3.md): 자리표 · 카메라 프리셋 · 6명 초과 규칙 · 모션 스케줄 */
import { describe, expect, it } from 'vitest'
import {
  CAM_PRESETS, LAYOUTS, MAX_SEATED, REF_ASPECT, SEAT_MIN_MS, ease, firstDrinkAt, fovFor, initialSeated, presetFor, seatToVacate, seatsFor, tagPoint, talkDelayAfterDrink,
} from '../three/chatRoomLayout'

describe('자리 (3번)', () => {
  it('인원별 자리 수 1/2/3/4/6, 5명은 6자리 중 한 자리를 비움', () => {
    expect([1, 2, 3, 4, 6].map((n) => LAYOUTS[n as 1].length)).toEqual([1, 2, 3, 4, 6])
    expect(seatsFor(5)).toHaveLength(5)
    expect(seatsFor(5).every((s) => LAYOUTS[6].includes(s))).toBe(true)
    expect(seatsFor(9)).toHaveLength(MAX_SEATED) // 6명 초과도 자리는 6개
    expect(seatsFor(0)).toHaveLength(1)
  })
  it('자리는 원탁 중심(0,0) 기준 원 위: 1~3마리 1.16 · 4마리 1.22 · 6마리 1.30 (옆자리는 반지름 ±0.01)', () => {
    const r = (s: { x: number; z: number }) => Math.hypot(s.x, s.z)
    for (const s of LAYOUTS[2]) expect(r(s)).toBeCloseTo(1.16, 2)
    for (const s of LAYOUTS[3]) expect(r(s)).toBeCloseTo(1.16, 2)
    for (const s of LAYOUTS[4]) expect(r(s)).toBeCloseTo(1.22, 2)
    for (const s of LAYOUTS[6]) expect(r(s)).toBeCloseTo(1.3, 2)
  })
  it('좌우 대칭, 나(1번)는 왼쪽 노랑 방석, 뒷모습 없음(카메라 +Z 쪽을 보는 성분이 있음)', () => {
    for (const n of [2, 3, 4, 6] as const) {
      const L = LAYOUTS[n]
      expect(L[0].x).toBeLessThan(0)
      expect(L[0].cushion).toBe('yellow')
      for (let i = 0; i < n; i++) { const a = L[i], b = L[n - 1 - i]; expect(a.x).toBeCloseTo(-b.x, 3); expect(a.yaw).toBeCloseTo(-b.yaw, 3) }
      // 두더지 정면 (sin yaw, cos yaw) 과 카메라(+Z) 사이 각이 90° 미만 = 등이 안 보임
      for (const s of L) expect(Math.cos(s.yaw) + 0).toBeGreaterThan(0.05)
    }
  })
  it('이름표 기준점: 1번 자리 → (-0.869, -0.136) (문서 7번)', () => {
    const p = tagPoint(LAYOUTS[1][0])
    expect(p.x).toBeCloseTo(-0.869, 2); expect(p.z).toBeCloseTo(-0.136, 2)
  })
})

describe('카메라 (5번)', () => {
  it('프리셋: 1~2 close · 3~4 medium · 5 이상 wide', () => {
    expect([1, 2, 3, 4, 5, 6, 12].map(presetFor)).toEqual(['close', 'close', 'medium', 'medium', 'wide', 'wide', 'wide'])
    expect(CAM_PRESETS.close.fov).toBe(62); expect(CAM_PRESETS.medium.fov).toBe(65); expect(CAM_PRESETS.wide.fov).toBeCloseTo(67.38, 2)
  })
  it('easeInOutQuad: 0 → 0, 0.5 → 0.5, 1 → 1, 단조 증가', () => {
    expect(ease(0)).toBe(0); expect(ease(0.5)).toBe(0.5); expect(ease(1)).toBe(1)
    let prev = 0
    for (let i = 1; i <= 20; i++) { const v = ease(i / 20); expect(v).toBeGreaterThanOrEqual(prev); prev = v }
  })
  it('화면이 기준(780:1420)보다 좁으면 가로 범위가 같도록 FOV 를 키우고, 넓으면 그대로', () => {
    expect(fovFor(62, REF_ASPECT)).toBeCloseTo(62, 6)
    expect(fovFor(62, 1)).toBe(62)
    const narrow = fovFor(62, REF_ASPECT * 0.8)
    expect(narrow).toBeGreaterThan(62)
    // 가로 반폭 = tan(fov/2) × aspect 가 기준과 같음
    expect(Math.tan((narrow * Math.PI) / 360) * REF_ASPECT * 0.8).toBeCloseTo(Math.tan((62 * Math.PI) / 360) * REF_ASPECT, 6)
  })
})

describe('6명 초과 (문서 맨 위)', () => {
  const ids = ['me', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  it('6명 이하면 모두 앉고 나가 먼저', () => {
    expect(initialSeated({ ids: ['a', 'me', 'b'], meId: 'me', spoke: {} })).toEqual(['me', 'a', 'b'])
  })
  it('6명 초과: 나 + 최근에 말한 5명, 자리 순서는 받은 순서', () => {
    const spoke = { h: 900, g: 800, f: 700, e: 600, d: 500, c: 100 }
    expect(initialSeated({ ids, meId: 'me', spoke })).toEqual(['me', 'd', 'e', 'f', 'g', 'h'])
  })
  it('말한 사람이 5명이 안 되면 나머지는 받은 순서로 채움', () => {
    expect(initialSeated({ ids, meId: 'me', spoke: { h: 5 } })).toEqual(['me', 'a', 'b', 'c', 'd', 'h'])
  })
  it('자리에 없는 사람이 말하면 가장 오래 말이 없던 사람과 교체, 나는 안 나감, 5초 안에 앉은 사람은 안 나감', () => {
    const seated = ['me', 'a', 'b', 'c', 'd', 'e']
    const at = { me: 0, a: 0, b: 0, c: 0, d: 0, e: 0 }
    const spoke = { a: 50, b: 10, c: 70, d: 90, e: 30, me: 0 }
    expect(seatToVacate(seated, 'me', at, spoke, SEAT_MIN_MS)).toBe('b')
    expect(seatToVacate(seated, 'me', { ...at, b: 2000 }, spoke, SEAT_MIN_MS)).toBe('e') // b 는 아직 3초
    expect(seatToVacate(seated, 'me', { me: 0, a: 1, b: 1, c: 1, d: 1, e: 1 }, spoke, 1000)).toBeNull()
    // 한 번도 말 안 한 사람이 가장 오래 말이 없던 사람
    expect(seatToVacate(seated, 'me', at, { a: 5, b: 6, c: 7, d: 8 }, SEAT_MIN_MS)).toBe('e')
  })
})

describe('모션 스케줄 (8번)', () => {
  it('talk 는 drink 시작 후 4~7초, 마리마다 첫 drink 는 10~20초', () => {
    expect(talkDelayAfterDrink(0)).toBe(4); expect(talkDelayAfterDrink(1)).toBe(7)
    expect(firstDrinkAt(0)).toBe(10); expect(firstDrinkAt(1)).toBe(20)
  })
})
