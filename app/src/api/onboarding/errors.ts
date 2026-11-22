/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필) — code → 화면 문구. 공통 코드는 common/errors.ts
 * 온보딩 · 내 땅굴 작업자가 명세(03-onboarding.md, 00-common.md "에러")의 코드로 채운다
 */
import type { ErrorTable } from '../common/errors'

export const ONBOARDING_ERRORS: ErrorTable = {
  USER_NOT_FOUND: '탈퇴했거나 없는 사용자예요.',
}
