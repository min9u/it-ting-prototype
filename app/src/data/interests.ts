/**
 * 관심사 v2 (3D 핸드오프 v3, 2026-11-11): 카테고리 11 · 세부 관심사 65 · 최대 10개
 * 원본: design/digul_3d_handoff_v3/docs/interest_catalog.json → 복사본 ./interestCatalog.json
 * 이름·순서·가구·전용 액세서리는 모두 이 JSON 에서 읽음 (코드에 적지 않기, HANDOFF_v3 "먼저 할 일" 3번).
 * 화면에 보이는 관심사는 세부 관심사 이름(name_ko). 방 만들기·잠금 판단은 id 로 바꿔서 씀 (toSubIds).
 */
import raw from './interestCatalog.json'

export interface InterestCategory {
  type: 'category'
  id: string
  name_ko: string
  order: number
  /** 카테고리 가구 id (첫 번째가 주 가구) */
  furniture: string[]
  furniture_slots: string[]
  /** 이 카테고리를 하나라도 고르면 열리는 전용 액세서리 */
  accessories: string[]
  max_pick: number
}

export interface InterestSub {
  type: 'sub'
  id: string
  name_ko: string
  category: string
  /** 고르면 놓이는 소품 (furniture_catalog 의 id) */
  prop: string
  slot_kind: 'shelf' | 'floor' | 'pet_floor'
  pet: string | null
}

const ROWS = raw as unknown as (InterestCategory | InterestSub)[]

export const INTEREST_CATS: InterestCategory[] = ROWS.filter((r): r is InterestCategory => r.type === 'category').sort((a, b) => a.order - b.order)
export const INTEREST_SUBS: InterestSub[] = ROWS.filter((r): r is InterestSub => r.type === 'sub')
/** 고를 수 있는 세부 관심사 수 (카탈로그 max_pick, 지금 10) */
export const MAX_PICK = INTEREST_CATS[0]?.max_pick ?? 10

const byId = new Map(INTEREST_SUBS.map((s) => [s.id, s]))
const byName = new Map(INTEREST_SUBS.map((s) => [s.name_ko, s]))

/** 세부 관심사 (id 또는 화면 이름으로) */
export const subOf = (idOrName: string) => byId.get(idOrName) ?? byName.get(idOrName)
export const interestCatOf = (id: string) => INTEREST_CATS.find((c) => c.id === id)
export const subsIn = (catId: string) => INTEREST_SUBS.filter((s) => s.category === catId)

/** 화면 이름·id 목록 → 세부 관심사 id (고른 순서, 중복·모르는 것 빼고, 최대 MAX_PICK) */
export function toSubIds(list: string[]): string[] {
  const out: string[] = []
  for (const x of list) {
    const s = subOf(x)
    if (s && !out.includes(s.id)) out.push(s.id)
  }
  return out.slice(0, MAX_PICK)
}

/** 고른 관심사에서 정해지는 카테고리 (고른 순서) */
export function categoriesOf(list: string[]): string[] {
  return [...new Set(toSubIds(list).map((id) => byId.get(id)!.category))]
}

/** 액세서리 id → 그 액세서리를 여는 카테고리 (interest_catalog 의 accessories) */
export const ACCESSORY_CATEGORY: Record<string, InterestCategory> = Object.fromEntries(
  INTEREST_CATS.flatMap((c) => c.accessories.map((a) => [a, c] as const)),
)

/*
 * 내가 고른 관심사 (백엔드가 없어서 화면끼리 나누는 작은 저장소, data/moleItems 의 착용과 같은 방식).
 * 온보딩 "관심사 확정"·내 정보 수정 저장 때 기록 → 내 땅굴이 그 관심사로 방을 만듦. 없으면 목 데이터(USERS.me)
 */
const PICKS_KEY = 'digul.myInterests'
export function getMyInterests(fallback: string[]): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(PICKS_KEY) ?? 'null')
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  } catch { /* 저장소를 못 쓰면 목 데이터 */ }
  return fallback
}
export function setMyInterests(list: string[]) {
  try { sessionStorage.setItem(PICKS_KEY, JSON.stringify(list)) } catch { /* 무시 */ }
}
