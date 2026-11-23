/** 06 채팅 DTO → 앱 모양 (대화 목록 · 대화방 · 메시지 · 요청). 화면은 이 결과만 쓴다 */
import { GONE_ID, toAppId, toPersonFromDisplay, type Person } from '../common'
import { parseIso } from '../../lib/time'
import type {
  ChatLeaveType, ChatMessageDto, ChatMessageType, ChatRequestCountDto, ChatRequestDirection, ChatRequestDto, ChatRoomDetailDto, ChatRoomSummaryDto,
} from './types'

/* ===== 메시지 ===== */
export interface ChatMeetupCard { meetupId: string; title: string; startsAt: number; capacity: number; confirmedCount: number }
export interface ChatMessage {
  /** 앱 id. 보내는 중 · 실패한 내 메시지는 clientId */
  id: string
  /** DTO id (같은 방 안에서 클수록 나중. 읽음 API 에 보냄). 보내는 중 · 실패면 0 */
  num: number
  type: ChatMessageType
  /** 보낸 사람 (탈퇴하면 GONE_ID) */
  authorId: string
  author: Person
  /** 보여 줄 본문. 모임 카드가 붙으면 링크는 뺌. 안내 · 사진만이면 '' */
  text: string
  card: ChatMeetupCard | null
  images: { id: string; url: string }[]
  /** ms */
  at: number
  /** 아래는 내가 보내는 중인 메시지에만 (api/chat/outbox.ts) */
  clientId?: string
  status?: 'sending' | 'failed'
  error?: string
}
const LINK_IN_TEXT = /\S*\/meetups\/[A-Za-z0-9_-]+\S*/
export function toChatMessage(d: ChatMessageDto): ChatMessage {
  const author = toPersonFromDisplay(d.sender)
  const card = d.meetupCard
    ? { meetupId: toAppId(d.meetupCard.meetupId), title: d.meetupCard.title, startsAt: parseIso(d.meetupCard.startsAt), capacity: d.meetupCard.capacity, confirmedCount: d.meetupCard.confirmedCount }
    : null
  const raw = d.content ?? ''
  return {
    id: toAppId(d.id), num: d.id, type: d.type, authorId: author.id, author,
    text: card ? raw.replace(LINK_IN_TEXT, '').trim() : raw,
    card, images: d.images.map((i) => ({ id: toAppId(i.id), url: i.url })), at: parseIso(d.createdAt),
  }
}
export const isNoticeMessage = (m: Pick<ChatMessage, 'type'>) => m.type !== 'TEXT'

/**
 * 안내 메시지 문구 (명세: 프론트가 type 과 sender 닉네임으로 만듦)
 * kind: 그 방의 종류. myId: 내 계정 (내가 일으킨 안내는 "나" 기준 문구)
 */
export function noticeText(m: Pick<ChatMessage, 'type' | 'authorId' | 'author'>, kind: 'dm' | 'group', myId: string, counterpartName = ''): string {
  const me = m.authorId === myId
  const who = m.author.id === GONE_ID ? '탈퇴한 사용자' : m.author.nickname
  switch (m.type) {
    case 'ACCEPTED': return me ? `${counterpartName || '상대'}님의 대화 요청을 수락했어요` : `${who}님이 대화 요청을 수락했어요`
    case 'JOINED': return `${me ? '내가' : `${who}님이`} 모임에 참여했어요`
    case 'LEFT': return kind === 'dm' ? (me ? '대화방을 나갔어요' : '상대방이 대화방을 나갔습니다') : `${me ? '내가' : `${who}님이`} 모임 대화방을 나갔어요`
    case 'WITHDRAWN': return kind === 'dm' ? '상대방이 탈퇴했습니다' : '참여자 한 명이 탈퇴했어요'
    default: return ''
  }
}

/* ===== 대화 목록 ===== */
export interface ChatRoomItem {
  id: string
  kind: 'dm' | 'group'
  /** 1:1 은 상대 닉네임 (탈퇴하면 "탈퇴한 사용자"), 모임은 모임 이름 */
  title: string
  counterpart?: Person
  meetupId?: string
  last?: ChatMessage
  /** 마지막 메시지 시각 (ms) */
  lastAt?: number
  unread: number
  readOnly: boolean
  /** 읽기 전용인 까닭: 상대가 나감 · 탈퇴 */
  readOnlyReason?: 'left' | 'gone'
}
export function toChatRoomItem(d: ChatRoomSummaryDto): ChatRoomItem {
  const counterpart = d.counterpart ? toPersonFromDisplay(d.counterpart) : undefined
  const last = d.lastMessage ? toChatMessage(d.lastMessage) : undefined
  return {
    id: toAppId(d.id), kind: d.type === 'DIRECT' ? 'dm' : 'group',
    title: d.type === 'DIRECT' ? counterpart?.nickname ?? '탈퇴한 사용자' : d.meetup?.title ?? '모임',
    counterpart, meetupId: d.meetup ? toAppId(d.meetup.id) : undefined,
    last, lastAt: last?.at, unread: d.unreadCount, readOnly: d.isReadOnly,
    readOnlyReason: d.isReadOnly ? (d.counterpart?.isWithdrawn ? 'gone' : 'left') : undefined,
  }
}
/** 목록 한 줄의 마지막 메시지 글 (사진만이면 "사진", 모임은 "닉네임: …") */
export function roomPreview(r: ChatRoomItem, myId: string): string {
  const m = r.last
  if (!m) return ''
  if (isNoticeMessage(m)) return noticeText(m, r.kind, myId, r.counterpart?.nickname)
  const body = m.text || (m.card ? `[모임] ${m.card.title}` : m.images.length ? '사진' : '')
  if (r.kind === 'dm') return body
  return `${m.authorId === myId ? '나' : m.author.nickname}: ${body}`
}

/* ===== 대화방 ===== */
export interface ChatRoomMeetup {
  id: string
  hostId: string
  title: string
  /** 07 카테고리 코드 */
  category: string
  startsAt: number
  endsAt: number | null
  online: boolean
  place: string | null
  placeDetail: string | null
  joinUrl: string | null
  capacity: number
  confirmedCount: number
  canceled: boolean
}
export interface ChatRoomMember { person: Person; isHost: boolean; isMe: boolean }
export interface ChatRoomVM {
  id: string
  kind: 'dm' | 'group'
  readOnly: boolean
  readOnlyReason?: 'left' | 'gone'
  leaveType: ChatLeaveType
  counterpart?: Person
  /** 함께 고른 관심사 이름 (상대가 고른 순서) */
  sharedInterests: string[]
  meetup?: ChatRoomMeetup
  notice: string | null
  canEditNotice: boolean
  members: ChatRoomMember[]
}
export function toChatRoom(d: ChatRoomDetailDto): ChatRoomVM {
  const m = d.meetup
  return {
    id: toAppId(d.id), kind: d.type === 'DIRECT' ? 'dm' : 'group', readOnly: d.isReadOnly,
    readOnlyReason: d.isReadOnly ? (d.counterpart?.isWithdrawn ? 'gone' : 'left') : undefined,
    leaveType: d.leaveType,
    counterpart: d.counterpart ? toPersonFromDisplay(d.counterpart) : undefined,
    sharedInterests: d.sharedInterests.map((t) => t.name),
    meetup: m ? {
      id: toAppId(m.id), hostId: toAppId(m.hostId), title: m.title, category: m.category, startsAt: parseIso(m.startsAt), endsAt: m.endsAt ? parseIso(m.endsAt) : null,
      online: m.mode === 'ONLINE', place: m.place, placeDetail: m.placeDetail, joinUrl: m.joinUrl, capacity: m.capacity, confirmedCount: m.confirmedCount, canceled: m.isCanceled,
    } : undefined,
    notice: d.notice, canEditNotice: d.canEditNotice,
    members: d.members.map((x) => ({ person: toPersonFromDisplay(x.user), isHost: x.isHost, isMe: x.isMe })),
  }
}

/* ===== 대화 요청 ===== */
export interface ChatRequestVM {
  id: string
  direction: 'received' | 'sent'
  person: Person
  /** 인사 (없으면 '') */
  message: string
  /** 겹치는 관심사 이름 */
  shared: string[]
  at: number
  expiresAt: number
}
export function toChatRequest(d: ChatRequestDto, direction: ChatRequestDirection): ChatRequestVM {
  return {
    id: toAppId(d.id), direction: direction === 'RECEIVED' ? 'received' : 'sent', person: toPersonFromDisplay(d.counterpart),
    message: d.message ?? '', shared: d.sharedInterests.map((t) => t.name), at: parseIso(d.createdAt), expiresAt: parseIso(d.expiresAt),
  }
}
export interface ChatRequestCount { received: number; sent: number }
export const toChatRequestCount = (d: ChatRequestCountDto): ChatRequestCount => ({ received: d.receivedCount, sent: d.sentCount })
