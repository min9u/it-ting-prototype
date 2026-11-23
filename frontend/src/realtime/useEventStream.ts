/**
 * 실시간 소식(SSE)을 React 에서 쓰는 훅 (realtime/events.ts)
 *
 *   useEventStream<{ unreadCount: number; hasUnread: boolean }>('NOTIFICATION_UNREAD_CHANGED', (d) => qc.setQueryData(…, d.unreadCount))
 *   useRefetchOnReconnect([notificationKeys.all, chatKeys.all])   끊겼다 다시 붙으면 그 키들을 새로 받음 (명세: 놓친 소식은 다시 안 옴)
 *   useEventStreamStatus()   'connecting' | 'open' | 'reconnecting' …
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { eventStream } from './events'
import type { StreamStatus } from './eventStream'

/** 소식 하나 받기 (화면이 떠 있는 동안). handler 는 바뀌어도 다시 구독하지 않음 */
export function useEventStream<T = unknown>(event: string, handler: (data: T) => void) {
  const ref = useRef(handler)
  useEffect(() => { ref.current = handler })
  useEffect(() => eventStream().subscribe<T>(event, (d) => ref.current(d)), [event])
}

/** 다시 연결되면 이 키들을 invalidate (keys 는 매번 새 배열이어도 됨) */
export function useRefetchOnReconnect(keys: QueryKey[]) {
  const qc = useQueryClient()
  const ref = useRef(keys)
  useEffect(() => { ref.current = keys })
  useEffect(() => eventStream().onReconnect(() => { for (const k of ref.current) void qc.invalidateQueries({ queryKey: k }) }), [qc])
}

const sub = (f: () => void) => eventStream().onStatus(() => f())
const get = (): StreamStatus => eventStream().status()
export function useEventStreamStatus(): StreamStatus {
  return useSyncExternalStore(sub, get, () => 'idle')
}
