/**
 * 04 내 땅굴 DTO → 앱 모양 (화면은 이 결과만 쓴다), 화면 값 → 요청 본문.
 * 관심사 id ↔ 앱 이름은 api/onboarding interestMap (이름으로 잇기), 두더지 코드는 api/common/moleCodes (대문자)
 */
import { toAppId, toDtoId } from '../common/ids'
import { toPersonFromDisplay, type CampusOption, type Person } from '../common/mappers'
import type { PageDto } from '../common/types'
import { appInterestName, interestIdsOf, wornOfMole, type InterestCatalog } from '../onboarding'
import type { GuestbookEntry } from '../../data/types'
import type { GuestbookEntryDto, MyBurrowDto, ProfileUpdateRequest } from './types'

/** 내 땅굴 (앱 모양). id 는 앱 id 글자 */
export interface MyBurrowVM {
  burrowId: string
  owner: Person
  nickname: string
  campus: string
  gen: number | null
  floor: number
  campusFloorId: string
  /** 안 썼으면 '' */
  intro: string
  /** 앱 관심사 이름 (고른 순서, 첫 번째가 대표 관심사 → 땅굴 무드) */
  interests: string[]
  /** 질문 3개와 답변 (자리 순서). questionId 는 앱 id 글자 */
  answers: { slot: number; questionId: string; question: string; answer: string }[]
  /** 입은 아이템 id (두더지) */
  worn: string[]
  regularCount: number
  guestbookCount: number
  entrance: { termId: string; campusFloorId: string; slot: number }
}

export function toMyBurrow(d: MyBurrowDto): MyBurrowVM {
  const interests = d.interests.map((i) => appInterestName(i.name))
  const worn = wornOfMole(d.owner.mole)
  const owner = { ...toPersonFromDisplay(d.owner, d.interests), interests, worn, intro: d.intro ?? '' }
  return {
    burrowId: toAppId(d.burrowId), owner,
    nickname: d.owner.nickname ?? '', campus: d.owner.campusName ?? '', gen: d.owner.generation, floor: d.owner.floor ?? 0,
    campusFloorId: toAppId(d.campusFloorId), intro: d.intro ?? '', interests,
    answers: [...d.answers].sort((a, b) => a.slot - b.slot).map((a) => ({ slot: a.slot, questionId: toAppId(a.introQuestionId), question: a.question, answer: a.answer })),
    worn, regularCount: d.regularCount, guestbookCount: d.guestbookCount,
    entrance: { termId: toAppId(d.entrance.termId), campusFloorId: toAppId(d.entrance.campusFloorId), slot: d.entrance.slot },
  }
}

/** 내 정보 수정 화면 값 */
export interface ProfileDraft {
  nickname: string
  intro: string
  campus: string
  floor: number
  interests: string[]
  qna: { qid: string; a: string }[]
}

/** 캠퍼스 이름 + 층 → 캠퍼스-층 id (GET /campuses 목록에서). 없으면 null */
export function campusFloorIdOf(campuses: CampusOption[] | undefined, campus: string, floor: number): string | null {
  return campuses?.find((c) => c.name === campus)?.floors.find((f) => f.floor === floor)?.id ?? null
}

/** 내 정보 수정 값 → PATCH /me/profile 본문 (다섯 값 모두). 관심사 목록 · 캠퍼스 목록이 있어야 id 를 앎 */
export function toProfileUpdate(d: ProfileDraft, catalog: InterestCatalog, campusFloorId: string): ProfileUpdateRequest {
  return {
    nickname: d.nickname.trim(),
    campusFloorId: toDtoId(campusFloorId),
    interestIds: interestIdsOf(d.interests, catalog),
    answers: d.qna.map((x) => ({ introQuestionId: toDtoId(x.qid), answer: x.a.trim() })),
    intro: d.intro.trim() || null, // 앞뒤 공백을 지우고, 비었으면 null (명세 04, 서버도 같은 규칙)
  }
}

/* ===== 방명록 ===== */
/** 방명록 글 (화면 모양). GuestbookEntry 에 쓴 사람 · 할 수 있는 일이 붙음 */
export interface GuestbookItemVM extends GuestbookEntry {
  author: Person
  canDelete: boolean
  canReport: boolean
}
export interface GuestbookPageVM {
  items: GuestbookItemVM[]
  page: number
  totalItems: number
  /** 글이 없으면 0 */
  totalPages: number
}
export function toGuestbookItem(d: GuestbookEntryDto): GuestbookItemVM {
  const author = { ...toPersonFromDisplay(d.author), worn: wornOfMole(d.author.mole) }
  return { id: toAppId(d.id), authorId: author.id, author, text: d.content, createdAt: d.createdAt, canDelete: d.canDelete, canReport: d.canReport }
}
export const toGuestbookPage = (d: PageDto<GuestbookEntryDto>): GuestbookPageVM => ({
  items: d.items.map(toGuestbookItem), page: d.page, totalItems: d.totalItems, totalPages: d.totalPages,
})
