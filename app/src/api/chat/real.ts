/**
 * 06 채팅 — 실제 서버 호출. 명세: docs/backend/team-spec/api/06-chat.md
 * - 받기는 실시간 소식(SSE) 하나: CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED (queries.ts useChatEvents).
 *   'GET /api/v1/me/event-stream' 연결 자체는 공통(api/common ENDPOINTS, realtime/events.ts)이 맡았다
 * - 보내기는 일반 API (POST /chat-rooms/{chatRoomId}/messages)
 * 인자의 id 는 DTO id(숫자). 화면 · 훅은 queries.ts 가 toDtoId 로 바꿔 부른다
 * 다른 영역 API 는 그 영역 것을 쓴다: 모임 나가기 = 07 meetupCalls.cancelParticipation, 사진 = 08 uploadImage(POST /images), 대화 요청 보내기 = 05 POST /chat-requests
 */
import { http, seg } from '../client'
import type { Id } from '../common/types'
import type {
  AcceptChatRequestResponse, ChatMessageDto, ChatMessagesQuery, ChatNoticeResponse, ChatReadResponse, ChatRequestCountDto, ChatRequestDirection,
  ChatRequestDto, ChatRoomDetailDto, ChatRoomSummaryDto, SendChatMessageRequest,
} from './types'
import type { CursorPageDto, ItemsDto } from '../common/types'

/** 명세대로 만든 API (src/tests/api-v1-endpoints.test.ts 가 명세 제목과 비교) */
export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/me/chat-rooms',
  'GET /api/v1/chat-rooms/{chatRoomId}',
  'GET /api/v1/chat-rooms/{chatRoomId}/messages',
  'POST /api/v1/chat-rooms/{chatRoomId}/messages',
  'POST /api/v1/chat-rooms/{chatRoomId}/read',
  'POST /api/v1/chat-rooms/{chatRoomId}/leave',
  'PUT /api/v1/chat-rooms/{chatRoomId}/notice',
  'DELETE /api/v1/chat-rooms/{chatRoomId}/notice',
  'GET /api/v1/me/chat-requests',
  'GET /api/v1/me/chat-requests/count',
  'POST /api/v1/chat-requests/{chatRequestId}/accept',
  'POST /api/v1/chat-requests/{chatRequestId}/reject',
  'POST /api/v1/chat-requests/{chatRequestId}/cancel',
]

export const real = {
  /** GET /me/chat-rooms — 내 대화방 모두 (마지막 메시지가 새로운 것부터). 필터 · 검색은 프론트 */
  rooms: (signal?: AbortSignal) => http.get<ItemsDto<ChatRoomSummaryDto>>('/me/chat-rooms', undefined, signal),
  /** GET /chat-rooms/{chatRoomId} — 상대 · 모임 · 공지 · 참여자 · 나가기 종류 (404 CHAT_ROOM_NOT_FOUND) */
  room: (chatRoomId: Id, signal?: AbortSignal) => http.get<ChatRoomDetailDto>(`/chat-rooms/${seg(chatRoomId)}`, undefined, signal),
  /** GET /chat-rooms/{chatRoomId}/messages — 새 것부터 커서로 */
  messages: (chatRoomId: Id, q: ChatMessagesQuery = {}, signal?: AbortSignal) =>
    http.get<CursorPageDto<ChatMessageDto>>(`/chat-rooms/${seg(chatRoomId)}/messages`, { size: q.size, cursor: q.cursor ?? undefined }, signal),
  /** POST /chat-rooms/{chatRoomId}/messages — 201 + 만든 메시지 (409 CHAT_ROOM_READ_ONLY) */
  sendMessage: (chatRoomId: Id, body: SendChatMessageRequest) => http.post<ChatMessageDto>(`/chat-rooms/${seg(chatRoomId)}/messages`, body),
  /** POST /chat-rooms/{chatRoomId}/read — 화면에 보인 마지막 메시지까지 읽음 → 그 방의 안 읽은 수 */
  read: (chatRoomId: Id, messageId: Id) => http.post<ChatReadResponse>(`/chat-rooms/${seg(chatRoomId)}/read`, { messageId }),
  /** POST /chat-rooms/{chatRoomId}/leave — 대화방에서만 나감 (409 CHAT_ROOM_LEAVE_NOT_ALLOWED) */
  leave: (chatRoomId: Id) => http.post<null>(`/chat-rooms/${seg(chatRoomId)}/leave`),
  /** PUT /chat-rooms/{chatRoomId}/notice — 공지 쓰기 · 고치기 (주최자만, 403 FORBIDDEN) */
  setNotice: (chatRoomId: Id, content: string) => http.put<ChatNoticeResponse>(`/chat-rooms/${seg(chatRoomId)}/notice`, { content }),
  /** DELETE /chat-rooms/{chatRoomId}/notice — 공지 지우기 (주최자만) */
  deleteNotice: (chatRoomId: Id) => http.delete<null>(`/chat-rooms/${seg(chatRoomId)}/notice`),
  /** GET /me/chat-requests?direction= — 받은 / 보낸 요청 모두 (새것부터) */
  requests: (direction: ChatRequestDirection, signal?: AbortSignal) => http.get<ItemsDto<ChatRequestDto>>('/me/chat-requests', { direction }, signal),
  /** GET /me/chat-requests/count — 받은 · 보낸 요청 수 ("요청 N" = receivedCount) */
  requestCount: (signal?: AbortSignal) => http.get<ChatRequestCountDto>('/me/chat-requests/count', undefined, signal),
  /** POST /chat-requests/{chatRequestId}/accept — 1:1 대화방이 생김 (404 CHAT_REQUEST_NOT_FOUND) */
  acceptRequest: (chatRequestId: Id) => http.post<AcceptChatRequestResponse>(`/chat-requests/${seg(chatRequestId)}/accept`),
  /** POST /chat-requests/{chatRequestId}/reject — 상대에게 알리지 않음 */
  rejectRequest: (chatRequestId: Id) => http.post<null>(`/chat-requests/${seg(chatRequestId)}/reject`),
  /** POST /chat-requests/{chatRequestId}/cancel — 보낸 요청 취소 (409 CHAT_REQUEST_ALREADY_ACCEPTED + detail.chatRoomId) */
  cancelRequest: (chatRequestId: Id) => http.post<null>(`/chat-requests/${seg(chatRequestId)}/cancel`),

}
export type ChatApi = typeof real
