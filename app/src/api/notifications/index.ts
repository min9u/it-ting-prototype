/**
 * 09 알림 영역 입구. 화면은 여기서: import { notificationsApi, useNotificationList, notificationKeys } from '../../api/notifications'
 * 이 폴더(api/notifications/)는 알림 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type NotificationQuery, type NotificationsApi } from './real'
export { notificationsApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
