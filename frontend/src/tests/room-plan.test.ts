/**
 * 관심사 → 땅굴 자동 생성 (data/interests.ts, data/roomPlan.ts, data/wallpapers.ts, data/myBurrow.ts)
 * 근거
 * - F3 2-4·2-5: 고른 순서, 맨 앞 = 대표 관심사, 3개 이상 · 최대 10개
 * - F3 3a-3 · 00 공통 5: 땅굴 무드 = 대표 관심사(맨 앞)의 대분류 (docs/spec-f3-f4.md, 2026-11-16 결정)
 * - F4 꾸미기 가구 탭 3: 세부 관심사마다 가구 하나, 관심사를 바꾸면 뺀 것은 사라지고 둔 것은 유지
 * - 3D 핸드오프 v3 (HANDOFF_v3 2·3번, furniture_drop_spec 3·4번, v3.4 반려동물 짝), 낙하는 "2초 안에" (2026-11-12 사용자 요청)
 * - 예전 가중치 규칙 Σ(1 + 1000/인원) — 남의 땅굴 벽지에만 남아 있다가 2026-11-18 지움 (data/roomLook.ts 한 곳)
 */
import { describe, expect, it } from 'vitest'
import { INTEREST_CATS, INTEREST_SUBS, MAX_PICK, categoriesOf, subOf, toSubIds } from '../data/interests'
import { DROP_LEN, DROP_SPAN, FURNITURE_CATALOG, SLOTS, planRoom } from '../data/roomPlan'
import { CATEGORIES } from '../data/mock'
import { DEFAULT_WALLPAPER, wallpaperForCategory } from '../data/wallpapers'
import { roomLookOf } from '../data/roomLook'
import { MIN_PICK, furnitureCandidates, wordChoices, isRare, leadCategory, moodWallpaper, pruneChoice, ssafyCount } from '../data/myBurrow'

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
  it('카테고리에 관심사 전용 액세서리 연결이 없음 (액세서리 v1.2: 관심사와 따로 고름)', () => {
    for (const c of INTEREST_CATS) expect(c, c.id).not.toHaveProperty('accessories')
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
  it('남의 땅굴도 대표 관심사 규칙 (2026-11-18 고침: 예전 가중치 규칙 Σ 1 + 1000/인원 은 지움, 시험은 room-look.test.ts)', () => {
    // 흔한 음악·댄스 관심사를 맨 앞에, 아주 드문 미술·수공예 관심사를 뒤에 → 예전 남의 땅굴 규칙이면 미술·수공예였음
    const music = [...subsOfCat('music_dance')].sort((a, b) => count(b.id) - count(a.id))[0]
    const art = [...subsOfCat('art_craft')].sort((a, b) => count(a.id) - count(b.id))[0]
    const names = [music.name_ko, art.name_ko]
    expect(moodWallpaper(names)).toBe(wallpaperForCategory('music_dance'))
    expect(roomLookOf('someone', names).wallpaper).toBe(wallpaperForCategory('music_dance'))
    expect(wallpaperForCategory('music_dance')).not.toBe(wallpaperForCategory('art_craft'))
  })
})
function count(subId: string) { return CATEGORIES.flatMap((c) => c.tags).find((t) => t.id === subId)!.count }

describe('planRoom: 관심사 → 가구 배치 (3D 핸드오프 v3.8, 규칙 자체는 room-plan-v38.test.ts)', () => {
  it('아무것도 안 고르면 빈 방, 연출 0초', () => {
    const p = planRoom([])
    expect(p.items).toEqual([])
    expect(p.duration).toBe(0)
  })
  it('소분류 하나 = 모델 하나 (동물은 용품 + 동물 둘), 대분류는 고른 순서', () => {
    const picks = [subsOfCat('book')[0].id, subsOfCat('music_dance')[0].id]
    const p = planRoom(picks)
    expect(p.categories).toEqual(['book', 'music_dance'])
    expect(p.items.map((it) => it.sub)).toEqual(picks)
    expect(planRoom(['강아지']).items).toHaveLength(2)
  })
  it('화면 이름으로 골라도 id 로 고른 것과 같음', () => {
    const ids = subsOfCat('art_craft').slice(0, 3).map((s) => s.id)
    const a = planRoom(ids), b = planRoom(ids.map(nameOf))
    expect(b.items.map((it) => [it.row.id, it.slot.name])).toEqual(a.items.map((it) => [it.row.id, it.slot.name]))
  })
  it('무작위 조합 300개: 슬롯 하나에 모델 하나, 같은 모델 두 번 없음, 고른 소분류마다 놓임', () => {
    const r = rng(20261116)
    for (let k = 0; k < 300; k++) {
      const picks = randomPicks(r, 3 + Math.floor(r() * 8))
      const p = planRoom(picks)
      const slots = p.items.map((it) => it.slot.name)
      expect(new Set(slots).size, picks.join(',')).toBe(slots.length)
      expect(new Set(p.items.map((it) => it.row.id)).size, picks.join(',')).toBe(p.items.length)
      for (const id of picks) expect(p.items.some((it) => it.sub === id), id).toBe(true)
    }
  })
  it('작은 모델은 선반 · 바닥 · 원탁 위(v3.8.1), 큰 모델은 바닥 · 벽 공용 자리에, 동물은 동물 자리에', () => {
    const r = rng(7)
    for (let k = 0; k < 100; k++) {
      for (const it of planRoom(randomPicks(r, 10)).items) {
        if (it.row.type === 'pet') expect(it.slot.slot_type).toBe('pet')
        else if (it.row.type === 'sub_prop' && it.slot.kind === 'pet_floor') expect(it.slot.slot_type).toBe('prop')
        else if (it.row.type === 'sub_prop') expect(['shelf', 'floor_prop', 'table_top', 'floor']).toContain(it.slot.kind) // v3.8.1: 작은 소품은 선반 · 바닥 · 원탁 위
        else expect(it.slot.slot_type).toBe('shared_big')
      }
    }
  })
  it('반려동물 소분류는 용품 + 짝 동물이 같은 시각에 떨어짐 (v3.4)', () => {
    for (const sub of subsOfCat('pet_plant').filter((s) => ['dog', 'cat', 'bird', 'insect_reptile', 'small_animal'].includes(s.id))) {
      const p = planRoom([sub.id])
      const pair = p.items.filter((it) => it.sub === sub.id)
      expect(pair.map((it) => it.row.type).sort()).toEqual(['pet', 'sub_prop'])
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
  it('부피 큰 묶음부터 떨어짐 (묶음 = 같은 시각, 용품 + 짝 동물)', () => {
    const p = planRoom(randomPicks(rng(5), 10))
    const vol = (it: (typeof p.items)[number]) => it.row.size_m.w * it.row.size_m.d * it.row.size_m.h
    const starts = [...new Set(p.items.map((it) => it.start))].sort((x, y) => x - y)
    const maxVol = starts.map((t) => Math.max(...p.items.filter((it) => it.start === t).map(vol)))
    for (let i = 1; i < maxVol.length; i++) expect(maxVol[i - 1]).toBeGreaterThanOrEqual(maxVol[i] - 1e-9)
  })
  it('모든 모델은 대분류 glb 안 node 로 찾음 (둥근 블록 없음)', () => {
    const p = planRoom(INTEREST_SUBS.slice(0, 10).map((s) => s.id))
    expect(p.items.every((it) => it.built && /^interest_.*_v3_8_draco_webp\.glb$/.test(it.row.glb_compressed ?? ''))).toBe(true)
  })
  it('공용 바닥 자리의 낙하 값은 모델 키 단계별로 고른 값이 슬롯에 들어 있음', () => {
    const r = rng(11)
    for (let k = 0; k < 50; k++) for (const it of planRoom(randomPicks(r, 10)).items) expect(['fall', 'pop'], it.row.id).toContain(it.slot.drop.mode)
  })
})

describe('가구 고르기 → 단어 고르기 (v3.8, 꾸미기 소품 탭은 5단계)', () => {
  it('"/"로 묶인 소분류만 고를 단어가 있고, 한 단어는 고정', () => {
    expect(wordChoices(INTEREST_SUBS.find((s) => s.name_ko === '카페/커피')!.id)).toEqual(['카페', '커피'])
    expect(wordChoices(INTEREST_SUBS.find((s) => s.name_ko === '영화')!.id)).toEqual([])
    expect(wordChoices(INTEREST_SUBS.find((s) => s.name_ko === '액세서리/기타')!.id)).toEqual([])
  })
  it('가구 후보(예전 가구 탭)는 비어 있음', () => {
    expect(INTEREST_SUBS.every((s) => furnitureCandidates(s.id, [s.id]).length === 0)).toBe(true)
  })
  it('관심사를 바꾸면 뺀 관심사의 선택은 사라지고 남긴 것은 유지', () => {
    const [a, b, c] = INTEREST_SUBS
    expect(pruneChoice({ [a.id]: 'x', [b.id]: 'y' }, [b.id, c.id])).toEqual({ [b.id]: 'y' })
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
