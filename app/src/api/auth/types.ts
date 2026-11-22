/**
 * 02 로그인 · 회원가입 DTO — 명세 그대로. 명세: docs/backend/team-spec/api/02-auth.md
 * id 는 숫자(Id), 시각은 UTC "…Z"(UtcInstant), enum 은 대문자, 값이 없으면 null
 */
import type { Id, UtcInstant } from '../common/types'

/** 다음에 갈 화면 (02 "다음에 갈 화면"). 프론트는 이 값만 보고 이동한다 */
export type NextStep = 'ONBOARDING' | 'NEW_TERM' | 'HOME'

/* ===== 회원가입 ===== */
/** POST /email-verifications 요청 */
export interface EmailVerificationRequest { email: string }
/** POST /email-verifications/check 요청. code 는 숫자 6자리 문자열 (앞자리 0 을 지키려고) */
export interface EmailVerificationCheckRequest { email: string; code: string }
/** POST /ssafy-verifications 요청. generation 은 GET /generations 가 준 값 */
export interface SsafyVerificationRequest { generation: number; mattermostId: string }
/** 코드를 보내는 API 의 응답 (201): 코드가 만료되는 시각. 남은 시간은 프론트가 계산 */
export interface CodeSentDto { expiresAt: UtcInstant }

/**
 * POST /users 요청 — SSAFY 인증 코드를 확인하고 계정을 만들어 로그인.
 * password 는 이메일 가입이면 필수, Google 가입이면 보내지 않는다. "비밀번호 확인" 칸은 보내지 않는다
 */
export interface SignupRequest {
  password?: string
  code: string
  campusFloorId: Id
  hasAgreedTerms: boolean
  hasAgreedPrivacy: boolean
}

/* ===== 로그인 ===== */
/** POST /sessions 요청 */
export interface LoginRequest { email: string; password: string }
/** POST /sessions · POST /users 응답 (201). POST /users 는 늘 ONBOARDING */
export interface SessionDto { userId: Id; nextStep: NextStep }

/** GET /me — 로그인 상태 · 다음 화면 · 소속. 401 이면 "로그인하지 않음" */
export interface MeDto {
  userId: Id
  nextStep: NextStep
  campusName: string
  generation: number
  floor: number
  /** 프로필의 캠퍼스-층 id (새 학기 안내가 처음에 골라 둠) */
  campusFloorId: Id
}

/** 403 ACCOUNT_SUSPENDED 의 error.detail (Google 로그인은 돌아온 주소의 쿼리로, 02 "구현 단계로 넘기는 것") */
export interface SuspendedDetail { reason: string; endsAt: UtcInstant }

/* ===== 비밀번호 재설정 ===== */
/** POST /password-resets 요청. 어떤 이메일이어도 똑같이 성공 (가입 여부 노출 방지) */
export interface PasswordResetRequest { email: string }
/** POST /password-resets/{token}/complete 요청 */
export interface PasswordResetCompleteRequest { password: string }

/* ===== Google (브라우저 이동, 응답 틀 없음) ===== */
/**
 * Google 로그인 · 확인이 끝나고 서버(콜백)가 브라우저를 보내는 곳 (02 · 10 "콜백이 브라우저를 보내는 곳").
 * 명세는 "프론트엔드의 정해진 주소"라고만 해서 이 앱이 정한 주소 (api/auth/google.ts GOOGLE_RETURN)
 */
export type GooglePurpose = 'LOGIN' | 'LINK' | 'WITHDRAW'
