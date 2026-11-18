/**
 * 관심사 → 땅굴 자동 생성 (data/interests.ts, data/roomPlan.ts, data/wallpapers.ts, data/myBurrow.ts)
 * 근거
 * - F3 2-4·2-5: 고른 순서, 맨 앞 = 대표 관심사, 3개 이상 · 최대 10개
 * - F3 3a-3 · 00 공통 5: 땅굴 무드 = 대표 관심사(맨 앞)의 대분류 (docs/spec-f3-f4.md, 2026-11-16 결정)
 * - F4 꾸미기 가구 탭 3: 세부 관심사마다 가구 하나, 관심사를 바꾸면 뺀 것은 사라지고 둔 것은 유지
 * - 3D 핸드오프 v3 (HANDOFF_v3 2·3번, furniture_drop_spec 3·4번, v3.4 반려동물 짝), 낙하는 "2초 안에" (2026-11-12 사용자 요청)
 * - 예전 가중치 규칙 Σ(1 + 1000/인원) — 지금은 벽지 기본값(wallpaperForPicks)에만 남음
 */
import { describe, expect, it } from 'vitest'
import { ACCESSORY_CATEGORY, INTEREST_CATS, INTEREST_SUBS, MAX_PICK, categoriesOf, subOf, toSubIds } from '../data/interests'
import { DROP_LEN, DROP_SPAN, FURNITURE_CATALOG, SLOTS, planRoom } from '../data/roomPlan'
import { CATEGORIES } from '../data/mock'
import { DEFAULT_WALLPAPER, topCategoryOf, wallpaperForCategory, wallpaperForPicks } from '../data/wallpapers'
import { MIN_PICK, applyChoice, furnitureCandidates, isRare, leadCategory, moodWallpaper, pruneChoice, ssafyCount } from '../data/myBurrow'

const subsOfCat = (cat: string) => INTEREST_SUBS.filter((s) => s.category === cat)
const nameOf = (id: string) => subOf(id)!.name_ko

/** 같은 결과가 나오는 시드 난수 (조합 시험용) */
function rng(seed: number) {
  let a = seed || 1
  return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296 }
}
function randomPicks(r: () => number, n: number) {
  const pool = [...INTEREST_SUBS]
  const out: string[] = []
  while (out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id)
  return out
}

describe('관심사 목록 (2026-11-18 확정본, 자세한 것은 interest-tags.test.ts)', () => {
  it('대분류 12 · 소분류 90 · 최대 10개 (F3 2-5)', () => {
    expect(INTEREST_CATS).toHaveLength(12)
    expect(INTEREST_SUBS).toHaveLength(90)
    expect(MAX_PICK).toBe(10)
    expect(MIN_PICK).toBe(3)
  })
  it('소분류 id 와 화면 이름이 겹치지 않음 (subOf 가 이름으로도 찾음)', () => {
    expect(new Set(INTEREST_SUBS.map((s) => s.id)).size).toBe(90)
    expect(new Set(INTEREST_SUBS.map((s) => s.name_ko)).size).toBe(90)
  })
  it('모든 세부 관심사의 카테고리가 있음 · 카테고리마다 세부 관심사가 하나 이상', () => {
    for (const s of INTEREST_SUBS) expect(INTEREST_CATS.some((c) => c.id === s.category), s.id).toBe(true)
    for (const c of INTEREST_CATS) expect(subsOfCat(c.id).length, c.id).toBeGreaterThan(0)
  })
  it('카테고리 순서(order)는 1부터 빈틈없이', () => {
    expect(INTEREST_CATS.map((c) => c.order)).toEqual(INTEREST_CATS.map((_, i) => i + 1))
  })
  it('전용 액세서리는 카테고리 하나에만 묶임', () => {
    const all = INTEREST_CATS.flatMap((c) => c.accessories)
    expect(new Set(all).size).toBe(all.length)
    for (const a of all) expect(ACCESSORY_CATEGORY[a]).toBeDefined()
  })
})

describe('toSubIds · categoriesOf (F3 2-4 고른 순서)', () => {
  it('이름·id 를 섞어 받아 고른 순서대로 id 로, 중복·모르는 것은 뺌', () => {
    const [a, b, c] = INTEREST_SUBS
    expect(toSubIds([a.name_ko, 'no-such', b.id, a.id, c.name_ko])).toEqual([a.id, b.id, c.id])
  })
  it('최대 10개에서 자름 (F3 10개 초과)', () => {
    expect(toSubIds(INTEREST_SUBS.slice(0, 15).map((s) => s.id))).toHaveLength(10)
  })
  it('대분류는 처음 나온 순서', () => {
    const music = subsOfCat('music_dance'), pet = subsOfCat('pet_plant')
    expect(categoriesOf([pet[0].id, music[0].id, pet[1].id])).toEqual(['pet_plant', 'music_dance'])
  })
})

describe('땅굴 무드 (F3 3a-3 · 00 공통 5: 대표 관심사 = 맨 앞)', () => {
  it('맨 앞 관심사의 대분류 → 벽지', () => {
    const picks = [subsOfCat('music_dance')[0].id, ...subsOfCat('book').slice(0, 3).map((s) => s.id)]
    expect(leadCategory(picks)).toBe('music_dance')
    expect(moodWallpaper(picks)).toBe(wallpaperForCategory('music_dance'))
  })
  it('음식·음료(차·커피 세트)는 벽지 표의 "tea" 로 찾음, 표에 없는 세트는 기본 벽지', () => {
    expect(wallpaperForCategory('food')).not.toBe(DEFAULT_WALLPAPER)
    expect(wallpaperForCategory('tea_coffee')).not.toBe(DEFAULT_WALLPAPER)
    expect(wallpaperForCategory('culture')).toBe(DEFAULT_WALLPAPER)
    expect(wallpaperForCategory(undefined)).toBe(DEFAULT_WALLPAPER)
  })
  it('예전 가중치 규칙: 드문 관심사 하나가 흔한 관심사 둘보다 무거움 (Σ 1 + 1000/인원)', () => {
    const tags = CATEGORIES.flatMap((c) => c.tags.map((t) => ({ ...t, cat: c.id })))
    const rare = [...tags].sort((a, b) => a.count - b.count)[0]
    const common = tags.filter((t) => t.cat !== rare.cat).sort((a, b) => b.count - a.count)
    const sameCat = common.filter((t) => t.cat === common[0].cat).slice(0, 2)
    expect(sameCat).toHaveLength(2)
    expect(topCategoryOf([sameCat[0].name, rare.name, sameCat[1].name])).toBe(rare.cat)
  })
  it.todo('남의 땅굴 벽지도 대표 관심사 규칙으로 — 지금 VisitBurrow 는 wallpaper 를 안 넘겨 roomScene 이 가중치 규칙(wallpaperForPicks)을 씀')
  it('(현재 동작 기록) 대표 관심사 규칙과 가중치 규칙이 다른 경우가 있음', () => {
    // 흔한 음악·댄스 관심사를 맨 앞에, 아주 드문 미술·수공예 관심사를 뒤에
    const music = [...subsOfCat('music_dance')].sort((a, b) => count(b.id) - count(a.id))[0]
    const art = [...subsOfCat('art_craft')].sort((a, b) => count(a.id) - count(b.id))[0]
    const names = [music.name_ko, art.name_ko]
    expect(moodWallpaper(names)).toBe(wallpaperForCategory('music_dance'))
    expect(wallpaperForPicks(names)).toBe(wallpaperForCategory('art_craft'))
    expect(wallpaperForCategory('music_dance')).not.toBe(wallpaperForCategory('art_craft'))
  })
})
function count(subId: string) { return CATEGORIES.flatMap((c) => c.tags).find((t) => t.id === subId)!.count }

describe('planRoom: 관심사 → 가구 배치 (3D 핸드오프 v3)', () => {
  it('아무것도 안 고르면 빈 방, 연출 0초', () => {
    const p = planRoom([])
    expect(p.items).toEqual([])
    expect(p.duration).toBe(0)
  })
  it('고른 대분류의 대분류 가구는 모두 정해진 슬롯에', () => {
    const picks = [subsOfCat('book')[0].id, subsOfCat('music_dance')[0].id]
    const p = planRoom(picks)
    expect(p.categories).toEqual(['book', 'music_dance'])
    for (const cat of p.categories) {
      const cd = INTEREST_CATS.find((c) => c.id === cat)!
      const placed = p.items.filter((it) => it.category === cat && it.sub === null)
      expect(placed.map((it) => [it.row.id, it.slot.name])).toEqual(cd.furniture.map((f, i) => [f, cd.furniture_slots[i]]))
    }
  })
  it('화면 이름으로 골라도 id 로 고른 것과 같음', () => {
    const ids = subsOfCat('art_craft').slice(0, 3).map((s) => s.id)
    const a = planRoom(ids), b = planRoom(ids.map(nameOf))
    expect(b.items.map((it) => [it.row.id, it.slot.name])).toEqual(a.items.map((it) => [it.row.id, it.slot.name]))
  })
  it('무작위 조합 300개: 슬롯 하나에 가구 하나(같은 가구 두 번 없음), 소품이 있는 소분류마다 소품 하나', () => {
    const r = rng(20261116)
    for (let k = 0; k < 300; k++) {
      const picks = randomPicks(r, 3 + Math.floor(r() * 8))
      const p = planRoom(picks)
      const slots = p.items.map((it) => it.slot.name)
      expect(new Set(slots).size, picks.join(',')).toBe(slots.length)
      expect(new Set(p.items.map((it) => it.row.id)).size, picks.join(',')).toBe(p.items.length)
      for (const id of picks) {
        const props = p.items.filter((it) => it.sub === id && it.row.type !== 'pet')
        const prop = subOf(id)!.prop
        expect(props, id).toHaveLength(prop ? 1 : 0)
        if (prop) expect(props[0].row.id).toBe(prop)
      }
      // 고른 대분류의 가구는 (다른 대분류가 먼저 놓았더라도) 방에 있음
      for (const c of p.categories) for (const f of INTEREST_CATS.find((x) => x.id === c)!.furniture) expect(p.items.some((it) => it.row.id === f), f).toBe(true)
    }
  })
  it('선반 소품은 선반 슬롯에만, 바닥·반려동물 소품은 카탈로그가 정한 슬롯에', () => {
    const r = rng(7)
    for (let k = 0; k < 100; k++) {
      for (const it of planRoom(randomPicks(r, 10)).items) {
        if (!it.sub) continue
        const sub = subOf(it.sub)!
        if (it.row.type === 'pet') expect(it.slot.name).toBe(it.row.slot?.name)
        else if (sub.slot_kind === 'shelf') expect(it.slot.kind).toBe('shelf')
        else expect(it.slot.name).toBe(it.row.slot?.name)
      }
    }
  })
  it('반려동물 용품을 고르면 짝 동물도 같이, 같은 시각에 떨어짐 (v3.4)', () => {
    for (const sub of subsOfCat('pet_plant').filter((s) => s.pet)) {
      const p = planRoom([sub.id])
      const pair = p.items.filter((it) => it.sub === sub.id)
      expect(pair.map((it) => it.row.id).sort()).toEqual([sub.prop, sub.pet!].sort())
      expect(pair[0].start).toBe(pair[1].start)
    }
  })
  it(`몇 개를 고르든 마지막 가구가 ${DROP_SPAN}초 안에 출발, 연출은 ${DROP_SPAN + DROP_LEN}초 안에 끝 ("2초 안에")`, () => {
    const r = rng(99)
    for (let k = 0; k < 100; k++) {
      const p = planRoom(randomPicks(r, 10))
      const last = Math.max(...p.items.map((it) => it.start))
      expect(last).toBeLessThanOrEqual(DROP_SPAN + 1e-9)
      expect(p.duration).toBeLessThanOrEqual(DROP_SPAN + DROP_LEN + 1e-9)
      expect(p.duration).toBeLessThan(2)
      for (const it of p.items) expect(it.start).toBeGreaterThanOrEqual(0)
    }
  })
  it('세트(카테고리)는 고른 순서대로 떨어지고, 세트 안은 부피 큰 것부터', () => {
    const picks = [subsOfCat('game')[0].id, subsOfCat('book')[0].id, subsOfCat('game')[1].id]
    const p = planRoom(picks)
    const firstStart = (c: string) => Math.min(...p.items.filter((it) => it.category === c).map((it) => it.start))
    expect(firstStart('game')).toBeLessThan(firstStart('book'))
    for (const c of p.categories) {
      const set = p.items.filter((it) => it.category === c).sort((a, b) => a.start - b.start)
      const vol = (it: (typeof set)[number]) => it.row.size_m.w * it.row.size_m.d * it.row.size_m.h
      for (let i = 1; i < set.length; i++) {
        if (set[i].start > set[i - 1].start) expect(vol(set[i - 1])).toBeGreaterThanOrEqual(vol(set[i]))
      }
    }
  })
  it('지금 카탈로그는 모든 가구가 모델(built) — 둥근 블록 없음 (v3.1~v3.4)', () => {
    const p = planRoom(INTEREST_SUBS.slice(0, 10).map((s) => s.id))
    expect(p.items.every((it) => it.built)).toBe(true)
  })
})

describe('가구 고르기 (F4 꾸미기 가구 탭 3)', () => {
  const shelfSub = INTEREST_SUBS.find((s) => s.slot_kind === 'shelf')!
  const floorSub = INTEREST_SUBS.find((s) => s.slot_kind === 'floor' || s.slot_kind === 'pet_floor')!
  it('후보 = 기본 가구 + 같은 대분류 선반 소품 최대 2개, 기본 가구가 맨 앞', () => {
    const c = furnitureCandidates(shelfSub.id, [shelfSub.id])
    expect(c[0].id).toBe(shelfSub.prop)
    expect(c.length).toBeGreaterThanOrEqual(1)
    expect(c.length).toBeLessThanOrEqual(3)
    for (const row of c) expect(INTEREST_SUBS.find((s) => s.prop === row.id)?.category).toBe(shelfSub.category)
  })
  it('소품이 아직 없는 소분류는 후보 없음', () => {
    const none = INTEREST_SUBS.find((s) => !s.prop)!
    expect(furnitureCandidates(none.id, [none.id])).toEqual([])
  })
  it('내가 고른 다른 관심사의 기본 가구는 후보에서 뺌', () => {
    const siblings = subsOfCat(shelfSub.category).filter((s) => s.slot_kind === 'shelf' && s.id !== shelfSub.id)
    const picks = [shelfSub.id, ...siblings.map((s) => s.id)]
    const c = furnitureCandidates(shelfSub.id, picks)
    expect(c.map((r) => r.id)).toEqual([shelfSub.prop])
  })
  it('바닥·반려동물 자리는 기본 가구 하나뿐', () => {
    expect(furnitureCandidates(floorSub.id, [floorSub.id]).map((r) => r.id)).toEqual([floorSub.prop])
  })
  it('관심사를 바꾸면 뺀 관심사의 선택은 사라지고 남긴 것은 유지', () => {
    const [a, b, c] = INTEREST_SUBS
    expect(pruneChoice({ [a.id]: 'x', [b.id]: 'y' }, [b.id, c.id])).toEqual({ [b.id]: 'y' })
  })
  it('고른 가구는 같은 자리에 다른 가구로 (반려동물은 안 바꿈)', () => {
    const c = furnitureCandidates(shelfSub.id, [shelfSub.id])
    if (c.length < 2) return
    const plan = planRoom([shelfSub.id])
    const next = applyChoice(plan, { [shelfSub.id]: c[1].id })
    const before = plan.items.find((it) => it.sub === shelfSub.id)!
    const after = next.items.find((it) => it.sub === shelfSub.id)!
    expect(after.row.id).toBe(c[1].id)
    expect(after.slot.name).toBe(before.slot.name)
    expect(after.start).toBe(before.start)
  })
})

describe('통하는 취향 (F3 분야 팝업 3: 고른 사람 5명 이하)', () => {
  it('목 인원수를 1/100 로 줄여 SSAFY 규모로, 최소 1명', () => {
    expect(ssafyCount(30)).toBe(1)
    expect(ssafyCount(540)).toBe(5)
    expect(isRare(540)).toBe(true)
    expect(isRare(560)).toBe(false)
  })
})

describe('카탈로그와 슬롯이 서로 맞음 (planRoom 이 기대는 것)', () => {
  it('모든 행·슬롯 id 가 하나뿐', () => {
    expect(new Set(FURNITURE_CATALOG.map((r) => r.id)).size).toBe(FURNITURE_CATALOG.length)
    expect(new Set(SLOTS.map((s) => s.name)).size).toBe(SLOTS.length)
  })
})
