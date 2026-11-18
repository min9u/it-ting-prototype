/*
 * 🎨 땅굴 색 다양하게 켜고 끄기 (2026-11-18 2단계 실험 스위치, docs/room-diversity-2-2026-11-18.md)
 * - 켬(기본): 대표 관심사 대분류의 색 묶음 + 집주인 id 씨앗 자동 꾸미기 (data/roomLook.ts roomLookOf 의 style)
 * - 끔: 디자이너 원래 색 (벽지 그림 · 가구 · 껍데기 모두 핸드오프 그대로). 벽지 종류와 가구 배치는 같음
 * - 화면: 땅굴의 "✨ 이펙트" 패널 맨 위 줄 (components/FxPanel.tsx). 장면을 다시 만들지 않고 바로 바뀜
 * - 주소 손잡이(저장값보다 먼저): ?look=designer (끔) · ?look=auto (켬). 비교 찍기(tools/room-diversity)가 씀
 */
const KEY = 'digul.roomLook.v1'

const forced = (): boolean | null => {
  try {
    const v = (location.search + location.hash).match(/[?&]look=(\w+)/)?.[1]
    return v === 'designer' || v === '0' ? false : v === 'auto' || v === '1' ? true : null
  } catch { return null }
}
const read = (): boolean => {
  const f = forced()
  if (f !== null) return f
  try { return localStorage.getItem(KEY) !== 'designer' } catch { return true }
}

let on = read()
let version = 0
const subs = new Set<() => void>()

/** 땅굴 색 다양하게가 켜져 있음 */
export const lookDiverse = () => on
export const lookVersion = () => version
export function subscribeLook(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } }
export function setLookDiverse(v: boolean) {
  if (v === on) return
  on = v
  version++
  try { localStorage.setItem(KEY, v ? 'auto' : 'designer') } catch { /* 이 탭에서만 */ }
  subs.forEach((f) => f())
}
