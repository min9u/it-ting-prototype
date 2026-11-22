/**
 * 02 로그인 · 회원가입 — code → 화면 문구 (명세의 에러 표 · 화면 시안 문구). 공통 코드는 common/errors.ts
 * 화면: errorText(e, AUTH_ERRORS)
 */
import type { ErrorTable } from '../common/errors'

export const AUTH_ERRORS: ErrorTable = {
  LOGIN_FAILED: '이메일 또는 비밀번호가 맞지 않아요',
  ACCOUNT_SUSPENDED: '정지된 계정이에요',
  SIGNUP_EXPIRED: '가입 시간이 지났어요. 처음부터 다시 진행해 주세요',
  // 초안 mock 이 아직 던지는 코드 (인증 작업자가 명세 코드로 바꿈)
  CODE_MISMATCH: '인증 코드가 맞지 않아요',
  RESET_LINK_EXPIRED: '링크가 만료됐어요. 다시 받아 주세요.',
}
