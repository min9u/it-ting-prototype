/** 05 탐색 · 방문 DTO → 앱 모양 (남의 땅굴 · 방명록) */
import { toAppId, toPerson, type Person } from '../common'
import type { MemberProfileDto } from '../common/legacy'
import { floorId, type Floor } from '../../data/field'
import type { GuestbookEntry } from '../../data/types'
import type { SavedRoom } from '../../data/roomLook'
import { subOf } from '../../data/interests'
import type { BurrowDto, GuestbookEntryDto, RoomLayoutDto } from './types'

export interface BurrowVM {
  owner: Person
  regular: boolean
  regularCount: number
  visitorsNow: number
  chatRoomId: string | null
  pendingRequestId: string | null
  /** 탐색 화면의 그 들판 그 자리 */
  spot: { floor: Floor; seat: number } | null
  /**
   * 집주인이 저장한 방 (꾸미기에서 고른 벽지·가구). 저장한 게 없으면 null → 화면이 관심사로 계산 (data/roomLook.ts roomLookOf).
   * 내 땅굴과 같은 함수를 거쳐서, 내가 보는 내 방과 남이 보는 내 방이 같음 (2026-11-18 1단계)
   */
  room: SavedRoom | null
}
/**
 * 방 꾸미기 저장 값 → 앱 값. 가구는 room.furniture 가 먼저, 없으면 관심사마다 온 member_interest.furniture.
 * 모르는 벽지·가구 id 는 roomLookOf 가 버리고 계산 값을 씀
 */
export function toSavedRoom(room: RoomLayoutDto | null | undefined, owner?: MemberProfileDto): SavedRoom | null {
  const perInterest: Record<string, string> = {}
  // 앱의 가구 선택 키는 소분류 코드(cafe_coffee …). 서버 interestId 가 숫자여도 이름으로 찾음
  for (const i of owner?.interests ?? []) if (i.furniture) perInterest[subOf(i.name)?.id ?? toAppId(i.interestId)] = i.furniture
  const furniture = { ...perInterest, ...(room?.furniture ?? {}) }
  if (!room?.wallpaperId && !room?.themeId && !Object.keys(furniture).length) return null
  return { wallpaperId: room?.wallpaperId ?? null, furniture, themeId: room?.themeId ?? null }
}
export function toBurrow(d: BurrowDto): BurrowVM {
  const e = d.entrance
  const term = e ? `${e.year} ${e.half === 'FIRST' ? '상반기' : '하반기'}` : ''
  return {
    owner: { ...toPerson(d.owner), visitorsNow: d.visitorsNow }, regular: d.regular, regularCount: d.regularCount, visitorsNow: d.visitorsNow,
    chatRoomId: d.chatRoomId ? toAppId(d.chatRoomId) : null, pendingRequestId: d.pendingRequestId ? toAppId(d.pendingRequestId) : null,
    spot: e ? { floor: { id: floorId(term, e.campus, e.floor), term, campus: e.campus, floor: e.floor }, seat: e.slot } : null,
    room: toSavedRoom(d.room, d.owner),
  }
}
export function toGuestbookEntry(d: GuestbookEntryDto): GuestbookEntry {
  // 앱은 ISO 문자열 그대로 들고 있음 (표시·정렬은 lib/time)
  return { id: toAppId(d.id), authorId: toPerson(d.author).id, text: d.content, createdAt: d.createdAt }
}
