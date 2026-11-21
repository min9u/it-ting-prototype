/**
 * 땅굴 방 배치 규칙 v3.8 (3D 핸드오프 v3.8 PLACEMENT_v3_8.md 2 · 3 · 5번). 순수 함수 — 아직 화면은 안 씀
 * (2-2 에서 planRoom 이 이걸 부름). 계획: docs/room-interest-v3-8-plan.md 2 · 4단계
 *
 * 입력: 소분류 id (고른 순서) + 소분류마다 고른 단어(없으면 첫 단어, data/interestWords.ts defaultWord)
 * 규칙
 *  - 소분류 하나 = 모델 하나. 고른 단어가 먼저, 자리가 없으면 같은 소분류의 다음 단어
 *  - 작은 → 선반 prop_slot_01~12 (비어 있는 칸, 고른 순서)
 *  - 큰(동물 아님) → 바닥 공용 20칸 중 **회전 없이** max_m(w, d, h) 안에 드는 빈칸 가운데 바닥 면적(w×d)이 가장 작은 칸
 *  - 벽 → 벽 공용 04 · 18 · 20 · 24 에서 같은 방식
 *  - 동물 짝(word.pet 있음) → 동물 pet_slot + 짝 prop_slot(5쌍) 중 빈 쌍. 같은 종 짝이 있으면 그 짝 먼저
 *  - 모델은 슬롯 회전(ry_deg) 그대로 놓음(여기서는 회전 안 다룸)
 * 낙하(5번): 바닥 공용은 모델 키 h 이상인 첫 max_h 줄의 mode · H · S · dust. 선반 · 벽 · 동물은 슬롯의 drop(pop)
 */
import bigRaw from './big_model_sizes_v3_8.json'
import slotsRaw from './slots_v3_8.json'
import { defaultWord, wordsOfSub, type WordDef } from './interestWords'
import type { DropSpec, Size, Slot } from './roomPlan'

export const SLOTS_V38 = slotsRaw as unknown as Slot[]
/** 큰 · 벽 모델 23개의 크기 (동물 용품은 짝 자리라 여기 없음) */
export const BIG_SIZES = bigRaw as unknown as Record<string, { sub: string; word: string; size: string; w: number; d: number; h: number }>

const FLOOR_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'shared_big' && s.kind === 'floor')
const WALL_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'shared_big' && s.kind === 'wall')
const SHELF_SLOTS = SLOTS_V38.filter((s) => s.slot_type === 'prop' && s.kind === 'shelf').sort((a, b) => a.name.localeCompare(b.name))
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
  kind: 'shelf' | 'floor' | 'wall' | 'pet'
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
  const placed: Placed[] = []
  const unplaced: PlaceResult['unplaced'] = []
  // 같은 종의 짝은 그 동물에게 남겨 둠 (설치류 · 소동물처럼 짝이 없는 종이 남의 짝을 먼저 가져가지 않게)
  const wanted = new Set(subIds.flatMap((s) => wordOrder(s, choice[s]).filter((w) => w.pet).map((w) => w.pet!)))

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
      return { sub, word: w, slot: prop, petSlot: pick, kind: 'pet', drop: prop.drop }
    }
    if (w.size === '작은') {
      const s = SHELF_SLOTS.find((x) => !used.has(x.name))
      if (!s) return null
      used.add(s.name)
      return { sub, word: w, slot: s, kind: 'shelf', drop: s.drop }
    }
    const m = BIG_SIZES[w.node]
    if (!m) return null
    const s = freeBest(w.size === '벽' ? WALL_SLOTS : FLOOR_SLOTS, m)
    if (!s) return null
    used.add(s.name)
    return { sub, word: w, slot: s, kind: w.size === '벽' ? 'wall' : 'floor', drop: w.size === '벽' ? s.drop : dropByHeight(s, m.h) }
  }

  for (const sub of subIds) {
    const words = wordOrder(sub, choice[sub])
    let got: Placed | null = null
    for (const w of words) { got = tryWord(sub, w); if (got) break }
    if (got) placed.push(got)
    else unplaced.push({ sub, reason: words.length ? '자리가 없음' : '단어 없음' })
  }
  return { placed, unplaced }
}
