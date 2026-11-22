/**
 * 05 탐색 · 방문 (+ 00 학기) — 실제 서버 호출. 명세: docs/backend/team-spec/api/05-explore-visit.md
 * 남의 땅굴 · 방명록 쓰기 · 단골 · 들판 · 오늘의 추천 · 대화 요청 보내기(POST /chat-requests, 05 문서)
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다. 땅굴 주소는 회원 id 로 연다 (/burrow/:userId)
 */
import { http } from '../client'
import type { LegacyId as Id, MemberProfileDto } from '../common/legacy'
import type { CursorPageDto } from '../common/types'
import type { ReportReason } from '../community/types'
import { RULES } from '../../lib/validation'
import type { BurrowDto, CampusFloorDto, DailyRecommendationDto, FieldDto, GuestbookEntryDto, RecommendRequestDto } from './types'

export const ENDPOINTS: readonly string[] = []

/** 방명록 글자 수 (lib/validation) */
export const GUESTBOOK_MAX = RULES.guestbook.max

export const real = {
  /** GET /burrows/{memberId} — 땅굴 방문 (주인·관계). 탈퇴·없는 사람 404 BURROW_NOT_FOUND */
  get: (memberId: Id, signal?: AbortSignal) => http.get<BurrowDto>(`/burrows/${memberId}`, undefined, signal),
  /** GET /burrows/{memberId}/guestbook — 신고로 가려진 글만 빼고 전부, 최신순 (커서) */
  guestbook: (memberId: Id, cursor?: string | null, size = 20, signal?: AbortSignal) =>
    http.get<CursorPageDto<GuestbookEntryDto>>(`/burrows/${memberId}/guestbook`, { cursor, size }, signal),
  /** POST /burrows/{memberId}/guestbook */
  writeGuestbook: (memberId: Id, content: string) => http.post<GuestbookEntryDto>(`/burrows/${memberId}/guestbook`, { content }),
  /** DELETE /guestbook/{entryId} — 땅굴 주인·글쓴이 */
  deleteGuestbook: (entryId: Id) => http.delete<void>(`/guestbook/${entryId}`),
  /** POST /reports (targetType GUESTBOOK) — 409 ALREADY_REPORTED */
  reportGuestbook: (entryId: Id, reason: ReportReason, detail: string | null) => http.post<void>('/reports', { targetType: 'GUESTBOOK', targetId: entryId, reason, detail }),
  /** PUT·DELETE /burrows/{memberId}/regular — 단골 */
  setRegular: (memberId: Id, on: boolean) => (on ? http.put<void>(`/burrows/${memberId}/regular`) : http.delete<void>(`/burrows/${memberId}/regular`)),
  /** GET /me/regulars — 단골 땅굴 목록 */
  regulars: (signal?: AbortSignal) => http.get<MemberProfileDto[]>('/me/regulars', undefined, signal),
  /** GET /campus-floors — 캠퍼스-층 목록 (명세는 GET /campuses, api/common) */
  campusFloors: (signal?: AbortSignal) => http.get<CampusFloorDto[]>('/campus-floors', undefined, signal),
  /** GET /fields/{campusFloorId}?termId= — 들판 한 장 (자리 150개) */
  field: (campusFloorId: Id, termId?: Id, signal?: AbortSignal) => http.get<FieldDto>(`/fields/${campusFloorId}`, { termId }, signal),
  /** GET /me/recommendations/today — 아직 안 받았으면 404 */
  todayRecommendation: (signal?: AbortSignal) => http.get<DailyRecommendationDto>('/me/recommendations/today', undefined, signal),
  /** POST /me/recommendations/today — 하루 한 번 */
  drawRecommendation: (req: RecommendRequestDto) => http.post<DailyRecommendationDto>('/me/recommendations/today', req),
}
export type ExploreApi = typeof real
