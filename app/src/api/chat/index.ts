/**
 * 06 채팅 영역 입구. 화면은 여기서: import { chatApi, useChatRooms, chatKeys, CHAT_ERRORS } from '../../api/chat'
 * 이 폴더(api/chat/)는 채팅 작업자만 고친다. 실시간 받기는 realtime/eventStream.ts (공통). 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type ChatApi, type ChatRoomQuery } from './real'
export { chatApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
