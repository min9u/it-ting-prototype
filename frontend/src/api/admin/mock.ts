/** 11 운영 · 관리자 (명세 보류) — 목 서버. data/admin.ts · data/account.ts(탈퇴 사유) · data/serviceNotices.ts */
import { mockRead, mockWrite, notFound, paginate } from '../mock/server'
import { userDisplay } from '../common/mockPeople'
import { REPORT_REASON_CODE } from '../community/real'
import type { NoticeCategory } from '../settings/types'
import { liftSuspension, reportStore, resolveReport, sanctionStore, suspend } from '../../data/admin'
import { leaveLog } from '../../data/account'
import { addServiceNotice } from '../../data/serviceNotices'
import { toIso, ymdMs } from '../../lib/time'
import type { AdminApi } from './real'
import type { AdminMemberDto, AdminReportDto, MemberSummaryDto, ReportStatus } from './types'
import type { ReportTargetType } from '../community/types'

const TARGET: Record<string, ReportTargetType> = { 글: 'POST', 댓글: 'COMMENT', 사용자: 'MEMBER', '방명록 글': 'GUESTBOOK' }
const STATUS: Record<string, ReportStatus> = { 대기: 'RECEIVED', 가림: 'HIDDEN', 복구: 'DISMISSED', 삭제: 'SANCTIONED', '문제 없음': 'DISMISSED' }
const STATUS_KO: Record<ReportStatus, '대기' | '가림' | '복구' | '삭제' | '문제 없음'> = { RECEIVED: '대기', HIDDEN: '가림', DISMISSED: '문제 없음', SANCTIONED: '삭제' }
const CAT_KO: Record<NoticeCategory, '공지' | '업데이트' | '이벤트'> = { NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트' }
/** 초안 모양의 사람 (관리자 영역 전용. 명세 모양 userDisplay 에서 만듦) */
function memberSummary(id: string): MemberSummaryDto {
  const d = userDisplay(id)
  return { id: id || 'gone', nickname: d.nickname, status: d.isWithdrawn ? 'WITHDRAWN' : 'ACTIVE', generation: d.generation, campus: d.campusName, floor: d.floor, mole: d.mole }
}
/** 목 데이터의 "2026.11.14" → ISO */
const dotIso = (d: string) => toIso(ymdMs(d.replace(/\./g, '-')))

export const mock: AdminApi = {
  adminReports: (q, signal) => mockRead(() => {
    const list = reportStore.get().list.filter((r) => !q.status || STATUS[r.status] === q.status).map((r): AdminReportDto => ({
      id: r.id, targetType: TARGET[r.target], targetId: r.id, targetPreview: r.summary,
      reporter: { ...memberSummary(''), nickname: r.reporter, status: 'ACTIVE' }, reason: REPORT_REASON_CODE[r.reason] ?? 'ETC', detail: r.memo ?? null,
      status: STATUS[r.status], reportCount: 1, createdAt: dotIso(r.at),
    }))
    return paginate(list, q.page, q.size ?? 20)
  }, { signal }),
  resolveReport: (id, status, memo) => mockWrite(() => { if (!reportStore.get().list.some((r) => r.id === id)) throw notFound('REPORT', '신고를 찾을 수 없습니다.'); resolveReport(id, STATUS_KO[status], memo) }),
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
