import { createStore } from '../lib/store'
import { NOTIFICATION_TYPE_SPEC, type NotificationCategory, type NotificationType } from '../api/notifications/types'
import { ME_ID } from './mock'
import { findMeetup, startMs } from './meetupStore'

/**
 * F9 알림 — 목 서버의 "DB" (백엔드 명세 v1: docs/backend/team-spec/api/09-notification.md, db/notification.md)
 * 화면은 이 파일을 직접 읽지 않는다. api/notifications 의 훅 · 함수만 쓴다 (목 서버 api/notifications/mock.ts 가 이 저장소를 읽음)
 *
 * - 한 줄 = notification 테이블 한 줄: 종류(type) · 일으킨 사람(actorId) · 갈 곳 id(targetId) · 생긴 시각 · 읽은 시각.
 *   제목 · 보조 설명은 저장하지 않는다 (프론트가 type · actor · target.title 로 만든다 → api/notifications/mappers.ts)
 * - 지울 수 없고 읽음 처리만. 30일이 지난 알림은 어느 API 도 주지 않는다
 * - 설정 › 알림 설정에서 끈 갈래의 새 알림은 만들지 않는다. 끄기 전에 받은 알림은 목록에 남고, 빨간 점에만 빠진다
 * - 알림 설정 스위치(noticePrefs)는 10 설정 영역이 쓴다 (api/settings/mock.ts). 여기 두는 까닭은 "만들 때의 규칙"이 읽기 때문
 */
export type NoticeKind = '모임' | '채팅' | '게시판' | '땅굴' | '공지'
export const NOTICE_KINDS: NoticeKind[] = ['모임', '채팅', '게시판', '땅굴', '공지']

/** 갈래 ↔ 화면 이름 (탭 · 설정 스위치) */
export const KIND_OF_CATEGORY: Record<NotificationCategory, NoticeKind> = { MEETUP: '모임', CHAT: '채팅', COMMUNITY: '게시판', BURROW: '땅굴', NOTICE: '공지' }
export const CATEGORY_OF_KIND: Record<NoticeKind, NotificationCategory> = { 모임: 'MEETUP', 채팅: 'CHAT', 게시판: 'COMMUNITY', 땅굴: 'BURROW', 공지: 'NOTICE' }

/** 종류 아이콘 (원형 · 종류별 색 · 한 글자). 땅굴 색은 명세에 "디자인에서 정한다"라 이끼색으로 정함 */
export const KIND_META: Record<NoticeKind, { label: string; bg: string; desc: string }> = {
  모임: { label: '모', bg: '#A5532F', desc: '참여 신청, 수락, 일정, 빈자리 같은 모임 소식을 알려드려요.' },
  채팅: { label: '채', bg: '#5B8A72', desc: '새 메시지와 대화 요청을 알려드려요.' },
  게시판: { label: '게', bg: '#C28A2E', desc: '내 글과 댓글에 달린 댓글, 좋아요를 알려드려요.' },
  땅굴: { label: '땅', bg: '#7A8448', desc: '내 방명록에 새 글이 남겨지면 알려드려요.' },
  공지: { label: '공', bg: '#6B4533', desc: '서비스 공지를 알려드려요.' },
}

/** notification 한 줄 (목 DB). id · actorId · targetId 는 앱 id(문자열) — DTO 로 내보낼 때 숫자로 바꾼다 */
export interface NoticeRecord {
  id: string
  type: NotificationType
  /** 일으킨 사람. 드러내지 않는 종류는 null */
  actorId: string | null
  /** 갈 곳 id (모임 · 대화방 · 대화 요청 · 글 · 땅굴 주인 · 공지). GUESTBOOK 이면 null */
  targetId: string | null
  /** 생긴 시각 (ms) */
  at: number
  /** 읽은 시각 (ms). null 이면 안 읽음 */
  readAt: number | null
}

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
export const NOTICE_TTL_DAYS = 30

export const categoryOfType = (t: NotificationType): NotificationCategory => NOTIFICATION_TYPE_SPEC[t].category
export const kindOfType = (t: NotificationType): NoticeKind => KIND_OF_CATEGORY[categoryOfType(t)]

function seed(): NoticeRecord[] {
  const now = Date.now()
  const at = (m: number) => now - m * MIN
  const d = (n: number, h = 0) => now - n * DAY - h * HOUR
  // 일정 임박은 서버 예약 작업이 시작 24시간 전에 만든다 → 목 모임의 시작 시각에 맞춤
  const m4 = findMeetup('m4')
  const remindAt = m4 ? startMs(m4) - DAY : d(3)
  const N = (id: string, type: NotificationType, actorId: string | null, targetId: string | null, t: number, unread = false): NoticeRecord =>
    ({ id, type, actorId, targetId, at: t, readAt: unread ? null : t + HOUR })
  return [
    // 요청 알림 (알림 화면 목록에는 나오고, 팝업에서는 위의 요청 두 줄이 대신함)
    N('r1', 'MEETUP_APPLICATION_RECEIVED', 'yerin', 'm3', at(1), true),
    N('r2', 'CHAT_REQUEST_RECEIVED', 'seobeok', 'q1', at(12)),
    N('r3', 'CHAT_REQUEST_RECEIVED', 'ha', 'q2', at(60)),
    // 일반 알림
    N('n1', 'CHAT_MESSAGE_RECEIVED', 'mingu', 'r-mingu', at(10), true),
    N('n2', 'MEETUP_VACANCY_OPENED', null, 'm8', at(65), true),
    N('n6', 'GUESTBOOK_ENTRY_CREATED', 'seobeok', null, at(180)),
    N('n3', 'POST_COMMENTED', 'yejin', 'p6', d(1, 2)),
    N('n4', 'COMMENT_REPLIED', 'ha', 'p1', d(1, 5)),
    N('n5', 'MEETUP_APPLICATION_ACCEPTED', 'kim', 'm1', d(2)),
    N('n9', 'MEETUP_START_REMINDER', null, 'm4', now - remindAt < NOTICE_TTL_DAYS * DAY ? remindAt : d(3)),
    N('n7', 'CHAT_MESSAGE_RECEIVED', 'kim', 'g-m1', d(4)),
    N('n8', 'NOTICE_PUBLISHED', null, 'sn2', d(5)),
    // 원본이 사라진 알림: 줄은 남고(target.title = null), 누르면 그 화면의 조회 API 가 404 → 안내 화면
    N('n11', 'MEETUP_DELETED', null, 'x-deleted', d(6)),
    N('n10', 'MEETUP_UPDATED', null, 'm1', d(7)),
    N('n12', 'COMMENT_LIKED', 'seoyeon', 'p28', d(8)),
    N('n13', 'POST_LIKED', 'mingu', 'p16', d(9)),
    N('n14', 'POST_HIDDEN', null, 'p24', d(10)),
    N('n26', 'COMMENT_HIDDEN', null, 'p2', d(11)),
    N('n15', 'MEETUP_CANCELED', null, 'p4', d(12)),
    N('n27', 'GUESTBOOK_ENTRY_HIDDEN', null, 'yerin', d(13)),
    N('n16', 'CHAT_REQUEST_ACCEPTED', 'yerin', 'r-yerin', d(14)),
    N('n17', 'NOTICE_PUBLISHED', null, 'sn4', d(16)),
    N('n18', 'GUESTBOOK_ENTRY_CREATED', 'ha', null, d(18)),
    N('n19', 'MEETUP_APPLICATION_REJECTED', null, 'm9', d(20)),
    N('n20', 'MEETUP_VACANCY_OPENED', null, 'm6', d(21)),
    N('n21', 'COMMENT_LIKED', 'ha', 'p2', d(22)),
    N('n22', 'MEETUP_PARTICIPATION_CANCELED', 'yejin', 'm3', d(24)),
    N('n23', 'NOTICE_PUBLISHED', null, 'sn5', d(25)),
    N('n24', 'CHAT_MESSAGE_RECEIVED', 'yerin', 'r-yerin', d(27)),
    N('n25', 'MEETUP_KICKED', null, 'm2', d(28)),
    // 30일이 지나 어느 API 도 주지 않는 알림
    N('n99', 'MEETUP_APPLICATION_ACCEPTED', 'kim', 'm1', d(35)),
  ]
}

type Prefs = Record<NoticeKind, boolean>
const ALL_ON: Prefs = { 모임: true, 채팅: true, 게시판: true, 땅굴: true, 공지: true }

/** 알림 (메모리, 목 DB) */
export const noticeStore = createStore({ list: seed() })
/** 알림 설정 (F10, 브라우저에 저장. 10 설정 영역이 바꿈) */
export const noticePrefs = createStore({ kinds: ALL_ON, browserPush: false }, 'digul.noticePrefs.v2')

export const useNotices = () => noticeStore.use().list

/** 30일 안의 알림, 안 읽은 것 먼저 → 각각 최신순 (명세 "주는 방식") */
export function liveNotices(list: NoticeRecord[], now = Date.now()) {
  return list
    .filter((n) => now - n.at < NOTICE_TTL_DAYS * DAY)
    .sort((a, b) => Number(a.readAt != null) - Number(b.readAt != null) || b.at - a.at)
}

/** 안 읽은 수 (모든 갈래) + 빨간 점 (지금 켜 둔 갈래의 안 읽은 알림이 있는지) */
export function unreadOf(list: NoticeRecord[], kinds: Prefs, now = Date.now()) {
  const unread = liveNotices(list, now).filter((n) => n.readAt == null)
  return { unreadCount: unread.length, hasUnread: unread.some((n) => kinds[kindOfType(n.type)] !== false) }
}

/* ===== 쓰기 (목 서버 · 다른 영역의 목이 부름) ===== */
let seq = 0
/**
 * 새 알림 만들기 (명세 "알림을 만들 때의 규칙")
 * - 자기 자신이 한 일이면 만들지 않음 · 꺼 둔 갈래면 만들지 않음 → null
 * - 새 메시지(CHAT_MESSAGE_RECEIVED)는 대화방마다 안 읽은 한 줄: 이미 있으면 시각 · 보낸 사람만 바꿈
 */
export function addNotice(n: { type: NotificationType; actorId?: string | null; targetId?: string | null; at?: number }): NoticeRecord | null {
  const actorId = NOTIFICATION_TYPE_SPEC[n.type].actor ? n.actorId ?? null : null
  if (actorId === ME_ID) return null
  if (noticePrefs.get().kinds[kindOfType(n.type)] === false) return null
  const at = n.at ?? Date.now()
  const targetId = n.targetId ?? null
  if (n.type === 'CHAT_MESSAGE_RECEIVED') {
    const open = noticeStore.get().list.find((x) => x.type === n.type && x.targetId === targetId && x.readAt == null)
    if (open) {
      const next = { ...open, at, actorId }
      noticeStore.set((s) => ({ list: s.list.map((x) => (x.id === open.id ? next : x)) }))
      return next
    }
  }
  const item: NoticeRecord = { id: `x${Date.now().toString(36)}${(seq++).toString(36)}`, type: n.type, actorId, targetId, at, readAt: null }
  noticeStore.set((s) => ({ list: [item, ...s.list] }))
  return item
}

/** 하나 읽음. 없으면(남의 것 · 30일 지남 포함) false */
export function markNoticeRead(id: string, now = Date.now()): boolean {
  const hit = liveNotices(noticeStore.get().list, now).find((n) => n.id === id)
  if (!hit) return false
  if (hit.readAt == null) noticeStore.set((s) => ({ list: s.list.map((n) => (n.id === id ? { ...n, readAt: now } : n)) }))
  return true
}
export function markAllNoticesRead(now = Date.now()) {
  if (!noticeStore.get().list.some((n) => n.readAt == null)) return
  noticeStore.set((s) => ({ list: s.list.map((n) => (n.readAt == null ? { ...n, readAt: now } : n)) }))
}
/** 그 대화방을 읽으면 그 방의 안 읽은 새 메시지 알림도 읽음 (명세 "새 메시지 알림") */
export function markChatNoticesRead(roomId: string, now = Date.now()) {
  if (!noticeStore.get().list.some((n) => n.type === 'CHAT_MESSAGE_RECEIVED' && n.targetId === roomId && n.readAt == null)) return
  noticeStore.set((s) => ({ list: s.list.map((n) => (n.type === 'CHAT_MESSAGE_RECEIVED' && n.targetId === roomId && n.readAt == null ? { ...n, readAt: now } : n)) }))
}

export function setNoticeKind(kind: NoticeKind, on: boolean) {
  noticePrefs.set((s) => ({ kinds: { ...s.kinds, [kind]: on } }))
}
export function setBrowserPush(on: boolean) { noticePrefs.set({ browserPush: on }) }
