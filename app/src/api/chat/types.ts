/**
 * 06 채팅 DTO — 명세 그대로. docs/backend/team-spec/api/06-chat.md
 * id 는 숫자(Id), 시각은 UTC(UtcInstant), 사람은 사용자 표시(UserDisplayDto), 관심사는 InterestTagDto, 값이 없으면 null
 */
import { RULES } from '../../lib/validation'
import type { Id, InterestTagDto, UserDisplayDto, UtcInstant } from '../common/types'

/* ===== 값 ===== */
/** chat_room.type */
export type ChatRoomType = 'DIRECT' | 'MEETUP'
/** chat_message.type. TEXT 가 아닌 것은 안내 메시지 (문구는 프론트가 type 과 sender 닉네임으로 만듦) */
export type ChatMessageType = 'TEXT' | 'ACCEPTED' | 'JOINED' | 'LEFT' | 'WITHDRAWN'
/** 나가기 버튼이 지금 하는 일 ("대화방에서 나가기" 표) */
export type ChatLeaveType = 'LEAVE_ROOM' | 'CANCEL_PARTICIPATION' | 'NOT_ALLOWED'
/** GET /me/chat-requests 의 direction */
export type ChatRequestDirection = 'RECEIVED' | 'SENT'

/** 글자 수 · 개수 (명세 "명세에 없어 이 문서에서 정한 것" 글자 수와 첨부) */
export const CHAT_MESSAGE_MAX = RULES.chatMessage.max
export const CHAT_NOTICE_MAX = RULES.chatNotice.max
export const CHAT_IMAGES_MAX = 3
/** 메시지 한 번에 받는 개수 (명세 기본 30, 1 ~ 100) */
export const CHAT_MESSAGES_PAGE = 30

/* ===== 메시지 (목록 · 마지막 메시지 · 보낸 뒤 응답 · 실시간 소식이 같은 모양) ===== */
export interface ChatMeetupCardDto {
  meetupId: Id
  title: string
  startsAt: UtcInstant
  /** 정원 (주최자 포함) */
  capacity: number
  /** 확정 인원 (주최자 포함) */
  confirmedCount: number
}
export interface ChatImageDto { id: Id; url: string }
export interface ChatMessageDto {
  /** 같은 방 안에서 클수록 나중 */
  id: Id
  type: ChatMessageType
  /** 보낸 사람, 또는 안내를 일으킨 사람 */
  sender: UserDisplayDto
  /** 안내 메시지 · 사진만 보낸 메시지는 null */
  content: string | null
  /** 본문에 모임 링크가 있을 때 (첫 링크만). 없거나 지운 모임이면 null */
  meetupCard: ChatMeetupCardDto | null
  /** 보낸 순서, 없으면 [] */
  images: ChatImageDto[]
  createdAt: UtcInstant
}

/* ===== GET /me/chat-rooms ===== */
export interface ChatRoomSummaryDto {
  id: Id
  type: ChatRoomType
  /** 1:1 상대 (모임이면 null) */
  counterpart: UserDisplayDto | null
  /** 모임 대화방의 모임 (1:1 이면 null) */
  meetup: { id: Id; title: string } | null
  lastMessage: ChatMessageDto | null
  unreadCount: number
  /** 상대가 나갔거나 탈퇴한 1:1. 모임은 늘 false */
  isReadOnly: boolean
}

/* ===== GET /chat-rooms/{chatRoomId} ===== */
export interface ChatRoomMeetupDto {
  id: Id
  hostId: Id
  title: string
  /** 07 모임의 카테고리 enum */
  category: string
  startsAt: UtcInstant
  endsAt: UtcInstant | null
  mode: 'OFFLINE' | 'ONLINE'
  place: string | null
  placeDetail: string | null
  joinUrl: string | null
  capacity: number
  confirmedCount: number
  isCanceled: boolean
}
export interface ChatRoomMemberDto { user: UserDisplayDto; isHost: boolean; isMe: boolean }
export interface ChatRoomDetailDto {
  id: Id
  type: ChatRoomType
  isReadOnly: boolean
  leaveType: ChatLeaveType
  counterpart: UserDisplayDto | null
  /** 1:1 에서 함께 고른 관심사 (상대가 고른 순서). 모임이면 [] */
  sharedInterests: InterestTagDto[]
  meetup: ChatRoomMeetupDto | null
  notice: string | null
  canEditNotice: boolean
  /** 지금 대화방에 있는 사람 (주최자 먼저, 그다음 들어온 순서). 1:1 이면 [] */
  members: ChatRoomMemberDto[]
}

/* ===== 메시지 · 읽음 · 공지 ===== */
export interface ChatMessagesQuery { size?: number; cursor?: string | null }
/** POST /chat-rooms/{id}/messages. 글 없이 사진만이면 content null */
export interface SendChatMessageRequest { content: string | null; imageIds: Id[] }
/** POST /chat-rooms/{id}/read */
export interface ChatReadRequest { messageId: Id }
export interface ChatReadResponse { unreadCount: number }
/** PUT /chat-rooms/{id}/notice */
export interface ChatNoticeRequest { content: string }
export interface ChatNoticeResponse { notice: string }

/* ===== 대화 요청 ===== */
export interface ChatRequestDto {
  id: Id
  /** 받은 요청이면 보낸 사람, 보낸 요청이면 받는 사람 */
  counterpart: UserDisplayDto
  /** 인사 (없으면 null) */
  message: string | null
  sharedInterests: InterestTagDto[]
  createdAt: UtcInstant
  expiresAt: UtcInstant
}
export interface ChatRequestCountDto { receivedCount: number; sentCount: number }
export interface AcceptChatRequestResponse { chatRoomId: Id }
/** 409 CHAT_REQUEST_ALREADY_ACCEPTED 의 error.detail */
export interface ChatRequestAlreadyAcceptedDetail { chatRoomId: Id }

/* ===== 실시간 소식 (GET /me/event-stream 으로 옴) ===== */
export const CHAT_MESSAGE_CREATED = 'CHAT_MESSAGE_CREATED'
export const CHAT_REQUEST_COUNT_CHANGED = 'CHAT_REQUEST_COUNT_CHANGED'
export interface ChatMessageCreatedEvent {
  chatRoomId: Id
  message: ChatMessageDto
  /** 이 소식을 받는 사람의, 그 방의 안 읽은 수 */
  unreadCount: number
}
export interface ChatRequestCountChangedEvent { receivedCount: number }

