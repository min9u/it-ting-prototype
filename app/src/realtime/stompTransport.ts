import { TIMING } from './protocol'
import type { Transport, TransportHandlers, WireMessage } from './types'

/**
 * 실제 서버용 전송: 브라우저 WebSocket 위에 STOMP 1.2 프레임을 직접 씀 (패키지 없이, 필요한 만큼만).
 * 가정: Spring Boot `@EnableWebSocketMessageBroker` + SimpleBroker, 엔드포인트 /ws (SockJS 없이 순수 WebSocket).
 * SockJS 를 켜면 순수 WebSocket 주소는 보통 /ws/websocket 이 됨 → VITE_WS_URL 로 맞출 것.
 *
 * 프레임:  COMMAND\n header:value\n ... \n\n body \0
 * - CONNECT  accept-version:1.2, heart-beat:10000,10000 (+ 토큰 방식이면 Authorization 헤더, 쿠키 방식이면 없음: WebSocket 핸드셰이크에 쿠키가 실림)
 * - SUBSCRIBE id·destination, UNSUBSCRIBE id, SEND destination·content-type·content-length
 * - 서버 하트비트(빈 줄)가 2.5배 시간 동안 없으면 죽은 연결로 보고 닫음 → hub 가 다시 연결
 * - ERROR 프레임이 인증 문제(401·403·expired·unauthorized)면 auth 로 알림 → 다시 연결하지 않고 로그인으로
 * - 닫힘 코드 4401(서버와 정할 것)도 인증 문제로 봄
 */
interface Frame { command: string; headers: Record<string, string>; body: string }

const AUTH_RE = /\b(401|403)\b|unauthori[sz]ed|forbidden|expired|invalid[_ ]?token|access ?denied/i

/** STOMP 1.2 헤더 값 이스케이프 (CONNECT 프레임은 하지 않음) */
const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/:/g, '\\c')
const unesc = (v: string) => v.replace(/\\(\\|r|n|c)/g, (_, c: string) => (c === '\\' ? '\\' : c === 'r' ? '\r' : c === 'n' ? '\n' : ':'))

export function parseFrame(raw: string): Frame | null {
  const text = raw.replace(/^(\r?\n)+/, '')
  if (!text) return null
  const sep = text.search(/\r?\n\r?\n/)
  const head = sep < 0 ? text : text.slice(0, sep)
  const body = sep < 0 ? '' : text.slice(sep).replace(/^\r?\n\r?\n/, '')
  const lines = head.split(/\r?\n/)
  const command = lines.shift() ?? ''
  const headers: Record<string, string> = {}
  for (const line of lines) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const k = unesc(line.slice(0, i))
    if (!(k in headers)) headers[k] = command === 'CONNECTED' ? line.slice(i + 1) : unesc(line.slice(i + 1)) // 같은 헤더가 여럿이면 처음 것
  }
  return { command, headers, body }
}

export function buildFrame(command: string, headers: Record<string, string>, body = ''): string {
  const raw = command === 'CONNECT' || command === 'STOMP'
  const lines = [command, ...Object.entries(headers).map(([k, v]) => `${raw ? k : esc(k)}:${raw ? v : esc(v)}`)]
  return `${lines.join('\n')}\n\n${body}\0`
}

export interface StompOptions {
  /** ws:// 또는 wss:// 전체 주소 (부를 때마다 계산: 토큰을 쿼리에 붙이는 방식 대비) */
  url: () => string
  /** 놓친 메시지 받기 (REST). realtime/index.ts 의 기본값을 API 계층이 바꿔 끼울 수 있음 */
  history: (roomId: string, afterSeq: number | undefined) => Promise<WireMessage[]>
  /** CONNECT 에 붙일 헤더 (Bearer 토큰 방식일 때 { Authorization: 'Bearer …' }) */
  connectHeaders?: () => Record<string, string>
  heartbeatMs?: number
}

export function createStompTransport(o: StompOptions): Transport {
  const HB = o.heartbeatMs ?? TIMING.heartbeat
  let ws: WebSocket | null = null
  let handlers: TransportHandlers | null = null
  let buffer = ''
  let lastIn = 0
  let outTimer: ReturnType<typeof setInterval> | undefined
  let inTimer: ReturnType<typeof setInterval> | undefined
  let reported = false
  let subSeq = 0
  /** 주제 → 구독 id (연결마다 새로) */
  const subs = new Map<string, string>()
  const topicOfSub = new Map<string, string>()
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

  const raw = (s: string) => { if (ws?.readyState === WebSocket.OPEN) ws.send(s) }
  const send = (command: string, headers: Record<string, string>, body = '') => raw(buildFrame(command, headers, body))

  function cleanup() {
    clearInterval(outTimer)
    clearInterval(inTimer)
    subs.clear()
    topicOfSub.clear()
    buffer = ''
  }

  /** 한 번만 알림 (ERROR 뒤 onclose 가 또 오는 경우) */
  function report(reason: string, auth?: boolean) {
    if (reported) return
    reported = true
    const h = handlers
    cleanup()
    h?.onClose({ reason, auth })
  }

  function onFrame(f: Frame) {
    switch (f.command) {
      case 'CONNECTED': {
        // 하트비트 맞추기: 서버 heart-beat "sx,sy" (sx = 서버가 보내는 간격, sy = 서버가 받고 싶은 간격)
        const [sx, sy] = (f.headers['heart-beat'] ?? '0,0').split(',').map((n) => parseInt(n, 10) || 0)
        if (sy > 0) { const every = Math.max(HB, sy); outTimer = setInterval(() => raw('\n'), every) }
        if (sx > 0) {
          const expect = Math.max(HB, sx)
          inTimer = setInterval(() => {
            // 숨겨진 탭은 타이머가 늦게 돌아서 잘못 판단할 수 있음 → 보일 때만 검사 (hub 가 보이면 다시 확인)
            if (typeof document !== 'undefined' && document.hidden) return
            if (Date.now() - lastIn > expect * 2.5) { try { ws?.close(4000, 'heartbeat timeout') } catch { /* 무시 */ } report('하트비트가 끊겼어요') }
          }, expect)
        }
        handlers?.onOpen()
        break
      }
      case 'MESSAGE': {
        const topic = topicOfSub.get(f.headers.subscription ?? '') ?? f.headers.destination ?? ''
        let body: unknown = f.body
        try { body = f.body ? JSON.parse(f.body) : {} } catch { /* 글자 그대로 */ }
        handlers?.onEvent(topic, body)
        break
      }
      case 'ERROR': {
        const msg = `${f.headers.message ?? ''} ${f.body}`.trim()
        try { ws?.close(1000, 'stomp error') } catch { /* 무시 */ }
        report(`서버 오류: ${msg || '알 수 없음'}`, AUTH_RE.test(msg))
        break
      }
      default: // RECEIPT 등
    }
  }

  function onData(chunk: string) {
    buffer += chunk
    let i: number
    while ((i = buffer.indexOf('\0')) >= 0) {
      const frame = parseFrame(buffer.slice(0, i))
      buffer = buffer.slice(i + 1)
      if (frame) onFrame(frame)
    }
    if (/^[\r\n]*$/.test(buffer)) buffer = '' // 하트비트(빈 줄)만 남음
  }

  return {
    name: 'stomp',
    connect(h) {
      handlers = h
      reported = false
      let sock: WebSocket
      try {
        sock = new WebSocket(o.url(), ['v12.stomp'])
      } catch (e) {
        setTimeout(() => report(`WebSocket 을 만들지 못했어요: ${String(e)}`), 0)
        return
      }
      ws = sock
      sock.binaryType = 'arraybuffer'
      sock.onopen = () => {
        lastIn = Date.now()
        const host = typeof location !== 'undefined' ? location.hostname : 'localhost'
        send('CONNECT', { 'accept-version': '1.2', host, 'heart-beat': `${HB},${HB}`, ...(o.connectHeaders?.() ?? {}) })
      }
      sock.onmessage = (ev) => {
        if (ws !== sock) return
        lastIn = Date.now()
        onData(typeof ev.data === 'string' ? ev.data : decoder ? decoder.decode(ev.data as ArrayBuffer) : '')
      }
      sock.onclose = (ev) => {
        if (ws !== sock) return
        ws = null
        // 4401: 서버가 인증 만료로 끊음(정할 것). 1008(정책 위반)도 이유에 인증 단어가 있으면 인증 문제로
        report(`연결이 닫혔어요 (${ev.code}${ev.reason ? ` ${ev.reason}` : ''})`, ev.code === 4401 || (ev.code === 1008 && AUTH_RE.test(ev.reason)))
      }
      sock.onerror = () => { /* 곧 onclose 가 옴 */ }
    },
    disconnect() {
      const sock = ws
      ws = null
      handlers = null
      cleanup()
      if (!sock) return
      try {
        if (sock.readyState === WebSocket.OPEN) sock.send(buildFrame('DISCONNECT', {}))
        sock.close(1000, 'bye')
      } catch { /* 무시 */ }
    },
    subscribe(topic) {
      if (subs.has(topic)) return
      const id = `sub-${++subSeq}`
      subs.set(topic, id)
      topicOfSub.set(id, topic)
      send('SUBSCRIBE', { id, destination: topic, ack: 'auto' })
    },
    unsubscribe(topic) {
      const id = subs.get(topic)
      if (!id) return
      subs.delete(topic)
      topicOfSub.delete(id)
      send('UNSUBSCRIBE', { id })
    },
    publish(destination, body) {
      const json = JSON.stringify(body)
      const len = encoder ? encoder.encode(json).length : json.length
      send('SEND', { destination, 'content-type': 'application/json', 'content-length': String(len) }, json)
    },
    history: (roomId, afterSeq) => o.history(roomId, afterSeq),
  }
}
