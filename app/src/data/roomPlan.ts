/**
 * 고른 관심사 → 땅굴 가구 배치 계획 (3D 핸드오프 v3 HANDOFF_v3.md 2·3번, furniture_drop_spec.md 3·4번)
 * three.js 없이 계산만 함 → 온보딩 "땅굴 만들기" 목록과 3D 방(three/roomScene.ts)이 같은 결과를 씀.
 *
 * - 카테고리 가구: 고른 카테고리의 furniture_slots 전부 (슬롯 고정)
 * - 선반 소품: 선반 12칸 중 빈 칸, 그 카테고리 주 가구 슬롯에서 가까운 칸부터 (카테고리는 고른 순서, 안에서도 고른 순서)
 * - 바닥 소품(기타)·동물 용품: 행의 slot.name 고정. 동물 용품을 고르면 짝 동물(sub.pet)도 같이
 * - glb 가 null(status todo)이면 둥근 블록으로 대신 놓음 (built 가 되면 코드 변경 없이 모델로)
 * - 낙하 순서: 카테고리(세트)마다, 세트 안은 부피 큰 것부터 (반려동물은 동물 + 짝 용품을 같은 시각에, v3.4)
 * - 낙하 시간 (2026-11-12 사용자 요청 "2초 안에"): spec 4번(0.12초 간격 + 세트 사이 1.0초 쉼)은 10개 고르면 15초가 넘어서
 *   세트 안 0.12초·세트 사이 0.24초로 겹쳐 떨어뜨리고, 마지막 시작이 DROP_SPAN(1.0초)을 넘으면 전체를 그 안으로 줄임
 *   → 몇 개를 고르든 마지막 가구가 시작 후 DROP_SPAN + DROP_LEN(0.6) = 1.6초 안에 착지. 가구 하나의 곡선(0.6초)은 spec 그대로
 */
import catalogRaw from './furnitureCatalog.json'
import slotsRaw from './slots.json'
import { INTEREST_CATS, subOf, toSubIds } from './interests'

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
export interface Slot {
  name: string
  kind: string
  category: string | null
  pos_three: [number, number, number]
  ry_deg: number
  max_m: Size
  mount?: string
  drop: DropSpec
}

export const FURNITURE_CATALOG = catalogRaw as unknown as FurnitureRow[]
export const SLOTS = slotsRaw as unknown as Slot[]

const rowOf = (id: string) => FURNITURE_CATALOG.find((r) => r.id === id)
const slotOf = (name: string) => SLOTS.find((s) => s.name === name)
const dist = (a: Slot, b: Slot) => Math.hypot(a.pos_three[0] - b.pos_three[0], a.pos_three[2] - b.pos_three[2])
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

export const DROP_LEN = 0.6, DROP_GAP = 0.12, SET_GAP = 0.24
/** 마지막 가구가 떨어지기 시작하는 시각의 상한 (초). 넘으면 시간표 전체를 이 안으로 압축 */
export const DROP_SPAN = 1.0

/**
 * picks: 세부 관심사 id 또는 화면 이름 (고른 순서)
 * (꾸미기 가구 탭에서 고른 가구는 표시만 하고 방 배치는 바꾸지 않음, 2026-11-12 사용자 확인)
 */
export function planRoom(picksIn: string[]): RoomPlan {
  const picks = toSubIds(picksIn)
  const cats = [...new Set(picks.map((id) => subOf(id)!.category))]
  const shelf = SLOTS.filter((s) => s.kind === 'shelf')
  const used = new Set<string>()
  const bySet = new Map<string, Omit<PlannedItem, 'start'>[]>()
  const push = (c: string, row: FurnitureRow | undefined, slot: Slot | undefined, sub: string | null) => {
    if (!row || !slot || row.type === 'unused') return
    if (!bySet.has(c)) bySet.set(c, [])
    bySet.get(c)!.push({ row, slot, category: c, built: isBuilt(row), sub })
  }
  // 카테고리 가구 (슬롯 고정)
  for (const c of cats) {
    const cd = INTEREST_CATS.find((x) => x.id === c)!
    cd.furniture.forEach((fid, i) => push(c, rowOf(fid), slotOf(cd.furniture_slots[i]), null))
  }
  // 소품
  for (const id of picks) {
    const sub = subOf(id)!, prop = rowOf(sub.prop)
    if (!prop) continue
    if (sub.slot_kind === 'shelf') {
      const main = slotOf(INTEREST_CATS.find((x) => x.id === sub.category)!.furniture_slots[0])
      const free = shelf.filter((s) => !used.has(s.name))
        .sort((a, b) => (main ? dist(a, main) - dist(b, main) : 0) || a.name.localeCompare(b.name))
      if (!free[0]) continue
      used.add(free[0].name)
      push(sub.category, prop, free[0], id)
    } else {
      push(sub.category, prop, prop.slot?.name ? slotOf(prop.slot.name) : undefined, id)
      if (sub.pet) { const pet = rowOf(sub.pet); push(sub.category, pet, pet?.slot?.name ? slotOf(pet.slot.name) : undefined, id) }
    }
  }
  // 낙하 시간표
  const items: PlannedItem[] = []
  let start = 0
  for (const c of cats) {
    const set = bySet.get(c) ?? []
    if (!set.length) continue
    // 동물과 짝 용품은 같은 시각 (HANDOFF_v3_4 3번): 같은 세부 관심사의 pet·용품을 한 묶음으로, 묶음끼리 부피 큰 것부터 0.12초 간격
    const groups = new Map<string, Omit<PlannedItem, 'start'>[]>()
    set.forEach((it, i) => {
      const key = it.category === 'pet' && it.sub ? `pair:${it.sub}` : `one:${i}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(it)
    })
    const order = [...groups.values()].sort((a, b) => Math.max(...b.map((x) => vol(x.row))) - Math.max(...a.map((x) => vol(x.row))))
    order.forEach((g, i) => g.forEach((it) => items.push({ ...it, start: start + DROP_GAP * i })))
    start += DROP_GAP * (order.length - 1) + SET_GAP
  }
  // 몇 개를 고르든 DROP_SPAN 안에 다 시작하게 (간격 비율은 유지한 채 압축)
  const last = Math.max(0, ...items.map((it) => it.start))
  if (last > DROP_SPAN) for (const it of items) it.start *= DROP_SPAN / last
  return { picks, categories: cats, items, duration: items.length ? Math.min(last, DROP_SPAN) + DROP_LEN : 0 }
}

/** 둥근 블록 색 (HANDOFF_v3 3번 추천 팔레트, 무광) */
export const BLOCK_COLORS: Record<string, string> = {
  music: '#E8743B', photo: '#A8D4EE', nature: '#8CC56A', game: '#F5C452', craft: '#C98A5A', book: '#A86B45',
  science: '#A8D4EE', tea_coffee: '#F7E6C8', outdoor: '#8CC56A', movie: '#E8743B', pet: '#F7E6C8',
}
