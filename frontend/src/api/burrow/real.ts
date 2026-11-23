/**
 * 04 내 땅굴 — 실제 서버 호출. 명세: docs/backend/team-spec/api/04-my-burrow.md
 * (남의 땅굴 방문 · 방명록 쓰기는 05 탐색 · 방문 = api/explore. 방명록 목록 · 삭제는 주인 · 방문자가 같이 쓰며 여기)
 *
 * ENDPOINTS: 명세대로 구현한 API (명세 제목 그대로). src/tests/api-v1-endpoints.test.ts 가 명세와 비교한다
 * 이 영역 API 는 모두 온보딩을 마친 계정만 (아니면 403 ONBOARDING_INCOMPLETE · NEW_TERM_INCOMPLETE, 공통 문구)
 */
import { http, seg } from '../client'
import type { Id, MoleDto, PageDto } from '../common/types'
import type { GuestbookEntryDto, GuestbookQuery, MoleUpdateRequest, MyBurrowDto, ProfileUpdateRequest } from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/me/burrow',
  'PATCH /api/v1/me/mole',
  'PATCH /api/v1/me/profile',
  'GET /api/v1/burrows/{burrowId}/guestbook-entries',
  'DELETE /api/v1/guestbook-entries/{guestbookEntryId}',
]

/** 방명록 한 페이지 글 수 (명세 기본값 5, 방명록 전체 보기 4) */
export const GUESTBOOK_PAGE_SIZE = 5

export const real = {
  /** GET /me/burrow — 내 땅굴 · 내 정보 카드 · 단골 수 · 방명록 글 수 · 입구 */
  myBurrow: (signal?: AbortSignal) => http.get<MyBurrowDto>('/me/burrow', undefined, signal),
  /** PATCH /me/mole — 네 부위 모두. 응답은 저장한 두더지 */
  updateMole: (body: MoleUpdateRequest) => http.patch<MoleDto>('/me/mole', body),
  /** PATCH /me/profile — 다섯 값 모두. 응답은 바뀐 내 땅굴 전체 (다시 조회하지 않음) */
  updateProfile: (body: ProfileUpdateRequest) => http.patch<MyBurrowDto>('/me/profile', body),
  /** GET /burrows/{burrowId}/guestbook-entries — 최신순 페이지 (가려진 글 뺌). 없는 땅굴 404 BURROW_NOT_FOUND */
  guestbookEntries: (burrowId: Id, q: GuestbookQuery = {}, signal?: AbortSignal) =>
    http.get<PageDto<GuestbookEntryDto>>(`/burrows/${seg(burrowId)}/guestbook-entries`, { page: q.page, size: q.size }, signal),
  /** DELETE /guestbook-entries/{guestbookEntryId} — 주인은 모든 글, 방문자는 자기 글. data null */
  deleteGuestbookEntry: (guestbookEntryId: Id) => http.delete<null>(`/guestbook-entries/${seg(guestbookEntryId)}`),
}
export type BurrowApi = typeof real
