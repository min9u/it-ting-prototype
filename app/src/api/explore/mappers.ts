/**
 * 05 탐색 · 방문 (+ 00 학기) DTO → 앱 모양. 화면은 이 결과만 쓴다.
 * - id 는 앱 문자열 (toAppId). 들판은 앱에서 FieldPlace{termId, campusFloorId}, 주소에는 placeId = "학기id|캠퍼스-층id"
 *   (목 모드: '2026 하반기|서울|2' = 예전 들판 id 와 같아서 data/field 의 parseFloor · 3D 들판 key 가 그대로 맞음)
 * - 들판은 data/field 의 FieldData 모양(자리 · 주인 · 구역 수 · 내 자리)으로 바꿔 3D 들판 · 미니맵이 그대로 받게 함
 * - "N분 전" 같은 문구는 서버가 주지 않음 → 화면이 시각(ms)으로 만듦
 */
import { toAppId, toAppIdOrNull, toPersonFromDisplay, type InterestTagDto, type Person } from '../common'
import type { FieldData, FieldUser, Floor, Resident } from '../../data/field'
import type { QnA } from '../../data/types'
import { parseIso } from '../../lib/time'
import type {
  AnswerDto, ChatRequestCreatedDto, ChatStatus, DailyRecommendationDto, EntranceDto, FieldDto, FieldStatusesDto,
  MoveBurrowDto, RegularBurrowsDto, TermDto, TermsDto, UserBurrowDto,
} from './types'

/* ===== 학기 ===== */
export interface TermVM { id: string; year: number; half: 1 | 2; isCurrent: boolean; /** "2026 하반기" */ label: string }
/** "2026 하반기" (명세: 표기는 프론트가 year · half 로 만든다) */
export const termLabel = (year: number, half: number) => `${year} ${half === 1 ? '상반기' : '하반기'}`
export const toTerm = (d: TermDto): TermVM => ({ id: toAppId(d.id), year: d.year, half: d.half, isCurrent: d.isCurrent, label: termLabel(d.year, d.half) })
/** 최근에 열린 학기부터 (첫 번째가 이번 학기) */
export const toTerms = (d: TermsDto): TermVM[] => d.items.map(toTerm)

/* ===== 들판 위치 ===== */
/** 들판 하나 = 학기 하나 + 캠퍼스-층 하나 (앱 id) */
export interface FieldPlace { termId: string; campusFloorId: string }
/** 주소 ?floor= 값. 학기 id 에는 '|' 가 없음 (목: 학기 이름, 실제: 숫자) → 첫 '|' 로 나눔 */
export const placeId = (p: FieldPlace) => `${p.termId}|${p.campusFloorId}`
export function parsePlace(s: string | null | undefined): FieldPlace | null {
  if (!s) return null
  const i = s.indexOf('|')
  if (i <= 0 || i >= s.length - 1) return null
  return { termId: s.slice(0, i), campusFloorId: s.slice(i + 1) }
}
export const samePlace = (a: FieldPlace | null | undefined, b: FieldPlace | null | undefined) => !!a && !!b && a.termId === b.termId && a.campusFloorId === b.campusFloorId
/** 탐색 화면 주소 (그 들판의 그 자리) */
export const exploreHrefOf = (p: FieldPlace, seat?: number) => `/burrow/explore?floor=${encodeURIComponent(placeId(p))}${seat ? `&seat=${seat}` : ''}`

/** 입구 (앱): 들판과 자리 번호 */
export interface EntranceVM { place: FieldPlace; seat: number }
export const toEntrance = (d: EntranceDto): EntranceVM => ({ place: { termId: toAppId(d.termId), campusFloorId: toAppId(d.campusFloorId) }, seat: d.slot })

/** 들판마다 비어 있는지 (캠퍼스-층 id → 비었으면 true) */
export const toFieldStatuses = (d: FieldStatusesDto): Map<string, boolean> => new Map(d.items.map((x) => [toAppId(x.campusFloorId), x.isEmpty]))

/* ===== 사람 (질문 · 관심사) ===== */
/** 질문과 답변 → 앱 Q&A ("Q1. 질문") */
export const toQna = (answers: AnswerDto[]): QnA[] => [...answers].sort((a, b) => a.slot - b.slot).map((x) => ({ q: `Q${x.slot}. ${x.question}`, a: x.answer }))
/** 나와 겹치는 관심사 이름 (isShared) */
export const sharedNames = (tags: InterestTagDto[]): string[] => tags.filter((t) => t.isShared).map((t) => t.name)
function personOf(owner: UserBurrowDto['owner'], tags: InterestTagDto[], answers: AnswerDto[], intro?: string | null): Person {
  const p = toPersonFromDisplay(owner, tags)
  return { ...p, qna: toQna(answers), ...(intro !== undefined ? { intro: intro ?? '' } : {}) }
}

/* ===== 들판 ===== */
/** 3D 들판 · 미니맵이 받는 모양 + 위치 · 학기 */
export interface FieldVM extends FieldData {
  place: FieldPlace
  term: TermVM
}
/** 구역 하나 = 자리 25개 (3D 핸드오프 v3.9). 켜는 구역 수 = ceil(가장 큰 자리 번호 / 25), 최소 1 */
export const SEATS_PER_ZONE = 25
export function toField(d: FieldDto): FieldVM {
  const term = toTerm(d.term)
  const place = { termId: term.id, campusFloorId: toAppId(d.campusFloorId) }
  const floor: Floor = { id: placeId(place), term: term.label, campus: d.campusName, floor: d.floor, current: term.isCurrent }
  const residents: Resident[] = [...d.items].sort((a, b) => a.slot - b.slot).map((e) => {
    const p = personOf(e.owner, e.interests, e.answers)
    const user: FieldUser = { ...p, campus: p.campus ?? '', gen: p.gen ?? 0, floor: p.floor ?? 0 }
    return { seat: e.slot, user, mine: e.isMine || undefined, shared: e.isMine ? [] : sharedNames(e.interests), burrowId: toAppId(e.burrowId) }
  })
  const maxSeat = residents.reduce((n, r) => Math.max(n, r.seat), 0)
  const mine = residents.find((r) => r.mine)
  return { place, term, floor, residents, maxSeat, zones: Math.max(1, Math.ceil(maxSeat / SEATS_PER_ZONE)), mySeat: mine?.seat ?? null }
}

/* ===== 이사 ===== */
export const toMoved = (d: MoveBurrowDto): EntranceVM => toEntrance(d.entrance)

/* ===== 단골 ===== */
export interface RegularVM { burrowId: string; owner: Person; /** 담은 시각 (ms) */ since: number }
export const toRegulars = (d: RegularBurrowsDto): RegularVM[] =>
  d.items.map((x) => ({ burrowId: toAppId(x.burrowId), owner: toPersonFromDisplay(x.owner), since: parseIso(x.createdAt) }))

/* ===== 오늘의 추천 ===== */
export interface FriendCardVM {
  burrowId: string
  owner: Person
  /** 서버가 고른 3개, 받은 순서 그대로 (겹치는 것 먼저) */
  tags: { name: string; shared: boolean }[]
  qna: QnA[]
}
export interface DailyRecommendationVM { hasReceived: boolean; recommendedOn: string; friends: FriendCardVM[] }
export const toDailyRecommendation = (d: DailyRecommendationDto): DailyRecommendationVM => ({
  hasReceived: d.hasReceived, recommendedOn: d.recommendedOn,
  friends: d.items.map((x) => ({
    burrowId: toAppId(x.burrowId), owner: personOf(x.owner, x.interests, x.answers),
    tags: x.interests.map((t) => ({ name: t.name, shared: t.isShared })), qna: toQna(x.answers),
  })),
})

/* ===== 남의 땅굴 ===== */
export interface BurrowVM {
  burrowId: string
  /** 내 땅굴이면 화면이 /burrow 로 보냄 */
  isMine: boolean
  /** 주인 (자기소개 · 관심사 · Q&A 포함) */
  owner: Person
  /** 나와 겹치는 관심사 이름 (isShared) */
  shared: string[]
  /** 방명록 글 수 → 우체통 깃발 */
  guestbookCount: number
  isRegular: boolean
  chat: { status: ChatStatus; chatRoomId: string | null }
  /** 이 땅굴이 놓인 들판 ("탐색"을 누르면 이 들판의 이 자리) */
  entrance: EntranceVM
}
export const toBurrow = (d: UserBurrowDto): BurrowVM => ({
  burrowId: toAppId(d.burrowId), isMine: d.isMine,
  owner: personOf(d.owner, d.interests, d.answers, d.intro),
  shared: d.isMine ? [] : sharedNames(d.interests),
  guestbookCount: d.guestbookCount, isRegular: d.isRegular,
  chat: { status: d.chat.status, chatRoomId: toAppIdOrNull(d.chat.chatRoomId) },
  entrance: toEntrance(d.entrance),
})

/* ===== 대화 요청 ===== */
/** 요청을 만들었으면 chatRequestId, 바로 대화방이 열렸으면 chatRoomId */
export interface ChatRequestResultVM { chatRequestId: string | null; chatRoomId: string | null }
export const toChatRequestResult = (d: ChatRequestCreatedDto): ChatRequestResultVM => ({ chatRequestId: toAppIdOrNull(d.chatRequestId), chatRoomId: toAppIdOrNull(d.chatRoomId) })
