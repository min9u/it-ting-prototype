/**
 * 09 알림 — 목 서버 (명세 모양 그대로). 가짜 DB 는 data/notifications.ts (notification 테이블 한 줄 = NoticeRecord)
 *
 * - target.title · startsAt 은 서버처럼 원본(모임 · 글 · 공지 · 모임 대화방 저장소)에서 그때그때 읽는다. 원본이 없으면 null
 * - 실시간 소식: 알림 저장소나 알림 설정이 바뀌어 { unreadCount, hasUnread } 가 달라지면
 *   mockEvents.emit('NOTIFICATION_UNREAD_CHANGED', …) — 서버가 "새 알림이 생겼거나 읽어서 수가 바뀌었을 때" 보내는 것과 같다
 *   (installMockNotificationServer, 목 모드에서 api/mockSync 가 부르는 useNotificationsMockSync 가 켬)
 * - 다른 영역의 목이 알림을 만들 때: pushMockNotification(type, { actorId, targetId }) (index.ts 에서 내보냄)
 */
import { cursorPage, emptyCursor, mockRead, mockWrite, notFound } from '../mock/server'
import { toAppId, toDtoId, toDtoIdOrNull } from '../common/ids'
import { userDisplay } from '../common/mockPeople'
import { mockEvents } from '../../realtime/events'
import { ME_ID } from '../../data/mock'
import {
  addNotice, categoryOfType, liveNotices, markAllNoticesRead, markNoticeRead, noticePrefs, noticeStore, unreadOf,
  type NoticeRecord,
} from '../../data/notifications'
import { applicantsOf, deadlinePassed, findMeetup, getMeetupState, isPast, startMs } from '../../data/meetupStore'
import { getChatState, liveRequests, roomOf } from '../../data/chat'
import { getPost } from '../../data/boardStore'
import { serviceNoticeOf } from '../../data/serviceNotices'
import { toIso } from '../../lib/time'
import { toAppNotice } from './mappers'
import type { NotificationsApi } from './real'
import {
  NOTIFICATION_TYPE_SPEC, NOTIFICATION_UNREAD_CHANGED, REQUEST_TYPES,
  type NotificationDto, type NotificationPopupDto, type NotificationTargetDto, type NotificationType, type NotificationUnreadDto,
} from './types'

/* ===== 직렬화 (목 DB → DTO) ===== */
/** 갈 곳의 이름 · 시작 시각 (서버: meetup.title · post_version.title · notice.title · meetup.starts_at) */
function targetOf(n: NoticeRecord): NotificationTargetDto {
  const type = NOTIFICATION_TYPE_SPEC[n.type].target
  const id = type === 'GUESTBOOK' ? null : toDtoIdOrNull(n.targetId)
  let title: string | null = null
  let startsAt: string | null = null
  if (n.targetId) {
    switch (type) {
      case 'MEETUP': {
        const m = findMeetup(n.targetId)
        if (m) { title = m.title; startsAt = toIso(startMs(m)) }
        break
      }
      case 'CHAT_ROOM': {
        const r = roomOf(n.targetId)
        if (r?.kind === 'group' && r.meetupId) title = findMeetup(r.meetupId)?.title ?? null
        break
      }
      case 'POST': {
        const p = getPost(n.targetId)
        if (p && p.status !== 'deleted') title = p.title
        break
      }
      case 'NOTICE': title = serviceNoticeOf(n.targetId)?.title ?? null; break
    }
  }
  return { type, id, title, startsAt }
}

export function notificationDto(n: NoticeRecord): NotificationDto {
  const spec = NOTIFICATION_TYPE_SPEC[n.type]
  return {
    id: toDtoId(n.id), type: n.type, category: spec.category,
    actor: spec.actor && n.actorId ? userDisplay(n.actorId) : null,
    target: targetOf(n), isRead: n.readAt != null, createdAt: toIso(n.at),
  }
}

const currentUnread = (): NotificationUnreadDto => unreadOf(noticeStore.get().list, noticePrefs.get().kinds)

/** 모임 참여 요청 수: 내가 연, 취소 · 삭제되지 않고 모집 마감 · 시작 전인 모임의 처리 안 된 신청 */
function meetupRequestCount() {
  const s = getMeetupState()
  return s.list
    .filter((m) => m.hostId === ME_ID && !m.cancelled && !isPast(m) && !deadlinePassed(m))
    .reduce((a, m) => a + applicantsOf(m.id, s).length, 0)
}

/* ===== 실시간 소식 흉내 ===== */
let installed = false
/**
 * 목 서버의 "보내기": 안 읽은 수 · 빨간 점이 바뀌면 NOTIFICATION_UNREAD_CHANGED, 새 알림이면 (허용했을 때) 브라우저 알림.
 * 저장소를 지켜보므로 누가 알림을 만들든(pushMockNotification · 다른 영역 목 · 관리자 공지) 같은 길로 나간다. 여러 번 불러도 한 번만 켬
 */
export function installMockNotificationServer() {
  if (installed) return
  installed = true
  let last = currentUnread()
  let known = new Set(noticeStore.get().list.map((n) => n.id))
  const check = () => {
    const list = noticeStore.get().list
    const fresh = list.filter((n) => !known.has(n.id))
    known = new Set(list.map((n) => n.id))
    const u = currentUnread()
    if (u.unreadCount !== last.unreadCount || u.hasUnread !== last.hasUnread) {
      last = u
      mockEvents.emit(NOTIFICATION_UNREAD_CHANGED, u)
    }
    for (const n of fresh) browserPush(n)
  }
  noticeStore.subscribe(check)
  noticePrefs.subscribe(check)
}

/** 브라우저 푸시 흉내 (설정 › 브라우저 알림 받기를 켜고 권한을 줬을 때). 실제로는 서버가 웹 푸시로 보냄 */
function browserPush(n: NoticeRecord) {
  const p = noticePrefs.get()
  if (!p.browserPush || n.readAt != null || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const a = toAppNotice(notificationDto(n))
  try { new Notification(a.title, { body: a.sub }) } catch { /* 무시 */ }
}

/**
 * 다른 영역의 목 서버가 "서버가 알림을 만드는 것"을 흉내 낼 때 (명세 "알림의 종류"의 만드는 때).
 *   pushMockNotification('POST_COMMENTED', { actorId: 'yerin', targetId: 'p6' })
 *   pushMockNotification('GUESTBOOK_ENTRY_CREATED', { actorId: 'ha' })   // 갈 곳 id 없음
 *   pushMockNotification('CHAT_MESSAGE_RECEIVED', { actorId: 'mingu', targetId: 'r-mingu' })  // 대화방마다 한 줄로 묶임
 * 받는 사람은 늘 나(목 계정). 자기 자신이 한 일 · 꺼 둔 갈래는 만들지 않고 null. 실시간 소식은 자동으로 나간다
 */
export function pushMockNotification(type: NotificationType, o: { actorId?: string | null; targetId?: string | null } = {}) {
  installMockNotificationServer()
  return addNotice({ type, actorId: o.actorId, targetId: o.targetId })
}

/**
 * 받는 사람이 정해진 알림 (명세 "알림의 종류"의 받는 사람). 목에서 알림을 볼 수 있는 계정은 나 하나라서,
 * 받는 사람이 나일 때만 만든다. 다른 영역 목의 "다른 사람이 한 일" 흉내가 부름 (예: 누가 내 모임에 신청 → 주최자 = 나)
 */
export function notifyMockUser(receiverId: string, type: NotificationType, o: { actorId?: string | null; targetId?: string | null } = {}) {
  return receiverId === ME_ID ? pushMockNotification(type, o) : null
}

/* ===== 목 서버 ===== */
export const mock: NotificationsApi = {
  popup: (signal) => mockRead((): NotificationPopupDto => {
    installMockNotificationServer()
    const received = liveRequests(getChatState()).filter((r) => r.direction === 'received')
    return {
      meetupRequestCount: meetupRequestCount(),
      chatRequestCount: received.length,
      latestChatRequester: received[0] ? userDisplay(received[0].userId) : null,
      recentItems: liveNotices(noticeStore.get().list).filter((n) => !REQUEST_TYPES.includes(n.type)).slice(0, 5).map(notificationDto),
      unreadCount: currentUnread().unreadCount,
    }
  }, { signal, empty: () => ({ meetupRequestCount: 0, chatRequestCount: 0, latestChatRequester: null, recentItems: [], unreadCount: 0 }) }),

  list: (q, signal) => mockRead(() => {
    installMockNotificationServer()
    const size = Math.min(50, Math.max(1, q.size ?? 20))
    const all = liveNotices(noticeStore.get().list).filter((n) => !q.category || categoryOfType(n.type) === q.category)
    return cursorPage(all.map(notificationDto), q.cursor, size)
  }, { signal, empty: () => emptyCursor<NotificationDto>() }),

  unreadCount: (signal) => mockRead(() => { installMockNotificationServer(); return currentUnread() }, { signal, empty: () => ({ unreadCount: 0, hasUnread: false }) }),

  read: (notificationId) => mockWrite(() => {
    if (!markNoticeRead(toAppId(notificationId))) throw notFound('NOTIFICATION', '알림을 찾을 수 없습니다.')
    return currentUnread()
  }),

  readAll: () => mockWrite(() => { markAllNoticesRead(); return currentUnread() }),
}
