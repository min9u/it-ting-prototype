/**
 * 02 로그인 · 회원가입 — 목 서버 (명세 모양 · 명세 code 로 실패). "DB · 세션"은 data/auth.ts · data/account.ts
 *
 * 목 세션: data/auth.ts 의 authState('guest' | 'member') 가 곧 세션 쿠키, mockNextStep() 이 그 계정의 nextStep.
 * - LOGIN_FREE = true (지금): 로그인은 입력과 관계없이 성공, GET /me 도 늘 로그인한 계정 (화면이 막히지 않게)
 * - LOGIN_FREE = false: 비로그인(guest)이면 GET /me 가 401 UNAUTHENTICATED, 로그인은 시연 계정 규칙(data/auth.ts 맨 위)
 * 가입 진행 기록(서버 Redis + 가입 쿠키)은 이 모듈의 메모리 (signupRecord). 탭을 새로 열면 사라짐 = 가입 쿠키가 없음
 * Google: googleLoginUrl() 이 앱 안의 흉내 Google 화면 주소를 주고, 그 화면이 mockGoogleCallback 을 불러 돌아갈 주소를 받는다
 */
import { ApiError } from '../client'
import { badRequest, conflict, forbidden, invalidInput, mockRead, mockWrite, notFound, unauthenticated } from '../mock/server'
import { toAppId, toDtoId } from '../common/ids'
import {
  CODE_TTL, DEMO, LOGIN_FREE, MOCK_RESEND_GAP_MS, accountPassword, authState, consumeResetToken, isTakenEmail, lastResetToken,
  mockNextStep, registerAccount, requestReset, resetTokenValid, setAuthState, setMockNextStep, verifyCode,
} from '../../data/auth'
import { accountStore, createAccount, MY_GOOGLE_EMAIL } from '../../data/account'
import { campusesInOrder } from '../../data/campusFloors'
import { ME_HOME, isNewTermPending } from '../../data/field'
import { ME_ID } from '../../data/mock'
import { checkPassword, emailValid } from '../../lib/authRules'
import { toIso } from '../../lib/time'
import { mockGoogleVerify } from '../settings/mock'
import { GOOGLE_RETURN } from './google'
import type { AuthApi } from './real'
import type { CodeSentDto, GooglePurpose, MeDto, SessionDto } from './types'

const MIN = 60_000
/** 가입 진행 기록을 두는 시간 (명세: 구현 단계에서 정함) */
const SIGNUP_TTL = 30 * MIN

/* ===== 서버의 임시 저장소 (Redis 노릇) ===== */
interface CodeEntry { sentAt: number; expiresAt: number }
/** 이메일 인증 코드 (이메일 → 보낸 시각 · 만료). 목은 000000 이 아닌 6자리면 맞음 */
const emailCodes = new Map<string, CodeEntry>()
interface SignupRecord {
  method: 'email' | 'google'
  email?: string
  googleEmail?: string
  generation?: number
  mattermostId?: string
  code?: CodeEntry
  createdAt: number
}
let signupRecord: SignupRecord | null = null

/** 가입 쿠키로 기록 찾기. LOGIN_FREE(공유 빌드)는 회원가입 3 을 바로 열어도 되게 이메일 가입 기록을 만들어 줌 */
function currentSignup(): SignupRecord {
  if (signupRecord && Date.now() - signupRecord.createdAt < SIGNUP_TTL) return signupRecord
  signupRecord = null
  if (LOGIN_FREE) return (signupRecord = { method: 'email', email: 'me@ssafy.com', createdAt: Date.now() })
  throw conflict('SIGNUP_EXPIRED', '가입 시간이 지났습니다. 처음부터 다시 진행해 주세요.')
}

const sixDigits = (code: string) => /^\d{6}$/.test(code)
function checkCode(entry: CodeEntry | undefined, code: string) {
  if (!entry || entry.expiresAt <= Date.now()) throw badRequest('VERIFICATION_CODE_EXPIRED', '인증 코드가 만료됐습니다.')
  if (!verifyCode(code)) throw badRequest('VERIFICATION_CODE_MISMATCH', '인증 코드가 맞지 않습니다.')
}
function newCode(prev: CodeEntry | undefined): CodeEntry {
  if (prev && Date.now() - prev.sentAt < MOCK_RESEND_GAP_MS) throw new ApiError(429, 'TOO_MANY_REQUESTS', '잠시 뒤 다시 요청해 주세요.')
  const now = Date.now()
  return { sentAt: now, expiresAt: now + CODE_TTL * 1000 }
}
const codeSent = (e: CodeEntry): CodeSentDto => ({ expiresAt: toIso(e.expiresAt) })
/** 404 PASSWORD_RESET_LINK_INVALID (명세 code 가 "_NOT_FOUND" 모양이 아니라 notFound() 를 쓰지 않음) */
const linkInvalid = () => new ApiError(404, 'PASSWORD_RESET_LINK_INVALID', '없거나 만료된 링크입니다.')

/** 로그인 · 가입 성공: 세션 만들기 */
function startSession(next: SessionDto['nextStep']): SessionDto {
  setAuthState('member')
  setMockNextStep(next)
  return { userId: toDtoId(ME_ID), nextStep: next }
}

/** 시연 정지 기간 (일) */
const SUSPEND_DAYS = 7

/* ===== Google (흉내) ===== */
/** 흉내 Google 화면이 보여 주는 계정 */
export const MOCK_GOOGLE = {
  /** 이미 가입한(연동한) Google 계정 → 로그인 */
  member: MY_GOOGLE_EMAIL,
  /** 처음 쓰는 Google 계정 → 회원가입 3 */
  fresh: 'new.mole@gmail.com',
  /** 다른 계정이 이미 쓰는 Google 계정 (설정 연동 시 GOOGLE_ACCOUNT_DUPLICATED) */
  taken: 'taken.mole@gmail.com',
  /** 정지된 계정에 연결된 Google 계정 */
  banned: 'banned.mole@gmail.com',
} as const
/** 이 탭에서 Google 로 가입한 계정 */
const googleMembers = new Set<string>()
const isGoogleMember = (email: string) => email === MOCK_GOOGLE.member || googleMembers.has(email) || accountStore.get().googleEmail === email

/**
 * 흉내 Google 화면에서 계정을 골랐을 때(email) · 취소했을 때(null) 서버 콜백이 하는 일 → 브라우저가 갈 프론트 주소.
 * LOGIN 은 02 GET /oauth/google/callback, LINK · WITHDRAW 는 10 "Google 확인" (api/settings/mock.ts)
 */
export function mockGoogleCallback(purpose: GooglePurpose, email: string | null): string {
  if (purpose !== 'LOGIN') return mockGoogleVerify(purpose, email)
  if (!email) return GOOGLE_RETURN.loginFailed('GOOGLE_LOGIN_CANCELED')
  if (email === MOCK_GOOGLE.banned) {
    return GOOGLE_RETURN.loginFailed('ACCOUNT_SUSPENDED', { reason: '신고 누적', endsAt: toIso(Date.now() + SUSPEND_DAYS * 24 * 60 * MIN) })
  }
  if (isGoogleMember(email)) { startSession('HOME'); return GOOGLE_RETURN.loggedIn }
  // 처음 쓰는 Google 계정: 계정은 만들지 않고 가입 진행 기록만 (이전 기록은 덮어씀)
  signupRecord = { method: 'google', googleEmail: email, createdAt: Date.now() }
  return GOOGLE_RETURN.newAccount
}

/** 목 "메일함": 재설정 메일 속 링크 (공유 빌드에서 "체험용 · 메일 속 링크 열기") */
export const mockMailbox = {
  resetLink: (email: string) => `/password-reset/new?token=${lastResetToken(email) ?? requestReset(email)}`,
}

/**
 * 목 세션의 다음 단계. 온보딩을 마친 계정이 새 학기 들판을 아직 고르지 않았으면(05 목 data/field isNewTermPending, 시연 ?newterm=demo) NEW_TERM
 * (명세 02 "새 학기를 고르지 않은 계정"). LOGIN_FREE 면 ONBOARDING 말고는 HOME 대신 그대로 들여보냄
 */
function nextStepNow(): MeDto['nextStep'] {
  const step = mockNextStep()
  if (step === 'ONBOARDING') return 'ONBOARDING'
  if (isNewTermPending()) return 'NEW_TERM'
  return LOGIN_FREE ? 'HOME' : step
}
const meDto = (): MeDto => {
  const campusFloorKey = `${ME_HOME.campus}|${ME_HOME.floor}`
  return {
    userId: toDtoId(ME_ID), nextStep: nextStepNow(),
    campusName: ME_HOME.campus, generation: ME_HOME.gen, floor: ME_HOME.floor, campusFloorId: toDtoId(campusFloorKey),
  }
}

export const mock: AuthApi = {
  /* ----- 회원가입 ----- */
  sendEmailCode: ({ email }) => mockWrite(() => {
    if (!emailValid(email)) throw invalidInput({ email: '이메일 형식이 올바르지 않습니다.' })
    if (isTakenEmail(email)) throw conflict('EMAIL_DUPLICATED', '이미 가입한 이메일입니다.')
    const e = newCode(emailCodes.get(email))
    emailCodes.set(email, e)
    return codeSent(e)
  }),
  checkEmailCode: ({ email, code }) => mockWrite(() => {
    if (!sixDigits(code)) throw invalidInput({ code: '숫자 6자리를 입력해야 합니다.' })
    checkCode(emailCodes.get(email), code)
    emailCodes.delete(email)
    signupRecord = { method: 'email', email, createdAt: Date.now() }
    return null
  }),
  sendSsafyCode: ({ generation, mattermostId }) => mockWrite(() => {
    const r = currentSignup()
    if (!Number.isInteger(generation) || generation <= 0) throw invalidInput({ generation: '기수 목록에 없는 값입니다.' })
    if (!mattermostId.trim()) throw invalidInput({ mattermostId: 'Mattermost ID 를 입력해야 합니다.' })
    if (mattermostId.trim().toLowerCase() === DEMO.takenMattermost) throw conflict('MATTERMOST_ID_DUPLICATED', '다른 계정이 가입에 쓴 Mattermost ID 입니다.')
    const e = newCode(r.mattermostId === mattermostId && r.generation === generation ? r.code : undefined)
    Object.assign(r, { generation, mattermostId, code: e })
    return codeSent(e)
  }),
  signup: (req) => mockWrite(() => {
    const r = currentSignup()
    const fields: Record<string, string> = {}
    if (!sixDigits(req.code)) fields.code = '숫자 6자리를 입력해야 합니다.'
    if (!req.hasAgreedTerms) fields.hasAgreedTerms = '이용약관에 동의해야 합니다.'
    if (!req.hasAgreedPrivacy) fields.hasAgreedPrivacy = '개인정보 수집 · 이용에 동의해야 합니다.'
    if (r.method === 'email' && !checkPassword(req.password ?? '').ok) fields.password = '비밀번호 규칙에 맞지 않습니다.'
    if (Object.keys(fields).length) throw invalidInput(fields)
    checkCode(r.code, req.code)
    const floorKey = toAppId(req.campusFloorId)
    const known = campusesInOrder().some((c) => c.floors.some((f) => `${c.campus}|${f}` === floorKey))
    if (!known) throw notFound('CAMPUS_FLOOR', '없는 캠퍼스-층입니다.')
    if (r.method === 'email') {
      if (r.email && isTakenEmail(r.email)) throw conflict('EMAIL_DUPLICATED', '이미 가입한 이메일입니다.')
      registerAccount(r.email ?? '', req.password ?? '')
      createAccount({ method: 'email', password: req.password })
    } else {
      if (r.googleEmail && googleMembers.has(r.googleEmail)) throw conflict('GOOGLE_ACCOUNT_DUPLICATED', '이미 가입한 Google 계정입니다.')
      googleMembers.add(r.googleEmail ?? '')
      createAccount({ method: 'google', googleEmail: r.googleEmail })
    }
    signupRecord = null
    return startSession('ONBOARDING')
  }),

  /* ----- 로그인 ----- */
  login: ({ email, password }) => mockWrite(() => {
    if (LOGIN_FREE) return startSession('HOME')
    const e = email.trim().toLowerCase()
    const saved = accountPassword(e)
    if (e === DEMO.wrongEmail || (saved != null && saved !== password) || !password) throw new ApiError(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 맞지 않습니다.')
    if (e === DEMO.bannedEmail) {
      throw forbidden('정지된 계정입니다.', 'ACCOUNT_SUSPENDED', { reason: '신고 누적', endsAt: toIso(Date.now() + SUSPEND_DAYS * 24 * 60 * MIN) })
    }
    return startSession(e === DEMO.newEmail ? 'ONBOARDING' : 'HOME')
  }),
  logout: () => mockWrite(() => { setAuthState('guest'); setMockNextStep('HOME'); return null }),
  me: (signal) => mockRead(() => {
    if (!LOGIN_FREE && authState() === 'guest') throw unauthenticated()
    return meDto()
  }, { signal }),
  googleLoginUrl: () => '/oauth/mock-google?purpose=LOGIN',

  /* ----- 비밀번호 재설정 ----- */
  requestPasswordReset: ({ email }) => mockWrite(() => {
    if (!emailValid(email)) throw invalidInput({ email: '이메일 형식이 올바르지 않습니다.' })
    requestReset(email)
    return null
  }),
  checkPasswordReset: (token, signal) => mockRead(() => {
    if (!resetTokenValid(token)) throw linkInvalid()
    return null
  }, { signal }),
  completePasswordReset: (token, { password }) => mockWrite(() => {
    if (!checkPassword(password).ok) throw invalidInput({ password: '비밀번호 규칙에 맞지 않습니다.' })
    if (!resetTokenValid(token)) throw linkInvalid()
    if (token !== 'demo') consumeResetToken(token, password)
    return null
  }),
}
