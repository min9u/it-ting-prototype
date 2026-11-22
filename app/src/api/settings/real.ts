/**
 * 10 설정 · 계정 — 실제 서버 호출. 명세: docs/backend/team-spec/api/10-settings.md
 * 로그아웃(DELETE /sessions/current)은 02 문서라 api/auth 에 있다.
 * 이 영역의 API 는 온보딩을 마치고 이번 학기를 고른 계정만 부를 수 있다 (아니면 403 ONBOARDING_INCOMPLETE · NEW_TERM_INCOMPLETE)
 * 차단(blocks)은 명세에 없는 기능이라(spec/README "이번 범위에 없는 것") 초안 API 를 지웠다
 */
import { API_BASE } from '../config'
import { http, seg } from '../client'
import type { Id, PageDto, PageQuery } from '../common/types'
import type {
  AccountDto, GoogleVerifyPurpose, NoticeDetailDto, NoticeSummaryDto, NotificationSettingsDto, NotificationSettingsUpdateRequest,
  NotificationSettingValuesDto, PasswordChangeRequest, PushSubscriptionDto, PushSubscriptionRequest, WithdrawalCheckDto, WithdrawRequest,
} from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/me/account',
  'PATCH /api/v1/me/password',
  'GET /api/v1/oauth/google/verify',
  'PUT /api/v1/me/google-link',
  'DELETE /api/v1/me/google-link',
  'GET /api/v1/me/notification-settings',
  'PATCH /api/v1/me/notification-settings',
  'POST /api/v1/me/push-subscriptions',
  'DELETE /api/v1/me/push-subscriptions/{pushSubscriptionId}',
  'GET /api/v1/notices',
  'GET /api/v1/notices/{noticeId}',
  'GET /api/v1/me/withdrawal-check',
  'POST /api/v1/me/withdraw',
]

export const real = {
  /* ----- 계정 · 비밀번호 · Google ----- */
  /** GET /me/account — 가입 방법 · Google 연동 상태 (설정 화면을 열 때) */
  account: (signal?: AbortSignal) => http.get<AccountDto>('/me/account', undefined, signal),
  /** PATCH /me/password — 400 CURRENT_PASSWORD_MISMATCH · PASSWORD_UNCHANGED, 409 PASSWORD_NOT_SET */
  changePassword: (req: PasswordChangeRequest) => http.patch<null>('/me/password', req),
  /** GET /oauth/google/verify?purpose= — 브라우저가 이 주소로 이동 (fetch 아님). 돌아오는 곳은 api/auth/google.ts GOOGLE_RETURN */
  googleVerifyUrl: (purpose: GoogleVerifyPurpose) => `${API_BASE}/oauth/google/verify?purpose=${purpose}`,
  /** PUT /me/google-link — 방금 확인받은 Google 계정 연결 (Google 에서 돌아온 주소의 verified=true 를 보고) */
  linkGoogle: () => http.put<AccountDto>('/me/google-link'),
  /** DELETE /me/google-link — 연동 해제. 409 GOOGLE_UNLINK_NOT_ALLOWED */
  unlinkGoogle: () => http.delete<AccountDto>('/me/google-link'),

  /* ----- 알림 설정 · 브라우저 푸시 ----- */
  /** GET /me/notification-settings — 다섯 갈래 + pushPublicKey */
  notificationSettings: (signal?: AbortSignal) => http.get<NotificationSettingsDto>('/me/notification-settings', undefined, signal),
  /** PATCH /me/notification-settings — 스위치마다 다섯 값을 모두 보냄 (저장 버튼 없음) */
  updateNotificationSettings: (req: NotificationSettingsUpdateRequest) => http.patch<NotificationSettingValuesDto>('/me/notification-settings', req),
  /** POST /me/push-subscriptions — 이 브라우저를 푸시 받을 곳으로 (같은 endpoint 면 내 것으로 바뀜) */
  registerPush: (req: PushSubscriptionRequest) => http.post<PushSubscriptionDto>('/me/push-subscriptions', req),
  /** DELETE /me/push-subscriptions/{pushSubscriptionId} — 끌 때 · 로그아웃 직전 (없거나 남의 것이어도 성공) */
  deletePush: (pushSubscriptionId: Id) => http.delete<null>(`/me/push-subscriptions/${seg(pushSubscriptionId)}`),

  /* ----- 공지 ----- */
  /** GET /notices?page&size — 최신순, 한 페이지 10개 (1 ~ 50) */
  notices: (q: PageQuery = {}, signal?: AbortSignal) => http.get<PageDto<NoticeSummaryDto>>('/notices', { page: q.page, size: q.size }, signal),
  /** GET /notices/{noticeId} — 404 NOTICE_NOT_FOUND */
  notice: (noticeId: Id, signal?: AbortSignal) => http.get<NoticeDetailDto>(`/notices/${seg(noticeId)}`, undefined, signal),

  /* ----- 탈퇴 ----- */
  /** GET /me/withdrawal-check — 열 때 · Google 에서 돌아왔을 때 */
  withdrawalCheck: (signal?: AbortSignal) => http.get<WithdrawalCheckDto>('/me/withdrawal-check', undefined, signal),
  /** POST /me/withdraw — 400 CURRENT_PASSWORD_MISMATCH, 409 GOOGLE_VERIFICATION_REQUIRED · HOSTING_MEETUP_EXISTS. 성공하면 로그아웃된 상태 */
  withdraw: (req: WithdrawRequest) => http.post<null>('/me/withdraw', req),
}
export type SettingsApi = typeof real
