import { useSyncExternalStore } from 'react'
import { ENV } from '../lib/env'
import { handleUnauthorized } from '../lib/authFlow'
import { createHub } from './hub'
import { createMockTransport, type MockControl, type MockDirectory, type MockMode } from './mockTransport'
import { createStompTransport, type StompOptions } from './stompTransport'
import type { ConnStatus, RealtimeClient, WireMessage, WireNotification } from './types'

export type * from './types'
export { SendFailure } from './hub'

/**
 * 실시간 연결 하나 (앱 전체가 같이 씀). 방식은 VITE_REALTIME (lib/env.ts): mock(기본) · stomp
 *
 * 쓰는 법
 *   realtime().start()                    로그인 영역에 들어올 때 (App.tsx AppLayout → useRealtimeLifecycle)
 *   realtime().joinRoom(id, handlers)     방 구독 (data/chat.ts)
 *   realtime().sendMessage({...})         보내기 → 확인되면 풀림, 실패면 SendFailure
 *   subscribeNotifications(cb)            알림 (같은 연결)
 *   useRealtimeStatus()                   연결 상태 (안내 띠 components/NetworkBanner.tsx)
 *
 * 시험 손잡이 (목): 주소 ?rt=flaky(가끔 끊김) · ?rt=down(서버 꺼짐), 콘솔 __digulRealtime.mock.drop(5000)
 */

/** 페이지 출처 기준 WebSocket 주소 (https 면 wss) */
export function wsUrl(path = ENV.wsPath): string {
  if (/^wss?:\/\//.test(path)) return path
  if (/^https?:\/\//.test(path)) return path.replace(/^http/, 'ws')
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * 놓친 메시지 받기 기본값 (REST). 응답은 WireMessage[] 또는 { items: WireMessage[] }.
 * API 계층(src/api)이 생기면 configureRealtime({ history }) 로 바꿔 끼울 것 (인증 갱신·에러 형식 통일)
 */
async function defaultHistory(roomId: string, afterSeq: number | undefined): Promise<WireMessage[]> {
  const q = afterSeq != null ? `?afterSeq=${afterSeq}` : ''
  const res = await fetch(`${ENV.apiBase}/chat/rooms/${encodeURIComponent(roomId)}/messages${q}`, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (res.status === 401) { handleUnauthorized('history 401'); return [] }
  if (!res.ok) throw new Error(`history ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.items ?? [])
}

let stompOpts: Partial<StompOptions> = {}
/** 실제 서버 연결 설정을 바꿔 끼움 (start 전에). history·connectHeaders(토큰 방식) */
export function configureRealtime(o: Partial<Pick<StompOptions, 'history' | 'connectHeaders' | 'url'>>) { stompOpts = { ...stompOpts, ...o } }

function mockModeFromUrl(): MockMode {
  try {
    const m = (location.search + location.hash).match(/[?&]rt=(flaky|down|normal)\b/)
    if (m) return m[1] as MockMode
  } catch { /* 무시 */ }
  return 'normal'
}

let client: RealtimeClient | null = null
let mock: MockControl | null = null

export function realtime(): RealtimeClient {
  if (client) return client
  if (ENV.realtime === 'stomp') {
    const t = createStompTransport({
      url: () => (stompOpts.url ? stompOpts.url() : wsUrl()),
      history: (id, after) => (stompOpts.history ?? defaultHistory)(id, after),
      connectHeaders: () => stompOpts.connectHeaders?.() ?? {},
    })
    client = createHub(t, { onUnauthorized: () => handleUnauthorized('websocket') })
  } else {
    const t = createMockTransport(mockModeFromUrl())
    mock = t.control
    client = createHub(t, { onUnauthorized: () => handleUnauthorized('websocket') })
  }
  // 시험 손잡이: 개발 서버 또는 주소에 ?rt= 가 있을 때만
  try {
    if (ENV.dev || /[?&]rt=/.test(location.search + location.hash)) {
      (window as unknown as { __digulRealtime?: unknown }).__digulRealtime = { client, mock }
    }
  } catch { /* 무시 */ }
  return client
}

/** 목 서버에 방 정보를 알려 줌 (data/chat.ts 가 부름. stomp 면 아무것도 안 함) */
export function setMockDirectory(d: MockDirectory) {
  realtime()
  mock?.setDirectory(d)
}

/** 알림 받기 (같은 연결). 돌려준 함수로 해제 */
export function subscribeNotifications(cb: (n: WireNotification) => void): () => void {
  return realtime().subscribeNotifications(cb)
}

const subscribeStatus = (f: () => void) => realtime().onStatus(() => f())
const getStatus = (): ConnStatus => realtime().status()
export function useRealtimeStatus(): ConnStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus)
}
