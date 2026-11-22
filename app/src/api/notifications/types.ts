/**
 * 09 알림 DTO. 명세: docs/backend/team-spec/api/09-notification.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 알림 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'
import type { MemberSummaryDto } from '../common/legacy'
import type { CursorPageDto } from '../common/types'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string

/** notification 의 큰 분류 (알림 탭·알림 설정 notification_setting.*_on 과 같음) */
export type NotificationCategory = 'MEETUP' | 'CHAT' | 'COMMUNITY' | 'BURROW' | 'NOTICE'
/** notification.type (VARCHAR(40)) */
export type NotificationType =
  | 'MEETUP_APPLICATION_RECEIVED' | 'MEETUP_APPLICATION_APPROVED' | 'MEETUP_APPLICATION_REJECTED' | 'MEETUP_MEMBER_LEFT'
  | 'MEETUP_KICKED' | 'MEETUP_UPDATED' | 'MEETUP_CANCELED' | 'MEETUP_STARTING_SOON' | 'MEETUP_VACANCY'
  | 'CHAT_MESSAGE' | 'CHAT_REQUEST_RECEIVED' | 'CHAT_REQUEST_ACCEPTED'
  | 'POST_COMMENTED' | 'COMMENT_REPLIED' | 'POST_LIKED' | 'COMMENT_LIKED' | 'REPLY_LIKED' | 'POST_HIDDEN'
  | 'COMMENT_HIDDEN' | 'GUESTBOOK_WRITTEN' | 'GUESTBOOK_HIDDEN' | 'SERVICE_NOTICE'
/** notification.target_type */
export type NotificationTargetType = 'MEETUP' | 'CHAT_ROOM' | 'CHAT_REQUEST' | 'POST' | 'COMMENT' | 'BURROW' | 'NOTICE'

/* ===== 알림 ===== */
export interface NotificationDto {
  id: LegacyId
  type: NotificationType
  category: NotificationCategory
  targetType: NotificationTargetType
  targetId: LegacyId | null
  /** 원본이 지워졌으면 false → 누르면 "삭제된 …" 안내 */
  targetExists: boolean
  actor: MemberSummaryDto | null
  /** 서버가 만든 문장 (원본이 지워져도 보이도록 만들 때의 제목을 저장 → erd-gaps) */
  title: string
  body: string
  readAt: IsoDateTime | null
  createdAt: IsoDateTime
}
export interface NotificationPageDto extends CursorPageDto<NotificationDto> {
  /** 켜 둔 종류의 안 읽은 알림 수 (탭과 관계없이 전체) */
  unreadCount: number
}
