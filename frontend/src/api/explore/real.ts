/**
 * 05 탐색 · 방문 (+ 00 학기) — 실제 서버 호출. 명세: docs/backend/team-spec/api/05-explore-visit.md, 00-common.md "GET /api/v1/terms"
 * 학기 · 들판 · 이사 · 단골 · 오늘의 추천 · 남의 땅굴 · 방명록 쓰기 · 대화 요청 보내기
 *
 * ENDPOINTS: 명세대로 구현한 API ("메서드 주소", id 자리는 명세 이름). src/tests/api-v1-endpoints.test.ts 가 명세 제목과 비교
 * 방문자 뷰의 방명록 목록 · 지우기는 명세상 04 내 땅굴 API 라 api/burrow 의 것을 쓴다 (useGuestbookEntries · useDeleteGuestbookEntry)
 */
import { http, seg } from '../client'
import type { Id } from '../common/types'
import { RULES } from '../../lib/validation'
import type {
  ChatRequestCreateRequest, ChatRequestCreatedDto, DailyRecommendationDto, DailyRecommendationRequest, FieldDto, FieldStatusesDto,
  GuestbookEntryDto, MoveBurrowDto, MoveBurrowRequest, RegularBurrowsDto, RegularStateDto, TermsDto, UserBurrowDto,
} from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/terms',
  'GET /api/v1/terms/{termId}/fields',
  'GET /api/v1/terms/{termId}/fields/{campusFloorId}',
  'POST /api/v1/me/burrow/move',
  'GET /api/v1/me/regular-burrows',
  'PUT /api/v1/burrows/{burrowId}/regular',
  'DELETE /api/v1/burrows/{burrowId}/regular',
  'GET /api/v1/me/daily-recommendation',
  'POST /api/v1/me/daily-recommendation',
  'GET /api/v1/users/{userId}/burrow',
  'POST /api/v1/burrows/{burrowId}/guestbook-entries',
  'POST /api/v1/chat-requests',
]

/** 방명록 글자 수 (lib/validation, 명세 1 ~ 50자) */
export const GUESTBOOK_MAX = RULES.guestbook.max

export const real = {
  /* ----- 00 학기 ----- */
  /** GET /terms — 열린 학기 (최근 것부터, 첫 번째가 이번 학기). 새 학기를 고르기 전에도 */
  terms: (signal?: AbortSignal) => http.get<TermsDto>('/terms', undefined, signal),

  /* ----- 들판 ----- */
  /** GET /terms/{termId}/fields — 그 학기 들판마다 비어 있는지 (캠퍼스-층 고르기의 "비어 있음"). 404 TERM_NOT_FOUND */
  fieldStatuses: (termId: Id, signal?: AbortSignal) => http.get<FieldStatusesDto>(`/terms/${seg(termId)}/fields`, undefined, signal),
  /** GET /terms/{termId}/fields/{campusFloorId} — 들판 하나의 땅굴 입구 전부 (안내판 · 주인 카드 값 포함). 404 TERM_NOT_FOUND · CAMPUS_FLOOR_NOT_FOUND */
  field: (termId: Id, campusFloorId: Id, signal?: AbortSignal) =>
    http.get<FieldDto>(`/terms/${seg(termId)}/fields/${seg(campusFloorId)}`, undefined, signal),
  /** POST /me/burrow/move — 새 학기 안내 "이 층으로 정하기". 두 번 불러도 한 번만 옮김. 404 CAMPUS_FLOOR_NOT_FOUND */
  moveBurrow: (req: MoveBurrowRequest) => http.post<MoveBurrowDto>('/me/burrow/move', req),

  /* ----- 단골 ----- */
  /** GET /me/regular-burrows — 내 단골 (최근에 담은 것부터, 한 번에 모두) */
  regularBurrows: (signal?: AbortSignal) => http.get<RegularBurrowsDto>('/me/regular-burrows', undefined, signal),
  /** PUT /burrows/{burrowId}/regular — 단골로 담기 (멱등). 403 OWN_BURROW_NOT_ALLOWED · 404 BURROW_NOT_FOUND */
  addRegular: (burrowId: Id) => http.put<RegularStateDto>(`/burrows/${seg(burrowId)}/regular`),
  /** DELETE /burrows/{burrowId}/regular — 단골에서 빼기 (멱등). 404 BURROW_NOT_FOUND */
  removeRegular: (burrowId: Id) => http.delete<RegularStateDto>(`/burrows/${seg(burrowId)}/regular`),

  /* ----- 오늘의 추천 ----- */
  /** GET /me/daily-recommendation — 오늘 받았는지와 받은 결과 (탐색에 들어올 때, 빨간 점) */
  dailyRecommendation: (signal?: AbortSignal) => http.get<DailyRecommendationDto>('/me/daily-recommendation', undefined, signal),
  /** POST /me/daily-recommendation — 추천 받기 (하루 한 번, 이미 받았으면 그 결과 200). 400 INVALID_INPUT · 404 CAMPUS_FLOOR_NOT_FOUND */
  drawRecommendation: (req: DailyRecommendationRequest) => http.post<DailyRecommendationDto>('/me/daily-recommendation', req),

  /* ----- 남의 땅굴 ----- */
  /** GET /users/{userId}/burrow — 방문자 뷰 · 방노트. 404 BURROW_NOT_FOUND */
  userBurrow: (userId: Id, signal?: AbortSignal) => http.get<UserBurrowDto>(`/users/${seg(userId)}/burrow`, undefined, signal),
  /** POST /burrows/{burrowId}/guestbook-entries — 방명록 쓰기 (201). 400 INVALID_INPUT · 403 OWN_BURROW_NOT_ALLOWED · 404 BURROW_NOT_FOUND */
  writeGuestbook: (burrowId: Id, content: string) => http.post<GuestbookEntryDto>(`/burrows/${seg(burrowId)}/guestbook-entries`, { content }),
  /** POST /chat-requests — 대화 요청 보내기 (201). 404 USER_NOT_FOUND · 409 CHAT_ROOM_ALREADY_EXISTS · CHAT_REQUEST_ALREADY_SENT · CHAT_REQUEST_ALREADY_RECEIVED */
  sendChatRequest: (req: ChatRequestCreateRequest) => http.post<ChatRequestCreatedDto>('/chat-requests', req),

}
export type ExploreApi = typeof real
