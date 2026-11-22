/**
 * 05 탐색 · 방문 (+ 00 학기) DTO. 명세: docs/backend/team-spec/api/05-explore-visit.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 탐색 · 방문 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'
import type { MemberProfileDto, MemberSummaryDto } from '../common/legacy'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string
/** 초안의 날짜 "YYYY-MM-DD". 명세는 DateString */
type IsoDate = string

/* ===== 땅굴 · 들판 ===== */
export interface CampusFloorDto { id: LegacyId; campusId: LegacyId; campus: string; floor: number }
export interface TermDto { id: LegacyId; year: number; half: 'FIRST' | 'SECOND'; openedAt: IsoDateTime }

/** 땅굴 입구 (burrow_entrance): 학기 하나에 들판(캠퍼스-층)의 자리 하나 */
export interface BurrowEntranceDto {
  termId: LegacyId
  /** term.year · term.half → "2026 하반기" */
  year: number
  half: 'FIRST' | 'SECOND'
  campusFloorId: LegacyId
  campus: string
  floor: number
  /** 1~150 */
  slot: number
}

/** GET /burrows/{memberId} — 땅굴 방문 (주인 프로필 + 나와의 관계) */
export interface BurrowDto {
  id: LegacyId
  owner: MemberProfileDto
  /** 이번 학기 입구. 없으면 null (탐색 버튼 숨김) */
  entrance: BurrowEntranceDto | null
  /** 내가 이 땅굴을 단골로 둠 (regular_burrow) */
  regular: boolean
  /** 이 땅굴을 단골로 둔 사람 수 */
  regularCount: number
  /** 지금 와 있는 방문자 수 (ERD 에 없음 → erd-gaps) */
  visitorsNow: number
  /** 나와 이 사람의 1:1 대화방 (있으면 "대화하기") */
  chatRoomId: LegacyId | null
  /** 내가 보낸, 아직 답이 없는 대화 요청 (있으면 말풍선이 "요청 보냄"으로 바뀌고 누를 수 없다) */
  pendingRequestId: LegacyId | null
  /** 방 꾸미기 저장 값 (ERD 에 없음 → erd-gaps "방 꾸미기 저장") */
  room: RoomLayoutDto | null
}

/** 방 꾸미기 저장 형식 제안 (위험 B10). schemaVersion 으로 바뀌는 형식을 옮김 */
export interface RoomLayoutDto {
  schemaVersion: 1
  wallpaperId: string | null
  /** 세부 관심사 id → 가구 id (member_interest.furniture 와 같은 값) */
  furniture: Record<string, string>
  /**
   * 꾸미기에서 고른 땅굴 색 테마 (2026-11-18, app/src/data/roomStyle.ts: cat_food … cat_pet_plant, base = 디자이너 원래 색).
   * 없거나 null 이면 대표 관심사 대분류의 묶음. 나머지 꾸미기 값(이불·러그 무늬 · 기본 가구 모양)은 회원 id 씨앗으로 프론트가 계산
   */
  themeId?: string | null
}

export interface GuestbookEntryDto {
  id: LegacyId
  burrowId: LegacyId
  author: MemberSummaryDto
  /** VARCHAR(50) (화면은 100자 → erd-gaps) */
  content: string
  createdAt: IsoDateTime
}

/** 들판 한 장 (GET /fields/{campusFloorId}?termId=) */
export interface FieldResidentDto { slot: number; member: MemberProfileDto; burrowId: LegacyId }
export interface FieldDto {
  campusFloor: CampusFloorDto
  term: TermDto
  residents: FieldResidentDto[]
  /** 배정된 가장 큰 자리 번호 (구역 수 = ceil(maxSlot / 25)) */
  maxSlot: number
  mySlot: number | null
}

/* ===== 추천 ===== */
/** 추천 받기 요청: 고른 캠퍼스-층과 기수. 서버에 저장하지 않고 받을 때마다 다시 고름 (2026-11-21 명세) */
export interface RecommendRequestDto {
  /** 고른 캠퍼스-층의 id (목에서는 "캠퍼스|층") */
  campusFloorId: LegacyId
  generation: number
}
export interface DailyRecommendationDto {
  recommendedOn: IsoDate
  members: MemberProfileDto[]
}
