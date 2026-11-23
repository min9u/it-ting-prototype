/**
 * 접촉 그림자 판 위치 (three/contactShadow.ts): 디자이너 room_base_v3_1 의 수납장·스탠드·큰 화분 판이 가구에서 1.2m 떨어져
 * 방 바깥에 떠 있던 문제 (2026-11-22). 실제 glb 의 숫자로 확인
 */
import { describe, expect, it } from 'vitest'
import { SHADOW_OFFSET_MAX, shadowFixedPos, shadowOffset } from '../three/contactShadow'

// shadow_round_table 과 같은 판 메시 가운데 (glb accessor min/max: x -1.22~-0.22, z -1.68~-0.68)
const C = { x: -0.72, z: -1.18 }

describe('접촉 그림자 판', () => {
  it('translation 0 + 크기 배율만 있는 판(수납장 · 스탠드 · 큰 화분)은 가구 아래로 옮겨짐', () => {
    for (const [name, sc] of [['cabinet', { x: 1.15, z: 0.75 }], ['lamp', { x: 0.65, z: 0.65 }], ['plant', { x: 0.8, z: 0.8 }]] as const) {
      const before = shadowOffset(C, sc, { x: 0, z: 0 })
      expect(Math.hypot(before.x, before.z), `${name} 원래는 방 바깥으로 떠 있음`).toBeGreaterThan(0.5)
      const p = shadowFixedPos(C, sc, { x: 0, z: 0 })
      const after = shadowOffset(C, sc, p)
      expect(Math.hypot(after.x, after.z), name).toBeCloseTo(0, 6)
    }
  })
  it('원탁(translation 0.72, 1.18)과 방석처럼 이미 가구 아래인 판은 그대로', () => {
    expect(shadowFixedPos(C, { x: 1, z: 1 }, { x: 0.72, z: 1.18 })).toEqual({ x: 0.72, z: 1.18 })
    const cush = { x: -0.1, z: -1.5 } // 방석 판 메시 가운데 + translation (0.1, 1.5)
    expect(shadowFixedPos(cush, { x: 1, z: 1 }, { x: 0.1, z: 1.5 })).toEqual({ x: 0.1, z: 1.5 })
    expect(SHADOW_OFFSET_MAX).toBeLessThan(0.5)
  })
})
