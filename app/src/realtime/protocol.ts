/**
 * 주제(destination) 이름과 시간 값 — 백엔드와 맞출 약속을 한 곳에 (docs/frontend-hardening.md "실시간 · 백엔드와 정할 것").
 * Spring STOMP(SimpleBroker) 관례: 구독은 /topic(여럿) · /user/queue(나만), 보내기는 /app 접두사
 */
export const TOPIC = {
  /** 방 안 이벤트: { event: 'MESSAGE' | 'TYPING' | 'READ' | 'ROOM', ... } */
  room: (roomId: string) => `/topic/chat/rooms/${roomId}`,
  /** 내 알림: { event: 'NOTIFICATION', notification } */
  notifications: '/user/queue/notifications',
  /** 내 보내기 실패: { event: 'SEND_FAILED', clientMessageId, code, message } */
  errors: '/user/queue/errors',
} as const

export const DEST = {
  send: (roomId: string) => `/app/chat/rooms/${roomId}/messages`,
  typing: (roomId: string) => `/app/chat/rooms/${roomId}/typing`,
  read: (roomId: string) => `/app/chat/rooms/${roomId}/read`,
} as const

/** 방 주제에서 방 id 뽑기 */
export const roomIdOfTopic = (topic: string) => /^\/topic\/chat\/rooms\/(.+)$/.exec(topic)?.[1]

/** 시간 값 (ms) */
export const TIMING = {
  /** 처음 연결·다시 연결 시도 하나의 제한 */
  connectTimeout: 10_000,
  /** 보내기: 이 안에 서버가 돌려주지 않으면 실패 → "다시 보내기" */
  sendTimeout: 10_000,
  /** STOMP 하트비트 (서버·클라이언트 둘 다 10초. Nginx proxy_read_timeout 은 이보다 넉넉히, docs/deploy-config.md) */
  heartbeat: 10_000,
  /** 입력 중: 보내는 간격 · 멈춘 뒤 false 보내기까지 · 받은 "입력 중"이 저절로 꺼지는 시간 */
  typingEvery: 3_000,
  typingIdle: 2_500,
  typingExpire: 6_000,
  /** 탭이 이만큼 숨겨져 있으면 일부러 끊음 (보이면 바로 다시 연결 + 놓친 것 받기) */
  hiddenDisconnect: 10 * 60_000,
  /** 오프라인일 때도 이 간격으로 한 번씩 시도 (navigator.onLine 이 틀릴 때가 있어서) */
  offlineProbe: 30_000,
} as const
