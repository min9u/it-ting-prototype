/**
 * 실시간 소식 입구 (명세 v1: 계정마다 SSE 연결 하나, GET /api/v1/me/event-stream).
 * 예전 채팅 전용 WebSocket + STOMP 허브(hub · stompTransport · mockTransport …)는 2026-11-22 에 지웠다:
 * 채팅은 받기 = 이 연결의 CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED (api/chat/queries.ts useChatEvents),
 * 보내기 = 일반 API (POST /chat-rooms/{id}/messages). 정리: docs/backend/api-v1/06-chat.md
 */
export { eventStream, startEventStream, stopEventStream, mockEvents, type KnownEventName } from './events'
export { useEventStream, useRefetchOnReconnect, useEventStreamStatus } from './useEventStream'
export type { StreamStatus } from './eventStream'
