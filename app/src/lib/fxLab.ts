/*
 * 관심사 이펙트 켜고 끄기 (docs/interest-effects.md, 2026-11-17 실험)
 * - 아티팩트에서는 주소를 못 바꾸므로 화면의 "✨ 이펙트" 패널(components/FxPanel.tsx)로만 바꿈
 * - 처음에는 추천 묶음. 선택은 localStorage 에 기억 (막혀 있으면 이 탭에서만)
 * - 장면은 다시 만들지 않음: 이펙트 쪽(three/interestFx)이 구독해서 그리는 것만 바꿈
 * - 측정용 주소 손잡이: ?fx=0 (모두 끔) · ?fx=all (모두 켬) · ?fx=rec (추천). 저장값보다 먼저
 */

export type FxArea = 'room' | 'field'
export type FxId =
  | 'r_particles' | 'r_card' | 'r_shared' | 'r_rare' | 'r_beam'
  | 'f_bubble' | 'f_smoke' | 'f_shared' | 'f_rare' | 'f_expand' | 'f_online' | 'f_edge'

export interface FxDef {
  id: FxId
  area: FxArea
  name: string
  desc: string
  /** 맞는 차별점: 1 말 걸 거리 · 2 내향인도 편하게 · 3 니치 취미 찾기 */
  aims: (1 | 2 | 3)[]
  /** 추천 묶음에 들어감 */
  rec: boolean
  /** 남의 땅굴에서만 보임 같은 조건 */
  note?: string
}

export const FX_DEFS: FxDef[] = [
  { id: 'r_particles', area: 'room', name: '관심사 숨결', desc: '관심사 가구에서 그 관심사다운 작은 입자가 피어남 (음표·잎·픽셀·김·불티·팝콘·발자국 …)', aims: [1, 3], rec: true },
  { id: 'r_card', area: 'room', name: '관심사 카드', desc: '가구에 마우스를 올리면 관심사 이름 · 고른 사람 수 · 드문 정도 · 말 걸기 한마디', aims: [1, 2, 3], rec: true },
  { id: 'r_shared', area: 'room', name: '나와 같은 관심사', desc: '나도 고른 관심사 가구가 따뜻하게 빛나고 하트가 떠오름', aims: [1, 2], rec: true, note: '남의 땅굴에서만' },
  { id: 'r_rare', area: 'room', name: '가장 드문 관심사', desc: '이 방에서 가장 드문 관심사 가구에 반짝이와 "드문 취미" 배지 (아주 드물면 무지개)', aims: [3], rec: true },
  { id: 'r_beam', area: 'room', name: '대표 관심사 빛줄기', desc: '천장 구멍 빛줄기와 떠다니는 먼지를 대표 관심사(맨 앞) 색으로 물들임', aims: [1], rec: false },
  { id: 'f_bubble', area: 'field', name: '대표 관심사 말풍선', desc: '구멍마다 대표 관심사 아이콘 말풍선 (멀리서도 한눈에)', aims: [1, 3], rec: true },
  { id: 'f_edge', area: 'field', name: '옆 땅굴 이정표', desc: '화면 밖 옆 구멍(약 10m 안)의 관심사를 화면 가장자리에 화살표·이름과 함께 → 어느 쪽으로 갈지 고르기 쉬움', aims: [1, 2, 3], rec: true },
  { id: 'f_expand', area: 'field', name: '가까이 가면 펼쳐짐', desc: '두더지 가까운 땅굴은 말풍선이 관심사 3개로 펼쳐짐 (겹치는 것·드문 것 먼저)', aims: [1, 3], rec: true },
  { id: 'f_shared', area: 'field', name: '겹치는 관심사 고리', desc: '나와 겹치는 관심사가 있는 구멍에 고리가 맥박치듯 퍼짐 (겹칠수록 여러 겹) + ♥ 개수', aims: [1, 2], rec: true },
  { id: 'f_rare', area: 'field', name: '드문 관심사 반짝', desc: '드문 관심사를 가진 땅굴 위에 금빛 별 (아주 드물면 무지개)', aims: [3], rec: true },
  { id: 'f_online', area: 'field', name: '접속 중이면 활발', desc: '접속 중인 땅굴은 말풍선이 통통 튀고 초록 점 · 연기가 더 많이', aims: [2], rec: true },
  { id: 'f_smoke', area: 'field', name: '관심사 연기', desc: '구멍에서 대표 관심사 색 연기가 피어오름 (가까운 몇 개만 움직이고 먼 곳은 멈춘 연기)', aims: [3], rec: false },
]

export const AIM_LABEL: Record<1 | 2 | 3, string> = { 1: '말 걸 거리', 2: '내향인도 편하게', 3: '니치 찾기' }

type FxState = Record<FxId, boolean>
const KEY = 'digul.fx.v1'
const recState = (): FxState => Object.fromEntries(FX_DEFS.map((d) => [d.id, d.rec])) as FxState

const forced = (): 'none' | 'all' | 'rec' | null => {
  try {
    const v = (location.search + location.hash).match(/[?&]fx=(\w+)/)?.[1]
    return v === '0' || v === 'none' ? 'none' : v === 'all' ? 'all' : v === 'rec' ? 'rec' : null
  } catch { return null }
}

const read = (): FxState => {
  const f = forced()
  if (f) return Object.fromEntries(FX_DEFS.map((d) => [d.id, f === 'all' ? true : f === 'rec' ? d.rec : false])) as FxState
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...recState(), ...(JSON.parse(raw) as Partial<FxState>) }
  } catch { /* 저장소 없음 */ }
  return recState()
}

let state = read()
let version = 0
const subs = new Set<() => void>()

export const getFx = () => state
export const fxOn = (id: FxId) => !!state[id]
export const fxVersion = () => version
export function subscribeFx(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } }
export function setFx(patch: Partial<FxState>) {
  state = { ...state, ...patch }
  version++
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 이 탭에서만 */ }
  subs.forEach((f) => f())
}
export type FxPreset = 'all' | 'rec' | 'none'
/** 한 영역(땅굴·탐색)의 이펙트를 묶음으로 */
export function applyPreset(area: FxArea, p: FxPreset) {
  setFx(Object.fromEntries(FX_DEFS.filter((d) => d.area === area).map((d) => [d.id, p === 'all' ? true : p === 'rec' ? d.rec : false])))
}
/** 지금 그 영역이 어떤 묶음과 같은지 (없으면 null = 직접 고름) */
export function presetOf(area: FxArea): FxPreset | null {
  const defs = FX_DEFS.filter((d) => d.area === area)
  if (defs.every((d) => state[d.id])) return 'all'
  if (defs.every((d) => !state[d.id])) return 'none'
  if (defs.every((d) => state[d.id] === d.rec)) return 'rec'
  return null
}
