/**
 * 04 내 땅굴 DTO — 명세 그대로. 명세: docs/backend/team-spec/api/04-my-burrow.md
 * 공통 모양(Id · UtcInstant · UserDisplayDto · InterestTagDto · MoleDto · PageDto)은 '../common'
 * (남의 땅굴 방문 · 방명록 쓰기는 05 탐색 · 방문 = api/explore. 방명록 목록 · 삭제 API 는 주인 · 방문자가 같이 쓰며 이 영역에 있음)
 */
import type { Id, InterestTagDto, MoleDto, UserDisplayDto, UtcInstant } from '../common/types'

/* ===== GET /me/burrow (PATCH /me/profile 의 응답도 같은 모양) ===== */
export interface MyBurrowAnswerDto {
  /** 보이는 자리 1 ~ 3 */
  slot: number
  introQuestionId: Id
  /** 질문 문구 */
  question: string
  /** 10 ~ 50자 */
  answer: string
}
/** 이번 학기 들판에 놓인 내 땅굴 입구 ("탐색"을 누르면 이 들판으로). null 이 오지 않음 */
export interface MyBurrowEntranceDto {
  termId: Id
  campusFloorId: Id
  slot: number
}
export interface MyBurrowDto {
  /** 방명록 목록을 부를 때 쓰는 땅굴 id */
  burrowId: Id
  /** 땅굴 주인인 나의 사용자 표시 (닉네임 · 두더지 · 캠퍼스 · 기수 · 층) */
  owner: UserDisplayDto
  /** 프로필의 캠퍼스-층 (내 정보 수정에서 지금 값을 고른 채로 열 때) */
  campusFloorId: Id
  /** 자기소개. 안 썼으면 null */
  intro: string | null
  /** 내 관심사 태그 (고른 순서, 첫 번째가 대표 관심사. isShared 는 모두 false) */
  interests: InterestTagDto[]
  /** 자기소개 질문과 답변 3개 (자리 순서) */
  answers: MyBurrowAnswerDto[]
  /** 내 땅굴을 단골로 담은 사람 수 (누구인지는 주지 않음) */
  regularCount: number
  /** 방명록 글 수 (가려진 글 뺌). 1 이상이면 우체통 깃발을 올림 */
  guestbookCount: number
  entrance: MyBurrowEntranceDto
}

/* ===== PATCH /me/mole ===== */
/** 요청 · 응답 모두 네 부위 (없음은 null). 코드는 영어 대문자 · 숫자 · 밑줄 30자 이하 */
export type MoleUpdateRequest = MoleDto

/* ===== PATCH /me/profile ===== */
/** 다섯 값을 모두 보낸다 (바꾸지 않은 값도 지금 값으로). 하나라도 빠지면 400 INVALID_INPUT */
export interface ProfileUpdateRequest {
  /** 1 ~ 12자 */
  nickname: string
  /** GET /campuses 의 floors[].id */
  campusFloorId: Id
  /** 3 ~ 10개, 겹치지 않게. 보낸 순서로 저장, 첫 번째가 대표 관심사 */
  interestIds: Id[]
  /** 정확히 3개, 보낸 순서가 자리 순서 */
  answers: { introQuestionId: Id; answer: string }[]
  /** 150자 이하. 안 썼으면 null (null · 빈 문자열이면 비움) */
  intro: string | null
}

/* ===== GET /burrows/{burrowId}/guestbook-entries ===== */
export interface GuestbookEntryDto {
  id: Id
  /** 쓴 사람 (탈퇴했으면 isWithdrawn true) */
  author: UserDisplayDto
  /** 50자 이하 */
  content: string
  createdAt: UtcInstant
  /** 요청한 사람이 지울 수 있는지 (주인이거나 쓴 사람) */
  canDelete: boolean
  /** 요청한 사람이 신고할 수 있는지 (쓴 사람이 아님) */
  canReport: boolean
}
export interface GuestbookQuery {
  /** 1부터. 안 보내면 1 */
  page?: number
  /** 안 보내면 5 */
  size?: number
}
