/**
 * 관심사 겹침 · 드문 취미 (디자인 B·C·D 와 미니맵 필터가 같이 씀)
 * 무게는 온보딩 "땅굴 무드"와 같은 식: 관심사마다 1 + 1000/그 관심사를 고른 사람 수 → 드문 취미가 무거움
 */
import { CATEGORIES, categoryOf } from '../../../data/mock'
import type { User } from '../../../data/types'
import { RARITY } from '../../../data/rarity'

const COUNT = new Map(CATEGORIES.flatMap((c) => c.tags.map((t) => [t.name, t.count] as const)))
/** 그 관심사를 고른 사람 수 (모르면 크게) */
export const peopleOf = (tag: string) => COUNT.get(tag) ?? 9999
/** 이 수보다 적게 고른 관심사 = 드문 취미 (data/rarity.ts 한 곳. 예전 400명 → 관심사 이펙트와 같은 250명) */
export const RARE_MAX = RARITY.rare
export const isRare = (tag: string) => peopleOf(tag) < RARE_MAX

/** 나와 겹치는 관심사 (드문 것부터) */
export function sharedWith(u: Pick<User, 'interests'>, mine: string[]): string[] {
  return u.interests.filter((i) => mine.includes(i)).sort((a, b) => peopleOf(a) - peopleOf(b))
}

/** 잘 맞는 정도: 겹치는 관심사마다 1 + 1000/인원 */
export function matchScore(u: Pick<User, 'interests'>, mine: string[]): number {
  return sharedWith(u, mine).reduce((s, t) => s + 1 + 1000 / peopleOf(t), 0)
}

/** 관심사 → 분류 이모지 (방 미리보기 소품) */
export const emojiOf = (tag: string) => categoryOf(tag)?.emoji ?? '🌱'

/** 그 사람 관심사의 분류들 (무거운 순) */
export function categoriesByWeight(interests: string[]): { id: string; emoji: string; name: string }[] {
  const w = new Map<string, { id: string; emoji: string; name: string; v: number }>()
  for (const t of interests) {
    const c = categoryOf(t)
    if (!c) continue
    const cur = w.get(c.id) ?? { id: c.id, emoji: c.emoji, name: c.name, v: 0 }
    cur.v += 1 + 1000 / peopleOf(t)
    w.set(c.id, cur)
  }
  return [...w.values()].sort((a, b) => b.v - a.v)
}
