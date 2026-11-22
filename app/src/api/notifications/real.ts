/**
 * 09 알림 — 실제 서버 호출. 명세: docs/backend/team-spec/api/09-notification.md
 * 빨간 점 · "안 읽음 N" 이 바로 바뀌는 것은 SSE 소식 NOTIFICATION_UNREAD_CHANGED (queries.ts useNotificationRealtime).
 * 알림 설정 · 브라우저 푸시 · 공지사항은 10 설정(api/settings)
 */
import { http, seg } from '../client'
import type { CursorPageDto, Id } from '../common/types'
import type { NotificationDto, NotificationListQuery, NotificationPopupDto, NotificationUnreadDto } from './types'

/** 이 영역이 명세대로 구현한 API (src/tests/api-v1-endpoints.test.ts) */
export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/me/notifications/popup',
  'GET /api/v1/me/notifications',
  'GET /api/v1/me/notifications/unread-count',
  'POST /api/v1/notifications/{notificationId}/read',
  'POST /api/v1/me/notifications/read-all',
]

export const real = {
  /** GET /me/notifications/popup — 요청 두 줄의 수 · 최근 대화 요청자 · 최근 알림 5개 · 안 읽은 수 */
  popup: (signal?: AbortSignal) => http.get<NotificationPopupDto>('/me/notifications/popup', undefined, signal),
  /** GET /me/notifications — 갈래별, 안 읽은 것 먼저 → 최신순, 커서 (기본 20개) */
  list: (q: NotificationListQuery, signal?: AbortSignal) =>
    http.get<CursorPageDto<NotificationDto>>('/me/notifications', { category: q.category ?? undefined, size: q.size, cursor: q.cursor ?? undefined }, signal),
  /** GET /me/notifications/unread-count — 안 읽은 수 + GNB 빨간 점 */
  unreadCount: (signal?: AbortSignal) => http.get<NotificationUnreadDto>('/me/notifications/unread-count', undefined, signal),
  /** POST /notifications/{notificationId}/read — 하나 읽음. 이미 읽었어도 성공. 404 NOTIFICATION_NOT_FOUND */
  read: (notificationId: Id) => http.post<NotificationUnreadDto>(`/notifications/${seg(notificationId)}/read`),
  /** POST /me/notifications/read-all — 갈래와 상관없이 모두 읽음 (요청 두 줄의 수는 그대로) */
  readAll: () => http.post<NotificationUnreadDto>('/me/notifications/read-all'),
}
export type NotificationsApi = typeof real
