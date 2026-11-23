/**
 * 앱 전체가 같이 쓰는 실시간 소식 연결 하나 (SSE, realtime/eventStream.ts).
 * 목/실제: NEXT_PUBLIC_API_REAL_AREAS 에 'events' 가 있거나 NEXT_PUBLIC_API_MODE=real 이면 실제 서버 (api/config.ts areaMode('events'))
 *
 *   startEventStream()   로그인 영역에 들어올 때 (App.tsx AppLayout)
 *   stopEventStream()    로그아웃할 때
 *   eventStream().subscribe('NOTIFICATION_UNREAD_CHANGED', (d) => …)
 *   eventStream().onReconnect(() => …)   다시 붙으면 조회 API 로 맞추기
 *
 * 소식 이름과 값은 그 소식을 만드는 영역의 명세에 있다: 06 채팅(CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED), 09 알림(NOTIFICATION_UNREAD_CHANGED)
 * 값의 타입은 그 영역 types.ts 에 두고, 받는 코드도 그 영역 queries.ts 에 둔다
 */
import { areaMode } from '../api/config'
import { buildUrl } from '../api/client'
import { handleUnauthorized } from '../lib/authFlow'
import { ENV } from '../lib/env'
import { createEventStream, mockEventSource, mockEvents, type EventSourceFactory, type EventStream } from './eventStream'

/** 명세의 소식 이름 (enum). 새 이름은 그 영역 작업자가 여기 말고 자기 types.ts 에 문자열 상수로 두어도 됨 */
export type KnownEventName = 'CHAT_MESSAGE_CREATED' | 'CHAT_REQUEST_COUNT_CHANGED' | 'NOTIFICATION_UNREAD_CHANGED'

export const EVENT_STREAM_PATH = '/me/event-stream'

const realSource: EventSourceFactory = (url) => new EventSource(url, { withCredentials: true })

/** 연결이 자꾸 실패할 때 로그인이 풀렸는지 (GET /me 가 401 이면 false) */
async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch(buildUrl('/me'), { credentials: 'include', headers: { Accept: 'application/json' } })
    return res.status !== 401
  } catch {
    return true // 네트워크 문제는 로그인 문제가 아님 → 계속 다시 시도
  }
}

let stream: EventStream | null = null

export function eventStream(): EventStream {
  if (stream) return stream
  const real = areaMode('events') === 'real'
  stream = createEventStream({
    url: () => buildUrl(EVENT_STREAM_PATH),
    createSource: real ? realSource : mockEventSource,
    checkAuth: real ? checkAuth : undefined,
    onUnauthorized: () => handleUnauthorized('event-stream 401'),
  })
  // 시험 손잡이 (개발 서버 콘솔): __digulEvents.mock.emit('NOTIFICATION_UNREAD_CHANGED', { unreadCount: 3, hasUnread: true })
  if (typeof window !== 'undefined' && ENV.dev) {
    (window as unknown as { __digulEvents?: unknown }).__digulEvents = { stream, mock: real ? null : mockEvents }
  }
  return stream
}

/** 로그인 영역에 들어올 때. 브라우저에서만 (서버 렌더링 중이면 아무것도 안 함) */
export function startEventStream() {
  if (typeof window === 'undefined') return
  if (areaMode('events') === 'real' && typeof EventSource === 'undefined') return
  eventStream().start()
}
export function stopEventStream() { stream?.stop() }

export { mockEvents }
