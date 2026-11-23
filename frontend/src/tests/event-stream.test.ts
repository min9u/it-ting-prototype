/**
 * 실시간 소식 연결 (SSE, realtime/eventStream.ts) — 명세 v1 GET /api/v1/me/event-stream
 * 이름별 구독 · JSON 풀기 · 끊기면 백오프로 다시 연결 · 다시 붙으면 onReconnect · 끊긴 동안 소식은 사라짐 · 계속 실패하면 로그인 확인
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventStream, mockEventSource, mockEvents } from '../realtime/eventStream'

const make = (extra: Partial<Parameters<typeof createEventStream>[0]> = {}) =>
  createEventStream({ url: () => '/api/v1/me/event-stream', createSource: mockEventSource, backoff: { base: 100, max: 1000, floor: 100, random: () => 1 }, ...extra })

beforeEach(() => { vi.useFakeTimers(); mockEvents.down(false) })
afterEach(() => { mockEvents.down(false); vi.useRealTimers() })

describe('실시간 소식 연결', () => {
  it('열리면 이름별로 JSON 값을 받음 (구독하지 않은 이름은 무시)', async () => {
    const s = make()
    const got: unknown[] = []
    s.subscribe<{ unreadCount: number }>('NOTIFICATION_UNREAD_CHANGED', (d) => got.push(d))
    s.start()
    expect(s.status()).toBe('connecting')
    await vi.advanceTimersByTimeAsync(0)
    expect(s.status()).toBe('open')
    mockEvents.emit('NOTIFICATION_UNREAD_CHANGED', { unreadCount: 4, hasUnread: true })
    mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 3 })
    expect(got).toEqual([{ unreadCount: 4, hasUnread: true }])
    s.stop()
  })

  it('연결 뒤에 구독해도 받음, 해제하면 안 받음', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    const h = vi.fn()
    const off = s.subscribe('CHAT_REQUEST_COUNT_CHANGED', h)
    mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 1 })
    off()
    mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 2 })
    expect(h).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('끊기면 백오프 뒤 다시 연결하고 onReconnect 를 부름. 끊긴 동안의 소식은 오지 않음', async () => {
    const s = make()
    const got: number[] = []
    const reconnected = vi.fn()
    s.subscribe<{ receivedCount: number }>('CHAT_REQUEST_COUNT_CHANGED', (d) => got.push(d.receivedCount))
    s.onReconnect(reconnected)
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(reconnected).not.toHaveBeenCalled() // 처음 연결은 "다시"가 아님

    mockEvents.drop(150)
    expect(s.status()).toBe('reconnecting')
    mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 9 }) // 끊긴 동안 → 사라짐
    await vi.advanceTimersByTimeAsync(100) // 첫 재시도: 아직 서버가 꺼져 있어 실패
    expect(s.status()).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(400) // 두 번째 재시도 (200ms) 성공
    expect(s.status()).toBe('open')
    expect(reconnected).toHaveBeenCalledTimes(1)
    mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 3 })
    expect(got).toEqual([3])
    s.stop()
  })

  it('계속 실패하면 로그인을 확인하고, 풀렸으면 멈추고 onUnauthorized', async () => {
    mockEvents.down(true)
    const onUnauthorized = vi.fn()
    const checkAuth = vi.fn(async () => false)
    const s = make({ checkAuth, onUnauthorized, authCheckAfter: 2 })
    s.start()
    await vi.advanceTimersByTimeAsync(0) // 1번째 실패
    expect(checkAuth).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200) // 다시 시도 → 2번째 실패 → 로그인 확인
    expect(checkAuth).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(s.status()).toBe('stopped')
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockEvents.openCount).toBe(0)
  })

  it('stop 하면 다시 연결하지 않음', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    s.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.status()).toBe('stopped')
    expect(mockEvents.openCount).toBe(0)
  })
})
