import { useSyncExternalStore } from 'react'

/**
 * 연결 상태 한 곳 (화면 위 안내 띠 components/NetworkBanner.tsx 가 읽음)
 * - online: 브라우저가 아는 인터넷 연결 (navigator.onLine + online/offline 이벤트)
 * - serverDown: REST 가 서버에 닿지 못함. **API 계층(src/api)이** 부름:
 *     네트워크 오류(fetch 가 TypeError)·502·503·504 → reportServerDown(), 그 뒤 아무 응답이나 성공 → reportServerUp()
 *   (4xx 는 서버가 살아 있다는 뜻이라 부르지 않음)
 * 실시간 연결 상태는 realtime/useEventStream.ts 의 useEventStreamStatus()
 */
interface NetState { online: boolean; serverDown: boolean; downSince: number | null }

let state: NetState = { online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, serverDown: false, downSince: null }
const subs = new Set<() => void>()
const set = (p: Partial<NetState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }))
  window.addEventListener('offline', () => set({ online: false }))
}

export function reportServerDown() { if (!state.serverDown) set({ serverDown: true, downSince: Date.now() }) }
export function reportServerUp() { if (state.serverDown) set({ serverDown: false, downSince: null }) }

/** fetch 실패를 보고 서버 문제인지 가려 줌 (API 계층용 도우미) */
export function isServerUnreachable(err: unknown, status?: number): boolean {
  if (status != null) return status === 502 || status === 503 || status === 504
  return err instanceof TypeError // fetch 의 네트워크 오류
}

export const getNetwork = () => state
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function useNetwork(): NetState { return useSyncExternalStore(subscribe, getNetwork, getNetwork) }
