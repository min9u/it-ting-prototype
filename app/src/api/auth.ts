/**
 * 인증 (F1 · F2). 계약: docs/backend/api-draft.md "인증"
 * 세션은 HttpOnly 쿠키 가정 (Bearer 로 정하면 client.ts setAuthHeaderProvider). 소셜 로그인 콜백은 경로(/oauth/callback)여야 해서
 * 해시 라우터인 공유 빌드에서는 못 씀 (위험 D5)
 * 목 구현은 data/auth.ts 의 시연 계정 규칙을 그대로 씀
 */
import { API_MODE } from './config'
import { ApiError, http } from './client'
import { badRequest, mockRead, mockWrite } from './mock/server'
import { memberProfile } from './mock/serialize'
import { CODE_WRONG, login, requestReset, resetTokenValid, consumeResetToken, setAuthState, verifyCode, registerAccount } from '../data/auth'
import { accountStore } from '../data/account'
import { ME_ID } from '../data/mock'
import { toIso } from '../lib/time'
import type { LoginRequest, LoginResponseDto, MeDto } from './types'

const real = {
  /** POST /auth/login — 401 INVALID_CREDENTIALS, 403 ACCOUNT_SUSPENDED(detail: reason·endsAt) */
  login: (req: LoginRequest) => http.post<LoginResponseDto>('/auth/login', req, { skipAuthRefresh: true }),
  /** GET /oauth2/authorization/google 로 이동 (fetch 아님). 콜백 뒤 서버가 /oauth/callback?next= 로 돌려보냄 */
  googleUrl: () => `${import.meta.env.VITE_API_BASE || '/api'}/oauth2/authorization/google`,
  logout: () => http.post<void>('/auth/logout'),
  /** POST /auth/refresh — client.ts 가 401 때 한 번 부름 */
  refresh: () => http.post<void>('/auth/refresh', undefined, { skipAuthRefresh: true }),
  /** GET /me — 앱 시작 때 로그인 상태 확인 (401 이면 비로그인) */
  me: (signal?: AbortSignal) => http.get<MeDto>('/me', undefined, signal),
  /** 회원가입 1: 이메일 인증 코드 (재전송 30초 간격, 429 TOO_MANY_REQUESTS) */
  sendEmailCode: (email: string) => http.post<{ expiresAt: string }>('/auth/email-codes', { email }, { skipAuthRefresh: true }),
  verifyEmailCode: (email: string, code: string) => http.post<{ verificationToken: string }>('/auth/email-codes/verify', { email, code }, { skipAuthRefresh: true }),
  /** 회원가입 2: 비밀번호 + 약관 동의 */
  signup: (verificationToken: string, password: string, termsAgreed: boolean) => http.post<LoginResponseDto>('/auth/signup', { verificationToken, password, termsAgreed }, { skipAuthRefresh: true }),
  /** 회원가입 3: SSAFY 인증 (Mattermost 코드) */
  sendSsafyCode: (mattermostId: string) => http.post<void>('/auth/ssafy/codes', { mattermostId }),
  verifySsafyCode: (code: string) => http.post<MeDto>('/auth/ssafy/verify', { code }),
  /** 비밀번호 찾기: 가입 여부와 관계없이 204 (노출 방지) */
  requestPasswordReset: (email: string) => http.post<void>('/auth/password-reset', { email }, { skipAuthRefresh: true }),
  /** 410 RESET_LINK_EXPIRED */
  confirmPasswordReset: (token: string, password: string) => http.post<void>('/auth/password-reset/confirm', { token, password }, { skipAuthRefresh: true }),
}
export type AuthApi = typeof real

const meDto = (): MeDto => {
  const a = accountStore.get()
  return { ...memberProfile(ME_ID), email: 'me@ssafy.com', role: a.admin ? 'ADMIN' : 'USER', ssafyVerifiedAt: toIso(Date.now() - 30 * 86_400_000), onboardedAt: toIso(Date.now() - 29 * 86_400_000), termsAgreedAt: toIso(Date.now() - 30 * 86_400_000), googleLinked: !!a.googleEmail, hasPassword: a.signup === 'email' }
}
const NEXT = (to: string): LoginResponseDto['next'] => (to.startsWith('/signup/ssafy') ? 'SSAFY_VERIFY' : to.startsWith('/onboarding') ? 'ONBOARDING' : 'HOME')

const mock: AuthApi = {
  login: async (req) => {
    await mockWrite(() => undefined) // 지연·실패 손잡이
    const r = await login(req.email, req.password)
    if (!r.ok && r.kind === 'mismatch') throw new ApiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 맞지 않아요')
    if (!r.ok && r.kind === 'suspended') throw new ApiError(403, 'ACCOUNT_SUSPENDED', `${r.reason}(으)로 ${r.days}일 동안 로그인할 수 없어요`, { detail: { reason: r.reason, endsAt: r.until } })
    return { member: meDto(), next: NEXT(r.ok ? r.next : '/burrow') }
  },
  googleUrl: () => '#/signup/ssafy?via=google',
  logout: () => mockWrite(() => setAuthState('guest')),
  refresh: () => mockWrite(() => undefined),
  me: (signal) => mockRead(meDto, { signal }),
  sendEmailCode: () => mockWrite(() => ({ expiresAt: toIso(Date.now() + 5 * 60_000) })),
  verifyEmailCode: (_email, code) => mockWrite(() => { if (!verifyCode(code)) throw badRequest('CODE_MISMATCH', CODE_WRONG); return { verificationToken: 'mock-token' } }),
  signup: (_token, password) => mockWrite(() => { registerAccount('me@ssafy.com', password); setAuthState('member'); return { member: meDto(), next: 'SSAFY_VERIFY' as const } }),
  sendSsafyCode: () => mockWrite(() => undefined),
  verifySsafyCode: (code) => mockWrite(() => { if (!verifyCode(code)) throw badRequest('CODE_MISMATCH', CODE_WRONG); return meDto() }),
  requestPasswordReset: (email) => mockWrite(() => { requestReset(email) }),
  confirmPasswordReset: (token, password) => mockWrite(() => {
    if (!resetTokenValid(token)) throw new ApiError(410, 'RESET_LINK_EXPIRED', '링크가 만료됐어요. 다시 받아 주세요.')
    consumeResetToken(token, password)
  }),
}

export const auth: AuthApi = API_MODE === 'real' ? real : mock
