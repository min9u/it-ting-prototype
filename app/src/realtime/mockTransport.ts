import { TOPIC } from './protocol'
import { imageUrlOf } from '../lib/imageRules'
import type { Transport, TransportHandlers, WireMessage, WireMessageType } from './types'

/**
 * 가짜 서버 (서버 없이 실시간 채팅을 흉내). 이 탭 안에서만 동작.
 * - 지연: 연결 150~400ms, 보내기 확인 120~450ms
 * - 상대 답장: 1:1 에서 처음 보내면 꼭 한 번(예전 시연 동작 그대로), 그 뒤엔 30%. 모임은 25% 로 다른 참여자 한 명.
 *   "입력 중…" 이벤트 → 1.7초 뒤 메시지
 * - 끊김: mode
 *   normal (기본) 저절로 끊기지 않음 (팀 시연이 매끄럽게)
 *   flaky  20~40초마다 2~8초 끊김. 끊긴 동안 상대가 보낸 메시지는 기록에 남아서 다시 연결되면 "놓친 메시지 받기"로 들어옴
 *   down   서버가 꺼진 것처럼 연결이 늘 실패
 *   주소에 ?rt=flaky · ?rt=down 을 붙이거나, 콘솔에서 __digulRealtime.mock.drop(5000)
 * - 멱등: 같은 clientMessageId 는 한 번만 저장하고 같은 메시지를 다시 돌려줌 (실제 서버에 요청할 동작과 같음)
 */
export type MockMode = 'normal' | 'flaky' | 'down'

export interface MockRoomInfo {
  kind: 'dm' | 'group'
  /** 나 말고 이 방에 있는 사람 (답장할 수 있는 사람) */
  others: string[]
  /** 상대가 나갔거나 탈퇴 → 답장 없음 */
  closed?: boolean
  /** 이 방의 지금 마지막 seq (가짜 서버의 번호를 이어서 매기려고) */
  lastSeq?: number
}

export interface MockDirectory {
  /** 내 사용자 id (내가 보낸 메시지의 senderId) */
  meId: string
  roomInfo(roomId: string): MockRoomInfo | undefined
  /** 답장 문구 */
  replyText(roomId: string, from: string): string
}

export interface MockControl {
  mode: MockMode
  /** 지금 연결을 끊고 ms 동안 못 붙게 함. missedFrom 을 주면 끊긴 동안 그 방에 상대 메시지가 하나 옴 */
  drop(ms?: number, missed?: { roomId: string; from?: string; text?: string }): void
  /** 다음 보내기를 서버가 거절 (예: 읽기 전용이 된 대화방) */
  rejectNext(code?: string, message?: string): void
  /** 상대가 메시지를 보냄 (연결돼 있으면 바로, 아니면 기록에만) */
  incoming(roomId: string, from: string, text: string): void
  /** 알림 하나 보냄 */
  notify(text: string): void
  setDirectory(d: MockDirectory): void
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const later = (ms: number, f: () => void) => setTimeout(f, ms)

export function createMockTransport(mode: MockMode = 'normal'): Transport & { control: MockControl } {
  let dir: MockDirectory = { meId: 'me', roomInfo: () => undefined, replyText: () => '좋아요!' }
  let h: TransportHandlers | null = null
  let connected = false
  let outageUntil = 0
  let flakyTimer: ReturnType<typeof setTimeout> | undefined
  let reject: { code: string; message: string } | null = null
  const subs = new Set<string>()
  const log = new Map<string, WireMessage[]>()
  const seqs = new Map<string, number>()
  const byClient = new Map<string, WireMessage>()
  const repliedOnce = new Set<string>()

  const nextSeq = (roomId: string) => {
    const base = Math.max(seqs.get(roomId) ?? 0, dir.roomInfo(roomId)?.lastSeq ?? 0)
    seqs.set(roomId, base + 1)
    return base + 1
  }

  /** 구독한 주제면 보냄 (연결돼 있을 때만) */
  const emit = (topic: string, body: unknown) => {
    if (!connected || !subs.has(topic)) return
    const target = h
    later(0, () => { if (connected && h === target) target?.onEvent(topic, body) })
  }

  function store(roomId: string, senderId: string, type: WireMessageType, content: string, extra: Partial<WireMessage> = {}): WireMessage {
    const seq = nextSeq(roomId)
    const m: WireMessage = { id: `srv-${roomId}-${seq}`, roomId, seq, senderId, type, content, createdAt: new Date().toISOString(), ...extra }
    log.set(roomId, [...(log.get(roomId) ?? []), m])
    return m
  }

  function say(roomId: string, from: string, text: string) {
    const m = store(roomId, from, 'TEXT', text)
    emit(TOPIC.room(roomId), { event: 'MESSAGE', message: m })
  }

  function maybeReply(roomId: string) {
    const info = dir.roomInfo(roomId)
    if (!info || info.closed || info.others.length === 0) return
    let go: boolean
    if (info.kind === 'dm') { go = !repliedOnce.has(roomId) || Math.random() < 0.3; repliedOnce.add(roomId) } else go = Math.random() < 0.25
    if (!go) return
    const from = info.others[Math.floor(Math.random() * info.others.length)]
    later(900, () => emit(TOPIC.room(roomId), { event: 'TYPING', roomId, userId: from, typing: true }))
    later(2600, () => {
      emit(TOPIC.room(roomId), { event: 'TYPING', roomId, userId: from, typing: false })
      say(roomId, from, dir.replyText(roomId, from))
    })
  }

  function scheduleFlaky() {
    clearTimeout(flakyTimer)
    if (control.mode !== 'flaky') return
    flakyTimer = later(rand(20_000, 40_000), () => {
      // 끊긴 동안 마지막으로 이야기한 방에 상대 메시지 하나 (다시 연결되면 기록으로 받음)
      const room = [...log.keys()].pop()
      const info = room ? dir.roomInfo(room) : undefined
      control.drop(rand(2_000, 8_000), room && info?.others[0] && !info.closed ? { roomId: room, from: info.others[0] } : undefined)
    })
  }

  const control: MockControl = {
    mode,
    drop(ms = 5000, missed) {
      outageUntil = Date.now() + ms
      if (missed) later(Math.min(ms / 2, 1500), () => store(missed.roomId, missed.from ?? dir.roomInfo(missed.roomId)?.others[0] ?? 'system', 'TEXT', missed.text ?? dir.replyText(missed.roomId, missed.from ?? '')))
      if (connected) {
        connected = false
        subs.clear()
        const target = h
        later(0, () => target?.onClose({ reason: '연결이 끊겼어요 (목 서버)' }))
      }
    },
    rejectNext(code = 'SEND_REJECTED', message = '상대에게 메시지를 보낼 수 없어요') { reject = { code, message } },
    incoming(roomId, from, text) { say(roomId, from, text) },
    notify(text) {
      emit(TOPIC.notifications, { event: 'NOTIFICATION', notification: { id: `n-${Date.now()}`, type: 'TEST', createdAt: new Date().toISOString(), text } })
    },
    setDirectory(d) { dir = d },
  }

  return {
    name: 'mock',
    control,
    connect(handlers) {
      h = handlers
      later(rand(150, 400), () => {
        if (h !== handlers) return
        if (control.mode === 'down' || Date.now() < outageUntil) { handlers.onClose({ reason: '서버에 연결할 수 없어요 (목 서버)' }); return }
        connected = true
        handlers.onOpen()
        scheduleFlaky()
      })
    },
    disconnect() {
      connected = false
      subs.clear()
      clearTimeout(flakyTimer)
      h = null
    },
    subscribe(topic) { subs.add(topic) },
    unsubscribe(topic) { subs.delete(topic) },
    publish(dest, body) {
      const m = /^\/app\/chat\/rooms\/([^/]+)\/(messages|typing|read)$/.exec(dest)
      if (!m) return
      const [, roomId, what] = m
      if (what !== 'messages') return // 입력 중·읽음은 다른 사람이 없어서 버림
      const b = body as { clientMessageId: string; type: WireMessageType; content: string; meetupId?: string; imageIds?: string[] }
      const images = (b.imageIds ?? []).flatMap((id) => { const url = imageUrlOf(id); return url ? [{ id, url }] : [] })
      const target = h
      later(rand(120, 450), () => {
        // 확인이 가기 전에 끊기면 확인을 잃어버림 (보내는 쪽은 시간 초과 → 다시 연결 뒤 기록으로 받음)
        if (!connected || h !== target) {
          if (!byClient.has(b.clientMessageId) && Math.random() < 0.5) byClient.set(b.clientMessageId, store(roomId, dir.meId, b.type, b.content, { clientMessageId: b.clientMessageId, meetupId: b.meetupId, images }))
          return
        }
        if (reject) {
          const r = reject
          reject = null
          emit(TOPIC.errors, { event: 'SEND_FAILED', clientMessageId: b.clientMessageId, code: r.code, message: r.message })
          return
        }
        const dup = byClient.get(b.clientMessageId)
        const msg = dup ?? store(roomId, dir.meId, b.type, b.content, { clientMessageId: b.clientMessageId, meetupId: b.meetupId, images })
        byClient.set(b.clientMessageId, msg)
        emit(TOPIC.room(roomId), { event: 'MESSAGE', message: msg })
        if (!dup) maybeReply(roomId)
      })
    },
    history(roomId, afterSeq) {
      // 가짜 서버 번호를 클라이언트가 가진 마지막 번호 뒤로 맞춤
      if (afterSeq != null && (seqs.get(roomId) ?? 0) < afterSeq) seqs.set(roomId, afterSeq)
      const list = (log.get(roomId) ?? []).filter((m) => afterSeq == null || m.seq > afterSeq)
      return new Promise((res) => later(rand(150, 400), () => res(list)))
    },
  }
}

