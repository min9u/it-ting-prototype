/**
 * 관심사 이펙트 데이터 (data/interestFx.ts) · 켜고 끄기 (lib/fxLab.ts). docs/interest-effects.md
 * 2026-11-18 관심사 확정본(대분류 12 · 소분류 90)으로 예시를 옮김 (docs/interest-tags-2026-11-18.md):
 * 가장 드문 것 = 기타언어 70명(목, 예전 운석수집 30명), 예린의 드문 관심사 = 차/다도 190명(예전 다도)
 */
import { describe, expect, it } from 'vitest'
import { holeFxOf, leadOf, peopleCount, rarestOf, rarityOf, rarityRank, sharedSubs, subsOfCat, SUB_TOTAL } from '../data/interestFx'
import { FX_DEFS, applyPreset, getFx, presetOf, setFx } from '../lib/fxLab'
import { USERS } from '../data/mock'
import { allCurrentFloors, fieldOf } from '../data/field'

describe('인원수 · 드문 정도', () => {
  it('목 인원수를 이름·id 로 찾음', () => {
    expect(peopleCount('기타언어')).toBe(70)
    expect(peopleCount('other_language')).toBe(70)
    expect(peopleCount('없는 관심사')).toBeNull()
  })
  it('드문 순서: 기타언어가 90개 중 가장 드묾', () => {
    expect(SUB_TOTAL).toBe(90)
    expect(rarityRank('기타언어')).toBe(1)
    expect(rarityRank('영화')).toBe(SUB_TOTAL) // 3,400명으로 가장 흔함
  })
  it('100명 미만 아주 드묾 · 250명 미만 드묾 · 700명 미만 흔치 않음', () => {
    expect(rarityOf(30)).toBe('legend')
    expect(rarityOf(190)).toBe('rare')
    expect(rarityOf(690)).toBe('uncommon')
    expect(rarityOf(700)).toBeNull()
    expect(rarityOf(null)).toBeNull()
  })
  it('방에서 가장 드문 관심사: 예린은 차/다도(190명)', () => {
    expect(rarestOf(USERS.yerin.interests)).toEqual({ id: 'tea', count: 190, rarity: 'rare' })
    expect(rarestOf(['고양이', '강아지'])).toBeNull()
  })
})

describe('겹치는 관심사 · 대표 관심사', () => {
  it('예린과 나: 캠핑/글램핑 · 드로잉/회화 · 콘솔게임 (예린이 고른 순서)', () => {
    expect(sharedSubs(USERS.yerin.interests, USERS.me.interests)).toEqual(['camping', 'drawing_painting', 'console_game'])
  })
  it('대표 관심사 = 맨 앞', () => {
    expect(leadOf(['드로잉/회화', '캠핑/글램핑'])).toEqual({ sub: 'drawing_painting', cat: 'art_craft' })
    expect(leadOf([])).toBeNull()
  })
  it('대분류 안에서 고른 것', () => {
    expect(subsOfCat(USERS.me.interests, 'music_dance')).toEqual(['jpop_ost', 'piano_keys'])
  })
})

describe('탐색 들판 구멍 정보 (holeFxOf)', () => {
  it('아이콘은 겹치는 것 → 가장 드문 것 → 고른 순서, 최대 3개', () => {
    const h = holeFxOf(5, { nickname: '도토리', interests: ['고양이', '기타언어', '캠핑/글램핑', '보드게임', '헬스/필라테스/요가'], online: true }, false, ['캠핑/글램핑'])!
    expect(h.icons).toEqual(['camping', 'other_language', 'cat'])
    expect(h.more).toBe(2)
    expect(h.shared).toBe(1)
    expect(h.rarity).toBe('legend')
    expect(h.cat).toBe('pet_plant')
    expect(h.name).toBe('도토리')
  })
  it('내 땅굴은 겹침 0 · 흔치 않음(700명 미만)은 들판에서 반짝이지 않음', () => {
    const h = holeFxOf(13, { interests: ['캠핑/글램핑', '시/에세이'] }, true, ['캠핑/글램핑'])!
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
  it('처음엔 모두 꺼짐 (2026-11-18 main: 이펙트 버튼으로 켬)', () => {
    for (const d of FX_DEFS) expect(getFx()[d.id], d.id).toBe(false)
    expect(presetOf('room')).toBe('none')
    expect(presetOf('field')).toBe('none')
  })
  it('묶음은 그 영역만 바꿈', () => {
    applyPreset('room', 'rec')
    expect(presetOf('room')).toBe('rec')
    expect(presetOf('field')).toBe('none')
    applyPreset('room', 'all')
    expect(presetOf('room')).toBe('all')
    setFx({ r_card: false })
    expect(presetOf('room')).toBeNull()
    applyPreset('room', 'rec'); applyPreset('field', 'rec')
  })
})

/* ---------- 2차 (2026-11-17 저녁) ---------- */
import { RARITY, isRareCount, isOnboardingRare, rarityOf as rarityOf2 } from '../data/rarity'
import { RARE_MAX as MATCH_RARE_MAX, isRare as matchIsRare } from '../screens/burrow/explore-designs/match'
import {
  closeSeatsOf, greetLine, greetTopicsOf, lanternChoicesOf, rollcallOf, rollcallText, summaryOf, talkMoodOf, zoneNamesOf,
} from '../data/interestFx'
import { getLantern, mergeSaved, setLantern } from '../lib/fxLab'

describe('드문 기준 한 곳 (data/rarity.ts)', () => {
  it('이펙트 · 탐색 시안 B~D 가 같은 250명 기준', () => {
    expect(MATCH_RARE_MAX).toBe(RARITY.rare)
    expect(matchIsRare('차/다도')).toBe(true) // 190명
    expect(matchIsRare('물고기')).toBe(false) // 380명: 예전 400명 기준에선 드묾 → 이제 아님
    expect(isRareCount(249)).toBe(true); expect(isRareCount(250)).toBe(false); expect(isRareCount(null)).toBe(false)
    expect(rarityOf2(99)).toBe('legend'); expect(rarityOf2(699)).toBe('uncommon')
  })
  it('온보딩 "통하는 취향"은 명세대로 SSAFY 규모 5명 이하(전국 목 숫자 550명 미만)', () => {
    expect(isOnboardingRare(540)).toBe(true)
    expect(isOnboardingRare(560)).toBe(false)
  })
})

describe('저장값 합치기 (새 이펙트도 보이게)', () => {
  it('저장값에 없는 새 이펙트는 기본(꺼짐), 있는 것은 그대로, 모르는 키·잘못된 값은 버림', () => {
    const m = mergeSaved(JSON.stringify({ r_particles: false, f_bubble: true, old_fx: true, r_card: 'yes' }))
    expect(m.r_particles).toBe(false)
    expect(m.f_bubble).toBe(true) // 저장한 값 그대로
    expect(m.r_summary).toBe(false) // 저장값에 없음 → 기본(꺼짐)
    expect(m.r_card).toBe(false) // 잘못된 값 → 기본
    expect('old_fx' in m).toBe(false)
    expect(mergeSaved('{깨짐').r_summary).toBe(false)
    expect(mergeSaved(null).f_lantern).toBe(false)
  })
})

describe('땅굴: 한 줄 요약 · 입장 이름표 · 인사 · 대화 의향', () => {
  it('요약 줄 순서: 겹치는 것 → 가장 드문 것 → 고른 순서', () => {
    const s = summaryOf(USERS.yerin.interests, USERS.me.interests)
    expect(s.map((x) => x.sub)).toEqual(['camping', 'drawing_painting', 'console_game', 'tea', 'baking_dessert', 'cat'])
    expect(s.filter((x) => x.shared).length).toBe(3)
    expect(s[3].rarest).toBe(true)
    // 내 땅굴: 겹침 없이 가장 드문 것(콘솔게임 640명)이 맨 앞
    expect(summaryOf(USERS.me.interests)[0]).toMatchObject({ sub: 'console_game', rarest: true, shared: false })
  })
  it('입장 이름표: 대분류마다 하나, 겹치는 것이 있는 대분류 먼저', () => {
    const g = rollcallOf(USERS.yerin.interests, USERS.me.interests)
    expect(g.map((x) => x.cat).slice(0, 3).sort()).toEqual(['art_craft', 'game', 'outdoor'])
    expect(g.find((x) => x.cat === 'food')).toMatchObject({ subs: ['baking_dessert', 'tea'], shared: 0 })
    expect(rollcallText({ cat: 'music_dance', subs: ['jpop_ost', 'piano_keys', 'jazz_classical'], shared: 0 })).toBe('음악·댄스 · JPOP/OST, 피아노/건반 외 1')
  })
  it('인사: 겹치면 겹치는 것(최대 3), 없으면 집주인의 가장 드문 것', () => {
    const a = greetTopicsOf(USERS.yerin.interests, USERS.me.interests)
    expect(a).toEqual({ subs: ['camping', 'drawing_painting', 'console_game'], shared: true })
    expect(greetLine(a)).toBe('“캠핑/글램핑” 이야기 해 볼까요?')
    const b = greetTopicsOf(['고양이', '기타언어'], ['캠핑/글램핑'])
    expect(b).toEqual({ subs: ['other_language'], shared: false })
    expect(greetLine(b)).toContain('궁금하다고')
  })
  it('대화 의향 (목): 예린은 말 걸어도 돼요, 서벅이는 방명록부터, 나머지는 id 로 늘 같은 값', () => {
    expect(talkMoodOf('yerin')).toBe('open')
    expect(talkMoodOf('seobeok')).toBe('slow')
    expect(talkMoodOf('f1-3')).toBe(talkMoodOf('f1-3'))
    expect(talkMoodOf(undefined)).toBeNull()
  })
})

describe('들판: 동네 이름 · 등불 · 잘 맞는 이웃', () => {
  it('동네 이름은 "가장 많은" 이 아니라 "평균보다 유난히 많은" 카테고리 (고양이가 모든 동네 이름이 되지 않게)', () => {
    const u = (interests: string[]) => ({ interests })
    const res = [
      // 1구역: 다 고양이 + 4명이 음악·댄스
      ...[1, 2, 3, 4].map((s) => ({ seat: s, user: u(['고양이', '피아노/건반']) })), { seat: 5, user: u(['고양이']) }, { seat: 6, user: u(['고양이']) },
      // 2구역: 다 고양이 + 4명이 캠핑
      ...[26, 27, 28, 29].map((s) => ({ seat: s, user: u(['고양이', '캠핑/글램핑']) })), { seat: 30, user: u(['고양이']) }, { seat: 31, user: u(['고양이']) },
    ]
    const z = zoneNamesOf(res)
    expect(z.map((x) => [x.zone, x.cat])).toEqual([[1, 'music_dance'], [2, 'outdoor']])
    expect(z[0]).toMatchObject({ n: 4, total: 6 })
  })
  it('목 들판에서도 구역마다 이름이 있고 반려동물만 나오지 않음', () => {
    const names = allCurrentFloors().flatMap((f) => zoneNamesOf(fieldOf(f).residents))
    expect(names.length).toBeGreaterThan(5)
    expect(new Set(names.map((x) => x.cat)).size).toBeGreaterThan(2)
  })
  it('등불 고르기: 내 관심사(이웃 수) + 이 들판의 드문 관심사(250명 미만, 내 것 빼고, 최대 4개)', () => {
    const res = [
      { seat: 1, user: { interests: ['캠핑/글램핑', '차/다도'] } }, { seat: 2, user: { interests: ['캠핑/글램핑', '기타언어'] } },
      { seat: 3, user: { interests: ['피아노/건반'] }, mine: true },
    ]
    const c = lanternChoicesOf(res, ['캠핑/글램핑', '피아노/건반'])
    expect(c.mine).toEqual([{ sub: 'camping', n: 2 }, { sub: 'piano_keys', n: 0 }])
    expect(c.rare.map((x) => x.sub)).toEqual(['other_language', 'tea'])
  })
  it('등불은 이펙트를 끄면 null', () => {
    setLantern('camping')
    expect(getLantern()).toBe('camping')
    setFx({ f_lantern: false })
    expect(getLantern()).toBeNull()
    setFx({ f_lantern: true }); setLantern(null)
  })
  it('잘 맞는 이웃: 이 들판 위쪽 1/4 (최소 3곳)만 → 인기 관심사 하나 겹친 것으로 모든 구멍에 고리가 뜨지 않음', () => {
    const f = fieldOf(allCurrentFloors()[0])
    const close = closeSeatsOf(f.residents, USERS.me.interests)
    const anyShared = f.residents.filter((r) => !r.mine && sharedSubs(r.user.interests, USERS.me.interests).length > 0).length
    expect(close.size).toBeGreaterThanOrEqual(Math.min(3, anyShared))
    expect(close.size).toBeLessThan(Math.max(4, anyShared))
    const r = closeSeatsOf([{ seat: 1, user: { interests: ['캠핑/글램핑'] } }, { seat: 2, user: { interests: ['차/다도'] } }, { seat: 3, user: { interests: [] } }], ['캠핑/글램핑'])
    expect([...r]).toEqual([1])
  })
})
