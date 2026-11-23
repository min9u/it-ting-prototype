/*
 * 관심사 이펙트 켜고 끄기 (docs/interest-effects.md, 2026-11-17 실험)
 * - 아티팩트에서는 주소를 못 바꾸므로 화면의 "✨ 이펙트" 패널(components/FxPanel.tsx)로만 바꿈
 * - 처음에는 모두 꺼짐 (2026-11-18 main 에 합칠 때 사용자 요청: "처음 들어갔을 때 이펙트는 다 꺼 주고, 이펙트 버튼을 눌러서 켤 수 있게").
 *   실험 아티팩트 1~2차 때는 추천 묶음이 기본이었음. 선택은 localStorage 에 기억 (막혀 있으면 이 탭에서만)
 * - 장면은 다시 만들지 않음: 이펙트 쪽(three/interestFx)이 구독해서 그리는 것만 바꿈
 * - 측정용 주소 손잡이: ?fx=0 (모두 끔) · ?fx=all (모두 켬) · ?fx=rec (추천). 저장값보다 먼저
 */

export type FxArea = 'room' | 'field'
export type FxId =
  | 'r_particles' | 'r_card' | 'r_shared' | 'r_rare' | 'r_beam'
  // 2차 (2026-11-17 저녁)
  | 'r_summary' | 'r_rollcall' | 'r_poke' | 'r_notice' | 'r_greet' | 'r_talk'
  | 'f_bubble' | 'f_smoke' | 'f_shared' | 'f_rare' | 'f_expand' | 'f_online' | 'f_edge' | 'f_minimap'
  | 'f_lantern' | 'f_radar' | 'f_zones' | 'f_mapheart'

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
  // 땅굴: 한눈에 보는 것 → 가구에서 피어나는 것 → 만지면 반응하는 것 → 분위기 순
  { id: 'r_summary', area: 'room', name: '관심사 한 줄 요약', desc: '장면 위에 이 땅굴의 관심사 줄 (나와 겹치는 것 ♥ · 가장 드문 것 ✦ 먼저) + "나와 N개 겹쳐요". 하나에 마우스를 올리면 그 가구에 불이 들어옴', aims: [1, 2, 3], rec: true },
  { id: 'r_rollcall', area: 'room', name: '입장 이름표', desc: '들어오면 관심사 가구마다 "음악 · 피아노" 이름표가 차례로 퐁 떴다가 사라짐 (요약 줄 제목에 마우스를 올리면 다시)', aims: [1, 3], rec: true },
  { id: 'r_particles', area: 'room', name: '관심사 숨결', desc: '관심사 가구에서 그 관심사다운 작은 입자가 피어남 (음표·잎·픽셀·김·불티·팝콘·발자국 …)', aims: [1, 3], rec: true },
  { id: 'r_card', area: 'room', name: '관심사 카드', desc: '가구에 마우스를 올리면 관심사 이름 · 고른 사람 수 · 드문 정도 · 말 걸기 한마디', aims: [1, 2, 3], rec: true },
  { id: 'r_shared', area: 'room', name: '나와 같은 관심사', desc: '나도 고른 관심사 가구가 따뜻하게 빛나고 하트가 떠오름 + "♥ 나도 캠핑" 배지', aims: [1, 2], rec: true, note: '남의 땅굴에서만' },
  { id: 'r_rare', area: 'room', name: '가장 드문 관심사', desc: '이 방에서 가장 드문 관심사 가구에 반짝이와 "✦ 다도 · 드문 취미" 배지 (아주 드물면 무지개)', aims: [3], rec: true },
  { id: 'r_poke', area: 'room', name: '누르면 관심사 톡', desc: '관심사 가구를 누르면 그 관심사 입자가 한 움큼 터짐 (피아노 → 음표, 이젤 → 물감 …)', aims: [1], rec: true },
  { id: 'r_greet', area: 'room', name: '인사하면 겹치는 관심사', desc: '👋 인사하면 두 두더지 사이로 겹치는 관심사가 튀어 오르고 "캠핑 이야기 해 볼까요?" (겹치는 게 없으면 집주인의 가장 드문 관심사)', aims: [1, 2], rec: true, note: '남의 땅굴에서만' },
  { id: 'r_talk', area: 'room', name: '말 걸어도 돼요 반딧불', desc: '집주인이 "말 걸어도 돼요"로 두면 곁에 반딧불, "방명록부터 천천히"면 작은 달 (집주인 설정은 아직 목 데이터)', aims: [2], rec: true, note: '남의 땅굴에서만' },
  { id: 'r_notice', area: 'room', name: '두더지가 알아챔', desc: '내 두더지가 관심사 가구 곁을 지나가면 머리 위에 "!" 와 그 관심사 이름이 퐁', aims: [1, 3], rec: false },
  { id: 'r_beam', area: 'room', name: '대표 관심사 빛줄기', desc: '천장 구멍 빛줄기와 떠다니는 먼지를 대표 관심사(맨 앞) 색으로 물들임', aims: [1], rec: false },
  // 탐색 들판
  { id: 'f_bubble', area: 'field', name: '대표 관심사 말풍선', desc: '구멍마다 대표 관심사 아이콘 말풍선 (멀리서도 한눈에)', aims: [1, 3], rec: true },
  { id: 'f_edge', area: 'field', name: '옆 땅굴 이정표', desc: '화면 밖 옆 구멍(약 10m 안)의 관심사를 화면 가장자리에 화살표·이름과 함께 → 어느 쪽으로 갈지 고르기 쉬움', aims: [1, 2, 3], rec: true },
  { id: 'f_expand', area: 'field', name: '가까이 가면 펼쳐짐', desc: '두더지 가까운 땅굴은 말풍선이 관심사 3개로 펼쳐지고 첫 관심사는 이름까지 (겹치는 것·드문 것 먼저)', aims: [1, 3], rec: true },
  { id: 'f_lantern', area: 'field', name: '관심사 등불', desc: '"🏮 관심사 등불"에서 관심사 하나를 고르면 그 관심사 땅굴에만 등불이 켜지고 나머지는 흐려짐. 화면 밖 땅굴도 이정표로, 미니맵에서도', aims: [3], rec: true },
  { id: 'f_shared', area: 'field', name: '겹치는 관심사 고리', desc: '나와 겹치는 관심사가 있는 구멍에 고리가 맥박치듯 퍼짐 (겹칠수록 여러 겹) + ♥ 개수', aims: [1, 2], rec: true },
  { id: 'f_radar', area: 'field', name: '잘 맞는 이웃 신호', desc: '이 들판에서 나와 가장 잘 맞는 이웃(겹치는 관심사가 많고 드물수록) 쪽 화면 가장자리에서 몇 초마다 신호가 퍼짐', aims: [1, 3], rec: true },
  { id: 'f_rare', area: 'field', name: '드문 관심사 반짝', desc: '드문 관심사를 가진 땅굴 위에 금빛 별 (아주 드물면 무지개)', aims: [3], rec: true },
  { id: 'f_online', area: 'field', name: '접속 중이면 활발', desc: '접속 중인 땅굴은 말풍선이 통통 튀고 초록 점 · 연기가 더 많이', aims: [2], rec: true },
  { id: 'f_zones', area: 'field', name: '동네 이름표', desc: '구역마다 유난히 많이 모인 관심사로 "음악 동네" 같은 이름 → 구역에 들어설 때 위에 띠, 미니맵에도 이름', aims: [3], rec: true },
  { id: 'f_minimap', area: 'field', name: '미니맵 관심사 색', desc: '미니맵의 땅굴 점을 대표 관심사 색으로 → 마을 전체에서 어디에 어떤 취미가 모였는지 한눈에', aims: [3], rec: true },
  { id: 'f_mapheart', area: 'field', name: '미니맵 ♥', desc: '미니맵에서 나와 겹치는 관심사가 있는 땅굴에 작은 하트 → 어느 쪽으로 가면 될지 바로', aims: [1, 3], rec: true },
  { id: 'f_smoke', area: 'field', name: '관심사 연기', desc: '구멍에서 대표 관심사 색 연기가 피어오름 (가까운 몇 개만 움직이고 먼 곳은 멈춘 연기)', aims: [3], rec: false },
]

export const AIM_LABEL: Record<1 | 2 | 3, string> = { 1: '말 걸 거리', 2: '내향인도 편하게', 3: '니치 찾기' }

type FxState = Record<FxId, boolean>
const KEY = 'digul.fx.v1'
/** 처음 들어왔을 때 (저장값 없음): 모두 꺼짐 */
const offState = (): FxState => Object.fromEntries(FX_DEFS.map((d) => [d.id, false])) as FxState

const forced = (): 'none' | 'all' | 'rec' | null => {
  try {
    const v = (location.search + location.hash).match(/[?&]fx=(\w+)/)?.[1]
    return v === '0' || v === 'none' ? 'none' : v === 'all' ? 'all' : v === 'rec' ? 'rec' : null
  } catch { return null }
}

/**
 * 저장값 + 기본값. 저장값에 없는 이펙트(나중에 새로 생긴 것)는 기본값(꺼짐)으로 채움 → 처음 들어온 사람과 같은 규칙.
 * 없어진 이펙트 키·잘못된 값은 버림
 */
export function mergeSaved(raw: string | null): FxState {
  const base = offState()
  if (!raw) return base
  try {
    const saved = JSON.parse(raw) as Record<string, unknown>
    for (const d of FX_DEFS) if (typeof saved?.[d.id] === 'boolean') base[d.id] = saved[d.id] as boolean
  } catch { /* 깨진 값 → 기본 */ }
  return base
}

const read = (): FxState => {
  const f = forced()
  if (f) return Object.fromEntries(FX_DEFS.map((d) => [d.id, f === 'all' ? true : f === 'rec' ? d.rec : false])) as FxState
  try { return mergeSaved(localStorage.getItem(KEY)) } catch { /* 저장소 없음 */ }
  return offState()
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

/**
 * 관심사 등불 (f_lantern): 지금 고른 관심사 (세부 관심사 id, 없으면 null). 탐색 들판·미니맵이 같이 봄.
 * 저장하지 않음 (탭 안에서만, 땅굴에 들어갔다 나와도 그대로)
 */
let lantern: string | null = null
export const getLantern = () => (state.f_lantern ? lantern : null)
export function setLantern(sub: string | null) {
  if (sub === lantern) return
  lantern = sub
  version++
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
