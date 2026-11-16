import { backoffDelay } from './backoff'
import { DEST, TIMING, TOPIC, roomIdOfTopic } from './protocol'
import type {
  ConnStatus, OutgoingMessage, RealtimeClient, ReadEvent, RoomEvent, RoomHandlers, SendError, Transport, TypingEvent, WireMessage, WireNotification,
} from './types'

/**
 * 실시간 연결의 공통 두뇌 (mock · stomp 가 같은 코드를 씀). docs/frontend-hardening.md "실시간"
 *
 * - 재연결: 끊기면 지수 백오프 + 지터(backoff.ts)로 다시 시도. 온라인 복귀·탭이 다시 보임·"지금 다시 연결"은 바로 시도
 * - 다시 받기: 연결될 때마다 구독한 방마다 "마지막 seq 이후" 기록을 받음 (구독 먼저 → 기록 나중, 겹치는 것은 저장소가 중복 제거)
 * - 보내기: clientMessageId 로 확인을 짝지음. 끊겨 있으면 60초까지 쥐고 있다가 붙을 때 보냄. 보낸 뒤 10초 안에 확인이 없으면 실패 → 화면에서 "다시 보내기"
 *   (같은 clientMessageId 로 다시 보내므로 서버가 멱등이면 두 번 저장되지 않음)
 * - 탭이 숨겨지면: 연결 유지 (알림·안 읽은 수를 받으려고). 10분 넘게 숨겨지면 일부러 끊고(paused), 보이면 바로 다시 연결 + 기록 받기
 * - 오프라인: 시도를 멈추고(offline) 30초마다 한 번만 확인, online 이벤트가 오면 바로
 * - 인증 실패(서버가 401 성격으로 끊음): 다시 시도하지 않고 unauthorized → onUnauthorized (로그인으로)
 */
export class SendFailure extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}

interface Pending {
  msg: OutgoingMessage
  waiters: { resolve: (m: WireMessage) => void; reject: (e: SendFailure) => void }[]
  timer: ReturnType<typeof setTimeout>
}

export function createHub(transport: Transport, o: { onUnauthorized?: () => void } = {}): RealtimeClient {
  let status: ConnStatus = { state: 'idle', attempt: 0, since: Date.now(), everOpened: false }
  const statusSubs = new Set<(s: ConnStatus) => void>()
  const setStatus = (patch: Partial<ConnStatus>) => {
    const changedState = patch.state != null && patch.state !== status.state
    status = { ...status, ...patch, since: changedState ? Date.now() : status.since }
    statusSubs.forEach((f) => f(status))
  }

  let started = false
  let connected = false
  let connecting = false
  /** 연결 시도마다 늘어남. 예전 시도의 늦은 콜백을 무시하려고 */
  let gen = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let connectTimer: ReturnType<typeof setTimeout> | undefined
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined

  const rooms = new Map<string, Set<RoomHandlers>>()
  const notifSubs = new Set<(n: WireNotification) => void>()
  const pending = new Map<string, Pending>()
  /** 방별 마지막 읽음: 보낸 값 / 아직 못 보낸 값 */
  const readSent = new Map<string, string>()
  const readDirty = new Map<string, string>()
  const typing = new Map<string, { on: boolean; lastSent: number; idle?: ReturnType<typeof setTimeout> }>()

  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false
  const clearTimers = () => { clearTimeout(retryTimer); clearTimeout(connectTimer) }

  /* ---------- 연결 ---------- */
  function connect() {
    if (!started || connected || connecting) return
    clearTimers()
    if (!online()) { goOffline(); return }
    connecting = true
    const my = ++gen
    if (status.state !== 'reconnecting') setStatus({ state: status.everOpened ? 'reconnecting' : 'connecting' })
    connectTimer = setTimeout(() => {
      if (my !== gen || connected) return
      gen++ // 이 시도의 늦은 콜백 무시
      connecting = false
      transport.disconnect()
      onDropped('연결 시간 초과')
    }, TIMING.connectTimeout)
    transport.connect({
      onOpen: () => {
        if (my !== gen) return
        clearTimeout(connectTimer)
        connecting = false
        connected = true
        onOpened()
      },
      onClose: (info) => {
        if (my !== gen) return
        clearTimeout(connectTimer)
        gen++
        connecting = false
        connected = false
        onDropped(info.reason, info.auth)
      },
      onEvent: (topic, body) => { if (my === gen) route(topic, body) },
    })
  }

  function onOpened() {
    setStatus({ state: 'open', attempt: 0, nextRetryAt: undefined, everOpened: true, lastError: undefined })
    transport.subscribe(TOPIC.notifications)
    transport.subscribe(TOPIC.errors)
    for (const id of rooms.keys()) { transport.subscribe(TOPIC.room(id)); resync(id) }
    // 끊긴 동안 쌓인 보내기·읽음
    for (const [id, p] of pending) { publishSend(p.msg); armSend(id, TIMING.sendTimeout) }
    for (const [roomId, id] of readDirty) publishRead(roomId, id)
  }

  function onDropped(reason: string, auth?: boolean) {
    stopTypingAll()
    if (!started) { setStatus({ state: 'closed' }); return }
    if (auth) {
      started = false
      clearTimers()
      setStatus({ state: 'unauthorized', lastError: reason })
      failAll('UNAUTHORIZED', '로그인이 필요해요')
      o.onUnauthorized?.()
      return
    }
    if (status.state === 'paused') return
    if (!online()) { goOffline(); return }
    scheduleRetry(reason)
  }

  function scheduleRetry(reason?: string) {
    clearTimeout(retryTimer)
    const delay = backoffDelay(status.attempt)
    setStatus({ state: 'reconnecting', attempt: status.attempt + 1, nextRetryAt: Date.now() + delay, lastError: reason ?? status.lastError })
    retryTimer = setTimeout(connect, delay)
  }

  function goOffline() {
    clearTimeout(retryTimer)
    if (connected || connecting) { gen++; connected = false; connecting = false; transport.disconnect() }
    setStatus({ state: 'offline', nextRetryAt: Date.now() + TIMING.offlineProbe })
    retryTimer = setTimeout(connect, TIMING.offlineProbe)
  }

  /** 탭이 오래 숨겨짐 → 일부러 끊음 (서버 자원 아끼기). 알림 배지는 다시 보일 때 다시 받기로 맞춤 */
  function pause() {
    if (!started || status.state === 'paused') return
    clearTimers()
    if (connected || connecting) { gen++; connected = false; connecting = false; transport.disconnect() }
    setStatus({ state: 'paused' })
  }

  function retryNow() {
    if (!started || connected || connecting) return
    clearTimeout(retryTimer)
    setStatus({ attempt: 0, nextRetryAt: undefined })
    connect()
  }

  /* ---------- 받기 ---------- */
  function route(topic: string, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>
    if (topic === TOPIC.notifications) {
      const n = (b.notification ?? b) as WireNotification
      notifSubs.forEach((f) => f(n))
      return
    }
    if (topic === TOPIC.errors) {
      if (b.event === 'SEND_FAILED') failOne(b as unknown as SendError)
      return
    }
    const roomId = roomIdOfTopic(topic)
    if (!roomId) return
    const hs = rooms.get(roomId)
    switch (b.event) {
      case 'MESSAGE': deliver(b.message as WireMessage); break
      case 'TYPING': hs?.forEach((h) => h.onTyping?.(b as unknown as TypingEvent)); break
      case 'READ': hs?.forEach((h) => h.onRead?.(b as unknown as ReadEvent)); break
      case 'ROOM': hs?.forEach((h) => h.onRoomEvent?.(b as unknown as RoomEvent)); break
    }
  }

  function deliver(m: WireMessage) {
    if (!m || !m.roomId) return
    if (m.clientMessageId) {
      const p = pending.get(m.clientMessageId)
      if (p) { clearTimeout(p.timer); pending.delete(m.clientMessageId); p.waiters.forEach((w) => w.resolve(m)) }
    }
    rooms.get(m.roomId)?.forEach((h) => h.onMessage(m))
  }

  /** 놓친 메시지 받기: 구독한 방의 마지막 seq 이후 */
  function resync(roomId: string) {
    const hs = rooms.get(roomId)
    if (!hs?.size) return
    let after: number | undefined
    hs.forEach((h) => { const s = h.lastSeq(); if (s != null && (after == null || s > after)) after = s })
    const my = gen
    transport.history(roomId, after).then((list) => {
      if (my !== gen) return // 그 사이 또 끊김 → 다음 연결 때 다시 받음
      for (const m of list) deliver(m)
    }).catch((e) => console.warn('[실시간] 놓친 메시지를 못 받았어요', roomId, e))
  }

  /* ---------- 보내기 ---------- */
  const publishSend = (m: OutgoingMessage) =>
    transport.publish(DEST.send(m.roomId), { clientMessageId: m.clientMessageId, type: m.type, content: m.content, meetupId: m.meetupId })

  /**
   * 보내기 기다림 시간: 연결돼 있으면 보낸 뒤 sendTimeout(10초) 안에 확인이 와야 함.
   * 끊겨 있으면 offlineHold(60초)까지 "보내는 중"으로 쥐고 있다가, 붙는 순간 보내고 그때부터 다시 10초 (onOpened → armSend)
   */
  function armSend(id: string, ms: number) {
    const p = pending.get(id)
    if (!p) return
    clearTimeout(p.timer)
    p.timer = setTimeout(() => {
      const q = pending.get(id)
      if (!q) return
      pending.delete(id)
      q.waiters.forEach((w) => w.reject(new SendFailure('TIMEOUT', connected ? '서버가 답하지 않아요' : '연결이 끊겨 보내지 못했어요')))
    }, ms)
  }

  function sendMessage(msg: OutgoingMessage): Promise<WireMessage> {
    return new Promise<WireMessage>((resolve, reject) => {
      const id = msg.clientMessageId
      const prev = pending.get(id)
      if (prev) {
        // 같은 메시지를 다시 보냄 (아직 기다리는 중) → 같은 확인을 같이 기다림
        prev.waiters.push({ resolve, reject })
      } else {
        pending.set(id, { msg, waiters: [{ resolve, reject }], timer: setTimeout(() => {}, 0) })
      }
      stopTyping(msg.roomId)
      armSend(id, connected ? TIMING.sendTimeout : TIMING.offlineHold)
      if (connected) publishSend(msg)
    })
  }

  function failOne(e: SendError) {
    const p = pending.get(e.clientMessageId)
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(e.clientMessageId)
    p.waiters.forEach((w) => w.reject(new SendFailure(e.code ?? 'REJECTED', e.message ?? '보내지 못했어요')))
  }

  function failAll(code: string, message: string) {
    for (const [id, p] of pending) { clearTimeout(p.timer); p.waiters.forEach((w) => w.reject(new SendFailure(code, message))); pending.delete(id) }
  }

  /* ---------- 읽음 · 입력 중 ---------- */
  function publishRead(roomId: string, id: string) {
    transport.publish(DEST.read(roomId), { lastMessageId: id })
    readSent.set(roomId, id)
    readDirty.delete(roomId)
  }
  function markRead(roomId: string, lastMessageId: string) {
    if (readSent.get(roomId) === lastMessageId) return
    if (connected) publishRead(roomId, lastMessageId)
    else readDirty.set(roomId, lastMessageId)
  }

  function setTyping(roomId: string, on: boolean) {
    const t = typing.get(roomId) ?? { on: false, lastSent: 0 }
    typing.set(roomId, t)
    clearTimeout(t.idle)
    if (!on) { stopTyping(roomId); return }
    t.idle = setTimeout(() => stopTyping(roomId), TIMING.typingIdle)
    const now = Date.now()
    if (connected && (!t.on || now - t.lastSent > TIMING.typingEvery)) {
      transport.publish(DEST.typing(roomId), { typing: true })
      t.on = true
      t.lastSent = now
    }
  }
  function stopTyping(roomId: string) {
    const t = typing.get(roomId)
    if (!t) return
    clearTimeout(t.idle)
    if (t.on && connected) transport.publish(DEST.typing(roomId), { typing: false })
    t.on = false
  }
  function stopTypingAll() { for (const t of typing.values()) { clearTimeout(t.idle); t.on = false } }

  /* ---------- 브라우저 이벤트 ---------- */
  const onOnline = () => { if (started) retryNow() }
  const onOffline = () => { if (started) goOffline() }
  const onVisibility = () => {
    if (!started && status.state !== 'paused') return
    if (document.hidden) {
      clearTimeout(hiddenTimer)
      hiddenTimer = setTimeout(pause, TIMING.hiddenDisconnect)
    } else {
      clearTimeout(hiddenTimer)
      if (status.state === 'paused') { setStatus({ state: 'reconnecting', attempt: 0 }); connect() }
      // 숨겨진 동안 타이머가 느려져 백오프가 길어졌을 수 있음 → 보이면 바로
      else if (status.state === 'reconnecting' || status.state === 'offline') retryNow()
    }
  }
  // bfcache 에서 돌아온 페이지: 소켓은 이미 닫혀 있음
  const onPageShow = (e: PageTransitionEvent) => { if (e.persisted && started) { gen++; connected = false; connecting = false; retryNow() } }

  function listen(on: boolean) {
    if (typeof window === 'undefined') return
    const f = on ? 'addEventListener' : 'removeEventListener'
    window[f]('online', onOnline)
    window[f]('offline', onOffline)
    window[f]('pageshow', onPageShow as EventListener)
    document[f]('visibilitychange', onVisibility)
  }

  return {
    start() {
      if (started) return
      started = true
      listen(true)
      if (status.state === 'unauthorized' || status.state === 'closed') setStatus({ state: 'idle', attempt: 0 })
      connect()
    },
    stop() {
      if (!started) return
      started = false
      listen(false)
      clearTimers()
      clearTimeout(hiddenTimer)
      gen++
      if (connected || connecting) transport.disconnect()
      connected = false
      connecting = false
      failAll('STOPPED', '연결을 멈췄어요')
      setStatus({ state: 'closed' })
    },
    status: () => status,
    onStatus(cb) { statusSubs.add(cb); return () => { statusSubs.delete(cb) } },
    retryNow,
    joinRoom(roomId, h) {
      let hs = rooms.get(roomId)
      const first = !hs
      if (!hs) { hs = new Set(); rooms.set(roomId, hs) }
      hs.add(h)
      if (first && connected) { transport.subscribe(TOPIC.room(roomId)); resync(roomId) }
      return () => {
        const set = rooms.get(roomId)
        if (!set) return
        set.delete(h)
        if (set.size === 0) {
          rooms.delete(roomId)
          if (connected) transport.unsubscribe(TOPIC.room(roomId))
        }
      }
    },
    sendMessage,
    markRead,
    setTyping,
    subscribeNotifications(cb) { notifSubs.add(cb); return () => { notifSubs.delete(cb) } },
  }
}
