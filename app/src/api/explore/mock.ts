/**
 * 05 탐색 · 방문 — 목 서버. data/mock.ts(USERS·GUESTBOOK) · data/field.ts(들판·단골·추천) · data/chat.ts(대화 관계)
 * 방명록은 땅굴 주인별로 나눔 (위험 B9). 목 데이터는 원래 하나뿐이라 주인마다 다른 몇 개를 골라 씀
 */
import { badRequest, conflict, cursorPage, emptyCursor, mockRead, mockWrite, notFound } from '../mock/server'
import { memberProfile, memberSummary, rawPerson } from '../common/mockPeople'
import { GUESTBOOK, ME_ID } from '../../data/mock'
import { CAMPUS_FLOORS, CURRENT_TERM, drawRecommendations, fieldOf, floorId, getRegulars, locateUser, setRegular, todaysPicks } from '../../data/field'
import { dmRoomWith, sentRequestTo } from '../../data/chat'
import { getMyFurnChoice, getMyRoomPick } from '../../data/myBurrow'
import type { GuestbookEntry } from '../../data/types'
import { visibleGuestbook } from '../../lib/format'
import { seoulYmd, toIso } from '../../lib/time'
import { GUESTBOOK_MAX, type ExploreApi } from './real'
import type { BurrowEntranceDto, DailyRecommendationDto, FieldDto, GuestbookEntryDto, RoomLayoutDto } from './types'

/* ===== 직렬화 (저장소 → DTO) ===== */
export function entranceOf(userId: string): BurrowEntranceDto | null {
  const spot = locateUser(userId)
  if (!spot) return null
  const [year, half] = spot.floor.term.split(' ')
  return {
    termId: spot.floor.term, year: Number(year), half: half === '상반기' ? 'FIRST' : 'SECOND',
    campusFloorId: `${spot.floor.campus}|${spot.floor.floor}`, campus: spot.floor.campus, floor: spot.floor.floor, slot: spot.seat,
  }
}
export function guestbookEntryDto(g: GuestbookEntry, ownerId: string): GuestbookEntryDto {
  return { id: g.id, burrowId: `b-${ownerId}`, author: memberSummary(g.authorId), content: g.text, createdAt: g.createdAt }
}

/* ===== 목 서버 ===== */
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
/** 주인별 방명록 (목). 내 땅굴은 원래 목 데이터 전체, 남의 땅굴은 주인이 쓰지 않은 글 몇 개 */
const books = new Map<string, GuestbookEntry[]>()
function bookOf(ownerId: string): GuestbookEntry[] {
  let b = books.get(ownerId)
  if (!b) {
    if (ownerId === ME_ID) b = [...GUESTBOOK]
    else {
      const pool = GUESTBOOK.filter((g) => g.authorId !== ownerId)
      const h = hash(ownerId)
      const n = 2 + (h % 5)
      b = Array.from({ length: Math.min(n, pool.length) }, (_, i) => ({ ...pool[(h + i * 3) % pool.length], id: `${ownerId}-gb${i}` }))
    }
    books.set(ownerId, b)
  }
  return b
}
const burrowNotFound = () => notFound('BURROW', '땅굴을 찾을 수 없습니다.')
const gbNotFound = () => notFound('GUESTBOOK_ENTRY', '방명록 글을 찾을 수 없습니다.')
const ownerOrThrow = (memberId: string) => { const u = rawPerson(memberId); if (!u) throw burrowNotFound(); return u }
/**
 * 저장한 방 (목). 나는 꾸미기에서 고른 값(data/myBurrow), 다른 목 주민은 꾸민 적이 없어서 null → 화면이 관심사로 계산.
 * 시험·데모용으로 다른 사람 방을 넣으려면 mockRooms 에 (목 서버 안에서만)
 */
export const mockRooms = new Map<string, RoomLayoutDto>()
function roomOf(memberId: string): RoomLayoutDto | null {
  if (memberId !== ME_ID) return mockRooms.get(memberId) ?? null
  const pick = getMyRoomPick(), furniture = getMyFurnChoice()
  return pick.wallpaperId || pick.themeId || Object.keys(furniture).length ? { schemaVersion: 1, wallpaperId: pick.wallpaperId, furniture, themeId: pick.themeId } : null
}
const daily = (ids: string[]): DailyRecommendationDto => ({ recommendedOn: seoulYmd(Date.now()), members: ids.map(memberProfile) })

export const mock: ExploreApi = {
  get: (memberId, signal) => mockRead(() => {
    const u = ownerOrThrow(memberId)
    const dm = dmRoomWith(u.id)
    return {
      id: `b-${u.id}`, owner: memberProfile(u.id), entrance: entranceOf(u.id), regular: getRegulars().includes(u.id),
      regularCount: 3 + (hash(u.id) % 20), visitorsNow: u.visitorsNow ?? 0,
      chatRoomId: dm && !dm.closed ? dm.id : null, pendingRequestId: sentRequestTo(u.id)?.id ?? null, room: roomOf(u.id),
    }
  }, { signal, detail: 'BURROW' }),
  guestbook: (memberId, cursor, size = 20, signal) => mockRead(() => {
    ownerOrThrow(memberId)
    return cursorPage(visibleGuestbook(bookOf(memberId)).map((g) => guestbookEntryDto(g, memberId)), cursor, size)
  }, { signal, empty: () => emptyCursor() }),
  writeGuestbook: (memberId, content) => mockWrite(() => {
    ownerOrThrow(memberId)
    const text = content.trim()
    if (!text) throw badRequest('EMPTY_CONTENT', '내용을 적어 주세요.')
    if (text.length > GUESTBOOK_MAX) throw badRequest('TOO_LONG', `방명록은 ${GUESTBOOK_MAX}자까지 쓸 수 있어요.`)
    const g: GuestbookEntry = { id: `gb${Date.now().toString(36)}`, authorId: ME_ID, text, createdAt: toIso(Date.now()) }
    bookOf(memberId).unshift(g)
    return guestbookEntryDto(g, memberId)
  }),
  deleteGuestbook: (entryId) => mockWrite(() => {
    for (const b of books.values()) { const i = b.findIndex((g) => g.id === entryId); if (i >= 0) { b.splice(i, 1); return } }
    throw gbNotFound()
  }),
  reportGuestbook: (entryId) => mockWrite(() => {
    // 신고한 사람 기준으로 센다 (같은 사람이 또 눌러도 그대로). 서로 다른 3명이 되면 visibleGuestbook 이 빼서 다음에 받을 때부터 안 보임
    for (const b of books.values()) {
      const g = b.find((x) => x.id === entryId)
      if (g) { if (!(g.reporters ?? []).includes(ME_ID)) g.reporters = [...(g.reporters ?? []), ME_ID]; return }
    }
    throw gbNotFound()
  }),
  setRegular: (memberId, on) => mockWrite(() => { ownerOrThrow(memberId); setRegular(memberId, on) }),
  regulars: (signal) => mockRead(() => getRegulars().filter((id) => rawPerson(id)).map(memberProfile), { signal, empty: () => [] }),
  campusFloors: (signal) => mockRead(() => CAMPUS_FLOORS.flatMap((c, ci) => c.floors.map((fl) => ({ id: `${c.campus}|${fl}`, campusId: String(ci + 1), campus: c.campus, floor: fl }))), { signal }),
  field: (campusFloorId, termId, signal) => mockRead<FieldDto>(() => {
    const [campus, fl] = campusFloorId.split('|')
    const term = termId ?? CURRENT_TERM
    if (!CAMPUS_FLOORS.some((c) => c.campus === campus && c.floors.includes(Number(fl)))) throw notFound('FIELD', '들판을 찾을 수 없습니다.')
    const f = fieldOf({ id: floorId(term, campus, Number(fl)), term, campus, floor: Number(fl) })
    const [year, half] = term.split(' ')
    return {
      campusFloor: { id: campusFloorId, campusId: campus, campus, floor: Number(fl) },
      term: { id: term, year: Number(year), half: half === '상반기' ? 'FIRST' : 'SECOND', openedAt: toIso(Date.UTC(Number(year), half === '상반기' ? 2 : 8, 1)) },
      residents: f.residents.map((r) => ({ slot: r.seat, member: memberProfile(r.mine ? ME_ID : r.user.id), burrowId: `b-${r.user.id}` })),
      maxSlot: f.maxSeat, mySlot: f.mySeat,
    }
  }, { signal, detail: 'FIELD' }),
  todayRecommendation: (signal) => mockRead(() => { const p = todaysPicks(); if (!p) throw notFound('DAILY_RECOMMENDATION', '오늘의 추천을 아직 받지 않았습니다.'); return daily(p) }, { signal }),
  drawRecommendation: (req) => mockWrite(() => {
    if (todaysPicks()) throw conflict('ALREADY_DRAWN', '오늘은 이미 추천을 받았어요.')
    const [campus, floor] = req.campusFloorId.split('|')
    if (!campus || !Number.isInteger(Number(floor))) throw badRequest('INVALID_INPUT', '캠퍼스와 층을 골라 주세요.')
    return daily(drawRecommendations({ campus, floor: Number(floor), gen: req.generation }))
  }),
}
