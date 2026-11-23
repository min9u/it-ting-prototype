/**
 * 09 알림 — code → 화면 문구 (명세 09-notification.md "에러"). 공통 코드는 common/errors.ts
 * 이 영역의 고유 코드는 POST /notifications/{notificationId}/read 의 404 하나뿐이다
 */
import type { ErrorTable } from '../common/errors'

export const NOTIFICATION_ERRORS: ErrorTable = {
  NOTIFICATION_NOT_FOUND: '이미 사라진 알림이에요. 알림은 30일 동안만 보관돼요.',
}
