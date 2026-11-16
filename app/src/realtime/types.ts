/**
 * 실시간 연결 계층의 약속 (채팅 메시지 · 입력 중 · 읽음 · 알림). docs/frontend-hardening.md "실시간"
 *
 * 화면·저장소(data/chat.ts)는 RealtimeClient 만 안다. 그 아래 전송(Transport)은 둘:
 * - mock  (realtime/mockTransport.ts): 서버 없이 이 탭 안에서 흉내. 지연·끊김·상대 답장
 * - stomp (realtime/stompTransport.ts): WebSocket + STOMP 1.2 프레임을 직접 씀 (패키지 없음). Spring 의 STOMP 브로커 가정
 * 재연결·다시 받기·중복 제거·보내는 중/실패 처리는 둘이 같은 코드(realtime/hub.ts)를 씀 → 목으로 시험한 동작이 실제와 같음
 *
 * 서버 JSON 모양은 ERD(docs/backend/erd-2026-11-16.md chat_message)에 맞추되, 아래 두 칸은 백엔드에 추가를 요청할 것:
 * - clientMessageId: 보낸 쪽이 만든 UUID. 서버가 그대로 돌려줘서 "보내는 중" 메시지를 교체 + 다시 보내도 한 번만 저장(멱등)
 * - seq: 방 안에서 늘어나는 순서 번호 (없으면 id 를 씀. 자세한 주의는 문서)
 */

/** 메시지 종류 (ERD chat_message.type, 값은 미정 → 제안) */
export type WireMessageType = 'TEXT' | 'SYSTEM' | 'MEETUP'

/** 서버가 보내는 메시지 한 건 */
export interface WireMessage {
  /** 서버 id (BIGINT 를 문자열로) */
  id: string
  roomId: string
  /** 방 안 순서. 정렬·중복 제거·다시 받기 기준 */
  seq: number
  /** 내가 보낸 메시지면 보낼 때 만든 id 가 그대로 돌아옴 */
  clientMessageId?: string
  /** 'system' = 가운데 안내 */
  senderId: string
  type: WireMessageType
  content: string
  /** type 이 MEETUP 이면 모임 id (모임 카드) */
  meetupId?: string
  /** ISO 8601 (오프셋 포함) */
  createdAt: string
}

/** 내가 보내는 메시지 */
export interface OutgoingMessage {
  clientMessageId: string
  roomId: string
  type: WireMessageType
  content: string
  meetupId?: string
}

/** 입력 중 */
export interface TypingEvent { roomId: string; userId: string; typing: boolean }
/** 읽음 (명세상 화면에 읽음 표시는 없음. 안 읽은 수 계산을 서버가 하도록 마지막 읽은 id 만 보냄) */
export interface ReadEvent { roomId: string; userId: string; lastMessageId: string }
/** 방 상태 바뀜 (상대가 나감·탈퇴, 공지 바뀜, 대화 요청 수락 등). 내용은 서버와 정할 것 */
export interface RoomEvent { roomId: string; kind: 'MEMBER_LEFT' | 'MEMBER_GONE' | 'NOTICE' | 'CLOSED' | string; payload?: unknown }

/** 알림 한 건 (ERD notification) */
export interface WireNotification {
  id: string
  type: string
  targetType?: string
  targetId?: string
  actorId?: string
  createdAt: string
  /** 화면에 그대로 보여 줄 한 줄 (서버가 만들어 줄지 프론트가 type 으로 만들지 정할 것) */
  text?: string
}

/** 보내기 실패 (서버가 거절) */
export interface SendError { clientMessageId: string; code: string; message: string }

/* ---------- 연결 상태 ---------- */
/**
 * idle 시작 전 · connecting 처음 연결 중 · open 연결됨 · reconnecting 끊겨서 다시 연결 기다리는 중
 * offline 브라우저가 오프라인 · paused 탭이 오래 숨겨져 일부러 끊음 · unauthorized 인증 실패(로그인 필요) · closed 멈춤
 */
export type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline' | 'paused' | 'unauthorized' | 'closed'

export interface ConnStatus {
  state: ConnState
  /** 연속 실패 횟수 (open 이 되면 0) */
  attempt: number
  /** reconnecting 일 때 다음 시도 시각 (ms) */
  nextRetryAt?: number
  /** 이 상태가 된 시각 (ms) */
  since: number
  /** 한 번이라도 연결된 적 있는지 (첫 연결 전에는 "다시 연결" 띠를 안 띄움) */
  everOpened: boolean
  lastError?: string
}

/* ---------- 화면·저장소가 쓰는 손잡이 ---------- */
export interface RoomHandlers {
  onMessage(m: WireMessage): void
  onTyping?(e: TypingEvent): void
  onRead?(e: ReadEvent): void
  onRoomEvent?(e: RoomEvent): void
  /** 다시 받기 기준: 이 방에서 받은 가장 큰 seq (없으면 undefined → 서버가 정한 최근 몇 개) */
  lastSeq(): number | undefined
}

export interface RealtimeClient {
  /** 연결 시작 (여러 번 불러도 한 번). 로그인 영역에 들어올 때 */
  start(): void
  /** 연결 끊고 멈춤 (로그아웃) */
  stop(): void
  status(): ConnStatus
  onStatus(cb: (s: ConnStatus) => void): () => void
  /** 기다리지 않고 바로 다시 연결 ("지금 다시 연결" 버튼, 온라인 복귀) */
  retryNow(): void
  /** 방 구독. 돌려준 함수로 해제 */
  joinRoom(roomId: string, h: RoomHandlers): () => void
  /**
   * 보내기. 서버가 같은 clientMessageId 로 돌려주면 풀림. 연결이 끊겨 있으면 60초까지 기다렸다가 다시 연결될 때 보냄.
   * 보낸 뒤 10초 안에 확인이 없으면 실패(reject) → 화면은 "다시 보내기". 같은 clientMessageId 로 다시 보내도 서버가 한 번만 저장(멱등)
   */
  sendMessage(m: OutgoingMessage): Promise<WireMessage>
  /** 마지막으로 읽은 메시지 (바뀔 때만 보냄) */
  markRead(roomId: string, lastMessageId: string): void
  /** 입력 중 (자주 불러도 됨. 3초에 한 번만 보내고, 멈추면 false) */
  setTyping(roomId: string, typing: boolean): void
  /** 알림 받기 (같은 연결) */
  subscribeNotifications(cb: (n: WireNotification) => void): () => void
}

/* ---------- 전송 계층 (mock · stomp 가 구현) ---------- */
export interface TransportHandlers {
  onOpen(): void
  /** auth: 서버가 인증 문제로 끊음 → 다시 연결하지 않고 로그인으로 */
  onClose(info: { reason: string; auth?: boolean }): void
  /** 구독한 주제로 온 내용 (JSON 을 푼 것) */
  onEvent(topic: string, body: unknown): void
}

export interface Transport {
  readonly name: 'mock' | 'stomp'
  connect(h: TransportHandlers): void
  disconnect(): void
  /** 연결된 뒤에만 부름 (hub 가 다시 연결될 때마다 다시 부름) */
  subscribe(topic: string): void
  unsubscribe(topic: string): void
  publish(destination: string, body: unknown): void
  /** 다시 연결된 뒤 놓친 메시지 받기 (stomp 는 REST, mock 은 가짜 서버 기록) */
  history(roomId: string, afterSeq: number | undefined): Promise<WireMessage[]>
}
