/**
 * 채팅 REST (F6): 대화방 목록 · 대화 요청. 계약: docs/backend/api-draft.md "채팅"
 * 메시지 기록·보내기·받기와 실시간 채널(STOMP)은 다른 작업 (data/chat.ts 메시지 부분). 여기서는 건드리지 않는다.
 * 목 구현은 data/chat.ts 의 방·요청 상태를 가짜 서버로 씀
 */
import { API_MODE } from './config'
import { http } from './client'
import { conflict, mockRead, mockWrite, notFound } from './mock/server'
import { chatRequestDto, chatRoomSummary } from './mock/serialize'
import {
  acceptRequest, dmRoomWith, dropRequest, getChatState, liveRequests, receivedFrom, rejectRequest, roomTitle, sendRequest, sentRequestTo,
} from '../data/chat'
import type { AcceptChatRequestResponse, ChatRequestDto, ChatRoomSummaryDto, ChatRoomType, Id, SendChatRequestResponse } from './types'

export interface ChatRoomQuery { type?: ChatRoomType; q?: string }

const real = {
  /** GET /chat/rooms — 내 대화방 (최근 메시지 순. 방 수가 많지 않아 페이지 없음, 늘면 커서) */
  rooms: (q: ChatRoomQuery = {}, signal?: AbortSignal) => http.get<ChatRoomSummaryDto[]>('/chat/rooms', { ...q }, signal),
  /** GET /chat/requests — 받은·보낸 대화 요청 (PENDING, 5일 안) */
  requests: (signal?: AbortSignal) => http.get<ChatRequestDto[]>('/chat/requests', { status: 'PENDING' }, signal),
  /** POST /chat/requests — 대화 요청 보내기 (409 REQUEST_EXISTS · ROOM_EXISTS · REQUEST_FROM_PEER). 내가 거절한 요청이 남은 사람이면 대화방이 바로 열려 chatRoomId 가 옴 */
  sendRequest: (receiverId: Id, message: string, context: ChatRequestDto['context']) => http.post<SendChatRequestResponse>('/chat/requests', { receiverId, message, context }),
  /** POST /chat/requests/{id}/accept → 만들어진 1:1 대화방 */
  acceptRequest: (id: Id) => http.post<AcceptChatRequestResponse>(`/chat/requests/${id}/accept`),
  /** POST /chat/requests/{id}/decline — 상대에게 알리지 않음 */
  declineRequest: (id: Id) => http.post<void>(`/chat/requests/${id}/decline`),
  /** DELETE /chat/requests/{id} — 보낸 요청 취소 */
  cancelRequest: (id: Id) => http.delete<void>(`/chat/requests/${id}`),
}
export type ChatApi = typeof real

/* ===== 목 서버 ===== */
const findReq = (id: Id) => liveRequests().find((r) => r.id === id)

const mock: ChatApi = {
  rooms: (q = {}, signal) => mockRead(() => {
    const word = q.q?.trim()
    return getChatState().rooms
      .filter((r) => !q.type || (q.type === 'DIRECT' ? r.kind === 'dm' : r.kind === 'group'))
      .filter((r) => !word || roomTitle(r).includes(word) || r.messages.some((m) => m.text.includes(word)))
      .map(chatRoomSummary)
      .sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? '1970-01-01T00:00:00Z') - Date.parse(a.lastMessage?.createdAt ?? '1970-01-01T00:00:00Z'))
  }, { signal, empty: () => [] }),
  requests: (signal) => mockRead(() => {
    return liveRequests().map(chatRequestDto)
  }, { signal, empty: () => [] }),
  sendRequest: (receiverId, message, context) => mockWrite(() => {
    if (dmRoomWith(receiverId)) throw conflict('ROOM_EXISTS', '이미 대화방이 있어요.')
    if (sentRequestTo(receiverId)) throw conflict('REQUEST_EXISTS', '이미 대화를 요청했어요.')
    // 상대가 먼저 보낸 요청에 아직 답하지 않았으면 새 요청을 만들지 않고 알림(토스트)으로 안내
    if (receivedFrom(receiverId)) throw conflict('REQUEST_FROM_PEER', '이 분이 먼저 대화를 요청했어요. 채팅 › 요청에서 답해 주세요.')
    const roomId = sendRequest(receiverId, message, context === 'BURROW_VISIT' ? '땅굴에 다녀갔어요' : context === 'SAME_MEETUP' ? '같은 모임 참여 예정' : undefined)
    if (roomId) return { chatRequestId: null, createdAt: null, expiresAt: null, chatRoomId: roomId } // 거절했던 요청을 수락한 것으로 처리 → 대화방이 바로 열림
    const d = chatRequestDto(sentRequestTo(receiverId)!)
    return { chatRequestId: d.id, createdAt: d.createdAt, expiresAt: d.expiresAt, chatRoomId: null }
  }),
  acceptRequest: (id) => mockWrite(() => {
    if (!findReq(id)) throw notFound('대화 요청')
    return { chatRoomId: acceptRequest(id)! }
  }),
  declineRequest: (id) => mockWrite(() => { if (!findReq(id)) throw notFound('대화 요청'); rejectRequest(id) }),
  cancelRequest: (id) => mockWrite(() => { if (!findReq(id)) throw notFound('대화 요청'); dropRequest(id) }),
}

export const chat: ChatApi = API_MODE === 'real' ? real : mock
