/**
 * 관심사 이펙트 데이터 (data/interestFx.ts) · 켜고 끄기 (lib/fxLab.ts). docs/interest-effects.md
 */
import { describe, expect, it } from 'vitest'
import { holeFxOf, leadOf, peopleCount, rarestOf, rarityOf, rarityRank, sharedSubs, subsOfCat, SUB_TOTAL } from '../data/interestFx'
import { FX_DEFS, applyPreset, getFx, presetOf, setFx } from '../lib/fxLab'
import { USERS } from '../data/mock'
import { allCurrentFloors, fieldOf } from '../data/field'

describe('인원수 · 드문 정도', () => {
  it('목 인원수를 이름·id 로 찾음', () => {
    expect(peopleCount('운석수집')).toBe(30)
    expect(peopleCount('meteorites')).toBe(30)
    expect(peopleCount('없는 관심사')).toBeNull()
  })
  it('드문 순서: 운석수집이 65개 중 가장 드묾', () => {
    expect(rarityRank('운석수집')).toBe(1)
    expect(rarityRank('인디밴드')).toBe(SUB_TOTAL) // 3,400명으로 가장 흔함
  })
  it('100명 미만 아주 드묾 · 250명 미만 드묾 · 700명 미만 흔치 않음', () => {
    expect(rarityOf(30)).toBe('legend')
    expect(rarityOf(190)).toBe('rare')
    expect(rarityOf(690)).toBe('uncommon')
    expect(rarityOf(700)).toBeNull()
    expect(rarityOf(null)).toBeNull()
  })
  it('방에서 가장 드문 관심사: 예린은 다도(190명)', () => {
    expect(rarestOf(USERS.yerin.interests)).toEqual({ id: 'tea_ceremony', count: 190, rarity: 'rare' })
    expect(rarestOf(['고양이', '강아지'])).toBeNull()
  })
})

describe('겹치는 관심사 · 대표 관심사', () => {
  it('예린과 나: 캠핑 · 수채화 · 레트로게임 (예린이 고른 순서)', () => {
    expect(sharedSubs(USERS.yerin.interests, USERS.me.interests)).toEqual(['camping', 'watercolor', 'retro_game'])
  })
  it('대표 관심사 = 맨 앞', () => {
    expect(leadOf(['수채화', '캠핑'])).toEqual({ sub: 'watercolor', cat: 'craft' })
    expect(leadOf([])).toBeNull()
  })
  it('카테고리 안에서 고른 것', () => {
    expect(subsOfCat(USERS.me.interests, 'music')).toEqual(['city_pop', 'piano'])
  })
})

describe('탐색 들판 구멍 정보 (holeFxOf)', () => {
  it('아이콘은 겹치는 것 → 가장 드문 것 → 고른 순서, 최대 3개', () => {
    const h = holeFxOf(5, { nickname: '도토리', interests: ['고양이', '운석수집', '캠핑', '보드게임', '요가'], online: true }, false, ['캠핑'])!
    expect(h.icons).toEqual(['camping', 'meteorites', 'cat'])
    expect(h.more).toBe(2)
    expect(h.shared).toBe(1)
    expect(h.rarity).toBe('legend')
    expect(h.cat).toBe('pet')
    expect(h.name).toBe('도토리')
  })
  it('내 땅굴은 겹침 0 · 흔치 않음(700명 미만)은 들판에서 반짝이지 않음', () => {
    const h = holeFxOf(13, { interests: ['캠핑', 'SF소설'] }, true, ['캠핑'])!
    expect(h.shared).toBe(0)
    expect(h.rarity).toBeNull()
    expect(h.name).toBe('내 땅굴')
  })
  it('관심사가 없으면 null', () => {
    expect(holeFxOf(1, { interests: [] }, false, [])).toBeNull()
  })
  it('목 데이터: 들판 사람 관심사는 인원수 비례 → 아주 드문 관심사(100명 미만)를 가진 사람은 소수', () => {
    const users = allCurrentFloors().flatMap((f) => fieldOf(f).residents).filter((r) => !r.mine).map((r) => r.user)
    const legend = users.filter((u) => holeFxOf(0, u, false, [])?.rarity === 'legend').length
    expect(users.length).toBeGreaterThan(100)
    expect(legend / users.length).toBeLessThan(0.15)
  })
})

describe('이펙트 켜고 끄기 (lib/fxLab)', () => {
  it('처음엔 추천 묶음', () => {
    for (const d of FX_DEFS) expect(getFx()[d.id], d.id).toBe(d.rec)
    expect(presetOf('room')).toBe('rec')
  })
  it('묶음은 그 영역만 바꿈', () => {
    applyPreset('field', 'none')
    expect(presetOf('field')).toBe('none')
    expect(presetOf('room')).toBe('rec')
    applyPreset('room', 'all')
    expect(presetOf('room')).toBe('all')
    setFx({ r_card: false })
    expect(presetOf('room')).toBeNull()
    applyPreset('room', 'rec'); applyPreset('field', 'rec')
  })
})
