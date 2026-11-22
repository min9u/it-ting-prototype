/**
 * 06 채팅 — 목 서버. data/chat.ts 의 방·요청 상태를 가짜 DB 로 씀
 * 실시간 소식은 realtime/eventStream.ts 의 mockEvents.emit('CHAT_MESSAGE_CREATED', …) 로 흉내 낼 수 있다
 */
import { conflict, mockRead, mockWrite, notFound } from '../mock/server'
import { memberProfile, memberSummary } from '../common/mockPeople'
import { accountStore } from '../../data/account'
import { ME_ID, USERS } from '../../data/mock'
import { findMeetup } from '../../data/meetupStore'
import {
  acceptRequest, dmRoomWith, dropRequest, getChatState, lastMsg, liveRequests, membersOf as roomMembersOf, personOf, receivedFrom, roomTitle,
  sendRequest, sentRequestTo, type Req, type Room,
} from '../../data/chat'
import { toIso } from '../../lib/time'
import type { ChatApi } from './real'
import type { ChatRequestDto, ChatRoomSummaryDto } from './types'

const DAY = 24 * 3_600_000

/* ===== 직렬화 (저장소 → DTO) ===== */
export function chatRoomSummary(r: Room): ChatRoomSummaryDto {
  const last = lastMsg(r)
  const mt = r.meetupId ? findMeetup(r.meetupId) : undefined
  const partner = r.partnerId ? personOf(r.partnerId) : undefined
  return {
    id: r.id, type: r.kind === 'dm' ? 'DIRECT' : 'MEETUP', meetupId: r.meetupId ?? null, title: roomTitle(r),
    partner: r.partnerId ? memberSummary(r.partnerId) : null,
    topic: r.kind === 'group' ? mt?.category ?? null : partner?.interests[0] ?? null,
    memberCount: r.kind === 'group' ? roomMembersOf(r).length : 2,
    lastMessage: last ? {
      id: last.id, type: last.system ? 'SYSTEM' : last.meetupId ? 'MEETUP_SHARE' : 'TEXT',
      senderId: last.system ? null : last.authorId, senderNickname: last.system ? null : last.authorId === ME_ID ? USERS[ME_ID].nickname : personOf(last.authorId).nickname,
      content: last.text || null, meetupId: last.meetupId ?? null, meetupTitle: last.meetupId ? findMeetup(last.meetupId)?.title ?? null : null,
      createdAt: toIso(last.at),
    } : null,
    unreadCount: r.unread,
    closedReason: r.closed === 'left' ? 'PARTNER_LEFT' : r.closed === 'gone' ? 'PARTNER_WITHDRAWN' : null,
    ended: !!r.ended,
  }
}
const CONTEXT: Record<string, ChatRequestDto['context']> = { '땅굴에 다녀갔어요': 'BURROW_VISIT', '같은 모임 참여 예정': 'SAME_MEETUP' }
export function chatRequestDto(r: Req): ChatRequestDto {
  return {
    id: r.id, direction: r.direction === 'received' ? 'RECEIVED' : 'SENT', counterpart: memberProfile(r.userId),
    message: r.message || null, status: 'PENDING', context: CONTEXT[r.context] ?? 'OTHER',
    createdAt: toIso(r.at), expiresAt: toIso(r.at + 5 * DAY), chatRoomId: null,
  }
}

/* ===== 목 서버 ===== */
const findReq = (id: string) => liveRequests().find((r) => r.id === id)
const reqNotFound = () => notFound('CHAT_REQUEST', '대화 요청을 찾을 수 없습니다.')
const getBlockedIds = () => accountStore.get().blocked.map((b) => b.id)

export const mock: ChatApi = {
  rooms: (q = {}, signal) => mockRead(() => {
    const blocked = getBlockedIds()
    const word = q.q?.trim()
    return getChatState().rooms
      .filter((r) => !(r.kind === 'dm' && r.partnerId && blocked.includes(r.partnerId)))
      .filter((r) => !q.type || (q.type === 'DIRECT' ? r.kind === 'dm' : r.kind === 'group'))
      .filter((r) => !word || roomTitle(r).includes(word) || r.messages.some((m) => m.text.includes(word)))
      .map(chatRoomSummary)
      .sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? '1970-01-01T00:00:00Z') - Date.parse(a.lastMessage?.createdAt ?? '1970-01-01T00:00:00Z'))
  }, { signal, empty: () => [] }),
  requests: (signal) => mockRead(() => {
    const blocked = getBlockedIds()
    return liveRequests().filter((r) => !blocked.includes(r.userId)).map(chatRequestDto)
  }, { signal, empty: () => [] }),
  sendRequest: (receiverId, message, context) => mockWrite(() => {
    if (dmRoomWith(receiverId)) throw conflict('ROOM_EXISTS', '이미 대화방이 있어요.')
    if (sentRequestTo(receiverId)) throw conflict('REQUEST_EXISTS', '이미 대화를 요청했어요.')
    // 상대가 먼저 보낸 요청에 아직 답하지 않았으면 새 요청을 만들지 않고 알림(토스트)으로 안내
    if (receivedFrom(receiverId)) throw conflict('REQUEST_FROM_PEER', '이 분이 먼저 대화를 요청했어요. 채팅 › 요청에서 답해 주세요.')
    sendRequest(receiverId, message, context === 'BURROW_VISIT' ? '땅굴에 다녀갔어요' : context === 'SAME_MEETUP' ? '같은 모임 참여 예정' : undefined)
    return chatRequestDto(sentRequestTo(receiverId)!)
  }),
  acceptRequest: (id) => mockWrite(() => {
    if (!findReq(id)) throw reqNotFound()
    return { chatRoomId: acceptRequest(id)! }
  }),
  declineRequest: (id) => mockWrite(() => { if (!findReq(id)) throw reqNotFound(); dropRequest(id) }),
  cancelRequest: (id) => mockWrite(() => { if (!findReq(id)) throw reqNotFound(); dropRequest(id) }),
}
