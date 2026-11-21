import { createStore } from '../lib/store'

/**
 * F10 계정 저장소: 가입 방식 · Google 연동 · 비밀번호(목) · 차단 목록 · 관리자 역할
 * 프로토타입이라 브라우저(localStorage)에만 저장한다.
 *
 * 다른 화면에서 쓸 것 (차단):
 *   import { blockUser, unblockUser, isBlocked, useBlocked } from '../data/account'
 *   - 프로필 팝업·글/댓글 "더 보기 › 차단" → blockUser({ id, nickname })
 *   - 채팅 요청·댓글 목록에서 숨길 때 → isBlocked(userId)
 */
export interface BlockedUser {
  id: string
  nickname: string
  /** YYYY.MM.DD */
  blockedAt: string
}

export type SignupMethod = 'email' | 'google'

interface AccountState {
  /** 'google' 이면 Google로만 가입한 계정 (비밀번호 없음) */
  signup: SignupMethod
  /** 연결된 Google 이메일. null 이면 연동 안 됨 */
  googleEmail: string | null
  /** 목 비밀번호 (현재 비밀번호 확인용) */
  password: string
  blocked: BlockedUser[]
  /** 관리자 역할 (DB에서 직접 줌. 프로토타입은 /admin?as=admin 으로 켬) */
  admin: boolean
}

export const MOCK_PASSWORD = 'digul123!'
export const MY_GOOGLE_EMAIL = 'dugul.mole@gmail.com'

const INIT: AccountState = {
  signup: 'email',
  googleEmail: null,
  password: MOCK_PASSWORD,
  blocked: [
    { id: 'b-star', nickname: '별빛두더지', blockedAt: '2026.11.05' },
    { id: 'b-potato', nickname: '책읽는감자', blockedAt: '2026.11.03' },
    { id: 'b-rabbit', nickname: '산책토끼', blockedAt: '2026.10.28' },
  ],
  admin: false,
}

export const accountStore = createStore<AccountState>(INIT, 'digul.account.v1')
export const useAccount = () => accountStore.use()
export const useBlocked = () => accountStore.use().blocked

export const hasPassword = (s = accountStore.get()) => s.signup === 'email'
export const isGoogleOnly = (s = accountStore.get()) => s.signup === 'google'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function isBlocked(userId: string) { return accountStore.get().blocked.some((b) => b.id === userId) }
export function blockUser(u: { id: string; nickname: string }) {
  if (isBlocked(u.id)) return
  accountStore.set((s) => ({ blocked: [{ id: u.id, nickname: u.nickname, blockedAt: today() }, ...s.blocked] }))
}
export function unblockUser(userId: string) {
  accountStore.set((s) => ({ blocked: s.blocked.filter((b) => b.id !== userId) }))
}

export function linkGoogle(email: string) { accountStore.set({ googleEmail: email }) }
export function unlinkGoogle() { if (hasPassword()) accountStore.set({ googleEmail: null }) }
export function changePassword(next: string) { accountStore.set({ password: next }) }
export function setSignupMethod(m: SignupMethod) {
  accountStore.set(m === 'google' ? { signup: 'google', googleEmail: MY_GOOGLE_EMAIL } : { signup: 'email' })
}
export function setAdmin(on: boolean) { accountStore.set({ admin: on }) }

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

/** 00 공통 9 비밀번호 규칙: 8자 이상, 영문·숫자·특수기호(!@#$%) 각 1개 이상, 그 밖의 문자는 못 씀 */
export function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[a-zA-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[!@#$%]/.test(pw),
    allowed: /^[a-zA-Z0-9!@#$%]*$/.test(pw),
  }
}
export const passwordOk = (pw: string) => Object.values(passwordChecks(pw)).every(Boolean)
