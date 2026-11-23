import { useSyncExternalStore } from 'react'

/**
 * 아주 작은 전역 저장소 (data/chat.ts 와 같은 방식: 모듈 변수 + useSyncExternalStore).
 * key 를 주면 localStorage 에 저장한다. 비공개 창·막힌 저장소에서도 동작하게 try/catch.
 */
export function createStore<T extends object>(init: T, key?: string) {
  let state: T = init
  if (key) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) state = { ...init, ...JSON.parse(raw) }
    } catch { /* 저장소를 못 쓰면 기본값 */ }
  }
  const subs = new Set<() => void>()
  const get = () => state
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const p = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...p }
    if (key) { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* 무시 */ } }
    subs.forEach((f) => f())
  }
  const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
  const use = () => useSyncExternalStore(subscribe, get)
  return { get, set, use, subscribe }
}

/** 00 공통 8 시간 표기: 방금 · N분 전 · N시간 전 · 어제 · N일 전, 일주일이 넘으면 날짜 (문구는 lib/time.ts 한 곳) */
export { agoNotice as noticeTime } from './time'
