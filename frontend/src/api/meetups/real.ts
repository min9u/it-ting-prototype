/**
 * 07 모임 — 실제 서버 호출. 명세: docs/backend/team-spec/api/07-meetup.md (20개 모두)
 * 경로는 /api/v1 뒤만 쓴다. id 는 DTO 숫자(Id). 앱 문자열 id 는 queries · 화면이 toDtoId 로 바꿔 넘긴다
 */
import { http, seg } from '../client'
import type { Id } from '../common/types'
import type {
  MeetupApplicationsDto, MeetupApplyRequest, MeetupApplyResponse, MeetupCalendarDto, MeetupCalendarQuery, MeetupCreateRequest,
  MeetupCreateResponse, MeetupDetailDto, MeetupLikeDto, MeetupPageDto, MeetupSearchQuery, MeetupUpdateRequest, MeetupVacancyAlertDto,
  MyMeetupSummaryDto, MyMeetupTab, MyMeetupsDto,
} from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/meetups',
  'POST /api/v1/meetups',
  'GET /api/v1/meetups/{meetupId}',
  'PATCH /api/v1/meetups/{meetupId}',
  'POST /api/v1/meetups/{meetupId}/cancel',
  'DELETE /api/v1/meetups/{meetupId}',
  'PUT /api/v1/meetups/{meetupId}/like',
  'DELETE /api/v1/meetups/{meetupId}/like',
  'PUT /api/v1/meetups/{meetupId}/vacancy-alert',
  'DELETE /api/v1/meetups/{meetupId}/vacancy-alert',
  'POST /api/v1/meetups/{meetupId}/applications',
  'GET /api/v1/meetups/{meetupId}/applications',
  'POST /api/v1/meetups/{meetupId}/withdraw-application',
  'POST /api/v1/meetups/{meetupId}/cancel-participation',
  'POST /api/v1/meetup-applications/{meetupApplicationId}/accept',
  'POST /api/v1/meetup-applications/{meetupApplicationId}/reject',
  'POST /api/v1/meetup-applications/{meetupApplicationId}/kick',
  'GET /api/v1/me/meetups',
  'GET /api/v1/me/meetups/summary',
  'GET /api/v1/meetup-calendar',
]

/** 목록 쿼리 → 주소 쿼리 (categories 는 쉼표로 이음 — 명세) */
export function searchParams(q: MeetupSearchQuery) {
  return {
    keyword: q.keyword?.trim() || undefined,
    categories: q.categories?.length ? q.categories.join(',') : undefined,
    dateFrom: q.dateFrom, dateTo: q.dateTo, mode: q.mode, sort: q.sort, page: q.page, size: q.size,
  }
}

export const real = {
  /** GET /meetups — 검색 · 필터 · 정렬 · 페이지 */
  list: (q: MeetupSearchQuery, signal?: AbortSignal) => http.get<MeetupPageDto>('/meetups', searchParams(q), signal),
  /** POST /meetups — 만들기 (201, 모임 대화방도 함께) */
  create: (req: MeetupCreateRequest) => http.post<MeetupCreateResponse>('/meetups', req),
  /** GET /meetups/{meetupId} — 상세 + 내 상태 */
  get: (id: Id, signal?: AbortSignal) => http.get<MeetupDetailDto>(`/meetups/${seg(id)}`, undefined, signal),
  /** PATCH /meetups/{meetupId} — 수정 (값을 모두 보냄. 409 MEETUP_EDIT_NOT_ALLOWED) */
  update: (id: Id, req: MeetupUpdateRequest) => http.patch<null>(`/meetups/${seg(id)}`, req),
  /** POST /meetups/{meetupId}/cancel — 취소 (확정자 1명 이상. 409 MEETUP_CANCEL_NOT_ALLOWED) */
  cancel: (id: Id) => http.post<null>(`/meetups/${seg(id)}/cancel`),
  /** DELETE /meetups/{meetupId} — 삭제 (확정자 0명. 409 MEETUP_DELETE_NOT_ALLOWED) */
  remove: (id: Id) => http.delete<null>(`/meetups/${seg(id)}`),
  /** PUT /meetups/{meetupId}/like — 찜 */
  like: (id: Id) => http.put<MeetupLikeDto>(`/meetups/${seg(id)}/like`),
  /** DELETE /meetups/{meetupId}/like — 찜 풀기 (빈자리 알림도 함께 꺼짐) */
  unlike: (id: Id) => http.delete<MeetupLikeDto>(`/meetups/${seg(id)}/like`),
  /** PUT /meetups/{meetupId}/vacancy-alert — 빈자리 알림 켜기 (찜한 모임만. 409 MEETUP_NOT_LIKED) */
  enableVacancyAlert: (id: Id) => http.put<MeetupVacancyAlertDto>(`/meetups/${seg(id)}/vacancy-alert`),
  /** DELETE /meetups/{meetupId}/vacancy-alert — 빈자리 알림 끄기 */
  disableVacancyAlert: (id: Id) => http.delete<MeetupVacancyAlertDto>(`/meetups/${seg(id)}/vacancy-alert`),
  /** POST /meetups/{meetupId}/applications — 참여 신청 (201) */
  apply: (id: Id, req: MeetupApplyRequest) => http.post<MeetupApplyResponse>(`/meetups/${seg(id)}/applications`, req),
  /** GET /meetups/{meetupId}/applications — 신청 관리 (주최자만) */
  applications: (id: Id, signal?: AbortSignal) => http.get<MeetupApplicationsDto>(`/meetups/${seg(id)}/applications`, undefined, signal),
  /** POST /meetups/{meetupId}/withdraw-application — 내 신청 취소 (확정 전) */
  withdrawApplication: (id: Id) => http.post<null>(`/meetups/${seg(id)}/withdraw-application`),
  /** POST /meetups/{meetupId}/cancel-participation — 내 참여 취소 (확정 후, 시작 24시간 전까지). 채팅 "모임 나가기"도 이것 */
  cancelParticipation: (id: Id) => http.post<null>(`/meetups/${seg(id)}/cancel-participation`),
  /** POST /meetup-applications/{meetupApplicationId}/accept — 수락 (409 MEETUP_FULL) */
  accept: (applicationId: Id) => http.post<null>(`/meetup-applications/${seg(applicationId)}/accept`),
  /** POST /meetup-applications/{meetupApplicationId}/reject — 거절 */
  reject: (applicationId: Id) => http.post<null>(`/meetup-applications/${seg(applicationId)}/reject`),
  /** POST /meetup-applications/{meetupApplicationId}/kick — 내보내기 (409 MEETUP_KICK_NOT_ALLOWED) */
  kick: (applicationId: Id) => http.post<null>(`/meetup-applications/${seg(applicationId)}/kick`),
  /** GET /me/meetups?tab= — 내 모임 탭 하나 (나누지 않음) */
  mine: (tab: MyMeetupTab, signal?: AbortSignal) => http.get<MyMeetupsDto>('/me/meetups', { tab }, signal),
  /** GET /me/meetups/summary — 탭별 개수 + 가까운 내 모임 5개 */
  summary: (signal?: AbortSignal) => http.get<MyMeetupSummaryDto>('/me/meetups/summary', undefined, signal),
  /** GET /meetup-calendar?year&month&scope — 한 달의 모임 */
  calendar: (q: MeetupCalendarQuery, signal?: AbortSignal) => http.get<MeetupCalendarDto>('/meetup-calendar', { year: q.year, month: q.month, scope: q.scope }, signal),
}
export type MeetupsApi = typeof real
