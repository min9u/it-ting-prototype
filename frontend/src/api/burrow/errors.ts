/**
 * 04 내 땅굴 — code → 화면 문구. 공통 코드(INVALID_INPUT · FORBIDDEN · NEW_TERM_INCOMPLETE …)는 common/errors.ts
 * 명세: 04-my-burrow.md "에러". 화면은 code 로만 가른다
 */
import type { ErrorTable } from '../common/errors'

export const BURROW_ERRORS: ErrorTable = {
  /** 내 정보 저장 · 닉네임 확인: 다른 사람이 쓰고 있거나 맡아 둔 닉네임 */
  NICKNAME_DUPLICATED: '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 적어 주세요',
  /** 내 정보 저장: 없거나 지운 캠퍼스-층 */
  CAMPUS_FLOOR_NOT_FOUND: '고른 캠퍼스 · 층이 지금은 없어요. 다시 골라 주세요.',
  /** 내 정보 저장: 지운 관심사가 섞임 */
  INTEREST_NOT_FOUND: '고른 관심사 가운데 지금은 없는 것이 있어요. 관심사를 다시 골라 주세요.',
  /** 내 정보 저장: 없는 질문 */
  INTRO_QUESTION_NOT_FOUND: '고른 질문 가운데 지금은 없는 것이 있어요. 질문을 다시 골라 주세요.',
  /** 방명록 목록: 없는 땅굴 (주인이 탈퇴한 땅굴도) */
  BURROW_NOT_FOUND: '없는 땅굴이에요.',
  /** 방명록 삭제: 없는 글 · 이미 지운 글 · 신고로 가려진 글 */
  GUESTBOOK_ENTRY_NOT_FOUND: '이미 지워졌거나 볼 수 없는 방명록이에요.',
  /** 방명록 삭제: 주인도 쓴 사람도 아님 */
  FORBIDDEN: '이 방명록은 지울 수 없어요.',
}
