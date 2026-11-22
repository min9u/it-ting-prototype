/**
 * 09 알림 — 목 서버. data/notifications.ts 를 가짜 DB 로 씀
 * 실시간 빨간 점은 realtime/eventStream.ts 의 mockEvents.emit('NOTIFICATION_UNREAD_CHANGED', { unreadCount, hasUnread }) 로 흉내 낼 수 있다
 */
import { cursorPage, mockRead, mockWrite, notFound } from '../mock/server'
import { ME_ID } from '../../data/mock'
import { markAllNoticesRead, markNoticeRead, noticePrefs, noticeStore, visibleNotices, type AppNotice, type NoticeKind } from '../../data/notifications'
import { toIso } from '../../lib/time'
import { KIND_CATEGORY } from './mappers'
import type { NotificationsApi } from './real'
import type { NotificationCategory, NotificationDto, NotificationTargetType, NotificationType } from './types'

const HOUR = 3_600_000

/* ===== 직렬화 (저장소 → DTO) ===== */
const KIND_CAT: Record<NoticeKind, NotificationCategory> = { 모임: 'MEETUP', 채팅: 'CHAT', 커뮤니티: 'COMMUNITY', 땅굴: 'BURROW', 공지: 'NOTICE' }
/** 명세 "알림 종류" 세부 이름 → type (erd-gaps "알림 type 후보") */
export const NOTICE_TYPE: Record<string, NotificationType> = {
  '참여 신청 받음': 'MEETUP_APPLICATION_RECEIVED', '신청 수락': 'MEETUP_APPLICATION_APPROVED', '신청 미승인': 'MEETUP_APPLICATION_REJECTED',
  '참여 취소': 'MEETUP_MEMBER_LEFT', '모임에서 내보내짐': 'MEETUP_KICKED', '모임 정보 수정': 'MEETUP_UPDATED', '모임 취소': 'MEETUP_CANCELED',
  '모임 일정 임박': 'MEETUP_STARTING_SOON', '빈자리 생김': 'MEETUP_VACANCY',
  '새 메시지': 'CHAT_MESSAGE', '대화 요청': 'CHAT_REQUEST_RECEIVED', '대화 요청 수락': 'CHAT_REQUEST_ACCEPTED',
  '내 글에 댓글': 'POST_COMMENTED', '내 댓글의 답글': 'COMMENT_REPLIED', '내 글 좋아요': 'POST_LIKED', '댓글 좋아요': 'COMMENT_LIKED',
  '답글 좋아요': 'REPLY_LIKED', '신고로 가려짐': 'POST_HIDDEN',
  // 11-20 명세의 두 종류
  '내 댓글 신고로 가려짐': 'COMMENT_HIDDEN', '방명록 글 신고로 가려짐': 'GUESTBOOK_HIDDEN',
  '방명록 새 글': 'GUESTBOOK_WRITTEN', '서비스 공지': 'SERVICE_NOTICE',
}
const GONE_TARGET: Record<string, NotificationTargetType> = { meetup: 'MEETUP', post: 'POST', burrow: 'BURROW', chat: 'CHAT_ROOM', notice: 'NOTICE' }
/** 저장소의 이동 주소 → (대상 종류, id). 실제 서버는 notification.target_type · target_id 를 그대로 줌 */
function targetOf(n: AppNotice): { targetType: NotificationTargetType; targetId: string | null } {
  if (n.gone) return { targetType: GONE_TARGET[n.gone], targetId: null }
  const to = n.to
  let m: RegExpExecArray | null
  if ((m = /manage=([^&]+)/.exec(to))) return { targetType: 'MEETUP', targetId: m[1] }
  if ((m = /^\/meetups\/([^/?]+)/.exec(to)) && m[1] !== 'me') return { targetType: 'MEETUP', targetId: m[1] }
  if (to.startsWith('/chat/requests')) return { targetType: 'CHAT_REQUEST', targetId: null }
  if ((m = /^\/chat\/([^/?]+)/.exec(to))) return { targetType: 'CHAT_ROOM', targetId: m[1] }
  if ((m = /^\/board\/([^/?#]+)/.exec(to))) return { targetType: 'POST', targetId: m[1] }
  if ((m = /^\/settings\/notices\/([^/?]+)/.exec(to))) return { targetType: 'NOTICE', targetId: m[1] }
  if (to.startsWith('/burrow')) return { targetType: 'BURROW', targetId: ME_ID }
  return { targetType: 'NOTICE', targetId: null }
}
export function notificationDto(n: AppNotice): NotificationDto {
  const t = targetOf(n)
  return {
    id: n.id, type: NOTICE_TYPE[n.type] ?? 'SERVICE_NOTICE', category: KIND_CAT[n.kind], ...t, targetExists: !n.gone,
    actor: null, title: n.title, body: n.sub, readAt: n.unread ? null : toIso(n.at + HOUR), createdAt: toIso(n.at),
  }
}

/* ===== 목 서버 ===== */
const KIND_OF = Object.fromEntries(Object.entries(KIND_CATEGORY).map(([k, v]) => [v, k])) as Record<NotificationCategory, NoticeKind>

export const mock: NotificationsApi = {
  list: (q, signal) => mockRead(() => {
    const visible = visibleNotices(noticeStore.get().list, noticePrefs.get().kinds)
    const inTab = q.category ? visible.filter((n) => n.kind === KIND_OF[q.category!]) : visible
    return { ...cursorPage(inTab.map(notificationDto), q.cursor, q.size ?? 20), unreadCount: visible.filter((n) => n.unread).length }
  }, { signal, empty: () => ({ items: [], nextCursor: null, hasNext: false, unreadCount: 0 }) }),
  unreadCount: (signal) => mockRead(() => ({ count: visibleNotices(noticeStore.get().list, noticePrefs.get().kinds).filter((n) => n.unread).length }), { signal }),
  markRead: (id) => mockWrite(() => { if (!noticeStore.get().list.some((n) => n.id === id)) throw notFound('NOTIFICATION', '알림을 찾을 수 없습니다.'); markNoticeRead(id) }),
  markAllRead: () => mockWrite(() => markAllNoticesRead()),
}
