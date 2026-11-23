/**
 * 탐색 들판 · 추천 (data/field.ts)
 * 근거: 02 F5 탐색 1 (들판 = 학기 하나의 캠퍼스-층, 자리 = 온보딩 완료 순서), 5 (오늘의 추천 친구: 하루 한 번, 걸러 내지 않고 우선순위),
 *      13 · 00 공통 13 ("탐색" = 그 땅굴이 놓인 들판으로), 3D 핸드오프 v3.9 (구역 25자리 × 6 = 150, 켜는 구역 = ceil(가장 큰 번호/25))
 *      00 공통 4 (반은 쓰지 않음), docs/explore-field-v3-9.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMPUS_FLOORS, CURRENT_TERM, MY_FLOOR, MY_SEAT, affOf, allCurrentFloors, exploreHref, fieldOf, fieldUserOf,
  floorId, floorLabel, locateUser, parseFloor, shortAffOf,
} from '../data/field'
import { ME_ID, USERS } from '../data/mock'
import layout from '../data/fieldLayout150.json'

const SEATS = layout.zones.reduce((n, z) => n + z.holes.length, 0)

describe('들판 id · 이름 (00 공통 19 캠퍼스-층 · 학기)', () => {
  it('id 를 만들고 다시 읽음', () => {
    const id = floorId(CURRENT_TERM, '대전', 2)
    expect(parseFloor(id)).toEqual({ id, term: CURRENT_TERM, campus: '대전', floor: 2 })
    expect(parseFloor('잘못된 값')).toBeNull()
  })
  it('이번 학기는 "서울-2층", 지난 학기는 학기를 앞에', () => {
    expect(floorLabel(MY_FLOOR)).toBe('서울-2층')
    expect(floorLabel(parseFloor(floorId('2026 상반기', '서울', 12))!)).toBe('2026 상반기 서울-12층')
  })
  it('이번 학기 들판 = 캠퍼스별 층 목록 전부', () => {
    expect(allCurrentFloors()).toHaveLength(CAMPUS_FLOORS.reduce((n, c) => n + c.floors.length, 0))
  })
  // 지금은 가입·내 정보의 캠퍼스-층(data/auth.ts: 서울 2·10·12·13층 …)과 들판 목록(data/field.ts: 서울 2·3·12층 …)이 다름 → docs/spec-design-gaps.md G-10
  it.todo('00 공통 19: 가입 때 고를 수 있는 캠퍼스-층마다 들판이 있음 (목록을 하나로 합친 뒤)')
  it('탐색 주소에 들판과 자리가 남음 (뒤로 가기하면 보던 자리)', () => {
    expect(exploreHref(MY_FLOOR, 13)).toBe(`/burrow/explore?floor=${encodeURIComponent(MY_FLOOR.id)}&seat=13`)
    expect(exploreHref(MY_FLOOR)).not.toContain('seat=')
  })
})

describe('fieldOf: 들판의 땅굴 주인 (F5 1 · v3.9)', () => {
  it('모든 이번 학기 들판: 자리 번호는 1~150 안에서 하나씩, 구역 수 = ceil(가장 큰 번호/25) (최소 1)', () => {
    expect(SEATS).toBe(150)
    for (const f of allCurrentFloors()) {
      const d = fieldOf(f)
      const seats = d.residents.map((r) => r.seat)
      expect(new Set(seats).size, f.id).toBe(seats.length)
      for (const s of seats) {
        expect(s, f.id).toBeGreaterThanOrEqual(1)
        expect(s, f.id).toBeLessThanOrEqual(SEATS)
      }
      expect(d.maxSeat, f.id).toBeLessThanOrEqual(SEATS)
      expect(d.zones, f.id).toBe(Math.max(1, Math.ceil(d.maxSeat / 25)))
      expect(d.zones, f.id).toBeLessThanOrEqual(layout.zones.length)
    }
  })
  it('내 들판(서울-2층)은 38자리 → 구역 2개, 내 자리 13번, 탈퇴로 빈 7·31번은 비어 있음', () => {
    const d = fieldOf(MY_FLOOR)
    expect(d.maxSeat).toBe(38)
    expect(d.zones).toBe(2)
    expect(d.mySeat).toBe(MY_SEAT)
    expect(d.residents.find((r) => r.mine)?.seat).toBe(MY_SEAT)
    expect(d.residents.some((r) => r.seat === 7 || r.seat === 31)).toBe(false)
  })
  it('빈 들판(지난 학기 부울경-1층)은 주인 0명이어도 구역 1개 (빈 상태 화면)', () => {
    const d = fieldOf(parseFloor(floorId('2026 상반기', '부울경', 1))!)
    expect(d.residents).toHaveLength(0)
    expect(d.zones).toBe(1)
  })
  it('같은 들판은 언제나 같은 결과 (서버 대신 시드)', () => {
    const f = parseFloor(floorId(CURRENT_TERM, '서울', 3))!
    const a = fieldOf(f).residents.map((r) => `${r.seat}:${r.user.id}`)
    const b = fieldOf({ ...f }).residents.map((r) => `${r.seat}:${r.user.id}`)
    expect(b).toEqual(a)
  })
  it('사람 id 는 모든 들판에서 하나뿐', () => {
    const ids = allCurrentFloors().flatMap((f) => fieldOf(f).residents.map((r) => r.user.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('locateUser (F5 13 · 00 공통 13: 방문자 뷰 "탐색" → 그 사람 들판의 그 구멍)', () => {
  it('나 → 내 들판 내 자리', () => {
    expect(locateUser(ME_ID)).toEqual({ floor: MY_FLOOR, seat: MY_SEAT })
  })
  it('실명 목 사용자 → 정해 둔 들판·자리', () => {
    const r = locateUser('yerin')!
    expect(r.floor.id).toBe(MY_FLOOR.id)
    expect(r.seat).toBe(1)
    expect(locateUser('park')!.floor.campus).toBe('대전')
  })
  it('들판에서 만든 사람도 찾고, 그 자리에 정말 그 사람이 있음', () => {
    const f = parseFloor(floorId(CURRENT_TERM, '광주', 1))!
    const someone = fieldOf(f).residents[5]
    expect(locateUser(someone.user.id)).toEqual({ floor: f, seat: someone.seat })
    expect(fieldUserOf(someone.user.id)?.id).toBe(someone.user.id)
  })
  it('없는 사람 → null', () => {
    expect(locateUser('no-such-user')).toBeNull()
  })
})

describe('소속 표기 (00 공통 4: 캠퍼스 · 기수 · 층, 반 없음)', () => {
  it('들판 사람과 실명 목 사용자 모두 "SSAFY N기 · 캠퍼스 · N층"', () => {
    expect(affOf(USERS.yerin)).toBe('SSAFY 16기 · 서울 · 2층')
    expect(shortAffOf(USERS.yerin)).toBe('서울 · 16기 · 2층')
    const u = fieldOf(MY_FLOOR).residents.find((r) => !r.mine && !USERS[r.user.id]?.affiliation)!.user
    expect(affOf(u)).toMatch(/^SSAFY \d+기 · 서울 · 2층$/)
    expect(affOf(u)).not.toContain('반')
  })
})

describe('오늘의 추천 친구 (02 F5 5 · 추천 친구 설정 2 · 4, 2026-11-21 명세: 캠퍼스-층 + 기수만)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0))
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })
  const SEL = { campus: '서울', floor: 2, gen: 16 }

  it('설정을 저장하는 곳이 없음 (관심사 · 질문 설정 API 는 없어짐, 고른 값은 저장하지 않음)', async () => {
    const f = await import('../data/field') as Record<string, unknown>
    expect(f.getRecommendSettings).toBeUndefined()
    expect(f.setRecommendSettings).toBeUndefined()
    expect(f.MAX_REC_QUESTIONS).toBeUndefined()
    f.drawRecommendations && (f.drawRecommendations as (s: typeof SEL) => string[])(SEL)
    expect(JSON.parse(localStorage.getItem('digul.recommend')!)).not.toHaveProperty('settings')
  })
  it('예전에 저장된 설정(관심사 · 질문 · 같은 캠퍼스…)은 읽지 않고, 오늘 받은 추천은 그대로', async () => {
    localStorage.setItem('digul.recommend', JSON.stringify({ settings: { interests: ['소설'], questions: ['tmi-1'], sameCampus: true }, date: '2026-11-16', picks: ['x1', 'x2'] }))
    const f = await import('../data/field')
    expect(f.todaysPicks()).toEqual(['x1', 'x2'])
  })
  it('후보: 고른 캠퍼스 · 층의 이번 학기 들판 사람 중 기수가 같고, 나와 단골은 뺌', async () => {
    const f = await import('../data/field')
    const pool = f.recommendPool(SEL)
    const regular = new Set(f.getRegulars())
    expect(pool.length).toBeGreaterThan(3)
    for (const u of pool) {
      expect(u.campus).toBe('서울'); expect(u.floor).toBe(2); expect(u.gen).toBe(16)
      expect(u.id).not.toBe(ME_ID); expect(regular.has(u.id), u.id).toBe(false)
    }
    // 서울-2층 16기 단골(예린 · 서벅이)은 들판에 있어도 후보가 아님
    expect(f.fieldOf(f.MY_FLOOR).residents.some((r) => r.user.id === 'yerin')).toBe(true)
    expect(pool.some((u) => u.id === 'yerin')).toBe(false)
  })
  it('단골을 해제하면 다시 후보', async () => {
    const f = await import('../data/field')
    f.setRegular('yerin', false)
    expect(f.recommendPool(SEL).some((u) => u.id === 'yerin')).toBe(true)
  })
  it('기수가 다르면 안 나옴 · 없는 캠퍼스 · 층이면 빈 목록 · 사람 없는 들판도 빈 목록', async () => {
    const f = await import('../data/field')
    for (const u of f.recommendPool({ ...SEL, gen: 12 })) expect(u.gen).toBe(12)
    expect(f.recommendPool({ campus: '서울', floor: 99, gen: 16 })).toEqual([])
    expect(f.recommendPool({ campus: '서울', floor: 99, gen: 12 })).toEqual([])
  })
  it('어느 캠퍼스 · 층 · 기수를 골라도 후보가 3명 이상이라 추천이 "0명"으로 나오지 않음 (단골을 뺀 뒤에도)', async () => {
    const f = await import('../data/field')
    const { GENERATIONS } = await import('../data/auth')
    for (const fl of f.allCurrentFloors()) {
      for (const g of GENERATIONS) {
        const sel = { campus: fl.campus, floor: fl.floor, gen: parseInt(g, 10) }
        expect(f.recommendPool(sel).length, `${fl.campus}-${fl.floor}층 ${g}`).toBeGreaterThanOrEqual(3)
      }
    }
    expect(f.drawRecommendations({ campus: '부울경', floor: 1, gen: 16 })).toHaveLength(3)
  })
  it('3명, 지금 보는 들판과 관계없이 고른 캠퍼스 · 층에서, 서로 다른 사람', async () => {
    const f = await import('../data/field')
    const picks = f.drawRecommendations({ campus: '대전', floor: 2, gen: 16 })
    expect(picks.length).toBeLessThanOrEqual(3)
    expect(picks.length).toBeGreaterThan(0)
    expect(new Set(picks).size).toBe(picks.length)
    for (const id of picks) { const loc = f.locateUser(id)!; expect(loc.floor.campus).toBe('대전'); expect(loc.floor.floor).toBe(2) }
  })
  it('나에게 추천된 횟수가 적은 사람 먼저: 이미 추천된 사람은 아직 안 된 사람 뒤', async () => {
    const f = await import('../data/field')
    const pool = f.recommendPool(SEL)
    const first = f.drawRecommendations(SEL)
    expect(first).toHaveLength(3)
    f.resetToday() // 다음 날처럼 다시 받을 수 있게 (횟수는 남음)
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    const second = f.drawRecommendations(SEL)
    // 추천된 적 없는 사람이 3명 이상 남아 있으면 둘째 날은 전부 새 사람
    if (pool.length - first.length >= 3) for (const id of second) expect(first.includes(id), id).toBe(false)
  })
  it('모두 한 번씩 추천된 뒤에는 다시 모두 같은 순위 (따로 초기화하지 않아도 다시 나옴)', async () => {
    const f = await import('../data/field')
    const pool = f.recommendPool(SEL)
    const seen = new Set<string>()
    let day = 16
    while (seen.size < pool.length && day < 16 + 40) {
      vi.setSystemTime(new Date(2026, 10, day++, 10, 0)); f.resetToday()
      for (const id of f.drawRecommendations(SEL)) seen.add(id)
    }
    expect(seen.size).toBe(pool.length)
    vi.setSystemTime(new Date(2026, 10, day, 10, 0)); f.resetToday()
    expect(f.drawRecommendations(SEL).length).toBe(3)
  })
  it('받고 나면 오늘은 그 결과 그대로 (하루 한 번, 조건을 바꿔 다시 보내도 처음 결과), 다음 날이 되면 다시 받을 수 있음', async () => {
    const f = await import('../data/field')
    const picks = f.drawRecommendations(SEL)
    expect(f.todaysPicks()).toEqual(picks)
    expect(f.drawRecommendations({ campus: '대전', floor: 1, gen: 15 })).toEqual(picks)
    vi.setSystemTime(new Date(2026, 10, 17, 9, 0))
    expect(f.todaysPicks()).toBeNull()
  })
  it('같은 날 같은 조건이면 같은 결과 (날짜 시드)', async () => {
    const f = await import('../data/field')
    const a = f.drawRecommendations(SEL)
    f.resetToday()
    localStorage.clear()
    vi.resetModules()
    const g = await import('../data/field')
    expect(g.drawRecommendations(SEL)).toEqual(a)
  })
})
