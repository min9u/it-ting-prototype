/**
 * 07 모임 — code → 화면 문구. 공통 코드는 common/errors.ts. 화면: errorText(e, MEETUP_ERRORS) 또는 useOptimistic({ errors: MEETUP_ERRORS })
 * 지금은 초안 목 서버가 던지는 코드. 모임 작업자가 명세(07-meetup.md "에러")의 코드로 바꾼다
 */
import type { ErrorTable } from '../common/errors'

export const MEETUP_ERRORS: ErrorTable = {
  MEETUP_NOT_FOUND: '삭제된 모임이에요.',
  MEETUP_FULL: '정원이 다 찼어요.',
  REAPPLY_BLOCKED: '이 모임에는 다시 신청할 수 없어요.',
  NOT_PENDING: '확인을 기다리는 신청이 없어요.',
  LEAVE_TOO_LATE: '시작 24시간 전부터는 참여를 취소할 수 없어요.',
  EDIT_TOO_LATE: '시작 12시간 전부터는 고칠 수 없어요.',
  ALREADY_REPORTED: '이미 신고한 모임이에요.',
}
