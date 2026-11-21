/**
 * 가구 낙하 (3D 핸드오프 v3.8 furniture_drop_spec_v3_7.md, 2026-11-21 4단계)
 * - 곡선: 0.60초 · 0.30초 착지 · 0.40~0.52 튕김 최고 0.15m · 안착 · pop 표
 * - 계획: 새 규칙으로 놓인 모든 가구의 낙하 값이 표(slots.json 의 drop · drop_by_height)에서 나옴
 */
import { describe, expect, it } from 'vitest'
import { DROP_DURATION, DUST_AT, furnitureDrop } from '../three/furnitureDrop'
import { diffPlans, planRoom } from '../data/roomPlan'
import { SUB_WORDS } from '../data/interestWords'

describe('furnitureDrop 곡선 (spec 2번)', () => {
  it('총 0.60초, 먼지는 0.30초(첫 착지)', () => {
    expect(DROP_DURATION).toBe(0.6)
    expect(DUST_AT).toBe(0.3)
  })
  it('낙하: 시작 높이 H, 0.30초에 바닥, 튕김 t=0.46 최고 0.15m, 0.52 다시 바닥, 0.60 안착(위치 0 · 회전 0 · 크기 1)', () => {
    expect(furnitureDrop(0, 2).y).toBeCloseTo(2)
    expect(furnitureDrop(0.15, 1.6).y).toBeCloseTo(1.6 * (1 - 0.25), 5)
    expect(furnitureDrop(0.30, 1.2).y).toBeCloseTo(0)
    expect(furnitureDrop(0.46, 2).y).toBeCloseTo(0.15, 5)
    expect(furnitureDrop(0.52, 2).y).toBeCloseTo(0)
    const end = furnitureDrop(0.6, 2, 0.5)
    expect(end).toMatchObject({ y: 0, side: 0, rotDeg: 0, scaleV: 1, scaleH: 1 })
  })
  it('시작 크기 0.8배, 회전 +8°, 가로 오프셋 S 는 낙하와 같이 0 으로', () => {
    const a = furnitureDrop(0, 2, 0.7)
    expect(a.scaleV).toBeCloseTo(0.8); expect(a.rotDeg).toBeCloseTo(8); expect(a.side).toBeCloseTo(0.7)
    expect(furnitureDrop(0.30, 2, 0.7).side).toBeCloseTo(0)
  })
  it('찌그러짐 t=0.34: 세로 0.80 · 가로 1.10 / 두 번째 착지 t=0.555: 0.92 · 1.04', () => {
    const k = furnitureDrop(0.34)
    expect([k.scaleV, k.scaleH]).toEqual([expect.closeTo(0.8, 5), expect.closeTo(1.1, 5)])
    const j = furnitureDrop(0.555)
    expect([j.scaleV, j.scaleH]).toEqual([expect.closeTo(0.92, 5), expect.closeTo(1.04, 5)])
  })
  it('pop: 위치 이동 없음, 0.22 에 1.08배, 0.36 에 세로 0.90 · 가로 1.05, 0.60 안착', () => {
    const p = (t: number) => furnitureDrop(t, 2, 0.5, 'pop')
    expect(p(0)).toMatchObject({ y: 0, side: 0, rotDeg: 0, scaleV: 0, scaleH: 0 })
    expect(p(0.22).scaleV).toBeCloseTo(1.08); expect(p(0.22).scaleH).toBeCloseTo(1.08)
    expect([p(0.36).scaleV, p(0.36).scaleH]).toEqual([expect.closeTo(0.9, 5), expect.closeTo(1.05, 5)])
    expect([p(0.6).scaleV, p(0.6).scaleH]).toEqual([1, 1])
  })
})

describe('낙하 계획 (슬롯 drop 표)', () => {
  const all = SUB_WORDS.flatMap((sw) => sw.words.map((w) => ({ sub: sw.subId, word: w.word })))
  it('낙하(fall)는 H 가 있고, 선반 · 벽걸이 · 동물은 pop', () => {
    for (const { sub, word } of all) {
      const plan = planRoom([sub], { [sub]: word })
      for (const it of plan.items) {
        const d = it.slot.drop
        if (d.mode === 'fall') expect(d.H, `${sub}/${word} ${it.slot.name}`).toBeGreaterThan(0)
        if (it.slot.kind === 'shelf' || it.slot.kind === 'wall' || it.row.type === 'pet') expect(d.mode, `${sub}/${word} ${it.slot.name}`).toBe('pop')
      }
    }
  })
  it('시작 시각: 부피 큰 것부터 0.12초 간격, 마지막 시작은 1.0초 안', () => {
    const plan = planRoom(SUB_WORDS.slice(0, 10).map((s) => s.subId))
    const starts = plan.items.map((i) => i.start)
    expect(Math.max(...starts)).toBeLessThanOrEqual(1.0 + 1e-9)
    expect(Math.min(...starts)).toBe(0)
    expect(plan.duration).toBeCloseTo(Math.max(...starts) + 0.6)
  })
  it('같은 소분류의 단어를 바꾸면 계획이 바뀜 (소품 탭 미리 보기가 다시 놓는 근거)', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    const a = planRoom([sw.subId], { [sw.subId]: sw.words[0].word }).items.map((i) => i.row.id)
    const b = planRoom([sw.subId], { [sw.subId]: sw.words[1].word }).items.map((i) => i.row.id)
    expect(a).not.toEqual(b)
  })
})

describe('방 배치가 바뀔 때 diffPlans (새 관심사만 낙하, 단어만 바꾼 건 pop, 빠진 건 사라짐)', () => {
  const subs = SUB_WORDS.filter((s) => s.pickable).slice(0, 6)
  const [a, b, c] = subs
  const key = (it: { slot: { name: string }; row: { id: string } }) => `${it.slot.name}|${it.row.id}`

  it('관심사를 하나 더 고르면 그 관심사의 소품만 drop, 이미 있던 것은 그대로', () => {
    const prev = planRoom([a.subId, b.subId]).items
    const next = planRoom([a.subId, b.subId, c.subId]).items
    const d = diffPlans(prev, next)
    expect(d.drop.length).toBeGreaterThan(0)
    expect(d.drop.every((i) => i.sub === c.subId)).toBe(true)
    expect(d.pop.every((i) => i.sub !== c.subId)).toBe(true)
    // 이미 있던 관심사의 소품 중 자리가 안 밀린 것은 removed · drop · pop 어디에도 안 들어감
    const touched = new Set([...d.removed, ...d.drop, ...d.pop].map(key))
    const stay = prev.filter((i) => next.some((n) => key(n) === key(i)))
    expect(stay.length).toBeGreaterThan(0)
    expect(stay.every((i) => !touched.has(key(i)))).toBe(true)
  })
  it('관심사를 빼면 그 관심사의 소품이 removed, 새로 놓는 건 없음', () => {
    const prev = planRoom([a.subId, b.subId, c.subId]).items
    const d = diffPlans(prev, planRoom([a.subId, b.subId]).items)
    expect(d.removed.length).toBeGreaterThan(0)
    expect(d.removed.every((i) => i.sub === c.subId)).toBe(true)
    expect(d.drop.length).toBe(0)
  })
  it('관심사 하나를 다른 것으로 바꾸면: 빠진 것 removed, 새 관심사 것 drop', () => {
    const prev = planRoom([a.subId, b.subId]).items
    const d = diffPlans(prev, planRoom([a.subId, c.subId]).items)
    expect(d.removed.some((i) => i.sub === b.subId)).toBe(true)
    expect(d.drop.every((i) => i.sub === c.subId)).toBe(true)
    expect(d.drop.length).toBeGreaterThan(0)
  })
  it('같은 관심사에서 단어만 바꾸면 drop 은 없고 pop(또는 removed)만', () => {
    const prev = planRoom([a.subId], { [a.subId]: a.words[0].word }).items
    const d = diffPlans(prev, planRoom([a.subId], { [a.subId]: a.words[1].word }).items)
    expect(d.drop.length).toBe(0)
    expect(d.pop.length).toBeGreaterThan(0)
    expect(d.removed.length).toBeGreaterThan(0)
  })
  it('바뀐 게 없으면 아무것도 없음', () => {
    const items = planRoom([a.subId, b.subId]).items
    expect(diffPlans(items, planRoom([a.subId, b.subId]).items)).toEqual({ removed: [], drop: [], pop: [] })
  })
})
