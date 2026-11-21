/**
 * 로그인 · 회원가입 · 비밀번호 찾기 목 데이터와 규칙 (02 명세 F1 · F2 + 00 공통 9 · 11 · 19 · 20, 2026-11-16).
 * 서버가 없어서 이 파일이 "서버" 노릇을 함. 화면 문구·규칙은 명세 그대로, 실패를 보여 주는 계정은 아래 DEMO.
 *
 * 시연용 계정 (docs/spec-f1-f2.md 에도 적어 둠)
 *  - wrong@ssafy.com           → "이메일 또는 비밀번호가 맞지 않아요"
 *  - banned@ssafy.com          → 정지된 계정 팝업 (신고로 인해 7일 동안 로그인할 수 없어요)
 *  - new@ssafy.com             → 온보딩을 안 마친 계정 → 온보딩 1
 *  - 이 탭에서 가입한 이메일   → 가입 때 정한 비밀번호가 아니면 실패
 *  - 그 밖의 형식이 맞는 이메일 → 로그인 성공 → 내 땅굴
 *  - 인증 코드 000000          → "인증 코드가 맞지 않아요" (그 밖의 6자리 숫자는 통과)
 */

/* ===== 00 공통 9 비밀번호 규칙 ===== */
/** 8자 이상. 쓸 수 있는 문자는 영문 대소문자, 숫자, 특수기호 !@#$% 뿐. 영문 · 숫자 · 특수기호를 각각 1개 이상 */
export const PW_RULE_TEXT = '8자 이상 · 영문, 숫자, 특수기호(!@#$%) 각 1개 이상'
export const PW_ALLOWED = /^[A-Za-z0-9!@#$%]*$/
export function checkPassword(pw: string) {
  const allowed = PW_ALLOWED.test(pw)
  const ok = allowed && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw) && /[!@#$%]/.test(pw)
  return { allowed, ok }
}
/** 규칙에 어긋나는 문자(공백 등)를 넣었을 때 바로 띄우는 문구 (명세에 문구가 없어 정함) */
export const PW_BAD_CHAR = '영문 · 숫자 · 특수기호(!@#$%)만 쓸 수 있어요'
export const PW_MISMATCH = '비밀번호가 달라요' // 02 명세는 "일치하지 않아요", Figma 03 은 "달라요" → Figma 를 따름 (2026-11-21)
/**
 * 비밀번호 확인 칸: "입력하는 동안 두 값이 다르면 바로" 띄움.
 * 아직 덜 친 경우(앞부분이 같음)는 기다리고, 갈라지거나 길이가 같아졌는데 다르면 오류
 */
export const confirmMismatch = (pw: string, pw2: string) => pw2.length > 0 && (pw2.length >= pw.length ? pw2 !== pw : !pw.startsWith(pw2))

/* ===== 이메일 ===== */
export const EMAIL_BAD = '이메일 형식을 확인해 주세요'
/** 이메일에 쓸 수 없는 문자(공백, 허용되지 않는 특수문자) → 치는 즉시 오류 */
export const emailHasBadChar = (v: string) => /[^A-Za-z0-9._%+\-@]/.test(v) || (v.match(/@/g)?.length ?? 0) > 1
/** 형식 검사 (칸을 벗어날 때) */
export const emailValid = (v: string) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v)

/* ===== 인증 코드 (회원가입 1 · 3) ===== */
export const CODE_LEN = 6
export const CODE_TTL = 5 * 60 // 5분 (시안 4:52 에서 줄어드는 시간)
export const RESEND_GAP = 30 // 재전송 간격 제한 (명세 "제안") 30초
export const CODE_NOT_DIGIT = '숫자 6자리를 입력해 주세요'
export const CODE_WRONG = '인증 코드가 맞지 않아요'
export const CODE_EXPIRED = '인증 시간이 지났어요. 코드를 다시 받아 주세요'
/** 목 서버의 코드 확인: 000000 만 틀림 */
export const verifyCode = (code: string) => code !== '000000'

/* ===== 00 공통 19 기수 (캠퍼스 · 층 목록은 data/campusFloors.ts 한 곳) ===== */
export const GENERATIONS = ['16기', '15기', '14기', '13기', '12기']

/* ===== 로그인 상태 (00 공통 11) ===== */
/**
 * guest = 비로그인 (랜딩 · 둘러보기 · 로그인 · 회원가입만), member = 로그인.
 * 처음 연 화면으로 정함: 시작 화면(F1 · F2)으로 들어오면 guest, 그 밖의 주소(개발용 바로 가기, 화면 목록)로 들어오면 member.
 * 그래야 팀원이 시작 화면부터 체험할 때는 "로그인해야 볼 수 있는 화면"이 막히고, 개발 중 바로 가기 링크는 그대로 열림.
 * ?guest=1 을 붙이면 언제든 비로그인으로.
 */
export type AuthState = 'guest' | 'member'
/**
 * 지금은 로그인 검사를 끔 (2026-11-16 사용자 요청: "일단 그냥 로그인되게").
 * true 면 로그인 · Google 로 계속하기가 입력과 관계없이 바로 내 땅굴로, 로그인 안 한 상태로도 모든 화면이 열림.
 * 명세대로 막으려면 false 로 (실패·정지·SSAFY 인증 시연 계정, 비로그인 → 로그인 화면 보내기가 다시 켜짐)
 */
export const LOGIN_FREE = true
const KEY = 'digul.auth'
export const START_PATHS = ['/start', '/look', '/login', '/signup', '/password-reset']
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

/* ===== 계정 (목) ===== */
export type LoginResult =
  | { ok: true; next: string }
  | { ok: false; kind: 'mismatch' }
  | { ok: false; kind: 'suspended'; reason: string; days: number; until: string }

/** 이 탭에서 가입한 계정 (이메일 → 비밀번호) */
const accounts = new Map<string, string>()
export const registerAccount = (email: string, pw: string) => { if (email) accounts.set(email.toLowerCase(), pw) }

const addDays = (d: number) => {
  const t = new Date(Date.now() + d * 864e5)
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`
}

/** 로그인 (요청 중 로딩을 보여 주려고 조금 기다림) */
export async function login(email: string, pw: string): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, LOGIN_FREE ? 250 : 700))
  if (LOGIN_FREE) { setAuthState('member'); return { ok: true, next: '/burrow' } }
  const e = email.trim().toLowerCase()
  if (e === 'wrong@ssafy.com') return { ok: false, kind: 'mismatch' }
  if (accounts.has(e) && accounts.get(e) !== pw) return { ok: false, kind: 'mismatch' }
  if (e === 'banned@ssafy.com') return { ok: false, kind: 'suspended', reason: '신고 누적', days: 7, until: addDays(7) }
  setAuthState('member')
  if (e === 'new@ssafy.com') return { ok: true, next: '/onboarding/name' }
  return { ok: true, next: '/burrow' }
}

/** Google 로 계속하기 (목): 처음 쓰는 Google 계정으로 보고 회원가입 3 으로 */
export async function googleLogin(): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, LOGIN_FREE ? 250 : 700))
  if (LOGIN_FREE) { setAuthState('member'); return { ok: true, next: '/burrow' } }
  return { ok: true, next: '/signup/ssafy?via=google' }
}

/* ===== 회원가입 진행 (단계 사이에 넘기는 값) ===== */
export const signupDraft: { email: string; pw: string } = { email: '', pw: '' }

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
export const lastResetToken = (email: string) => resetTokens.find((t) => t.email === email)?.token
/** 링크가 아직 쓸 수 있는지 (없는 토큰 = 이미 다시 보내서 무효가 됐거나 잘못된 링크) */
export function resetTokenValid(token: string | null) {
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
