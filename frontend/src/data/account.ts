import { createStore } from '../lib/store'

/**
 * F10 계정 — 목 서버의 "DB" (api/settings/mock.ts · api/auth/mock.ts 만 쓴다. 화면은 api/settings 를 거친다).
 * 가입 방식 · Google 연동 · 비밀번호(목) · 관리자 역할. 프로토타입이라 브라우저(localStorage)에만 저장한다.
 *
 * 차단은 팀 명세에서 뺀 기능이다(spec/README "이번 범위에 없는 것"): 화면 · API 초안 · 이 저장소의 차단 목록까지 모두 지웠다.
 * (예전 브라우저에 저장된 `digul.account.v1` 에 blocked 값이 남아 있어도 읽지 않으니 그대로 둬도 된다)
 */

export type SignupMethod = 'email' | 'google'

interface AccountState {
  /** 'google' 이면 Google로만 가입한 계정 (비밀번호 없음) */
  signup: SignupMethod
  /** 연결된 Google 이메일. null 이면 연동 안 됨 */
  googleEmail: string | null
  /** 목 비밀번호 (현재 비밀번호 확인용) */
  password: string
  /** 관리자 역할 (DB에서 직접 줌. 프로토타입은 /admin?as=admin 으로 켬) */
  admin: boolean
}

export const MOCK_PASSWORD = 'digul123!'
export const MY_GOOGLE_EMAIL = 'dugul.mole@gmail.com'

const INIT: AccountState = {
  signup: 'email',
  googleEmail: null,
  password: MOCK_PASSWORD,
  admin: false,
}

export const accountStore = createStore<AccountState>(INIT, 'digul.account.v1')
export const useAccount = () => accountStore.use()

export const hasPassword = (s = accountStore.get()) => s.signup === 'email'
export const isGoogleOnly = (s = accountStore.get()) => s.signup === 'google'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function linkGoogle(email: string) { accountStore.set({ googleEmail: email }) }
export function unlinkGoogle() { if (hasPassword()) accountStore.set({ googleEmail: null }) }
export function changePassword(next: string) { accountStore.set({ password: next }) }
export function setSignupMethod(m: SignupMethod) {
  accountStore.set(m === 'google' ? { signup: 'google', googleEmail: MY_GOOGLE_EMAIL } : { signup: 'email' })
}
export function setAdmin(on: boolean) { accountStore.set({ admin: on }) }
/** 목 서버의 브라우저 푸시 등록 표 (push_subscription). endpoint → id */
export const pushSubStore = createStore<{ seq: number; list: { id: number; endpoint: string }[] }>({ seq: 36, list: [] }, 'digul.mock.pushSubs.v1')

/** 목 서버 POST /users: 이 탭의 계정을 새로 가입한 모양으로 (이메일 가입은 비밀번호, Google 가입은 그 Google 이메일) */
export function createAccount(a: { method: SignupMethod; password?: string; googleEmail?: string | null }) {
  accountStore.set(a.method === 'google'
    ? { signup: 'google', googleEmail: a.googleEmail ?? MY_GOOGLE_EMAIL, password: '' }
    : { signup: 'email', googleEmail: null, password: a.password ?? MOCK_PASSWORD })
}

/** 탈퇴 사유 (F10 회원 탈퇴 · 선택). 관리자 "탈퇴 사유 확인"에서 모아 봄 */
/** 여섯 가지 (팀 명세 10 설정 회원 탈퇴 2, 11-20). "기타"를 골라도 글 적는 칸은 없음 */
export const LEAVE_REASONS = ['자주 쓰지 않아요', 'SSAFY 과정이 끝났어요', '맞는 사람이나 모임을 찾지 못했어요', '쓰기 불편해요', '불쾌한 일을 겪었어요', '기타'] as const
export const leaveLog = createStore<{ reasons: { reason: string; at: string }[] }>({
  reasons: [
    { reason: '자주 쓰지 않아요', at: '2026.11.12' },
    { reason: '맞는 사람이나 모임을 찾지 못했어요', at: '2026.11.09' },
    { reason: '자주 쓰지 않아요', at: '2026.11.02' },
  ],
}, 'digul.leaveLog.v2') // v1 은 예전 사유 문구가 저장돼 있어 키를 올림
/** 탈퇴: 계정을 처음 상태로 돌리고(프로토타입), 사유를 남긴다 */
export function withdraw(reason: string | null) {
  if (reason) leaveLog.set((s) => ({ reasons: [{ reason, at: today() }, ...s.reasons] }))
  accountStore.set({ ...INIT })
}

/** 00 공통 9 비밀번호 규칙 (lib/authRules.ts 한 곳. 옛 import 를 위해 다시 내보냄) */
export { passwordChecks, passwordOk } from '../lib/authRules'
