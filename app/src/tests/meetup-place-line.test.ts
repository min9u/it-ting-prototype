/** F7 모임 카드 (팀 명세 07 · 11-20): 모임에는 캠퍼스가 없어 카드 장소 줄에 붙지 않음 */
import { describe, expect, it } from 'vitest'
import { getMeetupState, placeLine } from '../data/meetupStore'

describe('F7 카드 장소 줄', () => {
  const off = getMeetupState().list.filter((m) => m.mode === '오프라인')
  it('오프라인: "지역 · 오프라인" (캠퍼스 이름이 앞에 안 붙고, 모임에 캠퍼스 값도 없음)', () => {
    expect(off.length).toBeGreaterThan(0)
    for (const m of off) {
      expect(placeLine(m)).toBe(`${m.area} · 오프라인`)
      expect('campus' in m).toBe(false)
    }
  })
})
