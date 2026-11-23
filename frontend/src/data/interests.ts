/**
 * 관심사 (2026-11-18 확정본: 대분류 12 · 소분류 90 · 최대 10개) → docs/interest-tags-2026-11-18.md
 * - 분류(id·이름·순서·이모지)는 data/interestTags.ts 한 곳, 3D 가구·소품·전용 액세서리 연결은 data/interest3d.ts
 * - 예전(관심사 v2, 3D 핸드오프 v3 interest_catalog.json 카테고리 11 · 세부 65)은 더 이상 읽지 않음.
 *   예전 값으로 저장된 것은 migrateInterests 로 새 이름으로 옮김
 * 화면에 보이는 관심사 값은 소분류 이름(name_ko). 방 만들기·잠금 판단은 id 로 바꿔서 씀 (toSubIds).
 */
import catalogRaw from './furnitureCatalog.json'
import { LEGACY_SUBS, MAX_PICK, TAG_TREE } from './interestTags'
import { CATEGORY_3D, SUB_PROP } from './interest3d'
import type { Tone } from './types'

export { MAX_PICK } from './interestTags'

export interface InterestCategory {
  type: 'category'
  id: string
  name_ko: string
  order: number
  emoji: string
  tone: Tone
  /** 3D 세트 (벽지·블록 색, data/interest3d.ts) */
  kit: string
  /** 대분류 가구 id (첫 번째가 주 가구) */
  furniture: string[]
  /** 가구마다 놓일 자리 (카탈로그 행의 slot.name) */
  furniture_slots: string[]
  /** 맞는 3D 세트가 없어 빌려 쓰면 그 이유 (임시) */
  substitute?: string
  max_pick: number
}

export interface InterestSub {
  type: 'sub'
  id: string
  name_ko: string
  category: string
  /** 고르면 놓이는 소품 (furniture_catalog 의 id). 아직 맞는 모델이 없으면 null */
  prop: string | null
  /** 소품 자리 종류 (소품이 없으면 null) */
  slot_kind: 'shelf' | 'floor' | 'pet_floor' | null
  /** 짝 동물 (반려동물 용품이면) */
  pet: string | null
}

interface CatalogRow { id: string; slot?: { kind?: string; name?: string; paired_pet?: string } | null }
const CATALOG = catalogRaw as unknown as CatalogRow[]
const rowOf = (id: string | null | undefined) => (id ? CATALOG.find((r) => r.id === id) : undefined)

export const INTEREST_CATS: InterestCategory[] = TAG_TREE.map((c, i) => {
  const d = CATEGORY_3D[c.id] ?? { kit: c.id, furniture: [] }
  return {
    type: 'category', id: c.id, name_ko: c.name, order: i + 1, emoji: c.emoji, tone: c.tone, kit: d.kit,
    furniture: [...d.furniture], furniture_slots: d.furniture.map((f) => rowOf(f)?.slot?.name ?? ''),
    ...(d.substitute ? { substitute: d.substitute } : {}), max_pick: MAX_PICK,
  }
})
export const INTEREST_SUBS: InterestSub[] = TAG_TREE.flatMap((c) => c.subs.map(([id, name]): InterestSub => {
  const prop = SUB_PROP[id] ?? null
  const slot = rowOf(prop)?.slot
  const kind = slot?.kind === 'shelf' || slot?.kind === 'floor' || slot?.kind === 'pet_floor' ? slot.kind : null
  return { type: 'sub', id, name_ko: name, category: c.id, prop: kind ? prop : null, slot_kind: kind, pet: (kind && slot?.paired_pet) || null }
}))

const byId = new Map(INTEREST_SUBS.map((s) => [s.id, s]))
const byName = new Map(INTEREST_SUBS.map((s) => [s.name_ko, s]))

/** 소분류 (id 또는 화면 이름으로) */
export const subOf = (idOrName: string) => byId.get(idOrName) ?? byName.get(idOrName)
export const interestCatOf = (id: string) => INTEREST_CATS.find((c) => c.id === id)
export const subsIn = (catId: string) => INTEREST_SUBS.filter((s) => s.category === catId)

/** 화면 이름·id 목록 → 소분류 id (고른 순서, 중복·모르는 것 빼고, 최대 MAX_PICK) */
export function toSubIds(list: string[]): string[] {
  const out: string[] = []
  for (const x of list) {
    const s = subOf(x)
    if (s && !out.includes(s.id)) out.push(s.id)
  }
  return out.slice(0, MAX_PICK)
}

/** 고른 관심사에서 정해지는 대분류 (고른 순서) */
export function categoriesOf(list: string[]): string[] {
  return [...new Set(toSubIds(list).map((id) => byId.get(id)!.category))]
}

/* ---------- 예전 값 옮기기 (관심사 v2 → 2026-11-18 확정본) ---------- */
const LEGACY = new Map<string, string | null>(LEGACY_SUBS.flatMap(([oldId, oldName, next]) => [[oldId, next], [oldName, next]] as const))
/**
 * 예전 관심사 하나 → 새 소분류 id. 새 목록에 있는 값이면 그 id, 예전 값이면 옮긴 id, 버린 것·모르는 것은 null.
 * (새 id 와 예전 id 가 같은 글자인 것(camping·cat 등)은 새 쪽이 먼저)
 */
export function migrateSubId(v: string): string | null {
  const s = subOf(v)
  if (s) return s.id
  return LEGACY.get(v) ?? null
}
/**
 * 저장소에 남은 관심사 목록(화면 이름 또는 id, 예전 값 섞여도 됨) → 새 소분류 이름 목록.
 * 고른 순서 유지, 예전 둘이 새 하나로 합쳐지면 한 번만, 버린 것은 뺌, 최대 MAX_PICK
 */
export function migrateInterests(list: unknown[]): string[] {
  const out: string[] = []
  for (const x of list) {
    if (typeof x !== 'string') continue
    const id = migrateSubId(x)
    const name = id ? byId.get(id)?.name_ko : undefined
    if (name && !out.includes(name)) out.push(name)
  }
  return out.slice(0, MAX_PICK)
}

/*
 * 내가 고른 관심사 (백엔드가 없어서 화면끼리 나누는 작은 저장소, data/moleItems 의 착용과 같은 방식).
 * 온보딩 "관심사 확정"·내 정보 수정 저장 때 기록 → 내 땅굴이 그 관심사로 방을 만듦. 없으면 목 데이터(USERS.me)
 */
const PICKS_KEY = 'digul.myInterests'
/**
 * 메모리에도 들고 있음: 아티팩트(공유 링크)처럼 sessionStorage 가 막힌 곳에서는 저장이 조용히 실패해서
 * 온보딩에서 고른 관심사 대신 목 데이터 방이 나왔음 (2026-11-12 사용자 제보). 한 페이지 안 이동은 이 값으로 이어짐
 */
let myPicks: string[] | null = null
export function getMyInterests(fallback: string[]): string[] {
  if (myPicks) return myPicks
  try {
    const v = JSON.parse(sessionStorage.getItem(PICKS_KEY) ?? 'null')
    if (Array.isArray(v)) {
      // 2026-11-18 전에 저장된 예전 관심사(시티팝·레트로게임 …)는 새 이름으로 옮김. 남는 게 3개 미만이면 목 데이터로
      const next = migrateInterests(v)
      if (next.length >= 3) {
        if (next.join('|') !== v.join('|')) setMyInterests(next)
        return next
      }
      if (v.length) sessionStorage.removeItem(PICKS_KEY)
    }
  } catch { /* 저장소를 못 쓰면 목 데이터 */ }
  return fallback
}
export function setMyInterests(list: string[]) {
  myPicks = [...list]
  try { sessionStorage.setItem(PICKS_KEY, JSON.stringify(list)) } catch { /* 무시 */ }
}
