/**
 * 02 로그인 · 회원가입 — code → 화면 문구 (명세의 에러 표 · 명세 화면 문구). 공통 코드는 common/errors.ts
 * 화면: errorText(e, AUTH_ERRORS). 칸 밑에 띄울 코드는 화면이 code 로 고른다 (message 글자로 분기하지 않음)
 */
import type { ErrorTable } from '../common/errors'

export const AUTH_ERRORS: ErrorTable = {
  // 로그인 (02 로그인 4)
  LOGIN_FAILED: '이메일 또는 비밀번호가 맞지 않아요',
  ACCOUNT_SUSPENDED: '정지된 계정이라 로그인할 수 없어요',
  // 회원가입 1 · 3
  EMAIL_DUPLICATED: '이미 가입한 이메일이에요. 로그인해 주세요',
  VERIFICATION_CODE_MISMATCH: '인증 코드가 맞지 않아요',
  VERIFICATION_CODE_EXPIRED: '인증 시간이 지났어요. 코드를 다시 받아 주세요',
  TOO_MANY_REQUESTS: '코드를 방금 보냈어요. 잠시 뒤 다시 받아 주세요',
  // 503: 메일 서버 · Mattermost 가 잠시 응답하지 않음. 서버가 코드를 지우고 간격도 세지 않아 바로 다시 받을 수 있다
  VERIFICATION_SEND_FAILED: '코드를 보내지 못했어요. 다시 받아 주세요',
  SIGNUP_EXPIRED: '가입 시간이 지났어요. 처음부터 다시 진행해 주세요',
  MATTERMOST_ID_DUPLICATED: '이미 가입에 쓰인 Mattermost ID예요',
  CAMPUS_FLOOR_NOT_FOUND: '없는 캠퍼스 · 층이에요. 다시 골라 주세요',
  GOOGLE_ACCOUNT_DUPLICATED: '이미 가입한 Google 계정이에요. 로그인해 주세요',
  // 비밀번호 찾기
  PASSWORD_RESET_LINK_INVALID: '링크가 만료됐어요. 다시 받아 주세요',
  // Google 로그인이 돌아온 주소의 error (명세가 코드를 정하지 않은 "취소"는 이 앱이 정함)
  GOOGLE_LOGIN_CANCELED: 'Google 로그인을 마치지 못했어요. 다시 시도해 주세요',
  GOOGLE_VERIFICATION_FAILED: 'Google 로그인을 마치지 못했어요. 다시 시도해 주세요',
}

/** 그 칸 밑에 띄우는 코드 (화면이 이 표로 칸을 고름) */
export const AUTH_FIELD_OF: Readonly<Record<string, 'email' | 'code' | 'mattermostId' | 'floor'>> = {
  EMAIL_DUPLICATED: 'email',
  VERIFICATION_CODE_MISMATCH: 'code',
  VERIFICATION_CODE_EXPIRED: 'code',
  MATTERMOST_ID_DUPLICATED: 'mattermostId',
  CAMPUS_FLOOR_NOT_FOUND: 'floor',
}
