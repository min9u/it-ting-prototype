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
import { CODE_MAX_FAILS, MM_ID_RE, emailValid, normalizeMattermostId, passwordFieldErrors } from '../../lib/authRules'
import { toIso } from '../../lib/time'
import { mockGoogleVerify } from '../settings/mock'
import { GOOGLE_RETURN } from './google'
import type { AuthApi } from './real'
import type { CodeSentDto, GooglePurpose, MeDto, SessionDto } from './types'

const MIN = 60_000
/** 가입 진행 기록을 두는 시간 (API 02 "가입 진행": 1시간) */
const SIGNUP_TTL = 60 * MIN
/** 같은 이메일로 재설정 메일을 다시 요청할 수 있는 간격 (API 02 POST /password-resets 2 · 4: 60초 안이면 아무것도 안 하고 성공) */
const RESET_GAP_MS = MIN

/* ===== 서버의 임시 저장소 (Redis 노릇) ===== */
/** 코드 하나: 만료 시각 · 틀린 횟수. 목은 000000 이 아닌 6자리면 맞음 */
interface CodeEntry { expiresAt: number; fails: number }
/** 이메일 인증 코드 (소문자로 바꾼 이메일 → 코드). 5번 틀리면 지움 */
const emailCodes = new Map<string, CodeEntry>()
/** 이메일마다 마지막으로 보낸 시각 (코드를 지워도 재전송 간격은 그대로 셈) */
const emailSentAt = new Map<string, number>()
interface SignupRecord {
  method: 'email' | 'google'
  email?: string
  googleEmail?: string
  generation?: number
  mattermostId?: string
  code?: CodeEntry
  /** SSAFY 코드를 마지막으로 보낸 시각 */
  sentAt?: number
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

/** 이메일은 대소문자를 가리지 않는다 (API 02 POST /email-verifications 4) */
const emailKey = (email: string) => email.trim().toLowerCase()
const sixDigits = (code: string) => /^\d{6}$/.test(code)
/** 코드 비교. 없거나 지났으면 EXPIRED, 다르면 MISMATCH 이고 5번째로 틀리면 drop() 으로 코드를 지움 */
function checkCode(entry: CodeEntry | undefined, code: string, drop: () => void) {
  if (!entry || entry.expiresAt <= Date.now()) throw badRequest('VERIFICATION_CODE_EXPIRED', '인증 코드가 만료됐습니다.')
  if (!verifyCode(code)) {
    entry.fails += 1
    if (entry.fails >= CODE_MAX_FAILS) drop()
    throw badRequest('VERIFICATION_CODE_MISMATCH', '인증 코드가 맞지 않습니다.')
  }
}
/** 재전송 간격 확인 (지나지 않았으면 429) */
function checkGap(lastSentAt: number | undefined) {
  if (lastSentAt != null && Date.now() - lastSentAt < MOCK_RESEND_GAP_MS) throw new ApiError(429, 'TOO_MANY_REQUESTS', '잠시 뒤 다시 요청해 주세요.')
}
const newCode = (): CodeEntry => ({ expiresAt: Date.now() + CODE_TTL * 1000, fails: 0 })
/** 503 VERIFICATION_SEND_FAILED: 메일 서버 · Mattermost 에 보내지 못함. 만든 코드는 지우고 재전송 간격도 세지 않는다 */
const sendFailed = (where: string) => new ApiError(503, 'VERIFICATION_SEND_FAILED', `${where}에 보내지 못했습니다. 다시 시도해 주세요.`)
const codeSent = (e: CodeEntry): CodeSentDto => ({ expiresAt: toIso(e.expiresAt) })
/** 404 PASSWORD_RESET_LINK_INVALID (명세 code 가 "_NOT_FOUND" 모양이 아니라 notFound() 를 쓰지 않음) */
const linkInvalid = () => new ApiError(404, 'PASSWORD_RESET_LINK_INVALID', '없거나 만료된 링크입니다.')
/** 재설정 메일을 마지막으로 요청한 시각 (소문자 이메일 → 시각) */
const resetRequestedAt = new Map<string, number>()

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
  resetLink: (email: string) => `/password-reset/${lastResetToken(emailKey(email)) ?? requestReset(emailKey(email))}`,
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
    if (!emailValid(email.trim())) throw invalidInput({ email: '이메일 형식이 올바르지 않습니다.' })
    const key = emailKey(email)
    if (isTakenEmail(key)) throw conflict('EMAIL_DUPLICATED', '이미 가입한 이메일입니다.')
    checkGap(emailSentAt.get(key))
    // 4 코드를 만들어 저장 → 5 보내지 못하면 지우고 503 (재전송 간격도 세지 않음)
    if (key === DEMO.sendFailEmail) { emailCodes.delete(key); throw sendFailed('메일 서버') }
    const e = newCode()
    emailCodes.set(key, e)
    emailSentAt.set(key, Date.now())
    return codeSent(e)
  }),
  checkEmailCode: ({ email, code }) => mockWrite(() => {
    if (!sixDigits(code)) throw invalidInput({ code: '숫자 6자리를 입력해야 합니다.' })
    const key = emailKey(email)
    checkCode(emailCodes.get(key), code, () => emailCodes.delete(key))
    emailCodes.delete(key)
    signupRecord = { method: 'email', email: key, createdAt: Date.now() }
    return null
  }),
  sendSsafyCode: ({ generation, mattermostId }) => mockWrite(() => {
    // 1 입력 모양 (가입 진행 기록을 찾기 전에)
    const mm = normalizeMattermostId(mattermostId ?? '')
    if (generation == null) throw invalidInput({ generation: '기수를 골라야 합니다.' })
    if (!MM_ID_RE.test(mm)) throw invalidInput({ mattermostId: 'Mattermost ID 는 영문 소문자 · 숫자 · . - _ 3 ~ 22자여야 합니다.' })
    // 2 가입 진행 기록 → 3 기수 목록 → 4 중복 → 5 재전송 간격
    const r = currentSignup()
    if (!Number.isInteger(generation) || generation <= 0) throw invalidInput({ generation: '기수 목록에 없는 값입니다.' })
    if (mm === DEMO.takenMattermost) throw conflict('MATTERMOST_ID_DUPLICATED', '다른 계정이 가입에 쓴 Mattermost ID 입니다.')
    checkGap(r.mattermostId === mm && r.generation === generation ? r.sentAt : undefined)
    // 6 코드를 담음 → 7 Mattermost 로 보내지 못하면 지우고 503 (재전송 간격도 세지 않음)
    if (mm === DEMO.sendFailMattermost) { r.code = undefined; throw sendFailed('Mattermost') }
    const e = newCode()
    Object.assign(r, { generation, mattermostId: mm, code: e, sentAt: Date.now() })
    return codeSent(e)
  }),
  signup: (req) => mockWrite(() => {
    // 1 입력 모양 (가입 진행 기록을 찾기 전에). 어긋난 규칙마다 한 줄씩
    const fields: { field: string; message: string }[] = []
    if (!sixDigits(req.code)) fields.push({ field: 'code', message: '숫자 6자리를 입력해야 합니다.' })
    if (!req.hasAgreedTerms) fields.push({ field: 'hasAgreedTerms', message: '이용약관에 동의해야 합니다.' })
    if (!req.hasAgreedPrivacy) fields.push({ field: 'hasAgreedPrivacy', message: '개인정보 수집 · 이용에 동의해야 합니다.' })
    if (req.password != null) fields.push(...passwordFieldErrors('password', req.password))
    if (fields.length) throw invalidInput(fields)
    // 2 가입 진행 기록. 이메일 가입인데 비밀번호가 없으면 INVALID_INPUT
    const r = currentSignup()
    if (r.method === 'email' && req.password == null) throw invalidInput({ password: '비밀번호를 입력해야 합니다.' })
    // 3 SSAFY 코드 (5번 틀리면 지움)
    checkCode(r.code, req.code, () => { r.code = undefined })
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
    if (!emailValid(email.trim())) throw invalidInput({ email: '이메일 형식이 올바르지 않습니다.' })
    // 2 · 4 같은 이메일로 60초 안에 다시 요청하면 아무것도 하지 않고 성공 (429 를 주지 않음: 가입 여부가 드러나므로)
    const key = emailKey(email)
    const last = resetRequestedAt.get(key)
    if (last != null && Date.now() - last < RESET_GAP_MS) return null
    resetRequestedAt.set(key, Date.now())
    requestReset(key)
    return null
  }),
  checkPasswordReset: (token, signal) => mockRead(() => {
    if (!resetTokenValid(token)) throw linkInvalid()
    return null
  }, { signal }),
  completePasswordReset: (token, { password }) => mockWrite(() => {
    const bad = passwordFieldErrors('password', password)
    if (bad.length) throw invalidInput(bad)
    if (!resetTokenValid(token)) throw linkInvalid()
    if (token !== 'demo') consumeResetToken(token, password)
    return null
  }),
}
