/**
 * 07 모임 — 실제 서버 호출. 명세: docs/backend/team-spec/api/07-meetup.md
 *
 * ENDPOINTS: 명세대로 구현한 API 만 적는다 ("메서드 /api/v1/주소", id 자리는 명세 이름 그대로). 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다 → 모임 작업자가 명세 주소 · DTO 로 바꾸고 ENDPOINTS 에 옮겨 적는다
 */
import { http } from '../client'
import type { ReportReason } from '../community/types'
import type { LegacyId as Id } from '../common/legacy'
import type { PageDto } from '../common/types'
import type { ApplicantDto, MeetupCardDto, MeetupDetailDto, MeetupListQuery, MeetupWriteRequest, MyMeetupTab } from './types'

export const ENDPOINTS: readonly string[] = []

export const real = {
  /** GET /meetups — 모임 탐색 (번호 페이지) */
  list: (q: MeetupListQuery, signal?: AbortSignal) => http.get<PageDto<MeetupCardDto>>('/meetups', { ...q, categories: q.categories }, signal),
  /** GET /meetups/{id} */
  get: (id: Id, signal?: AbortSignal) => http.get<MeetupDetailDto>(`/meetups/${id}`, undefined, signal),
  /** POST /meetups/{id}/applications — 참여 신청 (409 MEETUP_FULL · ALREADY_APPLIED · REAPPLY_BLOCKED · RECRUIT_CLOSED) */
  apply: (id: Id, message: string | null) => http.post<MeetupDetailDto>(`/meetups/${id}/applications`, { message }),
  /** DELETE /meetups/{id}/applications/me — 신청 취소 (확정 전) */
  withdraw: (id: Id) => http.delete<MeetupDetailDto>(`/meetups/${id}/applications/me`),
  /** POST /meetups/{id}/leave — 참여 취소 (확정 후, 시작 24시간 전까지. 409 LEAVE_TOO_LATE) */
  quit: (id: Id) => http.post<MeetupDetailDto>(`/meetups/${id}/leave`),
  /** PUT·DELETE /meetups/{id}/like — 찜 (멱등) */
  setLike: (id: Id, on: boolean) => (on ? http.put<void>(`/meetups/${id}/like`) : http.delete<void>(`/meetups/${id}/like`)),
  /** PUT /meetups/{id}/like/vacancy-alert — 빈자리 알림 */
  setVacancyAlert: (id: Id, on: boolean) => http.put<void>(`/meetups/${id}/like/vacancy-alert`, { on }),
  /** POST /reports (targetType MEETUP) */
  report: (id: Id, reason: ReportReason, detail: string | null) => http.post<void>('/reports', { targetType: 'MEETUP', targetId: id, reason, detail }),
  /** GET /me/meetups?tab= — 내 모임 탭 */
  mine: (tab: MyMeetupTab, signal?: AbortSignal) => http.get<MeetupCardDto[]>('/me/meetups', { tab }, signal),
  /** GET /meetups/{id}/applications — 신청 관리 (주최자) */
  applicants: (id: Id, signal?: AbortSignal) => http.get<ApplicantDto[]>(`/meetups/${id}/applications`, { status: 'PENDING' }, signal),
  approve: (id: Id, applicationId: Id) => http.post<void>(`/meetups/${id}/applications/${applicationId}/approve`),
  reject: (id: Id, applicationId: Id) => http.post<void>(`/meetups/${id}/applications/${applicationId}/reject`),
  kick: (id: Id, memberId: Id) => http.delete<void>(`/meetups/${id}/members/${memberId}`),
  /** POST /meetups/{id}/cancel — 확정자가 있으면 취소(기록 남음), DELETE /meetups/{id} — 확정자 0명이면 삭제 */
  cancel: (id: Id) => http.post<void>(`/meetups/${id}/cancel`),
  remove: (id: Id) => http.delete<void>(`/meetups/${id}`),
  /** POST /meetups — 만들기 (응답: 만든 모임 상세) */
  create: (req: MeetupWriteRequest) => http.post<MeetupDetailDto>('/meetups', req),
  /** PUT /meetups/{id} — 수정 (시작 12시간 전까지, 409 EDIT_TOO_LATE) */
  update: (id: Id, req: MeetupWriteRequest) => http.put<MeetupDetailDto>(`/meetups/${id}`, req),
}
export type MeetupsApi = typeof real
