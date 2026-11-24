/**
 * 05 탐색 · 방문 (+ 00 학기) DTO. 명세: docs/backend/team-spec/api/05-explore-visit.md, api/00-common.md "GET /api/v1/terms"
 * 명세 그대로: id 는 숫자(Id), 시각은 UTC(UtcInstant), 날짜만은 DateString, enum 은 대문자, 값이 없으면 null.
 * 사람은 UserDisplayDto, 관심사는 InterestTagDto (공통). 목록은 ItemsDto
 */
import type { DateString, Id, InterestTagDto, ItemsDto, UserDisplayDto, UtcInstant } from '../common/types'

/* ===== 학기 (00 공통) ===== */
/** GET /terms 의 항목 · 들판의 term. half: 1 상반기, 2 하반기 */
export interface TermDto {
  id: Id
  year: number
  half: 1 | 2
  /** 이번 학기인지 (열린 학기 가운데 가장 최근). 하나만 true */
  isCurrent: boolean
}
/** GET /terms (최근에 열린 학기부터 → 첫 번째가 이번 학기) */
export type TermsDto = ItemsDto<TermDto>

/* ===== 들판 ===== */
/** GET /terms/{termId}/fields 의 항목 (캠퍼스 목록 순서) */
export interface FieldStatusDto {
  campusFloorId: Id
  /** 땅굴이 하나도 없는지 (내 땅굴도 셈) */
  isEmpty: boolean
}
export type FieldStatusesDto = ItemsDto<FieldStatusDto>

/** 질문과 답변 (들판 입구 · 추천 카드 · 남의 땅굴이 같은 모양). 항상 3개, slot 작은 것부터 */
export interface AnswerDto {
  /** 1 ~ 3 */
  slot: number
  introQuestionId: Id
  question: string
  /** 10 ~ 50자 */
  answer: string
}

/** 들판 하나에 놓인 땅굴 입구 */
export interface FieldEntranceDto {
  slot: number
  burrowId: Id
  isMine: boolean
  owner: UserDisplayDto
  /** 고른 순서. 나와 겹치는 것은 isShared */
  interests: InterestTagDto[]
  answers: AnswerDto[]
  /** 주인의 자기소개. 쓰지 않았으면 null (명세 05 dev 2862f69 KAN-46: 방노트에 보여 줌) */
  intro: string | null
}
/** GET /terms/{termId}/fields/{campusFloorId} */
export interface FieldDto {
  term: TermDto
  campusFloorId: Id
  campusName: string
  floor: number
  /** slot 작은 것부터. 없으면 [] */
  items: FieldEntranceDto[]
}

/** 땅굴 입구 위치 (이사 응답 · 남의 땅굴 · 내 땅굴의 entrance) */
export interface EntranceDto {
  termId: Id
  campusFloorId: Id
  slot: number
}

/* ===== 이사 (새 학기 안내) ===== */
/** POST /me/burrow/move 요청 */
export interface MoveBurrowRequest { campusFloorId: Id }
/** POST /me/burrow/move 응답 (200, 이미 이사했으면 지금 값) */
export interface MoveBurrowDto {
  userId: Id
  /** 항상 HOME */
  nextStep: 'HOME'
  entrance: EntranceDto
}

/* ===== 단골 ===== */
/** GET /me/regular-burrows 의 항목 (최근에 담은 것부터) */
export interface RegularBurrowDto {
  burrowId: Id
  owner: UserDisplayDto
  createdAt: UtcInstant
}
export type RegularBurrowsDto = ItemsDto<RegularBurrowDto>
/** PUT · DELETE /burrows/{burrowId}/regular 응답 */
export interface RegularStateDto { isRegular: boolean }

/* ===== 오늘의 추천 ===== */
/** 추천된 사람 하나 */
export interface RecommendedFriendDto {
  burrowId: Id
  owner: UserDisplayDto
  /** 서버가 고른 3개 (나와 겹치는 것 먼저). 받은 순서대로 보여 줌 */
  interests: InterestTagDto[]
  /** 카드 뒷면 */
  answers: AnswerDto[]
}
/** GET · POST /me/daily-recommendation 응답 */
export interface DailyRecommendationDto {
  /** 오늘 추천을 받았는지 (0명을 받은 날도 true) */
  hasReceived: boolean
  /** 서버가 오늘로 보는 추천 기준 날짜 */
  recommendedOn: DateString
  /** 0 ~ 3명 */
  items: RecommendedFriendDto[]
}
/** POST /me/daily-recommendation 요청 (고른 값은 서버가 저장하지 않음) */
export interface DailyRecommendationRequest {
  campusFloorId: Id
  generation: number
}

/* ===== 남의 땅굴 ===== */
/** 대화 버튼의 상태 (위에서부터 차례로 봄) */
export type ChatStatus = 'CHATTING' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE'
/** GET /users/{userId}/burrow — 방문자 뷰 · 방노트 */
export interface UserBurrowDto {
  burrowId: Id
  /** true 면 프론트가 내 땅굴 화면으로 보냄 */
  isMine: boolean
  owner: UserDisplayDto
  /** 자기소개. 안 썼으면 null */
  intro: string | null
  /** 고른 순서, 첫 번째가 대표 관심사 */
  interests: InterestTagDto[]
  answers: AnswerDto[]
  /** 방명록 글 수 (우체통 깃발) */
  guestbookCount: number
  isRegular: boolean
  chat: {
    status: ChatStatus
    /** CHATTING 일 때만 */
    chatRoomId: Id | null
  }
  /** 이 땅굴이 놓인 들판의 입구 ("탐색"을 누르면 이 들판으로) */
  entrance: EntranceDto
}

/* ===== 방명록 ===== */
/** POST /burrows/{burrowId}/guestbook-entries 요청. 1 ~ 50자, 공백만은 안 됨 */
export interface GuestbookEntryCreateRequest { content: string }
/** 방명록 글 (쓰기 응답 = 04 목록의 항목과 같은 모양) */
export interface GuestbookEntryDto {
  id: Id
  author: UserDisplayDto
  content: string
  createdAt: UtcInstant
  canDelete: boolean
  canReport: boolean
}

/* ===== 대화 요청 보내기 ===== */
/** POST /chat-requests 요청. message 는 50자 이하, 비우거나 null 이면 인사 없이 */
export interface ChatRequestCreateRequest {
  receiverId: Id
  message: string | null
}
/**
 * POST /chat-requests 응답 (201).
 * 요청을 새로 만들었으면 chatRoomId 가 null, 내가 거절했던 요청이 남아 있어 바로 대화방이 열렸으면 나머지가 null
 */
export interface ChatRequestCreatedDto {
  chatRequestId: Id | null
  createdAt: UtcInstant | null
  expiresAt: UtcInstant | null
  chatRoomId: Id | null
}
