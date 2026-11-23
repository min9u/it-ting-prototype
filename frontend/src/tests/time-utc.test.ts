/**
 * 백엔드 명세 v1 의 시각 · 날짜 (api-convention.md "JSON 필드"): 서버는 UTC "…Z", 날짜만은 "YYYY-MM-DD".
 * 화면은 늘 서울 시각으로 보여야 함 (lib/time.ts)
 */
import { describe, expect, it } from 'vitest'
import { clock, isDateString, isUtcInstant, parseIso, seoulParts, seoulYmd, toIso, ymdLabel } from '../lib/time'

describe('UTC 시각 읽기 · 쓰기', () => {
  it('"…Z" 를 읽으면 서울 시각으로 보인다 (UTC 08:01 → 서울 17:01)', () => {
    const t = parseIso('2026-11-18T08:01:05Z')
    expect(t).toBe(Date.UTC(2026, 10, 18, 8, 1, 5))
    expect(seoulParts(t)).toMatchObject({ y: 2026, m: 11, d: 18, h: 17, mi: 1, s: 5 })
    expect(clock(t)).toBe('오후 5:01')
  })
  it('UTC 로는 전날이어도 서울 날짜는 다음 날 (UTC 11-17 20:00 → 서울 11-18 05:00)', () => {
    const t = parseIso('2026-11-17T20:00:00Z')
    expect(seoulYmd(t)).toBe('2026-11-18')
    expect(clock(t)).toBe('오전 5:00')
  })
  it('오프셋이 붙은 값도 같은 순간으로 읽음 (옛 목 데이터 호환)', () => {
    expect(parseIso('2026-11-18T17:01:05+09:00')).toBe(parseIso('2026-11-18T08:01:05Z'))
  })
  it('toIso 는 명세 모양 "…Z" 를 만들고 다시 읽으면 같은 순간 (초 아래는 버림)', () => {
    const ms = Date.UTC(2026, 10, 18, 8, 1, 5, 789)
    const s = toIso(ms)
    expect(s).toBe('2026-11-18T08:01:05Z')
    expect(isUtcInstant(s)).toBe(true)
    expect(parseIso(s)).toBe(Date.UTC(2026, 10, 18, 8, 1, 5))
  })
  it('isUtcInstant: 오프셋 · 밀리초 · 날짜만은 명세 모양이 아님', () => {
    expect(isUtcInstant('2026-11-18T17:01:05+09:00')).toBe(false)
    expect(isUtcInstant('2026-11-18T08:01:05.123Z')).toBe(false)
    expect(isUtcInstant('2026-11-18')).toBe(false)
  })
})

describe('날짜만 있는 값 "YYYY-MM-DD"', () => {
  it('서울의 그날 0시로 읽음 (시간대를 옮기지 않음)', () => {
    const t = parseIso('2026-11-18')
    expect(seoulYmd(t)).toBe('2026-11-18')
    expect(seoulParts(t)).toMatchObject({ h: 0, mi: 0 })
  })
  it('달력 값은 시간대와 관계없이 그대로 표시', () => {
    expect(isDateString('2026-11-18')).toBe(true)
    expect(isDateString('2026-11-18T00:00:00Z')).toBe(false)
    expect(ymdLabel('2026-11-18')).toBe('11월 18일 (수)')
  })
})
