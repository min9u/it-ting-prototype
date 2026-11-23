/**
 * 03 온보딩 (+ 00 관심사 · 자기소개 질문 · 프로필 팝업) DTO — 명세 그대로.
 * 명세: docs/backend/team-spec/api/03-onboarding.md, 00-common.md
 * 공통 모양(Id · UtcInstant · UserDisplayDto · InterestTagDto · MoleDto · ItemsDto)은 '../common'
 */
import type { Id, InterestTagDto, MoleDto, UserDisplayDto, UtcInstant } from '../common/types'

/* ===== GET /interest-categories ===== */
/** 세부 관심사 하나 */
export interface InterestDto {
  /** 관심사를 저장하는 API 의 interestIds 에 보내는 값 */
  id: Id
  name: string
  /** 그 관심사를 고른 사람 수 (저장된 관심사만, 온보딩 2 칩에 함께 적음) */
  userCount: number
}
/** 대분류 하나 (data.items[]) */
export interface InterestCategoryDto {
  id: Id
  name: string
  interests: InterestDto[]
}

/* ===== GET /intro-questions ===== */
export type IntroQuestionType = 'INTEREST' | 'TMI'
export interface IntroQuestionDto {
  /** 답변을 저장하는 API 의 introQuestionId 에 보내는 값 */
  id: Id
  type: IntroQuestionType
  /** 관심사 질문이 딸린 대분류. TMI 질문은 null */
  interestCategoryId: Id | null
  content: string
}

/* ===== GET /users/{userId}/profile ===== */
export interface UserProfileDto {
  user: UserDisplayDto
  /** 고른 순서(3 ~ 10개), 첫 번째가 대표 관심사. isShared 는 요청한 사람 기준 */
  interests: InterestTagDto[]
}

/* ===== POST /nicknames/check ===== */
export interface NicknameCheckRequest { nickname: string }
/** 성공이면 쓸 수 있는 닉네임이고, expiresAt 까지 이 계정 몫으로 맡아 둠 */
export interface NicknameCheckDto { expiresAt: UtcInstant }

/* ===== POST /me/onboarding/complete ===== */
export interface AnswerRequest {
  introQuestionId: Id
  /** 10 ~ 50자 */
  answer: string
}
export interface OnboardingCompleteRequest {
  /** 1 ~ 12자 */
  nickname: string
  /** 네 부위 모두 ("없음"은 null) */
  mole: MoleDto
  /** 3 ~ 10개, 겹치지 않게, 고른 순서. 첫 번째가 대표 관심사 */
  interestIds: Id[]
  /** 정확히 3개. 보낸 순서가 자기소개에 보이는 순서 */
  answers: AnswerRequest[]
}
export interface OnboardingCompleteDto {
  userId: Id
  /** 항상 HOME */
  nextStep: 'HOME'
  burrowId: Id
}
