/**
 * 02 로그인 · 회원가입 — 목 서버의 "DB · 세션" (api/auth/mock.ts 만 쓴다. 화면은 api/auth 를 거친다).
 * 입력 규칙 · 문구는 lib/authRules.ts (여기서는 옛 import 를 위해 다시 내보냄)
 *
 * 시연용 계정 (LOGIN_FREE = false 일 때)
 *  - wrong@ssafy.com           → 401 LOGIN_FAILED "이메일 또는 비밀번호가 맞지 않아요"
 *  - banned@ssafy.com          → 403 ACCOUNT_SUSPENDED (신고 누적, 7일)
 *  - new@ssafy.com             → nextStep ONBOARDING → 온보딩 1
 *  - 이 탭에서 가입한 이메일   → 가입 때 정한 비밀번호가 아니면 LOGIN_FAILED
 *  - 그 밖의 형식이 맞는 이메일 → 로그인 성공 → 내 땅굴
 * 가입 (늘)
 *  - taken@ssafy.com           → 409 EMAIL_DUPLICATED (이미 가입한 이메일)
 *  - Mattermost ID taken.mole  → 409 MATTERMOST_ID_DUPLICATED
 *  - sendfail@ssafy.com · Mattermost ID sendfail → 503 VERIFICATION_SEND_FAILED (메일 · Mattermost 로 못 보냄, 바로 다시 할 수 있음)
 *  - 인증 코드 000000          → 400 VERIFICATION_CODE_MISMATCH (그 밖의 6자리 숫자는 통과). 5번 틀리면 코드를 지움 → VERIFICATION_CODE_EXPIRED
 * Google (목 Google 화면 /oauth/mock-google)
 *  - 가입한 계정(MOCK_GOOGLE.member) → 로그인 / 처음 쓰는 계정 → 회원가입 3 / banned.mole@gmail.com → 정지 팝업
 */
import { ENV } from '../lib/env'
export {
  PW_RULE_TEXT, PW_ALLOWED, checkPassword, PW_BAD_CHAR, PW_MISMATCH, confirmMismatch,
  EMAIL_BAD, emailHasBadChar, emailValid, CODE_LEN, RESEND_GAP, CODE_NOT_DIGIT, CODE_WRONG, CODE_EXPIRED,
} from '../lib/authRules'

/** 목 서버의 인증 코드 유효 시간 (API 02 "인증 코드": 5분) */
export const CODE_TTL = 5 * 60
/**
 * 목 서버의 재전송 간격 (API 02: 60초. 이보다 빨리 다시 부르면 429 TOO_MANY_REQUESTS).
 * 화면의 RESEND_GAP 카운트다운과 같은 값이라 화면에서는 429 를 보기 어렵다
 */
export const MOCK_RESEND_GAP_MS = 60_000
/** 목 서버의 코드 확인: 000000 만 틀림 */
export const verifyCode = (code: string) => code !== '000000'

export const DEMO = {
  wrongEmail: 'wrong@ssafy.com',
  bannedEmail: 'banned@ssafy.com',
  newEmail: 'new@ssafy.com',
  takenEmail: 'taken@ssafy.com',
  takenMattermost: 'taken.mole',
  /** 보내기 실패(503 VERIFICATION_SEND_FAILED) 시연: 이 이메일 · 이 Mattermost ID 로 코드를 받으면 늘 실패 */
  sendFailEmail: 'sendfail@ssafy.com',
  sendFailMattermost: 'sendfail',
} as const

/* ===== 00 공통 19 기수 (캠퍼스 · 층 목록은 data/campusFloors.ts 한 곳) ===== */
export const GENERATIONS = ['16기', '15기', '14기', '13기', '12기']

/* ===== 목 세션 (00 공통 11) ===== */
/**
 * guest = 비로그인, member = 로그인 (실제 서버의 세션 쿠키 ITTING_SESSION 노릇).
 * 처음 연 화면으로 정함: 시작 화면(F1 · F2)으로 들어오면 guest, 그 밖의 주소(개발용 바로 가기, 화면 목록)로 들어오면 member.
 * 그래야 팀원이 시작 화면부터 체험할 때는 "로그인해야 볼 수 있는 화면"이 막히고, 개발 중 바로 가기 링크는 그대로 열림.
 * ?guest=1 을 붙이면 언제든 비로그인으로.
 */
export type AuthState = 'guest' | 'member'
/**
 * 로그인 검사를 끌지 (환경 변수 NEXT_PUBLIC_LOGIN_FREE, 기본 false = 명세대로. 2026-11-23 사용자 결정).
 * true 면 로그인이 입력과 관계없이 성공하고, 로그인 안 한 상태로도 모든 화면이 열림 (GET /me 가 늘 로그인). 시연 · 디자인 확인용
 * false 면 명세대로: 비로그인 → 로그인 화면, nextStep ONBOARDING → 온보딩 1, 시연 계정의 실패 · 정지
 */
export const LOGIN_FREE = ENV.loginFree
const KEY = 'digul.auth'
const STEP_KEY = 'digul.auth.nextStep'
export const START_PATHS = ['/start', '/look', '/login', '/signup', '/password-reset', '/oauth', '/auth/google']
const isStartPath = (p: string) => p === '/' || START_PATHS.some((s) => p === s || p.startsWith(`${s}/`))

function currentPath() {
  if (typeof window === 'undefined') return '/'
  const h = window.location.hash
  return h.startsWith('#/') ? h.slice(1).split('?')[0] : window.location.pathname
}

let state: AuthState | null = null
const read = (): AuthState => {
  if (state) return state
  let saved: string | null = null
  try { saved = sessionStorage.getItem(KEY) } catch { /* 아티팩트 등 저장소가 막힌 곳 */ }
  const forceGuest = typeof window !== 'undefined' && /[?&]guest=1/.test(window.location.href)
  state = forceGuest ? 'guest' : saved === 'guest' || saved === 'member' ? saved : isStartPath(currentPath()) ? 'guest' : 'member'
  try { sessionStorage.setItem(KEY, state) } catch { /* 무시 */ }
  return state
}
export const authState = () => read()
// 앱을 처음 연 주소로 정해야 해서 불러올 때 바로 읽음 (화면 이동 뒤에 처음 읽으면 이동한 주소로 정해짐)
read()
export function setAuthState(v: AuthState) {
  state = v
  try { sessionStorage.setItem(KEY, v) } catch { /* 무시 */ }
}

export type MockNextStep = 'ONBOARDING' | 'NEW_TERM' | 'HOME'
/** 목 세션 계정의 다음 단계 (GET /me 의 nextStep). 온보딩 확정 API(03)가 'HOME' 으로 바꿔야 함 */
export function mockNextStep(): MockNextStep {
  try { const v = sessionStorage.getItem(STEP_KEY); if (v === 'ONBOARDING' || v === 'NEW_TERM' || v === 'HOME') return v } catch { /* 무시 */ }
  return 'HOME'
}
export function setMockNextStep(v: MockNextStep) {
  try { sessionStorage.setItem(STEP_KEY, v) } catch { /* 무시 */ }
}

/* ===== 계정 (목) ===== */
/** 이 탭에서 가입한 계정 (이메일 → 비밀번호) */
const accounts = new Map<string, string>()
export const registerAccount = (email: string, pw: string) => { if (email) accounts.set(email.toLowerCase(), pw) }
export const accountPassword = (email: string) => accounts.get(email.trim().toLowerCase())
export const isTakenEmail = (email: string) => { const e = email.trim().toLowerCase(); return e === DEMO.takenEmail || accounts.has(e) }

/* ===== 비밀번호 재설정 링크 (30분, 한 번만, 다시 보내면 이전 링크 무효) ===== */
export const RESET_TTL_MS = 30 * 60 * 1000
interface ResetToken { token: string; email: string; at: number; used: boolean }
let resetTokens: ResetToken[] = []
const TOKENS_KEY = 'digul.resetTokens'
const loadTokens = () => { try { resetTokens = JSON.parse(sessionStorage.getItem(TOKENS_KEY) ?? '[]') } catch { /* 무시 */ } }
const saveTokens = () => { try { sessionStorage.setItem(TOKENS_KEY, JSON.stringify(resetTokens)) } catch { /* 무시 */ } }
loadTokens()

/** 재설정 메일 보내기: 가입 여부와 관계없이 똑같이 성공(가입 여부 노출 방지). 이전 링크는 무효 */
export function requestReset(email: string): string {
  const token = Math.random().toString(36).slice(2, 10)
  resetTokens = [...resetTokens.filter((t) => t.email !== email), { token, email, at: Date.now(), used: false }]
  saveTokens()
  return token
}
/** 목 "메일함": 그 이메일로 마지막에 보낸 링크의 토큰 */
export const lastResetToken = (email: string) => resetTokens.find((t) => t.email === email)?.token
/** 링크가 아직 쓸 수 있는지 (없는 토큰 = 이미 다시 보내서 무효가 됐거나 잘못된 링크). 'demo' 는 시연용(늘 유효) */
export function resetTokenValid(token: string | null) {
  if (token === 'demo') return true
  const t = resetTokens.find((x) => x.token === token)
  return !!t && !t.used && Date.now() - t.at < RESET_TTL_MS
}
/** 새 비밀번호 저장 → 링크 만료 */
export function consumeResetToken(token: string, pw: string) {
  const t = resetTokens.find((x) => x.token === token)
  if (!t) return
  t.used = true
  saveTokens()
  registerAccount(t.email, pw)
}

/* ===== 00 공통 20 지원 기기: 데스크톱 웹만 ===== */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  if (/[?&]device=mobile/.test(window.location.href)) return true
  const ua = navigator.userAgent
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData?.mobile) return true
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return true
  // iPadOS 는 데스크톱 사파리처럼 보임
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}
