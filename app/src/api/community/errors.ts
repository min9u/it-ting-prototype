/**
 * 08 커뮤니티 (+ 신고 · 사진) — code → 화면 문구. 명세 08-community.md 의 "에러" 표. 공통 코드는 common/errors.ts
 * 화면은 code 로만 가른다 (POST_NOT_FOUND → 삭제된 글 안내, POST_HIDDEN → 가려진 글 안내, ALREADY_REPORTED → "이미 신고했어요")
 */
import type { ErrorTable } from '../common/errors'

export const COMMUNITY_ERRORS: ErrorTable = {
  POST_NOT_FOUND: '삭제된 글이에요.',
  POST_HIDDEN: '신고로 가려진 글이에요.',
  POST_EDIT_NOT_ALLOWED: '신고로 가려진 글은 수정할 수 없어요.',
  COMMENT_NOT_FOUND: '삭제되었거나 가려진 댓글이에요.',
  COMMENT_EDIT_NOT_ALLOWED: '신고로 가려진 댓글은 수정할 수 없어요.',
  MEETUP_NOT_FOUND: '연결하려는 모임이 없어졌어요. 다른 모임을 골라 주세요.',
  MEETUP_NOT_LINKABLE: '이 카테고리의 글에는 연결할 수 없는 모임이에요. 다른 모임을 골라 주세요.',
  FORBIDDEN: '내가 쓴 글과 댓글만 고치거나 지울 수 있어요.',
  // 신고 (POST /reports)
  ALREADY_REPORTED: '이미 신고했어요.',
  OWN_TARGET_NOT_ALLOWED: '내 글이나 댓글, 나 자신은 신고할 수 없어요.',
  REPORT_TARGET_NOT_FOUND: '신고할 대상이 없어졌어요. 이미 삭제되었거나 가려졌을 수 있어요.',
}
