/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) — code → 화면 문구. 공통 코드(INVALID_INPUT · INTERNAL_ERROR …)는 common/errors.ts
 * 명세: 03-onboarding.md "에러", 00-common.md GET /users/{userId}/profile "에러". 화면은 code 로만 가른다
 */
import type { ErrorTable } from '../common/errors'

export const ONBOARDING_ERRORS: ErrorTable = {
  /** 00 프로필 팝업: 없는 사람 · 탈퇴 · 가입을 마치지 않은 사람 */
  USER_NOT_FOUND: '탈퇴했거나 찾을 수 없는 사용자예요.',
  /** 닉네임 확인 · 온보딩 확정: 다른 사람이 쓰고 있거나 맡아 둔 닉네임 */
  NICKNAME_DUPLICATED: '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 적어 주세요',
  /** 온보딩 확정: 지운 관심사가 섞임 (목록이 바뀐 사이에 고른 경우) */
  INTEREST_NOT_FOUND: '고른 관심사 가운데 지금은 없는 것이 있어요. 관심사를 다시 골라 주세요.',
  /** 온보딩 확정: 없는 질문 */
  INTRO_QUESTION_NOT_FOUND: '고른 질문 가운데 지금은 없는 것이 있어요. 질문을 다시 골라 주세요.',
}
