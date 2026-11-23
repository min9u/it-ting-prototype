/**
 * 방 배치 규칙 v3.8 (data/roomPlanV38.ts, 3D 핸드오프 v3.8 PLACEMENT_v3_8.md 2 · 3 · 4 · 5번)
 * 소분류 10개 무작위 조합(시드 고정): 놓지 못한 경우 0 · 같은 칸 중복 없음 · max_m 준수 · 동물 짝 함께
 */
import { describe, expect, it } from 'vitest'
import { SUB_WORDS, wordsOfSub } from '../data/interestWords'
import { BIG_SIZES, SLOTS_V38, dropByHeight, fits, placeWords, wordOrder } from '../data/roomPlanV38'

function rng(seed: number) {
  let a = seed || 1
  return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296 }
}
const ALL = SUB_WORDS.map((s) => s.subId)
const pickN = (r: () => number, from: readonly string[], n: number) => {
  const pool = [...from]; const out: string[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}
const sid = (tag: string) => SUB_WORDS.find((s) => s.tag === tag)!.subId
const slot = (n: string) => SLOTS_V38.find((s) => s.name === n)!

describe('배치 규칙 v3.8', () => {
  it('큰 · 벽 모델 크기표 23개는 단어 node 와 같고, 동물 용품 7개는 표에 없음', () => {
    const big = SUB_WORDS.flatMap((s) => s.words).filter((w) => w.size !== '작은')
    expect(big).toHaveLength(30)
    const pets = big.filter((w) => w.pet)
    expect(pets).toHaveLength(7)
    for (const w of big.filter((x) => !x.pet)) expect(BIG_SIZES[w.node], w.node).toBeTruthy()
    for (const w of pets) expect(BIG_SIZES[w.node]).toBeUndefined()
    expect(Object.keys(BIG_SIZES)).toHaveLength(23)
  })

  it('소분류 하나 = 모델 하나, 고른 단어가 먼저 · 안 고르면 첫 단어', () => {
    const s = sid('카페/커피')
    expect(placeWords([s]).placed[0].word.word).toBe('카페')
    expect(placeWords([s], { [s]: '커피' }).placed[0].word.word).toBe('커피')
    expect(wordOrder(s, '커피').map((w) => w.word)).toEqual(['커피', '카페'])
  })

  it('작은 소품 배정 순서(원탁 위 칸 안 씀): 선반, 선반, 바닥, 선반, 바닥, 선반, 바닥, 바닥, 선반, 바닥 (칸은 종류별 정해진 순서)', () => {
    const smalls = SUB_WORDS.filter((x) => x.words[0].size === '작은' && !x.words[0].pet).slice(0, 10).map((x) => x.subId)
    const r = placeWords(smalls)
    expect(r.unplaced).toEqual([])
    expect(r.placed.map((p) => p.slot.name)).toEqual([
      'prop_slot_01', 'prop_slot_02', 'prop_slot_20', 'prop_slot_03', 'prop_slot_21',
      'prop_slot_04', 'prop_slot_22', 'prop_slot_13', 'prop_slot_05', 'prop_slot_14',
    ])
    expect(r.placed.map((p) => p.kind)).toEqual(['shelf', 'shelf', 'floor_prop', 'shelf', 'floor_prop', 'shelf', 'floor_prop', 'floor_prop', 'shelf', 'floor_prop'])
    // 바닥 칸 1.4배 · 선반 1배, 바닥 새 칸 먼지 0.6
    expect(r.placed.map((p) => p.scale)).toEqual([1, 1, 1.4, 1, 1.4, 1, 1.4, 1.4, 1, 1.4])
    // 새 칸(20~22)과 선반은 제자리 등장, 되살린 13 · 14 는 원래 낙하(HANDOFF v3.8.1: ry · drop 유지)
    for (const p of r.placed) expect(p.drop.mode, p.slot.name).toBe(/_(13|14)$/.test(p.slot.name) ? 'fall' : 'pop')
    expect(r.placed.filter((p) => p.slot.name.match(/_(20|21|22)$/)).every((p) => p.drop.dust === 0.6)).toBe(true)
  })

  it('작은 소품은 17개(선반 12 + 바닥 5)까지, 원탁 위 칸(23·24)은 한 번도 안 씀, 바닥은 20 → 21 → 22 → 13 → 14 순서 (바닥이 차면 빈 선반으로)', () => {
    const smalls = SUB_WORDS.filter((x) => x.words[0].size === '작은' && !x.words[0].pet).slice(0, 20).map((x) => x.subId)
    const r = placeWords(smalls)
    expect(r.placed).toHaveLength(17)
    expect(r.unplaced).toHaveLength(3)
    expect(new Set(r.placed.map((p) => p.slot.name)).size).toBe(17)
    expect(r.placed.some((p) => p.kind === 'table_top' || /_(23|24)$/.test(p.slot.name))).toBe(false)
    expect(r.placed.filter((p) => p.kind === 'floor_prop').map((p) => p.slot.name)).toEqual(['prop_slot_20', 'prop_slot_21', 'prop_slot_22', 'prop_slot_13', 'prop_slot_14'])
    for (const p of r.placed.filter((x) => x.slot.name === 'prop_slot_13' || x.slot.name === 'prop_slot_14')) expect(p.scale).toBe(1.4)
    // 바닥 5칸이 차는 6번째 바닥 차례(작은 소품 11번째 이후)는 선반으로 감
    const eleven = placeWords(smalls.slice(0, 11))
    expect(eleven.placed[10].kind).toBe('shelf')
  })

  it('slots.json 에는 원탁 위 칸 23 · 24 가 그대로 있음(지우지 않음, 앱에서만 안 씀)', () => {
    for (const n of ['prop_slot_23', 'prop_slot_24']) { expect(slot(n).kind).toBe('table_top'); expect(slot(n).pos_three[1]).toBeCloseTo(0.39) }
    for (const n of ['prop_slot_20', 'prop_slot_21', 'prop_slot_22']) expect(slot(n).max_m).toEqual({ w: 0.45, d: 0.45, h: 0.5 })
  })

  it('큰 모델 · 벽 · 동물 짝은 v3.8 그대로 (작은 소품이 섞여도 같은 자리)', () => {
    const big = sid('요리/레시피'), small = SUB_WORDS.filter((x) => x.words[0].size === '작은' && !x.words[0].pet)[0].subId
    expect(placeWords([big]).placed[0].slot.name).toBe(placeWords([small, big]).placed[1].slot.name)
    expect(placeWords([sid('강아지')]).placed[0].petSlot!.name).toBe(placeWords([small, sid('강아지')]).placed[1].petSlot!.name)
  })

  it('큰 → 회전 없이 max_m 안에 드는 빈칸 중 바닥 면적이 가장 작은 칸', () => {
    const s = sid('요리/레시피') // 요리 = 주방 조리대(큰)
    const p = placeWords([s]).placed[0]
    const m = BIG_SIZES[p.word.node]
    expect(p.kind).toBe('floor')
    expect(fits(m, p.slot)).toBe(true)
    const a = (x: { max_m: { w: number; d: number } }) => x.max_m.w * x.max_m.d
    const cands = SLOTS_V38.filter((x) => x.slot_type === 'shared_big' && x.kind === 'floor' && fits(m, x))
    expect(a(p.slot)).toBe(Math.min(...cands.map(a)))
  })

  it('벽 → 벽 공용 04 · 18 · 20 · 24', () => {
    const wallSubs = SUB_WORDS.filter((x) => x.words[0].size === '벽')
    expect(wallSubs.length).toBeGreaterThan(0)
    for (const w of wallSubs) {
      const p = placeWords([w.subId]).placed[0]
      expect(['furniture_slot_04', 'furniture_slot_18', 'furniture_slot_20', 'furniture_slot_24']).toContain(p.slot.name)
      expect(p.drop.mode).toBe('pop')
    }
  })

  it('동물 짝: 동물 자리 + 짝 용품 자리가 함께, 같은 종 짝이 먼저', () => {
    const dog = placeWords([sid('강아지')]).placed[0]
    expect(dog.kind).toBe('pet')
    expect(dog.petSlot!.name).toBe('pet_slot_02')
    expect(dog.slot.name).toBe('prop_slot_16')
    expect(dog.petSlot!.pair_slot).toBe(dog.slot.name)
    // 짝이 없는 종(설치류)은 남의 짝을 먼저 가져가지 않음: 고양이를 같이 고르면 설치류는 다른 짝
    const both = placeWords([sid('설치류/소동물'), sid('고양이')]).placed
    expect(both.find((p) => p.word.word === '고양이')!.petSlot!.name).toBe('pet_slot_01')
    expect(both.find((p) => p.word.word === '설치류')!.petSlot!.name).not.toBe('pet_slot_01')
  })

  it('낙하: 바닥 공용은 모델 키 이상인 첫 max_h 줄, 줄이 모자라면 제자리 등장', () => {
    const s01 = slot('furniture_slot_01')
    expect(dropByHeight(s01, 0.4)).toMatchObject({ mode: 'fall', H: 1.2, S: 0.9 })
    expect(dropByHeight(s01, 0.5)).toMatchObject({ mode: 'fall', H: 1.2, S: 0.9 })
    expect(dropByHeight(s01, 0.51).mode).toBe('pop')
    expect(dropByHeight(s01, 9).mode).toBe('pop')
    const noRows = slot('prop_slot_01')
    expect(dropByHeight(noRows, 0.3)).toBe(noRows.drop)
  })

  it('소분류 10개 무작위 조합 3000번: 놓지 못한 경우 0, 칸 중복 없음, max_m 준수, 동물 짝 함께', () => {
    const r = rng(20261121)
    for (let i = 0; i < 3000; i++) {
      const subs = pickN(r, ALL, 10)
      // 단어를 무작위로 고른 경우도 섞음
      const choice: Record<string, string> = {}
      for (const s of subs) { const ws = wordsOfSub(s)!.words; if (ws.length > 1 && r() < 0.5) choice[s] = ws[Math.floor(r() * ws.length)].word }
      const res = placeWords(subs, choice)
      expect(res.unplaced, subs.join()).toEqual([])
      expect(res.placed).toHaveLength(10)
      const names = res.placed.flatMap((p) => [p.slot.name, ...(p.petSlot ? [p.petSlot.name] : [])])
      expect(new Set(names).size, subs.join()).toBe(names.length)
      for (const p of res.placed) {
        if (p.kind === 'floor' || p.kind === 'wall') expect(fits(BIG_SIZES[p.word.node], p.slot), p.word.node + p.slot.name).toBe(true)
        if (p.kind === 'pet') { expect(p.petSlot).toBeTruthy(); expect(p.petSlot!.pair_slot).toBe(p.slot.name) }
        if (p.kind === 'shelf') expect(p.slot.kind).toBe('shelf')
      }
    }
  })

  it('큰 모델 소분류만 10개(가장 힘든 경우)도 전부 놓임', () => {
    const bigSubs = SUB_WORDS.filter((x) => x.words.every((w) => w.size !== '작은')).map((x) => x.subId)
    const r = rng(7)
    for (let i = 0; i < 500; i++) {
      const res = placeWords(pickN(r, bigSubs, 10))
      expect(res.unplaced).toEqual([])
    }
  })
})
