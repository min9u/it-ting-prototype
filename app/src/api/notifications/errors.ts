/**
 * 09 알림 — code → 화면 문구. 공통 코드는 common/errors.ts
 * 알림 작업자가 명세(09-notification.md "에러")의 코드로 채운다
 */
import type { ErrorTable } from '../common/errors'

export const NOTIFICATION_ERRORS: ErrorTable = {
  NOTIFICATION_NOT_FOUND: '이미 지워진 알림이에요.',
}
