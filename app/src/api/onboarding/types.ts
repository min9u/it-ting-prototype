/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) DTO. 명세: docs/backend/team-spec/api/03-onboarding.md, 00-common.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 온보딩 · 내 땅굴 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'

/* ===== 관심사 ===== */
export interface InterestDto {
  id: LegacyId
  categoryId: LegacyId
  name: string
  /** 같은 관심사를 고른 사람 수 (니치 표시, 온보딩 "통하는 취향") */
  memberCount: number
}
export interface InterestCategoryDto {
  id: LegacyId
  name: string
  interests: InterestDto[]
}
export interface IntroQuestionDto {
  id: LegacyId
  /** intro_question.type: 공통 · 관심사별 등 */
  type: string
  interestCategoryId: LegacyId | null
  content: string
}
