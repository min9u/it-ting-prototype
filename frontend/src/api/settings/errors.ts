/**
 * 10 설정 · 계정 — code → 화면 문구 (명세 10-settings.md "에러" 표 + Google 확인의 돌아온 주소 error). 공통 코드는 common/errors.ts
 * 화면: errorText(e, SETTINGS_ERRORS), 칸 밑 문구는 code 로 칸을 고른다
 */
import type { ErrorTable } from '../common/errors'

export const SETTINGS_ERRORS: ErrorTable = {
  // 비밀번호 변경
  CURRENT_PASSWORD_MISMATCH: '현재 비밀번호가 맞지 않아요. 다시 입력해 주세요.',
  PASSWORD_UNCHANGED: '지금 쓰는 비밀번호와 같아요. 다른 비밀번호를 입력해 주세요.',
  PASSWORD_NOT_SET: 'Google로만 가입한 계정은 비밀번호가 없어요.',
  // Google 연동 · 확인 (돌아온 주소의 error 도 같은 표)
  GOOGLE_VERIFICATION_REQUIRED: 'Google 인증이 끝났거나 10분이 지났어요. 다시 인증해 주세요.',
  GOOGLE_ALREADY_LINKED: '이미 다른 Google 계정이 연동돼 있어요.',
  GOOGLE_ACCOUNT_DUPLICATED: '다른 계정에 연동된 Google 계정이에요. 다른 Google 계정을 골라 주세요.',
  GOOGLE_ACCOUNT_MISMATCH: '가입한 Google 계정으로 인증해 주세요.',
  GOOGLE_VERIFICATION_FAILED: 'Google 인증을 마치지 못했어요. 다시 시도해 주세요.',
  GOOGLE_UNLINK_NOT_ALLOWED: 'Google로만 가입한 계정이라 연동을 해제할 수 없어요.',
  // 공지
  NOTICE_NOT_FOUND: '삭제된 공지예요.',
  // 탈퇴
  HOSTING_MEETUP_EXISTS: '내가 연 예정 모임이 있어서 탈퇴할 수 없어요. 먼저 모임을 삭제하거나 취소해 주세요.',
}
