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
import { RARITY, rarityOf, type Rarity } from './rarity'

export { rarityOf, type Rarity } from './rarity'

/**
 * 대분류 이펙트 색 (말풍선 테두리·아이콘·입자·빛줄기). 2026-11-18 확정본 12개.
 * 예전 색을 이어 쓴 것: 음악·댄스(음악) · 사진·영상(사진) · 게임 · 미술·수공예(공예) · 책·글 · 음식·음료(차·커피) · 아웃도어 ·
 * 외국어·자기계발(예전 우주·과학의 남색) · 덕질·수집(예전 반려동물의 분홍) · 반려동물·식물(예전 자연의 초록).
 * 새로: 스포츠 진홍 · 문화생활 자주 (빨강 계열이 셋이라 붉은 쪽·보라 쪽으로 벌림)
 */
export const FX_COLORS: Record<string, string> = {
  food: '#A8693F', sports: '#D23C54', culture: '#B5509E', game: '#3E8EDE', music_dance: '#9C6FD6', outdoor: '#E8902B',
  language_selfdev: '#5B6CE0', book: '#B98A3E', photo_video: '#33A3A4', art_craft: '#E8705A', fandom_collect: '#E57AA6', pet_plant: '#5FAE45',
}
export const fxColor = (cat: string | null | undefined) => (cat && FX_COLORS[cat]) || '#C8643A'

/**
 * 대분류 → 땅굴 입자 모양 (three/interestFx/roomFx.ts 가 그림, 2026-11-18 확정본 12개).
 * 예전 모양을 이어 쓴 것: 음표(음악·댄스) · 플래시(사진·영상) · 잎(반려동물·식물, 반려동물 용품을 고르면 동물이 발자국도) · 픽셀(게임) ·
 * 물감(미술·수공예) · 종이(책·글) · 김(음식·음료) · 불티(아웃도어) · 팝콘(문화생활).
 * 새로: 통통 튀는 공(스포츠) · 말풍선(외국어·자기계발) · 반짝 별(덕질·수집). 예전 우주·과학의 별 반짝은 없어짐
 */
export const FX_STYLE: Record<string, string> = {
  food: 'steam', sports: 'ball', culture: 'popcorn', game: 'pixel', music_dance: 'note', outdoor: 'ember',
  language_selfdev: 'talk', book: 'page', photo_video: 'flash', art_craft: 'paint', fandom_collect: 'star5', pet_plant: 'leaf',
}

/** 세부 관심사 id → 같은 관심사를 고른 사람 수 */
const COUNT = new Map<string, number>(CATEGORIES.flatMap((c) => c.tags.map((t) => [t.id, t.count] as const)))
/** 드문 순서 (1 = 가장 드묾) */
const RANK = new Map([...COUNT.entries()].sort((a, b) => a[1] - b[1]).map(([id], i) => [id, i + 1]))

/** 같은 관심사를 고른 사람 수 (세부 관심사 id 또는 이름). 모르면 null */
export const peopleCount = (sub: string): number | null => COUNT.get(subOf(sub)?.id ?? '') ?? null
/** 소분류 90개 중 몇 번째로 드문지 (1 = 가장 드묾) */
export const rarityRank = (sub: string): number | null => RANK.get(subOf(sub)?.id ?? '') ?? null
export const SUB_TOTAL = INTEREST_SUBS.length

/* 드문 정도 기준(100 · 250 · 700명)은 data/rarity.ts 한 곳 (탐색 시안 B~D·미니맵과 같이 씀) */
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
/** 반려동물 용품처럼 짝 동물이 있는 소분류 (동물이 발자국을 내므로 용품은 입자 없음) */
export const hasPet = (sub: string | null | undefined) => !!(sub && subOf(sub)?.pet)
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
  /** 잘 맞는 정도 (겹치는 관심사마다 1 + 1000/인원, 탐색 시안 match.ts 와 같은 식). 잘 맞는 이웃 신호(f_radar) */
  score: number
  /** 이 사람의 세부 관심사 id 전부 (관심사 등불) */
  subs: string[]
  /** 이 들판에서 나와 잘 맞는 쪽 (closeSeatsOf, 겹치는 관심사 고리·미니맵 ♥). holeFxOf 는 false, 들판 단위로 채움 */
  close: boolean
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
    score: matchScoreOf(sharedIds), subs: ids, close: false,
  }
}

/** 잘 맞는 정도: 겹치는 관심사마다 1 + 1000/인원 (탐색 시안 match.ts matchScore 와 같은 식, 드문 것일수록 무거움) */
export const matchScoreOf = (sharedIds: string[]) => sharedIds.reduce((s, id) => s + 1 + 1000 / (COUNT.get(id) ?? 1000), 0)

/**
 * 들판에서 "나와 잘 맞는" 자리 (2차). 예전에는 겹치는 관심사가 1개만 있어도 고리·♥ 를 띄웠는데,
 * 인기 관심사(캠핑 2,600명 등)를 고른 사람은 들판 거의 모두와 1개쯤 겹쳐서 고리·♥ 가 모든 구멍에 떠 정보가 없었음.
 * → 잘 맞는 정도(matchScoreOf)가 이 들판에서 위쪽 1/4 (최소 3곳)인 자리만. 같은 점수는 같이 들어감
 */
export const CLOSE_TOP = 0.25
export function closeSeatsOf(residents: { seat: number; user: { interests: string[] }; mine?: boolean }[], myInterests: string[]): Set<number> {
  const scored = residents.filter((r) => !r.mine).map((r) => ({ seat: r.seat, score: matchScoreOf(sharedSubs(r.user.interests, myInterests)) })).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  const k = Math.min(scored.length, Math.max(3, Math.ceil((residents.length - 1) * CLOSE_TOP)))
  const cut = k ? scored[k - 1].score : Infinity
  return new Set(scored.filter((x) => x.score >= cut).map((x) => x.seat))
}

/* ---------- 2차 (2026-11-17 저녁) ---------- */

/** 땅굴 위 관심사 한 줄 요약 (r_summary) 한 칸 */
export interface SummaryItem { sub: string; cat: string; shared: boolean; rarest: boolean; count: number | null }
/**
 * 요약 줄 순서: 나와 겹치는 것(♥) → 가장 드문 것(✦, 700명 미만일 때) → 나머지 고른 순서.
 * viewer 가 없으면(내 땅굴) 겹침 없이 드문 것 → 고른 순서
 */
export function summaryOf(owner: string[], viewer?: string[]): SummaryItem[] {
  const ids = toSubIds(owner)
  const shared = new Set(viewer ? sharedSubs(ids, viewer) : [])
  const rare = rarestOf(ids)?.id ?? null
  const rank = (id: string) => (shared.has(id) ? 0 : id === rare ? 1 : 2)
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
    .map(({ id }) => ({ sub: id, cat: catOfSub(id) ?? '', shared: shared.has(id), rarest: id === rare, count: COUNT.get(id) ?? null }))
}

/** 입장 이름표 (r_rollcall): 카테고리마다 하나 (가구가 카테고리 단위라). 겹치는 것이 있는 카테고리 먼저 */
export interface RollcallGroup { cat: string; subs: string[]; shared: number }
export function rollcallOf(owner: string[], viewer?: string[]): RollcallGroup[] {
  const ids = toSubIds(owner)
  const shared = new Set(viewer ? sharedSubs(ids, viewer) : [])
  const groups: RollcallGroup[] = []
  for (const id of ids) {
    const cat = catOfSub(id)
    if (!cat) continue
    let g = groups.find((x) => x.cat === cat)
    if (!g) { g = { cat, subs: [], shared: 0 }; groups.push(g) }
    g.subs.push(id)
    if (shared.has(id)) g.shared++
  }
  return groups.sort((a, b) => b.shared - a.shared)
}
/** 이름표 글자: "음악 · 시티팝, 피아노" (세부 관심사 3개 넘으면 "외 N") */
export function rollcallText(g: RollcallGroup): string {
  const names = g.subs.slice(0, 2).map(subName)
  return `${catName(g.cat)} · ${names.join(', ')}${g.subs.length > 2 ? ` 외 ${g.subs.length - 2}` : ''}`
}

/**
 * 집주인 대화 의향 (r_talk, 차별점 2). 아직 설정 화면·서버가 없어서 **목 데이터**:
 * 예린·서연 = 말 걸어도 돼요, 서벅이·민구 = 방명록부터 천천히, 나머지는 id 로 정함(약 6:4)
 */
export type TalkMood = 'open' | 'slow'
const TALK_MOCK: Record<string, TalkMood> = { yerin: 'open', seoyeon: 'open', seobeok: 'slow', mingu: 'slow' }
export function talkMoodOf(userId: string | undefined): TalkMood | null {
  if (!userId) return null
  if (TALK_MOCK[userId]) return TALK_MOCK[userId]
  let h = 0
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) % 10 < 6 ? 'open' : 'slow'
}
export const TALK_LABEL: Record<TalkMood, string> = { open: '말 걸어도 돼요', slow: '방명록부터 천천히' }

/** 인사하면 퐁 (r_greet): 겹치는 관심사(최대 3개) → 없으면 집주인의 가장 드문 것 하나 → 그것도 없으면 맨 앞 */
export function greetTopicsOf(owner: string[], viewer: string[]): { subs: string[]; shared: boolean } {
  const sh = sharedSubs(owner, viewer)
  if (sh.length) return { subs: sh.slice(0, 3), shared: true }
  const r = rarestOf(owner)?.id ?? toSubIds(owner)[0]
  return { subs: r ? [r] : [], shared: false }
}
export function greetLine(t: { subs: string[]; shared: boolean }): string {
  if (!t.subs.length) return ''
  const first = subName(t.subs[0])
  return t.shared ? `“${first}” 이야기 해 볼까요?` : `“${first}”가 궁금하다고 말해 볼까요?`
}

/**
 * 동네 이름표 (f_zones): 구역(25자리)마다 유난히 많이 모인 카테고리.
 * 그냥 가장 많은 카테고리를 고르면 인원수가 큰 반려동물(고양이 3,300명)이 거의 모든 구역 이름이 되어서,
 * "이 구역에서 그 카테고리를 가진 집 수 − 들판 평균으로 기대되는 수"가 가장 큰 것을 고름 (3집 이상일 때만)
 */
export interface ZoneName { zone: number; cat: string; n: number; total: number }
export function zoneNamesOf(residents: { seat: number; user: { interests: string[] } }[], seatsPerZone = 25): ZoneName[] {
  const zoneOf = (seat: number) => Math.ceil(seat / seatsPerZone)
  const cats = (u: { interests: string[] }) => new Set(toSubIds(u.interests).map((id) => catOfSub(id)).filter((c): c is string => !!c))
  const all = new Map<string, number>()
  const byZone = new Map<number, { total: number; n: Map<string, number> }>()
  for (const r of residents) {
    const z = zoneOf(r.seat)
    const zz = byZone.get(z) ?? { total: 0, n: new Map() }
    zz.total++
    for (const c of cats(r.user)) { all.set(c, (all.get(c) ?? 0) + 1); zz.n.set(c, (zz.n.get(c) ?? 0) + 1) }
    byZone.set(z, zz)
  }
  const N = residents.length || 1
  const out: ZoneName[] = []
  for (const [zone, zz] of [...byZone.entries()].sort((a, b) => a[0] - b[0])) {
    let best: ZoneName | null = null, bestEx = -Infinity
    for (const [cat, n] of zz.n) {
      if (n < 3) continue
      const ex = n - zz.total * ((all.get(cat) ?? 0) / N)
      if (ex > bestEx || (ex === bestEx && best && n > best.n)) { bestEx = ex; best = { zone, cat, n, total: zz.total } }
    }
    if (best) out.push(best)
  }
  return out
}
export const zoneLabel = (z: ZoneName) => `${catName(z.cat)} 동네`

/**
 * 관심사 등불 고르기 (f_lantern): 내 관심사(이 들판에 가진 이웃 수) + 이 들판의 드문 관심사(드문 순 4개, 이웃이 있는 것만)
 */
export function lanternChoicesOf(residents: { user: { interests: string[] }; mine?: boolean }[], myInterests: string[]): { mine: { sub: string; n: number }[]; rare: { sub: string; n: number }[] } {
  const n = new Map<string, number>()
  for (const r of residents) if (!r.mine) for (const id of toSubIds(r.user.interests)) n.set(id, (n.get(id) ?? 0) + 1)
  const myIds = toSubIds(myInterests)
  const mine = myIds.map((sub) => ({ sub, n: n.get(sub) ?? 0 }))
  const rare = [...n.entries()]
    .filter(([id]) => !myIds.includes(id) && (COUNT.get(id) ?? 9999) < RARITY.rare)
    .sort((a, b) => (COUNT.get(a[0]) ?? 0) - (COUNT.get(b[0]) ?? 0))
    .slice(0, 4)
    .map(([sub, k]) => ({ sub, n: k }))
  return { mine, rare }
}
