/**
 * 10 설정 · 계정 — 실제 서버 호출. 명세: docs/backend/team-spec/api/10-settings.md
 * 로그아웃(DELETE /sessions/current)은 02 문서라 api/auth 에 있다.
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다 (화면에서 아직 안 씀. 설정 화면은 data/* 를 바로 씀)
 * 차단(blocks)은 명세 10 에 없다 → 인증 · 설정 작업자가 명세(spec/)를 보고 남길지 뺄지 정한다
 */
import { http } from '../client'
import type { LegacyId as Id } from '../common/legacy'
import type { MemberSummaryDto } from '../common/legacy'
import type { NoticeDto, NotificationSettingDto } from './types'

export const ENDPOINTS: readonly string[] = []

export const real = {
  getSettings: (signal?: AbortSignal) => http.get<NotificationSettingDto>('/me/notification-settings', undefined, signal),
  updateSettings: (patch: Partial<NotificationSettingDto>) => http.patch<NotificationSettingDto>('/me/notification-settings', patch),
  /** GET /notices — 공지사항 */
  notices: (signal?: AbortSignal) => http.get<NoticeDto[]>('/notices', undefined, signal),
  notice: (id: Id, signal?: AbortSignal) => http.get<NoticeDto>(`/notices/${id}`, undefined, signal),
  /** 차단 (초안. 명세 10 에 없음) */
  blocked: (signal?: AbortSignal) => http.get<(MemberSummaryDto & { blockedAt: string })[]>('/me/blocks', undefined, signal),
  block: (memberId: Id) => http.put<void>(`/me/blocks/${memberId}`),
  unblock: (memberId: Id) => http.delete<void>(`/me/blocks/${memberId}`),
  /** 회원 탈퇴 (초안 DELETE /me → 명세 POST /me/withdraw) */
  withdraw: (reason: string | null) => http.delete<void>('/me', { body: { reason } }),
}
export type SettingsApi = typeof real
