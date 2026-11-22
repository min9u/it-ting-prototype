/**
 * 02 로그인 · 회원가입 — 목 서버. data/auth.ts 의 시연 계정 규칙을 그대로 "서버"로 씀.
 *
 * 목 세션: data/auth.ts 의 authState('guest' | 'member') 가 곧 세션 쿠키다.
 * - LOGIN_FREE = true (지금): 로그인은 입력과 관계없이 성공, GET /me 도 늘 로그인한 계정 (화면이 막히지 않게)
 * - LOGIN_FREE = false: 비로그인(guest)이면 GET /me 가 401 UNAUTHENTICATED, 로그인은 시연 계정 규칙
 *   (wrong@ssafy.com → 401 LOGIN_FAILED, banned@ssafy.com → 403 ACCOUNT_SUSPENDED, new@ssafy.com → nextStep ONBOARDING)
 */
import { ApiError } from '../client'
import { badRequest, mockRead, mockWrite, unauthenticated } from '../mock/server'
import { toDtoId } from '../common/ids'
import { memberProfile } from '../common/mockPeople'
import { CODE_WRONG, LOGIN_FREE, authState, consumeResetToken, login, registerAccount, requestReset, resetTokenValid, setAuthState, verifyCode } from '../../data/auth'
import { accountStore } from '../../data/account'
import { ME_HOME } from '../../data/field'
import { ME_ID } from '../../data/mock'
import { toIso } from '../../lib/time'
import type { AuthApi } from './real'
import type { LegacyMeDto, MeDto, NextStep } from './types'

/** 마지막으로 로그인한 계정의 다음 단계 (목 세션에 같이 둠) */
let nextStep: NextStep = 'HOME'
const toNext = (path: string): NextStep => (path.startsWith('/onboarding') ? 'ONBOARDING' : 'HOME')
/** "28.11.29" 같은 목 날짜 → UTC 시각 (끝나는 날 서울 0시) */
const dotToIso = (d: string) => { const [y, m, dd] = d.split('.').map(Number); return toIso(Date.UTC(y, m - 1, dd) - 9 * 3_600_000) }

const meDto = (): MeDto => ({
  userId: toDtoId(ME_ID), nextStep, campusName: ME_HOME.campus, generation: ME_HOME.gen, floor: ME_HOME.floor,
  campusFloorId: toDtoId(`${ME_HOME.campus}|${ME_HOME.floor}`),
})
const legacyMe = (): LegacyMeDto => {
  const a = accountStore.get()
  return { ...memberProfile(ME_ID), email: 'me@ssafy.com', role: a.admin ? 'ADMIN' : 'USER', ssafyVerifiedAt: toIso(Date.now() - 30 * 86_400_000), onboardedAt: toIso(Date.now() - 29 * 86_400_000), termsAgreedAt: toIso(Date.now() - 30 * 86_400_000), googleLinked: !!a.googleEmail, hasPassword: a.signup === 'email' }
}

export const mock: AuthApi = {
  login: async (req) => {
    await mockWrite(() => null) // 지연·실패 손잡이
    const r = await login(req.email, req.password)
    if (!r.ok && r.kind === 'mismatch') throw new ApiError(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 맞지 않습니다.')
    if (!r.ok && r.kind === 'suspended') throw new ApiError(403, 'ACCOUNT_SUSPENDED', '정지된 계정입니다.', { detail: { reason: r.reason, endsAt: dotToIso(r.until) } })
    nextStep = r.ok ? toNext(r.next) : 'HOME'
    return { userId: toDtoId(ME_ID), nextStep }
  },
  logout: () => mockWrite(() => { setAuthState('guest'); return null }),
  me: (signal) => mockRead(() => {
    if (!LOGIN_FREE && authState() === 'guest') throw unauthenticated()
    return meDto()
  }, { signal }),
  googleUrl: () => '#/signup/ssafy?via=google',

  /* ----- 초안 (화면에서 아직 안 씀) ----- */
  sendEmailCode: () => mockWrite(() => ({ expiresAt: toIso(Date.now() + 5 * 60_000) })),
  verifyEmailCode: (_email, code) => mockWrite(() => { if (!verifyCode(code)) throw badRequest('CODE_MISMATCH', CODE_WRONG); return { verificationToken: 'mock-token' } }),
  signup: (_token, password) => mockWrite(() => { registerAccount('me@ssafy.com', password); setAuthState('member'); return { member: legacyMe(), next: 'ONBOARDING' as const } }),
  sendSsafyCode: () => mockWrite(() => null),
  verifySsafyCode: (code) => mockWrite(() => { if (!verifyCode(code)) throw badRequest('CODE_MISMATCH', CODE_WRONG); return legacyMe() }),
  requestPasswordReset: (email) => mockWrite(() => { requestReset(email); return null }),
  confirmPasswordReset: (token, password) => mockWrite(() => {
    if (!resetTokenValid(token)) throw new ApiError(410, 'RESET_LINK_EXPIRED', '링크가 만료됐어요. 다시 받아 주세요.')
    consumeResetToken(token, password)
    return null
  }),
}
