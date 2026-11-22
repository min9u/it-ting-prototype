/**
 * 03 온보딩 (+ 00 공통의 관심사 · 자기소개 질문 · 프로필 팝업) — 실제 서버 호출.
 * 명세: docs/backend/team-spec/api/03-onboarding.md, 00-common.md (GET /interest-categories · /intro-questions · /users/{userId}/profile)
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다 (화면에서 아직 안 씀. 온보딩 화면은 data/* 를 바로 씀)
 */
import { http } from '../client'
import type { LegacyId as Id, MemberProfileDto } from '../common/legacy'
import type { InterestCategoryDto, IntroQuestionDto } from './types'

export const ENDPOINTS: readonly string[] = []

export const real = {
  /** 프로필 팝업 (초안 GET /members/{id} → 명세 GET /users/{userId}/profile) */
  profile: (id: Id, signal?: AbortSignal) => http.get<MemberProfileDto>(`/members/${id}`, undefined, signal),
  /** 닉네임 확인 (초안 → 명세 POST /nicknames/check) */
  nicknameAvailable: (nickname: string, signal?: AbortSignal) => http.get<{ available: boolean }>(`/nicknames/${encodeURIComponent(nickname)}/availability`, undefined, signal),
  /** 관심사 저장 (초안 PUT /me/interests → 명세는 온보딩 확정 POST /me/onboarding/complete · 내 정보 수정 PATCH /me/profile) */
  updateInterests: (items: { interestId: Id; furniture: string | null }[]) => http.put<void>('/me/interests', { items }),
  /** GET /interest-categories — 대분류 12 + 세부 90 */
  interestCategories: (signal?: AbortSignal) => http.get<InterestCategoryDto[]>('/interest-categories', undefined, signal),
  /** GET /intro-questions */
  introQuestions: (signal?: AbortSignal) => http.get<IntroQuestionDto[]>('/intro-questions', undefined, signal),
}
export type OnboardingApi = typeof real
