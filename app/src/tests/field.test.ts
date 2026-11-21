/**
 * 탐색 들판 · 추천 (data/field.ts)
 * 근거: 02 F5 탐색 1 (들판 = 학기 하나의 캠퍼스-층, 자리 = 온보딩 완료 순서), 5 (오늘의 추천 친구: 하루 한 번, 걸러 내지 않고 우선순위),
 *      13 · 00 공통 13 ("탐색" = 그 땅굴이 놓인 들판으로), 3D 핸드오프 v3.9 (구역 25자리 × 6 = 150, 켜는 구역 = ceil(가장 큰 번호/25))
 *      00 공통 4 (반은 쓰지 않음), docs/explore-field-v3-9.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMPUS_FLOORS, CURRENT_TERM, MY_FLOOR, MY_SEAT, affOf, allCurrentFloors, drawRecommendations, exploreHref, fieldOf, fieldUserOf,
  floorId, floorLabel, getRecommendSettings, locateUser, me, parseFloor, setRecommendSettings, shortAffOf, todaysPicks,
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
  it('빈 들판(부울경-1층)은 주인 0명이어도 구역 1개 (빈 상태 화면)', () => {
    const d = fieldOf(parseFloor(floorId(CURRENT_TERM, '부울경', 1))!)
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

describe('추천 조건: 답이 궁금한 질문 여러 개 (Figma 863:133 설정 · 1265:35509 질문 고르기)', () => {
  const OLD = { interests: [], question: '하루 동안 투명 인간이 된다면 뭐 해볼래요?', sameQuestionFirst: true, sameCampus: true, sameGen: true, sameFloor: false }
  beforeEach(() => { vi.resetModules(); localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('처음엔 TMI "투명 인간" 질문 하나가 골라져 있음 (질문 목록 id)', async () => {
    const f = await import('../data/field')
    expect(f.getRecommendSettings().questions).toEqual(['tmi-1'])
    const { questionOf } = await import('../data/questions')
    expect(questionOf('tmi-1')?.text).toBe('하루 동안 투명 인간이 된다면 뭐 해볼래요?')
  })
  it('답이 궁금한 질문은 최대 3개: 3개보다 많이 저장돼 있으면 앞의 3개만 읽음', async () => {
    const f = await import('../data/field')
    expect(f.MAX_REC_QUESTIONS).toBe(3)
    const five = ['tmi-1', 'tmi-2', 'tmi-3', 'tmi-4', 'tmi-5']
    localStorage.setItem('digul.recommend', JSON.stringify({ settings: { ...OLD, question: undefined, questions: five }, date: null, picks: [] }))
    vi.resetModules()
    const g = await import('../data/field')
    expect(g.getRecommendSettings().questions).toEqual(five.slice(0, 3))
  })
  it('예전에 저장된 질문 하나(문장, 2026-11-21 전)는 질문 id 목록으로 옮겨 읽음', async () => {
    localStorage.setItem('digul.recommend', JSON.stringify({ settings: OLD, date: null, picks: [] }))
    const f = await import('../data/field')
    expect(f.getRecommendSettings().questions).toEqual(['tmi-1'])
    expect('question' in f.getRecommendSettings()).toBe(false)
  })
  it('질문 목록에 없는 예전 문장이거나 질문이 없었으면 빈 목록', async () => {
    localStorage.setItem('digul.recommend', JSON.stringify({ settings: { ...OLD, question: '없어진 질문?' }, date: null, picks: [] }))
    expect((await import('../data/field')).getRecommendSettings().questions).toEqual([])
    vi.resetModules()
    localStorage.setItem('digul.recommend', JSON.stringify({ settings: { ...OLD, question: null }, date: null, picks: [] }))
    expect((await import('../data/field')).getRecommendSettings().questions).toEqual([])
  })
  it('질문은 몇 개든 고르고 저장됨', async () => {
    const f = await import('../data/field')
    f.setRecommendSettings({ ...f.getRecommendSettings(), questions: ['tmi-1', 'tmi-2', 'music-1'] })
    expect(JSON.parse(localStorage.getItem('digul.recommend')!).settings.questions).toEqual(['tmi-1', 'tmi-2', 'music-1'])
  })
  it('만들어 낸 들판 이웃들이 답한 질문은 모두 질문 목록에 있음 (그래야 "같은 질문에 답한 사람"이 맞춰 봐짐. 이름 있는 목 사용자 USERS 는 자기 질문을 가짐)', async () => {
    const f = await import('../data/field')
    const { QUESTIONS } = await import('../data/questions')
    const named = new Set(Object.keys(USERS))
    const texts = new Set(QUESTIONS.map((q) => q.text))
    for (const fl of f.allCurrentFloors()) for (const r of f.fieldOf(fl).residents) for (const q of named.has(r.user.id) ? [] : r.user.qna ?? []) {
      expect(texts.has(q.q.replace(/^Q\d+\.\s*/, '')), q.q).toBe(true)
    }
  })
})

describe('오늘의 추천 친구 (F5 5 · 추천 친구 설정 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0))
  })
  afterEach(() => { vi.useRealTimers() })

  it('3명, 나는 빼고, 모두 이번 학기 들판 어딘가에 땅굴이 있음 (보는 들판과 관계없음)', () => {
    const picks = drawRecommendations()
    expect(picks).toHaveLength(3)
    expect(new Set(picks).size).toBe(3)
    expect(picks).not.toContain(ME_ID)
    for (const id of picks) expect(locateUser(id), id).not.toBeNull()
  })
  it('받고 나면 오늘은 그 3명 (하루 한 번), 다음 날이 되면 다시 받을 수 있음', () => {
    const picks = drawRecommendations()
    expect(todaysPicks()).toEqual(picks)
    vi.setSystemTime(new Date(2026, 10, 17, 9, 0))
    expect(todaysPicks()).toBeNull()
  })
  it('같은 날 같은 설정이면 같은 결과 (날짜 시드)', () => {
    expect(drawRecommendations()).toEqual(drawRecommendations())
  })
  it('걸러 내지 않고 우선순위: 고른 관심사를 가진 사람이 위로', () => {
    const s = getRecommendSettings()
    const target = me().interests[0]
    setRecommendSettings({ ...s, interests: [target], questions: [], sameCampus: false, sameGen: false, sameFloor: false })
    const pool = allCurrentFloors().flatMap((f) => fieldOf(f).residents).filter((r) => !r.mine).map((r) => r.user)
    const having = pool.filter((u) => u.interests.includes(target)).length
    const picks = drawRecommendations().map((id) => pool.find((u) => u.id === id)!)
    if (having >= 3) for (const u of picks) expect(u.interests, u.id).toContain(target)
  })
  it('설정은 저장돼 다음에도 그대로', () => {
    const s = { ...getRecommendSettings(), sameFloor: true }
    setRecommendSettings(s)
    expect(getRecommendSettings()).toEqual(s)
    expect(JSON.parse(localStorage.getItem('digul.recommend')!).settings.sameFloor).toBe(true)
  })
})
