/**
 * 05 탐색 · 방문 (+ 00 학기) — 목 서버. 명세 모양 그대로 흉내 낸다.
 * "DB" = data/field.ts(학기 · 들판 · 입구 · 단골 · 추천) · data/guestbooks.ts(방명록) · data/chat.ts(대화 관계, 읽기 + 요청 만들기) · data/mock.ts(사람)
 *
 * 목 id (common/ids.ts 의 되돌릴 수 있는 표):
 * - 학기: 학기 이름 '2026 하반기' → 숫자. 캠퍼스-층: '서울|2' (00 공통 목 서버와 같은 글자) → 숫자
 * - 땅굴: 'b-<주인 id>' → 숫자. 사람: 사람 id → 숫자 (common/mockPeople userDisplay)
 * 그래서 앱 쪽 들판 주소 ?floor=<학기 id>|<캠퍼스-층 id> 가 목 모드에서는 예전 들판 id('2026 하반기|서울|2')와 같다
 *
 * 새 학기를 고르지 않은 계정(data/field isNewTermPending, 시연 ?newterm=demo): 학기 목록 · 이사 말고는 403 NEW_TERM_INCOMPLETE
 */
import { conflict, forbidden, invalidInput, items, mockRead, mockWrite, notFound } from '../mock/server'
import { interestTags, rawPerson, userDisplay } from '../common/mockPeople'
import { toAppId, toDtoId } from '../common/ids'
import type { Id, InterestTagDto } from '../common/types'
import { ME_ID } from '../../data/mock'
import { GENERATIONS } from '../../data/auth'
import { campusesInOrder } from '../../data/campusFloors'
import {
  CAMPUS_FLOORS, CURRENT_TERM, TERMS, drawRecommendations, fieldOf, floorId, getRegulars, isNewTermPending, isRegular, locateUser,
  moveMyBurrow, myEntrance, regularSince, resetToday, setRegular, startNewTermDemo, todaysPicks, type Floor,
} from '../../data/field'
import { dmRoomWith, receivedFrom, sendRequest, sentRequestTo, REQUEST_TTL_DAYS } from '../../data/chat'
import { addGuestbookEntry, findGuestbookEntry, guestbookCountOf, guestbookOf, removeGuestbookEntry } from '../../data/guestbooks'
import type { GuestbookEntry } from '../../data/types'
import { seoulYmd, toIso } from '../../lib/time'
import { CHAT_REQUEST_MAX } from '../../lib/validation'
import { GUESTBOOK_MAX, type ExploreApi } from './real'
import type {
  AnswerDto, ChatStatus, DailyRecommendationDto, EntranceDto, FieldEntranceDto, GuestbookEntryDto, RecommendedFriendDto, TermDto, UserBurrowDto,
} from './types'

/* ===== 실패 ===== */
const burrowNotFound = () => notFound('BURROW', '땅굴을 찾을 수 없습니다.')
const termNotFound = () => notFound('TERM', '학기를 찾을 수 없습니다.')
const floorNotFound = () => notFound('CAMPUS_FLOOR', '캠퍼스-층을 찾을 수 없습니다.')
const ownBurrow = () => forbidden('내 땅굴에는 할 수 없습니다.', 'OWN_BURROW_NOT_ALLOWED')
/** 새 학기를 고르지 않은 계정은 이사 · 학기 목록 말고는 막음 (02 "새 학기를 고르지 않은 계정") */
function guard() {
  if (isNewTermPending()) throw forbidden('이번 학기의 캠퍼스 · 층을 먼저 골라야 합니다.', 'NEW_TERM_INCOMPLETE')
}

/* ===== 직렬화 (저장소 → DTO) ===== */
const halfOf = (term: string): 1 | 2 => (term.endsWith('상반기') ? 1 : 2)
export const termDto = (term: string): TermDto => ({ id: toDtoId(term), year: Number(term.split(' ')[0]), half: halfOf(term), isCurrent: term === CURRENT_TERM })
const cfKey = (campus: string, floor: number) => `${campus}|${floor}`
const burrowIdOf = (userId: string): Id => toDtoId(`b-${userId}`)
const entranceDto = (spot: { floor: Floor; seat: number }): EntranceDto => ({ termId: toDtoId(spot.floor.term), campusFloorId: toDtoId(cfKey(spot.floor.campus, spot.floor.floor)), slot: spot.seat })

/** 학기 id → 학기 이름 (없으면 404 TERM_NOT_FOUND) */
function termOf(termId: Id): string {
  const t = toAppId(termId)
  if (!(TERMS as readonly string[]).includes(t)) throw termNotFound()
  return t
}
/** 캠퍼스-층 id → 캠퍼스 · 층 (없으면 404 CAMPUS_FLOOR_NOT_FOUND) */
function campusFloorOf(campusFloorId: Id): { campus: string; floor: number } {
  const [campus, fl] = toAppId(campusFloorId).split('|')
  const floor = Number(fl)
  if (!CAMPUS_FLOORS.some((c) => c.campus === campus && c.floors.includes(floor))) throw floorNotFound()
  return { campus, floor }
}
const floorObj = (term: string, campus: string, floor: number): Floor => ({ id: floorId(term, campus, floor), term, campus, floor })

/** 사람의 땅굴 입구 (이번 학기 → 없으면 지난 학기 들판까지). 땅굴이 없으면 null */
function locate(userId: string): { floor: Floor; seat: number } | null {
  if (userId === ME_ID) return myEntrance()
  const now = locateUser(userId)
  if (now) return now
  for (const term of TERMS) {
    if (term === CURRENT_TERM) continue
    for (const c of CAMPUS_FLOORS) for (const fl of c.floors) {
      const r = fieldOf(floorObj(term, c.campus, fl)).residents.find((x) => !x.mine && x.user.id === userId)
      if (r) return { floor: floorObj(term, c.campus, fl), seat: r.seat }
    }
  }
  return null
}
/** 땅굴 id → 주인 id (없는 땅굴이면 404 BURROW_NOT_FOUND) */
function ownerOfBurrow(burrowId: Id): string {
  const key = toAppId(burrowId)
  const userId = key.startsWith('b-') ? key.slice(2) : ''
  if (!userId || !locate(userId) || !rawPerson(userId)) throw burrowNotFound()
  return userId
}

/** "Q1. 질문" → "질문" (목 데이터의 질문에는 번호가 붙어 있음. 명세는 질문 문구만) */
const stripQ = (q: string) => q.replace(/^Q\d+\.\s*/, '')
export function answersOf(userId: string): AnswerDto[] {
  const u = rawPerson(userId)
  return (u?.qna ?? []).slice(0, 3).map((x, i) => ({ slot: i + 1, introQuestionId: toDtoId(`q:${stripQ(x.q)}`), question: stripQ(x.q), answer: x.a }))
}
/** 추천 카드의 관심사: 나와 겹치는 것을 앞에, 각각은 고른 순서, 앞에서 3개 (서버가 고름) */
export const cardInterests = (tags: InterestTagDto[]): InterestTagDto[] => [...tags.filter((t) => t.isShared), ...tags.filter((t) => !t.isShared)].slice(0, 3)

function entranceItem(r: { seat: number; user: { id: string }; mine?: boolean }): FieldEntranceDto {
  const id = r.mine ? ME_ID : r.user.id
  return { slot: r.seat, burrowId: burrowIdOf(id), isMine: !!r.mine, owner: userDisplay(id), interests: interestTags(id), answers: answersOf(id) }
}
const friendDto = (id: string): RecommendedFriendDto => ({ burrowId: burrowIdOf(id), owner: userDisplay(id), interests: cardInterests(interestTags(id)), answers: answersOf(id) })
function dailyDto(): DailyRecommendationDto {
  const picks = todaysPicks()
  // 추천받은 뒤 탈퇴한 사람은 뺌
  return { hasReceived: !!picks, recommendedOn: seoulYmd(Date.now()), items: (picks ?? []).filter((id) => rawPerson(id)).map(friendDto) }
}
function chatStatusOf(userId: string): { status: ChatStatus; chatRoomId: Id | null } {
  if (userId === ME_ID) return { status: 'NONE', chatRoomId: null }
  const dm = dmRoomWith(userId)
  if (dm && !dm.closed) return { status: 'CHATTING', chatRoomId: toDtoId(dm.id) }
  if (sentRequestTo(userId)) return { status: 'REQUEST_SENT', chatRoomId: null }
  if (receivedFrom(userId)) return { status: 'REQUEST_RECEIVED', chatRoomId: null }
  return { status: 'NONE', chatRoomId: null }
}
export function userBurrowDto(userId: string): UserBurrowDto {
  const spot = locate(userId)
  const u = rawPerson(userId)
  if (!u || !spot) throw burrowNotFound()
  const mine = userId === ME_ID
  return {
    burrowId: burrowIdOf(userId), isMine: mine, owner: userDisplay(userId), intro: u.intro || null,
    interests: interestTags(userId), answers: answersOf(userId), guestbookCount: guestbookCountOf(userId),
    isRegular: !mine && isRegular(userId), chat: chatStatusOf(userId), entrance: entranceDto(spot),
  }
}
/** 방명록 글 (보는 사람 = 나). 주인은 모든 글을 지울 수 있고, 방문자는 자기 글만 */
export const guestbookEntryDto = (g: GuestbookEntry, ownerId: string): GuestbookEntryDto => ({
  id: toDtoId(g.id), author: userDisplay(g.authorId), content: g.text, createdAt: toIso(Date.parse(g.createdAt)),
  canDelete: ownerId === ME_ID || g.authorId === ME_ID, canReport: ownerId === ME_ID || g.authorId !== ME_ID,
})

const GEN_NUMS = GENERATIONS.map((g) => parseInt(g, 10))

/** 새 학기 안내 시연 시작 (목 모드에서만 화면이 부름, index.ts 의 startNewTermDemo) */
export const startMockNewTerm = () => startNewTermDemo()
/** 오늘 받은 추천 지우기 (index.ts 의 resetDailyRecommendationDemo) */
export const resetMockDaily = () => resetToday()

/* ===== 목 서버 ===== */
export const mock: ExploreApi = {
  terms: (signal) => mockRead(() => items(TERMS.map(termDto)), { signal }),

  fieldStatuses: (termId, signal) => mockRead(() => {
    guard()
    const term = termOf(termId)
    return items(campusesInOrder().flatMap((c) => [...c.floors].sort((a, b) => a - b).map((fl) => ({
      campusFloorId: toDtoId(cfKey(c.campus, fl)), isEmpty: fieldOf(floorObj(term, c.campus, fl)).residents.length === 0,
    }))))
  }, { signal }),

  field: (termId, campusFloorId, signal) => mockRead(() => {
    guard()
    const term = termOf(termId)
    const { campus, floor } = campusFloorOf(campusFloorId)
    const f = fieldOf(floorObj(term, campus, floor))
    return { term: termDto(term), campusFloorId: toDtoId(cfKey(campus, floor)), campusName: campus, floor, items: [...f.residents].sort((a, b) => a.seat - b.seat).map(entranceItem) }
  }, { signal, detail: 'CAMPUS_FLOOR' }),

  moveBurrow: (req) => mockWrite(() => {
    // 이미 이번 학기 들판에 있으면 본문도 보지 않고 지금 값 (두 번 불러도 한 번만 옮김)
    if (isNewTermPending()) {
      const { campus, floor } = campusFloorOf(req.campusFloorId)
      moveMyBurrow(campus, floor)
    }
    return { userId: toDtoId(ME_ID), nextStep: 'HOME' as const, entrance: entranceDto(myEntrance()) }
  }),

  regularBurrows: (signal) => mockRead(() => {
    guard()
    // 주인이 탈퇴한 땅굴은 단골에서도 지워짐 → 안 나옴
    return items(getRegulars().filter((id) => rawPerson(id) && locate(id)).map((id) => ({ burrowId: burrowIdOf(id), owner: userDisplay(id), createdAt: toIso(regularSince(id)) })))
  }, { signal, empty: () => items([]) }),
  addRegular: (burrowId) => mockWrite(() => {
    guard()
    const id = ownerOfBurrow(burrowId)
    if (id === ME_ID) throw ownBurrow()
    setRegular(id, true)
    return { isRegular: true }
  }),
  removeRegular: (burrowId) => mockWrite(() => {
    guard()
    setRegular(ownerOfBurrow(burrowId), false)
    return { isRegular: false }
  }),

  dailyRecommendation: (signal) => mockRead(() => { guard(); return dailyDto() }, { signal }),
  drawRecommendation: (req) => mockWrite(() => {
    guard()
    // 오늘 이미 받았으면 본문을 보지 않고 저장된 결과 (조건을 바꿔도 처음 결과)
    if (todaysPicks()) return dailyDto()
    if (!GEN_NUMS.includes(req.generation)) throw invalidInput({ generation: '고를 수 있는 기수가 아닙니다.' })
    const { campus, floor } = campusFloorOf(req.campusFloorId)
    drawRecommendations({ campus, floor, gen: req.generation })
    return dailyDto()
  }),

  userBurrow: (userId, signal) => mockRead(() => { guard(); return userBurrowDto(toAppId(userId)) }, { signal, detail: 'BURROW' }),

  writeGuestbook: (burrowId, content) => mockWrite(() => {
    guard()
    const text = content.trim()
    if (!text) throw invalidInput({ content: '본문을 입력해 주세요.' })
    if (content.length > GUESTBOOK_MAX) throw invalidInput({ content: `본문은 ${GUESTBOOK_MAX}자를 넘을 수 없습니다.` })
    const ownerId = ownerOfBurrow(burrowId)
    if (ownerId === ME_ID) throw ownBurrow()
    return guestbookEntryDto(addGuestbookEntry(ownerId, ME_ID, content), ownerId)
  }),

  sendChatRequest: (req) => mockWrite(() => {
    guard()
    const message = req.message?.trim() ? req.message : null
    if (message && message.length > CHAT_REQUEST_MAX) throw invalidInput({ message: `인사는 ${CHAT_REQUEST_MAX}자를 넘을 수 없습니다.` })
    const rid = toAppId(req.receiverId)
    if (rid === ME_ID) throw invalidInput({ receiverId: '나에게는 대화를 요청할 수 없습니다.' })
    if (!rawPerson(rid)) throw notFound('USER', '사용자를 찾을 수 없습니다.')
    const dm = dmRoomWith(rid)
    if (dm && !dm.closed) throw conflict('CHAT_ROOM_ALREADY_EXISTS', '이미 대화 중인 사람입니다.')
    if (sentRequestTo(rid)) throw conflict('CHAT_REQUEST_ALREADY_SENT', '이미 대화 요청을 보냈습니다.')
    if (receivedFrom(rid)) throw conflict('CHAT_REQUEST_ALREADY_RECEIVED', '상대가 이미 대화 요청을 보냈습니다.')
    // 목 채팅 저장소에는 "내가 거절한 요청"이 남지 않아서 바로 대화방이 열리는 경우(서버가 하는 일 7)는 흉내 내지 않음
    sendRequest(rid, message ?? '')
    const r = sentRequestTo(rid)!
    return { chatRequestId: toDtoId(r.id), createdAt: toIso(r.at), expiresAt: toIso(r.at + REQUEST_TTL_DAYS * 86_400_000), chatRoomId: null }
  }),

  /* ----- 다리: 04 방명록 목록 · 지우기 (api/burrow 가 만들면 지움) ----- */
  guestbookPage: (burrowId, page = 1, size = 5, signal) => mockRead(() => {
    guard()
    const ownerId = ownerOfBurrow(burrowId)
    const all = guestbookOf(ownerId).map((g) => guestbookEntryDto(g, ownerId))
    const totalPages = Math.ceil(all.length / size)
    return { items: all.slice((page - 1) * size, page * size), page, size, totalItems: all.length, totalPages }
  }, { signal, empty: () => ({ items: [], page: 1, size, totalItems: 0, totalPages: 0 }) }),
  deleteGuestbookEntry: (entryId) => mockWrite(() => {
    guard()
    const hit = findGuestbookEntry(toAppId(entryId))
    if (!hit) throw notFound('GUESTBOOK_ENTRY', '방명록 글을 찾을 수 없습니다.')
    if (hit.ownerId !== ME_ID && hit.entry.authorId !== ME_ID) throw forbidden('지울 수 없는 글입니다.')
    removeGuestbookEntry(hit.entry.id)
    return null
  }),
}
