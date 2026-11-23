/**
 * 11 운영 · 관리자 — 명세에서 보류(관리자 화면 보류)라 옛 초안 그대로 둔다. 관리자 화면은 data/admin.ts 를 바로 쓴다.
 * 명세 API 가 없으므로 ENDPOINTS 는 비어 있고 PENDING 도 없다.
 */
import { http } from '../client'
import type { PageDto } from '../common/types'
import type { NoticeCategory } from '../settings/types'
import type { AdminMemberDto, AdminReportDto, LegacyId as Id, ReportStatus, SuspendRequest, WithdrawReasonStatDto } from './types'

export const ENDPOINTS: readonly string[] = []

export const real = {
  adminReports: (q: { status?: ReportStatus; page?: number; size?: number }, signal?: AbortSignal) => http.get<PageDto<AdminReportDto>>('/admin/reports', { ...q }, signal),
  /** PATCH /admin/reports/{id} — 가리기·복구·삭제·문제 없음 */
  resolveReport: (id: Id, status: ReportStatus, memo?: string) => http.patch<void>(`/admin/reports/${id}`, { status, memo }),
  adminMembers: (q: { q?: string; page?: number; size?: number }, signal?: AbortSignal) => http.get<PageDto<AdminMemberDto>>('/admin/members', { ...q }, signal),
  suspend: (memberId: Id, req: SuspendRequest) => http.post<void>(`/admin/members/${memberId}/suspensions`, req),
  liftSuspension: (memberId: Id) => http.delete<void>(`/admin/members/${memberId}/suspensions/current`),
  withdrawStats: (signal?: AbortSignal) => http.get<WithdrawReasonStatDto[]>('/admin/withdraw-reasons', undefined, signal),
  createNotice: (n: { category: NoticeCategory; title: string; content: string }) => http.post<{ id: Id }>('/admin/notices', n),
}
export type AdminApi = typeof real
