/**
 * 고른 관심사 → 땅굴 가구 배치 계획 (3D 핸드오프 v3.8 PLACEMENT_v3_8.md, 2026-11-21 새 규칙으로 바꿈)
 * three.js 없이 계산만 함 → 온보딩 "땅굴 만들기" 목록과 3D 방(three/roomScene.ts)이 같은 결과를 씀.
 *
 * 배치는 data/roomPlanV38.ts 가 정함 (소분류 하나 = 모델 하나: 작은 → 선반, 큰 → 바닥 공용 20칸, 벽 → 벽 공용 4칸, 동물 → 짝 자리).
 * 여기서는 그 결과를 방이 읽는 모양(PlannedItem: 카탈로그 행 + 슬롯)으로 바꾸고 낙하 시간표를 짬.
 * - 낙하 순서: 부피 큰 것부터 0.12초 간격 (동물과 짝 용품은 같은 시각, v3.4)
 * - 낙하 시간 (2026-11-12 사용자 요청 "2초 안에"): 마지막 시작이 DROP_SPAN(1.0초)을 넘으면 전체를 그 안으로 줄임
 *   → 몇 개를 고르든 마지막 가구가 시작 후 DROP_SPAN + DROP_LEN(0.6) = 1.6초 안에 착지. 가구 하나의 곡선(0.6초)은 spec 그대로
 * - 카탈로그(furnitureCatalog.json)에는 기본 가구 · 장식 · 선반 · 우체통만 있고, 관심사 모델은 data/interestWords.ts 의 단어 행을 여기서 카탈로그 행으로 바꿈
 */
import catalogRaw from './furnitureCatalog.json'
import slotsRaw from './slots.json'
import { placeWords, BIG_SIZES, type Placed } from './roomPlanV38'
import { wordModelFile, wordsOfSub } from './interestWords'
import { subOf, toSubIds } from './interests'

export interface Size { w: number; d: number; h: number }
export interface FurnitureRow {
  id: string
  /** glb 안 노드 이름 */
  node: string
  name_ko: string
  type: 'base' | 'deco' | 'category_furniture' | 'sub_prop' | 'pet' | 'deco_attached' | 'unused'
  category: string | null
  sub_interest?: string | null
  glb: string | null
  /** 웹용 Draco + WebP 파일 이름 */
  glb_compressed?: string
  size_m: Size
  slot: { kind: string; name?: string; paired_pet?: string } | null
  sit_point: string | null
  /** 앉는 동작 묶음 (v3.3): 'cushion' | 'beanbag'. glb sit point 노드 extras 에도 같은 값 */
  sit_clip_set?: string
  /** 선반 소품을 칸 위치에서 칸 앞쪽(방 쪽)으로 옮길 거리 m (v3.2, 돔에 안 닿게). 없으면 0 */
  shelf_offset_forward_m?: number
  status: 'built' | 'todo' | 'unused'
  parent?: string
}
export interface DropSpec { mode: 'fall' | 'pop'; H: number | null; S: number | null; dust: number | null }
/** v3.8: 공용 자리는 모델 키 이상인 첫 max_h 줄의 값을 씀 (PLACEMENT_v3_8.md 5번). 4단계에서 연결 */
export interface DropByHeight extends DropSpec { max_h: number }
export interface Slot {
  name: string
  kind: string
  category: string | null
  pos_three: [number, number, number]
  ry_deg: number
  max_m: Size
  mount?: string
  drop: DropSpec
  /** v3.8 slots_v3_8.json: 'shared_big'(바닥 · 벽 공용) | 'prop'(선반 · 동물 용품) | 'pet' | 'fixed'(우체통). 옛 slots.json 에는 없음 */
  slot_type?: 'shared_big' | 'prop' | 'pet' | 'fixed'
  /** v3.8: 공용 자리의 키 단계별 낙하 값 */
  drop_by_height?: DropByHeight[]
  /** v3.8: 동물 자리는 동물 이름(cat 등), 용품 자리와 짝(pair_slot) */
  pet?: string
  pair_slot?: string
  /** v3.8.1: 작은 소품을 이 배율로 키워(바닥 1.4) 줄여(원탁 0.45) 놓음. max_m 은 배율을 곱한 뒤의 상자 */
  model_scale?: number
  /** v3.8.1: 되살린 바닥 자리(prop_slot_13·14)의 배율 */
  small_prop_rule?: { used_in_v3_8_1?: boolean; model_scale: number }
  /** v3.8: 자리에 원래 놓이던 것(동물은 pet_cat 등, 용품은 cat_bed 등). 같은 종 짝 고르기에 씀 */
  occupant?: string | null
}

export const FURNITURE_CATALOG = catalogRaw as unknown as FurnitureRow[]
export const SLOTS = slotsRaw as unknown as Slot[]

const vol = (r: FurnitureRow) => r.size_m.w * r.size_m.d * r.size_m.h

/** 이 행을 진짜 모델로 놓을 수 있는지 (아니면 블록) */
export const isBuilt = (r: FurnitureRow) => r.status === 'built' && !!(r.glb_compressed ?? r.glb)

export interface PlannedItem {
  row: FurnitureRow
  slot: Slot
  /** 이 세트(카테고리) */
  category: string
  /** 낙하 시작 (방 연출 시작 기준 초) */
  start: number
  built: boolean
  /** 고른 세부 관심사 (카테고리 가구면 null) */
  sub: string | null
}

export interface RoomPlan {
  picks: string[]
  categories: string[]
  items: PlannedItem[]
  /** 낙하 연출 전체 길이 (초) */
  duration: number
}

export const DROP_LEN = 0.6, DROP_GAP = 0.12
/** 마지막 가구가 떨어지기 시작하는 시각의 상한 (초). 넘으면 시간표 전체를 이 안으로 압축 */
export const DROP_SPAN = 1.0

/** 단어 하나 → 방이 읽는 카탈로그 행 (모델은 대분류 glb 안 node 이름으로 찾음) */
function rowOfWord(p: Placed, asPet: boolean): FurnitureRow {
  const w = p.word
  const jsonCat = wordsOfSub(p.sub)!.jsonCategoryId
  const slot = asPet ? p.petSlot! : p.slot
  const size = asPet ? { w: 0.3, d: 0.3, h: 0.3 } : BIG_SIZES[w.node] ? { w: BIG_SIZES[w.node].w, d: BIG_SIZES[w.node].d, h: BIG_SIZES[w.node].h } : { ...slot.max_m }
  const node = asPet ? w.pet! : w.node
  return {
    id: node, node, name_ko: asPet ? w.word : w.name,
    type: asPet ? 'pet' : p.kind === 'floor' || p.kind === 'wall' ? 'category_furniture' : 'sub_prop',
    category: null, sub_interest: p.sub, glb: null, glb_compressed: wordModelFile(jsonCat), size_m: size,
    slot: { kind: slot.kind, name: slot.name }, sit_point: null, status: 'built',
  }
}

/**
 * picks: 세부 관심사 id 또는 화면 이름 (고른 순서)
 * choice: 소분류마다 고른 단어 (없으면 첫 단어, 꾸미기 소품 탭). 모르는 값은 첫 단어로
 */
export function planRoom(picksIn: string[], choice: Record<string, string> = {}): RoomPlan {
  const picks = toSubIds(picksIn)
  const cats = [...new Set(picks.map((id) => subOf(id)!.category))]
  const { placed } = placeWords(picks, choice)
  const base: Omit<PlannedItem, 'start'>[] = []
  const groups: Omit<PlannedItem, 'start'>[][] = []
  for (const p of placed) {
    const category = subOf(p.sub)!.category
    // 낙하 값은 자리마다 다름(공용 바닥은 모델 키 단계별) → 슬롯 복사본에 넣어 둠
    const item = (row: FurnitureRow, slot: Slot): Omit<PlannedItem, 'start'> => ({ row, slot: { ...slot, drop: p.drop, model_scale: p.scale }, category, built: true, sub: p.sub })
    const g = [item(rowOfWord(p, false), p.slot)]
    if (p.petSlot) g.push(item(rowOfWord(p, true), p.petSlot))
    groups.push(g)
    base.push(...g)
  }
  // 동물과 짝 용품은 같은 시각 (HANDOFF_v3_4 3번), 묶음끼리 부피 큰 것부터 0.12초 간격
  const order = [...groups].sort((a, b) => Math.max(...b.map((x) => vol(x.row))) - Math.max(...a.map((x) => vol(x.row))))
  const items: PlannedItem[] = []
  order.forEach((g, i) => g.forEach((it) => items.push({ ...it, start: DROP_GAP * i })))
  // 몇 개를 고르든 DROP_SPAN 안에 다 시작하게 (간격 비율은 유지한 채 압축)
  const last = Math.max(0, ...items.map((it) => it.start))
  if (last > DROP_SPAN) for (const it of items) it.start *= DROP_SPAN / last
  return { picks, categories: cats, items, duration: items.length ? Math.min(last, DROP_SPAN) + DROP_LEN : 0 }
}

/**
 * 둥근 블록 색 (HANDOFF_v3 3번 추천 팔레트, 무광). 모델이 없는 가구 자리 · 꾸미기 가구 탭 썸네일.
 * 2026-11-18 확정본 대분류 12개 (빌려 쓰는 3D 세트의 색을 따름)
 */
export const BLOCK_COLORS: Record<string, string> = {
  food: '#F7E6C8', sports: '#8CC56A', culture: '#E8743B', game: '#F5C452', music_dance: '#E8743B', outdoor: '#8CC56A',
  language_selfdev: '#A86B45', book: '#A86B45', photo_video: '#A8D4EE', art_craft: '#C98A5A', fandom_collect: '#A8D4EE', pet_plant: '#8CC56A',
}

const keyOf = (it: PlannedItem) => `${it.slot.name}|${it.row.id}`
/**
 * 방 배치가 바뀔 때(관심사 변경 · 소품 탭에서 단어 변경) 지금 방(prev)과 새 계획(next)을 견줌 (같은 자리 + 같은 모델이면 그대로)
 * - removed: 빠질 것 (빠진 관심사의 소품, 또는 단어를 바꿔 다른 것으로 대체된 것)
 * - drop: 새로 들어온 관심사의 소품 → 낙하 연출 (이미 방에 있던 관심사가 아닌 것)
 * - pop: 이미 있던 관심사인데 달라진 것 (단어만 바꿈, 자리가 밀림) → 제자리 등장
 */
export function diffPlans(prev: PlannedItem[], next: PlannedItem[]) {
  const nextKeys = new Set(next.map(keyOf)), prevKeys = new Set(prev.map(keyOf))
  const oldSubs = new Set(prev.map((i) => i.sub).filter((x): x is string => !!x))
  const added = next.filter((i) => !prevKeys.has(keyOf(i)))
  const isNew = (i: PlannedItem) => !!i.sub && !oldSubs.has(i.sub)
  return {
    removed: prev.filter((i) => !nextKeys.has(keyOf(i))),
    drop: added.filter(isNew),
    pop: added.filter((i) => !isNew(i)),
  }
}
