/**
 * 두더지 꾸미기 액세서리 41개 (3D 핸드오프 v1.1 accessories_v1.glb, 규칙은 v2 accessories.md v1.2)
 * - 부위 4곳(머리·얼굴·목·손)마다 하나씩, 최대 4개
 * - 같이 못 끼는 조합: 등 리본 + 작은 캐리어 (하나를 끼면 다른 하나는 못 고름)
 * - 구분: 기본 / 관심사 전용 (레벨 잠금은 2026-11-12 제거: Figma 에 없음. 모두 바로 고를 수 있음)
 *   관심사 전용은 3D 핸드오프 v3 interest_catalog.json 카테고리의 accessories 로 정함 (glb 안 userData.interest 는 옛 값이라 안 씀)
 * - 아이콘: design/digul_3d_handoff_v1_1/icons (512px) → 160px WebP (assets/mole-items/)
 * - id = glb 노드 이름. 3D 착용은 src/three/moleDress.ts
 */
import none from '../assets/mole-items/none.png'
import { ACCESSORY_CATEGORY, categoriesOf } from './interests'

const ICONS = import.meta.glob<string>('../assets/mole-items/*.webp', { eager: true, query: '?url', import: 'default' })
const iconOf = (id: string) => ICONS[`../assets/mole-items/${id}.webp`] ?? none

export type MolePart = '머리' | '얼굴' | '목' | '손'
export const MOLE_PARTS: { part: MolePart; socket: string }[] = [
  { part: '머리', socket: 'socket_head' },
  { part: '얼굴', socket: 'socket_face' },
  { part: '목', socket: 'socket_neck' },
  { part: '손', socket: 'socket_hand_R' },
]
export const MAX_WORN = 4

export interface MoleItem {
  id: string
  name: string
  part: MolePart
  icon: string
  /** 관심사 전용: 이 카테고리 이름 (배지·안내 문구) */
  interest?: string
  /** 관심사 전용: 이 카테고리 id 의 세부 관심사를 하나라도 고르면 열림 */
  interestCat?: string
}

type Row = [id: string, name: string, part: MolePart]
const ROWS: Row[] = [
  // 머리 18
  ['hat_beret', '베레모', '머리'],
  ['hat_beanie', '비니', '머리'],
  ['hat_straw', '밀짚모자', '머리'],
  ['hair_tuft', '삐죽 머리털', '머리'],
  ['hair_thin_1', '얇은 한 가닥', '머리'],
  ['hat_party', '고깔모자', '머리'],
  ['hat_flower_pin', '꽃 핀', '머리'],
  ['hair_curl', '곱슬 앞머리', '머리'],
  ['hair_ponytail', '꽁지머리', '머리'],
  ['hair_ribbon', '리본 머리핀', '머리'],
  ['hair_thin_2', '얇은 두 가닥', '머리'],
  ['hat_crown', '작은 왕관', '머리'],
  ['hair_thin_3', '얇은 세 가닥', '머리'],
  ['hat_tiara', '하트 티아라', '머리'],
  ['headphones', '헤드폰', '머리'],
  ['headband_sport', '땀 밴드', '머리'],
  ['hat_chef', '요리사 모자', '머리'],
  ['hat_sprout', '새싹', '머리'],
  // 얼굴 6
  ['glasses_round', '동그란 안경', '얼굴'],
  ['glasses_sun', '선글라스', '얼굴'],
  ['glasses_heart', '하트 안경', '얼굴'],
  ['bandage', '볼 반창고', '얼굴'],
  ['glasses_star', '별 안경', '얼굴'],
  ['glasses_3d', '3D 안경', '얼굴'],
  // 목 5
  ['scarf_stripe', '줄무늬 목도리', '목'],
  ['bowtie', '나비넥타이', '목'],
  ['scarf_knit', '니트 목도리', '목'],
  ['ribbon_back', '등 리본', '목'],
  ['camera_neck', '목걸이 카메라', '목'],
  // 손 12
  ['prop_flower', '꽃 한 송이', '손'],
  ['prop_cup', '커피잔', '손'],
  ['prop_balloon', '풍선', '손'],
  ['prop_candy_star', '별 막대 사탕', '손'],
  ['prop_candy_heart', '하트 막대 사탕', '손'],
  ['prop_balloon_star', '별 풍선', '손'],
  ['prop_balloon_heart', '하트 풍선', '손'],
  ['prop_wand_heart', '하트 요술봉', '손'],
  ['prop_book', '작은 책', '손'],
  ['prop_gamepad', '게임패드', '손'],
  ['prop_palette', '물감 팔레트', '손'],
  ['prop_suitcase', '작은 캐리어', '손'],
]

export const MOLE_ITEMS: MoleItem[] = ROWS.map(([id, name, part]) => {
  const cat = ACCESSORY_CATEGORY[id]
  return { id, name, part, icon: iconOf(id), ...(cat ? { interest: cat.name_ko, interestCat: cat.id } : {}) }
})
export const NONE_ICON = none
export const itemOf = (id: string) => MOLE_ITEMS.find((x) => x.id === id)
export const partTotal = (part: MolePart) => MOLE_ITEMS.filter((x) => x.part === part).length

/** 같이 못 끼는 조합 (리본 꼬리가 캐리어를 뚫음) */
export const BLOCKED_PAIRS: [string, string][] = [['ribbon_back', 'prop_suitcase']]
export const blockedBy = (id: string, worn: string[]) =>
  BLOCKED_PAIRS.map(([a, b]) => (a === id ? b : b === id ? a : null)).find((x) => x && worn.includes(x)) ?? null

/** 잠금 이유. null 이면 고를 수 있음. picks(세부 관심사 이름 또는 id)가 없으면(관심사를 고르기 전, 온보딩 1단계) 관심사 아이템은 열어 둠 */
export function lockOf(item: MoleItem, o: { picks?: string[] } = {}): string | null {
  if (item.interestCat && o.picks && !categoriesOf(o.picks).includes(item.interestCat)) {
    return `'${item.interest}' 관심사를 하나라도 고르면 열려요`
  }
  return null
}

/** 부위별 착용 (없으면 null) */
export function wornByPart(worn: string[]) {
  const by: Record<MolePart, string | null> = { 머리: null, 얼굴: null, 목: null, 손: null }
  for (const id of worn) { const x = itemOf(id); if (x) by[x.part] = id }
  return by
}

/**
 * 동작 중 손 소품을 보일지 (accessories.md 2-2 숨김 규칙)
 * 인사·커피는 항상 숨김, 엉덩이 씰룩·굴 들어가기는 막대 사탕 + 니트 목도리일 때만 숨김
 */
export function handVisible(clipName: string, worn: string[]) {
  const by = wornByPart(worn)
  if (!by.손) return false
  if (clipName === 'mole_greet' || clipName === 'mole_drink') return false
  if ((clipName === 'mole_butt_wiggle' || clipName === 'mole_burrow_enter') && by.목 === 'scarf_knit' && (by.손 === 'prop_candy_star' || by.손 === 'prop_candy_heart')) return false
  return true
}

/** Figma 예시와 같은 기본 착용: 베레모 + 물감 팔레트 */
export const DEFAULT_WORN = ['hat_beret', 'prop_palette']

/*
 * 내 두더지가 지금 낀 것 (백엔드가 없어서 화면끼리 나누는 작은 저장소).
 * 내 땅굴에서 꾸미기를 저장하면 바뀌고, 탐색하기 밭의 두더지도 같은 것을 낌. 새로고침해도 이 탭 안에서는 유지 (sessionStorage).
 */
const WORN_KEY = 'digul.myWorn'
let myWorn: string[] | null = null
export function getMyWorn(): string[] {
  if (myWorn) return myWorn
  try { const v = JSON.parse(sessionStorage.getItem(WORN_KEY) ?? 'null'); if (Array.isArray(v)) return (myWorn = v.filter((x) => typeof x === 'string')) } catch { /* 저장소를 못 쓰면 기본값 */ }
  return (myWorn = DEFAULT_WORN)
}
export function setMyWorn(ids: string[]) {
  myWorn = ids
  try { sessionStorage.setItem(WORN_KEY, JSON.stringify(ids)) } catch { /* 무시 */ }
}
