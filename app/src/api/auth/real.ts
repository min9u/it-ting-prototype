/**
 * 02 로그인 · 회원가입 — 실제 서버 호출. 명세: docs/backend/team-spec/api/02-auth.md
 * 백엔드 구현됨(2026-11-22): POST /sessions · DELETE /sessions/current · GET /me → VITE_API_REAL_AREAS=auth
 *
 * 세션은 쿠키(ITTING_SESSION, HttpOnly)라 프론트는 아무것도 저장하지 않는다. 갱신 API 는 없다 (401 이면 로그인 화면).
 * Google 로그인은 fetch 가 아니라 브라우저 이동(googleUrl)
 */
import { API_BASE } from '../config'
import { http } from '../client'
import type { LegacyLoginResponseDto, LegacyMeDto, LoginRequest, MeDto, SessionDto } from './types'

/** 이 영역이 명세대로 구현한 API. 나머지는 ./PENDING (src/tests/api-v1-endpoints.test.ts) */
export const ENDPOINTS: readonly string[] = [
  'POST /api/v1/sessions',
  'DELETE /api/v1/sessions/current',
  'GET /api/v1/me',
]

export const real = {
  /** POST /sessions — 로그인. 401 LOGIN_FAILED, 403 ACCOUNT_SUSPENDED(detail: reason · endsAt) */
  login: (req: LoginRequest) => http.post<SessionDto>('/sessions', req, { quiet401: true }),
  /** DELETE /sessions/current — 로그아웃 (data null) */
  logout: () => http.delete<null>('/sessions/current'),
  /** GET /me — 앱을 열 때 로그인 상태 확인. 401 UNAUTHENTICATED 면 "로그인 안 함" (onUnauthorized 를 부르지 않음) */
  me: (signal?: AbortSignal) => http.get<MeDto>('/me', undefined, signal, { quiet401: true }),
  /** GET /oauth/google 로 브라우저 이동 (fetch 아님) */
  googleUrl: () => `${API_BASE}/oauth/google`,

  /* ----- 초안 주소 (명세로 옮기기 전, 화면에서 아직 안 씀) — 인증 작업자가 명세 주소로 바꿀 것 ----- */
  /** @deprecated → POST /email-verifications */
  sendEmailCode: (email: string) => http.post<{ expiresAt: string }>('/auth/email-codes', { email }),
  /** @deprecated → POST /email-verifications/check */
  verifyEmailCode: (email: string, code: string) => http.post<{ verificationToken: string }>('/auth/email-codes/verify', { email, code }),
  /** @deprecated → POST /users */
  signup: (verificationToken: string, password: string, termsAgreed: boolean) => http.post<LegacyLoginResponseDto>('/auth/signup', { verificationToken, password, termsAgreed }),
  /** @deprecated → POST /ssafy-verifications */
  sendSsafyCode: (mattermostId: string) => http.post<null>('/auth/ssafy/codes', { mattermostId }),
  /** @deprecated → POST /users */
  verifySsafyCode: (code: string) => http.post<LegacyMeDto>('/auth/ssafy/verify', { code }),
  /** @deprecated → POST /password-resets */
  requestPasswordReset: (email: string) => http.post<null>('/auth/password-reset', { email }),
  /** @deprecated → POST /password-resets/{token}/complete */
  confirmPasswordReset: (token: string, password: string) => http.post<null>('/auth/password-reset/confirm', { token, password }),
}
export type AuthApi = typeof real
