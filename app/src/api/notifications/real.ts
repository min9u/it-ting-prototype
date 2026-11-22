/**
 * 09 알림 — 실제 서버 호출. 명세: docs/backend/team-spec/api/09-notification.md
 * 실시간 빨간 점은 SSE 의 NOTIFICATION_UNREAD_CHANGED (realtime/eventStream.ts). 알림 설정 · 공지사항은 10 설정(api/settings)
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다
 */
import { http } from '../client'
import type { LegacyId as Id } from '../common/legacy'
import type { NotificationCategory, NotificationPageDto } from './types'

export const ENDPOINTS: readonly string[] = []

export interface NotificationQuery { category?: NotificationCategory; cursor?: string | null; size?: number }

export const real = {
  /** GET /notifications — 최근 30일, 안 읽은 것 먼저 → 최신순 (커서) */
  list: (q: NotificationQuery, signal?: AbortSignal) => http.get<NotificationPageDto>('/notifications', { ...q }, signal),
  /** GET /notifications/unread-count — GNB 빨간 점 */
  unreadCount: (signal?: AbortSignal) => http.get<{ count: number }>('/notifications/unread-count', undefined, signal),
  /** PATCH /notifications/{id}/read */
  markRead: (id: Id) => http.patch<void>(`/notifications/${id}/read`),
  /** PATCH /notifications/read-all (category 를 주면 그 종류만) */
  markAllRead: (category?: NotificationCategory) => http.patch<void>('/notifications/read-all', category ? { category } : undefined),
}
export type NotificationsApi = typeof real
