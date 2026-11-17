/**
 * 신고 (F7 모임 · F8 글/댓글 · 프로필 · 방명록) · 관리자 (F11). 계약: docs/backend/api-draft.md "신고", "관리자"
 * 신고는 대상마다 한 번 (report UQ reporter_id·target_type·target_id → 409 ALREADY_REPORTED). 3명이면 가려짐은 서버가 처리
 * 목 구현: data/admin.ts · data/account.ts(탈퇴 사유) · data/serviceNotices.ts
 */
import { API_MODE } from './config'
import { http } from './client'
import { mockRead, mockWrite, notFound, paginate } from './mock/server'
import { memberSummary } from './mock/serialize'
import { liftSuspension, reportStore, resolveReport, sanctionStore, suspend } from '../data/admin'
import { leaveLog } from '../data/account'
import { addServiceNotice } from '../data/serviceNotices'
import { toIso, ymdMs } from '../lib/time'
import type {
  AdminMemberDto, AdminReportDto, Id, NoticeCategory, PageDto, ReportReason, ReportRequest, ReportStatus, ReportTargetType, SuspendRequest,
  WithdrawReasonStatDto,
} from './types'

/** 화면 사유 문구 ↔ reason 코드 (components/Feedback REPORT_REASONS) */
export const REPORT_REASON_CODE: Record<string, ReportReason> = { '스팸·홍보': 'SPAM', '욕설·비하·괴롭힘': 'ABUSE', 음란물: 'SEXUAL', 기타: 'ETC' }
/** ReportDialog 가 주는 사유("기타: …" 포함) → 요청 본문 */
export function reportBody(targetType: ReportTargetType, targetId: Id, picked: string): ReportRequest {
  const etc = picked.startsWith('기타:')
  return { targetType, targetId, reason: etc ? 'ETC' : REPORT_REASON_CODE[picked] ?? 'ETC', detail: etc ? picked.slice(3).trim() : null }
}

const real = {
  /** POST /reports */
  create: (req: ReportRequest) => http.post<void>('/reports', req),
  /* ----- 관리자 (role ADMIN, 아니면 403) ----- */
  adminReports: (q: { status?: ReportStatus; page?: number; size?: number }, signal?: AbortSignal) => http.get<PageDto<AdminReportDto>>('/admin/reports', { ...q }, signal),
  /** PATCH /admin/reports/{id} — 가리기·복구·삭제·문제 없음 */
  resolveReport: (id: Id, status: ReportStatus, memo?: string) => http.patch<void>(`/admin/reports/${id}`, { status, memo }),
  adminMembers: (q: { q?: string; page?: number; size?: number }, signal?: AbortSignal) => http.get<PageDto<AdminMemberDto>>('/admin/members', { ...q }, signal),
  /** POST /admin/members/{id}/suspensions — member_suspension */
  suspend: (memberId: Id, req: SuspendRequest) => http.post<void>(`/admin/members/${memberId}/suspensions`, req),
  /** DELETE /admin/members/{id}/suspensions/current — lifted_at */
  liftSuspension: (memberId: Id) => http.delete<void>(`/admin/members/${memberId}/suspensions/current`),
  withdrawStats: (signal?: AbortSignal) => http.get<WithdrawReasonStatDto[]>('/admin/withdraw-reasons', undefined, signal),
  /** POST /admin/notices — 공지 작성 (+ 모두에게 SERVICE_NOTICE 알림) */
  createNotice: (n: { category: NoticeCategory; title: string; content: string }) => http.post<{ id: Id }>('/admin/notices', n),
}
export type ReportsApi = typeof real

/* ===== 목 서버 ===== */
const TARGET: Record<string, ReportTargetType> = { 글: 'POST', 댓글: 'COMMENT', 사용자: 'MEMBER', '방명록 글': 'GUESTBOOK' }
const STATUS: Record<string, ReportStatus> = { 대기: 'RECEIVED', 가림: 'HIDDEN', 복구: 'DISMISSED', 삭제: 'SANCTIONED', '문제 없음': 'DISMISSED' }
const STATUS_KO: Record<ReportStatus, '대기' | '가림' | '복구' | '삭제' | '문제 없음'> = { RECEIVED: '대기', HIDDEN: '가림', DISMISSED: '문제 없음', SANCTIONED: '삭제' }
const CAT_KO: Record<NoticeCategory, '공지' | '업데이트' | '이벤트'> = { NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트' }
/** 목 데이터의 "2026.11.14" → ISO */
const dotIso = (d: string) => toIso(ymdMs(d.replace(/\./g, '-')))

const mock: ReportsApi = {
  // 대상별 신고 기록은 각 저장소(boardStore.reportPost · meetupStore.report …)가 하고, 여기서는 받기만
  create: () => mockWrite(() => undefined),
  adminReports: (q, signal) => mockRead(() => {
    const list = reportStore.get().list.filter((r) => !q.status || STATUS[r.status] === q.status).map((r): AdminReportDto => ({
      id: r.id, targetType: TARGET[r.target], targetId: r.id, targetPreview: r.summary,
      reporter: { ...memberSummary(''), nickname: r.reporter, status: 'ACTIVE' }, reason: REPORT_REASON_CODE[r.reason] ?? 'ETC', detail: r.memo ?? null,
      status: STATUS[r.status], reportCount: 1, createdAt: dotIso(r.at),
    }))
    return paginate(list, q.page, q.size ?? 20)
  }, { signal }),
  resolveReport: (id, status, memo) => mockWrite(() => { if (!reportStore.get().list.some((r) => r.id === id)) throw notFound('신고'); resolveReport(id, STATUS_KO[status], memo) }),
  adminMembers: (q, signal) => mockRead(() => paginate(sanctionStore.get().list.filter((u) => !q.q || u.nickname.includes(q.q)).map((u): AdminMemberDto => ({
    ...memberSummary(u.userId), id: u.userId, nickname: u.nickname, status: u.until ? 'SUSPENDED' : 'ACTIVE', email: null, role: 'USER',
    createdAt: toIso(Date.UTC(2026, 8, 1)), suspendedUntil: u.until ? dotIso(u.until) : null,
  })), q.page, q.size ?? 20), { signal }),
  suspend: (memberId, req) => mockWrite(() => suspend(memberId, req.days, req.reason)),
  liftSuspension: (memberId) => mockWrite(() => liftSuspension(memberId)),
  withdrawStats: (signal) => mockRead(() => {
    const cnt = new Map<string, number>()
    for (const r of leaveLog.get().reasons) cnt.set(r.reason, (cnt.get(r.reason) ?? 0) + 1)
    return [...cnt.entries()].map(([reason, count]) => ({ reason, count }))
  }, { signal }),
  createNotice: (n) => mockWrite(() => ({ id: addServiceNotice({ cat: CAT_KO[n.category], title: n.title, body: n.content.split('\n') }).id })),
}

export const reports: ReportsApi = API_MODE === 'real' ? real : mock
