/**
 * 09 알림 DTO — 명세 그대로. docs/backend/team-spec/api/09-notification.md
 * id 는 숫자(Id), 시각은 UTC "…Z"(UtcInstant), 사람은 사용자 표시(UserDisplayDto), 값이 없으면 null
 */
import type { CursorQuery, Id, UserDisplayDto, UtcInstant } from '../common/types'

/** 갈래 (알림 탭 · 설정 › 알림 설정의 다섯 스위치와 같음). 아이콘 · 색은 프론트가 이 값으로 정한다 */
export type NotificationCategory = 'MEETUP' | 'CHAT' | 'COMMUNITY' | 'BURROW' | 'NOTICE'
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['MEETUP', 'CHAT', 'COMMUNITY', 'BURROW', 'NOTICE']

/** 알림의 종류 22가지 (명세 "알림의 종류"). 방노트는 명세가 보류해서 없음 */
export type NotificationType =
  // 모임
  | 'MEETUP_APPLICATION_RECEIVED' | 'MEETUP_APPLICATION_ACCEPTED' | 'MEETUP_APPLICATION_REJECTED' | 'MEETUP_PARTICIPATION_CANCELED'
  | 'MEETUP_KICKED' | 'MEETUP_UPDATED' | 'MEETUP_CANCELED' | 'MEETUP_DELETED' | 'MEETUP_VACANCY_OPENED' | 'MEETUP_START_REMINDER'
  // 채팅
  | 'CHAT_MESSAGE_RECEIVED' | 'CHAT_REQUEST_RECEIVED' | 'CHAT_REQUEST_ACCEPTED'
  // 커뮤니티
  | 'POST_COMMENTED' | 'POST_LIKED' | 'COMMENT_REPLIED' | 'COMMENT_LIKED' | 'POST_HIDDEN' | 'COMMENT_HIDDEN'
  // 땅굴
  | 'GUESTBOOK_ENTRY_CREATED' | 'GUESTBOOK_ENTRY_HIDDEN'
  // 공지
  | 'NOTICE_PUBLISHED'

/** 갈 곳의 종류 (notification.target_type) */
export type NotificationTargetType = 'MEETUP' | 'CHAT_ROOM' | 'CHAT_REQUEST' | 'POST' | 'GUESTBOOK' | 'BURROW' | 'NOTICE'

/**
 * 종류마다 정해진 갈래 · 갈 곳 종류 · 일으킨 사람(actor)이 있는지 (명세 "알림의 종류" 표).
 * 서버가 category 를 같이 주지만, 목 서버와 시험이 같은 표를 쓰도록 여기 한 곳에 둔다
 */
export const NOTIFICATION_TYPE_SPEC: Record<NotificationType, { category: NotificationCategory; target: NotificationTargetType; actor: boolean }> = {
  MEETUP_APPLICATION_RECEIVED: { category: 'MEETUP', target: 'MEETUP', actor: true },
  MEETUP_APPLICATION_ACCEPTED: { category: 'MEETUP', target: 'MEETUP', actor: true },
  MEETUP_APPLICATION_REJECTED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_PARTICIPATION_CANCELED: { category: 'MEETUP', target: 'MEETUP', actor: true },
  MEETUP_KICKED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_UPDATED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_CANCELED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_DELETED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_VACANCY_OPENED: { category: 'MEETUP', target: 'MEETUP', actor: false },
  MEETUP_START_REMINDER: { category: 'MEETUP', target: 'MEETUP', actor: false },
  CHAT_MESSAGE_RECEIVED: { category: 'CHAT', target: 'CHAT_ROOM', actor: true },
  CHAT_REQUEST_RECEIVED: { category: 'CHAT', target: 'CHAT_REQUEST', actor: true },
  CHAT_REQUEST_ACCEPTED: { category: 'CHAT', target: 'CHAT_ROOM', actor: true },
  POST_COMMENTED: { category: 'COMMUNITY', target: 'POST', actor: true },
  POST_LIKED: { category: 'COMMUNITY', target: 'POST', actor: true },
  COMMENT_REPLIED: { category: 'COMMUNITY', target: 'POST', actor: true },
  COMMENT_LIKED: { category: 'COMMUNITY', target: 'POST', actor: true },
  POST_HIDDEN: { category: 'COMMUNITY', target: 'POST', actor: false },
  COMMENT_HIDDEN: { category: 'COMMUNITY', target: 'POST', actor: false },
  GUESTBOOK_ENTRY_CREATED: { category: 'BURROW', target: 'GUESTBOOK', actor: true },
  GUESTBOOK_ENTRY_HIDDEN: { category: 'BURROW', target: 'BURROW', actor: false },
  NOTICE_PUBLISHED: { category: 'NOTICE', target: 'NOTICE', actor: false },
}
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_SPEC) as NotificationType[]

/** 요청 알림: 팝업의 최근 알림에서 빠지고 위의 요청 두 줄이 대신한다 */
export const REQUEST_TYPES: readonly NotificationType[] = ['MEETUP_APPLICATION_RECEIVED', 'CHAT_REQUEST_RECEIVED']

/* ===== 알림 한 줄 (팝업 · 목록 공용) ===== */
export interface NotificationTargetDto {
  type: NotificationTargetType
  /** 갈 곳의 id. GUESTBOOK 이면 null. BURROW 면 땅굴 주인의 계정 id */
  id: Id | null
  /** 모임 · 글 · 공지 · 모임 대화방의 이름. 그 밖이거나 원본이 사라졌으면 null */
  title: string | null
  /** 갈 곳이 모임일 때 시작 시각. 그 밖이거나 모임이 삭제됐으면 null */
  startsAt: UtcInstant | null
}
export interface NotificationDto {
  id: Id
  type: NotificationType
  category: NotificationCategory
  /** 알림을 일으킨 사람. 없거나 드러내지 않는 알림(거절 · 내보내기 · 가려짐 · 모임 수정/취소/삭제 …)은 null */
  actor: UserDisplayDto | null
  target: NotificationTargetDto
  isRead: boolean
  createdAt: UtcInstant
}

/* ===== GET /me/notifications/popup ===== */
export interface NotificationPopupDto {
  /** 내가 연 모임에 온, 아직 처리하지 않은 참여 신청 수 */
  meetupRequestCount: number
  /** 내가 받은, 아직 답하지 않은 대화 요청 수 */
  chatRequestCount: number
  /** 가장 최근에 대화 요청을 보낸 사람. 요청이 없으면 null */
  latestChatRequester: UserDisplayDto | null
  /** 최근 알림 5개까지 (요청 알림 제외, 안 읽은 것 먼저 → 최신순) */
  recentItems: NotificationDto[]
  unreadCount: number
}

/* ===== GET /me/notifications ===== */
export interface NotificationListQuery extends CursorQuery {
  /** 보내지 않으면 전체 */
  category?: NotificationCategory | null
}
// 응답은 CursorPageDto<NotificationDto> (common)

/* ===== 안 읽은 수 · 읽음 (GET unread-count, POST read, POST read-all 이 같은 모양) ===== */
export interface NotificationUnreadDto {
  /** 안 읽은 알림 수 (모든 갈래, 요청 알림 포함). 알림 화면의 "안 읽음 N" */
  unreadCount: number
  /** GNB 빨간 점 (지금 켜 둔 갈래의 안 읽은 알림이 있는지) */
  hasUnread: boolean
}

/* ===== 실시간 소식 (SSE) ===== */
export const NOTIFICATION_UNREAD_CHANGED = 'NOTIFICATION_UNREAD_CHANGED'
/** NOTIFICATION_UNREAD_CHANGED 의 값 (안 읽은 수 API 와 같은 모양). 새 알림의 내용은 담지 않는다 */
export type NotificationUnreadChangedEvent = NotificationUnreadDto
