/**
 * 00 공통 — 실제 서버 호출. 명세: docs/backend/team-spec/api/00-common.md
 * 백엔드 구현됨(2026-11-22): GET /campuses · GET /generations → NEXT_PUBLIC_API_REAL_AREAS=common 으로 실제 서버에 붙여 볼 수 있다.
 *
 * ENDPOINTS: 이 영역이 명세대로 구현한 API ("메서드 주소", 주소의 id 자리는 명세 그대로 {이름}).
 * src/tests/api-v1-endpoints.test.ts 가 명세 제목과 비교한다.
 * - 'GET /api/v1/me/event-stream' 은 06 채팅 문서에 있지만 연결 자체는 공통(realtime/eventStream.ts)이 맡아서 여기 적는다
 * - 00 의 나머지(학기 · 관심사 · 질문 · 프로필 팝업)는 다른 영역이 맡는다: api/explore/PENDING, api/onboarding/PENDING
 */
import { http } from '../client'
import type { CampusDto, GenerationDto, ItemsDto } from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/campuses',
  'GET /api/v1/generations',
  'GET /api/v1/me/event-stream',
]

export const real = {
  /** GET /campuses — 캠퍼스와 층 (로그인 불필요, 한 번에 모두) */
  campuses: (signal?: AbortSignal) => http.get<ItemsDto<CampusDto>>('/campuses', undefined, signal),
  /** GET /generations — 고를 수 있는 기수 (로그인 불필요, 큰 기수부터) */
  generations: (signal?: AbortSignal) => http.get<ItemsDto<GenerationDto>>('/generations', undefined, signal),
}
export type CommonApi = typeof real
