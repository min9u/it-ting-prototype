/**
 * 02 인증 · 10 설정 API (명세 v1) — 매퍼와 목 서버 규칙.
 * 목 서버는 LOGIN_FREE = false 로 바꿔서(명세대로 막는 상태) 본다. 지연은 ?api=fast 손잡이로 없앰
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../data/auth', async (orig) => ({ ...(await orig<typeof import('../data/auth')>()), LOGIN_FREE: false }))

type Auth = typeof import('../api/auth')
type Settings = typeof import('../api/settings')
let A: Auth
let S: Settings
let account: typeof import('../data/account')
let authStore: typeof import('../data/auth')

beforeAll(async () => {
  sessionStorage.setItem('digul.api.knobs', 'fast')
  A = await import('../api/auth')
  S = await import('../api/settings')
  account = await import('../data/account')
  authStore = await import('../data/auth')
})

/** 실패한 ApiError 의 code */
async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK' } catch (e) { return (e as { code?: string }).code ?? 'NOT_API_ERROR' }
}

describe('02 매퍼', () => {
  it('pathAfterLogin: ONBOARDING → 온보딩 1, HOME 은 가려던 주소 · 없으면 내 땅굴, NEW_TERM 은 내 땅굴', () => {
    expect(A.pathAfterLogin('ONBOARDING', '/chat')).toBe('/onboarding/name')
    expect(A.pathAfterLogin('HOME', '/chat')).toBe('/chat')
    expect(A.pathAfterLogin('HOME', null)).toBe('/burrow')
    expect(A.pathAfterLogin('NEW_TERM', '/chat')).toBe('/burrow')
  })
  it('toSuspension: 남은 날 올림 · 서울 날짜, 끝 시각이 없으면 0일', () => {
    const now = Date.UTC(2026, 10, 18, 3) // 서울 11-18 12:00
    const v = A.toSuspension({ reason: '신고 누적', endsAt: '2026-11-25T03:00:00Z' }, now)
    expect(v).toEqual({ reason: '신고 누적', days: 7, until: '2026.11.25' })
    expect(A.toSuspension({ reason: '', endsAt: '2026-11-18T04:00:00Z' }, now).days).toBe(1)
    expect(A.toSuspension(null, now)).toEqual({ reason: '운영 정책 위반', days: 0, until: '' })
  })
  it('secondsLeft: 만료 시각까지 남은 초, 지나면 0', () => {
    const now = Date.parse('2026-11-18T08:00:00Z')
    expect(A.secondsLeft('2026-11-18T08:05:00Z', now)).toBe(300)
    expect(A.secondsLeft('2026-11-18T07:59:00Z', now)).toBe(0)
  })
})

describe('02 목 서버 (명세 code)', () => {
  it('비로그인이면 GET /me 가 401 UNAUTHENTICATED', async () => {
    authStore.setAuthState('guest')
    expect(await codeOf(A.authApi.me())).toBe('UNAUTHENTICATED')
  })
  it('로그인: 시연 계정의 LOGIN_FAILED · ACCOUNT_SUSPENDED(detail) · ONBOARDING', async () => {
    expect(await codeOf(A.authApi.login({ email: 'wrong@ssafy.com', password: 'x' }))).toBe('LOGIN_FAILED')
    try { await A.authApi.login({ email: 'banned@ssafy.com', password: 'digul123!' }); throw new Error('정지 계정이 로그인됨') } catch (e) {
      const err = e as { code: string; status: number; detail: { reason: string; endsAt: string } }
      expect(err.code).toBe('ACCOUNT_SUSPENDED')
      expect(err.status).toBe(403)
      expect(err.detail.reason).toBe('신고 누적')
      expect(err.detail.endsAt).toMatch(/Z$/)
    }
    const r = await A.authApi.login({ email: 'new@ssafy.com', password: 'digul123!' })
    expect(r.nextStep).toBe('ONBOARDING')
    expect(typeof r.userId).toBe('number')
    expect((await A.authApi.me()).nextStep).toBe('ONBOARDING')
    await A.authApi.logout()
    expect(await codeOf(A.authApi.me())).toBe('UNAUTHENTICATED')
  })
  it('이메일 가입: 중복 · 재전송 간격 · 코드 틀림 → 가입 진행 → SSAFY → 계정 만들기(ONBOARDING)', async () => {
    expect(await codeOf(A.authApi.sendEmailCode({ email: 'taken@ssafy.com' }))).toBe('EMAIL_DUPLICATED')
    expect(await codeOf(A.authApi.sendEmailCode({ email: 'not-an-email' }))).toBe('INVALID_INPUT')
    const sent = await A.authApi.sendEmailCode({ email: 'mole@ssafy.com' })
    expect(sent.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(await codeOf(A.authApi.sendEmailCode({ email: 'mole@ssafy.com' }))).toBe('TOO_MANY_REQUESTS')
    expect(await codeOf(A.authApi.checkEmailCode({ email: 'mole@ssafy.com', code: '000000' }))).toBe('VERIFICATION_CODE_MISMATCH')
    expect(await codeOf(A.authApi.checkEmailCode({ email: 'other@ssafy.com', code: '123456' }))).toBe('VERIFICATION_CODE_EXPIRED')
    expect(await A.authApi.checkEmailCode({ email: 'mole@ssafy.com', code: '123456' })).toBeNull()
    // 코드는 한 번만
    expect(await codeOf(A.authApi.checkEmailCode({ email: 'mole@ssafy.com', code: '123456' }))).toBe('VERIFICATION_CODE_EXPIRED')

    expect(await codeOf(A.authApi.sendSsafyCode({ generation: 14, mattermostId: 'taken.mole' }))).toBe('MATTERMOST_ID_DUPLICATED')
    await A.authApi.sendSsafyCode({ generation: 14, mattermostId: 'mole.kim' })
    const floorId = (await import('../api/common')).toDtoId('서울|2')
    const base = { code: '123456', campusFloorId: floorId, hasAgreedTerms: true, hasAgreedPrivacy: true }
    expect(await codeOf(A.authApi.signup({ ...base, password: 'short' }))).toBe('INVALID_INPUT')
    expect(await codeOf(A.authApi.signup({ ...base, password: 'mole1234!', code: '000000' }))).toBe('VERIFICATION_CODE_MISMATCH')
    expect(await codeOf(A.authApi.signup({ ...base, password: 'mole1234!', campusFloorId: 1 }))).toBe('CAMPUS_FLOOR_NOT_FOUND')
    const r = await A.authApi.signup({ ...base, password: 'mole1234!' })
    expect(r.nextStep).toBe('ONBOARDING')
    // 가입 진행 기록은 계정을 만들면 지워짐
    expect(await codeOf(A.authApi.sendSsafyCode({ generation: 14, mattermostId: 'mole.kim' }))).toBe('SIGNUP_EXPIRED')
    // 이 탭에서 가입한 이메일은 다시 가입 못 함, 비밀번호가 다르면 로그인 실패
    expect(await codeOf(A.authApi.sendEmailCode({ email: 'mole@ssafy.com' }))).toBe('EMAIL_DUPLICATED')
    expect(await codeOf(A.authApi.login({ email: 'mole@ssafy.com', password: 'wrong123!' }))).toBe('LOGIN_FAILED')
  })
  it('Google 로그인 콜백: 가입한 계정 → /auth/google, 처음 → 회원가입 3, 정지 → /login?error=…, 취소', () => {
    expect(A.mockGoogleCallback('LOGIN', A.MOCK_GOOGLE.member)).toBe(A.GOOGLE_RETURN.loggedIn)
    expect(A.mockGoogleCallback('LOGIN', A.MOCK_GOOGLE.fresh)).toBe('/signup/ssafy?via=google')
    const banned = new URL(A.mockGoogleCallback('LOGIN', A.MOCK_GOOGLE.banned), 'http://x')
    expect(banned.pathname).toBe('/login')
    expect(banned.searchParams.get('error')).toBe('ACCOUNT_SUSPENDED')
    expect(A.suspendedFromQuery(banned.searchParams).endsAt).toMatch(/Z$/)
    expect(A.mockGoogleCallback('LOGIN', null)).toBe('/login?error=GOOGLE_LOGIN_CANCELED')
  })
  it('비밀번호 재설정: 없는 링크는 404 PASSWORD_RESET_LINK_INVALID, 쓴 링크는 다시 못 씀', async () => {
    expect(await codeOf(A.authApi.checkPasswordReset('nope'))).toBe('PASSWORD_RESET_LINK_INVALID')
    await A.authApi.requestPasswordReset({ email: 'reset@ssafy.com' })
    const token = new URL(A.mockMailbox.resetLink('reset@ssafy.com'), 'http://x').searchParams.get('token') ?? ''
    expect(await A.authApi.checkPasswordReset(token)).toBeNull()
    expect(await codeOf(A.authApi.completePasswordReset(token, { password: 'short' }))).toBe('INVALID_INPUT')
    await A.authApi.completePasswordReset(token, { password: 'newmole5678@' })
    expect(await codeOf(A.authApi.checkPasswordReset(token))).toBe('PASSWORD_RESET_LINK_INVALID')
  })
})

describe('10 매퍼', () => {
  it('탈퇴 사유 코드 여섯 개의 글이 data/account 의 목록과 같은 순서', () => {
    expect(S.WITHDRAW_REASONS.map((r) => r.label)).toEqual([...account.LEAVE_REASONS])
    expect(S.WITHDRAW_REASONS.map((r) => r.code)).toEqual(['NOT_USING', 'COURSE_ENDED', 'NO_MATCH', 'INCONVENIENT', 'UNPLEASANT', 'ETC'])
  })
  it('계정: Google 로만 가입 → 첫 화면 Google 연동하기', () => {
    const g = S.toAccount({ hasPassword: false, isGoogleLinked: true, googleEmail: 'a@gmail.com', canUnlinkGoogle: false })
    expect(g.googleOnly).toBe(true)
    expect(S.settingsHomePath(g)).toBe('/settings/google')
    expect(S.settingsHomePath(S.toAccount({ hasPassword: true, isGoogleLinked: false, googleEmail: null, canUnlinkGoogle: false }))).toBe('/settings/password')
  })
  it('공지: 분류 이름 · 서울 날짜 · 본문 줄바꿈', () => {
    const n = S.toNotice({ id: 12, category: 'UPDATE', title: 't', content: '첫 줄\n\n셋째 줄', createdAt: '2026-11-17T15:30:00Z' })
    expect(n).toMatchObject({ id: '12', cat: '업데이트', date: '2026.11.18', body: ['첫 줄', '', '셋째 줄'] })
  })
  it('알림 갈래 다섯 개 (명세 순서)', () => {
    expect(S.NOTIF_KINDS.map((k) => k.key)).toEqual(['isMeetupOn', 'isChatOn', 'isCommunityOn', 'isBurrowOn', 'isNoticeOn'])
  })
})

describe('10 목 서버 (명세 code)', () => {
  it('비밀번호 변경: 지금 비밀번호 틀림 · 같은 비밀번호 · Google 전용 계정', async () => {
    account.createAccount({ method: 'email', password: 'digul123!' })
    expect(await codeOf(S.settingsApi.changePassword({ currentPassword: 'nope1234!', newPassword: 'new12345!' }))).toBe('CURRENT_PASSWORD_MISMATCH')
    expect(await codeOf(S.settingsApi.changePassword({ currentPassword: 'digul123!', newPassword: 'digul123!' }))).toBe('PASSWORD_UNCHANGED')
    expect(await codeOf(S.settingsApi.changePassword({ currentPassword: 'digul123!', newPassword: 'short' }))).toBe('INVALID_INPUT')
    expect(await S.settingsApi.changePassword({ currentPassword: 'digul123!', newPassword: 'new12345!' })).toBeNull()
    account.createAccount({ method: 'google', googleEmail: 'g@gmail.com' })
    expect(await codeOf(S.settingsApi.changePassword({ currentPassword: 'x', newPassword: 'new12345!' }))).toBe('PASSWORD_NOT_SET')
    expect(await codeOf(S.settingsApi.unlinkGoogle())).toBe('GOOGLE_UNLINK_NOT_ALLOWED')
  })
  it('Google 연동: 확인 없이 PUT 이면 GOOGLE_VERIFICATION_REQUIRED, 다른 계정이 쓰면 돌아온 주소의 error, 확인 뒤 연결 · 해제', async () => {
    authStore.setAuthState('member')
    account.createAccount({ method: 'email', password: 'digul123!' })
    expect(await codeOf(S.settingsApi.linkGoogle())).toBe('GOOGLE_VERIFICATION_REQUIRED')
    expect(A.mockGoogleCallback('LINK', 'taken.mole@gmail.com')).toBe('/settings/google?error=GOOGLE_ACCOUNT_DUPLICATED')
    expect(A.mockGoogleCallback('LINK', 'fresh@gmail.com')).toBe('/settings/google?verified=true')
    const linked = await S.settingsApi.linkGoogle()
    expect(linked).toEqual({ hasPassword: true, isGoogleLinked: true, googleEmail: 'fresh@gmail.com', canUnlinkGoogle: true })
    expect(A.mockGoogleCallback('LINK', 'other@gmail.com')).toBe('/settings/google?error=GOOGLE_ALREADY_LINKED')
    expect((await S.settingsApi.unlinkGoogle()).isGoogleLinked).toBe(false)
  })
  it('알림 설정: 다섯 값을 모두 보내야 하고, 보낸 값으로 저장', async () => {
    const before = await S.settingsApi.notificationSettings()
    expect(before.pushPublicKey).toBeTruthy()
    const next = { ...S.pickValues(before), isCommunityOn: false }
    expect(await S.settingsApi.updateNotificationSettings(next)).toEqual(next)
    expect(S.pickValues(await S.settingsApi.notificationSettings())).toEqual(next)
    expect(await codeOf(S.settingsApi.updateNotificationSettings({ isMeetupOn: true } as never))).toBe('INVALID_INPUT')
  })
  it('푸시 등록: 같은 endpoint 는 같은 id, https 가 아니면 INVALID_INPUT, 지워도 성공', async () => {
    const req = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }
    const a = await S.settingsApi.registerPush(req)
    const b = await S.settingsApi.registerPush(req)
    expect(b.pushSubscriptionId).toBe(a.pushSubscriptionId)
    expect(await codeOf(S.settingsApi.registerPush({ ...req, endpoint: 'http://x' }))).toBe('INVALID_INPUT')
    expect(await S.settingsApi.deletePush(a.pushSubscriptionId)).toBeNull()
    expect(await S.settingsApi.deletePush(999)).toBeNull()
  })
  it('공지: 한 페이지 10개, 페이지 정보, 없는 공지는 NOTICE_NOT_FOUND', async () => {
    const p = await S.settingsApi.notices({ page: 1, size: 10 })
    expect(p.page).toBe(1)
    expect(p.items.length).toBeLessThanOrEqual(10)
    expect(p.totalPages).toBe(Math.max(1, Math.ceil(p.totalItems / 10)))
    const first = await S.settingsApi.notice(p.items[0].id)
    expect(first.content.length).toBeGreaterThan(0)
    expect(await codeOf(S.settingsApi.notice(1))).toBe('NOTICE_NOT_FOUND')
  })
  it('탈퇴: 비밀번호 틀림 → CURRENT_PASSWORD_MISMATCH, Google 전용은 확인 필요 · 다른 Google 계정은 MISMATCH', async () => {
    authStore.setAuthState('member')
    account.createAccount({ method: 'email', password: 'digul123!' })
    expect(await codeOf(S.settingsApi.withdraw({ password: 'wrong123!', reason: null }))).toBe('CURRENT_PASSWORD_MISMATCH')
    expect(await codeOf(S.settingsApi.withdraw({ reason: null }))).toBe('INVALID_INPUT')
    account.createAccount({ method: 'google', googleEmail: 'me@gmail.com' })
    expect((await S.settingsApi.withdrawalCheck()).isGoogleVerified).toBe(false)
    expect(await codeOf(S.settingsApi.withdraw({ reason: 'ETC' }))).toBe('GOOGLE_VERIFICATION_REQUIRED')
    expect(A.mockGoogleCallback('WITHDRAW', 'other@gmail.com')).toBe('/settings/leave?error=GOOGLE_ACCOUNT_MISMATCH')
    expect(A.mockGoogleCallback('WITHDRAW', 'me@gmail.com')).toBe('/settings/leave')
    const check = await S.settingsApi.withdrawalCheck()
    expect(check.isGoogleVerified).toBe(true)
    expect(check.canWithdraw).toBe(check.hostingMeetups.length === 0)
    for (const m of check.hostingMeetups) expect(m.startsAt).toMatch(/Z$/)
  })
})
