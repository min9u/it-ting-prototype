/**
 * 10 설정 · 계정 DTO — 명세 그대로. 명세: docs/backend/team-spec/api/10-settings.md
 * id 는 숫자(Id), 시각은 UTC "…Z"(UtcInstant), enum 은 대문자, 값이 없으면 null
 */
import type { Id, UtcInstant } from '../common/types'

/* ===== 계정 (GET /me/account · PUT · DELETE /me/google-link 가 같은 모양) ===== */
export interface AccountDto {
  /** 이메일로 가입한 계정 true, Google 로만 가입한 계정 false */
  hasPassword: boolean
  isGoogleLinked: boolean
  /** 연결된 Google 이메일. 연결 안 됐으면 null */
  googleEmail: string | null
  /** isGoogleLinked 이고 hasPassword 일 때만 true */
  canUnlinkGoogle: boolean
}

/** PATCH /me/password 요청. "새 비밀번호 확인" 칸은 보내지 않는다 */
export interface PasswordChangeRequest { currentPassword: string; newPassword: string }

/** GET /oauth/google/verify?purpose= (브라우저 이동) */
export type GoogleVerifyPurpose = 'LINK' | 'WITHDRAW'

/* ===== 알림 설정 ===== */
/** 다섯 갈래 (09 알림의 category 와 같음). 줄이 없는 계정은 모두 true */
export interface NotificationSettingValuesDto {
  isMeetupOn: boolean
  isChatOn: boolean
  isCommunityOn: boolean
  isBurrowOn: boolean
  isNoticeOn: boolean
}
/** GET /me/notification-settings: 다섯 값 + 푸시 구독에 쓰는 공개 키. "브라우저 알림 받기" 상태는 주지 않는다 */
/** pushPublicKey: 서버 설정에 키가 아직 없으면 null (명세 10 API, 브라우저 푸시 KAN-59 전까지) */
export interface NotificationSettingsDto extends NotificationSettingValuesDto { pushPublicKey: string | null }
/** PATCH /me/notification-settings 요청 (다섯 값을 모두) · 응답(저장한 뒤의 다섯 값) */
export type NotificationSettingsUpdateRequest = NotificationSettingValuesDto

/* ===== 브라우저 푸시 ===== */
/** POST /me/push-subscriptions 요청: 브라우저가 만든 구독 그대로 */
export interface PushSubscriptionRequest {
  /** https:// 로 시작, 2,000자까지 */
  endpoint: string
  keys: { p256dh: string; auth: string }
}
/** POST /me/push-subscriptions 응답 (201 새로 · 200 이미 등록) */
export interface PushSubscriptionDto { pushSubscriptionId: Id }

/* ===== 공지 ===== */
export type NoticeCategory = 'NOTICE' | 'UPDATE' | 'EVENT'
/** GET /notices 의 한 줄 (본문 없음) */
export interface NoticeSummaryDto { id: Id; category: NoticeCategory; title: string; createdAt: UtcInstant }
/** GET /notices/{noticeId}. content 는 줄바꿈만 있는 글 (HTML · 마크다운 없음) */
export interface NoticeDetailDto extends NoticeSummaryDto { content: string }

/* ===== 탈퇴 ===== */
/** GET /me/withdrawal-check */
export interface WithdrawalCheckDto {
  /** hostingMeetups 가 비어 있으면 true */
  canWithdraw: boolean
  /** 탈퇴를 막는, 내가 연 예정 모임 (시작이 가까운 것부터) */
  hostingMeetups: { id: Id; title: string; startsAt: UtcInstant }[]
  /** 탈퇴용 Google 확인이 끝나 아직 유효한지 (10분). 비밀번호 계정은 늘 false */
  isGoogleVerified: boolean
}
/** 탈퇴 사유 (글은 프론트가 가짐: mappers WITHDRAW_REASONS) */
export type WithdrawReason = 'NOT_USING' | 'COURSE_ENDED' | 'NO_MATCH' | 'INCONVENIENT' | 'UNPLEASANT' | 'ETC'
/** POST /me/withdraw 요청. password 는 비밀번호 계정만, reason 은 고르지 않았으면 null. "동의" 체크는 보내지 않는다 */
export interface WithdrawRequest { password?: string; reason: WithdrawReason | null }
