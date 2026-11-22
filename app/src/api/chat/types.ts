/**
 * 06 채팅 DTO. 명세: docs/backend/team-spec/api/06-chat.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 채팅 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'
import type { MemberProfileDto, MemberSummaryDto } from '../common/legacy'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string

/** chat_room.type */
export type ChatRoomType = 'DIRECT' | 'MEETUP'
/** chat_message.type */
export type ChatMessageType = 'TEXT' | 'SYSTEM' | 'MEETUP_SHARE'
/** chat_request.status */
export type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'EXPIRED'

/* ===== 채팅 (REST: 방 목록 · 요청. 메시지 주고받기는 실시간 작업) ===== */
export interface ChatMessagePreviewDto {
  id: LegacyId
  type: ChatMessageType
  senderId: LegacyId | null
  senderNickname: string | null
  content: string | null
  /** MEETUP_SHARE 일 때 공유한 모임 */
  meetupId: LegacyId | null
  meetupTitle: string | null
  createdAt: IsoDateTime
}
export interface ChatRoomSummaryDto {
  id: LegacyId
  type: ChatRoomType
  /** MEETUP 방이면 모임 */
  meetupId: LegacyId | null
  /** MEETUP 방은 모임 이름, DIRECT 방은 상대 닉네임 (탈퇴하면 "탈퇴한 사용자") */
  title: string
  /** DIRECT 방의 상대 */
  partner: MemberSummaryDto | null
  /** 대표 관심사 이름 (목록 타일 색) */
  topic: string | null
  /** 지금 참여자 수 (left_at 이 없는 사람) */
  memberCount: number
  lastMessage: ChatMessagePreviewDto | null
  /** chat_room_member.last_read_message_id 이후 메시지 수 (서버 계산) */
  unreadCount: number
  /** 읽기 전용이 된 까닭 */
  closedReason: 'PARTNER_LEFT' | 'PARTNER_WITHDRAWN' | null
  /** 모임이 끝났거나 취소됨 */
  ended: boolean
}
export interface ChatRequestDto {
  id: LegacyId
  /** 내 기준 방향 */
  direction: 'RECEIVED' | 'SENT'
  counterpart: MemberProfileDto
  /** VARCHAR(50) */
  message: string | null
  status: ChatRequestStatus
  /** 어디서 요청했나 (ERD 에 없음 → erd-gaps): 땅굴 방문 · 같은 모임 · 그 밖 */
  context: 'BURROW_VISIT' | 'SAME_MEETUP' | 'OTHER'
  createdAt: IsoDateTime
  /** created_at + 5일 */
  expiresAt: IsoDateTime
  chatRoomId: LegacyId | null
}
export interface AcceptChatRequestResponse { chatRoomId: LegacyId }
