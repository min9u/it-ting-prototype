/**
 * 02 로그인 · 회원가입 DTO. 명세: docs/backend/team-spec/api/02-auth.md
 * 위쪽은 명세 모양(구현됨: 세션 · 내 계정), 아래 "초안" 은 아직 명세로 옮기지 않은 것 (인증 작업자가 바꿈)
 */
import type { Id, UtcInstant } from '../common/types'
import type { MemberProfileDto } from '../common/legacy'

/* ===== 명세 모양 ===== */
/** 다음에 갈 화면 (02 "다음에 갈 화면") */
export type NextStep = 'ONBOARDING' | 'NEW_TERM' | 'HOME'

/** POST /sessions 요청 */
export interface LoginRequest { email: string; password: string }
/** POST /sessions 응답 (201) */
export interface SessionDto { userId: Id; nextStep: NextStep }

/** GET /me */
export interface MeDto {
  userId: Id
  nextStep: NextStep
  campusName: string
  generation: number
  floor: number
  campusFloorId: Id
}

/** 403 ACCOUNT_SUSPENDED 의 error.detail */
export interface SuspendedDetail { reason: string; endsAt: UtcInstant }

/* ===== 초안 (api-draft.md) — 인증 작업자가 명세 모양으로 바꿀 것 ===== */
/** @deprecated 초안의 GET /me 모양 */
export interface LegacyMeDto extends MemberProfileDto {
  email: string | null
  role: 'USER' | 'ADMIN'
  ssafyVerifiedAt: string | null
  onboardedAt: string | null
  termsAgreedAt: string | null
  googleLinked: boolean
  hasPassword: boolean
}
/** @deprecated 초안의 로그인 결과 */
export interface LegacyLoginResponseDto {
  member: LegacyMeDto
  next: 'ONBOARDING' | 'HOME'
}
