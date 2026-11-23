/**
 * 06 채팅 영역 입구. 화면은 여기서: import { useChatRooms, useChatRoom, chatCalls, chatKeys, CHAT_ERRORS } from '../../api/chat'
 * 이 폴더(api/chat/)는 채팅 작업자만 고친다. 실시간 연결은 공통 realtime/events.ts, 채팅 소식 받기는 queries.ts useChatEvents.
 * 규칙: docs/backend/api-v1-foundation.md, 정리: docs/backend/api-v1/06-chat.md
 */
export * from './types'
export { ENDPOINTS, type ChatApi } from './real'
export { chatApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
export { useOutbox, type PendingMessage } from './outbox'
