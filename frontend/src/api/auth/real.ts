/**
 * 02 로그인 · 회원가입 — 실제 서버 호출. 명세: docs/backend/team-spec/api/02-auth.md
 * 백엔드 구현됨(2026-11-22): POST /sessions · DELETE /sessions/current · GET /me → NEXT_PUBLIC_API_REAL_AREAS=auth
 *
 * 세션은 쿠키(ITTING_SESSION, HttpOnly)라 프론트는 아무것도 저장하지 않는다. 갱신 API 는 없다 (401 이면 로그인 화면).
 * 가입 진행 기록도 서버가 가입 쿠키로 가리킨다 (프론트는 읽지 않음). 비밀번호만 화면 상태로 들고 있다가 POST /users 에 담는다.
 * Google 로그인은 fetch 가 아니라 브라우저 이동 (googleLoginUrl → ./google.ts goGoogle)
 */
import { API_BASE } from '../config'
import { http, seg } from '../client'
import type {
  CodeSentDto, EmailVerificationCheckRequest, EmailVerificationRequest, LoginRequest, MeDto, PasswordResetCompleteRequest,
  PasswordResetRequest, SessionDto, SignupRequest, SsafyVerificationRequest,
} from './types'

/** 이 영역이 명세대로 구현한 API (src/tests/api-v1-endpoints.test.ts) */
export const ENDPOINTS: readonly string[] = [
  'POST /api/v1/email-verifications',
  'POST /api/v1/email-verifications/check',
  'POST /api/v1/ssafy-verifications',
  'POST /api/v1/users',
  'POST /api/v1/sessions',
  'DELETE /api/v1/sessions/current',
  'GET /api/v1/me',
  'GET /api/v1/oauth/google',
  // 프론트가 부르지 않는다. Google 이 브라우저를 보내는 서버 주소이고, 그 뒤 서버가 보내는 프론트 주소는 ./google.ts GOOGLE_RETURN
  'GET /api/v1/oauth/google/callback',
  'POST /api/v1/password-resets',
  'GET /api/v1/password-resets/{token}',
  'POST /api/v1/password-resets/{token}/complete',
]

/** 로그인 없이 부르는 API 라 401 이 와도 "로그인 화면으로"를 하지 않음 */
const PUBLIC = { quiet401: true } as const

export const real = {
  /* ----- 회원가입 ----- */
  /** POST /email-verifications — 인증 코드 보내기 · 재전송 (201 { expiresAt }). 409 EMAIL_DUPLICATED · 429 TOO_MANY_REQUESTS */
  sendEmailCode: (req: EmailVerificationRequest) => http.post<CodeSentDto>('/email-verifications', req, PUBLIC),
  /** POST /email-verifications/check — 코드 확인 → 가입 진행 시작 (가입 쿠키). 400 VERIFICATION_CODE_MISMATCH · VERIFICATION_CODE_EXPIRED */
  checkEmailCode: (req: EmailVerificationCheckRequest) => http.post<null>('/email-verifications/check', req, PUBLIC),
  /** POST /ssafy-verifications — Mattermost 로 코드 보내기 (201 { expiresAt }). 409 SIGNUP_EXPIRED · MATTERMOST_ID_DUPLICATED */
  sendSsafyCode: (req: SsafyVerificationRequest) => http.post<CodeSentDto>('/ssafy-verifications', req, PUBLIC),
  /** POST /users — 코드 확인 + 계정 만들기 + 로그인 (201, nextStep 은 늘 ONBOARDING) */
  signup: (req: SignupRequest) => http.post<SessionDto>('/users', req, PUBLIC),

  /* ----- 로그인 ----- */
  /** POST /sessions — 로그인. 401 LOGIN_FAILED, 403 ACCOUNT_SUSPENDED(detail: reason · endsAt) */
  login: (req: LoginRequest) => http.post<SessionDto>('/sessions', req, PUBLIC),
  /** DELETE /sessions/current — 로그아웃 (이 기기의 세션만) */
  logout: () => http.delete<null>('/sessions/current'),
  /** GET /me — 앱을 열 때 로그인 상태 확인. 401 UNAUTHENTICATED 면 "로그인 안 함" (onUnauthorized 를 부르지 않음) */
  me: (signal?: AbortSignal) => http.get<MeDto>('/me', undefined, signal, PUBLIC),
  /** GET /oauth/google — 브라우저가 이 주소로 이동 (fetch 아님) */
  googleLoginUrl: () => `${API_BASE}/oauth/google`,

  /* ----- 비밀번호 재설정 ----- */
  /** POST /password-resets — 재설정 메일 (어떤 이메일이어도 201 null) */
  requestPasswordReset: (req: PasswordResetRequest) => http.post<null>('/password-resets', req, PUBLIC),
  /** GET /password-resets/{token} — 링크가 유효한지 (404 PASSWORD_RESET_LINK_INVALID) */
  checkPasswordReset: (token: string, signal?: AbortSignal) => http.get<null>(`/password-resets/${seg(token)}`, undefined, signal, PUBLIC),
  /** POST /password-resets/{token}/complete — 새 비밀번호 저장 (로그인시키지 않음) */
  completePasswordReset: (token: string, req: PasswordResetCompleteRequest) => http.post<null>(`/password-resets/${seg(token)}/complete`, req, PUBLIC),
}
export type AuthApi = typeof real
