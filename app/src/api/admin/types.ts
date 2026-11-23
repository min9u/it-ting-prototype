/**
 * 11 운영 · 관리자 (명세 보류) DTO. 명세: docs/backend/team-spec/api/(없음 — 11 은 명세 보류)
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * (보류. 지금은 아무도 고치지 않음) 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { MoleDto } from '../common/types'
import type { ReportReason, ReportTargetType } from '../community/types'

/** 초안의 id (문자열). 명세는 숫자 Id (2026-11-22 공통의 옛 초안 타입 common/legacy.ts 를 지우며 관리자 영역으로 옮김) */
export type LegacyId = string
/** member.status (초안) */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN'
/** 짧게 보여 주는 사람 (초안. 탈퇴하면 nickname null, status WITHDRAWN) */
export interface MemberSummaryDto {
  id: LegacyId
  nickname: string | null
  status: MemberStatus
  generation: number | null
  campus: string | null
  floor: number | null
  mole: MoleDto
}

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string

/** member.role */
export type MemberRole = 'USER' | 'ADMIN'

/** report.status */
export type ReportStatus = 'RECEIVED' | 'HIDDEN' | 'DISMISSED' | 'SANCTIONED'

export interface AdminReportDto {
  id: LegacyId
  targetType: ReportTargetType
  targetId: LegacyId
  /** 신고된 내용 한 줄 */
  targetPreview: string
  reporter: MemberSummaryDto
  reason: ReportReason
  detail: string | null
  status: ReportStatus
  /** 같은 대상 신고 수 */
  reportCount: number
  createdAt: IsoDateTime
}
export interface AdminMemberDto extends MemberSummaryDto {
  email: string | null
  role: MemberRole
  createdAt: IsoDateTime
  suspendedUntil: IsoDateTime | null
}
export interface SuspendRequest { reason: string; days: number }
export interface WithdrawReasonStatDto { reason: string; count: number }
