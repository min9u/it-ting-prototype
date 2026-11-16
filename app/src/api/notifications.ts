/**
 * 알림 (F9) · 알림 설정 (F10) · 공지사항. 계약: docs/backend/api-draft.md "알림"
 * 목 구현은 data/notifications.ts · data/serviceNotices.ts 를 가짜 서버로 씀
 * 새 알림이 오는 것은 실시간(STOMP /user/queue/notifications) → 다른 작업. 여기서는 목록·읽음만
 */
import { API_MODE } from './config'
import { http } from './client'
import { cursorPage, mockRead, mockWrite, notFound } from './mock/server'
import { notificationDto } from './mock/serialize'
import { KIND_CATEGORY } from './mappers'
import {
  markAllNoticesRead, markNoticeRead, noticePrefs, noticeStore, setBrowserPush, setNoticeKind, visibleNotices, type NoticeKind,
} from '../data/notifications'
import { serviceNoticeOf, serviceNoticeStore } from '../data/serviceNotices'
import { ymdMs, toIso } from '../lib/time'
import type { Id, NoticeCategory, NoticeDto, NotificationCategory, NotificationPageDto, NotificationSettingDto } from './types'

export interface NotificationQuery { category?: NotificationCategory; cursor?: string | null; size?: number }

const real = {
  /** GET /notifications — 최근 30일, 안 읽은 것 먼저 → 최신순 (커서) */
  list: (q: NotificationQuery, signal?: AbortSignal) => http.get<NotificationPageDto>('/notifications', { ...q }, signal),
  /** GET /notifications/unread-count — GNB 빨간 점 */
  unreadCount: (signal?: AbortSignal) => http.get<{ count: number }>('/notifications/unread-count', undefined, signal),
  /** PATCH /notifications/{id}/read */
  markRead: (id: Id) => http.patch<void>(`/notifications/${id}/read`),
  /** PATCH /notifications/read-all (category 를 주면 그 종류만) */
  markAllRead: (category?: NotificationCategory) => http.patch<void>('/notifications/read-all', category ? { category } : undefined),
  getSettings: (signal?: AbortSignal) => http.get<NotificationSettingDto>('/me/notification-settings', undefined, signal),
  updateSettings: (patch: Partial<NotificationSettingDto>) => http.patch<NotificationSettingDto>('/me/notification-settings', patch),
  /** GET /notices — 공지사항 (번호 페이지로도 충분하지만 개수가 적어 전체) */
  notices: (signal?: AbortSignal) => http.get<NoticeDto[]>('/notices', undefined, signal),
  notice: (id: Id, signal?: AbortSignal) => http.get<NoticeDto>(`/notices/${id}`, undefined, signal),
}
export type NotificationsApi = typeof real

/* ===== 목 서버 ===== */
const KIND_OF = Object.fromEntries(Object.entries(KIND_CATEGORY).map(([k, v]) => [v, k])) as Record<NotificationCategory, NoticeKind>
const NOTICE_CAT: Record<string, NoticeCategory> = { 공지: 'NOTICE', 업데이트: 'UPDATE', 이벤트: 'EVENT' }
const settingsOf = (): NotificationSettingDto => {
  const p = noticePrefs.get()
  return { meetupOn: p.kinds.모임, chatOn: p.kinds.채팅, communityOn: p.kinds.커뮤니티, burrowOn: p.kinds.땅굴, noticeOn: p.kinds.공지, browserPushOn: p.browserPush }
}
const noticeDto = (n: { id: string; cat: string; title: string; date: string; body: string[] }): NoticeDto =>
  ({ id: n.id, category: NOTICE_CAT[n.cat] ?? 'NOTICE', title: n.title, content: n.body.join('\n'), createdAt: toIso(ymdMs(n.date.replace(/\./g, '-'))) })

const mock: NotificationsApi = {
  list: (q, signal) => mockRead(() => {
    const visible = visibleNotices(noticeStore.get().list, noticePrefs.get().kinds)
    const inTab = q.category ? visible.filter((n) => n.kind === KIND_OF[q.category!]) : visible
    return { ...cursorPage(inTab.map(notificationDto), q.cursor, q.size ?? 20), unreadCount: visible.filter((n) => n.unread).length }
  }, { signal, empty: () => ({ items: [], nextCursor: null, unreadCount: 0 }) }),
  unreadCount: (signal) => mockRead(() => ({ count: visibleNotices(noticeStore.get().list, noticePrefs.get().kinds).filter((n) => n.unread).length }), { signal }),
  markRead: (id) => mockWrite(() => { if (!noticeStore.get().list.some((n) => n.id === id)) throw notFound('알림'); markNoticeRead(id) }),
  markAllRead: () => mockWrite(() => markAllNoticesRead()),
  getSettings: (signal) => mockRead(settingsOf, { signal }),
  updateSettings: (patch) => mockWrite(() => {
    const map: [keyof NotificationSettingDto, NoticeKind][] = [['meetupOn', '모임'], ['chatOn', '채팅'], ['communityOn', '커뮤니티'], ['burrowOn', '땅굴'], ['noticeOn', '공지']]
    for (const [k, kind] of map) if (patch[k] != null) setNoticeKind(kind, !!patch[k])
    if (patch.browserPushOn != null) setBrowserPush(patch.browserPushOn)
    return settingsOf()
  }),
  notices: (signal) => mockRead(() => serviceNoticeStore.get().list.map(noticeDto), { signal, empty: () => [] }),
  notice: (id, signal) => mockRead(() => { const n = serviceNoticeOf(id); if (!n) throw notFound('공지'); return noticeDto(n) }, { signal, detail: true }),
}

export const notifications: NotificationsApi = API_MODE === 'real' ? real : mock
