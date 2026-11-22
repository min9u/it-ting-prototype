/**
 * 꾸미기 모드 가구 탭 (명세 04 "땅굴 – 꾸미기 모드 · 가구 탭", KAN-40 2026-11-22)
 * - 목 서버: 고른 단어 저장(맨 앞 단어는 저장 안 함) · 규칙 위반은 400 · 관심사를 바꾸면 뺀 것만 지움 · 방 모습에 반영
 * - 실제 모드: 서버 명세에 저장 API 가 없어 실패로 알림 (거짓 성공 없음, api/burrow/PENDING)
 * - 화면(DecorPanel): 가구 탭 · 두더지 탭, 고를 수 있는 관심사 칩만, "○○ 가구 고르기 · n개 중 1개" 카드
 * (vitest 설정이 *.test.ts 만 읽어서 JSX 대신 createElement)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'
import { SUB_WORDS } from '../data/interestWords'
import { INTEREST_SUBS } from '../data/interests'
import DecorPanel from '../screens/burrow/DecorPanel'

const PICKABLE = SUB_WORDS.filter((s) => s.pickable)
const nameOf = (subId: string) => INTEREST_SUBS.find((s) => s.id === subId)!.name_ko
/** 고를 수 있는 관심사 2개 + 고정 관심사 1개 (예: 차/다도 말고도 "/"가 없는 것) */
const A = PICKABLE[0], B = PICKABLE[1]
const [FIXED, FIXED2] = SUB_WORDS.filter((s) => !s.pickable)

/** 실패한 요청의 { status, code, fields } (vi.resetModules 뒤라 ApiError 클래스가 달라 instanceof 대신 이름으로 봄) */
async function failure(p: Promise<unknown>) {
  try { await p } catch (e) {
    const x = e as { name?: string; status: number; code: string; fields: { field: string }[] | null }
    if (x?.name === 'ApiError') return { status: x.status, code: x.code, fields: x.fields?.map((f) => f.field) ?? [] }
  }
  throw new Error('실패하지 않음')
}

afterEach(cleanup) // 설정에 globals 가 없어 직접 정리
beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('digul.api.knobs', 'fast') // 목 서버 지연 없이
  localStorage.clear()
  vi.resetModules()
})

/** 목 서버 + 내 관심사를 [A, B, 고정] 으로 맞춘 뒤의 모듈들 */
async function setup() {
  const I = await import('../data/interests')
  I.setMyInterests([nameOf(A.subId), nameOf(B.subId), nameOf(FIXED.subId)])
  const burrow = (await import('../api/burrow/mock')).mock
  const mappers = await import('../api/burrow/mappers')
  const M = await import('../data/myBurrow')
  return { burrow, mappers, M }
}

describe('목 서버: 고른 가구 단어 저장', () => {
  it('저장하면 GET /me/burrow 에 들어 있고, 맨 앞 단어는 저장하지 않음(= 기본값)', async () => {
    const { burrow, mappers } = await setup()
    expect((await burrow.myBurrow()).furniture).toEqual({})
    const saved = await burrow.updateFurniture({ furniture: { [A.subId]: A.words[1].word, [B.subId]: B.words[0].word } })
    expect(saved).toEqual({ [A.subId]: A.words[1].word })
    const vm = mappers.toMyBurrow(await burrow.myBurrow())
    expect(vm.furniture).toEqual({ [A.subId]: A.words[1].word })
  })

  it('고를 수 없는 단어 · 내 관심사가 아닌 것 · 한 단어짜리(고정) 관심사는 400 INVALID_INPUT 이고 아무것도 저장하지 않음', async () => {
    const { burrow } = await setup()
    expect(await failure(burrow.updateFurniture({ furniture: { [A.subId]: '없는단어' } }))).toMatchObject({ status: 400, code: 'INVALID_INPUT', fields: [`furniture.${A.subId}`] })
    expect(await failure(burrow.updateFurniture({ furniture: { [FIXED.subId]: FIXED.words[0].word } }))).toMatchObject({ status: 400, fields: [`furniture.${FIXED.subId}`] })
    const other = PICKABLE.find((s) => ![A.subId, B.subId].includes(s.subId))!
    expect(await failure(burrow.updateFurniture({ furniture: { [other.subId]: other.words[1].word } }))).toMatchObject({ status: 400, fields: [`furniture.${other.subId}`] })
    expect((await burrow.myBurrow()).furniture).toEqual({})
  })

  it('내 정보 수정에서 관심사를 바꾸면 뺀 관심사의 단어는 지우고 그대로 둔 것은 유지', async () => {
    const { burrow, mappers } = await setup()
    await burrow.updateFurniture({ furniture: { [A.subId]: A.words[1].word, [B.subId]: B.words[1].word } })
    const onboarding = (await import('../api/onboarding/mock')).mock
    const { toInterestCatalog } = await import('../api/onboarding/mappers')
    const now = mappers.toMyBurrow(await burrow.myBurrow())
    const catalog = toInterestCatalog(await onboarding.interestCategories())
    const draft = {
      nickname: now.nickname, intro: '', campus: now.campus, floor: now.floor,
      interests: [nameOf(A.subId), nameOf(FIXED.subId), nameOf(FIXED2.subId)], // B 를 뺌 (최소 3개)
      qna: now.answers.map((a) => ({ qid: a.questionId, a: a.answer })),
    }
    const next = await burrow.updateProfile(mappers.toProfileUpdate(draft, catalog, now.campusFloorId))
    expect(mappers.toMyBurrow(next).furniture).toEqual({ [A.subId]: A.words[1].word })
    expect(mappers.toMyBurrow(await burrow.myBurrow()).furniture).toEqual({ [A.subId]: A.words[1].word })
  })

  it('서버가 furniture 를 안 주면(실제 모드) 빈 값 = 모두 맨 앞 단어', async () => {
    const { burrow, mappers } = await setup()
    const dto = await burrow.myBurrow()
    delete dto.furniture
    expect(mappers.toMyBurrow(dto).furniture).toEqual({})
  })
})

describe('방문자: 주인이 고른 가구가 남의 땅굴 조회에 실림', () => {
  it('GET /users/{userId}/burrow 목: 내가 저장한 단어는 furniture 로 오고, 매퍼는 없으면 빈 값', async () => {
    const { burrow } = await setup()
    await burrow.updateFurniture({ furniture: { [A.subId]: A.words[1].word } })
    const { userBurrowDto } = await import('../api/explore/mock')
    const { toBurrow } = await import('../api/explore/mappers')
    const mine = userBurrowDto('me')
    expect(mine.furniture).toEqual({ [A.subId]: A.words[1].word })
    expect(toBurrow(mine).furniture).toEqual({ [A.subId]: A.words[1].word })
    const other = userBurrowDto('yerin') // 다른 사람은 저장한 값이 없음 (맨 앞 단어)
    expect(other.furniture).toBeUndefined()
    expect(toBurrow(other).furniture).toEqual({})
  })
})

describe('방 모습에 반영', () => {
  it('고른 단어가 땅굴의 가구 선택으로 들어가고, 내 관심사에 없는 것은 버림', async () => {
    const { roomLookOf } = await import('../data/roomLook')
    const mine = [nameOf(A.subId), nameOf(B.subId)]
    const look = roomLookOf('me', mine, { wallpaperId: null, themeId: null, furniture: { [A.subId]: A.words[1].word, [FIXED.subId]: 'x' } })
    expect(look.furniture).toEqual({ [A.subId]: A.words[1].word })
  })
})

describe('실제 모드', () => {
  it('서버 명세에 가구 저장 API 가 없어 실패(501)로 알림 — 성공한 척하지 않음', async () => {
    const { real, ENDPOINTS } = await import('../api/burrow/real')
    expect(await failure(real.updateFurniture({ furniture: { [A.subId]: A.words[1].word } }))).toMatchObject({ status: 501, code: 'NOT_IMPLEMENTED' })
    expect(ENDPOINTS.some((e) => /furniture/i.test(e))).toBe(false) // 명세에 없는 주소를 ENDPOINTS 에 넣지 않음
  })
})

describe('DecorPanel (화면)', () => {
  const base = { worn: [] as string[], setWorn: () => {}, dirty: false, onCancel: () => {}, onSave: () => {}, focusSub: null as string | null, setFocusSub: () => {} }
  const picks = () => [nameOf(A.subId), nameOf(B.subId), nameOf(FIXED.subId)]

  it('탭은 "가구" "두더지" 둘뿐(색 탭 없음), 가구 탭이 열려 있음', () => {
    render(h(DecorPanel, { ...base, tab: 'furniture', setTab: () => {}, picks: picks(), furn: {}, setFurn: () => {} }))
    const tabs = screen.getAllByRole('tab').filter((t) => ['가구', '두더지', '색', '소품'].includes(t.textContent ?? ''))
    expect(tabs.map((t) => t.textContent)).toEqual(['가구', '두더지'])
    expect(screen.getByRole('tab', { name: '가구' }).getAttribute('aria-selected')).toBe('true')
  })

  it('칩은 고를 수 있는 내 관심사만(고정 관심사는 없음), 제목 "○○ 가구 고르기" + "n개 중 1개"', () => {
    render(h(DecorPanel, { ...base, tab: 'furniture', setTab: () => {}, picks: picks(), furn: {}, setFurn: () => {} }))
    const chips = screen.getByRole('tablist', { name: '가구를 고를 수 있는 내 관심사' })
    expect(Array.from(chips.querySelectorAll('[role=tab]')).map((c) => c.textContent)).toEqual([nameOf(A.subId), nameOf(B.subId)])
    expect(screen.getByText(`${nameOf(A.subId)} 가구 고르기`)).toBeTruthy()
    expect(screen.getByText(`${A.words.length}개 중 1개`)).toBeTruthy()
    expect(document.body.textContent).not.toContain('소품')
  })

  it('처음엔 맨 앞 단어가 골라져 있고, 다른 카드를 누르면 그 단어로, 맨 앞 단어를 다시 누르면 선택 기록이 지워짐', () => {
    const setFurn = vi.fn()
    const { rerender } = render(h(DecorPanel, { ...base, tab: 'furniture', setTab: () => {}, picks: picks(), furn: {}, setFurn }))
    const cards = () => Array.from(document.querySelectorAll('button[aria-pressed]'))
    expect(cards().map((c) => c.getAttribute('aria-pressed'))).toEqual(A.words.map((_, i) => String(i === 0)))
    fireEvent.click(cards()[1])
    expect(setFurn).toHaveBeenLastCalledWith({ [A.subId]: A.words[1].word })
    rerender(h(DecorPanel, { ...base, tab: 'furniture', setTab: () => {}, picks: picks(), furn: { [A.subId]: A.words[1].word }, setFurn }))
    expect(cards().map((c) => c.getAttribute('aria-pressed'))).toEqual(A.words.map((_, i) => String(i === 1)))
    fireEvent.click(cards()[0])
    expect(setFurn).toHaveBeenLastCalledWith({})
  })

  it('칩을 누르면 그 관심사로 바뀌고(focusSub), 두더지 탭을 누르면 setTab("mole")', () => {
    const setFocusSub = vi.fn(), setTab = vi.fn()
    render(h(DecorPanel, { ...base, tab: 'furniture', setTab, picks: picks(), furn: {}, setFurn: () => {}, setFocusSub }))
    fireEvent.click(screen.getByRole('tab', { name: nameOf(B.subId) }))
    expect(setFocusSub).toHaveBeenCalledWith(B.subId)
    fireEvent.click(screen.getByRole('tab', { name: '두더지' }))
    expect(setTab).toHaveBeenCalledWith('mole')
  })

  it('고를 수 있는 관심사가 없으면 안내만 (칩 · 카드 없음)', () => {
    render(h(DecorPanel, { ...base, tab: 'furniture', setTab: () => {}, picks: [nameOf(FIXED.subId)], furn: {}, setFurn: () => {} }))
    expect(screen.getByText(/고를 수 있는 가구가 없어요/)).toBeTruthy()
    expect(document.querySelectorAll('button[aria-pressed]').length).toBe(0)
  })
})
