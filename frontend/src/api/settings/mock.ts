/**
 * 10 설정 · 계정 — 목 서버 (명세 모양 · 명세 code 로 실패).
 * "DB": data/account.ts(계정 · 푸시 등록 · 탈퇴 사유) · data/notifications.ts(알림 설정, 알림 영역과 같이 씀) · data/serviceNotices.ts(공지)
 *       · data/meetupStore.ts(탈퇴를 막는 예정 모임, 읽기만)
 * Google 확인 기록(서버 Redis, 세션에 묶임, 10분)은 이 모듈의 메모리
 */
import { badRequest, conflict, emptyPage, invalidInput, mockRead, mockWrite, notFound, paginate } from '../mock/server'
import { toAppId, toDtoId } from '../common/ids'
import {
  accountStore, changePassword as savePassword, LEAVE_REASONS, pushSubStore, setSignupMethod, withdraw as withdrawAccount, type SignupMethod,
} from '../../data/account'
import { LOGIN_FREE, authState, setAuthState, setMockNextStep } from '../../data/auth'
import { ME_ID } from '../../data/mock'
import { getMeetupState, isPast, startMs } from '../../data/meetupStore'
import { noticePrefs, setBrowserPush, setNoticeKind, type NoticeKind } from '../../data/notifications'
import { serviceNoticeOf, serviceNoticeStore, type ServiceNotice } from '../../data/serviceNotices'
import { checkPassword } from '../../lib/authRules'
import { toIso, ymdMs } from '../../lib/time'
import { GOOGLE_RETURN } from '../auth/google'
import type { SettingsApi } from './real'
import type {
  AccountDto, GoogleVerifyPurpose, NoticeCategory, NoticeDetailDto, NoticeSummaryDto, NotificationSettingValuesDto, WithdrawalCheckDto, WithdrawReason,
} from './types'

/** 목 서버의 푸시 공개 키 (VAPID 모양만) */
export const MOCK_PUSH_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const VERIFY_TTL = 10 * 60_000

/* ===== 계정 ===== */
const hasPw = () => accountStore.get().signup === 'email'
export function accountDto(): AccountDto {
  const a = accountStore.get()
  const linked = a.signup === 'google' || !!a.googleEmail
  return { hasPassword: hasPw(), isGoogleLinked: linked, googleEmail: linked ? a.googleEmail : null, canUnlinkGoogle: linked && hasPw() }
}

/* ===== Google 확인 기록 ===== */
interface Verification { purpose: GoogleVerifyPurpose; email: string; at: number }
let verification: Verification | null = null
const validVerification = (purpose: GoogleVerifyPurpose) =>
  verification && verification.purpose === purpose && Date.now() - verification.at < VERIFY_TTL ? verification : null
const loggedIn = () => LOGIN_FREE || authState() === 'member'
/** 다른 계정이 쓰는 Google 계정 (흉내) */
const TAKEN_GOOGLE = 'taken.mole@gmail.com'

/**
 * 흉내 Google 화면에서 고른 계정으로 "콜백"이 하는 일 (10 "Google 확인"). 돌아갈 프론트 주소를 준다.
 * email 이 null 이면 Google 에서 취소
 */
export function mockGoogleVerify(purpose: GoogleVerifyPurpose, email: string | null): string {
  if (!loggedIn()) return GOOGLE_RETURN.login
  if (!email) return GOOGLE_RETURN.verifyFailed(purpose, 'GOOGLE_VERIFICATION_FAILED')
  const acc = accountDto()
  if (purpose === 'LINK') {
    if (acc.isGoogleLinked) return GOOGLE_RETURN.verifyFailed(purpose, 'GOOGLE_ALREADY_LINKED')
    if (email === TAKEN_GOOGLE) return GOOGLE_RETURN.verifyFailed(purpose, 'GOOGLE_ACCOUNT_DUPLICATED')
    verification = { purpose, email, at: Date.now() }
    return GOOGLE_RETURN.linkVerified
  }
  if (email !== acc.googleEmail) return GOOGLE_RETURN.verifyFailed(purpose, 'GOOGLE_ACCOUNT_MISMATCH')
  verification = { purpose, email, at: Date.now() }
  return GOOGLE_RETURN.withdrawVerified
}

/* ===== 알림 설정 ===== */
const KIND_OF: [keyof NotificationSettingValuesDto, NoticeKind][] = [
  ['isMeetupOn', '모임'], ['isChatOn', '채팅'], ['isCommunityOn', '게시판'], ['isBurrowOn', '땅굴'], ['isNoticeOn', '공지'],
]
function settingValues(): NotificationSettingValuesDto {
  const k = noticePrefs.get().kinds
  return Object.fromEntries(KIND_OF.map(([f, kind]) => [f, k[kind] !== false])) as unknown as NotificationSettingValuesDto
}

/* ===== 공지 ===== */
const NOTICE_CAT: Record<ServiceNotice['cat'], NoticeCategory> = { 공지: 'NOTICE', 업데이트: 'UPDATE', 이벤트: 'EVENT' }
const noticeSummary = (n: ServiceNotice): NoticeSummaryDto =>
  ({ id: toDtoId(n.id), category: NOTICE_CAT[n.cat] ?? 'NOTICE', title: n.title, createdAt: toIso(ymdMs(n.date.replace(/\./g, '-'), 10)) })
const noticeDetail = (n: ServiceNotice): NoticeDetailDto => ({ ...noticeSummary(n), content: n.body.join('\n') })

/* ===== 탈퇴 ===== */
const REASON_LABEL: Record<WithdrawReason, string> = {
  NOT_USING: LEAVE_REASONS[0], COURSE_ENDED: LEAVE_REASONS[1], NO_MATCH: LEAVE_REASONS[2],
  INCONVENIENT: LEAVE_REASONS[3], UNPLEASANT: LEAVE_REASONS[4], ETC: LEAVE_REASONS[5],
}
/** 시연: 주소에 ?hosting=0 이면 내가 연 예정 모임이 없는 것으로 (모임 쪽 삭제가 저장되지 않는 프로토타입) */
const ignoreHosting = () => typeof window !== 'undefined' && /[?&]hosting=0/.test(window.location.href)
function hostingMeetups(): WithdrawalCheckDto['hostingMeetups'] {
  if (ignoreHosting()) return []
  return getMeetupState().list
    .filter((m) => m.hostId === ME_ID && !m.cancelled && !m.past && !isPast(m))
    .sort((a, b) => startMs(a) - startMs(b))
    .map((m) => ({ id: toDtoId(m.id), title: m.title, startsAt: toIso(startMs(m)) }))
}

/** 데모 손잡이 (화면 목록의 "Google 로만 가입한 계정으로 보기"). 목 서버에서만 뜻이 있음 */
export const settingsMockDemo = {
  setAccountKind: (kind: SignupMethod) => setSignupMethod(kind),
  /** 처음 비밀번호 (목) */
  initialPassword: 'digul123!',
}

export const mock: SettingsApi = {
  account: (signal) => mockRead(accountDto, { signal }),
  changePassword: ({ currentPassword, newPassword }) => mockWrite(() => {
    if (!currentPassword) throw invalidInput({ currentPassword: '지금 비밀번호를 입력해야 합니다.' })
    if (!checkPassword(newPassword).ok) throw invalidInput({ newPassword: '비밀번호 규칙에 맞지 않습니다.' })
    if (!hasPw()) throw conflict('PASSWORD_NOT_SET', '비밀번호가 없는 계정입니다.')
    const cur = accountStore.get().password
    if (currentPassword !== cur) throw badRequest('CURRENT_PASSWORD_MISMATCH', '지금 비밀번호가 맞지 않습니다.')
    if (newPassword === cur) throw badRequest('PASSWORD_UNCHANGED', '지금 비밀번호와 같습니다.')
    savePassword(newPassword)
    return null
  }),
  googleVerifyUrl: (purpose) => `/oauth/mock-google?purpose=${purpose}`,
  linkGoogle: () => mockWrite(() => {
    const v = validVerification('LINK')
    const acc = accountDto()
    if (!v) {
      if (acc.isGoogleLinked) return acc
      throw conflict('GOOGLE_VERIFICATION_REQUIRED', 'Google 확인을 먼저 받아야 합니다.')
    }
    if (acc.isGoogleLinked && acc.googleEmail !== v.email) throw conflict('GOOGLE_ALREADY_LINKED', '이미 다른 Google 계정이 연결돼 있습니다.')
    accountStore.set({ googleEmail: v.email })
    verification = null
    return accountDto()
  }),
  unlinkGoogle: () => mockWrite(() => {
    const acc = accountDto()
    if (!acc.isGoogleLinked) return acc
    if (!acc.hasPassword) throw conflict('GOOGLE_UNLINK_NOT_ALLOWED', '비밀번호가 없는 계정은 연동을 해제할 수 없습니다.')
    accountStore.set({ googleEmail: null })
    return accountDto()
  }),

  notificationSettings: (signal) => mockRead(() => ({ ...settingValues(), pushPublicKey: MOCK_PUSH_PUBLIC_KEY }), { signal }),
  updateNotificationSettings: (req) => mockWrite(() => {
    const missing = KIND_OF.filter(([f]) => typeof req[f] !== 'boolean')
    if (missing.length) throw invalidInput(Object.fromEntries(missing.map(([f]) => [f, '값이 필요합니다.'])))
    for (const [f, kind] of KIND_OF) setNoticeKind(kind, req[f])
    return settingValues()
  }),
  registerPush: ({ endpoint, keys }) => mockWrite(() => {
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000 || !keys?.p256dh || !keys?.auth) throw invalidInput({ endpoint: '푸시 구독 값이 올바르지 않습니다.' })
    const s = pushSubStore.get()
    const old = s.list.find((x) => x.endpoint === endpoint)
    const id = old?.id ?? s.seq + 1
    if (!old) pushSubStore.set({ seq: id, list: [...s.list, { id, endpoint }] })
    setBrowserPush(true) // 목: 이 브라우저로 "서버 푸시" (api/notifications/mock 의 browserPush 가 브라우저 알림을 띄움)
    return { pushSubscriptionId: id }
  }),
  deletePush: (pushSubscriptionId) => mockWrite(() => {
    const list = pushSubStore.get().list.filter((x) => x.id !== pushSubscriptionId)
    pushSubStore.set({ list })
    if (!list.length) setBrowserPush(false)
    return null
  }),

  notices: (q = {}, signal) => mockRead(() => {
    const size = Math.min(50, Math.max(1, q.size ?? 10))
    const all = [...serviceNoticeStore.get().list].sort((a, b) => b.date.localeCompare(a.date))
    return paginate(all.map(noticeSummary), q.page ?? 1, size)
  }, { signal, empty: () => ({ ...emptyPage<NoticeSummaryDto>(q.size ?? 10), totalPages: 0 }) }),
  notice: (noticeId, signal) => mockRead(() => {
    const n = serviceNoticeOf(toAppId(noticeId))
    if (!n) throw notFound('NOTICE', '없거나 삭제한 공지입니다.')
    return noticeDetail(n)
  }, { signal, detail: 'NOTICE' }),

  withdrawalCheck: (signal) => mockRead(() => {
    const hosting = hostingMeetups()
    return { canWithdraw: hosting.length === 0, hostingMeetups: hosting, isGoogleVerified: !hasPw() && !!validVerification('WITHDRAW') }
  }, { signal }),
  withdraw: ({ password, reason }) => mockWrite(() => {
    if (reason != null && !(reason in REASON_LABEL)) throw invalidInput({ reason: '목록에 없는 탈퇴 사유입니다.' })
    if (hasPw()) {
      if (!password) throw invalidInput({ password: '비밀번호를 입력해야 합니다.' })
      if (password !== accountStore.get().password) throw badRequest('CURRENT_PASSWORD_MISMATCH', '비밀번호가 맞지 않습니다.')
    } else if (!validVerification('WITHDRAW')) {
      throw conflict('GOOGLE_VERIFICATION_REQUIRED', 'Google 확인을 먼저 받아야 합니다.')
    }
    if (hostingMeetups().length) throw conflict('HOSTING_MEETUP_EXISTS', '내가 연 예정 모임이 있습니다.')
    withdrawAccount(reason ? REASON_LABEL[reason] : null)
    pushSubStore.set({ list: [] })
    setBrowserPush(false)
    verification = null
    setAuthState('guest')
    setMockNextStep('HOME')
    return null
  }),
}
