/** F7 모임 리스트 (팀 명세 11-20): 캠퍼스로 거르지 않고, 카드 장소 줄에 캠퍼스를 붙이지 않음 */
import { describe, expect, it } from 'vitest'
import { getMeetupState, placeLine } from '../data/meetupStore'

describe('F7 카드 장소 줄', () => {
  const off = getMeetupState().list.filter((m) => m.mode === '오프라인')
  it('오프라인: "지역 · 오프라인" (캠퍼스 이름이 앞에 안 붙음)', () => {
    expect(off.length).toBeGreaterThan(0)
    for (const m of off) {
      expect(placeLine(m)).toBe(`${m.area} · 오프라인`)
      if (m.campus) expect(placeLine(m)).not.toContain(`${m.campus} · ${m.area}`)
    }
  })
})
