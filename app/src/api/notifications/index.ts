/**
 * 09 알림 영역 입구. 화면은 여기서: import { useNotificationList, useReadNotification, … } from '../../api/notifications'
 * 이 폴더(api/notifications/)는 알림 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md · 정리: docs/backend/api-v1/09-notification.md
 *
 * 다른 영역의 목 서버가 알림을 만들 때 (명세 "알림의 종류"의 만드는 때를 흉내):
 *   import { pushMockNotification } from '../notifications'
 *   pushMockNotification('MEETUP_APPLICATION_ACCEPTED', { actorId: hostId, targetId: meetupId })
 * 대화방을 읽으면 그 방의 새 메시지 알림도 읽음 (06 읽음 API 의 목에서):
 *   markMockChatNotificationsRead(roomId)
 */
export * from './types'
export { ENDPOINTS, type NotificationsApi } from './real'
export { notificationsApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
export { pushMockNotification, notifyMockUser } from './mock'
export { markChatNoticesRead as markMockChatNotificationsRead } from '../../data/notifications'
