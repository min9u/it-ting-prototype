/*
 * 저사양 실험실 (docs/gpu-lowspec-ideas.md). 그래픽 가속이 꺼진 PC용 아이디어를 하나씩 켜고 끄며 비교한다.
 * - 저사양(low) 품질일 때만 적용. GPU(high)는 그대로 (단, "모드 강제"로 저사양을 켜서 GPU PC에서도 시험 가능)
 * - 선택은 localStorage 에 저장 (막혀 있으면 이 탭에서만)
 * - 바뀌면 3D 장면을 새로 만든다 (SceneCanvas 가 version 을 deps 에 넣음)
 */

export interface LabState {
  /** 모드 강제: auto = 감지대로, low = 저사양 강제, high = 고사양 강제 */
  force: 'auto' | 'low' | 'high'
  /** A 탐색하기: 밭은 한 번 그려 두고 두더지만 */
  A: boolean
  /** B 스톱모션: 일부러 낮은 fps */
  B: boolean
  /** B 의 fps */
  fps: number
  /** C 저사양 카메라 고정 (땅굴 돌리기·확대 끔) */
  C: boolean
  /** I 쉬는 중 가끔 숨쉬기 */
  I: boolean
  /** G 3D 창을 작게 (액자) */
  G: boolean
  /** H "가볍게 보기" 버튼 */
  H: boolean
  /** F 단순화 두더지 (가벼운 재질·액세서리 끔) */
  F: boolean
  /** D 땅굴을 별도 스레드(Worker)에서 그리기 (시험판) */
  D: boolean
  /** E 탐색하기 두더지를 2D 그림으로 (시험판) */
  E: boolean
  /** 땅굴 부분 다시 그리기 (이미 있던 것, 비교용) */
  P: boolean
}

export const LAB_DEFAULT: LabState = { force: 'auto', A: true, B: true, fps: 10, C: true, I: true, G: false, H: false, F: false, D: false, E: false, P: true }

const KEY = 'digul.lowlab'
const KEY_SHOW = 'digul.lowlab.show'

const read = (): LabState => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...LAB_DEFAULT, ...JSON.parse(raw) }
  } catch { /* 무시 */ }
  return { ...LAB_DEFAULT }
}

let state = read()
let version = 0
const subs = new Set<() => void>()

export const getLab = () => state
export const labVersion = () => version
export function setLab(patch: Partial<LabState>) {
  state = { ...state, ...patch }
  version++
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 무시 */ }
  subs.forEach((f) => f())
}
export function resetLab() { setLab({ ...LAB_DEFAULT }) }
export function subscribeLab(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } }

/** 패널을 보일지 (저사양 감지·?lowlab·한 번 열어 둔 적 있음) */
export function labShown(): boolean {
  try {
    if (/[?&]lowlab\b/.test(location.search + location.hash)) return true
    return localStorage.getItem(KEY_SHOW) === '1'
  } catch { return false }
}
export function setLabShown(on: boolean) {
  try { if (on) localStorage.setItem(KEY_SHOW, '1'); else localStorage.removeItem(KEY_SHOW) } catch { /* 무시 */ }
}
