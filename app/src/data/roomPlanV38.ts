/**
 * 땅굴 방 배치 규칙 v3.8 (3D 핸드오프 v3.8 PLACEMENT_v3_8.md 2 · 3 · 5번). 순수 함수 — 아직 화면은 안 씀
 * (2-2 에서 planRoom 이 이걸 부름). 계획: docs/room-interest-v3-8-plan.md 2 · 4단계
 *
 * 입력: 소분류 id (고른 순서) + 소분류마다 고른 단어(없으면 첫 단어, data/interestWords.ts defaultWord)
 * 고른 단어와 자리 (2026-11-22, 꾸미기 가구 탭에서 한 관심사를 바꿔도 다른 관심사는 그대로):
 *  1 기준 배치: 모든 소분류를 **맨 앞 단어로** 아래 규칙대로 놓음 (고른 게 없을 때의 방 = 디자이너 규칙 그대로)
 *  2 예약: 소분류마다 바꿔 고를 수 있는 다른 단어의 자리를 미리 잡아 둠. 같은 종류(작은 → 작은 · 큰 → 큰 · 벽 → 벽)이고 맞으면 기준 자리를 그대로,
 *     종류가 다르면 기준에서 안 쓰는 빈 칸을 소분류 순서 · 단어 순서대로 하나씩. 예약은 **무엇을 골랐는지와 상관없이** 정해짐
 *  3 선택: 고른 단어의 예약 자리(없으면 기준)를 꺼내 씀 → 한 소분류의 선택은 다른 소분류의 단어 · 자리를 바꾸지 못하고, 같은 (관심사, 선택)이면
 *     꾸미는 중 · 저장한 뒤 · 방문자 뷰가 모두 같은 방이 됨 (예전에는 고른 단어를 순서대로 넣어서 작은/큰/벽이 바뀌면 뒤의 소분류가 밀렸음)
 * 규칙
 *  - 소분류 하나 = 모델 하나. 기준 배치에서는 맨 앞 단어가 먼저, 자리가 없으면 같은 소분류의 다음 단어
 *  - 작은 → 선반 prop_slot_01~12 (비어 있는 칸, 고른 순서)
 *  - 큰(동물 아님) → 바닥 공용 20칸 중 **회전 없이** max_m(w, d, h) 안에 드는 빈칸 가운데 바닥 면적(w×d)이 가장 작은 칸
 *  - 벽 → 벽 공용 04 · 18 · 20 · 24 에서 같은 방식
 *  - 동물 짝(word.pet 있음) → 동물 pet_slot + 짝 prop_slot(5쌍) 중 빈 쌍. 같은 종 짝이 있으면 그 짝 먼저
 *  - 모델은 슬롯 회전(ry_deg) 그대로 놓음(여기서는 회전 안 다룸)
 * 낙하(5번): 바닥 공용은 모델 키 h 이상인 첫 max_h 줄의 mode · H · S · dust. 선반 · 벽 · 동물은 슬롯의 drop(pop)
 */
import bigRaw from './big_model_sizes_v3_8.json'
import slotsRaw from './slots.json'
import { defaultWord, wordsOfSub, type WordDef } from './interestWords'
import type { DropSpec, Size, Slot } from './roomPlan'

export const SLOTS_V38 = slotsRaw as unknown as Slot[]
/** 큰 · 벽 모델 23개의 크기 (동물 용품은 짝 자리라 여기 없음) */
export const BIG_SIZES = bigRaw as unknown as Record<string, { sub: string; word: string; size: string; w: number; d: number; h: number }>

const FLOOR_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'shared_big' && s.kind === 'floor')
const WALL_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'shared_big' && s.kind === 'wall')
const SHELF_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'prop' && s.kind === 'shelf').sort((a, b) => a.name.localeCompare(b.name))
/**
 * v3.8.1 작은 소품 자리: 바닥 5칸(20 → 21 → 22 → 13 → 14 순서). 원탁 위 2칸(23·24)은 안 씀. 선반은 번호가 앞선 빈 칸
 * 작은 소품 배정 순서(PLACEMENT_v3_8_1.md): 작은 단어를 고른 순서대로 세어 i = 1, 2, 3 …
 */
const FLOOR_PROP_SLOTS = ['prop_slot_20', 'prop_slot_21', 'prop_slot_22', 'prop_slot_13', 'prop_slot_14'].map((n) => SLOTS_V38.find((s) => s.name === n)!)
/** 원탁 위 칸(prop_slot_23·24)은 앱에서 쓰지 않음(2026-11-21 결정) → 원탁 자리는 바닥으로 */
export const SMALL_ORDER = ['shelf', 'shelf', 'floor', 'shelf', 'floor', 'shelf', 'floor', 'floor', 'shelf', 'floor'] as const
/** 자리 모델 배율: 바닥 칸 1.4배 · 원탁 칸 0.45배 (새 칸은 slot.model_scale, 13 · 14 는 small_prop_rule.model_scale) */
export const scaleOfSlot = (s: Slot) => s.model_scale ?? s.small_prop_rule?.model_scale ?? 1
const PET_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'pet')
const slotByName = (n: string) => SLOTS_V38.find((s) => s.name === n)

const area = (s: Slot) => s.max_m.w * s.max_m.d
/** 회전 없이 들어가는지 (w · d · h 모두 max_m 이하) */
export const fits = (m: Size, s: Slot) => m.w <= s.max_m.w + 1e-9 && m.d <= s.max_m.d + 1e-9 && m.h <= s.max_m.h + 1e-9

export interface Placed {
  /** 소분류 id */
  sub: string
  /** 놓인 단어(모델) */
  word: WordDef
  /** 모델이 놓이는 자리 (동물 짝이면 용품 자리 prop_slot) */
  slot: Slot
  /** 동물 짝이면 동물 자리 pet_slot */
  petSlot?: Slot
  kind: 'shelf' | 'floor_prop' | 'table_top' | 'floor' | 'wall' | 'pet'
  /** 작은 소품 모델 배율 (바닥 1.4 · 원탁 0.45, 그 밖 1) */
  scale: number
  /** 낙하 값 (공용 바닥은 키 단계별로 고른 값) */
  drop: DropSpec
}
export interface PlaceResult {
  placed: Placed[]
  /** 놓지 못한 소분류 (모든 단어가 자리 없음). 정상이면 빔 */
  unplaced: { sub: string; reason: string }[]
}

/** 바닥 공용 자리의 키 단계별 낙하 값: 모델 키 h 이상인 첫 max_h 줄. 줄이 없거나 단계가 모자라면 제자리 등장 */
export function dropByHeight(slot: Slot, h: number): DropSpec {
  const rows = slot.drop_by_height
  if (!rows?.length) return slot.drop
  const row = rows.find((r) => h <= r.max_h + 1e-9)
  if (!row) return { mode: 'pop', H: null, S: null, dust: slot.drop.dust ?? null }
  return { mode: row.mode, H: row.H ?? null, S: row.S ?? null, dust: row.dust ?? null }
}

/** 소분류의 단어를 시도할 순서: 고른 단어 → 나머지 단어 (원래 순서) */
export function wordOrder(sub: string, chosen?: string): WordDef[] {
  const words = wordsOfSub(sub)?.words ?? []
  const first = chosen ? words.find((w) => w.word === chosen) : defaultWord(sub)
  return first ? [first, ...words.filter((w) => w !== first)] : words
}

export function placeWords(subIds: readonly string[], choice: Readonly<Record<string, string>> = {}): PlaceResult {
  const used = new Set<string>()
  /** 지금까지 놓은 작은 소품 수 (배정 순서의 i - 1) */
  let smallN = 0
  const placed: Placed[] = []
  const unplaced: PlaceResult['unplaced'] = []
  // 같은 종의 짝은 그 동물에게 남겨 둠 (설치류 · 소동물처럼 짝이 없는 종이 남의 짝을 먼저 가져가지 않게)
  const wanted = new Set(subIds.flatMap((s) => wordOrder(s).filter((w) => w.pet).map((w) => w.pet!)))

  const freeBest = (list: Slot[], m: Size) =>
    list.filter((s) => !used.has(s.name) && fits(m, s)).sort((a, b) => area(a) - area(b) || a.name.localeCompare(b.name))[0]

  const tryWord = (sub: string, w: WordDef): Placed | null => {
    if (w.pet) {
      const pairs = PET_SLOTS.filter((p) => !used.has(p.name) && !used.has(p.pair_slot ?? ''))
      const same = pairs.find((p) => p.occupant === w.pet)
      const loose = pairs.find((p) => !wanted.has(p.occupant as string))
      const pick = same ?? loose ?? pairs[0]
      const prop = pick && slotByName(pick.pair_slot ?? '')
      if (!pick || !prop) return null
      used.add(pick.name); used.add(prop.name)
      return { sub, word: w, slot: prop, petSlot: pick, kind: 'pet', drop: prop.drop, scale: 1 }
    }
    if (w.size === '작은') {
      // v3.8.1: i 번째 작은 소품의 자리 종류(선반·원탁·바닥)를 표대로 고르고, 그 종류가 다 찼으면 빈 선반 → 남은 바닥·원탁
      const want = SMALL_ORDER[smallN] ?? 'shelf'
      const free = (list: Slot[]) => list.find((x) => !used.has(x.name))
      const s = free(want === 'floor' ? FLOOR_PROP_SLOTS : SHELF_SLOTS) ?? free(SHELF_SLOTS) ?? free(FLOOR_PROP_SLOTS)
      if (!s) return null
      used.add(s.name); smallN++
      const kind = s.kind === 'shelf' ? 'shelf' : s.kind === 'table_top' ? 'table_top' : 'floor_prop'
      return { sub, word: w, slot: s, kind, drop: s.drop, scale: scaleOfSlot(s) }
    }
    const m = BIG_SIZES[w.node]
    if (!m) return null
    const s = freeBest(w.size === '벽' ? WALL_SLOTS : FLOOR_SLOTS, m)
    if (!s) return null
    used.add(s.name)
    return { sub, word: w, slot: s, kind: w.size === '벽' ? 'wall' : 'floor', drop: w.size === '벽' ? s.drop : dropByHeight(s, m.h), scale: 1 }
  }

  // 1 기준 배치: 모든 소분류를 맨 앞 단어로 (고른 값과 상관없음)
  const base = new Map<string, Placed>()
  for (const sub of subIds) {
    const words = wordOrder(sub)
    let got: Placed | null = null
    for (const w of words) { got = tryWord(sub, w); if (got) break }
    if (got) base.set(sub, got)
    else unplaced.push({ sub, reason: words.length ? '자리가 없음' : '단어 없음' })
  }

  // 2 예약: 바꿔 고를 수 있는 다른 단어의 자리를 미리 잡음. 소분류 순서 · 단어 순서만으로 정해져서 고른 값에 영향받지 않음
  const alt = new Map<string, Map<string, Placed>>()
  const smallAt = (sub: string, w: WordDef, s: Slot): Placed => {
    const kind = s.kind === 'shelf' ? 'shelf' : s.kind === 'table_top' ? 'table_top' : 'floor_prop'
    return { sub, word: w, slot: s, kind, drop: s.drop, scale: scaleOfSlot(s) }
  }
  for (const sub of subIds) {
    const b = base.get(sub)
    if (!b) continue
    const mine = new Map<string, Placed>()
    alt.set(sub, mine)
    let smallSlot: Slot | null = null // 이 소분류의 작은 단어들이 같이 쓰는 빈 칸 (단어는 하나만 놓이므로)
    for (const w of wordsOfSub(sub)?.words ?? []) {
      if (w.word === b.word.word) continue
      let got: Placed | null = null
      if (w.pet) {
        got = tryWord(sub, w)
      } else if (w.size === '작은') {
        if (b.kind === 'shelf' || b.kind === 'floor_prop' || b.kind === 'table_top') got = { ...b, word: w } // 작은 → 작은: 기준 자리 그대로
        else {
          smallSlot ??= [...SHELF_SLOTS, ...FLOOR_PROP_SLOTS].find((x) => !used.has(x.name)) ?? null
          if (smallSlot) { used.add(smallSlot.name); got = smallAt(sub, w, smallSlot) }
          else got = null
        }
      } else {
        const m = BIG_SIZES[w.node]
        if (m) {
          const wall = w.size === '벽'
          if (b.kind === (wall ? 'wall' : 'floor') && fits(m, b.slot)) got = { ...b, word: w, drop: wall ? b.slot.drop : dropByHeight(b.slot, m.h) } // 큰 → 큰 · 벽 → 벽: 맞으면 기준 자리 그대로
          else {
            const s = freeBest(wall ? WALL_SLOTS : FLOOR_SLOTS, m)
            if (s) { used.add(s.name); got = { sub, word: w, slot: s, kind: wall ? 'wall' : 'floor', drop: wall ? s.drop : dropByHeight(s, m.h), scale: 1 } }
          }
        }
      }
      if (got) mine.set(w.word, got)
    }
  }

  // 3 선택: 고른 단어의 예약 자리를 씀. 모르는 단어 · 예약 못 한 단어(빈 칸이 없음)는 기준(맨 앞 단어) 그대로 — 다른 가구를 밀어내지 않음
  for (const sub of subIds) {
    const b = base.get(sub)
    if (!b) continue
    const want = choice[sub]
    placed.push((want && want !== b.word.word ? alt.get(sub)?.get(want) : undefined) ?? b)
  }
  return { placed, unplaced }
}
