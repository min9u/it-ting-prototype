/**
 * 실시간 소식 연결 (SSE) — 백엔드 명세 v1: GET /api/v1/me/event-stream (api-convention.md "실시간 소식", api/06-chat.md)
 *
 * - 계정마다 연결 하나. 로그인한 뒤 한 번 열어 두고 모든 영역이 같이 쓴다 (영역마다 따로 열지 않음)
 * - 소식 한 건 = 이름(event, enum) + 값(data, JSON). 받기만 하고, 값을 바꾸는 일은 일반 API 로
 * - 끊긴 동안의 소식은 서버가 다시 보내지 않는다 → 다시 붙으면 onReconnect 로 알림 → 영역이 조회 API 로 화면을 맞춤
 *
 * 쓰는 법 (영역 코드)
 *   const off = eventStream().subscribe<{ unreadCount: number }>('NOTIFICATION_UNREAD_CHANGED', (d) => …)
 *   eventStream().onReconnect(() => queryClient.invalidateQueries({ queryKey: notificationKeys.all }))
 *   React 에서는 realtime/useEventStream.ts 의 useEventStream · useRefetchOnReconnect
 * 목 (NEXT_PUBLIC_API_REAL_AREAS 에 'events' 가 없고 NEXT_PUBLIC_API_MODE 가 mock 일 때):
 *   mockEvents.emit('CHAT_REQUEST_COUNT_CHANGED', { receivedCount: 3 })   ← 영역 mock.ts 가 "서버가 보낸 것"처럼
 *   mockEvents.drop(3000)  끊김 흉내 (그동안 emit 한 것은 사라짐 = 명세와 같음), mockEvents.down(true) 서버 꺼짐
 *
 * 다시 연결: EventSource 가 스스로 다시 붙는 것에 맡기지 않고(401 이면 영영 닫힘) 오류가 나면 닫고 지수 백오프로 새로 연다.
 * 연결이 계속 실패하면 GET /me 로 로그인을 확인해서 401 이면 멈추고 onUnauthorized (EventSource 는 상태 코드를 못 봄).
 * 서버(Next.js 등)에서 불려도 깨지지 않게 window · EventSource 는 start() 안에서만 만진다.
 */
import { backoffDelay, type BackoffOptions } from './backoff'

/** EventSource 의 필요한 부분 (시험 · 목에서 바꿔 끼움) */
export interface EventSourceLike {
  readonly readyState: number
  addEventListener(type: string, listener: (ev: MessageEvent | Event) => void): void
  removeEventListener(type: string, listener: (ev: MessageEvent | Event) => void): void
  close(): void
}
export type EventSourceFactory = (url: string) => EventSourceLike

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'stopped'

export interface EventStreamOptions {
  url: () => string
  createSource: EventSourceFactory
  /** 연결이 attempt 번 연속 실패했을 때 로그인 확인. false 면 멈추고 onUnauthorized */
  checkAuth?: () => Promise<boolean>
  /** 몇 번 연속 실패하면 checkAuth 를 부를지 (기본 2) */
  authCheckAfter?: number
  onUnauthorized?: () => void
  backoff?: BackoffOptions
  /** 시험용 타이머 */
  setTimer?: (f: () => void, ms: number) => unknown
  clearTimer?: (t: unknown) => void
}

export interface EventStream {
  start(): void
  stop(): void
  status(): StreamStatus
  onStatus(f: (s: StreamStatus) => void): () => void
  /** 소식 받기. 돌려준 함수로 해제. 값은 JSON 을 푼 것 */
  subscribe<T = unknown>(event: string, handler: (data: T) => void): () => void
  /** 끊겼다가 다시 붙었을 때 (처음 연결은 아님). 놓친 소식을 조회 API 로 맞출 자리 */
  onReconnect(f: () => void): () => void
}

export function createEventStream(o: EventStreamOptions): EventStream {
  const setTimer = o.setTimer ?? ((f, ms) => setTimeout(f, ms))
  const clearTimer = o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>))
  const handlers = new Map<string, Set<(data: unknown) => void>>()
  const reconnectFns = new Set<() => void>()
  const statusFns = new Set<(s: StreamStatus) => void>()
  /** 지금 연결에 붙인 이름별 리스너 (새 이름을 구독하면 지금 연결에도 붙임) */
  const attached = new Map<string, (ev: MessageEvent | Event) => void>()
  let src: EventSourceLike | null = null
  let st: StreamStatus = 'idle'
  let failures = 0
  let everOpened = false
  let timer: unknown = null

  const setStatus = (s: StreamStatus) => { if (s !== st) { st = s; statusFns.forEach((f) => f(s)) } }

  function dispatch(name: string, ev: MessageEvent | Event) {
    const raw = (ev as MessageEvent).data
    let data: unknown = raw
    if (typeof raw === 'string' && raw) { try { data = JSON.parse(raw) } catch { console.warn(`[실시간] ${name} 값이 JSON 이 아니에요`, raw); return } }
    handlers.get(name)?.forEach((h) => { try { h(data) } catch (e) { console.error(`[실시간] ${name} 처리 중 오류`, e) } })
  }
  function attach(name: string) {
    if (!src || attached.has(name)) return
    const l = (ev: MessageEvent | Event) => dispatch(name, ev)
    attached.set(name, l)
    src.addEventListener(name, l)
  }
  function closeSource() {
    if (!src) return
    for (const [name, l] of attached) src.removeEventListener(name, l)
    attached.clear()
    src.removeEventListener('open', onOpen)
    src.removeEventListener('error', onError)
    src.close()
    src = null
  }
  function onOpen() {
    failures = 0
    const again = everOpened
    everOpened = true
    setStatus('open')
    if (again) reconnectFns.forEach((f) => { try { f() } catch (e) { console.error('[실시간] onReconnect 오류', e) } })
  }
  function onError() {
    if (st === 'stopped') return
    closeSource()
    failures++
    setStatus(everOpened ? 'reconnecting' : 'connecting')
    const after = o.authCheckAfter ?? 2
    const wait = backoffDelay(failures - 1, o.backoff)
    if (o.checkAuth && failures >= after) {
      void o.checkAuth().then((ok) => {
        if (st === 'stopped') return
        if (!ok) { stop(); o.onUnauthorized?.(); return }
        schedule(wait)
      }, () => schedule(wait))
    } else schedule(wait)
  }
  function schedule(ms: number) {
    if (timer != null) clearTimer(timer)
    timer = setTimer(() => { timer = null; open() }, ms)
  }
  function open() {
    if (st === 'stopped') return
    closeSource()
    try {
      src = o.createSource(o.url())
    } catch (e) {
      console.warn('[실시간] 연결을 만들지 못했어요', e)
      onError()
      return
    }
    src.addEventListener('open', onOpen)
    src.addEventListener('error', onError)
    for (const name of handlers.keys()) attach(name)
  }
  function stop() {
    if (timer != null) { clearTimer(timer); timer = null }
    closeSource()
    setStatus('stopped')
  }

  return {
    start() {
      if (st === 'connecting' || st === 'open' || st === 'reconnecting') return
      failures = 0
      everOpened = false
      setStatus('connecting')
      open()
    },
    stop,
    status: () => st,
    onStatus(f) { statusFns.add(f); return () => { statusFns.delete(f) } },
    subscribe<T>(event: string, handler: (data: T) => void) {
      let set = handlers.get(event)
      if (!set) { set = new Set(); handlers.set(event, set) }
      const h = handler as (data: unknown) => void
      set.add(h)
      attach(event)
      return () => { set!.delete(h) }
    },
    onReconnect(f) { reconnectFns.add(f); return () => { reconnectFns.delete(f) } },
  }
}

/* ===== 목 서버 쪽 연결 ===== */
const OPEN = 1, CLOSED = 2

/** 목 서버: 영역 mock 이 emit 하면 열린 연결 모두에 흘려 보냄. 끊긴 동안 emit 한 것은 버림 (명세: 다시 보내지 않음) */
class MockHub {
  private sources = new Set<MockEventSource>()
  private downUntil = 0
  private forcedDown = false
  get isDown() { return this.forcedDown || Date.now() < this.downUntil }
  add(s: MockEventSource) { this.sources.add(s) }
  remove(s: MockEventSource) { this.sources.delete(s) }
  /** "서버가 보냄" */
  emit(event: string, data: unknown) {
    const payload = JSON.stringify(data)
    for (const s of [...this.sources]) s.deliver(event, payload)
  }
  /** ms 동안 끊김 (열린 연결은 error 로 닫히고, 그동안 다시 붙으려는 연결도 실패) */
  drop(ms = 3000) {
    this.downUntil = Date.now() + ms
    for (const s of [...this.sources]) s.fail()
  }
  /** 서버를 끄거나 켬 */
  down(on: boolean) {
    this.forcedDown = on
    if (on) for (const s of [...this.sources]) s.fail()
  }
  /** 지금 열린 연결 수 (시험용) */
  get openCount() { return [...this.sources].filter((s) => s.readyState === OPEN).length }
}

class MockEventSource implements EventSourceLike {
  readyState = 0
  private listeners = new Map<string, Set<(ev: MessageEvent | Event) => void>>()
  private hub: MockHub
  constructor(hub: MockHub) {
    this.hub = hub
    hub.add(this)
    // 실제 EventSource 처럼 다음 틱에 열림 (서버가 꺼져 있으면 실패)
    setTimeout(() => {
      if (this.readyState === CLOSED) return
      if (hub.isDown) { this.fail(); return }
      this.readyState = OPEN
      this.fire('open', new Event('open'))
    }, 0)
  }
  addEventListener(type: string, l: (ev: MessageEvent | Event) => void) {
    let s = this.listeners.get(type)
    if (!s) { s = new Set(); this.listeners.set(type, s) }
    s.add(l)
  }
  removeEventListener(type: string, l: (ev: MessageEvent | Event) => void) { this.listeners.get(type)?.delete(l) }
  close() { this.readyState = CLOSED; this.hub.remove(this) }
  deliver(event: string, data: string) {
    if (this.readyState !== OPEN) return
    this.fire(event, new MessageEvent(event, { data }))
  }
  fail() {
    if (this.readyState === CLOSED) return
    this.readyState = CLOSED
    this.hub.remove(this)
    this.fire('error', new Event('error'))
  }
  private fire(type: string, ev: MessageEvent | Event) { this.listeners.get(type)?.forEach((l) => l(ev)) }
}

/** 목 서버 손잡이 (영역 mock.ts · 시험 · 콘솔 __digulEvents) */
export const mockEvents = new MockHub()
/** 목 연결 만들기 (createEventStream 의 createSource 로) */
export const mockEventSource: EventSourceFactory = () => new MockEventSource(mockEvents)
