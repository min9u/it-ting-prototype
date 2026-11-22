/**
 * 06 채팅 — 실제 서버 호출. 명세: docs/backend/team-spec/api/06-chat.md
 * 메시지 주고받기는 지금 realtime/(STOMP 허브)와 data/chat.ts 에 있다. 명세는 보내기 = 일반 API, 받기 = SSE 하나
 * (realtime/eventStream.ts 의 CHAT_MESSAGE_CREATED · CHAT_REQUEST_COUNT_CHANGED). 채팅 작업자가 옮긴다.
 * 'GET /api/v1/me/event-stream' 연결 자체는 공통(api/common ENDPOINTS)이 맡았다.
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다
 */
import { http } from '../client'
import type { LegacyId as Id } from '../common/legacy'
import type { AcceptChatRequestResponse, ChatRequestDto, ChatRoomSummaryDto, ChatRoomType } from './types'

export const ENDPOINTS: readonly string[] = []

export interface ChatRoomQuery { type?: ChatRoomType; q?: string }

export const real = {
  /** GET /chat/rooms — 내 대화방 (최근 메시지 순) */
  rooms: (q: ChatRoomQuery = {}, signal?: AbortSignal) => http.get<ChatRoomSummaryDto[]>('/chat/rooms', { ...q }, signal),
  /** GET /chat/requests — 받은·보낸 대화 요청 (PENDING, 5일 안) */
  requests: (signal?: AbortSignal) => http.get<ChatRequestDto[]>('/chat/requests', { status: 'PENDING' }, signal),
  /** POST /chat/requests — 대화 요청 보내기 (409 REQUEST_EXISTS · ROOM_EXISTS, 403 BLOCKED) */
  sendRequest: (receiverId: Id, message: string, context: ChatRequestDto['context']) => http.post<ChatRequestDto>('/chat/requests', { receiverId, message, context }),
  /** POST /chat/requests/{id}/accept → 만들어진 1:1 대화방 */
  acceptRequest: (id: Id) => http.post<AcceptChatRequestResponse>(`/chat/requests/${id}/accept`),
  /** POST /chat/requests/{id}/decline — 상대에게 알리지 않음 */
  declineRequest: (id: Id) => http.post<void>(`/chat/requests/${id}/decline`),
  /** DELETE /chat/requests/{id} — 보낸 요청 취소 */
  cancelRequest: (id: Id) => http.delete<void>(`/chat/requests/${id}`),
}
export type ChatApi = typeof real
