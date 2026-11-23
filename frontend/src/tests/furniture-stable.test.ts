/**
 * 가구 단어 선택(placeWords 의 choice): 한 관심사의 가구를 바꿔도 다른 관심사의 단어 · 자리는 그대로 (사용자 제보 2026-11-22, KAN-40)
 * 꾸미기 가구 탭은 2026-11-23 다시 뺐다(명세 dev 9ea6698: 가구는 세부 관심사마다 하나, 고르지 않음). 앱 화면은 늘 맨 앞 단어이고,
 * 선택 인자는 실험실(/lab/rooms)이 쓰므로 배치 규칙 시험은 남긴다. 아래 "앱 화면" 시험은 가구 탭이 없고 고른 값이 방에 가지 않는지 본다
 * 관심사 8개: 맛집탐방, 힙합/락, 웹툰/만화, 사주/타로, 애니메이션, 자전거/바이크/드라이브, 캠핑/글램핑, 자수/뜨개/패브릭
 *
 * 원인(수정 전): placeWords 가 고른 단어까지 넣고 관심사를 앞에서부터 차례로 자리에 넣었다. 작은 가구는 "몇 번째 작은 가구인가"로
 * 선반 · 바닥이 정해지고 큰 가구는 "남은 칸 중 가장 작은 칸"을 가져가서, 한 관심사의 단어 크기가 바뀌면(벽 → 작은) 뒤의 관심사가 다른 칸으로 밀렸다.
 * (vitest 설정이 *.test.ts 만 읽어서 JSX 대신 createElement)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from './memoryRouter'
import { createElement as h } from 'react'
import { toSubIds } from '../data/interests'
import { SUB_WORDS, wordsOfSub } from '../data/interestWords'
import { placeWords } from '../data/roomPlanV38'
import { planRoom } from '../data/roomPlan'
import { validFurniture } from '../data/roomLook'

const NAMES = ['맛집탐방', '힙합/락', '웹툰/만화', '사주/타로', '애니메이션', '자전거/바이크/드라이브', '캠핑/글램핑', '자수/뜨개/패브릭']
const SUBS = toSubIds(NAMES)
const [, HIPHOP, , , , CYCLE, CAMP, NEEDLE] = SUBS
const wordByName = (sub: string, name: string) => wordsOfSub(sub)!.words.find((w) => w.name === name)!.word

/** 지금 방에 놓이는 것: 관심사 → "단어@자리" (방이 그리는 계획과 같은 함수) */
const placement = (picks: string[], choice: Record<string, string>) =>
  Object.fromEntries(placeWords(picks, choice).placed.map((p) => [p.sub, `${p.word.word}@${p.slot.name}`]))
/** 한 관심사를 뺀 나머지 */
const without = (o: Record<string, string>, sub: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== sub))

describe('제보 재현: 관심사 8개, 힙합 미니 앰프 → 자전거 헬멧 → 다시 벽걸이 자전거', () => {
  const base = placement(SUBS, {})
  const amp = { [HIPHOP]: wordByName(HIPHOP, '미니 앰프') }
  const helmet = { ...amp, [CYCLE]: wordByName(CYCLE, '헬멧') }

  it('기준 배치: 자전거는 벽, 캠핑은 큰 의자, 자수는 선반 04', () => {
    expect(base[CYCLE]).toMatch(/^자전거@furniture_slot_/)
    expect(base[CAMP]).toMatch(/^캠핑@furniture_slot_/)
    expect(base[NEEDLE]).toBe('자수@prop_slot_04')
  })

  it('① 힙합 미니 앰프: 그 가구만 바뀜 (자리는 그대로)', () => {
    const now = placement(SUBS, amp)
    expect(now[HIPHOP]).toBe(`락@${base[HIPHOP].split('@')[1]}`)
    for (const s of SUBS.filter((x) => x !== HIPHOP)) expect(now[s], s).toBe(base[s])
  })

  it('② 자전거 헬멧: 자전거만 바뀌고, 캠핑 의자 · 자수 수틀을 포함한 나머지 관심사는 단어도 자리도 그대로', () => {
    const now = placement(SUBS, helmet)
    expect(now[CYCLE]).toMatch(/^바이크@/)
    expect(now[CYCLE]).not.toBe(base[CYCLE])
    for (const s of SUBS.filter((x) => x !== CYCLE)) expect(now[s], `${s}`).toBe(placement(SUBS, amp)[s])
    expect(now[CAMP]).toBe(base[CAMP])
    expect(now[NEEDLE]).toBe('자수@prop_slot_04')
  })

  it('③ 다시 벽걸이 자전거: 처음(미니 앰프만 고른 상태)과 똑같이 돌아옴', () => {
    expect(placement(SUBS, amp)).toEqual(placement(SUBS, { ...helmet, [CYCLE]: wordByName(CYCLE, '벽걸이 자전거') }))
  })

  it('헬멧은 다른 관심사가 쓰는 칸을 가져가지 않음 (모든 가구가 서로 다른 칸)', () => {
    const slots = Object.values(placement(SUBS, helmet)).map((v) => v.split('@')[1])
    expect(new Set(slots).size).toBe(slots.length)
  })
})

describe('성질: 어떤 관심사 조합 · 선택이라도 한 관심사를 바꾸면 그 관심사만 달라짐', () => {
  const lists = new Map(SUB_WORDS.map((s) => [s.subId, s.words.map((w) => w.word)]))
  const pickable = SUB_WORDS.filter((s) => s.pickable).map((s) => s.subId)
  let seed = 20261122
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

  it('무작위 관심사 3~10개 × 선택 × 한 관심사 바꾸기 3000번: 나머지는 단어 · 자리가 같고, 자리가 겹치지 않음', () => {
    let violations = 0, overlap = 0, checks = 0
    const bad: string[] = []
    for (let n = 0; n < 3000; n++) {
      const size = 3 + Math.floor(rnd() * 8)
      // 고를 수 있는 관심사를 넉넉히 섞어서 (섞인 종류 18개가 자주 들어가게)
      const picks = shuffle([...pickable, ...shuffle(SUB_WORDS.map((s) => s.subId)).slice(0, 10)]).filter((x, i, a) => a.indexOf(x) === i).slice(0, size)
      const choice: Record<string, string> = {}
      for (const s of picks) { const l = lists.get(s)!; if (l.length > 1 && rnd() < 0.6) choice[s] = l[Math.floor(rnd() * l.length)] }
      const target = picks[Math.floor(rnd() * picks.length)]
      const l = lists.get(target)!
      const other = { ...choice, [target]: l[Math.floor(rnd() * l.length)] }
      const a = placement(picks, choice), b = placement(picks, other)
      checks++
      if (JSON.stringify(without(a, target)) !== JSON.stringify(without(b, target))) { violations++; if (bad.length < 3) bad.push(`picks=${picks.join(',')} target=${target}`) }
      for (const p of [a, b]) { const sl = Object.values(p).map((v) => v.split('@')[1]); if (new Set(sl).size !== sl.length) overlap++ }
    }
    expect({ checks, violations, overlap, bad }).toEqual({ checks: 3000, violations: 0, overlap: 0, bad: [] })
  })

  it('고른 게 없으면 기본 단어(소분류마다 맨 앞)가 모두 놓임 (디자이너 규칙의 기준 배치)', () => {
    const r = placeWords(SUBS, {})
    expect(r.unplaced).toEqual([])
    expect(r.placed.map((p) => p.word.word)).toEqual(SUBS.map((s) => wordsOfSub(s)!.words[0].word))
  })
})

describe('저장 · 일반 화면 · 방문자 뷰가 같은 결과', () => {
  /** 방이 실제로 그리는 계획 (3D 장면이 부르는 planRoom 의 칸|모델) */
  const drawn = (picks: string[], furniture: Record<string, string>) => planRoom(picks, furniture).items.map((i) => `${i.slot.name}|${i.row.id}`).sort()
  const choice = { [HIPHOP]: wordByName(HIPHOP, '미니 앰프'), [CYCLE]: wordByName(CYCLE, '헬멧') }

  it('꾸미는 중(고르는 값) = 저장한 뒤 내 땅굴(roomLookOf) = 방문자 뷰(주인이 준 furniture, roomLookOf)', () => {
    const editing = drawn(NAMES, choice)
    expect(drawn(NAMES, validFurniture(choice, NAMES))).toEqual(editing)
    // 저장 값은 맨 앞 단어를 빼고 저장(기본 = 키 없음): 같은 결과
    const stored = { [HIPHOP]: choice[HIPHOP], [CYCLE]: choice[CYCLE] }
    expect(drawn(NAMES, validFurniture(stored, NAMES))).toEqual(editing)
  })

  it('목 서버 응답에는 가구 값이 없음 (내 땅굴 · 남의 땅굴): 방은 관심사만으로 = 맨 앞 단어', async () => {
    sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('digul.api.knobs', 'fast')
    vi.resetModules()
    const I = await import('../data/interests')
    I.setMyInterests(NAMES)
    const burrow = (await import('../api/burrow/mock')).mock
    const { userBurrowDto } = await import('../api/explore/mock')
    expect('updateFurniture' in burrow).toBe(false)
    expect('furniture' in (await burrow.myBurrow())).toBe(false)
    expect('furniture' in userBurrowDto('me')).toBe(false)
    expect(drawn(NAMES, {})).toEqual(drawn(NAMES, validFurniture({}, NAMES)))
  })
})

// ───────────────────────── 화면(MyBurrow) 상태 ─────────────────────────
// 3D 방은 WebGL 이 없으니 가짜로 바꾸고, 화면이 방에 넘기는 값(관심사 · 고른 가구)만 기록
const shown: { interests: string[]; furniture: Record<string, string> }[] = []
vi.mock('../components/RoomView', () => ({
  default: (p: { interests: string[]; furniture?: Record<string, string> }) => {
    shown.push({ interests: p.interests, furniture: p.furniture ?? {} })
    return null
  },
}))
afterEach(cleanup)
beforeEach(() => { shown.length = 0 })

describe('꾸미기 화면: 두더지 탭만 (가구 탭 없음, 2026-11-23)', () => {
  it('꾸미기 모드에 "가구" 탭이 없고, 방에 넘어가는 가구 값은 늘 빈 값(= 맨 앞 단어)', async () => {
    sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('digul.api.knobs', 'fast')
    vi.resetModules()
    const I = await import('../data/interests')
    I.setMyInterests(NAMES)
    const MyBurrow = (await import('../screens/burrow/MyBurrow')).default
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(h(QueryClientProvider, { client: qc }, h(MemoryRouter, { initialEntries: ['/burrow?mode=decor'] }, h(MyBurrow))))
    await waitFor(() => expect(screen.getByRole('tab', { name: '두더지' })).toBeTruthy(), { timeout: 4000 })
    expect(screen.queryByRole('tab', { name: '가구' })).toBeNull()
    expect(screen.getAllByRole('tab').filter((t) => t.textContent === '두더지')).toHaveLength(1)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every((x) => Object.keys(x.furniture).length === 0)).toBe(true)
  })
})
