/**
 * 가구 단어 데이터 (옛 꾸미기 소품 · 가구 탭이 쓰던 것, 2026-11-21 v3.8 5단계)
 * 단어를 고를 수 있는 소분류(90개 중 57개). 고른 값(FurnChoice) = 소분류 → 단어, 처음 값은 첫 단어.
 * 꾸미기 가구 탭과 목 전용 저장은 2026-11-23 뺐다(명세 dev 9ea6698: 가구는 고르지 않음). 데이터 · 배치 함수는 실험실(/lab/rooms)이 써서 시험을 남김
 */
import { describe, expect, it } from 'vitest'
import { SUB_WORDS, wordsOfSub } from '../data/interestWords'
import { planRoom } from '../data/roomPlan'
import { pruneChoice, wordChoices } from '../data/myBurrow'
import { validFurniture } from '../data/roomLook'
import { INTEREST_SUBS } from '../data/interests'

describe('소품 탭: 칩 · 후보', () => {
  it('칩이 되는 소분류는 57개, 이름에 "/"가 있는 58개에서 "액세서리/기타"(모델 1개 = 고정)만 빠짐', () => {
    const chips = SUB_WORDS.filter((s) => wordChoices(s.subId).length > 0)
    expect(chips.length).toBe(57)
    const slash = INTEREST_SUBS.filter((s) => s.name_ko.includes('/'))
    expect(slash.length).toBe(58)
    expect(slash.filter((s) => wordChoices(s.id).length === 0).map((s) => s.name_ko)).toEqual(['액세서리/기타'])
  })
  it('후보 수 = 단어 수, 한 단어 관심사는 후보 없음(고정)', () => {
    for (const sw of SUB_WORDS) expect(wordChoices(sw.subId)).toEqual(sw.pickable ? sw.words.map((w) => w.word) : [])
  })
  it('후보마다 모델 이름과 모델 노드가 있음 (카드 = 썸네일 + 이름)', () => {
    for (const sw of SUB_WORDS) for (const w of sw.words) { expect(w.name.length).toBeGreaterThan(0); expect(w.node.length).toBeGreaterThan(0) }
  })
})

describe('소품 탭: 고르면 방에 반영', () => {
  it('소분류 하나만 골랐을 때 고른 단어의 모델이 방에 놓임 (57개 × 단어 전부)', () => {
    for (const sw of SUB_WORDS.filter((s) => s.pickable)) {
      for (const w of sw.words) {
        const ids = planRoom([sw.subId], { [sw.subId]: w.word }).items.map((i) => i.row.id)
        expect(ids, `${sw.tag} → ${w.word}`).toContain(w.pet ? w.pet : w.node)
      }
    }
  })
  it('처음 값(고른 게 없음) = 첫 단어', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    const ids = planRoom([sw.subId], {}).items.map((i) => i.row.id)
    expect(ids).toContain(sw.words[0].pet ?? sw.words[0].node)
  })
  it('모르는 단어를 넣으면 첫 단어로 (옛 저장값 방어)', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    const a = planRoom([sw.subId], { [sw.subId]: '없는단어' }).items.map((i) => i.row.id)
    const b = planRoom([sw.subId], {}).items.map((i) => i.row.id)
    expect(a).toEqual(b)
  })
})

describe('소품 탭: 저장 · 관심사 바꾸면', () => {
  it('관심사에서 뺀 소분류의 선택은 사라지고 둔 것은 유지', () => {
    const [a, b] = SUB_WORDS.filter((s) => s.pickable)
    const c = { [a.subId]: a.words[1].word, [b.subId]: b.words[1].word }
    expect(pruneChoice(c, [a.subId])).toEqual({ [a.subId]: a.words[1].word })
  })
  it('남이 보는 땅굴: 단어 후보에 없는 값은 버림', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    expect(validFurniture({ [sw.subId]: '없는단어' }, [sw.subId])).toEqual({})
    expect(validFurniture({ [sw.subId]: sw.words[1].word }, [sw.subId])).toEqual({ [sw.subId]: sw.words[1].word })
    expect(wordsOfSub(sw.subId)).toBeTruthy()
  })
})
