/**
 * 땅굴 · 방명록 · 들판 · 단골 (F4 · F5). 계약: docs/backend/api-draft.md "땅굴"
 * 땅굴 주소는 회원 id 로 연다 (/burrow/:userId). burrow.id 와 member.id 가 1:1 이라 서버가 바꿔 찾는다.
 * 목 구현: data/mock.ts(USERS·GUESTBOOK) · data/field.ts(들판·단골) · data/chat.ts(대화 관계)
 * 방명록은 땅굴 주인별로 나눔 (위험 B9). 목 데이터는 원래 하나뿐이라 주인마다 다른 몇 개를 골라 씀
 */
import { RULES } from '../lib/validation'
import { API_MODE } from './config'
import { http } from './client'
import { badRequest, cursorPage, emptyCursor, mockRead, mockWrite, notFound } from './mock/server'
import { entranceOf, guestbookEntryDto, memberProfile, rawPerson } from './mock/serialize'
import { GUESTBOOK, ME_ID } from '../data/mock'
import { CAMPUS_FLOORS, CURRENT_TERM, fieldOf, floorId, getRegulars, setRegular } from '../data/field'
import { dmRoomWith, sentRequestTo } from '../data/chat'
import { liveGuestbook } from '../lib/format'
import { toIso } from '../lib/time'
import type { GuestbookEntry } from '../data/types'
import { getMyFurnChoice, getMyRoomPick } from '../data/myBurrow'
import type { BurrowDto, CampusFloorDto, CursorPageDto, FieldDto, GuestbookEntryDto, Id, MemberProfileDto, RoomLayoutDto } from './types'

/** 방명록 글자 수 (화면 100자, ERD VARCHAR(50) → erd-gaps) */
/** 방명록 글자 수 (lib/validation · ERD guestbook_entry.content VARCHAR(50)) */
export const GUESTBOOK_MAX = RULES.guestbook.max

const real = {
  /** GET /burrows/{memberId} — 땅굴 방문 (주인·관계). 탈퇴·없는 사람 404 BURROW_NOT_FOUND */
  get: (memberId: Id, signal?: AbortSignal) => http.get<BurrowDto>(`/burrows/${memberId}`, undefined, signal),
  /** GET /burrows/{memberId}/guestbook — 7일 안 글, 최신순 (커서) */
  guestbook: (memberId: Id, cursor?: string | null, size = 20, signal?: AbortSignal) =>
    http.get<CursorPageDto<GuestbookEntryDto>>(`/burrows/${memberId}/guestbook`, { cursor, size }, signal),
  /** POST /burrows/{memberId}/guestbook */
  writeGuestbook: (memberId: Id, content: string) => http.post<GuestbookEntryDto>(`/burrows/${memberId}/guestbook`, { content }),
  /** DELETE /guestbook/{entryId} — 땅굴 주인·글쓴이 */
  deleteGuestbook: (entryId: Id) => http.delete<void>(`/guestbook/${entryId}`),
  /** PUT·DELETE /burrows/{memberId}/regular — 단골 (상대 수락 없음, 해제해도 알리지 않음) */
  setRegular: (memberId: Id, on: boolean) => (on ? http.put<void>(`/burrows/${memberId}/regular`) : http.delete<void>(`/burrows/${memberId}/regular`)),
  /** GET /me/regulars — 단골 땅굴 목록 */
  regulars: (signal?: AbortSignal) => http.get<MemberProfileDto[]>('/me/regulars', undefined, signal),
  /** GET /campus-floors — 캠퍼스-층 목록 (00 공통 19) */
  campusFloors: (signal?: AbortSignal) => http.get<CampusFloorDto[]>('/campus-floors', undefined, signal),
  /** GET /fields/{campusFloorId}?termId= — 들판 한 장 (자리 150개) */
  field: (campusFloorId: Id, termId?: Id, signal?: AbortSignal) => http.get<FieldDto>(`/fields/${campusFloorId}`, { termId }, signal),
}
export type BurrowsApi = typeof real

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
const ownerOrThrow = (memberId: Id) => { const u = rawPerson(memberId); if (!u) throw notFound('땅굴'); return u }
/**
 * 저장한 방 (목). 나는 꾸미기에서 고른 값(data/myBurrow), 다른 목 주민은 꾸민 적이 없어서 null → 화면이 관심사로 계산.
 * 시험·데모용으로 다른 사람 방을 넣으려면 mockRooms 에 (목 서버 안에서만)
 */
export const mockRooms = new Map<string, RoomLayoutDto>()
function roomOf(memberId: string): RoomLayoutDto | null {
  if (memberId !== ME_ID) return mockRooms.get(memberId) ?? null
  const pick = getMyRoomPick(), furniture = getMyFurnChoice()
  return pick.wallpaperId || Object.keys(furniture).length ? { schemaVersion: 1, wallpaperId: pick.wallpaperId, furniture } : null
}

const mock: BurrowsApi = {
  get: (memberId, signal) => mockRead(() => {
    const u = ownerOrThrow(memberId)
    const dm = dmRoomWith(u.id)
    return {
      id: `b-${u.id}`, owner: memberProfile(u.id), entrance: entranceOf(u.id), regular: getRegulars().includes(u.id),
      regularCount: 3 + (hash(u.id) % 20), visitorsNow: u.visitorsNow ?? 0,
      chatRoomId: dm && !dm.closed ? dm.id : null, pendingRequestId: sentRequestTo(u.id)?.id ?? null, room: roomOf(u.id),
    }
  }, { signal, detail: true }),
  guestbook: (memberId, cursor, size = 20, signal) => mockRead(() => {
    ownerOrThrow(memberId)
    return cursorPage(liveGuestbook(bookOf(memberId)).map((g) => guestbookEntryDto(g, memberId)), cursor, size)
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
    throw notFound('방명록 글')
  }),
  setRegular: (memberId, on) => mockWrite(() => { ownerOrThrow(memberId); setRegular(memberId, on) }),
  regulars: (signal) => mockRead(() => getRegulars().filter((id) => rawPerson(id)).map(memberProfile), { signal, empty: () => [] }),
  campusFloors: (signal) => mockRead(() => CAMPUS_FLOORS.flatMap((c, ci) => c.floors.map((fl) => ({ id: `${c.campus}|${fl}`, campusId: String(ci + 1), campus: c.campus, floor: fl }))), { signal }),
  field: (campusFloorId, termId, signal) => mockRead<FieldDto>(() => {
    const [campus, fl] = campusFloorId.split('|')
    const term = termId ?? CURRENT_TERM
    if (!CAMPUS_FLOORS.some((c) => c.campus === campus && c.floors.includes(Number(fl)))) throw notFound('들판')
    const f = fieldOf({ id: floorId(term, campus, Number(fl)), term, campus, floor: Number(fl) })
    const [year, half] = term.split(' ')
    return {
      campusFloor: { id: campusFloorId, campusId: campus, campus, floor: Number(fl) },
      term: { id: term, year: Number(year), half: half === '상반기' ? 'FIRST' : 'SECOND', openedAt: toIso(Date.UTC(Number(year), half === '상반기' ? 2 : 8, 1)) },
      residents: f.residents.map((r) => ({ slot: r.seat, member: memberProfile(r.mine ? ME_ID : r.user.id), burrowId: `b-${r.user.id}` })),
      maxSlot: f.maxSeat, mySlot: f.mySeat,
    }
  }, { signal, detail: true }),
}

export const burrows: BurrowsApi = API_MODE === 'real' ? real : mock
