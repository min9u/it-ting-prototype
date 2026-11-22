/**
 * 03 온보딩 (+ 00 공통의 관심사 · 자기소개 질문 · 프로필 팝업) — 실제 서버 호출.
 * 명세: docs/backend/team-spec/api/03-onboarding.md, 00-common.md
 *
 * ENDPOINTS: 명세대로 구현한 API (명세 제목 그대로). src/tests/api-v1-endpoints.test.ts 가 명세와 비교한다
 */
import { http, seg } from '../client'
import type { Id, ItemsDto } from '../common/types'
import type {
  InterestCategoryDto, IntroQuestionDto, IntroQuestionType, NicknameCheckDto, OnboardingCompleteDto, OnboardingCompleteRequest, UserProfileDto,
} from './types'

export const ENDPOINTS: readonly string[] = [
  'GET /api/v1/interest-categories',
  'GET /api/v1/intro-questions',
  'GET /api/v1/users/{userId}/profile',
  'POST /api/v1/nicknames/check',
  'POST /api/v1/me/onboarding/complete',
]

export const real = {
  /** GET /interest-categories — 대분류 12 + 세부 90, 고른 사람 수 포함 (한 번에 모두) */
  interestCategories: (signal?: AbortSignal) => http.get<ItemsDto<InterestCategoryDto>>('/interest-categories', undefined, signal),
  /** GET /intro-questions — type 을 안 보내면 두 종류 모두 */
  introQuestions: (type?: IntroQuestionType, signal?: AbortSignal) => http.get<ItemsDto<IntroQuestionDto>>('/intro-questions', type ? { type } : undefined, signal),
  /** GET /users/{userId}/profile — 프로필 팝업. 탈퇴 · 가입 중 · 없는 사람은 404 USER_NOT_FOUND */
  userProfile: (userId: Id, signal?: AbortSignal) => http.get<UserProfileDto>(`/users/${seg(userId)}/profile`, undefined, signal),
  /** POST /nicknames/check — 쓸 수 있으면 5분 동안 맡아 둠. 겹치면 409 NICKNAME_DUPLICATED */
  checkNickname: (nickname: string) => http.post<NicknameCheckDto>('/nicknames/check', { nickname }),
  /** POST /me/onboarding/complete — 온보딩 값을 한 번에 저장하고 땅굴을 만듦 (이미 마쳤으면 같은 답) */
  completeOnboarding: (body: OnboardingCompleteRequest) => http.post<OnboardingCompleteDto>('/me/onboarding/complete', body),
}
export type OnboardingApi = typeof real
