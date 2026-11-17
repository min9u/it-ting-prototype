/**
 * 관심사 이펙트 데이터 (docs/interest-effects.md, 2026-11-17)
 * three.js 없이 계산만 함 → 땅굴 이펙트(three/interestFx/roomFx.ts)·탐색 들판 이펙트(fieldFx.ts)·테스트가 같이 씀.
 * - 카테고리마다 이펙트 색 (관심사 칩 톤과 같은 계열이되 3D 위에서 잘 보이게 채도를 올림)
 * - 같은 관심사를 고른 사람 수 = data/mock.ts 의 목 인원수 (서버가 생기면 그 값으로)
 * - 드문 정도: 인원수 기준 3단계. 방 안에서는 "가장 드문 관심사" 하나에 특별한 효과
 * - 탐색 들판 구멍마다 보일 것: 대표 관심사(맨 앞) · 펼칠 아이콘 3개(겹치는 것 → 드문 것 → 고른 순서) · 겹치는 수 · 드문 정도 · 접속 중
 */
import { CATEGORIES } from './mock'
import { INTEREST_CATS, INTEREST_SUBS, interestCatOf, subOf, subsIn, toSubIds } from './interests'
import { MY_FLOOR, fieldOf, floorLabel } from './field'

/** 카테고리 이펙트 색 (말풍선 테두리·아이콘·입자·빛줄기) */
export const FX_COLORS: Record<string, string> = {
  music: '#9C6FD6', photo: '#33A3A4', nature: '#5FAE45', game: '#3E8EDE', craft: '#E8705A', book: '#B98A3E',
  science: '#6A6FE0', tea_coffee: '#A8693F', outdoor: '#E8902B', movie: '#D9486B', pet: '#E57AA6',
}
export const fxColor = (cat: string | null | undefined) => (cat && FX_COLORS[cat]) || '#C8643A'

/** 세부 관심사 id → 같은 관심사를 고른 사람 수 */
const COUNT = new Map<string, number>(CATEGORIES.flatMap((c) => c.tags.map((t) => [t.id, t.count] as const)))
/** 드문 순서 (1 = 가장 드묾) */
const RANK = new Map([...COUNT.entries()].sort((a, b) => a[1] - b[1]).map(([id], i) => [id, i + 1]))

/** 같은 관심사를 고른 사람 수 (세부 관심사 id 또는 이름). 모르면 null */
export const peopleCount = (sub: string): number | null => COUNT.get(subOf(sub)?.id ?? '') ?? null
/** 65개 중 몇 번째로 드문지 (1 = 가장 드묾) */
export const rarityRank = (sub: string): number | null => RANK.get(subOf(sub)?.id ?? '') ?? null
export const SUB_TOTAL = INTEREST_SUBS.length

export type Rarity = 'legend' | 'rare' | 'uncommon'
/** 인원수 → 드문 정도. 100명 미만 아주 드묾 · 250명 미만 드묾 · 700명 미만 흔치 않음 (목 인원수 30~3,400명 기준) */
export function rarityOf(count: number | null): Rarity | null {
  if (count == null) return null
  return count < 100 ? 'legend' : count < 250 ? 'rare' : count < 700 ? 'uncommon' : null
}
export const RARITY_LABEL: Record<Rarity, string> = { legend: '아주 드문 관심사', rare: '드문 관심사', uncommon: '흔치 않은 관심사' }

/** 목록에서 가장 드문 관심사 (드문 정도가 있을 때만) */
export function rarestOf(list: string[]): { id: string; count: number; rarity: Rarity } | null {
  let best: { id: string; count: number } | null = null
  for (const id of toSubIds(list)) {
    const n = COUNT.get(id)
    if (n != null && (!best || n < best.count)) best = { id, count: n }
  }
  const r = best ? rarityOf(best.count) : null
  return best && r ? { ...best, rarity: r } : null
}

/** 겹치는 세부 관심사 id (owner 가 고른 순서) */
export function sharedSubs(owner: string[], mine: string[]): string[] {
  const m = new Set(toSubIds(mine))
  return toSubIds(owner).filter((id) => m.has(id))
}

/** 대표 관심사 = 맨 앞에 고른 것 (땅굴 무드와 같은 규칙, data/myBurrow leadCategory) */
export function leadOf(list: string[]): { sub: string; cat: string } | null {
  const id = toSubIds(list)[0]
  const s = id ? subOf(id) : undefined
  return s ? { sub: s.id, cat: s.category } : null
}

export const catName = (cat: string) => interestCatOf(cat)?.name_ko ?? cat
export const subName = (sub: string) => subOf(sub)?.name_ko ?? sub
export const catOfSub = (sub: string) => subOf(sub)?.category ?? null
/** 카테고리 가구 중 주 가구 (이펙트 입자를 내는 가구) */
export const mainFurnitureOf = (cat: string) => INTEREST_CATS.find((c) => c.id === cat)?.furniture[0] ?? null

/** 그 카테고리에서 이 사람이 고른 세부 관심사 (고른 순서) */
export const subsOfCat = (list: string[], cat: string) => {
  const inCat = new Set(subsIn(cat).map((s) => s.id))
  return toSubIds(list).filter((id) => inCat.has(id))
}

/**
 * 내 들판(이번 학기 내 캠퍼스-층)에서 이 관심사를 가진 이웃 수 (나·방 주인 빼고). 니치 취미를 가까이에서 찾게 (차별점 3).
 * 목 데이터라 들판을 시드로 만듦 (data/field.ts)
 */
export function neighborsWith(sub: string, exclude: string[] = []): { n: number; where: string } {
  const id = subOf(sub)?.id
  const d = fieldOf(MY_FLOOR)
  const n = id ? d.residents.filter((r) => !r.mine && !exclude.includes(r.user.id) && toSubIds(r.user.interests).includes(id)).length : 0
  return { n, where: floorLabel(MY_FLOOR) }
}

/** 탐색 들판 구멍 하나에 보일 이펙트 정보 */
export interface HoleFx {
  seat: number
  /** 땅굴 주인 닉네임 (화면 밖 이웃 이정표) */
  name: string
  /** 대표 카테고리 (말풍선·연기 색) */
  cat: string
  /** 펼쳤을 때 아이콘 (세부 관심사 id, 최대 3개): 겹치는 것 → 가장 드문 것 → 고른 순서 */
  icons: string[]
  /** 아이콘 밖으로 남은 관심사 수 */
  more: number
  /** 나와 겹치는 관심사 수 (내 땅굴이면 0) */
  shared: number
  /** 겹치는 세부 관심사 id */
  sharedIds: string[]
  /** 드문 관심사 (들판은 아주 드묾·드묾만 반짝) */
  rarity: 'legend' | 'rare' | null
  rareId: string | null
  online: boolean
  mine: boolean
}

export function holeFxOf(seat: number, user: { interests: string[]; online?: boolean; nickname?: string }, mine: boolean, myInterests: string[]): HoleFx | null {
  const ids = toSubIds(user.interests)
  const lead = leadOf(ids)
  if (!lead) return null
  const sharedIds = mine ? [] : sharedSubs(ids, myInterests)
  const rare = rarestOf(ids)
  const icons: string[] = []
  const add = (id: string | null | undefined) => { if (id && !icons.includes(id) && icons.length < 3) icons.push(id) }
  sharedIds.forEach(add)
  add(rare?.id)
  ids.forEach(add)
  const rarity = rare && rare.rarity !== 'uncommon' ? rare.rarity : null
  return {
    seat, name: mine ? '내 땅굴' : user.nickname ?? '', cat: lead.cat, icons, more: Math.max(0, ids.length - icons.length), shared: sharedIds.length, sharedIds,
    rarity, rareId: rarity ? rare!.id : null, online: !!user.online, mine,
  }
}
