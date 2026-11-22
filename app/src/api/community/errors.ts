/**
 * 08 커뮤니티 (+ 신고) — code → 화면 문구. 공통 코드는 common/errors.ts
 * 지금은 초안 목 서버가 던지는 코드. 커뮤니티 작업자가 명세(08-community.md "에러")의 코드로 바꾼다
 */
import type { ErrorTable } from '../common/errors'

export const COMMUNITY_ERRORS: ErrorTable = {
  POST_NOT_FOUND: '삭제된 글이에요.',
  POST_DELETED: '삭제된 글이에요.',
  POST_HIDDEN: '신고로 가려진 글이에요.',
  COMMENT_NOT_FOUND: '삭제된 댓글이에요.',
  ALREADY_REPORTED: '이미 신고했어요.',
}
