/**
 * 옛 초안(docs/backend/api-draft.md, 2026-11-16) 의 사람 모양. **새 코드에서 쓰지 말 것.**
 *
 * 영역 작업자가 자기 영역 DTO 를 명세 모양(./types.ts 의 UserDisplayDto · InterestTagDto)으로 옮기는 동안
 * 아직 옮기지 않은 영역이 깨지지 않게 남겨 둔다. 모든 영역이 옮기면 이 파일과 mockPeople.ts 의 memberSummary · memberProfile,
 * mappers.ts 의 toPerson 을 지운다 (합칠 때 공통 담당이).
 * id 가 문자열인 것도 초안 그대로다 (LegacyId).
 */

/** 초안의 id (문자열) */
export type LegacyId = string

/** member.status (초안) */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN'

/** 두더지 꾸미기 (초안. 명세의 MoleDto 와 같은 모양) */
export interface MoleLookDto {
  head: string | null
  face: string | null
  neck: string | null
  hand: string | null
}

/** 글쓴이·참여자·채팅 상대처럼 짧게 보여 주는 사람 (탈퇴하면 nickname null, status WITHDRAWN) */
export interface MemberSummaryDto {
  id: LegacyId
  nickname: string | null
  status: MemberStatus
  generation: number | null
  campus: string | null
  floor: number | null
  mole: MoleLookDto
}

export interface MemberInterestDto {
  interestId: LegacyId
  name: string
  categoryId: LegacyId
  /** 0 = 대표 관심사 */
  sortOrder: number
  furniture: string | null
}

export interface AnswerDto {
  slot: number
  questionId: LegacyId
  question: string
  answer: string
}

/** 프로필 팝업·땅굴 방문·요청 카드 옆 패널 (초안) */
export interface MemberProfileDto extends MemberSummaryDto {
  intro: string | null
  interests: MemberInterestDto[]
  answers: AnswerDto[]
  online: boolean
}
